import { useState, useCallback, useRef } from 'react';
import { InventoryItem, Transaction, TransactionType, TransactionStatus, LocationId, User, LocationData, Language } from '../types';
import { supabase } from '../services/supabase';
import { generateId } from '../constants';

interface UseInventoryDataProps {
  currentUser: User | null;
  selectedLocation: string | null;
  language: Language;
  addToast: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

export const useInventoryData = ({ currentUser, selectedLocation, language, addToast }: UseInventoryDataProps) => {
  const [inventory, setInventory] = useState<Record<string, InventoryItem[]>>({});
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  // Mutation lock: prevents real-time subscription from overwriting optimistic updates
  const isMutating = useRef(false);

  const handleCleanUpTransactions = useCallback(async (months: number) => {
      if (months === 0) return; // 0 means never
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - months);
      const cutoffString = cutoffDate.toISOString();
      isMutating.current = true;
      try {
          const { error } = await supabase
              .from('transactions')
              .delete()
              .lt('date', cutoffString);
          if (error) {
              console.error("Error cleaning up transactions:", error);
          } else {
              setTransactions(prev => prev.filter(t => new Date(t.date) >= cutoffDate));
          }
      } finally {
          isMutating.current = false;
      }
  }, []);

  const handleAddItem = useCallback(async (locationId: string, item: Omit<InventoryItem, 'id' | 'lastUpdated'>) => {
      if (currentUser?.role === 'branch_manager' && currentUser.branchCode !== locationId) {
          console.error("Branch managers can only add items to their own branch.");
          return;
      }
      if (currentUser?.role === 'warehouse_manager' && locationId !== 'warehouse' && locationId !== 'mammal') {
          console.error("Warehouse managers can only add items to warehouse or mammal.");
          return;
      }

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

      const tempId = generateId();
      const newItem: InventoryItem = {
          ...item,
          id: tempId,
          lastUpdated: new Date().toISOString(),
          locationId
      };
      
      setInventory(prev => ({
          ...prev,
          [locationId]: [...(prev[locationId] || []), newItem]
      }));

      isMutating.current = true;
      try {
          const { data, error } = await supabase.from('inventory_items').insert([{
              location_id: locationId,
              name_en: item.nameEn,
              name_ar: item.nameAr,
              description: item.description,
              category: item.category,
              quantity: item.quantity,
              unit: item.unit,
              min_threshold: item.minThreshold,
              expiration_date: item.expirationDate || null,
              barcode: item.barcode || null
          }]).select();

          if (error) throw error;

          if (data && data[0]) {
              const realItem: InventoryItem = {
                  id: data[0].id,
                  locationId: data[0].location_id,
                  nameEn: data[0].name_en,
                  nameAr: data[0].name_ar,
                  description: data[0].description,
                  category: data[0].category,
                  quantity: data[0].quantity,
                  unit: data[0].unit,
                  minThreshold: data[0].min_threshold,
                  lastUpdated: data[0].last_updated,
                  expirationDate: data[0].expiration_date,
                  barcode: data[0].barcode
              };
              setInventory(prev => ({
                  ...prev,
                  [locationId]: prev[locationId].map(i => i.id === tempId ? realItem : i)
              }));
          }
      } catch (error: any) {
          console.error("Error adding item:", error);
          addToast('error', language === 'ar' ? 'فشل إضافة العنصر' : `Failed to add item: ${error.message || 'Unknown error'}`);
          // Rollback local state
          setInventory(prev => ({
              ...prev,
              [locationId]: prev[locationId].filter(i => i.id !== tempId)
          }));
      } finally {
          isMutating.current = false;
      }
  }, [currentUser, inventory, language, addToast]);

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

      setInventory(prev => ({
          ...prev,
          [locationId]: (prev[locationId] || []).map(i => i.id === updatedItem.id ? updatedItem : i)
      }));

