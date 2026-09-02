import { useEffect, useMemo, useState } from 'react'
import { Link, Route, Routes, useNavigate } from 'react-router-dom'
import { sb, fmtDate, fmtTime } from '../supabase.js'
import { useToast } from '../ui.jsx'
import VideoCall from './VideoCall.jsx'

// Patient portal: book appointments & video consults, see and cancel your own bookings.

const REASONS = [
  ['Check-up / exam', '🪥'], ['Hygiene / cleaning', '✨'], ['Toothache / emergency', '🚨'],
  ['Whitening consult', '😁'], ['Follow-up', '🔁'], ['Something else', '💬'],
]

export default function Portal() {
  return (
    <div className="portal-shell">
      <div className="portal-top">
        <div className="row" style={{ gap: 10 }}>
          <div className="logo-mark" style={{ width: 32, height: 32, borderRadius: 9 }}>
            <svg width="17" height="17" viewBox="0 0 64 64">
              <path d="M22 16c-5 0-8 4.5-8 10 0 8 4 12 5.5 19 .8 3.8 1.5 6 3.5 6s2.6-2.5 3-6c.5-4 1.6-7 6-7s5.5 3 6 7c.4 3.5 1 6 3 6s2.7-2.2 3.5-6C46 38 50 34 50 26c0-5.5-3-10-8-10-4 0-5.5 2-10 2s-6-2-10-2z" fill="#fff" />
            </svg>
          </div>
          <b style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>Dentora</b>
        </div>
        <button className="btn ghost sm" onClick={() => sb.auth.signOut()}>Sign out</button>
      </div>
      <Routes>
        <Route path="/" element={<PortalHome />} />
        <Route path="/book" element={<BookFlow />} />
        <Route path="/medical" element={<MedicalHistory />} />
        <Route path="/call/:id" element={<VideoCall />} />
        <Route path="*" element={<PortalHome />} />
      </Routes>
    </div>
  )
}

