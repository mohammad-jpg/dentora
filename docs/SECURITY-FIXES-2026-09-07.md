# Security and integrity fixes — 7 September 2026

Follows the findings in [AUDIT-HANDOVER-2026-09-07.md](./AUDIT-HANDOVER-2026-09-07.md). Every finding
was re-verified against the live project before being changed; every fix below is verified by
`npm run test:rls` (29 checks against production, all passing at the time of writing) and by
`npm run build`. Browser click-through of the signed-in screens was not part of this pass.

## Critical

**Cross-tenant and portal-write leaks (RLS).** 18 patient-linked tables gave portal patients
INSERT/UPDATE/DELETE on their own clinical and financial rows; `dental_rota` and the
`dental-files` storage bucket were readable and writable across clinics by any authenticated user;
`Settings.jsx` could rename another clinic's rota rooms; `clinic.jsx` could pick a colleague's
membership. Fixed in migration `20260907_01_tenant_isolation.sql` plus code. Verified: portal
patient rota visibility 65 → 0, portal writes rejected, staff scoped to own clinic.

**Recall engine had no caller authorisation.** v5 requires either the scheduler secret
(`dental_secrets.recall_engine`, readable only by the database and the service role; the cron job
sends it as `x-recall-secret`) or an owner/admin session, in which case the run is scoped to that
clinic. Reminders are claimed atomically before sending (no double-texting under concurrent runs),
`sendSms` checks the HTTP response, and a failed send is logged as `[failed: …]` and never marked
delivered. Verified: anonymous → 401, non-admin staff → 403.

## High

**Booking could double-book and skip availability checks.** `dental_appointments` now has an
exclusion constraint (practitioner × time range, non-cancelled) and a duration check. All booking
paths — staff diary and portal — call `dental_book_appointment()`, which validates clinic
membership, active clinician, patient clinic, status, duration, and for the portal also rota day,
09:00–17:00, 30-minute grid and 30-minute lead time, then inserts inside the same transaction.
Verified: overlap → `slot_taken`; two concurrent bookings for one slot → exactly one succeeds; a
raw insert cannot bypass the constraint.

**Signup verification could be bypassed.** `signup-clinic` v3 and `portal` v4 require a session
whose verified email matches; the unverified `createUser` fallback is gone. Provisioning rolls back
a half-created clinic on failure. Verified: unverified signup → 401.

**Questionnaires overwrote clinician alerts.** Tablet and portal submissions are stored in
`dental_questionnaires` with `source` and wait for review. The patient record shows them in a
"Patient-reported medical history awaiting review" panel where a clinician either updates the
alerts (editing the merged text first) or marks them reviewed with no change. Check-in also lists
everything awaiting review.

**Tablet check-in exposed the staff session.** The tablet now opens the public `/#/kiosk` page
and is never signed in. Reception creates a single-use, 30-minute, 6-digit code for one patient
(`dental_checkin_sessions`); the `checkin` function exchanges it for the patient's first name and
stores the answers. Verified: unknown code → 404.

**Chart history was destructive.** Chart entries and clinical notes can no longer be deleted
(DELETE revoked) or edited (trigger). They are retired with `deleted_at / deleted_by /
deleted_reason`, shown struck-through with the reason, and the "as of" chart shows exactly what
stood on that date, including entries retired later. Entries now record an `author`. Verified:
delete → permission denied; edit → rejected; retire → allowed and still on the record.

**Write-offs inflated revenue.** Write-offs must be allocated to an invoice (check constraint) and
are written per open invoice for the remaining balance; invoice status is derived from allocated
payments by trigger, not set by the client. Reports excludes `write_off` from revenue collected and
shows it separately. Verified: part payment → `part_paid`; lump write-off → rejected; allocated
write-off → `paid`.

**Role enforcement.** Changing practice details, add-ons, fees, surgeries, rota, templates and
clinicians now requires owner/admin at the database level (`dental_is_admin`). Members keep read
access. `manage-staff` v2: only an owner can change, reset or remove another owner; a password reset
is refused for a login that also belongs to another clinic; owners can grant owner. `invite-staff`
v3 and `manage-staff` accept an explicit `clinic_id` for multi-clinic users. Verified: non-admin
update of clinic settings, fees and add-ons → 0 rows.

## Medium

- **Video rooms** use an unguessable `video_token` per appointment instead of the appointment id,
  are readable only through RLS, and the join button is enabled only from 15 minutes before the
  start to 2 hours after the end. A missing or inaccessible appointment shows a clear message.
- **Perio plaque score** now uses every assessed site (pocket depth entered or plaque ticked) as its
  denominator.
- **Imaging bridge** strips quotes, shell metacharacters and control characters from patient
  fields before building the command line, caps length, and validates the DOB format.
- **New-clinic defaults** are copied from immutable snapshot tables (`dental_default_fees`,
  `dental_default_templates`) rather than from the live "Dentora Dublin" demo clinic.
- **Multi-clinic** users get a clinic switcher in the sidebar; the context is always the signed-in
  user's own membership.
- **Trial lifecycle**: `dental_clinics.plan` and `trial_ends_at` (30 days from signup); the app
  shows a days-left banner and an ended-trial banner. Hard enforcement is deliberately not done —
  it needs billing.
- **Error handling** on the mutations touched in this pass (diary, billing, chart, settings) now
  surfaces failures instead of reporting success.
- **Backend is versioned**: `supabase/functions/*` and `supabase/migrations/*` are in the repo;
  `scripts/rls-test.mjs` is the regression suite. Security advisor: `anon` execute revoked on the
  helper functions.

## Still open

- Real SMS/WhatsApp delivery needs Twilio secrets on the recall engine; the sick-day, debt and
  bulk-message paths still write `[demo]` entries to the comms log rather than sending.
- Video admission is by unguessable token and join window; there is no provider-issued room
  token (Jitsi public instance). For hard guarantees move to a provider with admission control.
- Trial expiry is a banner, not a lock. Subscription billing, data export and claims submission
  (PRSI/DTSS) are not built.
- Leaked-password protection and `pg_net` schema placement are dashboard-only settings (Auth →
  Password security; Database → Extensions).
- No staging environment: migrations are applied to production. The SQL is committed so it can be
  replayed, but a second project would be the proper next step.
- Large tables are read without pagination; fine at current sizes.
- Legacy `generate-insights` function from the previous project is still deployed and unused.
