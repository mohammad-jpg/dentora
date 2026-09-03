import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { sb, fmtDate, fullName } from '../supabase.js'
import { Modal, useToast } from '../ui.jsx'

// Laboratory tracking: what's out at the lab, what's due back, what's overdue.
const STATUS = { sent: ['At the lab', 'b-blue'], received: ['Back in practice', 'b-teal'], fitted: ['Fitted', 'b-green'] }

export default function LabWork() {
  const [cases, setCases] = useState([])
  const [patients, setPatients] = useState([])
  const [editing, setEditing] = useState(null)
  const toast = useToast()

  const load = () =>
    sb.from('dental_lab_cases').select('*, patient:dental_patients(id,first_name,last_name)')
      .order('status').order('due_back', { ascending: true, nullsFirst: false })
      .then(({ data }) => setCases(data || []))
  useEffect(() => {
    load()
    sb.from('dental_patients').select('id,first_name,last_name').eq('archived', false).order('last_name')
      .then(({ data }) => setPatients(data || []))
  }, [])

  const save = async (form) => {
    const payload = { ...form, due_back: form.due_back || null, shade: form.shade || null, note: form.note || null }
    const q = editing?.id
      ? sb.from('dental_lab_cases').update(payload).eq('id', editing.id)
      : sb.from('dental_lab_cases').insert(payload)
    const { error } = await q
    if (error) return toast('Error: ' + error.message)
    toast(editing?.id ? 'Lab case updated' : 'Lab case logged')
    setEditing(null)
    load()
  }
  const setStatus = async (c, status) => {
    await sb.from('dental_lab_cases').update({ status }).eq('id', c.id)
    load()
  }

  const today = new Date().toISOString().slice(0, 10)
  const open = cases.filter((c) => c.status !== 'fitted')
  const overdue = open.filter((c) => c.status === 'sent' && c.due_back && c.due_back < today)

  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title">Lab work</div>
          <div className="page-sub">{open.length} case(s) in progress{overdue.length ? ` · ${overdue.length} overdue from the lab` : ''}</div>
        </div>
        <button className="btn" onClick={() => setEditing({ patient_id: patients[0]?.id || '', lab_name: '', item: '', shade: '', sent_on: today, due_back: '', status: 'sent', note: '' })}>
          + Log lab case
        </button>
      </div>
      <div className="content">
        <div className="card">
          <table className="tbl">
            <thead><tr><th>Patient</th><th>Item</th><th>Lab</th><th>Sent</th><th>Due back</th><th>Status</th><th /></tr></thead>
            <tbody>
              {cases.map((c) => {
                const late = c.status === 'sent' && c.due_back && c.due_back < today
                const [label, cls] = STATUS[c.status] || [c.status, 'b-gray']
                return (
                  <tr key={c.id}>
                    <td><Link to={`/patients/${c.patient?.id}`} style={{ fontWeight: 600, color: 'var(--teal-dark)' }}>{fullName(c.patient)}</Link></td>
                    <td>{c.item}{c.shade ? <span className="muted"> · shade {c.shade}</span> : ''}</td>
                    <td className="muted">{c.lab_name}</td>
                    <td>{fmtDate(c.sent_on)}</td>
                    <td>
                      {c.due_back ? fmtDate(c.due_back) : '—'}
                      {late && <span className="badge b-red" style={{ marginLeft: 6 }}>overdue — chase the lab</span>}
                    </td>
                    <td><span className={`badge ${cls}`}>{label}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="row" style={{ justifyContent: 'flex-end' }}>
                        {c.status === 'sent' && <button className="btn sm secondary" onClick={() => setStatus(c, 'received')}>Mark received</button>}
                        {c.status === 'received' && <button className="btn sm secondary" onClick={() => setStatus(c, 'fitted')}>Mark fitted</button>}
                        <button className="btn ghost sm" onClick={() => setEditing({ ...c })}>Edit</button>
                      </span>
                    </td>
                  </tr>
                )
              })}
              {cases.length === 0 && <tr><td colSpan={7}><div className="empty">Nothing at the lab. Log a case when you send an impression or scan.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <Modal title={editing.id ? 'Edit lab case' : 'Log lab case'} onClose={() => setEditing(null)}>
          <div className="grid" style={{ gap: 12 }}>
            <div>
              <label className="field">Patient</label>
              <select className="input" value={editing.patient_id} onChange={(e) => setEditing((x) => ({ ...x, patient_id: e.target.value }))}>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.last_name}, {p.first_name}</option>)}
              </select>
            </div>
            <div className="form-grid">
              <div><label className="field">Item</label>
                <input className="input" value={editing.item} onChange={(e) => setEditing((x) => ({ ...x, item: e.target.value }))} placeholder="e.g. Crown UR5, e.max" autoFocus /></div>
              <div><label className="field">Shade</label>
                <input className="input" value={editing.shade || ''} onChange={(e) => setEditing((x) => ({ ...x, shade: e.target.value }))} placeholder="e.g. A2" /></div>
            </div>
            <div><label className="field">Lab</label>
              <input className="input" value={editing.lab_name} onChange={(e) => setEditing((x) => ({ ...x, lab_name: e.target.value }))} placeholder="e.g. Southern Dental Lab" /></div>
            <div className="form-grid">
              <div><label className="field">Sent on</label>
                <input type="date" className="input" value={editing.sent_on} onChange={(e) => setEditing((x) => ({ ...x, sent_on: e.target.value }))} /></div>
              <div><label className="field">Due back</label>
                <input type="date" className="input" value={editing.due_back || ''} onChange={(e) => setEditing((x) => ({ ...x, due_back: e.target.value }))} /></div>
            </div>
            <div><label className="field">Note</label>
              <input className="input" value={editing.note || ''} onChange={(e) => setEditing((x) => ({ ...x, note: e.target.value }))} /></div>
          </div>
          <div className="actions">
            <button className="btn secondary" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn" disabled={!editing.item?.trim() || !editing.lab_name?.trim()} onClick={() => save({
              patient_id: editing.patient_id, lab_name: editing.lab_name.trim(), item: editing.item.trim(),
              shade: editing.shade, sent_on: editing.sent_on, due_back: editing.due_back, status: editing.status, note: editing.note,
            })}>Save</button>
          </div>
        </Modal>
      )}
    </>
  )
}
