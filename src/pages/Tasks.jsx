import { useEffect, useState } from 'react'
import { sb, fmtDate } from '../supabase.js'
import { useToast } from '../ui.jsx'
import { useClinic } from '../clinic.jsx'

export default function Tasks() {
  const { clinicId } = useClinic()
  const [tasks, setTasks] = useState([])
  const [title, setTitle] = useState('')
  const [assignee, setAssignee] = useState('Reception')
  const [due, setDue] = useState('')
  const [team, setTeam] = useState([])
  const toast = useToast()

  const load = () =>
    sb.from('dental_tasks').select('*').order('done').order('due_date').then(({ data }) => setTasks(data || []))
  useEffect(() => {
    load()
    sb.from('dental_practitioners').select('name').eq('clinic_id', clinicId).order('name').then(({ data }) => setTeam((data || []).map((p) => p.name)))
  }, [])

  const add = async () => {
    if (!title.trim()) return
    await sb.from('dental_tasks').insert({ title: title.trim(), assignee, due_date: due || null, clinic_id: clinicId })
    setTitle(''); setDue('')
    toast('Task added')
    load()
  }
  const toggle = async (t) => {
    await sb.from('dental_tasks').update({ done: !t.done }).eq('id', t.id)
    load()
  }
  const del = async (t) => {
    await sb.from('dental_tasks').delete().eq('id', t.id)
    load()
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title">Tasks</div>
          <div className="page-sub">{tasks.filter((t) => !t.done).length} open</div>
        </div>
      </div>
      <div className="content grid" style={{ gap: 16, maxWidth: 760 }}>
        <div className="card card-pad row">
          <input className="input" placeholder="New task…" value={title} onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()} />
          <select className="input" style={{ width: 170 }} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            {['Reception', 'Practice Manager', ...team].map((a) => <option key={a}>{a}</option>)}
          </select>
          <input type="date" className="input" style={{ width: 150 }} value={due} onChange={(e) => setDue(e.target.value)} />
          <button className="btn" onClick={add}>Add</button>
        </div>
        <div className="card">
          <table className="tbl">
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td style={{ width: 34 }}><input type="checkbox" checked={t.done} onChange={() => toggle(t)} /></td>
                  <td style={{ textDecoration: t.done ? 'line-through' : 'none', color: t.done ? 'var(--ink-40)' : 'inherit', fontWeight: 500 }}>
                    {t.title}
                    <div className="small muted">{t.assignee}</div>
                  </td>
                  <td className="small muted" style={{ width: 110 }}>{t.due_date ? fmtDate(t.due_date) : ''}</td>
                  <td style={{ width: 40, textAlign: 'right' }}><button className="btn ghost sm" onClick={() => del(t)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
