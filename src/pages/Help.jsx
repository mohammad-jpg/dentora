import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { sb } from '../supabase.js'
import { useToast } from '../ui.jsx'
import { useClinic } from '../clinic.jsx'
import { hasPackage } from '../specialty/packages.js'
import { PACKAGES } from '../specialty/packages.js'
import { SUPPORT_EMAIL, SUPPORT_HOURS, SUPPORT_PHONE, SUPPORT_PHONE_TEL } from '../support.js'

// In-app how-to guide. Each section: what it's for, the steps, and the small habits that make
// it work well. Ends with support contact details and a request form.

const GUIDE = [
  {
    id: 'start', title: 'Getting started', to: '/',
    what: 'The first ten minutes with a new practice: set up the team, the rooms, the rota and the fee schedule, then add patients.',
    steps: [
      'Settings → Practice details: check the name, address and phone. These appear on invoices, referral letters and patient texts.',
      'Settings → Team: add each person who needs a login. Clinicians get a diary column automatically; reception and nurses do not.',
      'Settings → Surgeries and Rota: name your rooms and set who works where on which days. The diary only shows a column for clinicians who are working that day.',
      'Settings → Fee schedule: prices are pre-filled with a standard Irish private schedule. Click any price to change it.',
      'Patients → Import CSV if you are moving from another system, or + New patient to add one at a time. Name and phone number is enough to start.',
    ],
    tips: [
      'Add clinicians who do not need a login (a visiting hygienist, a locum) from Settings → Clinicians → Add (no login). They still get a diary column.',
      'The first-login tour can be re-run from Settings if a new team member wants it.',
    ],
  },
  {
    id: 'diary', title: 'Diary', to: '/diary',
    what: 'One column per working clinician, driven by the rota. Everything front desk does during the day starts here.',
    steps: [
      'Click any empty slot in a clinician\'s column to book. Pick the patient, set the end time and reason, save.',
      'Click an appointment to change its status: Booked → Confirmed → Arrived → Completed, or Cancelled / FTA (failed to attend).',
      'To move an appointment, open it and change the start and end time. The system will refuse a time that overlaps another appointment for that clinician.',
      'Use the date picker or arrows to move between days; Today brings you back.',
      'If a clinician calls in sick, click absence in their column header. It cancels their day and texts every affected patient a rebooking link.',
    ],
    tips: [
      'Mark patients Arrived as they come in — the dashboard shows who is waiting, and completed visits feed the automatic recall cycle.',
      'Online and video bookings made by patients appear with an [Online] or [Video] prefix so you can spot them.',
      'The red line is the current time. Columns for clinicians who are off or on leave say so in the header.',
    ],
  },
  {
    id: 'patients', title: 'Patients and records', to: '/patients',
    what: 'Every patient has one record with tabs for the chart, notes, plans, billing, imaging and communications.',
    steps: [
      'Patients → search by name, phone or email. Filter by scheme (Private / PRSI / Medical card).',
      'Open a patient to see the overview: details, medical alerts, appointment history, and any patient-reported medical history waiting for review.',
      'Edit details from the top-right button. Set the recall cycle (3, 6, 12 months or off) here — it drives automatic recalls.',
      'Archive a patient who has left the practice: they disappear from lists and automations but nothing is deleted.',
    ],
    tips: [
      'Medical alerts show as a red badge at the top of the record and are only ever changed by a clinician. Patient-submitted histories wait in an amber panel until you review them.',
      'Use Bulk SMS on the Patients page to text a filtered list — for example all medical-card patients about a change in hours.',
    ],
  },
  {
    id: 'chart', title: 'Dental chart, BPE and perio', to: '/patients',
    what: 'FDI odontogram with surfaces, a primary-teeth view, BPE scoring and a full pocket chart. The chart is a legal record: entries are added, never edited or deleted.',
    steps: [
      'Patient → Dental chart. Click a tooth, choose the condition, surfaces (M O D B L, R for root) and status (existing, planned, completed), then Add.',
      'Made a mistake? Click Retire on the entry and give a reason. It stays on the record, struck through, and the chart history still shows it as it stood on earlier dates.',
      'Use the "As of" dropdown to see the chart exactly as it was on any date a change was made.',
      'BPE: score each sextant 0–4 or X, star for furcation. A 4 anywhere, or a 3 in two or more sextants, raises the "comprehensive perio exam indicated" flag.',
      'Perio chart: pocket depth, recession and plaque per site, buccal and lingual, with attachment loss calculated. Past exams are kept and a new exam starts from the last one.',
    ],
    tips: [
      'Switch to Baby teeth for a child; the chart uses the ABCDE notation.',
      'Planned entries on the chart are a good prompt for building the treatment plan.',
    ],
  },
  {
    id: 'notes', title: 'Clinical notes', to: '/patients',
    what: 'Dated, attributed notes per patient. Templates and dictation keep them quick; once saved they cannot be changed.',
    steps: [
      'Patient → Notes. Choose the author, optionally insert a template (Settings → Note templates to edit them), type or click Dictate and talk.',
      'Save. To correct a note, add a new one referencing it — the original stays as written.',
    ],
    tips: ['Dictation works in Chrome and Edge and needs microphone permission the first time.'],
  },
  {
    id: 'plans', title: 'Treatment plans', to: '/patients',
    what: 'Itemised plans with prices from your fee schedule, adjustable per case, that track what has been done.',
    steps: [
      'Patient → Treatment plans → New plan. Add items from the fee schedule, edit the price or tooth if needed, save as Proposed.',
      'When the patient agrees, set it to Accepted. Tick items off as they are completed; the plan closes itself when everything is done.',
    ],
    tips: ['Print or copy the plan for the patient before they leave — acceptance rates are far higher when they take something home.'],
  },
  {
    id: 'billing', title: 'Billing, payments and debt', to: '/billing',
    what: 'Invoices from the fee schedule, payments by any method, and a debt manager that ages balances and sends reminders.',
    steps: [
      'Billing → New invoice: pick the patient, add items, adjust prices, raise it.',
      'Take payment against an invoice: card, cash, transfer or insurance. The invoice becomes Paid or Part paid automatically.',
      'Debt manager (top of the Billing page) lists everyone with a balance, how old the oldest invoice is, and how many reminders they have had. Send reminder uses your Account template.',
      'Write off a bad debt from the same card. It is recorded against each open invoice and kept separate from real income in Reports.',
    ],
    tips: [
      'A patient\'s Billing tab shows the same invoices and payments for just that patient.',
      'PRSI and medical-card items are in the fee schedule at €0 or the scheme rate so the patient statement is honest.',
    ],
  },
  {
    id: 'recalls', title: 'Recalls and reminders', to: '/recalls',
    what: 'Automatic texts: one week and one day before a recall is due, and the day before every appointment. Completed visits schedule the next recall by themselves.',
    steps: [
      'Set each patient\'s recall cycle on their record (default 6 months). When a visit is marked Completed, the next recall is created for that many months ahead.',
      'Recalls page: see who is due, contacted or booked. Mark as booked when they book, or let online booking do it.',
      'Settings → Message templates to change the wording. Placeholders like {name}, {clinic}, {link} and {phone} are filled in per patient.',
      'Owners and admins can run the automation on demand with Run automation now; otherwise it runs every morning at 8am.',
    ],
    tips: [
      'Nobody gets more than two recall texts — the system remembers what it has sent.',
      'Until a Twilio number is connected, messages are logged in the patient\'s Comms tab as [demo] rather than transmitted, so you can see exactly what would go out.',
    ],
  },
  {
    id: 'lab', title: 'Lab work', to: '/lab',
    what: 'Every case sent to a lab, when it is due back, and whether it has been received and fitted.',
    steps: [
      'Lab work → New case: patient, lab, item, shade, sent date and due date.',
      'Mark Received when it arrives and Fitted at the appointment. Overdue cases are flagged for chasing.',
    ],
    tips: ['Book the fit appointment for a day or two after the due-back date so a late lab does not mean a wasted slot.'],
  },
  {
    id: 'referrals', title: 'Referrals', to: '/referrals',
    what: 'A register of specialists and a letter generator that fills in the patient, history and your practice details.',
    steps: [
      'Referrals → New referral: pick the patient and specialist, state the reason and urgency. The letter is generated for you to copy or print.',
      'Add your own specialists to the register; the shared list covers common Irish referral centres.',
    ],
    tips: ['The letter automatically includes medical alerts and the patient\'s scheme so the specialist has what they need.'],
  },
  {
    id: 'checkin', title: 'Tablet check-in', to: '/checkin',
    what: 'Patients fill in their medical history on a waiting-room tablet that is never signed in to Dentora.',
    steps: [
      'One-time: on the tablet, open the kiosk link shown on the Check-in page and leave it on that screen.',
      'When a patient arrives, find them on the Check-in page and click their name. A 6-digit code appears.',
      'Hand the tablet over; the patient enters the code, answers the questions, signs and hands it back. The code works once and expires after 30 minutes.',
      'Their answers appear on their record under "Patient-reported medical history awaiting review". A clinician either updates the alerts (editing the merged text first) or marks it reviewed with no change.',
    ],
    tips: ['The Check-in page also lists every submission still waiting for review across the practice.'],
  },
  {
    id: 'handover', title: 'Handover sheet', to: '/handover',
    what: 'The digital version of the paper routing slip: the nurse records what was done and what is needed next; front desk processes it at checkout.',
    steps: [
      'Handover → New sheet during or after the appointment: visit type, findings, treatment, products, next visit, notes.',
      'Front desk opens the pending sheet at checkout, books the next visit and raises the invoice, then marks it processed.',
    ],
    tips: ['Fill it in chairside on a phone or tablet — the app works on small screens.'],
  },
  {
    id: 'portal', title: 'Patient portal and video', to: '/',
    what: 'Patients book online from your real diary, cancel, join video consultations and submit their medical history.',
    steps: [
      'Patients go to the site and choose I\'m a patient. They register with an email code, pick your practice and clinician, and see live slots.',
      'A booking lands in your diary as [Online] or [Video]. Video bookings get a private room; click the video button on the appointment to join. The room opens 15 minutes before the start.',
      'A patient booking with you for the first time gets a patient record created automatically.',
    ],
    tips: [
      'Online slots follow the rota and the 09:00–17:00 window on the half hour. Block time by booking it in the diary.',
      'Put the booking link in your recall texts (it is there by default) and on your website.',
    ],
  },
  {
    id: 'ortho', title: 'Orthodontics add-on', to: '/ortho', pkg: 'ortho',
    what: 'Case records for fixed appliances, aligners, functional appliances and retention, with visit logs and instalment plans.',
    steps: [
      'Orthodontics → + Add patient (top right). Search an existing patient or create a new one, then fill in the case: appliance, status, start date, planned months, IOTN, overjet/overbite.',
      'Set a total fee, deposit, monthly instalment and number of instalments. The monthly schedule is generated for you from the start date.',
      'Log visit each adjustment: archwires, elastics or aligner tray number, note, and weeks until the next visit. The next-visit date updates in the table.',
      'Record instalments as they are paid from the Instalments due list — it posts to the patient\'s account.',
      'The same case is also on the patient\'s Ortho tab, with the full visit and payment history.',
    ],
    tips: [
      'The Adjustments due list is your daily worklist: anyone whose next visit is within a week, or who has never been seen since the case opened.',
      'Change a case to Retention at debond; it drops out of the active count but keeps its history.',
    ],
  },
  {
    id: 'endo', title: 'Endodontics add-on', to: '/endo', pkg: 'endo',
    what: 'Per-tooth root canal records with diagnosis, tests, working lengths per canal, obturation, reviews and a one-click report to the referring dentist.',
    steps: [
      'Endodontics → + Add patient (top right). Pick or create the patient, type the FDI tooth number — the canal list pre-fills (a 16 gets MB, MB2, DB, P).',
      'Record the pulpal and apical diagnosis, sensibility tests, and per canal the working length, reference point, master apical file and obturation. Note medicament, sealer, rubber dam, complications.',
      'Move the case along with Start, Complete and Sign off, or edit it directly. Set a review date and it appears in Reviews due.',
      'For referred patients, enter the referring dentist. When the case is complete, Report generates the letter from the record — copy or print it.',
    ],
    tips: ['Reviews due (next 14 days) and Reports to referrers are the two side lists to clear each week.'],
  },
  {
    id: 'team', title: 'Team, roles and settings', to: '/settings',
    what: 'Who can do what, plus everything the practice runs on: rooms, rota, fees, templates, add-ons and imaging.',
    steps: [
      'Roles: Owner and Admin can change practice settings, fees, rooms, rota, templates and the team. Dentist and Staff can do everything clinical and front-desk but not change the practice setup.',
      'Team card: add a member with a login, set a new password for them, make or remove admin, or remove them. Only an owner can change another owner.',
      'Add-ons card: switch Orthodontics or Endodontics on or off. The nav and patient tabs update immediately.',
      'Imaging: choose Romexis or CS Imaging and install the bridge on each Windows PC (see bridge folder) so "Open in…" launches the patient in your imaging software.',
    ],
    tips: ['If someone belongs to more than one practice, a switcher appears in the sidebar.'],
  },
  {
    id: 'reports', title: 'Reports', to: '/reports',
    what: 'Revenue collected by month, write-offs, appointment outcomes including FTA rate, and top billed treatments.',
    steps: ['Reports is read-only. Revenue counts money actually received; written-off debt is shown separately.'],
    tips: ['A rising FTA rate is the earliest sign the reminder texts are not going out — check the recall page.'],
  },
]

