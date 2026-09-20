  const queryClient = useQueryClient();
  const getAuditTarget = useCallback((auditId: string) => {
    const audits = queryClient.getQueryData(['audits']) as any[];
    return audits?.find(a => a.id === auditId)?.locationId || selectedLocation || '';
  }, [queryClient, selectedLocation]);

import { useCallback } from 'react';
import { InventoryItem, Transaction, TransactionType, LocationId, User, Language, AppNotification, PurchaseOrder } from '../types';
import { useInventoryQuery, useTransactionsQuery, usePurchaseOrdersQuery } from './useQueries';
import { useQueryClient } from '@tanstack/react-query';
import { useInventoryMutations } from './useMutations';
import { canWriteLocation, isAdmin, readOnlyMessage, subjectFrom } from '../services/permissions';

interface UseInventoryDataProps {
  currentUser: User | null;
  selectedLocation: string | null;
  language: Language;
  alerts: AppNotification[];
  addToast: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

export const useInventoryData = ({ currentUser, selectedLocation, language, alerts, addToast }: UseInventoryDataProps) => {
  /**
   * Every write goes through this.
   *
   * The previous guards only compared `branch_code`, so a branch manager who had
   * been granted full access to another branch was silently blocked, and a branch
   * marked read-only for them was still writable. Both are now decided by
   * services/permissions.ts, and a refusal tells the user why instead of quietly
   * doing nothing.
   */
  const guardWrite = useCallback(
    (locationId: string): boolean => {
      if (canWriteLocation(subjectFrom(currentUser), locationId)) return true;
      addToast('error', readOnlyMessage(language));
      return false;
    },
    [currentUser, language, addToast]
  );
  const { data: inventoryData } = useInventoryQuery();
  const inventory = inventoryData || {};
  const { data: transactions } = useTransactionsQuery();
  // Purchase orders are only used here to answer "which location does this order
  // belong to?", so writes to a PO follow the same rule as writes to stock.
  const { data: purchaseOrders = [] } = usePurchaseOrdersQuery();

  const poLocation = useCallback(
    (poId: string): string =>
      (purchaseOrders as PurchaseOrder[]).find((po) => po.id === poId)?.locationId || '',
    [purchaseOrders]
  );

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
    editPurchaseOrderMutation,
    updatePurchaseOrderStatusMutation,
    receivePurchaseOrderMutation,
    scheduleAuditMutation,
    saveAuditCountsMutation,
    submitAuditMutation,
    applyAuditMutation,
    deleteAuditMutation
  } = useInventoryMutations({ language, addToast });

  const handleCleanUpTransactions = useCallback(async (months: number) => {
    // Permanently deletes transaction history, so it is not a branch action.
    if (!isAdmin(subjectFrom(currentUser))) {
      addToast('error', language === 'ar' ? 'تنظيف السجلات متاح للمدير فقط.' : 'Only an administrator can clean up transaction logs.');
      return;
    }
    cleanUpTransactionsMutation.mutate(months);
  }, [cleanUpTransactionsMutation, currentUser, language, addToast]);

  const handleAddItem = useCallback(async (locationId: string, item: Omit<InventoryItem, 'id' | 'lastUpdated'>) => {
    if (!guardWrite(locationId)) return;

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
    if (!guardWrite(locationId)) return;

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
     if (!guardWrite(locationId)) return;

     const itemIds = itemId.split(',').map(id => id.trim()).filter(Boolean);
     deleteItemMutation.mutate(itemIds);
  }, [guardWrite, deleteItemMutation]);

  const handleBulkDeleteItems = useCallback(async (locationId: string, itemIds: string[]) => {
      if (!guardWrite(locationId)) return;

      const cleanedIds = itemIds.map(id => id.trim()).filter(Boolean);
      deleteItemMutation.mutate(cleanedIds);
  }, [guardWrite, deleteItemMutation]);

  const handleBulkEditItems = useCallback(async (locationId: string, itemIds: string[], updates: Partial<InventoryItem>) => {
      // Bulk edit previously had no permission check at all.
      if (!guardWrite(locationId)) return;
      const cleanedIds = itemIds.map(id => id.trim()).filter(Boolean);
      bulkEditItemsMutation.mutate({ itemIds: cleanedIds, updates });
  }, [guardWrite, bulkEditItemsMutation]);

