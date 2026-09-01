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

function Login() {
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
        <div className="logo" style={{ padding: 0, marginBottom: 20, justifyContent: 'center' }}>
          <div className="logo-mark">
            <svg width="22" height="22" viewBox="0 0 64 64">
              <path d="M22 16c-5 0-8 4.5-8 10 0 8 4 12 5.5 19 .8 3.8 1.5 6 3.5 6s2.6-2.5 3-6c.5-4 1.6-7 6-7s5.5 3 6 7c.4 3.5 1 6 3 6s2.7-2.2 3.5-6C46 38 50 34 50 26c0-5.5-3-10-8-10-4 0-5.5 2-10 2s-6-2-10-2z" fill="#fff" />
            </svg>
          </div>
          <div>
            <div className="logo-name" style={{ color: 'var(--ink)' }}>Dentora</div>
            <div className="logo-sub">Staff sign in</div>
          </div>
        </div>
        <label className="field">Email</label>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoFocus />
        <div style={{ height: 12 }} />
        <label className="field">Password</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        {err && <div className="small" style={{ color: 'var(--red)', marginTop: 10 }}>{err}</div>}
        <button className="btn" style={{ width: '100%', marginTop: 18, justifyContent: 'center' }} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <div className="small muted" style={{ marginTop: 14, textAlign: 'center' }}>
          Patient data is protected — staff accounts only.
        </div>
      </form>
    </div>
  )
}
