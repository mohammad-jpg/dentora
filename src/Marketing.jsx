import { useState } from 'react'
import { PACKAGES } from './specialty/packages.js'
import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_TEL } from './support.js'
import { sb } from './supabase.js'
import { Modal, ToothMark } from './ui.jsx'

// Conversion landing page for practice owners: free trial or book a demo.

const FI = {
  cal: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>,
  chart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3v18M5 8l7-5 7 5M5 8v8m14-8v8M5 16l7 5 7-5"/></svg>,
  phone: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg>,
  bell: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>,
  doc: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 2.5h8l4 4V21.5H6z"/><path d="M14 2.5v4h4M9 12h6M9 16h6"/></svg>,
  euro: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17.5 5.5A7.5 7.5 0 1 0 17.5 18.5M4 10h9M4 14h9"/></svg>,
  xray: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M12 7v10M8.5 9.5h7M9.5 12h5M10.5 14.5h3"/></svg>,
  lock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>,
}

const FEATURES = [
  [FI.cal, 'A diary your team will actually like', 'Colour-coded columns per clinician, live time indicator, one-click booking, and sick-day rebooking that texts every affected patient.'],
  [FI.chart, 'Proper clinical charting', 'FDI odontogram with full history, primary dentition, root surfaces, BPE with BSP flags and 6-point periodontal charting.'],
  [FI.phone, 'Patients book themselves', 'Your own online booking page with live availability, plus video consultations with a private room per appointment.'],
  [FI.bell, 'Recalls that run themselves', 'Automatic texts a week before and the day before, with your booking link included. Editable templates, sensible limits.'],
  [FI.doc, 'Notes in seconds', 'Per-procedure note templates and voice dictation. Digital handover sheets replace the paper-and-scanner routine.'],
  [FI.euro, 'Billing without friction', 'A fee schedule seeded with Irish pricing, per-case adjustments, part-payments, ageing debts and write-offs.'],
  [FI.xray, 'Works with your imaging', 'One-click open in Romexis or CS Imaging via the free bridge, and a register for CBCTs and 3D scans.'],
  [FI.lock, 'GDPR-first, EU-hosted', 'Per-clinic isolation enforced at the database level, role-based staff logins, daily backups, full export any time.'],
]

const FAQS = [
  ['How long does setup actually take?', 'About a minute. The signup wizard creates your clinic, surgeries, rota and an editable Irish fee schedule automatically. Add your team from Settings and you can take your first online booking the same morning.'],
  ['Do I need new hardware?', 'No. Dentora runs in the browser on whatever you have — reception PC, surgery PC, iPad in the waiting room, your phone on the sofa. Nothing to install or maintain.'],
  ['What about my existing patient data?', 'We migrate it for you. For the first ten practices that is free and done personally by the founder: an export from your current system, patients and history brought across, your team, rooms and fees set up, and a hand-holding first fortnight. Your data stays yours — export it any time, no lock-in.'],
  ['Is patient data safe?', 'Data is hosted in the EU with per-clinic isolation enforced at the database level — one practice can never see another’s records. Staff access is per-login with roles, and backups run daily.'],
  ['How is this so much cheaper than the big names?', 'Flat per-practice pricing with everything included. No per-surgery multipliers, no per-user fees, no add-on modules for the portal or video — the features the incumbents sell separately are just… in it. The only extras are the optional Orthodontics and Endodontics plug-ins, which most general practices never need.'],
  ['Can I add the specialty modules later?', 'Yes. Orthodontics (+€' + PACKAGES.ortho.price + '/mo) and Endodontics (+€' + PACKAGES.endo.price + '/mo) are switched on or off by an owner or admin from Settings, take effect immediately, and are billed monthly alongside your plan.'],
]

