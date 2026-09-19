import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AlertTriangle, CalendarX2, ExternalLink, Loader2, LogOut, RefreshCw, ShieldAlert } from 'lucide-react';
import { useOMSSubscription, SubscriptionResult } from '../hooks/useOMSSubscription';
import { Button } from './ui/Button';
import { APP_VERSION } from '../config';
import { logger } from '../utils/logger';
import type { Language, Theme } from '../types';

/**
 * Subscription gate.
 *
 * The subscription decision lives here, *above* `App`, so that when the licence has
 * lapsed the application is not merely covered by a message — nothing behind this
 * gate mounts at all. That matters: `App` opens realtime channels, runs queries and
 * (as administrator) deletes old transactions on load. Gating inside `App` meant all
 * of that still ran behind the lock screen.
 *
 * The provider owns the single subscription check so the rest of the app can read it
 * (the admin settings screen shows it) without polling a second time.
 */

const SubscriptionContext = createContext<SubscriptionResult | null>(null);

export const useSubscription = (): SubscriptionResult => {
  const value = useContext(SubscriptionContext);
  if (!value) {
    throw new Error('useSubscription must be used inside <SubscriptionProvider>');
  }
  return value;
};

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const subscription = useOMSSubscription();
  return <SubscriptionContext.Provider value={subscription}>{children}</SubscriptionContext.Provider>;
};

/** Preferences used by the lock screen, which renders before `App` sets them. */
const useDocumentChrome = () => {
  const [language] = useState<Language>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('dawar_language') : null;
    return saved === 'ar' ? 'ar' : 'en';
  });
  const [theme] = useState<Theme>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('dawar_theme') : null;
    return saved === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return { language, theme };
};

