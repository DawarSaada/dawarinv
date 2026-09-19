import React from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del } from 'idb-keyval';
import { registerAppServiceWorker } from './services/pwa';
import { SubscriptionGate, SubscriptionProvider } from './components/SubscriptionGate';
import { AppSettingsProvider } from './components/AppSettingsProvider';
import { APP_VERSION, configError } from './config';
import { captureError, logger } from './utils/logger';

registerAppServiceWorker();

// Single funnel for anything that escapes React's error boundary.
window.addEventListener('error', (event) => {
  captureError(event.error ?? event.message, { source: 'window.error' });
});
window.addEventListener('unhandledrejection', (event) => {
  captureError(event.reason, { source: 'unhandledrejection' });
});

const NETWORK_ERROR_PATTERN = /failed to fetch|network|timeout|timed out|load failed|networkerror/i;
const RETRYABLE_ERROR_NAMES = /^(TypeError|AuthRetryableFetchError|FunctionsFetchError|FunctionsRelayError)$/;

/**
 * Stock movements, transfers and receipts are not idempotent, so a blind retry can
 * double-apply a write. Only transient failures (offline, network hiccup, 5xx) are
 * retried; validation/constraint errors surface to the user immediately.
 */
const isRetryableError = (error: unknown): boolean => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;

  const name = (error as { name?: string })?.name ?? '';
  const message = (error as { message?: string })?.message ?? '';
  const status = (error as { status?: number })?.status;

  if (RETRYABLE_ERROR_NAMES.test(name) && NETWORK_ERROR_PATTERN.test(message)) return true;
  if (typeof status === 'number' && status >= 500) return true;

  return false;
};

const MAX_RETRIES = 2;
const retryDelay = (attempt: number) => Math.min(1000 * 2 ** attempt, 8000);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      /**
       * Always revalidate on mount, while still painting instantly from whatever is
       * cached.
       *
       * `staleTime` alone was not enough here: the cache is persisted to IndexedDB with
       * a 24h lifetime, so a page load served whatever was cached — up to five minutes
       * of it inside a session, and the previous session's data otherwise. A stock
       * change made on another device or outside the app therefore did not appear, and
       * for an inventory screen a stale quantity is a wrong quantity.
       *
       * Realtime invalidation remains the primary mechanism during a session; this makes
       * correctness on load independent of it.
       */
      refetchOnMount: 'always',
      staleTime: 30 * 1000,
      gcTime: 1000 * 60 * 60 * 24, // 24 hours caching
      networkMode: 'offlineFirst',
      retry: (failureCount, error) => failureCount < MAX_RETRIES && isRetryableError(error),
      retryDelay,
    },
    mutations: {
      networkMode: 'offlineFirst',
      retry: (failureCount, error) => failureCount < MAX_RETRIES && isRetryableError(error),
      retryDelay,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Offline reads fail routinely; keep them quiet but visible in the console.
      logger.warn('Query failed', query.queryKey, error);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      captureError(error, {
        scope: 'mutation',
        mutationKey: JSON.stringify(mutation.options.mutationKey ?? null),
        mutationFn: mutation.options.mutationFn?.name ?? 'anonymous',
      });
    },
  }),
});

const idbStorage = {
  getItem: async (key: string) => await get(key),
  setItem: async (key: string, value: string) => await set(key, value),
  removeItem: async (key: string) => await del(key),
};

const persister = createAsyncStoragePersister({
  storage: idbStorage,
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

/** A deployment without its environment variables should say so, not render a blank page. */
const renderConfigError = (container: HTMLElement, message: string) => {
  container.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:Inter,system-ui,sans-serif;background:#f9fafb;color:#111827">
      <div style="max-width:32rem;background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:32px">
        <h1 style="margin:0 0 12px;font-size:20px">Configuration required</h1>
        <p style="margin:0 0 12px;line-height:1.6">${message}</p>
        <p style="margin:0;color:#6b7280;font-size:14px">Reference: .env.example</p>
      </div>
    </div>`;
};

const mountApp = async (container: HTMLElement, App: React.ComponentType) => {
  const root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister,
            maxAge: 1000 * 60 * 60 * 24,
            // A new release invalidates the persisted cache instead of replaying stale rows.
            buster: APP_VERSION,
            dehydrateOptions: {
              shouldDehydrateQuery: (query) => query.state.status === 'success',
              shouldDehydrateMutation: (mutation) => mutation.state.status === 'pending',
            },
          }}
        >
          <ToastProvider>
            {/*
              The subscription gate sits above `App` so a lapsed licence prevents the
              application from mounting at all — no queries, no realtime channels, no
              scheduled cleanup running behind a message.
            */}
            <SubscriptionProvider>
              <SubscriptionGate>
                {/* Inside the gate: nothing is fetched while the licence is stopped. */}
                <AppSettingsProvider>
                  <App />
                </AppSettingsProvider>
              </SubscriptionGate>
            </SubscriptionProvider>
          </ToastProvider>
        </PersistQueryClientProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
};

const bootstrap = async () => {
  if (configError) {
    renderConfigError(rootElement, configError);
    return;
  }
  // Imported lazily so a misconfigured deployment can render the message above
  // instead of crashing while the data layer is being initialised.
  const { default: App } = await import('./App');
  await mountApp(rootElement, App);
};

void bootstrap();
