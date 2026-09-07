# Dentora — from here to 10 paying practices

Written 2026-09-07. Assumes one person (Mohammad) selling, onboarding and supporting, with Ahmed as
clinical advisor and first reference. Free migration/onboarding for the first 10.

## The shape of it

Warm referrals in, a 20-minute demo, a private trial with the practice's own data in it, a
migration weekend, then a month of hand-holding. Ten practices is roughly 40 conversations, 20
demos, 12 trials. The rate limiter is not demand, it is the practices' contract renewal dates with
their current vendor, so this is a 4–6 month arc, not a 4–6 week one.

## Stage 0 — before the first invoice (do these now, in this order)

1. **GDPR paperwork.** A dental practice cannot legally put patient data in Dentora without a Data
   Processing Agreement. Need: DPA (Dentora as processor), privacy notice, terms of service, a
   one-page security summary (EU hosting, per-clinic isolation, backups, the audit). One evening
   with a template; this blocks everything.
2. **Real SMS.** Recalls and reminders are the headline; demo mode does not count. Twilio account,
   Irish number, three secrets on the recall engine. Half a day.
3. **Domain.** dentora.ie with the app on app.dentora.ie instead of github.io. A practice will not
   type a github address into a tablet.
4. **Support inbox that pings you.** Support form → email notification (pg_net → Resend). Commit to
   same-day replies in writing.
5. **Backups.** Confirm Supabase PITR on the Pro org and do one restore drill so "we have backups"
   is true in the way an audit would accept.
6. **Billing.** No card processing yet. Month 1–3: invoice monthly from your existing invoicing
   system, bank transfer, 14-day terms. Stripe direct debit once there are five paying.

## Stage 1 — lead sources (first 10)

In order of expected yield:

- **Ahmed's practice and his network.** He has been giving feedback since day one; he is reference
  customer number one and should be paying (even a token amount) so you can say "in use at".
- **Practices where you are the patient.** Dundrum Orthodontics via Christina. Everyone on the team
  is a patient somewhere; every appointment is a demo opportunity.
- **Dental nurses and receptionists as champions.** They feel the pain of the current software
  daily and they talk to the principal. Give them the demo login and the Help tab; they sell it.
- **The Radix LinkedIn list.** Suhaib's Discovery Pipeline already holds hundreds of UK/Irish
  practice principals, qualified. Reuse the sourcing; change the message.
- **Local canvassing in Dublin.** Ten practices within a 30-minute drive, walk in with a tablet,
  ask for the practice manager, leave a one-pager with the demo login. Old-fashioned, works in
  dentistry.
- **Referral offer.** One month free for each practice a customer refers that goes live.

## Stage 2 — qualify (5 minutes, phone or in person)

Ask, in this order:
1. What do you use now, and when does the contract renew? (Aerona, Dentally, EXACT, SOE, paper.)
2. How many surgeries and clinicians?
3. Who decides? (Principal. Practice manager influences.)
4. What annoys you most? (Usually: cost, FTAs, recalls done by hand, no online booking, support.)
5. Do you do ortho or endo in-house?

Disqualify politely if the renewal is more than nine months out; put them in a follow-up list dated
two months before renewal.

## Stage 3 — demo (20 minutes, in person if under an hour away)

Use the demo practice that matches them (Harbour for general, Align for ortho, Shannon for endo).
Show exactly four things, then stop: their Monday diary, one patient record end to end, the recall
automation, and the thing they said annoyed them. Leave the demo login and the Help tab. Do not
show Settings, Reports or add-ons unless asked.

## Stage 4 — private trial with their data (the close)

Same day as the demo, create their own practice through the signup wizard, then import 20–50 of
their real patients from a CSV export and set their fee schedule. Ask them to run the diary in
Dentora alongside their current system for one week. This is the step that converts: once their
own patients are on screen, switching becomes the default.

## Stage 5 — decision and paperwork

Signed order form (plan, add-ons, monthly price, trial end date, "first 10: onboarding free"), DPA
countersigned, go-live date agreed. Go-live is always a Monday; migration happens the weekend
before.

## Stage 6 — migration weekend

Friday evening: full export from the old system. Saturday: import patients, appointments for the
next 8 weeks, open balances, recall dates; verify counts against the old system; set team, rooms,
rota, fees, templates, imaging software. Sunday: one hour of training on site or video, Help tab
open. Monday: you are reachable on WhatsApp all day; check in daily for the first week, then
weekly for a month.

Keep a migration checklist per source system. After two migrations from the same vendor, write an
importer for its export format — that is what turns "I do it myself" into something repeatable.

## Stage 7 — retention and expansion

Month-one review call: what they use, what they do not, what is missing. Ask for the referral. Turn
on ortho/endo if they do it in-house. Case study with permission after three months.

## Cadence and numbers

Weekly: 5 new conversations, 2 demos, 1 trial started. Warm-referral conversion is roughly one in
two trials to paying. That is 10 practices in about 20 weeks with the contract-renewal lag.

Track in one sheet: practice, contact, current PMS, renewal date, stage, next action, date.

## What changes after 10

Self-serve signup, the Help tab and the demo accounts already exist, so the product side scales.
What does not scale is you doing every migration and answering every support email. By practice
10: importers for the two or three most common source systems, a recorded onboarding video, a
second person on support, direct debit billing, and the €750 onboarding fee switched on.
