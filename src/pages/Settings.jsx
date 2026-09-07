import { useEffect, useState } from 'react'
import { sb, euro } from '../supabase.js'
import { Modal, useToast } from '../ui.jsx'
import { useClinic } from '../clinic.jsx'
import { PACKAGES } from '../specialty/packages.js'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

export default function Settings() {
  const { clinic, clinicId, role, reload } = useClinic()
  const canManage = ['owner', 'admin'].includes(role)
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
    const { error } = await sb.from('dental_treatments').update({ price: Number(price) }).eq('id', t.id)
    if (error) return toast('Error: ' + error.message)
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
    const { error } = await sb.from('dental_surgeries').update({ name: name.trim() }).eq('id', s.id)
    if (error) return toast('Error: ' + error.message)
    // Rota rows carry a free-text room name with no clinic_id of their own, so this must be
    // scoped to this clinic's practitioners explicitly -- otherwise a rename here can also
    // rewrite another clinic's rota rows that happen to share the same generic room name
    // (e.g. "Surgery 1"). RLS now enforces the same clinic boundary as a second layer.
    const pracIds = pracs.map((p) => p.id)
    if (pracIds.length) await sb.from('dental_rota').update({ room: name.trim() }).eq('room', s.name).in('practitioner_id', pracIds)
    load()
  }
  const removeSurgery = async (s) => {
    await sb.from('dental_surgeries').delete().eq('id', s.id)
    toast(`${s.name} removed`)
    load()
  }

  const invite = async (form) => {
    const { data, error } = await sb.functions.invoke('invite-staff', { body: { ...form, clinic_id: clinicId } })
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
            <PracticeCard clinic={clinic} onSave={canManage ? saveClinic : () => toast('Only an owner or admin can change practice details.')} />
            <AddonsCard clinic={clinic} canManage={['owner', 'admin'].includes(role)} onSave={saveClinic} />

            <TeamCard members={members} clinicId={clinicId} canManage={canManage} onInvite={() => setInviting(true)} onChanged={load} />

            <div className="card card-pad">
              <div className="card-title">
                Surgeries
                {canManage && <button className="btn sm" onClick={addSurgery}>+ Add surgery</button>}
              </div>
              <div className="grid" style={{ gap: 8 }}>
                {surgeries.map((s) => (
                  <div className="row" key={s.id}>
                    <input className="input" defaultValue={s.name} readOnly={!canManage} onBlur={(e) => canManage && renameSurgery(s, e.target.value)} />
                    {canManage && surgeries.length > 1 && <button className="btn ghost sm" onClick={() => removeSurgery(s)}>✕</button>}
                  </div>
                ))}
              </div>
            </div>

            <TemplatesCard clinicId={clinicId} />
            <MessagesCard clinicId={clinicId} />
            <ImportCard clinicId={clinicId} />
            {canManage && <ExportCard clinicId={clinicId} clinic={clinic} />}
            {canManage && <AccessLogCard clinicId={clinicId} />}

            <CliniciansCard pracs={pracs} clinicId={clinicId} canManage={['owner', 'admin'].includes(role)} onChanged={load} />
          </div>

          <div className="card">
            <div className="card-pad card-title" style={{ marginBottom: 0 }}>Fee schedule{canManage ? ' — edit prices inline' : ''}</div>
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
                      <input type="number" className="input" defaultValue={Number(t.price)} min="0" step="5" readOnly={!canManage}
                        onBlur={(e) => canManage && updatePrice(t, e.target.value)} />
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

function TeamCard({ members, canManage, clinicId, onInvite, onChanged }) {
  const [busyId, setBusyId] = useState(null)
  const [pwFor, setPwFor] = useState(null) // membership being given a new password
  const [pw, setPw] = useState('')
  const [removeFor, setRemoveFor] = useState(null)
  const toast = useToast()

  const call = async (m, body, okMsg) => {
    setBusyId(m.id)
    const { data, error } = await sb.functions.invoke('manage-staff', { body: { membership_id: m.id, clinic_id: clinicId, ...body } })
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

// Patient migration, option A: self-serve CSV import from any old system's export.
function parseCSV(text) {
  const rows = []
  let row = [], cur = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') inQ = false
      else cur += c
    } else if (c === '"') inQ = true
    else if (c === ',') { row.push(cur); cur = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cur); cur = ''
      if (row.some((v) => v.trim())) rows.push(row)
      row = []
    } else cur += c
  }
  row.push(cur)
  if (row.some((v) => v.trim())) rows.push(row)
  return rows
}

