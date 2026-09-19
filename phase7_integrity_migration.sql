-- Phase 7: Stock integrity fixes
--
-- Apply with the Supabase SQL editor, or:
--   node run_mig.js phase7_integrity_migration.sql
--
-- Three live defects are fixed here:
--   1. inventory_items.quantity had no lower bound, and execute_daily_log()
--      subtracted usage without checking stock, so 71 items were sitting at
--      negative quantities (as low as -2735).
--   2. The same function is now guarded, so over-issuing raises a readable error
--      instead of quietly going negative.
--   3. receive_purchase_order() hardcoded 'warehouse' and marked a partially
--      received order as 'received'. It now credits the PO's own location, caps
--      each line at the ordered quantity, and reports whether the order is
--      complete.
--
-- Run this in ONE transaction. It is safe to re-run.

begin;

-- ---------------------------------------------------------------------------
-- 1. Preserve the evidence before repairing anything
-- ---------------------------------------------------------------------------
create table if not exists public.inventory_negative_stock_backup (
  id uuid primary key,
  location_id text,
  name_en text,
  name_ar text,
  quantity numeric,
  unit text,
  captured_at timestamptz default now()
);

insert into public.inventory_negative_stock_backup (id, location_id, name_en, name_ar, quantity, unit)
select i.id, i.location_id, i.name_en, i.name_ar, i.quantity, i.unit
from public.inventory_items i
where i.quantity < 0
on conflict (id) do update
  set quantity = excluded.quantity, captured_at = now();

do $$
declare
  v_count integer;
  v_total numeric;
begin
  select count(*), coalesce(sum(quantity), 0) into v_count, v_total
  from public.inventory_items where quantity < 0;
  if v_count > 0 then
    raise notice 'Repairing % items with negative stock (sum %). Originals saved in inventory_negative_stock_backup — do a physical count for these.', v_count, v_total;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Repair, then forbid negative stock
-- ---------------------------------------------------------------------------
-- Negative stock is not a state this system can reason about (thresholds, totals
-- and transfers all assume >= 0), so the ledger is clamped and the item is left
-- for a stocktake. The backup table above holds the original figures.
update public.inventory_items set quantity = 0 where quantity < 0;

alter table public.inventory_items
  drop constraint if exists inventory_items_quantity_nonnegative;
alter table public.inventory_items
  add constraint inventory_items_quantity_nonnegative check (quantity >= 0);

alter table public.inventory_items
  drop constraint if exists inventory_items_min_threshold_nonnegative;
alter table public.inventory_items
  add constraint inventory_items_min_threshold_nonnegative check (min_threshold >= 0);

-- ---------------------------------------------------------------------------
-- 3. Guard execute_daily_log: no silent negatives, no negative/zero quantities
-- ---------------------------------------------------------------------------
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
    v_available numeric;
BEGIN
    FOR v_log IN SELECT * FROM jsonb_array_elements(p_logs)
    LOOP
        v_item_id := (v_log->>'itemId')::uuid;
        v_type := v_log->>'type';
        v_quantity := (v_log->>'quantity')::numeric;
        v_notes := v_log->>'notes';

        -- A zero or negative amount would move stock the wrong way.
        IF v_quantity IS NULL OR v_quantity <= 0 THEN
            RAISE EXCEPTION 'Log quantity must be greater than zero (got %).', v_quantity
              USING ERRCODE = 'check_violation';
        END IF;

        -- Lock the row so a concurrent transfer or receipt cannot interleave.
        SELECT * INTO v_item FROM public.inventory_items WHERE id = v_item_id FOR UPDATE;
        IF NOT FOUND THEN CONTINUE; END IF;

        -- Logs may only touch their own location.
        IF v_item.location_id IS DISTINCT FROM p_location THEN
            RAISE EXCEPTION 'Item "%" does not belong to location "%".', v_item.name_en, p_location
              USING ERRCODE = 'check_violation';
        END IF;

        IF v_type = 'usage' THEN
            v_available := v_item.quantity;
            IF v_quantity > v_available THEN
                -- Fails the whole batch rather than half-applying it.
                RAISE EXCEPTION 'Not enough stock for "%" at %: % % available, % requested.',
                  v_item.name_en, p_location, v_available, v_item.unit, v_quantity
                  USING ERRCODE = 'check_violation';
            END IF;
            v_new_quantity := v_available - v_quantity;
        ELSE
            v_new_quantity := v_item.quantity + v_quantity;
        END IF;

        UPDATE public.inventory_items
        SET quantity = v_new_quantity, last_updated = now()
        WHERE id = v_item_id;

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

-- ---------------------------------------------------------------------------
-- 4. Corrected receive_purchase_order
-- ---------------------------------------------------------------------------
-- Return type changes from void to jsonb, which CREATE OR REPLACE cannot do.
drop function if exists public.receive_purchase_order(uuid, jsonb, text);

