# Dentora audit and development handover

Audited 7 September 2026. Local HEAD: `ba4538d`. Scope: repository, deployed Supabase policy definitions, grants, selected constraints, four deployed Edge Function sources, function inventory, cron configuration, and production compilation. No production data, policies, functions or deployment changed. Build regenerated local ignored `dist/`; that directory already had uncommitted deployment changes before the build. This document is the only source-tree addition.

## Overall assessment

Dentora is a substantial interactive prototype with persistent workflows. It is not yet a production-ready clinical system. Earlier conversation claims of complete feature parity, secure isolation, immutable history, and full end-to-end verification were too strong. Existing screens are a useful foundation; the next work should establish correct permissions and data integrity before expanding features.

## Architecture and current state

- React 18, React Router 6 HashRouter, Vite 5, plain JavaScript/JSX, custom CSS; Supabase JS client.
- `src/main.jsx` boots the app. `src/auth.jsx` handles session, login, email-code signup and password recovery; logged-out visitors see `Marketing.jsx`.
- `src/App.jsx` chooses staff versus patient surface using membership visibility. `clinic.jsx` picks the first visible membership for clinic context. It does not filter that membership query by the current user, even though policies expose colleagues' memberships. This can give the UI a colleague's role. There is no explicit active-clinic selector.
- Staff CRUD mostly goes directly from browser to Supabase REST. Correct RLS is therefore essential; hidden buttons are not authorisation.
- Backend project: `rqvmqvuijydrjjilqhhp`, originally named grappling-tracker. Supabase tools are accessible in Codex. Do not delete this project: it hosts Dentora.
- Six deployed functions: signup-clinic v2, invite-staff v2, manage-staff v1, portal v3, recall-engine v4, and legacy generate-insights v3. The legacy function survived removal of grappling tables.
- Active cron: dentora-recalls-daily, `0 8 * * *`.
- Git remote: `git@github.com:mohammad-jpg/dentora.git`. Deployment historically uses a separate Git repository inside `dist/` pushed to gh-pages. No checked-in CI deployment workflow found.
- Public URL from configuration/history: https://mohammad-jpg.github.io/dentora/. This audit's shell could not resolve that hostname, so current public deployment was not independently verified.
- Only 42 tracked files; no checked-in Supabase migration history, Edge Function sources, automated tests, lint setup, or CI configuration found. Remote backend is not reproducible from this checkout.
- README describes v2 and is materially stale. Recent history includes v15 authentication/import, v16 neutral visual design, v17 specialty packages, v19 specialty queues, and demo account documentation.

## Feature map

| Area | Implementation | Limits observed |
| --- | --- | --- |
| Marketing | Feature/pricing pages, trial CTA, demo requests | No subscription checkout or enforced trial lifecycle found |
| Clinic setup | Signup, team management, surgeries, rota, templates, CSV patient import, onboarding | First-membership selection; incomplete backend role controls; partial-failure handling |
| Diary | Day grid, clinician columns, booking/editing/cancellation, sick-day action | No atomic clash protection, room capacity enforcement or shared scheduling engine |
| Patients | Search, archive, schemes, demographics, notes, chart, treatment plans | Scheme flags are not eligibility checks or claims submission |
| Clinical | Adult/primary odontogram, BPE, simplified perio exams, note templates, browser dictation | Chart history is timestamp filtering; perio stores only two sites per tooth; examiner is selectable text |
| Specialty | Ortho cases/visits/instalments; endo cases/canals/reports; queue screens | Add-ons are clinic toggles, not paid entitlements; implant/perio case tables exist remotely without matching top-level pages |
| Billing | Invoice records, payment records, debtor reminders and write-offs | No actual card processing; write-off accounting defect; multi-step writes are not atomic |
| Patient portal | Account, clinic/dentist selection, slots, booking/cancellation, medical-history submission | Booking validation and patient permissions need urgent correction |
| Video | Jitsi iframe and appointment-derived room name | No server-issued participant credentials; join available even if appointment lookup fails |
| Imaging | Storage, preview, external-study register, Windows protocol helper | Vendor/hardware integration unverified; not a DICOM PACS or validated diagnostic viewer |
| Operations | Lab cases, handover, check-in, recalls, tasks, reports | Check-in runs inside a full staff session; many communication actions only log demo text |

