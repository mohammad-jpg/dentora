import { createContext, useContext, useEffect, useState } from 'react'

// Brand mark: single-weight outline tooth
export function ToothMark({ size = 16, color = '#fff', strokeWidth = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8.4 3.5c-2.3 0-3.7 1.9-3.7 4.4 0 3.5 1.8 5.1 2.5 8.2.37 1.6.66 2.6 1.6 2.6s1.13-1.1 1.32-2.6c.28-1.8.76-3 2.88-3s2.6 1.2 2.88 3c.19 1.5.37 2.6 1.32 2.6s1.23-1 1.6-2.6c.7-3.1 2.5-4.7 2.5-8.2 0-2.5-1.4-4.4-3.7-4.4-1.8 0-2.5.85-4.6.85s-2.8-.85-4.6-.85Z"
        stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    </svg>
  )
}

export function Modal({ title, onClose, children, wide = false }) {
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  )
}

export const STATUS_META = {
  booked: { label: 'Booked', cls: 'b-blue', color: '#1D5FBF' },
  confirmed: { label: 'Confirmed', cls: 'b-teal', color: '#0E6B66' },
  arrived: { label: 'Arrived', cls: 'b-violet', color: '#6D5BAE' },
  completed: { label: 'Completed', cls: 'b-green', color: '#1C7C4F' },
  cancelled: { label: 'Cancelled', cls: 'b-gray', color: '#84949c' },
  fta: { label: 'FTA', cls: 'b-red', color: '#B42332' },
}

export function StatusBadge({ status }) {
  const m = STATUS_META[status] || { label: status, cls: 'b-gray' }
  return <span className={`badge ${m.cls}`}>{m.label}</span>
}

export function InvoiceBadge({ status }) {
  const map = {
    paid: ['Paid', 'b-green'],
    unpaid: ['Unpaid', 'b-red'],
    part_paid: ['Part paid', 'b-amber'],
    void: ['Void', 'b-gray'],
  }
  const [label, cls] = map[status] || [status, 'b-gray']
  return <span className={`badge ${cls}`}>{label}</span>
}

const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null)
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 2600)
    return () => clearTimeout(t)
  }, [msg])
  return (
    <ToastCtx.Provider value={setMsg}>
      {children}
      {msg && <div className="toast">{msg}</div>}
    </ToastCtx.Provider>
  )
}

export function Stat({ label, value, detail, color = 'var(--teal-soft)', icon }) {
  return (
    <div className="card stat">
      <div className="k">{label}</div>
      <div className="v">{value}</div>
      {detail && <div className="d">{detail}</div>}
      <div className="icon" style={{ background: color }}>{icon}</div>
    </div>
  )
}
