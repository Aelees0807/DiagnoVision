-- ============================================================
-- DiagnoVision — Medical Staff Module Schema  (Phase 2)
-- Run this file in the Supabase SQL Editor AFTER schema.sql.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- 0. HELPER FUNCTION — is_medical_staff()
-- ════════════════════════════════════════════════════════════
-- Returns true when the current user has role = 'medical_staff' or 'admin'.

create or replace function public.is_medical_staff()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('medical_staff', 'admin')
  );
end;
$$;

comment on function public.is_medical_staff()
  is 'Returns true when the current JWT user has role = medical_staff or admin.';


-- ════════════════════════════════════════════════════════════
-- 1. PATIENTS TABLE
-- ════════════════════════════════════════════════════════════
-- Patient records managed by medical staff.

create table public.patients (
  id           bigint generated always as identity primary key,
  staff_id     uuid           not null references public.profiles(id) on delete cascade,
  patient_name text           not null,
  patient_id   text,                       -- hospital/clinic patient ID (optional)
  age          int,
  gender       text           check (gender in ('male', 'female', 'other', null)),
  contact      text,
  notes        text,
  created_at   timestamptz    not null default now(),
  updated_at   timestamptz    not null default now()
);

comment on table  public.patients              is 'Patient records created and managed by medical staff.';
comment on column public.patients.staff_id     is 'The medical staff member who created this patient record.';
comment on column public.patients.patient_id   is 'External hospital/clinic patient identifier (optional).';

-- Auto-update updated_at
create trigger handle_patients_updated_at
  before update on public.patients
  for each row
  execute function extensions.moddatetime(updated_at);


-- ════════════════════════════════════════════════════════════
-- 2. ADD COLUMNS TO medical_predictions
-- ════════════════════════════════════════════════════════════

