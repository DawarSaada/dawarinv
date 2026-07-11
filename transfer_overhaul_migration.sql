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
