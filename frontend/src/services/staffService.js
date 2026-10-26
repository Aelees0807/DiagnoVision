/**
 * DiagnoVision — Medical Staff Service
 * All Supabase operations for the Medical Staff module.
 * Handles patients, predictions (staff view), reviews, and analytics.
 */

import { supabase } from '@/lib/supabase';

// ── Patient Operations ──────────────────────────────────────

/**
 * Fetch all patients belonging to the current staff member.
 * @param {{ search?: string, page?: number, limit?: number }} opts
 */
export async function fetchPatients({ search = '', page = 1, limit = 20 } = {}) {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('patients')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (search) {
    query = query.or(`patient_name.ilike.%${search}%,patient_id.ilike.%${search}%`);
  }

  const { data, error, count } = await query;
  return { data, error, count, hasMore: count > to + 1 };
}

/**
 * Create a new patient record.
 */
export async function createPatient({ patientName, patientId, age, gender, contact, notes }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('patients')
    .insert({
      staff_id: user.id,
      patient_name: patientName,
      patient_id: patientId || null,
      age: age || null,
      gender: gender || null,
      contact: contact || null,
      notes: notes || null,
    })
    .select()
    .single();

  return { data, error };
}

/**
 * Update an existing patient record.
 */
export async function updatePatient(id, updates) {
  const { data, error } = await supabase
    .from('patients')
    .update({
      patient_name: updates.patientName,
      patient_id: updates.patientId || null,
      age: updates.age || null,
      gender: updates.gender || null,
      contact: updates.contact || null,
      notes: updates.notes || null,
    })
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

/**
 * Delete a patient record.
 */
export async function deletePatient(id) {
  const { error } = await supabase
    .from('patients')
    .delete()
    .eq('id', id);

  return { error };
}


// ── Prediction Operations (Staff View) ──────────────────────

/**
 * Fetch predictions visible to medical staff with privacy scoping.
 * Supports filtering by doctor's assigned patients, unassigned triage pool, or all.
 * @param {{ page, limit, status, classification, uncertain, dateFrom, dateTo, patientId, search, scope }} opts
 */
export async function fetchStaffPredictions({
  page = 1,
  limit = 15,
  status = 'all',
  classification = 'all',
  uncertain = 'all',
  dateFrom = null,
  dateTo = null,
  patientId = null,
  search = '',
  scope = 'my_patients', // 'my_patients' | 'unassigned' | 'all'
} = {}) {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('medical_predictions')
    .select(`
      *,
      patients (id, patient_name, patient_id),
      profiles:user_id (id, full_name, email, role),
      staff_reviews (id, verdict, override_class, clinical_notes, created_at, reviewer_id)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  // Privacy Scope: My Patients vs Unassigned Intake Queue
  if (scope === 'my_patients') {
    // Only scans linked to an assigned patient (RLS restricts to current doctor's patients)
    query = query.not('patient_id', 'is', null);
  } else if (scope === 'unassigned') {
    // Triage pool: Scans not yet linked to any patient record
    query = query.is('patient_id', null);
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

  if (dateFrom) {
    query = query.gte('created_at', dateFrom);
  }
  if (dateTo) {
    query = query.lte('created_at', dateTo);
  }

  if (patientId) {
    query = query.eq('patient_id', patientId);
  }

  const { data, error, count } = await query;
  return { data, error, count, hasMore: count > to + 1 };
}

/**
 * Fetch a single prediction with full details.
 */
export async function fetchPredictionDetail(predictionId) {
  const { data, error } = await supabase
    .from('medical_predictions')
    .select(`
      *,
      patients (id, patient_name, patient_id, age, gender),
      profiles:user_id (id, full_name, email, role),
      staff_reviews (id, verdict, override_class, clinical_notes, created_at, reviewer_id)
    `)
    .eq('id', predictionId)
    .single();

  return { data, error };
}

/**
 * Update the review_status of a prediction.
 */
export async function updatePredictionStatus(predictionId, reviewStatus) {
  const { data, error } = await supabase
    .from('medical_predictions')
    .update({ review_status: reviewStatus })
    .eq('id', predictionId)
    .select()
    .single();

  return { data, error };
}

/**
 * Link a prediction to a patient.
 */
export async function linkPredictionToPatient(predictionId, patientId) {
  const { data, error } = await supabase
    .from('medical_predictions')
    .update({ patient_id: patientId })
    .eq('id', predictionId)
    .select()
    .single();

  return { data, error };
}

/**
 * Connect a patient's scan to a doctor's patient record using a secure patient share code.
 * Calls the secure RPC 'connect_shared_scan'.
 */
export async function connectPatientScanByCode({ shareCode, patientId }) {
  const { data, error } = await supabase.rpc('connect_shared_scan', {
    p_share_code: shareCode.trim().toUpperCase(),
    p_patient_id: parseInt(patientId),
  });

  if (error) {
    return { data: null, error: error.message };
  }

  if (data && !data.success) {
    return { data: null, error: data.error };
  }

  return { data, error: null };
}


// ── Staff Review Operations ──────────────────────────────────

/**
 * Submit a review for a prediction (confirm or override).
 * Also updates the prediction's review_status.
 */
export async function submitReview({ predictionId, verdict, overrideClass, clinicalNotes }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Insert the review
  const { data: review, error: reviewError } = await supabase
    .from('staff_reviews')
    .insert({
      prediction_id: predictionId,
      reviewer_id: user.id,
      verdict,
      override_class: verdict === 'overridden' ? overrideClass : null,
      clinical_notes: clinicalNotes || null,
    })
    .select()
    .single();

  if (reviewError) return { data: null, error: reviewError };

  // Update prediction status
  const { error: statusError } = await supabase
    .from('medical_predictions')
    .update({ review_status: verdict })
    .eq('id', predictionId);

  if (statusError) {
    console.error('[StaffService] Error updating prediction status:', statusError);
  }

  return { data: review, error: null };
}

/**
 * Fetch all reviews for a specific prediction.
 */
export async function fetchReviewsForPrediction(predictionId) {
  const { data, error } = await supabase
    .from('staff_reviews')
    .select('*, profiles:reviewer_id (full_name, role)')
    .eq('prediction_id', predictionId)
    .order('created_at', { ascending: false });

  return { data, error };
}


// ── Dashboard Analytics ──────────────────────────────────────

/**
 * Get dashboard stats for the current medical staff member.
 * Differentiates between assigned patient scans and the hospital's unassigned intake queue.
 */
export async function fetchDashboardStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  // 1. Assigned Patients — Scans today
  const { count: scansToday } = await supabase
    .from('medical_predictions')
    .select('*', { count: 'exact', head: true })
    .not('patient_id', 'is', null)
    .gte('created_at', todayISO);

  // 2. Assigned Patients — Pending reviews
  const { count: pendingReviews } = await supabase
    .from('medical_predictions')
    .select('*', { count: 'exact', head: true })
    .not('patient_id', 'is', null)
    .eq('review_status', 'pending');

  // 3. Assigned Patients — Flagged (uncertain) cases
  const { count: flaggedCases } = await supabase
    .from('medical_predictions')
    .select('*', { count: 'exact', head: true })
    .not('patient_id', 'is', null)
    .eq('is_uncertain', true)
    .eq('review_status', 'pending');

  // 4. Total patients registered under this doctor
  const { count: totalPatients } = await supabase
    .from('patients')
    .select('*', { count: 'exact', head: true });

  // 5. Total assigned scans ever
  const { count: totalScans } = await supabase
    .from('medical_predictions')
    .select('*', { count: 'exact', head: true })
    .not('patient_id', 'is', null);

  // Recent predictions (last 5 assigned to this doctor)
  const { data: recentScans } = await supabase
    .from('medical_predictions')
    .select(`
      id, predicted_class, confidence_score, is_uncertain, review_status, created_at, patient_id,
      patients (id, patient_name, patient_id)
    `)
    .not('patient_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);

  // Classification distribution for doctor's assigned patients
  const { data: allPredictions } = await supabase
    .from('medical_predictions')
    .select('predicted_class, is_uncertain, review_status')
    .not('patient_id', 'is', null);

  const distribution = {
    NORMAL: 0,
    PNEUMONIA: 0,
    uncertain: 0,
    reviewed: 0,
  };

  if (allPredictions) {
    allPredictions.forEach(p => {
      if (p.predicted_class === 'NORMAL') distribution.NORMAL++;
      if (p.predicted_class === 'PNEUMONIA') distribution.PNEUMONIA++;
      if (p.is_uncertain) distribution.uncertain++;
      if (p.review_status !== 'pending') distribution.reviewed++;
    });
  }

  return {
    scansToday: scansToday || 0,
    pendingReviews: pendingReviews || 0,
    flaggedCases: flaggedCases || 0,
    totalPatients: totalPatients || 0,
    totalScans: totalScans || 0,
    recentScans: recentScans || [],
    distribution,
  };
}
