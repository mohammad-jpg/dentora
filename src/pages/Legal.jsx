import { Link, useParams } from 'react-router-dom'
import { ToothMark } from '../ui.jsx'
import { DOCS, LEGAL_VERSION } from '../legal.js'

// Public legal pages: /#/legal/privacy | terms | dpa | security | subprocessors
const ORDER = ['privacy', 'terms', 'dpa', 'security', 'subprocessors']

// Tiny renderer for the markdown subset used in legal.js: headings, bold, tables, lists, paragraphs.
function render(md) {
  const lines = md.trim().split('\n')
  const out = []
  let i = 0
  const inline = (t) => t.split(/(\*\*[^*]+\*\*)/g).map((s, k) => s.startsWith('**') ? <b key={k}>{s.slice(2, -2)}</b> : s)
  while (i < lines.length) {
    const l = lines[i]
    if (l.startsWith('## ')) { out.push(<h2 key={i}>{l.slice(3)}</h2>); i++; continue }
    if (l.startsWith('### ')) { out.push(<h3 key={i}>{l.slice(4)}</h3>); i++; continue }
    if (l.startsWith('|')) {
      const rows = []
      while (i < lines.length && lines[i].startsWith('|')) { rows.push(lines[i]); i++ }
      const cells = (r) => r.split('|').slice(1, -1).map((c) => c.trim())
      const head = cells(rows[0]); const body = rows.slice(2).map(cells)
      out.push(<div key={i} className="tblwrap" style={{ overflowX: 'auto' }}><table className="tbl"><thead><tr>{head.map((h, k) => <th key={k}>{h}</th>)}</tr></thead><tbody>{body.map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>)}</tbody></table></div>)
      continue
    }
    if (l.startsWith('- ')) {
      const items = []
      while (i < lines.length && lines[i].startsWith('- ')) { items.push(lines[i].slice(2)); i++ }
      out.push(<ul key={i}>{items.map((it, k) => <li key={k}>{inline(it)}</li>)}</ul>)
      continue
    }
    if (l.trim() === '') { i++; continue }
    const para = []
    while (i < lines.length && lines[i].trim() !== '' && !/^(## |### |\||- )/.test(lines[i])) { para.push(lines[i]); i++ }
    out.push(<p key={i}>{inline(para.join(' '))}</p>)
  }
  return out
}

export default function Legal() {
  const { doc } = useParams()
  const key = DOCS[doc] ? doc : 'privacy'
  const d = DOCS[key]
  return (
    <div className="portal-shell">
      <div className="portal-top">
        <Link to="/" className="row" style={{ gap: 10, color: 'inherit' }}>
          <div className="logo-mark" style={{ width: 32, height: 32, borderRadius: 9 }}><ToothMark size={17} /></div>
          <b style={{ fontSize: 16 }}>Dentora</b>
        </Link>
        <span className="small muted">Version {LEGAL_VERSION}</span>
      </div>
      <div className="portal-main" style={{ maxWidth: 820, margin: '0 auto' }}>
        <div className="tabs" style={{ flexWrap: 'wrap' }}>
          {ORDER.map((k) => <Link key={k} to={`/legal/${k}`} className={key === k ? 'active' : ''} style={{ padding: '9px 13px', fontWeight: key === k ? 600 : 550, color: key === k ? 'var(--accent-strong)' : 'var(--ink-40)', borderBottom: `2px solid ${key === k ? 'var(--accent)' : 'transparent'}`, marginBottom: -1 }}>{DOCS[k].title}</Link>)}
        </div>
        <div className="card card-pad legal">
          <h1 style={{ fontSize: 22, margin: '0 0 6px' }}>{d.title}</h1>
          {render(d.body)}
        </div>
        <p className="small muted" style={{ marginTop: 14 }}>Printable copies of every document are available on request, and the current versions are also kept in the product's public repository.</p>
      </div>
    </div>
  )
}
