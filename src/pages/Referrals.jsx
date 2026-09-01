import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { sb, fmtDate, fullName, age } from '../supabase.js'
import { Modal, useToast } from '../ui.jsx'
import { useClinic } from '../clinic.jsx'

const KIND_LABEL = {
  internal: 'In-house',
  specialist: 'Specialist register',
  dental_hospital: 'Dental hospital',
  general_hospital: 'General hospital / A&E',
}
const URGENCY_CLS = { routine: 'b-blue', urgent: 'b-amber', emergency: 'b-red' }
const STATUS_CLS = { draft: 'b-gray', sent: 'b-blue', accepted: 'b-teal', completed: 'b-green' }

function buildLetter({ patient, specialist, reason, urgency, clinic, signer }) {
  const today = new Date().toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })
  const pAge = age(patient.dob)
  return `${clinic.name}
${[clinic.address, clinic.phone, clinic.email].filter(Boolean).join(' · ')}

${today}

To: ${specialist.name}${specialist.organisation ? `, ${specialist.organisation}` : ''}
${specialist.location || ''}

RE: ${patient.first_name} ${patient.last_name}${pAge != null ? ` (${pAge} yrs, DOB ${fmtDate(patient.dob)})` : ''}
${patient.address || ''}
${patient.phone ? `Tel: ${patient.phone}` : ''}

Dear colleague,

I would be grateful if you could see the above patient for ${specialist.specialty.toLowerCase()} assessment${urgency !== 'routine' ? ` on an ${urgency.toUpperCase()} basis` : ''}.

Reason for referral:
${reason}
${patient.medical_alerts ? `\nRelevant medical history: ${patient.medical_alerts}` : ''}
Patient scheme: ${patient.scheme === 'prsi' ? 'PRSI' : patient.scheme === 'medical_card' ? 'Medical card' : 'Private'}

Please do not hesitate to contact the practice for records or radiographs.

Kind regards,

${signer}
${clinic.name}`
}

