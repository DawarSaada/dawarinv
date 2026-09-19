import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { omsSupabase } from '../services/omsClient';
import { logger } from '../utils/logger';

/**
 * Subscription enforcement.
 *
 * The application is licensed per period and the period end lives in the OMS
 * project's `app_settings` (`polar_current_period_end` / `polar_subscription_status`).
 * When that moment passes the whole application must stop, with a message telling
 * the user to ask the administrator to renew.
 *
 * Three things make this reliable rather than a best-effort check:
 *
 *  1. **It re-evaluates while the app is open.** The previous version fetched once
 *     on mount with `[]` dependencies, so a session left open simply kept running
 *     past the expiry moment. A 30s local tick now compares the known period end
 *     against the clock, and a periodic refresh picks up a remote change (a renewal,
 *     a failed payment) without a reload.
 *
 *  2. **It cannot be outrun by going offline.** The last known subscription state
 *     and period end are cached in localStorage, so an offline (or freshly loaded)
 *     client still locks itself the moment the known expiry passes. This is an
 *     offline-first PWA, so without this an expired licence could be used offline
 *     indefinitely.
 *
 *  3. **It fails closed but not absurdly.** Before the first successful check there
 *     is nothing to trust, so the app is locked. A transient failure *after* a
 *     successful check keeps the last known decision and simply re-evaluates it
 *     locally, so a flaky network cannot stop staff working mid-shift.
 *
 * This is a commercial control, not a security boundary: it governs the app, and a
 * caller holding the anon key can still reach the API directly (see the auth risk in
 * PRODUCTION_AUDIT.md).
 */

export type SubscriptionState = 'loading' | 'active' | 'expired' | 'unverifiable';

export type SubscriptionReason =
  | 'active'
  | 'expired'
  | 'status'
  | 'simulated'
  | 'legacy-unpaid'
  | 'unconfigured'
  | 'unverified'
  | 'error';

export interface SubscriptionInfo {
  state: SubscriptionState;
  /** Raw status reported by the billing provider, e.g. `active`, `past_due`. */
  status: string | null;
  /** Period end as an ISO string, when the provider reports one. */
  expiresAt: string | null;
  /** Why the current state was reached, so the UI can say something specific. */
  reason: SubscriptionReason;
  /** Billing page offered by the OMS project, when it exposes one. */
  checkoutUrl: string | null;
  /** When the state was last confirmed against the OMS project. */
  checkedAt: string | null;
}

export interface SubscriptionResult extends SubscriptionInfo {
  /** True whenever the application must not run. */
  isLocked: boolean;
  isLoading: boolean;
  /** Re-check immediately; used by the "try again" action on the lock screen. */
  refresh: () => Promise<void>;
}

/** Values read from the OMS project's `app_settings`. */
interface SubscriptionSettings {
  simulateFailure: boolean;
  status: string | null;
  periodEnd: string | null;
  lastPaidMonth: string | null;
  checkoutUrl: string | null;
}

const SETTINGS_CACHE_KEY = 'dawar_subscription_state';
const SETTINGS_KEYS = [
  'sub_simulate_fail',
  'polar_subscription_status',
  'polar_current_period_end',
  'sub_last_paid_month',
  'polar_checkout_url',
];

/** How often the known period end is compared against the clock (no network). */
const TICK_MS = 30 * 1000;
/** How often the OMS project is asked again for the current subscription. */
const REFRESH_MS = 5 * 60 * 1000;

/**
 * Parse a period end.
 *
 * A full timestamp (`2026-10-15T23:59:59Z`) is taken literally. A date-only value
 * (`2026-10-15`) is read as the *end* of that day in local time, because "expires on
 * the 15th" means the 15th is still covered — reading it as UTC midnight would lock
 * the app a day early in any timezone east of Greenwich.
 */
export const parsePeriodEnd = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-').map(Number);
    return new Date(year, month - 1, day, 23, 59, 59, 999);
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/** Turn raw settings into a decision. Pure, so it is safe to call on every tick. */
export const decideSubscription = (
  settings: SubscriptionSettings | null,
  now: Date,
  enforced: boolean
): Pick<SubscriptionInfo, 'state' | 'reason' | 'status' | 'expiresAt' | 'checkoutUrl'> => {
  const status = settings?.status ?? null;
  const expiresAt = settings?.periodEnd ?? null;
  const checkoutUrl = settings?.checkoutUrl ?? null;

  if (!enforced) {
    // No OMS credentials in this deployment: there is nothing to check against.
    // Surfaced loudly rather than silently, because it means licensing is off.
    return { state: 'active', reason: 'unconfigured', status, expiresAt, checkoutUrl };
  }

  if (!settings) {
    return { state: 'unverifiable', reason: 'unverified', status, expiresAt, checkoutUrl };
  }

  if (settings.simulateFailure) {
    return { state: 'expired', reason: 'simulated', status, expiresAt, checkoutUrl };
  }

  if (status) {
    // Any status other than an active one means the licence is not in good standing:
    // `past_due`, `canceled`, `incomplete`, `unpaid` all stop the application.
    if (status.toLowerCase() !== 'active') {
      return { state: 'expired', reason: 'status', status, expiresAt, checkoutUrl };
    }

    const end = parsePeriodEnd(expiresAt);
    if (end && now.getTime() >= end.getTime()) {
      return { state: 'expired', reason: 'expired', status, expiresAt, checkoutUrl };
    }

    // An active status with no period end is honoured, but it is worth knowing about:
    // without an end date there is no moment at which this check can ever lock.
    if (!end) {
      logger.warn('Subscription is active but reports no period end; expiry cannot be enforced.');
    }

    return { state: 'active', reason: 'active', status, expiresAt, checkoutUrl };
  }

  // Legacy fallback: no billing-provider status, so the paid month is the signal.
  const currentMonth = now.toISOString().slice(0, 7);
  if (settings.lastPaidMonth === currentMonth) {
    return { state: 'active', reason: 'active', status, expiresAt, checkoutUrl };
  }

  return { state: 'expired', reason: 'legacy-unpaid', status, expiresAt, checkoutUrl };
};

