import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// v2: explicit clinic selection for multi-clinic users; owners are protected from admins
// (only an owner can reset an owner's password, change an owner's role, or remove one).
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '')
    const { data: caller, error: authErr } = await admin.auth.getUser(token)
    if (authErr || !caller?.user) return json({ error: 'You must be signed in.' }, 401)

    const { action, membership_id, password, role, clinic_id } = await req.json()
    if (!membership_id) return json({ error: 'Missing team member.' }, 400)

    let q = admin.from('dental_memberships').select('id, clinic_id, role').eq('user_id', caller.user.id)
    if (clinic_id) q = q.eq('clinic_id', clinic_id)
    const { data: me } = await q.limit(1).maybeSingle()
    if (!me || !['owner', 'admin'].includes(me.role)) {
      return json({ error: 'Only the practice owner or an admin can manage the team.' }, 403)
    }

    const { data: target } = await admin.from('dental_memberships')
      .select('*').eq('id', membership_id).eq('clinic_id', me.clinic_id).maybeSingle()
    if (!target) return json({ error: 'Team member not found in your clinic.' }, 404)

    if (target.role === 'owner' && me.role !== 'owner') {
      return json({ error: 'Only an owner can change another owner.' }, 403)
    }

    const { count: ownerCount } = await admin.from('dental_memberships')
      .select('id', { count: 'exact', head: true }).eq('clinic_id', me.clinic_id).eq('role', 'owner')

    if (action === 'remove') {
      if (target.user_id === caller.user.id) return json({ error: "You can't remove yourself." }, 400)
      if (target.role === 'owner' && (ownerCount || 0) <= 1) return json({ error: "You can't remove the only owner." }, 400)
      if (target.practitioner_id) {
        await admin.from('dental_practitioners').update({ active: false }).eq('id', target.practitioner_id)
      }
      const { error } = await admin.from('dental_memberships').delete().eq('id', target.id)
      if (error) return json({ error: error.message }, 500)
      const { count: others } = await admin.from('dental_memberships')
        .select('id', { count: 'exact', head: true }).eq('user_id', target.user_id)
      if ((others || 0) === 0) await admin.auth.admin.deleteUser(target.user_id)
      return json({ ok: true })
    }

    if (action === 'set_password') {
      if (!password || password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400)
      // A login shared with another clinic belongs to that person, not to this clinic.
      const { count: others } = await admin.from('dental_memberships')
        .select('id', { count: 'exact', head: true }).eq('user_id', target.user_id).neq('clinic_id', me.clinic_id)
      if ((others || 0) > 0) return json({ error: 'This person also belongs to another clinic — ask them to use “Forgot password” instead.' }, 400)
      const { error } = await admin.auth.admin.updateUserById(target.user_id, { password })
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true })
    }

    if (action === 'set_role') {
      const allowed = me.role === 'owner' ? ['owner', 'admin', 'staff', 'dentist'] : ['admin', 'staff', 'dentist']
      if (!allowed.includes(role)) return json({ error: 'Invalid role.' }, 400)
      if (target.role === 'owner' && role !== 'owner' && (ownerCount || 0) <= 1) return json({ error: "You can't demote the only owner." }, 400)
      const { error } = await admin.from('dental_memberships').update({ role }).eq('id', target.id)
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true })
    }

    return json({ error: 'Unknown action.' }, 400)
  } catch (e) {
    return json({ error: (e as Error).message || 'Unexpected error' }, 500)
  }
})
