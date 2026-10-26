import { supabase } from '@/lib/supabase';
import axios from 'axios';

/**
 * DiagnoVision — Admin Service
 * Provides data fetching, role governance, clinical audits, and health diagnostics
 * for the hospital administrator dashboard.
 */

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : 'https://diagnovision-api.onrender.com');

/**
 * Fetch hospital-wide overview statistics.
 */
export async function fetchAdminOverviewStats() {
  try {
    // Query metrics directly from tables for accurate real-time hospital statistics
    const [staffRes, usersRes, scansRes, reviewsRes, uncertainRes, normalRes, pneumoniaRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'medical_staff'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('medical_predictions').select('id', { count: 'exact', head: true }),
      supabase.from('staff_reviews').select('verdict'),
      supabase.from('medical_predictions').select('id', { count: 'exact', head: true }).eq('is_uncertain', true),
      supabase.from('medical_predictions').select('id', { count: 'exact', head: true }).eq('predicted_class', 'NORMAL'),
      supabase.from('medical_predictions').select('id', { count: 'exact', head: true }).eq('predicted_class', 'PNEUMONIA'),
    ]);

    const reviews = reviewsRes.data || [];
    const totalReviews = reviews.length;
    const confirmedReviews = reviews.filter(r => r.verdict === 'confirmed').length;
    const overriddenReviews = reviews.filter(r => r.verdict === 'overridden').length;
    const concordanceRate = totalReviews > 0 ? Number(((confirmedReviews / totalReviews) * 100).toFixed(1)) : 100.0;

    return {
      data: {
        total_users: usersRes.count || 0,
        total_staff: staffRes.count || 0,
        total_scans: scansRes.count || 0,
        total_reviews: totalReviews,
        confirmed_reviews: confirmedReviews,
        overridden_reviews: overriddenReviews,
        uncertain_scans: uncertainRes.count || 0,
        normal_scans: normalRes.count || 0,
        pneumonia_scans: pneumoniaRes.count || 0,
        concordance_rate: concordanceRate,
        scans_today: 0,
      },
      error: null,
    };
  } catch (err) {
    console.error('[adminService] fetchAdminOverviewStats error:', err);
    return { data: null, error: err.message || 'Failed to load admin stats' };
  }
}

/**
 * Fetch registered users roster with filtering and pagination.
 */
export async function fetchAdminUsers({ search = '', role = 'all', page = 1, limit = 50 }) {
  try {
    const offset = (page - 1) * limit;
    const { data, error } = await supabase.rpc('admin_get_users', {
      p_search: search || null,
      p_role: role === 'all' ? null : role,
      p_limit: limit,
      p_offset: offset,
    });

    if (!error && data?.success) {
      return { users: data.users || [], total: data.total || 0, error: null };
    }

    // Direct table query fallback
    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' });

    if (role && role !== 'all') {
      query = query.eq('role', role);
    }
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: profiles, count, error: profileErr } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (profileErr) throw profileErr;

    return {
      users: (profiles || []).map(p => ({
        ...p,
        email: p.email || 'No email recorded',
        scans_count: 0,
        patients_count: 0,
      })),
      total: count || 0,
      error: null,
    };
  } catch (err) {
    console.error('[adminService] fetchAdminUsers error:', err);
    return { users: [], total: 0, error: err.message || 'Failed to fetch users' };
  }
}

/**
 * Update a user's role (promote/demote).
 */
export async function updateUserRole({ userId, role }) {
  try {
    // Security Policy: Never allow promoting accounts to admin via user governance
    if (role === 'admin') {
      return { data: null, error: 'Security Violation: Cannot promote users to Administrator.' };
    }

    if (role !== 'general' && role !== 'medical_staff') {
      return { data: null, error: 'Invalid role. Only General User and Medical Staff are permitted.' };
    }

    // Verify target user is not an administrator
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (targetProfile?.role === 'admin') {
      return { data: null, error: 'Security Violation: Administrator accounts are permanent and cannot be modified.' };
    }

    const { data, error } = await supabase.rpc('admin_update_user_role', {
      p_user_id: userId,
      p_role: role,
    });

    if (!error && data?.success) {
      return { data, error: null };
    }

    if (error?.message) {
      return { data: null, error: error.message };
    }

    // Direct update fallback (strictly excludes admin accounts)
    const { data: updateData, error: updateErr } = await supabase
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .neq('role', 'admin')
      .select()
      .single();

    if (updateErr) throw updateErr;
    return { data: updateData, error: null };
  } catch (err) {
    console.error('[adminService] updateUserRole error:', err);
    return { data: null, error: err.message || 'Failed to update user role' };
  }
}

/**
 * Toggle user active/suspended status.
 */
export async function toggleUserStatus({ userId, status }) {
  try {
    const { data, error } = await supabase.rpc('admin_toggle_user_status', {
      p_user_id: userId,
      p_status: status,
    });

    if (!error && data?.success) {
      return { data, error: null };
    }

    const { data: updateData, error: updateErr } = await supabase
      .from('profiles')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();

    if (updateErr) throw updateErr;
    return { data: updateData, error: null };
  } catch (err) {
    console.error('[adminService] toggleUserStatus error:', err);
    return { data: null, error: err.message || 'Failed to change user status' };
  }
}

/**
 * Fetch hospital-wide clinical audit logs.
 */