-- Link predictions to patients (nullable — general users don't have patients)
alter table public.medical_predictions
  add column if not exists patient_id bigint references public.patients(id) on delete set null;

-- Review status for medical staff workflow
alter table public.medical_predictions
  add column if not exists review_status text not null default 'pending'
  check (review_status in ('pending', 'reviewed', 'confirmed', 'overridden'));

comment on column public.medical_predictions.patient_id     is 'Optional link to a patient record (set by medical staff).';
comment on column public.medical_predictions.review_status  is 'Review workflow status: pending | reviewed | confirmed | overridden.';


-- ════════════════════════════════════════════════════════════
-- 3. STAFF REVIEWS TABLE
-- ════════════════════════════════════════════════════════════
-- Clinical notes, review verdicts, and override records.

create table public.staff_reviews (
  id               bigint generated always as identity primary key,
  prediction_id    bigint         not null references public.medical_predictions(id) on delete cascade,
  reviewer_id      uuid           not null references public.profiles(id) on delete cascade,
  verdict          text           not null check (verdict in ('confirmed', 'overridden')),
  override_class   text,          -- only set when verdict = 'overridden' (e.g., 'NORMAL')
  clinical_notes   text,          -- free-text clinical observations
  created_at       timestamptz    not null default now()
);

comment on table  public.staff_reviews              is 'Medical staff review records for AI predictions.';
comment on column public.staff_reviews.verdict       is 'confirmed = AI was correct; overridden = staff changed the result.';
comment on column public.staff_reviews.override_class is 'The corrected classification when verdict = overridden.';


-- ════════════════════════════════════════════════════════════
-- 4. ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────
-- 4a. patients
-- ────────────────────────────────────────────────────────────
alter table public.patients enable row level security;

-- Medical staff can view their own patients
create policy "Staff can view own patients"
  on public.patients for select
  using (auth.uid() = staff_id);

-- Medical staff can insert patients
create policy "Staff can insert patients"
  on public.patients for insert
  with check (auth.uid() = staff_id and public.is_medical_staff());

-- Medical staff can update their own patients
create policy "Staff can update own patients"
  on public.patients for update
  using (auth.uid() = staff_id and public.is_medical_staff())
  with check (auth.uid() = staff_id);

-- Medical staff can delete their own patients
create policy "Staff can delete own patients"
  on public.patients for delete
  using (auth.uid() = staff_id and public.is_medical_staff());

-- Admins can view all patients
create policy "Admins can view all patients"
  on public.patients for select
  using (public.is_admin());


-- ────────────────────────────────────────────────────────────
-- 4b. staff_reviews
-- ────────────────────────────────────────────────────────────
alter table public.staff_reviews enable row level security;

-- Medical staff can view reviews for scans they are authorized to access
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

-- Medical staff can insert reviews on authorized scans
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

-- Medical staff can update their own reviews
create policy "Staff can update own reviews"
  on public.staff_reviews for update
  using (auth.uid() = reviewer_id and public.is_medical_staff())
  with check (auth.uid() = reviewer_id);

-- Admins can view all reviews
create policy "Admins can view all reviews"
  on public.staff_reviews for select
  using (public.is_admin());


-- ────────────────────────────────────────────────────────────
-- 4c. medical_predictions — strict isolation policies for staff
-- ────────────────────────────────────────────────────────────

-- Medical staff can ONLY view scans of their assigned patients or scans they uploaded
create policy "Staff can view ONLY assigned patient scans"
  on public.medical_predictions for select
  using (
    public.is_admin()
    or (
      public.is_medical_staff()
      and (
        exists (
          select 1
          from public.patients
          where patients.id = medical_predictions.patient_id
            and patients.staff_id = auth.uid()
        )
        or medical_predictions.user_id = auth.uid()
      )
    )
  );

-- Medical staff can ONLY update scans of their assigned patients
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


-- ════════════════════════════════════════════════════════════
-- 4d. SCAN SHARES TABLE (Patient Consent Sharing)
-- ════════════════════════════════════════════════════════════
-- Allows patients to generate one-time share codes (e.g. DV-849201)
-- to securely grant a doctor access to their scan for consultation.

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

alter table public.scan_shares enable row level security;

create policy "Patients can view own scan shares"
  on public.scan_shares for select
  using (auth.uid() = patient_user_id);

create policy "Patients can insert scan shares for own predictions"
  on public.scan_shares for insert
  with check (
    auth.uid() = patient_user_id
    and exists (
      select 1 from public.medical_predictions
      where id = prediction_id and user_id = auth.uid()
    )
  );

create policy "Patients can update own scan shares"
  on public.scan_shares for update
  using (auth.uid() = patient_user_id)
  with check (auth.uid() = patient_user_id);

create policy "Staff can view shares"
  on public.scan_shares for select
  using (public.is_medical_staff() or public.is_admin());

-- RPC for doctors to redeem patient share code
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
  if not (public.is_medical_staff()) then
    return jsonb_build_object('success', false, 'error', 'Unauthorized. Only medical staff can connect patient scans.');
  end if;

  select * into v_patient
  from public.patients
  where id = p_patient_id
    and (staff_id = auth.uid() or public.is_admin());

  if not found then
    return jsonb_build_object('success', false, 'error', 'Selected patient does not exist or is not assigned to your care.');
  end if;

  v_normalized_code := upper(trim(p_share_code));

  select * into v_share
  from public.scan_shares
  where share_code = v_normalized_code
    and status = 'active'
    and expires_at > now();

  if not found then
    return jsonb_build_object('success', false, 'error', 'Invalid, expired, or already claimed share code.');
  end if;

  update public.medical_predictions
  set patient_id = p_patient_id,
      review_status = 'pending'
  where id = v_share.prediction_id;

  update public.scan_shares
  set status = 'claimed',
      claimed_at = now(),
      doctor_id = auth.uid(),
      patient_id = p_patient_id
  where id = v_share.id;

  return jsonb_build_object('success', true, 'prediction_id', v_share.prediction_id, 'patient_name', v_patient.patient_name);
end;
$$;


-- ════════════════════════════════════════════════════════════
-- 5. GRANTS
-- ════════════════════════════════════════════════════════════

grant select, insert, update, delete   on public.patients       to authenticated;
grant select, insert, update           on public.staff_reviews  to authenticated;

-- Allow update on medical_predictions (for review_status)
grant update                           on public.medical_predictions to authenticated;


-- ════════════════════════════════════════════════════════════
-- 6. INDEXES
-- ════════════════════════════════════════════════════════════

create index if not exists idx_patients_staff_id
  on public.patients(staff_id);

create index if not exists idx_predictions_patient_id
  on public.medical_predictions(patient_id);

create index if not exists idx_predictions_review_status
  on public.medical_predictions(review_status);

create index if not exists idx_predictions_is_uncertain
  on public.medical_predictions(is_uncertain);

create index if not exists idx_staff_reviews_prediction_id
  on public.staff_reviews(prediction_id);

create index if not exists idx_staff_reviews_reviewer_id
  on public.staff_reviews(reviewer_id);


-- ────────────────────────────────────────────────────────────
-- 10. STORAGE ACCESS — Allow Medical Staff to View X-Rays
-- ────────────────────────────────────────────────────────────
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

-- ════════════════════════════════════════════════════════════
-- DONE
-- ════════════════════════════════════════════════════════════
-- To promote a user to medical_staff, run:
--   update public.profiles set role = 'medical_staff' where id = '<uuid>';
--
