import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { InventoryItem, Transaction, TransactionType, LocationId, Language, Supplier, PurchaseOrder, PurchaseOrderItem, Audit, AuditItem } from '../types';
import { generateId } from '../constants';

interface MutationProps {
  language: Language;
  addToast: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

export const useInventoryMutations = ({ language, addToast }: MutationProps) => {
  const queryClient = useQueryClient();

  const addItemMutation = useMutation({
    mutationFn: async ({ locationId, item }: { locationId: string, item: Omit<InventoryItem, 'id' | 'lastUpdated'> }) => {
      const tempId = generateId();
      const { data, error } = await supabase.rpc('execute_add_item', {
        p_location_id: locationId,
        p_name_en: item.nameEn,
        p_name_ar: item.nameAr,
        p_description: item.description,
        p_category: item.category,
        p_quantity: item.quantity,
        p_unit: item.unit,
        p_min_threshold: item.minThreshold,
        p_expiration_date: item.expirationDate || null,
        p_barcode: item.barcode || null
      });

      if (error) throw error;
      return { data: [data], locationId, tempId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (error: any) => {
      console.error("Error adding item:", error);
      addToast('error', language === 'ar' ? 'فشل إضافة العنصر' : `Failed to add item: ${error.message || 'Unknown error'}`);
    }
  });

  const editItemMutation = useMutation({
    mutationFn: async (updatedItem: InventoryItem) => {
      const { error } = await supabase.rpc('execute_edit_item', {
        p_id: updatedItem.id,
        p_name_en: updatedItem.nameEn,
        p_name_ar: updatedItem.nameAr,
        p_description: updatedItem.description,
        p_category: updatedItem.category,
        p_quantity: updatedItem.quantity,
        p_unit: updatedItem.unit,
        p_min_threshold: updatedItem.minThreshold,
        p_expiration_date: updatedItem.expirationDate || null,
        p_barcode: updatedItem.barcode || null
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (error: any) => {
      console.error("Error editing item:", error);
      addToast('error', language === 'ar' ? 'فشل تعديل العنصر' : `Failed to update item: ${error.message || 'Unknown error'}`);
    }
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemIds: string[]) => {
      const { error } = await supabase.rpc('execute_delete_items', { p_item_ids: itemIds });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      addToast('success', language === 'ar' ? 'تم الحذف بنجاح' : 'Deleted successfully');
    },
    onError: (error: any) => {
      console.error("Error deleting item:", error);
      addToast('error', language === 'ar' ? `فشل الحذف: ${error.message}` : `Deletion failed: ${error.message}`);
    }
  });

  const bulkEditItemsMutation = useMutation({
    mutationFn: async ({ itemIds, updates }: { itemIds: string[], updates: Partial<InventoryItem> }) => {
      const dbUpdates: any = {};
      if (updates.category) dbUpdates.category = updates.category;
      if (updates.unit) dbUpdates.unit = updates.unit;
      if (updates.minThreshold !== undefined) dbUpdates.min_threshold = updates.minThreshold;

      if (Object.keys(dbUpdates).length === 0) return;

      const chunkSize = 50;
      for (let i = 0; i < itemIds.length; i += chunkSize) {
        const chunk = itemIds.slice(i, i + chunkSize);
        const { error } = await supabase.rpc('execute_bulk_edit_items', {
          p_item_ids: chunk,
          p_updates: dbUpdates
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (error: any) => {
      console.error("Error in bulk edit:", error);
      addToast('error', language === 'ar' ? `فشل التعديل الجماعي: ${error.message}` : `Bulk update failed: ${error.message}`);
    }
  });

  const transferMutation = useMutation({
    mutationFn: async ({ items, fromLocation, toLocation, performedBy, isManagerOfSource }: {
      items: { itemId: string, itemNameEn: string, itemNameAr: string, quantity: number, unit: string }[],
      fromLocation: string,
      toLocation: string,
      performedBy: string,
      isManagerOfSource: boolean
    }) => {
      // Use the newly created RPC
      const { error } = await supabase.rpc('execute_transfer', {
        p_from_location: fromLocation,
        p_to_location: toLocation,
        p_performed_by: performedBy,
        p_is_manager_of_source: isManagerOfSource,
        p_items: items
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      addToast('success', language === 'ar' ? 'تم بدء النقل بنجاح' : 'Transfer initiated successfully');
    },
    onError: (error: any) => {
      console.error("Transfer failed", error);
      addToast('error', language === 'ar' ? 'فشل النقل. يرجى التحقق من اتصالك.' : 'Transfer failed. Please check your connection.');
    }
  });

  const confirmSourceTransferMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      const { error } = await supabase.rpc('confirm_source_transfer', { p_transaction_id: transactionId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (error: any) => {
      console.error("Confirm transfer failed", error);
    }
  });

  const receiveTransferMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      const { error } = await supabase.rpc('receive_transfer', { p_transaction_id: transactionId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (error: any) => {
      console.error("Receive transfer failed", error);
      addToast('error', language === 'ar' ? 'حدث خطأ أثناء استلام المخزون' : 'An error occurred while receiving inventory');
    }
  });

  const rejectTransferMutation = useMutation({
    mutationFn: async ({ transactionId, reason }: { transactionId: string, reason: string }) => {
      const { error } = await supabase.rpc('reject_transfer', { p_transaction_id: transactionId, p_reason: reason });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (error: any) => {
      console.error("Reject transfer failed", error);
      addToast('error', language === 'ar' ? 'حدث خطأ أثناء رفض النقل' : 'An error occurred while rejecting transfer');
    }
  });

  const dailyLogMutation = useMutation({
    mutationFn: async ({ location, performedBy, logs }: {
      location: string,
      performedBy: string,
      logs: { type: TransactionType, itemId: string, quantity: number, notes: string }[]
    }) => {
      const { error } = await supabase.rpc('execute_daily_log', {
        p_location: location,
        p_performed_by: performedBy,
        p_logs: logs
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      addToast('success', language === 'ar' ? 'تم تسجيل العملية بنجاح' : 'Log recorded successfully');
    },
    onError: (error: any) => {
      console.error("Log failed", error);
      addToast('error', language === 'ar' ? 'حدث خطأ أثناء تسجيل العملية' : 'An error occurred while recording log');
    }
  });

  const cleanUpTransactionsMutation = useMutation({
    mutationFn: async (months: number) => {
      if (months === 0) return;
      const { error } = await supabase.rpc('execute_cleanup_transactions', { p_months: months });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    }
  });

  // === NEW GROUP-LEVEL TRANSFER MUTATIONS ===

  const receiveTransferGroupMutation = useMutation({
    mutationFn: async ({ transferGroupId, items, signatureUrl }: {
      transferGroupId: string,
      items: { transactionId: string, receivedQuantity: number, itemStatus: string, receiptNotes: string, photoUrls?: string[] }[],
      signatureUrl?: string
    }) => {
      const { error } = await supabase.rpc('receive_transfer_group', {
        p_transfer_group_id: transferGroupId,
        p_items: items.map(i => ({
          transactionId: i.transactionId,
          receivedQuantity: i.receivedQuantity,
          itemStatus: i.itemStatus,
          receiptNotes: i.receiptNotes,
          photoUrls: i.photoUrls || []
        })),
        p_signature_url: signatureUrl || null
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      addToast('success', language === 'ar' ? 'تم استلام التحويل بنجاح' : 'Transfer received successfully');
    },
    onError: (error: any) => {
      console.error("Receive transfer group failed", error);
      addToast('error', language === 'ar' ? 'فشل استلام التحويل' : `Failed to receive transfer: ${error.message}`);
    }
  });

  const rejectTransferGroupMutation = useMutation({
    mutationFn: async ({ transferGroupId, reason }: { transferGroupId: string, reason: string }) => {
      const { error } = await supabase.rpc('reject_transfer_group', {
        p_transfer_group_id: transferGroupId,
        p_reason: reason
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      addToast('success', language === 'ar' ? 'تم رفض التحويل بنجاح' : 'Transfer rejected successfully');
    },
    onError: (error: any) => {
      console.error("Reject transfer group failed", error);
      addToast('error', language === 'ar' ? 'فشل رفض التحويل' : `Failed to reject transfer: ${error.message}`);
    }
  });

  const confirmTransferGroupMutation = useMutation({
    mutationFn: async (transferGroupId: string) => {
      const { error } = await supabase.rpc('confirm_transfer_group', {
        p_transfer_group_id: transferGroupId
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      addToast('success', language === 'ar' ? 'تمت الموافقة والشحن بنجاح' : 'Transfer approved & shipped');
    },
    onError: (error: any) => {
      console.error("Confirm transfer group failed", error);
      addToast('error', language === 'ar' ? 'فشلت الموافقة على التحويل' : `Failed to confirm transfer: ${error.message}`);
    }
  });

  const autoRejectExpiredMutation = useMutation({
    mutationFn: async (days: number) => {
      const { data, error } = await supabase.rpc('auto_reject_expired_transfers', { p_days: days });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count) => {
      if (count && count > 0) {
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        addToast('info', language === 'ar' ? `تم رفض ${count} تحويل(ات) منتهية تلقائياً` : `Auto-rejected ${count} expired transfer(s)`);
      }
    },
    onError: (error: any) => {
      console.error("Auto-reject failed", error);
    }
  });

  const markNotificationAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const markAllNotificationsAsReadMutation = useMutation({
    mutationFn: async (locationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('location_id', locationId)
        .eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const addSupplierMutation = useMutation({
    mutationFn: async (supplier: Omit<Supplier, 'id' | 'createdAt'>) => {
      const { data, error } = await supabase
        .from('suppliers')
        .insert({
          name_en: supplier.nameEn,
          name_ar: supplier.nameAr,
          contact_person: supplier.contactPerson,
          email: supplier.email,
          phone: supplier.phone,
          address: supplier.address
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      addToast('success', language === 'ar' ? 'تم إضافة المورد' : 'Supplier added successfully');
    },
    onError: (error: any) => {
      addToast('error', error.message);
    }
  });

  const editSupplierMutation = useMutation({
    mutationFn: async (supplier: Supplier) => {
      const { error } = await supabase
        .from('suppliers')
        .update({
          name_en: supplier.nameEn,
          name_ar: supplier.nameAr,
          contact_person: supplier.contactPerson,
          email: supplier.email,
          phone: supplier.phone,
          address: supplier.address
        })
        .eq('id', supplier.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      addToast('success', language === 'ar' ? 'تم تحديث المورد' : 'Supplier updated successfully');
    },
    onError: (error: any) => {
      addToast('error', error.message);
    }
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      addToast('success', language === 'ar' ? 'تم حذف المورد' : 'Supplier deleted');
    },
    onError: (error: any) => {
      addToast('error', error.message);
    }
  });

  const createPurchaseOrderMutation = useMutation({
    mutationFn: async (params: { po: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt' | 'poNumber' | 'status'> & { status?: string }, items: Omit<PurchaseOrderItem, 'id' | 'poId' | 'totalPrice'>[] }) => {
      // 1. Create PO
      const poNumber = `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      
      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          po_number: poNumber,
          supplier_id: params.po.supplierId,
          status: params.po.status || 'draft',
          expected_delivery: params.po.expectedDelivery || null,
          notes: params.po.notes,
          created_by: params.po.createdBy
        })
        .select()
        .single();
        
      if (poError) throw poError;

      // 2. Insert Items
      const itemsToInsert = params.items.map(item => ({
        po_id: poData.id,
        item_name_en: item.itemNameEn,
        item_name_ar: item.itemNameAr,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: item.quantity * item.unitPrice
      }));

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;
      
      return poData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      addToast('success', language === 'ar' ? 'تم إنشاء أمر الشراء' : 'Purchase order created');
    },
    onError: (error: any) => {
      addToast('error', error.message);
    }
  });

  const updatePurchaseOrderStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      addToast('success', language === 'ar' ? 'تم تحديث حالة الطلب' : 'Status updated');
    },
    onError: (error: any) => {
      addToast('error', error.message);
    }
  });

  const receivePurchaseOrderMutation = useMutation({
    mutationFn: async ({ poId, items, performedBy }: { poId: string, items: { id: string, received_quantity: number }[], performedBy: string }) => {
      const { error } = await supabase.rpc('receive_purchase_order', {
        p_po_id: poId,
        p_items: items,
        p_performed_by: performedBy
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      addToast('success', language === 'ar' ? 'تم استلام أمر الشراء بنجاح' : 'Purchase order received successfully');
    },
    onError: (error: any) => {
      addToast('error', error.message);
    }
  });

  const scheduleAuditMutation = useMutation({
    mutationFn: async ({ title, locationId, scheduledDate, createdBy, items }: { title: string, locationId: string, scheduledDate?: string, createdBy: string, items: Omit<AuditItem, 'id' | 'auditId' | 'variance'>[] }) => {
      // 1. Create Audit
      const { data: auditData, error: auditError } = await supabase
        .from('audits')
        .insert({
          title,
          location_id: locationId,
          status: 'scheduled',
          scheduled_date: scheduledDate || null,
          created_by: createdBy
        })
        .select()
        .single();
        
      if (auditError) throw auditError;

      // 2. Insert Items
      const itemsToInsert = items.map(item => ({
        audit_id: auditData.id,
        item_id: item.itemId || null,
        item_name_en: item.itemNameEn,
        item_name_ar: item.itemNameAr,
        category: item.category,
        unit: item.unit,
        expected_quantity: item.expectedQuantity
      }));

      const { error: itemsError } = await supabase
        .from('audit_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;
      
      return auditData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audits'] });
      addToast('success', language === 'ar' ? 'تم جدولة الجرد بنجاح' : 'Audit scheduled successfully');
    },
    onError: (error: any) => {
      addToast('error', error.message);
    }
  });

  const saveAuditCountsMutation = useMutation({
    mutationFn: async ({ items }: { items: { id: string, counted_quantity: number, notes?: string }[] }) => {
      for (const item of items) {
        const { error } = await supabase
          .from('audit_items')
          .update({ 
            counted_quantity: item.counted_quantity,
            notes: item.notes
          })
          .eq('id', item.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audits'] });
      addToast('success', language === 'ar' ? 'تم حفظ الجرد' : 'Audit counts saved');
    },
    onError: (error: any) => {
      addToast('error', error.message);
    }
  });

  const submitAuditMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('audits')
        .update({ status: 'pending_review', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audits'] });
      addToast('success', language === 'ar' ? 'تم إرسال الجرد للمراجعة' : 'Audit submitted for review');
    },
    onError: (error: any) => {
      addToast('error', error.message);
    }
  });

  const applyAuditMutation = useMutation({
    mutationFn: async ({ auditId, performedBy }: { auditId: string, performedBy: string }) => {
      const { error } = await supabase.rpc('apply_audit_variances', {
        p_audit_id: auditId,
        p_performed_by: performedBy
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audits'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      addToast('success', language === 'ar' ? 'تم تطبيق التسويات بنجاح' : 'Variances applied successfully');
    },
    onError: (error: any) => {
      addToast('error', error.message);
    }
  });

  return {
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
  };
};
