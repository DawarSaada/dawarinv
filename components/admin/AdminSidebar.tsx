import React from 'react';
import { 
  Shield, 
  LogOut, 
  Users, 
  Package, 
  FileText, 
  History, 
  Settings 
} from 'lucide-react';
import { Language } from '../../types';

interface AdminSidebarProps {
  activeTab: 'users' | 'inventory' | 'reports' | 'transactions' | 'settings';
  setActiveTab: (tab: 'users' | 'inventory' | 'reports' | 'transactions' | 'settings') => void;
  onLogout: () => void;
  language: Language;
  t: any;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeTab,
  setActiveTab,
  onLogout,
  language,
  t
}) => {
  const menuItems = [
    { id: 'users' as const, label: t.users, icon: Users },
    { id: 'inventory' as const, label: t.inventory, icon: Package },
    { id: 'reports' as const, label: t.reports, icon: FileText },
    { id: 'transactions' as const, label: t.viewLogs, icon: History },
    { id: 'settings' as const, label: language === 'ar' ? 'الإعدادات' : 'Settings', icon: Settings }
  ];

  return (
    <>
      {/* Header Mobile Only */}
      <div className="lg:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-brand-600 rounded-lg text-white">
            <Shield className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-gray-900 dark:text-white leading-tight">{t.adminDashboard}</span>
            <div className="flex items-center gap-1">
              <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-[8px] font-bold text-green-600 dark:text-green-400 uppercase tracking-tighter">Live</span>
            </div>
          </div>
        </div>
        <button onClick={onLogout} className="p-2 text-red-500 rounded-lg">
          <LogOut className="w-5 h-5 rtl:rotate-180" />
        </button>
      </div>

      {/* Desktop Sidebar & Mobile Top Nav */}
      <aside className="w-full lg:w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-row lg:flex-col overflow-x-auto lg:overflow-y-auto lg:z-20 scrollbar-hide">
        <div className="hidden lg:block p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-600 rounded-lg text-white">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{t.adminDashboard}</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-widest">Real-time Connected</span>
              </div>
            </div>
          </div>
        </div>

        <nav className="flex lg:flex-col p-2 lg:p-4 space-x-2 lg:space-x-0 lg:space-y-2 flex-grow">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex-shrink-0 flex items-center gap-3 px-4 py-2.5 sm:py-3 rounded-xl transition-all whitespace-nowrap ${activeTab === item.id ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-sm sm:text-base">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="hidden lg:block p-4 border-t border-gray-100 dark:border-gray-700">
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors font-medium"
          >
            <LogOut className="w-5 h-5 rtl:rotate-180" />
            {t.logout}
          </button>
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;
