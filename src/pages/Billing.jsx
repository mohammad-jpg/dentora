import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { sb, euro, fmtDate, fullName } from '../supabase.js'
import { Modal, InvoiceBadge, useToast } from '../ui.jsx'

export default function Billing() {
  const [invoices, setInvoices] = useState([])
  const [payments, setPayments] = useState([])
  const [patients, setPatients] = useState([])
  const [treatments, setTreatments] = useState([])
  const [creating, setCreating] = useState(false)
  const [paying, setPaying] = useState(null)
  const toast = useToast()

  const load = () => {
    sb.from('dental_invoices').select('*, patient:dental_patients(id,first_name,last_name)')
      .order('issued_on', { ascending: false }).then(({ data }) => setInvoices(data || []))
    sb.from('dental_payments').select('*').then(({ data }) => setPayments(data || []))
  }
  useEffect(() => {
    load()
    sb.from('dental_patients').select('id,first_name,last_name').order('last_name').then(({ data }) => setPatients(data || []))
    sb.from('dental_treatments').select('*').order('category').then(({ data }) => setTreatments(data || []))
  }, [])

  const paidFor = (inv) => payments.filter((p) => p.invoice_id === inv.id).reduce((s, p) => s + Number(p.amount), 0)
  const outstanding = invoices.filter((i) => i.status !== 'void').reduce((s, i) => s + Number(i.total) - paidFor(i), 0)

  const createInvoice = async (patient_id, items) => {
    const total = items.reduce((s, i) => s + Number(i.amount), 0)
    const number = 'INV-' + String(1045 + invoices.length)
    const { error } = await sb.from('dental_invoices').insert({ patient_id, number, items, total, status: 'unpaid' })
    if (error) return toast('Error: ' + error.message)
    toast(`Invoice ${number} raised — ${euro(total)}`)
    setCreating(false)
    load()
  }

  const recordPayment = async (inv, amount, method) => {
    const { error } = await sb.from('dental_payments').insert({ invoice_id: inv.id, patient_id: inv.patient.id, amount, method })
    if (error) return toast('Error: ' + error.message)
    const nowPaid = paidFor(inv) + Number(amount)
    await sb.from('dental_invoices').update({ status: nowPaid >= Number(inv.total) ? 'paid' : 'part_paid' }).eq('id', inv.id)
    toast(`Payment of ${euro(amount)} recorded`)
    setPaying(null)
    load()
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title">Billing</div>
          <div className="page-sub">{euro(outstanding)} outstanding across {invoices.filter((i) => i.status === 'unpaid' || i.status === 'part_paid').length} invoices</div>
        </div>
        <button className="btn" onClick={() => setCreating(true)}>+ New invoice</button>
      </div>
      <div className="content">
        <div className="card">
          <table className="tbl">
            <thead><tr><th>Invoice</th><th>Patient</th><th>Date</th><th>Items</th><th>Total</th><th>Paid</th><th>Status</th><th /></tr></thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td style={{ fontWeight: 600 }}>{inv.number}</td>
                  <td><Link to={`/patients/${inv.patient?.id}`} style={{ fontWeight: 600, color: 'var(--teal-dark)' }}>{fullName(inv.patient)}</Link></td>
                  <td>{fmtDate(inv.issued_on)}</td>
                  <td className="small muted" style={{ maxWidth: 260 }}>{(inv.items || []).map((i) => i.description).join(', ')}</td>
                  <td className="mono">{euro(inv.total)}</td>
                  <td className="mono muted">{euro(paidFor(inv))}</td>
                  <td><InvoiceBadge status={inv.status} /></td>
                  <td style={{ textAlign: 'right' }}>
                    {inv.status !== 'paid' && inv.status !== 'void' && (
                      <button className="btn sm secondary" onClick={() => setPaying(inv)}>Take payment</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {creating && <InvoiceModal patients={patients} treatments={treatments} onSave={createInvoice} onClose={() => setCreating(false)} />}
      {paying && <PayModal inv={paying} due={Number(paying.total) - paidFor(paying)} onSave={recordPayment} onClose={() => setPaying(null)} />}
    </>
  )
}

function InvoiceModal({ patients, treatments, onSave, onClose }) {
  const [patientId, setPatientId] = useState(patients[0]?.id || '')
  const [items, setItems] = useState([])
  const [sel, setSel] = useState('')
  const addItem = () => {
    const t = treatments.find((x) => x.id === sel)
    if (t) setItems((a) => [...a, { description: t.name, amount: Number(t.price) }])
  }
  const total = items.reduce((s, i) => s + i.amount, 0)
  return (
    <Modal title="New invoice" onClose={onClose}>
      <div className="grid" style={{ gap: 12 }}>
        <div>
          <label className="field">Patient</label>
          <select className="input" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.last_name}, {p.first_name}</option>)}
          </select>
        </div>
        <div className="row">
          <select className="input" value={sel} onChange={(e) => setSel(e.target.value)}>
            <option value="">Add from fee schedule…</option>
            {treatments.map((t) => <option key={t.id} value={t.id}>{t.name} — {euro(t.price)}</option>)}
          </select>
          <button className="btn secondary" onClick={addItem}>Add</button>
        </div>
        {items.map((it, i) => (
          <div key={i} className="spread small" style={{ padding: '6px 10px', background: 'var(--mint-bg)', borderRadius: 8 }}>
            <span>{it.description}</span>
            <span className="row">
              €<input type="number" className="input" style={{ width: 84, padding: '4px 8px' }} value={it.amount} min="0" step="5"
                onChange={(e) => setItems((a) => a.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) } : x)))} />
              <button className="btn ghost sm" onClick={() => setItems((a) => a.filter((_, j) => j !== i))}>✕</button>
            </span>
          </div>
        ))}
        {items.length > 0 && <p className="small muted" style={{ margin: 0 }}>Adjust prices per case — e.g. a one-surface filling vs full coverage.</p>}
        {items.length > 0 && <div className="spread" style={{ fontWeight: 700 }}><span>Total</span><span>{euro(total)}</span></div>}
      </div>
      <div className="actions">
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn" disabled={!patientId || items.length === 0} onClick={() => onSave(patientId, items)}>Raise invoice</button>
      </div>
    </Modal>
  )
}

function PayModal({ inv, due, onSave, onClose }) {
  const [amount, setAmount] = useState(due.toFixed(2))
  const [method, setMethod] = useState('card')
  return (
    <Modal title={`Take payment — ${inv.number}`} onClose={onClose}>
      <div className="form-grid">
        <div>
          <label className="field">Amount (due {euro(due)})</label>
          <input type="number" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} min="0" step="0.01" />
        </div>
        <div>
          <label className="field">Method</label>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="card">Card</option><option value="cash">Cash</option>
            <option value="transfer">Bank transfer</option><option value="insurance">Insurance</option>
          </select>
        </div>
      </div>
      <div className="actions">
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn" disabled={!(Number(amount) > 0)} onClick={() => onSave(inv, Number(amount), method)}>Record {euro(amount)}</button>
      </div>
    </Modal>
  )
}
