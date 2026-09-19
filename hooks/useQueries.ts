import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { fetchAllRows } from '../services/pagedFetch';
import { InventoryItem, Transaction, LocationData, User, UserRole, TransactionType, TransactionStatus, CatalogItem, AppNotification, Supplier, PurchaseOrder, PurchaseOrderItem, Audit, AuditItem } from '../types';
import { LOCATIONS as STATIC_LOCATIONS } from '../constants';
import { useCallback, useEffect, useRef } from 'react';
import { logger } from '../utils/logger';

/**
 * Every table read below is paged.
 *
 * Supabase caps a single response at `db-max-rows` (1000 by default) and says
 * nothing about it, so an unpaginated `.select('*')` used to hand the app a
 * silent subset of the data — 85 inventory items and most of the transaction
 * history never reached the UI. `fetchAllRows` walks the table with `.range()`
 * instead. Keep the `.order()` inside each paged query: paging over an unstable
 * order can repeat or skip rows.
 */

export const useNotificationsQuery = (locationId: string | null) => {
  return useQuery({
    queryKey: ['notifications', locationId],
    queryFn: async () => {
      if (!locationId) return [];
      const data = await fetchAllRows<any>(
        (from, to) =>
          supabase
            .from('notifications')
            .select('*')
            .eq('location_id', locationId)
            .order('created_at', { ascending: false })
            .order('id', { ascending: true })
            .range(from, to),
        'notifications'
      );

      return data.map((n: any) => ({
        id: n.id,
        locationId: n.location_id,
        itemId: n.item_id,
        type: n.type,
        messageEn: n.message_en,
        messageAr: n.message_ar,
        isRead: n.is_read,
        createdAt: n.created_at
      })) as AppNotification[];
    },
    enabled: !!locationId,
  });
};

export const useCatalogQuery = () => {
  return useQuery({
    queryKey: ['catalog'],
    queryFn: async () => {
      const data = await fetchAllRows<any>(
        (from, to) => supabase.from('product_catalog').select('*').order('name_en').order('id').range(from, to),
        'product_catalog'
      );
      return data.map((c: any) => ({
        id: c.id,
        nameEn: c.name_en,
        nameAr: c.name_ar,
        description: c.description,
        category: c.category,
        unit: c.unit,
        minThreshold: c.min_threshold,
        barcode: c.barcode,
        defaultPrice: c.default_price ? Number(c.default_price) : undefined
      })) as CatalogItem[];
    },
    placeholderData: [],
  });
};

export const useSuppliersQuery = () => {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const data = await fetchAllRows<any>(
        (from, to) => supabase.from('suppliers').select('*').order('name_en').order('id').range(from, to),
        'suppliers'
      );
      return data.map((s: any) => ({
        id: s.id,
        nameEn: s.name_en,
        nameAr: s.name_ar,
        contactPerson: s.contact_person,
        email: s.email,
        phone: s.phone,
        address: s.address,
        suppliedItems: s.supplied_items || [],
        createdAt: s.created_at
      })) as Supplier[];
    },
    placeholderData: [],
  });
};

export const usePurchaseOrdersQuery = () => {
  return useQuery({
    queryKey: ['purchase_orders'],
    queryFn: async () => {
      // Fetch POs with their items and suppliers
      const data = await fetchAllRows<any>(
        (from, to) =>
          supabase
            .from('purchase_orders')
            .select(`
              *,
              supplier:suppliers(*),
              items:purchase_order_items(*)
            `)
            .order('created_at', { ascending: false })
            .order('id', { ascending: true })
            .range(from, to),
        'purchase_orders'
      );

      return data.map((po: any) => ({
        id: po.id,
        poNumber: po.po_number,
        supplierId: po.supplier_id,
        locationId: po.location_id,
        status: po.status,
        expectedDelivery: po.expected_delivery,
        totalAmount: Number(po.total_amount),
        notes: po.notes,
        createdBy: po.created_by,
        createdAt: po.created_at,
        updatedAt: po.updated_at,
        supplier: po.supplier ? {
          id: po.supplier.id,
          nameEn: po.supplier.name_en,
          nameAr: po.supplier.name_ar,
          contactPerson: po.supplier.contact_person,
          email: po.supplier.email,
          phone: po.supplier.phone,
          address: po.supplier.address,
          createdAt: po.supplier.created_at
        } : undefined,
        items: (po.items || []).map((item: any) => ({
          id: item.id,
          poId: item.po_id,
          itemNameEn: item.item_name_en,
          itemNameAr: item.item_name_ar,
          quantity: Number(item.quantity),
          receivedQuantity: Number(item.received_quantity),
          unitPrice: Number(item.unit_price),
          totalPrice: Number(item.total_price)
        }))
      })) as PurchaseOrder[];
    },
    placeholderData: [],
  });
};

export const useAuditsQuery = () => {
  return useQuery({
    queryKey: ['audits'],
    queryFn: async () => {
      const data = await fetchAllRows<any>(
        (from, to) =>
          supabase
            .from('audits')
            .select(`
              *,
              items:audit_items(*)
            `)
            .order('created_at', { ascending: false })
            .order('id', { ascending: true })
            .range(from, to),
        'audits'
      );

      return data.map((a: any) => ({
        id: a.id,
        title: a.title,
        locationId: a.location_id,
        status: a.status,
        scheduledDate: a.scheduled_date,
        completedDate: a.completed_date,
        createdBy: a.created_by,
        createdAt: a.created_at,
        updatedAt: a.updated_at,
        items: (a.items || []).map((item: any) => ({
          id: item.id,
          auditId: item.audit_id,
          itemId: item.item_id,
          itemNameEn: item.item_name_en,
          itemNameAr: item.item_name_ar,
          category: item.category,
          unit: item.unit,
          expectedQuantity: Number(item.expected_quantity),
          countedQuantity: item.counted_quantity != null ? Number(item.counted_quantity) : undefined,
          variance: item.variance != null ? Number(item.variance) : undefined,
          notes: item.notes
        }))
      })) as Audit[];
    },
    placeholderData: [],
  });
};

