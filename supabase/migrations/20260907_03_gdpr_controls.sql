-- Applied 2026-09-07 as "gdpr_controls" (+ "support_requests" recorded in 20260907_02).
alter table public.dental_patients
  add column if not exists sms_marketing_consent boolean not null default false,
  add column if not exists sms_marketing_consent_at timestamptz,
  add column if not exists anonymised_at timestamptz;
alter table public.dental_clinics
  add column if not exists terms_accepted_at timestamptz, add column if not exists dpa_accepted_at timestamptz,
  add column if not exists accepted_by text, add column if not exists legal_version text;
alter table public.dental_portal_profiles
  add column if not exists privacy_accepted_at timestamptz, add column if not exists legal_version text;

create table if not exists public.dental_access_log (
  id bigint generated always as identity primary key,
  clinic_id uuid not null, patient_id uuid not null, user_id uuid not null default auth.uid(),
  user_email text, action text not null default 'view', at timestamptz not null default now());
create index if not exists dental_access_log_patient_idx on public.dental_access_log (patient_id, at desc);
create index if not exists dental_access_log_clinic_idx on public.dental_access_log (clinic_id, at desc);
alter table public.dental_access_log enable row level security;
create policy member_insert on public.dental_access_log for insert to authenticated
  with check (user_id = auth.uid() and clinic_id in (select public.dental_my_clinics()));
create policy admin_read on public.dental_access_log for select to authenticated using (public.dental_is_admin(clinic_id));

create or replace function public.dental_anonymise_patient(p_patient_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_clinic uuid; v_tag text;
begin
  select clinic_id into v_clinic from public.dental_patients where id = p_patient_id;
  if v_clinic is null then raise exception using message = 'Patient not found.'; end if;
  if not public.dental_is_admin(v_clinic) then raise exception using message = 'Only an owner or admin can anonymise a patient.'; end if;
  v_tag := 'ANON-' || upper(substr(replace(p_patient_id::text, '-', ''), 1, 8));
  update public.dental_patients set first_name = 'Anonymised', last_name = v_tag, dob = null, phone = null, email = null,
    address = null, notes = null, archived = true, sms_marketing_consent = false, anonymised_at = now() where id = p_patient_id;
  delete from public.dental_comms_log where patient_id = p_patient_id;
  delete from public.dental_questionnaires where patient_id = p_patient_id;
  delete from public.dental_checkin_sessions where patient_id = p_patient_id;
  delete from public.dental_portal_links where patient_id = p_patient_id;
  update public.dental_appointments set reason = '[anonymised]', notes = null where patient_id = p_patient_id;
  update public.dental_referrals set letter = '[anonymised]' where patient_id = p_patient_id;
  update public.dental_routing_slips set data = '{}'::jsonb where patient_id = p_patient_id;
  insert into public.dental_access_log (clinic_id, patient_id, user_email, action)
    values (v_clinic, p_patient_id, (select email from auth.users where id = auth.uid()), 'anonymise');
end $$;
revoke all on function public.dental_anonymise_patient(uuid) from public, anon;
grant execute on function public.dental_anonymise_patient(uuid) to authenticated;

-- cron "dentora-retention-daily" (30 3 * * *): purge kiosk codes > 7 d, access log > 2 y, comms log > 3 y.
