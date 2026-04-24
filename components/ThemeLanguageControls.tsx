import React from 'react';
import { Sun, Moon, Languages } from 'lucide-react';
import { Language, Theme } from '../types';

interface ThemeLanguageControlsProps {
  language: Language;
  theme: Theme;
  onToggleLanguage: () => void;
  onToggleTheme: () => void;
}

const ThemeLanguageControls: React.FC<ThemeLanguageControlsProps> = ({
  language,
  theme,
  onToggleLanguage,
  onToggleTheme
}) => {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex gap-2 rtl:left-4 rtl:right-auto flex-col-reverse sm:flex-row pb-safe">
      {/* Theme Toggle */}
      <button
        onClick={onToggleTheme}
        className="p-3 rounded-full bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all group"
        title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
      >
        {theme === 'light' ? (
          <Moon className="w-6 h-6 text-gray-700 group-hover:text-brand-600 dark:text-gray-200" />
        ) : (
          <Sun className="w-6 h-6 text-yellow-400 group-hover:text-yellow-300" />
        )}
      </button>

      {/* Language Toggle */}
      <button
        onClick={onToggleLanguage}
        className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-full bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all text-sm font-bold text-gray-700 dark:text-gray-200"
        title="Switch Language"
      >
        <Languages className="w-5 h-5 text-brand-600" />
        <span className={language === 'ar' ? 'font-arabic' : 'font-sans'}>
          {language === 'en' ? 'AR' : 'EN'}
        </span>
      </button>
    </div>
  );
};

export default ThemeLanguageControls;