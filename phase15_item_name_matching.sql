-- Phase 15: match inventory rows the way the unique index matches them
--
-- Why this exists (2026-10-02):
--
--   phase8_product_integrity.sql made a product name unique per location *case-
--   and whitespace-insensitively* (inventory_items_location_name_en_ci). Two
--   SECURITY DEFINER functions still look a row up with an exact name and, when
--   that fails, create it. A stock name that was tidied up after the source record
--   was written therefore misses the match and is inserted a second time, and the
--   transaction dies with vendor text on the screen:
--
--     duplicate key value violates unique constraint "inventory_items_location_name_en_ci"
--
--   For `apply_audit_variances` that is fatal rather than cosmetic: the whole
--   apply is one transaction, so the audit stays in pending_review and not a single
--   variance is posted. It happened for real on
--
--     audit "جرد أسبوعي 1 (الأسبوع 2) - الجوافة" (b01), line "Astra Halloumi Cheese 8kg"
--     against stock "Astra Halloumi Cheese 8KG"
--
--   `audit_items` already stores `item_id`, the stock row the line was counted
--   from, so identity does not have to be guessed from a name at all. Both
--   functions now resolve in this order:
--
--     1. by id            — exact, and immune to a rename between count and apply
--                           (audit only: the count sheet carries the id)
--     2. by name          — ignoring case and surrounding whitespace, which is
--                           exactly how the index compares
--     3. create it        — trimmed, and deferring to a row that appears
--                           concurrently instead of raising
--
--   Both functions keep every other behaviour verbatim, including the ledger
--   entries `transactions` expects and the PO's "only a complete order closes".
--
-- Not covered here: `receive_transfer_group` (transfer_overhaul_migration.sql) has
-- the same exact-name-then-create shape. It has no live collision today, and its
-- installed version cannot be told apart from the older copy in
-- combined_migrations.sql without the SQL editor, so it is left untouched and
-- listed in PRODUCTION_AUDIT.md instead.
--
-- Idempotent: `create or replace` only, no data is touched.
--
-- Apply in the SQL editor (DDL needs the service role, which is not in .env):
--   https://supabase.com/dashboard/project/wmopyqckfwlfeepsappe/sql/new
--
-- Verify:  npm run migrations            (functions still probe as installed)
--          scripts/migration-doctor.mjs (no negative stock, no name duplicates)
--          then apply the pending audit from the UI: it completes and posts its
--          variances rather than failing with a duplicate key.
--
-- Rollback: re-run the `apply_audit_variances` block from phase4_audit_migration.sql
--           and the `receive_purchase_order` block from phase7_integrity_migration.sql.

begin;

-- ---------------------------------------------------------------------------
-- 0. One place that answers "which stock row is this?"
-- ---------------------------------------------------------------------------
create or replace function public.resolve_inventory_item_id(
  p_location_id text,
  p_name_en text,
  p_name_ar text,
  p_item_id uuid default null
) returns uuid as $$
declare
  v_id uuid;
begin
  -- 1. By identity, when the caller knows the row it means.
  if p_item_id is not null then
    select id into v_id from public.inventory_items
    where id = p_item_id and location_id = p_location_id
    limit 1;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  -- 2. By name. lower(btrim(...)) mirrors inventory_items_location_name_en_ci, so
  --    anything the index would treat as the same product resolves to one row.
  --    The English spelling wins when both names could answer, and the id breaks a
  --    remaining tie, so the same sheet always posts to the same row.
  select id into v_id from public.inventory_items
  where location_id = p_location_id
    and (
      lower(btrim(name_en)) = lower(btrim(coalesce(p_name_en, '')))
      or (btrim(coalesce(p_name_ar, '')) <> ''
          and lower(btrim(name_ar)) = lower(btrim(p_name_ar)))
    )
  order by
    (lower(btrim(name_en)) = lower(btrim(coalesce(p_name_en, '')))) desc,
    id
  limit 1;

  return v_id;
end;
$$ language plpgsql stable security definer;

-- ---------------------------------------------------------------------------
-- 1. Applying an audit: post each variance against the row that was counted
-- ---------------------------------------------------------------------------
create or replace function public.apply_audit_variances(
  p_audit_id uuid,
  p_performed_by text
) returns void as $$
declare
  v_audit record;
  v_item record;
  v_transaction_type text;
  v_adjustment numeric;
  v_item_id uuid;
