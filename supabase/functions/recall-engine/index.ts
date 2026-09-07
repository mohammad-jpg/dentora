import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-recall-secret',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const BOOK_URL = 'https://mohammad-jpg.github.io/dentora/'

const DEFAULTS: Record<string, string> = {
  recall_week: 'Hi {name}, your {type} at {clinic} is due next week. Book online in 1 minute: {link} or call {phone}.',
  recall_tomorrow: 'Hi {name}, a reminder that your {type} at {clinic} is due tomorrow. Not booked yet? {link} or call {phone}.',
  appt_reminder: 'Hi {name}, a reminder of your appointment tomorrow at {time} at {clinic}. Need to change it? {link} or call {phone}.',
}

function fill(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
}

// Returns { ok, detail }. Failures are logged and never marked as delivered.
async function sendSms(live: boolean, p: any, body: string, admin: any): Promise<{ ok: boolean; detail?: string }> {
  const sid = Deno.env.get('TWILIO_SID'), tok = Deno.env.get('TWILIO_TOKEN'), from = Deno.env.get('TWILIO_FROM')
  if (!live) {
    await admin.from('dental_comms_log').insert({ patient_id: p.id, channel: 'sms', body: '[demo] ' + body })
    return { ok: true }
  }
  if (!p.phone) {
    await admin.from('dental_comms_log').insert({ patient_id: p.id, channel: 'sms', body: '[failed: no phone number] ' + body })
    return { ok: false, detail: 'no phone' }
  }
  const num = String(p.phone).replace(/\s+/g, '').replace(/^0/, '+353')
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + btoa(`${sid}:${tok}`), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: num, From: from!, Body: body }),
    })
    if (!res.ok) {
      const txt = (await res.text()).slice(0, 200)
      await admin.from('dental_comms_log').insert({ patient_id: p.id, channel: 'sms', body: `[failed: ${res.status}] ` + body })
      return { ok: false, detail: txt }
    }
    await admin.from('dental_comms_log').insert({ patient_id: p.id, channel: 'sms', body })
    return { ok: true }
  } catch (e) {
    await admin.from('dental_comms_log').insert({ patient_id: p.id, channel: 'sms', body: '[failed: network] ' + body })
    return { ok: false, detail: (e as Error).message }
  }
}

