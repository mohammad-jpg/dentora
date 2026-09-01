import { createContext, useContext, useEffect, useState } from 'react'
import { sb } from './supabase.js'

// Loads the signed-in user's clinic. All data queries are scoped to the clinic
// by row-level security; this context supplies clinic_id for inserts + display.
const ClinicCtx = createContext(null)
export const useClinic = () => useContext(ClinicCtx)

export function ClinicProvider({ children }) {
  const [state, setState] = useState({ loading: true, clinic: null, role: null })

  const load = async () => {
    const { data: ms } = await sb.from('dental_memberships').select('clinic_id, role').limit(1)
    const m = ms?.[0]
    if (!m) return setState({ loading: false, clinic: null, role: null })
    const { data: clinic } = await sb.from('dental_clinics').select('*').eq('id', m.clinic_id).single()
    setState({ loading: false, clinic, role: m.role })
  }
  useEffect(() => { load() }, [])

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
  return (
    <ClinicCtx.Provider value={{ clinic: state.clinic, clinicId: state.clinic.id, role: state.role, reload: load }}>
      {children}
    </ClinicCtx.Provider>
  )
}
