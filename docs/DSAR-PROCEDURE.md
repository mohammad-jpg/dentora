# Data subject requests — how to handle them

Reviewed 2026-09-07. One month to respond (extendable by two for complex requests, with notice).

## A patient asks their practice (most cases)
The practice is the controller. Dentora's job is to make it easy:

| Request | What the practice does in Dentora |
|---|---|
| Access (Art. 15) | Patient record → print/copy the overview, chart, notes, plans, invoices, comms; or Settings → Export (owner/admin) and extract that patient's rows from the JSON |
| Rectification (Art. 16) | Edit details on the record. Clinical entries: add a correcting note / retire the entry with a reason (the original stays, as the law on clinical records expects) |
| Erasure (Art. 17) | Usually refused for clinical records (legal obligation to retain). Where erasure applies: patient record → **Anonymise** — identity and contact removed, comms and questionnaires deleted, clinical record kept pseudonymised |
| Restriction / objection | Archive the patient (no automations, hidden from lists) and untick marketing consent |
| Portability (Art. 20) | Export gives JSON; the patients CSV covers the structured personal data |

## A patient or staff member asks Dentora directly
1. Verify identity (reply to the email on the account, or via their practice).
2. If it concerns a dental record: tell them the practice is the controller, forward the request to the practice the same day, and offer the practice help (5 working days as per the DPA).
3. If it concerns a portal or staff account: export their account data from `dental_portal_profiles` / `dental_memberships` / auth user, or delete the account (Supabase Auth) and its links, within one month.
4. Log the request: date, who, what, outcome.

## Register
| Date | From | Type | Practice | Outcome / date |
|---|---|---|---|---|
| | | | | |