export const useLocationsQuery = () => {
  return useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const data = await fetchAllRows<any>(
        (from, to) => supabase.from('locations').select('*').order('id').range(from, to),
        'locations'
      );
      // An empty table genuinely means "fall back to the built-in location list":
      // locations are configuration, not user data.
      if (data.length === 0) return STATIC_LOCATIONS;
      return data.map((l: any) => ({
        id: l.id,
        name: l.name,
        nameAr: l.name_ar || l.name,
        description: l.description || '',
        descriptionAr: l.description_ar || l.description || '',
        icon: l.icon || 'store',
        type: l.type as 'central' | 'branch'
      })) as LocationData[];
    },
    placeholderData: STATIC_LOCATIONS,
  });
};

export const useUsersQuery = () => {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const data = await fetchAllRows<any>(
        (from, to) => supabase.from('app_users').select('*').order('username').order('id').range(from, to),
        'app_users'
      );
      // No demo-user fallback: seeding the directory from constants meant an empty
      // (or not-yet-migrated) project accepted the hardcoded sample logins.
      return data.map((u: any) => {
        const rawBranches = u.accessible_branches || [];
        const accessibleBranches = rawBranches.filter((b: string) => !b.endsWith(':read'));
        const readOnlyBranches = rawBranches.filter((b: string) => b.endsWith(':read')).map((b: string) => b.replace(':read', ''));
        
        return {
          id: u.id,
          username: u.username,
          password: u.password,
          name: u.name,
          nameAr: u.name_ar,
          role: u.role as UserRole,
          branchCode: u.branch_code,
          branchName: u.branch_name,
          branchNameAr: u.branch_name_ar,
          accessibleBranches,
          readOnlyBranches
        };
      }) as User[];
    },
  });
};

export const useInventoryQuery = () => {
  return useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      const data = await fetchAllRows<any>(
        (from, to) =>
          supabase.from('inventory_items').select('*').order('location_id').order('id').range(from, to),
        'inventory_items'
      );
      const newInventory: Record<string, InventoryItem[]> = {};
      if (data) {
        data.forEach((i: any) => {
          const item: InventoryItem = {
            id: i.id,
            nameEn: i.name_en,
            nameAr: i.name_ar,
            description: i.description,
            category: i.category,
            quantity: Number(i.quantity),
            unit: i.unit,
            minThreshold: Number(i.min_threshold),
            lastUpdated: i.last_updated,
            locationId: i.location_id,
            expirationDate: i.expiration_date,
            barcode: i.barcode
          };
          if (!newInventory[i.location_id]) newInventory[i.location_id] = [];
          newInventory[i.location_id].push(item);
        });
      }
      // An empty result means the location really has no stock; showing seed
      // inventory here made phantom stock look real.
      return newInventory;
    },
  });
};

export const useTransactionsQuery = () => {
  return useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const data = await fetchAllRows<any>(
        (from, to) =>
          supabase.from('transactions').select('*').order('date', { ascending: false }).order('id').range(from, to),
        'transactions'
      );
      return data.map((t: any) => ({
        id: t.id,
        transferGroupId: t.transfer_group_id,
        date: t.date,
        type: t.type as TransactionType,
        status: t.status as TransactionStatus,
        fromLocation: t.from_location,
        toLocation: t.to_location,
        itemNameEn: t.item_name_en,
        itemNameAr: t.item_name_ar,
        quantity: Number(t.quantity),
        unit: t.unit,
        performedBy: t.performed_by,
        notes: t.notes,
        rejectionReason: t.rejection_reason,
        receivedQuantity: t.received_quantity != null ? Number(t.received_quantity) : undefined,
        receiptNotes: t.receipt_notes,
        itemStatus: t.item_status,
        signatureUrl: t.signature_url,
        photoUrls: t.photo_urls
      })) as Transaction[];
    },
    placeholderData: [],
  });
};

/**
 * Coalesces realtime bursts before invalidating.
 *
 * A single daily log or PO receipt writes many rows, and one broadcast per row
 * used to trigger one full refetch per row on every connected client. Merging
 * them into a trailing edge keeps the data fresh but collapses the storm.
 */
const useInvalidationCoalescer = () => {
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const client = useQueryClient();

  useEffect(
    () => () => {
      timers.current.forEach((timer) => clearTimeout(timer));
      timers.current.clear();
    },
    []
  );

  return useCallback(
    (queryKey: string) => {
      const existing = timers.current.get(queryKey);
      if (existing) clearTimeout(existing);
      timers.current.set(
        queryKey,
        setTimeout(() => {
          timers.current.delete(queryKey);
          client.invalidateQueries({ queryKey: [queryKey] });
        }, 600)
      );
    },
    [client]
  );
};

export const useRealtimeSubscriptions = () => {
  const invalidate = useInvalidationCoalescer();

  useEffect(() => {
    const tables: { table: string; key: string }[] = [
      { table: 'transactions', key: 'transactions' },
      { table: 'inventory_items', key: 'inventory' },
      { table: 'app_users', key: 'users' },
      { table: 'notifications', key: 'notifications' },
    ];

    const channels = tables.map(({ table, key }) =>
      supabase
        .channel(`${table}-changes`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => invalidate(key))
        .subscribe()
    );

    return () => {
      channels.forEach((channel) => supabase.removeChannel(channel));
    };
  }, [invalidate]);
};
