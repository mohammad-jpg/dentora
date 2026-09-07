import { createContext, useContext, useEffect, useState } from 'react'
import { sb } from './supabase.js'

// Loads the signed-in user's clinic(s). All data queries are scoped to the clinic by
// row-level security; this context supplies clinic_id for inserts + display, the user's
// own role in that clinic, and a switcher for people who belong to more than one clinic.
const ClinicCtx = createContext(null)
export const useClinic = () => useContext(ClinicCtx)

const STORE = 'dentora.clinic'

export function ClinicProvider({ children }) {
  const [state, setState] = useState({ loading: true, clinic: null, role: null, memberships: [] })

  const load = async () => {
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return setState({ loading: false, clinic: null, role: null, memberships: [] })
    // dental_memberships is also visible for colleagues at a shared clinic (for the Team
    // card), so this must filter to the signed-in user's own rows explicitly.
    const { data: ms } = await sb.from('dental_memberships').select('clinic_id, role').eq('user_id', user.id).order('created_at')
    if (!ms?.length) return setState({ loading: false, clinic: null, role: null, memberships: [] })
    const { data: clinics } = await sb.from('dental_clinics').select('*').in('id', ms.map((m) => m.clinic_id))
    let chosen = null
    try { chosen = localStorage.getItem(STORE) } catch { /* storage unavailable */ }
    const m = ms.find((x) => x.clinic_id === chosen) || ms[0]
    const clinic = (clinics || []).find((c) => c.id === m.clinic_id) || null
    const memberships = ms.map((x) => ({ ...x, name: (clinics || []).find((c) => c.id === x.clinic_id)?.name || 'Clinic' }))
    setState({ loading: false, clinic, role: m.role, memberships })
  }
  useEffect(() => { load() }, [])

  const switchClinic = (id) => {
    try { localStorage.setItem(STORE, id) } catch { /* storage unavailable */ }
    window.location.reload()
  }

  if (state.loading) return <div className="login-wrap"><div className="muted">Loading your clinic…</div></div>
  if (!state.clinic) {
    return (
      <div className="login-wrap">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>No clinic linked to this account</p>
          <p className="small muted">Ask your clinic owner to add you from Settings → Team, or set up a new clinic from the sign-in screen.</p>
          <button className="btn" style={{ marginTop: 16 }} onClick={() => sb.auth.signOut()}>Back to sign in</button>
        </div>
      </div>
    )
  }
  const value = {
    clinic: state.clinic, clinicId: state.clinic.id, role: state.role,
    isAdmin: ['owner', 'admin'].includes(state.role),
    memberships: state.memberships, switchClinic, reload: load,
  }
  return <ClinicCtx.Provider value={value}>{children}</ClinicCtx.Provider>
}
