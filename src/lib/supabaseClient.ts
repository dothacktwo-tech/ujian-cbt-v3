import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wpzvwwxnfurztyejkhsm.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_CqxZWICgjXk9rXAM4sdFvA_MKLnJnHF';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
