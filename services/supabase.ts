import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

// Values come from build-time env vars and are validated in config.ts.
export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      // Cap realtime throughput; this app only needs change notifications.
      eventsPerSecond: 10,
    },
  },
});