// v5: caller authorisation. The scheduler presents a secret only the database and this
// function can read and processes every clinic; a signed-in owner/admin may run it for
// their own clinic only. Each reminder is claimed atomically before sending so concurrent
// runs cannot double-text, and a failed send is never marked as delivered.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    let clinicScope: string[] | null = null  // null = all clinics (scheduler)
    const secretHeader = req.headers.get('x-recall-secret') || ''
    const { data: secretRow } = await admin.from('dental_secrets').select('value').eq('key', 'recall_engine').maybeSingle()
    if (secretRow?.value && secretHeader && secretHeader === secretRow.value) {
      clinicScope = null
    } else {
      const token = (req.headers.get('Authorization') || '').replace('Bearer ', '')
      const { data: caller } = await admin.auth.getUser(token)
      if (!caller?.user) return json({ error: 'Not authorised.' }, 401)
      let requested: string | null = null
      try { requested = (await req.json())?.clinic_id || null } catch { /* empty body */ }
      const { data: ms } = await admin.from('dental_memberships').select('clinic_id, role').eq('user_id', caller.user.id).in('role', ['owner', 'admin'])
      const allowed = (ms || []).map((m) => m.clinic_id)
      if (!allowed.length) return json({ error: 'Only a practice owner or admin can run the recall engine.' }, 403)
      if (requested && !allowed.includes(requested)) return json({ error: 'Not authorised for that clinic.' }, 403)
      clinicScope = requested ? [requested] : [allowed[0]]
    }

    const today = new Date().toISOString().slice(0, 10)
    const plus = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10)
    const live = !!(Deno.env.get('TWILIO_SID') && Deno.env.get('TWILIO_TOKEN') && Deno.env.get('TWILIO_FROM'))
    const inScope = (clinicId: string | null) => clinicScope === null || (clinicId != null && clinicScope.includes(clinicId))

    const { data: tpls } = await admin.from('dental_message_templates').select('clinic_id, key, body')
    const tpl = (clinicId: string | null, key: string) =>
      (tpls || []).find((t) => t.clinic_id === clinicId && t.key === key)?.body || DEFAULTS[key]

    let recallsSent = 0, remindersSent = 0, cyclesCreated = 0, failed = 0

    // Recalls at exactly D-7 and D-1. Claim first (atomic), send, then confirm.
    const { data: due } = await admin.from('dental_recalls')
      .select('id, recall_type, due_date, last_reminded_on, patient:dental_patients(id, first_name, phone, archived, clinic_id, clinic:dental_clinics(name, phone))')
      .in('status', ['due', 'contacted'])
      .in('due_date', [plus(7), plus(1)])
    for (const r of due || []) {
      const p = r.patient as any
      if (!p || p.archived || !inScope(p.clinic_id)) continue
      const { data: claimed } = await admin.from('dental_recalls').update({ last_reminded_on: today })
        .eq('id', r.id).or(`last_reminded_on.is.null,last_reminded_on.neq.${today}`).select('id')
      if (!claimed?.length) continue
      const key = r.due_date === plus(1) ? 'recall_tomorrow' : 'recall_week'
      const body = fill(tpl(p.clinic_id, key), {
        name: p.first_name, type: String(r.recall_type).toLowerCase(),
        clinic: p.clinic?.name || 'your dental clinic', phone: p.clinic?.phone || 'the practice', link: BOOK_URL,
      })
      const sent = await sendSms(live, p, body, admin)
      if (sent.ok) { await admin.from('dental_recalls').update({ status: 'contacted' }).eq('id', r.id); recallsSent++ }
      else { await admin.from('dental_recalls').update({ last_reminded_on: r.last_reminded_on }).eq('id', r.id); failed++ }
    }

    // Appointment reminders for tomorrow.
    const { data: appts } = await admin.from('dental_appointments')
      .select('id, starts_at, reason, reminded_on, clinic_id, patient:dental_patients(id, first_name, phone, archived, clinic_id, clinic:dental_clinics(name, phone))')
      .in('status', ['booked', 'confirmed'])
      .gte('starts_at', `${plus(1)}T00:00:00Z`).lte('starts_at', `${plus(1)}T23:59:59Z`)
    for (const a of appts || []) {
      const p = a.patient as any
      if (!p || p.archived || !inScope(a.clinic_id)) continue
      const { data: claimed } = await admin.from('dental_appointments').update({ reminded_on: today })
        .eq('id', a.id).or(`reminded_on.is.null,reminded_on.neq.${today}`).select('id')
      if (!claimed?.length) continue
      const time = new Date(a.starts_at).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Dublin' })
      const body = fill(tpl(p.clinic_id, 'appt_reminder'), {
        name: p.first_name, time, clinic: p.clinic?.name || 'your dental clinic', phone: p.clinic?.phone || 'the practice', link: BOOK_URL,
      })
      const sent = await sendSms(live, p, body, admin)
      if (sent.ok) remindersSent++
      else { await admin.from('dental_appointments').update({ reminded_on: a.reminded_on }).eq('id', a.id); failed++ }
    }

    // Recall cycles: a completed visit in the last 7 days schedules the next recall.
    const { data: done } = await admin.from('dental_appointments')
      .select('id, starts_at, clinic_id, patient:dental_patients(id, first_name, archived, recall_months)')
      .eq('status', 'completed')
      .gte('starts_at', new Date(Date.now() - 7 * 86400000).toISOString())
    const seen = new Set<string>()
    for (const a of done || []) {
      const p = a.patient as any
      if (!p || p.archived || !p.recall_months || seen.has(p.id) || !inScope(a.clinic_id)) continue
      seen.add(p.id)
      const { count } = await admin.from('dental_recalls')
        .select('id', { count: 'exact', head: true })
        .eq('patient_id', p.id).in('status', ['due', 'contacted', 'booked'])
      if ((count || 0) > 0) continue
      const dueDate = new Date(new Date(a.starts_at).getTime())
      dueDate.setMonth(dueDate.getMonth() + p.recall_months)
      const { error } = await admin.from('dental_recalls').insert({
        patient_id: p.id, recall_type: 'Exam & Clean', due_date: dueDate.toISOString().slice(0, 10), status: 'due',
      })
      if (!error) cyclesCreated++
    }

    return json({ ok: true, recalls: recallsSent, reminders: remindersSent, cycles_created: cyclesCreated, failed, scope: clinicScope ? 'clinic' : 'all', mode: live ? 'live' : 'demo' })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
