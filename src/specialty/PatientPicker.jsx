import { useEffect, useMemo, useState } from 'react'
import { sb, age, fmtDate } from '../supabase.js'
import { Modal, useToast } from '../ui.jsx'
import { useClinic } from '../clinic.jsx'
import { PatientModal } from '../pages/Patients.jsx'

// Modal that lets staff pick an existing clinic patient (search by name / phone / email)
// or create a new patient record on the spot. Calls onPick(patient) with the full row.
// `taken` = set of patient ids that already have an open case, shown with a hint.
export default function PatientPicker({ title = 'Add patient', hint, taken = new Set(), onPick, onClose }) {
  const { clinicId } = useClinic()
  const [patients, setPatients] = useState(null)
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const toast = useToast()

  useEffect(() => {
    sb.from('dental_patients').select('id,first_name,last_name,dob,phone,email,scheme,archived')
      .eq('clinic_id', clinicId).eq('archived', false).order('last_name').order('first_name')
      .then(({ data }) => setPatients(data || []))
  }, [clinicId])

  const results = useMemo(() => {
    if (!patients) return []
    const needle = q.trim().toLowerCase()
    const list = needle
      ? patients.filter((p) => `${p.first_name} ${p.last_name} ${p.phone || ''} ${p.email || ''}`.toLowerCase().includes(needle))
      : patients
    return list.slice(0, 40)
  }, [patients, q])

  const create = async (form) => {
    const { data, error } = await sb.from('dental_patients').insert({ ...form, clinic_id: clinicId }).select().single()
    if (error) return toast('Error: ' + error.message)
    toast('Patient added')
    setCreating(false)
    onPick(data)
  }

  if (creating) return <PatientModal onSave={create} onClose={() => setCreating(false)} />

  return (
    <Modal title={title} onClose={onClose}>
      {hint && <p className="small muted" style={{ marginTop: -6, marginBottom: 12 }}>{hint}</p>}
      <div className="row" style={{ gap: 8 }}>
        <input className="input" autoFocus placeholder="Search by name, phone or email…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn secondary" style={{ whiteSpace: 'nowrap' }} onClick={() => setCreating(true)}>New patient</button>
      </div>
      <div className="grid" style={{ gap: 4, marginTop: 12, maxHeight: 360, overflowY: 'auto' }}>
        {patients === null && <div className="small muted" style={{ padding: 10 }}>Loading patients…</div>}
        {patients !== null && results.length === 0 && (
          <div className="empty" style={{ padding: 18 }}>
            {q ? <>No patients match “{q}”. <button className="btn ghost sm" onClick={() => setCreating(true)}>Create “{q}” as a new patient</button></> : 'No patients on file yet.'}
          </div>
        )}
        {results.map((p) => (
          <button key={p.id} type="button" className="spread" onClick={() => onPick(p)}
            style={{ textAlign: 'left', background: 'none', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', width: '100%' }}>
            <span className="row" style={{ gap: 10 }}>
              <span className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{p.first_name[0]}{p.last_name[0]}</span>
              <span>
                <div style={{ fontWeight: 600 }}>{p.first_name} {p.last_name}</div>
                <div className="small muted">
                  {age(p.dob) != null ? `${age(p.dob)} yrs · ` : ''}{p.dob ? `${fmtDate(p.dob)} · ` : ''}{p.phone || 'no phone'}
                </div>
              </span>
            </span>
            {taken.has(p.id) && <span className="badge b-gray">has open case</span>}
          </button>
        ))}
        {patients && patients.length > 40 && results.length === 40 && <div className="small muted" style={{ padding: '6px 10px' }}>Showing first 40 — refine your search.</div>}
      </div>
      <div className="actions">
        <button className="btn secondary" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  )
}
