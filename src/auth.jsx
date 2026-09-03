import { createContext, useContext, useEffect, useState } from 'react'
import { sb } from './supabase.js'

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
  if (!session) return <Login />
  return <AuthCtx.Provider value={session}>{children}</AuthCtx.Provider>
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
  const [mode, setMode] = useState('choose')
  if (mode === 'staff') return <SignIn onSignup={() => setMode('staff-signup')} onHome={() => setMode('choose')} />
  if (mode === 'staff-signup') return <SignupWizard onBack={() => setMode('staff')} />
  if (mode === 'patient') return <PatientAuth onHome={() => setMode('choose')} />
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

function PatientAuth({ onHome }) {
  const [tab, setTab] = useState('signin')
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
    const { data, error } = await sb.functions.invoke('portal', { body: { action: 'signup', ...f } })
    if (error || data?.error) {
      let msg = data?.error || 'Something went wrong — please try again.'
      if (error?.context) { try { msg = (await error.context.json())?.error || msg } catch { /* keep */ } }
      setErr(msg); setBusy(false); return
    }
    await signIn()
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
        <button className="btn ghost" style={{ width: '100%', marginTop: 6, justifyContent: 'center' }} onClick={onHome}>← Back</button>
      </div>
    </div>
  )
}

function SignIn({ onSignup, onHome }) {
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
        <button type="button" className="btn ghost" style={{ width: '100%', marginTop: 8, justifyContent: 'center' }} onClick={onSignup}>
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

  const finish = async () => {
    setBusy(true); setErr('')
    const { data, error } = await sb.functions.invoke('signup-clinic', { body: f })
    if (error || data?.error) {
      let msg = data?.error || 'Something went wrong — please try again.'
      if (error?.context) { try { msg = (await error.context.json())?.error || msg } catch { /* keep msg */ } }
      setErr(msg); setBusy(false); return
    }
    const { error: se } = await sb.auth.signInWithPassword({ email: f.email, password: f.password })
    if (se) { setErr('Clinic created — now sign in with your new details.'); setBusy(false); onBack() }
  }

  return (
    <div className="login-wrap">
      <div className="login-card" style={{ maxWidth: 440 }}>
        <Logo sub={`Set up your clinic · step ${step} of 3`} />
        <div className="row" style={{ gap: 4, marginBottom: 18 }}>
          {[1, 2, 3].map((s) => (
            <div key={s} style={{ flex: 1, height: 5, borderRadius: 99, background: s <= step ? 'var(--teal)' : 'var(--line)' }} />
          ))}
        </div>

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

        <div className="row" style={{ marginTop: 18 }}>
          <button className="btn secondary" style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => (step === 1 ? onBack() : setStep(step - 1))} disabled={busy}>
            {step === 1 ? 'Back to sign in' : 'Back'}
          </button>
          {step < 3 ? (
            <button className="btn" style={{ flex: 1, justifyContent: 'center' }} disabled={!canNext} onClick={() => setStep(step + 1)}>Next</button>
          ) : (
            <button className="btn" style={{ flex: 1, justifyContent: 'center' }} disabled={busy} onClick={finish}>
              {busy ? 'Setting up…' : 'Create my clinic'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
