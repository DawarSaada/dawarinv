/**
 * Runtime configuration.
 *
 * All values are injected at build time by Vite from `.env` (see `.env.example`).
 * Anything exposed here ends up in the client bundle, so only publishable keys
 * (Supabase anon keys, VAPID public key) may live in `.env`.
 * Server secrets such as the OpenRouter API key must stay in Supabase function secrets.
 */

type Env = Record<string, string | undefined>;

const env: Env = (import.meta.env ?? {}) as unknown as Env;

/** App version, injected by Vite from package.json. */
export const APP_VERSION: string = __APP_VERSION__;
/** Build mode: 'development' | 'production'. */
export const IS_PRODUCTION: boolean = env.MODE === 'production';

const read = (key: string): string => (env[key] ?? '').trim();

const warn = (message: string) => {
  // eslint-disable-next-line no-console
  console.warn(`[config] ${message}`);
};

export interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  vapidPublicKey: string;
  omsSupabaseUrl: string;
  omsSupabaseAnonKey: string;
  appVersion: string;
  /**
   * ISO 4217 code used for money in the UI.
   *
   * Hardcoded "SAR" appeared in the purchase order screens, which makes the app
   * single-country. Override with VITE_CURRENCY per deployment; per-location
   * currencies are a roadmap item (ROADMAP.md, section 6).
   */
  currency: string;
  /** BCP-47 locale used for number and date formatting when a language is not set. */
  defaultLocale: string;
}

const supabaseUrl = read('VITE_SUPABASE_URL');
const supabaseAnonKey = read('VITE_SUPABASE_ANON_KEY');
const vapidPublicKey = read('VITE_VAPID_PUBLIC_KEY');
const omsSupabaseUrl = read('VITE_OMS_SUPABASE_URL');
const omsSupabaseAnonKey = read('VITE_OMS_SUPABASE_ANON_KEY');
const currency = read('VITE_CURRENCY') || 'SAR';
const defaultLocale = read('VITE_DEFAULT_LOCALE') || 'en';

const missingRequired = (['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const)
  .filter((key) => !read(key));

export const supabaseConfigured = !!(supabaseUrl && supabaseAnonKey);
export const pushConfigured = !!vapidPublicKey;
export const omsConfigured = !!(omsSupabaseUrl && omsSupabaseAnonKey);

/**
 * Set when a required variable is missing. The app renders a readable configuration
 * screen in that case (see index.tsx) rather than failing with a blank page.
 */
export const configError: string | null = missingRequired.length
  ? `Missing required environment variable(s): ${missingRequired.join(', ')}. ` +
    'The application cannot reach its database without them. ' +
    'Set them for this deployment (see .env.example) and rebuild.'
  : null;

if (configError) {
  if (IS_PRODUCTION) {
    // eslint-disable-next-line no-console
    console.error(`[config] ${configError}`);
  } else {
    warn(configError);
  }
}

export const config: AppConfig = {
  supabaseUrl,
  supabaseAnonKey,
  vapidPublicKey,
  omsSupabaseUrl,
  omsSupabaseAnonKey,
  appVersion: APP_VERSION,
  currency,
  defaultLocale,
};
