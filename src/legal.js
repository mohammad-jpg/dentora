// Canonical legal texts shown at /#/legal and exported to docs/legal/*.md by scripts/export-legal.mjs.
// DRAFTS: written to reflect exactly how the system works, but they have not been reviewed by a
// solicitor. Get them reviewed before the first paying practice signs. Bracketed items need filling in.
import { SUPPORT_EMAIL, SUPPORT_PHONE } from './support.js'

export const LEGAL_VERSION = '2026-09-07'
export const ENTITY = '[Dentora legal entity — e.g. "Mohammad Syed trading as Dentora" or the company name and CRO number]'
export const ENTITY_ADDRESS = '[Registered address], Dublin, Ireland'
export const DP_CONTACT = `${SUPPORT_EMAIL} (data protection contact: Mohammad Syed)`

export const SUBPROCESSORS = [
  { name: 'Supabase, Inc.', purpose: 'Database, authentication, file storage and serverless functions for the Dentora application', data: 'All practice and patient data held in Dentora', location: 'AWS eu-west-1 (Dublin, Ireland). Supabase is a US company; data is hosted in the EU.', basis: 'Supabase Data Processing Addendum; EU Standard Contractual Clauses for any support access from outside the EU' },
  { name: 'Amazon Web Services EMEA SARL', purpose: 'Underlying cloud infrastructure used by Supabase', data: 'As above (encrypted at rest and in transit)', location: 'eu-west-1 (Dublin, Ireland)', basis: 'AWS GDPR Data Processing Addendum (via Supabase)' },
  { name: 'GitHub, Inc. (GitHub Pages)', purpose: 'Serving the application files (HTML, JavaScript, CSS, fonts) to browsers', data: 'No practice or patient data. Standard web server logs (IP address, browser, time) for requests to the application files.', location: 'Global CDN; GitHub is a US company', basis: 'GitHub Data Protection Agreement; EU Standard Contractual Clauses' },
  { name: 'Twilio Ireland Ltd / Twilio Inc.', purpose: 'Sending SMS appointment reminders, recalls and messages (only once a practice enables SMS)', data: 'Patient mobile number, patient first name, message text', location: 'EU processing where available; Twilio Inc. is a US company', basis: 'Twilio Data Protection Addendum; EU Standard Contractual Clauses' },
  { name: '8x8, Inc. (Jitsi Meet, meet.jit.si)', purpose: 'Video consultation rooms (only when a video appointment is joined)', data: 'Room identifier (random token), participant display name, audio/video in transit. No recordings.', location: 'US company; media servers may be outside the EU', basis: 'Public service terms; EU Standard Contractual Clauses. Practices needing EU-only video should ask about the hosted alternative.' },
]

