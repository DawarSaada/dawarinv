import { createClient } from '@supabase/supabase-js';

const omsSupabaseUrl = import.meta.env.VITE_OMS_SUPABASE_URL;
const omsSupabaseKey = import.meta.env.VITE_OMS_SUPABASE_ANON_KEY;

if (!omsSupabaseUrl || !omsSupabaseKey) {
  console.warn("Missing OMS Supabase credentials in environment variables. Subscription checks will be bypassed.");
}

export const omsSupabase = (omsSupabaseUrl && omsSupabaseKey) 
  ? createClient(omsSupabaseUrl, omsSupabaseKey) 
  : null;
