import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const DAY_START = 9, DAY_END = 17, SLOT_MIN = 30

function dublinOffset(dateStr: string): string {
  const probe = new Date(`${dateStr}T12:00:00Z`)
  const part = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Dublin', timeZoneName: 'shortOffset' })
    .formatToParts(probe).find((p) => p.type === 'timeZoneName')?.value || 'GMT'
  const m = part.match(/GMT([+-]\d+)/)
  const h = m ? parseInt(m[1]) : 0
  const sign = h < 0 ? '-' : '+'
  return `${sign}${String(Math.abs(h)).padStart(2, '0')}:00`
}

function slotIso(dateStr: string, minsFromMidnight: number, off: string): string {
  const h = Math.floor(minsFromMidnight / 60), m = minsFromMidnight % 60
  return `${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00${off}`
}

// v4: signup requires a verified session; booking goes through the transactional
// dental_book_appointment() function (rota, hours, grid, lead time and overlap are all
// enforced in the database); medical history is stored for clinician review and no
// longer overwrites medical alerts.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const body = await req.json()
    const action = body.action
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '')
    const { data: caller, error: authErr } = await admin.auth.getUser(token)

    if (action === 'signup') {
      const { full_name, email, phone, password } = body
      if (!full_name?.trim() || !email?.trim() || !password) return json({ error: 'Name, email and password are required.' }, 400)
      if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400)
      if (!caller?.user || caller.user.email?.toLowerCase() !== email.trim().toLowerCase()) {
        return json({ error: 'Please verify your email address first — request a new code and try again.' }, 401)
      }
      const { data: existing } = await admin.from('dental_portal_profiles').select('user_id').eq('user_id', caller.user.id).maybeSingle()
      if (existing) return json({ error: 'You already have an account — sign in instead.' }, 400)
      const { error: pe } = await admin.auth.admin.updateUserById(caller.user.id, { password, user_metadata: { name: full_name, portal: true } })
      if (pe) return json({ error: pe.message }, 500)
      const { error: ie } = await admin.from('dental_portal_profiles').insert({
        user_id: caller.user.id, full_name: full_name.trim(), phone: phone || null, email: email.trim().toLowerCase(),
      })
      if (ie) return json({ error: ie.message }, 500)
      return json({ ok: true })
    }

    if (authErr || !caller?.user) return json({ error: 'Please sign in first.' }, 401)
    const uid = caller.user.id

    if (action === 'slots') {
      const { practitioner_id, date } = body
      if (!practitioner_id || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return json({ error: 'Missing practitioner or date.' }, 400)
      const weekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7
      if (weekday > 4) return json({ slots: [] })
      const { data: prac } = await admin.from('dental_practitioners').select('id, active').eq('id', practitioner_id).maybeSingle()
      if (!prac?.active) return json({ slots: [] })
      const { data: rota } = await admin.from('dental_rota').select('status')
        .eq('practitioner_id', practitioner_id).eq('weekday', weekday).maybeSingle()
      if (!rota || rota.status !== 'working') return json({ slots: [] })
      const off = dublinOffset(date)
      const dayStart = new Date(slotIso(date, 0, off)).getTime()
      const dayEnd = new Date(slotIso(date, 24 * 60 - 1, off)).getTime()
      const { data: appts } = await admin.from('dental_appointments')
        .select('starts_at, ends_at, status').eq('practitioner_id', practitioner_id)
        .gte('starts_at', new Date(dayStart).toISOString()).lte('starts_at', new Date(dayEnd).toISOString())
        .neq('status', 'cancelled')
      const now = Date.now()
      const slots: string[] = []
      for (let mins = DAY_START * 60; mins < DAY_END * 60; mins += SLOT_MIN) {
        const s = new Date(slotIso(date, mins, off)).getTime()
        const e = s + SLOT_MIN * 60000
        if (s < now + 30 * 60000) continue
        const clash = (appts || []).some((a) => {
          const as = new Date(a.starts_at).getTime(), ae = new Date(a.ends_at).getTime()
          return s < ae && e > as
        })
        if (!clash) slots.push(`${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`)
      }
      return json({ slots })
    }

    if (action === 'book') {
      const { clinic_id, practitioner_id, date, time, kind, reason } = body
      if (!clinic_id || !practitioner_id || !date || !time || !reason?.trim()) return json({ error: 'Missing booking details.' }, 400)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return json({ error: 'Invalid date or time.' }, 400)
      const { data: prac } = await admin.from('dental_practitioners').select('id, clinic_id, active').eq('id', practitioner_id).maybeSingle()
      if (!prac || prac.clinic_id !== clinic_id || !prac.active) return json({ error: 'That clinician is not available at this clinic.' }, 400)
      const off = dublinOffset(date)
      const start = new Date(`${date}T${time}:00${off}`)
      if (isNaN(start.getTime())) return json({ error: 'Invalid date or time.' }, 400)
      const end = new Date(start.getTime() + SLOT_MIN * 60000)
      const { data: prof } = await admin.from('dental_portal_profiles').select('*').eq('user_id', uid).single()
      if (!prof) return json({ error: 'No patient profile found for your account.' }, 400)
      let { data: link } = await admin.from('dental_portal_links').select('patient_id').eq('user_id', uid).eq('clinic_id', clinic_id).maybeSingle()
      if (!link) {
        const parts = prof.full_name.trim().split(/\s+/)
        const first = parts.slice(0, -1).join(' ') || parts[0]
        const last = parts.length > 1 ? parts[parts.length - 1] : '(portal)'
        const { data: patient, error: pe } = await admin.from('dental_patients')
          .insert({ first_name: first, last_name: last, phone: prof.phone, email: prof.email, clinic_id, notes: 'Registered via online booking' })
          .select().single()
        if (pe) return json({ error: pe.message }, 500)
        const { error: le } = await admin.from('dental_portal_links').insert({ user_id: uid, clinic_id, patient_id: patient.id })
        if (le) return json({ error: le.message }, 500)
        link = { patient_id: patient.id }
      }
      const prefix = kind === 'video' ? '[Video] ' : '[Online] '
      const { data: appt, error: ae } = await admin.rpc('dental_book_appointment', {
        p_clinic_id: clinic_id, p_patient_id: link.patient_id, p_practitioner_id: practitioner_id,
        p_starts_at: start.toISOString(), p_ends_at: end.toISOString(), p_status: 'booked',
        p_reason: (prefix + reason.trim()).slice(0, 200), p_appointment_id: null, p_enforce_rota: true,
      })
      if (ae) {
        if (/slot_taken/.test(ae.message)) return json({ error: 'Sorry — that slot was just taken. Pick another.' }, 409)
        return json({ error: ae.message }, 400)
      }
      return json({ ok: true, appointment: appt })
    }

    if (action === 'cancel') {
      const { appointment_id } = body
      const { data: links } = await admin.from('dental_portal_links').select('patient_id').eq('user_id', uid)
      const mine = (links || []).map((l) => l.patient_id)
      const { data: appt } = await admin.from('dental_appointments').select('id, patient_id, starts_at, status').eq('id', appointment_id).maybeSingle()
      if (!appt || !mine.includes(appt.patient_id)) return json({ error: 'Appointment not found.' }, 404)
      if (['completed', 'arrived'].includes(appt.status) || new Date(appt.starts_at).getTime() < Date.now()) {
        return json({ error: 'This appointment can no longer be cancelled online — please call the practice.' }, 400)
      }
      const { error } = await admin.from('dental_appointments').update({ status: 'cancelled' }).eq('id', appointment_id)
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true })
    }

    if (action === 'medical_history') {
      const dataForm = body.data
      if (!dataForm || typeof dataForm !== 'object') return json({ error: 'Missing form data.' }, 400)
      const { data: links } = await admin.from('dental_portal_links').select('patient_id').eq('user_id', uid)
      if (!links?.length) return json({ error: 'Book your first appointment before filling in medical history.' }, 400)
      for (const l of links) {
        const { error } = await admin.from('dental_questionnaires').insert({ patient_id: l.patient_id, data: dataForm, source: 'portal' })
        if (error) return json({ error: error.message }, 500)
      }
      return json({ ok: true })
    }

    return json({ error: 'Unknown action.' }, 400)
  } catch (e) {
    return json({ error: (e as Error).message || 'Unexpected error' }, 500)
  }
})
