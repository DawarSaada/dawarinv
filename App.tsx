import React, { useState, useEffect, useMemo, useRef } from 'react';
import Login from './components/Login';
import LocationSelection from './components/LocationSelection';
import InventoryDashboard from './components/InventoryDashboard';
import AdminDashboard from './components/AdminDashboard';
import MammalEmployeeDashboard from './components/MammalEmployeeDashboard';
import ThemeLanguageControls from './components/ThemeLanguageControls';
import { LocationId, Language, Theme, User, InventoryItem, Transaction, TransactionType, LocationData, TransactionStatus, UserRole } from './types';
import { LOCATIONS as STATIC_LOCATIONS, TRANSLATIONS, INITIAL_INVENTORY, INITIAL_USERS, generateId } from './constants';
import { supabase } from './services/supabase';
import { useToast } from './components/Toast';
import { useAuth } from './hooks/useAuth';
import { useInventoryData } from './hooks/useInventoryData';


const App: React.FC = () => {
  const { addToast } = useToast();
  // Global Application State
  const [locations, setLocations] = useState<LocationData[]>(STATIC_LOCATIONS);
  const [loading, setLoading] = useState(true);
  
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
  } = useAuth(requestNotificationPermission);

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
    handleBulkLog
  } = useInventoryData({ currentUser, selectedLocation, language, addToast });

  
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('dawar_theme');
    return (saved === 'dark' || saved === 'light') ? saved : 'light';
  });

  // To prevent repeated notifications for the same transaction
  const notifiedIds = useRef<Set<string>>(new Set());

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

  // Initial Data Fetch from Supabase with Fallback
  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    let loadedUsers = INITIAL_USERS;
    let loadedInventory = INITIAL_INVENTORY;
    let loadedLocations = STATIC_LOCATIONS;
    let loadedTransactions: Transaction[] = [];

    try {
        // Fetch Locations
        const { data: locData, error: locError } = await supabase.from('locations').select('*');
        if (!locError && locData) {
            loadedLocations = locData.map((l: any) => ({
                id: l.id,
                name: l.name,
                nameAr: l.name_ar || l.name,
                description: l.description || '',
                descriptionAr: l.description_ar || l.description || '',
                icon: l.icon || 'store',
                type: l.type as 'central' | 'branch'
            }));
        }

        // Fetch Users
        const { data: usersData, error: usersError } = await supabase.from('app_users').select('*');
        if (!usersError && usersData && usersData.length > 0) {
            loadedUsers = usersData.map((u: any) => ({
                id: u.id,
                username: u.username,
                password: u.password,
                name: u.name,
                nameAr: u.name_ar,
                role: u.role as UserRole,
                branchCode: u.branch_code,
                branchName: u.branch_name,
                branchNameAr: u.branch_name_ar,
                accessibleBranches: u.accessible_branches || []
            }));
        }

        // Fetch Inventory
        const { data: itemsData, error: itemsError } = await supabase.from('inventory_items').select('*');
        if (!itemsError && itemsData && itemsData.length > 0) {
            const newInventory: Record<string, InventoryItem[]> = {};
            itemsData.forEach((i: any) => {
                const item: InventoryItem = {
                    id: i.id,
                    nameEn: i.name_en,
                    nameAr: i.name_ar,
                    description: i.description,
                    category: i.category,
                    quantity: Number(i.quantity),
                    unit: i.unit,
                    minThreshold: Number(i.min_threshold),
                    lastUpdated: i.last_updated,
                    locationId: i.location_id,
                    expirationDate: i.expiration_date,
                    barcode: i.barcode
                };
                if (!newInventory[i.location_id]) newInventory[i.location_id] = [];
                newInventory[i.location_id].push(item);
            });
            loadedInventory = newInventory;
        }

        // Fetch Transactions - Ordered by Date Descending
        const { data: txData, error: txError } = await supabase
          .from('transactions')
          .select('*')
          .order('date', { ascending: false });
          
        if (!txError && txData) {
            loadedTransactions = txData.map((t: any) => ({
                id: t.id,
                transferGroupId: t.transfer_group_id,
                date: t.date,
                type: t.type as TransactionType,
                status: t.status as TransactionStatus,
                fromLocation: t.from_location,
                toLocation: t.to_location,
                itemNameEn: t.item_name_en,
                itemNameAr: t.item_name_ar,
                quantity: Number(t.quantity),
                unit: t.unit,
                performedBy: t.performed_by,
                notes: t.notes,
                rejectionReason: t.rejection_reason
            }));
        }
    } catch (error) {
        console.warn("Backend connection failed or not configured. Using local fallback data.", error);
        addToast('warning', language === 'ar' ? 'فشل الاتصال بالخادم. جاري استخدام البيانات المحلية.' : 'Backend connection failed. Using local data.');
    } finally {
        setUsers(loadedUsers);
        setInventory(loadedInventory);
        setLocations(loadedLocations);
        setTransactions(loadedTransactions);
        setLoading(false);
    }
  };

  useEffect(() => {
      fetchData();

      // Debounce fetchData to avoid multiple rapid calls from real-time updates
      let debounceTimer: any;
      const debouncedFetch = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => fetchData(true), 500);
      };

      // Set up real-time subscriptions
      const txSubscription = supabase
        .channel('transactions-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, (payload) => {
          console.log('Real-time transaction update:', payload);
          debouncedFetch();
        })
        .subscribe((status) => {
          console.log('Transactions subscription status:', status);
        });

      const invSubscription = supabase
        .channel('inventory-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, (payload) => {
          console.log('Real-time inventory update:', payload);
          debouncedFetch();
        })
        .subscribe((status) => {
          console.log('Inventory subscription status:', status);
        });

      return () => {
        clearTimeout(debounceTimer);
        supabase.removeChannel(txSubscription);
        supabase.removeChannel(invSubscription);
      };
  }, []);


  // Auto-request permission on login
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

  // Notification Trigger Effect
  useEffect(() => {
    if (!currentUser) return;

    // Filter relevant incoming transfers that haven't been notified yet
    const relevantIncoming = transactions.filter(t => 
      t.toLocation === selectedLocation && 
      t.status === 'pending_target' && 
      !notifiedIds.current.has(t.id)
    );

    // Filter relevant completed transfers (where we were the sender)
    const relevantCompleted = transactions.filter(t => 
      t.fromLocation === selectedLocation && 
      t.status === 'completed' && 
      !notifiedIds.current.has(t.id + '_completed')
    );

    const t_text = TRANSLATIONS[language];

    if (relevantIncoming.length > 0) {
      relevantIncoming.forEach(tx => {
        const fromLoc = availableLocations.find(l => l.id === tx.fromLocation);
        const fromLocName = fromLoc ? (fromLoc.id === 'warehouse' ? t_text.warehouse : fromLoc.id === 'mammal' ? t_text.mammal : (language === 'ar' ? (fromLoc.nameAr || fromLoc.name) : fromLoc.name)) : tx.fromLocation;
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            const title = t_text.incomingRequests;
            const options = {
                body: `${language === 'ar' ? tx.itemNameAr : tx.itemNameEn}: ${tx.quantity} ${tx.unit} ${t_text.from} ${fromLocName}`,
                icon: 'https://cdn-icons-png.flaticon.com/512/3081/3081840.png',
                badge: 'https://cdn-icons-png.flaticon.com/512/3081/3081840.png',
                vibrate: [100, 50, 100],
                data: { primaryKey: tx.id }
            };
            
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(registration => {
                    registration.showNotification(title, options);
                }).catch(err => {
                    console.error("Service worker notification failed, falling back to standard", err);
                    new Notification(title, options);
                });
            } else {
                new Notification(title, options);
            }
          } catch (e) { console.error("Notification failed", e); }
        }
        notifiedIds.current.add(tx.id);
      });
    }

    if (relevantCompleted.length > 0) {
      relevantCompleted.forEach(tx => {
        const toLoc = availableLocations.find(l => l.id === tx.toLocation);
        const toLocName = toLoc ? (toLoc.id === 'warehouse' ? t_text.warehouse : toLoc.id === 'mammal' ? t_text.mammal : (language === 'ar' ? (toLoc.nameAr || toLoc.name) : toLoc.name)) : tx.toLocation;
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            const title = language === 'ar' ? 'تم استلام التحويل' : 'Transfer Received';
            const options = {
                body: `${language === 'ar' ? tx.itemNameAr : tx.itemNameEn}: ${tx.quantity} ${tx.unit} ${language === 'ar' ? 'بواسطة' : 'by'} ${toLocName}`,
                icon: 'https://cdn-icons-png.flaticon.com/512/3081/3081840.png',
                badge: 'https://cdn-icons-png.flaticon.com/512/3081/3081840.png',
                vibrate: [100, 50, 100],
                data: { primaryKey: tx.id + '_completed' }
            };
            
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(registration => {
                    registration.showNotification(title, options);
                }).catch(err => {
                    console.error("Service worker notification failed, falling back to standard", err);
                    new Notification(title, options);
                });
            } else {
                new Notification(title, options);
            }
          } catch (e) { console.error("Notification failed", e); }
        }
        notifiedIds.current.add(tx.id + '_completed');
      });
    }
  }, [transactions, currentUser, selectedLocation, language]);

  // Dynamically calculate available locations based on state and permissions
  const availableLocations = useMemo<LocationData[]>(() => {
      // Filter based on user permissions
      if (currentUser) {
          if (currentUser.role === 'branch_manager') {
              const accessible = new Set(currentUser.accessibleBranches || []);
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
    const rawItems = selectedLocation === 'all' 
      ? Object.entries(inventory).flatMap(([locId, items]) => (items as InventoryItem[]).map(i => ({ ...i, locationId: locId })))
      : inventory[selectedLocation || ''] || [];

    if (selectedLocation !== 'all') return rawItems;

    // Consolidate global view: group by nameEn + nameAr + category + unit
    const grouped: Record<string, InventoryItem & { locationNames: string[] }> = {};
    
    rawItems.forEach(item => {
      // Use a composite key for grouping
      const key = `${item.nameEn.toLowerCase()}|${item.nameAr}|${item.category}|${item.unit}`;
      if (!grouped[key]) {
          const locName = availableLocations.find(l => l.id === item.locationId)?.name || item.locationId || '';
          grouped[key] = {
              ...item,
              quantity: Number(item.quantity),
              locationNames: locName ? [locName] : []
          };
      } else {
          grouped[key].quantity += Number(item.quantity);
          const locName = availableLocations.find(l => l.id === item.locationId)?.name || item.locationId || '';
          if (locName && !grouped[key].locationNames.includes(locName)) {
              grouped[key].locationNames.push(locName);
          }
      }
    });

    return Object.values(grouped).map(item => ({
        ...item,
        locationId: item.locationNames.join(', ') // Display joined location names in the locationId field for global view
    }));
  }, [inventory, selectedLocation, availableLocations]);

  if (loading) {
      return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-brand-600 font-bold animate-pulse">Loading System...</div>;
  }

  if (!currentUser) {
    return (
      <div className={`font-sans antialiased text-gray-900 bg-gray-50 dark:bg-gray-900 min-h-screen overflow-x-hidden transition-colors ${language === 'ar' ? 'font-arabic' : ''}`}>
        <ThemeLanguageControls language={language} theme={theme} onToggleLanguage={toggleLanguage} onToggleTheme={toggleTheme} />
        <Login onLogin={(user, rememberMe) => handleLogin(user, rememberMe, setSelectedLocation)} language={language} users={users} />
      </div>
    );
  }

  if (currentUser.role === 'admin' && !selectedLocation) {
     return (
        <div className={`font-sans antialiased text-gray-900 bg-gray-50 dark:bg-gray-900 min-h-screen overflow-x-hidden transition-colors ${language === 'ar' ? 'font-arabic' : ''}`}>
            <ThemeLanguageControls language={language} theme={theme} onToggleLanguage={toggleLanguage} onToggleTheme={toggleTheme} />
            <AdminDashboard 
                users={users}
                transactions={transactions}
                inventory={inventory}
                onCreateUser={(user) => handleCreateUser(user, setLocations)}
                onEditUser={(user) => handleEditUser(user, setLocations)}
                onDeleteUser={handleDeleteUser}
                onDeleteItem={handleDeleteItem}
                onLogout={() => handleLogout(setSelectedLocation, () => {})}
                language={language}
                availableLocations={availableLocations}
                onManageLocation={setSelectedLocation}
                onCleanUpTransactions={handleCleanUpTransactions}
                getUserName={getUserName}
            />
        </div>
     );
  }

  if (currentUser.role === 'mammal_employee' && selectedLocation === 'mammal') {
      return (
          <div className={`font-sans antialiased text-gray-900 bg-gray-50 dark:bg-gray-900 min-h-screen overflow-x-hidden transition-colors ${language === 'ar' ? 'font-arabic' : ''}`}>
              <ThemeLanguageControls language={language} theme={theme} onToggleLanguage={toggleLanguage} onToggleTheme={toggleTheme} />
              <MammalEmployeeDashboard 
                  items={inventory['mammal'] || []}
                  onLogout={() => handleLogout(setSelectedLocation, () => {})}
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
        <ThemeLanguageControls language={language} theme={theme} onToggleLanguage={toggleLanguage} onToggleTheme={toggleTheme} />
        <LocationSelection 
          onSelect={setSelectedLocation} 
          onLogout={() => handleLogout(setSelectedLocation, () => {})}
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
    (t.status === 'pending_target' || t.status === 'pending_source')
  );

  const outgoingApprovals = transactions.filter(t => 
    (selectedLocation === 'all' ? true : t.fromLocation === selectedLocation) && 
    t.status === 'pending_source'
  );

  return (
    <div className={`font-sans antialiased text-gray-900 bg-gray-50 dark:bg-gray-900 min-h-screen overflow-x-hidden transition-colors ${language === 'ar' ? 'font-arabic' : ''}`}>
      <ThemeLanguageControls language={language} theme={theme} onToggleLanguage={toggleLanguage} onToggleTheme={toggleTheme} />
      <InventoryDashboard 
        locationId={selectedLocation} 
        inventory={displayInventory}
        transactions={transactions}
        onBack={() => setSelectedLocation(null)}
        onLogout={() => handleLogout(setSelectedLocation, () => {})}
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
        incomingTransfers={incomingTransfers}
        outgoingTransfers={outgoingTransfers}
        outgoingApprovals={outgoingApprovals}
        onReceiveTransfer={handleReceiveTransfer}
        onRejectTransfer={handleRejectTransfer}
        onConfirmOutbound={handleConfirmSourceTransfer}
        availableLocations={availableLocations}
        getUserName={getUserName}
      />
    </div>
  );
};

export default App;