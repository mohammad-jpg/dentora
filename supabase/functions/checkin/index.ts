import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// Waiting-room tablet check-in. The tablet is never signed in: reception creates a short-lived
// 6-digit code for one patient; the kiosk page exchanges it for the patient's first name and,
// on submit, stores the questionnaire for clinician review. Codes expire after 30 minutes and
// can be used once.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { action, code, data } = await req.json()
    const token = String(code || '').replace(/\D/g, '')
    if (token.length !== 6) return json({ error: 'Enter the 6-digit code from reception.' }, 400)

    const { data: sess } = await admin.from('dental_checkin_sessions')
      .select('id, clinic_id, patient_id, expires_at, used_at').eq('token', token).maybeSingle()
    if (!sess || sess.used_at || new Date(sess.expires_at).getTime() < Date.now()) {
      return json({ error: 'That code has expired — ask reception for a new one.' }, 404)
    }

    if (action === 'load') {
      const { data: p } = await admin.from('dental_patients').select('first_name').eq('id', sess.patient_id).single()
      const { data: c } = await admin.from('dental_clinics').select('name').eq('id', sess.clinic_id).single()
      return json({ ok: true, first_name: p?.first_name || '', clinic_name: c?.name || '' })
    }

    if (action === 'submit') {
      if (!data || typeof data !== 'object' || !data.consent || !String(data.signature || '').trim()) {
        return json({ error: 'Please confirm the declaration and sign before submitting.' }, 400)
      }
      const { data: claimed } = await admin.from('dental_checkin_sessions')
        .update({ used_at: new Date().toISOString() }).eq('id', sess.id).is('used_at', null).select('id')
      if (!claimed?.length) return json({ error: 'That code has already been used.' }, 409)
      const { error } = await admin.from('dental_questionnaires').insert({ patient_id: sess.patient_id, data, source: 'kiosk' })
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true })
    }

    return json({ error: 'Unknown action.' }, 400)
  } catch (e) {
    return json({ error: (e as Error).message || 'Unexpected error' }, 500)
  }
})
