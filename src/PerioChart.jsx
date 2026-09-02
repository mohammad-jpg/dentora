import { useEffect, useState } from 'react'
import { sb, fmtDate } from './supabase.js'
import { Modal, useToast } from './ui.jsx'

// Periodontal charting: BPE screening (6 sextants, BSP flag rules) and a
// comprehensive perio chart (buccal/lingual PPD, recession, computed attachment
// loss, plaque per tooth) with exam history.

export const SEXTANTS = [
  ['s1', 'UR (17–14)'], ['s2', 'Anterior (13–23)'], ['s3', 'UL (24–27)'],
  ['s4', 'LL (34–37)'], ['s5', 'Anterior (43–33)'], ['s6', 'LR (47–44)'],
]

// BSP guidance flag: comprehensive perio exam indicated if any sextant scores 4,
// or 3 appears in two or more sextants.
export function bpeFlag(scores) {
  const vals = SEXTANTS.map(([k]) => scores?.[k]).filter(Boolean)
  const fours = vals.filter((v) => v === '4').length
  const threes = vals.filter((v) => v === '3').length
  return fours >= 1 || threes >= 2
}

export function BpeModal({ patientId, examiner, latest, onSaved, onClose }) {
  const [scores, setScores] = useState(() => ({ ...(latest?.scores || {}) }))
  const toast = useToast()

  const set = (k, v) => setScores((s) => ({ ...s, [k]: s[k] === v ? undefined : v }))
  const toggleStar = (k) => {
    const stars = new Set(scores.stars || [])
    stars.has(k) ? stars.delete(k) : stars.add(k)
    setScores((s) => ({ ...s, stars: [...stars] }))
  }

  const save = async () => {
    const { error } = await sb.from('dental_bpe_exams').insert({ patient_id: patientId, scores, examiner })
    if (error) return toast('Error: ' + error.message)
    toast(bpeFlag(scores) ? 'BPE saved — comprehensive perio exam indicated ⚠' : 'BPE saved')
    onSaved()
  }

  return (
    <Modal title="BPE — Basic Periodontal Examination" onClose={onClose}>
      <p className="small muted" style={{ marginBottom: 12 }}>Score each sextant 0–4 (X = no teeth, ★ = furcation involvement).</p>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {SEXTANTS.map(([k, label]) => (
          <div key={k} style={{ padding: '10px', background: 'var(--mint-bg)', borderRadius: 10, textAlign: 'center' }}>
            <div className="small muted" style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
            <div className="row" style={{ justifyContent: 'center', gap: 3, flexWrap: 'wrap' }}>
              {['0', '1', '2', '3', '4', 'X'].map((v) => (
                <button key={v}
                  className={`slot-chip ${scores[k] === v ? 'on' : ''}`}
                  style={{ width: 30, padding: '6px 0', ...(v === '4' && scores[k] === v ? { background: 'var(--red)', borderColor: 'var(--red)' } : {}) }}
                  onClick={() => set(k, v)}>{v}</button>
              ))}
              <button className={`slot-chip ${(scores.stars || []).includes(k) ? 'on' : ''}`} style={{ width: 30, padding: '6px 0' }}
                onClick={() => toggleStar(k)}>★</button>
            </div>
          </div>
        ))}
      </div>
      {bpeFlag(scores) && (
        <div className="badge b-red" style={{ marginTop: 14 }}>
          ⚠ Comprehensive perio exam indicated — 4 in a sextant, or 3 in two or more (BSP guidance)
        </div>
      )}
      <div className="actions">
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn" onClick={save}>Save BPE</button>
      </div>
    </Modal>
  )
}

const UPPER = ['18','17','16','15','14','13','12','11','21','22','23','24','25','26','27','28']
const LOWER = ['48','47','46','45','44','43','42','41','31','32','33','34','35','36','37','38']
const ROWS = [
  ['ppd', 'Pocket depth'], ['rec', 'Recession'], ['loa', 'Attachment loss'], ['plq', 'Plaque'],
]