export async function fetchAdminAuditLogs({ limit = 50 } = {}) {
  try {
    const { data, error } = await supabase.rpc('admin_get_audit_logs', { p_limit: limit });
    if (!error && data?.success) {
      return { logs: data.logs || [], error: null };
    }

    // Direct join fallback
    const { data: reviews, error: revErr } = await supabase
      .from('staff_reviews')
      .select(`
        id, verdict, override_class, clinical_notes, created_at, prediction_id, reviewer_id,
        medical_predictions (id, predicted_class, confidence_score, patient_id, patients (patient_name))
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (revErr) throw revErr;

    const formatted = (reviews || []).map(r => ({
      id: r.id,
      prediction_id: r.prediction_id,
      verdict: r.verdict,
      override_class: r.override_class,
      clinical_notes: r.clinical_notes,
      created_at: r.created_at,
      reviewer_name: 'Staff Reviewer',
      reviewer_email: 'Staff',
      predicted_class: r.medical_predictions?.predicted_class || 'UNKNOWN',
      confidence_score: r.medical_predictions?.confidence_score || 0,
      patient_name: r.medical_predictions?.patients?.patient_name || 'Direct Upload',
    }));

    return { logs: formatted, error: null };
  } catch (err) {
    console.error('[adminService] fetchAdminAuditLogs error:', err);
    return { logs: [], error: err.message || 'Failed to fetch audit logs' };
  }
}

/**
 * Check backend system health and measure live round-trip latency.
 */
export async function checkSystemHealth() {
  const start = performance.now();
  try {
    const response = await axios.get(`${API_BASE}/api/health`, { timeout: 15000 });
    const latency = Math.round(performance.now() - start);

    return {
      online: true,
      latencyMs: latency,
      data: response.data,
      apiBase: API_BASE,
      error: null,
    };
  } catch (err) {
    const latency = Math.round(performance.now() - start);
    return {
      online: false,
      latencyMs: latency,
      data: null,
      apiBase: API_BASE,
      error: err.message || 'Backend unreachable',
    };
  }
}

/**
 * Fetch all hospital predictions across all patients for admin oversight.
 */
export async function fetchAdminPredictions({
  page = 1,
  limit = 20,
  status = 'all',
  classification = 'all',
  uncertain = 'all',
  search = '',
  searchTarget = 'patient_name',
  onlyMyUploads = false,
  currentUserId = null,
} = {}) {
  try {
    const isSearching = !!(search && search.trim());
    // When searching, fetch up to 300 latest hospital records so search matches across all pages
    const fetchLimit = isSearching ? 300 : limit;
    const fetchFrom = isSearching ? 0 : (page - 1) * limit;
    const fetchTo = fetchFrom + fetchLimit - 1;

    let query = supabase
      .from('medical_predictions')
      .select(`
        *,
        patients (id, patient_name, patient_id),
        profiles:user_id (id, full_name, email, role),
        staff_reviews (id, verdict, override_class, clinical_notes, created_at, reviewer_id)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (onlyMyUploads && currentUserId) {
      query = query.eq('user_id', currentUserId);
    }
    if (status !== 'all') {
      query = query.eq('review_status', status);
    }
    if (classification !== 'all') {
      query = query.eq('predicted_class', classification);
    }
    if (uncertain === 'yes') {
      query = query.eq('is_uncertain', true);
    } else if (uncertain === 'no') {
      query = query.eq('is_uncertain', false);
    }

    const { data, error, count } = await query.range(fetchFrom, fetchTo);
    if (error) throw error;

    let filtered = data || [];
    if (isSearching) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(item => {
        const patientName = (item.patients?.patient_name || '').toLowerCase();
        const profileName = (item.profiles?.full_name || '').toLowerCase();
        const profileEmail = (item.profiles?.email || '').toLowerCase();
        const hospitalPid = (item.patients?.patient_id || '').toLowerCase();
        const scanId = String(item.id || '');

        if (searchTarget === 'patient_name') {
          // Strictly match Patient Name (or direct intake uploader if unlinked)
          // NEVER matches predicted_class (PNEUMONIA) or hospital PID to prevent false positives
          if (item.patients?.patient_name) {
            return patientName.includes(q);
          }
          return profileName.includes(q) || profileEmail.includes(q);
        }

        if (searchTarget === 'uploader') {
          // Strictly match Uploader's Full Name or Email
          return profileName.includes(q) || profileEmail.includes(q);
        }

        if (searchTarget === 'patient_id') {
          // Strictly match Hospital Patient ID (e.g. PID002)
          return hospitalPid.includes(q);
        }

        if (searchTarget === 'scan_id') {
          // Strictly match Scan ID
          const cleanQ = q.replace(/^#/, '').trim();
          return scanId === cleanQ || scanId.includes(cleanQ);
        }

        // 'all' mode: matches patient name, profile name, email, hospital PID, or exact scan ID
        // Note: NEVER matches predicted_class (PNEUMONIA / NORMAL) because that would match everything
        const cleanQ = q.replace(/^#/, '').trim();
        return (
          patientName.includes(q) ||
          profileName.includes(q) ||
          profileEmail.includes(q) ||
          hospitalPid.includes(q) ||
          scanId === cleanQ
        );
      });

      const totalFiltered = filtered.length;
      const paginated = filtered.slice((page - 1) * limit, page * limit);
      return {
        data: paginated,
        error: null,
        count: totalFiltered,
        hasMore: totalFiltered > page * limit,
      };
    }

    return { data: filtered, error: null, count: count || 0, hasMore: (count || 0) > fetchTo + 1 };
  } catch (err) {
    console.error('[adminService] fetchAdminPredictions error:', err);
    return { data: [], error: err.message || 'Failed to fetch predictions', count: 0, hasMore: false };
  }
}