CREATE OR REPLACE FUNCTION public.receive_purchase_order(
  p_po_id uuid,
  p_items jsonb, -- Array of { id: uuid, received_quantity: numeric }
  p_performed_by text
) RETURNS jsonb AS $$
DECLARE
  v_po record;
  v_json_item jsonb;
  v_item record;
  v_po_location text;
  v_req_qty numeric;
  v_apply_qty numeric;
  v_remaining numeric;
  v_total_received numeric := 0;
  v_inv_item_id uuid;
  v_unit text;
  v_all_received boolean := true;
BEGIN
  SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase order % not found.', p_po_id USING ERRCODE = 'no_data_found';
  END IF;

  -- Re-receiving a closed order would double-count stock.
  IF v_po.status IN ('received', 'cancelled') THEN
    RAISE EXCEPTION 'Purchase order % is % and cannot be received again.', v_po.po_number, v_po.status
      USING ERRCODE = 'check_violation';
  END IF;

  v_po_location := coalesce(nullif(v_po.location_id, ''), 'warehouse');

  FOR v_json_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_req_qty := coalesce((v_json_item->>'received_quantity')::numeric, 0);
    CONTINUE WHEN v_req_qty <= 0;

    -- Lock the line: p_items may list the same line twice.
    SELECT * INTO v_item FROM public.purchase_order_items
    WHERE id = (v_json_item->>'id')::uuid AND po_id = p_po_id
    FOR UPDATE;

    CONTINUE WHEN NOT FOUND;

    -- Never receive more than was ordered.
    v_remaining := v_item.quantity - coalesce(v_item.received_quantity, 0);
    v_apply_qty := least(v_req_qty, greatest(v_remaining, 0));
    CONTINUE WHEN v_apply_qty <= 0;

    -- 1. Record it against the PO line
    UPDATE public.purchase_order_items
    SET received_quantity = coalesce(received_quantity, 0) + v_apply_qty
    WHERE id = v_item.id;

    -- 2. Credit inventory at the PO's own location. Exact name match, no wildcards:
    --    a LIKE pattern would merge distinct products.
    SELECT id INTO v_inv_item_id FROM public.inventory_items
    WHERE location_id = v_po_location
      AND (name_en = v_item.item_name_en OR name_ar = v_item.item_name_ar)
    LIMIT 1;

    -- Note: purchase_order_items has no `unit` column, so the unit is resolved from
    -- the existing stock row, then the catalog, then a literal default.
    IF v_inv_item_id IS NOT NULL THEN
      UPDATE public.inventory_items
      SET quantity = quantity + v_apply_qty, last_updated = now()
      WHERE id = v_inv_item_id;

      SELECT unit INTO v_unit FROM public.inventory_items WHERE id = v_inv_item_id;
    ELSE
      SELECT unit INTO v_unit FROM public.product_catalog
      WHERE name_en = v_item.item_name_en LIMIT 1;

      INSERT INTO public.inventory_items (
        location_id, name_en, name_ar, category, quantity, unit, min_threshold, last_updated
      ) VALUES (
        v_po_location,
        v_item.item_name_en,
        coalesce(nullif(v_item.item_name_ar, ''), v_item.item_name_en),
        coalesce((SELECT category FROM public.product_catalog WHERE name_en = v_item.item_name_en LIMIT 1), 'General'),
        v_apply_qty,
        coalesce(v_unit, 'pcs'),
        coalesce((SELECT min_threshold FROM public.product_catalog WHERE name_en = v_item.item_name_en LIMIT 1), 0),
        now()
      )
      RETURNING id INTO v_inv_item_id;
    END IF;

    v_unit := coalesce(v_unit, 'pcs');

    -- 3. Ledger entry, using the same shape as execute_daily_log's receive branch
    --    so reports see PO receipts the same way. `transactions` has no item_id or
    --    location_id column — the previous client-side version wrote those names and
    --    silently dropped the row.
    INSERT INTO public.transactions (
      date, type, status, from_location, to_location,
      item_name_en, item_name_ar, quantity, unit, performed_by, notes
    ) VALUES (
      now(), 'receive', 'completed', 'External Supplier', v_po_location,
      v_item.item_name_en, v_item.item_name_ar, v_apply_qty,
      v_unit, p_performed_by,
      'Received from PO ' || v_po.po_number
    );

    v_total_received := v_total_received + v_apply_qty;
  END LOOP;

  -- 4. Only a genuinely complete order is closed. 'partial' is not an allowed
  --    status, so a partly received order keeps its current status.
  SELECT bool_and(coalesce(received_quantity, 0) >= quantity) INTO v_all_received
  FROM public.purchase_order_items WHERE po_id = p_po_id;
  v_all_received := coalesce(v_all_received, false);

  UPDATE public.purchase_orders
  SET status = CASE WHEN v_all_received THEN 'received' ELSE status END,
      updated_at = now()
  WHERE id = p_po_id;

  RETURN jsonb_build_object(
    'status', CASE WHEN v_all_received THEN 'received' ELSE v_po.status END,
    'received', v_total_received,
    'fully_received', v_all_received,
    'location_id', v_po_location
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

commit;

-- Sanity check after applying:
--   select count(*) from public.inventory_items where quantity < 0;            -- 0
--   select * from public.inventory_negative_stock_backup order by quantity;     -- the 71 repaired rows
--   select status, count(*) from public.purchase_orders group by status;
