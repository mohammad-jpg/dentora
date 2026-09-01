import { useEffect, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { ToastProvider } from './ui.jsx'
import { AuthProvider } from './auth.jsx'
import { ClinicProvider, useClinic } from './clinic.jsx'
import { sb } from './supabase.js'
import Referrals from './pages/Referrals.jsx'
import Handover from './pages/Handover.jsx'
import Portal from './pages/Portal.jsx'
import VideoCall from './pages/VideoCall.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Diary from './pages/Diary.jsx'
import Patients from './pages/Patients.jsx'
import PatientDetail from './pages/PatientDetail.jsx'
import Billing from './pages/Billing.jsx'
import Recalls from './pages/Recalls.jsx'
import Tasks from './pages/Tasks.jsx'
import Reports from './pages/Reports.jsx'
import Settings from './pages/Settings.jsx'

const I = {
  home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>,
  cal: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>,
  people: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.6c2.5.3 4.3 1.9 5 4.4"/></svg>,
  euro: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.5 5.5A7.5 7.5 0 1 0 17.5 18.5M4 10h9M4 14h9"/></svg>,
  bell: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="m8 12.5 2.5 2.5L16 9.5"/></svg>,
  chart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20V10M10 20V4M16 20v-8M21 20H3"/></svg>,
  cog: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z"/></svg>,
  send: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 3 10.5 13.5M21 3l-7 18-3.5-7.5L3 10l18-7Z"/></svg>,
  clip: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4a3 3 0 0 1 6 0M9 11h6M9 15h6"/></svg>,
}

function Nav() {
  const links = [
    ['/', 'Dashboard', I.home],
    ['/diary', 'Diary', I.cal],
    ['/patients', 'Patients', I.people],
    ['/billing', 'Billing', I.euro],
    ['/recalls', 'Recalls', I.bell],
    ['/referrals', 'Referrals', I.send],
    ['/handover', 'Handover', I.clip],
    ['/tasks', 'Tasks', I.check],
    ['/reports', 'Reports', I.chart],
    ['/settings', 'Settings', I.cog],
  ]
  return (
    <nav className="nav">
      {links.map(([to, label, icon]) => (
        <NavLink key={to} to={to} end={to === '/'}>
          {icon}
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <SurfaceRouter />
      </AuthProvider>
    </ToastProvider>
  )
}

// Staff accounts (clinic membership) get the practice app; everyone else gets the patient portal.
function SurfaceRouter() {
  const [surface, setSurface] = useState(null)
  useEffect(() => {
    sb.from('dental_memberships').select('id').limit(1)
      .then(({ data }) => setSurface(data?.length ? 'staff' : 'portal'))
  }, [])
  if (!surface) return <div className="login-wrap"><div className="muted">Loading…</div></div>
  if (surface === 'portal') return <Portal />
  return (
    <ClinicProvider>
      <Shell />
    </ClinicProvider>
  )
}

function Shell() {
  const { clinic } = useClinic()
  return (
      <div className="shell">
        <aside className="sidebar">
          <div className="logo">
            <div className="logo-mark">
              <svg width="22" height="22" viewBox="0 0 64 64">
                <path d="M22 16c-5 0-8 4.5-8 10 0 8 4 12 5.5 19 .8 3.8 1.5 6 3.5 6s2.6-2.5 3-6c.5-4 1.6-7 6-7s5.5 3 6 7c.4 3.5 1 6 3 6s2.7-2.2 3.5-6C46 38 50 34 50 26c0-5.5-3-10-8-10-4 0-5.5 2-10 2s-6-2-10-2z" fill="#fff" />
              </svg>
            </div>
            <div>
              <div className="logo-name">Dentora</div>
              <div className="logo-sub">Practice OS</div>
            </div>
          </div>
          <Nav />
          <div className="sidebar-foot">
            <b>{clinic.name}</b>
            <br />
            <button
              onClick={() => sb.auth.signOut()}
              style={{ background: 'none', border: 'none', color: '#7E959C', padding: 0, marginTop: 4, fontSize: 11.5, textDecoration: 'underline' }}>
              Sign out
            </button>
          </div>
        </aside>
        <div className="main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/diary" element={<Diary />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/patients/:id" element={<PatientDetail />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/recalls" element={<Recalls />} />
            <Route path="/referrals" element={<Referrals />} />
            <Route path="/handover" element={<Handover />} />
            <Route path="/video/:id" element={<VideoCall staff />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </div>
  )
}
