import React, { useState, useMemo } from 'react';
import { InventoryItem, Language, Transaction, TransactionType, AppNotification, Theme } from '../types';
import { TRANSLATIONS } from '../constants';
import { formatUnit } from '../utils/units';
import NotificationCenter from './NotificationCenter';
import { exportDailyReportPDF } from '../services/exportService';
import { 
    LogOut, 
    ClipboardList, 
    ArrowDownCircle, 
    ArrowUpCircle, 
    CheckCircle, 
    AlertCircle, 
    Search, 
    FileText, 
    Download, 
    X, 
    Save, 
    RotateCcw, 
    Edit2,
    Camera
} from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';
import AppControls from './AppControls';
import {
    Badge,
    Button,
    EmptyState,
    ErrorState,
    FilterBar,
    Modal,
    PageBody,
    PageHeader,
    StatTile
} from './ui';

interface MammalEmployeeDashboardProps {
    items: InventoryItem[];
    onLogout: () => void;
    language: Language;
    onLogTransaction: (type: TransactionType, itemId: string, quantity: number, notes: string) => void;
    onBulkLogTransaction: (logs: { type: TransactionType, itemId: string, quantity: number, notes: string }[]) => void;
    userName: string;
    transactions: Transaction[];
    alerts?: AppNotification[];
    onMarkNotificationAsRead?: (id: string) => void;
    onMarkAllNotificationsAsRead?: () => void;
    theme?: Theme;
    onToggleTheme?: () => void;
    onToggleLanguage?: () => void;
}

type LogEntry = {
    received: string;
    used: string;
    notes: string;
}

