import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { sb, fmtDate, fullName } from '../supabase.js'
import { useToast } from '../ui.jsx'
import { useClinic } from '../clinic.jsx'

export default function Recalls() {
  const { clinic } = useClinic()
  const [recalls, setRecalls] = useState([])
  const toast = useToast()

  const load = () =>
    sb.from('dental_recalls').select('*, patient:dental_patients(id,first_name,last_name,phone)')
      .neq('status', 'done').order('due_date').then(({ data }) => setRecalls(data || []))
  useEffect(() => { load() }, [])

  const remind = async (r) => {
    await sb.from('dental_comms_log').insert({
      patient_id: r.patient.id, channel: 'sms',
      body: `Hi ${r.patient.first_name}, you're due your ${r.recall_type.toLowerCase()} at ${clinic.name}. ${clinic.phone ? `Call ${clinic.phone} to book.` : ''}`,
    })
    await sb.from('dental_recalls').update({ status: 'contacted' }).eq('id', r.id)
    toast(`Reminder sent to ${fullName(r.patient)} (demo)`)
    load()
  }
  const setStatus = async (r, status) => {
    await sb.from('dental_recalls').update({ status }).eq('id', r.id)
    load()
  }

  const overdue = (d) => new Date(d) < new Date()
  const cls = { due: 'b-amber', contacted: 'b-blue', booked: 'b-green' }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title">Recalls</div>
          <div className="page-sub">{recalls.filter((r) => r.status === 'due').length} patients due · automated reminders keep the chairs full</div>
        </div>
        <button className="btn" onClick={async () => {
          const { data, error } = await sb.functions.invoke('recall-engine', { body: {} })
          if (error || data?.error) return toast(data?.error || 'Automation run failed.')
          toast(`Automation ran — ${data.processed} reminder(s) sent (${data.mode} mode)`)
          load()
        }}>▶ Run automation now</button>
      </div>
      <div className="content">
        <div className="card card-pad" style={{ borderLeft: '4px solid var(--teal)', marginBottom: 16 }}>
          <b style={{ fontFamily: 'var(--font-display)', fontSize: 14 }}>Automatic recalls are on</b>
          <p className="small muted" style={{ marginTop: 4 }}>
            Each patient gets exactly two texts — one week before their recall is due and one the day before —
            with your online booking link, so nobody gets spammed. Booked online? It lands straight in your diary.
            Currently in demo mode (messages logged, not transmitted); add a Twilio number to go live.
          </p>
        </div>
        <div className="card">
          <table className="tbl">
            <thead><tr><th>Patient</th><th>Recall type</th><th>Due</th><th>Status</th><th /></tr></thead>
            <tbody>
              {recalls.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link to={`/patients/${r.patient?.id}`} style={{ fontWeight: 600, color: 'var(--teal-dark)' }}>{fullName(r.patient)}</Link>
                    <div className="small muted">{r.patient?.phone}</div>
                  </td>
                  <td>{r.recall_type}</td>
                  <td>
                    {fmtDate(r.due_date)}{' '}
                    {overdue(r.due_date) && r.status === 'due' && <span className="badge b-red">overdue</span>}
                  </td>
                  <td><span className={`badge ${cls[r.status] || 'b-gray'}`}>{r.status}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="row" style={{ justifyContent: 'flex-end' }}>
                      {r.status === 'due' && <button className="btn sm secondary" onClick={() => remind(r)}>Send reminder</button>}
                      {r.status !== 'booked' && <button className="btn sm ghost" onClick={() => setStatus(r, 'booked')}>Mark booked</button>}
                      <button className="btn sm ghost" onClick={() => setStatus(r, 'done')}>Done</button>
                    </span>
                  </td>
                </tr>
              ))}
              {recalls.length === 0 && <tr><td colSpan={5}><div className="empty">No open recalls 🎉</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
