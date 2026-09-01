import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sb, age, fmtDate } from '../supabase.js'
import { Modal, useToast } from '../ui.jsx'

export default function Patients() {
  const [patients, setPatients] = useState([])
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const nav = useNavigate()
  const toast = useToast()

  const load = () =>
    sb.from('dental_patients').select('*').order('last_name').then(({ data }) => setPatients(data || []))
  useEffect(() => { load() }, [])

  const filtered = patients.filter((p) =>
    `${p.first_name} ${p.last_name} ${p.phone || ''} ${p.email || ''}`.toLowerCase().includes(q.toLowerCase())
  )

  const add = async (form) => {
    const { data, error } = await sb.from('dental_patients').insert(form).select().single()
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
        <div className="row">
          <input className="input" placeholder="Search name, phone, email…" value={q}
            onChange={(e) => setQ(e.target.value)} style={{ width: 260 }} />
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
                      <div style={{ fontWeight: 600 }}>{p.first_name} {p.last_name}</div>
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
    </>
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
        <div style={{ gridColumn: '1/-1' }}>
          <label className="field">Scheme</label>
          <select className="input" value={form.scheme} onChange={set('scheme')}>
            <option value="private">Private</option>
            <option value="prsi">PRSI (Dental Benefit)</option>
            <option value="medical_card">Medical card (DTSS)</option>
          </select>
        </div>
        <div style={{ gridColumn: '1/-1' }}><label className="field">Email</label><input className="input" value={form.email} onChange={set('email')} /></div>
        <div style={{ gridColumn: '1/-1' }}><label className="field">Address</label><input className="input" value={form.address} onChange={set('address')} /></div>
        <div style={{ gridColumn: '1/-1' }}><label className="field">Medical alerts</label><input className="input" value={form.medical_alerts} onChange={set('medical_alerts')} placeholder="Allergies, medications, conditions…" /></div>
      </div>
      <div className="actions">
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn" onClick={submit}>Save patient</button>
      </div>
    </Modal>
  )
}
