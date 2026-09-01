import { useEffect, useState } from 'react'
import { sb, euro } from '../supabase.js'
import { Stat, STATUS_META } from '../ui.jsx'

export default function Reports() {
  const [payments, setPayments] = useState([])
  const [appts, setAppts] = useState([])
  const [invoices, setInvoices] = useState([])

  useEffect(() => {
    sb.from('dental_payments').select('*').then(({ data }) => setPayments(data || []))
    sb.from('dental_appointments').select('status,starts_at').then(({ data }) => setAppts(data || []))
    sb.from('dental_invoices').select('items,total,status').then(({ data }) => setInvoices(data || []))
  }, [])

  // Revenue by month (payments received)
  const byMonth = {}
  for (const p of payments) {
    const k = p.paid_on.slice(0, 7)
    byMonth[k] = (byMonth[k] || 0) + Number(p.amount)
  }
  const months = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).slice(-6)
  const maxRev = Math.max(...months.map(([, v]) => v), 1)

  // Appointment status mix
  const statusMix = {}
  for (const a of appts) statusMix[a.status] = (statusMix[a.status] || 0) + 1
  const totalAppts = appts.length || 1
  const ftaRate = Math.round(((statusMix.fta || 0) / totalAppts) * 100)

  // Top billed items
  const itemTotals = {}
  for (const inv of invoices) for (const it of inv.items || []) {
    itemTotals[it.description] = (itemTotals[it.description] || 0) + Number(it.amount)
  }
  const topItems = Object.entries(itemTotals).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const maxItem = Math.max(...topItems.map(([, v]) => v), 1)

  const totalRevenue = payments.reduce((s, p) => s + Number(p.amount), 0)

  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title">Reports</div>
          <div className="page-sub">Practice performance at a glance</div>
        </div>
      </div>
      <div className="content grid" style={{ gap: 18 }}>
        <div className="stats">
          <Stat label="Revenue collected" value={euro(totalRevenue)} detail="all time (demo data)" icon="💶" />
          <Stat label="Appointments" value={appts.length} detail="booked in system" color="var(--blue-soft)" icon="🗓️" />
          <Stat label="FTA rate" value={`${ftaRate}%`} detail="failed to attend" color="var(--red-soft)" icon="🚫" />
          <Stat label="Avg invoice" value={euro(invoices.length ? invoices.reduce((s, i) => s + Number(i.total), 0) / invoices.length : 0)} detail={`${invoices.length} invoices`} color="var(--violet-soft)" icon="🧾" />
        </div>

        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="card card-pad">
            <div className="card-title">Revenue by month</div>
            <div className="barchart">
              {months.map(([m, v]) => (
                <div className="bar" key={m}>
                  <div className="val">{euro(v)}</div>
                  <div className="fill" style={{ height: `${(v / maxRev) * 75}%` }} />
                  <div className="lbl">{new Date(m + '-01').toLocaleDateString('en-IE', { month: 'short' })}</div>
                </div>
              ))}
              {months.length === 0 && <div className="empty" style={{ width: '100%' }}>No payments yet.</div>}
            </div>
          </div>

          <div className="card card-pad">
            <div className="card-title">Appointment outcomes</div>
            <div className="grid" style={{ gap: 10 }}>
              {Object.entries(statusMix).map(([s, n]) => {
                const meta = STATUS_META[s] || { label: s, color: '#8A9AA1' }
                return (
                  <div key={s}>
                    <div className="spread small" style={{ marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>{meta.label}</span>
                      <span className="muted">{n} · {Math.round((n / totalAppts) * 100)}%</span>
                    </div>
                    <div style={{ height: 8, background: '#EEF3F2', borderRadius: 99 }}>
                      <div style={{ height: 8, width: `${(n / totalAppts) * 100}%`, background: meta.color, borderRadius: 99 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="card card-pad">
          <div className="card-title">Top billed treatments</div>
          <div className="grid" style={{ gap: 10 }}>
            {topItems.map(([name, v]) => (
              <div key={name}>
                <div className="spread small" style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{name}</span>
                  <span className="muted">{euro(v)}</span>
                </div>
                <div style={{ height: 8, background: '#EEF3F2', borderRadius: 99 }}>
                  <div style={{ height: 8, width: `${(v / maxItem) * 100}%`, background: 'linear-gradient(90deg, #12A3A1, #0E7C7B)', borderRadius: 99 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
