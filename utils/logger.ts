/**
 * Small logging facade.
 *
 * - `debug`/`info` are stripped in production builds so we never leak internal
 *   state (table names, ids, payloads) into a user's console.
 * - `warn`/`error` are kept: they are actionable in the field.
 * - `captureError` is the single funnel for unexpected errors. It logs, and emits
 *   a `app:error` window event so an external reporter (Sentry, OTLP, ...) can be
 *   attached without touching every call site.
 */

const isProd = import.meta.env.PROD;

const noop = () => {};

export interface ErrorContext {
  [key: string]: unknown;
}

export const logger = {
  debug: isProd ? noop : (...args: unknown[]) => console.debug(...args),
  info: isProd ? noop : (...args: unknown[]) => console.info(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
};

export const captureError = (error: unknown, context: ErrorContext = {}) => {
  const normalized = error instanceof Error ? error : new Error(String(error));

  // Avoid double-logging in dev where the raw error is already visible.
  if (isProd) {
    console.error('[error]', normalized.message, context);
  }

  try {
    window.dispatchEvent(
      new CustomEvent('app:error', {
        detail: {
          message: normalized.message,
          stack: normalized.stack,
          context,
          timestamp: new Date().toISOString(),
        },
      })
    );
  } catch {
    /* dispatching is best-effort only */
  }
};
