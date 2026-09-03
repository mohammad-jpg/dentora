import { useState } from 'react'
import { sb } from './supabase.js'
import { Modal } from './ui.jsx'

// Conversion landing page for practice owners: free trial or book a demo.

const FEATURES = [
  ['🗓️', 'A diary your team will love', 'Colour-coded columns per clinician, live now-line, one-click booking, sick-day rebooking that texts every affected patient.'],
  ['🦷', 'Real clinical charting', 'FDI odontogram with history, baby teeth (ABCDE), root surfaces, BPE with BSP flags and full 6-point perio charting.'],
  ['📱', 'Patients book themselves', 'Your own online booking portal with live availability — plus video consultations with a private room per appointment.'],
  ['🤖', 'Recalls that run themselves', 'Automatic texts a week before and the day before, with your booking link. Chairs stay full while reception sleeps.'],
  ['📝', 'Notes in seconds', 'Per-procedure templates and voice dictation. The nurse-to-desk handover sheet replaces paper and scanning.'],
  ['💶', 'Billing without friction', 'Fee schedule seeded with Irish pricing, per-case price adjustment, part-payments and outstanding-balance tracking.'],
  ['🩻', 'Plays nice with your X-rays', 'One-click open in Romexis or CS Imaging via the free bridge, plus a register for CBCTs and 3D scans.'],
  ['🔒', 'GDPR-first, EU-hosted', 'Per-clinic isolation enforced in the database, staff logins with roles, daily backups, your data exported any time.'],
]

const FAQS = [
  ['How long does setup actually take?', 'About a minute. The signup wizard creates your clinic, surgeries, rota and an editable Irish fee schedule automatically. Add your team from Settings and you can take your first online booking the same morning.'],
  ['Do I need new hardware?', 'No. Dentora runs in the browser on whatever you have — reception PC, surgery PC, iPad in the waiting room, your phone on the sofa. Nothing to install or maintain.'],
  ['What about my existing patient data?', 'Start fresh in minutes, or we import your patient list from a spreadsheet export with you during onboarding. Your data stays yours — export it any time, no lock-in.'],
  ['Is patient data safe?', 'Data is hosted in the EU with per-clinic isolation enforced at the database level — one practice can never see another’s records. Staff access is per-login with roles, and backups run daily.'],
  ['How is this so much cheaper than the big names?', 'Flat per-practice pricing with everything included. No per-surgery multipliers, no per-user fees, no add-on modules for the portal or video — the features the incumbents sell separately are just… in it.'],
]

