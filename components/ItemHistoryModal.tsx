import React, { useMemo } from 'react';
import { InventoryItem, Transaction, Language } from '../types';
import { X, Clock, ArrowRightLeft, ArrowDownCircle, Plus, AlertTriangle } from 'lucide-react';
import { TRANSLATIONS } from '../constants';

interface ItemHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  transactions: Transaction[];
  language: Language;
  getUserName?: (name: string) => string;
  availableLocations?: { id: string; name: string; nameAr?: string }[];
}

const ItemHistoryModal: React.FC<ItemHistoryModalProps> = ({
  isOpen,
  onClose,
  item,
  transactions,
  language,
  getUserName,
  availableLocations = []
}) => {
  const t = TRANSLATIONS[language];

  const itemTransactions = useMemo(() => {
    if (!item) return [];
    return transactions
      .filter(tx => tx.itemNameEn === item.nameEn || tx.itemNameAr === item.nameAr)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [item, transactions]);

  if (!isOpen || !item) return null;

  const getLocationName = (locId: string) => {
    const loc = availableLocations.find(l => l.id === locId);
    if (!loc) return locId;
    if (loc.id === 'warehouse') return language === 'ar' ? 'المستودع' : 'Warehouse';
    if (loc.id === 'mammal') return language === 'ar' ? 'المعمل' : 'Mammal';
    return language === 'ar' ? (loc.nameAr || loc.name) : loc.name;
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'transfer': return <ArrowRightLeft className="w-4 h-4 text-blue-500" />;
      case 'usage': return <ArrowDownCircle className="w-4 h-4 text-red-500" />;
      case 'receive': return <Plus className="w-4 h-4 text-green-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTransactionDescription = (tx: Transaction) => {
    const isAr = language === 'ar';
    switch (tx.type) {
      case 'transfer':
        return isAr 
            ? `تم نقل ${tx.quantity} من ${getLocationName(tx.fromLocation || '')} إلى ${getLocationName(tx.toLocation || '')}`
            : `Transferred ${tx.quantity} from ${getLocationName(tx.fromLocation || '')} to ${getLocationName(tx.toLocation || '')}`;
      case 'usage':
        return isAr
            ? `تم استخدام ${tx.quantity} في ${getLocationName(tx.fromLocation || '')}`
            : `Used ${tx.quantity} at ${getLocationName(tx.fromLocation || '')}`;
      case 'receive':
        return isAr
            ? `تم استلام ${tx.quantity} في ${getLocationName(tx.toLocation || '')}`
            : `Received ${tx.quantity} to ${getLocationName(tx.toLocation || '')}`;
      default:
        return isAr
            ? `معاملة غير معروفة بكمية ${tx.quantity}`
            : `Unknown transaction of ${tx.quantity}`;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4 pb-4 pt-[max(env(safe-area-inset-top,1rem),1rem)]">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {language === 'ar' ? item.nameAr : item.nameEn}
              </h2>
              <p className="text-sm text-gray-500">{t.historyAuditTrail}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {itemTransactions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>{t.noHistoryFound}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {itemTransactions.map((tx) => (
                <div key={tx.id} className="flex gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800">
                  <div className="mt-1">
                    {getTransactionIcon(tx.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <p className="font-medium text-gray-900 dark:text-white text-sm">
                        {getTransactionDescription(tx)}
                      </p>
                      <span className="text-xs text-gray-500 whitespace-nowrap ml-4">
                        {new Date(tx.date).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{t.performedBy}: {getUserName ? getUserName(tx.performedBy) : tx.performedBy}</span>
                      {tx.status && (
                        <span className={`px-2 py-0.5 rounded-full ${
                          tx.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          (tx.status === 'pending_source' || tx.status === 'pending_target') ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {tx.status}
                        </span>
                      )}
                    </div>
                    {tx.notes && (
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-800">
                        {tx.notes}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ItemHistoryModal;
