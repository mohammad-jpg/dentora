# Security fixes — 7 September 2026

Follows the findings in [AUDIT-HANDOVER-2026-09-07.md](./AUDIT-HANDOVER-2026-09-07.md). This covers the
first item of that report's recommended order ("restrict clinical/storage/rota policies; fix room
renaming and current-user clinic selection"). The remaining six items are not done and are listed
at the bottom.

## What was wrong, verified before fixing

- 18 patient-linked tables (chart entries, clinical notes, invoices, payments, questionnaires, referrals,
  recalls, lab cases, imaging refs, ortho/endo/implant/perio cases, routing slips, comms log, BPE/perio
  exams) used a `FOR ALL` policy keyed on `patient_id IN (SELECT id FROM dental_patients)`. Because that
  inner `SELECT` runs under RLS, and a portal patient can see their own row there, this silently gave
  portal accounts INSERT/UPDATE/DELETE — not just read — on their own clinical and financial records,
  via direct API calls that bypass the app UI and the `portal` edge function entirely.
- `dental_practitioners` had `USING (true)` on its portal-read policy, and `dental_rota`'s policy
  depended on practitioner visibility, so any authenticated user (staff at any clinic, or a patient
  portal account) could read and write every clinic's rota.
- [Settings.jsx](../src/pages/Settings.jsx) renamed a surgery's rota rooms with `.eq('room', s.name)`
  and no clinic filter, so renaming e.g. "Surgery 1" could rewrite another clinic's rota rows sharing
  that name. Confirmed as a live risk after seeding three new demo clinics that all default to
  "Surgery 1" / "Surgery 2".
- Storage bucket `dental-files` had the same `patient_id IN (SELECT id FROM dental_patients)` flaw,
  giving a portal patient direct read/write/delete on files in their own patient folder.
- [clinic.jsx](../src/clinic.jsx) selected the signed-in user's clinic with
  `dental_memberships.select(...).limit(1)` and no `user_id` filter. Because colleagues' membership
  rows at a shared clinic are also visible (for the Team card), this could non-deterministically pick
  a colleague's row instead of the signed-in user's own.

## What changed

- Migration `fix_patient_linked_tenant_isolation` (applied directly to project `rqvmqvuijydrjjilqhhp`,
  effective immediately, no deploy needed): rewrote the 18 tables' policies to
  `patient_id IN (SELECT id FROM dental_patients WHERE clinic_id IN (SELECT dental_my_clinics()))`,
  scoped `dental_rota` to `practitioner_id IN (... WHERE clinic_id IN (SELECT dental_my_clinics()))`,
  tightened `dental_practitioners.portal_read` to `active = true`, and applied the same clinic-scoped
  predicate to the `dental-files` storage policy.
- `dental_ortho_instalments` and `dental_ortho_visits` needed no direct change — their policies key off
  `dental_ortho_cases` visibility, which is now correctly scoped transitively.
- `clinic.jsx` now filters the membership query by `auth.uid()` explicitly.
- `Settings.jsx`'s `renameSurgery` now scopes the rota update to the clinic's own practitioner IDs, as
  a second layer on top of the RLS fix.

## Verification

Ran against the live database (not a staging copy) using the Harbour demo staff account and the Mary
portal patient account:

| Check | Before (per audit) | After |
|---|---|---|
| Rota rows visible to a portal patient | 65, across clinics | 0 |
| Rota rows visible to Harbour staff belonging to another clinic | — | 0 of 15 |
| Patients visible to Harbour staff | — | 12 (exactly their own) |
| Portal patient INSERT into own `dental_chart_entries` | allowed | blocked by RLS |
| Portal patient INSERT into own `dental_clinical_notes` | allowed | blocked by RLS |
| Portal patient INSERT a fabricated `dental_payments` row | allowed | blocked by RLS |
| Portal patient SELECT own appointments (legitimate portal use) | works | still works |
| Harbour staff read/write their own clinic's rota and patient chart | works | still works |

`npm run build` passes. This was API-level verification (signed-in Supabase client, real policies), not
a browser click-through of the deployed site.

## Not done yet (from the audit's remaining priority order)

1. Recall-engine caller authorisation, signup verification bypass removal, owner-account protection.
2. Atomic booking (clinic/availability/duration/concurrency checked in one transaction, all booking paths).
3. Non-destructive chart history, protected medical alerts, restricted tablet check-in sessions.
4. Financial ledger correction (write-offs are still counted as collected revenue in Reports.jsx).
5. Backend sources/schema versioned in the repo, staging environment, reproducible deploys.
6. Real message/room-admission/trial-billing/export delivery, vendor integration validation.
7. Broader role enforcement — most clinic-data policies still require membership only, not
   owner/admin authority, so an ordinary staff member can still change clinic settings or add-on
   toggles at the database level even though the UI hides those controls from them.

Do not treat this pass as a full remediation. It closes the specific cross-tenant and portal-write
leaks that were verified live; the items above are unchanged.
