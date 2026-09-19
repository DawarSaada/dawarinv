-- Phase 11: fix "add item" and "edit item" — they are broken right now
--
-- Run this in the Supabase SQL editor. It changes two function bodies and nothing
-- else: no table is altered, no row is read or written.
--
-- Why this is urgent
-- ------------------
-- Both RPCs pass a parameter declared `text` straight into a column that is `date`
-- in the live database:
--
--     p_expiration_date text
--     ...
--     INSERT INTO public.inventory_items (..., expiration_date, ...)
--     VALUES (..., p_expiration_date, ...)
--
-- Postgres does not implicitly cast text to date there, so *every* call fails:
--
--     42804  column "expiration_date" is of type date but expression is of type text
--
-- The failure is at plan time, so it happens before the row is touched and before
-- any other check — it does not matter whether the caller passes a date or NULL.
-- Verified against the live project: execute_add_item and execute_edit_item both
-- return 42804 for every payload, which means adding an item from the catalog and
-- editing an existing item have both been impossible through the UI.
--
-- supabase_schema.sql declares expiration_date as `text`, but the database has it
-- as `date`. Casting in the functions is the fix that works either way, so it does
-- not matter which type wins when you eventually reconcile the schema.
--
-- phase8_product_integrity.sql carries the same two functions with the same cast,
-- so applying phase8 later will not reintroduce the bug. This migration exists
-- separately because phase8 must wait for scripts/catalog-doctor.mjs --apply to
-- clean the duplicate rows first, and this cannot wait.

begin;

-- ---------------------------------------------------------------------------
-- 1. execute_add_item — trims, refuses duplicates, clamps, casts the date
-- ---------------------------------------------------------------------------
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
    v_name_en text := btrim(regexp_replace(coalesce(p_name_en, ''), '\s+', ' ', 'g'));
    v_name_ar text := btrim(regexp_replace(coalesce(p_name_ar, ''), '\s+', ' ', 'g'));
BEGIN
    IF v_name_en = '' THEN
        RAISE EXCEPTION 'The product name cannot be empty.' USING ERRCODE = 'check_violation';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.inventory_items
        WHERE location_id = p_location_id
          AND (lower(btrim(name_en)) = lower(v_name_en)
               OR (v_name_ar <> '' AND lower(btrim(name_ar)) = lower(v_name_ar)))
    ) THEN
        RAISE EXCEPTION 'A product with this name already exists at this location.' USING ERRCODE = 'unique_violation';
    END IF;

    INSERT INTO public.inventory_items (
        location_id, name_en, name_ar, description, category, quantity, unit, min_threshold, expiration_date, barcode
    ) VALUES (
        p_location_id, v_name_en, v_name_ar, btrim(p_description),
        btrim(coalesce(nullif(btrim(p_category), ''), 'Uncategorized')),
        greatest(coalesce(p_quantity, 0), 0), btrim(p_unit),
        greatest(coalesce(p_min_threshold, 0), 0),
        -- The fix: text -> date explicitly. Empty string means "no expiry".
        nullif(btrim(p_expiration_date), '')::date,
        nullif(btrim(p_barcode), '')
    ) RETURNING * INTO v_new_item;

    RETURN to_jsonb(v_new_item);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 2. execute_edit_item — same cast, plus the same duplicate guard
-- ---------------------------------------------------------------------------
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
DECLARE
    v_location text;
    v_name_en text := btrim(regexp_replace(coalesce(p_name_en, ''), '\s+', ' ', 'g'));
    v_name_ar text := btrim(regexp_replace(coalesce(p_name_ar, ''), '\s+', ' ', 'g'));
BEGIN
    SELECT location_id INTO v_location FROM public.inventory_items WHERE id = p_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item % not found.', p_id USING ERRCODE = 'no_data_found';
    END IF;

    IF v_name_en = '' THEN
        RAISE EXCEPTION 'The product name cannot be empty.' USING ERRCODE = 'check_violation';
    END IF;

    -- Renaming onto another product's name would silently create a duplicate.
    IF EXISTS (
        SELECT 1 FROM public.inventory_items
        WHERE location_id = v_location AND id <> p_id
          AND (lower(btrim(name_en)) = lower(v_name_en)
               OR (v_name_ar <> '' AND lower(btrim(name_ar)) = lower(v_name_ar)))
    ) THEN
        RAISE EXCEPTION 'Another product at this location already uses this name.' USING ERRCODE = 'unique_violation';
    END IF;

    UPDATE public.inventory_items
    SET
        name_en = v_name_en,
        name_ar = v_name_ar,
        description = btrim(p_description),
        category = btrim(coalesce(nullif(btrim(p_category), ''), 'Uncategorized')),
        -- The edit dialog exposes a quantity field and staff use it to correct a count.
        -- Note this writes stock without a matching ledger entry; routing corrections
        -- through the movement RPCs is a roadmap item (see PRODUCTION_AUDIT.md).
        quantity = greatest(coalesce(p_quantity, 0), 0),
        unit = btrim(p_unit),
        min_threshold = greatest(coalesce(p_min_threshold, 0), 0),
        expiration_date = nullif(btrim(p_expiration_date), '')::date,
        barcode = nullif(btrim(p_barcode), ''),
        last_updated = now()
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

commit;

-- ---------------------------------------------------------------------------
-- Verify — both should succeed, and the second should return the new row.
-- ---------------------------------------------------------------------------
--   select public.execute_add_item('warehouse', '__probe_delete_me__', '', '', 'Probe',
--                                  1, 'piece', 0, null, null);
--   select public.execute_edit_item(
--     (select id from public.inventory_items where name_en = '__probe_delete_me__'),
--     '__probe_delete_me__', '', '', 'Probe', 2, 'piece', 0, '2026-12-31', null);
--   select name_en, quantity, expiration_date from public.inventory_items
--   where name_en = '__probe_delete_me__';
--   delete from public.inventory_items where name_en = '__probe_delete_me__';
