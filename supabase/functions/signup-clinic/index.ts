import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// v3: email verification is mandatory (no unverified createUser fallback); defaults come from
// immutable snapshot tables; provisioning cleans up after itself on failure.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  let clinicId: string | null = null
  try {
    const { clinic_name, address, phone, owner_name, email, password, surgeries } = await req.json()
    if (!clinic_name?.trim() || !owner_name?.trim() || !email?.trim() || !password) {
      return json({ error: 'Clinic name, your name, email and password are required.' }, 400)
    }
    if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400)
    const emailNorm = email.trim().toLowerCase()

    // The caller must hold a session created by verifying the email code for this exact address.
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '')
    const { data: caller } = await admin.auth.getUser(token)
    if (!caller?.user || caller.user.email?.toLowerCase() !== emailNorm) {
      return json({ error: 'Please verify your email address first — request a new code and try again.' }, 401)
    }
    const { count } = await admin.from('dental_memberships').select('id', { count: 'exact', head: true }).eq('user_id', caller.user.id)
    if ((count || 0) > 0) return json({ error: 'This email already runs a clinic — sign in instead.' }, 400)
    const { error: pe } = await admin.auth.admin.updateUserById(caller.user.id, { password, user_metadata: { name: owner_name } })
    if (pe) return json({ error: pe.message }, 500)
    const userId = caller.user.id

    const { data: clinic, error: ce } = await admin.from('dental_clinics')
      .insert({ name: clinic_name.trim(), address: address || null, phone: phone || null, email: emailNorm, plan: 'trial' })
      .select().single()
    if (ce) return json({ error: ce.message }, 500)
    clinicId = clinic.id

    const { data: prac, error: pre } = await admin.from('dental_practitioners')
      .insert({ name: owner_name, role: 'Principal Dentist', color: '#0E7C7B', clinic_id: clinic.id })
      .select().single()
    if (pre) throw pre

    const { error: me } = await admin.from('dental_memberships').insert({
      user_id: userId, clinic_id: clinic.id, role: 'owner', display_name: owner_name, email: emailNorm, practitioner_id: prac.id,
    })
    if (me) throw me

    const names: string[] = Array.isArray(surgeries) && surgeries.length ? surgeries : ['Surgery 1']
    const { data: surg, error: se } = await admin.from('dental_surgeries')
      .insert(names.map((n: string, i: number) => ({ clinic_id: clinic.id, name: String(n).trim() || `Surgery ${i + 1}`, sort: i + 1 })))
      .select()
    if (se) throw se

    const { error: re } = await admin.from('dental_rota').insert(
      [0, 1, 2, 3, 4].map((wd) => ({ practitioner_id: prac.id, weekday: wd, clinic: clinic.name, room: surg[0].name, status: 'working' }))
    )
    if (re) throw re

    const { data: fees } = await admin.from('dental_default_fees').select('code,name,category,price,duration_min')
    if (fees?.length) {
      const { error } = await admin.from('dental_treatments').insert(fees.map((f) => ({ ...f, clinic_id: clinic.id })))
      if (error) throw error
    }
    const { data: tpls } = await admin.from('dental_default_templates').select('kind,key,label,body')
    const msgs = (tpls || []).filter((t) => t.kind === 'message')
    const notes = (tpls || []).filter((t) => t.kind === 'note')
    if (msgs.length) {
      const { error } = await admin.from('dental_message_templates').insert(msgs.map((m) => ({ clinic_id: clinic.id, key: m.key, label: m.label, body: m.body })))
      if (error) throw error
    }
    if (notes.length) {
      const { error } = await admin.from('dental_note_templates').insert(notes.map((n) => ({ clinic_id: clinic.id, name: n.key, body: n.body })))
      if (error) throw error
    }

    return json({ ok: true, clinic_id: clinic.id })
  } catch (e) {
    // Roll back a half-provisioned clinic so the user can retry cleanly.
    if (clinicId) {
      const { data: pracs } = await admin.from('dental_practitioners').select('id').eq('clinic_id', clinicId)
      if (pracs?.length) await admin.from('dental_rota').delete().in('practitioner_id', pracs.map((p) => p.id))
      for (const t of ['dental_memberships', 'dental_treatments', 'dental_message_templates', 'dental_note_templates', 'dental_surgeries', 'dental_practitioners']) {
        await admin.from(t).delete().eq('clinic_id', clinicId)
      }
      await admin.from('dental_clinics').delete().eq('id', clinicId)
    }
    return json({ error: (e as Error).message || 'Unexpected error' }, 500)
  }
})
