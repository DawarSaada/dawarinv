-- oms_sync_rpc.sql
-- Database RPCs for syncing DawarSaadaOMS orders with dawarsaada-inventory.

-- 1. Dispatch Sync RPC
CREATE OR REPLACE FUNCTION public.execute_oms_dispatch(
    p_order_id text,
    p_from_location text,
    p_to_location text,
    p_items jsonb, -- Array of { nameEn, nameAr, quantity, unit }
    p_performed_by text
) RETURNS void AS $$
DECLARE
    v_transfer_group_id text;
    v_item jsonb;
    v_quantity numeric;
    v_unit text;
    v_name_en text;
    v_name_ar text;
    v_item_id uuid;
    v_category text;
    v_old_tx record;
BEGIN
    v_transfer_group_id := 'OMS-' || p_order_id;

    -- Revert any existing pending target transactions for this order to prevent double-deduction on retry
    FOR v_old_tx IN 
        SELECT item_name_en, item_name_ar, quantity FROM public.transactions 
        WHERE transfer_group_id = v_transfer_group_id AND status = 'pending_target'
    LOOP
        UPDATE public.inventory_items 
        SET quantity = quantity + v_old_tx.quantity 
        WHERE location_id = p_from_location 
          AND (name_en = v_old_tx.item_name_en OR name_ar = v_old_tx.item_name_ar);
    END LOOP;

    -- Delete old pending transactions for this order
    DELETE FROM public.transactions 
    WHERE transfer_group_id = v_transfer_group_id AND status = 'pending_target';

    -- Process new items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_quantity := (v_item->>'quantity')::numeric;
        v_unit := v_item->>'unit';
        v_name_en := v_item->>'nameEn';
        v_name_ar := v_item->>'nameAr';

        -- Find item at source location
        SELECT id INTO v_item_id FROM public.inventory_items 
        WHERE location_id = p_from_location 
          AND (name_en = v_name_en OR name_ar = v_name_ar)
        LIMIT 1;

        IF v_item_id IS NOT NULL THEN
            UPDATE public.inventory_items 
            SET quantity = quantity - v_quantity 
            WHERE id = v_item_id;
        ELSE
            -- Find category or default to Uncategorized
            SELECT category INTO v_category FROM public.product_catalog WHERE name_en = v_name_en LIMIT 1;
            IF v_category IS NULL THEN
                SELECT category INTO v_category FROM public.inventory_items WHERE name_en = v_name_en AND category NOT IN ('Received', 'Returned') LIMIT 1;
            END IF;
            IF v_category IS NULL THEN
                v_category := 'Uncategorized';
            END IF;

            -- Create the item at source with negative stock
            INSERT INTO public.inventory_items (location_id, name_en, name_ar, category, quantity, unit, min_threshold)
            VALUES (p_from_location, v_name_en, v_name_ar, v_category, 0 - v_quantity, v_unit, 0);
        END IF;

        -- Insert transaction record
        INSERT INTO public.transactions (
            transfer_group_id, date, type, status, from_location, to_location,
            item_name_en, item_name_ar, quantity, unit, performed_by, notes
        ) VALUES (
            v_transfer_group_id, now(), 'transfer', 'pending_target', p_from_location, p_to_location,
            v_name_en, v_name_ar, v_quantity, v_unit, p_performed_by, 'OMS Order Dispatch Sync'
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Receive Sync RPC
CREATE OR REPLACE FUNCTION public.execute_oms_receive(
    p_order_id text,
    p_performed_by text
) RETURNS void AS $$
DECLARE
    v_tx record;
BEGIN
    -- Loop through all pending transactions for this order and receive them
    FOR v_tx IN 
        SELECT id FROM public.transactions 
        WHERE transfer_group_id = 'OMS-' || p_order_id 
          AND status = 'pending_target'
    LOOP
        PERFORM public.receive_transfer(v_tx.id);
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Cancel Sync RPC
CREATE OR REPLACE FUNCTION public.execute_oms_cancel(
    p_order_id text,
    p_reason text
) RETURNS void AS $$
DECLARE
    v_tx record;
BEGIN
    -- Revert all pending transactions for this order (returns stock to source)
    FOR v_tx IN 
        SELECT id FROM public.transactions 
        WHERE transfer_group_id = 'OMS-' || p_order_id 
          AND status = 'pending_target'
    LOOP
        PERFORM public.reject_transfer(v_tx.id, p_reason);
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
