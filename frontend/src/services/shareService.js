/**
 * DiagnoVision — Patient Scan Sharing Service
 * Allows patients to generate secure, time-limited share codes (e.g. DV-849201)
 * so doctors can connect and review their scans with explicit consent.
 */

import { supabase } from '@/lib/supabase';

/**
 * Generate a random 6-character alphanumeric code formatted as DV-XXXXXX
 */
function generateCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude ambiguous chars like 0, O, 1, I
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `DV-${code}`;
}

/**
 * Create or get an active share code for a prediction.
 */
export async function createScanShare(predictionId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Check if an active, non-expired share already exists
  const { data: existing } = await supabase
    .from('scan_shares')
    .select('*')
    .eq('prediction_id', predictionId)
    .eq('patient_user_id', user.id)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (existing) {
    return { data: existing, error: null };
  }

  // Generate a unique code
  let shareCode = generateCode();

  const { data, error } = await supabase
    .from('scan_shares')
    .insert({
      prediction_id: predictionId,
      patient_user_id: user.id,
      share_code: shareCode,
      status: 'active',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    })
    .select()
    .single();

  return { data, error };
}

/**
 * Fetch all share records for a specific prediction.
 */
export async function getScanShares(predictionId) {
  const { data, error } = await supabase
    .from('scan_shares')
    .select('*')
    .eq('prediction_id', predictionId)
    .order('created_at', { ascending: false });

  return { data, error };
}

/**
 * Revoke an active share code.
 */
export async function revokeScanShare(shareId) {
  const { data, error } = await supabase
    .from('scan_shares')
    .update({ status: 'revoked' })
    .eq('id', shareId)
    .select()
    .single();

  return { data, error };
}