begin
  -- Check Audit
  select * into v_audit from public.audits where id = p_audit_id;
  if v_audit is null then
    raise exception 'Audit not found';
  end if;

  if v_audit.status != 'pending_review' then
    raise exception 'Audit must be in pending_review status to apply variances';
  end if;

  -- Process Items
  for v_item in
    select * from public.audit_items
    where audit_id = p_audit_id and variance is not null and variance != 0
    order by id
  loop
    if btrim(coalesce(v_item.item_name_en, '')) = '' then
      raise exception 'Audit line % has no product name, so it cannot be posted.', v_item.id;
    end if;

    -- Calculate adjustment
    v_adjustment := abs(v_item.variance);
    if v_item.variance > 0 then
      v_transaction_type := 'receive';
    else
      v_transaction_type := 'usage';
    end if;

    v_item_id := public.resolve_inventory_item_id(
      v_audit.location_id, v_item.item_name_en, v_item.item_name_ar, v_item.item_id
    );

    -- Adjust Inventory
    if v_item_id is not null then
      update public.inventory_items
      set quantity = v_item.counted_quantity,
          last_updated = now()
      where id = v_item_id;
    elsif v_item.counted_quantity > 0 then
      -- Create item if it doesn't exist but has a count > 0
      insert into public.inventory_items (
        location_id, name_en, name_ar, category, quantity, unit, min_threshold
      ) values (
        v_audit.location_id,
        btrim(regexp_replace(v_item.item_name_en, '\s+', ' ', 'g')),
        btrim(regexp_replace(coalesce(v_item.item_name_ar, ''), '\s+', ' ', 'g')),
        coalesce(v_item.category, 'Uncategorized'),
        v_item.counted_quantity,
        coalesce(v_item.unit, 'pcs'),
        0
      )
      -- A row that slipped in between the look-up and here is the same product:
      -- take it rather than failing the apply.
      on conflict do nothing
      returning id into v_item_id;

      if v_item_id is null then
        v_item_id := public.resolve_inventory_item_id(
          v_audit.location_id, v_item.item_name_en, v_item.item_name_ar, null
        );
      end if;

      if v_item_id is not null then
        update public.inventory_items
        set quantity = v_item.counted_quantity,
            last_updated = now()
        where id = v_item_id;
      else
        -- Said plainly, because the alternative is the constraint name in a toast.
        raise exception 'Cannot post "%": this location already has a product with that name, but the row could not be matched.', v_item.item_name_en
          using errcode = 'unique_violation';
      end if;
    end if;

    -- Log transaction
    insert into public.transactions (
      type, status, from_location, to_location, item_name_en, item_name_ar, quantity, unit, performed_by, notes
    ) values (
      v_transaction_type, 'completed',
      case when v_transaction_type = 'usage' then v_audit.location_id else null end,
      case when v_transaction_type = 'receive' then v_audit.location_id else null end,
      v_item.item_name_en, v_item.item_name_ar, v_adjustment, coalesce(v_item.unit, 'pcs'), p_performed_by,
      'Audit Auto-Correction for Audit: ' || v_audit.title
    );
  end loop;

  -- Mark Audit Completed
  update public.audits
  set status = 'completed',
      completed_date = now(),
      updated_at = now()
  where id = p_audit_id;

end;
$$ language plpgsql security definer;

