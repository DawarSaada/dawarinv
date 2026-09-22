import React, { useState, useEffect, useMemo, useRef, Suspense, lazy } from 'react';
import Login from './components/Login';
import { useSubscription } from './components/SubscriptionGate';
import { useAppSettingsContext } from './components/AppSettingsProvider';
import { LocationId, Language, Theme, User, InventoryItem, Transaction, TransactionType, LocationData, TransactionStatus, UserRole, TransferSettings } from './types';

const LocationSelection = lazy(() => import('./components/LocationSelection'));
const InventoryDashboard = lazy(() => import('./components/InventoryDashboard'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const MammalEmployeeDashboard = lazy(() => import('./components/MammalEmployeeDashboard'));

const DashboardLoadingFallback: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors">
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Loading...</p>
    </div>
  </div>
);
import { LOCATIONS as STATIC_LOCATIONS, TRANSLATIONS, generateId } from './constants';
import { supabase } from './services/supabase';
import { useToast } from './components/Toast';
import { useAuth } from './hooks/useAuth';
import { useInventoryData } from './hooks/useInventoryData';
import { useLocationsQuery, useUsersQuery, useRealtimeSubscriptions, useTransactionsQuery, useCatalogQuery, useNotificationsQuery, useSuppliersQuery, usePurchaseOrdersQuery, useAuditsQuery } from './hooks/useQueries';
import { useNotifications } from './hooks/useNotifications';
import { usePwaStatus } from './hooks/usePwaStatus';
import { logger } from './utils/logger';


const App: React.FC = () => {
  const { addToast } = useToast();
  
  useRealtimeSubscriptions();

  const { data: locations = [] } = useLocationsQuery();
  const { data: fetchedUsers = [], isLoading: isLoadingUsers } = useUsersQuery();
  const { data: catalog = [] } = useCatalogQuery();
  const { data: suppliers = [] } = useSuppliersQuery();
  const { data: purchaseOrders = [] } = usePurchaseOrdersQuery();

  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Request Notification Permission
  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission();
        logger.info('Notification permission:', permission);
      } catch (e) {
        console.warn("Notification permission request failed", e);
      }
    }
  };

  const {
    users,
    setUsers,
    currentUser,
    setCurrentUser,
    handleLogin,
    handleLogout,
    handleCreateUser,
    handleEditUser,
    handleDeleteUser
  } = useAuth(requestNotificationPermission, fetchedUsers);

  // The subscription decision is enforced by SubscriptionGate, above this component,
  // so it is only read here to report the licence in the admin settings screen.
  const subscription = useSubscription();
  const subDetails = useMemo(
    () => ({
      status: subscription.status,
      expiry: subscription.expiresAt,
      state: subscription.state,
      reason: subscription.reason,
      checkedAt: subscription.checkedAt,
    }),
    [subscription.status, subscription.expiresAt, subscription.state, subscription.reason, subscription.checkedAt]
  );

  const [selectedLocation, setSelectedLocation] = useState<LocationId | null>(() => {
    try {
      const savedUserStr = localStorage.getItem('dawar_user');
      const expiryStr = localStorage.getItem('dawar_session_expiry');
      let user: User | null = null;

      if (savedUserStr && expiryStr && Date.now() < parseInt(expiryStr, 10)) {
        user = JSON.parse(savedUserStr);
      }

      if (user) {
        if (user.role === 'branch_manager') return user.branchCode || null;
        if (user.role === 'mammal_employee') return 'mammal';
        // Other roles usually want to select a location, so default to null
      }
    } catch (e) {
      console.error("Failed to restore location selection", e);
    }
    return null;
  });

  const { data: audits = [] } = useAuditsQuery();
  const { data: alerts = [] } = useNotificationsQuery(selectedLocation);

  // Theme & Language State - Initialize from localStorage
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('dawar_language');
    return (saved === 'ar' || saved === 'en') ? saved : 'en';
  });

  // Surfaces "ready offline" / "new version downloaded" states to the user.
  usePwaStatus(language);

  const {
    inventory,
    setInventory,
    transactions,
    setTransactions,
    isMutating,
    handleCleanUpTransactions,
    handleAddItem,
    handleEditItem,
    handleDeleteItem,
    handleBulkDeleteItems,
    handleBulkEditItems,
    handleTransfer,
    handleConfirmSourceTransfer,
    handleReceiveTransfer,
    handleRejectTransfer,
    handleDailyLog,
    handleBulkLog,
    handleReceiveTransferGroup,
    handleRejectTransferGroup,
    handleConfirmTransferGroup,
    handleAutoRejectExpired,
    handleMarkNotificationAsRead,
    handleMarkAllNotificationsAsRead,
    handleAddSupplier,
    handleEditSupplier,
    handleDeleteSupplier,
    handleCreatePO,
    handleEditPO,
    handleUpdatePOStatus,
    handleReceivePO,
    handleScheduleAudit,
    handleSaveAuditCounts,
    handleSubmitAudit,
    handleApplyAudit,
    handleDeleteAudit
  } = useInventoryData({ currentUser, selectedLocation, language, alerts, addToast });

  // Business settings (currency, transfer rules, retention) come from the shared
  // settings context, which reads the central store and tells the administrator when
  // it is only saving locally. See components/AppSettingsProvider.tsx.
  const {
    settings,
    save: saveSettings,
    centralStoreAvailable,
    centralValues,
    isLoading: settingsLoading,
  } = useAppSettingsContext();
  const transferSettings = settings.transfer;

  // Auto-reject expired transfers on app load. Waits for the settings to arrive: with
  // a central store the rule may differ from this browser's last known value, and
  // running the sweep on a stale rule would reject the wrong transfers.
  useEffect(() => {
    if (settingsLoading) return;
    if (transferSettings.enableAutoReject && transferSettings.autoRejectDays > 0 && currentUser?.role === 'admin') {
      handleAutoRejectExpired(transferSettings.autoRejectDays);
    }
  }, [currentUser?.role, settingsLoading]); // Only run once on login



  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('dawar_theme');
    return (saved === 'dark' || saved === 'light') ? saved : 'light';
  });

  // Handle document direction and theme class updates
  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // React Query handles loading state and data fetching automatically.
  // We no longer need manual fetchData or real-time debounce logic here.

  // Use the new notifications hook
  useNotifications(currentUser, selectedLocation, transactions || [], locations, language);

  // Auto-request permission on login and cleanup transactions
  useEffect(() => {
    if (currentUser) {
      requestNotificationPermission();
    }

    // Auto cleanup transactions if admin, using the administrator's retention setting.
    // 0 means keep everything, which is why nothing is deleted until it is set.
    //
    // Deliberately requires the value to come from the central store. This deletes
    // history permanently, and a number left behind in one browser's localStorage is
    // not a decision anyone made — the old screen wrote exactly such values. Without
    // this, opening the app on a machine where a retention period was once tried would
    // run a delete nobody asked for. An administrator who wants it either sets it in
    // Settings (which stores it centrally) or presses "Clean up now", which confirms.
    if (currentUser?.role === 'admin' && centralValues.retentionMonths !== undefined) {
      const months = centralValues.retentionMonths;
      if (months > 0) {
        handleCleanUpTransactions(months);
      }
    }
  }, [currentUser, centralValues.retentionMonths]);

  // Dynamically calculate available locations based on state and permissions
  const availableLocations = useMemo<LocationData[]>(() => {
    // Filter based on user permissions
    if (currentUser) {
      if (currentUser.role === 'branch_manager') {
        const accessible = new Set([
          ...(currentUser.accessibleBranches || []),
          ...(currentUser.readOnlyBranches || [])
        ]);
        accessible.add(currentUser.branchCode!);
        return locations.filter(loc => accessible.has(loc.id));
      }
      if (currentUser.role === 'mammal_employee') {
        return locations.filter(loc => loc.id === 'mammal');
      }
    }
    return locations;
  }, [locations, currentUser]);

  const toggleLanguage = () => {
    setLanguage(prev => {
      const newLang = prev === 'en' ? 'ar' : 'en';
      localStorage.setItem('dawar_language', newLang);
      return newLang;
    });
  };

  const getUserName = (name: string) => {
    if (language === 'en') return name;
    const user = users.find(u => u.name === name);
    return user?.nameAr || name;
  };

  const toggleTheme = () => {
    setTheme(prev => {
      const newTheme = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('dawar_theme', newTheme);
      return newTheme;
    });
  };






  const displayInventory = useMemo(() => {
    if (!inventory) return [];
    
    const rawItems = selectedLocation === 'all'
      ? Object.entries(inventory).flatMap(([locId, items]) => (items as InventoryItem[]).map(i => ({ ...i, locationId: locId })))
      : inventory[selectedLocation || ''] || [];

    if (selectedLocation !== 'all') return rawItems;

    // Consolidate global view: group by nameEn + nameAr + category + unit
    const grouped: Record<string, InventoryItem & { locationNames: string[], allIds: string[] }> = {};

    rawItems.forEach(item => {
      // Use a composite key for grouping
      const key = `${item.nameEn.toLowerCase()}|${item.nameAr}|${item.category}|${item.unit}`;
      if (!grouped[key]) {
        const locName = availableLocations.find(l => l.id === item.locationId)?.name || item.locationId || '';
        grouped[key] = {
          ...item,
          quantity: Number(item.quantity),
          locationNames: locName ? [locName] : [],
          allIds: [item.id]
        };
      } else {
        grouped[key].quantity += Number(item.quantity);
        const locName = availableLocations.find(l => l.id === item.locationId)?.name || item.locationId || '';
        if (locName && !grouped[key].locationNames.includes(locName)) {
          grouped[key].locationNames.push(locName);
        }
        grouped[key].allIds.push(item.id);
      }
    });

    return Object.values(grouped).map(item => ({
      ...item,
      id: item.allIds.join(','), // Use joined IDs as the temporary ID for selection
      locationId: item.locationNames.join(', ') // Display joined location names in the locationId field for global view
    }));
  }, [inventory, selectedLocation, availableLocations]);

  // Loading is handled by React Query at component levels, 
  // or we can show a global loader if data is absolutely required before rendering.

  if (!currentUser) {
    return (
      <div className={`font-sans antialiased text-gray-900 bg-gray-50 dark:bg-gray-900 dark:text-gray-100 min-h-screen overflow-x-hidden transition-colors ${language === 'ar' ? 'font-arabic' : ''}`}>
        {isOffline && (
          <div className="bg-orange-500 text-white text-center py-2 text-sm font-bold shadow-md relative z-50">
            {language === 'ar' ? 'أنت في وضع عدم الاتصال (أوفلاين)' : 'You are currently offline'}
          </div>
        )}
        <Login
          onLogin={(user, rememberMe) => handleLogin(user, rememberMe, setSelectedLocation)}
          language={language}
          users={users}
          isLoading={isLoadingUsers}
          theme={theme}
          onToggleLanguage={toggleLanguage}
          onToggleTheme={toggleTheme}
        />
      </div>
    );
  }

  const canAccessAdminDashboard = ['admin', 'warehouse_manager'].includes(currentUser.role);
  if (canAccessAdminDashboard && !selectedLocation) {
    return (
      <div className={`font-sans antialiased text-gray-900 bg-gray-50 dark:bg-gray-900 dark:text-gray-100 min-h-screen overflow-x-hidden transition-colors ${language === 'ar' ? 'font-arabic' : ''}`}>
        {isOffline && (
          <div className="bg-orange-500 text-white text-center py-2 text-sm font-bold shadow-md relative z-50">
            {language === 'ar' ? 'أنت في وضع عدم الاتصال (أوفلاين)' : 'You are currently offline'}
          </div>
        )}
        <Suspense fallback={<DashboardLoadingFallback />}>
          <AdminDashboard
            currentUserRole={currentUser.role}
            currentUser={currentUser}
            users={users}
            transactions={transactions}
            inventory={inventory}
            catalog={catalog}
            onCreateUser={(user) => handleCreateUser(user)}
            onEditUser={(user) => handleEditUser(user)}
            onDeleteUser={handleDeleteUser}
            onDeleteItem={handleDeleteItem}
            onLogout={() => handleLogout(setSelectedLocation, () => { })}
            language={language}
            availableLocations={availableLocations}
            onManageLocation={setSelectedLocation}
            onCleanUpTransactions={handleCleanUpTransactions}
            getUserName={getUserName}
            subDetails={subDetails}
            onRefreshSubscription={subscription.refresh}
            transferSettings={transferSettings}
            onTransferSettingsChange={(next) => {
              // Saved to the central store when phase10 is applied; otherwise the hook
              // falls back to this browser and says so in the settings screen.
              void saveSettings({ transfer: next }, { updatedBy: getUserName(currentUser.role) });
            }}
            retentionMonths={settings.retentionMonths}
            onRetentionMonthsChange={(months) =>
              saveSettings({ retentionMonths: months }, { updatedBy: getUserName(currentUser.role) })
            }
            settingsAreShared={centralStoreAvailable}
            suppliers={suppliers}
            purchaseOrders={purchaseOrders}
            onAddSupplier={handleAddSupplier}
            onEditSupplier={handleEditSupplier}
            onDeleteSupplier={handleDeleteSupplier}
            onCreatePO={handleCreatePO}
            onEditPO={handleEditPO}
            onUpdatePOStatus={handleUpdatePOStatus}
            onReceivePO={handleReceivePO}
            audits={audits}
            onScheduleAudit={handleScheduleAudit}
            onSaveAuditCounts={handleSaveAuditCounts}
            onSubmitAudit={handleSubmitAudit}
            onApplyAudit={handleApplyAudit}
            onDeleteAudit={handleDeleteAudit}
            alerts={alerts}
            onMarkNotificationAsRead={handleMarkNotificationAsRead}
            onMarkAllNotificationsAsRead={handleMarkAllNotificationsAsRead}
            theme={theme}
            onToggleTheme={toggleTheme}
            onToggleLanguage={toggleLanguage}
          />
        </Suspense>
      </div>
    );
  }

  if (currentUser.role === 'mammal_employee' && selectedLocation === 'mammal') {
    return (
      <div className={`font-sans antialiased text-gray-900 bg-gray-50 dark:bg-gray-900 dark:text-gray-100 min-h-screen overflow-x-hidden transition-colors ${language === 'ar' ? 'font-arabic' : ''}`}>
        {isOffline && (
          <div className="bg-orange-500 text-white text-center py-2 text-sm font-bold shadow-md relative z-50">
            {language === 'ar' ? 'أنت في وضع عدم الاتصال (أوفلاين)' : 'You are currently offline'}
          </div>
        )}
        <Suspense fallback={<DashboardLoadingFallback />}>
          <MammalEmployeeDashboard
            items={inventory['mammal'] || []}
            onLogout={() => handleLogout(setSelectedLocation, () => { })}
            language={language}
            onLogTransaction={handleDailyLog}
            onBulkLogTransaction={handleBulkLog}
            userName={language === 'ar' ? (currentUser.nameAr || currentUser.name) : currentUser.name}
            transactions={transactions}
            alerts={alerts}
            onMarkNotificationAsRead={handleMarkNotificationAsRead}
            onMarkAllNotificationsAsRead={handleMarkAllNotificationsAsRead}
            theme={theme}
            onToggleTheme={toggleTheme}
            onToggleLanguage={toggleLanguage}
          />
        </Suspense>
      </div>
    );
  }

  if (!selectedLocation) {
    return (
      <div className={`font-sans antialiased text-gray-900 bg-gray-50 dark:bg-gray-900 dark:text-gray-100 min-h-screen overflow-x-hidden transition-colors pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] px-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] ${language === 'ar' ? 'font-arabic' : ''}`}>
        {isOffline && (
          <div className="bg-orange-500 text-white text-center py-2 text-sm font-bold shadow-md relative z-50">
            {language === 'ar' ? 'أنت في وضع عدم الاتصال (أوفلاين)' : 'You are currently offline'}
          </div>
        )}
        <Suspense fallback={<DashboardLoadingFallback />}>
          <LocationSelection
            onSelect={setSelectedLocation}
            onLogout={() => handleLogout(setSelectedLocation, () => { })}
            language={language}
            availableLocations={availableLocations}
            currentUserRole={currentUser.role}
            theme={theme}
            onToggleTheme={toggleTheme}
            onToggleLanguage={toggleLanguage}
          />
        </Suspense>
      </div>
    );
  }

  const incomingTransfers = transactions.filter(t =>
    (selectedLocation === 'all' ? true : t.toLocation === selectedLocation) &&
    t.status === 'pending_target'
  );

  const outgoingTransfers = transactions.filter(t =>
    (selectedLocation === 'all' ? true : t.fromLocation === selectedLocation) &&
    t.status === 'pending_target'
  );

  const outgoingApprovals = transactions.filter(t =>
    (selectedLocation === 'all' ? true : t.fromLocation === selectedLocation) &&
    t.status === 'pending_source'
  );

  return (
    <div className={`font-sans antialiased text-gray-900 bg-gray-50 dark:bg-gray-900 dark:text-gray-100 min-h-screen overflow-x-hidden transition-colors pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] px-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] ${language === 'ar' ? 'font-arabic' : ''}`}>
      {isOffline && (
        <div className="bg-orange-500 text-white text-center py-2 text-sm font-bold shadow-md relative z-50">
          {language === 'ar' ? 'أنت في وضع عدم الاتصال (أوفلاين)' : 'You are currently offline'}
        </div>
      )}
      <Suspense fallback={<DashboardLoadingFallback />}>
        <InventoryDashboard
          key={selectedLocation || 'global'}
          locationId={selectedLocation}
          inventory={displayInventory}
          transactions={transactions}
          onBack={() => setSelectedLocation(null)}
          onLogout={() => handleLogout(setSelectedLocation, () => { })}
          language={language}
          theme={theme}
          onToggleTheme={toggleTheme}
          onToggleLanguage={toggleLanguage}
          onTransfer={handleTransfer}
          onAddItem={handleAddItem}
          onEditItem={handleEditItem}
          onDeleteItem={handleDeleteItem}
          onBulkDeleteItems={handleBulkDeleteItems}
          onBulkEditItems={handleBulkEditItems}
          onRecordUsage={(itemId, qty, notes) => handleDailyLog('usage', itemId, qty, notes)}
          onRecordReceive={(itemId, qty, notes) => handleDailyLog('receive', itemId, qty, notes)}
          userRole={currentUser.role}
          userBranchCode={currentUser.branchCode}
          accessibleBranches={currentUser.accessibleBranches}
          readOnlyBranches={currentUser.readOnlyBranches}
          incomingTransfers={incomingTransfers}
          outgoingTransfers={outgoingTransfers}
          outgoingApprovals={outgoingApprovals}
          onReceiveTransfer={handleReceiveTransfer}
          onRejectTransfer={handleRejectTransfer}
          onConfirmOutbound={handleConfirmSourceTransfer}
          availableLocations={availableLocations}
          getUserName={getUserName}
          catalog={catalog}
          alerts={alerts}
          onMarkNotificationAsRead={handleMarkNotificationAsRead}
          onMarkAllNotificationsAsRead={handleMarkAllNotificationsAsRead}
          transferSettings={transferSettings}
          onReceiveTransferGroup={handleReceiveTransferGroup}
          onRejectTransferGroup={handleRejectTransferGroup}
          onConfirmTransferGroup={handleConfirmTransferGroup}
          audits={audits}
          onScheduleAudit={handleScheduleAudit}
          onSaveAuditCounts={handleSaveAuditCounts}
          onSubmitAudit={handleSubmitAudit}
          onApplyAudit={handleApplyAudit}
          onDeleteAudit={handleDeleteAudit}
          suppliers={suppliers}
          purchaseOrders={purchaseOrders}
          onCreatePO={handleCreatePO}
          onEditPO={handleEditPO}
          onUpdatePOStatus={handleUpdatePOStatus}
          onReceivePO={handleReceivePO}
        />
      </Suspense>
    </div>
  );
};

export default App;