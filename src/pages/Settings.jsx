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

            <div className="card card-pad">
              <div className="card-title">
                Team
                {role === 'owner' && <button className="btn sm" onClick={() => setInviting(true)}>+ Add team member</button>}
              </div>
              <div className="grid" style={{ gap: 10 }}>
                {members.map((m) => (
                  <div key={m.id} className="spread" style={{ padding: '8px 12px', background: 'var(--mint-bg)', borderRadius: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{m.display_name || m.email}</div>
                      <div className="small muted">{m.email}</div>
                    </div>
                    <span className={`badge ${m.role === 'owner' ? 'b-teal' : 'b-gray'}`}>{m.role}</span>
                  </div>
                ))}
              </div>
              {role !== 'owner' && <p className="small muted" style={{ marginTop: 10 }}>Only the clinic owner can add team members.</p>}
            </div>

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

            <div className="card card-pad">
              <div className="card-title">Clinicians</div>
              <div className="grid" style={{ gap: 10 }}>
                {pracs.map((p) => (
                  <div key={p.id} className="row" style={{ padding: '8px 10px', background: 'var(--mint-bg)', borderRadius: 10 }}>
                    <span className="swatch" style={{ background: p.color, borderRadius: 99 }} />
                    <div>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div className="small muted">{p.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
  const [f, setF] = useState({ name: clinic.name, address: clinic.address || '', phone: clinic.phone || '', email: clinic.email || '', opening_hours: clinic.opening_hours || '' })
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
      </div>
    </div>
  )
}

function InviteModal({ onSave, onClose }) {
  const [f, setF] = useState({ name: '', role: 'Associate Dentist', email: '', password: '' })
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
  )
}