-- ---------------------------------------------------------------------------
-- 2. Receiving a purchase order: same resolve, same create
-- ---------------------------------------------------------------------------
create or replace function public.receive_purchase_order(
  p_po_id uuid,
  p_items jsonb, -- Array of { id: uuid, received_quantity: numeric }
  p_performed_by text
) returns jsonb as $$
declare
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
begin
  select * into v_po from public.purchase_orders where id = p_po_id for update;
  if not found then
    raise exception 'Purchase order % not found.', p_po_id using errcode = 'no_data_found';
  end if;

  -- Re-receiving a closed order would double-count stock.
  if v_po.status in ('received', 'cancelled') then
    raise exception 'Purchase order % is % and cannot be received again.', v_po.po_number, v_po.status
      using errcode = 'check_violation';
  end if;

  v_po_location := coalesce(nullif(v_po.location_id, ''), 'warehouse');

  for v_json_item in select * from jsonb_array_elements(p_items)
  loop
    v_req_qty := coalesce((v_json_item->>'received_quantity')::numeric, 0);
    continue when v_req_qty <= 0;

    -- Lock the line: p_items may list the same line twice.
    select * into v_item from public.purchase_order_items
    where id = (v_json_item->>'id')::uuid and po_id = p_po_id
    for update;

    continue when not found;

    -- Never receive more than was ordered.
    v_remaining := v_item.quantity - coalesce(v_item.received_quantity, 0);
    v_apply_qty := least(v_req_qty, greatest(v_remaining, 0));
    continue when v_apply_qty <= 0;

    -- 1. Record it against the PO line
    update public.purchase_order_items
    set received_quantity = coalesce(received_quantity, 0) + v_apply_qty
    where id = v_item.id;

    -- 2. Credit inventory at the PO's own location. The row is resolved the way the
    --    unique index compares names, not by exact text: a PO line written as
    --    "Astra Halloumi Cheese 8kg" must credit the shelf that spells it "8KG"
    --    rather than colliding with it. (No item id exists here — purchase_order_items
    --    stores a name, not a row.)
    v_inv_item_id := public.resolve_inventory_item_id(
      v_po_location, v_item.item_name_en, v_item.item_name_ar, null
    );

    -- Note: purchase_order_items has no `unit` column, so the unit is resolved from
    -- the existing stock row, then the catalog, then a literal default.
    if v_inv_item_id is not null then
      update public.inventory_items
      set quantity = quantity + v_apply_qty, last_updated = now()
      where id = v_inv_item_id;

      select unit into v_unit from public.inventory_items where id = v_inv_item_id;
    else
      select unit into v_unit from public.product_catalog
      where name_en = v_item.item_name_en limit 1;

      insert into public.inventory_items (
        location_id, name_en, name_ar, category, quantity, unit, min_threshold, last_updated
      ) values (
        v_po_location,
        btrim(regexp_replace(v_item.item_name_en, '\s+', ' ', 'g')),
        coalesce(nullif(btrim(coalesce(v_item.item_name_ar, '')), ''), v_item.item_name_en),
        coalesce((select category from public.product_catalog where name_en = v_item.item_name_en limit 1), 'General'),
        v_apply_qty,
        coalesce(v_unit, 'pcs'),
        coalesce((select min_threshold from public.product_catalog where name_en = v_item.item_name_en limit 1), 0),
        now()
      )
      on conflict do nothing
      returning id into v_inv_item_id;

      -- `null` here means the index refused a second copy, so the product is already
      -- on this shelf: credit that row instead of dropping the receipt. The row just
      -- inserted already holds v_apply_qty, so only the adopted row is topped up.
      if v_inv_item_id is null then
        v_inv_item_id := public.resolve_inventory_item_id(
          v_po_location, v_item.item_name_en, v_item.item_name_ar, null
        );

        if v_inv_item_id is null then
          raise exception 'Cannot receive "%": this location already has a product with that name, but the row could not be matched.', v_item.item_name_en
            using errcode = 'unique_violation';
        end if;

        update public.inventory_items
        set quantity = quantity + v_apply_qty, last_updated = now()
        where id = v_inv_item_id;

        select unit into v_unit from public.inventory_items where id = v_inv_item_id;
      end if;
    end if;

    v_unit := coalesce(v_unit, 'pcs');

    -- 3. Ledger entry, using the same shape as execute_daily_log's receive branch
    --    so reports see PO receipts the same way. `transactions` has no item_id or
    --    location_id column — the previous client-side version wrote those names and
    --    silently dropped the row.
    insert into public.transactions (
      date, type, status, from_location, to_location,
      item_name_en, item_name_ar, quantity, unit, performed_by, notes
    ) values (
      now(), 'receive', 'completed', 'External Supplier', v_po_location,
      v_item.item_name_en, v_item.item_name_ar, v_apply_qty,
      v_unit, p_performed_by,
      'Received from PO ' || v_po.po_number
    );

    v_total_received := v_total_received + v_apply_qty;
  end loop;

  -- 4. Only a genuinely complete order is closed. 'partial' is not an allowed
  --    status, so a partly received order keeps its current status.
  select bool_and(coalesce(received_quantity, 0) >= quantity) into v_all_received
  from public.purchase_order_items where po_id = p_po_id;
  v_all_received := coalesce(v_all_received, false);

  update public.purchase_orders
  set status = case when v_all_received then 'received' else status end,
      updated_at = now()
  where id = p_po_id;

  return jsonb_build_object(
    'status', case when v_all_received then 'received' else v_po.status end,
    'received', v_total_received,
    'fully_received', v_all_received,
    'location_id', v_po_location
  );
end;
$$ language plpgsql security definer;

commit;

-- Sanity check after applying:
--   select count(*) from public.inventory_items where quantity < 0;   -- 0
--   select location_id, lower(btrim(name_en)), count(*)
--     from public.inventory_items group by 1, 2 having count(*) > 1;  -- no rows
