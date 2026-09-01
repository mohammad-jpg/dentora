import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { sb, fmtDate, fullName } from '../supabase.js'
import { useToast } from '../ui.jsx'

// Digital version of the paper "Patient Routing Slip" — completed by the nurse/hygienist
// before handover to the front desk, then processed by reception.

const EMPTY = {
  visit_type: 'recall',
  chief_complaint: '', dental_history: '', medical_history: '',
  diagnostics: { bitewings: false, opg: false, fmp: false, cbct: false, photos: false, photo_teeth: '' },
  findings: {
    caries: { on: false, extent: '', teeth: '' },
    pulpal: { on: false, diagnosis: '', teeth: '' },
    crack: { on: false, crown_needed: '', stain: '', teeth: '' },
    failing_restoration: { on: false, action: '', teeth: '' },
    perio: { on: false, pocketing: '', bop: '', mobility: '' },
    missing: { on: false, replacement_discussed: '', implant_suitable: '', teeth: '' },
    malocclusion: { on: false, aligner_suitable: '', crowding: '', teeth: '' },
    wear: { on: false, severity: '', night_guard: '', teeth: '' },
    other: { on: false, detail: '', teeth: '' },
  },
  notes: '',
  hygienist: { teeth_of_concern: '', bop: '', noted_areas: '', night_guard: '' },
  products: { whitening: false, fluoride: false, other: '' },
  handover: {
    highlighted: '', schedule_mins: '', inhouse_referral: '', refer_to: '', note: '',
    accepted: '', next_appt_date: '', next_appt_treatment: '', next_hygiene_reserved: '',
  },
}

const STATUS_META = {
  in_progress: ['In progress', 'b-amber'],
  handed_over: ['With front desk', 'b-blue'],
  processed: ['Processed', 'b-green'],
}

