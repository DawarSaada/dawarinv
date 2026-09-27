-- 20260927_update_oms_dispatch_rpc.sql
-- Upgraded execute_oms_dispatch function:
-- 1. Case-insensitive and trimmed matching for item names (lower(btrim(...)))
-- 2. Two-pass execution: checks that all items exist and have sufficient stock before deducting anything
-- 3. If any item is missing or short, aborts cleanly with a detailed descriptive exception rather than violating check constraints

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
    v_available_qty numeric;
    v_old_tx record;
    v_shortages text := '';
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
          AND (lower(btrim(name_en)) = lower(btrim(v_old_tx.item_name_en)) 
               OR (v_old_tx.item_name_ar IS NOT NULL AND lower(btrim(name_ar)) = lower(btrim(v_old_tx.item_name_ar))));
    END LOOP;

    -- Delete old pending transactions for this order
    DELETE FROM public.transactions 
    WHERE transfer_group_id = v_transfer_group_id AND status = 'pending_target';

    -- Pass 1: Verify all items exist and have sufficient stock at source
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_quantity := (v_item->>'quantity')::numeric;
        v_unit := v_item->>'unit';
        v_name_en := v_item->>'nameEn';
        v_name_ar := v_item->>'nameAr';

        SELECT id, quantity INTO v_item_id, v_available_qty 
        FROM public.inventory_items 
        WHERE location_id = p_from_location 
          AND (lower(btrim(name_en)) = lower(btrim(v_name_en))
               OR (v_name_ar IS NOT NULL AND btrim(v_name_ar) <> '' AND lower(btrim(name_ar)) = lower(btrim(v_name_ar))))
        LIMIT 1;

        IF v_item_id IS NULL THEN
            v_shortages := v_shortages || format('• %s: Non-existent in inventory (Req: %s %s); ', v_name_en, v_quantity, v_unit);
        ELSIF v_available_qty < v_quantity THEN
            v_shortages := v_shortages || format('• %s: Req %s %s, Avail %s (Short: %s); ', v_name_en, v_quantity, v_unit, v_available_qty, v_quantity - v_available_qty);
        END IF;
    END LOOP;

    -- If any shortages exist, abort transaction with detailed message
    IF v_shortages <> '' THEN
        RAISE EXCEPTION 'STOCK_SHORTAGE: %', v_shortages;
    END IF;

    -- Pass 2: Deduct stock and record transactions
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_quantity := (v_item->>'quantity')::numeric;
        v_unit := v_item->>'unit';
        v_name_en := v_item->>'nameEn';
        v_name_ar := v_item->>'nameAr';

        -- Deduct from source
        UPDATE public.inventory_items 
        SET quantity = quantity - v_quantity,
            last_updated = now()
        WHERE location_id = p_from_location 
          AND (lower(btrim(name_en)) = lower(btrim(v_name_en))
               OR (v_name_ar IS NOT NULL AND btrim(v_name_ar) <> '' AND lower(btrim(name_ar)) = lower(btrim(v_name_ar))));

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