export default function Referrals() {
  const { clinic } = useClinic()
  const [referrals, setReferrals] = useState([])
  const [specialists, setSpecialists] = useState([])
  const [patients, setPatients] = useState([])
  const [pracs, setPracs] = useState([])
  const [creating, setCreating] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [showRegister, setShowRegister] = useState(false)
  const toast = useToast()

  const load = () =>
    sb.from('dental_referrals')
      .select('*, patient:dental_patients(id,first_name,last_name), specialist:dental_specialists(*)')
      .order('created_at', { ascending: false })
      .then(({ data }) => setReferrals(data || []))

  useEffect(() => {
    load()
    sb.from('dental_specialists').select('*').order('kind').order('name').then(({ data }) => setSpecialists(data || []))
    sb.from('dental_patients').select('*').order('last_name').then(({ data }) => setPatients(data || []))
    sb.from('dental_practitioners').select('name').order('name').then(({ data }) => setPracs(data || []))
  }, [])

  const create = async (form) => {
    const patient = patients.find((p) => p.id === form.patient_id)
    const specialist = specialists.find((s) => s.id === form.specialist_id)
    const letter = buildLetter({ patient, specialist, reason: form.reason, urgency: form.urgency, clinic, signer: pracs[0]?.name || clinic.name })
    const { data, error } = await sb.from('dental_referrals')
      .insert({ patient_id: form.patient_id, specialist_id: form.specialist_id, reason: form.reason, urgency: form.urgency, letter, status: 'draft' })
      .select('*, patient:dental_patients(id,first_name,last_name), specialist:dental_specialists(*)').single()
    if (error) return toast('Error: ' + error.message)
    toast('Referral letter generated')
    setCreating(false)
    setViewing(data)
    load()
  }

  const setStatus = async (r, status) => {
    await sb.from('dental_referrals').update({ status }).eq('id', r.id)
    load()
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title">Referrals</div>
          <div className="page-sub">In-house, specialist register, dental hospital & A&E — letters generated instantly</div>
        </div>
        <div className="row">
          <button className="btn secondary" onClick={() => setShowRegister(true)}>Specialist register</button>
          <button className="btn" onClick={() => setCreating(true)}>+ New referral</button>
        </div>
      </div>
      <div className="content">
        <div className="card">
          <table className="tbl">
            <thead><tr><th>Patient</th><th>Referred to</th><th>Reason</th><th>Urgency</th><th>Date</th><th>Status</th><th /></tr></thead>
            <tbody>
              {referrals.map((r) => (
                <tr key={r.id}>
                  <td><Link to={`/patients/${r.patient?.id}`} style={{ fontWeight: 600, color: 'var(--teal-dark)' }}>{fullName(r.patient)}</Link></td>
                  <td>
                    {r.specialist?.name}
                    <div className="small muted">{r.specialist?.specialty} · {KIND_LABEL[r.specialist?.kind]}</div>
                  </td>
                  <td className="small muted" style={{ maxWidth: 220 }}>{r.reason}</td>
                  <td><span className={`badge ${URGENCY_CLS[r.urgency]}`}>{r.urgency}</span></td>
                  <td>{fmtDate(r.created_at)}</td>
                  <td>
                    <select className="input" style={{ width: 120, padding: '5px 8px' }} value={r.status} onChange={(e) => setStatus(r, e.target.value)}>
                      {['draft', 'sent', 'accepted', 'completed'].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td style={{ textAlign: 'right' }}><button className="btn sm secondary" onClick={() => setViewing(r)}>View letter</button></td>
                </tr>
              ))}
              {referrals.length === 0 && <tr><td colSpan={7}><div className="empty">No referrals yet — create one and the letter writes itself.</div></td></tr>}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: 12 }}>
          Register is a demo copy — live sync from the Dental Council specialist register (refreshed quarterly) is on the roadmap.
        </p>
      </div>

      {creating && <ReferralModal patients={patients} specialists={specialists} onSave={create} onClose={() => setCreating(false)} />}
      {viewing && (
        <Modal title={`Referral letter — ${fullName(viewing.patient)}`} onClose={() => setViewing(null)}>
          <div className="letter">{viewing.letter}</div>
          <div className="actions">
            <button className="btn secondary" onClick={() => { navigator.clipboard.writeText(viewing.letter); toast('Letter copied') }}>Copy</button>
            <button className="btn" onClick={() => window.print()}>Print</button>
          </div>
        </Modal>
      )}
      {showRegister && (
        <Modal title="Specialist register" onClose={() => setShowRegister(false)}>
          <div className="grid" style={{ gap: 10 }}>
            {specialists.map((s) => (
              <div key={s.id} className="spread" style={{ padding: '10px 12px', background: 'var(--mint-bg)', borderRadius: 10 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{s.name} <span className="badge b-gray" style={{ marginLeft: 6 }}>{KIND_LABEL[s.kind]}</span></div>
                  <div className="small muted">{s.specialty} · {s.organisation} · {s.location}</div>
                  <div className="small muted">{s.phone}{s.email ? ` · ${s.email}` : ''}{s.register_no ? ` · ${s.register_no}` : ''}</div>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  )
}

function ReferralModal({ patients, specialists, onSave, onClose }) {
  const [form, setForm] = useState({
    patient_id: patients[0]?.id || '',
    specialist_id: specialists[0]?.id || '',
    reason: '',
    urgency: 'routine',
  })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const groups = ['internal', 'specialist', 'dental_hospital', 'general_hospital']
  return (
    <Modal title="New referral" onClose={onClose}>
      <div className="grid" style={{ gap: 12 }}>
        <div>
          <label className="field">Patient</label>
          <select className="input" value={form.patient_id} onChange={set('patient_id')}>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.last_name}, {p.first_name}</option>)}
          </select>
        </div>
        <div>
          <label className="field">Refer to</label>
          <select className="input" value={form.specialist_id} onChange={set('specialist_id')}>
            {groups.map((g) => (
              <optgroup key={g} label={KIND_LABEL[g]}>
                {specialists.filter((s) => s.kind === g).map((s) => (
                  <option key={s.id} value={s.id}>{s.name} — {s.specialty}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className="field">Urgency</label>
          <select className="input" value={form.urgency} onChange={set('urgency')}>
            <option value="routine">Routine</option>
            <option value="urgent">Urgent</option>
            <option value="emergency">Emergency (trauma)</option>
          </select>
        </div>
        <div>
          <label className="field">Reason for referral</label>
          <textarea className="input" rows={4} value={form.reason} onChange={set('reason')}
            placeholder="e.g. Impacted LL8, recurrent pericoronitis — for assessment and surgical removal" />
        </div>
      </div>
      <div className="actions">
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn" disabled={!form.reason.trim()} onClick={() => onSave(form)}>Generate letter</button>
      </div>
    </Modal>
  )
}
