/**
 * DiagnoVision — Supabase Client
 * Singleton client used across the frontend for Auth, DB, and Storage.
 * Reads from VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY env vars.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'public-anon-key';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn(
    '[DiagnoVision] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
    'Auth and database features will not work.'
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
);
