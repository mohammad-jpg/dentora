-- Applied 2026-09-07 as "fix_patient_linked_tenant_isolation".
-- Fix critical RLS gap: the "tenant_all" policy on every patient-linked clinical/financial
-- table was scoped to "patient_id IN (SELECT id FROM dental_patients)". Because that inner
-- SELECT runs under RLS too, and portal patients can see their own dental_patients row via
-- the portal_own_patient policy, this FOR ALL policy silently gave portal patients
-- INSERT/UPDATE/DELETE on their own chart entries, clinical notes, payments, invoices and
-- questionnaires. None of these tables are read directly by the patient portal UI (it goes
-- through the 'portal' edge function, which uses the service-role key), so access is scoped
-- to staff of the patient's own clinic only.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'dental_bpe_exams','dental_chart_entries','dental_clinical_notes','dental_comms_log',
    'dental_endo_cases','dental_imaging_refs','dental_implant_cases','dental_invoices',
    'dental_lab_cases','dental_ortho_cases','dental_payments','dental_perio_cases',
    'dental_perio_exams','dental_questionnaires','dental_recalls','dental_referrals',
    'dental_routing_slips','dental_treatment_plans'
  ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY tenant_all ON public.%I FOR ALL TO authenticated '
      'USING (patient_id IN (SELECT id FROM dental_patients WHERE clinic_id IN (SELECT dental_my_clinics()))) '
      'WITH CHECK (patient_id IN (SELECT id FROM dental_patients WHERE clinic_id IN (SELECT dental_my_clinics())))',
      t
    );
  END LOOP;
END $$;

-- dental_rota was scoped off practitioner visibility, and dental_practitioners.portal_read
-- allowed any authenticated user to see every practitioner at every clinic.
DROP POLICY IF EXISTS tenant_all ON public.dental_rota;
CREATE POLICY tenant_all ON public.dental_rota FOR ALL TO authenticated
  USING (practitioner_id IN (SELECT id FROM dental_practitioners WHERE clinic_id IN (SELECT dental_my_clinics())))
  WITH CHECK (practitioner_id IN (SELECT id FROM dental_practitioners WHERE clinic_id IN (SELECT dental_my_clinics())));

DROP POLICY IF EXISTS portal_read ON public.dental_practitioners;
CREATE POLICY portal_read ON public.dental_practitioners FOR SELECT TO authenticated
  USING (active = true);

DROP POLICY IF EXISTS dentora_files_all ON storage.objects;
CREATE POLICY dentora_files_all ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'dental-files' AND ((storage.foldername(name))[1])::uuid IN (SELECT id FROM dental_patients WHERE clinic_id IN (SELECT dental_my_clinics())))
  WITH CHECK (bucket_id = 'dental-files' AND ((storage.foldername(name))[1])::uuid IN (SELECT id FROM dental_patients WHERE clinic_id IN (SELECT dental_my_clinics())));
