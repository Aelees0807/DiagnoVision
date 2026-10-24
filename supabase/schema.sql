-- ============================================================
-- DiagnoVision — Supabase Schema  (Phase 1)
-- Run this entire file in the Supabase SQL Editor.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 0. EXTENSIONS
-- ────────────────────────────────────────────────────────────
-- moddatetime auto-updates "updated_at" columns on row change.
create extension if not exists moddatetime schema extensions;


-- ════════════════════════════════════════════════════════════
-- 1. TABLES
-- ════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────
-- 1a. profiles
--     One row per authenticated user, auto-created by trigger.
--     "role" gates access: general (default), medical_staff, admin.
-- ────────────────────────────────────────────────────────────
create table public.profiles (
  id         uuid        primary key references auth.users(id) on delete cascade,
  full_name  text,
  role       text        not null default 'general'
                         check (role in ('general', 'medical_staff', 'admin')),
  status     boolean     not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table  public.profiles          is 'User profile, one-to-one with auth.users.';
comment on column public.profiles.role     is 'Access tier: general | medical_staff | admin.';
comment on column public.profiles.status   is 'Soft-disable flag (false = deactivated by admin).';

-- Auto-update updated_at on every edit.
create trigger handle_profiles_updated_at
  before update on public.profiles
  for each row
  execute function extensions.moddatetime(updated_at);


-- ────────────────────────────────────────────────────────────
-- 1b. medical_predictions
--     Stores each saved screening result for a logged-in user.
-- ────────────────────────────────────────────────────────────
create table public.medical_predictions (
  id               bigint generated always as identity primary key,
  user_id          uuid           not null references public.profiles(id) on delete cascade,
  image_path       text,                          -- path inside the 'xrays' storage bucket
  heatmap_path     text,                          -- path inside the 'xrays' storage bucket
  predicted_class  text           not null,       -- e.g. 'NORMAL', 'PNEUMONIA'
  confidence_score double precision not null,     -- 0-100 percentage
  is_uncertain     boolean        not null default false,  -- true when confidence < 70%
  created_at       timestamptz    not null default now()
);

comment on table  public.medical_predictions              is 'AI-assisted screening results saved by authenticated users.';
comment on column public.medical_predictions.is_uncertain is 'Flagged true when the model abstained (confidence < 70%).';
comment on column public.medical_predictions.image_path   is 'Object path in the xrays storage bucket (<uid>/images/...).';
comment on column public.medical_predictions.heatmap_path is 'Object path in the xrays storage bucket (<uid>/heatmaps/...).';


-- ────────────────────────────────────────────────────────────
-- 1c. disease_info
--     Reference table: plain-language descriptions for each
--     class the model can output. Readable by everyone,
--     writable only by admins.
-- ────────────────────────────────────────────────────────────
create table public.disease_info (
  id                 bigint generated always as identity primary key,
  class_name         text   unique not null,       -- matches predicted_class values
  description        text   not null,
  affected_area      text   not null,
  cause              text   not null,
  recommended_action text   not null
);

comment on table public.disease_info is 'Plain-language screening information for each model output class.';


-- ────────────────────────────────────────────────────────────
-- 1d. feedback
--     Optional user feedback on a screening result.
-- ────────────────────────────────────────────────────────────
create table public.feedback (
  id            bigint generated always as identity primary key,
  user_id       uuid   references public.profiles(id),
  prediction_id bigint references public.medical_predictions(id) on delete cascade,
  rating        int    not null check (rating >= 1 and rating <= 5),
  feedback_text text,
  created_at    timestamptz not null default now()
);

comment on table public.feedback is 'User-submitted feedback and ratings on individual screening results.';


-- ════════════════════════════════════════════════════════════
-- 2. TRIGGER — auto-create profile on sign-up
-- ════════════════════════════════════════════════════════════
-- Fires after every INSERT on auth.users.
-- Copies the user's full_name from the sign-up metadata (if provided).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer          -- runs with table-owner privileges
set search_path = ''      -- hardened: prevents search_path hijack
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$;

comment on function public.handle_new_user()
  is 'Auto-creates a profiles row when a new auth.users row is inserted.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();


-- ════════════════════════════════════════════════════════════
-- 3. HELPER FUNCTION — is_admin()
-- ════════════════════════════════════════════════════════════
-- Security-definer function so RLS policies can check admin
-- status without granting direct SELECT on profiles to anon.

create or replace function public.is_admin()
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
      and role = 'admin'
  );
end;
$$;

comment on function public.is_admin()
  is 'Returns true when the current JWT user has role = admin in profiles.';


-- ════════════════════════════════════════════════════════════
-- 4. ROW LEVEL SECURITY (RLS)
-- ════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────
-- 4a. profiles
-- ────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

-- Users can read their own profile.
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Users can update their own profile, but NOT their role.
-- The WITH CHECK ensures the role column remains unchanged.
create policy "Users can update own profile except role"
  on public.profiles for update
  using  (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );

-- Admins can view every profile (for the admin dashboard).
create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin());


-- ────────────────────────────────────────────────────────────
-- 4b. medical_predictions
-- ────────────────────────────────────────────────────────────
alter table public.medical_predictions enable row level security;

