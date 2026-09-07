# Security summary

_Dentora · version 2026-09-07 · DRAFT for solicitor review · generated from src/legal.js_

One page for a practice principal or their IT adviser. Version 2026-09-07.

**Where the data is.** Ireland. Every record lives in a database in AWS's Dublin region, run by Supabase. Nothing about your patients is stored outside the EU.

**Who can see it.** Only the staff you add, with the roles you give them. Every practice's data is isolated from every other practice's at the database level, not just hidden in the interface — a rule the database itself enforces on every query. We test this automatically against the live system with a suite of negative checks (a patient trying to read another practice's rota, a receptionist trying to change fees, and so on).

**Clinical records can't be quietly changed.** Chart entries and clinical notes are append-only. A mistaken entry is retired with a reason and a name against it, and the "as of" history shows the chart exactly as it stood on any earlier date.

**Every opening of a patient record is logged** — who and when — and the practice owner can review the log.

**Encryption.** TLS on every connection; encryption at rest on the database, files and backups.

**Backups.** Daily, kept for 7 days, restore procedure tested.

**Logins.** Individual accounts with email-verified signup, salted password hashing, email-code password reset. Remove a leaver in Settings and their access ends immediately.

**The waiting-room tablet is never signed in.** Patients enter a single-use code; the tablet sees one patient's questionnaire and nothing else.

**Independent review.** A security audit of the code and live database was carried out on 7 September 2026. Its findings were fixed the same week and the fixes are verified by the automated test suite.

**Sub-processors** are listed at /#/legal/subprocessors. SMS (Twilio) and video (Jitsi/8x8) are the only ones that touch patient data outside our own database, and only when you use those features.

**Breach notification** to you within 48 hours of confirmation, with what you need for your own 72-hour DPC notification.

Questions: hello@dentora.ie · 070 657 7733
