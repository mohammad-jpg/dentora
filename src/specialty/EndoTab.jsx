import { useEffect, useState } from 'react'
import { sb, fmtDate } from '../supabase.js'
import { Modal, useToast } from '../ui.jsx'
import { useClinic } from '../clinic.jsx'

export const PULPAL = {
  reversible_pulpitis: 'Reversible pulpitis',
  irreversible_pulpitis_symptomatic: 'Symptomatic irreversible pulpitis',
  irreversible_pulpitis_asymptomatic: 'Asymptomatic irreversible pulpitis',
  necrosis: 'Pulp necrosis',
  previously_treated: 'Previously treated',
  previously_initiated: 'Previously initiated therapy',
}
export const APICAL = {
  normal: 'Normal apical tissues',
  symptomatic_ap: 'Symptomatic apical periodontitis',
  asymptomatic_ap: 'Asymptomatic apical periodontitis',
  acute_abscess: 'Acute apical abscess',
  chronic_abscess: 'Chronic apical abscess',
}
export const ENDO_STATUS = {
  planned: ['Planned', 'b-gray'], in_progress: ['In progress', 'b-amber'], completed: ['Completed', 'b-green'], review: ['Under review', 'b-blue'],
}
export const OPEN_ENDO = ['planned', 'in_progress', 'review']
const CANAL_PRESETS = {
  anterior: ['Single'], premolar: ['B', 'P'], molar_upper: ['MB', 'MB2', 'DB', 'P'], molar_lower: ['MB', 'ML', 'D'],
}
const blankCanal = () => ({ name: '', wl: '', ref: '', maf: '', obturation: '' })

// Pick a sensible canal preset from an FDI tooth number so the form starts pre-filled.
export function presetForTooth(tooth) {
  const n = String(tooth || '').trim()
  if (!/^[1-4][1-8]$/.test(n)) return null
  const q = Number(n[0]), t = Number(n[1])
  if (t <= 3) return 'anterior'
  if (t <= 5) return 'premolar'
  return q <= 2 ? 'molar_upper' : 'molar_lower'
}

export const newEndoForm = (tooth = '') => ({
  tooth, diagnosis_pulpal: 'irreversible_pulpitis_symptomatic', diagnosis_apical: 'symptomatic_ap',
  tests: { cold: '', ept: '', percussion: '', palpation: '', mobility: '' },
  canals: [blankCanal()],
  medicament: '', sealer: '', rubber_dam: true, visits: 1, complications: '', status: 'planned', review_due: '', outcome: '', referrer: '', notes: '',
})

// Normalise a case row for editing (jsonb fields may be null on older rows).
export const editEndoForm = (c) => ({ ...c, tests: c.tests || {}, canals: c.canals?.length ? c.canals : [blankCanal()] })

// Insert or update a case. Returns { data, error }.
export async function saveEndoCase(patientId, form, existingId) {
  const payload = {
    ...form, patient_id: patientId,
    tooth: String(form.tooth || '').trim(),
    visits: Number(form.visits) || 1, review_due: form.review_due || null,
    canals: (form.canals || []).filter((c) => c.name?.trim()),
  }
  delete payload.id; delete payload.created_at; delete payload.patient
  const q = existingId
    ? sb.from('dental_endo_cases').update(payload).eq('id', existingId).select().single()
    : sb.from('dental_endo_cases').insert(payload).select().single()
  return q
}