## Priority findings

### Critical: patient access expands into clinical writes

Live `dental_patients` SELECT policy permits a portal patient to see their linked patient row. Numerous child tables use `FOR ALL` with `patient_id IN (SELECT id FROM dental_patients)` as both USING and WITH CHECK. That includes chart entries, clinical notes, payments, invoices, questionnaires, perio/BPE, treatment plans, recalls, referrals and specialty records. Storage uses the same visible-patient predicate.

Because authenticated users also have INSERT/UPDATE/DELETE grants, this authorises portal users to modify records tied to their own patient ID, not merely submit a questionnaire through the intended function. No malicious writes were executed. Verified using deployed policy/grant definitions. Correct the staff policy to require actual membership of the patient's clinic; add deliberately limited patient read policies separately.

### Critical: cross-clinic rota access, including an ordinary UI mutation path

`dental_practitioners.portal_read` allows every authenticated user to SELECT all practitioners. `dental_rota.tenant_all` then authorises ALL operations whenever the practitioner is visible. A read-only transaction acting as a linked portal user showed **0 memberships, 1 patient and 65 rota rows**. Write grants and the identical ALL policy make changes authorised too; writes were not tested.

`Settings.jsx:49` renames rota rooms using only `.eq('room', s.name)`. With the current policy, renaming “Surgery 1” in one clinic can rename matching rota rooms across clinics. Fix RLS and explicitly scope this operation to the clinic's practitioners; move toward surgery IDs instead of free-text room names.

### Critical: recall engine has no caller authorisation

Deployed recall-engine v4 creates a service-role client and processes all clinics without validating the caller or a scheduler secret. `verify_jwt: true` is not a clinic/admin check; legacy public anon JWT access is used in the existing workflow. Do not invoke this function as a read-only test: it changes state and could send messages if secrets are configured.

Separate scheduler authority from per-clinic manual runs. Add atomic delivery jobs, permissions, retry handling and real delivery status. `sendSms()` currently ignores HTTP error responses and still marks reminders as processed. Concurrent runs can pass the same date check and duplicate work.

### High: booking accepts invalid availability and can double-book

Portal v3 computes slots using a weekly rota, fixed weekdays and 09:00–17:00 half-hour appointments. Its separate `book` action does not re-check working rota, office hours, active practitioner, clinic/practitioner association, offered slot grid or the 30-minute lead time. It checks overlap then inserts in separate requests. Staff diary writes directly without the same checks.

Inspected appointment constraints contain PK/FKs only: no overlap exclusion, positive-duration check or composite clinic association constraint. Concurrent bookings can both pass the overlap query. Put invariant checks and booking into one database transaction shared by every booking path.

### High: signup verification can be bypassed

Both signup-clinic v2 and portal v3 support the new verified-email session path, but retain fallback `admin.createUser({email_confirm: true})` when no matching verified session is supplied. The UI verification step is therefore not mandatory on the backend. Remove the fallback and make provisioning resumable/atomic; several insert errors are ignored and can leave partial accounts.

### High: questionnaire overwrites clinician alerts

`CheckIn.jsx:41` and portal `medical_history` replace `dental_patients.medical_alerts` with the submitted answer summary. Leaving a known allergy unchecked can erase the existing alert. The portal applies answers to every linked clinic. Store patient-submitted history separately, retain provenance and require clinical reconciliation before replacing verified alerts.

### High: tablet check-in exposes the staff application

Check-in is a route inside the ordinary staff shell. Handing that session to a waiting-room patient exposes navigation and staff credentials/session privileges. A restricted, expiring, patient-specific check-in session is needed; hiding the sidebar alone would not fix access.

### High: historical chart is not an immutable record

`PatientDetail.jsx:171` permanently deletes chart entries. Historical views filter remaining rows by creation date (`:175–176`). Deleting an entry removes it from every historical view. Use versioned/amended records with author identity, time and reason rather than destructive deletion. Similar database permissions allow clinical-note deletion even where the UI doesn't expose it.

### High: write-offs inflate revenue and leave invoice balances inconsistent

`Billing.jsx:140` inserts a positive payment with method `write_off`, without invoice allocation, then marks open invoices paid. `Reports.jsx` sums every payment as collected revenue. Invoice-level paid totals sum by invoice_id, so the unallocated write-off does not settle those calculations consistently. Use explicit ledger adjustments, allocate them to invoices, and exclude write-offs from cash collections.

