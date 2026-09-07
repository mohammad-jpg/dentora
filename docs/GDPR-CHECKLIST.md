# GDPR — where Dentora stands and what is still yours to do

Dated 2026-09-07. Dentora is a **processor** for practice and patient data; each practice is the
**controller**. For staff accounts, portal accounts, enquiries and the website, Dentora is the
controller. Data is hosted in AWS eu-west-1 (Dublin) — confirmed on the Supabase project.

I am not a solicitor. The documents under docs/legal are drafted to match exactly how the system
works, but they must be reviewed by a solicitor before the first paying practice signs.

## Done (technical and organisational controls)

| Requirement | Control | Where |
|---|---|---|
| Art. 28 — processor contract | DPA accepted at clinic signup; who/when/version recorded on the clinic | `dental_clinics.dpa_accepted_at`, `/#/legal/dpa` |
| Art. 13/14 — transparency | Privacy notice; linked from site footer, both sign-in screens, portal signup, Help | `/#/legal/privacy` |
| Art. 6/7/9 — lawful basis, consent | Marketing SMS only to opted-in patients (flag + timestamp); reminders/recalls as service messages; health data on practice instruction only | Patient modal, Bulk SMS |
| Art. 15/20 — access, portability | Full JSON + CSV export of the practice's data (owner/admin); exports logged | Settings → Export |
| Art. 16 — rectification | Patient details editable; clinical corrections by attributed retire/addendum (record integrity) | Patient record |
| Art. 17 — erasure | Anonymise patient: identity removed, clinical record kept pseudonymised for statutory retention; comms, questionnaires, portal link deleted | Patient record → Anonymise (owner/admin) |
| Art. 25 — privacy by design | Tenant isolation by RLS with automated negative tests; role-based writes; append-only clinical records; quarantined patient-reported history; kiosk tablet never signed in | Migrations, `npm run test:rls` |
| Art. 30 — records of processing | ROPA for Dentora as processor and as controller | docs/ROPA.md |
| Art. 32 — security | EU hosting, TLS, encryption at rest, RLS, roles, access log (2 yrs), unguessable video rooms, no third-party fonts/scripts, backups | docs/legal/SECURITY.md |
| Art. 33/34 — breach | Procedure with 48-hour notification to the practice | docs/BREACH-PROCEDURE.md |
| Art. 28(2) — sub-processors | Published list with purpose, data, location, safeguards; 30-day change notice | `/#/legal/subprocessors` |
| Art. 44+ — transfers | EU hosting; US sub-processors (Twilio, 8x8, GitHub, Supabase support) under SCCs; Google Fonts removed | Sub-processor list |
| Storage limitation | Retention policy; automated purge of kiosk codes (7 d), access log (2 y), message log (3 y) | docs/RETENTION.md, cron `dentora-retention-daily` |
| Accountability | Access log per record view/export/anonymise, reviewable by owner/admin | Settings → Access log |
| Cookies / ePrivacy | No analytics or advertising cookies; session in local storage only (strictly necessary); no banner required | Privacy notice |

## Yours to do (cannot be done from the code)

1. **Solicitor review** of DPA, Terms, Privacy notice (an Irish data-protection solicitor; half a day). Fill in the legal entity, address and CRO number in `src/legal.js` (`ENTITY`, `ENTITY_ADDRESS`), then `node scripts/export-legal.mjs`.
2. **Sign your own processor agreements**: Supabase DPA (Dashboard → Organisation → Legal documents), Twilio DPA (when you enable SMS), and read 8x8/Jitsi terms — or replace public Jitsi with an EU-hosted video provider before any practice relies on video for clinical consultations.
3. **Supabase dashboard settings I can't reach**: Auth → enable leaked-password protection; confirm Point-in-Time Recovery or daily backups are on for the Pro plan and note the retention; do one restore drill and date it in docs/RETENTION.md.
4. **Decide on a DPO.** Processing health data at scale as a core activity can trigger the Article 37 DPO requirement. At the current size you are almost certainly below "large scale", but get the solicitor to confirm and record the decision.
5. **Domain and hosting**: move the app from github.io to app.dentora.ie. GitHub serves only static files (no patient data) but the professional domain matters to practices and removes a US-based visitor-log sub-processor from the critical path.
6. **MFA for staff logins**: Supabase supports TOTP; adding it is a product task (a day). Recommended before practices with more than a handful of staff.
7. **Practice-side guidance**: each practice remains responsible for its lawful basis, patient consent for marketing, staff confidentiality, and Dental Council retention periods. The Terms say so; say it in onboarding too.
8. **Breach register and staff training**: keep docs/BREACH-PROCEDURE.md's register up to date; brief anyone who supports customers.
9. **Cyber / professional indemnity insurance** once revenue starts.

## Version and change log

- 2026-09-07 — first full set: legal texts v2026-09-07, consent gates, export, anonymise, access log, retention cron, fonts self-hosted, sub-processor list.
