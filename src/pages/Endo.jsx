import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { sb, fmtDate, fullName } from '../supabase.js'
import { Stat, useToast } from '../ui.jsx'
import { useClinic } from '../clinic.jsx'
import { hasPackage } from '../specialty/packages.js'
import Upsell from '../specialty/Upsell.jsx'
import PatientPicker from '../specialty/PatientPicker.jsx'
import {
  PULPAL, APICAL, ENDO_STATUS, OPEN_ENDO, newEndoForm, editEndoForm, saveEndoCase, buildEndoReport, EndoCaseModal, EndoReportModal,
} from '../specialty/EndoTab.jsx'

const FILTERS = [['all', 'All'], ['planned', 'Planned'], ['in_progress', 'In progress'], ['review', 'Under review'], ['completed', 'Completed']]
const isoDate = (d) => d.toISOString().slice(0, 10)
const plusDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return isoDate(d) }

export default function Endo() {
  const { clinic } = useClinic()
  const enabled = hasPackage(clinic, 'endo')
  const toast = useToast()
  const [cases, setCases] = useState([])
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [picking, setPicking] = useState(false)
  const [target, setTarget] = useState(null)
  const [editing, setEditing] = useState(null)
  const [report, setReport] = useState(null)

  const load = () =>
    sb.from('dental_endo_cases').select('*, patient:dental_patients(id,first_name,last_name,phone,dob,archived)').order('created_at', { ascending: false })
      .then(({ data }) => setCases((data || []).filter((c) => c.patient && !c.patient.archived)))
  useEffect(() => { if (enabled) load() }, [clinic])

  const today = isoDate(new Date())
  const byId = useMemo(() => Object.fromEntries(cases.map((c) => [c.id, c])), [cases])

  if (!enabled) {
    return (
      <>
        <div className="topbar"><div><div className="page-title">Endodontics</div><div className="page-sub">Specialty package</div></div></div>
        <div className="content"><Upsell pkg="endo" /></div>
      </>
    )
  }

  const open = cases.filter((c) => OPEN_ENDO.includes(c.status))
  const inProgress = cases.filter((c) => c.status === 'in_progress')
  const reviewsDue = cases.filter((c) => c.review_due && c.review_due <= plusDays(14) && c.status !== 'completed')
    .sort((a, b) => a.review_due.localeCompare(b.review_due))
  const reviewsOverdue = reviewsDue.filter((c) => c.review_due < today)
  const referred = cases.filter((c) => c.referrer)
  const reportQueue = cases.filter((c) => c.referrer && c.status === 'completed').slice(0, 8)
  const openPatientIds = new Set(open.map((c) => c.patient_id))

  const needle = q.trim().toLowerCase()
  const rows = cases.filter((c) =>
    (filter === 'all' || c.status === filter) &&
    (!needle || `${fullName(c.patient)} ${c.patient?.phone || ''} ${c.tooth} ${c.referrer || ''}`.toLowerCase().includes(needle))
  )

  const startCase = (patient) => { setPicking(false); setTarget(patient); setEditing(newEndoForm()) }
  const save = async (form) => {
    const patientId = editing?.id ? editing.patient_id : target?.id
    const { error } = await saveEndoCase(patientId, form, editing?.id)
    if (error) return toast('Error: ' + error.message)
    toast(editing?.id ? 'Endo case updated' : `Endo case opened for ${fullName(target)} — tooth ${form.tooth}`)
    setEditing(null); setTarget(null)
    load()
  }
  const setStatus = async (c, status) => {
    const { error } = await sb.from('dental_endo_cases').update({ status }).eq('id', c.id)
    if (error) return toast('Error: ' + error.message)
    toast(`Tooth ${c.tooth} marked ${ENDO_STATUS[status][0].toLowerCase()}`)
    load()
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title">Endodontics</div>
          <div className="page-sub">{open.length} open case(s){reviewsDue.length ? ` · ${reviewsDue.length} review(s) due` : ''}</div>
        </div>
        <button className="btn" onClick={() => setPicking(true)}>+ Add patient</button>
      </div>
      <div className="content">
        <div className="stats" style={{ marginBottom: 18 }}>
          <Stat label="Open cases" value={open.length} detail={`${inProgress.length} in progress · ${cases.filter((c) => c.status === 'planned').length} planned`} icon={null} />
          <Stat label="Reviews due" value={reviewsDue.length} detail={reviewsOverdue.length ? `${reviewsOverdue.length} overdue` : 'next 14 days'} icon={null} />
          <Stat label="Completed" value={cases.filter((c) => c.status === 'completed').length} detail="all time" icon={null} />
          <Stat label="Referred in" value={referred.length} detail={`${reportQueue.length} report(s) to send`} icon={null} />
        </div>

        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.7fr) minmax(280px, 1fr)', alignItems: 'start' }}>
          <div className="card" style={{ minWidth: 0, overflowX: 'auto' }}>
            <div className="spread" style={{ padding: '12px 16px 0' }}>
              <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
                {FILTERS.map(([k, l]) => {
                  const n = k === 'all' ? cases.length : cases.filter((c) => c.status === k).length
                  return <button key={k} className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>{l}{n ? <span className="muted" style={{ marginLeft: 5, fontWeight: 500 }}>{n}</span> : null}</button>
                })}
              </div>
              <input className="input" style={{ width: 220 }} placeholder="Search patient, tooth, referrer…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <table className="tbl" style={{ marginTop: 8 }}>
              <thead><tr><th>Patient</th><th>Tooth</th><th>Diagnosis</th><th>Canals</th><th>Visits</th><th>Review</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {rows.map((c) => {
                  const [label, cls] = ENDO_STATUS[c.status] || [c.status, 'b-gray']
                  const due = c.review_due && c.review_due <= today && c.status !== 'completed'
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link to={`/patients/${c.patient.id}?tab=Endo`} style={{ fontWeight: 600, color: 'var(--accent-strong)' }}>{fullName(c.patient)}</Link>
                        <div className="small muted">{c.referrer ? `ref. ${c.referrer}` : c.patient.phone || '—'}</div>
                      </td>
                      <td style={{ fontWeight: 600, fontSize: 15 }}>{c.tooth}</td>
                      <td className="small">{PULPAL[c.diagnosis_pulpal] || '—'}<div className="muted">{APICAL[c.diagnosis_apical] || ''}</div></td>
                      <td className="small">{(c.canals || []).map((k) => k.name).filter(Boolean).join(', ') || '—'}</td>
                      <td>{c.visits}</td>
                      <td className="small">{c.review_due ? fmtDate(c.review_due) : '—'}{due && <span className="badge b-amber" style={{ marginLeft: 6 }}>due</span>}</td>
                      <td><span className={`badge ${cls}`}>{label}</span></td>
                      <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                        {c.status === 'planned' && <button className="btn sm secondary" onClick={() => setStatus(c, 'in_progress')}>Start</button>}
                        {c.status === 'in_progress' && <button className="btn sm secondary" onClick={() => setStatus(c, 'completed')}>Complete</button>}
                        {c.status === 'review' && <button className="btn sm secondary" onClick={() => setStatus(c, 'completed')}>Sign off</button>}
                        {c.referrer && <button className="btn ghost sm" style={{ marginLeft: 4 }} onClick={() => setReport(buildEndoReport(clinic, c.patient, c))}>Report</button>}
                        <button className="btn ghost sm" style={{ marginLeft: 4 }} onClick={() => setEditing(editEndoForm(c))}>Edit</button>
                      </td>
                    </tr>
                  )
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={8}><div className="empty">
                    {cases.length === 0 ? <>No endodontic cases yet. <button className="btn ghost sm" onClick={() => setPicking(true)}>Add a patient</button> to open the first one.</> : 'No cases match this filter.'}
                  </div></td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="grid" style={{ gap: 14 }}>
            <div className="card card-pad">
              <div className="card-title">Reviews due {reviewsOverdue.length > 0 && <span className="badge b-red">{reviewsOverdue.length} overdue</span>}</div>
              <div className="grid" style={{ gap: 4 }}>
                {reviewsDue.slice(0, 10).map((c) => (
                  <div key={c.id} className="spread small" style={{ padding: '7px 10px', background: 'var(--mint-bg)', borderRadius: 7 }}>
                    <span>
                      <Link to={`/patients/${c.patient.id}?tab=Endo`} style={{ fontWeight: 600, color: 'var(--accent-strong)' }}>{fullName(c.patient)}</Link>
                      <div className="muted">Tooth {c.tooth} · {c.review_due < today ? `was due ${fmtDate(c.review_due)}` : `due ${fmtDate(c.review_due)}`}</div>
                    </span>
                    <button className="btn sm secondary" onClick={() => setEditing(editEndoForm(c))}>Record</button>
                  </div>
                ))}
                {reviewsDue.length === 0 && <div className="small muted">No reviews due in the next 14 days.</div>}
              </div>
              <p className="small muted" style={{ marginTop: 10, marginBottom: 0 }}>Record the clinical and radiographic findings in Outcome, then set the status to Completed.</p>
            </div>

            <div className="card card-pad">
              <div className="card-title">Reports to referrers</div>
              <div className="grid" style={{ gap: 4 }}>
                {reportQueue.map((c) => (
                  <div key={c.id} className="spread small" style={{ padding: '7px 10px', background: 'var(--mint-bg)', borderRadius: 7 }}>
                    <span>
                      <span style={{ fontWeight: 600 }}>{fullName(c.patient)}</span>
                      <div className="muted">Tooth {c.tooth} · {c.referrer}</div>
                    </span>
                    <button className="btn sm secondary" onClick={() => setReport(buildEndoReport(clinic, c.patient, c))}>Open</button>
                  </div>
                ))}
                {reportQueue.length === 0 && <div className="small muted">Completed cases with a referring dentist appear here.</div>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {picking && (
        <PatientPicker title="Add patient to endodontics" hint="Pick an existing patient or create a new record, then enter the tooth and findings." taken={openPatientIds} onPick={startCase} onClose={() => setPicking(false)} />
      )}
      {editing && (
        <EndoCaseModal form={editing} setForm={setEditing} onSave={save} onClose={() => { setEditing(null); setTarget(null) }}
          patientName={editing.id ? fullName(byId[editing.id]?.patient) : fullName(target)} />
      )}
      {report && <EndoReportModal report={report} onClose={() => setReport(null)} />}
    </>
  )
}
