import { createContext, useContext, useEffect, useState } from 'react'
import { sb } from './supabase.js'
import Marketing from './Marketing.jsx'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = loading

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <div className="login-wrap"><div className="muted">Loading…</div></div>
  // during signup/reset, verifying the email code creates a session mid-flow —
  // keep showing the flow until it finishes (it reloads the page when done)
  if (!session || window.__dentoraAuthHold) return <Login />
  return <AuthCtx.Provider value={session}>{children}</AuthCtx.Provider>
}

// --- shared email-code verification step (Supabase built-in mailer, works with no domain) ---
function CodeStep({ email, onVerified, onBack, intro }) {
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [resent, setResent] = useState(false)

  const verify = async () => {
    setBusy(true); setErr('')
    const { data, error } = await sb.auth.verifyOtp({ email, token: code.trim(), type: 'email' })
    setBusy(false)
    if (error || !data?.session) return setErr('That code isn’t right or has expired — check the email and try again.')
    onVerified()
  }
  const resend = async () => {
    setErr('')
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
    if (error) setErr(error.message)
    else setResent(true)
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      <p className="small" style={{ color: 'var(--ink-60)', lineHeight: 1.6 }}>
        {intro || <>We've emailed a 6-digit code to <b>{email}</b> to verify it's really you.</>}
      </p>
      <div>
        <label className="field">Enter the 6-digit code</label>
        <input className="input" inputMode="numeric" maxLength={8} value={code} autoFocus
          style={{ fontSize: 22, letterSpacing: '0.35em', textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 700 }}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && code.length >= 6 && verify()} />
      </div>
      {err && <div className="small" style={{ color: 'var(--red)' }}>{err}</div>}
      <button className="btn" style={{ justifyContent: 'center' }} disabled={code.length < 6 || busy} onClick={verify}>
        {busy ? 'Checking…' : 'Verify email'}
      </button>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="btn ghost sm" onClick={onBack}>← Back</button>
        <button className="btn ghost sm" onClick={resend} disabled={resent}>{resent ? 'Code re-sent ✓' : 'Resend code'}</button>
      </div>
      <p className="small muted">No email after a minute? Check spam — it comes from Supabase Auth (our secure login provider).</p>
    </div>
  )
}

