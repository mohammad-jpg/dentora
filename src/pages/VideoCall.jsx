import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { sb, fmtDate, fmtTime, fullName } from '../supabase.js'

// Embedded video consultation room (Jitsi). The room name is an unguessable per-appointment
// token that is only readable by the clinic's staff and the patient who booked (row-level
// security), and the join button is only enabled inside the appointment's window.
const OPEN_BEFORE_MIN = 15
const OPEN_AFTER_MIN = 120

export default function VideoCall({ staff = false }) {
  const { id } = useParams()
  const [appt, setAppt] = useState(undefined) // undefined = loading, null = not found / no access
  const [joined, setJoined] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    sb.from('dental_appointments')
      .select('id, starts_at, ends_at, status, video_token, patient:dental_patients(first_name,last_name), practitioner:dental_practitioners(name)')
      .eq('id', id).maybeSingle().then(({ data }) => setAppt(data || null))
  }, [id])
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 30000); return () => clearInterval(t) }, [])

  const backTo = staff ? '/diary' : '/'
  const now = Date.now()
  const opensAt = appt ? new Date(appt.starts_at).getTime() - OPEN_BEFORE_MIN * 60000 : 0
  const closesAt = appt ? new Date(appt.ends_at).getTime() + OPEN_AFTER_MIN * 60000 : 0
  const cancelled = appt?.status === 'cancelled'
  const inWindow = appt && !cancelled && now >= opensAt && now <= closesAt
  const room = appt?.video_token ? `Dentora-${appt.video_token}` : null
  const url = room ? `https://meet.jit.si/${room}#config.prejoinConfig.enabled=true` : null

  return (
    <div className={staff ? 'content' : 'portal-main'} style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: staff ? 1000 : 900, margin: '0 auto', padding: 18 }}>
      <div className="spread">
        <div>
          <div className="page-title" style={{ fontSize: 19 }}>Video consultation</div>
          {appt && (
            <div className="page-sub">
              {fmtDate(appt.starts_at)} at {fmtTime(appt.starts_at)} · {staff ? fullName(appt.patient) : appt.practitioner?.name}
            </div>
          )}
        </div>
        <Link to={backTo} className="btn secondary sm">← Back</Link>
      </div>

      {appt === undefined && <div className="card card-pad muted">Loading…</div>}
      {appt === null && (
        <div className="card card-pad" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <p style={{ fontWeight: 600 }}>This appointment isn't available</p>
          <p className="small muted">It may have been removed, or your account doesn't have access to it.</p>
        </div>
      )}
      {appt && !joined && (
        <div className="card card-pad" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <p style={{ fontWeight: 600, fontSize: 17, marginTop: 10 }}>{cancelled ? 'This appointment was cancelled' : inWindow ? 'Ready to join?' : now < opensAt ? 'Not open yet' : 'This consultation has ended'}</p>
          <p className="small muted" style={{ marginTop: 6 }}>
            {cancelled ? 'Please book a new appointment.'
              : inWindow ? 'Your camera and microphone will be requested. The room is private to this appointment.'
              : now < opensAt ? `The room opens ${OPEN_BEFORE_MIN} minutes before the appointment, at ${fmtTime(opensAt)} on ${fmtDate(opensAt)}.`
              : 'Rooms close two hours after the appointment time.'}
          </p>
          <button className="btn" style={{ marginTop: 18 }} disabled={!inWindow || !url} onClick={() => setJoined(true)}>Join the call</button>
        </div>
      )}
      {appt && joined && url && (
        <iframe className="video-frame" src={url} allow="camera; microphone; fullscreen; display-capture; autoplay" title="Video consultation" />
      )}
      {joined && url && <p className="small muted">Trouble with the embedded call? <a href={url} target="_blank" rel="noreferrer" style={{ color: 'var(--teal)', fontWeight: 600 }}>Open it in a new tab</a>.</p>}
    </div>
  )
}
