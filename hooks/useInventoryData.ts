import { useCallback } from 'react';
import { InventoryItem, Transaction, TransactionType, LocationId, User, Language } from '../types';
import { useInventoryQuery, useTransactionsQuery } from './useQueries';
import { useInventoryMutations } from './useMutations';

interface UseInventoryDataProps {
  currentUser: User | null;
  selectedLocation: string | null;
  language: Language;
  addToast: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

export const useInventoryData = ({ currentUser, selectedLocation, language, addToast }: UseInventoryDataProps) => {
  const { data: inventoryData } = useInventoryQuery();
  const inventory = inventoryData || {};
  const { data: transactions } = useTransactionsQuery();

  const {
    addItemMutation,
    editItemMutation,
    deleteItemMutation,
    bulkEditItemsMutation,
    transferMutation,
    confirmSourceTransferMutation,
    receiveTransferMutation,
    rejectTransferMutation,
    dailyLogMutation,
    cleanUpTransactionsMutation,
    receiveTransferGroupMutation,
    rejectTransferGroupMutation,
    confirmTransferGroupMutation,
    autoRejectExpiredMutation,
    markNotificationAsReadMutation,
    markAllNotificationsAsReadMutation,
    addSupplierMutation,
    editSupplierMutation,
    deleteSupplierMutation,
    createPurchaseOrderMutation,
    updatePurchaseOrderStatusMutation,
    receivePurchaseOrderMutation,
    scheduleAuditMutation,
    saveAuditCountsMutation,
    submitAuditMutation,
    applyAuditMutation
  } = useInventoryMutations({ language, addToast });

  const handleCleanUpTransactions = useCallback(async (months: number) => {
    cleanUpTransactionsMutation.mutate(months);
  }, [cleanUpTransactionsMutation]);

  const handleAddItem = useCallback(async (locationId: string, item: Omit<InventoryItem, 'id' | 'lastUpdated'>) => {
    if (currentUser?.role === 'branch_manager' && currentUser.branchCode !== locationId) return;
    if (currentUser?.role === 'warehouse_manager' && locationId !== 'warehouse' && locationId !== 'mammal') return;

    const nameEnTrimmed = item.nameEn.trim();
    const nameArTrimmed = item.nameAr.trim();

    const existing = (inventory[locationId] || []).find(i => 
        i.nameEn.toLowerCase().trim() === nameEnTrimmed.toLowerCase() || 
        i.nameAr.trim() === nameArTrimmed
    );
    if (existing) {
        addToast('error', language === 'ar' ? 'هذا المنتج موجود بالفعل في هذا الموقع' : 'This item already exists in this location');
        return;
    }

    addItemMutation.mutate({ locationId, item });
  }, [currentUser, inventory, addItemMutation, language, addToast]);

  const handleEditItem = useCallback(async (locationId: string, updatedItem: InventoryItem) => {
    if (currentUser?.role === 'branch_manager' && currentUser.branchCode !== locationId) return;
    if (currentUser?.role === 'warehouse_manager' && locationId !== 'warehouse' && locationId !== 'mammal') return;

    const nameEnTrimmed = updatedItem.nameEn.trim();
    const nameArTrimmed = updatedItem.nameAr.trim();

    const existing = (inventory[locationId] || []).find(i => 
        i.id !== updatedItem.id && (
            i.nameEn.toLowerCase().trim() === nameEnTrimmed.toLowerCase() || 
            i.nameAr.trim() === nameArTrimmed
        )
    );
    if (existing) {
        addToast('error', language === 'ar' ? 'هذا الاسم مستخدم بالفعل لمنتج آخر' : 'This name is already used by another item');
        return;
    }

    editItemMutation.mutate(updatedItem);
  }, [currentUser, inventory, editItemMutation, language, addToast]);

  const handleDeleteItem = useCallback(async (locationId: string, itemId: string) => {
     if (currentUser?.role === 'branch_manager' && currentUser.branchCode !== locationId && locationId !== 'all') return;
     if (currentUser?.role === 'warehouse_manager' && locationId !== 'warehouse' && locationId !== 'mammal' && locationId !== 'all') return;

     const itemIds = itemId.split(',').map(id => id.trim()).filter(Boolean);
     deleteItemMutation.mutate(itemIds);
  }, [currentUser, deleteItemMutation]);

  const handleBulkDeleteItems = useCallback(async (locationId: string, itemIds: string[]) => {
      if (currentUser?.role === 'branch_manager' && currentUser.branchCode !== locationId && locationId !== 'all') return;
      if (currentUser?.role === 'warehouse_manager' && locationId !== 'warehouse' && locationId !== 'mammal' && locationId !== 'all') return;

      const cleanedIds = itemIds.map(id => id.trim()).filter(Boolean);
      deleteItemMutation.mutate(cleanedIds);
  }, [currentUser, deleteItemMutation]);

  const handleBulkEditItems = useCallback(async (locationId: string, itemIds: string[], updates: Partial<InventoryItem>) => {
      const cleanedIds = itemIds.map(id => id.trim()).filter(Boolean);
      bulkEditItemsMutation.mutate({ itemIds: cleanedIds, updates });
  }, [bulkEditItemsMutation]);

  const handleTransfer = useCallback(async (items: { itemId: string, quantity: number }[], toLocation: LocationId, sourceOverride?: LocationId) => {
    if (!currentUser) return;
    
    const fromLocation = sourceOverride || selectedLocation;
    if (!fromLocation || fromLocation === 'all') return;

    const isManagerOfSource = 
        (currentUser.role === 'branch_manager' && currentUser.branchCode === fromLocation) ||
        (currentUser.role === 'warehouse_manager' && (fromLocation === 'warehouse' || fromLocation === 'mammal')) ||
        (currentUser.role === 'admin');

    const mappedItems = items.map(transferItem => {
      const sourceItem = (inventory[fromLocation] || []).find(i => i.id === transferItem.itemId);
      return {
        itemId: transferItem.itemId,
        itemNameEn: sourceItem?.nameEn || '',
        itemNameAr: sourceItem?.nameAr || '',
        quantity: transferItem.quantity,
        unit: sourceItem?.unit || 'pcs'
      };
    }).filter(i => i.itemNameEn !== '');

    if (mappedItems.length === 0) return;

    transferMutation.mutate({
      items: mappedItems,
      fromLocation,
      toLocation,
      performedBy: currentUser.name,
      isManagerOfSource
    });
  }, [currentUser, selectedLocation, inventory, transferMutation]);

  const handleConfirmSourceTransfer = useCallback(async (transaction: Transaction) => {
      if (!currentUser) return;
      confirmSourceTransferMutation.mutate(transaction.id);
  }, [currentUser, confirmSourceTransferMutation]);

  const handleReceiveTransfer = useCallback(async (transaction: Transaction) => {
      if (!currentUser) return;
      receiveTransferMutation.mutate(transaction.id);
  }, [currentUser, receiveTransferMutation]);

  const handleRejectTransfer = useCallback(async (transaction: Transaction, reason: string) => {
      if (!currentUser) return;
      rejectTransferMutation.mutate({ transactionId: transaction.id, reason });
  }, [currentUser, rejectTransferMutation]);

  const handleDailyLog = useCallback(async (type: TransactionType, itemId: string, quantity: number, notes: string) => {
      if (!currentUser || !selectedLocation || selectedLocation === 'all') return;
      
      dailyLogMutation.mutate({
        location: selectedLocation,
        performedBy: currentUser.name,
        logs: [{ type, itemId, quantity, notes }]
      });
  }, [currentUser, selectedLocation, dailyLogMutation]);

  const handleBulkLog = useCallback(async (logs: { type: TransactionType, itemId: string, quantity: number, notes: string }[]) => {
      if (!currentUser || !selectedLocation || selectedLocation === 'all') return;
      
      dailyLogMutation.mutate({
        location: selectedLocation,
        performedBy: currentUser.name,
        logs
      });
  }, [currentUser, selectedLocation, dailyLogMutation]);

  const handleReceiveTransferGroup = useCallback(async (
    transferGroupId: string, 
    items: { transactionId: string, receivedQuantity: number, itemStatus: string, receiptNotes: string, photoUrls?: string[] }[],
    signatureUrl?: string
  ) => {
    if (!currentUser) return;
    receiveTransferGroupMutation.mutate({ transferGroupId, items, signatureUrl });
  }, [currentUser, receiveTransferGroupMutation]);

  const handleRejectTransferGroup = useCallback(async (transferGroupId: string, reason: string) => {
    if (!currentUser) return;
    rejectTransferGroupMutation.mutate({ transferGroupId, reason });
  }, [currentUser, rejectTransferGroupMutation]);

  const handleConfirmTransferGroup = useCallback(async (transferGroupId: string) => {
    if (!currentUser) return;
    confirmTransferGroupMutation.mutate(transferGroupId);
  }, [currentUser, confirmTransferGroupMutation]);

  const handleAutoRejectExpired = useCallback(async (days: number) => {
    autoRejectExpiredMutation.mutate(days);
  }, [autoRejectExpiredMutation]);

  const handleMarkNotificationAsRead = useCallback(async (notificationId: string) => {
    markNotificationAsReadMutation.mutate(notificationId);
  }, [markNotificationAsReadMutation]);

  const handleMarkAllNotificationsAsRead = useCallback(async () => {
    if (selectedLocation && selectedLocation !== 'all') {
      markAllNotificationsAsReadMutation.mutate(selectedLocation);
    }
  }, [selectedLocation, markAllNotificationsAsReadMutation]);

  // Return a mock isMutating for backwards compatibility with anything expecting a ref
  const isMutating = { current: false };

  return {
    inventory,
    setInventory: () => {}, // No-op, managed by react-query
    transactions,
    setTransactions: () => {}, // No-op, managed by react-query
    isMutating,
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
    handleBulkLog,
    handleReceiveTransferGroup,
    handleRejectTransferGroup,
    handleConfirmTransferGroup,
    handleAutoRejectExpired,
    handleMarkNotificationAsRead,
    handleMarkAllNotificationsAsRead,
    
    // Phase 3 Mutations
    handleAddSupplier: (s: any) => addSupplierMutation.mutate(s),
    handleEditSupplier: (s: any) => editSupplierMutation.mutate(s),
    handleDeleteSupplier: (id: string) => deleteSupplierMutation.mutate(id),
    handleCreatePO: (po: any, items: any[]) => createPurchaseOrderMutation.mutate({ po, items }),
    handleUpdatePOStatus: (id: string, status: string) => updatePurchaseOrderStatusMutation.mutate({ id, status }),
    handleReceivePO: (poId: string, items: any[], performedBy: string) => receivePurchaseOrderMutation.mutate({ poId, items, performedBy }),

    // Phase 4 Mutations
    handleScheduleAudit: (params: any) => scheduleAuditMutation.mutate(params),
    handleSaveAuditCounts: (items: any[]) => saveAuditCountsMutation.mutate({ items }),
    handleSubmitAudit: (id: string) => submitAuditMutation.mutate(id),
    handleApplyAudit: (auditId: string, performedBy: string) => applyAuditMutation.mutate({ auditId, performedBy })
  };
};
