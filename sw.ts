/// <reference lib="webworker" />
declare let self: ServiceWorkerGlobalScope;

import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// Precache the build output (Vite injects the manifest at build time).
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Serve the app shell for navigations so the PWA opens offline.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/api\//],
  })
);

// Web fonts: keep them available offline after the first load.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({ cacheName: 'google-fonts-stylesheets' })
);
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 16,
        maxAgeSeconds: 60 * 60 * 24 * 365,
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// `autoUpdate` registration asks the waiting worker to activate immediately.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload: {
    title?: string;
    body?: string;
    icon?: string;
    badge?: string;
    vibrate?: number[];
    data?: Record<string, unknown>;
  } = {};

  try {
    payload = event.data.json();
  } catch {
    payload = { body: event.data.text() };
  }

  // `vibrate` is part of the notification spec but missing from the DOM lib types.
  const options: NotificationOptions & { vibrate?: number[] } = {
    body: payload.body ?? '',
    icon: payload.icon ?? '/icons/icon-192.png',
    badge: payload.badge ?? '/masked-icon.svg',
    vibrate: payload.vibrate ?? [100, 50, 100],
    data: payload.data ?? {},
  };

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If the app is already focused, do not duplicate the notification.
        const hasVisibleClient = clientList.some(
          (client) => client.visibilityState === 'visible' && client.focused
        );
        if (hasVisibleClient) return;
        return self.registration.showNotification(payload.title ?? 'Dawar Saada', options);
      })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data?.url as string) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
