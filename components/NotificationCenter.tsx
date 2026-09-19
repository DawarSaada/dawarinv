import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, Package, ArrowRightLeft, Info, X } from 'lucide-react';
import { AppNotification, Language } from '../types';

interface NotificationCenterProps {
  notifications: AppNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead?: () => void;
  language: Language;
  t: any;
  align?: 'left' | 'right';
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  language,
  t,
  align
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'low_stock': return <Package className="w-5 h-5 text-red-500" />;
      case 'transfer': return <ArrowRightLeft className="w-5 h-5 text-brand-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffHours = Math.abs(now.getTime() - date.getTime()) / 36e5;
    
    if (diffHours < 24) {
      return date.toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
        title={t.notifications || 'Notifications'}
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[9px] font-bold text-white items-center justify-center border-2 border-white dark:border-gray-900">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </span>
        )}
      </button>

      {isOpen && (
        <div className={`absolute ${align ? (align === 'left' ? 'left-0' : 'right-0') : (language === 'ar' ? 'left-0' : 'right-0')} mt-2 w-80 sm:w-96 bg-white dark:bg-gray-900 rounded-xl shadow-pop border border-gray-200 dark:border-gray-800 z-50 overflow-hidden flex flex-col max-h-[80vh]`}>
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-900/50">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Bell className="w-4 h-4" />
              {t.notifications || 'Notifications'}
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 rounded-full text-xs">
                  {unreadCount} {t.new || 'New'}
                </span>
              )}
            </h3>
            {unreadCount > 0 && onMarkAllAsRead && (
              <button 
                onClick={() => onMarkAllAsRead()}
                className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 font-medium"
              >
                {t.markAllAsRead || 'Mark all as read'}
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1 p-2">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center">
                <Bell className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-sm">{t.noNotifications || 'No notifications yet'}</p>
              </div>
            ) : (
              <div className="space-y-1">
                {notifications.map((notification) => (
                  <div 
                    key={notification.id}
                    className={`p-3 rounded-xl flex gap-3 transition-colors ${notification.isRead ? 'opacity-70 hover:bg-gray-50 dark:hover:bg-gray-700/50' : 'bg-brand-50/50 dark:bg-brand-900/10 hover:bg-brand-50 dark:hover:bg-brand-900/20'}`}
                  >
                    <div className={`mt-0.5 p-2 rounded-full h-fit shrink-0 ${notification.isRead ? 'bg-gray-100 dark:bg-gray-800' : 'bg-white dark:bg-gray-900 shadow-sm'}`}>
                      {getIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm text-gray-900 dark:text-white ${!notification.isRead ? 'font-bold' : ''}`}>
                        {language === 'ar' ? notification.messageAr : notification.messageEn}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">
                        {formatTime(notification.createdAt)}
                      </p>
                    </div>
                    {!notification.isRead && (
                      <button 
                        onClick={() => onMarkAsRead(notification.id)}
                        className="p-1.5 h-fit text-brand-600 hover:bg-brand-100 dark:hover:bg-brand-900/50 rounded-full transition-colors shrink-0"
                        title={t.markAsRead || 'Mark as read'}
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
