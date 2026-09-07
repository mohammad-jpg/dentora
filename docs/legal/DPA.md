# Data Processing Agreement

_Dentora · version 2026-09-07 · DRAFT for solicitor review · generated from src/legal.js_

Version 2026-09-07. This agreement forms part of the Terms of Service between [Dentora legal entity — e.g. "Mohammad Syed trading as Dentora" or the company name and CRO number] ("Processor") and the Practice ("Controller") and is entered into under Article 28 of Regulation (EU) 2016/679 (GDPR). It is accepted electronically when the Practice's owner creates the clinic account; the date, time and accepting user are recorded.

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
See /#/legal/subprocessors. Current at 2026-09-07.
