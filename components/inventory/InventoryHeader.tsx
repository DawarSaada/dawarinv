import React from 'react';
import { 
  ArrowLeft, 
  Sparkles, 
  LogOut 
} from 'lucide-react';
import { AppNotification, Language } from '../../types';
import NotificationCenter from '../NotificationCenter';

interface InventoryHeaderProps {
  onBack: () => void;
  locationName: string;
  isGlobalView: boolean;
  t: any;
  isAssistantOpen: boolean;
  setIsAssistantOpen: (val: boolean) => void;
  onLogout: () => void;
  alerts?: AppNotification[];
  language?: Language;
}

const InventoryHeader: React.FC<InventoryHeaderProps> = ({
  onBack,
  locationName,
  isGlobalView,
  t,
  isAssistantOpen,
  setIsAssistantOpen,
  onLogout,
  alerts = [],
  language = 'en'
}) => {
  const handleMarkAsRead = (id: string) => {
    // In a real app with Supabase, we would do a mutation.
    // For now, let's keep it visually working (the actual mutation will be handled if passed in)
  };

  const handleMarkAllAsRead = () => {
    // Mutation
  };
  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20 transition-colors">
      <div className="px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400 transition-colors flex-shrink-0">
            <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="truncate">{locationName}</span>
              <div className="flex-shrink-0 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-tighter">Live</span>
              </div>
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">{isGlobalView ? t.globalInventoryDesc : t.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-3">
          <button onClick={() => setIsAssistantOpen(!isAssistantOpen)} className={`p-2 sm:px-4 sm:py-2 rounded-lg font-medium transition-all ${isAssistantOpen ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 ring-1 ring-brand-200 dark:ring-brand-800' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
            <Sparkles className="w-4 h-4 text-brand-500 sm:mr-2 sm:rtl:ml-2 sm:rtl:mr-0 inline" />
            <span className="hidden sm:inline">{t.askAI}</span>
          </button>
          <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>
          
          <NotificationCenter 
            notifications={alerts}
            language={language}
            t={t}
            onMarkAsRead={handleMarkAsRead}
            onMarkAllAsRead={handleMarkAllAsRead}
          />

          <button onClick={onLogout} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600 dark:text-gray-500 rounded-lg transition-colors ml-1 rtl:ml-0 rtl:mr-1">
            <LogOut className="w-5 h-5 rtl:rotate-180" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default InventoryHeader;
