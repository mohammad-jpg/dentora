-- Applied 2026-09-07 as "audit_remediation_booking_ledger_roles_clinical".
-- Note: the dental_rota policies created here supersede the one in 20260907_01.

-- 1. Booking integrity ----------------------------------------------------------------
create extension if not exists btree_gist;
alter table public.dental_appointments
  add constraint dental_appointments_duration_chk
  check (ends_at > starts_at and ends_at - starts_at <= interval '8 hours');
alter table public.dental_appointments
  add constraint dental_appointments_no_overlap
  exclude using gist (practitioner_id with =, tstzrange(starts_at, ends_at) with &&)
  where (status <> 'cancelled');
alter table public.dental_appointments
  add column if not exists video_token text not null default replace(gen_random_uuid()::text, '-', '');

create or replace function public.dental_book_appointment(
  p_clinic_id uuid, p_patient_id uuid, p_practitioner_id uuid,
  p_starts_at timestamptz, p_ends_at timestamptz, p_status text, p_reason text,
  p_appointment_id uuid default null, p_enforce_rota boolean default false
) returns public.dental_appointments
language plpgsql security invoker set search_path = public as $$
declare
  v_prac public.dental_practitioners; v_pat public.dental_patients; v_row public.dental_appointments;
  v_local timestamp; v_local_end timestamp; v_wd int; v_rota text;
begin
  if p_ends_at is null or p_starts_at is null or p_ends_at <= p_starts_at then
    raise exception using message = 'End time must be after start time.';
  end if;
  if p_ends_at - p_starts_at > interval '8 hours' then
    raise exception using message = 'Appointments cannot exceed 8 hours.';
  end if;
  if p_status not in ('booked','confirmed','arrived','completed','cancelled','fta') then
    raise exception using message = 'Invalid appointment status.';
  end if;
  select * into v_prac from public.dental_practitioners where id = p_practitioner_id;
  if v_prac.id is null or v_prac.clinic_id <> p_clinic_id then
    raise exception using message = 'Clinician is not part of this clinic.';
  end if;
  if not coalesce(v_prac.active, false) then
    raise exception using message = 'That clinician is no longer active.';
  end if;
  select * into v_pat from public.dental_patients where id = p_patient_id;
  if v_pat.id is null or v_pat.clinic_id <> p_clinic_id then
    raise exception using message = 'Patient is not part of this clinic.';
  end if;
  if p_enforce_rota then
    v_local := p_starts_at at time zone 'Europe/Dublin';
    v_local_end := p_ends_at at time zone 'Europe/Dublin';
    v_wd := extract(isodow from v_local)::int - 1;
    select status into v_rota from public.dental_rota where practitioner_id = p_practitioner_id and weekday = v_wd limit 1;
    if v_rota is distinct from 'working' then
      raise exception using message = 'That clinician is not working on that day.';
    end if;
    if v_local::time < time '09:00' or v_local_end::time > time '17:00' or v_local::date <> v_local_end::date then
      raise exception using message = 'Online bookings are available 09:00–17:00.';
    end if;
    if extract(minute from v_local)::int % 30 <> 0 or extract(second from v_local) <> 0 then
      raise exception using message = 'Online bookings start on the hour or half hour.';
    end if;
    if p_starts_at < now() + interval '30 minutes' then
      raise exception using message = 'That time is no longer available.';
    end if;
  end if;
  begin
    if p_appointment_id is null then
      insert into public.dental_appointments (clinic_id, patient_id, practitioner_id, starts_at, ends_at, status, reason)
      values (p_clinic_id, p_patient_id, p_practitioner_id, p_starts_at, p_ends_at, p_status, p_reason)
      returning * into v_row;
    else
      update public.dental_appointments
        set patient_id = p_patient_id, practitioner_id = p_practitioner_id,
            starts_at = p_starts_at, ends_at = p_ends_at, status = p_status, reason = p_reason
        where id = p_appointment_id and clinic_id = p_clinic_id
        returning * into v_row;
      if v_row.id is null then raise exception using message = 'Appointment not found.'; end if;
    end if;
  exception when exclusion_violation then
    raise exception using message = 'slot_taken', errcode = 'P0002';
  end;
  return v_row;
