import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { config } from '../config';
import { logger } from '../utils/logger';
import { isCurrency } from '../constants';
import type { Currency, TransferSettings } from '../types';

/**
 * Application settings that belong to the *business*, not to one browser.
 *
 * These used to live in `localStorage` — transfer rules and transaction retention —
 * so an administrator's change applied only to the device it was made on. Other
 * administrators saw the defaults and staff never received the rule at all. Currency
 * was a build-time environment variable, which meant a rebuild to change it.
 *
 * They now come from `public.app_settings` (see phase10_app_settings.sql). Until that
 * migration is applied the hook keeps working exactly as before: it reads and writes
 * the old `localStorage` keys and reports `centralStoreAvailable: false`, so the
 * settings screen can tell the administrator that the values are local-only rather
 * than pretending they were shared.
 */

export const DEFAULT_TRANSFER_SETTINGS: TransferSettings = {
  enableSignatureCapture: false,
  enablePhotoEvidence: false,
  enableAutoReject: false,
  autoRejectDays: 7,
};

export interface AppSettings {
  currency: Currency;
  /** 0 disables automatic cleanup entirely. */
  retentionMonths: number;
  transfer: TransferSettings;
}

/** `VITE_CURRENCY` is the deployment's starting point; anything unexpected falls back. */
const ENV_CURRENCY: Currency = isCurrency(config.currency)
  ? config.currency
  : (config.currency ? (logger.warn(`Unknown VITE_CURRENCY "${config.currency}"; using SAR.`), 'SAR') : 'SAR');

export const DEFAULT_APP_SETTINGS: AppSettings = {
  currency: ENV_CURRENCY,
  retentionMonths: 0,
  transfer: DEFAULT_TRANSFER_SETTINGS,
};

/** localStorage keys, still used as the fallback and as an offline mirror. */
const KEYS = {
  transfer: 'dawar_transfer_settings',
  retention: 'dawar_retention_months',
  currency: 'dawar_currency',
  mirror: 'dawar_app_settings',
} as const;

const readJson = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

/** Whatever this browser already had stored, before settings were centralised. */
const readLocalSettings = (): Partial<AppSettings> => {
  const out: Partial<AppSettings> = {};

  const transfer = readJson<Partial<TransferSettings>>(KEYS.transfer);
  if (transfer) out.transfer = { ...DEFAULT_TRANSFER_SETTINGS, ...transfer };

  const retention = localStorage.getItem(KEYS.retention);
  if (retention !== null && retention !== '') {
    const months = parseInt(retention, 10);
    if (!Number.isNaN(months)) out.retentionMonths = months;
  }

  const currency = localStorage.getItem(KEYS.currency);
  if (isCurrency(currency)) out.currency = currency;

  return out;
};

const writeLocal = (settings: AppSettings) => {
  try {
    localStorage.setItem(KEYS.transfer, JSON.stringify(settings.transfer));
    localStorage.setItem(KEYS.retention, String(settings.retentionMonths));
    localStorage.setItem(KEYS.currency, settings.currency);
  } catch {
    /* storage blocked — the in-memory state still applies for this session */
  }
};

const merge = (...layers: (Partial<AppSettings> | null | undefined)[]): AppSettings => {
  const out: AppSettings = { ...DEFAULT_APP_SETTINGS, transfer: { ...DEFAULT_TRANSFER_SETTINGS } };
  for (const layer of layers) {
    if (!layer) continue;
    if (layer.currency) out.currency = layer.currency;
    if (typeof layer.retentionMonths === 'number') out.retentionMonths = layer.retentionMonths;
    if (layer.transfer) out.transfer = { ...out.transfer, ...layer.transfer };
  }
  return out;
};

/** Rows are one key per settings group, with a JSON value. */
const fromRows = (rows: { key: string; value: unknown }[]): Partial<AppSettings> => {
  const out: Partial<AppSettings> = {};
  for (const row of rows) {
    if (row.key === 'currency' && isCurrency(row.value)) {
      out.currency = row.value;
    } else if (row.key === 'retention_months' && row.value !== null && row.value !== undefined) {
      const months = Number(row.value);
      if (!Number.isNaN(months)) out.retentionMonths = months;
    } else if (row.key === 'transfer_settings' && row.value && typeof row.value === 'object') {
      out.transfer = { ...DEFAULT_TRANSFER_SETTINGS, ...(row.value as Partial<TransferSettings>) };
    }
  }
  return out;
};

/** PostgREST reports a missing table as 42P01 or PGRST205. */
const isMissingTable = (error: { code?: string; message?: string } | null): boolean => {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  return /could not find the table/i.test(error.message ?? '');
};

