import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { sb, euro, fmtDate, fullName } from '../supabase.js'
import { Modal, InvoiceBadge, useToast } from '../ui.jsx'
import { useClinic } from '../clinic.jsx'

export default function Billing() {
  const { clinic, clinicId } = useClinic()
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
      <div className="content grid" style={{ gap: 16 }}>
        <DebtsCard invoices={invoices} payments={payments} clinic={clinic} clinicId={clinicId} onChanged={load} />
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

// Panara-style debt manager: ageing, templated reminders with history, bad-debt write-off.
function DebtsCard({ invoices, payments, clinic, clinicId, onChanged }) {
  const [tpl, setTpl] = useState('')
  const [history, setHistory] = useState({}) // patient_id -> count of account reminders
  const [confirmOff, setConfirmOff] = useState(null)
  const toast = useToast()

  useEffect(() => {
    sb.from('dental_message_templates').select('body').eq('clinic_id', clinicId).eq('key', 'debt_reminder').maybeSingle()
      .then(({ data }) => setTpl(data?.body || 'Hi {name}, a reminder from {clinic} that {amount} is outstanding on your account.'))
    sb.from('dental_comms_log').select('patient_id').like('body', '%outstanding on your account%')
      .then(({ data }) => {
        const h = {}
        for (const r of data || []) h[r.patient_id] = (h[r.patient_id] || 0) + 1
        setHistory(h)
      })
  }, [clinicId])

  const debtors = useMemo(() => {
    const byPatient = {}
    for (const inv of invoices) {
      if (inv.status === 'void' || !inv.patient) continue
      const id = inv.patient.id
      byPatient[id] ||= { patient: inv.patient, billed: 0, paid: 0, oldest: inv.issued_on }
      byPatient[id].billed += Number(inv.total)
      if (inv.status !== 'paid' && inv.issued_on < byPatient[id].oldest) byPatient[id].oldest = inv.issued_on
    }
    for (const p of payments) {
      if (byPatient[p.patient_id]) byPatient[p.patient_id].paid += Number(p.amount)
    }
    return Object.values(byPatient)
      .map((d) => ({ ...d, balance: d.billed - d.paid, days: Math.max(0, Math.floor((Date.now() - new Date(d.oldest).getTime()) / 86400000)) }))
      .filter((d) => d.balance > 0.009)
      .sort((a, b) => b.balance - a.balance)
  }, [invoices, payments])

  const remind = async (d) => {
    const body = tpl
      .replaceAll('{name}', d.patient.first_name)
      .replaceAll('{clinic}', clinic.name)
      .replaceAll('{amount}', euro(d.balance))
      .replaceAll('{phone}', clinic.phone || 'the practice')
    await sb.from('dental_comms_log').insert({ patient_id: d.patient.id, channel: 'sms', body: '[demo] ' + body })
    setHistory((h) => ({ ...h, [d.patient.id]: (h[d.patient.id] || 0) + 1 }))
    toast(`Account reminder sent to ${fullName(d.patient)}`)
  }

  const writeOff = async (d) => {
    await sb.from('dental_payments').insert({ patient_id: d.patient.id, amount: d.balance, method: 'write_off' })
    const open = invoices.filter((i) => i.patient?.id === d.patient.id && ['unpaid', 'part_paid'].includes(i.status))
    for (const inv of open) await sb.from('dental_invoices').update({ status: 'paid' }).eq('id', inv.id)
    toast(`${euro(d.balance)} written off for ${fullName(d.patient)}`)
    setConfirmOff(null)
    onChanged()
  }

  if (debtors.length === 0) return null

  return (
    <div className="card card-pad">
      <div className="card-title">Debt manager <span className="small muted" style={{ fontWeight: 400 }}>{debtors.length} patient(s) owing · reminders use your Account template (Settings)</span></div>
      <table className="tbl">
        <thead><tr><th>Patient</th><th>Balance</th><th>Oldest debt</th><th>Reminders sent</th><th /></tr></thead>
        <tbody>
          {debtors.map((d) => (
            <tr key={d.patient.id}>
              <td><Link to={`/patients/${d.patient.id}`} style={{ fontWeight: 600, color: 'var(--teal-dark)' }}>{fullName(d.patient)}</Link></td>
              <td className="mono" style={{ fontWeight: 700, color: 'var(--red)' }}>{euro(d.balance)}</td>
              <td>
                {d.days} days
                {d.days > 60 && <span className="badge b-red" style={{ marginLeft: 6 }}>chase</span>}
                {d.days > 30 && d.days <= 60 && <span className="badge b-amber" style={{ marginLeft: 6 }}>ageing</span>}
              </td>
              <td className="muted">{history[d.patient.id] || 0}</td>
              <td style={{ textAlign: 'right' }}>
                <span className="row" style={{ justifyContent: 'flex-end' }}>
                  <button className="btn sm secondary" onClick={() => remind(d)}>Send reminder</button>
                  <button className="btn sm ghost" style={{ color: 'var(--red)' }} onClick={() => setConfirmOff(d)}>Write off</button>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {confirmOff && (
        <Modal title={`Write off ${euro(confirmOff.balance)}?`} onClose={() => setConfirmOff(null)}>
          <p className="small" style={{ color: 'var(--ink-60)' }}>
            {fullName(confirmOff.patient)}'s balance will be cleared as a bad debt. This is recorded as a
            write-off payment so your revenue reports stay honest. It can't be undone from here.
          </p>
          <div className="actions">
            <button className="btn secondary" onClick={() => setConfirmOff(null)}>Cancel</button>
            <button className="btn danger" onClick={() => writeOff(confirmOff)}>Write off {euro(confirmOff.balance)}</button>
          </div>
        </Modal>
      )}
    </div>
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
