import React from 'react';
import { 
  Bell, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Download, 
  Eye, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  Check,
  Package,
  ArrowRight,
  MapPin,
  Clock
} from 'lucide-react';
import { Transaction, AppNotification, LocationData, Language } from '../../types';
import { supabase } from '../../services/supabase';
import { TRANSLATIONS } from '../../constants';

interface InventoryNotificationsProps {
  t: any;
  groupedIncoming: [string, Transaction[]][];
  groupedApprovals: [string, Transaction[]][];
  handleDownloadTransfer: (groupId: string, type: 'incoming' | 'outgoing') => void;
  setSelectedTransferGroup: (groupId: string) => void;
  handleBulkAccept: (groupId: string) => void;
  setRejectionTarget: (items: Transaction[]) => void;
  onConfirmOutbound: (tx: Transaction) => void;
  alerts?: AppNotification[];
  language?: Language;
  availableLocations?: LocationData[];
  onOpenTransferDetail?: (groupId: string, type: 'incoming' | 'outgoing' | 'approval') => void;
}

const InventoryNotifications: React.FC<InventoryNotificationsProps> = ({
  t,
  groupedIncoming,
  groupedApprovals,
  handleDownloadTransfer,
  setSelectedTransferGroup,
  handleBulkAccept,
  setRejectionTarget,
  onConfirmOutbound,
  alerts = [],
  language = 'en',
  availableLocations = [],
  onOpenTransferDetail
}) => {
  if (groupedIncoming.length === 0 && groupedApprovals.length === 0 && alerts.length === 0) {
    return null;
  }

  const handleMarkAsRead = async (id: string) => {
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    } catch (e) {
      console.error(e);
    }
  };

  // Helper to resolve location name
  const getLocationName = (locationId: string | undefined) => {
    if (!locationId) return '';
    if (locationId === 'warehouse') return t.warehouse;
    if (locationId === 'mammal') return t.mammal;
    const loc = availableLocations.find(l => l.id === locationId);
    if (!loc) return locationId;
    return language === 'ar' ? (loc.nameAr || loc.name) : loc.name;
  };

  const handleViewTransfer = (groupId: string, type: 'incoming' | 'outgoing' | 'approval') => {
    if (onOpenTransferDetail) {
      onOpenTransferDetail(groupId, type);
    } else {
      setSelectedTransferGroup(groupId);
    }
  };

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
                {groupedIncoming.map(([groupId, items]) => {
                  const fromName = getLocationName(items[0]?.fromLocation);
                  const toName = getLocationName(items[0]?.toLocation);
                  const date = items[0]?.date ? new Date(items[0].date).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' }) : '';
                  
                  return (
                   <div key={groupId} className="bg-white dark:bg-gray-800 rounded-2xl border border-blue-100 dark:border-blue-900/30 p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow">
                      {/* Route Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="p-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                            <Package className="w-4 h-4 text-blue-500" />
                          </div>
                          <span className="font-bold text-gray-900 dark:text-white">{fromName}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-gray-300" />
                          <span className="font-bold text-gray-900 dark:text-white">{toName}</span>
                        </div>
                        <button onClick={() => handleDownloadTransfer(groupId, 'incoming')} className="p-1.5 text-gray-300 hover:text-brand-600 transition-colors rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20" title={t.exportPDF}>
                           <Download className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Meta */}
                      <div className="flex items-center gap-3 mb-4 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {items.length} {t.items}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {date}</span>
                        <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full font-bold text-[10px]">{t.awaitingReview}</span>
                      </div>

                      {/* Action */}
                      <button 
                        onClick={() => handleViewTransfer(groupId, 'incoming')} 
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-blue-600 to-brand-600 text-white rounded-xl text-xs font-bold hover:from-blue-700 hover:to-brand-700 transition-all shadow-md shadow-blue-200 dark:shadow-none"
                      >
                        <Eye className="w-4 h-4" /> {t.reviewTransfer}
                      </button>
                   </div>
                  );
                })}
                {groupedIncoming.length === 0 && <p className="text-sm text-gray-400 italic">{t.noItemsInList}</p>}
             </div>
          </div>

          {/* Outgoing Section */}
          <div className="space-y-4">
             <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <ArrowUpCircle className="w-4 h-4 text-orange-500" /> {t.outgoingApprovals}
             </h3>
             <div className="space-y-3">
                {groupedApprovals.map(([groupId, items]) => {
                  const fromName = getLocationName(items[0]?.fromLocation);
                  const toName = getLocationName(items[0]?.toLocation);
                  const date = items[0]?.date ? new Date(items[0].date).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' }) : '';

                  return (
                   <div key={groupId} className="bg-white dark:bg-gray-800 rounded-2xl border border-orange-100 dark:border-orange-900/30 p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow">
                      {/* Route Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="p-1.5 bg-orange-50 dark:bg-orange-900/30 rounded-lg">
                            <Package className="w-4 h-4 text-orange-500" />
                          </div>
                          <span className="font-bold text-gray-900 dark:text-white">{fromName}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-gray-300" />
                          <span className="font-bold text-gray-900 dark:text-white">{toName}</span>
                        </div>
                        <button onClick={() => handleDownloadTransfer(groupId, 'outgoing')} className="p-1.5 text-gray-300 hover:text-orange-600 transition-colors rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20">
                           <Download className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Meta */}
                      <div className="flex items-center gap-3 mb-4 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {items.length} {t.items}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {date}</span>
                        <span className="px-2 py-0.5 bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full font-bold text-[10px]">{t.waitingForSource}</span>
                      </div>

                      {/* Action */}
                      <button 
                        onClick={() => handleViewTransfer(groupId, 'approval')} 
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl text-xs font-bold hover:from-orange-600 hover:to-amber-600 transition-all shadow-md shadow-orange-200 dark:shadow-none"
                      >
                        <Eye className="w-4 h-4" /> {t.reviewTransfer}
                      </button>
                   </div>
                  );
                })}
                {groupedApprovals.length === 0 && <p className="text-sm text-gray-400 italic">{t.noTransactionsFound}</p>}
              </div>
           </div>
        </div>

        {/* System Alerts Section */}
        {alerts.length > 0 && (
           <div className="space-y-4 mt-6">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                 <AlertTriangle className="w-4 h-4 text-red-500" /> {language === 'ar' ? 'تنبيهات النظام' : 'System Alerts'}
              </h3>
              
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-red-200 dark:border-red-900/30 shadow-sm overflow-hidden flex flex-col">
                 <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-red-50/50 dark:bg-red-900/10">
                    <div className="flex items-center gap-2">
                       <AlertTriangle className="w-5 h-5 text-red-500" />
                       <span className="font-bold text-red-600 dark:text-red-400">
                          {language === 'ar' ? 'تنبيهات المخزون' : 'Stock Alerts'} ({alerts.length})
                       </span>
                    </div>
                    {alerts.some(a => !a.isRead) && (
                       <button 
                          onClick={async () => {
                             for (const a of alerts.filter(al => !al.isRead)) {
                                await handleMarkAsRead(a.id);
                             }
                          }}
                          className="px-3 py-1.5 bg-brand-50 hover:bg-brand-100 dark:bg-brand-900/30 dark:hover:bg-brand-900/50 text-xs font-bold text-brand-600 dark:text-brand-400 rounded-lg flex items-center gap-1.5 transition-colors"
                       >
                          <Check className="w-3.5 h-3.5" /> {language === 'ar' ? 'تحديد الكل كمقروء' : 'Mark All as Read'}
                       </button>
                    )}
                 </div>
                 
                 <div className="p-0 max-h-[400px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                    {alerts.map(alert => (
                       <div key={alert.id} className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${alert.isRead ? 'bg-gray-50/50 dark:bg-gray-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
                          <div>
                             <p className={`text-sm ${alert.isRead ? 'text-gray-500' : 'text-gray-900 dark:text-white font-medium'}`}>
                                {language === 'ar' ? alert.messageAr : alert.messageEn}
                             </p>
                             <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(alert.createdAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', {
                                  year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                })}
                             </p>
                          </div>
                          {!alert.isRead && (
                             <button 
                                onClick={() => handleMarkAsRead(alert.id)}
                                className="text-xs font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400 flex items-center gap-1 shrink-0"
                             >
                                <CheckCircle className="w-3.5 h-3.5" /> {language === 'ar' ? 'تحديد كمقروء' : 'Mark as Read'}
                             </button>
                          )}
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        )}
    </div>
  );
};

export default InventoryNotifications;
