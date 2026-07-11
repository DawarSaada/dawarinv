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