end $$;
revoke all on function public.dental_book_appointment(uuid,uuid,uuid,timestamptz,timestamptz,text,text,uuid,boolean) from public, anon;
grant execute on function public.dental_book_appointment(uuid,uuid,uuid,timestamptz,timestamptz,text,text,uuid,boolean) to authenticated, service_role;

-- 2. Clinical record integrity ---------------------------------------------------------
alter table public.dental_chart_entries
  add column if not exists author text, add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by text, add column if not exists deleted_reason text;
alter table public.dental_clinical_notes
  add column if not exists deleted_at timestamptz, add column if not exists deleted_by text;
revoke delete on public.dental_chart_entries, public.dental_clinical_notes, public.dental_questionnaires from authenticated, anon;

create or replace function public.dental_immutable_clinical() returns trigger language plpgsql as $$
begin
  if new.id <> old.id or new.patient_id <> old.patient_id or new.created_at <> old.created_at then
    raise exception using message = 'Clinical records cannot be re-attributed.';
  end if;
  if tg_table_name = 'dental_chart_entries' then
    if new.tooth is distinct from old.tooth or new.surface is distinct from old.surface
       or new.condition is distinct from old.condition or new.status is distinct from old.status
       or new.note is distinct from old.note or new.author is distinct from old.author then
      raise exception using message = 'Chart entries cannot be edited — add a new entry, or retire this one with a reason.';
    end if;
  elsif tg_table_name = 'dental_clinical_notes' then
    if new.body is distinct from old.body or new.author is distinct from old.author then
      raise exception using message = 'Clinical notes cannot be edited — add an addendum, or retire this note.';
    end if;
  end if;
  if old.deleted_at is not null and new.deleted_at is distinct from old.deleted_at then
    raise exception using message = 'This entry has already been retired.';
  end if;
  return new;
end $$;
drop trigger if exists dental_chart_entries_immutable on public.dental_chart_entries;
create trigger dental_chart_entries_immutable before update on public.dental_chart_entries for each row execute function public.dental_immutable_clinical();
drop trigger if exists dental_clinical_notes_immutable on public.dental_clinical_notes;
create trigger dental_clinical_notes_immutable before update on public.dental_clinical_notes for each row execute function public.dental_immutable_clinical();

alter table public.dental_questionnaires
  add column if not exists source text not null default 'checkin',
  add column if not exists reviewed_at timestamptz, add column if not exists reviewed_by text;

-- 3. Ledger ----------------------------------------------------------------------------
alter table public.dental_payments add constraint dental_payments_writeoff_invoice_chk check (method <> 'write_off' or invoice_id is not null);
alter table public.dental_payments add constraint dental_payments_amount_chk check (amount > 0);
create or replace function public.dental_sync_invoice_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_inv uuid := coalesce(new.invoice_id, old.invoice_id); v_paid numeric; v_total numeric; v_status text;
begin
  if v_inv is null then return null; end if;
  select total, status into v_total, v_status from public.dental_invoices where id = v_inv;
  if v_status is null or v_status = 'void' then return null; end if;
  select coalesce(sum(amount), 0) into v_paid from public.dental_payments where invoice_id = v_inv;
  update public.dental_invoices set status = case when v_paid >= v_total then 'paid' when v_paid > 0 then 'part_paid' else 'unpaid' end where id = v_inv;
  return null;
end $$;
drop trigger if exists dental_payments_sync_invoice on public.dental_payments;
create trigger dental_payments_sync_invoice after insert or update or delete on public.dental_payments for each row execute function public.dental_sync_invoice_status();

