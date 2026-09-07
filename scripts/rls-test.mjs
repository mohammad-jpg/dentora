// Negative tests against the live Supabase project. Run: npm run test:rls
// Signs in as real accounts and asserts that the things the 2026-09-07 audit found are
// actually blocked by the database, not just hidden by the UI. Exit code 1 on any failure.
import { createClient } from '@supabase/supabase-js'

const URL = 'https://rqvmqvuijydrjjilqhhp.supabase.co'
const KEY = 'sb_publishable__tfNXm80IGxRjG0VjfhTeQ_95At18rL'
const HARBOUR = '7a832a6c-0a60-4791-9e0a-b976ac92407b'
const ACCOUNTS = {
  harbourOwner: ['demo.harbour@dentora.ie', 'DemoHarbour2026!'],
  cocoDentist: ['sinead@cocodental.ie', 'SineadCoco2026!'],   // role: dentist (not admin) at Coco Dental
  patient: ['mary.tester@example.com', 'MaryPortal2026!'],     // portal patient at Dentora Dublin
}

let failures = 0
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); if (!cond) failures++ }
async function login([email, password]) {
  const s = createClient(URL, KEY, { auth: { persistSession: false } })
  const { error } = await s.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`login failed for ${email}: ${error.message}`)
  return s
}
const iso = (d) => d.toISOString()
const at = (dayOffset, h, m = 0) => { const d = new Date(); d.setDate(d.getDate() + dayOffset); d.setHours(h, m, 0, 0); return d }

const staff = await login(ACCOUNTS.harbourOwner)
const dentist = await login(ACCOUNTS.cocoDentist)
const patient = await login(ACCOUNTS.patient)

// ---------------------------------------------------------------- tenant isolation
{
  const { data } = await patient.from('dental_rota').select('id')
  ok('portal patient cannot read any rota rows', (data || []).length === 0, `${(data || []).length} rows`)
  const { data: own } = await patient.from('dental_patients').select('id').single()
  ok('portal patient can still read their own patient row', !!own)
  for (const t of ['dental_chart_entries', 'dental_clinical_notes', 'dental_payments', 'dental_questionnaires']) {
    const { error } = await patient.from(t).insert({ patient_id: own.id, ...(t === 'dental_chart_entries' ? { tooth: '11', condition: 'watch', status: 'existing' } : t === 'dental_clinical_notes' ? { author: 'x', body: 'x' } : t === 'dental_payments' ? { amount: 1, method: 'card' } : { data: {} }) })
    ok(`portal patient cannot insert into ${t}`, !!error)
  }
  const { data: pts } = await staff.from('dental_patients').select('clinic_id')
  ok('staff see only their own clinic\'s patients', (pts || []).every((p) => p.clinic_id === HARBOUR), `${(pts || []).length} rows`)
  const { data: rota } = await staff.from('dental_rota').select('practitioner_id')
  const { data: pr } = await staff.from('dental_practitioners').select('id').eq('clinic_id', HARBOUR)
  const mine = new Set((pr || []).map((p) => p.id))
  ok('staff see only their own clinic\'s rota', (rota || []).every((r) => mine.has(r.practitioner_id)))
}

// ---------------------------------------------------------------- role enforcement
{
  // Colleagues' membership rows are visible too, so filter to this user's own row (the same
  // bug the audit found in clinic.jsx).
  const { data: { user: du } } = await dentist.auth.getUser()
  const { data: m } = await dentist.from('dental_memberships').select('clinic_id, role').eq('user_id', du.id).limit(1).single()
  ok('fixture: Coco account is a non-admin', m?.role === 'dentist', m?.role)
  const { data: upd } = await dentist.from('dental_clinics').update({ opening_hours: 'hacked' }).eq('id', m.clinic_id).select('id')
  ok('non-admin staff cannot update clinic settings', (upd || []).length === 0)
  const { data: fee } = await dentist.from('dental_treatments').select('id, price').eq('clinic_id', m.clinic_id).limit(1).single()
  const { data: feeUpd } = await dentist.from('dental_treatments').update({ price: 1 }).eq('id', fee.id).select('id')
  ok('non-admin staff cannot change fees', (feeUpd || []).length === 0)
  const { data: fees } = await dentist.from('dental_treatments').select('id').eq('clinic_id', m.clinic_id)
  ok('non-admin staff can still read the fee schedule', (fees || []).length > 0)
  const { data: addons } = await dentist.from('dental_clinics').update({ addons: ['ortho', 'endo'] }).eq('id', m.clinic_id).select('id')
  ok('non-admin staff cannot toggle add-ons', (addons || []).length === 0)
}

