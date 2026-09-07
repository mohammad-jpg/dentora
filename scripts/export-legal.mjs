// Writes docs/legal/*.md from src/legal.js so the repo always carries the same text the app shows.
// Run: node scripts/export-legal.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { DOCS, LEGAL_VERSION } from '../src/legal.js'

mkdirSync('docs/legal', { recursive: true })
for (const [key, d] of Object.entries(DOCS)) {
  const md = `# ${d.title}\n\n_Dentora · version ${LEGAL_VERSION} · DRAFT for solicitor review · generated from src/legal.js_\n${d.body}`
  writeFileSync(`docs/legal/${key.toUpperCase()}.md`, md)
  console.log('wrote docs/legal/' + key.toUpperCase() + '.md')
}