### High: role enforcement and multi-account management

Most clinic data policies require membership only, not owner/admin authority. Ordinary staff can bypass UI restrictions to change clinic settings and add-on flags. `clinic.jsx` can choose a colleague's role. manage-staff checks its caller more carefully but permits an admin to reset an owner's password and selects only the caller's first clinic. Define explicit permissions and owner protections; verify multi-clinic and patient/staff combined identities.

### Medium: video privacy is overclaimed

`VideoCall.jsx` constructs a public-provider room from the route appointment ID and renders join controls even when no authorised appointment was loaded. Knowing the room name is enough to navigate to the external room; there is no Dentora-issued room admission token. Implement appointment authorisation, permitted join windows and a provider admission model; two-party camera/audio operation was not tested in this audit.

### Medium: clinical scope and reporting need validation

PerioChart stores one buccal and one lingual/palatal depth/recession value per tooth, not six sites. Plaque percentage uses the count of entered pocket depths as its denominator, which can misrepresent independently ticked plaque sites. Do not market this as a validated comprehensive periodontal workflow. BPE escalation logic and clinical defaults require clinician review against the applicable guidance; this audit did not validate medical guidance.

### Medium: incomplete delivery and commercial features

Sick-day, debt and bulk-message paths insert `[demo]` communications; adding Twilio secrets to the recall engine does not make these separate paths send. Payment entry records money received elsewhere. Specialty toggles do not collect subscription fees. A advertised 30-day trial has no lifecycle enforcement found. Full-export and complete vendor parity claims are not substantiated by this audit.

### Medium: maintainability and integration risks

- Many mutations ignore errors, report success and reload; multi-step workflows can partially succeed.
- Large PatientDetail and Settings components mix UI, persistence and business rules.
- Browser-local time in staff diary differs from explicit Dublin handling in the portal; clinic opening-hours text is not a scheduling rule.
- Imaging helper interpolates patient fields into command-line argument strings; validate/escape these and test with real vendor versions. Default vendor arguments are unverified.
- New-clinic provisioning copies templates from mutable demo clinic name `Dentora Dublin`; a demo user can influence future defaults.
- Full-table reads lack pagination and no automated regression suite is present.

## Verification performed and limits

- `npm run build`: passed, 106 modules; JS bundle ~632 kB (~171 kB gzip), chunk-size warning.
- Local source worktree clean before audit. Existing `dist/` deployment repository already dirty before build. No push/deploy performed.
- Live RLS, grants and appointment/payment/invoice constraints inspected; no write exploit executed.
- Read-only portal-role transaction confirmed rota visibility; rolled back.
- Read deployed portal, recall-engine, signup-clinic and manage-staff source. invite-staff listed but not re-audited in full this pass.
- Supabase security advisors: pg_net in public; public/authenticated execution of SECURITY DEFINER helper functions; leaked-password protection disabled. Helpers themselves filter by auth.uid(); advisor warnings alone do not establish data leakage. The more serious policy-composition defects above were found manually.
- No automated tests exist to run. No browser-wide regression, real hardware, payment processor, SMS delivery, email delivery, video audio, restore drill or load test was performed.
- Could not independently fetch the public GitHub Pages site because of shell DNS restrictions. Supabase management connection worked.

## Recommended next implementation order

1. Restrict clinical/storage/rota policies; fix room renaming and current-user clinic selection. Add role-based negative tests with synthetic fixtures.
2. Restrict recall-engine invocation; remove signup verification bypass; protect owner account management.
3. Centralise booking in an atomic operation with clinic, availability, duration and concurrency validation.
4. Preserve medical alerts and chart history; implement restricted tablet sessions and reliable audit records.
5. Correct financial ledger and reporting; add repeatable tests for partial payments/write-offs.
6. Version backend sources and schema, add staging and a reproducible deployment workflow; establish restore testing.
7. Finish actual messaging, room admission, trial/billing/export workflows and vendor integration validation.

The existing product can continue as a synthetic-data demonstration while this work proceeds. Do not interpret this audit as approval for real patient use. We can continue from the current codebase; there is no need to rebuild it from scratch.
