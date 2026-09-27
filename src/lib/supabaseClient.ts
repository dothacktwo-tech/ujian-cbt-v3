import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wpzvwwxnfurztyejkhsm.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_CqxZWICgjXk9rXAM4sdFvA_MKLnJnHF';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.info(
    '[Supabase Client Notice] Menggunakan konfigurasi default Supabase. ' +
    'Untuk menghubungkan ke project custom di Vercel, tambahkan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di Environment Variables.'
  );
}

let clientInstance: SupabaseClient | null = null;
try {
  clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
} catch (err: any) {
  console.error('[Supabase Client Error] Inisialisasi client browser gagal:', err?.message || err);
}

export const supabase = clientInstance!;
