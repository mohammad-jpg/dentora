import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const COLORS = ['#0E7C7B', '#7C5CBF', '#E07A3F', '#2F6FD6', '#2E9E6B', '#C98A12', '#D64550']
const CLINICAL = ['Principal Dentist', 'Associate Dentist', 'Dentist', 'Hygienist', 'Orthodontist', 'Endodontist']

// v3: explicit clinic selection; an existing login can be added to a second clinic instead of
// failing; a failed provisioning removes the login it just created.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  let createdUserId: string | null = null
  try {
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '')
    const { data: caller, error: authErr } = await admin.auth.getUser(token)
    if (authErr || !caller?.user) return json({ error: 'You must be signed in to add team members.' }, 401)

    const { name, role, email, password, is_admin, clinic_id } = await req.json()
    let q = admin.from('dental_memberships').select('clinic_id, role').eq('user_id', caller.user.id)
    if (clinic_id) q = q.eq('clinic_id', clinic_id)
    const { data: membership } = await q.limit(1).maybeSingle()
    if (!membership) return json({ error: 'No clinic found for your account.' }, 403)
    if (!['owner', 'admin'].includes(membership.role)) {
      return json({ error: 'Only the practice owner or an admin can add team members.' }, 403)
    }
    if (!name?.trim() || !role || !email?.trim() || !password) {
      return json({ error: 'Name, role, email and password are all required.' }, 400)
    }
    if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400)
    const emailNorm = email.trim().toLowerCase()

    const { data: clinic } = await admin.from('dental_clinics').select('name').eq('id', membership.clinic_id).single()

    const { data: created, error: ue } = await admin.auth.admin.createUser({
      email: emailNorm, password, email_confirm: true, user_metadata: { name },
    })
    if (ue) {
      const msg = /already/i.test(ue.message) ? 'That email already has a Dentora login. Ask them to sign in and use “Forgot password” if needed, then contact support to link them to this clinic.' : ue.message
      return json({ error: msg }, 400)
    }
    createdUserId = created.user.id

    const isClinician = CLINICAL.includes(role)
    let practitionerId: string | null = null
    if (isClinician) {
      const { count } = await admin.from('dental_practitioners')
        .select('id', { count: 'exact', head: true }).eq('clinic_id', membership.clinic_id)
      const { data: prac, error: pe } = await admin.from('dental_practitioners')
        .insert({ name, role, color: COLORS[(count || 0) % COLORS.length], clinic_id: membership.clinic_id })
        .select().single()
      if (pe) throw pe
      practitionerId = prac.id
      const { data: surg } = await admin.from('dental_surgeries')
        .select('name').eq('clinic_id', membership.clinic_id).order('sort').limit(1)
      if (surg?.length) {
        const { error: re } = await admin.from('dental_rota').insert(
          [0, 1, 2, 3, 4].map((wd) => ({ practitioner_id: prac.id, weekday: wd, clinic: clinic?.name || null, room: surg[0].name, status: 'working' }))
        )
        if (re) throw re
      }
    }

    const { error: me } = await admin.from('dental_memberships').insert({
      user_id: created.user.id, clinic_id: membership.clinic_id,
      role: is_admin ? 'admin' : isClinician ? 'dentist' : 'staff',
      display_name: name, email: emailNorm, practitioner_id: practitionerId,
    })
    if (me) throw me

    return json({ ok: true })
  } catch (e) {
    if (createdUserId) {
      await admin.from('dental_memberships').delete().eq('user_id', createdUserId)
      await admin.auth.admin.deleteUser(createdUserId)
    }
    return json({ error: (e as Error).message || 'Unexpected error' }, 500)
  }
})
