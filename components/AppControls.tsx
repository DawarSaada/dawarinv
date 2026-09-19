import React from 'react';
import { Languages, Moon, Sun } from 'lucide-react';
import { Language, Theme } from '../types';
import { cn } from './ui/cn';

interface AppControlsProps {
  language: Language;
  theme: Theme;
  onToggleLanguage: () => void;
  onToggleTheme: () => void;
  /** `floating` keeps the legacy fixed bottom-corner placement. */
  variant?: 'inline' | 'floating';
  /** Shows word labels next to the icons. */
  showLabels?: boolean;
  className?: string;
}

const baseButton =
  'flex h-9 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white';

/**
 * Theme and language switches.
 *
 * Rendered inline in a header instead of floating over content: the previous
 * fixed overlay sat on top of cards, tables and forms on every screen. Icons
 * only by default so the top bar stays quiet on small screens.
 */
const AppControls: React.FC<AppControlsProps> = ({
  language,
  theme,
  onToggleLanguage,
  onToggleTheme,
  variant = 'inline',
  showLabels = false,
  className,
}) => {
  const isAr = language === 'ar';

  return (
    <div
      className={cn(
        'flex items-center gap-1.5',
        variant === 'floating' && 'fixed bottom-4 end-4 z-toast pb-safe',
        className
      )}
    >
      <button
        type="button"
        onClick={onToggleTheme}
        className={cn(baseButton, showLabels ? 'px-2.5' : 'w-9')}
        aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        title={theme === 'light' ? (isAr ? 'الوضع الداكن' : 'Dark mode') : isAr ? 'الوضع الفاتح' : 'Light mode'}
      >
        {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        {showLabels && (
          <span>
            {theme === 'light' ? (isAr ? 'داكن' : 'Dark') : isAr ? 'فاتح' : 'Light'}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={onToggleLanguage}
        className={cn(baseButton, 'px-2.5')}
        aria-label={isAr ? 'Switch to English' : 'التبديل إلى العربية'}
        title={isAr ? 'English' : 'العربية'}
      >
        <Languages className="h-4 w-4 text-brand-600" />
        {showLabels ? (
          <span className={isAr ? 'font-sans' : 'font-arabic'}>
            {isAr ? 'English' : 'العربية'}
          </span>
        ) : (
          <span className={isAr ? 'font-sans' : 'font-arabic'}>{isAr ? 'EN' : 'ع'}</span>
        )}
      </button>
    </div>
  );
};

export default AppControls;
