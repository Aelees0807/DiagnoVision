-- ============================================================
-- DiagnoVision — Admin Dashboard Migration
-- 1. Adds email column to public.profiles and syncs with auth.users
-- 2. Grants Admins update permissions on profiles
-- 3. Provides high-performance Admin RPC functions for:
--    - Overview statistics (scans, concordance, user counts)
--    - User management (search, list with scan/patient counts)
--    - Role promotion/demotion and status toggling
--    - Clinical review audit logs
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. PROFILES ENHANCEMENT (Email column & sync)
-- ────────────────────────────────────────────────────────────

alter table public.profiles add column if not exists email text;

-- Backfill emails from auth.users
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and (p.email is null or p.email = '');

-- Update trigger function to record email on new user sign-up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = case when public.profiles.full_name is null or public.profiles.full_name = '' then excluded.full_name else public.profiles.full_name end;
  return new;
end;
$$;


-- ────────────────────────────────────────────────────────────
-- 2. ADMIN RLS POLICIES ON PROFILES
-- ────────────────────────────────────────────────────────────

drop policy if exists "Admins can update all profiles" on public.profiles;
create policy "Admins can update all profiles"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());


-- ────────────────────────────────────────────────────────────
-- 3. SECURE ADMIN RPC — admin_get_overview_stats()
-- ────────────────────────────────────────────────────────────

create or replace function public.admin_get_overview_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_users bigint;
  v_total_staff bigint;
  v_total_scans bigint;
  v_total_patients bigint;
  v_total_reviews bigint;
  v_confirmed_reviews bigint;
  v_overridden_reviews bigint;
  v_uncertain_scans bigint;
  v_normal_scans bigint;
  v_pneumonia_scans bigint;
  v_scans_today bigint;
  v_concordance_rate numeric;
begin
  if not (public.is_admin()) then
    return jsonb_build_object('success', false, 'error', 'Unauthorized. Only administrators can view hospital statistics.');
  end if;

  select count(*) into v_total_users from public.profiles;
  select count(*) into v_total_staff from public.profiles where role = 'medical_staff';
  select count(*) into v_total_scans from public.medical_predictions;
  select count(*) into v_total_patients from public.patients;
  
  select count(*) into v_uncertain_scans from public.medical_predictions where is_uncertain = true;
  select count(*) into v_normal_scans from public.medical_predictions where predicted_class = 'NORMAL';
  select count(*) into v_pneumonia_scans from public.medical_predictions where predicted_class = 'PNEUMONIA';
  select count(*) into v_scans_today from public.medical_predictions where created_at >= date_trunc('day', now());

  select 
    count(*),
    count(*) filter (where verdict = 'confirmed'),
    count(*) filter (where verdict = 'overridden')
  into v_total_reviews, v_confirmed_reviews, v_overridden_reviews
  from public.staff_reviews;

  if v_total_reviews > 0 then
    v_concordance_rate := round((v_confirmed_reviews::numeric / v_total_reviews::numeric) * 100, 1);
  else
    v_concordance_rate := 100.0;
  end if;

  return jsonb_build_object(
    'success', true,
    'total_users', v_total_users,
    'total_staff', v_total_staff,
    'total_scans', v_total_scans,
    'total_patients', v_total_patients,
    'total_reviews', v_total_reviews,
    'confirmed_reviews', v_confirmed_reviews,
    'overridden_reviews', v_overridden_reviews,
    'uncertain_scans', v_uncertain_scans,
    'normal_scans', v_normal_scans,
    'pneumonia_scans', v_pneumonia_scans,
    'scans_today', v_scans_today,
    'concordance_rate', v_concordance_rate
  );
end;
$$;


-- ────────────────────────────────────────────────────────────
-- 4. SECURE ADMIN RPC — admin_get_users()
-- ────────────────────────────────────────────────────────────

create or replace function public.admin_get_users(
  p_search text default null,
  p_role text default null,
  p_limit int default 50,
  p_offset int default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_total bigint;
begin
  if not (public.is_admin()) then
    return jsonb_build_object('success', false, 'error', 'Unauthorized. Only administrators can view user roster.');
  end if;

  -- Count total matching
  select count(*) into v_total
  from public.profiles p
  where (p_search is null or p_search = '' or p.full_name ilike '%' || p_search || '%' or p.email ilike '%' || p_search || '%')
    and (p_role is null or p_role = 'all' or p.role = p_role);

  -- Fetch matching rows
  select jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'email', coalesce(p.email, 'No email recorded'),
      'role', p.role,
      'status', p.status,
      'created_at', p.created_at,
      'scans_count', (select count(*) from public.medical_predictions mp where mp.user_id = p.id),
      'patients_count', (select count(*) from public.patients pt where pt.staff_id = p.id)
    ) order by p.created_at desc
  ) into v_result
  from (
    select *
    from public.profiles p
    where (p_search is null or p_search = '' or p.full_name ilike '%' || p_search || '%' or p.email ilike '%' || p_search || '%')
      and (p_role is null or p_role = 'all' or p.role = p_role)
    order by p.created_at desc
    limit p_limit
    offset p_offset
  ) p;

  return jsonb_build_object(
    'success', true,
    'total', v_total,
    'users', coalesce(v_result, '[]'::jsonb)
  );
