import React, { useState } from 'react';
import { User as UserIcon, Lock, ArrowRight, Check } from 'lucide-react';
import { TRANSLATIONS } from '../constants';
import { Language, User } from '../types';

interface LoginProps {
  onLogin: (user: User, rememberMe: boolean) => void;
  language: Language;
  users: User[];
  isLoading?: boolean;
}

const Login: React.FC<LoginProps> = ({ onLogin, language, users, isLoading = false }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  
  const t = TRANSLATIONS[language];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
      onLogin(user, rememberMe);
    } else {
      setError(t.invalidCredentials);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 transition-colors">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden transition-colors">
        <div className="bg-brand-600 dark:bg-brand-700 p-8 text-center transition-colors">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 mb-4 backdrop-blur-sm">
             <UserIcon className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white font-arabic mb-2">{t.title}</h1>
          <p className="text-brand-100">{t.subtitle}</p>
        </div>
        
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.username}</label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 rtl:pr-10 rtl:pl-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder={t.usernamePlaceholder}
                />
                <UserIcon className="w-5 h-5 text-gray-400 absolute left-3 rtl:right-3 rtl:left-auto top-3.5" />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.password}</label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 rtl:pr-10 rtl:pl-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder={t.passwordPlaceholder}
                />
                <Lock className="w-5 h-5 text-gray-400 absolute left-3 rtl:right-3 rtl:left-auto top-3.5" />
              </div>
            </div>
            
            <div className="flex items-center">
              <button 
                type="button"
                onClick={() => setRememberMe(!rememberMe)}
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
              >
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${rememberMe ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'}`}>
                  {rememberMe && <Check className="w-3.5 h-3.5" />}
                </div>
                {t.rememberMe}
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (language === 'ar' ? 'جاري التحميل...' : 'Loading...') : t.login}
              {!isLoading && <ArrowRight className="w-5 h-5 rtl:rotate-180" />}
            </button>
          </form>
          
          <div className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
            {t.copyright}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;