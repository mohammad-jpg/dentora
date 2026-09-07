import { useEffect, useState } from 'react'
import { sb, euro, fmtDate } from '../supabase.js'
import { Modal, useToast } from '../ui.jsx'

export const APPLIANCES = {
  fixed_both: 'Fixed appliances — upper & lower',
  fixed_upper: 'Fixed appliance — upper',
  fixed_lower: 'Fixed appliance — lower',
  aligners: 'Clear aligners',
  functional: 'Functional appliance',
  retainers: 'Retainers only',
}
export const ORTHO_STATUS = {
  consult: ['Consultation', 'b-gray'], records: ['Records taken', 'b-blue'], active: ['Active treatment', 'b-teal'],
  retention: ['Retention', 'b-violet'], completed: ['Completed', 'b-green'],
}

export function orthoProgress(c) {
  if (!c.start_date || !c.planned_months) return 0
  const months = (Date.now() - new Date(c.start_date).getTime()) / (30.44 * 86400000)
  return Math.max(0, Math.min(100, Math.round((months / c.planned_months) * 100)))
}

export default function OrthoTab({ patientId, patient }) {
  const [cases, setCases] = useState([])
  const [editing, setEditing] = useState(null)
  const [open, setOpen] = useState(null) // case id expanded
  const toast = useToast()

  const load = () =>
    sb.from('dental_ortho_cases').select('*').eq('patient_id', patientId).order('created_at', { ascending: false })
      .then(({ data }) => { setCases(data || []); if (!open && data?.[0]) setOpen(data[0].id) })
  useEffect(() => { load() }, [patientId])

  const save = async (form) => {
    const payload = {
      ...form, patient_id: patientId,
      start_date: form.start_date || null, planned_months: Number(form.planned_months) || null,
      overjet_mm: form.overjet_mm === '' ? null : Number(form.overjet_mm),
      aligner_total: form.aligner_total === '' ? null : Number(form.aligner_total),
      aligner_current: form.aligner_current === '' ? null : Number(form.aligner_current),
      plan_total: Number(form.plan_total) || 0, deposit: Number(form.deposit) || 0,
      instalment: Number(form.instalment) || 0, instalments_count: Number(form.instalments_count) || 0,
    }
    const q = editing?.id ? sb.from('dental_ortho_cases').update(payload).eq('id', editing.id) : sb.from('dental_ortho_cases').insert(payload).select().single()
    const { data, error } = await q
    if (error) return toast('Error: ' + error.message)
    // (re)generate instalment schedule for new cases with a plan
    if (!editing?.id && data && payload.instalments_count > 0 && payload.instalment > 0) {
      const first = payload.start_date ? new Date(payload.start_date) : new Date()
      const rows = Array.from({ length: payload.instalments_count }, (_, i) => {
        const d = new Date(first); d.setMonth(d.getMonth() + i + 1)
        return { case_id: data.id, due_date: d.toISOString().slice(0, 10), amount: payload.instalment }
      })
      await sb.from('dental_ortho_instalments').insert(rows)
    }
    toast(editing?.id ? 'Case updated' : 'Ortho case opened')
    setEditing(null)
    load()
  }

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="spread">
        <span className="muted small">{cases.length} case(s)</span>
        <button className="btn" onClick={() => setEditing({ appliance: 'fixed_both', status: 'consult', start_date: '', planned_months: 18, iotn: '', overjet_mm: '', overbite: '', aligner_total: '', aligner_current: '', plan_total: '', deposit: '', instalment: '', instalments_count: '', notes: '' })}>
          + New ortho case
        </button>
      </div>
      {cases.map((c) => (
        <OrthoCase key={c.id} c={c} patient={patient} expanded={open === c.id} onToggle={() => setOpen(open === c.id ? null : c.id)} onEdit={() => setEditing({ ...c })} onChanged={load} />
      ))}
      {cases.length === 0 && <div className="card card-pad empty">No orthodontic case yet.</div>}
      {editing && <OrthoCaseModal form={editing} setForm={setEditing} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  )
}

