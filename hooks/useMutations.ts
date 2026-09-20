import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { InventoryItem, Transaction, TransactionType, LocationId, Language, Supplier, PurchaseOrder, PurchaseOrderItem, Audit, AuditItem } from '../types';
import { generateId } from '../constants';
import { logger } from '../utils/logger';

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
      logger.debug('Attempting transfer RPC', { fromLocation, toLocation, performedBy, isManagerOfSource });
      const { data, error } = await supabase.rpc('execute_transfer', {
        p_from_location: fromLocation,
        p_to_location: toLocation,
        p_performed_by: performedBy,
        p_is_manager_of_source: isManagerOfSource,
        p_items: items
      });
      logger.debug('Transfer RPC response', { hasData: !!data, error });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      addToast('success', language === 'ar' ? 'تم بدء النقل بنجاح' : 'Transfer initiated successfully');
      
      // Trigger push notification to target branch
      supabase.functions.invoke('push-notifications', {
        body: {
          location_id: variables.toLocation,
          title: language === 'ar' ? 'تحويل وارد' : 'Incoming Transfer',
          body: language === 'ar' 
            ? `تحويل وارد: ${variables.items.length} عناصر من ${variables.fromLocation}` 
            : `Incoming Transfer: ${variables.items.length} items from ${variables.fromLocation}`,
          data: { primaryKey: 'transfer' }
        }
      }).catch(e => console.error('Push notification failed', e));
    },
    onError: (error: any) => {
      console.error("Transfer failed", error);
      const detail = error?.message || error?.details || error?.hint || JSON.stringify(error);
      addToast('error', `Transfer failed: ${detail}`);
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
    mutationFn: async ({ transactionId, receivedQuantity, notes }: { transactionId: string, receivedQuantity: number, notes: string }) => {
      const { error } = await supabase.rpc('receive_transfer', { p_transaction_id: transactionId, p_received_quantity: receivedQuantity, p_notes: notes });
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
      // The server guard now rejects over-issuing with a specific message naming the
      // item and the available quantity — surface it instead of a generic failure.
      const detail: string | undefined = error?.message;
      addToast(
        'error',
        detail
          ? detail
          : language === 'ar'
            ? 'حدث خطأ أثناء تسجيل العملية'
            : 'An error occurred while recording log'
      );
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
      
      // Attempt to find the source location of this transfer group by fetching one transaction
      // Trigger push notification to source location (fire and forget)
      (async () => {
        try {
          const { data } = await supabase.from('transactions').select('from_location').eq('transfer_group_id', transferGroupId).limit(1).single();
          if (data?.from_location) {
            await supabase.functions.invoke('push-notifications', {
              body: {
                location_id: data.from_location,
                title: 'Transfer Received',
                body: 'The transfer you sent has been successfully received.',
                data: { primaryKey: transferGroupId + '_completed' }
              }
            });
          }
        } catch (e) {
          console.error('Push notification failed', e);
        }
      })();
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

  // Alerts are *marked* read, not deleted: the low-stock triggers own these rows
  // and deleting them destroyed the alert history (and re-created them on the next
  // stock change, so the same alert kept reappearing as "new").
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
    mutationFn: async (notificationIds: string[]) => {
      if (!notificationIds || notificationIds.length === 0) return;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', notificationIds);

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
          address: supplier.address,
          supplied_items: supplier.suppliedItems || []
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
          address: supplier.address,
          supplied_items: supplier.suppliedItems || []
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

  /**
   * Retries the insert when the generated PO number collides.
   *
   * `po_number` is UNIQUE and the number is random, so a clash used to surface as
   * a raw "duplicate key value" error instead of a new order.
   */
  const insertPurchaseOrder = async (row: Record<string, unknown>) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const year = new Date().getFullYear();
      const poNumber = `PO-${year}-${String(Math.floor(1000 + Math.random() * 9000))}`;
      const { data, error } = await supabase
        .from('purchase_orders')
        .insert({ ...row, po_number: poNumber })
        .select()
        .single();

      if (!error) return data;
      // 23505 = unique_violation on po_number; anything else is a real failure.
      if ((error as any).code !== '23505') throw error;
    }
    throw new Error('Could not allocate a unique purchase order number.');
  };

  const createPurchaseOrderMutation = useMutation({
    mutationFn: async (params: { po: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt' | 'poNumber' | 'status'> & { status?: string }, items: Omit<PurchaseOrderItem, 'id' | 'poId' | 'totalPrice'>[] }) => {
      const poData = await insertPurchaseOrder({
        supplier_id: params.po.supplierId,
        location_id: params.po.locationId || 'warehouse',
        status: params.po.status || 'draft',
        expected_delivery: params.po.expectedDelivery || null,
        notes: params.po.notes,
        created_by: params.po.createdBy
      });

      const itemsToInsert = params.items.map(item => ({
        po_id: poData.id,
        item_name_en: item.itemNameEn,
        item_name_ar: item.itemNameAr,
        quantity: item.quantity,
        received_quantity: 0,
        unit_price: item.unitPrice,
        total_price: item.quantity * item.unitPrice
      }));

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(itemsToInsert);

      if (itemsError) {
        // Do not leave a header with no lines behind.
        await supabase.from('purchase_orders').delete().eq('id', poData.id);
        throw itemsError;
      }

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

  const editPurchaseOrderMutation = useMutation({
    mutationFn: async (params: { id: string, po: Partial<PurchaseOrder>, items: Omit<PurchaseOrderItem, 'id' | 'poId' | 'totalPrice'>[] }) => {
      // 1. Update PO Header
      const { error: poError } = await supabase
        .from('purchase_orders')
        .update({
          expected_delivery: params.po.expectedDelivery,
          notes: params.po.notes,
          total_amount: params.po.totalAmount
        })
        .eq('id', params.id);
      
      if (poError) throw poError;

      // 2. Read the lines first: editing a PO used to delete and re-insert every
      //    line, which reset `received_quantity` to whatever the caller sent (0 for
      //    anything already partially received) and handed the lines new ids.
      const { data: existingItems, error: fetchError } = await supabase
        .from('purchase_order_items')
        .select('item_name_en, received_quantity')
        .eq('po_id', params.id);

      if (fetchError) throw fetchError;

      const receivedByName = new Map<string, number>();
      (existingItems || []).forEach((row: any) => {
        receivedByName.set(row.item_name_en, Number(row.received_quantity) || 0);
      });

      // 3. Delete existing items
      const { error: deleteError } = await supabase
        .from('purchase_order_items')
        .delete()
        .eq('po_id', params.id);

      if (deleteError) throw deleteError;

      // 4. Insert new items, carrying forward any quantity already received.
      const newItems = params.items.map(item => ({
        po_id: params.id,
        item_name_en: item.itemNameEn,
        item_name_ar: item.itemNameAr,
        quantity: item.quantity,
        received_quantity: Math.min(
          Number(item.receivedQuantity ?? 0) || receivedByName.get(item.itemNameEn) || 0,
          item.quantity
        ),
        unit_price: item.unitPrice,
        total_price: item.quantity * item.unitPrice
      }));

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(newItems);
      
      if (itemsError) throw itemsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      addToast('success', language === 'ar' ? 'تم تحديث أمر الشراء بنجاح' : 'Purchase order updated successfully');
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

  /**
   * Receiving a purchase order runs entirely inside the `receive_purchase_order`
   * RPC, so it is one transaction on the server.
   *
   * It used to be re-implemented here as a loop of round-trips, which lost stock:
   * a failure halfway left PO rows updated but inventory untouched, a retry then
   * double-counted, `quantity = quantity + x` was applied client-side from a stale
   * read, and the resulting `transactions` insert named columns that do not exist
   * (`item_id`, `location_id`) and never checked the error — so receipts of an
   * existing item silently produced no ledger entry at all. The RPC also credits
   * the PO's own location instead of always 'warehouse'.
   */
  const receivePurchaseOrderMutation = useMutation({
    mutationFn: async ({ poId, items, performedBy }: { poId: string, items: { id: string, received_quantity: number }[], performedBy: string }) => {
      const received = items.filter((item) => Number(item.received_quantity) > 0);
      if (received.length === 0) {
        throw new Error(language === 'ar' ? 'لم يتم إدخال كميات للاستلام' : 'No quantities were entered to receive');
      }

      const { data, error } = await supabase.rpc('receive_purchase_order', {
        p_po_id: poId,
        p_items: received.map((item) => ({ id: item.id, received_quantity: Number(item.received_quantity) })),
        p_performed_by: performedBy
      });
      if (error) throw error;
      return data as { status?: string; received?: number; fully_received?: boolean } | null;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      const fullyReceived = result?.fully_received ?? true;
      if (language === 'ar') {
        addToast('success', fullyReceived ? 'تم استلام أمر الشراء بالكامل' : 'تم استلام الكميات — الطلب ما زال مفتوحاً للباقي');
      } else {
        addToast('success', fullyReceived ? 'Purchase order received in full' : 'Quantities received — the order stays open for the rest');
      }
    },
    onError: (error: any) => {
      console.error('Receive purchase order failed', error);
      addToast('error', error?.message || (language === 'ar' ? 'فشل استلام أمر الشراء' : 'Failed to receive the purchase order'));
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
      const CHUNK_SIZE = 50;
      for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        const chunk = items.slice(i, i + CHUNK_SIZE);
        await Promise.all(
          chunk.map(async (item) => {
            const { error } = await supabase
              .from('audit_items')
              .update({ 
                counted_quantity: item.counted_quantity,
                notes: item.notes
              })
              .eq('id', item.id);
            if (error) throw error;
          })
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audits'] });
      addToast('success', language === 'ar' ? 'تم حفظ العد' : 'Audit counts saved');
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

  const deleteAuditMutation = useMutation({
    mutationFn: async (auditId: string) => {
      const { error } = await supabase
        .from('audits')
        .delete()
        .eq('id', auditId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audits'] });
      addToast('success', language === 'ar' ? 'تم حذف الجرد بنجاح' : 'Audit deleted successfully');
    },
    onError: (error: any) => {
      addToast('error', language === 'ar' ? 'فشل في حذف الجرد' : 'Failed to delete audit');
      console.error(error);
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
    editPurchaseOrderMutation,
    updatePurchaseOrderStatusMutation,
    receivePurchaseOrderMutation,
    scheduleAuditMutation,
    saveAuditCountsMutation,
    submitAuditMutation,
    applyAuditMutation,
    deleteAuditMutation
  };
};
