-- migration.sql
-- Contains RPCs for atomic operations.

-- 1. Execute Transfer (Atomic creation of transactions and deducting source inventory if applicable)
CREATE OR REPLACE FUNCTION public.execute_transfer(
    p_from_location text,
    p_to_location text,
    p_performed_by text,
    p_is_manager_of_source boolean,
    p_items jsonb -- Array of objects: { itemId, itemNameEn, itemNameAr, quantity, unit }
) RETURNS void AS $$
DECLARE
    v_transfer_group_id text;
    v_item jsonb;
    v_item_id uuid;
    v_quantity numeric;
    v_unit text;
    v_name_en text;
    v_name_ar text;
    v_status text;
BEGIN
    v_transfer_group_id := 'GRP-' || (extract(epoch from now()) * 1000)::bigint::text;
    v_status := CASE WHEN p_is_manager_of_source THEN 'pending_target' ELSE 'pending_source' END;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := (v_item->>'itemId')::uuid;
        v_quantity := (v_item->>'quantity')::numeric;
        v_unit := v_item->>'unit';
        v_name_en := v_item->>'itemNameEn';
        v_name_ar := v_item->>'itemNameAr';

        -- If manager of source, deduct quantity
        IF p_is_manager_of_source THEN
            UPDATE public.inventory_items 
            SET quantity = quantity - v_quantity 
            WHERE id = v_item_id;
        END IF;

        -- Insert transaction
        INSERT INTO public.transactions (
            transfer_group_id, date, type, status, from_location, to_location,
            item_name_en, item_name_ar, quantity, unit, performed_by
        ) VALUES (
            v_transfer_group_id, now(), 'transfer', v_status, p_from_location, p_to_location,
            v_name_en, v_name_ar, v_quantity, v_unit, p_performed_by
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Confirm Source Transfer (Manager approves an outgoing request)
CREATE OR REPLACE FUNCTION public.confirm_source_transfer(p_transaction_id uuid)
RETURNS void AS $$
DECLARE
    v_tx record;
    v_item_id uuid;
BEGIN
    SELECT * INTO v_tx FROM public.transactions WHERE id = p_transaction_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Transaction not found'; END IF;

    -- Find matching item at source
    SELECT id INTO v_item_id FROM public.inventory_items 
    WHERE location_id = v_tx.from_location 
      AND (name_en = v_tx.item_name_en OR name_ar = v_tx.item_name_ar) 
    LIMIT 1;

    IF v_item_id IS NOT NULL THEN
        UPDATE public.inventory_items SET quantity = quantity - v_tx.quantity WHERE id = v_item_id;
    END IF;

    UPDATE public.transactions SET status = 'pending_target' WHERE id = p_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Receive Transfer (Target manager receives stock)
CREATE OR REPLACE FUNCTION public.receive_transfer(p_transaction_id uuid)
RETURNS void AS $$
DECLARE
    v_tx record;
    v_item_id uuid;
    v_category text;
BEGIN
    SELECT * INTO v_tx FROM public.transactions WHERE id = p_transaction_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Transaction not found'; END IF;

    -- Find matching item at destination
    SELECT id INTO v_item_id FROM public.inventory_items 
    WHERE location_id = v_tx.to_location 
      AND (name_en = v_tx.item_name_en OR name_ar = v_tx.item_name_ar) 
    LIMIT 1;

    IF v_item_id IS NOT NULL THEN
        UPDATE public.inventory_items SET quantity = quantity + v_tx.quantity WHERE id = v_item_id;
    ELSE
        -- Look up category from product_catalog or fallback
        SELECT category INTO v_category FROM public.product_catalog WHERE name_en = v_tx.item_name_en LIMIT 1;
        IF v_category IS NULL THEN
            SELECT category INTO v_category FROM public.inventory_items WHERE name_en = v_tx.item_name_en AND category NOT IN ('Received', 'Returned') LIMIT 1;
        END IF;
        IF v_category IS NULL THEN
            v_category := 'Uncategorized';
        END IF;

        INSERT INTO public.inventory_items (location_id, name_en, name_ar, category, quantity, unit, min_threshold)
        VALUES (v_tx.to_location, v_tx.item_name_en, v_tx.item_name_ar, v_category, v_tx.quantity, v_tx.unit, 0);
    END IF;

    UPDATE public.transactions SET status = 'completed' WHERE id = p_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Reject Transfer (Return stock to source if it was deducted)
CREATE OR REPLACE FUNCTION public.reject_transfer(p_transaction_id uuid, p_reason text)
RETURNS void AS $$
DECLARE
    v_tx record;
    v_item_id uuid;
    v_category text;
BEGIN
    SELECT * INTO v_tx FROM public.transactions WHERE id = p_transaction_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Transaction not found'; END IF;

    IF v_tx.status = 'pending_target' THEN
        -- It was deducted from source, so we must return it
        SELECT id INTO v_item_id FROM public.inventory_items 
        WHERE location_id = v_tx.from_location 
          AND (name_en = v_tx.item_name_en OR name_ar = v_tx.item_name_ar) 
        LIMIT 1;

        IF v_item_id IS NOT NULL THEN
            UPDATE public.inventory_items SET quantity = quantity + v_tx.quantity WHERE id = v_item_id;
        ELSE
            -- Look up category from product_catalog or fallback
            SELECT category INTO v_category FROM public.product_catalog WHERE name_en = v_tx.item_name_en LIMIT 1;
            IF v_category IS NULL THEN
                SELECT category INTO v_category FROM public.inventory_items WHERE name_en = v_tx.item_name_en AND category NOT IN ('Received', 'Returned') LIMIT 1;
            END IF;
            IF v_category IS NULL THEN
                v_category := 'Uncategorized';
            END IF;

            INSERT INTO public.inventory_items (location_id, name_en, name_ar, category, quantity, unit, min_threshold)
            VALUES (v_tx.from_location, v_tx.item_name_en, v_tx.item_name_ar, v_category, v_tx.quantity, v_tx.unit, 0);
        END IF;
    END IF;

    UPDATE public.transactions SET status = 'rejected', rejection_reason = p_reason WHERE id = p_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Execute Daily Log (usage or receive)
CREATE OR REPLACE FUNCTION public.execute_daily_log(
    p_location text,
    p_performed_by text,
    p_logs jsonb -- Array of objects: { type, itemId, quantity, notes }
) RETURNS void AS $$
DECLARE
    v_log jsonb;
    v_item_id uuid;
    v_type text;
    v_quantity numeric;
    v_notes text;
    v_item record;
    v_new_quantity numeric;
BEGIN
    FOR v_log IN SELECT * FROM jsonb_array_elements(p_logs)
    LOOP
        v_item_id := (v_log->>'itemId')::uuid;
        v_type := v_log->>'type';
        v_quantity := (v_log->>'quantity')::numeric;
        v_notes := v_log->>'notes';

        SELECT * INTO v_item FROM public.inventory_items WHERE id = v_item_id;
        IF NOT FOUND THEN CONTINUE; END IF;

        IF v_type = 'usage' THEN
            v_new_quantity := v_item.quantity - v_quantity;
        ELSE
            v_new_quantity := v_item.quantity + v_quantity;
        END IF;

        UPDATE public.inventory_items SET quantity = v_new_quantity WHERE id = v_item_id;

        INSERT INTO public.transactions (
            date, type, status, from_location, to_location,
            item_name_en, item_name_ar, quantity, unit, performed_by, notes
        ) VALUES (
            now(), v_type, 'completed', 
            CASE WHEN v_type = 'usage' THEN p_location ELSE 'External Supplier' END,
            CASE WHEN v_type = 'usage' THEN 'Consumed' ELSE p_location END,
            v_item.name_en, v_item.name_ar, v_quantity, v_item.unit, p_performed_by, v_notes
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. Add Item (Security Definer)
CREATE OR REPLACE FUNCTION public.execute_add_item(
    p_location_id text,
    p_name_en text,
    p_name_ar text,
    p_description text,
    p_category text,
    p_quantity numeric,
    p_unit text,
    p_min_threshold numeric,
    p_expiration_date text,
    p_barcode text
) RETURNS jsonb AS $$
DECLARE
    v_new_item public.inventory_items;
BEGIN
    INSERT INTO public.inventory_items (
        location_id, name_en, name_ar, description, category, quantity, unit, min_threshold, expiration_date, barcode
    ) VALUES (
        p_location_id, p_name_en, p_name_ar, p_description, p_category, p_quantity, p_unit, p_min_threshold, p_expiration_date, p_barcode
    ) RETURNING * INTO v_new_item;

    RETURN to_jsonb(v_new_item);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7. Edit Item (Security Definer)
CREATE OR REPLACE FUNCTION public.execute_edit_item(
    p_id uuid,
    p_name_en text,
    p_name_ar text,
    p_description text,
    p_category text,
    p_quantity numeric,
    p_unit text,
    p_min_threshold numeric,
    p_expiration_date text,
    p_barcode text
) RETURNS void AS $$
BEGIN
    UPDATE public.inventory_items 
    SET 
        name_en = p_name_en,
        name_ar = p_name_ar,
        description = p_description,
        category = p_category,
        quantity = p_quantity,
        unit = p_unit,
        min_threshold = p_min_threshold,
        expiration_date = p_expiration_date,
        barcode = p_barcode,
        last_updated = now()
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 8. Delete Items (Security Definer)
CREATE OR REPLACE FUNCTION public.execute_delete_items(
    p_item_ids uuid[]
) RETURNS void AS $$
BEGIN
    DELETE FROM public.inventory_items WHERE id = ANY(p_item_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 9. Bulk Edit Items (Security Definer)
CREATE OR REPLACE FUNCTION public.execute_bulk_edit_items(
    p_item_ids uuid[],
    p_updates jsonb
) RETURNS void AS $$
BEGIN
    UPDATE public.inventory_items 
    SET 
        category = COALESCE((p_updates->>'category'), category),
        unit = COALESCE((p_updates->>'unit'), unit),
        min_threshold = COALESCE((p_updates->>'min_threshold')::numeric, min_threshold),
        last_updated = now()
    WHERE id = ANY(p_item_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 10. Clean Up Transactions (Security Definer)
CREATE OR REPLACE FUNCTION public.execute_cleanup_transactions(
    p_months integer
) RETURNS void AS $$
DECLARE
    v_cutoff_date timestamp with time zone;
BEGIN
    IF p_months <= 0 THEN
        RETURN;
    END IF;
    
    v_cutoff_date := now() - (p_months || ' month')::interval;
    
    DELETE FROM public.transactions WHERE date < v_cutoff_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Phase 2: Notifications Migration

-- 1. Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id text REFERENCES public.locations(id) ON DELETE CASCADE,
  item_id uuid, -- Optional link to inventory item or transaction
  type text NOT NULL CHECK (type IN ('low_stock', 'transfer', 'system')),
  message_en text NOT NULL,
  message_ar text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS and add public access policy
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access" ON public.notifications;
CREATE POLICY "Public Access" ON public.notifications FOR ALL USING (true);

-- 2. Trigger for Low Stock Alerts
CREATE OR REPLACE FUNCTION public.check_low_stock_and_notify()
RETURNS TRIGGER AS $$
BEGIN
  -- If quantity drops below threshold (or threshold increases)
  IF NEW.quantity <= NEW.min_threshold AND (OLD.quantity > OLD.min_threshold OR OLD.min_threshold != NEW.min_threshold) THEN
    INSERT INTO public.notifications (location_id, item_id, type, message_en, message_ar)
    VALUES (
      NEW.location_id,
      NEW.id,
      'low_stock',
      'Low Stock Alert: ' || NEW.name_en || ' has dropped to ' || NEW.quantity || ' ' || NEW.unit,
      'تنبيه نقص المخزون: ' || NEW.name_ar || ' انخفض إلى ' || NEW.quantity || ' ' || NEW.unit
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_inventory_update_check_stock ON public.inventory_items;
CREATE TRIGGER on_inventory_update_check_stock
  AFTER UPDATE OF quantity, min_threshold ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.check_low_stock_and_notify();

-- 3. Trigger for Transfer Alerts
CREATE OR REPLACE FUNCTION public.notify_target_on_transfer()
RETURNS TRIGGER AS $$
BEGIN
  -- Only notify when a transfer reaches pending_target (or if direct completed without pending source)
  IF NEW.type = 'transfer' AND NEW.status = 'pending_target' AND (OLD.status IS NULL OR OLD.status != 'pending_target') THEN
    INSERT INTO public.notifications (location_id, item_id, type, message_en, message_ar)
    VALUES (
      NEW.to_location,
      NULL,
      'transfer',
      'Incoming Transfer: ' || NEW.quantity || ' ' || NEW.unit || ' of ' || NEW.item_name_en || ' from ' || NEW.from_location,
      'تحويل قادم: ' || NEW.quantity || ' ' || NEW.unit || ' من ' || NEW.item_name_ar || ' من ' || NEW.from_location
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_transaction_insert_update_notify ON public.transactions;
CREATE TRIGGER on_transaction_insert_update_notify
  AFTER INSERT OR UPDATE OF status ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_target_on_transfer();
-- Transfer System Overhaul Migration
-- Run this in Supabase SQL Editor

-- 1. Add new columns for partial receipt tracking
ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS received_quantity numeric;

ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS receipt_notes text;

ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS item_status text 
  CHECK (item_status IN ('pending', 'received', 'partial', 'rejected', 'extra'));

ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS signature_url text;

ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS photo_urls text[];

-- 2. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_transfer_group_id 
  ON public.transactions(transfer_group_id) 
  WHERE transfer_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_status 
  ON public.transactions(status);

CREATE INDEX IF NOT EXISTS idx_transactions_type_status 
  ON public.transactions(type, status);

-- 3. Admin Settings Table for feature toggles
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}',
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access" ON public.app_settings;
CREATE POLICY "Public Access" ON public.app_settings FOR ALL USING (true);

-- Seed default transfer settings
INSERT INTO public.app_settings (key, value) VALUES (
  'transfer_settings',
  '{"enableSignatureCapture": false, "enablePhotoEvidence": false, "enableAutoReject": false, "autoRejectDays": 7}'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- 4. Atomic group-level receive RPC
CREATE OR REPLACE FUNCTION public.receive_transfer_group(
  p_transfer_group_id text,
  p_items jsonb,
  p_signature_url text DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_item jsonb;
  v_tx record;
  v_received_qty numeric;
  v_item_status text;
  v_receipt_notes text;
  v_photo_urls text[];
BEGIN
  -- Process each item in the group
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_received_qty := (v_item->>'receivedQuantity')::numeric;
    v_item_status := v_item->>'itemStatus';
    v_receipt_notes := v_item->>'receiptNotes';
    
    -- Parse photo URLs if present
    IF v_item ? 'photoUrls' AND v_item->'photoUrls' IS NOT NULL THEN
      SELECT array_agg(elem::text) INTO v_photo_urls
      FROM jsonb_array_elements_text(v_item->'photoUrls') AS elem;
    ELSE
      v_photo_urls := NULL;
    END IF;

    -- Get the transaction record
    SELECT * INTO v_tx FROM public.transactions 
    WHERE id = (v_item->>'transactionId')::uuid 
      AND transfer_group_id = p_transfer_group_id
      AND status = 'pending_target';
    
    IF v_tx IS NULL THEN
      CONTINUE;
    END IF;

    -- Update the transaction with receipt details
    UPDATE public.transactions SET
      received_quantity = v_received_qty,
      item_status = v_item_status,
      receipt_notes = v_receipt_notes,
      signature_url = p_signature_url,
      photo_urls = v_photo_urls,
      status = 'completed'
    WHERE id = v_tx.id;

    -- Update destination inventory based on received quantity
    IF v_item_status IN ('received', 'partial', 'extra') AND v_received_qty > 0 THEN
      -- Try to find existing item at destination
      IF EXISTS (
        SELECT 1 FROM public.inventory_items 
        WHERE location_id = v_tx.to_location 
          AND (name_en = v_tx.item_name_en OR name_ar = v_tx.item_name_ar)
      ) THEN
        UPDATE public.inventory_items 
        SET quantity = quantity + v_received_qty,
            last_updated = now()
        WHERE location_id = v_tx.to_location 
          AND (name_en = v_tx.item_name_en OR name_ar = v_tx.item_name_ar);
      ELSE
        -- Create item at destination
        INSERT INTO public.inventory_items (
          location_id, name_en, name_ar, category, quantity, unit, min_threshold
        ) 
        SELECT v_tx.to_location, v_tx.item_name_en, v_tx.item_name_ar, 
               COALESCE(ii.category, 'Uncategorized'), v_received_qty, v_tx.unit,
               COALESCE(ii.min_threshold, 0)
        FROM (SELECT 1) AS dummy
        LEFT JOIN public.inventory_items ii 
          ON ii.name_en = v_tx.item_name_en AND ii.location_id = v_tx.from_location
        LIMIT 1;
      END IF;
    END IF;

    -- Restore difference to source if partial or rejected
    IF v_item_status = 'partial' AND v_received_qty < v_tx.quantity THEN
      UPDATE public.inventory_items 
      SET quantity = quantity + (v_tx.quantity - v_received_qty),
          last_updated = now()
      WHERE location_id = v_tx.from_location 
        AND (name_en = v_tx.item_name_en OR name_ar = v_tx.item_name_ar);
    ELSIF v_item_status = 'rejected' THEN
      UPDATE public.inventory_items 
      SET quantity = quantity + v_tx.quantity,
          last_updated = now()
      WHERE location_id = v_tx.from_location 
        AND (name_en = v_tx.item_name_en OR name_ar = v_tx.item_name_ar);
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Atomic group-level reject RPC
CREATE OR REPLACE FUNCTION public.reject_transfer_group(
  p_transfer_group_id text,
  p_reason text
) RETURNS void AS $$
DECLARE
  v_tx record;
BEGIN
  FOR v_tx IN 
    SELECT * FROM public.transactions 
    WHERE transfer_group_id = p_transfer_group_id 
      AND status = 'pending_target'
  LOOP
    -- Update transaction status
    UPDATE public.transactions SET
      status = 'rejected',
      item_status = 'rejected',
      rejection_reason = p_reason,
      received_quantity = 0
    WHERE id = v_tx.id;

    -- Restore source inventory
    UPDATE public.inventory_items 
    SET quantity = quantity + v_tx.quantity,
        last_updated = now()
    WHERE location_id = v_tx.from_location 
      AND (name_en = v_tx.item_name_en OR name_ar = v_tx.item_name_ar);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Atomic group-level confirm (source approval) RPC
CREATE OR REPLACE FUNCTION public.confirm_transfer_group(
  p_transfer_group_id text
) RETURNS void AS $$
BEGIN
  UPDATE public.transactions SET
    status = 'pending_target'
  WHERE transfer_group_id = p_transfer_group_id 
    AND status = 'pending_source';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Auto-reject expired transfers function
CREATE OR REPLACE FUNCTION public.auto_reject_expired_transfers(
  p_days integer
) RETURNS integer AS $$
DECLARE
  v_count integer := 0;
  v_group record;
BEGIN
  FOR v_group IN
    SELECT DISTINCT transfer_group_id 
    FROM public.transactions 
    WHERE status = 'pending_target' 
      AND type = 'transfer'
      AND transfer_group_id IS NOT NULL
      AND date < now() - (p_days || ' days')::interval
  LOOP
    PERFORM public.reject_transfer_group(
      v_group.transfer_group_id, 
      'Auto-rejected: Not acted upon within ' || p_days || ' days'
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Phase 3: Supplier & Purchase Order Management Migration

-- 1. Create Suppliers Table
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_en text NOT NULL,
  name_ar text NOT NULL,
  contact_person text,
  email text,
  phone text,
  address text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access" ON public.suppliers;
CREATE POLICY "Public Access" ON public.suppliers FOR ALL USING (true);

-- 2. Create Purchase Orders Table
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_number text UNIQUE NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('draft', 'pending', 'approved', 'received', 'cancelled')),
  expected_delivery date,
  total_amount numeric DEFAULT 0,
  notes text,
  created_by text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access" ON public.purchase_orders;
CREATE POLICY "Public Access" ON public.purchase_orders FOR ALL USING (true);

-- 3. Create Purchase Order Items Table
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id uuid REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  item_name_en text NOT NULL,
  item_name_ar text NOT NULL,
  quantity numeric NOT NULL,
  received_quantity numeric DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  total_price numeric NOT NULL DEFAULT 0
);

ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access" ON public.purchase_order_items;
CREATE POLICY "Public Access" ON public.purchase_order_items FOR ALL USING (true);

-- 4. Create trigger to update PO total_amount on item changes
CREATE OR REPLACE FUNCTION public.update_po_total_amount()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.purchase_orders
    SET total_amount = (SELECT COALESCE(SUM(total_price), 0) FROM public.purchase_order_items WHERE po_id = OLD.po_id),
        updated_at = now()
    WHERE id = OLD.po_id;
    RETURN OLD;
  ELSE
    UPDATE public.purchase_orders
    SET total_amount = (SELECT COALESCE(SUM(total_price), 0) FROM public.purchase_order_items WHERE po_id = NEW.po_id),
        updated_at = now()
    WHERE id = NEW.po_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_po_total ON public.purchase_order_items;
CREATE TRIGGER trigger_update_po_total
AFTER INSERT OR UPDATE OR DELETE ON public.purchase_order_items
FOR EACH ROW EXECUTE FUNCTION public.update_po_total_amount();


-- 5. RPC Function to receive Purchase Order items into inventory
CREATE OR REPLACE FUNCTION public.receive_purchase_order(
  p_po_id uuid,
  p_items jsonb, -- Array of { id: uuid, received_quantity: numeric }
  p_performed_by text
) RETURNS void AS $$
DECLARE
  v_item record;
  v_json_item jsonb;
  v_req_qty numeric;
  v_po_status text;
  v_all_received boolean := true;
BEGIN
  -- Check PO status
  SELECT status INTO v_po_status FROM public.purchase_orders WHERE id = p_po_id;
  IF v_po_status NOT IN ('approved', 'pending') THEN
    RAISE EXCEPTION 'Purchase order cannot be received in its current status: %', v_po_status;
  END IF;

  -- Process each item from input
  FOR v_json_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_req_qty := (v_json_item->>'received_quantity')::numeric;

    -- Get PO item details
    SELECT * INTO v_item FROM public.purchase_order_items 
    WHERE id = (v_json_item->>'id')::uuid AND po_id = p_po_id;

    IF v_item IS NOT NULL AND v_req_qty > 0 THEN
      -- 1. Update received_quantity in PO items
      UPDATE public.purchase_order_items 
      SET received_quantity = COALESCE(received_quantity, 0) + v_req_qty
      WHERE id = v_item.id;

      -- 2. Add to warehouse inventory
      IF EXISTS (
        SELECT 1 FROM public.inventory_items 
        WHERE location_id = 'warehouse' 
          AND (name_en = v_item.item_name_en OR name_ar = v_item.item_name_ar)
      ) THEN
        UPDATE public.inventory_items 
        SET quantity = quantity + v_req_qty,
            last_updated = now()
        WHERE location_id = 'warehouse' 
          AND (name_en = v_item.item_name_en OR name_ar = v_item.item_name_ar);
      ELSE
        -- Create new item in warehouse (look up unit and category from catalog if possible, otherwise default)
        INSERT INTO public.inventory_items (
          location_id, name_en, name_ar, category, quantity, unit, min_threshold
        ) 
        SELECT 'warehouse', v_item.item_name_en, v_item.item_name_ar, 
               COALESCE((SELECT category FROM public.product_catalog WHERE name_en = v_item.item_name_en LIMIT 1), 'Uncategorized'), 
               v_req_qty, 
               COALESCE((SELECT unit FROM public.product_catalog WHERE name_en = v_item.item_name_en LIMIT 1), 'pcs'),
               0;
      END IF;

      -- 3. Log the transaction
      INSERT INTO public.transactions (
        type, status, to_location, item_name_en, item_name_ar, quantity, unit, performed_by, notes
      ) VALUES (
        'receive', 'completed', 'warehouse', v_item.item_name_en, v_item.item_name_ar, v_req_qty, 
        COALESCE((SELECT unit FROM public.product_catalog WHERE name_en = v_item.item_name_en LIMIT 1), 'pcs'),
        p_performed_by, 'Received from PO: ' || (SELECT po_number FROM public.purchase_orders WHERE id = p_po_id)
      );
    END IF;
  END LOOP;

  -- Update PO Status to received if all quantities match (simplified logic: just mark received for now, or partial)
  UPDATE public.purchase_orders 
  SET status = 'received',
      updated_at = now()
  WHERE id = p_po_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Phase 4: Cycle Counting & Audit Module Migration

-- 1. Create Audits Table
CREATE TABLE IF NOT EXISTS public.audits (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  location_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('scheduled', 'in_progress', 'pending_review', 'completed', 'cancelled')),
  scheduled_date date,
  completed_date timestamp with time zone,
  created_by text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access" ON public.audits;
CREATE POLICY "Public Access" ON public.audits FOR ALL USING (true);

-- 2. Create Audit Items Table
CREATE TABLE IF NOT EXISTS public.audit_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_id uuid REFERENCES public.audits(id) ON DELETE CASCADE,
  item_id uuid, -- Reference to inventory_items (but could be nullable if item doesn't exist yet)
  item_name_en text NOT NULL,
  item_name_ar text NOT NULL,
  category text,
  unit text,
  expected_quantity numeric NOT NULL,
  counted_quantity numeric,
  variance numeric,
  notes text
);

ALTER TABLE public.audit_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access" ON public.audit_items;
CREATE POLICY "Public Access" ON public.audit_items FOR ALL USING (true);

-- 3. Trigger to auto-calculate variance
CREATE OR REPLACE FUNCTION public.calculate_audit_variance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.counted_quantity IS NOT NULL THEN
    NEW.variance = NEW.counted_quantity - NEW.expected_quantity;
  ELSE
    NEW.variance = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_variance ON public.audit_items;
CREATE TRIGGER trigger_calculate_variance
BEFORE INSERT OR UPDATE ON public.audit_items
FOR EACH ROW EXECUTE FUNCTION public.calculate_audit_variance();


-- 4. RPC Function to Apply Audit Variances (Only Admin)
CREATE OR REPLACE FUNCTION public.apply_audit_variances(
  p_audit_id uuid,
  p_performed_by text
) RETURNS void AS $$
DECLARE
  v_audit record;
  v_item record;
  v_transaction_type text;
  v_adjustment numeric;
BEGIN
  -- Check Audit
  SELECT * INTO v_audit FROM public.audits WHERE id = p_audit_id;
  IF v_audit IS NULL THEN
    RAISE EXCEPTION 'Audit not found';
  END IF;
  
  IF v_audit.status != 'pending_review' THEN
    RAISE EXCEPTION 'Audit must be in pending_review status to apply variances';
  END IF;

  -- Process Items
  FOR v_item IN SELECT * FROM public.audit_items WHERE audit_id = p_audit_id AND variance IS NOT NULL AND variance != 0
  LOOP
    -- Calculate adjustment
    v_adjustment := ABS(v_item.variance);
    IF v_item.variance > 0 THEN
      v_transaction_type := 'receive';
    ELSE
      v_transaction_type := 'usage';
    END IF;

    -- Adjust Inventory
    IF EXISTS (
      SELECT 1 FROM public.inventory_items 
      WHERE location_id = v_audit.location_id 
        AND (name_en = v_item.item_name_en OR name_ar = v_item.item_name_ar)
    ) THEN
      UPDATE public.inventory_items 
      SET quantity = v_item.counted_quantity,
          last_updated = now()
      WHERE location_id = v_audit.location_id 
        AND (name_en = v_item.item_name_en OR name_ar = v_item.item_name_ar);
    ELSE
      -- Create item if it doesn't exist but has a count > 0
      IF v_item.counted_quantity > 0 THEN
        INSERT INTO public.inventory_items (
          location_id, name_en, name_ar, category, quantity, unit, min_threshold
        ) VALUES (
          v_audit.location_id, v_item.item_name_en, v_item.item_name_ar, 
          COALESCE(v_item.category, 'Uncategorized'), v_item.counted_quantity, COALESCE(v_item.unit, 'pcs'), 0
        );
      END IF;
    END IF;

    -- Log transaction
    INSERT INTO public.transactions (
      type, status, from_location, to_location, item_name_en, item_name_ar, quantity, unit, performed_by, notes
    ) VALUES (
      v_transaction_type, 'completed', 
      CASE WHEN v_transaction_type = 'usage' THEN v_audit.location_id ELSE NULL END,
      CASE WHEN v_transaction_type = 'receive' THEN v_audit.location_id ELSE NULL END,
      v_item.item_name_en, v_item.item_name_ar, v_adjustment, COALESCE(v_item.unit, 'pcs'), p_performed_by, 
      'Audit Auto-Correction for Audit: ' || v_audit.title
    );
  END LOOP;

  -- Mark Audit Completed
  UPDATE public.audits 
  SET status = 'completed',
      completed_date = now(),
      updated_at = now()
  WHERE id = p_audit_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
