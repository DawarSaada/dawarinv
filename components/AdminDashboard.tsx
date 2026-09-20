import React, { useState, useMemo, useEffect } from 'react';
import { User, Transaction, Language, UserRole, InventoryItem, LocationData, LocationId, CatalogItem, TransferSettings, AppNotification, SubscriptionDetails } from '../types';
import { TRANSLATIONS } from '../constants';
import { useToast } from './Toast';
import ConfirmationModal from './ConfirmationModal';
import { exportDailyReportPDF, exportDailyReportExcel } from '../services/exportService';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import {
    Activity,
    BookOpen,
    Building2,
    ClipboardCheck,
    FileText,
    History,
    LogOut,
    Moon,
    Package,
    Search,
    Settings,
    Shield,
    ShoppingCart,
    Sun,
    Users
} from 'lucide-react';
import { AppShell, ShellBrand, PageBody, Badge, Menu, CommandPalette, Button, type NavItem, type CommandItem } from './ui';
import AppControls from './AppControls';
import NotificationCenter from './NotificationCenter';
import { useHotkey } from '../hooks/useHotkey';
import UserManagement from './admin/UserManagement';
import AdminInventoryView from './admin/AdminInventoryView';
import AdminTransactionsLog from './admin/AdminTransactionsLog';
import AdminReports from './admin/AdminReports';
import AdminSettings from './admin/AdminSettings';
import UserModal from './admin/UserModal';
import ProductCatalogManagement from './admin/ProductCatalogManagement';
import AnalyticsDashboard from './admin/AnalyticsDashboard';
import SupplierManagement from './admin/SupplierManagement';
import PurchaseOrderManagement from './admin/PurchaseOrderManagement';
import PurchaseOrderModal from './admin/PurchaseOrderModal';
import ReceivePOModal from './admin/ReceivePOModal';
import AuditManagement from './admin/AuditManagement';
import ScheduleAuditModal from './admin/ScheduleAuditModal';
import PerformAuditModal from './admin/PerformAuditModal';
import ReviewAuditModal from './admin/ReviewAuditModal';
import { Supplier, PurchaseOrder, PurchaseOrderItem, Audit, Theme } from '../types';
import { canOpenTab, canWriteLocation, subjectFrom } from '../services/permissions';

const ALL_TABS = [
    'users',
    'transactions',
    'inventory',
    'reports',
    'settings',
    'catalog',
    'analytics',
    'suppliers',
    'purchase_orders',
    'audits',
] as const;

