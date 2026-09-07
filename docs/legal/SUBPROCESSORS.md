# Sub-processors

_Dentora · version 2026-09-07 · DRAFT for solicitor review · generated from src/legal.js_

Third parties that process personal data on Dentora's behalf. Current at 2026-09-07. Practices are notified by email 30 days before any change.

### Supabase, Inc.
- **Purpose:** Database, authentication, file storage and serverless functions for the Dentora application
- **Data:** All practice and patient data held in Dentora
- **Location:** AWS eu-west-1 (Dublin, Ireland). Supabase is a US company; data is hosted in the EU.
- **Safeguards:** Supabase Data Processing Addendum; EU Standard Contractual Clauses for any support access from outside the EU

### Amazon Web Services EMEA SARL
- **Purpose:** Underlying cloud infrastructure used by Supabase
- **Data:** As above (encrypted at rest and in transit)
- **Location:** eu-west-1 (Dublin, Ireland)
- **Safeguards:** AWS GDPR Data Processing Addendum (via Supabase)

### GitHub, Inc. (GitHub Pages)
- **Purpose:** Serving the application files (HTML, JavaScript, CSS, fonts) to browsers
- **Data:** No practice or patient data. Standard web server logs (IP address, browser, time) for requests to the application files.
- **Location:** Global CDN; GitHub is a US company
- **Safeguards:** GitHub Data Protection Agreement; EU Standard Contractual Clauses

### Twilio Ireland Ltd / Twilio Inc.
- **Purpose:** Sending SMS appointment reminders, recalls and messages (only once a practice enables SMS)
- **Data:** Patient mobile number, patient first name, message text
- **Location:** EU processing where available; Twilio Inc. is a US company
- **Safeguards:** Twilio Data Protection Addendum; EU Standard Contractual Clauses

### 8x8, Inc. (Jitsi Meet, meet.jit.si)
- **Purpose:** Video consultation rooms (only when a video appointment is joined)
- **Data:** Room identifier (random token), participant display name, audio/video in transit. No recordings.
- **Location:** US company; media servers may be outside the EU
- **Safeguards:** Public service terms; EU Standard Contractual Clauses. Practices needing EU-only video should ask about the hosted alternative.

Not used: no advertising or analytics providers; no external font or script CDNs (fonts are served from Dentora itself).
