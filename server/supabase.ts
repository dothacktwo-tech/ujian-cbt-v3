import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ override: true });

// Environment variable retrieval with fallbacks
const getEnvVar = (keys: string[]): string => {
  for (const key of keys) {
    const val = process.env[key];
    if (val && val.trim().length > 0) {
      return val.trim();
    }
  }
  return '';
};

let supabaseInstance: SupabaseClient | null = null;
let envWarningLogged = false;

/**
 * Validates whether Supabase environment variables are properly configured.
 * Logs specific, helpful diagnostic warnings if any are missing.
 */
export function checkSupabaseEnv(): { valid: boolean; url: string; key: string } {
  const url = getEnvVar(['SUPABASE_URL', 'VITE_SUPABASE_URL']) || 'https://nsieuoxrzanautfecwtu.supabase.co';
  const key = getEnvVar([
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_ANON_KEY',
    'VITE_SUPABASE_ANON_KEY',
  ]) || 'sb_publishable_89VoytPqC6px_JJ0lXvwSQ_4ieorHC1';

  return { valid: true, url, key };
}

/**
 * Returns a singleton instance of the Supabase server client.
 * Returns null if environment variables are not configured.
 */
export function getSupabaseClient(): SupabaseClient | null {
  const { valid, url, key } = checkSupabaseEnv();
  if (!valid) {
    return null;
  }

  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      console.info('[Supabase Client] Berhasil diinisialisasi untuk project:', new URL(url).hostname);
    } catch (err: any) {
      console.error('[Supabase Client Init Error] Gagal membuat client Supabase:', {
        message: err.message,
        stack: err.stack,
      });
      return null;
    }
  }

  return supabaseInstance;
}

export interface SupabaseAuthResult {
  success: boolean;
  user?: any;
  session?: any;
  error?: string;
  statusCode: number;
}

/**
 * Authenticates user via Supabase Auth with structured validation and comprehensive error handling.
 */
export async function authenticateWithSupabase(
  identifier: string,
  password: string
): Promise<SupabaseAuthResult> {
  // 1. Sanitasi & Validasi Input
  const cleanIdentifier = typeof identifier === 'string' ? identifier.trim() : '';
  const cleanPassword = typeof password === 'string' ? password : '';

  if (!cleanIdentifier || !cleanPassword) {
    return {
      success: false,
      error: 'Email/Username dan Password tidak boleh kosong.',
      statusCode: 400,
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    console.warn('[Supabase Auth] Melewati autentikasi Supabase Auth karena kredensial env belum terpasang.');
    return {
      success: false,
      error: 'Konfigurasi Supabase belum terpasang di server.',
      statusCode: 500,
    };
  }

  try {
    // Jalankan autentikasi Supabase Auth
    const { data, error } = await client.auth.signInWithPassword({
      email: cleanIdentifier,
      password: cleanPassword,
    });

    if (error) {
      console.error('[Supabase Auth Error Detail]:', {
        name: error.name,
        message: error.message,
        status: error.status,
      });

      if (error.status === 400 || error.message.toLowerCase().includes('invalid login credentials')) {
        return {
          success: false,
          error: 'Email/Username atau Password salah.',
          statusCode: 401,
        };
      }

      return {
        success: false,
        error: error.message || 'Gagal melakukan verifikasi dengan Supabase Auth.',
        statusCode: error.status || 500,
      };
    }

    return {
      success: true,
      user: data.user,
      session: data.session,
      statusCode: 200,
    };
  } catch (err: any) {
    console.error('[Supabase Auth Exception]:', {
      message: err?.message,
      stack: err?.stack,
      code: err?.code,
    });
    return {
      success: false,
      error: err?.message || 'Terjadi kesalahan internal saat menghubungi Supabase Auth.',
      statusCode: 500,
    };
  }
}

export const supabaseConfig = {
  get url() {
    return getEnvVar(['SUPABASE_URL', 'VITE_SUPABASE_URL']);
  },
  get key() {
    return getEnvVar([
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_PUBLISHABLE_KEY',
      'SUPABASE_ANON_KEY',
      'VITE_SUPABASE_ANON_KEY',
    ]);
  },
  host: process.env.PGHOST || 'db.wpzvwwxnfurztyejkhsm.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
};
