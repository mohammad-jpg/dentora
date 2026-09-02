// Interactive dental chart. Adult = FDI notation; primary (baby) teeth = ABCDE per quadrant.
// Surfaces: M/D/B/L/O crown surfaces + R (root).
export const CONDITIONS = {
  caries: { label: 'Caries', color: '#D64550' },
  filling: { label: 'Filling', color: '#2F6FD6' },
  crown: { label: 'Crown', color: '#C98A12' },
  root_canal: { label: 'Root canal', color: '#7C5CBF' },
  missing: { label: 'Missing', color: '#8A9AA1' },
  implant: { label: 'Implant', color: '#0E7C7B' },
  extraction: { label: 'For extraction', color: '#B02A37' },
  watch: { label: 'Watch', color: '#E07A3F' },
}

const ADULT_UPPER = ['18','17','16','15','14','13','12','11','21','22','23','24','25','26','27','28']
const ADULT_LOWER = ['48','47','46','45','44','43','42','41','31','32','33','34','35','36','37','38']
// Primary dentition, ABCDE per quadrant (URE→URA | ULA→ULE etc.)
const PRIM_UPPER = ['URE','URD','URC','URB','URA','ULA','ULB','ULC','ULD','ULE']
const PRIM_LOWER = ['LRE','LRD','LRC','LRB','LRA','LLA','LLB','LLC','LLD','LLE']

const SURF_PATHS = {
  B: 'M4 4 L36 4 L28 12 L12 12 Z',
  L: 'M4 36 L36 36 L28 28 L12 28 Z',
  M: 'M4 4 L12 12 L12 28 L4 36 Z',
  D: 'M36 4 L28 12 L28 28 L36 36 Z',
  O: 'M12 12 L28 12 L28 28 L12 28 Z',
}

function Tooth({ num, entries, selected, onClick, small }) {
  const whole = entries.find((e) => !e.surface)
  const bySurface = {}
  for (const e of entries) if (e.surface) for (const s of e.surface.split('')) bySurface[s] = e

  const wholeCond = whole ? CONDITIONS[whole.condition] : null
  const isMissing = whole && whole.condition === 'missing'
  const planned = (e) => e && e.status === 'planned'
  const root = bySurface['R']
  const rootCond = root ? CONDITIONS[root.condition] : null

  return (
    <div className={`tooth-box ${selected ? 'sel' : ''}`} onClick={onClick} title={`Tooth ${num}`}
      style={small ? { width: 38 } : undefined}>
      <svg width={small ? 34 : 40} height={small ? 42 : 50} viewBox="0 0 40 50">
        <rect x="1.5" y="1.5" width="37" height="37" rx="8"
          fill={wholeCond && !isMissing ? wholeCond.color + (planned(whole) ? '55' : '33') : '#fff'}
          stroke={selected ? '#0E7C7B' : wholeCond ? wholeCond.color : '#D5E2E0'}
          strokeWidth={selected ? 2.5 : 1.5}
          strokeDasharray={planned(whole) ? '4 3' : 'none'} />
        {!isMissing && Object.entries(SURF_PATHS).map(([s, d]) => {
          const e = bySurface[s]
          const c = e ? CONDITIONS[e.condition] : null
          return (
            <path key={s} d={d}
              fill={c ? c.color : '#F1F6F5'}
              opacity={e && planned(e) ? 0.55 : 1}
              stroke="#D5E2E0" strokeWidth="0.7" />
          )
        })}
        {/* root */}
        <rect x="12" y="41" width="16" height="7" rx="3"
          fill={rootCond ? rootCond.color : '#EDF3F2'}
          opacity={root && planned(root) ? 0.55 : 1}
          stroke="#D5E2E0" strokeWidth="0.7" />
        {isMissing && (
          <g stroke="#8A9AA1" strokeWidth="2.5" strokeLinecap="round">
            <line x1="10" y1="10" x2="30" y2="30" />
            <line x1="30" y1="10" x2="10" y2="30" />
          </g>
        )}
        {whole && whole.condition === 'root_canal' && (
          <polygon points="20,6 16,16 24,16" fill="#7C5CBF" />
        )}
      </svg>
      <span className="tooth-num">{num}</span>
    </div>
  )
}

export default function Odontogram({ entries, selectedTooth, onSelect, dentition = 'adult' }) {
  const byTooth = {}
  for (const e of entries) (byTooth[e.tooth] ||= []).push(e)
  const primary = dentition === 'primary'
  const upper = primary ? PRIM_UPPER : ADULT_UPPER
  const lower = primary ? PRIM_LOWER : ADULT_LOWER
  const rowStored = (teeth) => (
    <div className="odo-row">
      {teeth.map((n) => (
        <Tooth key={n} num={primary ? `${n.slice(2)}·${n.slice(0, 2)}` : n}
          entries={byTooth[n] || []} selected={selectedTooth === n} onClick={() => onSelect(n)} small={primary} />
      ))}
    </div>
  )
  return (
    <div className="odo">
      {rowStored(upper)}
      <div style={{ height: 8 }} />
      {rowStored(lower)}
      <div className="odo-legend">
        {Object.entries(CONDITIONS).map(([k, c]) => (
          <span key={k} className="row"><span className="swatch" style={{ background: c.color }} />{c.label}</span>
        ))}
        <span className="row"><span className="swatch" style={{ border: '2px dashed #8A9AA1', background: '#fff' }} />Planned (dashed / faded)</span>
        <span className="row"><span className="swatch" style={{ background: '#EDF3F2' }} />Bar below crown = root surface (R)</span>
      </div>
    </div>
  )
}
