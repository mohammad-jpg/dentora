import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { sb, euro, fmtTime, fullName } from '../supabase.js'
import { Stat, StatusBadge } from '../ui.jsx'
import { useClinic } from '../clinic.jsx'

export default function Dashboard() {
  const { clinic } = useClinic()
  const [appts, setAppts] = useState([])
  const [tasks, setTasks] = useState([])
  const [recallsDue, setRecallsDue] = useState(0)
  const [outstanding, setOutstanding] = useState(0)
  const [patientCount, setPatientCount] = useState(null)

  useEffect(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const end = new Date(); end.setHours(23, 59, 59, 999)
    sb.from('dental_appointments')
      .select('*, patient:dental_patients(*), practitioner:dental_practitioners(*)')
      .gte('starts_at', start.toISOString())
      .lte('starts_at', end.toISOString())
      .order('starts_at')
      .then(({ data }) => setAppts(data || []))
    sb.from('dental_tasks').select('*').eq('done', false).order('due_date').limit(6)
      .then(({ data }) => setTasks(data || []))
    sb.from('dental_recalls').select('id').eq('status', 'due')
      .then(({ data }) => setRecallsDue((data || []).length))
    sb.from('dental_patients').select('id', { count: 'exact', head: true })
      .then(({ count }) => setPatientCount(count ?? 0))
    Promise.all([
      sb.from('dental_invoices').select('total,status').neq('status', 'void'),
      sb.from('dental_payments').select('amount'),
    ]).then(([inv, pay]) => {
      const billed = (inv.data || []).reduce((s, i) => s + Number(i.total), 0)
      const paid = (pay.data || []).reduce((s, p) => s + Number(p.amount), 0)
      setOutstanding(billed - paid)
    })
  }, [])

  const seen = appts.filter((a) => ['arrived', 'completed'].includes(a.status)).length
  const today = new Date().toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title">Good morning 👋</div>
          <div className="page-sub">{today} · here's how {clinic.name} looks</div>
        </div>
        <Link to="/diary" className="btn">Open diary</Link>
      </div>
      <div className="content grid" style={{ gap: 18 }}>
        {patientCount === 0 && (
          <div className="card card-pad" style={{ borderLeft: '4px solid var(--teal)' }}>
            <div className="card-title">Getting started — 3 steps and you're running</div>
            <div className="grid" style={{ gap: 8 }}>
              <div className="row"><span className="badge b-teal">1</span><span><Link to="/settings" style={{ fontWeight: 600, color: 'var(--teal-dark)' }}>Add your team</Link> — dentists and hygienists get their own login and diary column (Settings → Team).</span></div>
              <div className="row"><span className="badge b-teal">2</span><span><Link to="/patients" style={{ fontWeight: 600, color: 'var(--teal-dark)' }}>Add your first patient</Link> — name and phone number is enough to start.</span></div>
              <div className="row"><span className="badge b-teal">3</span><span><Link to="/diary" style={{ fontWeight: 600, color: 'var(--teal-dark)' }}>Book them in</Link> — click any empty slot in the diary.</span></div>
            </div>
          </div>
        )}
        <div className="stats">
          <Stat label="Appointments today" value={appts.length} detail={`${seen} arrived or seen`} icon="🗓️" />
          <Stat label="Chair utilisation" value={appts.length ? `${Math.min(100, Math.round((appts.length / 14) * 100))}%` : '0%'} detail="of bookable slots" color="var(--violet-soft)" icon="🪥" />
          <Stat label="Outstanding balances" value={euro(outstanding)} detail="across all patients" color="var(--coral-soft)" icon="💶" />
          <Stat label="Recalls due" value={recallsDue} detail="patients to contact" color="var(--amber-soft)" icon="🔔" />
        </div>

        <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
          <div className="card card-pad">
            <div className="card-title">
              Today's schedule
              <Link to="/diary" className="small" style={{ color: 'var(--teal)', fontWeight: 600 }}>Full diary →</Link>
            </div>
            {appts.length === 0 && <div className="empty">No appointments today.</div>}
            <table className="tbl">
              <tbody>
                {appts.map((a) => (
                  <tr key={a.id}>
                    <td className="mono" style={{ width: 70, fontWeight: 600 }}>{fmtTime(a.starts_at)}</td>
                    <td>
                      <Link to={`/patients/${a.patient?.id}`} style={{ fontWeight: 600 }}>{fullName(a.patient)}</Link>
                      <div className="small muted">{a.reason}</div>
                    </td>
                    <td className="small muted">{a.practitioner?.name}</td>
                    <td style={{ textAlign: 'right' }}><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card card-pad">
            <div className="card-title">
              Open tasks
              <Link to="/tasks" className="small" style={{ color: 'var(--teal)', fontWeight: 600 }}>All tasks →</Link>
            </div>
            {tasks.length === 0 && <div className="empty">All caught up 🎉</div>}
            <div className="grid" style={{ gap: 10 }}>
              {tasks.map((t) => (
                <div key={t.id} className="spread" style={{ padding: '10px 12px', background: 'var(--mint-bg)', borderRadius: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{t.title}</div>
                    <div className="small muted">{t.assignee}</div>
                  </div>
                  {t.due_date && <span className="badge b-gray">{new Date(t.due_date).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
