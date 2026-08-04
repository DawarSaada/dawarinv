import React, { useState, useMemo, useEffect } from 'react';
import { User, Transaction, Language, UserRole, InventoryItem, LocationData, LocationId, CatalogItem, TransferSettings, AppNotification } from '../types';
import { TRANSLATIONS } from '../constants';
import { useToast } from './Toast';
import ConfirmationModal from './ConfirmationModal';
import { exportDailyReportPDF, exportDailyReportExcel } from '../services/exportService';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import AdminSidebar from './admin/AdminSidebar';
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
import { Supplier, PurchaseOrder, PurchaseOrderItem, Audit } from '../types';

interface AdminDashboardProps {
    currentUserRole: UserRole;
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
    onUpdatePOStatus: (id: string, status: string, performedBy: string) => void;
    onReceivePO: (poId: string, items: any[], performedBy: string) => void;
    audits: Audit[];
    onScheduleAudit: (params: any) => void;
    onSaveAuditCounts: (items: any[]) => void;
    onSubmitAudit: (auditId: string) => void;
    onApplyAudit: (auditId: string, performedBy: string) => void;
    subDetails?: { status: string, expiry: string | null };
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
    currentUserRole,
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
    subDetails
}) => {
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState<'users' | 'transactions' | 'inventory' | 'reports' | 'settings' | 'catalog' | 'analytics' | 'suppliers' | 'purchase_orders' | 'audits'>(() => {
        const hash = window.location.hash.replace('#', '');
        const validTabs = ['users', 'transactions', 'inventory', 'reports', 'settings', 'catalog', 'analytics', 'suppliers', 'purchase_orders', 'audits'];
        if (validTabs.includes(hash)) {
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
            const validTabs = ['users', 'transactions', 'inventory', 'reports', 'settings', 'catalog', 'analytics', 'suppliers', 'purchase_orders', 'audits'];
            if (validTabs.includes(hash)) {
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

    // Settings State
    const [retentionMonths, setRetentionMonths] = useState<number>(() => {
        const saved = localStorage.getItem('dawar_retention_months');
        return saved ? parseInt(saved, 10) : 0;
    });

    const handleSaveSettings = () => {
        localStorage.setItem('dawar_retention_months', retentionMonths.toString());
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
        accessibleBranches: [] as string[]
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

    return (
        <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col lg:flex-row transition-colors pb-24 lg:pb-0 ${language === 'ar' ? 'font-arabic' : ''}`}>
            <AdminSidebar 
                currentUserRole={currentUserRole}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onLogout={onLogout}
                language={language}
                t={t}
                alerts={alerts}
                onMarkNotificationAsRead={onMarkNotificationAsRead}
                onMarkAllNotificationsAsRead={onMarkAllNotificationsAsRead}
            />

            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                {activeTab === 'users' && (
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

                {activeTab === 'settings' && (
                    <AdminSettings 
                        retentionMonths={retentionMonths}
                        setRetentionMonths={setRetentionMonths}
                        onSaveSettings={handleSaveSettings}
                        onManualCleanUp={handleManualCleanUp}
                        language={language}
                        transferSettings={transferSettings}
                        onTransferSettingsChange={onTransferSettingsChange}
                        subDetails={subDetails}
                    />
                )}

                {activeTab === 'catalog' && (
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
                    />
                )}
            </main>

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
                onSaveCounts={onSaveAuditCounts}
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
        </div>
    );
};

export default AdminDashboard;