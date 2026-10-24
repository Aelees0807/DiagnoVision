/**
 * DiagnoVision — Supabase Client
 * Singleton client used across the frontend for Auth, DB, and Storage.
 * Reads from VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY env vars.
 */

import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  rawUrl &&
  !rawUrl.includes('placeholder') &&
  rawKey &&
  !rawKey.includes('placeholder') &&
  !rawKey.includes('public-anon-key')
);

const supabaseUrl = rawUrl || 'https://placeholder.supabase.co';
const supabaseAnonKey = rawKey || 'public-anon-key';

if (!isSupabaseConfigured) {
  console.warn(
    '[DiagnoVision] Missing or placeholder VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
    'Auth and database features will not work until environment variables are set in your deployment.'
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
);
