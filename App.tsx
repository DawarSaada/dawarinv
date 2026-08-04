import React, { useState, useEffect, useMemo, useRef } from 'react';
import Login from './components/Login';
import LocationSelection from './components/LocationSelection';
import InventoryDashboard from './components/InventoryDashboard';
import AdminDashboard from './components/AdminDashboard';
import MammalEmployeeDashboard from './components/MammalEmployeeDashboard';
import ThemeLanguageControls from './components/ThemeLanguageControls';
import { LocationId, Language, Theme, User, InventoryItem, Transaction, TransactionType, LocationData, TransactionStatus, UserRole, TransferSettings } from './types';
import { LOCATIONS as STATIC_LOCATIONS, TRANSLATIONS, INITIAL_INVENTORY, INITIAL_USERS, generateId } from './constants';
import { supabase } from './services/supabase';
import { useToast } from './components/Toast';
import { useAuth } from './hooks/useAuth';
import { useInventoryData } from './hooks/useInventoryData';
import { useLocationsQuery, useUsersQuery, useRealtimeSubscriptions, useTransactionsQuery, useCatalogQuery, useNotificationsQuery, useSuppliersQuery, usePurchaseOrdersQuery, useAuditsQuery } from './hooks/useQueries';
import { useNotifications } from './hooks/useNotifications';
import { useOMSSubscription } from './hooks/useOMSSubscription';


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
        console.log('Notification permission:', permission);
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

  const { isSubscriptionLocked, isLoading: isSubLoading, subDetails } = useOMSSubscription();

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

  // Transfer Settings (admin-configurable)
  const [transferSettings, setTransferSettings] = useState<TransferSettings>(() => {
    try {
      const saved = localStorage.getItem('dawar_transfer_settings');
      if (saved) return JSON.parse(saved);
    } catch (e) { /* ignore */ }
    return { enableSignatureCapture: false, enablePhotoEvidence: false, enableAutoReject: false, autoRejectDays: 7 };
  });

  // Auto-reject expired transfers on app load
  useEffect(() => {
    if (transferSettings.enableAutoReject && transferSettings.autoRejectDays > 0 && currentUser?.role === 'admin') {
      handleAutoRejectExpired(transferSettings.autoRejectDays);
    }
  }, [currentUser?.role]); // Only run once on login



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

    // Auto cleanup transactions if admin
    if (currentUser?.role === 'admin') {
      const retentionStr = localStorage.getItem('dawar_retention_months');
      if (retentionStr) {
        const months = parseInt(retentionStr, 10);
        if (!isNaN(months) && months > 0) {
          handleCleanUpTransactions(months);
        }
      }
    }
  }, [currentUser]);

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

  // Subscription Blocking Logic
  if (isSubscriptionLocked && currentUser?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-8 text-center border border-gray-100 dark:border-gray-700">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Subscription Expired</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-8">
            The OMS subscription has expired or is inactive. This inventory management application has been temporarily locked.
          </p>
          <div className="p-4 bg-brand-50 dark:bg-brand-900/20 rounded-xl border border-brand-100 dark:border-brand-800/30">
            <p className="text-sm font-medium text-brand-800 dark:text-brand-300">
              Please contact the Admin to renew the subscription.
            </p>
          </div>
          <button 
            onClick={() => handleLogout(setSelectedLocation, () => { })}
            className="mt-8 px-6 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

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
      <div className={`font-sans antialiased text-gray-900 bg-gray-50 dark:bg-gray-900 min-h-screen overflow-x-hidden transition-colors ${language === 'ar' ? 'font-arabic' : ''}`}>
        {isOffline && (
          <div className="bg-orange-500 text-white text-center py-2 text-sm font-bold shadow-md relative z-50">
            {language === 'ar' ? 'أنت في وضع عدم الاتصال (أوفلاين)' : 'You are currently offline'}
          </div>
        )}
        <ThemeLanguageControls language={language} theme={theme} onToggleLanguage={toggleLanguage} onToggleTheme={toggleTheme} />
        <Login onLogin={(user, rememberMe) => handleLogin(user, rememberMe, setSelectedLocation)} language={language} users={users} />
      </div>
    );
  }

  const canAccessAdminDashboard = ['admin', 'warehouse_manager'].includes(currentUser.role);
  if (canAccessAdminDashboard && !selectedLocation) {
    return (
      <div className={`font-sans antialiased text-gray-900 bg-gray-50 dark:bg-gray-900 min-h-screen overflow-x-hidden transition-colors ${language === 'ar' ? 'font-arabic' : ''}`}>
        {isOffline && (
          <div className="bg-orange-500 text-white text-center py-2 text-sm font-bold shadow-md relative z-50">
            {language === 'ar' ? 'أنت في وضع عدم الاتصال (أوفلاين)' : 'You are currently offline'}
          </div>
        )}
        <ThemeLanguageControls language={language} theme={theme} onToggleLanguage={toggleLanguage} onToggleTheme={toggleTheme} />
        <AdminDashboard
          currentUserRole={currentUser.role}
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
          transferSettings={transferSettings}
          onTransferSettingsChange={(settings) => {
            setTransferSettings(settings);
            localStorage.setItem('dawar_transfer_settings', JSON.stringify(settings));
          }}
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
        />
      </div>
    );
  }

  if (currentUser.role === 'mammal_employee' && selectedLocation === 'mammal') {
    return (
      <div className={`font-sans antialiased text-gray-900 bg-gray-50 dark:bg-gray-900 min-h-screen overflow-x-hidden transition-colors ${language === 'ar' ? 'font-arabic' : ''}`}>
        {isOffline && (
          <div className="bg-orange-500 text-white text-center py-2 text-sm font-bold shadow-md relative z-50">
            {language === 'ar' ? 'أنت في وضع عدم الاتصال (أوفلاين)' : 'You are currently offline'}
          </div>
        )}
        <ThemeLanguageControls language={language} theme={theme} onToggleLanguage={toggleLanguage} onToggleTheme={toggleTheme} />
        <MammalEmployeeDashboard
          items={inventory['mammal'] || []}
          onLogout={() => handleLogout(setSelectedLocation, () => { })}
          language={language}
          onLogTransaction={handleDailyLog}
          onBulkLogTransaction={handleBulkLog}
          userName={language === 'ar' ? (currentUser.nameAr || currentUser.name) : currentUser.name}
          transactions={transactions}
        />
      </div>
    );
  }

  if (!selectedLocation) {
    return (
      <div className={`font-sans antialiased text-gray-900 bg-gray-50 dark:bg-gray-900 min-h-screen overflow-x-hidden transition-colors pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] px-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] ${language === 'ar' ? 'font-arabic' : ''}`}>
        {isOffline && (
          <div className="bg-orange-500 text-white text-center py-2 text-sm font-bold shadow-md relative z-50">
            {language === 'ar' ? 'أنت في وضع عدم الاتصال (أوفلاين)' : 'You are currently offline'}
          </div>
        )}
        <ThemeLanguageControls language={language} theme={theme} onToggleLanguage={toggleLanguage} onToggleTheme={toggleTheme} />
        <LocationSelection
          onSelect={setSelectedLocation}
          onLogout={() => handleLogout(setSelectedLocation, () => { })}
          language={language}
          availableLocations={availableLocations}
          currentUserRole={currentUser.role}
        />
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
    <div className={`font-sans antialiased text-gray-900 bg-gray-50 dark:bg-gray-900 min-h-screen overflow-x-hidden transition-colors pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] px-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] ${language === 'ar' ? 'font-arabic' : ''}`}>
      {isOffline && (
        <div className="bg-orange-500 text-white text-center py-2 text-sm font-bold shadow-md relative z-50">
          {language === 'ar' ? 'أنت في وضع عدم الاتصال (أوفلاين)' : 'You are currently offline'}
        </div>
      )}
      <ThemeLanguageControls language={language} theme={theme} onToggleLanguage={toggleLanguage} onToggleTheme={toggleTheme} />
      <InventoryDashboard
        key={selectedLocation || 'global'}
        locationId={selectedLocation}
        inventory={displayInventory}
        transactions={transactions}
        onBack={() => setSelectedLocation(null)}
        onLogout={() => handleLogout(setSelectedLocation, () => { })}
        language={language}
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
    </div>
  );
};

export default App;