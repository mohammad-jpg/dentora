# Record of processing activities (Article 30)

Dentora · maintained by Mohammad Syed · reviewed 2026-09-07

## A. As processor (Art. 30(2)) — on behalf of each dental practice

| Item | Detail |
|---|---|
| Controller | Each dental practice with a Dentora clinic account (name, address and contact held on `dental_clinics`) |
| Processor | [Dentora legal entity], Dublin. Contact: hello@dentora.ie |
| Categories of processing | Storage, retrieval, display, transmission (SMS, email, video), backup and export of practice and patient records; access logging |
| Categories of data | Patient identity and contact; date of birth; scheme and payment data; appointments; dental charts, clinical notes, treatment plans, imaging references and files, periodontal and specialty case records; medical history and alerts (special category); communications; staff identity, role, access log |
| Data subjects | Patients (including children); practice staff; referring/referred clinicians |
| Transfers | Hosting in EU (AWS eu-west-1). Sub-processors outside the EEA (Twilio, 8x8, GitHub, Supabase support) under EU SCCs — see docs/legal/SUBPROCESSORS.md |
| Security measures | docs/legal/DPA.md Annex A |
| Retention | On practice instruction; deletion within 30 days of termination; backups 7 days |

## B. As controller (Art. 30(1))

| Processing | Purpose | Legal basis | Data | Subjects | Retention |
|---|---|---|---|---|---|
| Staff accounts | Provide the service | Contract | Name, email, hashed password, role, clinic, login events | Practice staff | Life of the account + 30 days |
| Portal accounts | Let patients book and join video | Contract | Name, email, phone, hashed password, login events | Patients | Until closed, or 3 years inactive |
| Access log | Security, accountability | Legal obligation / legitimate interest | Staff email, patient id, action, time | Staff, patients | 2 years |
| Support and demo requests | Respond to enquiries | Legitimate interest / pre-contract | Name, email, phone, practice, message | Prospects, staff | 2 years |
| Web server logs | Operate and secure the site | Legitimate interest | IP, user agent, time | Visitors | Per GitHub Pages defaults |
| Billing | Invoice practices | Contract / legal obligation | Practice name, address, invoices | Practice contacts | 6 years (Revenue) |

No automated decision-making. No data sold or used for advertising.