function PerioGrid({ teeth, side, data, setData, readOnly }) {
  const key = (t, row) => `${side}_${row}`
  const cell = (t, row) => data[t]?.[key(t, row)] ?? ''
  const setCell = (t, row, v) =>
    setData((d) => ({ ...d, [t]: { ...(d[t] || {}), [key(t, row)]: v } }))

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ padding: '4px 8px', textAlign: 'left', fontSize: 10.5, color: 'var(--ink-40)' }}>{side === 'b' ? 'BUCCAL' : 'LINGUAL/PALATAL'}</th>
            {teeth.map((t) => <th key={t} style={{ padding: 4, fontWeight: 700, color: 'var(--ink-60)', fontSize: 11 }}>{t}</th>)}
          </tr>
        </thead>
        <tbody>
          {ROWS.map(([row, label]) => (
            <tr key={row}>
              <td style={{ padding: '3px 8px', whiteSpace: 'nowrap', fontWeight: 600, fontSize: 11.5, color: 'var(--ink-60)' }}>{label}</td>
              {teeth.map((t) => {
                if (row === 'loa') {
                  const ppd = Number(cell(t, 'ppd')), rec = Number(cell(t, 'rec'))
                  const loa = (cell(t, 'ppd') !== '' || cell(t, 'rec') !== '') ? ppd + rec : ''
                  return <td key={t} style={{ textAlign: 'center', padding: 2, fontWeight: 700, color: loa >= 5 ? 'var(--red)' : 'var(--ink-60)' }}>{loa}</td>
                }
                if (row === 'plq') {
                  const on = cell(t, 'plq') === 1
                  return (
                    <td key={t} style={{ textAlign: 'center', padding: 2 }}>
                      <button disabled={readOnly}
                        onClick={() => setCell(t, 'plq', on ? 0 : 1)}
                        style={{ width: 26, height: 22, borderRadius: 6, border: '1px solid var(--line)', cursor: readOnly ? 'default' : 'pointer', background: on ? 'var(--amber)' : '#fff' }} />
                    </td>
                  )
                }
                return (
                  <td key={t} style={{ padding: 2 }}>
                    <input value={cell(t, row)} disabled={readOnly} inputMode="numeric"
                      onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 2); setCell(t, row, v === '' ? '' : Number(v)) }}
                      style={{ width: 28, height: 24, textAlign: 'center', border: '1px solid var(--line)', borderRadius: 6, fontSize: 12,
                        background: row === 'ppd' && Number(cell(t, row)) >= 4 ? 'var(--red-soft)' : '#fff' }} />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function PerioModal({ patientId, examiner, onClose }) {
  const [exams, setExams] = useState([])
  const [viewing, setViewing] = useState(null) // exam row being viewed, or null = new
  const [data, setData] = useState({})
  const toast = useToast()

  const load = () =>
    sb.from('dental_perio_exams').select('*').eq('patient_id', patientId).order('created_at', { ascending: false })
      .then(({ data: rows }) => {
        setExams(rows || [])
        if (rows?.[0] && Object.keys(rows[0].data || {}).length && !viewing) setData(structuredClone(rows[0].data))
      })
  useEffect(() => { load() }, [patientId])

  const stats = (() => {
    let sites = 0, plq = 0, deep = 0
    for (const t of Object.keys(data)) {
      for (const side of ['b', 'l']) {
        const ppd = data[t]?.[`${side}_ppd`]
        if (ppd !== '' && ppd != null) { sites++; if (Number(ppd) >= 4) deep++ }
        if (data[t]?.[`${side}_plq`] === 1) plq++
      }
    }
    return { sites, plaquePct: sites ? Math.round((plq / sites) * 100) : 0, deep }
  })()

  const save = async () => {
    const { error } = await sb.from('dental_perio_exams').insert({ patient_id: patientId, data, examiner })
    if (error) return toast('Error: ' + error.message)
    toast('Perio chart saved')
    setViewing(null)
    load()
  }

  const readOnly = !!viewing

  return (
    <Modal title="Comprehensive periodontal exam" onClose={onClose} wide>
      <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <select className="input" style={{ width: 230 }} value={viewing?.id || ''}
          onChange={(e) => {
            const ex = exams.find((x) => x.id === e.target.value)
            if (ex) { setViewing(ex); setData(structuredClone(ex.data)) }
            else { setViewing(null); setData(exams[0] ? structuredClone(exams[0].data) : {}) }
          }}>
          <option value="">✏️ New exam{exams[0] ? ' (prefilled from last)' : ''}</option>
          {exams.map((ex) => <option key={ex.id} value={ex.id}>📜 {fmtDate(ex.created_at)} — {ex.examiner || 'unknown'}</option>)}
        </select>
        <span className="badge b-teal">{stats.sites} sites charted</span>
        <span className={`badge ${stats.deep ? 'b-red' : 'b-green'}`}>{stats.deep} pockets ≥4mm</span>
        <span className={`badge ${stats.plaquePct > 30 ? 'b-amber' : 'b-green'}`}>Plaque score {stats.plaquePct}%</span>
      </div>
      {readOnly && <div className="badge b-amber" style={{ marginBottom: 10 }}>📜 Viewing a past exam — read-only. Switch to "New exam" to chart.</div>}
      <div className="grid" style={{ gap: 14 }}>
        <PerioGrid teeth={UPPER} side="b" data={data} setData={setData} readOnly={readOnly} />
        <PerioGrid teeth={UPPER} side="l" data={data} setData={setData} readOnly={readOnly} />
        <div style={{ borderTop: '1px solid var(--line)' }} />
        <PerioGrid teeth={LOWER} side="b" data={data} setData={setData} readOnly={readOnly} />
        <PerioGrid teeth={LOWER} side="l" data={data} setData={setData} readOnly={readOnly} />
      </div>
      <p className="small muted" style={{ marginTop: 10 }}>
        Attachment loss = pocket depth + recession (calculated). Pockets ≥4mm highlight red. Plaque row: tap to toggle per tooth.
      </p>
      <div className="actions">
        <button className="btn secondary" onClick={onClose}>Close</button>
        {!readOnly && <button className="btn" onClick={save}>Save exam</button>}
      </div>
    </Modal>
  )
}