end;
$$;


-- ────────────────────────────────────────────────────────────
-- 5. SECURE ADMIN RPC — admin_update_user_role()
-- ────────────────────────────────────────────────────────────

create or replace function public.admin_update_user_role(
  p_user_id uuid,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_role text;
begin
  if not (public.is_admin()) then
    return jsonb_build_object('success', false, 'error', 'Unauthorized. Only administrators can assign roles.');
  end if;

  -- Security Policy: Role governance only permits switching between general user and medical_staff
  if p_role not in ('general', 'medical_staff') then
    return jsonb_build_object('success', false, 'error', 'Security Violation: Cannot promote accounts to Administrator.');
  end if;

  -- Security Policy: Administrator roles are immutable and cannot be demoted
  select role into v_current_role from public.profiles where id = p_user_id;
  if v_current_role = 'admin' then
    return jsonb_build_object('success', false, 'error', 'Security Violation: Administrator accounts cannot be modified or demoted.');
  end if;

  update public.profiles
  set role = p_role,
      updated_at = now()
  where id = p_user_id;

  return jsonb_build_object('success', true, 'user_id', p_user_id, 'new_role', p_role);
end;
$$;


-- ────────────────────────────────────────────────────────────
-- 6. SECURE ADMIN RPC — admin_toggle_user_status()
-- ────────────────────────────────────────────────────────────

create or replace function public.admin_toggle_user_status(
  p_user_id uuid,
  p_status boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_admin()) then
    return jsonb_build_object('success', false, 'error', 'Unauthorized. Only administrators can change user status.');
  end if;

  -- Prevent admin from disabling themselves
  if p_user_id = auth.uid() and p_status = false then
    return jsonb_build_object('success', false, 'error', 'You cannot deactivate your own administrator account.');
  end if;

  update public.profiles
  set status = p_status,
      updated_at = now()
  where id = p_user_id;

  return jsonb_build_object('success', true, 'user_id', p_user_id, 'new_status', p_status);
end;
$$;


-- ────────────────────────────────────────────────────────────
-- 7. SECURE ADMIN RPC — admin_get_audit_logs()
-- ────────────────────────────────────────────────────────────

create or replace function public.admin_get_audit_logs(
  p_limit int default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_logs jsonb;
begin
  if not (public.is_admin()) then
    return jsonb_build_object('success', false, 'error', 'Unauthorized. Only administrators can view audit logs.');
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'id', sr.id,
      'prediction_id', sr.prediction_id,
      'verdict', sr.verdict,
      'override_class', sr.override_class,
      'clinical_notes', sr.clinical_notes,
      'created_at', sr.created_at,
      'reviewer_name', coalesce(p.full_name, 'Staff Member'),
      'reviewer_email', coalesce(p.email, 'Unknown'),
      'predicted_class', mp.predicted_class,
      'confidence_score', mp.confidence_score,
      'patient_name', coalesce(pt.patient_name, 'Direct Upload')
    ) order by sr.created_at desc
  ) into v_logs
  from (
    select * from public.staff_reviews
    order by created_at desc
    limit p_limit
  ) sr
  left join public.profiles p on p.id = sr.reviewer_id
  left join public.medical_predictions mp on mp.id = sr.prediction_id
  left join public.patients pt on pt.id = mp.patient_id;

  return jsonb_build_object(
    'success', true,
    'logs', coalesce(v_logs, '[]'::jsonb)
  );
end;
$$;


-- ────────────────────────────────────────────────────────────
-- 8. GRANTS
-- ────────────────────────────────────────────────────────────

grant execute on function public.admin_get_overview_stats() to authenticated;
grant execute on function public.admin_get_users(text, text, int, int) to authenticated;
grant execute on function public.admin_update_user_role(uuid, text) to authenticated;
grant execute on function public.admin_toggle_user_status(uuid, boolean) to authenticated;
grant execute on function public.admin_get_audit_logs(int) to authenticated;
