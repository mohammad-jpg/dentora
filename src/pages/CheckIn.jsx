import { useEffect, useState } from 'react'
import { sb } from '../supabase.js'
import { useToast } from '../ui.jsx'
import { useClinic } from '../clinic.jsx'

// Tablet check-in: reception picks the patient, hands the iPad over, the patient
// fills the medical questionnaire, and it lands straight on their record.

const CONDITIONS = [
  'Heart condition', 'High blood pressure', 'Diabetes', 'Asthma / breathing', 'Epilepsy',
  'Bleeding disorder / blood thinners', 'Hepatitis / HIV', 'Osteoporosis medication', 'Pregnancy',
]

export default function CheckIn() {
  const { clinic } = useClinic()
  const [patients, setPatients] = useState([])
  const [q, setQ] = useState('')
  const [patient, setPatient] = useState(null)
  const [stage, setStage] = useState('pick') // pick | form | done
  const [f, setF] = useState(null)
  const toast = useToast()

  useEffect(() => {
    sb.from('dental_patients').select('id,first_name,last_name,dob,phone').order('last_name').then(({ data }) => setPatients(data || []))
  }, [])

  const start = (p) => {
    setPatient(p)
    setF({ conditions: [], other_condition: '', medications: '', allergies: '', smoker: '', gp: '', emergency_contact: '', consent: false, signature: '' })
    setStage('form')
  }

  const toggleCond = (c) =>
    setF((x) => ({ ...x, conditions: x.conditions.includes(c) ? x.conditions.filter((v) => v !== c) : [...x.conditions, c] }))

  const submit = async () => {
    const { error } = await sb.from('dental_questionnaires').insert({ patient_id: patient.id, data: f })
    if (error) return toast('Error: ' + error.message)
    const alerts = [...f.conditions, f.other_condition, f.allergies ? `Allergies: ${f.allergies}` : '']
      .filter((s) => s && s.trim()).join('; ')
    await sb.from('dental_patients').update({ medical_alerts: alerts || null }).eq('id', patient.id)
    setStage('done')
  }

  const filtered = patients.filter((p) => `${p.first_name} ${p.last_name}`.toLowerCase().includes(q.toLowerCase()))

  if (stage === 'form') {
    const ok = f.consent && f.signature.trim()
    return (
      <div className="content" style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div className="page-title">Hi {patient.first_name} 👋</div>
          <div className="page-sub">Please answer a few questions about your health — it keeps your treatment safe.</div>
        </div>
        <div className="grid" style={{ gap: 14 }}>
          <div className="card card-pad">
            <div className="card-title">Do any of these apply to you?</div>
            <div className="grid" style={{ gap: 8, gridTemplateColumns: '1fr 1fr' }}>
              {CONDITIONS.map((c) => (
                <button key={c} className={`pick ${f.conditions.includes(c) ? 'on' : ''}`} onClick={() => toggleCond(c)}>
                  <b style={{ fontSize: 14 }}>{c}</b>
                </button>
              ))}
            </div>
            <input className="input" style={{ marginTop: 10 }} placeholder="Anything else we should know?"
              value={f.other_condition} onChange={(e) => setF((x) => ({ ...x, other_condition: e.target.value }))} />
          </div>
          <div className="card card-pad grid" style={{ gap: 12 }}>
            <div><label className="field">Medications you take</label>
              <input className="input" value={f.medications} onChange={(e) => setF((x) => ({ ...x, medications: e.target.value }))} placeholder="e.g. warfarin, inhaler — or 'none'" /></div>
            <div><label className="field">Allergies</label>
              <input className="input" value={f.allergies} onChange={(e) => setF((x) => ({ ...x, allergies: e.target.value }))} placeholder="e.g. penicillin, latex — or 'none'" /></div>
            <div className="form-grid">
              <div>
                <label className="field">Do you smoke?</label>
                <div className="row">
                  {['No', 'Yes', 'Vape'].map((v) => (
                    <button key={v} className={`btn sm ${f.smoker === v ? '' : 'secondary'}`} onClick={() => setF((x) => ({ ...x, smoker: v }))}>{v}</button>
                  ))}
                </div>
              </div>
              <div><label className="field">Your GP</label>
                <input className="input" value={f.gp} onChange={(e) => setF((x) => ({ ...x, gp: e.target.value }))} /></div>
            </div>
            <div><label className="field">Emergency contact (name & number)</label>
              <input className="input" value={f.emergency_contact} onChange={(e) => setF((x) => ({ ...x, emergency_contact: e.target.value }))} /></div>
          </div>
          <div className="card card-pad grid" style={{ gap: 12 }}>
            <label className="row" style={{ cursor: 'pointer', alignItems: 'flex-start', gap: 10 }}>
              <input type="checkbox" checked={f.consent} onChange={(e) => setF((x) => ({ ...x, consent: e.target.checked }))} style={{ marginTop: 3 }} />
              <span className="small">I confirm the above is accurate and consent to {clinic.name} storing this information for my dental care.</span>
            </label>
            <div><label className="field">Type your full name to sign</label>
              <input className="input" value={f.signature} onChange={(e) => setF((x) => ({ ...x, signature: e.target.value }))} placeholder={`${patient.first_name} ${patient.last_name}`} /></div>
            <button className="btn" style={{ padding: '14px', justifyContent: 'center', fontSize: 15 }} disabled={!ok} onClick={submit}>
              Submit & hand back ✓
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (stage === 'done') {
    return (
      <div className="content" style={{ textAlign: 'center', paddingTop: 80 }}>
        <div style={{ fontSize: 52 }}>🎉</div>
        <div className="page-title" style={{ marginTop: 12 }}>All done, {patient.first_name}!</div>
        <div className="page-sub">Please hand the tablet back to reception — you'll be called shortly.</div>
        <button className="btn secondary" style={{ marginTop: 26 }} onClick={() => { setStage('pick'); setPatient(null); setQ('') }}>
          Reception: next patient →
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title">Check-in</div>
          <div className="page-sub">Pick the patient, hand over the tablet — their answers land straight on the record and update medical alerts.</div>
        </div>
      </div>
      <div className="content" style={{ maxWidth: 640 }}>
        <input className="input" placeholder="Find patient…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 12 }} autoFocus />
        <div className="grid" style={{ gap: 8 }}>
          {filtered.slice(0, 8).map((p) => (
            <button key={p.id} className="pick" onClick={() => start(p)}>
              <b>{p.first_name} {p.last_name}</b>
              <span>{p.phone || ''}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