interface AdminDashboardProps {
    currentUserRole: UserRole;
    /** Full user record, needed for branch-level write access decisions. */
    currentUser?: User | null;
    users: User[];
    transactions: Transaction[];
    inventory: Record<string, InventoryItem[]>;
    catalog: CatalogItem[];
    onCreateUser: (user: Omit<User, 'id'>) => void;
    onEditUser: (user: User) => void;
    onDeleteUser: (id: string) => void;
    onDeleteItem: (locationId: string, itemId: string) => void;
    onLogout: () => void;
    language: Language;
    availableLocations: LocationData[];
    onManageLocation: (locationId: LocationId) => void;
    onCleanUpTransactions?: (months: number) => Promise<void>;
    getUserName: (name: string) => string;
    transferSettings?: TransferSettings;
    onTransferSettingsChange?: (settings: TransferSettings) => void;
    alerts?: AppNotification[];
    onMarkNotificationAsRead?: (id: string) => void;
    onMarkAllNotificationsAsRead?: () => void;
    suppliers: Supplier[];
    purchaseOrders: PurchaseOrder[];
    onAddSupplier: (s: Omit<Supplier, 'id' | 'createdAt'>) => void;
    onEditSupplier: (s: Supplier) => void;
    onDeleteSupplier: (id: string) => void;
    onCreatePO: (po: any, items: any[]) => void;
    onEditPO: (id: string, po: any, items: any[]) => void;
    onUpdatePOStatus: (id: string, status: string) => void;
    onReceivePO: (poId: string, items: any[], performedBy: string) => void;
    audits: Audit[];
    onScheduleAudit: (params: any) => void;
    onSaveAuditCounts: (auditId: string, items: any[]) => Promise<void> | void;
    onSubmitAudit: (auditId: string) => void;
    onApplyAudit: (auditId: string, performedBy: string) => void;
    onDeleteAudit: (auditId: string) => void;
    subDetails?: SubscriptionDetails;
    onRefreshSubscription?: () => void;
    /** Business settings, owned by the shared settings store. */
    retentionMonths: number;
    onRetentionMonthsChange?: (months: number) => void;
    /** False when the deployment has no central settings store yet. */
    settingsAreShared?: boolean;
    updatedBy?: string;
    /** Theme/language controls are hosted by the shell top bar instead of floating buttons. */
    theme?: Theme;
    onToggleTheme?: () => void;
    onToggleLanguage?: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
    currentUserRole,
    currentUser,
    users, 
    transactions, 
    inventory,
    catalog,
    onCreateUser, 
    onEditUser,
    onDeleteUser, 
    onDeleteItem,
    onLogout, 
    language,
    availableLocations,
    onManageLocation,
    onCleanUpTransactions,
    getUserName,
    transferSettings = { enableSignatureCapture: false, enablePhotoEvidence: false, enableAutoReject: false, autoRejectDays: 7 },
    onTransferSettingsChange,
    alerts = [],
    onMarkNotificationAsRead,
    onMarkAllNotificationsAsRead,
    suppliers = [],
    purchaseOrders = [],
    onAddSupplier,
    onEditSupplier,
    onDeleteSupplier,
    onCreatePO,
    onEditPO,
    onUpdatePOStatus,
    onReceivePO,
    audits = [],
    onScheduleAudit,
    onSaveAuditCounts,
    onSubmitAudit,
    onApplyAudit,
    onDeleteAudit,
    subDetails,
    onRefreshSubscription,
    retentionMonths,
    onRetentionMonthsChange,
    settingsAreShared = true,
    updatedBy,
    theme,
    onToggleTheme,
    onToggleLanguage
}) => {
    const { addToast } = useToast();
    const [commandOpen, setCommandOpen] = useState(false);
    useHotkey('k', () => setCommandOpen((open) => !open), { mod: true });
    const [activeTab, setActiveTab] = useState<'users' | 'transactions' | 'inventory' | 'reports' | 'settings' | 'catalog' | 'analytics' | 'suppliers' | 'purchase_orders' | 'audits'>(() => {
        const hash = window.location.hash.replace('#', '');
        const allowed = (ALL_TABS as readonly string[]).includes(hash)
            && canOpenTab({ role: currentUserRole }, hash);
        if (allowed) {
            return hash as any;
        }
        return currentUserRole === 'admin' ? 'users' : 'inventory';
    });

    useEffect(() => {
        window.location.hash = activeTab;
    }, [activeTab]);

    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.replace('#', '');
            const allowed = (ALL_TABS as readonly string[]).includes(hash)
                && canOpenTab({ role: currentUserRole }, hash);
            if (allowed) {
                setActiveTab(hash as any);
            }
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);
    const [selectedInventoryLocation, setSelectedInventoryLocation] = useState<string>('warehouse');
    const [showUserModal, setShowUserModal] = useState(false);
    
    // Purchase Order Modals State
    const [isPOModalOpen, setIsPOModalOpen] = useState(false);
    const [isReceivePOModalOpen, setIsReceivePOModalOpen] = useState(false);
    const [selectedPO, setSelectedPO] = useState<PurchaseOrder | undefined>(undefined);
    
    // Audit Modals State
    const [isScheduleAuditModalOpen, setIsScheduleAuditModalOpen] = useState(false);
    const [isPerformAuditModalOpen, setIsPerformAuditModalOpen] = useState(false);
    const [isReviewAuditModalOpen, setIsReviewAuditModalOpen] = useState(false);
    const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);

    // Reports State
    const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
    const [reportLocation, setReportLocation] = useState('all');
    const [reportFilter, setReportFilter] = useState<'all' | 'received' | 'used'>('all');

    // Transactions Log State
    const [transactionSearch, setTransactionSearch] = useState('');
    const [transactionTypeFilter, setTransactionTypeFilter] = useState<'all' | 'transfer' | 'usage' | 'receive'>('all');
    const [txPage, setTxPage] = useState(1);
    const [txPageSize, setTxPageSize] = useState(25);

    // Retention is a business setting, owned by App (see hooks/useAppSettings): it used
    // to be read and written here in localStorage, so only the browser that set it
    // ever followed the rule.
    const handleSaveSettings = async () => {
        await onRetentionMonthsChange?.(retentionMonths);
        addToast('success', language === 'ar' ? 'تم حفظ الإعدادات' : 'Settings saved');
    };

    const [cleanupConfirm, setCleanupConfirm] = useState(false);

    const handleManualCleanUp = () => {
        if (onCleanUpTransactions) {
            setCleanupConfirm(true);
        }
    };

    const executeCleanUp = async () => {
        if (onCleanUpTransactions) {
            await onCleanUpTransactions(retentionMonths);
            addToast('success', language === 'ar' ? 'تم التنظيف بنجاح' : 'Cleanup completed successfully');
        }
        setCleanupConfirm(false);
    };

    // User Management State
    const [confirmDelete, setConfirmDelete] = useState<{
        isOpen: boolean;
        type: 'user' | 'item';
        id: string;
        name: string;
        locationId?: string;
    }>({
        isOpen: false,
        type: 'user',
        id: '',
        name: ''
    });

    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [locationType, setLocationType] = useState<'central' | 'branch'>('central');
    const [userForm, setUserForm] = useState({
        name: '',
        nameAr: '',
        username: '',
        password: '',
        role: 'warehouse_manager' as UserRole,
        branchCode: '',
        branchName: '',
        branchNameAr: '',
        accessibleBranches: [] as string[],
        readOnlyBranches: [] as string[]
    });

    const t = TRANSLATIONS[language];
    const currentInventory = inventory[selectedInventoryLocation] || [];

    // Filter available locations and transactions for non-admins
    const dashboardLocations = useMemo(() => {
        if (currentUserRole === 'admin') return availableLocations;
        return availableLocations.filter(loc => loc.id === 'warehouse' || loc.id === 'mammal');
    }, [availableLocations, currentUserRole]);

    const dashboardTransactions = useMemo(() => {
        if (currentUserRole === 'admin') return transactions;
        return transactions.filter(tx => tx.fromLocation === 'warehouse' || tx.toLocation === 'warehouse' || tx.fromLocation === 'mammal' || tx.toLocation === 'mammal');
    }, [transactions, currentUserRole]);

    const openCreateModal = () => {
        setEditingUserId(null);
        setUserForm({ 
            name: '', 
            nameAr: '', 
            username: '', 
            password: '', 
            role: 'warehouse_manager', 
            branchCode: '', 
            branchName: '', 
            branchNameAr: '', 
            accessibleBranches: [],
            readOnlyBranches: []
        });
        setLocationType('central');
        setShowUserModal(true);
    };

    const openEditModal = (user: User) => {
        setEditingUserId(user.id);
        setUserForm({ 
            name: user.name, 
            nameAr: user.nameAr || '',
            username: user.username, 
            password: '', 
            role: user.role, 
            branchCode: user.branchCode || '', 
            branchName: user.branchName || '',
            branchNameAr: user.branchNameAr || '',
            accessibleBranches: user.accessibleBranches || [],
            readOnlyBranches: user.readOnlyBranches || []
        });
        setLocationType(user.role === 'branch_manager' ? 'branch' : 'central');
        setShowUserModal(true);
    };

    const handleUserSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            ...userForm,
            role: locationType === 'branch' ? 'branch_manager' as UserRole : userForm.role
        };

        if (editingUserId) {
            onEditUser({ ...payload, id: editingUserId } as User);
        } else {
            onCreateUser(payload as any);
        }
        setShowUserModal(false);
    };

    const handleDeleteUserRequest = (user: User) => {
        setConfirmDelete({
            isOpen: true,
            type: 'user',
            id: user.id,
            name: user.name
        });
    };

    const handleDeleteItemRequest = (item: InventoryItem) => {
        const itemName = language === 'ar' ? item.nameAr : item.nameEn;
        setConfirmDelete({
            isOpen: true,
            type: 'item',
            id: item.id,
            name: itemName,
            locationId: selectedInventoryLocation
        });
    };

    const executeDeletion = () => {
        if (confirmDelete.type === 'user') {
            onDeleteUser(confirmDelete.id);
        } else if (confirmDelete.type === 'item' && confirmDelete.locationId) {
            onDeleteItem(confirmDelete.locationId, confirmDelete.id);
        }
        setConfirmDelete(prev => ({ ...prev, isOpen: false }));
    };

    // Inventory Exports
    const exportToExcel = () => {
        const locName = selectedInventoryLocation === 'warehouse' ? t.warehouse : selectedInventoryLocation === 'mammal' ? t.mammal : (language === 'ar' ? (availableLocations.find(l => l.id === selectedInventoryLocation)?.nameAr || availableLocations.find(l => l.id === selectedInventoryLocation)?.name) : availableLocations.find(l => l.id === selectedInventoryLocation)?.name) || selectedInventoryLocation;
        const data = currentInventory.map(item => ({
            [t.itemNameEn]: item.nameEn,
            [t.itemNameAr]: item.nameAr,
            [t.category]: item.category,
            [t.quantity]: item.quantity,
            [t.unit]: item.unit,
            [t.lastUpdated]: item.lastUpdated
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Inventory");
        XLSX.writeFile(wb, `Inventory_${locName}.xlsx`);
    };

    const exportToPDF = () => {
        const locName = selectedInventoryLocation === 'warehouse' ? t.warehouse : selectedInventoryLocation === 'mammal' ? t.mammal : (language === 'ar' ? (availableLocations.find(l => l.id === selectedInventoryLocation)?.nameAr || availableLocations.find(l => l.id === selectedInventoryLocation)?.name) : availableLocations.find(l => l.id === selectedInventoryLocation)?.name) || selectedInventoryLocation;
        const doc = new jsPDF();
        doc.text(`${t.inventory} - ${locName}`, 14, 15);
        autoTable(doc, {
            startY: 20,
            head: [[t.itemNameEn, t.itemNameAr, t.category, t.quantity, t.unit, t.lastUpdated]],
            body: currentInventory.map(item => [item.nameEn, item.nameAr, item.category, item.quantity, item.unit, item.lastUpdated]),
        });
        doc.save(`Inventory_${locName}.pdf`);
    };

    // --- Chart Data Preparation (Memoized) ---
    const transactionsOverTime = useMemo(() => {
        const last7Days = Array.from({length: 7}, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            return d.toISOString().split('T')[0];
        }).reverse();

        return last7Days.map(date => {
            const dayTx = dashboardTransactions.filter(tx => tx.date.startsWith(date));
            return {
                date: date.substring(5), // MM-DD
                Received: dayTx.filter(tx => tx.type === 'receive' || (tx.type === 'transfer' && tx.toLocation === reportLocation)).length,
                Usage: dayTx.filter(tx => tx.type === 'usage').length,
                Transfers: dayTx.filter(tx => tx.type === 'transfer').length
            };
        });
    }, [transactions, reportLocation]);

    const stockDistribution = useMemo(() => {
        return availableLocations.map(loc => {
            const locInventory = inventory[loc.id] || [];
            const totalItems = locInventory.reduce((sum, item) => sum + item.quantity, 0);
            return {
                name: loc.id === 'warehouse' ? t.warehouse : loc.id === 'mammal' ? t.mammal : (language === 'ar' ? (loc.nameAr || loc.name) : loc.name),
                value: totalItems
            };
        }).filter(d => d.value > 0);
    }, [availableLocations, inventory, language, t]);

    const usageByItem = useMemo(() => {
        return dashboardTransactions
            .filter(tx => tx.type === 'usage')
            .reduce((acc, tx) => {
                const name = language === 'ar' ? tx.itemNameAr : tx.itemNameEn;
                acc[name] = (acc[name] || 0) + tx.quantity;
                return acc;
            }, {} as Record<string, number>);
    }, [transactions, language]);

    const topUsedItems = useMemo(() => {
        return Object.entries(usageByItem)
            .map(([name, quantity]) => ({ name, quantity: quantity as number }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5);
    }, [usageByItem]);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

    const isAr = language === 'ar';

    // Section list drives the sidebar, the mobile tab bar and the command palette.
    const adminMenu = [
        { id: 'users' as const, label: t.users, icon: <Users />, adminOnly: true, mobilePrimary: true },
        { id: 'inventory' as const, label: t.inventory, icon: <Package />, adminOnly: false, mobilePrimary: true },
        { id: 'reports' as const, label: t.reports, icon: <FileText />, adminOnly: false, mobilePrimary: true },
        { id: 'transactions' as const, label: t.viewLogs, icon: <History />, adminOnly: false, mobilePrimary: true },
        { id: 'analytics' as const, label: isAr ? 'التحليلات' : 'Analytics', icon: <Activity />, adminOnly: false, mobilePrimary: false },
        { id: 'catalog' as const, label: isAr ? 'دليل المنتجات' : 'Catalog', icon: <BookOpen />, adminOnly: true, mobilePrimary: false },
        { id: 'audits' as const, label: isAr ? 'الجرد الدوري' : 'Audits', icon: <ClipboardCheck />, adminOnly: false, mobilePrimary: false },
        { id: 'suppliers' as const, label: isAr ? 'الموردين' : 'Suppliers', icon: <Building2 />, adminOnly: false, mobilePrimary: false },
        { id: 'purchase_orders' as const, label: isAr ? 'أوامر الشراء' : 'Purchase Orders', icon: <ShoppingCart />, adminOnly: false, mobilePrimary: false },
        { id: 'settings' as const, label: isAr ? 'الإعدادات' : 'Settings', icon: <Settings />, adminOnly: true, mobilePrimary: false },
    ].filter((item) => currentUserRole === 'admin' || !item.adminOnly);

    const navItems: NavItem[] = adminMenu.map(({ id, label, icon, mobilePrimary }) => ({
        id,
        label,
        icon,
        mobilePrimary,
    }));

    const commands: CommandItem[] = [
        ...adminMenu.map((item) => ({
            id: `go-${item.id}`,
            label: isAr ? `الانتقال إلى ${item.label}` : `Go to ${item.label}`,
            group: isAr ? 'التنقل' : 'Navigate',
            icon: item.icon,
            keywords: [item.id, 'tab', 'section'],
            onSelect: () => setActiveTab(item.id),
        })),
        ...(availableLocations ?? []).slice(0, 12).map((location) => ({
            id: `open-${location.id}`,
            label: isAr ? `فتح مخزون ${location.nameAr || location.name}` : `Open ${location.name} inventory`,
            group: isAr ? 'المواقع' : 'Locations',
            icon: <Package />,
            keywords: [location.id],
            onSelect: () => onManageLocation(location.id),
        })),
        ...(onToggleTheme
            ? [{
                id: 'toggle-theme',
                label: theme === 'dark' ? (isAr ? 'الوضع الفاتح' : 'Switch to light mode') : isAr ? 'الوضع الداكن' : 'Switch to dark mode',
                group: isAr ? 'الإعدادات' : 'Preferences',
                icon: theme === 'dark' ? <Sun /> : <Moon />,
                onSelect: onToggleTheme,
            }]
            : []),
        ...(onToggleLanguage
            ? [{
                id: 'toggle-language',
                label: isAr ? 'Switch to English' : 'التبديل إلى العربية',
                group: isAr ? 'الإعدادات' : 'Preferences',
                icon: <Search />,
                onSelect: onToggleLanguage,
            }]
            : []),
        {
            id: 'logout',
            label: t.logout,
            group: isAr ? 'الإعدادات' : 'Preferences',
            icon: <LogOut />,
            onSelect: onLogout,
        },
    ];

    return (
        <AppShell
            className={language === 'ar' ? 'font-arabic' : ''}
            navLabel={isAr ? 'فتح القائمة' : 'Open navigation'}
            closeLabel={isAr ? 'إغلاق القائمة' : 'Close navigation'}
            brand={
                <ShellBrand
                    mark={<Shield className="h-4.5 w-4.5" />}
                    title={t.adminDashboard}
                    subtitle={isAr ? 'مخزون دوار السعادة' : 'Dawar Saada Inventory'}
                />
            }
            navItems={navItems}
            activeId={activeTab}
            onNavigate={(id) => setActiveTab(id as typeof activeTab)}
            topbar={
                <button
                    type="button"
                    onClick={() => setCommandOpen(true)}
                    className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 text-start text-sm text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-200"
                >
                    <Search className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{isAr ? 'ابحث أو انتقل إلى…' : 'Search or jump to…'}</span>
                    <kbd className="ms-auto hidden flex-shrink-0 rounded border border-gray-200 px-1.5 py-0.5 text-2xs text-gray-400 sm:block dark:border-gray-700">
                        ⌘K
                    </kbd>
                </button>
            }
            topbarEnd={
                <>
                    <Badge tone="success" dot pulse className="hidden md:inline-flex">
                        {isAr ? 'مباشر' : 'Live'}
                    </Badge>
                    <NotificationCenter
                        notifications={alerts || []}
                        language={language}
                        t={t}
                        onMarkAsRead={onMarkNotificationAsRead}
                        onMarkAllAsRead={onMarkAllNotificationsAsRead}
                    />
                    {theme && onToggleTheme && onToggleLanguage && (
                        <AppControls
                            language={language}
                            theme={theme}
                            onToggleTheme={onToggleTheme}
                            onToggleLanguage={onToggleLanguage}
                        />
                    )}
                </>
            }
            sidebarFooter={
                <Button variant="ghost" block icon={<LogOut className="rtl:rotate-180" />} onClick={onLogout}>
                    {t.logout}
                </Button>
            }
        >
            <PageBody className="space-y-4">
                {activeTab === 'users' && currentUserRole === 'admin' && (
                    <UserManagement 
                        users={users}
                        t={t}
                        language={language}
                        onOpenCreateModal={openCreateModal}
                        onOpenEditModal={openEditModal}
                        onDeleteUser={handleDeleteUserRequest}
                    />
                )}

                {activeTab === 'inventory' && (
                    <AdminInventoryView 
                        currentInventory={currentInventory}
                        availableLocations={availableLocations}
                        selectedInventoryLocation={selectedInventoryLocation}
                        setSelectedInventoryLocation={setSelectedInventoryLocation}
                        t={t}
                        language={language}
                        onExportExcel={exportToExcel}
                        onExportPDF={exportToPDF}
                        onManageLocation={onManageLocation}
                        onDeleteItem={handleDeleteItemRequest}
                        currentUser={currentUser}
                    />
                )}

                {activeTab === 'reports' && (
                    <AdminReports 
                        transactions={dashboardTransactions}
                        availableLocations={dashboardLocations}
                        reportDate={reportDate}
                        setReportDate={setReportDate}
                        reportLocation={reportLocation}
                        setReportLocation={setReportLocation}
                        reportFilter={reportFilter}
                        setReportFilter={setReportFilter}
                        t={t}
                        language={language}
                        onExportPDF={() => {
                            const filtered = dashboardTransactions.filter(tx => {
                                const txDate = new Date(tx.date).toISOString().split('T')[0];
                                return txDate === reportDate && (reportLocation === 'all' || tx.fromLocation === reportLocation || tx.toLocation === reportLocation);
                            });
                            const locName = reportLocation === 'all' ? t.allStatuses : (dashboardLocations.find(l => l.id === reportLocation)?.name || reportLocation);
                            exportDailyReportPDF(filtered, reportLocation, locName, language, undefined, reportDate);
                        }}
                        onExportExcel={() => {
                            const filtered = dashboardTransactions.filter(tx => {
                                const txDate = new Date(tx.date).toISOString().split('T')[0];
                                return txDate === reportDate && (reportLocation === 'all' || tx.fromLocation === reportLocation || tx.toLocation === reportLocation);
                            });
                            const locName = reportLocation === 'all' ? t.allStatuses : (dashboardLocations.find(l => l.id === reportLocation)?.name || reportLocation);
                            exportDailyReportExcel(filtered, reportLocation, locName, language, reportDate);
                        }}
                        txByDayData={transactionsOverTime}
                        catDistributionData={stockDistribution}
                        topUsedItems={topUsedItems}
                        COLORS={COLORS}
                    />
                )}

                {activeTab === 'analytics' && (
                    <AnalyticsDashboard 
                        transactions={dashboardTransactions}
                        inventory={inventory}
                        availableLocations={dashboardLocations}
                        language={language}
                        t={t}
                    />
                )}

                {activeTab === 'transactions' && (
                    <AdminTransactionsLog 
                        transactions={dashboardTransactions}
                        t={t}
                        language={language}
                        search={transactionSearch}
                        setSearch={setTransactionSearch}
                        typeFilter={transactionTypeFilter}
                        setTypeFilter={setTransactionTypeFilter}
                        page={txPage}
                        setPage={setTxPage}
                        pageSize={txPageSize}
                        setPageSize={setTxPageSize}
                        getUserName={getUserName}
                    />
                )}

                {activeTab === 'settings' && currentUserRole === 'admin' && (
                    <AdminSettings 
                        retentionMonths={retentionMonths}
                        setRetentionMonths={(months) => onRetentionMonthsChange?.(months)}
                        onSaveSettings={handleSaveSettings}
                        onManualCleanUp={handleManualCleanUp}
                        language={language}
                        transferSettings={transferSettings}
                        onTransferSettingsChange={onTransferSettingsChange}
                        subDetails={subDetails}
                        onRefreshSubscription={onRefreshSubscription}
                        settingsAreShared={settingsAreShared}
                        updatedBy={updatedBy}
                    />
                )}

                {activeTab === 'catalog' && currentUserRole === 'admin' && (
                    <ProductCatalogManagement 
                        catalog={catalog}
                        suppliers={suppliers}
                        language={language}
                    />
                )}

                {activeTab === 'suppliers' && (
                    <SupplierManagement 
                        suppliers={suppliers}
                        onAdd={onAddSupplier}
                        onEdit={onEditSupplier}
                        onDelete={onDeleteSupplier}
                        language={language}
                        catalog={catalog}
                    />
                )}

                {activeTab === 'purchase_orders' && (
                    <PurchaseOrderManagement 
                        purchaseOrders={purchaseOrders}
                        suppliers={suppliers}
                        catalog={catalog}
                        onCreatePO={onCreatePO}
                        onEditPO={onEditPO}
                        onUpdateStatus={onUpdatePOStatus}
                        onReceivePO={onReceivePO}
                        userName={getUserName(currentUserRole)}
                        language={language}
                        onOpenCreateModal={() => { setSelectedPO(undefined); setIsPOModalOpen(true); }}
                        onOpenViewModal={(po) => { setSelectedPO(po); setIsPOModalOpen(true); }}
                        onOpenReceiveModal={(po) => { setSelectedPO(po); setIsReceivePOModalOpen(true); }}
                    />
                )}

                {activeTab === 'audits' && (
                    <AuditManagement 
                        audits={audits}
                        locations={availableLocations}
                        userRole={currentUserRole}
                        language={language}
                        onOpenScheduleModal={() => setIsScheduleAuditModalOpen(true)}
                        onOpenPerformModal={(audit) => { setSelectedAudit(audit); setIsPerformAuditModalOpen(true); }}
                        onOpenReviewModal={(audit) => { setSelectedAudit(audit); setIsReviewAuditModalOpen(true); }}
                        onDeleteAudit={onDeleteAudit}
                    />
                )}
            </PageBody>

            <CommandPalette
                open={commandOpen}
                onClose={() => setCommandOpen(false)}
                items={commands}
                placeholder={isAr ? 'ابحث أو انتقل إلى…' : 'Search or jump to…'}
                emptyLabel={isAr ? 'لا توجد نتائج' : 'No matches'}
                recentLabel={isAr ? 'الأخيرة' : 'Recent'}
            />

            <UserModal 
                isOpen={showUserModal}
                onClose={() => setShowUserModal(false)}
                editingUserId={editingUserId}
                userForm={userForm}
                setUserForm={setUserForm}
                locationType={locationType}
                setLocationType={setLocationType}
                handleUserSubmit={handleUserSubmit}
                availableLocations={availableLocations}
                t={t}
                language={language}
            />

            <ConfirmationModal
                isOpen={confirmDelete.isOpen}
                onClose={() => setConfirmDelete({...confirmDelete, isOpen: false})}
                onConfirm={executeDeletion}
                title={t.confirmDeleteTitle}
                message={`${confirmDelete.type === 'user' ? t.confirmDeleteUser : t.confirmDeleteItem}: "${confirmDelete.name}"?`}
                language={language}
                danger={true}
            />

            <PurchaseOrderModal 
                isOpen={isPOModalOpen}
                onClose={() => setIsPOModalOpen(false)}
                language={language}
                suppliers={suppliers}
                catalog={catalog}
                purchaseOrder={selectedPO}
                onSave={onCreatePO}
                onEdit={onEditPO}
                onUpdateStatus={onUpdatePOStatus}
                // Approval, cancellation and editing write the order's own branch,
                // so they are withheld unless the viewer may write there.
                canManage={canWriteLocation(subjectFrom(currentUser), selectedPO?.locationId || 'warehouse')}
                userName={getUserName(currentUserRole)}
            />

            <ReceivePOModal 
                isOpen={isReceivePOModalOpen}
                onClose={() => setIsReceivePOModalOpen(false)}
                language={language}
                purchaseOrder={selectedPO || null}
                onReceive={onReceivePO}
                userName={getUserName(currentUserRole)}
            />

            <ScheduleAuditModal 
                isOpen={isScheduleAuditModalOpen}
                onClose={() => setIsScheduleAuditModalOpen(false)}
                language={language}
                locations={availableLocations}
                inventory={inventory}
                onSchedule={onScheduleAudit}
                userName={getUserName(currentUserRole)}
            />

            <PerformAuditModal 
                isOpen={isPerformAuditModalOpen}
                onClose={() => { setIsPerformAuditModalOpen(false); setSelectedAudit(null); }}
                language={language}
                audit={selectedAudit}
                onSaveCounts={(items) => onSaveAuditCounts(selectedAudit!.id, items)}
                onSubmitAudit={onSubmitAudit}
            />

            <ReviewAuditModal 
                isOpen={isReviewAuditModalOpen}
                onClose={() => { setIsReviewAuditModalOpen(false); setSelectedAudit(null); }}
                language={language}
                audit={selectedAudit}
                userRole={currentUserRole}
                onApplyAudit={(id) => onApplyAudit(id, getUserName(currentUserRole))}
            />

            <ConfirmationModal
                isOpen={cleanupConfirm}
                onClose={() => setCleanupConfirm(false)}
                onConfirm={executeCleanUp}
                title={language === 'ar' ? 'تنظيف السجلات' : 'Clean Up Records'}
                message={language === 'ar' ? `سيتم حذف جميع السجلات الأقدم من ${retentionMonths} شهر. لا يمكن التراجع عن هذا الإجراء.` : `All records older than ${retentionMonths} month(s) will be permanently deleted. This cannot be undone.`}
                language={language}
                danger={true}
            />
        </AppShell>
    );
};

export default AdminDashboard;