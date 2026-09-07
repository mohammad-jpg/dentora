import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sb } from './supabase.js'
import { Modal } from './ui.jsx'
import { useClinic } from './clinic.jsx'

// First-login tour for a brand-new clinic. Shows until "Finish" stamps clinics.onboarded_at.
const STEPS = [
  {
    title: 'Welcome to Dentora',
    body: (clinic) => (
      <>
        <p><b>{clinic.name}</b> is live — surgeries, rota and a full Irish fee schedule are already set up for you.</p>
        <p style={{ marginTop: 10 }}>This 60-second tour shows you the four things worth doing first. You can leave it any time and everything still works.</p>
      </>
    ),
  },
  {
    title: '1 · Add your team',
    goto: '/settings',
    body: () => (
      <>
        <p>In <b>Settings → Team</b>, add your dentists, hygienists and reception. Clinicians automatically get their own login, diary column and Mon–Fri rota.</p>
        <p style={{ marginTop: 10 }}>Tick <b>"Can manage the team"</b> for your practice manager so they can run all of this without you.</p>
      </>
    ),
  },
  {
    title: '2 · Bring your patients over',
    goto: '/settings',
    body: () => (
      <>
        <p>Two ways — pick whichever is easier:</p>
        <p style={{ marginTop: 10 }}><b>Option A — do it yourself:</b> export patients from your old system as a spreadsheet (CSV), then use <b>Settings → Import patients</b>. Takes about 2 minutes.</p>
        <p style={{ marginTop: 10 }}><b>Option B — we do it for you, free:</b> send us whatever export your old system produces and we'll migrate it for you, usually the same day.</p>
      </>
    ),
  },
  {
    title: '3 · Check your prices',
    goto: '/settings',
    body: () => (
      <p>Your fee schedule is pre-filled with standard Irish pricing. In <b>Settings → Fee schedule</b>, click any price to change it — treatment plans and invoices use these automatically, and you can still adjust per case.</p>
    ),
  },
  {
    title: '4 · Share your booking link',
    body: () => (
      <>
        <p>Your patients can already book (and video-call) themselves at:</p>
        <p style={{ marginTop: 8, padding: '10px 12px', background: 'var(--teal-soft)', borderRadius: 10, fontWeight: 700, wordBreak: 'break-all' }}>
          https://mohammad-jpg.github.io/dentora/
        </p>
        <p style={{ marginTop: 10 }}>Put it in your SMS templates, your website and your Google profile. Automatic recall texts already include it. That's it — you're running.</p>
      </>
    ),
  },
]

export default function Onboarding() {
  const { clinic, reload } = useClinic()
  const [step, setStep] = useState(0)
  const [open, setOpen] = useState(true)
  const nav = useNavigate()

  if (!open || clinic.onboarded_at) return null
  const s = STEPS[step]
  const last = step === STEPS.length - 1

  const finish = async (jumpTo) => {
    await sb.from('dental_clinics').update({ onboarded_at: new Date().toISOString() }).eq('id', clinic.id)
    setOpen(false)
    reload()
    if (jumpTo) nav(jumpTo)
  }

  return (
    <Modal title={s.title} onClose={() => finish()}>
      <div className="small" style={{ color: 'var(--ink-60)', lineHeight: 1.65, fontSize: 13.5 }}>
        {s.body(clinic)}
      </div>
      <div className="row" style={{ gap: 4, margin: '18px 0 4px' }}>
        {STEPS.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 99, background: i <= step ? 'var(--teal)' : 'var(--line)' }} />
        ))}
      </div>
      <div className="actions">
        {s.goto && <button className="btn secondary" onClick={() => finish(s.goto)} style={{ marginRight: 'auto' }}>Take me there</button>}
        {step > 0 && <button className="btn secondary" onClick={() => setStep(step - 1)}>Back</button>}
        {!last
          ? <button className="btn" onClick={() => setStep(step + 1)}>Next</button>
          : <button className="btn" onClick={() => finish()}>Finish</button>}
      </div>
    </Modal>
  )
}
