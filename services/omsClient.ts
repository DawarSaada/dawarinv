import { createClient } from '@supabase/supabase-js';

const omsSupabaseUrl = import.meta.env.VITE_OMS_SUPABASE_URL;
const omsSupabaseKey = import.meta.env.VITE_OMS_SUPABASE_ANON_KEY;

if (!omsSupabaseUrl || !omsSupabaseKey) {
  console.error("Missing OMS Supabase credentials in environment variables.");
}

export const omsSupabase = createClient(omsSupabaseUrl || '', omsSupabaseKey || '');
