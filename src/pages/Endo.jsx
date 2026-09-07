import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { sb, fmtDate, fullName } from '../supabase.js'
import { useClinic } from '../clinic.jsx'
import { hasPackage } from '../specialty/packages.js'
import Upsell from '../specialty/Upsell.jsx'
import { PULPAL, APICAL, ENDO_STATUS } from '../specialty/EndoTab.jsx'

export default function Endo() {
  const { clinic } = useClinic()
  const [cases, setCases] = useState([])

  useEffect(() => {
    if (!hasPackage(clinic, 'endo')) return
    sb.from('dental_endo_cases').select('*, patient:dental_patients(id,first_name,last_name)').order('created_at', { ascending: false })
      .then(({ data }) => setCases(data || []))
  }, [clinic])

  if (!hasPackage(clinic, 'endo')) {
    return (
      <>
        <div className="topbar"><div><div className="page-title">Endodontics</div><div className="page-sub">Specialty package</div></div></div>
        <div className="content"><Upsell pkg="endo" /></div>
      </>
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  const reviewsDue = cases.filter((c) => c.review_due && c.review_due <= today && c.status !== 'completed')
  const open = cases.filter((c) => ['planned', 'in_progress'].includes(c.status))

  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title">Endodontics</div>
          <div className="page-sub">{open.length} open case(s){reviewsDue.length ? ` · ${reviewsDue.length} review(s) due` : ''}</div>
        </div>
      </div>
      <div className="content">
        <div className="card">
          <table className="tbl">
            <thead><tr><th>Patient</th><th>Tooth</th><th>Diagnosis</th><th>Canals</th><th>Visits</th><th>Review</th><th>Status</th></tr></thead>
            <tbody>
              {cases.map((c) => {
                const [label, cls] = ENDO_STATUS[c.status] || [c.status, 'b-gray']
                const due = c.review_due && c.review_due <= today && c.status !== 'completed'
                return (
                  <tr key={c.id}>
                    <td><Link to={`/patients/${c.patient?.id}`} style={{ fontWeight: 600, color: 'var(--accent-strong)' }}>{fullName(c.patient)}</Link></td>
                    <td style={{ fontWeight: 600 }}>{c.tooth}</td>
                    <td className="small">{PULPAL[c.diagnosis_pulpal] || '—'}<div className="muted">{APICAL[c.diagnosis_apical] || ''}</div></td>
                    <td className="small">{(c.canals || []).map((k) => k.name).filter(Boolean).join(', ') || '—'}</td>
                    <td>{c.visits}</td>
                    <td>{c.review_due ? fmtDate(c.review_due) : '—'}{due && <span className="badge b-amber" style={{ marginLeft: 6 }}>due</span>}</td>
                    <td><span className={`badge ${cls}`}>{label}</span></td>
                  </tr>
                )
              })}
              {cases.length === 0 && <tr><td colSpan={7}><div className="empty">No endodontic cases yet — open one from a patient's Endo tab.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