const IMPORT_FIELDS = [
  ['first_name', ['first', 'firstname', 'first name', 'forename', 'given']],
  ['last_name', ['last', 'lastname', 'last name', 'surname', 'family']],
  ['name', ['name', 'patient', 'patient name', 'full name']],
  ['dob', ['dob', 'date of birth', 'birth', 'birthdate', 'born']],
  ['phone', ['phone', 'mobile', 'tel', 'telephone', 'contact']],
  ['email', ['email', 'e-mail', 'mail']],
  ['address', ['address', 'addr']],
  ['medical_alerts', ['medical', 'alerts', 'allergies', 'medical alerts', 'notes']],
  ['scheme', ['scheme', 'type', 'category', 'gms', 'status']],
]

function normDob(v) {
  if (!v) return null
  const s = v.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/)
  if (m) {
    let y = m[3].length === 2 ? (Number(m[3]) > 30 ? '19' + m[3] : '20' + m[3]) : m[3]
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  return null
}
function normScheme(v) {
  const s = (v || '').toLowerCase()
  if (s.includes('gms') || s.includes('medical')) return 'medical_card'
  if (s.includes('prsi')) return 'prsi'
  return 'private'
}

function ImportCard({ clinicId }) {
  const [rows, setRows] = useState(null) // parsed data rows
  const [map, setMap] = useState({}) // field -> column index
  const [headers, setHeaders] = useState([])
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const toast = useToast()

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const text = await file.text()
    const parsed = parseCSV(text)
    if (parsed.length < 2) return toast('That file looks empty — export your patients as CSV and try again.')
    const hdr = parsed[0].map((h) => h.trim())
    setHeaders(hdr)
    setRows(parsed.slice(1))
    // auto-guess column mapping
    const guess = {}
    hdr.forEach((h, idx) => {
      const lh = h.toLowerCase()
      for (const [field, aliases] of IMPORT_FIELDS) {
        if (guess[field] === undefined && aliases.some((a) => lh.includes(a))) { guess[field] = idx; break }
      }
    })
    setMap(guess)
    setResult(null)
  }

  const doImport = async () => {
    setBusy(true)
    const get = (r, field) => (map[field] !== undefined ? (r[map[field]] || '').trim() : '')
    const patients = rows.map((r) => {
      let first = get(r, 'first_name'), last = get(r, 'last_name')
      if (!first && !last) {
        const full = get(r, 'name')
        const parts = full.split(/\s+/)
        first = parts.slice(0, -1).join(' ') || parts[0] || ''
        last = parts.length > 1 ? parts[parts.length - 1] : '(imported)'
      }
      return {
        clinic_id: clinicId,
        first_name: first || '(unknown)', last_name: last || '(imported)',
        dob: normDob(get(r, 'dob')), phone: get(r, 'phone') || null, email: get(r, 'email') || null,
        address: get(r, 'address') || null, medical_alerts: get(r, 'medical_alerts') || null,
        scheme: normScheme(get(r, 'scheme')), notes: 'Imported ' + new Date().toLocaleDateString('en-IE'),
      }
    }).filter((p) => p.first_name !== '(unknown)' || p.phone || p.email)
    let done = 0, failed = 0
    for (let i = 0; i < patients.length; i += 100) {
      const { error } = await sb.from('dental_patients').insert(patients.slice(i, i + 100))
      if (error) failed += patients.slice(i, i + 100).length
      else done += patients.slice(i, i + 100).length
    }
    setBusy(false)
    setResult({ done, failed })
    setRows(null)
    toast(`Imported ${done} patient(s)${failed ? ` · ${failed} failed` : ''}`)
  }

  return (
    <div className="card card-pad">
      <div className="card-title">Import patients</div>
      {!rows && (
        <div className="grid" style={{ gap: 10 }}>
          <p className="small muted" style={{ lineHeight: 1.6 }}>
            Moving from another system? Export your patients as a <b>CSV spreadsheet</b> and drop it here —
            we auto-detect names, DOB, phone, email, address, medical alerts and scheme.
            Prefer not to? <b>Send us the export and we'll migrate it for you, free.</b>
          </p>
          <label className="btn secondary" style={{ cursor: 'pointer', justifyContent: 'center' }}>
            Choose CSV file
            <input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={onFile} />
          </label>
          {result && <div className="badge b-green">Last import: {result.done} added{result.failed ? `, ${result.failed} failed` : ''}</div>}
        </div>
      )}
      {rows && (
        <div className="grid" style={{ gap: 10 }}>
          <div className="badge b-teal">{rows.length} row(s) found — check the column matching below</div>
          {IMPORT_FIELDS.filter(([f]) => f !== 'name').map(([field]) => (
            <div className="spread" key={field}>
              <span className="small" style={{ fontWeight: 600 }}>{field.replace('_', ' ')}</span>
              <select className="input" style={{ width: 190, padding: '5px 8px' }}
                value={map[field] ?? ''}
                onChange={(e) => setMap((m) => ({ ...m, [field]: e.target.value === '' ? undefined : Number(e.target.value) }))}>
                <option value="">— not in file —</option>
                {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
              </select>
            </div>
          ))}
          <div className="row">
            <button className="btn secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setRows(null)}>Cancel</button>
            <button className="btn" style={{ flex: 1, justifyContent: 'center' }} disabled={busy} onClick={doImport}>
              {busy ? 'Importing…' : `Import ${rows.length} patients`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MessagesCard({ clinicId }) {
  const [msgs, setMsgs] = useState([])
  const [editing, setEditing] = useState(null)
  const toast = useToast()
  const load = () =>
    sb.from('dental_message_templates').select('*').eq('clinic_id', clinicId).order('label').then(({ data }) => setMsgs(data || []))
  useEffect(() => { load() }, [clinicId])

  const save = async () => {
    const { error } = await sb.from('dental_message_templates').update({ body: editing.body }).eq('id', editing.id)
    if (error) return toast('Error: ' + error.message)
    toast('Message template saved')
    setEditing(null)
    load()
  }

  return (
    <div className="card card-pad">
      <div className="card-title">Text message templates</div>
      <div className="grid" style={{ gap: 8 }}>
        {msgs.map((m) => (
          <div key={m.id} className="spread" style={{ padding: '8px 12px', background: 'var(--mint-bg)', borderRadius: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{m.label}</div>
              <div className="small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{m.body}</div>
            </div>
            <button className="btn ghost sm" onClick={() => setEditing({ ...m })}>Edit</button>
          </div>
        ))}
      </div>
      <p className="small muted" style={{ marginTop: 10 }}>
        Used by the daily automations, the debt manager and marketing texts. Placeholders: {'{name} {clinic} {phone} {link} {time} {type} {amount}'}
      </p>
      {editing && (
        <Modal title={editing.label} onClose={() => setEditing(null)}>
          <textarea className="input" rows={5} value={editing.body} onChange={(e) => setEditing((x) => ({ ...x, body: e.target.value }))} />
          <p className="small muted" style={{ marginTop: 8 }}>Placeholders: {'{name} {clinic} {phone} {link} {time} {type} {amount}'}</p>
          <div className="actions">
            <button className="btn secondary" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn" disabled={!editing.body.trim()} onClick={save}>Save</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function AddonsCard({ clinic, canManage, onSave }) {
  const addons = Array.isArray(clinic.addons) ? clinic.addons : []
  const toggle = (key) => {
    const next = addons.includes(key) ? addons.filter((k) => k !== key) : [...addons, key]
    onSave({ addons: next })
  }
  const monthly = addons.reduce((s, k) => s + (PACKAGES[k]?.price || 0), 0)
  return (
    <div className="card card-pad">
      <div className="card-title">
        Specialty packages
        {monthly > 0 && <span className="badge b-teal">+€{monthly}/mo</span>}
      </div>
      <div className="grid" style={{ gap: 10 }}>
        {Object.values(PACKAGES).map((p) => {
          const on = addons.includes(p.key)
          return (
            <div key={p.key} style={{ padding: '12px 14px', border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`, borderRadius: 9, background: on ? 'var(--accent-soft)' : 'transparent' }}>
              <div className="spread">
                <div>
                  <div style={{ fontWeight: 600 }}>{p.name} <span className="small muted" style={{ fontWeight: 500 }}>· +€{p.price}/month</span></div>
                  <div className="small muted" style={{ marginTop: 3, lineHeight: 1.5 }}>{p.blurb}</div>
                </div>
                {canManage && (
                  <button className={`btn sm ${on ? 'secondary' : ''}`} onClick={() => toggle(p.key)} style={{ flexShrink: 0 }}>
                    {on ? 'Enabled — turn off' : 'Enable'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <p className="small muted" style={{ marginTop: 10 }}>Packages add a Specialty section to the menu and a tab on every patient record. Billed monthly with your plan; turn off any time.</p>
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


// GDPR: full export of the practice's data (portability / exit). Everything RLS lets this user
// see for the clinic, as one JSON file plus a patients CSV.
function ExportCard({ clinicId, clinic }) {
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const CLINIC_TABLES = ['dental_practitioners', 'dental_surgeries', 'dental_rota', 'dental_treatments', 'dental_message_templates', 'dental_note_templates', 'dental_tasks', 'dental_appointments', 'dental_memberships', 'dental_checkin_sessions', 'dental_support_requests']
  const PATIENT_TABLES = ['dental_chart_entries', 'dental_clinical_notes', 'dental_treatment_plans', 'dental_invoices', 'dental_payments', 'dental_recalls', 'dental_referrals', 'dental_lab_cases', 'dental_imaging_refs', 'dental_comms_log', 'dental_questionnaires', 'dental_bpe_exams', 'dental_perio_exams', 'dental_ortho_cases', 'dental_endo_cases', 'dental_routing_slips']
  const all = async (table, col, ids) => {
    const out = []
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await sb.from(table).select('*').in(col, ids.slice(i, i + 200))
      if (error) throw new Error(`${table}: ${error.message}`)
      out.push(...(data || []))
    }
    return out
  }
  const download = (name, text, type) => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  }
  const run = async () => {
    setBusy(true)
    try {
      const bundle = { exported_at: new Date().toISOString(), clinic, tables: {} }
      const { data: patients, error: pe } = await sb.from('dental_patients').select('*').eq('clinic_id', clinicId)
      if (pe) throw pe
      bundle.tables.dental_patients = patients
      const ids = patients.map((p) => p.id)
      for (const t of PATIENT_TABLES) bundle.tables[t] = await all(t, 'patient_id', ids)
      const { data: prs } = await sb.from('dental_practitioners').select('id').eq('clinic_id', clinicId)
      for (const t of CLINIC_TABLES) {
        if (t === 'dental_rota') bundle.tables[t] = await all(t, 'practitioner_id', (prs || []).map((p) => p.id))
        else { const { data } = await sb.from(t).select('*').eq('clinic_id', clinicId); bundle.tables[t] = data || [] }
      }
      const cases = bundle.tables.dental_ortho_cases.map((c) => c.id)
      bundle.tables.dental_ortho_visits = await all('dental_ortho_visits', 'case_id', cases)
      bundle.tables.dental_ortho_instalments = await all('dental_ortho_instalments', 'case_id', cases)
      const stamp = new Date().toISOString().slice(0, 10)
      download(`dentora-export-${stamp}.json`, JSON.stringify(bundle, null, 2), 'application/json')
      const cols = ['id', 'first_name', 'last_name', 'dob', 'phone', 'email', 'address', 'scheme', 'medical_alerts', 'recall_months', 'archived', 'created_at']
      const csv = [cols.join(','), ...patients.map((p) => cols.map((c) => `"${String(p[c] ?? '').replaceAll('"', '""')}"`).join(','))].join('\n')
      download(`dentora-patients-${stamp}.csv`, csv, 'text/csv')
      const rows = Object.values(bundle.tables).reduce((n, t) => n + t.length, 0)
      toast(`Exported ${patients.length} patients and ${rows} records`)
      await sb.from('dental_access_log').insert({ clinic_id: clinicId, patient_id: '00000000-0000-0000-0000-000000000000', action: 'export', user_email: (await sb.auth.getUser()).data.user?.email })
    } catch (e) { toast('Export failed: ' + e.message) }
    setBusy(false)
  }
  return (
    <div className="card card-pad">
      <div className="card-title">Export practice data</div>
      <p className="small muted" style={{ margin: '0 0 10px' }}>Everything in one JSON file (all tables) plus a patients CSV. Your data is yours: use this to move systems, to answer a subject access request, or for your own backups. Exports are recorded in the access log.</p>
      <button className="btn secondary" disabled={busy} onClick={run}>{busy ? 'Exporting…' : 'Download full export'}</button>
    </div>
  )
}

// GDPR accountability: who opened which patient record, when. Owner/admin only.
function AccessLogCard({ clinicId }) {
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  useEffect(() => {
    sb.from('dental_access_log').select('id, at, user_email, action, patient:dental_patients(first_name,last_name)')
      .eq('clinic_id', clinicId).order('at', { ascending: false }).limit(200).then(({ data }) => setRows(data || []))
  }, [clinicId])
  const shown = rows.filter((r) => !q || `${r.user_email} ${r.patient?.first_name} ${r.patient?.last_name} ${r.action}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="card card-pad">
      <div className="card-title">Access log <span className="small muted" style={{ fontWeight: 400 }}>last 200 · kept 2 years</span></div>
      <input className="input" placeholder="Filter by staff, patient or action…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 8 }} />
      <div style={{ maxHeight: 280, overflowY: 'auto' }}>
        <table className="tbl" style={{ fontSize: 12.5 }}>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td className="mono muted" style={{ whiteSpace: 'nowrap' }}>{new Date(r.at).toLocaleString('en-IE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                <td>{r.user_email}</td>
                <td>{r.action}</td>
                <td>{r.patient ? `${r.patient.first_name} ${r.patient.last_name}` : '—'}</td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td className="muted">No entries yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
