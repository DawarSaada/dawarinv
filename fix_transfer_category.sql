-- Fix issue where category becomes 'Received' or 'Returned' on transfer.
-- 1. Redefine receive_transfer
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


-- 2. Redefine reject_transfer
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


-- 3. Update existing records that have wrong categories
UPDATE public.inventory_items
SET category = COALESCE(
    (SELECT category FROM public.product_catalog WHERE product_catalog.name_en = inventory_items.name_en LIMIT 1),
    (SELECT category FROM public.inventory_items ii2 WHERE ii2.name_en = inventory_items.name_en AND ii2.category NOT IN ('Received', 'Returned') LIMIT 1),
    'Uncategorized'
)
WHERE category IN ('Received', 'Returned');
