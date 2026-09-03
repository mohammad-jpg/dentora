import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sb, age, fmtDate } from '../supabase.js'
import { Modal, useToast } from '../ui.jsx'
import { useClinic } from '../clinic.jsx'

export default function Patients() {
  const { clinicId, clinic } = useClinic()
  const [patients, setPatients] = useState([])
  const [q, setQ] = useState('')
  const [scheme, setScheme] = useState('all')
  const [showArchived, setShowArchived] = useState(false)
  const [adding, setAdding] = useState(false)
  const [blast, setBlast] = useState(false)
  const nav = useNavigate()
  const toast = useToast()

  const load = () =>
    sb.from('dental_patients').select('*').order('last_name').then(({ data }) => setPatients(data || []))
  useEffect(() => { load() }, [])

  const filtered = patients.filter((p) =>
    (showArchived ? true : !p.archived) &&
    (scheme === 'all' || p.scheme === scheme) &&
    `${p.first_name} ${p.last_name} ${p.phone || ''} ${p.email || ''}`.toLowerCase().includes(q.toLowerCase())
  )

  const add = async (form) => {
    const { data, error } = await sb.from('dental_patients').insert({ ...form, clinic_id: clinicId }).select().single()
    if (error) return toast('Error: ' + error.message)
    toast('Patient added')
    setAdding(false)
    nav(`/patients/${data.id}`)
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title">Patients</div>
          <div className="page-sub">{patients.length} on file</div>
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <input className="input" placeholder="Search name, phone, email…" value={q}
            onChange={(e) => setQ(e.target.value)} style={{ width: 220 }} />
          <select className="input" style={{ width: 150 }} value={scheme} onChange={(e) => setScheme(e.target.value)}>
            <option value="all">All schemes</option>
            <option value="private">Private</option>
            <option value="prsi">PRSI</option>
            <option value="medical_card">Medical card</option>
          </select>
          <label className="row small muted" style={{ gap: 5, cursor: 'pointer' }}>
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> archived
          </label>
          <button className="btn secondary" onClick={() => setBlast(true)} disabled={filtered.length === 0}>💬 Text these {filtered.length}</button>
          <button className="btn" onClick={() => setAdding(true)}>+ New patient</button>
        </div>
      </div>
      <div className="content">
        <div className="card">
          <table className="tbl">
            <thead>
              <tr><th>Patient</th><th>Age</th><th>Phone</th><th>Email</th><th>Medical alerts</th><th>Since</th></tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="click" onClick={() => nav(`/patients/${p.id}`)}>
                  <td>
                    <div className="row">
                      <div className="avatar">{p.first_name[0]}{p.last_name[0]}</div>
                      <div style={{ fontWeight: 600 }}>
                        {p.first_name} {p.last_name}
                        {p.archived && <span className="badge b-gray" style={{ marginLeft: 8 }}>archived</span>}
                      </div>
                    </div>
                  </td>
                  <td>{age(p.dob) ?? '—'}</td>
                  <td>{p.phone || '—'}</td>
                  <td className="muted">{p.email || '—'}</td>
                  <td>{p.medical_alerts ? <span className="badge b-red">⚠ {p.medical_alerts}</span> : <span className="muted">None</span>}</td>
                  <td className="muted">{fmtDate(p.created_at)}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6}><div className="empty">No patients match.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {adding && <PatientModal onSave={add} onClose={() => setAdding(false)} />}
      {blast && <BlastModal patients={filtered.filter((p) => !p.archived)} clinic={clinic} clinicId={clinicId} onClose={() => setBlast(false)} />}
    </>
  )
}

