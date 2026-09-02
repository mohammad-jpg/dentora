import { useEffect, useState } from 'react'
import { sb, euro } from '../supabase.js'
import { Modal, useToast } from '../ui.jsx'
import { useClinic } from '../clinic.jsx'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

export default function Settings() {
  const { clinic, clinicId, role, reload } = useClinic()
  const [treatments, setTreatments] = useState([])
  const [pracs, setPracs] = useState([])
  const [surgeries, setSurgeries] = useState([])
  const [members, setMembers] = useState([])
  const [inviting, setInviting] = useState(false)
  const toast = useToast()

  const load = () => {
    sb.from('dental_treatments').select('*').order('category').order('name').then(({ data }) => setTreatments(data || []))
    sb.from('dental_practitioners').select('*').eq('clinic_id', clinicId).order('name').then(({ data }) => setPracs(data || []))
    sb.from('dental_surgeries').select('*').order('sort').then(({ data }) => setSurgeries(data || []))
    sb.from('dental_memberships').select('*').eq('clinic_id', clinicId).then(({ data }) => setMembers(data || []))
  }
  useEffect(() => { load() }, [clinicId])

  const updatePrice = async (t, price) => {
    if (Number(price) === Number(t.price)) return
    await sb.from('dental_treatments').update({ price: Number(price) }).eq('id', t.id)
    toast(`${t.name}: ${euro(price)}`)
    load()
  }

  const saveClinic = async (patch) => {
    const { error } = await sb.from('dental_clinics').update(patch).eq('id', clinicId)
    if (error) return toast('Error: ' + error.message)
    toast('Practice details saved')
    reload()
  }

  const addSurgery = async () => {
    const name = `Surgery ${surgeries.length + 1}`
    await sb.from('dental_surgeries').insert({ clinic_id: clinicId, name, sort: surgeries.length + 1 })
    toast(`${name} added`)
    load()
  }
  const renameSurgery = async (s, name) => {
    if (!name.trim() || name === s.name) return
    await sb.from('dental_surgeries').update({ name: name.trim() }).eq('id', s.id)
    await sb.from('dental_rota').update({ room: name.trim() }).eq('room', s.name)
    load()
  }
  const removeSurgery = async (s) => {
    await sb.from('dental_surgeries').delete().eq('id', s.id)
    toast(`${s.name} removed`)
    load()
  }

  const invite = async (form) => {
    const { data, error } = await sb.functions.invoke('invite-staff', { body: form })
    if (error || data?.error) {
      let msg = data?.error || 'Could not add team member.'
      if (error?.context) { try { msg = (await error.context.json())?.error || msg } catch { /* keep */ } }
      return toast(msg)
    }
    toast(`${form.name} added — they can sign in with ${form.email}`)
    setInviting(false)
    load()
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-sub">{clinic.name} · practice, team, surgeries, rota & fees</div>
        </div>
      </div>
      <div className="content grid" style={{ gap: 18 }}>
        <RotaCard pracs={pracs} surgeries={surgeries} />
        <div className="grid" style={{ gridTemplateColumns: '1fr 1.5fr', alignItems: 'start' }}>
          <div className="grid" style={{ gap: 16 }}>
            <PracticeCard clinic={clinic} onSave={saveClinic} />

            <TeamCard members={members} canManage={['owner', 'admin'].includes(role)} onInvite={() => setInviting(true)} onChanged={load} />

            <div className="card card-pad">
              <div className="card-title">
                Surgeries
                <button className="btn sm" onClick={addSurgery}>+ Add surgery</button>
              </div>
              <div className="grid" style={{ gap: 8 }}>
                {surgeries.map((s) => (
                  <div className="row" key={s.id}>
                    <input className="input" defaultValue={s.name} onBlur={(e) => renameSurgery(s, e.target.value)} />
                    {surgeries.length > 1 && <button className="btn ghost sm" onClick={() => removeSurgery(s)}>✕</button>}
                  </div>
                ))}
              </div>
            </div>

            <TemplatesCard clinicId={clinicId} />

            <CliniciansCard pracs={pracs} clinicId={clinicId} canManage={['owner', 'admin'].includes(role)} onChanged={load} />
          </div>

          <div className="card">
            <div className="card-pad card-title" style={{ marginBottom: 0 }}>Fee schedule — edit prices inline</div>
            <table className="tbl">
              <thead><tr><th>Code</th><th>Treatment</th><th>Category</th><th>Duration</th><th>Price (€)</th></tr></thead>
              <tbody>
                {treatments.map((t) => (
                  <tr key={t.id}>
                    <td className="mono muted">{t.code}</td>
                    <td style={{ fontWeight: 500 }}>{t.name}</td>
                    <td><span className="badge b-gray">{t.category}</span></td>
                    <td className="muted">{t.duration_min} min</td>
                    <td style={{ width: 110 }}>
                      <input type="number" className="input" defaultValue={Number(t.price)} min="0" step="5"
                        onBlur={(e) => updatePrice(t, e.target.value)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {inviting && <InviteModal onSave={invite} onClose={() => setInviting(false)} />}
    </>
  )
}

function TeamCard({ members, canManage, onInvite, onChanged }) {
  const [busyId, setBusyId] = useState(null)
  const [pwFor, setPwFor] = useState(null) // membership being given a new password
  const [pw, setPw] = useState('')
  const [removeFor, setRemoveFor] = useState(null)
  const toast = useToast()

  const call = async (m, body, okMsg) => {
    setBusyId(m.id)
    const { data, error } = await sb.functions.invoke('manage-staff', { body: { membership_id: m.id, ...body } })
    setBusyId(null)
    if (error || data?.error) {
      let msg = data?.error || 'Something went wrong.'
      if (error?.context) { try { msg = (await error.context.json())?.error || msg } catch { /* keep */ } }
      return toast(msg)
    }
    toast(okMsg)
    setPwFor(null); setPw(''); setRemoveFor(null)
    onChanged()
  }

  const roleBadge = { owner: 'b-teal', admin: 'b-violet', dentist: 'b-blue', staff: 'b-gray' }

  return (
    <div className="card card-pad">
      <div className="card-title">
        Team
        {canManage && <button className="btn sm" onClick={onInvite}>+ Add team member</button>}
      </div>
      <div className="grid" style={{ gap: 10 }}>
        {members.map((m) => (
          <div key={m.id} style={{ padding: '10px 12px', background: 'var(--mint-bg)', borderRadius: 10 }}>
            <div className="spread">
              <div>
                <div style={{ fontWeight: 600 }}>{m.display_name || m.email}</div>
                <div className="small muted">{m.email}</div>
              </div>
              <span className={`badge ${roleBadge[m.role] || 'b-gray'}`}>{m.role}</span>
            </div>
            {canManage && m.role !== 'owner' && (
              <div className="row" style={{ marginTop: 8, flexWrap: 'wrap', gap: 6 }}>
                <button className="btn ghost sm" disabled={busyId === m.id} onClick={() => { setPwFor(m); setPw('') }}>New password</button>
                {m.role === 'admin'
                  ? <button className="btn ghost sm" disabled={busyId === m.id}
                      onClick={() => call(m, { action: 'set_role', role: m.practitioner_id ? 'dentist' : 'staff' }, 'Admin access removed')}>Remove admin</button>
                  : <button className="btn ghost sm" disabled={busyId === m.id}
                      onClick={() => call(m, { action: 'set_role', role: 'admin' }, `${m.display_name || m.email} can now manage the team`)}>Make admin</button>}
                <button className="btn ghost sm" style={{ color: 'var(--red)' }} disabled={busyId === m.id} onClick={() => setRemoveFor(m)}>Remove</button>
              </div>
            )}
          </div>
        ))}
      </div>
      {!canManage && <p className="small muted" style={{ marginTop: 10 }}>Only the practice owner or an admin can manage the team.</p>}

      {pwFor && (
        <Modal title={`New password — ${pwFor.display_name || pwFor.email}`} onClose={() => setPwFor(null)}>
          <label className="field">Set their new password (8+ characters — share it with them)</label>
          <input className="input" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
          <div className="actions">
            <button className="btn secondary" onClick={() => setPwFor(null)}>Cancel</button>
            <button className="btn" disabled={pw.length < 8} onClick={() => call(pwFor, { action: 'set_password', password: pw }, 'Password updated')}>Save password</button>
          </div>
        </Modal>
      )}
      {removeFor && (
        <Modal title={`Remove ${removeFor.display_name || removeFor.email}?`} onClose={() => setRemoveFor(null)}>
          <p className="small" style={{ color: 'var(--ink-60)' }}>
            Their login stops working immediately and their diary column is retired. All their past
            appointments, notes and treatments stay on the patient records — nothing clinical is deleted.
          </p>
          <div className="actions">
            <button className="btn secondary" onClick={() => setRemoveFor(null)}>Cancel</button>
            <button className="btn danger" onClick={() => call(removeFor, { action: 'remove' }, 'Team member removed')}>Remove from team</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function CliniciansCard({ pracs, clinicId, canManage, onChanged }) {
  const [editing, setEditing] = useState(null) // practitioner being edited, or {new: true}
  const toast = useToast()

  const save = async () => {
    const payload = { name: editing.name.trim(), role: editing.role, color: editing.color, active: editing.active }
    if (!payload.name) return
    const q = editing.id
      ? sb.from('dental_practitioners').update(payload).eq('id', editing.id)
      : sb.from('dental_practitioners').insert({ ...payload, clinic_id: clinicId })
    const { error } = await q
    if (error) return toast('Error: ' + error.message)
    toast(editing.id ? 'Clinician updated' : `${payload.name} added to the diary`)
    setEditing(null)
    onChanged()
  }

  return (
    <div className="card card-pad">
      <div className="card-title">
        Clinicians & diary columns
        {canManage && <button className="btn sm" onClick={() => setEditing({ new: true, name: '', role: 'Associate Dentist', color: '#2F6FD6', active: true })}>+ Add (no login)</button>}
      </div>
      <div className="grid" style={{ gap: 10 }}>
        {pracs.map((p) => (
          <div key={p.id} className="spread" style={{ padding: '8px 10px', background: 'var(--mint-bg)', borderRadius: 10, opacity: p.active ? 1 : 0.55 }}>
            <div className="row">
              <span className="swatch" style={{ background: p.color, borderRadius: 99 }} />
              <div>
                <div style={{ fontWeight: 600 }}>{p.name} {!p.active && <span className="badge b-gray">hidden from diary</span>}</div>
                <div className="small muted">{p.role}</div>
              </div>
            </div>
            {canManage && <button className="btn ghost sm" onClick={() => setEditing({ ...p })}>Edit</button>}
          </div>
        ))}
      </div>
      <p className="small muted" style={{ marginTop: 10 }}>
        "Add team member" above creates a login + diary column together; "+ Add (no login)" is for locums or
        clinicians who don't need their own sign-in.
      </p>

      {editing && (
        <Modal title={editing.id ? `Edit ${editing.name}` : 'Add clinician'} onClose={() => setEditing(null)}>
          <div className="grid" style={{ gap: 12 }}>
            <div><label className="field">Name</label>
              <input className="input" value={editing.name} onChange={(e) => setEditing((x) => ({ ...x, name: e.target.value }))} autoFocus /></div>
            <div className="form-grid">
              <div>
                <label className="field">Role</label>
                <select className="input" value={editing.role} onChange={(e) => setEditing((x) => ({ ...x, role: e.target.value }))}>
                  {['Principal Dentist', 'Associate Dentist', 'Hygienist', 'Orthodontist', 'Locum Dentist', 'Dental Nurse'].map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="field">Diary colour</label>
                <input type="color" className="input" style={{ height: 40, padding: 4 }} value={editing.color}
                  onChange={(e) => setEditing((x) => ({ ...x, color: e.target.value }))} />
              </div>
            </div>
            <label className="row" style={{ cursor: 'pointer', gap: 8 }}>
              <input type="checkbox" checked={editing.active} onChange={(e) => setEditing((x) => ({ ...x, active: e.target.checked }))} />
              <span className="small">Show in the diary (untick to hide — e.g. on leave or has left; history is kept)</span>
            </label>
          </div>
          <div className="actions">
            <button className="btn secondary" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn" onClick={save}>Save</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function TemplatesCard({ clinicId }) {
  const [templates, setTemplates] = useState([])
  const [editing, setEditing] = useState(null) // {id?, name, body}
  const toast = useToast()
  const load = () =>
    sb.from('dental_note_templates').select('*').eq('clinic_id', clinicId).order('name').then(({ data }) => setTemplates(data || []))
  useEffect(() => { load() }, [clinicId])

  const save = async () => {
    if (!editing.name.trim() || !editing.body.trim()) return
    const payload = { name: editing.name.trim(), body: editing.body }
    const q = editing.id
      ? sb.from('dental_note_templates').update(payload).eq('id', editing.id)
      : sb.from('dental_note_templates').insert({ ...payload, clinic_id: clinicId })
    const { error } = await q
    if (error) return toast('Error: ' + error.message)
    toast('Template saved')
    setEditing(null)
    load()
  }
  const del = async (t) => {
    await sb.from('dental_note_templates').delete().eq('id', t.id)
    load()
  }

  return (
    <div className="card card-pad">
      <div className="card-title">
        Note templates
        <button className="btn sm" onClick={() => setEditing({ name: '', body: '' })}>+ New</button>
      </div>
      <div className="grid" style={{ gap: 8 }}>
        {templates.map((t) => (
          <div key={t.id} className="spread" style={{ padding: '8px 12px', background: 'var(--mint-bg)', borderRadius: 10 }}>
            <span style={{ fontWeight: 600, fontSize: 13.5 }}>{t.name}</span>
            <span className="row">
              <button className="btn ghost sm" onClick={() => setEditing({ ...t })}>Edit</button>
              <button className="btn ghost sm" onClick={() => del(t)}>✕</button>
            </span>
          </div>
        ))}
        {templates.length === 0 && <div className="small muted">No templates yet.</div>}
      </div>
      {editing && (
        <Modal title={editing.id ? 'Edit template' : 'New note template'} onClose={() => setEditing(null)}>
          <div className="grid" style={{ gap: 12 }}>
            <div><label className="field">Name</label>
              <input className="input" value={editing.name} onChange={(e) => setEditing((x) => ({ ...x, name: e.target.value }))} placeholder="e.g. Crown prep" /></div>
            <div><label className="field">Note body (use ___ for blanks to fill)</label>
              <textarea className="input" rows={9} value={editing.body} onChange={(e) => setEditing((x) => ({ ...x, body: e.target.value }))}
                style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13 }} /></div>
          </div>
          <div className="actions">
            <button className="btn secondary" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn" onClick={save}>Save template</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function PracticeCard({ clinic, onSave }) {
  const [f, setF] = useState({ name: clinic.name, address: clinic.address || '', phone: clinic.phone || '', email: clinic.email || '', opening_hours: clinic.opening_hours || '', imaging_software: clinic.imaging_software || 'none' })
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  return (
    <div className="card card-pad">
      <div className="card-title">
        Practice
        <button className="btn sm" onClick={() => onSave(f)}>Save</button>
      </div>
      <div className="grid" style={{ gap: 10 }}>
        <div><label className="field">Name</label><input className="input" value={f.name} onChange={set('name')} /></div>
        <div><label className="field">Address</label><input className="input" value={f.address} onChange={set('address')} /></div>
        <div><label className="field">Phone</label><input className="input" value={f.phone} onChange={set('phone')} /></div>
        <div><label className="field">Email</label><input className="input" value={f.email} onChange={set('email')} /></div>
        <div><label className="field">Opening hours</label><input className="input" value={f.opening_hours} onChange={set('opening_hours')} /></div>
        <div>
          <label className="field">Imaging software (for "Open in…" buttons)</label>
          <select className="input" value={f.imaging_software} onChange={set('imaging_software')}>
            <option value="none">None / not set up</option>
            <option value="romexis">Planmeca Romexis</option>
            <option value="csimaging">Carestream CS Imaging</option>
          </select>
          <p className="small muted" style={{ marginTop: 6 }}>
            Needs the free <a href="https://github.com/mohammad-jpg/dentora/tree/main/bridge" target="_blank" rel="noreferrer" style={{ color: 'var(--teal)', fontWeight: 600 }}>Dentora Imaging Bridge</a> installed
            once on each surgery PC (2-minute setup).
          </p>
        </div>
      </div>
    </div>
  )
}

function InviteModal({ onSave, onClose }) {
  const [f, setF] = useState({ name: '', role: 'Associate Dentist', email: '', password: '', is_admin: false })
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const ok = f.name.trim() && /.+@.+\..+/.test(f.email) && f.password.length >= 8
  return (
    <Modal title="Add team member" onClose={onClose}>
      <div className="grid" style={{ gap: 12 }}>
        <div><label className="field">Full name</label><input className="input" value={f.name} onChange={set('name')} placeholder="Dr. …" autoFocus /></div>
        <div>
          <label className="field">Role</label>
          <select className="input" value={f.role} onChange={set('role')}>
            {['Principal Dentist', 'Associate Dentist', 'Hygienist', 'Orthodontist', 'Reception', 'Practice Manager', 'Dental Nurse'].map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div><label className="field">Their email (their login)</label><input className="input" type="email" value={f.email} onChange={set('email')} /></div>
        <div><label className="field">Set their password (8+ characters — share it with them)</label>
          <input className="input" value={f.password} onChange={set('password')} /></div>
        <label className="row" style={{ cursor: 'pointer', gap: 8 }}>
          <input type="checkbox" checked={f.is_admin} onChange={(e) => setF((x) => ({ ...x, is_admin: e.target.checked }))} />
          <span className="small">Can manage the team (admin) — e.g. your practice manager or secretary</span>
        </label>
        <p className="small muted">Dentists, hygienists and orthodontists get a diary column and a Mon–Fri rota automatically. Reception and nurses get a login without a diary column.</p>
      </div>
      <div className="actions">
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn" disabled={!ok} onClick={() => onSave(f)}>Add to team</button>
      </div>
    </Modal>
  )
}

function RotaCard({ pracs, surgeries }) {
  const [rota, setRota] = useState([])
  const load = () => sb.from('dental_rota').select('*').then(({ data }) => setRota(data || []))
  useEffect(() => { load() }, [pracs.length])

  const rooms = surgeries.map((s) => s.name)
  const cell = (pracId, wd) => rota.find((r) => r.practitioner_id === pracId && r.weekday === wd)

  const cycle = async (pracId, wd) => {
    const cur = cell(pracId, wd)
    let next
    if (!cur || cur.status !== 'working') next = { status: 'working', room: rooms[0] || 'Surgery 1' }
    else {
      const idx = rooms.indexOf(cur.room)
      next = idx < rooms.length - 1 ? { status: 'working', room: rooms[idx + 1] } : { status: 'off', room: null }
    }
    if (cur?.status === 'off') next = { status: 'leave', room: null }
    if (cur) await sb.from('dental_rota').update(next).eq('id', cur.id)
    else await sb.from('dental_rota').insert({ practitioner_id: pracId, weekday: wd, ...next })
    load()
  }

  return (
    <div className="card card-pad">
      <div className="card-title">Rota <span className="small muted" style={{ fontWeight: 400 }}>click a cell to change surgery / off / leave</span></div>
      <div className="rota-wrap">
      <div className="rota-grid">
        <div />
        {DAYS.map((d) => <div key={d} className="small muted" style={{ textAlign: 'center', fontWeight: 700 }}>{d}</div>)}
        {pracs.map((p) => (
          [<div key={p.id} className="small" style={{ fontWeight: 600 }}>{p.name}</div>,
            ...DAYS.map((_, wd) => {
              const c = cell(p.id, wd)
              const cls = c?.status === 'working' ? 'rota-working' : c?.status === 'leave' ? 'rota-leave' : 'rota-off'
              return (
                <button key={p.id + wd} className={`rota-cell ${cls}`} style={{ border: 'none', cursor: 'pointer' }}
                  onClick={() => cycle(p.id, wd)}>
                  {c?.status === 'working' ? c.room : c?.status === 'leave' ? 'Leave' : 'Off'}
                </button>
              )
            })]
        ))}
      </div>
      </div>
    </div>
  )
}