export function buildEndoReport(clinic, patient, c) {
  const today = new Date().toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })
  const canalLines = (c.canals || []).map((k) => `  ${k.name}: WL ${k.wl || '—'} mm (${k.ref || 'ref not recorded'}), MAF ${k.maf || '—'}${k.obturation ? `, ${k.obturation}` : ''}`).join('\n')
  return `${clinic.name}
${[clinic.address, clinic.phone, clinic.email].filter(Boolean).join(' · ')}

${today}

${c.referrer ? `To: ${c.referrer}\n\n` : ''}RE: ${patient.first_name} ${patient.last_name}${patient.dob ? ` (DOB ${fmtDate(patient.dob)})` : ''}
Tooth ${c.tooth} — endodontic treatment report

Dear colleague,

Thank you for referring the above patient. Summary of treatment on tooth ${c.tooth}:

Diagnosis: ${PULPAL[c.diagnosis_pulpal] || '—'}; ${APICAL[c.diagnosis_apical] || '—'}
Tests: cold ${c.tests?.cold || '—'}, EPT ${c.tests?.ept || '—'}, percussion ${c.tests?.percussion || '—'}, palpation ${c.tests?.palpation || '—'}, mobility ${c.tests?.mobility || '—'}
Rubber dam isolation: ${c.rubber_dam ? 'yes' : 'no'} · Visits: ${c.visits}
Canals:
${canalLines || '  —'}
${c.medicament ? `Intracanal medicament: ${c.medicament}\n` : ''}${c.sealer ? `Sealer: ${c.sealer}\n` : ''}${c.complications ? `Complications: ${c.complications}\n` : 'No complications.\n'}${c.outcome ? `Outcome: ${c.outcome}\n` : ''}
${c.review_due ? `Review planned: ${fmtDate(c.review_due)} (clinical and radiographic).` : 'Review recommended at 12 months.'}
${c.notes ? `\nNotes: ${c.notes}\n` : ''}
The patient has been advised to return to you for the definitive coronal restoration${c.status === 'completed' ? ' as soon as possible' : ' on completion'}.

Kind regards,

${clinic.name}`
}

export function EndoReportModal({ report, onClose }) {
  const toast = useToast()
  return (
    <Modal title="Report to referring dentist" onClose={onClose}>
      <div className="letter">{report}</div>
      <div className="actions">
        <button className="btn secondary" onClick={() => { navigator.clipboard.writeText(report); toast('Report copied') }}>Copy</button>
        <button className="btn" onClick={() => window.print()}>Print</button>
      </div>
    </Modal>
  )
}

export default function EndoTab({ patientId, patient }) {
  const { clinic } = useClinic()
  const [cases, setCases] = useState([])
  const [editing, setEditing] = useState(null)
  const [report, setReport] = useState(null)
  const toast = useToast()

  const load = () =>
    sb.from('dental_endo_cases').select('*').eq('patient_id', patientId).order('created_at', { ascending: false })
      .then(({ data }) => setCases(data || []))
  useEffect(() => { load() }, [patientId])

  const save = async (form) => {
    const { error } = await saveEndoCase(patientId, form, editing?.id)
    if (error) return toast('Error: ' + error.message)
    toast(editing?.id ? 'Endo case updated' : 'Endo case opened')
    setEditing(null)
    load()
  }

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="spread">
        <span className="muted small">{cases.length} case(s)</span>
        <button className="btn" onClick={() => setEditing(newEndoForm())}>+ New endo case</button>
      </div>
      {cases.map((c) => {
        const [label, cls] = ENDO_STATUS[c.status] || [c.status, 'b-gray']
        return (
          <div key={c.id} className="card card-pad">
            <div className="spread">
              <div>
                <div style={{ fontWeight: 600 }}>Tooth {c.tooth} <span className={`badge ${cls}`} style={{ marginLeft: 8 }}>{label}</span></div>
                <div className="small muted">{PULPAL[c.diagnosis_pulpal] || '—'} · {APICAL[c.diagnosis_apical] || '—'}</div>
              </div>
              <div className="row">
                <button className="btn sm secondary" onClick={() => setReport(buildEndoReport(clinic, patient, c))}>Report to referrer</button>
                <button className="btn ghost sm" onClick={() => setEditing(editEndoForm(c))}>Edit</button>
              </div>
            </div>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 12 }}>
              <div className="small">
                <div className="muted" style={{ fontWeight: 600, marginBottom: 4 }}>Canals</div>
                <table className="tbl" style={{ fontSize: 12 }}>
                  <thead><tr><th>Canal</th><th>WL</th><th>Ref</th><th>MAF</th><th>Obturation</th></tr></thead>
                  <tbody>
                    {(c.canals || []).map((k, i) => (
                      <tr key={i}><td><b>{k.name}</b></td><td>{k.wl ? `${k.wl} mm` : '—'}</td><td>{k.ref || '—'}</td><td>{k.maf || '—'}</td><td>{k.obturation || '—'}</td></tr>
                    ))}
                    {(c.canals || []).length === 0 && <tr><td colSpan={5} className="muted">Not recorded</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="small grid" style={{ gap: 5 }}>
                {[['Cold', c.tests?.cold], ['EPT', c.tests?.ept], ['Percussion', c.tests?.percussion], ['Palpation', c.tests?.palpation], ['Rubber dam', c.rubber_dam ? 'Yes' : 'No'], ['Visits', c.visits], ['Medicament', c.medicament], ['Sealer', c.sealer], ['Complications', c.complications || 'None'], ['Review due', c.review_due ? fmtDate(c.review_due) : '—'], ['Outcome', c.outcome]].map(([k, v]) => (
                  <div key={k} className="spread"><span className="muted">{k}</span><span>{v || '—'}</span></div>
                ))}
              </div>
            </div>
          </div>
        )
      })}
      {cases.length === 0 && <div className="card card-pad empty">No endodontic case yet.</div>}
      {editing && <EndoCaseModal form={editing} setForm={setEditing} onSave={save} onClose={() => setEditing(null)} />}
      {report && <EndoReportModal report={report} onClose={() => setReport(null)} />}
    </div>
  )
}