export default function Handover() {
  const [slips, setSlips] = useState([])
  const [patients, setPatients] = useState([])
  const [pracs, setPracs] = useState([])
  const [editing, setEditing] = useState(null) // slip row being edited/created
  const toast = useToast()

  const load = () =>
    sb.from('dental_routing_slips')
      .select('*, patient:dental_patients(id,first_name,last_name), practitioner:dental_practitioners(name)')
      .order('created_at', { ascending: false })
      .then(({ data }) => setSlips(data || []))

  useEffect(() => {
    load()
    sb.from('dental_patients').select('id,first_name,last_name').order('last_name').then(({ data }) => setPatients(data || []))
    sb.from('dental_practitioners').select('id,name').order('name').then(({ data }) => setPracs(data || []))
  }, [])

  const startNew = () =>
    setEditing({ patient_id: patients[0]?.id || '', practitioner_id: pracs[0]?.id || '', status: 'in_progress', data: structuredClone(EMPTY) })

  const save = async (slip, status) => {
    const payload = {
      patient_id: slip.patient_id, practitioner_id: slip.practitioner_id,
      data: slip.data, status, updated_at: new Date().toISOString(),
    }
    const q = slip.id
      ? sb.from('dental_routing_slips').update(payload).eq('id', slip.id)
      : sb.from('dental_routing_slips').insert(payload)
    const { error } = await q
    if (error) return toast('Error: ' + error.message)
    toast(status === 'handed_over' ? 'Slip handed to front desk' : 'Slip saved')
    setEditing(null)
    load()
  }

  const setStatus = async (slip, status) => {
    await sb.from('dental_routing_slips').update({ status }).eq('id', slip.id)
    toast(status === 'processed' ? 'Marked processed by front desk' : 'Status updated')
    load()
  }

  if (editing) {
    return <SlipForm slip={editing} patients={patients} pracs={pracs}
      onChange={setEditing} onSave={save} onCancel={() => setEditing(null)} />
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title">Handover</div>
          <div className="page-sub">Patient routing slips — nurse/hygienist completes, front desk processes. No more paper + scanning.</div>
        </div>
        <button className="btn" onClick={startNew}>+ New routing slip</button>
      </div>
      <div className="content">
        <div className="card">
          <table className="tbl">
            <thead><tr><th>Patient</th><th>Provider</th><th>Created</th><th>Key flags</th><th>Status</th><th /></tr></thead>
            <tbody>
              {slips.map((s) => {
                const [label, cls] = STATUS_META[s.status] || [s.status, 'b-gray']
                const f = s.data?.findings || {}
                const flags = Object.entries(f).filter(([, v]) => v?.on).map(([k]) => k.replace('_', ' '))
                return (
                  <tr key={s.id}>
                    <td><Link to={`/patients/${s.patient?.id}`} style={{ fontWeight: 600, color: 'var(--teal-dark)' }}>{fullName(s.patient)}</Link></td>
                    <td className="muted">{s.practitioner?.name || '—'}</td>
                    <td>{fmtDate(s.created_at)}</td>
                    <td className="small muted" style={{ maxWidth: 220 }}>{flags.length ? flags.join(', ') : 'no findings ticked'}</td>
                    <td><span className={`badge ${cls}`}>{label}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="row" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn sm secondary" onClick={() => setEditing(structuredClone(s))}>Open</button>
                        {s.status === 'handed_over' && <button className="btn sm" onClick={() => setStatus(s, 'processed')}>Mark processed</button>}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {slips.length === 0 && <tr><td colSpan={6}><div className="empty">No routing slips yet.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

/* ---------- form helpers ---------- */
function Check({ label, checked, onChange }) {
  return (
    <label className="row" style={{ gap: 7, cursor: 'pointer', fontSize: 13.5 }}>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}
function Choice({ label, value, options, onChange }) {
  return (
    <span className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
      {label && <span className="small muted" style={{ fontWeight: 600 }}>{label}</span>}
      {options.map(([v, l]) => (
        <button key={v} type="button"
          className={`btn sm ${value === v ? '' : 'secondary'}`}
          onClick={() => onChange(value === v ? '' : v)}>{l}</button>
      ))}
    </span>
  )
}
function Teeth({ value, onChange }) {
  return <input className="input" style={{ width: 130 }} placeholder="Teeth (FDI)" value={value}
    onChange={(e) => onChange(e.target.value)} />
}
function Section({ title, sub, children }) {
  return (
    <div className="card card-pad">
      <div className="card-title" style={{ marginBottom: 4 }}>{title}</div>
      {sub && <div className="small muted" style={{ marginBottom: 12 }}>{sub}</div>}
      <div className="grid" style={{ gap: 12 }}>{children}</div>
    </div>
  )
}

function FindingRow({ label, f, onChange, children }) {
  return (
    <div style={{ padding: '10px 12px', background: f.on ? 'var(--teal-soft)' : 'var(--mint-bg)', borderRadius: 10 }}>
      <div className="spread" style={{ flexWrap: 'wrap', gap: 8 }}>
        <Check label={<b>{label}</b>} checked={f.on} onChange={(v) => onChange({ ...f, on: v })} />
        {f.on && 'teeth' in f && <Teeth value={f.teeth} onChange={(v) => onChange({ ...f, teeth: v })} />}
      </div>
      {f.on && <div className="row" style={{ flexWrap: 'wrap', gap: 10, marginTop: 8 }}>{children}</div>}
    </div>
  )
}

function SlipForm({ slip, patients, pracs, onChange, onSave, onCancel }) {
  const d = slip.data
  const set = (path, value) => {
    const next = structuredClone(slip)
    let obj = next.data
    const keys = path.split('.')
    for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]]
    obj[keys[keys.length - 1]] = value
    onChange(next)
  }
  const setF = (key) => (v) => set(`findings.${key}`, v)
  const yn = [['yes', 'Yes'], ['no', 'No']]

  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title">Patient routing slip</div>
          <div className="page-sub">Complete in sequence · diagnostics before treatment · hand over to front desk when done</div>
        </div>
        <div className="row">
          <button className="btn secondary" onClick={onCancel}>Back</button>
          <button className="btn secondary" onClick={() => onSave(slip, 'in_progress')}>Save draft</button>
          <button className="btn" onClick={() => onSave(slip, 'handed_over')}>Hand over to front desk</button>
        </div>
      </div>
      <div className="content grid" style={{ gap: 16, maxWidth: 900 }}>
        <Section title="Patient information">
          <div className="form-grid">
            <div>
              <label className="field">Patient</label>
              <select className="input" value={slip.patient_id} onChange={(e) => onChange({ ...slip, patient_id: e.target.value })}>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.last_name}, {p.first_name}</option>)}
              </select>
            </div>
            <div>
              <label className="field">Provider</label>
              <select className="input" value={slip.practitioner_id || ''} onChange={(e) => onChange({ ...slip, practitioner_id: e.target.value })}>
                {pracs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <Choice label="Visit:" value={d.visit_type} options={[['new', 'New patient'], ['recall', 'Recall']]} onChange={(v) => set('visit_type', v)} />
          <div><label className="field">Chief complaint (patient's own words)</label>
            <input className="input" value={d.chief_complaint} onChange={(e) => set('chief_complaint', e.target.value)} /></div>
          <div className="form-grid">
            <div><label className="field">Dental history (previous Tx, anxiety, habits)</label>
              <input className="input" value={d.dental_history} onChange={(e) => set('dental_history', e.target.value)} /></div>
            <div><label className="field">Medical history / allergies</label>
              <input className="input" value={d.medical_history} onChange={(e) => set('medical_history', e.target.value)} /></div>
          </div>
        </Section>

        <Section title="Diagnostics completed">
          <div className="row" style={{ flexWrap: 'wrap', gap: 16 }}>
            <Check label="Bitewing radiographs" checked={d.diagnostics.bitewings} onChange={(v) => set('diagnostics.bitewings', v)} />
            <Check label="OPG (panoramic)" checked={d.diagnostics.opg} onChange={(v) => set('diagnostics.opg', v)} />
            <Check label="FMP (full mouth periapicals)" checked={d.diagnostics.fmp} onChange={(v) => set('diagnostics.fmp', v)} />
            <Check label="CBCT" checked={d.diagnostics.cbct} onChange={(v) => set('diagnostics.cbct', v)} />
            <Check label="Intraoral photos taken" checked={d.diagnostics.photos} onChange={(v) => set('diagnostics.photos', v)} />
          </div>
          {d.diagnostics.photos && (
            <div><label className="field">Teeth photographed (FDI)</label>
              <input className="input" value={d.diagnostics.photo_teeth} onChange={(e) => set('diagnostics.photo_teeth', e.target.value)} /></div>
          )}
        </Section>

        <Section title="Clinical findings" sub="Tick a finding, add tooth numbers in FDI notation">
          <FindingRow label="Caries" f={d.findings.caries} onChange={setF('caries')}>
            <Choice label="Extent:" value={d.findings.caries.extent}
              options={[['enamel', 'Enamel'], ['dentine', 'Dentine'], ['deep', 'Deep / pulpal']]}
              onChange={(v) => set('findings.caries.extent', v)} />
          </FindingRow>
          <FindingRow label="Pulpal pathology" f={d.findings.pulpal} onChange={setF('pulpal')}>
            <Choice label="Diagnosis:" value={d.findings.pulpal.diagnosis}
              options={[['rev', 'Rev. pulpitis'], ['irrev', 'Irrev. pulpitis'], ['necrosis', 'Necrosis']]}
              onChange={(v) => set('findings.pulpal.diagnosis', v)} />
          </FindingRow>
          <FindingRow label="Crack or fracture" f={d.findings.crack} onChange={setF('crack')}>
            <Choice label="Crown needed:" value={d.findings.crack.crown_needed} options={yn}
              onChange={(v) => set('findings.crack.crown_needed', v)} />
            <Choice label="Stain:" value={d.findings.crack.stain} options={[['warm', 'Warm'], ['dark', 'Dark']]}
              onChange={(v) => set('findings.crack.stain', v)} />
          </FindingRow>
          <FindingRow label="Failing restoration" f={d.findings.failing_restoration} onChange={setF('failing_restoration')}>
            <Choice label="Action:" value={d.findings.failing_restoration.action}
              options={[['resin', 'Replace with resin'], ['inlay', 'CEREC inlay/onlay'], ['crown', 'Crown']]}
              onChange={(v) => set('findings.failing_restoration.action', v)} />
          </FindingRow>
          <FindingRow label="Periodontal status" f={d.findings.perio} onChange={setF('perio')}>
            <Choice label="Pocketing:" value={d.findings.perio.pocketing}
              options={[['4', '≤4mm'], ['5', '5mm'], ['6', '6mm+']]}
              onChange={(v) => set('findings.perio.pocketing', v)} />
            <Choice label="BOP:" value={d.findings.perio.bop} options={yn} onChange={(v) => set('findings.perio.bop', v)} />
            <Choice label="Mobility:" value={d.findings.perio.mobility} options={yn} onChange={(v) => set('findings.perio.mobility', v)} />
          </FindingRow>
          <FindingRow label="Missing tooth" f={d.findings.missing} onChange={setF('missing')}>
            <Choice label="Replacement discussed?" value={d.findings.missing.replacement_discussed} options={yn}
              onChange={(v) => set('findings.missing.replacement_discussed', v)} />
            <Choice label="Implant suitable?" value={d.findings.missing.implant_suitable} options={yn}
              onChange={(v) => set('findings.missing.implant_suitable', v)} />
          </FindingRow>
          <FindingRow label="Misalignment / malocclusion" f={d.findings.malocclusion} onChange={setF('malocclusion')}>
            <Choice label="Aligner suitable?" value={d.findings.malocclusion.aligner_suitable} options={yn}
              onChange={(v) => set('findings.malocclusion.aligner_suitable', v)} />
            <Choice label="Crowding:" value={d.findings.malocclusion.crowding}
              options={[['mild', 'Mild'], ['moderate', 'Moderate']]}
              onChange={(v) => set('findings.malocclusion.crowding', v)} />
          </FindingRow>
          <FindingRow label="Tooth wear" f={d.findings.wear} onChange={setF('wear')}>
            <Choice label="Severity:" value={d.findings.wear.severity}
              options={[['mild', 'Mild'], ['moderate', 'Moderate'], ['severe', 'Severe']]}
              onChange={(v) => set('findings.wear.severity', v)} />
            <Choice label="Night guard recommended:" value={d.findings.wear.night_guard} options={yn}
              onChange={(v) => set('findings.wear.night_guard', v)} />
          </FindingRow>
          <FindingRow label="Other findings" f={d.findings.other} onChange={setF('other')}>
            <Choice label="Detail:" value={d.findings.other.detail}
              options={[['mucosal', 'Mucosal lesion'], ['pericoronitis', 'Pericoronitis'], ['tori', 'Tori'], ['other', 'Other']]}
              onChange={(v) => set('findings.other.detail', v)} />
          </FindingRow>
          <div><label className="field">Notes</label>
            <textarea className="input" rows={2} value={d.notes} onChange={(e) => set('notes', e.target.value)} /></div>
        </Section>

        <Section title="Hygienist notes">
          <div className="form-grid">
            <div><label className="field">Tooth numbers of concern</label>
              <input className="input" value={d.hygienist.teeth_of_concern} onChange={(e) => set('hygienist.teeth_of_concern', e.target.value)} /></div>
            <div><label className="field">Noted areas</label>
              <input className="input" value={d.hygienist.noted_areas} onChange={(e) => set('hygienist.noted_areas', e.target.value)} /></div>
          </div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 16 }}>
            <Choice label="Bleeding on probing?" value={d.hygienist.bop} options={yn} onChange={(v) => set('hygienist.bop', v)} />
            <Choice label="Night guard recommended?" value={d.hygienist.night_guard} options={yn} onChange={(v) => set('hygienist.night_guard', v)} />
          </div>
        </Section>

        <Section title="Products recommended">
          <div className="row" style={{ flexWrap: 'wrap', gap: 16 }}>
            <Check label="Whitening" checked={d.products.whitening} onChange={(v) => set('products.whitening', v)} />
            <Check label="Fluoride treatment" checked={d.products.fluoride} onChange={(v) => set('products.fluoride', v)} />
            <input className="input" style={{ width: 220 }} placeholder="Other product…" value={d.products.other}
              onChange={(e) => set('products.other', e.target.value)} />
          </div>
        </Section>

        <Section title="Handover & next steps">
          <div><label className="field">Clinician highlighted to patient and recommended treatment</label>
            <textarea className="input" rows={2} value={d.handover.highlighted} onChange={(e) => set('handover.highlighted', e.target.value)} /></div>
          <Choice label="How long to schedule:" value={d.handover.schedule_mins}
            options={[['30', '30 min'], ['45', '45 min'], ['60', '60 min'], ['90', '90 min+']]}
            onChange={(v) => set('handover.schedule_mins', v)} />
          <div className="row" style={{ flexWrap: 'wrap', gap: 14 }}>
            <Choice label="In-house referral required?" value={d.handover.inhouse_referral} options={yn}
              onChange={(v) => set('handover.inhouse_referral', v)} />
            {d.handover.inhouse_referral === 'yes' && (
              <select className="input" style={{ width: 200 }} value={d.handover.refer_to} onChange={(e) => set('handover.refer_to', e.target.value)}>
                <option value="">Refer to (doctor)…</option>
                {pracs.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            )}
          </div>
          <Choice label="Patient accepted treatment?" value={d.handover.accepted}
            options={[['yes', 'Yes'], ['no', 'No'], ['consider', 'To consider']]}
            onChange={(v) => set('handover.accepted', v)} />
          <Choice label="Next hygiene appointment reserved?" value={d.handover.next_hygiene_reserved} options={yn}
            onChange={(v) => set('handover.next_hygiene_reserved', v)} />
          <div className="form-grid">
            <div><label className="field">Next appointment date</label>
              <input type="date" className="input" value={d.handover.next_appt_date} onChange={(e) => set('handover.next_appt_date', e.target.value)} /></div>
            <div><label className="field">Treatment</label>
              <input className="input" value={d.handover.next_appt_treatment} onChange={(e) => set('handover.next_appt_treatment', e.target.value)} /></div>
          </div>
          <div><label className="field">Note for front desk</label>
            <input className="input" value={d.handover.note} onChange={(e) => set('handover.note', e.target.value)} /></div>
        </Section>

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn secondary" onClick={() => onSave(slip, 'in_progress')}>Save draft</button>
          <button className="btn" onClick={() => onSave(slip, 'handed_over')}>Hand over to front desk</button>
        </div>
      </div>
    </>
  )
}
