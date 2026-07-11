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


const App: React.FC = () => {
  const { addToast } = useToast();
  
  useRealtimeSubscriptions();

  const { data: locations = [] } = useLocationsQuery();
  const { data: fetchedUsers = [] } = useUsersQuery();
  const { data: catalog = [] } = useCatalogQuery();
  const { data: suppliers = [] } = useSuppliersQuery();
  const { data: purchaseOrders = [] } = usePurchaseOrdersQuery();
  const { data: audits = [] } = useAuditsQuery();

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
    handleUpdatePOStatus,
    handleReceivePO,
    handleScheduleAudit,
    handleSaveAuditCounts,
    handleSubmitAudit,
    handleApplyAudit
  } = useInventoryData({ currentUser, selectedLocation, language, addToast });

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

  const { data: alerts = [] } = useNotificationsQuery(selectedLocation);


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
          onUpdatePOStatus={handleUpdatePOStatus}
          onReceivePO={handleReceivePO}
          audits={audits}
          onScheduleAudit={handleScheduleAudit}
          onSaveAuditCounts={handleSaveAuditCounts}
          onSubmitAudit={handleSubmitAudit}
          onApplyAudit={handleApplyAudit}
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
      <div className={`font-sans antialiased text-gray-900 bg-gray-50 dark:bg-gray-900 min-h-screen overflow-x-hidden transition-colors ${language === 'ar' ? 'font-arabic' : ''}`}>
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
    <div className={`font-sans antialiased text-gray-900 bg-gray-50 dark:bg-gray-900 min-h-screen overflow-x-hidden transition-colors ${language === 'ar' ? 'font-arabic' : ''}`}>
      {isOffline && (
        <div className="bg-orange-500 text-white text-center py-2 text-sm font-bold shadow-md relative z-50">
          {language === 'ar' ? 'أنت في وضع عدم الاتصال (أوفلاين)' : 'You are currently offline'}
        </div>
      )}
      <ThemeLanguageControls language={language} theme={theme} onToggleLanguage={toggleLanguage} onToggleTheme={toggleTheme} />
      <InventoryDashboard
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
      />
    </div>
  );
};

export default App;