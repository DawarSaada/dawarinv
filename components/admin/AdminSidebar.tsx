import React from 'react';
import { 
  Shield, 
  LogOut, 
  Users, 
  Package, 
  FileText, 
  History, 
  Settings,
  BookOpen,
  Building2,
  ShoppingCart,
  ClipboardCheck,
  Activity
} from 'lucide-react';
import { Language, UserRole, AppNotification } from '../../types';
import NotificationCenter from '../NotificationCenter';

interface AdminSidebarProps {
  currentUserRole: UserRole;
  activeTab: 'users' | 'inventory' | 'reports' | 'transactions' | 'settings' | 'catalog' | 'analytics' | 'suppliers' | 'purchase_orders' | 'audits';
  setActiveTab: (tab: any) => void;
  onLogout: () => void;
  language: Language;
  t: any;
  alerts?: AppNotification[];
  onMarkNotificationAsRead?: (id: string) => void;
  onMarkAllNotificationsAsRead?: () => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({
  currentUserRole,
  activeTab,
  setActiveTab,
  onLogout,
  language,
  t,
  alerts = [],
  onMarkNotificationAsRead,
  onMarkAllNotificationsAsRead
}) => {
  const allMenuItems = [
    { id: 'users' as const, label: t.users, icon: Users, adminOnly: true },
    { id: 'inventory' as const, label: t.inventory, icon: Package, adminOnly: false },
    { id: 'catalog' as const, label: language === 'ar' ? 'دليل المنتجات' : 'Catalog', icon: BookOpen, adminOnly: true },
    { id: 'reports' as const, label: t.reports, icon: FileText, adminOnly: false },
    { id: 'analytics' as const, label: language === 'ar' ? 'التحليلات' : 'Analytics', icon: Activity, adminOnly: false },
    { id: 'audits' as const, label: language === 'ar' ? 'الجرد الدوري' : 'Audits', icon: ClipboardCheck, adminOnly: false },
    { id: 'suppliers' as const, label: language === 'ar' ? 'الموردين' : 'Suppliers', icon: Building2, adminOnly: false },
    { id: 'purchase_orders' as const, label: language === 'ar' ? 'أوامر الشراء' : 'Purchase Orders', icon: ShoppingCart, adminOnly: false },
    { id: 'transactions' as const, label: t.viewLogs, icon: History, adminOnly: false },
    { id: 'settings' as const, label: language === 'ar' ? 'الإعدادات' : 'Settings', icon: Settings, adminOnly: true }
  ];

  const menuItems = allMenuItems.filter(item => currentUserRole === 'admin' || !item.adminOnly);

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
        <div className="flex items-center gap-2">
          <NotificationCenter 
            notifications={alerts}
            language={language}
            t={t}
            onMarkAsRead={onMarkNotificationAsRead || (() => {})}
            onMarkAllAsRead={onMarkAllNotificationsAsRead || (() => {})}
          />
          <button onClick={onLogout} className="p-2 text-red-500 rounded-lg">
            <LogOut className="w-5 h-5 rtl:rotate-180" />
          </button>
        </div>
      </div>

      {/* Desktop Sidebar & Mobile Top Nav */}
      <aside className="w-full lg:w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-row lg:flex-col lg:z-20 shrink-0">
        <div className="hidden lg:block p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
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
          <div className="flex items-center gap-2 mt-2 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-xl border border-gray-100 dark:border-gray-600">
            <NotificationCenter 
              notifications={alerts}
              language={language}
              t={t}
              onMarkAsRead={onMarkNotificationAsRead || (() => {})}
              onMarkAllAsRead={onMarkAllNotificationsAsRead || (() => {})}
              align={language === 'ar' ? 'right' : 'left'}
            />
            <span className="text-sm font-bold text-gray-600 dark:text-gray-300">{t.notifications || 'Notifications'}</span>
          </div>
        </div>

        <nav className="flex lg:flex-col p-2 lg:p-4 space-x-2 lg:space-x-0 lg:space-y-2 flex-grow overflow-x-auto lg:overflow-y-auto scrollbar-hide">
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
