import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { sb, euro, fmtDate, fmtTime, fullName, age } from '../supabase.js'
import { Modal, StatusBadge, InvoiceBadge, useToast } from '../ui.jsx'
import Odontogram, { CONDITIONS } from '../Odontogram.jsx'
import { PatientModal } from './Patients.jsx'
import { useClinic } from '../clinic.jsx'

const TABS = ['Overview', 'Dental chart', 'Notes', 'Treatment plans', 'Billing', 'Imaging', 'Comms']

export const SCHEME_META = {
  private: { label: 'Private', cls: 'b-gray' },
  prsi: { label: 'PRSI', cls: 'b-blue' },
  medical_card: { label: 'Medical card', cls: 'b-violet' },
}

export default function PatientDetail() {
  const { id } = useParams()
  const [p, setP] = useState(null)
  const [tab, setTab] = useState('Overview')
  const [editing, setEditing] = useState(false)
  const toast = useToast()

  const load = () => sb.from('dental_patients').select('*').eq('id', id).single().then(({ data }) => setP(data))
  useEffect(() => { load() }, [id])

  const saveEdit = async (form) => {
    const { error } = await sb.from('dental_patients').update(form).eq('id', id)
    if (error) return toast('Error: ' + error.message)
    toast('Patient updated')
    setEditing(false)
    load()
  }

  if (!p) return <div className="content empty">Loading…</div>

  return (
    <>
      <div className="topbar">
        <div className="row" style={{ gap: 14 }}>
          <div className="avatar" style={{ width: 48, height: 48, fontSize: 17 }}>{p.first_name[0]}{p.last_name[0]}</div>
          <div>
            <div className="page-title">{p.first_name} {p.last_name}</div>
            <div className="page-sub">
              {age(p.dob) != null ? `${age(p.dob)} yrs · ` : ''}{p.phone || 'no phone'} · {p.email || 'no email'}
            </div>
          </div>
          <span className={`badge ${SCHEME_META[p.scheme]?.cls || 'b-gray'}`} style={{ marginLeft: 8 }}>{SCHEME_META[p.scheme]?.label || p.scheme}</span>
          {p.medical_alerts && <span className="badge b-red" style={{ marginLeft: 4 }}>⚠ {p.medical_alerts}</span>}
        </div>
        <div className="row">
          <Link to="/patients" className="btn secondary sm">← All patients</Link>
          <button className="btn sm" onClick={() => setEditing(true)}>Edit details</button>
        </div>
      </div>
      <div className="content">
        <div className="tabs">
          {TABS.map((t) => (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
        {tab === 'Overview' && <Overview p={p} />}
        {tab === 'Dental chart' && <ChartTab patientId={id} />}
        {tab === 'Notes' && <NotesTab patientId={id} />}
        {tab === 'Treatment plans' && <PlansTab patientId={id} />}
        {tab === 'Billing' && <BillingTab patientId={id} />}
        {tab === 'Imaging' && <ImagingTab patientId={id} patient={p} />}
        {tab === 'Comms' && <CommsTab patientId={id} patient={p} />}
      </div>
      {editing && <PatientModal patient={p} onSave={saveEdit} onClose={() => setEditing(false)} />}
    </>
  )
}

function Overview({ p }) {
  const [appts, setAppts] = useState([])
  useEffect(() => {
    sb.from('dental_appointments')
      .select('*, practitioner:dental_practitioners(name)')
      .eq('patient_id', p.id).order('starts_at', { ascending: false }).limit(10)
      .then(({ data }) => setAppts(data || []))
  }, [p.id])
  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr 1.4fr' }}>
      <div className="card card-pad">
        <div className="card-title">Details</div>
        <div className="grid" style={{ gap: 12 }}>
          {[['Date of birth', p.dob ? `${fmtDate(p.dob)} (${age(p.dob)} yrs)` : '—'],
            ['Phone', p.phone || '—'],
            ['Email', p.email || '—'],
            ['Address', p.address || '—'],
            ['Medical alerts', p.medical_alerts || 'None recorded'],
            ['Patient since', fmtDate(p.created_at)]].map(([k, v]) => (
            <div key={k} className="spread">
              <span className="muted small" style={{ fontWeight: 600 }}>{k}</span>
              <span style={{ textAlign: 'right' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="card card-pad">
        <div className="card-title">Appointment history</div>
        <table className="tbl">
          <tbody>
            {appts.map((a) => (
              <tr key={a.id}>
                <td className="mono small" style={{ width: 130 }}>{fmtDate(a.starts_at)} {fmtTime(a.starts_at)}</td>
                <td>{a.reason}<div className="small muted">{a.practitioner?.name}</div></td>
                <td style={{ textAlign: 'right' }}><StatusBadge status={a.status} /></td>
              </tr>
            ))}
            {appts.length === 0 && <tr><td><div className="empty">No appointments yet.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ChartTab({ patientId }) {
  const [entries, setEntries] = useState([])
  const [tooth, setTooth] = useState(null)
  const [dentition, setDentition] = useState('adult')
  const [asOf, setAsOf] = useState('') // '' = current chart; else YYYY-MM-DD snapshot
  const [form, setForm] = useState({ condition: 'caries', surface: '', status: 'planned', note: '' })
  const toast = useToast()

  const load = () =>
    sb.from('dental_chart_entries').select('*').eq('patient_id', patientId).order('created_at')
      .then(({ data }) => setEntries(data || []))
  useEffect(() => { load() }, [patientId])

  const add = async () => {
    if (!tooth) return
    const { error } = await sb.from('dental_chart_entries').insert({
      patient_id: patientId, tooth,
      surface: form.surface || null,
      condition: form.condition, status: form.status, note: form.note || null,
    })
    if (error) return toast('Error: ' + error.message)
    toast(`Tooth ${tooth}: ${CONDITIONS[form.condition].label} added`)
    setForm((f) => ({ ...f, note: '' }))
    load()
  }
  const del = async (id) => {
    await sb.from('dental_chart_entries').delete().eq('id', id)
    load()
  }

  const changeDates = [...new Set(entries.map((e) => e.created_at.slice(0, 10)))].sort().reverse()
  const visible = asOf ? entries.filter((e) => e.created_at.slice(0, 10) <= asOf) : entries
  const toothEntries = visible.filter((e) => e.tooth === tooth)

  return (
    <div className="grid" style={{ gridTemplateColumns: '1.7fr 1fr' }}>
      <div className="card card-pad">
        <div className="card-title">
          Dental chart {dentition === 'adult' ? '(FDI)' : '(primary — ABCDE)'}
          <span className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
            <select className="input" style={{ width: 170, padding: '5px 8px' }} value={asOf} onChange={(e) => setAsOf(e.target.value)}>
              <option value="">Current chart</option>
              {changeDates.map((d) => <option key={d} value={d}>As of {new Date(d + 'T12:00').toLocaleDateString('en-IE')}</option>)}
            </select>
            <button className={`btn sm ${dentition === 'adult' ? '' : 'secondary'}`} onClick={() => { setDentition('adult'); setTooth(null) }}>Adult</button>
            <button className={`btn sm ${dentition === 'primary' ? '' : 'secondary'}`} onClick={() => { setDentition('primary'); setTooth(null) }}>Baby teeth</button>
          </span>
        </div>
        {asOf && (
          <div className="badge b-amber" style={{ marginBottom: 10 }}>
            📜 Viewing the chart as it stood on {new Date(asOf + 'T12:00').toLocaleDateString('en-IE')} — read-only
          </div>
        )}
        <Odontogram entries={visible} selectedTooth={tooth} onSelect={setTooth} dentition={dentition} />
      </div>
      <div className="card card-pad">
        <div className="card-title">{tooth ? `Tooth ${tooth}` : 'Select a tooth'}</div>
        {tooth ? (
          <>
            <div className="grid" style={{ gap: 10, marginBottom: 16 }}>
              {toothEntries.map((e) => (
                <div key={e.id} className="spread" style={{ padding: '8px 10px', background: 'var(--mint-bg)', borderRadius: 10 }}>
                  <div>
                    <span className="badge" style={{ background: CONDITIONS[e.condition]?.color + '22', color: CONDITIONS[e.condition]?.color }}>
                      {CONDITIONS[e.condition]?.label}{e.surface ? ` · ${e.surface}` : ''}
                    </span>
                    <span className="small muted" style={{ marginLeft: 8 }}>{e.status} · {fmtDate(e.created_at)}</span>
                    {e.note && <div className="small muted" style={{ marginTop: 3 }}>{e.note}</div>}
                  </div>
                  {!asOf && <button className="btn ghost sm" onClick={() => del(e.id)}>✕</button>}
                </div>
              ))}
              {toothEntries.length === 0 && <div className="small muted">No entries for this tooth.</div>}
            </div>
            {!asOf && (
            <div className="grid" style={{ gap: 10 }}>
              <div className="form-grid">
                <div>
                  <label className="field">Condition</label>
                  <select className="input" value={form.condition} onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}>
                    {Object.entries(CONDITIONS).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field">Surfaces (M O D B L + R = root)</label>
                  <input className="input" value={form.surface} placeholder="e.g. MO, R — blank = whole tooth"
                    onChange={(e) => setForm((f) => ({ ...f, surface: e.target.value.toUpperCase().replace(/[^MODBLR]/g, '') }))} />
                </div>
                <div>
                  <label className="field">Status</label>
                  <select className="input" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                    <option value="existing">Existing</option>
                    <option value="planned">Planned</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="field">Note</label>
                  <input className="input" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
                </div>
              </div>
              <button className="btn" onClick={add}>Add to tooth {tooth}</button>
            </div>
            )}
          </>
        ) : (
          <div className="empty">Click a tooth on the chart to view or record findings.</div>
        )}
      </div>
    </div>
  )
}

function PlansTab({ patientId }) {
  const [plans, setPlans] = useState([])
  const [treatments, setTreatments] = useState([])
  const [creating, setCreating] = useState(false)
  const toast = useToast()

  const load = () =>
    sb.from('dental_treatment_plans').select('*').eq('patient_id', patientId).order('created_at', { ascending: false })
      .then(({ data }) => setPlans(data || []))
  useEffect(() => {
    load()
    sb.from('dental_treatments').select('*').order('category').then(({ data }) => setTreatments(data || []))
  }, [patientId])

  const toggleItem = async (plan, idx) => {
    const items = plan.items.map((it, i) => (i === idx ? { ...it, done: !it.done } : it))
    const allDone = items.every((i) => i.done)
    await sb.from('dental_treatment_plans').update({ items, status: allDone ? 'completed' : plan.status }).eq('id', plan.id)
    load()
  }
  const setStatus = async (plan, status) => {
    await sb.from('dental_treatment_plans').update({ status }).eq('id', plan.id)
    load()
  }
  const create = async (title, items) => {
    const { error } = await sb.from('dental_treatment_plans').insert({ patient_id: patientId, title, items, status: 'proposed' })
    if (error) return toast('Error: ' + error.message)
    toast('Treatment plan created')
    setCreating(false)
    load()
  }

  const statusCls = { proposed: 'b-blue', accepted: 'b-teal', in_progress: 'b-amber', completed: 'b-green' }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="spread">
        <span className="muted">{plans.length} plan(s)</span>
        <button className="btn" onClick={() => setCreating(true)}>+ New plan</button>
      </div>
      {plans.map((plan) => {
        const total = plan.items.reduce((s, i) => s + Number(i.price || 0), 0)
        return (
          <div className="card card-pad" key={plan.id}>
            <div className="card-title">
              <span>{plan.title} <span className={`badge ${statusCls[plan.status] || 'b-gray'}`} style={{ marginLeft: 8 }}>{plan.status.replace('_', ' ')}</span></span>
              <span className="row">
                <select className="input" style={{ width: 140, padding: '5px 8px' }} value={plan.status} onChange={(e) => setStatus(plan, e.target.value)}>
                  {['proposed', 'accepted', 'in_progress', 'completed'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </span>
            </div>
            <table className="tbl">
              <tbody>
                {plan.items.map((it, i) => (
                  <tr key={i}>
                    <td style={{ width: 30 }}>
                      <input type="checkbox" checked={!!it.done} onChange={() => toggleItem(plan, i)} />
                    </td>
                    <td style={{ textDecoration: it.done ? 'line-through' : 'none' }}>
                      {it.name}{it.tooth ? <span className="muted"> · tooth {it.tooth}</span> : ''}
                    </td>
                    <td className="mono" style={{ textAlign: 'right' }}>{euro(it.price)}</td>
                  </tr>
                ))}
                <tr>
                  <td /><td style={{ fontWeight: 700 }}>Total</td>
                  <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{euro(total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )
      })}
      {plans.length === 0 && <div className="card card-pad empty">No treatment plans yet.</div>}
      {creating && <PlanModal treatments={treatments} onSave={create} onClose={() => setCreating(false)} />}
    </div>
  )
}

function PlanModal({ treatments, onSave, onClose }) {
  const [title, setTitle] = useState('')
  const [items, setItems] = useState([])
  const [sel, setSel] = useState('')
  const [toothIn, setToothIn] = useState('')

  const addItem = () => {
    const t = treatments.find((x) => x.id === sel)
    if (!t) return
    setItems((arr) => [...arr, { name: t.name, tooth: toothIn, price: Number(t.price), done: false }])
    setToothIn('')
  }
  const total = items.reduce((s, i) => s + i.price, 0)

  return (
    <Modal title="New treatment plan" onClose={onClose}>
      <div className="grid" style={{ gap: 12 }}>
        <div>
          <label className="field">Plan title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Restore lower left" />
        </div>
        <div className="row">
          <select className="input" value={sel} onChange={(e) => setSel(e.target.value)}>
            <option value="">Choose treatment…</option>
            {treatments.map((t) => <option key={t.id} value={t.id}>{t.name} — {euro(t.price)}</option>)}
          </select>
          <input className="input" style={{ width: 90 }} placeholder="Tooth" value={toothIn} onChange={(e) => setToothIn(e.target.value)} />
          <button className="btn secondary" onClick={addItem}>Add</button>
        </div>
        {items.map((it, i) => (
          <div key={i} className="spread small" style={{ padding: '6px 10px', background: 'var(--mint-bg)', borderRadius: 8 }}>
            <span>{it.name}{it.tooth ? ` · ${it.tooth}` : ''}</span>
            <span className="row">
              €<input type="number" className="input" style={{ width: 84, padding: '4px 8px' }} value={it.price} min="0" step="5"
                onChange={(e) => setItems((a) => a.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) } : x)))} />
              <button className="btn ghost sm" onClick={() => setItems((a) => a.filter((_, j) => j !== i))}>✕</button>
            </span>
          </div>
        ))}
        {items.length > 0 && <div className="spread" style={{ fontWeight: 700 }}><span>Total</span><span>{euro(total)}</span></div>}
      </div>
      <div className="actions">
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn" disabled={!title || items.length === 0} onClick={() => onSave(title, items)}>Create plan</button>
      </div>
    </Modal>
  )
}

function BillingTab({ patientId }) {
  const [invoices, setInvoices] = useState([])
  const [payments, setPayments] = useState([])
  useEffect(() => {
    sb.from('dental_invoices').select('*').eq('patient_id', patientId).order('issued_on', { ascending: false })
      .then(({ data }) => setInvoices(data || []))
    sb.from('dental_payments').select('*').eq('patient_id', patientId).order('paid_on', { ascending: false })
      .then(({ data }) => setPayments(data || []))
  }, [patientId])

  const billed = invoices.filter((i) => i.status !== 'void').reduce((s, i) => s + Number(i.total), 0)
  const paid = payments.reduce((s, p) => s + Number(p.amount), 0)

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="card stat"><div className="k">Billed</div><div className="v">{euro(billed)}</div></div>
        <div className="card stat"><div className="k">Paid</div><div className="v" style={{ color: 'var(--green)' }}>{euro(paid)}</div></div>
        <div className="card stat"><div className="k">Balance</div><div className="v" style={{ color: billed - paid > 0 ? 'var(--red)' : 'var(--green)' }}>{euro(billed - paid)}</div></div>
      </div>
      <div className="card">
        <table className="tbl">
          <thead><tr><th>Invoice</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td style={{ fontWeight: 600 }}>{inv.number}</td>
                <td>{fmtDate(inv.issued_on)}</td>
                <td className="small muted">{(inv.items || []).map((i) => i.description).join(', ')}</td>
                <td className="mono">{euro(inv.total)}</td>
                <td><InvoiceBadge status={inv.status} /></td>
              </tr>
            ))}
            {invoices.length === 0 && <tr><td colSpan={5}><div className="empty">No invoices.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function NotesTab({ patientId }) {
  const { clinic, clinicId } = useClinic()
  const [notes, setNotes] = useState([])
  const [templates, setTemplates] = useState([])
  const [pracs, setPracs] = useState([])
  const [body, setBody] = useState('')
  const [author, setAuthor] = useState('')
  const [listening, setListening] = useState(false)
  const [rec, setRec] = useState(null)
  const toast = useToast()

  const load = () =>
    sb.from('dental_clinical_notes').select('*').eq('patient_id', patientId).order('created_at', { ascending: false })
      .then(({ data }) => setNotes(data || []))
  useEffect(() => {
    load()
    sb.from('dental_note_templates').select('*').eq('clinic_id', clinicId).order('name').then(({ data }) => setTemplates(data || []))
    sb.from('dental_practitioners').select('name').eq('clinic_id', clinicId).order('name')
      .then(({ data }) => { setPracs(data || []); if (data?.[0]) setAuthor(data[0].name) })
  }, [patientId, clinicId])

  const save = async () => {
    if (!body.trim()) return
    const { error } = await sb.from('dental_clinical_notes').insert({ patient_id: patientId, author, body: body.trim() })
    if (error) return toast('Error: ' + error.message)
    toast('Note saved')
    setBody('')
    load()
  }

  const insertTemplate = (id) => {
    const t = templates.find((x) => x.id === id)
    if (t) setBody((b) => (b ? b + '\n\n' : '') + t.body)
  }

  const toggleDictation = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return toast('Dictation needs Chrome or Edge (speech recognition unsupported here).')
    if (listening) { rec?.stop(); setListening(false); return }
    const r = new SR()
    r.lang = 'en-IE'
    r.continuous = true
    r.interimResults = false
    r.onresult = (e) => {
      let text = ''
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) text += e.results[i][0].transcript
      if (text) setBody((b) => (b ? b + ' ' : '') + text.trim())
    }
    r.onend = () => setListening(false)
    r.onerror = () => { setListening(false); toast('Dictation stopped — check the microphone permission.') }
    r.start()
    setRec(r)
    setListening(true)
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr 1.2fr', alignItems: 'start' }}>
      <div className="card card-pad">
        <div className="card-title">New clinical note</div>
        <div className="grid" style={{ gap: 10 }}>
          <div className="row">
            <select className="input" value={author} onChange={(e) => setAuthor(e.target.value)}>
              {pracs.map((p) => <option key={p.name}>{p.name}</option>)}
              <option>Reception</option>
            </select>
            <select className="input" value="" onChange={(e) => { if (e.target.value) insertTemplate(e.target.value) }}>
              <option value="">Insert template…</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <textarea className="input" rows={10} value={body} onChange={(e) => setBody(e.target.value)}
            placeholder="Type, insert a template, or hit Dictate and talk…" style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13 }} />
          <div className="row">
            <button className={`btn ${listening ? 'danger' : 'secondary'}`} onClick={toggleDictation}>
              {listening ? '■ Stop dictating' : '🎤 Dictate'}
            </button>
            <button className="btn" style={{ flex: 1, justifyContent: 'center' }} disabled={!body.trim()} onClick={save}>Save note</button>
          </div>
          <p className="small muted">Templates are managed in Settings. Dictation uses the browser's speech engine (Chrome/Edge) — free, nothing leaves {clinic.name} unlogged.</p>
        </div>
      </div>
      <div className="card card-pad">
        <div className="card-title">Notes history</div>
        <div className="grid" style={{ gap: 10 }}>
          {notes.map((n) => (
            <div key={n.id} style={{ padding: '10px 12px', background: 'var(--mint-bg)', borderRadius: 10 }}>
              <div className="spread small" style={{ marginBottom: 4 }}>
                <b>{n.author || 'Unknown'}</b>
                <span className="muted mono">{fmtDate(n.created_at)} {fmtTime(n.created_at)}</span>
              </div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{n.body}</div>
            </div>
          ))}
          {notes.length === 0 && <div className="empty">No notes yet.</div>}
        </div>
      </div>
    </div>
  )
}

const REF_KINDS = { xray: '🩻 X-ray', cbct: '🧠 CBCT (3D)', scan3d: '🦷 3D scan', photo: '📷 Photos', other: '📁 Other' }
const IMAGING_LABELS = { romexis: 'Romexis', csimaging: 'CS Imaging' }

function ImagingTab({ patientId, patient }) {
  const { clinic } = useClinic()
  const imaging = clinic.imaging_software && clinic.imaging_software !== 'none' ? clinic.imaging_software : null

  const openInImaging = () => {
    const params = new URLSearchParams({
      vendor: imaging, pid: patientId,
      first: patient?.first_name || '', last: patient?.last_name || '', dob: patient?.dob || '',
    })
    window.location.href = `dentora://open?${params.toString()}`
  }
  const [files, setFiles] = useState([])
  const [refs, setRefs] = useState([])
  const [refForm, setRefForm] = useState({ kind: 'cbct', label: '', location: '', taken_on: '', note: '' })
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const loadRefs = () =>
    sb.from('dental_imaging_refs').select('*').eq('patient_id', patientId).order('created_at', { ascending: false })
      .then(({ data }) => setRefs(data || []))
  useEffect(() => { loadRefs() }, [patientId])

  const addRef = async () => {
    if (!refForm.label.trim()) return
    const { error } = await sb.from('dental_imaging_refs').insert({
      patient_id: patientId, kind: refForm.kind, label: refForm.label.trim(),
      location: refForm.location || null, taken_on: refForm.taken_on || null, note: refForm.note || null,
    })
    if (error) return toast('Error: ' + error.message)
    toast('Study logged')
    setRefForm({ kind: 'cbct', label: '', location: '', taken_on: '', note: '' })
    loadRefs()
  }
  const delRef = async (r) => {
    await sb.from('dental_imaging_refs').delete().eq('id', r.id)
    loadRefs()
  }

  const load = () =>
    sb.storage.from('dental-files').list(patientId, { sortBy: { column: 'created_at', order: 'desc' } })
      .then(({ data }) => setFiles((data || []).filter((f) => f.name !== '.emptyFolderPlaceholder')))
  useEffect(() => { load() }, [patientId])

  const upload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    const { error } = await sb.storage.from('dental-files').upload(`${patientId}/${Date.now()}_${file.name}`, file)
    setBusy(false)
    e.target.value = ''
    if (error) return toast('Upload failed: ' + error.message)
    toast(`${file.name} attached`)
    load()
  }

  const [viewing, setViewing] = useState(null) // {name, url, kind}

  const open = async (f) => {
    const { data, error } = await sb.storage.from('dental-files').createSignedUrl(`${patientId}/${f.name}`, 600)
    if (error) return toast('Error: ' + error.message)
    const ext = f.name.split('.').pop().toLowerCase()
    const kind = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext) ? 'image' : ext === 'pdf' ? 'pdf' : 'other'
    if (kind === 'other') return window.open(data.signedUrl, '_blank')
    setViewing({ name: f.name.replace(/^\d+_/, ''), url: data.signedUrl, kind })
  }

  const del = async (f) => {
    await sb.storage.from('dental-files').remove([`${patientId}/${f.name}`])
    toast('File removed')
    load()
  }

  const fmtSize = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`)

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card card-pad">
        <div className="card-title">
          Files & documents
          {imaging && (
            <button className="btn sm" style={{ background: 'var(--violet)' }} onClick={openInImaging}>
              🩻 Open in {IMAGING_LABELS[imaging]}
            </button>
          )}
        </div>
        <div className="row" style={{ marginBottom: 8 }}>
          <label className="btn secondary" style={{ cursor: 'pointer' }}>
            {busy ? 'Uploading…' : '⬆ Attach file'}
            <input type="file" style={{ display: 'none' }} onChange={upload} disabled={busy} />
          </label>
          <span className="small muted">X-ray exports, photos, STL/PLY, PDFs, patient emails, consent forms, referral replies — anything on the record, stored encrypted.</span>
        </div>
        <table className="tbl">
          <tbody>
            {files.map((f) => (
              <tr key={f.name}>
                <td style={{ fontWeight: 500 }}>{f.name.replace(/^\d+_/, '')}</td>
                <td className="small muted" style={{ width: 90 }}>{f.metadata?.size ? fmtSize(f.metadata.size) : ''}</td>
                <td className="small muted" style={{ width: 110 }}>{f.created_at ? fmtDate(f.created_at) : ''}</td>
                <td style={{ width: 130, textAlign: 'right' }}>
                  <span className="row" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn sm secondary" onClick={() => open(f)}>Open</button>
                    <button className="btn ghost sm" onClick={() => del(f)}>✕</button>
                  </span>
                </td>
              </tr>
            ))}
            {files.length === 0 && <tr><td colSpan={4}><div className="empty">No files attached yet.</div></td></tr>}
          </tbody>
        </table>
      </div>
      <div className="card card-pad">
        <div className="card-title">Large studies — CBCT, 3D scans, full X-ray sets</div>
        <p className="small muted" style={{ marginBottom: 12 }}>
          Multi-GB studies stay in your imaging program — log them here so everyone knows they exist and where to open them.
        </p>
        <div className="grid" style={{ gap: 10, marginBottom: 14 }}>
          {refs.map((r) => (
            <div key={r.id} className="spread" style={{ padding: '10px 12px', background: 'var(--mint-bg)', borderRadius: 10 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{REF_KINDS[r.kind] || r.kind} — {r.label}</div>
                <div className="small muted">
                  {r.location ? `Open in: ${r.location}` : ''}{r.taken_on ? ` · taken ${fmtDate(r.taken_on)}` : ''}
                </div>
                {r.note && <div className="small muted">{r.note}</div>}
              </div>
              <span className="row">
                {imaging && <button className="btn sm secondary" onClick={openInImaging}>Open in {IMAGING_LABELS[imaging]}</button>}
                <button className="btn ghost sm" onClick={() => delRef(r)}>✕</button>
              </span>
            </div>
          ))}
          {refs.length === 0 && <div className="small muted">No external studies logged.</div>}
        </div>
        <div className="form-grid">
          <div>
            <label className="field">Type</label>
            <select className="input" value={refForm.kind} onChange={(e) => setRefForm((f) => ({ ...f, kind: e.target.value }))}>
              {Object.entries(REF_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="field">Label</label>
            <input className="input" value={refForm.label} placeholder="e.g. CBCT upper arch pre-implant"
              onChange={(e) => setRefForm((f) => ({ ...f, label: e.target.value }))} />
          </div>
          <div>
            <label className="field">Where it lives (program / drive)</label>
            <input className="input" value={refForm.location} placeholder="e.g. Romexis — Surgery 2 PC"
              onChange={(e) => setRefForm((f) => ({ ...f, location: e.target.value }))} />
          </div>
          <div>
            <label className="field">Taken on</label>
            <input type="date" className="input" value={refForm.taken_on}
              onChange={(e) => setRefForm((f) => ({ ...f, taken_on: e.target.value }))} />
          </div>
        </div>
        <button className="btn" style={{ marginTop: 10 }} disabled={!refForm.label.trim()} onClick={addRef}>Log study</button>
      </div>
      <p className="small muted" style={{ maxWidth: 680 }}>
        {imaging
          ? <>The "Open in {IMAGING_LABELS[imaging]}" buttons need the free <a href="https://github.com/mohammad-jpg/dentora/tree/main/bridge" target="_blank" rel="noreferrer" style={{ color: 'var(--teal)', fontWeight: 600 }}>Dentora Imaging Bridge</a> installed once on each surgery PC — if nothing opens, install it (2 minutes, no admin rights).</>
          : <>Pick your imaging software in Settings → Practice to get one-click "Open in Romexis / CS Imaging" buttons here (via the free Dentora Imaging Bridge).</>}
      </p>
      {viewing && (
        <Modal title={viewing.name} onClose={() => setViewing(null)}>
          {viewing.kind === 'image'
            ? <img src={viewing.url} alt={viewing.name} style={{ maxWidth: '100%', borderRadius: 10 }} />
            : <iframe src={viewing.url} title={viewing.name} style={{ width: '100%', height: '60vh', border: 'none', borderRadius: 10 }} />}
          <div className="actions">
            <a className="btn secondary" href={viewing.url} target="_blank" rel="noreferrer">Open in new tab</a>
            <button className="btn" onClick={() => setViewing(null)}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function CommsTab({ patientId, patient }) {
  const { clinic } = useClinic()
  const [log, setLog] = useState([])
  const toast = useToast()
  const load = () =>
    sb.from('dental_comms_log').select('*').eq('patient_id', patientId).order('sent_at', { ascending: false })
      .then(({ data }) => setLog(data || []))
  useEffect(() => { load() }, [patientId])

  const send = async (channel) => {
    const body = channel === 'sms'
      ? `Hi ${patient.first_name}, a quick note from ${clinic.name}${clinic.phone ? ` — reply or call us on ${clinic.phone}` : ''}.`
      : `Dear ${patient.first_name}, this is a message from ${clinic.name} regarding your care.`
    await sb.from('dental_comms_log').insert({ patient_id: patientId, channel, body })
    toast(channel === 'sms' ? 'SMS queued (demo)' : 'Email queued (demo)')
    load()
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="row">
        <button className="btn secondary" onClick={() => send('sms')}>📱 Send SMS</button>
        <button className="btn secondary" onClick={() => send('email')}>✉️ Send email</button>
        <span className="small muted">Demo mode — messages are logged, not transmitted. Live SMS via Twilio ≈ €0.07/msg.</span>
      </div>
      <div className="card">
        <table className="tbl">
          <tbody>
            {log.map((m) => (
              <tr key={m.id}>
                <td style={{ width: 80 }}><span className={`badge ${m.channel === 'sms' ? 'b-teal' : 'b-violet'}`}>{m.channel.toUpperCase()}</span></td>
                <td>{m.body}</td>
                <td className="small muted mono" style={{ width: 150, textAlign: 'right' }}>{fmtDate(m.sent_at)} {fmtTime(m.sent_at)}</td>
              </tr>
            ))}
            {log.length === 0 && <tr><td colSpan={3}><div className="empty">No messages yet.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