export default function Marketing({ onTrial, onStaff, onPatient }) {
  const [demo, setDemo] = useState(false)

  return (
    <div className="mk">
      <header className="mk-head">
        <div className="row" style={{ gap: 9 }}>
          <div className="logo-mark" style={{ width: 34, height: 34, borderRadius: 10 }}>
            <svg width="18" height="18" viewBox="0 0 64 64">
              <path d="M22 16c-5 0-8 4.5-8 10 0 8 4 12 5.5 19 .8 3.8 1.5 6 3.5 6s2.6-2.5 3-6c.5-4 1.6-7 6-7s5.5 3 6 7c.4 3.5 1 6 3 6s2.7-2.2 3.5-6C46 38 50 34 50 26c0-5.5-3-10-8-10-4 0-5.5 2-10 2s-6-2-10-2z" fill="#fff" />
            </svg>
          </div>
          <b style={{ fontFamily: 'var(--font-display)', fontSize: 17, letterSpacing: '-0.02em' }}>Dentora</b>
        </div>
        <nav>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
          <a onClick={onPatient} style={{ cursor: 'pointer' }}>I'm a patient</a>
          <a onClick={onStaff} style={{ cursor: 'pointer' }}>Sign in</a>
          <button className="btn sm" onClick={onTrial} style={{ marginLeft: 6 }}>Start free trial</button>
        </nav>
      </header>

      <section className="mk-hero">
        <div>
          <span className="mk-eyebrow">🇮🇪 Built hands-on with working dentists</span>
          <h1>The dental practice, <em>beautifully run</em>.</h1>
          <p className="sub">
            Diary, charting, perio, notes, billing, automated recalls, online booking and video consultations —
            one modern system, one flat price, live in your practice today.
          </p>
          <div className="mk-ctas">
            <button className="btn" onClick={onTrial}>Start your free 30-day trial</button>
            <button className="btn secondary" onClick={() => setDemo(true)} style={{ padding: '13px 22px', fontSize: 15, borderRadius: 13 }}>
              📅 Book a demo
            </button>
          </div>
          <p className="mk-trust">No card required · set up in 60 seconds · cancel anytime · your data exported on exit</p>
        </div>
        <HeroMock />
      </section>

      <section className="mk-section" id="features" style={{ paddingTop: 10 }}>
        <h2>Everything the big systems do. Nothing they charge extra for.</h2>
        <p className="lead">Every feature below is included in every plan — no modules, no per-user fees, no surprises at renewal.</p>
        <div className="mk-feats">
          {FEATURES.map(([ic, t, d]) => (
            <div className="mk-feat" key={t}>
              <span className="ic">{ic}</span>
              <b>{t}</b>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mk-section" style={{ paddingTop: 0 }}>
        <h2>Live before your next patient sits down</h2>
        <p className="lead">No installs, no server in a cupboard, no training days.</p>
        <div className="mk-steps">
          <div className="mk-step"><div className="n">1</div><b>Create your clinic</b><p className="small muted" style={{ marginTop: 6, lineHeight: 1.6 }}>60-second wizard: your practice, your surgeries, your login. An Irish fee schedule and rota are set up for you.</p></div>
          <div className="mk-step"><div className="n">2</div><b>Add your team</b><p className="small muted" style={{ marginTop: 6, lineHeight: 1.6 }}>Dentists and hygienists get their own login, diary column and rota automatically. Reception too.</p></div>
          <div className="mk-step"><div className="n">3</div><b>Share your booking link</b><p className="small muted" style={{ marginTop: 6, lineHeight: 1.6 }}>Patients book (and video-call) themselves. Recalls text themselves. Your diary fills itself.</p></div>
        </div>
      </section>

      <section className="mk-section" id="pricing" style={{ paddingTop: 0 }}>
        <h2>Flat, honest pricing</h2>
        <p className="lead">Per practice — unlimited users, every feature included. 30 days free on every plan.</p>
        <div className="mk-price-grid">
          <div className="mk-price">
            <div className="who">Solo</div>
            <div className="amt">€149<small>/mo</small></div>
            <ul>
              <li>1 surgery, unlimited users</li>
              <li>Full clinical suite &amp; billing</li>
              <li>Online booking portal</li>
              <li>Email support</li>
            </ul>
            <button className="btn secondary" onClick={onTrial}>Start free trial</button>
          </div>
          <div className="mk-price hero">
            <span className="tag2">MOST POPULAR</span>
            <div className="who">Practice</div>
            <div className="amt">€249<small>/mo</small></div>
            <ul>
              <li>Up to 5 surgeries, unlimited users</li>
              <li>Everything in Solo</li>
              <li>Video consultations</li>
              <li>Automated recalls + SMS bundle</li>
              <li>Handover sheets &amp; referrals</li>
              <li>Same-day priority support</li>
            </ul>
            <button className="btn" onClick={onTrial}>Start free trial</button>
          </div>
          <div className="mk-price">
            <div className="who">Group</div>
            <div className="amt">€449<small>/mo</small></div>
            <ul>
              <li>Multi-site, unlimited surgeries</li>
              <li>Cross-clinic reporting</li>
              <li>Custom features negotiated in</li>
              <li>Phone support, named contact</li>
            </ul>
            <button className="btn secondary" onClick={() => setDemo(true)}>Talk to us</button>
          </div>
        </div>
      </section>

      <section className="mk-section" id="faq" style={{ paddingTop: 0 }}>
        <h2>Questions dentists actually ask</h2>
        <p className="lead" style={{ marginBottom: 26 }} />
        <div className="mk-faq">
          {FAQS.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mk-section">
        <div className="mk-cta-band">
          <h2>See your practice in Dentora this week.</h2>
          <p>Start the free trial yourself in a minute — or book a 20-minute demo and we'll set your clinic up with you, live on the call.</p>
          <div className="mk-ctas" style={{ justifyContent: 'center' }}>
            <button className="btn" onClick={onTrial}>Start free trial</button>
            <button className="btn secondary" onClick={() => setDemo(true)} style={{ padding: '13px 22px', fontSize: 15, borderRadius: 13 }}>📅 Book a demo</button>
          </div>
        </div>
      </section>

      <footer className="mk-foot">
        <span>© {new Date().getFullYear()} Dentora · Dublin, Ireland</span>
        <span className="row" style={{ gap: 18 }}>
          <a onClick={onPatient} style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--teal-dark)' }}>Patient booking</a>
          <a onClick={onStaff} style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--teal-dark)' }}>Practice sign in</a>
        </span>
      </footer>

      {demo && <DemoModal onClose={() => setDemo(false)} />}
    </div>
  )
}

function HeroMock() {
  const chips = [
    // [col(1-3), top(px), height, color, label]
    [1, 4, 30, '#2F6FD6', '09:00 · Exam'],
    [2, 4, 64, '#0E7C7B', '09:00 · Crown prep'],
    [3, 38, 30, '#E07A3F', '09:30 · Hygiene'],
    [1, 72, 30, '#7C5CBF', '10:00 · Video consult'],
    [3, 106, 64, '#2F6FD6', '10:30 · Fillings ×2'],
    [2, 106, 30, '#23926A', '10:30 · Check-up'],
    [1, 140, 30, '#0E7C7B', '11:00 · Whitening'],
  ]
  const rows = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30']
  return (
    <div className="mk-shot" aria-hidden="true">
      <div className="bar"><span className="dot" /><span className="dot" /><span className="dot" /></div>
      <div className="mk-mini">
        <div className="mh">
          <div />
          <div>🟢 Dr. Kelly</div>
          <div>🟣 Dr. O'Brien</div>
          <div>🟠 Emma (Hyg.)</div>
        </div>
        <div style={{ position: 'relative' }}>
          {rows.map((t) => (
            <div className="mrow" key={t}>
              <div className="mtime">{t}</div>
              <div className="mcell" /><div className="mcell" /><div className="mcell" />
            </div>
          ))}
          {chips.map(([col, top, h, color, label], i) => (
            <div className="mk-chip" key={'c' + i}
              style={{
                top, height: h, background: color,
                left: `calc(44px + (100% - 44px) * ${(col - 1) / 3} + 3px)`,
                width: `calc((100% - 44px) / 3 - 6px)`,
              }}>
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DemoModal({ onClose }) {
  const [f, setF] = useState({ name: '', practice: '', email: '', phone: '', preferred_time: 'This week — morning', note: '' })
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const ok = f.name.trim() && /.+@.+\..+/.test(f.email)

  const submit = async () => {
    setBusy(true); setErr('')
    const { error } = await sb.from('dental_demo_requests').insert(f)
    setBusy(false)
    if (error) return setErr('Something went wrong — email hello@dentora.ie instead.')
    setSent(true)
  }

  if (sent) {
    return (
      <Modal title="You're booked in 🎉" onClose={onClose}>
        <p className="small" style={{ color: 'var(--ink-60)', lineHeight: 1.6 }}>
          Thanks {f.name.split(' ')[0]} — we'll confirm your demo time by email within a few hours.
          Fancy a head start? The free trial takes 60 seconds and the demo works on your own clinic.
        </p>
        <div className="actions"><button className="btn" onClick={onClose}>Done</button></div>
      </Modal>
    )
  }

  return (
    <Modal title="Book a 20-minute demo" onClose={onClose}>
      <div className="grid" style={{ gap: 12 }}>
        <div className="form-grid">
          <div><label className="field">Your name</label><input className="input" value={f.name} onChange={set('name')} autoFocus /></div>
          <div><label className="field">Practice name</label><input className="input" value={f.practice} onChange={set('practice')} /></div>
        </div>
        <div className="form-grid">
          <div><label className="field">Email</label><input className="input" type="email" value={f.email} onChange={set('email')} /></div>
          <div><label className="field">Phone</label><input className="input" value={f.phone} onChange={set('phone')} /></div>
        </div>
        <div>
          <label className="field">When suits you?</label>
          <select className="input" value={f.preferred_time} onChange={set('preferred_time')}>
            {['This week — morning', 'This week — lunchtime', 'This week — evening', 'Next week — morning', 'Next week — lunchtime', 'Next week — evening'].map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div><label className="field">Anything specific you want to see? (optional)</label>
          <input className="input" value={f.note} onChange={set('note')} placeholder="e.g. online booking, moving from Aerona…" /></div>
      </div>
      {err && <div className="small" style={{ color: 'var(--red)', marginTop: 10 }}>{err}</div>}
      <div className="actions">
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn" disabled={!ok || busy} onClick={submit}>{busy ? 'Sending…' : 'Request demo'}</button>
      </div>
    </Modal>
  )
}
