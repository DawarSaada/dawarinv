import React from 'react';
import { 
  Bell, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Download, 
  Eye, 
  CheckCircle, 
  XCircle 
} from 'lucide-react';
import { Transaction } from '../../types';

interface InventoryNotificationsProps {
  t: any;
  groupedIncoming: [string, Transaction[]][];
  groupedApprovals: [string, Transaction[]][];
  handleDownloadTransfer: (groupId: string, type: 'incoming' | 'outgoing') => void;
  setSelectedTransferGroup: (groupId: string) => void;
  handleBulkAccept: (groupId: string) => void;
  setRejectionTarget: (items: Transaction[]) => void;
  onConfirmOutbound: (tx: Transaction) => void;
}

const InventoryNotifications: React.FC<InventoryNotificationsProps> = ({
  t,
  groupedIncoming,
  groupedApprovals,
  handleDownloadTransfer,
  setSelectedTransferGroup,
  handleBulkAccept,
  setRejectionTarget,
  onConfirmOutbound
}) => {
  if (groupedIncoming.length === 0 && groupedApprovals.length === 0) {
    return null;
  }

  return (
    <div className="mb-8 space-y-6">
       <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-brand-600" />
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{t.notificationCenter}</h2>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Incoming Section */}
          <div className="space-y-4">
             <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <ArrowDownCircle className="w-4 h-4 text-blue-500" /> {t.incomingRequests}
             </h3>
             <div className="space-y-3">
                {groupedIncoming.map(([groupId, items]) => (
                   <div key={groupId} className="bg-white dark:bg-gray-800 rounded-xl border border-blue-100 dark:border-blue-900/30 p-4 sm:p-5 shadow-sm">
                      <div className="flex justify-between items-start mb-4">
                         <div>
                            <p className="text-xs text-gray-400 mb-1">{t.from}: <span className="text-gray-900 dark:text-white font-bold">{items[0].fromLocation}</span></p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{items.length} {t.items} • {items.reduce((acc, curr) => acc + curr.quantity, 0)} {items[0].unit}</p>
                         </div>
                         <button onClick={() => handleDownloadTransfer(groupId, 'incoming')} className="p-2 text-gray-400 hover:text-brand-600 transition-colors" title={t.exportPDF}>
                            <Download className="w-5 h-5" />
                         </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                         <button onClick={() => setSelectedTransferGroup(groupId)} className="flex-1 min-w-[100px] flex items-center justify-center gap-2 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors">
                            <Eye className="w-3 h-3" /> {t.viewItems}
                         </button>
                         <button onClick={() => handleBulkAccept(groupId)} className="flex-1 min-w-[100px] flex items-center justify-center gap-2 py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-colors">
                            <CheckCircle className="w-3 h-3" /> {t.accept}
                         </button>
                         <button onClick={() => setRejectionTarget(items)} className="flex items-center justify-center p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors" title={t.reject}>
                            <XCircle className="w-5 h-5" />
                         </button>
                      </div>
                   </div>
                ))}
                {groupedIncoming.length === 0 && <p className="text-sm text-gray-400 italic">{t.noItemsInList}</p>}
             </div>
          </div>

          {/* Outgoing Section */}
          <div className="space-y-4">
             <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <ArrowUpCircle className="w-4 h-4 text-orange-500" /> {t.outgoingApprovals}
             </h3>
             <div className="space-y-3">
                {groupedApprovals.map(([groupId, items]) => (
                   <div key={groupId} className="bg-white dark:bg-gray-800 rounded-xl border border-orange-100 dark:border-orange-900/30 p-4 sm:p-5 shadow-sm">
                      <div className="flex justify-between items-start mb-4">
                         <div>
                            <p className="text-xs text-gray-400 mb-1">{t.to}: <span className="text-gray-900 dark:text-white font-bold">{items[0].toLocation}</span></p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{items.length} {t.items} • {items.reduce((acc, curr) => acc + curr.quantity, 0)} {items[0].unit}</p>
                         </div>
                         <button onClick={() => handleDownloadTransfer(groupId, 'outgoing')} className="p-2 text-gray-400 hover:text-orange-600 transition-colors">
                            <Download className="w-5 h-5" />
                         </button>
                      </div>
                      <div className="flex gap-2">
                         <button 
                            onClick={() => setSelectedTransferGroup(groupId)} 
                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors"
                         >
                            <Eye className="w-3 h-3" /> {t.viewItems}
                         </button>
                         <button 
                            onClick={() => items.forEach(tx => onConfirmOutbound(tx))} 
                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-orange-600 text-white rounded-lg text-xs font-bold hover:bg-orange-700 transition-colors"
                         >
                            <CheckCircle className="w-3 h-3" /> {t.confirmOutbound}
                         </button>
                      </div>
                   </div>
                ))}
                {groupedApprovals.length === 0 && <p className="text-sm text-gray-400 italic">{t.noTransactionsFound}</p>}
             </div>
          </div>
       </div>
    </div>
  );
};

export default InventoryNotifications;
