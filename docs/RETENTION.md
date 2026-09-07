# Retention and deletion

Reviewed 2026-09-07.

## Practice (controller) data held by Dentora
- Kept for the life of the practice's contract.
- On termination: full export available from Settings; deleted within 30 days of the practice's instruction, and in any case within 30 days of termination; gone from backups on the 7-day rotation.
- Clinical retention periods are the practice's responsibility. Irish guidance commonly cited: 8 years after the last treatment for adults; for children until age 25 (or 26 if treatment ended at 17); indefinitely where there is a legal claim. Practices should confirm with Dental Council of Ireland and their indemnifier. Dentora never deletes clinical records on its own initiative; the **Anonymise** action removes identity but keeps the clinical record for the retention period.

## Data Dentora controls
| Data | Retention | Mechanism |
|---|---|---|
| Staff accounts | Until removed by the practice; login deleted if no other clinic membership | manage-staff function |
| Portal accounts | Until closed by the patient, or 3 years without activity | Manual review (quarterly) |
| Access log | 2 years | cron `dentora-retention-daily` |
| SMS / message log | 3 years | cron `dentora-retention-daily` |
| Kiosk check-in codes | 7 days | cron `dentora-retention-daily` |
| Support and demo requests | 2 years | Manual review (quarterly) |
| Backups | 7 days rolling | Supabase |

## Backups and restore
- Supabase Pro daily backups. **Action:** confirm PITR is enabled on the project and record the date of a restore drill here.
- Restore drill: ______ (date) — restored to a scratch project, verified row counts on dental_patients and dental_appointments.
