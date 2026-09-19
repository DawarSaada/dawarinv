import { registerSW } from 'virtual:pwa-register';
import { logger } from '../utils/logger';

export const PWA_UPDATE_AVAILABLE = 'pwa:update-available';
export const PWA_OFFLINE_READY = 'pwa:offline-ready';

let applyUpdate: ((reloadPage?: boolean) => Promise<void>) | null = null;
let updatePending = false;

/** Registers the generated service worker (precache + offline shell). */
export const registerAppServiceWorker = (): void => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh() {
      updatePending = true;
      window.dispatchEvent(new CustomEvent(PWA_UPDATE_AVAILABLE));
    },
    onOfflineReady() {
      window.dispatchEvent(new CustomEvent(PWA_OFFLINE_READY));
    },
    onRegisterError(error: unknown) {
      logger.error('Service worker registration failed', error);
    },
  });
};

export const isUpdatePending = (): boolean => updatePending;

/**
 * Activates the waiting service worker.
 * With `reloadPage: false` the new worker takes over without interrupting the user;
 * the refreshed bundle is picked up on the next full page load.
 */
export const applyPendingUpdate = async (reloadPage = false): Promise<void> => {
  if (!applyUpdate) return;
  updatePending = false;
  try {
    await applyUpdate(reloadPage);
  } catch (error) {
    logger.error('Could not activate the new service worker', error);
  }
};