export default function Marketing({ onTrial, onStaff, onPatient }) {
  const [demo, setDemo] = useState(false)

  return (
    <div className="mk">
      <header className="mk-head">
        <div className="row" style={{ gap: 9 }}>
          <div className="logo-mark" style={{ width: 30, height: 30 }}><ToothMark size={17} /></div>
          <b style={{ fontSize: 16, letterSpacing: '-0.02em', fontWeight: 700 }}>Dentora</b>
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
          <span className="mk-eyebrow">Built with working dentists in Ireland</span>
          <h1>The complete system for running a modern dental practice.</h1>
          <p className="sub">
            Diary, clinical charting, notes, billing, automated recalls, online booking and video
            consultations in one place — flat pricing per practice, live the same day you sign up.
          </p>
          <div className="mk-ctas">
            <button className="btn" onClick={onTrial}>Start your free 30-day trial</button>
            <button className="btn secondary" onClick={() => setDemo(true)} style={{ padding: '11px 18px', fontSize: 14.5 }}>
              Book a demo
            </button>
          </div>
          <p className="mk-trust">No card required · set up in minutes · cancel any time · your data exported on exit</p>
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
        <p className="lead">Per practice — unlimited users, every feature included. 30 days free on every plan. Specialty modules are optional plug-in add-ons, priced below.</p>
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

        <div className="mk-onboard">
          <div>
            <b>Migration and onboarding: free for the first 10 practices.</b>
            <p className="small muted" style={{ margin: '4px 0 0', lineHeight: 1.6 }}>
              Done personally by the founder, not a helpdesk. We take an export from your current system, bring your patients and history across, set up your team, rooms and fee schedule, and stay on hand for the first weeks. After the first ten, onboarding is €750.
            </p>
          </div>
          <button className="btn" onClick={() => setDemo(true)}>Claim a place</button>
        </div>

        <div className="mk-addons">
          <div className="mk-addons-head">
            <h3>Plug-in add-ons</h3>
            <p className="small muted">Specialist modules you switch on from Settings when you need them, billed monthly on top of any plan. Turn them off any time.</p>
          </div>
          <div className="mk-addons-grid">
            {Object.values(PACKAGES).map((p) => (
              <div key={p.key} className="mk-addon">
                <div className="spread" style={{ alignItems: 'baseline' }}>
                  <b>{p.name}</b>
                  <span className="mk-addon-price">+€{p.price}<small>/mo</small></span>
                </div>
                <p className="small muted" style={{ marginTop: 6, lineHeight: 1.6 }}>{p.blurb}</p>
              </div>
            ))}
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
            <button className="btn secondary" onClick={() => setDemo(true)} style={{ padding: '11px 18px', fontSize: 14.5 }}>Book a demo</button>
          </div>
        </div>
      </section>

      <footer className="mk-foot">
        <span>© {new Date().getFullYear()} Dentora · Dublin, Ireland · <a href={`tel:${SUPPORT_PHONE_TEL}`} style={{ color: 'inherit' }}>{SUPPORT_PHONE}</a> · <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: 'inherit' }}>{SUPPORT_EMAIL}</a></span>
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
    // [col(1-3), top(px), height, stripe, tint, label]
    [1, 4, 30, '#1D5FBF', '#EAF1FB', '09:00 · Exam'],
    [2, 4, 64, '#0E6B66', '#EAF3F2', '09:00 · Crown prep'],
    [3, 38, 30, '#92610A', '#FAF3E2', '09:30 · Hygiene'],
    [1, 72, 30, '#6D5BAE', '#F0EDF9', '10:00 · Video consult'],
    [3, 106, 64, '#1D5FBF', '#EAF1FB', '10:30 · Fillings ×2'],
    [2, 106, 30, '#1C7C4F', '#E8F4EE', '10:30 · Check-up'],
    [1, 140, 30, '#0E6B66', '#EAF3F2', '11:00 · Whitening'],
  ]
  const rows = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30']
  return (
    <div className="mk-shot" aria-hidden="true">
      <div className="bar"><span className="dot" /><span className="dot" /><span className="dot" /></div>
      <div className="mk-mini">
        <div className="mh">
          <div />
          <div>Dr. Kelly</div>
          <div>Dr. O'Brien</div>
          <div>E. Walsh (Hyg.)</div>
        </div>
        <div style={{ position: 'relative' }}>
          {rows.map((t) => (
            <div className="mrow" key={t}>
              <div className="mtime">{t}</div>
              <div className="mcell" /><div className="mcell" /><div className="mcell" />
            </div>
          ))}
          {chips.map(([col, top, h, stripe, tint, label], i) => (
            <div className="mk-chip" key={'c' + i}
              style={{
                top, height: h, '--stripe': stripe, '--tint': tint,
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
      <Modal title="Demo request received" onClose={onClose}>
        <p className="small" style={{ color: 'var(--ink-60)', lineHeight: 1.6 }}>
          Thanks {f.name.split(' ')[0]} — we'll confirm a time by email shortly. If you'd like a head
          start, the free trial takes about a minute and the demo can then run on your own clinic.
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
