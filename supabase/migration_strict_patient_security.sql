-- ============================================================
-- DiagnoVision — Strict Patient Privacy & Security Migration
-- Enforces Principle of Least Privilege & HIPAA-compliant access:
-- Doctors can ONLY access scans of patients assigned to them,
-- plus unassigned intake scans in the hospital triage queue.
-- ============================================================

-- 1. DROP OLD OVERLY-PERMISSIVE POLICIES
drop policy if exists "Medical staff can view all predictions" on public.medical_predictions;
drop policy if exists "Medical staff can update predictions" on public.medical_predictions;

-- 2. CREATE STRICT MEDICAL STAFF SELECT POLICY
-- Staff can view:
--   a) Scans belonging to their assigned patients (patient.staff_id = auth.uid())
--   b) Unassigned scans waiting in the hospital intake queue (patient_id is null)
--   c) Scans uploaded directly by the staff member themselves (user_id = auth.uid())
-- Admins retain full hospital oversight.
create policy "Staff can view assigned patient scans and unassigned triage"
  on public.medical_predictions for select
  using (
    public.is_admin()
    or (
      public.is_medical_staff()
      and (
        -- Unassigned incoming triage scan
        medical_predictions.patient_id is null
        -- OR scan belongs to a patient assigned to this doctor
        or exists (
          select 1
          from public.patients
          where patients.id = medical_predictions.patient_id
            and patients.staff_id = auth.uid()
        )
        -- OR scan uploaded by the staff member
        or medical_predictions.user_id = auth.uid()
      )
    )
  );

-- 3. CREATE STRICT MEDICAL STAFF UPDATE POLICY
-- Doctors can ONLY update (review, override, or link):
--   a) Unassigned scans (to claim / assign to their patient)
--   b) Scans belonging to their assigned patients
-- WITH CHECK ensures a doctor cannot re-assign a scan to someone else's patient.
create policy "Staff can update assigned or unassigned predictions"
  on public.medical_predictions for update
  using (
    public.is_admin()
    or (
      public.is_medical_staff()
      and (
        medical_predictions.patient_id is null
        or exists (
          select 1
          from public.patients
          where patients.id = medical_predictions.patient_id
            and patients.staff_id = auth.uid()
        )
      )
    )
  )
  with check (
    public.is_admin()
    or (
      public.is_medical_staff()
      and (
        -- Target patient must belong to the doctor
        exists (
          select 1
          from public.patients
          where patients.id = medical_predictions.patient_id
            and patients.staff_id = auth.uid()
        )
        or medical_predictions.patient_id is null
      )
    )
  );

-- 4. UPDATE STAFF REVIEWS ACCESS POLICIES
drop policy if exists "Staff can view own reviews" on public.staff_reviews;
drop policy if exists "Staff can insert reviews" on public.staff_reviews;

-- Staff can view reviews only for scans they have authorized access to
create policy "Staff can view authorized reviews"
  on public.staff_reviews for select
  using (
    auth.uid() = reviewer_id
    or public.is_admin()
    or exists (
      select 1
      from public.medical_predictions p
      left join public.patients pt on pt.id = p.patient_id
      where p.id = staff_reviews.prediction_id
        and (
          p.patient_id is null
          or pt.staff_id = auth.uid()
        )
    )
  );

-- Staff can insert clinical reviews only on scans they have authorized access to
create policy "Staff can insert authorized reviews"
  on public.staff_reviews for insert
  with check (
    auth.uid() = reviewer_id
    and public.is_medical_staff()
    and exists (
      select 1
      from public.medical_predictions p
      left join public.patients pt on pt.id = p.patient_id
      where p.id = staff_reviews.prediction_id
        and (
          p.patient_id is null
          or pt.staff_id = auth.uid()
        )
    )
  );

-- Add helper index to accelerate doctor-patient scan access checks
create index if not exists idx_patients_id_staff_id
  on public.patients(id, staff_id);
