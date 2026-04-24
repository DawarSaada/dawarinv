import React from 'react';
import { 
  Package, 
  CheckCircle, 
  MoreVertical, 
  Pencil, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Clock, 
  Trash2, 
  MapPin
} from 'lucide-react';
import { InventoryItem, Language } from '../../types';

interface InventoryGridProps {
  filteredItems: InventoryItem[];
  viewMode: 'grid' | 'list' | 'compact';
  language: Language;
  isGlobalView: boolean;
  selectedItemIds: Set<string>;
  toggleItemSelection: (id: string) => void;
  canEditItem: boolean;
  canRecordUsage: boolean;
  activeActionId: string | null;
  setActiveActionId: (id: string | null) => void;
  t: any;
  onEditItem: (item: InventoryItem) => void;
  onRecordUsage: (item: InventoryItem) => void;
  onRecordReceive: (item: InventoryItem) => void;
  onViewHistory: (item: InventoryItem) => void;
  onDeleteItem: (item: InventoryItem) => void;
  isExpiringSoon: (date?: string) => boolean;
  isExpired: (date?: string) => boolean;
}

const InventoryGrid: React.FC<InventoryGridProps> = ({
  filteredItems,
  viewMode,
  language,
  isGlobalView,
  selectedItemIds,
  toggleItemSelection,
  canEditItem,
  canRecordUsage,
  activeActionId,
  setActiveActionId,
  t,
  onEditItem,
  onRecordUsage,
  onRecordReceive,
  onViewHistory,
  onDeleteItem,
  isExpiringSoon,
  isExpired
}) => {
  if (filteredItems.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <Package className="w-10 h-10 text-gray-400" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t.noItemsFound}</h3>
        <p className="text-gray-500 dark:text-gray-400">{t.tryAdjustingFilters}</p>
      </div>
    );
  }

  return (
    <div className={
        viewMode === 'list' ? 'flex flex-col gap-3' : 
        viewMode === 'compact' ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3' : 
        'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'
    }>
      {filteredItems.map(item => {
        const isLowStock = item.quantity <= item.minThreshold;
        const isSelected = selectedItemIds.has(item.id);

        // --- COMPACT BOX VIEW ---
        if (viewMode === 'compact') {
            const expiringSoon = isExpiringSoon(item.expirationDate);
            const expired = isExpired(item.expirationDate);
            return (
              <div 
                key={item.id} 
                onClick={() => !isGlobalView && toggleItemSelection(item.id)}
                className={`bg-white dark:bg-gray-800 rounded-xl p-3 border hover:border-brand-300 dark:hover:border-brand-700 shadow-sm hover:shadow-md transition-all relative flex flex-col items-center text-center cursor-pointer ${isSelected ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-gray-200 dark:border-gray-700'} ${expired ? 'border-red-500' : expiringSoon ? 'border-yellow-500' : ''}`}
              >
                  {isSelected && (
                    <div className="absolute top-2 left-2 z-10">
                      <CheckCircle className="w-4 h-4 text-brand-600 fill-white" />
                    </div>
                  )}
                  {isLowStock && <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>}
                  {(expired || expiringSoon) && (
                      <div className={`absolute top-2 right-[${isLowStock ? '16px' : '8px'}] w-2 h-2 rounded-full ${expired ? 'bg-red-600' : 'bg-yellow-500'}`} title={expired ? 'Expired' : 'Expiring Soon'}></div>
                  )}
                  <div className={`p-2 rounded-full mb-2 ${isLowStock ? 'bg-red-50 dark:bg-red-900/20 text-red-600' : 'bg-brand-50 dark:bg-brand-900/20 text-brand-600'}`}>
                     <Package className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1 line-clamp-1 w-full">{language === 'ar' ? item.nameAr : item.nameEn}</h3>
                  <p className={`text-lg font-bold mb-2 ${isLowStock ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>{item.quantity} <span className="text-[10px] text-gray-500">{item.unit}</span></p>
                  
                  {!isGlobalView && (
                       <div className="flex gap-1 w-full mt-auto" onClick={e => e.stopPropagation()}>
                          {canEditItem ? (
                              <>
                                 <button onClick={() => onEditItem(item)} className="flex-1 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs hover:bg-gray-200 dark:hover:bg-gray-600"><Pencil className="w-3 h-3 mx-auto" /></button>
                                 <button onClick={() => onRecordReceive(item)} className="flex-1 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs hover:bg-gray-200 dark:hover:bg-gray-600"><ArrowUpCircle className="w-3 h-3 mx-auto text-green-500" /></button>
                                 <button onClick={() => onRecordUsage(item)} className="flex-1 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs hover:bg-gray-200 dark:hover:bg-gray-600"><ArrowDownCircle className="w-3 h-3 mx-auto" /></button>
                                 <button onClick={() => onViewHistory(item)} className="flex-1 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs hover:bg-gray-200 dark:hover:bg-gray-600"><Clock className="w-3 h-3 mx-auto" /></button>
                              </>
                          ) : canRecordUsage ? (
                              <>
                                 <button onClick={() => onRecordReceive(item)} className="flex-1 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs hover:bg-gray-200 dark:hover:bg-gray-600"><ArrowUpCircle className="w-3 h-3 mx-auto text-green-500" /></button>
                                 <button onClick={() => onRecordUsage(item)} className="flex-1 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs hover:bg-gray-200 dark:hover:bg-gray-600"><ArrowDownCircle className="w-3 h-3 mx-auto" /></button>
                                 <button onClick={() => onViewHistory(item)} className="flex-1 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs hover:bg-gray-200 dark:hover:bg-gray-600"><Clock className="w-3 h-3 mx-auto" /></button>
                              </>
                          ) : (
                              <button onClick={() => onViewHistory(item)} className="flex-1 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs hover:bg-gray-200 dark:hover:bg-gray-600"><Clock className="w-3 h-3 mx-auto" /></button>
                          )}
                       </div>
                  )}
              </div>
            );
        }

        // --- LIST VIEW ---
        if (viewMode === 'list') {
            const expiringSoon = isExpiringSoon(item.expirationDate);
            const expired = isExpired(item.expirationDate);
            return (
                <div 
                  key={item.id} 
                  onClick={() => !isGlobalView && toggleItemSelection(item.id)}
                  className={`bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 border hover:border-brand-300 dark:hover:border-brand-700 shadow-sm flex items-center gap-4 cursor-pointer ${isSelected ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-gray-200 dark:border-gray-700'} ${expired ? 'border-red-500' : expiringSoon ? 'border-yellow-500' : ''}`}
                >
                    {!isGlobalView && (
                      <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-brand-600 border-brand-600' : 'border-gray-300 dark:border-gray-600'}`}>
                        {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
                      </div>
                    )}
                    <div className={`p-3 rounded-lg hidden sm:block ${isLowStock ? 'bg-red-50 dark:bg-red-900/20 text-red-600' : 'bg-brand-50 dark:bg-brand-900/20 text-brand-600'}`}>
                        <Package className="w-6 h-6" />
                    </div>
                    
                    <div className="flex-1 min-0">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">{language === 'ar' ? item.nameAr : item.nameEn}</h3>
                            {isLowStock && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 uppercase">{t.lowStock}</span>}
                            {expired && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 uppercase">Expired</span>}
                            {expiringSoon && !expired && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400 uppercase">Expiring Soon</span>}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">{item.category}</span>
                            {isGlobalView && item.locationId && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {item.locationId}</span>}
                            {item.expirationDate && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {item.expirationDate}</span>}
                        </p>
                    </div>

                    <div className="text-right whitespace-nowrap px-4">
                        <p className={`text-xl font-bold ${isLowStock ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                            {item.quantity} <span className="text-sm text-gray-500 font-medium">{item.unit}</span>
                        </p>
                    </div>

                    {!isGlobalView && (
                       <div className="relative" onClick={e => e.stopPropagation()}>
                          <button onClick={(e) => { e.stopPropagation(); setActiveActionId(activeActionId === item.id ? null : item.id); }} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors">
                             <MoreVertical className="w-5 h-5" />
                          </button>
                          {activeActionId === item.id && (
                             <div className="absolute right-0 rtl:right-auto rtl:left-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-1 z-30">
                                 {canEditItem ? (
                                     <>
                                        <button onClick={() => { onEditItem(item); setActiveActionId(null); }} className="w-full text-left rtl:text-right px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-2"><Pencil className="w-4 h-4" /> {t.edit}</button>
                                        <button onClick={() => { onRecordUsage(item); setActiveActionId(null); }} className="w-full text-left rtl:text-right px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-2"><ArrowDownCircle className="w-4 h-4 text-red-500" /> {t.recordUsage}</button>
                                        <button onClick={() => { onViewHistory(item); setActiveActionId(null); }} className="w-full text-left rtl:text-right px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-2"><Clock className="w-4 h-4 text-blue-500" /> {t.history}</button>
                                        <button onClick={() => { onDeleteItem(item); setActiveActionId(null); }} className="w-full text-left rtl:text-right px-4 py-2.5 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 flex items-center gap-2"><Trash2 className="w-4 h-4" /> {t.delete}</button>
                                     </>
                                 ) : canRecordUsage ? (
                                     <>
                                        <button onClick={() => { onRecordUsage(item); setActiveActionId(null); }} className="w-full text-left rtl:text-right px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-2"><ArrowDownCircle className="w-4 h-4 text-red-500" /> {t.recordUsage}</button>
                                        <button onClick={() => { onViewHistory(item); setActiveActionId(null); }} className="w-full text-left rtl:text-right px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-2"><Clock className="w-4 h-4 text-blue-500" /> {t.history}</button>
                                     </>
                                 ) : (
                                     <button onClick={() => { onViewHistory(item); setActiveActionId(null); }} className="w-full text-left rtl:text-right px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-2"><Clock className="w-4 h-4 text-blue-500" /> {t.history}</button>
                                 )}
                             </div>
                          )}
                       </div>
                    )}
                </div>
            );
        }

        // --- GRID VIEW (DEFAULT) ---
        const expiringSoon = isExpiringSoon(item.expirationDate);
        const expired = isExpired(item.expirationDate);
        return (
          <div 
            key={item.id} 
            onClick={() => !isGlobalView && toggleItemSelection(item.id)}
            className={`bg-white dark:bg-gray-800 rounded-2xl p-5 border hover:border-brand-300 dark:hover:border-brand-700 shadow-sm hover:shadow-md transition-all group relative cursor-pointer ${isSelected ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-gray-200 dark:border-gray-700'} ${expired ? 'border-red-500' : expiringSoon ? 'border-yellow-500' : ''}`}
          >
            {!isGlobalView && (
              <div className={`absolute top-4 left-4 z-10 w-6 h-6 rounded-full border flex items-center justify-center transition-all ${isSelected ? 'bg-brand-600 border-brand-600 scale-110' : 'bg-white/80 dark:bg-gray-800/80 border-gray-300 dark:border-gray-600 opacity-0 group-hover:opacity-100'}`}>
                {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
              </div>
            )}
            
            {isLowStock && (
              <div className="absolute top-4 right-4 rtl:right-auto rtl:left-4 z-10">
                <span className="flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
              </div>
            )}

            {(expired || expiringSoon) && (
              <div className={`absolute top-4 right-[${isLowStock ? '32px' : '16px'}] z-10`} title={expired ? 'Expired' : 'Expiring Soon'}>
                <span className="flex h-3 w-3">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${expired ? 'bg-red-400' : 'bg-yellow-400'} opacity-75`}></span>
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${expired ? 'bg-red-600' : 'bg-yellow-500'}`}></span>
                </span>
              </div>
            )}

            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl ${isLowStock ? 'bg-red-50 dark:bg-red-900/20 text-red-600' : 'bg-brand-50 dark:bg-brand-900/20 text-brand-600'}`}>
                <Package className="w-6 h-6" />
              </div>
              
              {!isGlobalView && (
                  <div className="relative" onClick={e => e.stopPropagation()}>
                    <button onClick={(e) => { e.stopPropagation(); setActiveActionId(activeActionId === item.id ? null : item.id); }} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors">
                       <MoreVertical className="w-5 h-5" />
                    </button>
                    
                    {activeActionId === item.id && (
                       <div className="absolute right-0 rtl:right-auto rtl:left-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-1 z-[30] animate-in fade-in zoom-in-95 duration-100">
                          {canEditItem ? (
                              <>
                                  <button onClick={() => { onEditItem(item); setActiveActionId(null); }} className="w-full text-left rtl:text-right px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-2">
                                      <Pencil className="w-4 h-4" /> {t.edit}
                                  </button>
                                  <button onClick={() => { onRecordReceive(item); setActiveActionId(null); }} className="w-full text-left rtl:text-right px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-2">
                                      <ArrowUpCircle className="w-4 h-4 text-green-500" /> {language === 'ar' ? 'تسجيل استلام' : 'Record Receive'}
                                  </button>
                                  <button onClick={() => { onRecordUsage(item); setActiveActionId(null); }} className="w-full text-left rtl:text-right px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-2">
                                      <ArrowDownCircle className="w-4 h-4 text-red-500" /> {t.recordUsage}
                                  </button>
                                  <button onClick={() => { onViewHistory(item); setActiveActionId(null); }} className="w-full text-left rtl:text-right px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-2">
                                      <Clock className="w-4 h-4 text-blue-500" /> {t.history}
                                  </button>
                                  <button onClick={() => { onDeleteItem(item); setActiveActionId(null); }} className="w-full text-left rtl:text-right px-4 py-2.5 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 flex items-center gap-2">
                                      <Trash2 className="w-4 h-4" /> {t.delete}
                                  </button>
                              </>
                          ) : canRecordUsage ? (
                              <>
                                  <button onClick={() => { onRecordReceive(item); setActiveActionId(null); }} className="w-full text-left rtl:text-right px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-2">
                                      <ArrowUpCircle className="w-4 h-4 text-green-500" /> {language === 'ar' ? 'تسجيل استلام' : 'Record Receive'}
                                  </button>
                                  <button onClick={() => { onRecordUsage(item); setActiveActionId(null); }} className="w-full text-left rtl:text-right px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-2">
                                      <ArrowDownCircle className="w-4 h-4 text-red-500" /> {t.recordUsage}
                                  </button>
                                  <button onClick={() => { onViewHistory(item); setActiveActionId(null); }} className="w-full text-left rtl:text-right px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-2">
                                      <Clock className="w-4 h-4 text-blue-500" /> {t.history}
                                  </button>
                              </>
                          ) : (
                              <button onClick={() => { onViewHistory(item); setActiveActionId(null); }} className="w-full text-left rtl:text-right px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-blue-500" /> {t.history}
                              </button>
                          )}
                       </div>
                    )}
                  </div>
              )}
            </div>

                <div className="flex flex-col flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 line-clamp-1">{language === 'ar' ? item.nameAr : item.nameEn}</h3>
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-3">
                     <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-xs font-medium">{item.category}</span>
                     {isGlobalView && item.locationId && (
                         <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-medium"><MapPin className="w-3 h-3" /> {item.locationId}</span>
                     )}
                  </div>
                  
                  <div className="flex items-end justify-between mt-auto">
                     <div>
                        <p className="text-xs text-gray-400 uppercase font-bold mb-0.5">{t.stockLevel}</p>
                        <p className={`text-2xl font-bold ${isLowStock ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                           {item.quantity} <span className="text-sm text-gray-500 font-medium">{item.unit}</span>
                        </p>
                     </div>
                     {isLowStock && (
                        <div className="text-right">
                           <p className="text-[10px] text-red-500 font-bold uppercase bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-full">{t.lowStockAlert}</p>
                        </div>
                     )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
  );
};

export default InventoryGrid;
