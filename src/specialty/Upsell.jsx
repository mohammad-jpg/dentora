import { Link } from 'react-router-dom'
import { PACKAGES } from './packages.js'

export default function Upsell({ pkg }) {
  const p = PACKAGES[pkg]
  return (
    <div className="card card-pad" style={{ maxWidth: 640 }}>
      <div className="card-title">{p.name} package</div>
      <p className="small" style={{ color: 'var(--ink-60)', lineHeight: 1.6 }}>{p.blurb}</p>
      <div className="row" style={{ marginTop: 14, gap: 14 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 650, letterSpacing: '-0.02em' }}>+€{p.price}<span className="small muted" style={{ fontWeight: 500 }}>/month</span></div>
          <div className="small muted">added to your plan · cancel any time</div>
        </div>
        <Link to="/settings" className="btn" style={{ marginLeft: 'auto' }}>Enable in Settings</Link>
      </div>
    </div>
  )
}
