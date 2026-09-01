import { createClient } from '@supabase/supabase-js'

const url = 'https://rqvmqvuijydrjjilqhhp.supabase.co'
const key = 'sb_publishable__tfNXm80IGxRjG0VjfhTeQ_95At18rL'

export const sb = createClient(url, key)

export const euro = (n) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0)

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IE') : '—')

export const fmtTime = (d) =>
  new Date(d).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit', hour12: false })

export const fullName = (p) => (p ? `${p.first_name} ${p.last_name}` : 'Unknown')

export const age = (dob) => {
  if (!dob) return null
  const diff = Date.now() - new Date(dob).getTime()
  return Math.floor(diff / 31557600000)
}