-- 4. Role enforcement --------------------------------------------------------------------
create or replace function public.dental_my_role(p_clinic uuid) returns text language sql stable security definer set search_path = public as $$
  select role from public.dental_memberships where user_id = auth.uid() and clinic_id = p_clinic limit 1 $$;
create or replace function public.dental_is_admin(p_clinic uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.dental_memberships where user_id = auth.uid() and clinic_id = p_clinic and role in ('owner','admin')) $$;
revoke execute on function public.dental_my_clinics(), public.dental_my_patient_ids(), public.dental_my_role(uuid), public.dental_is_admin(uuid) from public, anon;
grant execute on function public.dental_my_clinics(), public.dental_my_patient_ids(), public.dental_my_role(uuid), public.dental_is_admin(uuid) to authenticated, service_role;

drop policy if exists clinic_members_update on public.dental_clinics;
create policy clinic_admin_update on public.dental_clinics for update to authenticated using (public.dental_is_admin(id)) with check (public.dental_is_admin(id));
do $$
declare t text;
begin
  for t in select unnest(array['dental_treatments','dental_surgeries','dental_message_templates','dental_note_templates','dental_practitioners']) loop
    execute format('drop policy if exists tenant_all on public.%I', t);
    execute format('create policy tenant_read on public.%I for select to authenticated using (clinic_id in (select public.dental_my_clinics()))', t);
    execute format('create policy admin_all on public.%I for all to authenticated using (public.dental_is_admin(clinic_id)) with check (public.dental_is_admin(clinic_id))', t);
  end loop;
end $$;
drop policy if exists tenant_all on public.dental_rota;
create policy tenant_read on public.dental_rota for select to authenticated
  using (practitioner_id in (select id from public.dental_practitioners where clinic_id in (select public.dental_my_clinics())));
create policy admin_all on public.dental_rota for all to authenticated
  using (practitioner_id in (select id from public.dental_practitioners where public.dental_is_admin(clinic_id)))
  with check (practitioner_id in (select id from public.dental_practitioners where public.dental_is_admin(clinic_id)));

-- 5. Recall engine scheduler secret -------------------------------------------------------
create table if not exists public.dental_secrets (key text primary key, value text not null, created_at timestamptz default now());
alter table public.dental_secrets enable row level security;
insert into public.dental_secrets (key, value)
  values ('recall_engine', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
  on conflict (key) do nothing;
-- cron job "dentora-recalls-daily" (0 8 * * *) posts to /functions/v1/recall-engine with header
-- x-recall-secret := (select value from public.dental_secrets where key = 'recall_engine').

-- 6. Kiosk check-in sessions ---------------------------------------------------------------
create table if not exists public.dental_checkin_sessions (
  id uuid primary key default gen_random_uuid(),
  token text unique not null default replace(gen_random_uuid()::text, '-', ''),
  clinic_id uuid not null references public.dental_clinics(id) on delete cascade,
  patient_id uuid not null references public.dental_patients(id) on delete cascade,
  created_by text, expires_at timestamptz not null default now() + interval '30 minutes',
  used_at timestamptz, created_at timestamptz default now());
alter table public.dental_checkin_sessions enable row level security;
create policy tenant_all on public.dental_checkin_sessions for all to authenticated
  using (clinic_id in (select public.dental_my_clinics())) with check (clinic_id in (select public.dental_my_clinics()));

-- 7. Immutable defaults for new clinics ------------------------------------------------------
create table if not exists public.dental_default_fees (code text primary key, name text, category text, price numeric, duration_min int);
create table if not exists public.dental_default_templates (kind text, key text, label text, body text, primary key (kind, key));
alter table public.dental_default_fees enable row level security;
alter table public.dental_default_templates enable row level security;
-- seeded from the Dentora Dublin clinic on 2026-09-07 (47 fees, 5 message templates, 5 note templates)

-- 8. Trial fields ---------------------------------------------------------------------------
alter table public.dental_clinics
  add column if not exists plan text not null default 'trial',
  add column if not exists trial_ends_at timestamptz default (now() + interval '30 days');
