# Dentora

Practice management for Irish dental practices: diary, patient records and charting, billing, recalls, lab work, referrals, tablet check-in, patient portal with online booking and video consultations, plus orthodontic and endodontic add-on modules.

Live: https://mohammad-jpg.github.io/dentora/ · Demo accounts: [docs/DEMO-ACCOUNTS.md](docs/DEMO-ACCOUNTS.md)

## Layout

| Path | What |
|---|---|
| `src/` | React 18 + Vite app (HashRouter, plain CSS). `pages/` are routes; `specialty/` is the ortho/endo add-ons; `clinic.jsx` is the signed-in clinic context. |
| `src/pages/Kiosk.jsx` | Waiting-room tablet page. Rendered outside the signed-in app; the tablet never holds a staff session. |
| `supabase/migrations/` | SQL applied to the production project, in order. The remote is the source of truth; these are the record. |
| `supabase/functions/` | Source of every deployed Edge Function (`signup-clinic`, `portal`, `invite-staff`, `manage-staff`, `recall-engine`, `checkin`). |
| `scripts/rls-test.mjs` | Negative tests run against the live project (`npm run test:rls`). |
| `bridge/` | Windows `dentora://` protocol helper for launching Romexis / CS Imaging with the current patient. |
| `docs/` | Audit report, security fix log, demo guide, GDPR checklist, ROPA, breach/retention/DSAR procedures. |
| `src/legal.js`, `docs/legal/` | Privacy notice, Terms, DPA, security summary, sub-processors (app page `/#/legal`; `node scripts/export-legal.mjs` regenerates the .md copies). |

## Backend

Supabase project `rqvmqvuijydrjjilqhhp` (Pro org). Tables are prefixed `dental_`; every table has row-level security keyed on `dental_my_clinics()` (staff) or `dental_my_patient_ids()` (portal patients). Owner/admin-only writes use `dental_is_admin(clinic_id)`.

Invariants enforced in the database rather than the client:

- **No double-booking.** `dental_appointments` has an exclusion constraint on (practitioner, time range) for non-cancelled rows, and every booking path calls `dental_book_appointment()`, which also validates clinic membership, active clinician, duration, and (for the portal) rota, hours, slot grid and lead time.
- **Clinical records are append-only.** Chart entries and clinical notes cannot be deleted or edited; they are retired with `deleted_at / deleted_by / deleted_reason` and the "as of" chart history honours that.
- **Patient-reported history never overwrites clinician alerts.** Questionnaires (tablet or portal) wait in `dental_questionnaires` with `reviewed_at IS NULL` until a clinician reconciles them.
- **Ledger.** Invoice status is derived from allocated payments by trigger. Write-offs must be allocated to an invoice and are excluded from collected revenue.
- **Recall engine.** The daily cron job presents a secret stored in `dental_secrets`; manual runs need an owner/admin session and are scoped to that clinic. Failed SMS sends are logged and never marked delivered.

## Working on it

```bash
npm install
npm run dev          # http://localhost:5199
npm run build
npm run test:rls     # negative tests against production (uses demo/test accounts)
```

Deploy: `npm run build`, then commit `dist/` to the `gh-pages` branch and push (see the deploy commits in history for the exact worktree flow).

Edge Functions are deployed with the Supabase MCP / CLI from `supabase/functions/<name>/index.ts`. Migrations are applied with `apply_migration` and the SQL is committed under `supabase/migrations/`.

## Not yet done

See the bottom of [docs/SECURITY-FIXES-2026-09-07.md](docs/SECURITY-FIXES-2026-09-07.md).