function OrthoCase({ c, expanded, onToggle, onEdit, onChanged }) {
  const [visits, setVisits] = useState([])
  const [inst, setInst] = useState([])
  const [addingVisit, setAddingVisit] = useState(false)
  const [v, setV] = useState({ visit_date: new Date().toISOString().slice(0, 10), archwire_upper: '', archwire_lower: '', elastics: '', aligner_no: '', note: '', next_weeks: 6 })
  const toast = useToast()
  const [label, cls] = ORTHO_STATUS[c.status] || [c.status, 'b-gray']

  const load = () => {
    sb.from('dental_ortho_visits').select('*').eq('case_id', c.id).order('visit_date', { ascending: false }).then(({ data }) => setVisits(data || []))
    sb.from('dental_ortho_instalments').select('*').eq('case_id', c.id).order('due_date').then(({ data }) => setInst(data || []))
  }
  useEffect(() => { if (expanded) load() }, [expanded, c.id])

  const addVisit = async () => {
    const { error } = await sb.from('dental_ortho_visits').insert({
      case_id: c.id, visit_date: v.visit_date, archwire_upper: v.archwire_upper || null, archwire_lower: v.archwire_lower || null,
      elastics: v.elastics || null, aligner_no: v.aligner_no === '' ? null : Number(v.aligner_no), note: v.note || null, next_weeks: Number(v.next_weeks) || null,
    })
    if (error) return toast('Error: ' + error.message)
    if (v.aligner_no !== '') await sb.from('dental_ortho_cases').update({ aligner_current: Number(v.aligner_no) }).eq('id', c.id)
    toast('Visit logged')
    setAddingVisit(false)
    setV((x) => ({ ...x, archwire_upper: '', archwire_lower: '', elastics: '', aligner_no: '', note: '' }))
    load(); onChanged()
  }

  const markPaid = async (i) => {
    await sb.from('dental_payments').insert({ patient_id: c.patient_id, amount: i.amount, method: 'card' })
    await sb.from('dental_ortho_instalments').update({ paid_on: new Date().toISOString().slice(0, 10) }).eq('id', i.id)
    toast(`Instalment of ${euro(i.amount)} recorded`)
    load()
  }

  const today = new Date().toISOString().slice(0, 10)
  const paid = inst.filter((i) => i.paid_on).reduce((s, i) => s + Number(i.amount), 0)
  const overdue = inst.filter((i) => !i.paid_on && i.due_date < today)
  const progress = orthoProgress(c)

  return (
    <div className="card card-pad">
      <div className="spread" style={{ cursor: 'pointer' }} onClick={onToggle}>
        <div>
          <div style={{ fontWeight: 600 }}>{APPLIANCES[c.appliance] || c.appliance} <span className={`badge ${cls}`} style={{ marginLeft: 8 }}>{label}</span></div>
          <div className="small muted">
            {c.start_date ? `Started ${fmtDate(c.start_date)} · ` : ''}{c.planned_months ? `${c.planned_months} months planned` : ''}
            {c.appliance === 'aligners' && c.aligner_total ? ` · tray ${c.aligner_current || 0} of ${c.aligner_total}` : ''}
          </div>
        </div>
        <div className="row">
          {c.status === 'active' && (
            <div style={{ width: 120 }}>
              <div className="small muted" style={{ textAlign: 'right', marginBottom: 3 }}>{progress}% of plan</div>
              <div style={{ height: 6, background: 'var(--line-soft)', borderRadius: 99 }}>
                <div style={{ height: 6, width: `${progress}%`, background: 'var(--accent)', borderRadius: 99 }} />
              </div>
            </div>
          )}
          <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); onEdit() }}>Edit</button>
        </div>
      </div>

      {expanded && (
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 16 }}>
          <div>
            <div className="card-title" style={{ marginBottom: 8 }}>
              Assessment
            </div>
            <div className="grid" style={{ gap: 6 }}>
              {[['IOTN', c.iotn || '—'], ['Overjet', c.overjet_mm != null ? `${c.overjet_mm} mm` : '—'], ['Overbite', c.overbite || '—']].map(([k, val]) => (
                <div key={k} className="spread small"><span className="muted">{k}</span><span>{val}</span></div>
              ))}
            </div>
            {c.notes && <p className="small" style={{ marginTop: 10, color: 'var(--ink-60)', whiteSpace: 'pre-wrap' }}>{c.notes}</p>}

            <div className="card-title" style={{ margin: '18px 0 8px' }}>
              Visits
              <button className="btn sm secondary" onClick={() => setAddingVisit(true)}>+ Log visit</button>
            </div>
            {addingVisit && (
              <div className="grid" style={{ gap: 8, padding: 12, background: 'var(--mint-bg)', borderRadius: 8, marginBottom: 10 }}>
                <div className="form-grid">
                  <div><label className="field">Date</label><input type="date" className="input" value={v.visit_date} onChange={(e) => setV((x) => ({ ...x, visit_date: e.target.value }))} /></div>
                  <div><label className="field">Next visit (weeks)</label><input type="number" className="input" value={v.next_weeks} onChange={(e) => setV((x) => ({ ...x, next_weeks: e.target.value }))} /></div>
                  {c.appliance === 'aligners' ? (
                    <div><label className="field">Aligner tray no.</label><input type="number" className="input" value={v.aligner_no} onChange={(e) => setV((x) => ({ ...x, aligner_no: e.target.value }))} /></div>
                  ) : (
                    <>
                      <div><label className="field">Archwire upper</label><input className="input" placeholder="e.g. 0.014 NiTi" value={v.archwire_upper} onChange={(e) => setV((x) => ({ ...x, archwire_upper: e.target.value }))} /></div>
                      <div><label className="field">Archwire lower</label><input className="input" placeholder="e.g. 19×25 SS" value={v.archwire_lower} onChange={(e) => setV((x) => ({ ...x, archwire_lower: e.target.value }))} /></div>
                    </>
                  )}
                  <div><label className="field">Elastics</label><input className="input" placeholder="e.g. Class II 3/16 4.5oz" value={v.elastics} onChange={(e) => setV((x) => ({ ...x, elastics: e.target.value }))} /></div>
                </div>
                <input className="input" placeholder="Note (oral hygiene, breakages, compliance…)" value={v.note} onChange={(e) => setV((x) => ({ ...x, note: e.target.value }))} />
                <div className="row" style={{ justifyContent: 'flex-end' }}>
                  <button className="btn secondary sm" onClick={() => setAddingVisit(false)}>Cancel</button>
                  <button className="btn sm" onClick={addVisit}>Save visit</button>
                </div>
              </div>
            )}
            <div className="grid" style={{ gap: 6 }}>
              {visits.map((vs) => (
                <div key={vs.id} className="small" style={{ padding: '8px 10px', background: 'var(--mint-bg)', borderRadius: 8 }}>
                  <b>{fmtDate(vs.visit_date)}</b>
                  {vs.aligner_no != null && <span> · tray {vs.aligner_no}</span>}
                  {vs.archwire_upper && <span> · U: {vs.archwire_upper}</span>}
                  {vs.archwire_lower && <span> · L: {vs.archwire_lower}</span>}
                  {vs.elastics && <span> · elastics: {vs.elastics}</span>}
                  {vs.next_weeks && <span className="muted"> · next in {vs.next_weeks}w</span>}
                  {vs.note && <div className="muted" style={{ marginTop: 2 }}>{vs.note}</div>}
                </div>
              ))}
              {visits.length === 0 && <div className="small muted">No visits logged.</div>}
            </div>
          </div>

          <div>
            <div className="card-title" style={{ marginBottom: 8 }}>
              Payment plan
              {overdue.length > 0 && <span className="badge b-red">{overdue.length} overdue</span>}
            </div>
            <div className="grid" style={{ gap: 6, marginBottom: 10 }}>
              {[['Plan total', euro(c.plan_total)], ['Deposit', euro(c.deposit)], ['Instalments', c.instalments_count ? `${c.instalments_count} × ${euro(c.instalment)}` : '—'], ['Paid to date', euro(paid + Number(c.deposit || 0))], ['Remaining', euro(Number(c.plan_total || 0) - paid - Number(c.deposit || 0))]].map(([k, val]) => (
                <div key={k} className="spread small"><span className="muted">{k}</span><span style={{ fontWeight: k === 'Remaining' ? 650 : 500 }}>{val}</span></div>
              ))}
            </div>
            <div className="grid" style={{ gap: 4, maxHeight: 260, overflowY: 'auto' }}>
              {inst.map((i) => {
                const late = !i.paid_on && i.due_date < today
                return (
                  <div key={i.id} className="spread small" style={{ padding: '6px 10px', background: 'var(--mint-bg)', borderRadius: 7 }}>
                    <span>{fmtDate(i.due_date)} · {euro(i.amount)}</span>
                    {i.paid_on
                      ? <span className="badge b-green">paid {fmtDate(i.paid_on)}</span>
                      : <span className="row" style={{ gap: 6 }}>{late && <span className="badge b-red">overdue</span>}<button className="btn sm secondary" onClick={() => markPaid(i)}>Record</button></span>}
                  </div>
                )
              })}
              {inst.length === 0 && <div className="small muted">No instalment schedule — set one when creating the case.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function OrthoCaseModal({ form, setForm, onSave, onClose }) {
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  return (
    <Modal title={form.id ? 'Edit ortho case' : 'New orthodontic case'} onClose={onClose}>
      <div className="grid" style={{ gap: 12 }}>
        <div className="form-grid">
          <div><label className="field">Appliance</label>
            <select className="input" value={form.appliance} onChange={set('appliance')}>{Object.entries(APPLIANCES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          <div><label className="field">Status</label>
            <select className="input" value={form.status} onChange={set('status')}>{Object.entries(ORTHO_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></div>
          <div><label className="field">Start date</label><input type="date" className="input" value={form.start_date || ''} onChange={set('start_date')} /></div>
          <div><label className="field">Planned duration (months)</label><input type="number" className="input" value={form.planned_months ?? ''} onChange={set('planned_months')} /></div>
          <div><label className="field">IOTN (DHC / AC)</label><input className="input" placeholder="e.g. 4d / 7" value={form.iotn || ''} onChange={set('iotn')} /></div>
          <div><label className="field">Overjet (mm)</label><input type="number" step="0.5" className="input" value={form.overjet_mm ?? ''} onChange={set('overjet_mm')} /></div>
          <div><label className="field">Overbite</label><input className="input" placeholder="e.g. increased & complete" value={form.overbite || ''} onChange={set('overbite')} /></div>
          {form.appliance === 'aligners' && (
            <div><label className="field">Total aligner trays</label><input type="number" className="input" value={form.aligner_total ?? ''} onChange={set('aligner_total')} /></div>
          )}
        </div>
        <div className="card-title" style={{ margin: '4px 0 0' }}>Payment plan</div>
        <div className="form-grid">
          <div><label className="field">Total fee (€)</label><input type="number" className="input" value={form.plan_total ?? ''} onChange={set('plan_total')} /></div>
          <div><label className="field">Deposit (€)</label><input type="number" className="input" value={form.deposit ?? ''} onChange={set('deposit')} /></div>
          <div><label className="field">Monthly instalment (€)</label><input type="number" className="input" value={form.instalment ?? ''} onChange={set('instalment')} /></div>
          <div><label className="field">Number of instalments</label><input type="number" className="input" value={form.instalments_count ?? ''} onChange={set('instalments_count')} /></div>
        </div>
        {!form.id && <p className="small muted">A monthly schedule is generated automatically from the start date.</p>}
        <div><label className="field">Notes</label><textarea className="input" rows={3} value={form.notes || ''} onChange={set('notes')} /></div>
      </div>
      <div className="actions">
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn" onClick={() => onSave(form)}>Save case</button>
      </div>
    </Modal>
  )
}