-- Users can view their own predictions.
create policy "Users can view own predictions"
  on public.medical_predictions for select
  using (auth.uid() = user_id);

-- Users can insert their own predictions.
create policy "Users can insert own predictions"
  on public.medical_predictions for insert
  with check (auth.uid() = user_id);

-- Users can delete their own predictions.
create policy "Users can delete own predictions"
  on public.medical_predictions for delete
  using (auth.uid() = user_id);

-- Admins can view all predictions.
create policy "Admins can view all predictions"
  on public.medical_predictions for select
  using (public.is_admin());


-- ────────────────────────────────────────────────────────────
-- 4c. disease_info
-- ────────────────────────────────────────────────────────────
alter table public.disease_info enable row level security;

-- Everyone (including anonymous / guest users) can read disease info.
create policy "Anyone can read disease info"
  on public.disease_info for select
  using (true);

-- Only admins can insert disease info.
create policy "Admins can insert disease info"
  on public.disease_info for insert
  with check (public.is_admin());

-- Only admins can update disease info.
create policy "Admins can update disease info"
  on public.disease_info for update
  using  (public.is_admin())
  with check (public.is_admin());

-- Only admins can delete disease info.
create policy "Admins can delete disease info"
  on public.disease_info for delete
  using (public.is_admin());


-- ────────────────────────────────────────────────────────────
-- 4d. feedback
-- ────────────────────────────────────────────────────────────
alter table public.feedback enable row level security;

-- Users can view their own feedback.
create policy "Users can view own feedback"
  on public.feedback for select
  using (auth.uid() = user_id);

-- Users can insert their own feedback.
create policy "Users can insert own feedback"
  on public.feedback for insert
  with check (auth.uid() = user_id);

-- Users can delete their own feedback.
create policy "Users can delete own feedback"
  on public.feedback for delete
  using (auth.uid() = user_id);

-- Admins can view all feedback.
create policy "Admins can view all feedback"
  on public.feedback for select
  using (public.is_admin());


-- ════════════════════════════════════════════════════════════
-- 5. STORAGE — private 'xrays' bucket
-- ════════════════════════════════════════════════════════════
-- Bucket is PRIVATE (no public URLs).
-- Objects are namespaced: <user_uid>/images/..., <user_uid>/heatmaps/...

insert into storage.buckets (id, name, public)
values ('xrays', 'xrays', false)
on conflict (id) do nothing;

-- Authenticated users can upload into their own UID folder.
create policy "Users can upload to own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'xrays'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can read their own objects.
create policy "Users can read own objects"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'xrays'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can update (overwrite) their own objects.
create policy "Users can update own objects"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'xrays'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can delete their own objects.
create policy "Users can delete own objects"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'xrays'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ════════════════════════════════════════════════════════════
-- 6. SEED DATA — disease_info
-- ════════════════════════════════════════════════════════════
-- Plain-language, screening-style wording.
-- These match the CLASS_NAMES in backend/config.py: NORMAL, PNEUMONIA.

insert into public.disease_info (class_name, description, affected_area, cause, recommended_action)
values
  (
    'NORMAL',
    'The AI-assisted screening found no signs consistent with pneumonia in this chest X-ray. Lung fields appear within expected limits for this automated analysis.',
    'Lungs (bilateral)',
    'N/A — no abnormality indicated by this screening.',
    'No immediate follow-up is suggested by this screening. Continue routine check-ups as recommended by your healthcare provider. This result does not replace a professional radiological evaluation.'
  ),
  (
    'PNEUMONIA',
    'The AI-assisted screening identified signs consistent with pneumonia in this chest X-ray. Areas of increased opacity were noted, which may suggest an inflammatory process in the lung tissue.',
    'Lungs — one or both lung fields may show areas of consolidation or opacity.',
    'Pneumonia can be caused by bacterial, viral, or fungal infections. The most common bacterial cause is Streptococcus pneumoniae. This screening cannot distinguish between bacterial and viral origins.',
    'Please consult a qualified healthcare professional for clinical correlation and further evaluation. Additional tests (blood work, sputum culture, or CT scan) may be recommended. This AI-assisted screening is not a diagnosis and should not be used as the sole basis for treatment decisions.'
  );


-- ════════════════════════════════════════════════════════════
-- 7. GRANTS
-- ════════════════════════════════════════════════════════════
-- Allow the PostgREST roles (anon and authenticated) to
-- access the tables through the Supabase JS client.
-- RLS policies above still control row-level access.

grant usage on schema public to anon, authenticated;

grant select                           on public.disease_info          to anon, authenticated;
grant select, update                   on public.profiles              to authenticated;
grant select, insert, delete           on public.medical_predictions   to authenticated;
grant select, insert, delete           on public.feedback              to authenticated;

-- Admin writes to disease_info are controlled by RLS;
-- we grant the DML privileges broadly and let policies decide.
grant insert, update, delete           on public.disease_info          to authenticated;


-- ════════════════════════════════════════════════════════════
-- DONE — Manual admin promotion
-- ════════════════════════════════════════════════════════════
-- To promote a user to admin, run this in the SQL editor
-- (replace <uuid> with the user's auth.users id):
--
--   update public.profiles set role = 'admin' where id = '<uuid>';
--
