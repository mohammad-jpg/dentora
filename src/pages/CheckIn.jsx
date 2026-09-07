import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { sb, fullName, currentUserName } from '../supabase.js'
import { useToast } from '../ui.jsx'
import { useClinic } from '../clinic.jsx'

// Reception side of tablet check-in. The waiting-room tablet is never signed in: it opens
// the public kiosk page and the patient types a 6-digit code created here. Answers arrive
// as a questionnaire awaiting clinician review on the patient's record — they do not
// overwrite the medical alerts a clinician has recorded.

const kioskUrl = () => `${window.location.origin}${window.location.pathname}#/kiosk`
const sixDigits = () => String(Math.floor(100000 + Math.random() * 900000))

export default function CheckIn() {
  const { clinic, clinicId } = useClinic()
  const [patients, setPatients] = useState([])
  const [q, setQ] = useState('')
  const [sessions, setSessions] = useState([])
  const [pending, setPending] = useState([])
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const load = () => {
    const since = new Date(); since.setHours(0, 0, 0, 0)
    sb.from('dental_checkin_sessions').select('*, patient:dental_patients(id,first_name,last_name)')
      .eq('clinic_id', clinicId).gte('created_at', since.toISOString()).order('created_at', { ascending: false })
      .then(({ data }) => setSessions(data || []))
    sb.from('dental_questionnaires').select('id, created_at, source, patient:dental_patients!inner(id,first_name,last_name,clinic_id)')
      .is('reviewed_at', null).eq('patient.clinic_id', clinicId).order('created_at', { ascending: false })
      .then(({ data }) => setPending(data || []))
  }
  useEffect(() => {
    sb.from('dental_patients').select('id,first_name,last_name,dob,phone').eq('clinic_id', clinicId).eq('archived', false).order('last_name')
      .then(({ data }) => setPatients(data || []))
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [clinicId])

  const createCode = async (p) => {
    setBusy(true)
    const by = await currentUserName()
    let ok = false
    for (let i = 0; i < 5 && !ok; i++) {
      const { error } = await sb.from('dental_checkin_sessions').insert({ clinic_id: clinicId, patient_id: p.id, token: sixDigits(), created_by: by })
      if (!error) ok = true
      else if (!/duplicate|unique/i.test(error.message)) { setBusy(false); return toast('Error: ' + error.message) }
    }
    setBusy(false)
    if (!ok) return toast('Could not create a code — try again.')
    toast(`Code ready for ${fullName(p)}`)
    setQ('')
    load()
  }

  const filtered = q.trim() ? patients.filter((p) => `${p.first_name} ${p.last_name} ${p.phone || ''}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : []
  const now = Date.now()
  const stateOf = (s) => s.used_at ? ['Completed', 'b-green'] : new Date(s.expires_at).getTime() < now ? ['Expired', 'b-gray'] : ['Waiting', 'b-amber']

  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title">Check-in</div>
          <div className="page-sub">Create a code for the patient, they enter it on the waiting-room tablet · answers go to the record for review</div>
        </div>
      </div>
      <div className="content grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 1fr)', alignItems: 'start' }}>
        <div className="grid" style={{ gap: 16 }}>
          <div className="card card-pad">
            <div className="card-title">New check-in code</div>
            <input className="input" placeholder="Find patient by name or phone…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
            <div className="grid" style={{ gap: 8, marginTop: 10 }}>
              {filtered.map((p) => (
                <button key={p.id} className="pick" disabled={busy} onClick={() => createCode(p)}>
                  <b>{p.first_name} {p.last_name}</b>
                  <span>{p.phone || ''}</span>
                </button>
              ))}
              {q.trim() && filtered.length === 0 && <div className="small muted">No patients match.</div>}
            </div>
          </div>

          <div className="card card-pad">
            <div className="card-title">Today's codes</div>
            <div className="grid" style={{ gap: 6 }}>
              {sessions.map((s) => {
                const [label, cls] = stateOf(s)
                return (
                  <div key={s.id} className="spread" style={{ padding: '8px 10px', background: 'var(--mint-bg)', borderRadius: 8 }}>
                    <span>
                      <b>{fullName(s.patient)}</b>
                      <div className="small muted">created {new Date(s.created_at).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })}{s.created_by ? ` by ${s.created_by}` : ''}</div>
                    </span>
                    <span className="row" style={{ gap: 10 }}>
                      {label === 'Waiting' && <span className="mono" style={{ fontSize: 22, fontWeight: 650, letterSpacing: '0.18em' }}>{s.token}</span>}
                      <span className={`badge ${cls}`}>{label}</span>
                    </span>
                  </div>
                )
              })}
              {sessions.length === 0 && <div className="small muted">No codes created today.</div>}
            </div>
          </div>
        </div>

        <div className="grid" style={{ gap: 16 }}>
          <div className="card card-pad">
            <div className="card-title">Tablet setup</div>
            <p className="small" style={{ color: 'var(--ink-60)', margin: 0 }}>
              On the waiting-room tablet, open this address and leave it there. It is not signed in to Dentora, so the tablet only ever sees the one patient whose code is entered.
            </p>
            <div className="row" style={{ marginTop: 10, gap: 8 }}>
              <code style={{ flex: 1, padding: '8px 10px', background: 'var(--code-bg, var(--line-soft))', borderRadius: 6, fontSize: 13, overflowX: 'auto' }}>{kioskUrl()}</code>
              <button className="btn secondary sm" onClick={() => { navigator.clipboard.writeText(kioskUrl()); toast('Link copied') }}>Copy</button>
            </div>
            <p className="small muted" style={{ marginTop: 8, marginBottom: 0 }}>Codes are single-use and expire after 30 minutes.</p>
          </div>

          <div className="card card-pad">
            <div className="card-title">Awaiting clinician review {pending.length > 0 && <span className="badge b-amber">{pending.length}</span>}</div>
            <div className="grid" style={{ gap: 6 }}>
              {pending.map((qn) => (
                <div key={qn.id} className="spread small" style={{ padding: '7px 10px', background: 'var(--mint-bg)', borderRadius: 7 }}>
                  <span>
                    <Link to={`/patients/${qn.patient.id}`} style={{ fontWeight: 600, color: 'var(--accent-strong)' }}>{fullName(qn.patient)}</Link>
                    <div className="muted">{qn.source === 'portal' ? 'via patient portal' : 'via tablet'} · {new Date(qn.created_at).toLocaleString('en-IE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                  </span>
                  <Link to={`/patients/${qn.patient.id}`} className="btn sm secondary">Review</Link>
                </div>
              ))}
              {pending.length === 0 && <div className="small muted">Nothing waiting. Submitted histories appear here until a clinician reviews them on the patient record.</div>}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