// ---------------------------------------------------------------- booking integrity
{
  const { data: prac } = await staff.from('dental_practitioners').select('id').eq('clinic_id', HARBOUR).eq('active', true).limit(1).single()
  const { data: pats } = await staff.from('dental_patients').select('id').eq('clinic_id', HARBOUR).limit(2)
  const s = at(40, 10), e = at(40, 10, 30)
  const book = (patient_id, starts, ends) => staff.rpc('dental_book_appointment', {
    p_clinic_id: HARBOUR, p_patient_id: patient_id, p_practitioner_id: prac.id,
    p_starts_at: iso(starts), p_ends_at: iso(ends), p_status: 'booked', p_reason: 'rls-test', p_appointment_id: null, p_enforce_rota: false,
  })
  const first = await book(pats[0].id, s, e)
  ok('staff can book through dental_book_appointment', !first.error, first.error?.message)
  const overlap = await book(pats[1].id, at(40, 10, 15), at(40, 10, 45))
  ok('overlapping booking for the same clinician is rejected', /slot_taken/.test(overlap.error?.message || ''), overlap.error?.message)
  const [r1, r2] = await Promise.all([book(pats[0].id, at(41, 9), at(41, 9, 30)), book(pats[1].id, at(41, 9), at(41, 9, 30))])
  ok('two simultaneous bookings for the same slot: exactly one wins', [r1, r2].filter((r) => !r.error).length === 1)
  const bad = await book(pats[0].id, at(42, 10), at(42, 9))
  ok('end before start is rejected', !!bad.error)
  const { error: rawErr } = await staff.from('dental_appointments').insert({ clinic_id: HARBOUR, patient_id: pats[1].id, practitioner_id: prac.id, starts_at: iso(at(40, 10, 5)), ends_at: iso(at(40, 10, 20)), status: 'booked', reason: 'rls-test raw' })
  ok('a raw insert cannot bypass the overlap constraint either', !!rawErr, rawErr?.message)
  await staff.from('dental_appointments').delete().eq('reason', 'rls-test')
  await staff.from('dental_appointments').delete().eq('reason', 'rls-test raw')
}

// ---------------------------------------------------------------- clinical record integrity
{
  const { data: pat } = await staff.from('dental_patients').select('id').eq('clinic_id', HARBOUR).limit(1).single()
  const { data: entry } = await staff.from('dental_chart_entries').insert({ patient_id: pat.id, tooth: '11', condition: 'watch', status: 'existing', note: 'rls-test', author: 'test' }).select().single()
  const { error: delErr } = await staff.from('dental_chart_entries').delete().eq('id', entry.id)
  ok('chart entries cannot be hard-deleted', !!delErr, delErr?.message)
  const { error: editErr } = await staff.from('dental_chart_entries').update({ condition: 'caries' }).eq('id', entry.id)
  ok('chart entries cannot be edited after the fact', !!editErr, editErr?.message)
  const { error: retireErr } = await staff.from('dental_chart_entries').update({ deleted_at: new Date().toISOString(), deleted_by: 'test', deleted_reason: 'rls-test' }).eq('id', entry.id)
  ok('chart entries can be retired with attribution', !retireErr, retireErr?.message)
  const { data: after } = await staff.from('dental_chart_entries').select('deleted_at').eq('id', entry.id).single()
  ok('retired entry is still on the record', !!after?.deleted_at)
}

// ---------------------------------------------------------------- ledger
{
  const { data: pat } = await staff.from('dental_patients').select('id').eq('clinic_id', HARBOUR).limit(1).single()
  const { data: inv } = await staff.from('dental_invoices').insert({ patient_id: pat.id, number: 'RLS-TEST', issued_on: '2026-01-01', status: 'unpaid', items: [{ description: 'test', amount: 100 }], total: 100 }).select().single()
  await staff.from('dental_payments').insert({ invoice_id: inv.id, patient_id: pat.id, amount: 40, method: 'card' })
  let { data: st } = await staff.from('dental_invoices').select('status').eq('id', inv.id).single()
  ok('part payment sets invoice to part_paid via trigger', st?.status === 'part_paid', st?.status)
  const { error: lump } = await staff.from('dental_payments').insert({ patient_id: pat.id, amount: 60, method: 'write_off' })
  ok('unallocated write-off is rejected', !!lump)
  await staff.from('dental_payments').insert({ invoice_id: inv.id, patient_id: pat.id, amount: 60, method: 'write_off' })
  ;({ data: st } = await staff.from('dental_invoices').select('status').eq('id', inv.id).single())
  ok('allocated write-off settles the invoice', st?.status === 'paid', st?.status)
  await staff.from('dental_payments').delete().eq('invoice_id', inv.id)
  await staff.from('dental_invoices').delete().eq('id', inv.id)
}

// ---------------------------------------------------------------- edge functions
{
  const anon = createClient(URL, KEY, { auth: { persistSession: false } })
  const { data, error } = await anon.functions.invoke('recall-engine', { body: {} })
  let status = error?.context?.status
  ok('recall-engine refuses anonymous callers', status === 401 || status === 403 || !!data?.error, `status ${status}`)
  const { data: d2, error: e2 } = await dentist.functions.invoke('recall-engine', { body: {} })
  ok('recall-engine refuses non-admin staff', (e2?.context?.status === 403) || /owner or admin/.test(d2?.error || ''), d2?.error || e2?.context?.status)
  const { data: d3, error: e3 } = await anon.functions.invoke('checkin', { body: { action: 'load', code: '000000' } })
  ok('checkin rejects an unknown code', (e3?.context?.status === 404) || !!d3?.error)
  const { data: d4, error: e4 } = await anon.functions.invoke('signup-clinic', { body: { clinic_name: 'x', owner_name: 'x', email: 'nobody@example.com', password: 'password123' } })
  ok('signup-clinic refuses unverified signups', (e4?.context?.status === 401) || /verify/i.test(d4?.error || ''))
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed')
process.exit(failures ? 1 : 0)
