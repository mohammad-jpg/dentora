# Dentora — Practice OS

Self-built dental practice management software (Aerona-style) for Mohammad's dental network.
Built 2026-09-01 by Claude Code.

## Run

```bash
npm install
npm run dev   # http://localhost:5199
```

## Stack

- Vite + React 18 (plain JSX, custom CSS design system in `src/app.css`)
- Supabase backend: project `grappling-tracker` (rqvmqvuijydrjjilqhhp, eu-west-1),
  tables prefixed `dental_` to isolate from grappling-tracker's own tables.
  Client config in `src/supabase.js` (publishable key — safe for frontend).

## Login (v2)

App requires staff sign-in (Supabase Auth). Demo account: `staff@dentora.ie` / `Dentora2026!`
RLS on all `dental_` tables + the `dental-files` storage bucket is authenticated-only
(`staff_all` policies) — anon key alone can no longer read patient data.

## Modules

Dashboard · Diary (per-clinician day grid + today's surgery from rota, click-to-book/edit) ·
Patients (PRSI / medical-card scheme flags) ·
Patient record (overview, FDI odontogram charting, treatment plans, billing, imaging
file attachments via Supabase Storage, comms) ·
Billing · Recalls (simulated SMS) · Referrals (specialist register + auto-generated letters) ·
Tasks · Reports · Settings (Truly Dental-based fee schedule + weekly rota editor).

## Before real patient data (GDPR)

Remaining: per-staff accounts (not shared login), access log, Supabase Pro (daily backups),
sign Supabase DPA, move to a dedicated Supabase project.

## v2 feedback source (Ahmed, 2026-09-01)

Shipped: rota/rooms/leave, referrals + register + letters, secure login, imaging attachments,
Truly Dental price list, PRSI/medical card flags. Not code: pitch HSE dental clinics as a
contract; live Dental Council register sync + PRSI/DTSS claiming are roadmap.

## Moving the project

Folder is self-contained — `mv ~/Desktop/bjj/dentora ~/Desktop/dentora` works fine
(also update `.claude/launch.json` in whatever folder you run Claude from).
