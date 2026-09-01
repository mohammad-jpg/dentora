import { useEffect, useMemo, useState } from 'react'
import { sb, fmtTime, fullName } from '../supabase.js'
import { Modal, STATUS_META, useToast } from '../ui.jsx'
import { useClinic } from '../clinic.jsx'

const DAY_START = 8 // 08:00
const DAY_END = 18 // 18:00
const SLOT_MIN = 15
const SLOT_PX = 24 // px per 15 min

const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function localISO(date, h, m) {
  const d = new Date(date)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

export default function Diary() {
  const [date, setDate] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d })
  const [pracs, setPracs] = useState([])
  const [patients, setPatients] = useState([])
  const [appts, setAppts] = useState([])
  const [rota, setRota] = useState([])
  const [editing, setEditing] = useState(null) // appt object or {new: true, prac, h, m}
  const toast = useToast()
  const { clinicId } = useClinic()

  useEffect(() => {
    sb.from('dental_practitioners').select('*').eq('active', true).order('name').then(({ data }) => setPracs(data || []))
    sb.from('dental_patients').select('id,first_name,last_name').order('last_name').then(({ data }) => setPatients(data || []))
    sb.from('dental_rota').select('*').then(({ data }) => setRota(data || []))
  }, [])

  const load = () => {
    const start = new Date(date)
    const end = new Date(date); end.setHours(23, 59, 59)
    sb.from('dental_appointments')
      .select('*, patient:dental_patients(id,first_name,last_name)')
      .gte('starts_at', start.toISOString()).lte('starts_at', end.toISOString())
      .then(({ data }) => setAppts(data || []))
  }
  useEffect(load, [date])

  const hours = useMemo(() => Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i), [])
  const slots = (DAY_END - DAY_START) * (60 / SLOT_MIN)

  const shiftDay = (n) => setDate((d) => { const x = new Date(d); x.setDate(x.getDate() + n); return x })

  const apptStyle = (a, prac) => {
    const s = new Date(a.starts_at)
    const e = new Date(a.ends_at)
    const top = ((s.getHours() - DAY_START) * 60 + s.getMinutes()) / SLOT_MIN * SLOT_PX
    const height = Math.max(SLOT_PX, ((e - s) / 60000) / SLOT_MIN * SLOT_PX - 3)
    const color = STATUS_META[a.status]?.color || '#2F6FD6'
    return { top, height, background: color }
  }

  const save = async (form) => {
    const payload = {
      clinic_id: clinicId,
      patient_id: form.patient_id,
      practitioner_id: form.practitioner_id,
      starts_at: localISO(date, ...form.start.split(':').map(Number)),
      ends_at: localISO(date, ...form.end.split(':').map(Number)),
      status: form.status,
      reason: form.reason,
    }
    if (editing?.id) {
      const { error } = await sb.from('dental_appointments').update(payload).eq('id', editing.id)
      if (error) return toast('Error: ' + error.message)
      toast('Appointment updated')
    } else {
      const { error } = await sb.from('dental_appointments').insert(payload)
      if (error) return toast('Error: ' + error.message)
      toast('Appointment booked')
    }
    setEditing(null)
    load()
  }

  const remove = async () => {
    await sb.from('dental_appointments').delete().eq('id', editing.id)
    toast('Appointment deleted')
    setEditing(null)
    load()
  }

  const gridCols = `64px repeat(${pracs.length}, minmax(180px, 1fr))`

  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title">Diary</div>
          <div className="page-sub">Click an empty slot to book · click an appointment to edit</div>
        </div>
        <div className="row">
          <button className="btn secondary sm" onClick={() => shiftDay(-1)}>←</button>
          <button className="btn secondary sm" onClick={() => { const d = new Date(); d.setHours(0,0,0,0); setDate(d) }}>Today</button>
          <input type="date" className="input" style={{ width: 160 }} value={dayKey(date)}
            onChange={(e) => { if (e.target.value) { const d = new Date(e.target.value + 'T00:00'); setDate(d) } }} />
          <button className="btn secondary sm" onClick={() => shiftDay(1)}>→</button>
        </div>
      </div>
      <div className="content diary-wrap">
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>
          {date.toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
        <div className="diary-grid">
          <div className="diary-head" style={{ gridTemplateColumns: gridCols }}>
            <div />
            {pracs.map((p) => {
              const wd = (date.getDay() + 6) % 7
              const r = rota.find((x) => x.practitioner_id === p.id && x.weekday === wd)
              const where = !r ? p.role : r.status === 'working' ? `${p.role} · ${r.room}` : r.status === 'leave' ? `${p.role} · on leave` : `${p.role} · off today`
              return (
                <div className="col-h" key={p.id}>
                  <span style={{ color: p.color }}>●</span> {p.name}
                  <div className="role">{where}</div>
                </div>
              )
            })}
          </div>
          <div className="diary-body" style={{ gridTemplateColumns: gridCols }}>
            <div className="time-col">
              {hours.map((h) => (
                <div className="time-cell" key={h} style={{ height: SLOT_PX * 4 }}>{String(h).padStart(2, '0')}:00</div>
              ))}
            </div>
            {pracs.map((prac) => (
              <div className="prac-col" key={prac.id} style={{ height: slots * SLOT_PX }}>
                {Array.from({ length: slots }, (_, i) => {
                  const h = DAY_START + Math.floor(i / 4)
                  const m = (i % 4) * 15
                  return (
                    <div key={i} className="slot" title={`Book ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`}
                      onClick={() => setEditing({ practitioner_id: prac.id, start: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` })} />
                  )
                })}
                {appts.filter((a) => a.practitioner_id === prac.id).map((a) => {
                  const st = apptStyle(a, prac)
                  return (
                    <div key={a.id} className="appt" style={st} onClick={() => setEditing(a)}>
                      <b>{fullName(a.patient)}</b>
                      <span className="st">{fmtTime(a.starts_at)} · {a.reason}</span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 14 }}>
          {Object.entries(STATUS_META).map(([k, m]) => (
            <span key={k} className="row small muted" style={{ gap: 6 }}>
              <span className="swatch" style={{ background: m.color }} /> {m.label}
            </span>
          ))}
        </div>
      </div>

      {editing && (
        <ApptModal
          key={editing.id || 'new'}
          appt={editing}
          patients={patients}
          pracs={pracs}
          onSave={save}
          onDelete={editing.id ? remove : null}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

function ApptModal({ appt, patients, pracs, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(() => ({
    patient_id: appt.patient_id || patients[0]?.id || '',
    practitioner_id: appt.practitioner_id || pracs[0]?.id || '',
    start: appt.starts_at ? fmtTime(appt.starts_at) : appt.start || '09:00',
    end: appt.ends_at ? fmtTime(appt.ends_at) : addMin(appt.start || '09:00', 30),
    status: appt.status || 'booked',
    reason: appt.reason || '',
  }))
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <Modal title={appt.id ? 'Edit appointment' : 'New appointment'} onClose={onClose}>
      <div className="form-grid">
        <div style={{ gridColumn: '1/-1' }}>
          <label className="field">Patient</label>
          <select className="input" value={form.patient_id} onChange={set('patient_id')}>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.last_name}, {p.first_name}</option>)}
          </select>
        </div>
        <div>
          <label className="field">Clinician</label>
          <select className="input" value={form.practitioner_id} onChange={set('practitioner_id')}>
            {pracs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field">Status</label>
          <select className="input" value={form.status} onChange={set('status')}>
            {Object.entries(STATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="field">Start</label>
          <input type="time" className="input" value={form.start} onChange={set('start')} step={300} />
        </div>
        <div>
          <label className="field">End</label>
          <input type="time" className="input" value={form.end} onChange={set('end')} step={300} />
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label className="field">Reason / treatment</label>
          <input className="input" value={form.reason} onChange={set('reason')} placeholder="e.g. Exam + scale & polish" />
        </div>
      </div>
      <div className="actions">
        {onDelete && <button className="btn danger" onClick={onDelete} style={{ marginRight: 'auto' }}>Delete</button>}
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn" onClick={() => onSave(form)}>Save</button>
      </div>
    </Modal>
  )
}

function addMin(hhmm, mins) {
  const [h, m] = hhmm.split(':').map(Number)
  const t = h * 60 + m + mins
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}
