import React, { useState, useMemo } from 'react';
import { InventoryItem, Language, Transaction, TransactionType } from '../types';
import { TRANSLATIONS } from '../constants';
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
    Edit2 
} from 'lucide-react';

interface MammalEmployeeDashboardProps {
    items: InventoryItem[];
    onLogout: () => void;
    language: Language;
    onLogTransaction: (type: TransactionType, itemId: string, quantity: number, notes: string) => void;
    onBulkLogTransaction: (logs: { type: TransactionType, itemId: string, quantity: number, notes: string }[]) => void;
    userName: string;
    transactions: Transaction[];
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
    transactions
}) => {
    const t = TRANSLATIONS[language];
    const [search, setSearch] = useState('');
    const [showReportModal, setShowReportModal] = useState(false);
    
    // Bulk Entry State
    const [logEntries, setLogEntries] = useState<Record<string, LogEntry>>({});
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const filteredItems = items.filter(i => {
        const name = language === 'ar' ? i.nameAr : i.nameEn;
        return name.toLowerCase().includes(search.toLowerCase());
    });

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
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors font-sans pb-24">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20">
                <div className="px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="p-2 bg-brand-600 rounded-lg text-white flex-shrink-0">
                            <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white font-arabic leading-tight truncate">
                                {t.logSheet}
                            </h1>
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                                <span className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-tighter">Live</span>
                                <span className="text-[10px] text-gray-400 ml-1 truncate">• {t.mammal}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setShowReportModal(true)}
                            className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-lg text-sm font-bold hover:bg-blue-100 transition-colors"
                        >
                            <FileText className="w-4 h-4" />
                            <span className="hidden sm:inline">{t.dailyReport}</span>
                        </button>
                        <button 
                            onClick={onLogout}
                            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded-lg transition-colors"
                        >
                            <LogOut className="w-5 h-5 rtl:rotate-180" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="p-4 sm:p-6 max-w-5xl mx-auto">
                {/* Search */}
                <div className="mb-6 relative">
                    <input
                        type="text"
                        placeholder={t.searchPlaceholder}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 rtl:pr-10 rtl:pl-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm focus:ring-2 focus:ring-brand-500 outline-none text-gray-900 dark:text-white"
                    />
                    <Search className="w-5 h-5 text-gray-400 absolute left-3 rtl:right-3 rtl:left-auto top-3.5" />
                </div>

                {/* Messages */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <span className="font-medium">{error}</span>
                    </div>
                )}
                {successMsg && (
                    <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2">
                        <CheckCircle className="w-5 h-5 shrink-0" />
                        <span className="font-medium">{successMsg}</span>
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
                            <div key={item.id} className={`bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-5 border shadow-sm transition-all ${hasEntry ? 'border-brand-300 dark:border-brand-700 ring-1 ring-brand-100 dark:ring-brand-900/30' : 'border-gray-200 dark:border-gray-700'}`}>
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white">{language === 'ar' ? item.nameAr : item.nameEn}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{t.stockLevel}: <span className="font-medium text-gray-900 dark:text-white">{item.quantity} {item.unit}</span></p>
                                            {isLow && <span className="text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded uppercase">{t.lowStock}</span>}
                                        </div>
                                    </div>
                                    {hasEntry && (
                                        <span className="text-xs font-bold text-brand-600 bg-brand-50 dark:bg-brand-900/20 px-2 py-1 rounded-lg">
                                            {projectedStock} {item.unit} (Proj.)
                                        </span>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {/* Received Input */}
                                    <div className="relative">
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1 flex items-center gap-1">
                                            <ArrowDownCircle className="w-3 h-3 text-green-500" /> {t.enterReceived}
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={entry.received}
                                            onChange={(e) => handleInputChange(item.id, 'received', e.target.value)}
                                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-white placeholder-gray-400"
                                            placeholder="0"
                                        />
                                    </div>

                                    {/* Used Input */}
                                    <div className="relative">
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1 flex items-center gap-1">
                                            <ArrowUpCircle className="w-3 h-3 text-red-500" /> {t.enterUsed}
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={entry.used}
                                            onChange={(e) => handleInputChange(item.id, 'used', e.target.value)}
                                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-white placeholder-gray-400"
                                            placeholder="0"
                                        />
                                    </div>
                                    
                                    {/* Notes Input */}
                                    <div className="md:col-span-1">
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1 flex items-center gap-1">
                                            <Edit2 className="w-3 h-3" /> {t.notes}
                                        </label>
                                        <input
                                            type="text"
                                            value={entry.notes}
                                            onChange={(e) => handleInputChange(item.id, 'notes', e.target.value)}
                                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-white placeholder-gray-400"
                                            placeholder={t.addNote}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>

            {/* Bottom Action Bar */}
            {hasPendingChanges && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg animate-in slide-in-from-bottom-5 z-40">
                    <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
                        <div className="hidden sm:block">
                            <p className="font-bold text-gray-900 dark:text-white">{pendingCount} {t.updatesPending}</p>
                            <p className="text-xs text-gray-500">{t.saveChanges}</p>
                        </div>
                        <div className="flex flex-1 sm:flex-none gap-3">
                            <button 
                                onClick={handleClear}
                                disabled={isSubmitting}
                                className="flex-1 sm:flex-none px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
                            >
                                <RotateCcw className="w-4 h-4" />
                                <span className="hidden sm:inline">{t.clear}</span>
                            </button>
                            <button 
                                onClick={handleSubmitAll}
                                disabled={isSubmitting}
                                className="flex-1 sm:flex-none px-8 py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-200 dark:shadow-none flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait"
                            >
                                {isSubmitting ? <span className="animate-spin text-xl">⟳</span> : <Save className="w-4 h-4" />}
                                {t.submit}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Report Modal */}
            {showReportModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t.dailyReport}</h3>
                            <button onClick={() => setShowReportModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* Summary Stats */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-900/30">
                                    <p className="text-xs font-bold text-green-600 uppercase mb-1">{t.receivedToday}</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{receivedToday.length}</p>
                                </div>
                                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/30">
                                    <p className="text-xs font-bold text-red-600 uppercase mb-1">{t.usedToday}</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{usedToday.length}</p>
                                </div>
                            </div>

                            <button 
                                onClick={() => exportDailyReportPDF(todayTransactions, 'mammal', t.mammal, language, userName)}
                                className="w-full py-4 bg-gray-900 dark:bg-gray-700 text-white rounded-xl font-bold hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
                            >
                                <Download className="w-5 h-5" />
                                {t.downloadReport}
                            </button>

                            <p className="text-xs text-center text-gray-400">
                                {t.summary} • {new Date().toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MammalEmployeeDashboard;