const MammalEmployeeDashboard: React.FC<MammalEmployeeDashboardProps> = ({ 
    items, 
    onLogout, 
    language, 
    onLogTransaction,
    onBulkLogTransaction,
    userName,
    transactions,
    alerts = [],
    onMarkNotificationAsRead,
    onMarkAllNotificationsAsRead,
    theme,
    onToggleTheme,
    onToggleLanguage
}) => {
    const t = TRANSLATIONS[language];
    const isAr = language === 'ar';
    const [search, setSearch] = useState('');
    const [showReportModal, setShowReportModal] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    
    // Bulk Entry State
    const [logEntries, setLogEntries] = useState<Record<string, LogEntry>>({});
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const filteredItems = items.filter(i => {
        const name = language === 'ar' ? i.nameAr : i.nameEn;
        const matchesSearch = name.toLowerCase().includes(search.toLowerCase()) || 
                              (i.barcode && i.barcode.toLowerCase().includes(search.toLowerCase()));
        return matchesSearch;
    });

    const handleScan = (decodedText: string) => {
        setSearch(decodedText);
        setShowScanner(false);
    };

    const handleInputChange = (id: string, field: keyof LogEntry, value: string) => {
        setLogEntries(prev => ({
            ...prev,
            [id]: {
                ...prev[id] || { received: '', used: '', notes: '' },
                [field]: value
            }
        }));
        setError('');
        setSuccessMsg('');
    };

    const hasPendingChanges = Object.values(logEntries).some((e: LogEntry) => e.received || e.used || e.notes);
    const pendingCount = Object.values(logEntries).filter((e: LogEntry) => e.received || e.used).length;

    const handleSubmitAll = async () => {
        setError('');
        
        // Validate
        for (const itemId of Object.keys(logEntries)) {
            const entry = logEntries[itemId];
            const item = items.find(i => i.id === itemId);
            if (!item) continue;

            const received = Number(entry.received || 0);
            const used = Number(entry.used || 0);

            if (received < 0 || used < 0) {
                setError(t.invalidNumber);
                return;
            }

            if (used > (item.quantity + received)) {
                 setError(`${t.insufficientStock} for ${language === 'ar' ? item.nameAr : item.nameEn} (Max: ${item.quantity + received})`);
                 return;
            }
        }

        setIsSubmitting(true);
        const logs: { type: TransactionType, itemId: string, quantity: number, notes: string }[] = [];

        // Prepare Receives
        Object.keys(logEntries).forEach(itemId => {
            const entry = logEntries[itemId];
            const received = Number(entry.received || 0);
            if (received > 0) {
                logs.push({ type: 'receive', itemId, quantity: received, notes: entry.notes });
            }
        });

        // Prepare Usage
        Object.keys(logEntries).forEach(itemId => {
            const entry = logEntries[itemId];
            const used = Number(entry.used || 0);
            if (used > 0) {
                 logs.push({ type: 'usage', itemId, quantity: used, notes: entry.notes });
            }
        });

        if (logs.length > 0) {
            await onBulkLogTransaction(logs);
            setLogEntries({});
            setSuccessMsg(t.bulkSuccess);
            setTimeout(() => setSuccessMsg(''), 3000);
        } else {
            setError(t.noChangesToSave);
        }
        setIsSubmitting(false);
    };

    const handleClear = () => {
        setLogEntries({});
        setError('');
    };

    // Filter transactions for report modal
    const getTodayTransactions = () => {
        const today = new Date();
        return transactions.filter(t => {
            const d = new Date(t.date);
            return d.getDate() === today.getDate() &&
                   d.getMonth() === today.getMonth() &&
                   d.getFullYear() === today.getFullYear();
        });
    };
    const todayTransactions = getTodayTransactions();
    const receivedToday = todayTransactions.filter(t => t.type === 'receive' || (t.type === 'transfer' && t.toLocation === 'mammal'));
    const usedToday = todayTransactions.filter(t => t.type === 'usage');

    return (
        <div className="min-h-screen bg-gray-50 pb-28 font-sans dark:bg-gray-950">
            <PageHeader
                sticky
                icon={<ClipboardList />}
                title={t.logSheet}
                subtitle={`${t.mammal} · ${userName}`}
                meta={
                    <>
                        <Badge tone="success" dot pulse>
                            {isAr ? 'مباشر' : 'Live'}
                        </Badge>
                        {pendingCount > 0 && <Badge tone="brand">{pendingCount} {t.updatesPending}</Badge>}
                    </>
                }
                actions={
                    <>
                        <NotificationCenter
                            notifications={alerts}
                            language={language}
                            t={t}
                            onMarkAsRead={onMarkNotificationAsRead || (() => {})}
                            onMarkAllAsRead={onMarkAllNotificationsAsRead || (() => {})}
                        />
                        <Button
                            variant="secondary"
                            icon={<FileText />}
                            onClick={() => setShowReportModal(true)}
                            hideLabelOnMobile
                        >
                            {t.dailyReport}
                        </Button>
                        {theme && onToggleTheme && onToggleLanguage && (
                            <AppControls
                                language={language}
                                theme={theme}
                                onToggleTheme={onToggleTheme}
                                onToggleLanguage={onToggleLanguage}
                            />
                        )}
                        <Button
                            variant="ghost"
                            icon={<LogOut className="rtl:rotate-180" />}
                            onClick={onLogout}
                            hideLabelOnMobile
                        >
                            {t.logout}
                        </Button>
                    </>
                }
            />

            <PageBody className="space-y-4">
                <FilterBar
                    filtersLabel={isAr ? 'تصفية' : 'Filters'}
                    clearLabel={isAr ? 'مسح الكل' : 'Clear all'}
                    moreLabel={isAr ? 'خيارات أخرى' : 'More options'}
                    search={{
                        value: search,
                        onChange: setSearch,
                        placeholder: t.searchPlaceholder,
                        trailingSlot: (
                            <Button
                                variant="secondary"
                                size="sm"
                                icon={<Camera />}
                                aria-label={isAr ? 'مسح الباركود' : 'Scan barcode'}
                                title={isAr ? 'مسح الباركود' : 'Scan barcode'}
                                onClick={() => setShowScanner(true)}
                            />
                        )
                    }}
                    primaryAction={
                        hasPendingChanges ? (
                            <Button
                                variant="primary"
                                icon={<Save />}
                                loading={isSubmitting}
                                onClick={handleSubmitAll}
                            >
                                {t.submit}
                            </Button>
                        ) : undefined
                    }
                />

                {/* Messages */}
                {error && <ErrorState title={error} />}
                {successMsg && (
                    <div
                        className="flex items-center gap-3 rounded-lg border border-success-100 bg-success-50 p-3.5 text-sm font-medium text-success-700 dark:border-success-900 dark:bg-success-900/20 dark:text-success-100"
                        role="status"
                    >
                        <CheckCircle className="h-4.5 w-4.5 shrink-0" />
                        {successMsg}
                    </div>
                )}

                {/* Bulk Entry List */}
                <div className="space-y-4">
                    {filteredItems.map(item => {
                        const entry = logEntries[item.id] || { received: '', used: '', notes: '' };
                        const hasEntry = entry.received || entry.used;
                        const projectedStock = item.quantity + Number(entry.received || 0) - Number(entry.used || 0);
                        const isLow = projectedStock <= item.minThreshold;

                        return (
                            <div key={item.id} className={`rounded-xl border bg-white p-4 transition-colors sm:p-5 dark:bg-gray-900 ${hasEntry ? 'border-brand-500 ring-1 ring-brand-500/30' : 'border-gray-200 dark:border-gray-800'}`}>
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white">{language === 'ar' ? item.nameAr : item.nameEn}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{t.stockLevel}: <span className="tnum font-medium text-gray-900 dark:text-white">{item.quantity} {formatUnit(item.unit, language)}</span></p>
                                            {isLow && <Badge tone="warning" size="sm">{t.lowStock}</Badge>}
                                        </div>
                                    </div>
                                    {hasEntry && (
                                        <Badge tone="brand">
                                            {projectedStock} {formatUnit(item.unit, language)} {isAr ? '(متوقع)' : '(projected)'}
                                        </Badge>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {/* Received Input */}
                                    <div className="relative">
                                        <label className="mb-1.5 flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                            <ArrowDownCircle className="w-3 h-3 text-green-500" /> {t.enterReceived}
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={entry.received}
                                            onChange={(e) => handleInputChange(item.id, 'received', e.target.value)}
                                            className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                            placeholder="0"
                                        />
                                    </div>

                                    {/* Used Input */}
                                    <div className="relative">
                                        <label className="mb-1.5 flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                            <ArrowUpCircle className="w-3 h-3 text-red-500" /> {t.enterUsed}
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={entry.used}
                                            onChange={(e) => handleInputChange(item.id, 'used', e.target.value)}
                                            className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                            placeholder="0"
                                        />
                                    </div>
                                    
                                    {/* Notes Input */}
                                    <div className="md:col-span-1">
                                        <label className="mb-1.5 flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                            <Edit2 className="w-3 h-3" /> {t.notes}
                                        </label>
                                        <input
                                            type="text"
                                            value={entry.notes}
                                            onChange={(e) => handleInputChange(item.id, 'notes', e.target.value)}
                                            className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                            placeholder={t.addNote}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {filteredItems.length === 0 && (
                        <div className="rounded-xl border border-dashed border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900">
                            <EmptyState
                                icon={<Search />}
                                title={t.noItemsFound || (isAr ? 'لا توجد أصناف' : 'No items found')}
                                description={t.tryAdjustingFilters}
                                action={
                                    search ? (
                                        <Button variant="secondary" size="sm" onClick={() => setSearch('')}>
                                            {isAr ? 'مسح البحث' : 'Clear search'}
                                        </Button>
                                    ) : undefined
                                }
                            />
                        </div>
                    )}
                </div>
            </PageBody>

            {/* Bottom Action Bar */}
            {hasPendingChanges && (
                <div className="fixed inset-x-0 bottom-0 z-sticky border-t border-gray-200 bg-white/95 p-3 pb-safe backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
                    <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
                        <div className="hidden sm:block">
                            <p className="font-bold text-gray-900 dark:text-white">{pendingCount} {t.updatesPending}</p>
                            <p className="text-xs text-gray-500">{t.saveChanges}</p>
                        </div>
                        <div className="flex flex-1 sm:flex-none gap-3">
                            <button 
                                onClick={handleClear}
                                disabled={isSubmitting}
                                className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 sm:flex-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                                <RotateCcw className="w-4 h-4" />
                                <span className="hidden sm:inline">{t.clear}</span>
                            </button>
                            <button 
                                onClick={handleSubmitAll}
                                disabled={isSubmitting}
                                className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-brand-700 px-5 text-sm font-medium text-white transition-colors hover:bg-brand-800 disabled:cursor-wait disabled:opacity-60 sm:flex-none"
                            >
                                {isSubmitting ? <span className="animate-spin text-xl">⟳</span> : <Save className="w-4 h-4" />}
                                {t.submit}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Modal
                open={showReportModal}
                onClose={() => setShowReportModal(false)}
                title={t.dailyReport}
                icon={<FileText />}
                size="sm"
                footer={
                    <Button
                        variant="primary"
                        block
                        icon={<Download />}
                        onClick={() => exportDailyReportPDF(todayTransactions, 'mammal', t.mammal, language, userName)}
                    >
                        {t.downloadReport}
                    </Button>
                }
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <StatTile
                            label={t.receivedToday}
                            value={receivedToday.length}
                            tone="success"
                            icon={<ArrowDownCircle />}
                        />
                        <StatTile
                            label={t.usedToday}
                            value={usedToday.length}
                            tone="danger"
                            icon={<ArrowUpCircle />}
                        />
                    </div>
                    <p className="text-center text-xs text-gray-400">
                        {t.summary} • {new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}
                    </p>
                </div>
            </Modal>

            {showScanner && (
                <BarcodeScanner 
                    onScan={handleScan}
                    onClose={() => setShowScanner(false)}
                    language={language}
                    t={t}
                />
            )}
        </div>
    );
};

export default MammalEmployeeDashboard;