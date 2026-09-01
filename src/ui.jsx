import { createContext, useContext, useEffect, useState } from 'react'

export function Modal({ title, onClose, children }) {
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  )
}

export const STATUS_META = {
  booked: { label: 'Booked', cls: 'b-blue', color: '#2F6FD6' },
  confirmed: { label: 'Confirmed', cls: 'b-teal', color: '#0E7C7B' },
  arrived: { label: 'Arrived', cls: 'b-violet', color: '#7C5CBF' },
  completed: { label: 'Completed', cls: 'b-green', color: '#2E9E6B' },
  cancelled: { label: 'Cancelled', cls: 'b-gray', color: '#8A9AA1' },
  fta: { label: 'FTA', cls: 'b-red', color: '#D64550' },
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
