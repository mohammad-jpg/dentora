import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { sb, fmtDate, fmtTime, fullName } from '../supabase.js'

// Embedded video consultation room (Jitsi). Room name derives from the appointment id,
// which only the patient (via their booking) and clinic staff can see.
export default function VideoCall({ staff = false }) {
  const { id } = useParams()
  const [appt, setAppt] = useState(null)
  const [joined, setJoined] = useState(false)

  useEffect(() => {
    sb.from('dental_appointments')
      .select('*, patient:dental_patients(first_name,last_name), practitioner:dental_practitioners(name)')
      .eq('id', id).single().then(({ data }) => setAppt(data))
  }, [id])

  const room = `Dentora-${(id || '').replace(/-/g, '')}`
  const url = `https://meet.jit.si/${room}#config.prejoinConfig.enabled=true`
  const backTo = staff ? '/diary' : '/'

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
      {!joined ? (
        <div className="card card-pad" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 40 }}>📹</div>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 17, marginTop: 10 }}>Ready to join?</p>
          <p className="small muted" style={{ marginTop: 6 }}>Your camera and microphone will be requested. The room is private to this appointment.</p>
          <button className="btn" style={{ marginTop: 18 }} onClick={() => setJoined(true)}>Join the call</button>
        </div>
      ) : (
        <iframe className="video-frame" src={url} allow="camera; microphone; fullscreen; display-capture; autoplay" title="Video consultation" />
      )}
      <p className="small muted">Trouble with the embedded call? <a href={url} target="_blank" rel="noreferrer" style={{ color: 'var(--teal)', fontWeight: 600 }}>Open it in a new tab</a>.</p>
    </div>
  )
}
