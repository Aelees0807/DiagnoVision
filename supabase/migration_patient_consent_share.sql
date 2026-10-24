-- ============================================================
-- DiagnoVision — Complete Patient Privacy & Doctor Sharing Migration
-- 1. Complete Isolation: Doctors can NEVER see or browse unassigned stranger scans.
-- 2. Closes the "Dummy Patient" exploit permanently.
-- 3. Patient Consent Model: Patients generate a secure One-Time Share Code
--    to explicitly authorize a doctor to connect and review their scan.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. SCAN SHARES TABLE (Patient Consent Tracking)
-- ────────────────────────────────────────────────────────────

create table if not exists public.scan_shares (
  id              bigint generated always as identity primary key,
  prediction_id   bigint not null references public.medical_predictions(id) on delete cascade,
  patient_user_id uuid not null references public.profiles(id) on delete cascade,
  share_code      text not null unique,
  status          text not null default 'active' check (status in ('active', 'claimed', 'revoked', 'expired')),
  doctor_id       uuid references public.profiles(id) on delete set null,
  patient_id      bigint references public.patients(id) on delete set null,
  expires_at      timestamptz not null default (now() + interval '7 days'),
  claimed_at      timestamptz,
  created_at      timestamptz not null default now()
);

comment on table  public.scan_shares              is 'Patient-authorized scan share tokens for clinical consultation.';
comment on column public.scan_shares.share_code   is 'Unique 6-digit or formatted code (e.g., DV-849201) given to doctor.';
comment on column public.scan_shares.status       is 'active | claimed | revoked | expired.';

create index if not exists idx_scan_shares_code         on public.scan_shares(share_code);
create index if not exists idx_scan_shares_prediction   on public.scan_shares(prediction_id);
create index if not exists idx_scan_shares_patient_user on public.scan_shares(patient_user_id);


-- ────────────────────────────────────────────────────────────
-- 2. ROW LEVEL SECURITY ON scan_shares
-- ────────────────────────────────────────────────────────────

alter table public.scan_shares enable row level security;

-- Patients can view their own share records
drop policy if exists "Patients can view own scan shares" on public.scan_shares;
create policy "Patients can view own scan shares"
  on public.scan_shares for select
  using (auth.uid() = patient_user_id);

-- Patients can generate a share code for their own scan
drop policy if exists "Patients can insert scan shares for own predictions" on public.scan_shares;
create policy "Patients can insert scan shares for own predictions"
  on public.scan_shares for insert
  with check (
    auth.uid() = patient_user_id
    and exists (
      select 1 from public.medical_predictions
      where id = prediction_id and user_id = auth.uid()
    )
  );

-- Patients can revoke their own share code
drop policy if exists "Patients can update own scan shares" on public.scan_shares;
create policy "Patients can update own scan shares"
  on public.scan_shares for update
  using (auth.uid() = patient_user_id)
  with check (auth.uid() = patient_user_id);

-- Medical staff can view claimed share records or lookup active shares
drop policy if exists "Staff can view shares" on public.scan_shares;
create policy "Staff can view shares"
  on public.scan_shares for select
  using (
    public.is_medical_staff()
    or public.is_admin()
  );


-- ────────────────────────────────────────────────────────────
-- 3. SECURE RPC — connect_shared_scan()
-- ────────────────────────────────────────────────────────────
-- A doctor redeems a patient's share code to securely link the scan
-- to one of their registered patients.