// Panara's "marketing using lists and SMS", improved: filter above, one message to the whole list.
function BlastModal({ patients, clinic, clinicId, onClose }) {
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  useEffect(() => {
    sb.from('dental_message_templates').select('body').eq('clinic_id', clinicId).eq('key', 'marketing').maybeSingle()
      .then(({ data }) => setBody(data?.body || 'Hi {name}, a quick hello from {clinic}! Book online any time: {link}'))
  }, [clinicId])

  const send = async () => {
    setBusy(true)
    for (const p of patients) {
      const msg = body
        .replaceAll('{name}', p.first_name)
        .replaceAll('{clinic}', clinic.name)
        .replaceAll('{phone}', clinic.phone || 'the practice')
        .replaceAll('{link}', 'https://mohammad-jpg.github.io/dentora/')
      await sb.from('dental_comms_log').insert({ patient_id: p.id, channel: 'sms', body: '[demo] ' + msg })
    }
    toast(`Message queued to ${patients.length} patient(s)`)
    onClose()
  }

  return (
    <Modal title={`Text ${patients.length} patient(s)`} onClose={onClose}>
      <p className="small muted" style={{ marginBottom: 10 }}>
        Goes to everyone currently matching your search and filters. Placeholders: {'{name} {clinic} {phone} {link}'}
      </p>
      <textarea className="input" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="actions">
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn" disabled={!body.trim() || busy || patients.length === 0} onClick={send}>
          {busy ? 'Sending…' : `Send to ${patients.length}`}
        </button>
      </div>
    </Modal>
  )
}

export function PatientModal({ patient = {}, onSave, onClose }) {
  const [form, setForm] = useState({
    first_name: patient.first_name || '',
    last_name: patient.last_name || '',
    dob: patient.dob || '',
    phone: patient.phone || '',
    email: patient.email || '',
    address: patient.address || '',
    medical_alerts: patient.medical_alerts || '',
    scheme: patient.scheme || 'private',
    recall_months: patient.recall_months ?? 6,
    archived: patient.archived || false,
  })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const submit = () => {
    if (!form.first_name || !form.last_name) return
    onSave({ ...form, dob: form.dob || null })
  }
  return (
    <Modal title={patient.id ? 'Edit patient' : 'New patient'} onClose={onClose}>
      <div className="form-grid">
        <div><label className="field">First name</label><input className="input" value={form.first_name} onChange={set('first_name')} /></div>
        <div><label className="field">Last name</label><input className="input" value={form.last_name} onChange={set('last_name')} /></div>
        <div><label className="field">Date of birth</label><input type="date" className="input" value={form.dob} onChange={set('dob')} /></div>
        <div><label className="field">Phone</label><input className="input" value={form.phone} onChange={set('phone')} /></div>
        <div>
          <label className="field">Scheme</label>
          <select className="input" value={form.scheme} onChange={set('scheme')}>
            <option value="private">Private</option>
            <option value="prsi">PRSI (Dental Benefit)</option>
            <option value="medical_card">Medical card (DTSS)</option>
          </select>
        </div>
        <div>
          <label className="field">Recall cycle</label>
          <select className="input" value={form.recall_months} onChange={(e) => setForm((f) => ({ ...f, recall_months: Number(e.target.value) }))}>
            <option value={3}>Every 3 months</option>
            <option value={6}>Every 6 months</option>
            <option value={12}>Every 12 months</option>
            <option value={0}>No automatic recalls</option>
          </select>
        </div>
        <div style={{ gridColumn: '1/-1' }}><label className="field">Email</label><input className="input" value={form.email} onChange={set('email')} /></div>
        <div style={{ gridColumn: '1/-1' }}><label className="field">Address</label><input className="input" value={form.address} onChange={set('address')} /></div>
        <div style={{ gridColumn: '1/-1' }}><label className="field">Medical alerts</label><input className="input" value={form.medical_alerts} onChange={set('medical_alerts')} placeholder="Allergies, medications, conditions…" /></div>
        {patient.id && (
          <label className="row" style={{ gridColumn: '1/-1', cursor: 'pointer', gap: 8 }}>
            <input type="checkbox" checked={form.archived} onChange={(e) => setForm((f) => ({ ...f, archived: e.target.checked }))} />
            <span className="small">Archive this patient — hidden from lists and automations; the full record is kept and they can be un-archived any time</span>
          </label>
        )}
      </div>
      <div className="actions">
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn" onClick={submit}>Save patient</button>
      </div>
    </Modal>
  )
}
