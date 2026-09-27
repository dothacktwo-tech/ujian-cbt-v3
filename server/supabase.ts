import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY!;

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error('Supabase URL or Key environment variables are missing.');
    }
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseInstance;
}

export const supabaseConfig = {
  url: SUPABASE_URL,
  key: SUPABASE_KEY,
  host: process.env.PGHOST || 'db.wpzvwwxnfurztyejkhsm.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
};