// --- forgot password: email code → new password ---
function ResetFlow({ onBack, sub }) {
  const [stage, setStage] = useState('email') // email | code | password
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const send = async () => {
    setBusy(true); setErr('')
    window.__dentoraAuthHold = true
    const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } })
    setBusy(false)
    if (error) return setErr(/not found|Signups/i.test(error.message) ? 'No account with that email.' : error.message)
    setStage('code')
  }
  const save = async () => {
    setBusy(true); setErr('')
    const { error } = await sb.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) return setErr(error.message)
    window.__dentoraAuthHold = false
    window.location.reload()
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <Logo sub={sub || 'Reset your password'} />
        {stage === 'email' && (
          <div className="grid" style={{ gap: 12 }}>
            <div><label className="field">Your account email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus
                onKeyDown={(e) => e.key === 'Enter' && /.+@.+\..+/.test(email) && send()} /></div>
            {err && <div className="small" style={{ color: 'var(--red)' }}>{err}</div>}
            <button className="btn" style={{ justifyContent: 'center' }} disabled={!/.+@.+\..+/.test(email) || busy} onClick={send}>
              {busy ? 'Sending…' : 'Email me a code'}
            </button>
            <button className="btn ghost" style={{ justifyContent: 'center' }} onClick={() => { window.__dentoraAuthHold = false; onBack() }}>← Back to sign in</button>
          </div>
        )}
        {stage === 'code' && (
          <CodeStep email={email.trim()} onBack={() => setStage('email')} onVerified={() => setStage('password')}
            intro={<>We've emailed a 6-digit code to <b>{email.trim()}</b>. Enter it, then choose a new password.</>} />
        )}
        {stage === 'password' && (
          <div className="grid" style={{ gap: 12 }}>
            <div><label className="field">Choose a new password (8+ characters)</label>
              <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus /></div>
            {err && <div className="small" style={{ color: 'var(--red)' }}>{err}</div>}
            <button className="btn" style={{ justifyContent: 'center' }} disabled={pw.length < 8 || busy} onClick={save}>
              {busy ? 'Saving…' : 'Save & sign in'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Logo({ sub }) {
  return (
    <div className="logo" style={{ padding: 0, marginBottom: 20, justifyContent: 'center' }}>
      <div className="logo-mark">
        <svg width="22" height="22" viewBox="0 0 64 64">
          <path d="M22 16c-5 0-8 4.5-8 10 0 8 4 12 5.5 19 .8 3.8 1.5 6 3.5 6s2.6-2.5 3-6c.5-4 1.6-7 6-7s5.5 3 6 7c.4 3.5 1 6 3 6s2.7-2.2 3.5-6C46 38 50 34 50 26c0-5.5-3-10-8-10-4 0-5.5 2-10 2s-6-2-10-2z" fill="#fff" />
        </svg>
      </div>
      <div>
        <div className="logo-name" style={{ color: 'var(--ink)' }}>Dentora</div>
        <div className="logo-sub">{sub}</div>
      </div>
    </div>
  )
}

function Login() {
  const [mode, setMode] = useState('landing')
  if (mode === 'landing') {
    return <Marketing onTrial={() => setMode('staff-signup')} onStaff={() => setMode('staff')} onPatient={() => setMode('patient')} />
  }
  if (mode === 'staff') return <SignIn onSignup={() => setMode('staff-signup')} onHome={() => setMode('landing')} onReset={() => setMode('reset')} />
  if (mode === 'staff-signup') return <SignupWizard onBack={() => setMode('staff')} />
  if (mode === 'patient') return <PatientAuth onHome={() => setMode('landing')} onReset={() => setMode('reset')} />
  if (mode === 'reset') return <ResetFlow onBack={() => setMode('landing')} />
  return (
    <div className="landing">
      <Logo sub="Practice OS" />
      <h1>The dental practice, <em>beautifully run</em>.</h1>
      <p className="tag">Diary, charting, notes, billing, recalls, online booking and video consultations — one system your whole practice will actually enjoy using.</p>
      <div className="chips">
        <span>🗓️ Smart diary</span>
        <span>🦷 Perio & charting</span>
        <span>📱 Online booking</span>
        <span>📹 Video consults</span>
        <span>🤖 Automated recalls</span>
        <span>🔒 GDPR-first</span>
      </div>
      <div className="doors">
        <button className="door" onClick={() => setMode('patient')}>
          <span className="emoji">😁</span>
          <b>I'm a patient</b>
          <p>Book an appointment or video consultation with your dentist in under a minute.</p>
        </button>
        <button className="door" onClick={() => setMode('staff')}>
          <span className="emoji">🦷</span>
          <b>Practice staff</b>
          <p>Sign in to your diary, patients and billing — or set up a brand-new clinic in 60 seconds.</p>
        </button>
      </div>
      <p className="foot">No installs · works on any device · your data stays yours</p>
    </div>
  )
}

function PatientAuth({ onHome, onReset }) {
  const [tab, setTab] = useState('signin')
  const [stage, setStage] = useState('form') // form | verify
  const [f, setF] = useState({ full_name: '', phone: '', email: '', password: '' })
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const signIn = async () => {
    setBusy(true); setErr('')
    const { error } = await sb.auth.signInWithPassword({ email: f.email, password: f.password })
    if (error) { setErr(error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message); setBusy(false) }
  }
  const signUp = async () => {
    setBusy(true); setErr('')
    window.__dentoraAuthHold = true
    const { error } = await sb.auth.signInWithOtp({ email: f.email.trim(), options: { shouldCreateUser: true } })
    setBusy(false)
    if (error) return setErr(/rate/i.test(error.message) ? 'Too many codes requested — wait a few minutes and try again.' : error.message)
    setStage('verify')
  }
  const completeSignup = async () => {
    const { data, error } = await sb.functions.invoke('portal', { body: { action: 'signup', ...f } })
    if (error || data?.error) {
      let msg = data?.error || 'Something went wrong — please try again.'
      if (error?.context) { try { msg = (await error.context.json())?.error || msg } catch { /* keep */ } }
      setErr(msg); setStage('form'); return
    }
    window.__dentoraAuthHold = false
    window.location.reload()
  }

  if (stage === 'verify') {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <Logo sub="Verify your email" />
          <CodeStep email={f.email.trim()} onBack={() => setStage('form')} onVerified={completeSignup} />
          {err && <div className="small" style={{ color: 'var(--red)', marginTop: 10 }}>{err}</div>}
        </div>
      </div>
    )
  }

  const ok = tab === 'signin'
    ? /.+@.+\..+/.test(f.email) && f.password
    : f.full_name.trim() && /.+@.+\..+/.test(f.email) && f.password.length >= 8

  return (
    <div className="login-wrap">
      <div className="login-card">
        <Logo sub="Patient portal" />
        <div className="tabs" style={{ marginBottom: 16 }}>
          <button className={tab === 'signin' ? 'active' : ''} onClick={() => setTab('signin')}>Sign in</button>
          <button className={tab === 'signup' ? 'active' : ''} onClick={() => setTab('signup')}>Create account</button>
        </div>
        <div className="grid" style={{ gap: 12 }}>
          {tab === 'signup' && (
            <>
              <div><label className="field">Your name</label><input className="input" value={f.full_name} onChange={set('full_name')} autoFocus /></div>
              <div><label className="field">Mobile number</label><input className="input" value={f.phone} onChange={set('phone')} placeholder="08x xxx xxxx" /></div>
            </>
          )}
          <div><label className="field">Email</label><input className="input" type="email" value={f.email} onChange={set('email')} autoComplete="username" /></div>
          <div><label className="field">Password{tab === 'signup' ? ' (8+ characters)' : ''}</label>
            <input className="input" type="password" value={f.password} onChange={set('password')} autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
              onKeyDown={(e) => e.key === 'Enter' && ok && (tab === 'signin' ? signIn() : signUp())} /></div>
        </div>
        {err && <div className="small" style={{ color: 'var(--red)', marginTop: 10 }}>{err}</div>}
        <button className="btn" style={{ width: '100%', marginTop: 16, justifyContent: 'center' }} disabled={!ok || busy}
          onClick={tab === 'signin' ? signIn : signUp}>
          {busy ? 'One moment…' : tab === 'signin' ? 'Sign in' : 'Create account'}
        </button>
        {tab === 'signin' && (
          <button className="btn ghost sm" style={{ width: '100%', marginTop: 6, justifyContent: 'center' }} onClick={onReset}>Forgot password?</button>
        )}
        <button className="btn ghost" style={{ width: '100%', marginTop: 2, justifyContent: 'center' }} onClick={onHome}>← Back</button>
      </div>
    </div>
  )
}

function SignIn({ onSignup, onHome, onReset }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setErr('')
    const { error } = await sb.auth.signInWithPassword({ email, password })
    if (error) setErr(error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message)
    setBusy(false)
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <Logo sub="Staff sign in" />
        <label className="field">Email</label>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoFocus />
        <div style={{ height: 12 }} />
        <label className="field">Password</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        {err && <div className="small" style={{ color: 'var(--red)', marginTop: 10 }}>{err}</div>}
        <button className="btn" style={{ width: '100%', marginTop: 18, justifyContent: 'center' }} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <button type="button" className="btn ghost sm" style={{ width: '100%', marginTop: 6, justifyContent: 'center' }} onClick={onReset}>
          Forgot password?
        </button>
        <button type="button" className="btn ghost" style={{ width: '100%', marginTop: 2, justifyContent: 'center' }} onClick={onSignup}>
          New here? Set up your clinic →
        </button>
        <button type="button" className="btn ghost" style={{ width: '100%', marginTop: 2, justifyContent: 'center', color: 'var(--ink-40)' }} onClick={onHome}>← Back</button>
        <div className="small muted" style={{ marginTop: 12, textAlign: 'center' }}>
          Patient data is protected — staff accounts only.
        </div>
      </form>
    </div>
  )
}

function SignupWizard({ onBack }) {
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [f, setF] = useState({
    clinic_name: '', address: '', phone: '',
    owner_name: '', email: '', password: '',
    surgeries: ['Surgery 1'],
  })
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  const canNext = step === 1 ? f.clinic_name.trim().length > 1
    : step === 2 ? f.owner_name.trim() && /.+@.+\..+/.test(f.email) && f.password.length >= 8
    : true

  const sendCode = async () => {
    setBusy(true); setErr('')
    window.__dentoraAuthHold = true
    const { error } = await sb.auth.signInWithOtp({ email: f.email.trim(), options: { shouldCreateUser: true } })
    setBusy(false)
    if (error) return setErr(/rate/i.test(error.message) ? 'Too many codes requested — wait a few minutes and try again.' : error.message)
    setStep('verify')
  }

  const finish = async () => {
    setBusy(true); setErr('')
    const { data, error } = await sb.functions.invoke('signup-clinic', { body: f })
    if (error || data?.error) {
      let msg = data?.error || 'Something went wrong — please try again.'
      if (error?.context) { try { msg = (await error.context.json())?.error || msg } catch { /* keep msg */ } }
      setErr(msg); setBusy(false); return
    }
    window.__dentoraAuthHold = false
    window.location.reload()
  }

  return (
    <div className="login-wrap">
      <div className="login-card" style={{ maxWidth: 440 }}>
        <Logo sub={`Set up your clinic · step ${step === 'verify' ? 3 : step === 3 ? 4 : step} of 4`} />
        <div className="row" style={{ gap: 4, marginBottom: 18 }}>
          {[1, 2, 3, 4].map((s) => {
            const cur = step === 'verify' ? 3 : step === 3 ? 4 : step
            return <div key={s} style={{ flex: 1, height: 5, borderRadius: 99, background: s <= cur ? 'var(--teal)' : 'var(--line)' }} />
          })}
        </div>

        {step === 'verify' && (
          <CodeStep email={f.email.trim()} onBack={() => setStep(2)} onVerified={() => setStep(3)} />
        )}

        {step === 1 && (
          <div className="grid" style={{ gap: 12 }}>
            <div><label className="field">Clinic name</label>
              <input className="input" value={f.clinic_name} onChange={set('clinic_name')} placeholder="e.g. Seapoint Dental" autoFocus /></div>
            <div><label className="field">Address <span className="muted">(optional)</span></label>
              <input className="input" value={f.address} onChange={set('address')} placeholder="Street, town" /></div>
            <div><label className="field">Clinic phone <span className="muted">(optional)</span></label>
              <input className="input" value={f.phone} onChange={set('phone')} /></div>
          </div>
        )}

        {step === 2 && (
          <div className="grid" style={{ gap: 12 }}>
            <div><label className="field">Your name</label>
              <input className="input" value={f.owner_name} onChange={set('owner_name')} placeholder="Dr. …" autoFocus /></div>
            <div><label className="field">Your email (this is your login)</label>
              <input className="input" type="email" value={f.email} onChange={set('email')} /></div>
            <div><label className="field">Choose a password (8+ characters)</label>
              <input className="input" type="password" value={f.password} onChange={set('password')} /></div>
            <p className="small muted">You'll be the clinic owner — you can add dentists, hygienists and reception staff later in Settings.</p>
          </div>
        )}

        {step === 3 && (
          <div className="grid" style={{ gap: 12 }}>
            <label className="field">Your surgeries (rooms)</label>
            {f.surgeries.map((s, i) => (
              <div className="row" key={i}>
                <input className="input" value={s}
                  onChange={(e) => setF((x) => ({ ...x, surgeries: x.surgeries.map((v, j) => (j === i ? e.target.value : v)) }))} />
                {f.surgeries.length > 1 && (
                  <button className="btn ghost sm" onClick={() => setF((x) => ({ ...x, surgeries: x.surgeries.filter((_, j) => j !== i) }))}>✕</button>
                )}
              </div>
            ))}
            <button className="btn secondary sm" style={{ justifyContent: 'center' }}
              onClick={() => setF((x) => ({ ...x, surgeries: [...x.surgeries, `Surgery ${x.surgeries.length + 1}`] }))}>
              + Add another surgery
            </button>
            <p className="small muted">We'll set you up with the standard Irish fee schedule (fully editable) and a Mon–Fri rota. You can change everything later.</p>
          </div>
        )}

        {err && <div className="small" style={{ color: 'var(--red)', marginTop: 12 }}>{err}</div>}

        {step !== 'verify' && (
        <div className="row" style={{ marginTop: 18 }}>
          <button className="btn secondary" style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => (step === 1 ? onBack() : setStep(step === 3 ? 2 : step - 1))} disabled={busy}>
            {step === 1 ? 'Back to sign in' : 'Back'}
          </button>
          {step === 1 && <button className="btn" style={{ flex: 1, justifyContent: 'center' }} disabled={!canNext} onClick={() => setStep(2)}>Next</button>}
          {step === 2 && (
            <button className="btn" style={{ flex: 1, justifyContent: 'center' }} disabled={!canNext || busy} onClick={sendCode}>
              {busy ? 'Sending code…' : 'Verify my email →'}
            </button>
          )}
          {step === 3 && (
            <button className="btn" style={{ flex: 1, justifyContent: 'center' }} disabled={busy} onClick={finish}>
              {busy ? 'Setting up…' : 'Create my clinic'}
            </button>
          )}
        </div>
        )}
      </div>
    </div>
  )
}