const TOPICS = ['Question about a feature', 'Something is not working', 'Billing or my plan', 'Add-ons', 'Data import or migration', 'Something else']

export default function Help() {
  const { clinic, clinicId } = useClinic()
  const loc = useLocation()
  const toast = useToast()
  const [f, setF] = useState({ name: '', email: '', phone: '', topic: TOPICS[0], message: '' })
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    sb.auth.getUser().then(({ data: { user } }) => setF((x) => ({ ...x, name: user?.user_metadata?.name || '', email: user?.email || '' })))
  }, [])
  useEffect(() => {
    const id = loc.hash?.replace('#', '')
    if (id) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [loc.hash])

  const sections = GUIDE.filter((s) => !s.pkg || hasPackage(clinic, s.pkg))
  const addons = Object.values(PACKAGES)

  const submit = async () => {
    if (!f.email.trim() || !f.message.trim()) return toast('Add your email and a message.')
    setBusy(true)
    const { error } = await sb.from('dental_support_requests').insert({
      clinic_id: clinicId, name: f.name.trim() || null, email: f.email.trim(), phone: f.phone.trim() || null,
      topic: f.topic, message: f.message.trim(), page: `${clinic.name} · ${window.location.hash}`,
    })
    setBusy(false)
    if (error) return toast('Error: ' + error.message)
    setSent(true)
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title">Help</div>
          <div className="page-sub">How to do everything in Dentora, and how to reach us</div>
        </div>
        <a href={`tel:${SUPPORT_PHONE_TEL}`} className="btn secondary">Call {SUPPORT_PHONE}</a>
      </div>
      <div className="content grid" style={{ gridTemplateColumns: 'minmax(180px, 220px) minmax(0, 1fr)', alignItems: 'start', gap: 24 }}>
        <div className="card card-pad" style={{ position: 'sticky', top: 16 }}>
          <div className="card-title">In this guide</div>
          <div className="grid" style={{ gap: 2 }}>
            {sections.map((s) => (
              <a key={s.id} href={`#/help#${s.id}`} className="small" style={{ padding: '5px 8px', borderRadius: 6, color: 'var(--ink-60)', fontWeight: 500 }}>{s.title}</a>
            ))}
            <a href="#/help#addons" className="small" style={{ padding: '5px 8px', borderRadius: 6, color: 'var(--ink-60)', fontWeight: 500 }}>Add-ons and pricing</a>
            <a href="#/help#support" className="small" style={{ padding: '5px 8px', borderRadius: 6, color: 'var(--accent-strong)', fontWeight: 600 }}>Contact support</a>
          </div>
        </div>

        <div className="grid" style={{ gap: 16 }}>
          {sections.map((s) => (
            <div key={s.id} id={s.id} className="card card-pad" style={{ scrollMarginTop: 16 }}>
              <div className="card-title">
                {s.title}
                <Link to={s.to} className="btn ghost sm">Open</Link>
              </div>
              <p className="small" style={{ color: 'var(--ink-60)', margin: '0 0 10px' }}>{s.what}</p>
              <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 5 }}>
                {s.steps.map((st, i) => <li key={i} className="small" style={{ lineHeight: 1.55 }}>{st}</li>)}
              </ol>
              {s.tips?.length > 0 && (
                <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--mint-bg)', borderRadius: 8 }}>
                  <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>Worth knowing</div>
                  <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 3 }}>
                    {s.tips.map((t, i) => <li key={i} className="small" style={{ lineHeight: 1.5, color: 'var(--ink-60)' }}>{t}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ))}

          <div id="addons" className="card card-pad" style={{ scrollMarginTop: 16 }}>
            <div className="card-title">Add-ons and pricing <Link to="/settings" className="btn ghost sm">Manage in Settings</Link></div>
            <p className="small" style={{ color: 'var(--ink-60)', margin: '0 0 10px' }}>
              Every plan includes the full practice system with unlimited users. Specialty modules are plug-in add-ons billed monthly on top of your plan and can be switched on or off any time by an owner or admin.
            </p>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
              {addons.map((p) => (
                <div key={p.key} className="spread" style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, alignItems: 'flex-start', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <div className="small muted" style={{ marginTop: 2 }}>{p.blurb}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 650, fontSize: 18, letterSpacing: '-0.02em' }}>+€{p.price}</div>
                    <div className="small muted">per month</div>
                    <span className={`badge ${hasPackage(clinic, p.key) ? 'b-green' : 'b-gray'}`} style={{ marginTop: 4 }}>{hasPackage(clinic, p.key) ? 'On' : 'Off'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div id="support" className="card card-pad" style={{ scrollMarginTop: 16 }}>
            <div className="card-title">Contact support</div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
              <div style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8 }}>
                <div className="small muted">Phone</div>
                <a href={`tel:${SUPPORT_PHONE_TEL}`} style={{ fontWeight: 650, fontSize: 18, color: 'var(--accent-strong)', letterSpacing: '0.01em' }}>{SUPPORT_PHONE}</a>
                <div className="small muted">{SUPPORT_HOURS}</div>
              </div>
              <div style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8 }}>
                <div className="small muted">Email</div>
                <a href={`mailto:${SUPPORT_EMAIL}`} style={{ fontWeight: 650, fontSize: 16, color: 'var(--accent-strong)' }}>{SUPPORT_EMAIL}</a>
                <div className="small muted">We reply the same working day</div>
              </div>
            </div>
            {sent ? (
              <div className="empty" style={{ padding: 20 }}>
                <b>Thanks — we have your message.</b>
                <div className="small muted" style={{ marginTop: 4 }}>We'll reply to {f.email}. Urgent? Call {SUPPORT_PHONE}.</div>
                <button className="btn secondary sm" style={{ marginTop: 12 }} onClick={() => { setSent(false); setF((x) => ({ ...x, message: '' })) }}>Send another</button>
              </div>
            ) : (
              <div className="grid" style={{ gap: 12 }}>
                <div className="form-grid">
                  <div><label className="field">Your name</label><input className="input" value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} /></div>
                  <div><label className="field">Email for our reply</label><input className="input" type="email" value={f.email} onChange={(e) => setF((x) => ({ ...x, email: e.target.value }))} /></div>
                  <div><label className="field">Phone (optional)</label><input className="input" value={f.phone} onChange={(e) => setF((x) => ({ ...x, phone: e.target.value }))} placeholder="If you'd like a call back" /></div>
                  <div><label className="field">Topic</label>
                    <select className="input" value={f.topic} onChange={(e) => setF((x) => ({ ...x, topic: e.target.value }))}>{TOPICS.map((t) => <option key={t}>{t}</option>)}</select></div>
                </div>
                <div><label className="field">What can we help with?</label>
                  <textarea className="input" rows={5} value={f.message} onChange={(e) => setF((x) => ({ ...x, message: e.target.value }))} placeholder="Tell us what you were doing, what you expected, and what happened. Screenshots can be emailed after." /></div>
                <div className="row" style={{ justifyContent: 'flex-end' }}>
                  <button className="btn" disabled={busy} onClick={submit}>{busy ? 'Sending…' : 'Send to support'}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
