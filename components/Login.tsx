import React, { useState } from 'react';
import { ArrowRight, Boxes, Languages, Lock, Package, User as UserIcon, WifiOff } from 'lucide-react';
import { TRANSLATIONS } from '../constants';
import { Language, User, Theme } from '../types';
import { Button } from './ui/Button';
import { Checkbox } from './ui/Checkbox';
import { Field, Input } from './ui/Field';
import { APP_VERSION } from '../config';
import AppControls from './AppControls';

interface LoginProps {
  onLogin: (user: User, rememberMe: boolean) => void;
  language: Language;
  users: User[];
  isLoading?: boolean;
  theme?: Theme;
  onToggleLanguage?: () => void;
  onToggleTheme?: () => void;
}

const Login: React.FC<LoginProps> = ({
  onLogin,
  language,
  users,
  isLoading = false,
  theme = 'light',
  onToggleLanguage,
  onToggleTheme,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');

  const t = TRANSLATIONS[language];
  const isArabic = language === 'ar';
  const directoryEmpty = users.length === 0;
  const [online] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = users.find((u) => u.username === username.trim() && u.password === password);

    if (user) {
      setError('');
      onLogin(user, rememberMe);
    } else {
      setError(t.invalidCredentials);
    }
  };

  const features = [
    { icon: <WifiOff className="h-4 w-4" />, label: t.loginFeatureOffline },
    { icon: <Languages className="h-4 w-4" />, label: t.loginFeatureBilingual },
    { icon: <Package className="h-4 w-4" />, label: t.loginFeatureBarcode },
  ];

  return (
    <div
      className={`flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950 lg:flex-row ${
        isArabic ? 'font-arabic' : ''
      }`}
    >
      {/* Brand panel — hidden on phones, where the form matters more than the pitch. */}
      <aside className="relative hidden w-full overflow-hidden bg-gray-950 lg:flex lg:w-[46%] lg:max-w-2xl lg:flex-col lg:justify-between lg:p-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.12) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -top-24 -start-16 h-72 w-72 rounded-full bg-brand-600/25 blur-3xl"
          aria-hidden
        />

        <div className="relative">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Boxes className="h-6 w-6" />
          </span>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-white">{t.title}</h1>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-gray-400">{t.subtitle}</p>
        </div>

        <ul className="relative mt-10 space-y-3">
          {features.map((feature) => (
            <li key={feature.label} className="flex items-center gap-3 text-sm text-gray-300">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-gray-800 bg-gray-900 text-brand-500">
                {feature.icon}
              </span>
              {feature.label}
            </li>
          ))}
        </ul>

        <div className="relative flex items-center gap-2 text-2xs uppercase tracking-wider text-gray-500">
          <span className="h-px w-8 bg-brand-600" aria-hidden />
          {t.version} {APP_VERSION}
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex flex-1 flex-col">
        <div className="flex items-center justify-between px-5 pt-5 sm:px-8">
          <div className="flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Boxes className="h-5 w-5" />
            </span>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">{t.title}</span>
          </div>
          <div className="ms-auto">
            {onToggleLanguage && onToggleTheme && (
              <AppControls
                language={language}
                theme={theme}
                onToggleLanguage={onToggleLanguage}
                onToggleTheme={onToggleTheme}
              />
            )}
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8">
          <div className="w-full max-w-sm">
            <h2 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
              {t.login}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t.subtitle}</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <Field label={t.username} htmlFor="login-username">
                <Input
                  id="login-username"
                  type="text"
                  name="username"
                  size="lg"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  leadingIcon={<UserIcon />}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t.usernamePlaceholder}
                  invalid={Boolean(error)}
                />
              </Field>

              <Field label={t.password} htmlFor="login-password">
                <Input
                  id="login-password"
                  type="password"
                  name="password"
                  size="lg"
                  autoComplete="current-password"
                  leadingIcon={<Lock />}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.passwordPlaceholder}
                  invalid={Boolean(error)}
                />
              </Field>

              <div className="flex items-center justify-between">
                <Checkbox
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  label={<span className="text-sm">{t.rememberMe}</span>}
                />
                {!online && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-warning-700 dark:text-warning-500">
                    <WifiOff className="h-3.5 w-3.5" />
                    {isArabic ? 'غير متصل' : 'Offline'}
                  </span>
                )}
              </div>

              {error && (
                <p
                  className="rounded-lg border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700 dark:border-danger-900 dark:bg-danger-900/20 dark:text-danger-100"
                  role="alert"
                >
                  {error}
                </p>
              )}

              {directoryEmpty && !isLoading && (
                <p className="rounded-lg border border-warning-100 bg-warning-50 px-3 py-2 text-xs text-warning-700 dark:border-warning-900 dark:bg-warning-900/20 dark:text-warning-100">
                  {t.loginDirectoryUnavailable}
                </p>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                block
                loading={isLoading}
                trailingIcon={<ArrowRight className="h-4 w-4 rtl:rotate-180" />}
              >
                {t.login}
              </Button>
            </form>

            <p className="mt-8 text-center text-xs text-gray-400 dark:text-gray-500 lg:text-start">
              {t.copyright}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;