/** Reads the signed-in user from the same session the auth hook uses. */
const readSessionUser = (): { role?: string; name?: string } | null => {
  try {
    const raw = localStorage.getItem('dawar_user');
    const expiry = localStorage.getItem('dawar_session_expiry');
    if (!raw || !expiry || Date.now() >= parseInt(expiry, 10)) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/**
 * Format a licence deadline.
 *
 * Arabic is rendered with the Gregorian calendar on purpose (`-u-ca-gregory`): the
 * default `ar-SA` locale resolves to Umm al-Qura, and a renewal deadline that reads
 * as a Hijri date alone is hard to act on. Arabic-Indic digits and Arabic month
 * names are kept.
 */
const formatDeadline = (value: string | null, language: Language): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(language === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
};

interface Copy {
  title: string;
  body: string;
  contact: string;
  signOut: string;
  retry: string;
  renew: string;
  statusLabel: string;
  expiryLabel: string;
  checkedLabel: string;
  versionLabel: string;
  toggle: string;
}

const COPY: Record<Language, Copy> = {
  en: {
    title: 'Subscription expired',
    body: 'The subscription for this system has ended, so the application has been stopped. No stock can be viewed or changed until it is renewed.',
    contact: 'Please contact the Administrator to renew the subscription.',
    signOut: 'Sign out',
    retry: 'Check again',
    renew: 'Renew subscription',
    statusLabel: 'Status',
    expiryLabel: 'Expired on',
    checkedLabel: 'Last checked',
    versionLabel: 'Version',
    toggle: 'العربية',
  },
  ar: {
    title: 'انتهى الاشتراك',
    body: 'انتهت صلاحية اشتراك هذا النظام، وتم إيقاف التطبيق. لا يمكن عرض أو تعديل المخزون حتى يتم التجديد.',
    contact: 'يرجى التواصل مع المسؤول لتجديد الاشتراك.',
    signOut: 'تسجيل الخروج',
    retry: 'إعادة المحاولة',
    renew: 'تجديد الاشتراك',
    statusLabel: 'الحالة',
    expiryLabel: 'انتهى في',
    checkedLabel: 'آخر تحقق',
    versionLabel: 'الإصدار',
    toggle: 'English',
  },
};

/** Distinguishes "expired" from "we could not check", so the message is honest. */
const reasonCopy = (reason: SubscriptionResult['reason'], language: Language): string | null => {
  const messages: Record<string, { en: string; ar: string }> = {
    status: {
      en: 'The billing provider reports the subscription as not active.',
      ar: 'حالة الاشتراك لدى مزود الفوترة غير نشطة.',
    },
    simulated: {
      en: 'The subscription is switched off for this environment by a settings flag.',
      ar: 'تم إيقاف الاشتراك لهذه البيئة بإعداد داخلي.',
    },
    'legacy-unpaid': {
      en: 'The current month has not been marked as paid.',
      ar: 'لم يتم تسجيل دفع الشهر الحالي.',
    },
    unverified: {
      en: 'The subscription could not be checked yet.',
      ar: 'لم يتم التحقق من الاشتراك بعد.',
    },
    error: {
      en: 'The subscription could not be verified — the billing service is unreachable. The application stays locked until it can be confirmed.',
      ar: 'تعذّر التحقق من الاشتراك — خدمة الفوترة غير متاحة. سيبقى التطبيق موقوفاً حتى يتم التأكيد.',
    },
  };
  const entry = messages[reason];
  return entry ? entry[language] : null;
};

/**
 * Shown only until the first subscription answer arrives on a cold start.
 *
 * Returning users have a cached decision, so they go straight to the app or straight
 * to the lock screen and never see this.
 */
const LoadingSplash: React.FC = () => (
  <div
    data-testid="subscription-splash"
    className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center gap-4 p-4"
  >
    <Loader2 className="w-8 h-8 animate-spin text-brand-600 dark:text-brand-400" aria-hidden />
    <p className="text-sm text-gray-500 dark:text-gray-400">
      Dawar Saada · {APP_VERSION}
    </p>
  </div>
);

const LockScreen: React.FC<{ subscription: SubscriptionResult }> = ({ subscription }) => {
  const { language } = useDocumentChrome();
  const t = COPY[language];
  const isArabic = language === 'ar';
  const sessionUser = readSessionUser();
  const isAdmin = sessionUser?.role === 'admin';

  const expiry = formatDeadline(subscription.expiresAt, language);
  const checked = formatDeadline(subscription.checkedAt, language);
  const detail = reasonCopy(subscription.reason, language);
  const isExpired = subscription.state === 'expired';

  const signOut = useCallback(() => {
    localStorage.removeItem('dawar_user');
    localStorage.removeItem('dawar_session_expiry');
    window.location.reload();
  }, []);

  const toggleLanguage = useCallback(() => {
    const next = language === 'ar' ? 'en' : 'ar';
    localStorage.setItem('dawar_language', next);
    window.location.reload();
  }, [language]);

  const handleRenew = useCallback(() => {
    if (!subscription.checkoutUrl) return;
    window.open(subscription.checkoutUrl, '_blank', 'noopener,noreferrer');
  }, [subscription.checkoutUrl]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8">
          <div className="flex flex-col items-center text-center">
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${
                isExpired ? 'bg-danger-50 dark:bg-danger-500/15' : 'bg-amber-50 dark:bg-amber-500/15'
              }`}
            >
              {isExpired ? (
                <CalendarX2 className="w-10 h-10 text-danger-600 dark:text-danger-400" aria-hidden />
              ) : (
                <ShieldAlert className="w-10 h-10 text-amber-600 dark:text-amber-400" aria-hidden />
              )}
            </div>

            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t.title}</h1>
            <p className="mt-3 text-gray-600 dark:text-gray-300 leading-relaxed">
              {isExpired ? t.body : detail}
            </p>
            {isExpired && detail && (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{detail}</p>
            )}
          </div>

          <dl className="mt-6 divide-y divide-gray-100 dark:divide-gray-700 text-sm">
            <div className="flex justify-between gap-4 py-2">
              <dt className="text-gray-500 dark:text-gray-400">{t.statusLabel}</dt>
              <dd className="font-medium text-gray-900 dark:text-white">
                {subscription.status ?? subscription.reason}
              </dd>
            </div>
            {expiry && (
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-gray-500 dark:text-gray-400">{t.expiryLabel}</dt>
                <dd className="font-medium text-gray-900 dark:text-white">{expiry}</dd>
              </div>
            )}
            {checked && (
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-gray-500 dark:text-gray-400">{t.checkedLabel}</dt>
                <dd className="font-medium text-gray-900 dark:text-white">{checked}</dd>
              </div>
            )}
          </dl>

          <div className="mt-6 flex items-start gap-3 rounded-xl border border-brand-100 dark:border-brand-800/40 bg-brand-50 dark:bg-brand-900/20 p-4">
            <AlertTriangle className="mt-0.5 w-5 h-5 shrink-0 text-brand-700 dark:text-brand-300" aria-hidden />
            <p className="text-sm font-medium text-brand-800 dark:text-brand-200">{t.contact}</p>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-2">
            <Button
              variant="primary"
              block
              icon={<RefreshCw />}
              loading={subscription.isLoading}
              onClick={() => void subscription.refresh()}
            >
              {t.retry}
            </Button>
            {isAdmin && subscription.checkoutUrl && (
              <Button
                variant="secondary"
                block
                icon={<ExternalLink />}
                onClick={handleRenew}
              >
                {t.renew}
              </Button>
            )}
            <Button variant="ghost" block icon={<LogOut />} onClick={signOut}>
              {t.signOut}
            </Button>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between px-2 text-xs text-gray-500 dark:text-gray-400">
          <span>
            {t.versionLabel} {APP_VERSION}
          </span>
          <button
            type="button"
            onClick={toggleLanguage}
            className="font-medium hover:text-gray-900 dark:hover:text-white underline-offset-2 hover:underline"
            lang={isArabic ? 'en' : 'ar'}
          >
            {t.toggle}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Renders the application only while the subscription is running.
 *
 * `loading` also holds the app back: until the first answer arrives there is no
 * basis for trusting it, and mounting `App` would open the data connections that the
 * lock exists to prevent.
 */
export const SubscriptionGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const subscription = useSubscription();
  // Keeps direction/theme correct for the splash and the lock screen, which render
  // before `App` gets a chance to set them.
  useDocumentChrome();

  useEffect(() => {
    if (subscription.isLocked && !subscription.isLoading) {
      logger.warn('Application held at the subscription gate', {
        state: subscription.state,
        reason: subscription.reason,
      });
    }
  }, [subscription.isLocked, subscription.isLoading, subscription.state, subscription.reason]);

  if (subscription.state === 'loading') {
    return <LoadingSplash />;
  }

  if (subscription.isLocked) {
    return <LockScreen subscription={subscription} />;
  }

  return <>{children}</>;
};