  const handleTransfer = useCallback(async (items: { itemId: string, quantity: number }[], toLocation: LocationId, sourceOverride?: LocationId) => {
    if (!currentUser) return;
    
    const fromLocation = sourceOverride || selectedLocation;
    if (!fromLocation || fromLocation === 'all') return;

    // Shipping stock out of a branch requires write access to that branch.
    if (!guardWrite(fromLocation)) return;

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
  }, [currentUser, selectedLocation, inventory, transferMutation, guardWrite]);

  /**
   * The location a transfer touches, for permission purposes.
   *
   * Shipping stock out moves the SOURCE branch's numbers; receiving moves the
   * DESTINATION's. Both are writes to that branch, so both need write access there.
   */
  const sourceOf = (transaction: Transaction) => transaction.fromLocation || '';
  const destinationOf = (transaction: Transaction) => transaction.toLocation || transaction.fromLocation || '';

  const handleConfirmSourceTransfer = useCallback(async (transaction: Transaction) => {
      if (!currentUser) return;
      if (!guardWrite(sourceOf(transaction))) return;
      confirmSourceTransferMutation.mutate(transaction.id);
  }, [currentUser, confirmSourceTransferMutation, guardWrite]);

  const handleReceiveTransfer = useCallback(async (transaction: Transaction) => {
      if (!currentUser) return;
      // Receiving credits the destination branch, so it needs write access there.
      if (!guardWrite(destinationOf(transaction))) return;
      // Full receipt of the transferred quantity unless a partial quantity was already recorded
      receiveTransferMutation.mutate({
        transactionId: transaction.id,
        receivedQuantity: transaction.receivedQuantity ?? transaction.quantity,
        notes: transaction.receiptNotes ?? ''
      });
  }, [currentUser, receiveTransferMutation, guardWrite]);

  const handleRejectTransfer = useCallback(async (transaction: Transaction, reason: string) => {
      if (!currentUser) return;
      if (!guardWrite(destinationOf(transaction))) return;
      rejectTransferMutation.mutate({ transactionId: transaction.id, reason });
  }, [currentUser, rejectTransferMutation, guardWrite]);

  const handleDailyLog = useCallback(async (type: TransactionType, itemId: string, quantity: number, notes: string) => {
      if (!currentUser || !selectedLocation || selectedLocation === 'all') return;
      if (!guardWrite(selectedLocation)) return;
      
      dailyLogMutation.mutate({
        location: selectedLocation,
        performedBy: currentUser.name,
        logs: [{ type, itemId, quantity, notes }]
      });
  }, [currentUser, selectedLocation, dailyLogMutation, guardWrite]);

  const handleBulkLog = useCallback(async (logs: { type: TransactionType, itemId: string, quantity: number, notes: string }[]) => {
      if (!currentUser || !selectedLocation || selectedLocation === 'all') return;
      if (!guardWrite(selectedLocation)) return;
      
      dailyLogMutation.mutate({
        location: selectedLocation,
        performedBy: currentUser.name,
        logs
      });
  }, [currentUser, selectedLocation, dailyLogMutation, guardWrite]);

  const handleReceiveTransferGroup = useCallback(async (
    transferGroupId: string, 
    items: { transactionId: string, receivedQuantity: number, itemStatus: string, receiptNotes: string, photoUrls?: string[] }[],
    signatureUrl?: string
  ) => {
    if (!currentUser) return;
    // Group operations only carry an id, so the acting location is the one being
    // viewed. These are reached from a single location's list, never from the
    // combined view.
    if (!guardWrite(selectedLocation || '')) return;
    receiveTransferGroupMutation.mutate({ transferGroupId, items, signatureUrl });
  }, [currentUser, receiveTransferGroupMutation, guardWrite, selectedLocation]);

  const handleRejectTransferGroup = useCallback(async (transferGroupId: string, reason: string) => {
    if (!currentUser) return;
    if (!guardWrite(selectedLocation || '')) return;
    rejectTransferGroupMutation.mutate({ transferGroupId, reason });
  }, [currentUser, rejectTransferGroupMutation, guardWrite, selectedLocation]);

  const handleConfirmTransferGroup = useCallback(async (transferGroupId: string) => {
    if (!currentUser) return;
    if (!guardWrite(selectedLocation || '')) return;
    confirmTransferGroupMutation.mutate(transferGroupId);
  }, [currentUser, confirmTransferGroupMutation, guardWrite, selectedLocation]);

