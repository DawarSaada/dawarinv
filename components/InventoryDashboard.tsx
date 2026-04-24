import React, { useState, useRef, useEffect, useMemo } from 'react';
import { InventoryItem, LocationId, Language, Transaction, LocationData } from '../types';
import { TRANSLATIONS } from '../constants';
import { useToast } from './Toast';
import SmartAssistant from './SmartAssistant';
import TransferModal from './TransferModal';
import AddItemModal from './AddItemModal';
import UsageModal from './UsageModal';
import BulkEditModal from './BulkEditModal';
import ItemHistoryModal from './ItemHistoryModal';
import ConfirmationModal from './ConfirmationModal';
import ReceiveModal from './ReceiveModal';
import { Pagination } from './Pagination';
import { extractTextFromPDF, parseTransferDocument } from '../services/pdfService';
import { exportTransferPDF, exportInventoryExcel } from '../services/exportService';
import { 
  XCircle, 
  Package
} from 'lucide-react';
import InventoryHeader from './inventory/InventoryHeader';
import InventoryNotifications from './inventory/InventoryNotifications';
import InventoryToolbar from './inventory/InventoryToolbar';
import InventoryGrid from './inventory/InventoryGrid';
import BulkActionsBar from './inventory/BulkActionsBar';

interface InventoryDashboardProps {
  locationId: LocationId;
  inventory: InventoryItem[];
  transactions: Transaction[];
  onBack: () => void;
  onLogout: () => void;
  language: Language;
  onTransfer: (items: { itemId: string, quantity: number }[], toLocation: LocationId, sourceOverride?: LocationId) => void;
  onAddItem: (locationId: string, item: Omit<InventoryItem, 'id' | 'lastUpdated'>) => void;
  onEditItem: (locationId: string, item: InventoryItem) => void;
  onDeleteItem: (locationId: string, itemId: string) => void;
  onBulkDeleteItems: (locationId: string, itemIds: string[]) => void;
  onBulkEditItems: (locationId: string, itemIds: string[], updates: Partial<InventoryItem>) => void;
  onRecordUsage: (itemId: string, quantity: number, notes: string) => void;
  onRecordReceive?: (itemId: string, quantity: number, notes: string) => void;
  userRole: string;
  userBranchCode?: string;
  incomingTransfers: Transaction[];
  outgoingTransfers: Transaction[];
  outgoingApprovals: Transaction[];
  onReceiveTransfer: (transaction: Transaction) => void;
  onRejectTransfer: (transaction: Transaction, reason: string) => void;
  onConfirmOutbound: (transaction: Transaction) => void;
  availableLocations: LocationData[];
  getUserName: (name: string) => string;
}

