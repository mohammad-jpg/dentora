import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { sb, euro, fullName } from '../supabase.js'
import { useClinic } from '../clinic.jsx'
import { hasPackage } from '../specialty/packages.js'
import Upsell from '../specialty/Upsell.jsx'
import { APPLIANCES, ORTHO_STATUS, orthoProgress } from '../specialty/OrthoTab.jsx'

export default function Ortho() {
  const { clinic } = useClinic()
  const [cases, setCases] = useState([])
  const [inst, setInst] = useState([])

  useEffect(() => {
    if (!hasPackage(clinic, 'ortho')) return
    sb.from('dental_ortho_cases').select('*, patient:dental_patients(id,first_name,last_name)').order('created_at', { ascending: false })
      .then(({ data }) => setCases(data || []))
    sb.from('dental_ortho_instalments').select('*').is('paid_on', null).then(({ data }) => setInst(data || []))
  }, [clinic])

  if (!hasPackage(clinic, 'ortho')) {
    return (
      <>
        <div className="topbar"><div><div className="page-title">Orthodontics</div><div className="page-sub">Specialty package</div></div></div>
        <div className="content"><Upsell pkg="ortho" /></div>
      </>
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  const overdueByCase = {}
  for (const i of inst) if (i.due_date < today) overdueByCase[i.case_id] = (overdueByCase[i.case_id] || 0) + Number(i.amount)
  const active = cases.filter((c) => ['active', 'records', 'consult'].includes(c.status))
  const overdueTotal = Object.values(overdueByCase).reduce((s, v) => s + v, 0)

  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title">Orthodontics</div>
          <div className="page-sub">{active.length} active case(s){overdueTotal ? ` · ${euro(overdueTotal)} in overdue instalments` : ''}</div>
        </div>
      </div>
      <div className="content">
        <div className="card">
          <table className="tbl">
            <thead><tr><th>Patient</th><th>Appliance</th><th>Status</th><th>Progress</th><th>Plan</th><th>Instalments</th></tr></thead>
            <tbody>
              {cases.map((c) => {
                const [label, cls] = ORTHO_STATUS[c.status] || [c.status, 'b-gray']
                const p = orthoProgress(c)
                return (
                  <tr key={c.id}>
                    <td><Link to={`/patients/${c.patient?.id}`} style={{ fontWeight: 600, color: 'var(--accent-strong)' }}>{fullName(c.patient)}</Link></td>
                    <td>{APPLIANCES[c.appliance]}{c.appliance === 'aligners' && c.aligner_total ? <span className="muted"> · tray {c.aligner_current || 0}/{c.aligner_total}</span> : ''}</td>
                    <td><span className={`badge ${cls}`}>{label}</span></td>
                    <td style={{ minWidth: 140 }}>
                      {c.status === 'active' ? (
                        <div className="row" style={{ gap: 8 }}>
                          <div style={{ flex: 1, height: 6, background: 'var(--line-soft)', borderRadius: 99 }}><div style={{ height: 6, width: `${p}%`, background: 'var(--accent)', borderRadius: 99 }} /></div>
                          <span className="small muted">{p}%</span>
                        </div>
                      ) : <span className="muted">—</span>}
                    </td>
                    <td className="mono">{euro(c.plan_total)}</td>
                    <td>{overdueByCase[c.id] ? <span className="badge b-red">{euro(overdueByCase[c.id])} overdue</span> : <span className="muted small">up to date</span>}</td>
                  </tr>
                )
              })}
              {cases.length === 0 && <tr><td colSpan={6}><div className="empty">No orthodontic cases yet — open one from a patient's Ortho tab.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