  const handleAutoRejectExpired = useCallback(async (days: number) => {
    // Sweeps every branch's pending transfers, so it is not a branch action.
    if (!isAdmin(subjectFrom(currentUser))) {
      addToast('error', language === 'ar' ? 'الرفض التلقائي متاح للمدير فقط.' : 'Only an administrator can run auto-reject.');
      return;
    }
    autoRejectExpiredMutation.mutate(days);
  }, [autoRejectExpiredMutation, currentUser, language, addToast]);

  const handleMarkNotificationAsRead = useCallback(async (notificationId: string) => {
    markNotificationAsReadMutation.mutate(notificationId);
  }, [markNotificationAsReadMutation]);

  const handleMarkAllNotificationsAsRead = useCallback(async () => {
    const unreadIds = alerts.filter(a => !a.isRead).map(a => a.id);
    if (unreadIds.length > 0) {
      markAllNotificationsAsReadMutation.mutate(unreadIds);
    }
  }, [alerts, markAllNotificationsAsReadMutation]);

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
    // Suppliers are shared master data: deleting one affects every branch, and
    // purchase orders reference it, so it stays an administrator action.
    handleDeleteSupplier: (id: string) => {
      if (!isAdmin(subjectFrom(currentUser))) {
        addToast('error', language === 'ar' ? 'حذف المورد متاح للمدير فقط.' : 'Only an administrator can delete a supplier.');
        return;
      }
      deleteSupplierMutation.mutate(id);
    },
    // A branch manager raises orders for their own shelf and approves them as part of
    // raising them, so their order is created approved. Enforced here rather than only
    // in the dialog, so no other code path can leave a branch order waiting for an
    // approver who does not exist in that flow. The admin and warehouse flows keep
    // draft / submit for approval.
    handleCreatePO: (po: any, items: any[]) => {
      const isBranchOrder = currentUser?.role === 'branch_manager';
      createPurchaseOrderMutation.mutate({
        po: { ...po, status: isBranchOrder ? 'approved' : po.status },
        items,
      });
    },
    handleEditPO: (id: string, po: any, items: any[]) => editPurchaseOrderMutation.mutate({ id, po, items }),
    // Approving, cancelling or receiving a purchase order writes the branch the
    // order is delivered to. The admin screen reached by a warehouse manager had no
    // check here, so a branch order could be received into a branch they may only
    // read. The branch screen guards the same path in InventoryDashboard.
    handleUpdatePOStatus: (id: string, status: string) => {
      if (!guardWrite(poLocation(id))) return;
      updatePurchaseOrderStatusMutation.mutate({ id, status });
    },
    handleReceivePO: (poId: string, items: any[], performedBy: string) => {
      if (!guardWrite(poLocation(poId))) return;
      receivePurchaseOrderMutation.mutate({ poId, items, performedBy });
    },

    // Phase 4 Mutations.
    // Audits move stock (apply_audit_variances) and delete records, and none of these
    // were permission-checked, so a read-only branch could run a count and post the
    // variances. They are scoped to the location being viewed, which is where the
    // audit list is filtered from.
    handleScheduleAudit: (params: any) => {
      const target = params?.locationId || params?.location_id || selectedLocation || '';
      if (!guardWrite(target)) return;
      scheduleAuditMutation.mutate(params);
    },
    handleSaveAuditCounts: (auditId: string, items: any[]) => {
        if (!guardWrite(getAuditTarget(auditId))) return;
      saveAuditCountsMutation.mutate({ items });
    },
    handleSubmitAudit: (id: string) => {
        if (!guardWrite(getAuditTarget(id))) return;
      submitAuditMutation.mutate(id);
    },
    handleApplyAudit: (auditId: string, performedBy: string) => {
        if (!guardWrite(getAuditTarget(auditId))) return;
      applyAuditMutation.mutate({ auditId, performedBy });
    },
    handleDeleteAudit: (auditId: string) => {
        // Deleting an audit destroys the record of a count, so it stays admin-only.
        if (!canWriteLocation(subjectFrom(currentUser), getAuditTarget(auditId))) return;
      if (!isAdmin(subjectFrom(currentUser))) {
        addToast('error', language === 'ar' ? 'حذف الجرد متاح للمدير فقط.' : 'Only an administrator can delete an audit.');
        return;
      }
      deleteAuditMutation.mutate(auditId);
    }
  };
};
