import { createClient } from '@supabase/supabase-js';
import { config, omsConfigured } from '../config';
import { logger } from '../utils/logger';

/**
 * Optional client for the OMS project, used only to read subscription status.
 * When the credentials are absent the subscription check is bypassed instead of
 * locking the whole application.
 */
export const omsSupabase = omsConfigured
  ? createClient(config.omsSupabaseUrl, config.omsSupabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

if (!omsSupabase) {
  logger.info('OMS credentials not configured; subscription checks are bypassed.');
}
