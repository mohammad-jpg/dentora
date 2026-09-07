# Personal data breach procedure

Owner: Mohammad Syed · hello@dentora.ie · 070 657 7733. Reviewed 2026-09-07.

A breach is any accidental or unlawful destruction, loss, alteration, unauthorised disclosure of,
or access to, personal data — including a lost laptop with a session open, a wrong-recipient
email containing patient data, a mis-scoped database policy, or a compromised login.

## Clock
- **T+0** — become aware. Start the log below.
- **Within 48 hours** — notify every affected practice (they have 72 hours to notify the DPC).
- **Within 72 hours of *Dentora* being a controller of the affected data** (staff/portal accounts, enquiries) — notify the Data Protection Commission if the breach is likely to result in a risk to people: forms.dataprotection.ie.
- **Without undue delay** — notify affected individuals directly if the risk is high (health data disclosed, credentials exposed).

## Steps
1. **Contain.** Revoke the login (Settings → Team → Remove, or Supabase Auth → user → delete sessions), rotate any exposed key (Supabase → Settings → API), disable the affected function or policy. Do not delete evidence.
2. **Assess.** What data, whose, how many, how long exposed, is it still ongoing, was it encrypted. Query the access log and the Supabase logs (`query_logs`) for the window.
3. **Notify practices** by email and phone with: what happened, what data, likely consequences, what you have done, what they should do, and your contact. Give them what they need for their own DPC form.
4. **Notify the DPC** where Dentora is controller (see clock). Record the reference number.
5. **Fix and verify.** Apply the fix, add a check to `scripts/rls-test.mjs` if it is a policy or access issue, run the suite, redeploy.
6. **Record** in the register and write a short post-incident note in docs/.

## Register

| Date aware | What | Data / subjects | Practices notified (date) | DPC notified (date / ref) | Fixed (date, commit) |
|---|---|---|---|---|---|
| 2026-09-07 | Independent audit found RLS gaps that would have allowed portal patients to write to their own clinical/financial rows and any authenticated user to read/write cross-clinic rota. No evidence of exploitation; access to affected tables was reviewed. | Clinical and rota data, all clinics | Not a reportable breach: no unauthorised access identified. Practices to be informed in the next product update note. | n/a | 2026-09-07, 2796a6e / c627161 |