const InventoryDashboard: React.FC<InventoryDashboardProps> = ({ 
  locationId, 
  inventory, 
  transactions,
  onBack, 
  onLogout, 
  language,
  onTransfer,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onBulkDeleteItems,
  onBulkEditItems,
  onRecordUsage,
  userRole,
  userBranchCode,
  incomingTransfers,
  outgoingTransfers,
  outgoingApprovals,
  onReceiveTransfer,
  onRejectTransfer,
  onConfirmOutbound,
  availableLocations,
  getUserName,
  onRecordReceive
}) => {
  const { addToast } = useToast();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'inStock' | 'lowStock'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'quantity' | 'lastUpdated'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'compact'>('grid');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  
  const [itemToEdit, setItemToEdit] = useState<InventoryItem | null>(null);
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
  const [usageItem, setUsageItem] = useState<InventoryItem | null>(null);

  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [receiveItem, setReceiveItem] = useState<InventoryItem | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean; itemId: string; itemName: string}>({isOpen: false, itemId: '', itemName: ''});

  // Dropdown states
  const [activeDropdown, setActiveDropdown] = useState<'view' | 'sort' | 'filter' | null>(null);

  // Grouped Notifications State
  const [selectedTransferGroup, setSelectedTransferGroup] = useState<string | null>(null);
  const [rejectionTarget, setRejectionTarget] = useState<Transaction[] | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [pdfTransferData, setPdfTransferData] = useState<{
      targetLocationId: string | null;
      items: { itemId: string; quantity: number }[];
  } | null>(null);

  useEffect(() => {
    const handleClickOutside = () => {
        setActiveActionId(null);
        setActiveDropdown(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const isGlobalView = locationId === 'all';
  const t = TRANSLATIONS[language];
  const locationData = availableLocations.find(l => l.id === locationId);
  const locationName = isGlobalView ? t.globalInventory : (locationId === 'warehouse' ? t.warehouse : locationId === 'mammal' ? t.mammal : (locationData ? (language === 'ar' ? (locationData.nameAr || locationData.name) : locationData.name) : locationId));
  const location = locationData || (isGlobalView ? { id: 'all', name: t.globalInventory, icon: 'globe' } : { id: locationId, name: locationId });

  const canEditItem = userRole === 'admin' || 
                      (userRole === 'branch_manager' && userBranchCode === locationId) ||
                      (userRole === 'warehouse_manager' && (locationId === 'warehouse' || locationId === 'mammal'));

  const canBulkEdit = userRole === 'admin' || (userRole === 'warehouse_manager' && (locationId === 'warehouse' || locationId === 'mammal'));

  const canRecordUsage = userRole === 'admin' || 
                         (userRole === 'branch_manager' && userBranchCode === locationId) ||
                         (userRole === 'warehouse_manager' && locationId === 'warehouse') ||
                         (userRole === 'mammal_employee' && locationId === 'mammal');

  const categories = useMemo(() => {
    const cats = new Set(inventory.map(item => item.category));
    return Array.from(cats).sort();
  }, [inventory]);

  const filteredItems = useMemo(() => {
    const filtered = inventory.filter(item => {
      const searchLower = search.toLowerCase();
      const itemName = language === 'ar' ? item.nameAr : item.nameEn;
      const matchesSearch = 
        itemName.toLowerCase().includes(searchLower) || 
        item.category.toLowerCase().includes(searchLower) ||
        (item.description && item.description.toLowerCase().includes(searchLower)) ||
        (item.locationId && item.locationId.toLowerCase().includes(searchLower)) ||
        (item.barcode && item.barcode.toLowerCase().includes(searchLower));
      
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const isLowStock = item.quantity <= item.minThreshold;
      const matchesStockStatus = stockStatusFilter === 'all' || (stockStatusFilter === 'lowStock' && isLowStock) || (stockStatusFilter === 'inStock' && !isLowStock);

      return matchesSearch && matchesCategory && matchesStockStatus;
    });

    return filtered.sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
            case 'name':
                const nameA = language === 'ar' ? a.nameAr : a.nameEn;
                const nameB = language === 'ar' ? b.nameAr : b.nameEn;
                comparison = nameA.localeCompare(nameB);
                break;
            case 'quantity':
                comparison = a.quantity - b.quantity;
                break;
            case 'lastUpdated':
                comparison = new Date(a.lastUpdated || 0).getTime() - new Date(b.lastUpdated || 0).getTime();
                break;
        }
        return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [inventory, search, selectedCategory, stockStatusFilter, language, sortBy, sortOrder]);

  const isExpiringSoon = (dateString?: string) => {
    if (!dateString) return false;
    const expDate = new Date(dateString);
    const today = new Date();
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30 && diffDays >= 0;
  };

  const isExpired = (dateString?: string) => {
    if (!dateString) return false;
    const expDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return expDate < today;
  };

  const lowStockItems = inventory.filter(item => item.quantity <= item.minThreshold);
  const groupedIncoming = useMemo(() => {
      const groups: Record<string, Transaction[]> = {};
      incomingTransfers.forEach(tx => {
          const gid = tx.transferGroupId || `UNGROUPED-${tx.date}`;
          if (!groups[gid]) groups[gid] = [];
          groups[gid].push(tx);
      });
      return Object.entries(groups).sort((a,b) => new Date(b[1][0].date).getTime() - new Date(a[1][0].date).getTime());
  }, [incomingTransfers]);

  const groupedOutgoing = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    outgoingTransfers.forEach(tx => {
        const gid = tx.transferGroupId || `UNGROUPED-${tx.date}`;
        if (!groups[gid]) groups[gid] = [];
        groups[gid].push(tx);
    });
    return Object.entries(groups).sort((a,b) => new Date(b[1][0].date).getTime() - new Date(a[1][0].date).getTime());
}, [outgoingTransfers]);

  const groupedApprovals = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    outgoingApprovals.forEach(tx => {
        const gid = tx.transferGroupId || `UNGROUPED-${tx.date}`;
        if (!groups[gid]) groups[gid] = [];
        groups[gid].push(tx);
    });
    return Object.entries(groups).sort((a,b) => new Date(b[1][0].date).getTime() - new Date(a[1][0].date).getTime());
  }, [outgoingApprovals]);

  const handleReject = () => {
      if (rejectionTarget && rejectionReason.trim()) {
          if (Array.isArray(rejectionTarget)) {
              rejectionTarget.forEach(tx => onRejectTransfer(tx, rejectionReason));
          } else {
              onRejectTransfer(rejectionTarget, rejectionReason);
          }
          setRejectionTarget(null);
          setRejectionReason('');
      }
  };

  const handleBulkAccept = async (groupId: string) => {
      const group = groupedIncoming.find(g => g[0] === groupId);
      if (group) {
          for (const tx of group[1]) {
              await onReceiveTransfer(tx);
          }
      }
  };

  const handleDownloadTransfer = (groupId: string, type: 'incoming' | 'outgoing') => {
    const group = (type === 'incoming' ? groupedIncoming : groupedOutgoing).find(g => g[0] === groupId);
    if (group) {
      const tx = group[1][0];
      const fromLoc = availableLocations.find(l => l.id === tx.fromLocation);
      const toLoc = availableLocations.find(l => l.id === tx.toLocation);
      const fromLocationName = fromLoc ? (fromLoc.id === 'warehouse' ? t.warehouse : fromLoc.id === 'mammal' ? t.mammal : (language === 'ar' ? (fromLoc.nameAr || fromLoc.name) : fromLoc.name)) : (tx.fromLocation || '');
      const toLocationName = toLoc ? (toLoc.id === 'warehouse' ? t.warehouse : toLoc.id === 'mammal' ? t.mammal : (language === 'ar' ? (toLoc.nameAr || toLoc.name) : toLoc.name)) : (tx.toLocation || '');
      
      const translatedTransactions = group[1].map(t => ({
        ...t,
        performedBy: getUserName ? getUserName(t.performedBy) : t.performedBy
      }));
      
      exportTransferPDF(translatedTransactions, language, fromLocationName, toLocationName);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItemIds.size === filteredItems.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(filteredItems.map(i => i.id)));
    }
  };

  const handleBulkDelete = () => {
    if (window.confirm(t.confirmDelete)) {
      onBulkDeleteItems(locationId, Array.from(selectedItemIds));
      setSelectedItemIds(new Set());
    }
  };

  const handleBulkTransfer = () => {
    const selectedItemsData = Array.from(selectedItemIds).map(id => {
      return {
        itemId: id,
        quantity: 0
      };
    });
    
    setPdfTransferData({
      targetLocationId: null,
      items: selectedItemsData
    });
    setIsTransferModalOpen(true);
  };

  const handleBulkEdit = () => {
    setIsBulkEditModalOpen(true);
  };

  const handleBulkEditSave = (updates: Partial<InventoryItem>) => {
    onBulkEditItems(locationId, Array.from(selectedItemIds), updates);
    setSelectedItemIds(new Set());
  };

  const handleTransferSubmit = async (transferItems: { itemId: string, quantity: number }[], toLocation: LocationId, sourceOverride?: LocationId) => {
    await onTransfer(transferItems, toLocation, sourceOverride);
    setSelectedItemIds(new Set());
    setPdfTransferData(null);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessingPdf(true);
    try {
        const text = await extractTextFromPDF(file);
        const data = await parseTransferDocument(text, inventory, availableLocations);
        setPdfTransferData(data);
        setIsTransferModalOpen(true);
    } catch (error) {
        console.error("PDF Error", error);
        addToast('error', t.matchError);
    } finally {
        setIsProcessingPdf(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col transition-colors pb-24 ${language === 'ar' ? 'font-arabic' : ''}`}>
      <div className={`flex-1 flex flex-col transition-all duration-300 ${isAssistantOpen ? 'lg:mr-96 lg:rtl:mr-0 lg:rtl:ml-96' : ''}`}>
        
        <InventoryHeader 
          onBack={onBack}
          locationName={locationName}
          isGlobalView={isGlobalView}
          t={t}
          isAssistantOpen={isAssistantOpen}
          setIsAssistantOpen={setIsAssistantOpen}
          onLogout={onLogout}
        />

        <main className="p-4 sm:p-6 max-w-7xl mx-auto w-full">

          {/* Enhanced Notification Center */}
          <InventoryNotifications 
            t={t}
            groupedIncoming={groupedIncoming}
            groupedApprovals={groupedApprovals}
            handleDownloadTransfer={handleDownloadTransfer}
            setSelectedTransferGroup={setSelectedTransferGroup}
            handleBulkAccept={handleBulkAccept}
            setRejectionTarget={setRejectionTarget}
            onConfirmOutbound={onConfirmOutbound}
          />

          {/* Action & Filter Bar */}
          <InventoryToolbar 
            t={t}
            search={search}
            setSearch={setSearch}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            categories={categories}
            stockStatusFilter={stockStatusFilter}
            setStockStatusFilter={setStockStatusFilter}
            sortBy={sortBy}
            setSortBy={setSortBy}
            sortOrder={sortOrder}
            setSortOrder={setSortOrder}
            viewMode={viewMode}
            setViewMode={setViewMode}
            isGlobalView={isGlobalView}
            selectedItemIds={selectedItemIds}
            toggleSelectAll={toggleSelectAll}
            filteredItemsCount={filteredItems.length}
            onExportExcel={() => exportInventoryExcel(filteredItems, locationId, language)}
            onSmartUpload={() => fileInputRef.current?.click()}
            onOpenTransfer={() => setIsTransferModalOpen(true)}
            onAddItem={() => { setItemToEdit(null); setIsAddItemModalOpen(true); }}
            canEditItem={canEditItem}
            isProcessingPdf={isProcessingPdf}
            activeDropdown={activeDropdown}
            setActiveDropdown={setActiveDropdown}
            lowStockCount={lowStockItems.length}
            language={language}
          />

          {/* Inventory Container */}
          <InventoryGrid 
            filteredItems={filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize)}
            viewMode={viewMode}
            language={language}
            isGlobalView={isGlobalView}
            selectedItemIds={selectedItemIds}
            toggleItemSelection={toggleItemSelection}
            canEditItem={canEditItem}
            canRecordUsage={canRecordUsage}
            activeActionId={activeActionId}
            setActiveActionId={setActiveActionId}
            t={t}
            onEditItem={(item) => { setItemToEdit(item); setIsAddItemModalOpen(true); }}
            onRecordUsage={(item) => { setUsageItem(item); setIsUsageModalOpen(true); }}
            onRecordReceive={(item) => { setReceiveItem(item); setIsReceiveModalOpen(true); }}
            onViewHistory={(item) => { setHistoryItem(item); setIsHistoryModalOpen(true); }}
            onDeleteItem={(item) => setDeleteConfirm({isOpen: true, itemId: item.id, itemName: language === 'ar' ? item.nameAr : item.nameEn})}
            isExpiringSoon={isExpiringSoon}
            isExpired={isExpired}
          />
          
          {filteredItems.length === 0 && (
             <div className="text-center py-20">
                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                   <Package className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t.noItemsFound}</h3>
                <p className="text-gray-500 dark:text-gray-400">{t.tryAdjustingFilters}</p>
             </div>
          )}

          {/* Pagination */}
          {filteredItems.length > 0 && (
              <div className="mt-6 mb-12">
                  <Pagination 
                      currentPage={currentPage}
                      pageSize={pageSize}
                      totalItems={filteredItems.length}
                      onPageChange={setCurrentPage}
                      onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
                      language={language}
                  />
              </div>
          )}

        </main>
      </div>

      {/* Bulk Actions Bar */}
          <BulkActionsBar 
            t={t}
            selectedCount={selectedItemIds.size}
            canBulkEdit={canBulkEdit}
            onBulkEdit={handleBulkEdit}
            onBulkDelete={handleBulkDelete}
            onBulkTransfer={handleBulkTransfer}
            onClearSelection={() => setSelectedItemIds(new Set())}
          />

      <SmartAssistant 
        locationName={locationName}
        items={inventory}
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        language={language}
      />

      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => { setIsTransferModalOpen(false); setPdfTransferData(null); }}
        currentLocation={locationId}
        items={inventory}
        onTransfer={handleTransferSubmit}
        language={language}
        availableLocations={availableLocations}
        initialData={pdfTransferData}
      />

      <AddItemModal 
        isOpen={isAddItemModalOpen}
        onClose={() => setIsAddItemModalOpen(false)}
        onSubmit={(item) => {
          if (itemToEdit) {
            onEditItem(locationId, { ...itemToEdit, ...item });
          } else {
            onAddItem(locationId, item);
          }
        }}
        language={language}
        initialData={itemToEdit}
        existingItems={inventory}
      />

      <BulkEditModal 
        isOpen={isBulkEditModalOpen}
        onClose={() => setIsBulkEditModalOpen(false)}
        selectedCount={selectedItemIds.size}
        onSave={handleBulkEditSave}
        language={language}
      />

      <ItemHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        item={historyItem}
        transactions={transactions}
        language={language}
        getUserName={getUserName}
        availableLocations={availableLocations}
      />

      <UsageModal
        isOpen={isUsageModalOpen}
        onClose={() => setIsUsageModalOpen(false)}
        item={usageItem}
        onConfirm={(qty, notes) => onRecordUsage(usageItem!.id, qty, notes)}
        language={language}
      />

      <ReceiveModal
        isOpen={isReceiveModalOpen}
        onClose={() => setIsReceiveModalOpen(false)}
        item={receiveItem}
        onConfirm={(qty, notes) => {
            if (onRecordReceive && receiveItem) {
                onRecordReceive(receiveItem.id, qty, notes);
            }
        }}
        language={language}
      />

      <ConfirmationModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({isOpen: false, itemId: '', itemName: ''})}
        onConfirm={() => { onDeleteItem(locationId, deleteConfirm.itemId); setDeleteConfirm({isOpen: false, itemId: '', itemName: ''}); }}
        title={t.confirmDeleteTitle}
        message={`${t.confirmDeleteItem}: "${deleteConfirm.itemName}"?`}
        language={language}
        danger={true}
      />

      {/* Rejection Modal */}
      {rejectionTarget && (
         <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
               <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{t.rejectionReason}</h3>
               <textarea 
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl mb-4 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500"
                  placeholder={t.rejectionPlaceholder}
                  rows={3}
               />
               <div className="flex gap-3">
                  <button onClick={() => setRejectionTarget(null)} className="flex-1 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium">{t.cancel}</button>
                  <button onClick={handleReject} disabled={!rejectionReason.trim()} className="flex-1 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 disabled:opacity-50">{t.reject}</button>
               </div>
            </div>
         </div>
      )}

      {/* View Items Modal for Transfer Group */}
      {selectedTransferGroup && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[80vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t.transferDetails}</h3>
                      <button onClick={() => setSelectedTransferGroup(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                          <XCircle className="w-6 h-6 text-gray-500" />
                      </button>
                  </div>
                  <div className="space-y-3">
                      {(() => {
                          const group = [...groupedIncoming, ...groupedApprovals, ...groupedOutgoing].find(g => g[0] === selectedTransferGroup);
                          return (group?.[1] || []).map(tx => (
                              <div key={tx.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                                  <span className="font-medium text-gray-900 dark:text-white">{language === 'ar' ? tx.itemNameAr : tx.itemNameEn}</span>
                                  <span className="font-bold text-brand-600 dark:text-brand-400">{tx.quantity} {tx.unit}</span>
                              </div>
                          ));
                      })()}
                  </div>
                  <div className="mt-6 flex gap-3">
                      {groupedIncoming.some(g => g[0] === selectedTransferGroup) && (
                          <>
                              <button 
                                onClick={() => {
                                    const group = groupedIncoming.find(g => g[0] === selectedTransferGroup);
                                    if (group) setRejectionTarget(group[1]);
                                    setSelectedTransferGroup(null);
                                }} 
                                className="flex-1 py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors"
                              >
                                {t.reject}
                              </button>
                              <button 
                                onClick={() => {
                                    handleBulkAccept(selectedTransferGroup);
                                    setSelectedTransferGroup(null);
                                }} 
                                className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors"
                              >
                                {t.accept}
                              </button>
                          </>
                      )}
                      {groupedApprovals.some(g => g[0] === selectedTransferGroup) && (
                          <button 
                            onClick={() => {
                                const group = groupedApprovals.find(g => g[0] === selectedTransferGroup);
                                if (group) group[1].forEach(tx => onConfirmOutbound(tx));
                                setSelectedTransferGroup(null);
                            }} 
                            className="flex-1 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors"
                          >
                            {t.confirmOutbound}
                          </button>
                      )}
                      {!groupedIncoming.some(g => g[0] === selectedTransferGroup) && !groupedApprovals.some(g => g[0] === selectedTransferGroup) && (
                          <button 
                            onClick={() => setSelectedTransferGroup(null)} 
                            className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                          >
                            {t.cancel}
                          </button>
                      )}
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default InventoryDashboard;