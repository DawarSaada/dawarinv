-- Phase 8: Product data integrity
--
-- Apply AFTER scripts/catalog-doctor.mjs --apply has cleaned the existing rows,
-- and after phase7_integrity_migration.sql.
--
-- Why this exists:
--   inventory_items is unique on (location_id, name_en) — exact text. "Dry tissue "
--   and "Dry Tissue " are therefore two different products, which is how the same
--   item ended up stored twice (88 redundant rows were merged by catalog-doctor).
--   The app also accepted a free-text unit, producing 54 spellings of ~6 units
--   including 45x "Peace" for "Piece".
--
-- This migration makes the duplicate case impossible to create again and trims
-- on write. It is safe to re-run.

begin;

-- ---------------------------------------------------------------------------
-- 1. Normalise what is already stored (defensive: catalog-doctor already did this)
-- ---------------------------------------------------------------------------
update public.inventory_items
set name_en = btrim(regexp_replace(name_en, '\s+', ' ', 'g'))
where name_en <> btrim(regexp_replace(name_en, '\s+', ' ', 'g'));

update public.inventory_items
set name_ar = btrim(regexp_replace(name_ar, '\s+', ' ', 'g'))
where name_ar <> btrim(regexp_replace(name_ar, '\s+', ' ', 'g'));

update public.product_catalog
set name_en = btrim(regexp_replace(name_en, '\s+', ' ', 'g'))
where name_en <> btrim(regexp_replace(name_en, '\s+', ' ', 'g'));

-- Fail loudly instead of silently skipping if duplicates somehow remain: the
-- indexes below would otherwise be created but not enforced.
do $$
declare
  v_dupes integer;
begin
  select count(*) into v_dupes from (
    select location_id, lower(btrim(name_en))
    from public.inventory_items
    group by 1, 2 having count(*) > 1
  ) d;
  if v_dupes > 0 then
    raise exception 'Still % duplicate (location, name_en) group(s). Run scripts/catalog-doctor.mjs --apply first.', v_dupes;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. No leading/trailing whitespace, ever
-- ---------------------------------------------------------------------------
alter table public.inventory_items
  drop constraint if exists inventory_items_name_en_trimmed;
alter table public.inventory_items
  add constraint inventory_items_name_en_trimmed check (name_en = btrim(name_en) and name_en <> '');

alter table public.inventory_items
  drop constraint if exists inventory_items_name_ar_trimmed;
alter table public.inventory_items
  add constraint inventory_items_name_ar_trimmed check (name_ar = btrim(name_ar));

-- ---------------------------------------------------------------------------
-- 3. One product per location, case- and whitespace-insensitive
-- ---------------------------------------------------------------------------
create unique index if not exists inventory_items_location_name_en_ci
  on public.inventory_items (location_id, lower(btrim(name_en)));

-- Arabic names may legitimately be blank on some rows, so only enforce the ones set.
create unique index if not exists inventory_items_location_name_ar_ci
  on public.inventory_items (location_id, lower(btrim(name_ar)))
  where btrim(name_ar) <> '';

-- ---------------------------------------------------------------------------
-- 4. Trim on write, and turn a duplicate into a message the UI can show
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
        -- inventory_items.expiration_date is `date` in the live database (supabase_schema.sql
        -- declares it text). The parameter is text, so it must be cast explicitly: Postgres
        -- does not implicitly cast text to date in an INSERT, and passing it raw made every
        -- add fail with 42804 "column \"expiration_date\" is of type date but expression is of
        -- type text". Empty string is treated as "no expiry".
        nullif(btrim(p_expiration_date), '')::date, nullif(btrim(p_barcode), '')
    ) RETURNING * INTO v_new_item;

    RETURN to_jsonb(v_new_item);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
        -- Kept because the edit dialog exposes a quantity field, and staff use it to
        -- correct a count. Note this writes stock without a matching ledger entry;
        -- routing corrections through the movement RPCs is a roadmap item (see the
        -- "write history" risk in PRODUCTION_AUDIT.md).
        quantity = greatest(coalesce(p_quantity, 0), 0),
        unit = btrim(p_unit),
        min_threshold = greatest(coalesce(p_min_threshold, 0), 0),
        -- Cast for the same 42804 reason as execute_add_item above.
        expiration_date = nullif(btrim(p_expiration_date), '')::date,
        barcode = nullif(btrim(p_barcode), ''),
        last_updated = now()
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

commit;

-- Also worth adding once the product identity work lands:
--   alter table public.inventory_items add column catalog_id uuid references public.product_catalog(id);
-- See the product-identity risk in PRODUCTION_AUDIT.md.