function PortalHome() {
  const [profile, setProfile] = useState(null)
  const [appts, setAppts] = useState([])
  const toast = useToast()

  const load = () => {
    sb.from('dental_portal_profiles').select('*').limit(1).then(({ data }) => setProfile(data?.[0] || null))
    sb.from('dental_appointments')
      .select('*, practitioner:dental_practitioners(name), clinic:dental_clinics(name, address, phone)')
      .neq('status', 'cancelled')
      .order('starts_at', { ascending: false })
      .then(({ data }) => setAppts(data || []))
  }
  useEffect(() => { load() }, [])

  const now = Date.now()
  const upcoming = appts.filter((a) => new Date(a.ends_at).getTime() >= now && a.status !== 'completed').reverse()
  const past = appts.filter((a) => new Date(a.ends_at).getTime() < now || a.status === 'completed').slice(0, 5)

  const cancel = async (a) => {
    const { data, error } = await sb.functions.invoke('portal', { body: { action: 'cancel', appointment_id: a.id } })
    if (error || data?.error) return toast(data?.error || 'Could not cancel — call the practice.')
    toast('Appointment cancelled')
    load()
  }

  const firstName = profile?.full_name?.split(' ')[0]

  return (
    <div className="portal-main">
      <div>
        <div className="page-title">Hi{firstName ? ` ${firstName}` : ''} 👋</div>
        <div className="page-sub">Book a visit or jump into a video consultation.</div>
      </div>
      <Link to="/book" className="btn" style={{ justifyContent: 'center', padding: '14px 16px', fontSize: 15 }}>
        + Book an appointment
      </Link>

      {appts.length > 0 && (
        <Link to="/medical" className="appt-card" style={{ textDecoration: 'none' }}>
          <div className="appt-date" style={{ background: 'var(--violet-soft)', color: 'var(--violet)' }}><b>📋</b></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>Medical history</div>
            <div className="small muted">Fill it in from home before your visit — skip the waiting-room form.</div>
          </div>
          <span className="btn sm secondary">Fill in →</span>
        </Link>
      )}

      <div>
        <div className="card-title" style={{ marginBottom: 10 }}>Upcoming</div>
        <div className="grid" style={{ gap: 10 }}>
          {upcoming.map((a) => <ApptCard key={a.id} a={a} onCancel={cancel} />)}
          {upcoming.length === 0 && <div className="card card-pad empty">Nothing booked yet — tap the button above 👆</div>}
        </div>
      </div>

      {past.length > 0 && (
        <div>
          <div className="card-title" style={{ marginBottom: 10 }}>Previous visits</div>
          <div className="grid" style={{ gap: 8 }}>
            {past.map((a) => (
              <div key={a.id} className="appt-card" style={{ opacity: 0.7 }}>
                <div className="appt-date"><b>{new Date(a.starts_at).getDate()}</b><span>{new Date(a.starts_at).toLocaleDateString('en-IE', { month: 'short' })}</span></div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{cleanReason(a.reason)}</div>
                  <div className="small muted">{a.practitioner?.name} · {a.clinic?.name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const cleanReason = (r) => (r || '').replace(/^\[(Video|Online)\]\s*/, '')
const isVideo = (r) => /^\[Video\]/.test(r || '')

function ApptCard({ a, onCancel }) {
  const d = new Date(a.starts_at)
  const video = isVideo(a.reason)
  const soon = d.getTime() - Date.now() < 15 * 60000 // join opens 15 min before
  return (
    <div className="appt-card">
      <div className="appt-date">
        <b>{d.getDate()}</b>
        <span>{d.toLocaleDateString('en-IE', { month: 'short' })}</span>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700 }}>{video ? '📹 ' : ''}{cleanReason(a.reason)}</div>
        <div className="small muted">
          {d.toLocaleDateString('en-IE', { weekday: 'long' })} at {fmtTime(a.starts_at)} · {a.practitioner?.name}
        </div>
        <div className="small muted">{video ? 'Video consultation' : a.clinic?.name}{!video && a.clinic?.address ? ` · ${a.clinic.address}` : ''}</div>
      </div>
      <div className="grid" style={{ gap: 6 }}>
        {video && (
          <Link to={`/call/${a.id}`} className="btn sm" style={{ justifyContent: 'center', opacity: soon ? 1 : 0.85 }}>
            {soon ? 'Join call' : 'Video room'}
          </Link>
        )}
        <button className="btn ghost sm" onClick={() => onCancel(a)}>Cancel</button>
      </div>
    </div>
  )
}

function BookFlow() {
  const [clinics, setClinics] = useState([])
  const [pracs, setPracs] = useState([])
  const [f, setF] = useState({ clinic: null, prac: null, kind: 'visit', reason: '', otherReason: '', date: null, time: null })
  const [slots, setSlots] = useState(null) // null = loading/not asked
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const nav = useNavigate()

  useEffect(() => {
    sb.from('dental_clinics').select('id,name,address').order('name').then(({ data }) => setClinics(data || []))
  }, [])
  useEffect(() => {
    if (!f.clinic) return
    sb.from('dental_practitioners').select('id,name,role,color').eq('clinic_id', f.clinic.id).eq('active', true).order('name')
      .then(({ data }) => setPracs(data || []))
  }, [f.clinic])

  const days = useMemo(() => {
    const out = []
    for (let i = 0; i < 14; i++) {
      const d = new Date(); d.setDate(d.getDate() + i)
      const wd = (d.getDay() + 6) % 7
      if (wd > 4) continue // closed weekends
      out.push(d)
    }
    return out
  }, [])
  const dkey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  useEffect(() => {
    if (!f.prac || !f.date) return
    setSlots(null)
    sb.functions.invoke('portal', { body: { action: 'slots', practitioner_id: f.prac.id, date: f.date } })
      .then(({ data }) => setSlots(data?.slots || []))
  }, [f.prac, f.date])

  const reasonText = f.reason === 'Something else' ? f.otherReason : f.reason
  const ready = f.clinic && f.prac && reasonText.trim() && f.date && f.time

  const book = async () => {
    setBusy(true)
    const { data, error } = await sb.functions.invoke('portal', {
      body: { action: 'book', clinic_id: f.clinic.id, practitioner_id: f.prac.id, date: f.date, time: f.time, kind: f.kind, reason: reasonText },
    })
    if (error || data?.error) {
      let msg = data?.error || 'Booking failed — please try another slot.'
      if (error?.context) { try { msg = (await error.context.json())?.error || msg } catch { /* keep */ } }
      toast(msg); setBusy(false)
      setF((x) => ({ ...x, time: null })); setSlots(null)
      if (f.prac && f.date) sb.functions.invoke('portal', { body: { action: 'slots', practitioner_id: f.prac.id, date: f.date } }).then(({ data: d2 }) => setSlots(d2?.slots || []))
      return
    }
    toast(f.kind === 'video' ? 'Video consultation booked 📹' : 'Appointment booked 🎉')
    nav('/')
  }

  const Step = ({ n, title, done, children }) => (
    <div className="card card-pad">
      <div className="card-title" style={{ marginBottom: 10 }}>
        <span><span className={`badge ${done ? 'b-green' : 'b-teal'}`} style={{ marginRight: 8 }}>{done ? '✓' : n}</span>{title}</span>
      </div>
      {children}
    </div>
  )

  return (
    <div className="portal-main">
      <div className="spread">
        <div className="page-title" style={{ fontSize: 20 }}>Book an appointment</div>
        <Link to="/" className="btn secondary sm">← Back</Link>
      </div>

      <Step n="1" title="Choose your clinic" done={!!f.clinic}>
        <div className="pick-grid">
          {clinics.map((c) => (
            <button key={c.id} className={`pick ${f.clinic?.id === c.id ? 'on' : ''}`}
              onClick={() => setF((x) => ({ ...x, clinic: c, prac: null, time: null }))}>
              <b>{c.name}</b>
              <span>{c.address || ''}</span>
            </button>
          ))}
        </div>
      </Step>

      {f.clinic && (
        <Step n="2" title="Choose your dentist" done={!!f.prac}>
          <div className="pick-grid">
            {pracs.map((p) => (
              <button key={p.id} className={`pick ${f.prac?.id === p.id ? 'on' : ''}`}
                onClick={() => setF((x) => ({ ...x, prac: p, time: null }))}>
                <b><span style={{ color: p.color }}>●</span> {p.name}</b>
                <span>{p.role}</span>
              </button>
            ))}
            {pracs.length === 0 && <div className="small muted">No clinicians listed yet for this clinic.</div>}
          </div>
        </Step>
      )}

      {f.prac && (
        <Step n="3" title="What do you need?" done={!!reasonText.trim()}>
          <div className="row" style={{ marginBottom: 12 }}>
            <button className={`pick ${f.kind === 'visit' ? 'on' : ''}`} style={{ flex: 1 }} onClick={() => setF((x) => ({ ...x, kind: 'visit' }))}>
              <b>🏥 In the practice</b><span>Come in to the clinic</span>
            </button>
            <button className={`pick ${f.kind === 'video' ? 'on' : ''}`} style={{ flex: 1 }} onClick={() => setF((x) => ({ ...x, kind: 'video' }))}>
              <b>📹 Video consultation</b><span>Talk to your dentist online</span>
            </button>
          </div>
          <div className="pick-grid">
            {REASONS.map(([r, emoji]) => (
              <button key={r} className={`pick ${f.reason === r ? 'on' : ''}`} onClick={() => setF((x) => ({ ...x, reason: r }))}>
                <b>{emoji} {r}</b>
              </button>
            ))}
          </div>
          {f.reason === 'Something else' && (
            <input className="input" style={{ marginTop: 10 }} placeholder="Tell us briefly what's going on…"
              value={f.otherReason} onChange={(e) => setF((x) => ({ ...x, otherReason: e.target.value }))} />
          )}
        </Step>
      )}

      {f.prac && reasonText.trim() && (
        <Step n="4" title="Pick a time" done={!!f.time}>
          <div className="day-strip" style={{ marginBottom: 12 }}>
            {days.map((d) => (
              <button key={dkey(d)} className={`day-chip ${f.date === dkey(d) ? 'on' : ''}`}
                onClick={() => setF((x) => ({ ...x, date: dkey(d), time: null }))}>
                <span>{d.toLocaleDateString('en-IE', { weekday: 'short' })}</span>
                <b>{d.getDate()}</b>
                <span>{d.toLocaleDateString('en-IE', { month: 'short' })}</span>
              </button>
            ))}
          </div>
          {f.date && slots === null && <div className="small muted">Checking availability…</div>}
          {f.date && slots !== null && slots.length === 0 && <div className="small muted">No free times that day — try another date.</div>}
          {f.date && slots !== null && slots.length > 0 && (
            <div className="slot-grid">
              {slots.map((s) => (
                <button key={s} className={`slot-chip ${f.time === s ? 'on' : ''}`} onClick={() => setF((x) => ({ ...x, time: s }))}>{s}</button>
              ))}
            </div>
          )}
        </Step>
      )}

      {ready && (
        <div className="card card-pad" style={{ borderLeft: '4px solid var(--teal)' }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {f.kind === 'video' ? '📹 Video consultation' : `🏥 ${f.clinic.name}`}
          </div>
          <div className="small muted" style={{ marginBottom: 12 }}>
            {cleanReasonLabel(reasonText)} with {f.prac.name} · {new Date(f.date + 'T00:00').toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long' })} at {f.time}
          </div>
          <button className="btn" style={{ width: '100%', justifyContent: 'center', padding: '13px' }} disabled={busy} onClick={book}>
            {busy ? 'Booking…' : 'Confirm booking'}
          </button>
        </div>
      )}
    </div>
  )
}

const cleanReasonLabel = (r) => r

const MH_CONDITIONS = [
  'Heart condition', 'High blood pressure', 'Diabetes', 'Asthma / breathing', 'Epilepsy',
  'Bleeding disorder / blood thinners', 'Hepatitis / HIV', 'Osteoporosis medication', 'Pregnancy',
]

function MedicalHistory() {
  const [f, setF] = useState({ conditions: [], other_condition: '', medications: '', allergies: '', smoker: '', gp: '', emergency_contact: '', consent: false, signature: '' })
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const toggle = (c) =>
    setF((x) => ({ ...x, conditions: x.conditions.includes(c) ? x.conditions.filter((v) => v !== c) : [...x.conditions, c] }))

  const submit = async () => {
    setBusy(true)
    const { data, error } = await sb.functions.invoke('portal', { body: { action: 'medical_history', data: f } })
    setBusy(false)
    if (error || data?.error) {
      let msg = data?.error || 'Could not save — try again.'
      if (error?.context) { try { msg = (await error.context.json())?.error || msg } catch { /* keep */ } }
      return toast(msg)
    }
    setDone(true)
  }

  if (done) {
    return (
      <div className="portal-main" style={{ textAlign: 'center', paddingTop: 70 }}>
        <div style={{ fontSize: 48 }}>✅</div>
        <div className="page-title" style={{ marginTop: 12 }}>Medical history saved</div>
        <div className="page-sub">Your dentist will see it before your appointment — no waiting-room forms for you.</div>
        <Link to="/" className="btn" style={{ marginTop: 24 }}>Back to home</Link>
      </div>
    )
  }

  const ok = f.consent && f.signature.trim()
  return (
    <div className="portal-main">
      <div className="spread">
        <div className="page-title" style={{ fontSize: 20 }}>Medical history</div>
        <Link to="/" className="btn secondary sm">← Back</Link>
      </div>
      <div className="card card-pad">
        <div className="card-title">Do any of these apply to you?</div>
        <div className="pick-grid">
          {MH_CONDITIONS.map((c) => (
            <button key={c} className={`pick ${f.conditions.includes(c) ? 'on' : ''}`} onClick={() => toggle(c)}>
              <b style={{ fontSize: 13.5 }}>{c}</b>
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
        <div><label className="field">Emergency contact (name & number)</label>
          <input className="input" value={f.emergency_contact} onChange={(e) => setF((x) => ({ ...x, emergency_contact: e.target.value }))} /></div>
      </div>
      <div className="card card-pad grid" style={{ gap: 12 }}>
        <label className="row" style={{ cursor: 'pointer', alignItems: 'flex-start', gap: 10 }}>
          <input type="checkbox" checked={f.consent} onChange={(e) => setF((x) => ({ ...x, consent: e.target.checked }))} style={{ marginTop: 3 }} />
          <span className="small">I confirm the above is accurate and consent to my dental clinic storing this information for my care.</span>
        </label>
        <div><label className="field">Type your full name to sign</label>
          <input className="input" value={f.signature} onChange={(e) => setF((x) => ({ ...x, signature: e.target.value }))} /></div>
        <button className="btn" style={{ padding: 14, justifyContent: 'center' }} disabled={!ok || busy} onClick={submit}>
          {busy ? 'Saving…' : 'Save my medical history'}
        </button>
      </div>
    </div>
  )
}
