import { useEffect, useState } from 'react'
import { sb, euro } from '../supabase.js'
import { useToast } from '../ui.jsx'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const ROOMS = ['Surgery 1', 'Surgery 2', 'Surgery 3']

function RotaCard({ pracs }) {
  const [rota, setRota] = useState([])
  const toast = useToast()
  const load = () => sb.from('dental_rota').select('*').then(({ data }) => setRota(data || []))
  useEffect(() => { load() }, [])

  const cell = (pracId, wd) => rota.find((r) => r.practitioner_id === pracId && r.weekday === wd)

  const cycle = async (pracId, wd) => {
    const cur = cell(pracId, wd)
    // click cycles: working Surgery1 -> Surgery2 -> Surgery3 -> off -> leave -> working Surgery1
    let next
    if (!cur || cur.status !== 'working') next = { status: 'working', room: ROOMS[0] }
    else {
      const idx = ROOMS.indexOf(cur.room)
      next = idx < ROOMS.length - 1 ? { status: 'working', room: ROOMS[idx + 1] } : { status: 'off', room: null }
    }
    if (cur?.status === 'off') next = { status: 'leave', room: null }
    if (cur) await sb.from('dental_rota').update(next).eq('id', cur.id)
    else await sb.from('dental_rota').insert({ practitioner_id: pracId, weekday: wd, ...next })
    load()
  }

  return (
    <div className="card card-pad">
      <div className="card-title">Rota — Dentora Dublin <span className="small muted" style={{ fontWeight: 400 }}>click a cell to change room / off / leave</span></div>
      <div className="rota-grid">
        <div />
        {DAYS.map((d) => <div key={d} className="small muted" style={{ textAlign: 'center', fontWeight: 700 }}>{d}</div>)}
        {pracs.map((p) => (
          [<div key={p.id} className="small" style={{ fontWeight: 600 }}>{p.name}</div>,
            ...DAYS.map((_, wd) => {
              const c = cell(p.id, wd)
              const cls = c?.status === 'working' ? 'rota-working' : c?.status === 'leave' ? 'rota-leave' : 'rota-off'
              return (
                <button key={p.id + wd} className={`rota-cell ${cls}`} style={{ border: 'none', cursor: 'pointer' }}
                  onClick={() => cycle(p.id, wd)}>
                  {c?.status === 'working' ? c.room : c?.status === 'leave' ? 'Leave' : 'Off'}
                </button>
              )
            })]
        ))}
      </div>
    </div>
  )
}

export default function Settings() {
  const [treatments, setTreatments] = useState([])
  const [pracs, setPracs] = useState([])
  const toast = useToast()

  const load = () => {
    sb.from('dental_treatments').select('*').order('category').order('name').then(({ data }) => setTreatments(data || []))
    sb.from('dental_practitioners').select('*').order('name').then(({ data }) => setPracs(data || []))
  }
  useEffect(() => { load() }, [])

  const updatePrice = async (t, price) => {
    if (Number(price) === Number(t.price)) return
    await sb.from('dental_treatments').update({ price: Number(price) }).eq('id', t.id)
    toast(`${t.name}: ${euro(price)}`)
    load()
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-sub">Practice profile, team & fee schedule</div>
        </div>
      </div>
      <div className="content grid" style={{ gap: 18 }}>
        <RotaCard pracs={pracs} />
        <div className="grid" style={{ gridTemplateColumns: '1fr 1.5fr', alignItems: 'start' }}>
        <div className="grid" style={{ gap: 16 }}>
          <div className="card card-pad">
            <div className="card-title">Practice</div>
            <div className="grid" style={{ gap: 10 }}>
              {[['Name', 'Dentora Dental (demo)'], ['Address', '12 Harcourt St, Dublin 2'], ['Phone', '01 555 0123'], ['Email', 'hello@dentora.ie'], ['Opening hours', 'Mon–Fri 08:00–18:00']].map(([k, v]) => (
                <div key={k} className="spread"><span className="muted small" style={{ fontWeight: 600 }}>{k}</span><span>{v}</span></div>
              ))}
            </div>
          </div>
          <div className="card card-pad">
            <div className="card-title">Team</div>
            <div className="grid" style={{ gap: 10 }}>
              {pracs.map((p) => (
                <div key={p.id} className="row" style={{ padding: '8px 10px', background: 'var(--mint-bg)', borderRadius: 10 }}>
                  <span className="swatch" style={{ background: p.color, borderRadius: 99 }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <div className="small muted">{p.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-pad card-title" style={{ marginBottom: 0 }}>Fee schedule — edit prices inline</div>
          <table className="tbl">
            <thead><tr><th>Code</th><th>Treatment</th><th>Category</th><th>Duration</th><th>Price (€)</th></tr></thead>
            <tbody>
              {treatments.map((t) => (
                <tr key={t.id}>
                  <td className="mono muted">{t.code}</td>
                  <td style={{ fontWeight: 500 }}>{t.name}</td>
                  <td><span className="badge b-gray">{t.category}</span></td>
                  <td className="muted">{t.duration_min} min</td>
                  <td style={{ width: 110 }}>
                    <input type="number" className="input" defaultValue={Number(t.price)} min="0" step="5"
                      onBlur={(e) => updatePrice(t, e.target.value)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      </div>
    </>
  )
}