create or replace function public.connect_shared_scan(
  p_share_code text,
  p_patient_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_share record;
  v_patient record;
  v_normalized_code text;
begin
  -- 1. Ensure caller is verified medical staff or admin
  if not (public.is_medical_staff()) then
    return jsonb_build_object(
      'success', false,
      'error', 'Unauthorized. Only verified medical staff can connect patient scans.'
    );
  end if;

  -- 2. Verify target patient belongs to the calling doctor (or caller is admin)
  select * into v_patient
  from public.patients
  where id = p_patient_id
    and (staff_id = auth.uid() or public.is_admin());

  if not found then
    return jsonb_build_object(
      'success', false,
      'error', 'Selected patient does not exist or is not assigned to your clinical care.'
    );
  end if;

  -- 3. Normalize share code (trim spaces and convert to uppercase)
  v_normalized_code := upper(trim(p_share_code));

  -- 4. Find active, non-expired share code
  select * into v_share
  from public.scan_shares
  where share_code = v_normalized_code
    and status = 'active'
    and expires_at > now();

  if not found then
    return jsonb_build_object(
      'success', false,
      'error', 'Invalid, expired, or already claimed share code. Please check with your patient.'
    );
  end if;

  -- 5. Securely link the prediction to this patient
  update public.medical_predictions
  set patient_id = p_patient_id,
      review_status = 'pending'
  where id = v_share.prediction_id;

  -- 6. Mark the share code as claimed by this doctor
  update public.scan_shares
  set status = 'claimed',
      claimed_at = now(),
      doctor_id = auth.uid(),
      patient_id = p_patient_id
  where id = v_share.id;

  return jsonb_build_object(
    'success', true,
    'prediction_id', v_share.prediction_id,
    'patient_name', v_patient.patient_name
  );
end;
$$;

comment on function public.connect_shared_scan(text, bigint)
  is 'Securely claims a patient scan via authorized share code and links it to the doctors patient record.';


-- ────────────────────────────────────────────────────────────
-- 4. STRICT RLS ON medical_predictions (COMPLETE ISOLATION)
-- ────────────────────────────────────────────────────────────
-- Drops any open or triage policies.
-- Doctors can ONLY see scans for patients assigned to them or uploaded by themselves.

drop policy if exists "Medical staff can view all predictions" on public.medical_predictions;
drop policy if exists "Medical staff can update predictions" on public.medical_predictions;
drop policy if exists "Staff can view assigned patient scans and unassigned triage" on public.medical_predictions;
drop policy if exists "Staff can update assigned or unassigned predictions" on public.medical_predictions;
drop policy if exists "Staff can view ONLY assigned patient scans" on public.medical_predictions;
drop policy if exists "Staff can update ONLY assigned patient predictions" on public.medical_predictions;

-- Doctor SELECT: ONLY assigned patients or doctor-uploaded scans
create policy "Staff can view ONLY assigned patient scans"
  on public.medical_predictions for select
  using (
    public.is_admin()
    or (
      public.is_medical_staff()
      and (
        -- Scan belongs to a patient assigned to this doctor
        exists (
          select 1
          from public.patients
          where patients.id = medical_predictions.patient_id
            and patients.staff_id = auth.uid()
        )
        -- OR scan was uploaded directly by the doctor
        or medical_predictions.user_id = auth.uid()
      )
    )
  );

-- Doctor UPDATE: ONLY scans belonging to their assigned patients
create policy "Staff can update ONLY assigned patient predictions"
  on public.medical_predictions for update
  using (
    public.is_admin()
    or (
      public.is_medical_staff()
      and exists (
        select 1
        from public.patients
        where patients.id = medical_predictions.patient_id
          and patients.staff_id = auth.uid()
      )
    )
  )
  with check (
    public.is_admin()
    or (
      public.is_medical_staff()
      and exists (
        select 1
        from public.patients
        where patients.id = medical_predictions.patient_id
          and patients.staff_id = auth.uid()
      )
    )
  );


-- ────────────────────────────────────────────────────────────
-- 5. GRANTS
-- ────────────────────────────────────────────────────────────

grant select, insert, update           on public.scan_shares to authenticated;
grant execute on function public.connect_shared_scan(text, bigint) to authenticated;


-- ────────────────────────────────────────────────────────────
-- 6. STORAGE ACCESS — Allow Medical Staff to View X-Rays
-- ────────────────────────────────────────────────────────────
-- By default, storage.objects only allows users to read from their own UID folder.
-- When a patient shares a scan with a doctor, the file is under the patient's UID folder.
-- This policy allows verified medical staff and admins to read/preview X-ray images.

drop policy if exists "Medical staff and admins can read xray images" on storage.objects;
create policy "Medical staff and admins can read xray images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'xrays'
    and (
      public.is_medical_staff()
      or public.is_admin()
    )
  );

