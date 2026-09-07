import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { sb, euro, fmtDate, fullName } from '../supabase.js'
import { Modal, Stat, useToast } from '../ui.jsx'
import { useClinic } from '../clinic.jsx'
import { hasPackage } from '../specialty/packages.js'
import Upsell from '../specialty/Upsell.jsx'
import PatientPicker from '../specialty/PatientPicker.jsx'
import {
  APPLIANCES, APPLIANCE_SHORT, ORTHO_STATUS, OPEN_ORTHO, orthoProgress, nextVisitDue,
  newOrthoForm, saveOrthoCase, recordInstalment, OrthoCaseModal, OrthoVisitForm,
} from '../specialty/OrthoTab.jsx'

const FILTERS = [['all', 'All'], ['consult', 'Consultation'], ['records', 'Records'], ['active', 'Active'], ['retention', 'Retention'], ['completed', 'Completed']]
const isoDate = (d) => d.toISOString().slice(0, 10)
const plusDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return isoDate(d) }

export default function Ortho() {
  const { clinic } = useClinic()
  const enabled = hasPackage(clinic, 'ortho')
  const toast = useToast()
  const [cases, setCases] = useState([])
  const [inst, setInst] = useState([])
  const [lastVisit, setLastVisit] = useState({}) // case_id -> most recent visit
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [picking, setPicking] = useState(false)
  const [target, setTarget] = useState(null)   // patient chosen for a new case
  const [editing, setEditing] = useState(null)  // case form (new or existing)
  const [logging, setLogging] = useState(null)  // case receiving a visit

  const load = () => {
    sb.from('dental_ortho_cases').select('*, patient:dental_patients(id,first_name,last_name,phone,dob,archived)').order('created_at', { ascending: false })
      .then(({ data }) => setCases((data || []).filter((c) => c.patient && !c.patient.archived)))
    sb.from('dental_ortho_instalments').select('*').order('due_date').then(({ data }) => setInst(data || []))
    sb.from('dental_ortho_visits').select('case_id,visit_date,next_weeks').order('visit_date', { ascending: false })
      .then(({ data }) => { const m = {}; for (const v of data || []) if (!m[v.case_id]) m[v.case_id] = v; setLastVisit(m) })
  }
  useEffect(() => { if (enabled) load() }, [clinic])

  const today = isoDate(new Date())
  const soon = plusDays(7)
  const byCase = useMemo(() => Object.fromEntries(cases.map((c) => [c.id, c])), [cases])
  const money = useMemo(() => {
    const m = {}
    for (const i of inst) {
      const r = (m[i.case_id] ||= { paid: 0, overdue: 0, overdueCount: 0, next: null })
      if (i.paid_on) r.paid += Number(i.amount)
      else if (i.due_date < today) { r.overdue += Number(i.amount); r.overdueCount++ }
      else if (!r.next || i.due_date < r.next) r.next = i.due_date
    }
    return m
  }, [inst, today])

  if (!enabled) {
    return (
      <>
        <div className="topbar"><div><div className="page-title">Orthodontics</div><div className="page-sub">Specialty package</div></div></div>
        <div className="content"><Upsell pkg="ortho" /></div>
      </>
    )
  }

  const dueDate = (c) => nextVisitDue(lastVisit[c.id])

  const active = cases.filter((c) => c.status === 'active')
  const retention = cases.filter((c) => c.status === 'retention')
  const overdueTotal = Object.values(money).reduce((s, r) => s + r.overdue, 0)
  const overdueCases = Object.values(money).filter((r) => r.overdue > 0).length
  const visitsDue = cases.filter((c) => c.status === 'active' && (!lastVisit[c.id] || dueDate(c) <= soon))
  const openPatientIds = new Set(cases.filter((c) => OPEN_ORTHO.includes(c.status)).map((c) => c.patient_id))

  const needle = q.trim().toLowerCase()
  const rows = cases.filter((c) =>
    (filter === 'all' || c.status === filter) &&
    (!needle || `${fullName(c.patient)} ${c.patient?.phone || ''} ${APPLIANCES[c.appliance] || ''}`.toLowerCase().includes(needle))
  )

  // Work queues for the side column
  const instDue = inst.filter((i) => !i.paid_on && i.due_date <= plusDays(30) && byCase[i.case_id]).slice(0, 12)
  const adjustments = visitsDue.map((c) => ({ c, due: dueDate(c) })).sort((a, b) => (a.due || '').localeCompare(b.due || '')).slice(0, 10)

  const startCase = (patient) => { setPicking(false); setTarget(patient); setEditing(newOrthoForm()) }
  const save = async (form) => {
    const patientId = editing?.id ? editing.patient_id : target?.id
    const { error } = await saveOrthoCase(patientId, form, editing?.id)
    if (error) return toast('Error: ' + error.message)
    toast(editing?.id ? 'Case updated' : `Ortho case opened for ${fullName(target)}`)
    setEditing(null); setTarget(null)
    load()
  }
  const record = async (i) => {
    const c = byCase[i.case_id]
    const { error } = await recordInstalment(i, c.patient_id)
    if (error) return toast('Error: ' + error.message)
    toast(`${euro(i.amount)} recorded for ${fullName(c.patient)}`)
    load()
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title">Orthodontics</div>
          <div className="page-sub">{active.length} in active treatment · {retention.length} in retention{overdueTotal ? ` · ${euro(overdueTotal)} overdue` : ''}</div>
        </div>
        <button className="btn" onClick={() => setPicking(true)}>+ Add patient</button>
      </div>
      <div className="content">
        <div className="stats" style={{ marginBottom: 18 }}>
          <Stat label="Active cases" value={active.length} detail={`${cases.filter((c) => ['consult', 'records'].includes(c.status)).length} awaiting start`} icon={null} />
          <Stat label="In retention" value={retention.length} detail={`${cases.filter((c) => c.status === 'completed').length} completed`} icon={null} />
          <Stat label="Overdue instalments" value={euro(overdueTotal)} detail={overdueCases ? `across ${overdueCases} case(s)` : 'all up to date'} icon={null} />
          <Stat label="Adjustments due" value={visitsDue.length} detail="within 7 days or never seen" icon={null} />
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
              <span className="row" style={{ gap: 8 }}>
                <input className="input" style={{ width: 220 }} placeholder="Search patient…" value={q} onChange={(e) => setQ(e.target.value)} />
                <button className="btn secondary" style={{ whiteSpace: 'nowrap' }} onClick={() => setPicking(true)}>+ Add patient</button>
              </span>
            </div>
            <table className="tbl" style={{ marginTop: 8 }}>
              <thead><tr><th>Patient</th><th>Appliance</th><th>Status</th><th>Progress</th><th>Next visit</th><th>Plan</th><th></th></tr></thead>
              <tbody>
                {rows.map((c) => {
                  const [label, cls] = ORTHO_STATUS[c.status] || [c.status, 'b-gray']
                  const p = orthoProgress(c)
                  const m = money[c.id] || { paid: 0, overdue: 0 }
                  const paid = m.paid + Number(c.deposit || 0)
                  const due = dueDate(c)
                  const lv = lastVisit[c.id]
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link to={`/patients/${c.patient.id}?tab=Ortho`} style={{ fontWeight: 600, color: 'var(--accent-strong)' }}>{fullName(c.patient)}</Link>
                        <div className="small muted">{c.patient.phone || '—'}</div>
                      </td>
                      <td>
                        {APPLIANCE_SHORT[c.appliance] || c.appliance}
                        {c.appliance === 'aligners' && c.aligner_total ? <div className="small muted">tray {c.aligner_current || 0}/{c.aligner_total}</div> : null}
                        {c.start_date && <div className="small muted">from {fmtDate(c.start_date)}</div>}
                      </td>
                      <td><span className={`badge ${cls}`}>{label}</span></td>
                      <td style={{ minWidth: 130 }}>
                        {c.status === 'active' ? (
                          <div className="row" style={{ gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: 'var(--line-soft)', borderRadius: 99 }}><div style={{ height: 6, width: `${p}%`, background: 'var(--accent)', borderRadius: 99 }} /></div>
                            <span className="small muted">{p}%</span>
                          </div>
                        ) : <span className="muted">—</span>}
                      </td>
                      <td className="small">
                        {c.status !== 'active' && c.status !== 'retention' ? <span className="muted">—</span>
                          : !lv ? <span className="badge b-amber">not yet seen</span>
                          : due && due < today ? <><span className="badge b-red">overdue</span><div className="muted">{fmtDate(due)}</div></>
                          : due ? <>{fmtDate(due)}<div className="muted">last {fmtDate(lv.visit_date)}</div></>
                          : <span className="muted">last {fmtDate(lv.visit_date)}</span>}
                      </td>
                      <td className="small">
                        <span className="mono">{euro(paid)}</span><span className="muted"> / {euro(c.plan_total)}</span>
                        {m.overdue ? <div><span className="badge b-red">{euro(m.overdue)} overdue</span></div> : m.next ? <div className="muted">next {fmtDate(m.next)}</div> : null}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                        {['active', 'retention'].includes(c.status) && <button className="btn sm secondary" onClick={() => setLogging(c)}>Log visit</button>}
                        <button className="btn ghost sm" style={{ marginLeft: 4 }} onClick={() => setEditing({ ...c })}>Edit</button>
                      </td>
                    </tr>
                  )
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={7}><div className="empty">
                    {cases.length === 0 ? <>No orthodontic cases yet. <button className="btn ghost sm" onClick={() => setPicking(true)}>Add a patient</button> to open the first one.</> : 'No cases match this filter.'}
                  </div></td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="grid" style={{ gap: 14 }}>
            <div className="card card-pad">
              <div className="card-title">Adjustments due {adjustments.length > 0 && <span className="badge b-amber">{visitsDue.length}</span>}</div>
              <div className="grid" style={{ gap: 4 }}>
                {adjustments.map(({ c, due }) => (
                  <div key={c.id} className="spread small" style={{ padding: '7px 10px', background: 'var(--mint-bg)', borderRadius: 7 }}>
                    <span>
                      <Link to={`/patients/${c.patient.id}?tab=Ortho`} style={{ fontWeight: 600, color: 'var(--accent-strong)' }}>{fullName(c.patient)}</Link>
                      <div className="muted">{APPLIANCE_SHORT[c.appliance]} · {due ? (due < today ? `was due ${fmtDate(due)}` : `due ${fmtDate(due)}`) : 'no visit logged yet'}</div>
                    </span>
                    <button className="btn sm secondary" onClick={() => setLogging(c)}>Log</button>
                  </div>
                ))}
                {adjustments.length === 0 && <div className="small muted">Nothing due in the next 7 days.</div>}
              </div>
            </div>

            <div className="card card-pad">
              <div className="card-title">Instalments due {overdueCases > 0 && <span className="badge b-red">{euro(overdueTotal)} overdue</span>}</div>
              <div className="grid" style={{ gap: 4, maxHeight: 420, overflowY: 'auto' }}>
                {instDue.map((i) => {
                  const c = byCase[i.case_id]
                  const late = i.due_date < today
                  return (
                    <div key={i.id} className="spread small" style={{ padding: '7px 10px', background: 'var(--mint-bg)', borderRadius: 7 }}>
                      <span>
                        <Link to={`/patients/${c.patient.id}?tab=Ortho`} style={{ fontWeight: 600, color: 'var(--accent-strong)' }}>{fullName(c.patient)}</Link>
                        <div className="muted">{fmtDate(i.due_date)} · {euro(i.amount)} {late && <span className="badge b-red" style={{ marginLeft: 4 }}>overdue</span>}</div>
                      </span>
                      <button className="btn sm secondary" onClick={() => record(i)}>Record</button>
                    </div>
                  )
                })}
                {instDue.length === 0 && <div className="small muted">Nothing due in the next 30 days.</div>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {picking && (
        <PatientPicker title="Add patient to orthodontics" hint="Pick an existing patient or create a new record, then fill in the case." taken={openPatientIds} onPick={startCase} onClose={() => setPicking(false)} />
      )}
      {editing && (
        <OrthoCaseModal form={editing} setForm={setEditing} onSave={save} onClose={() => { setEditing(null); setTarget(null) }}
          patientName={editing.id ? fullName(byCase[editing.id]?.patient) : fullName(target)} />
      )}
      {logging && (
        <Modal title={`Log visit — ${fullName(logging.patient)}`} onClose={() => setLogging(null)}>
          <p className="small muted" style={{ marginTop: -6, marginBottom: 12 }}>{APPLIANCES[logging.appliance]}{logging.appliance === 'aligners' && logging.aligner_total ? ` · currently tray ${logging.aligner_current || 0} of ${logging.aligner_total}` : ''}</p>
          <OrthoVisitForm c={logging} onSaved={() => { setLogging(null); load() }} onCancel={() => setLogging(null)} />
        </Modal>
      )}
    </>
  )
}