      isMutating.current = true;
      try {
          const { error } = await supabase.from('inventory_items').update({
              name_en: updatedItem.nameEn,
              name_ar: updatedItem.nameAr,
              description: updatedItem.description,
              category: updatedItem.category,
              quantity: updatedItem.quantity,
              unit: updatedItem.unit,
              min_threshold: updatedItem.minThreshold,
              expiration_date: updatedItem.expirationDate || null,
              barcode: updatedItem.barcode || null
          }).eq('id', updatedItem.id);

          if (error) throw error;
      } catch (error: any) {
          console.error("Error editing item:", error);
          addToast('error', language === 'ar' ? 'فشل تعديل العنصر' : `Failed to update item: ${error.message || 'Unknown error'}`);
      } finally {
          isMutating.current = false;
      }
  }, [currentUser, inventory, language, addToast]);

  const isUUID = (id: string) => {
    if (!id) return false;
    const trimmed = id.trim();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
  };

  const handleDeleteItem = useCallback(async (locationId: string, itemId: string) => {
     if (currentUser?.role === 'branch_manager' && currentUser.branchCode !== locationId && locationId !== 'all') return;
     if (currentUser?.role === 'warehouse_manager' && locationId !== 'warehouse' && locationId !== 'mammal' && locationId !== 'all') return;

     const itemIds = itemId.split(',').map(id => id.trim()).filter(Boolean);
     
     // Store original state for rollback (shallow copy is enough because we replace arrays)
     let originalInventory: Record<string, InventoryItem[]> | null = null;
     setInventory(prev => {
         originalInventory = prev;
         const next = { ...prev };
         if (locationId === 'all') {
             Object.keys(next).forEach(loc => {
                 next[loc] = next[loc].filter(i => !itemIds.includes(i.id));
             });
         } else {
             next[locationId] = (next[locationId] || []).filter(i => !itemIds.includes(i.id));
         }
         return next;
     });

     isMutating.current = true;
     try {
         const validUUIDs = Array.from(new Set(itemIds.filter(id => isUUID(id))));
         if (validUUIDs.length > 0) {
             const { error } = await supabase.from('inventory_items').delete().in('id', validUUIDs);
             if (error) throw error;
         }
         addToast('success', language === 'ar' ? 'تم حذف العنصر بنجاح' : 'Item deleted successfully');
     } catch (error: any) {
         console.error("Error deleting item:", error);
         addToast('error', language === 'ar' ? `فشل الحذف: ${error.message || 'خطأ غير معروف'}` : `Deletion failed: ${error.message || 'Unknown error'}`);
         // Rollback local state
         if (originalInventory) setInventory(originalInventory);
     } finally {
         isMutating.current = false;
     }
  }, [currentUser, language, addToast]);

  const handleBulkDeleteItems = useCallback(async (locationId: string, itemIds: string[]) => {
      if (currentUser?.role === 'branch_manager' && currentUser.branchCode !== locationId && locationId !== 'all') return;
      if (currentUser?.role === 'warehouse_manager' && locationId !== 'warehouse' && locationId !== 'mammal' && locationId !== 'all') return;

      const cleanedIds = itemIds.map(id => id.trim()).filter(Boolean);

      // Store original state for rollback
      let originalInventory: Record<string, InventoryItem[]> | null = null;
      setInventory(prev => {
          originalInventory = prev;
          const next = { ...prev };
          if (locationId === 'all') {
              Object.keys(next).forEach(loc => {
                  next[loc] = next[loc].filter(i => !cleanedIds.includes(i.id));
              });
          } else {
              next[locationId] = (next[locationId] || []).filter(i => !cleanedIds.includes(i.id));
          }
          return next;
      });

      isMutating.current = true;
      try {
          const validUUIDs = Array.from(new Set(cleanedIds.filter(id => isUUID(id))));
          if (validUUIDs.length > 0) {
              // Chunk deletions to avoid URL length limits (approx 50 UUIDs per chunk is safe)
              const chunkSize = 50;
              for (let i = 0; i < validUUIDs.length; i += chunkSize) {
                  const chunk = validUUIDs.slice(i, i + chunkSize);
                  const { error } = await supabase.from('inventory_items').delete().in('id', chunk);
                  if (error) throw error;
              }
          }
          addToast('success', language === 'ar' ? 'تم حذف العناصر المختارة' : 'Selected items deleted successfully');
      } catch (error: any) {
          console.error("Error in bulk delete:", error);
          addToast('error', language === 'ar' ? `فشل الحذف الجماعي: ${error.message || 'خطأ غير معروف'}` : `Bulk deletion failed: ${error.message || 'Unknown error'}`);
          // Rollback local state
          if (originalInventory) setInventory(originalInventory);
      } finally {
          isMutating.current = false;
      }
  }, [currentUser, language, addToast]);

  const handleBulkEditItems = useCallback(async (locationId: string, itemIds: string[], updates: Partial<InventoryItem>) => {
      const cleanedIds = itemIds.map(id => id.trim()).filter(Boolean);
      
      // Apply optimistic update across the correct location(s)
      setInventory(prev => {
          if (locationId === 'all') {
              const next = { ...prev };
              Object.keys(next).forEach(loc => {
                  next[loc] = next[loc].map(i => cleanedIds.includes(i.id) ? { ...i, ...updates } : i);
              });
              return next;
          }
          return {
              ...prev,
              [locationId]: (prev[locationId] || []).map(i => cleanedIds.includes(i.id) ? { ...i, ...updates } : i)
          };
      });

      const dbUpdates: any = {};
      if (updates.category) dbUpdates.category = updates.category;
      if (updates.unit) dbUpdates.unit = updates.unit;
      if (updates.minThreshold !== undefined) dbUpdates.min_threshold = updates.minThreshold;

      if (Object.keys(dbUpdates).length === 0) return;

      isMutating.current = true;
      try {
          const validUUIDs = Array.from(new Set(cleanedIds.filter(id => isUUID(id))));
          if (validUUIDs.length > 0) {
              const chunkSize = 50;
              for (let i = 0; i < validUUIDs.length; i += chunkSize) {
                  const chunk = validUUIDs.slice(i, i + chunkSize);
                  const { error } = await supabase.from('inventory_items').update(dbUpdates).in('id', chunk);
                  if (error) throw error;
              }
          }
      } catch (error: any) {
          console.error("Error in bulk edit:", error);
          addToast('error', language === 'ar' ? `فشل التعديل الجماعي: ${error.message || 'خطأ غير معروف'}` : `Bulk update failed: ${error.message || 'Unknown error'}`);
      } finally {
          isMutating.current = false;
      }
  }, [addToast, language]);

  const handleTransfer = useCallback(async (items: { itemId: string, quantity: number }[], toLocation: LocationId, sourceOverride?: LocationId) => {
    if (!currentUser) return;
    
    const fromLocation = sourceOverride || selectedLocation;
    if (!fromLocation || fromLocation === 'all') return;

    const isManagerOfSource = 
        (currentUser.role === 'branch_manager' && currentUser.branchCode === fromLocation) ||
        (currentUser.role === 'warehouse_manager' && (fromLocation === 'warehouse' || fromLocation === 'mammal')) ||
        (currentUser.role === 'admin');

    const status: TransactionStatus = isManagerOfSource ? 'pending_target' : 'pending_source';
    const transferGroupId = `GRP-${Date.now()}`;

    const newTransactions: Transaction[] = [];
    const updatedSourceInventory = [...(inventory[fromLocation] || [])];

    for (const transferItem of items) {
        const sourceItemIndex = updatedSourceInventory.findIndex(i => i.id === transferItem.itemId);
        if (sourceItemIndex !== -1) {
            const sourceItem = updatedSourceInventory[sourceItemIndex];
            
            if (isManagerOfSource) {
                updatedSourceInventory[sourceItemIndex] = {
                    ...sourceItem,
                    quantity: sourceItem.quantity - transferItem.quantity
                };
            }

            newTransactions.push({
                id: generateId(),
                transferGroupId: transferGroupId,
                date: new Date().toISOString(),
                type: 'transfer',
                status: status,
                fromLocation: fromLocation,
                toLocation: toLocation,
                itemNameEn: sourceItem.nameEn,
                itemNameAr: sourceItem.nameAr,
                quantity: transferItem.quantity,
                unit: sourceItem.unit,
                performedBy: currentUser.name
            });
        }
    }

    if (isManagerOfSource) {
        setInventory(prev => ({ ...prev, [fromLocation]: updatedSourceInventory }));
    }
    setTransactions(prev => [...newTransactions, ...prev]);

    if (newTransactions.length > 0) {
        isMutating.current = true;
        try {
            if (isManagerOfSource) {
                // Use updatedSourceInventory (which already has subtracted quantities)
                for (const item of items) {
                    const sourceItem = updatedSourceInventory.find(i => i.id === item.itemId);
                    if (sourceItem) {
                        await supabase.from('inventory_items').update({
                            quantity: sourceItem.quantity
                        }).eq('id', item.itemId).then(({error}) => { if (error) throw error; });
                    }
                }
            }
            
            const dbTransactions = newTransactions.map(t => ({
                transfer_group_id: t.transferGroupId,
                date: t.date,
                type: 'transfer',
                status: t.status,
                from_location: t.fromLocation,
                to_location: t.toLocation,
                item_name_en: t.itemNameEn,
                item_name_ar: t.itemNameAr,
                quantity: t.quantity,
                unit: t.unit,
                performed_by: t.performedBy
            }));
            
            const { data, error } = await supabase.from('transactions').insert(dbTransactions).select();
            
            if (!error && data) {
                setTransactions(prev => {
                    let updated = [...prev];
                    data.forEach((dbTx: any) => {
                        const index = updated.findIndex(t => 
                            t.transferGroupId === dbTx.transfer_group_id && 
                            t.itemNameEn === dbTx.item_name_en &&
                            t.id.length < 15
                        );
                        if (index !== -1) {
                            updated[index] = {
                                ...updated[index],
                                id: dbTx.id
                            };
                        }
                    });
                    return updated;
                });
            }
        } catch (err) {
            console.error("Transfer failed", err);
            addToast('error', language === 'ar' ? 'فشل النقل. يرجى التحقق من اتصالك.' : 'Transfer failed. Please check your connection.');
        } finally {
            isMutating.current = false;
        }
    }
  }, [currentUser, selectedLocation, inventory, language, addToast]);

  const handleConfirmSourceTransfer = useCallback(async (transaction: Transaction) => {
      if (!currentUser) return;
      isMutating.current = true;
      try {
          const sourceItem = (inventory[transaction.fromLocation!] || []).find(i => i.nameEn === transaction.itemNameEn || i.nameAr === transaction.itemNameAr);
          if (sourceItem) {
              setInventory(prev => ({
                  ...prev,
                  [transaction.fromLocation!]: prev[transaction.fromLocation!].map(i => 
                      i.id === sourceItem.id ? { ...i, quantity: i.quantity - transaction.quantity } : i
                  )
              }));
          }
          setTransactions(prev => prev.map(t => t.id === transaction.id ? { ...t, status: 'pending_target' } : t));

          if (sourceItem) {
              await supabase.from('inventory_items').update({
                  quantity: sourceItem.quantity - transaction.quantity
              }).eq('id', sourceItem.id).then(({error}) => { if (error) throw error; });
          }
          await supabase.from('transactions').update({ status: 'pending_target' }).eq('id', transaction.id).then(({error}) => { if (error) throw error; });
      } catch (error) {
          console.error("Error in handleConfirmSourceTransfer:", error);
      } finally {
          isMutating.current = false;
      }
  }, [currentUser, inventory]);

  const handleReceiveTransfer = useCallback(async (transaction: Transaction) => {
      if (!currentUser) return;
      isMutating.current = true;
      try {
          const targetLocation = transaction.toLocation!;
          const existingItems = inventory[targetLocation] || [];
          const destItem = existingItems.find(i => i.nameEn === transaction.itemNameEn || i.nameAr === transaction.itemNameAr);

          if (destItem) {
              setInventory(prev => ({
                  ...prev,
                  [targetLocation]: prev[targetLocation].map(i => 
                      i.id === destItem.id ? { ...i, quantity: i.quantity + transaction.quantity } : i
                  )
              }));
          } else {
              const newItem: InventoryItem = {
                  id: generateId(),
                  locationId: targetLocation,
                  nameEn: transaction.itemNameEn,
                  nameAr: transaction.itemNameAr,
                  category: 'Received',
                  quantity: transaction.quantity,
                  unit: transaction.unit,
                  minThreshold: 0,
                  lastUpdated: new Date().toISOString()
              };
              setInventory(prev => ({
                  ...prev,
                  [targetLocation]: [...(prev[targetLocation] || []), newItem]
              }));
          }

          setTransactions(prev => prev.map(t => t.id === transaction.id ? { ...t, status: 'completed' } : t));

          if (destItem) {
              await supabase.from('inventory_items').update({
                  quantity: destItem.quantity + transaction.quantity
              }).eq('id', destItem.id).then(({error}) => { if (error) throw error; });
          } else {
              await supabase.from('inventory_items').insert([{
                  location_id: targetLocation,
                  name_en: transaction.itemNameEn,
                  name_ar: transaction.itemNameAr,
                  category: 'Received',
                  quantity: transaction.quantity,
                  unit: transaction.unit,
                  min_threshold: 0
              }]).then(({error}) => { if (error) throw error; });
          }
          await supabase.from('transactions').update({ status: 'completed' }).eq('id', transaction.id).then(({error}) => { if (error) throw error; });
      } catch (error) {
          console.error("Error in handleReceiveTransfer:", error);
          addToast('error', language === 'ar' ? 'حدث خطأ أثناء استلام المخزون' : 'An error occurred while receiving inventory');
      } finally {
          isMutating.current = false;
      }
  }, [currentUser, inventory, language, addToast]);

  const handleRejectTransfer = useCallback(async (transaction: Transaction, reason: string) => {
      if (!currentUser) return;
      isMutating.current = true;
      try {
          const sourceLocation = transaction.fromLocation!;
          const wasDeducted = transaction.status === 'pending_target';
          const sourceItem = (inventory[sourceLocation] || []).find(i => i.nameEn === transaction.itemNameEn || i.nameAr === transaction.itemNameAr);

          if (wasDeducted) {
              if (sourceItem) {
                   setInventory(prev => ({
                      ...prev,
                      [sourceLocation]: prev[sourceLocation].map(i => 
                          i.id === sourceItem.id ? { ...i, quantity: i.quantity + transaction.quantity } : i
                      )
                  }));
              } else {
                  const restoredItem: InventoryItem = {
                      id: generateId(),
                      locationId: sourceLocation,
                      nameEn: transaction.itemNameEn,
                      nameAr: transaction.itemNameAr,
                      category: 'Returned',
                      quantity: transaction.quantity,
                      unit: transaction.unit,
                      minThreshold: 0,
                      lastUpdated: new Date().toISOString()
                  };
                  setInventory(prev => ({
                      ...prev,
                      [sourceLocation]: [...(prev[sourceLocation] || []), restoredItem]
                  }));
              }
          }

          setTransactions(prev => prev.map(t => t.id === transaction.id ? { ...t, status: 'rejected', rejectionReason: reason } : t));

          if (wasDeducted) {
              if (sourceItem) {
                   await supabase.from('inventory_items').update({
                      quantity: sourceItem.quantity + transaction.quantity
                  }).eq('id', sourceItem.id).then(({error}) => { if (error) throw error; });
              } else {
                  await supabase.from('inventory_items').insert([{
                      location_id: sourceLocation,
                      name_en: transaction.itemNameEn,
                      name_ar: transaction.itemNameAr,
                      category: 'Returned',
                      quantity: transaction.quantity,
                      unit: transaction.unit,
                      min_threshold: 0
                  }]).then(({error}) => { if (error) throw error; });
              }
          }
          await supabase.from('transactions').update({ status: 'rejected', rejection_reason: reason }).eq('id', transaction.id).then(({error}) => { if (error) throw error; });
      } catch (error) {
          console.error("Error in handleRejectTransfer:", error);
          addToast('error', language === 'ar' ? 'حدث خطأ أثناء رفض النقل' : 'An error occurred while rejecting transfer');
      } finally {
          isMutating.current = false;
      }
  }, [currentUser, inventory, language, addToast]);

  const handleDailyLog = useCallback(async (type: TransactionType, itemId: string, quantity: number, notes: string) => {
      if (!currentUser || !selectedLocation || selectedLocation === 'all') return;
      const location = selectedLocation;
      const item = (inventory[location] || []).find(i => i.id === itemId);
      
      if (item) {
          isMutating.current = true;
          try {
              const newQty = type === 'usage' ? item.quantity - quantity : item.quantity + quantity;
              
              setInventory(prev => ({
                  ...prev,
                  [location]: prev[location].map(i => i.id === itemId ? { ...i, quantity: newQty } : i)
              }));

              const tempId = generateId();
              const newTx: Transaction = {
                  id: tempId,
                  date: new Date().toISOString(),
                  type: type,
                  status: 'completed',
                  fromLocation: type === 'usage' ? location : 'External Supplier',
                  toLocation: type === 'usage' ? 'Consumed' : location,
                  itemNameEn: item.nameEn,
                  itemNameAr: item.nameAr,
                  quantity: quantity,
                  unit: item.unit,
                  performedBy: currentUser.name,
                  notes: notes
              };
              
              setTransactions(prev => [newTx, ...prev]);

              await supabase.from('inventory_items').update({ quantity: newQty }).eq('id', itemId).then(({error}) => { if (error) throw error; });
              await supabase.from('transactions').insert([{
                  date: newTx.date,
                  type: type,
                  status: 'completed',
                  from_location: newTx.fromLocation,
                  to_location: newTx.toLocation,
                  item_name_en: newTx.itemNameEn,
                  item_name_ar: newTx.itemNameAr,
                  quantity: quantity,
                  unit: item.unit,
                  performed_by: currentUser.name,
                  notes: notes
              }]).then(({error}) => { if (error) throw error; });
              
              addToast('success', language === 'ar' ? 'تم تسجيل العملية بنجاح' : 'Log recorded successfully');
          } catch (error) {
              console.error("Error in handleDailyLog:", error);
              addToast('error', language === 'ar' ? 'حدث خطأ أثناء تسجيل العملية' : 'An error occurred while recording log');
          } finally {
              isMutating.current = false;
          }
      }
  }, [currentUser, selectedLocation, inventory, language, addToast]);

  const handleBulkLog = useCallback(async (logs: { type: TransactionType, itemId: string, quantity: number, notes: string }[]) => {
      if (!currentUser || !selectedLocation || selectedLocation === 'all') return;
      isMutating.current = true;
      try {
          const newTransactions: Transaction[] = [];
          const updatedLocationInventory = [...(inventory[selectedLocation] || [])];
          const quantityChanges: Record<string, number> = {};
          
          logs.forEach(log => {
              const idx = updatedLocationInventory.findIndex(i => i.id === log.itemId);
              if (idx !== -1) {
                  const item = updatedLocationInventory[idx];
                  const change = log.type === 'usage' ? -log.quantity : log.quantity;
                  
                  updatedLocationInventory[idx] = {
                      ...item,
                      quantity: item.quantity + change,
                      lastUpdated: new Date().toISOString()
                  };
                  
                  quantityChanges[log.itemId] = (quantityChanges[log.itemId] || 0) + change;

                  newTransactions.push({
                      id: generateId(),
                      date: new Date().toISOString(),
                      type: log.type,
                      status: 'completed',
                      fromLocation: log.type === 'usage' ? selectedLocation : 'External Supplier',
                      toLocation: log.type === 'usage' ? 'Consumed' : selectedLocation,
                      itemNameEn: item.nameEn,
                      itemNameAr: item.nameAr,
                      quantity: log.quantity,
                      unit: item.unit,
                      performedBy: currentUser.name,
                      notes: log.notes
                  });
              }
          });

          setInventory(prev => ({ ...prev, [selectedLocation]: updatedLocationInventory }));
          setTransactions(prev => [...newTransactions, ...prev]);
          
          for (const [itemId, change] of Object.entries(quantityChanges)) {
              const item = updatedLocationInventory.find(i => i.id === itemId);
              if (item) {
                   await supabase.from('inventory_items').update({ 
                       quantity: item.quantity 
                   }).eq('id', itemId).then(({error}) => { if (error) throw error; });
              }
          }
          
          const dbTxs = newTransactions.map(t => ({
              date: t.date,
              type: t.type,
              status: 'completed',
              from_location: t.fromLocation,
              to_location: t.toLocation,
              item_name_en: t.itemNameEn,
              item_name_ar: t.itemNameAr,
              quantity: t.quantity,
              unit: t.unit,
              performed_by: t.performedBy,
              notes: t.notes
          }));
          
          if (dbTxs.length > 0) {
              await supabase.from('transactions').insert(dbTxs).then(({error}) => { if (error) throw error; });
          }
      } catch (error) {
          console.error("Error in handleBulkLog:", error);
          addToast('error', language === 'ar' ? 'حدث خطأ أثناء حفظ السجلات' : 'An error occurred while saving logs');
      } finally {
          isMutating.current = false;
      }
  }, [currentUser, selectedLocation, inventory, language, addToast]);

  return {
    inventory,
    setInventory,
    transactions,
    setTransactions,
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
    handleBulkLog
  };
};