export const DOCS = {
  privacy: {
    title: 'Privacy notice',
    body: `
## Who we are
${ENTITY}, ${ENTITY_ADDRESS}. Contact: ${DP_CONTACT}, ${SUPPORT_PHONE}.

Dentora is practice management software used by dental practices. This notice explains what personal data we handle, in which role, and what your rights are. Version ${LEGAL_VERSION}.

## Two roles
**For patient and practice records inside Dentora, the dental practice is the data controller and Dentora is a data processor.** The practice decides what is recorded about you and why; we store and process it on the practice's instructions under a written Data Processing Agreement. If you are a patient and want to exercise your rights over your dental record, contact your practice. We help them respond.

**For the following, Dentora is the data controller:**
- Practice staff accounts (name, email, role, login activity)
- Patient portal accounts (name, email, phone, login activity) — the account itself, not your dental record
- Enquiries, demo requests and support requests sent to us
- Visits to the Dentora website

## What we collect and why
| Data | Purpose | Legal basis |
|---|---|---|
| Staff account: name, email, password (hashed), role, clinic | Providing the service to the practice | Contract (with the practice) |
| Portal account: name, email, phone, password (hashed) | Letting you book, cancel and join video consultations | Contract (with you) |
| Access log: which staff member opened which record, when | Security and accountability required of a health data processor | Legal obligation / legitimate interest |
| Support and demo requests: name, email, phone, message | Answering you | Legitimate interest / pre-contract |
| Web server logs (IP address, browser, time) when loading the app | Running and securing the service | Legitimate interest |

We do not use advertising or analytics cookies. The application stores your login session in your browser's local storage, which is strictly necessary to keep you signed in.

## Special category data
Dental records include health data. It is processed only on the practice's instructions, only by the practice's authorised staff, and is isolated per practice at the database level. Dentora staff do not access practice data except to provide support at the practice's request, or where required by law, and every such access is logged.

## Where data is stored
All Dentora data is stored in the European Union (AWS eu-west-1, Dublin, Ireland) via Supabase. Some sub-processors are US companies; transfers are covered by EU Standard Contractual Clauses. The current list is published at /#/legal/subprocessors.

## How long we keep it
- Practice and patient records: for as long as the practice's contract runs, then returned or deleted within 30 days of termination unless the practice instructs otherwise. Practices are responsible for their own clinical retention periods (in Ireland typically 8 years after the last treatment, longer for children).
- Access log: 2 years.
- SMS and message log: 3 years.
- Portal account: until you close it, or 3 years after your last activity.
- Support and demo requests: 2 years.
- Backups: rolling, deleted on the same schedule as the backup rotation (currently 7 days).

## Your rights
You can ask for access to your data, correction, erasure, restriction, portability, and to object to processing based on legitimate interest. For your dental record, ask your practice; we will help them. For accounts and enquiries, email ${SUPPORT_EMAIL}. We respond within one month. You can complain to the Data Protection Commission (dataprotection.ie), Ireland.

## Automated decisions
None.

## Changes
We will notify practices by email of material changes and update the version date above.
`,
  },
  terms: {
    title: 'Terms of service',
    body: `
Version ${LEGAL_VERSION}. These terms are between ${ENTITY} ("Dentora", "we") and the dental practice that creates an account ("the Practice", "you"). By creating a clinic account you accept these terms and the Data Processing Agreement on behalf of the Practice, and you confirm you are authorised to do so.

## 1. The service
Dentora provides practice management software as a hosted service: diary, patient records, charting, billing, recalls, communications, a patient booking portal, video consultations and optional specialty modules, as described at dentora.ie. We may improve or change features; we will not remove a core function without 60 days' notice.

## 2. Trial and fees
Every plan starts with a 30-day free trial. Fees are per practice per month as published at the time of signup, plus any add-ons switched on, invoiced monthly in arrears and payable within 14 days. Prices exclude VAT. We may change prices with 60 days' notice; changes do not apply until your next billing period after the notice. Onboarding is free for the first ten practices and €750 thereafter unless agreed otherwise in writing.

## 3. Your responsibilities
You are the data controller for all patient and practice data you enter. You must: have a lawful basis for it; obtain patient consent where required (for example marketing texts); keep staff logins personal and confidential; remove leavers promptly; use strong passwords; and comply with Dental Council of Ireland and data protection requirements for clinical records, including retention periods. You are responsible for the accuracy of clinical entries; Dentora is a record-keeping tool, not a source of clinical advice.

## 4. Acceptable use
No unlawful, infringing or abusive use; no attempt to access another practice's data or to circumvent security; no reselling. Bulk SMS may only be sent to patients who have opted in.

## 5. Availability and support
We aim for 99.5% monthly availability excluding announced maintenance. Support is by email and phone on business days; we aim to respond the same working day. Security incidents affecting your data are notified without undue delay and within 48 hours of confirmation.

## 6. Your data
You own your data. You can export it at any time from Settings. On termination we return or delete it within 30 days on your instruction. We keep backups for 7 days. We never sell data and never use patient data for any purpose other than providing the service to you.

## 7. Term and termination
Monthly, cancellable by either side with 30 days' notice. We may suspend access immediately for non-payment beyond 30 days, breach of these terms, or a security threat, and will tell you why.

## 8. Liability
Nothing limits liability for death, personal injury, fraud, or anything that cannot be limited by law. Otherwise our total liability in any 12-month period is limited to the fees you paid in that period. We are not liable for indirect or consequential loss, or for loss caused by your failure to keep logins secure or to maintain your own clinical retention obligations. The service is provided as described; clinical decisions remain with the treating clinician.

## 9. Changes and law
We may update these terms with 30 days' notice by email. Irish law applies and the Irish courts have jurisdiction.

Contact: ${SUPPORT_EMAIL} · ${SUPPORT_PHONE}
`,
  },
  dpa: {
    title: 'Data Processing Agreement',
    body: `
Version ${LEGAL_VERSION}. This agreement forms part of the Terms of Service between ${ENTITY} ("Processor") and the Practice ("Controller") and is entered into under Article 28 of Regulation (EU) 2016/679 (GDPR). It is accepted electronically when the Practice's owner creates the clinic account; the date, time and accepting user are recorded.

## 1. Subject matter and duration
The Processor provides hosted dental practice management software. Processing lasts for the term of the Terms of Service plus the return-or-deletion period in clause 9.

## 2. Nature and purpose
Storage, retrieval, display, transmission (SMS, email, video) and backup of practice and patient data, solely to provide the service to the Controller.

## 3. Types of personal data
Patient identity and contact details; dates of birth; scheme and payment information; appointment history; dental charts, clinical notes, treatment plans, imaging references and uploaded files, periodontal and specialty case records; medical history and alerts (special category health data); communications sent; staff identity, role and access logs.

## 4. Categories of data subjects
Patients of the Controller (including children); the Controller's staff and clinicians; referring and referred-to clinicians named in records.

## 5. Processor obligations
The Processor shall:
- process personal data only on the Controller's documented instructions, which are the Terms of Service, this agreement and the Controller's use of the software; and inform the Controller if an instruction appears to infringe data protection law;
- ensure that persons authorised to process the data are bound by confidentiality;
- implement the technical and organisational measures in Annex A;
- assist the Controller in responding to data subject requests, by providing export, correction, anonymisation and access-log tools in the software and, where needed, direct assistance within 5 working days;
- assist the Controller with security, breach notification, data protection impact assessments and prior consultation, taking into account the nature of processing;
- make available all information necessary to demonstrate compliance and allow for and contribute to audits, including inspections, conducted by the Controller or an auditor mandated by the Controller, on 30 days' notice and no more than once a year unless required by a supervisory authority or following a breach;
- not transfer personal data outside the EEA except as set out in clause 7.

## 6. Sub-processors
The Controller gives general authorisation for the sub-processors listed at /#/legal/subprocessors (Annex B). The Processor will give at least 30 days' notice by email of any intended addition or replacement, during which the Controller may object on reasonable data protection grounds; if the objection cannot be resolved the Controller may terminate without penalty. The Processor imposes equivalent data protection obligations on each sub-processor and remains liable for their performance.

## 7. International transfers
Data is stored in the EU (AWS eu-west-1, Dublin). Where a sub-processor is established outside the EEA (see Annex B), transfers are made under the EU Standard Contractual Clauses (Commission Decision 2021/914) with the sub-processor, supplemented by the measures in Annex A.

## 8. Personal data breach
The Processor shall notify the Controller without undue delay and in any case within 48 hours of becoming aware of a personal data breach affecting the Controller's data, providing the information the Controller needs to meet its 72-hour obligation to the Data Protection Commission, and shall cooperate in containment and remediation.

## 9. Return and deletion
At the end of the service the Controller may export all of its data from the software. On the Controller's written instruction, and in any case 30 days after termination, the Processor deletes the Controller's data, and deletes it from backups on the normal backup rotation (7 days), unless EU or Irish law requires storage.

## 10. Liability
Liability is governed by the Terms of Service. Each party is liable for its own compliance with GDPR.

## Annex A — Technical and organisational measures
- Hosting in the EU (Dublin) on Supabase / AWS, ISO 27001 and SOC 2 certified infrastructure.
- Encryption in transit (TLS 1.2+) and at rest (AES-256).
- Logical isolation of every practice's data enforced by database row-level security; verified by an automated negative test suite run against production.
- Role-based access: owner, admin, dentist, staff; practice configuration changes restricted to owner/admin at the database level.
- Individual, password-protected staff logins; passwords stored as salted hashes; email-code verification at signup; password reset by email code.
- Access logging of every opening of a patient record (who, when), retained 2 years and reviewable by the practice's owner/admin.
- Append-only clinical records: chart entries and clinical notes cannot be deleted or edited; corrections are made by attributed retirement or addendum.
- Patient-reported medical history is quarantined for clinician review before it changes the medical alerts on a record.
- Waiting-room tablet check-in uses single-use, 30-minute codes; the tablet holds no staff session.
- Video consultation rooms use unguessable per-appointment tokens and a limited join window.
- Daily backups with 7-day retention; restore procedure tested.
- Change control: all database changes and backend code are version-controlled; an independent security audit was carried out on 7 September 2026 and its findings remediated.
- Sub-processors bound by written data processing terms.
- Data minimisation tools for the Controller: patient anonymisation (right to erasure compatible with clinical retention), archive, marketing consent flag, full export.

## Annex B — Sub-processors
See /#/legal/subprocessors. Current at ${LEGAL_VERSION}.
`,
  },
  security: {
    title: 'Security summary',
    body: `
One page for a practice principal or their IT adviser. Version ${LEGAL_VERSION}.

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

Questions: ${SUPPORT_EMAIL} · ${SUPPORT_PHONE}
`,
  },
  subprocessors: {
    title: 'Sub-processors',
    body: `
Third parties that process personal data on Dentora's behalf. Current at ${LEGAL_VERSION}. Practices are notified by email 30 days before any change.

${SUBPROCESSORS.map((s) => `### ${s.name}
- **Purpose:** ${s.purpose}
- **Data:** ${s.data}
- **Location:** ${s.location}
- **Safeguards:** ${s.basis}
`).join('\n')}
Not used: no advertising or analytics providers; no external font or script CDNs (fonts are served from Dentora itself).
`,
  },
}