/**
 * True when a column the client sends is not in the table yet.
 *
 * This matters for `updated_by`: an earlier version of `app_settings` in this project
 * has only `key`, `value` and `updated_at`. Without this check every save would fail
 * with a 400 and the admin would see an error with no way through.
 */
const isUnknownColumn = (error: { code?: string; message?: string } | null): boolean => {
  if (!error) return false;
  if (error.code === '42703' || error.code === 'PGRST204') return true;
  return /column .* does not exist|could not find the '.*' column/i.test(error.message ?? '');
};

export interface UseAppSettingsResult {
  settings: AppSettings;
  isLoading: boolean;
  /** False while the deployment has no central store, so the UI can say so. */
  centralStoreAvailable: boolean;
  /**
   * Only the values the server actually returned.
   *
   * Callers that do something destructive need this: transaction retention deletes
   * history, and a number left in one browser's localStorage must not be able to
   * trigger it. `settings` merges defaults and local values, so it cannot answer
   * "was this the administrator's decision or a leftover?"
   */
  centralValues: Partial<AppSettings>;
  /** True when the stored value has been confirmed by the server at least once. */
  isSynced: boolean;
  save: (patch: Partial<AppSettings>, options?: { updatedBy?: string }) => Promise<void>;
}

export const useAppSettings = (): UseAppSettingsResult => {
  const queryClient = useQueryClient();
  const [centralStoreAvailable, setCentralStoreAvailable] = useState(true);
  const [isSynced, setIsSynced] = useState(false);

  const { data: rows, isLoading } = useQuery({
    queryKey: ['app_settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('key, value');
      if (error) {
        if (isMissingTable(error)) {
          // Expected until phase10_app_settings.sql is applied.
          logger.warn('app_settings table not found; settings stay per-browser.');
          return null;
        }
        throw error;
      }
      return (data ?? []) as { key: string; value: unknown }[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // `rows === null` is the "no central table" answer; `undefined` means still loading.
  useEffect(() => {
    if (rows === null) {
      setCentralStoreAvailable(false);
    } else if (rows) {
      setCentralStoreAvailable(true);
      setIsSynced(true);
    }
  }, [rows]);

  const saveMutation = useMutation({
    mutationFn: async ({
      patch,
      updatedBy,
    }: {
      patch: Partial<AppSettings>;
      updatedBy?: string;
    }) => {
      const entries: { key: string; value: unknown }[] = [];
      if (patch.currency !== undefined) entries.push({ key: 'currency', value: patch.currency });
      if (patch.retentionMonths !== undefined) {
        entries.push({ key: 'retention_months', value: patch.retentionMonths });
      }
      if (patch.transfer !== undefined) entries.push({ key: 'transfer_settings', value: patch.transfer });

      if (entries.length === 0) return;

      if (!centralStoreAvailable) {
        // No table to write to: keep the old behaviour rather than failing the click.
        writeLocal(merge(readLocalSettings(), patch));
        return;
      }

      let { error } = await supabase
        .from('app_settings')
        .upsert(
          entries.map((entry) => ({ ...entry, updated_by: updatedBy ?? null })),
          { onConflict: 'key' }
        );

      if (error && isUnknownColumn(error)) {
        // The table predates `updated_by`. Save anyway, without the audit stamp, rather
        // than blocking the administrator on a migration they may not have run.
        logger.warn('app_settings.updated_by is missing; saving without it. Apply phase10_app_settings.sql.');
        const retry = await supabase.from('app_settings').upsert(entries, { onConflict: 'key' });
        error = retry.error;
      }

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app_settings'] });
    },
  });

  const [localFallback, setLocalFallback] = useState<Partial<AppSettings>>(() => readLocalSettings());

  const central = useMemo(() => (rows ? fromRows(rows) : null), [rows]);

  const settings = useMemo(
    () => merge(localFallback, central),
    [localFallback, central]
  );

  const save = useCallback(
    async (patch: Partial<AppSettings>, options?: { updatedBy?: string }) => {
      setLocalFallback((prev) => merge(prev, patch));
      await saveMutation.mutateAsync({ patch, updatedBy: options?.updatedBy });
    },
    [saveMutation]
  );

  // Mirror what the server sent so an offline load shows the same values.
  useEffect(() => {
    if (central) writeLocal(merge(localFallback, central));
  }, [central, localFallback]);

  return {
    settings,
    isLoading,
    centralStoreAvailable,
    centralValues: central ?? {},
    isSynced,
    save,
  };
};