export function EndoCaseModal({ form, setForm, onSave, onClose, patientName }) {
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const setTest = (k) => (e) => setForm((f) => ({ ...f, tests: { ...f.tests, [k]: e.target.value } }))
  const setCanal = (i, k, val) => setForm((f) => ({ ...f, canals: f.canals.map((c, j) => (j === i ? { ...c, [k]: val } : c)) }))
  const preset = (key) => setForm((f) => ({ ...f, canals: CANAL_PRESETS[key].map((n) => ({ ...blankCanal(), name: n })) }))
  // When the tooth is typed on a new case and canals are still untouched, pre-fill the matching preset.
  const setTooth = (e) => {
    const tooth = e.target.value
    setForm((f) => {
      const untouched = !f.id && f.canals.every((c) => !c.name && !c.wl && !c.maf)
      const key = presetForTooth(tooth)
      return untouched && key ? { ...f, tooth, canals: CANAL_PRESETS[key].map((n) => ({ ...blankCanal(), name: n })) } : { ...f, tooth }
    })
  }
  const title = form.id ? `Edit endo case — tooth ${form.tooth}` : 'New endodontic case'

  return (
    <Modal title={patientName ? `${title} — ${patientName}` : title} onClose={onClose} wide>
      <div className="grid" style={{ gap: 12 }}>
        <div className="form-grid" style={{ gridTemplateColumns: '1fr 2fr 2fr' }}>
          <div><label className="field">Tooth (FDI)</label><input className="input" value={form.tooth} onChange={setTooth} placeholder="e.g. 46" autoFocus /></div>
          <div><label className="field">Pulpal diagnosis</label>
            <select className="input" value={form.diagnosis_pulpal || ''} onChange={set('diagnosis_pulpal')}>{Object.entries(PULPAL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          <div><label className="field">Apical diagnosis</label>
            <select className="input" value={form.diagnosis_apical || ''} onChange={set('diagnosis_apical')}>{Object.entries(APICAL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        </div>
        <div>
          <label className="field">Sensibility & clinical tests</label>
          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
            {[['cold', 'Cold', 'e.g. lingering'], ['ept', 'EPT', 'e.g. 45'], ['percussion', 'Percussion', '+ / −'], ['palpation', 'Palpation', '+ / −'], ['mobility', 'Mobility', 'grade']].map(([k, l, ph]) => (
              <input key={k} className="input" placeholder={`${l}: ${ph}`} value={form.tests?.[k] || ''} onChange={setTest(k)} />
            ))}
          </div>
        </div>
        <div>
          <div className="spread" style={{ marginBottom: 6 }}>
            <label className="field" style={{ margin: 0 }}>Canals — working length, reference, master apical file, obturation</label>
            <span className="row" style={{ gap: 4 }}>
              {Object.keys(CANAL_PRESETS).map((k) => <button key={k} type="button" className="btn ghost sm" onClick={() => preset(k)}>{k.replace('_', ' ')}</button>)}
            </span>
          </div>
          <div className="grid" style={{ gap: 6 }}>
            {form.canals.map((c, i) => (
              <div key={i} className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 1.5fr 1fr 1.5fr auto', gap: 6 }}>
                <input className="input" placeholder="Canal" value={c.name} onChange={(e) => setCanal(i, 'name', e.target.value)} />
                <input className="input" placeholder="WL mm" value={c.wl} onChange={(e) => setCanal(i, 'wl', e.target.value)} />
                <input className="input" placeholder="Reference point" value={c.ref} onChange={(e) => setCanal(i, 'ref', e.target.value)} />
                <input className="input" placeholder="MAF" value={c.maf} onChange={(e) => setCanal(i, 'maf', e.target.value)} />
                <input className="input" placeholder="Obturation" value={c.obturation} onChange={(e) => setCanal(i, 'obturation', e.target.value)} />
                <button type="button" className="btn ghost sm" onClick={() => setForm((f) => ({ ...f, canals: f.canals.filter((_, j) => j !== i) }))}>Remove</button>
              </div>
            ))}
            <button type="button" className="btn secondary sm" style={{ justifySelf: 'start' }} onClick={() => setForm((f) => ({ ...f, canals: [...f.canals, blankCanal()] }))}>+ Canal</button>
          </div>
        </div>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div><label className="field">Medicament</label><input className="input" placeholder="e.g. Ca(OH)₂" value={form.medicament || ''} onChange={set('medicament')} /></div>
          <div><label className="field">Sealer</label><input className="input" placeholder="e.g. AH Plus" value={form.sealer || ''} onChange={set('sealer')} /></div>
          <div><label className="field">Visits</label><input type="number" className="input" value={form.visits ?? 1} onChange={set('visits')} /></div>
          <div><label className="field">Status</label>
            <select className="input" value={form.status} onChange={set('status')}>{Object.entries(ENDO_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></div>
          <div><label className="field">Review due</label><input type="date" className="input" value={form.review_due || ''} onChange={set('review_due')} /></div>
          <div><label className="field">Referring dentist</label><input className="input" value={form.referrer || ''} onChange={set('referrer')} placeholder="Name / practice" /></div>
          <div style={{ gridColumn: 'span 2' }}><label className="field">Complications</label><input className="input" value={form.complications || ''} onChange={set('complications')} placeholder="e.g. separated instrument MB2, managed by bypass" /></div>
        </div>
        <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!form.rubber_dam} onChange={(e) => setForm((f) => ({ ...f, rubber_dam: e.target.checked }))} />
          <span className="small">Rubber dam isolation used</span>
        </label>
        <div className="form-grid">
          <div><label className="field">Outcome</label><input className="input" value={form.outcome || ''} onChange={set('outcome')} placeholder="e.g. asymptomatic, radiographic healing at 6/12" /></div>
          <div><label className="field">Notes</label><input className="input" value={form.notes || ''} onChange={set('notes')} /></div>
        </div>
      </div>
      <div className="actions">
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn" disabled={!String(form.tooth || '').trim()} onClick={() => onSave(form)}>Save case</button>
      </div>
    </Modal>
  )
}
