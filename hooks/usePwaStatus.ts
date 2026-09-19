import { useEffect } from 'react';
import { useToast } from '../components/Toast';
import { Language } from '../types';
import {
  PWA_OFFLINE_READY,
  PWA_UPDATE_AVAILABLE,
  applyPendingUpdate,
  isUpdatePending,
} from '../services/pwa';

/**
 * Tells the user when the app is ready for offline use and when a new release has
 * been downloaded. Updates are activated in the background (no forced reload) so
 * an in-progress form or offline queue is never interrupted.
 */
export const usePwaStatus = (language: Language): void => {
  const { addToast } = useToast();

  useEffect(() => {
    const onOfflineReady = () => {
      addToast(
        'success',
        language === 'ar'
          ? 'التطبيق جاهز للعمل بدون اتصال بالإنترنت'
          : 'The app is ready to work offline'
      );
    };

    const onUpdateAvailable = () => {
      addToast(
        'info',
        language === 'ar'
          ? 'تم تنزيل إصدار جديد. سيتم تطبيقه عند إعادة فتح التطبيق.'
          : 'A new version was downloaded. It will be applied the next time you open the app.'
      );
      // Activate the new worker without reloading the current page.
      void applyPendingUpdate(false);
    };

    window.addEventListener(PWA_OFFLINE_READY, onOfflineReady);
    window.addEventListener(PWA_UPDATE_AVAILABLE, onUpdateAvailable);

    return () => {
      window.removeEventListener(PWA_OFFLINE_READY, onOfflineReady);
      window.removeEventListener(PWA_UPDATE_AVAILABLE, onUpdateAvailable);
    };
  }, [addToast, language]);

  // If an update arrived while the app was open, activate it once the user leaves.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && isUpdatePending()) {
        void applyPendingUpdate(false);
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);
};