const readCache = (): { settings: SubscriptionSettings; checkedAt: string } | null => {
  try {
    const raw = localStorage.getItem(SETTINGS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.settings) return null;
    return { settings: parsed.settings as SubscriptionSettings, checkedAt: parsed.checkedAt ?? null };
  } catch {
    return null;
  }
};

const writeCache = (settings: SubscriptionSettings) => {
  try {
    localStorage.setItem(
      SETTINGS_CACHE_KEY,
      JSON.stringify({ settings, checkedAt: new Date().toISOString() })
    );
  } catch {
    /* storage full or blocked — the in-memory state still holds for this session */
  }
};

/**
 * Development-only override, used to exercise the lock screen without waiting for a
 * real expiry or writing to the OMS project.
 *
 * It is compiled out of production builds on purpose: shipping a named localStorage
 * key that unlocks the application would hand away the control it exists to enforce.
 */
const readForcedState = (): SubscriptionSettings | null => {
  if (!import.meta.env.DEV) return null;
  try {
    const raw = localStorage.getItem('dawar_subscription_override');
    if (!raw) return null;
    if (raw === 'clear') return null;
    return JSON.parse(raw) as SubscriptionSettings;
  } catch {
    return null;
  }
};

export const useOMSSubscription = (): SubscriptionResult => {
  const cached = useMemo(readCache, []);
  const [settings, setSettings] = useState<SubscriptionSettings | null>(
    () => readForcedState() ?? cached?.settings ?? null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(cached?.checkedAt ?? null);
  /** Drives the local re-evaluation; only the clock changes it. */
  const [now, setNow] = useState(() => new Date());

  // `enforced` is false only when the deployment has no OMS credentials at all.
  const enforced = !!omsSupabase;

  const fetchSubscription = useCallback(async () => {
    const forced = readForcedState();
    if (forced) {
      setSettings(forced);
      setCheckedAt(new Date().toISOString());
      setError(null);
      setIsLoading(false);
      return;
    }

    if (!omsSupabase) {
      setError(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await omsSupabase
        .from('app_settings')
        .select('key, value')
        .in('key', SETTINGS_KEYS);

      if (fetchError) throw fetchError;

      const next: SubscriptionSettings = {
        simulateFailure: false,
        status: null,
        periodEnd: null,
        lastPaidMonth: null,
        checkoutUrl: null,
      };

      (data ?? []).forEach((row) => {
        if (row.key === 'sub_simulate_fail') next.simulateFailure = row.value === 'true';
        if (row.key === 'polar_subscription_status') next.status = row.value || null;
        if (row.key === 'polar_current_period_end') next.periodEnd = row.value || null;
        if (row.key === 'sub_last_paid_month') next.lastPaidMonth = row.value || null;
        if (row.key === 'polar_checkout_url') next.checkoutUrl = row.value || null;
      });

      setSettings(next);
      writeCache(next);
      setCheckedAt(new Date().toISOString());
      setError(null);
    } catch (err) {
      // Keep whatever was last confirmed. Locking here would stop the whole business
      // on a dropped request; the cached decision (and its expiry) still applies.
      // Supabase rejects with a plain object rather than an Error, so read `message`
      // off either shape — otherwise the log reads "[object Object]" and tells nobody
      // whether this was a network drop or a bad key.
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : String(err);
      logger.warn('Subscription check failed; using the last known state.', message);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchSubscription();
  }, [fetchSubscription]);

  // Initial load, then a periodic refresh, plus a refresh whenever the tab comes
  // back or the connection returns (the moments a stale decision is most likely).
  useEffect(() => {
    void fetchSubscription();

    const refreshTimer = window.setInterval(() => void fetchSubscription(), REFRESH_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchSubscription();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);

    return () => {
      window.clearInterval(refreshTimer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, [fetchSubscription]);

  // Local tick: locks the app at the expiry moment without waiting for a network
  // round trip (and while offline).
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const decision = useMemo(
    () => decideSubscription(enforced ? settings : null, now, enforced),
    [settings, now, enforced]
  );

  // Before the first answer arrives there is nothing to trust, so the app waits
  // rather than running: `loading` is treated as locked by the gate.
  const state: SubscriptionState = isLoading && !settings && enforced ? 'loading' : decision.state;

  return {
    state,
    reason: error && state === 'unverifiable' ? 'error' : decision.reason,
    status: decision.status,
    expiresAt: decision.expiresAt,
    checkoutUrl: decision.checkoutUrl,
    checkedAt,
    isLocked: state !== 'active',
    isLoading,
    refresh,
  };
};
