import { useEffect, useState } from 'react'
import { sb } from '../supabase.js'
import { ToothMark, useToast } from '../ui.jsx'

// Waiting-room tablet. This page renders outside the staff app entirely: the tablet is
// never signed in. Reception generates a 6-digit code for one patient (Check-in page);
// the patient enters it here, fills in their medical history, and it goes to the record
// for clinician review. Codes are single-use and expire after 30 minutes.

export const MH_CONDITIONS = [
  'Heart condition', 'High blood pressure', 'Diabetes', 'Asthma / breathing', 'Epilepsy',
  'Bleeding disorder / blood thinners', 'Hepatitis / HIV', 'Osteoporosis medication', 'Pregnancy',
]
export const blankHistory = () => ({ conditions: [], other_condition: '', medications: '', allergies: '', smoker: '', gp: '', emergency_contact: '', consent: false, signature: '' })

export default function Kiosk() {
  const [code, setCode] = useState('')
  const [stage, setStage] = useState('code') // code | form | done
  const [who, setWho] = useState(null)
  const [f, setF] = useState(blankHistory())
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const call = async (body) => {
    const { data, error } = await sb.functions.invoke('checkin', { body })
    if (error || data?.error) {
      let msg = data?.error || 'Something went wrong — ask reception.'
      if (error?.context) { try { msg = (await error.context.json())?.error || msg } catch { /* keep */ } }
      throw new Error(msg)
    }
    return data
  }

  const start = async () => {
    setBusy(true)
    try {
      const d = await call({ action: 'load', code })
      setWho(d); setF(blankHistory()); setStage('form')
    } catch (e) { toast(e.message) }
    setBusy(false)
  }
  const submit = async () => {
    setBusy(true)
    try { await call({ action: 'submit', code, data: f }); setStage('done') } catch (e) { toast(e.message) }
    setBusy(false)
  }
  const reset = () => { setStage('code'); setCode(''); setWho(null); setF(blankHistory()) }
  useEffect(() => { if (stage === 'done') { const t = setTimeout(reset, 20000); return () => clearTimeout(t) } }, [stage])

  const toggleCond = (c) =>
    setF((x) => ({ ...x, conditions: x.conditions.includes(c) ? x.conditions.filter((v) => v !== c) : [...x.conditions, c] }))

  return (
    <div className="portal-shell">
      <div className="portal-top">
        <div className="row" style={{ gap: 10 }}>
          <div className="logo-mark" style={{ width: 32, height: 32, borderRadius: 9 }}><ToothMark size={17} /></div>
          <b style={{ fontSize: 16 }}>{who?.clinic_name || 'Dentora'} · Check-in</b>
        </div>
        {stage !== 'code' && <button className="btn ghost sm" onClick={reset}>Start over</button>}
      </div>

      {stage === 'code' && (
        <div className="portal-main" style={{ maxWidth: 420, margin: '60px auto', textAlign: 'center' }}>
          <div className="page-title">Welcome</div>
          <p className="small muted" style={{ marginTop: 6 }}>Enter the 6-digit code reception gave you.</p>
          <input className="input" inputMode="numeric" autoFocus maxLength={6} value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => { if (e.key === 'Enter' && code.length === 6) start() }}
            style={{ fontSize: 30, letterSpacing: '0.35em', textAlign: 'center', marginTop: 18, padding: '14px 12px', fontVariantNumeric: 'tabular-nums' }} />
          <button className="btn" style={{ width: '100%', justifyContent: 'center', marginTop: 14, padding: 14 }} disabled={code.length !== 6 || busy} onClick={start}>
            {busy ? 'Checking…' : 'Continue'}
          </button>
        </div>
      )}

      {stage === 'form' && (
        <div className="portal-main" style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div className="page-title">Hi {who.first_name}</div>
            <div className="page-sub">Please answer a few questions about your health — it keeps your treatment safe. Your dentist reviews these before your appointment.</div>
          </div>
          <div className="grid" style={{ gap: 14 }}>
            <div className="card card-pad">
              <div className="card-title">Do any of these apply to you?</div>
              <div className="grid" style={{ gap: 8, gridTemplateColumns: '1fr 1fr' }}>
                {MH_CONDITIONS.map((c) => (
                  <button key={c} className={`pick ${f.conditions.includes(c) ? 'on' : ''}`} onClick={() => toggleCond(c)}>
                    <b style={{ fontSize: 14 }}>{c}</b>
                  </button>
                ))}
              </div>
              <input className="input" style={{ marginTop: 10 }} placeholder="Anything else we should know?"
                value={f.other_condition} onChange={(e) => setF((x) => ({ ...x, other_condition: e.target.value }))} />
            </div>
            <div className="card card-pad grid" style={{ gap: 12 }}>
              <div><label className="field">Medications you take</label>
                <input className="input" value={f.medications} onChange={(e) => setF((x) => ({ ...x, medications: e.target.value }))} placeholder="e.g. warfarin, inhaler — or 'none'" /></div>
              <div><label className="field">Allergies</label>
                <input className="input" value={f.allergies} onChange={(e) => setF((x) => ({ ...x, allergies: e.target.value }))} placeholder="e.g. penicillin, latex — or 'none'" /></div>
              <div className="form-grid">
                <div>
                  <label className="field">Do you smoke?</label>
                  <div className="row">
                    {['No', 'Yes', 'Vape'].map((v) => (
                      <button key={v} className={`btn sm ${f.smoker === v ? '' : 'secondary'}`} onClick={() => setF((x) => ({ ...x, smoker: v }))}>{v}</button>
                    ))}
                  </div>
                </div>
                <div><label className="field">Your GP</label>
                  <input className="input" value={f.gp} onChange={(e) => setF((x) => ({ ...x, gp: e.target.value }))} /></div>
              </div>
              <div><label className="field">Emergency contact (name & number)</label>
                <input className="input" value={f.emergency_contact} onChange={(e) => setF((x) => ({ ...x, emergency_contact: e.target.value }))} /></div>
            </div>
            <div className="card card-pad grid" style={{ gap: 12 }}>
              <label className="row" style={{ cursor: 'pointer', alignItems: 'flex-start', gap: 10 }}>
                <input type="checkbox" checked={f.consent} onChange={(e) => setF((x) => ({ ...x, consent: e.target.checked }))} style={{ marginTop: 3 }} />
                <span className="small">I confirm the above is accurate and consent to {who.clinic_name} storing this information for my dental care.</span>
              </label>
              <div><label className="field">Type your full name to sign</label>
                <input className="input" value={f.signature} onChange={(e) => setF((x) => ({ ...x, signature: e.target.value }))} /></div>
              <button className="btn" style={{ padding: 14, justifyContent: 'center', fontSize: 15 }} disabled={!(f.consent && f.signature.trim()) || busy} onClick={submit}>
                {busy ? 'Saving…' : 'Submit & hand back'}
              </button>
            </div>
          </div>
        </div>
      )}

      {stage === 'done' && (
        <div className="portal-main" style={{ textAlign: 'center', paddingTop: 80 }}>
          <div className="page-title">All done, {who?.first_name}</div>
          <div className="page-sub">Please hand the tablet back to reception — you'll be called shortly.</div>
          <button className="btn secondary" style={{ marginTop: 26 }} onClick={reset}>Next patient</button>
        </div>
      )}
    </div>
  )
}
