-- migration-check.sql — which migrations are actually applied?
--
-- Paste the whole file into the Supabase SQL editor and run it. It is read-only:
-- it inspects pg_catalog and information_schema and changes nothing.
--
-- Why this exists: the app can only reach the REST API with the anon key, and that
-- exposes nothing about functions, triggers, constraints or policies — so a missing
-- migration can look identical to an applied one. This reads the catalog directly.
--
-- The second query reproduces the same rules as scripts/migration-doctor.mjs and
-- prints the whole result as one table, so both agree.

-- ===========================================================================
-- Part 1: the summary table
-- ===========================================================================
with
fn as (
  select proname, pg_get_function_identity_arguments(oid) as args, pg_get_functiondef(oid) as def
  from pg_proc where pronamespace = 'public'::regnamespace
),
has_fn as (
  select name, exists (select 1 from fn where fn.proname = name) as present
  from unnest(array[
    'execute_transfer','confirm_source_transfer','receive_transfer','reject_transfer',
    'execute_daily_log','execute_add_item','execute_edit_item','execute_delete_items',
    'execute_bulk_edit_items','execute_cleanup_transactions','receive_purchase_order',
    'update_po_total_amount','apply_audit_variances','calculate_audit_variance',
    'receive_transfer_group','reject_transfer_group','confirm_transfer_group',
    'auto_reject_expired_transfers','execute_oms_dispatch','execute_oms_receive',
    'execute_oms_cancel','can_edit_location','can_read_location','app_user_access',
    'check_low_stock','touch_app_settings'
  ]) as name
),
trg as (select tgname, tgrelid::regclass::text as tbl from pg_trigger where not tgisinternal),
con as (select conname, contype from pg_constraint where connamespace = 'public'::regnamespace),
idx as (select indexname from pg_indexes where schemaname = 'public'),
pol as (select tablename, policyname, cmd, qual::text as qual from pg_policies where schemaname = 'public'),
colt as (select table_name, column_name, data_type from information_schema.columns where table_schema = 'public'),
data as (
  select
    (select count(*) from public.inventory_items where quantity < 0) as negatives,
    (select count(*) from (select location_id, lower(btrim(name_en)) from public.inventory_items group by 1,2 having count(*)>1) d) as dup_groups,
    (select count(*) from public.inventory_items where name_en <> btrim(name_en)) as untrimmed,
    (select count(*) from public.inventory_items where lower(unit) = 'peace') as peace_units,
    (select count(*) from public.inventory_items where category in ('Uncategorized','Received','Packets','ABC')) as placeholders,
    (select count(*) from public.inventory_items) as total_items
)
select migration, check, result, detail from (
  -- Objects -----------------------------------------------------------------
  select 1 ord, 'supabase_schema.sql' migration, 'locations/app_users/inventory_items/transactions exist' check,
    case when (select count(*) from colt where table_name in ('locations','app_users','inventory_items','transactions')) = 4
         then 'APPLIED' else 'MISSING' end result,
    (select string_agg(data_type, ', ') from colt where table_name='inventory_items' and column_name='expiration_date') detail
  union all
  select 2, 'phase2_notifications_migration.sql', 'notifications.is_read', case when exists (select 1 from colt where table_name='notifications' and column_name='is_read') then 'APPLIED' else 'MISSING' end, null
  union all
  select 3, 'phase3_migration.sql', 'trigger trg_check_low_stock / function check_low_stock', case when exists (select 1 from trg where tgname='trg_check_low_stock') or (select present from has_fn where name='check_low_stock') then 'APPLIED' else 'MISSING' end, 'phase2 already created the same table, so this only adds the alert trigger'
  union all
  select 4, 'phase3_po_migration.sql', 'suppliers + purchase_orders + purchase_order_items', case when (select count(*) from colt where table_name in ('suppliers','purchase_orders','purchase_order_items')) = 3 then 'APPLIED' else 'MISSING' end, null
  union all
  select 5, 'phase4_audit_migration.sql', 'audits + audit_items + apply_audit_variances()', case when (select present from has_fn where name='apply_audit_variances') then 'APPLIED' else 'MISSING' end, null
  union all
  select 6, 'phase5_webpush_migration.sql', 'push_subscriptions', case when exists (select 1 from colt where table_name='push_subscriptions') then 'APPLIED' else 'MISSING' end, null
  union all
  select 7, 'phase5_rls_migration.sql', 'SECURITY DEFINER RPCs installed', case when (select count(*) from has_fn where name in ('execute_add_item','execute_edit_item','execute_delete_items','execute_bulk_edit_items','execute_cleanup_transactions') and present) = 5 then 'APPLIED' else 'MISSING' end, null
  union all
  select 8, 'phase5_rls_migration.sql', 'restrictive RLS in force (inventory_items/transactions read-only)', case when not exists (select 1 from pol where tablename='inventory_items' and cmd in ('INSERT','UPDATE','DELETE')) then 'APPLIED' else 'NOT IN FORCE' end, 'direct REST writes to inventory_items still succeed'
  union all
  select 9, 'phase6_po_migration.sql', 'purchase_orders.location_id', case when exists (select 1 from colt where table_name='purchase_orders' and column_name='location_id') then 'APPLIED' else 'MISSING' end, null
  union all
  select 10, 'transfer_overhaul_migration.sql', 'transactions.transfer_group_id + signature_url + photo_urls', case when (select count(*) from colt where table_name='transactions' and column_name in ('transfer_group_id','signature_url','photo_urls','received_quantity')) = 4 then 'APPLIED' else 'MISSING' end, null
  union all
  select 11, 'catalog_migration.sql', 'product_catalog', case when exists (select 1 from colt where table_name='product_catalog') then 'APPLIED' else 'MISSING' end, null
  union all
  select 12, 'supabase/migrations/20260714120000_supplier_items.sql', 'suppliers.supplied_items', case when exists (select 1 from colt where table_name='suppliers' and column_name='supplied_items') then 'APPLIED' else 'MISSING' end, null
  union all
  select 13, 'supabase/migrations/20260714130000_catalog_default_price.sql', 'product_catalog.default_price', case when exists (select 1 from colt where table_name='product_catalog' and column_name='default_price') then 'APPLIED' else 'MISSING' end, null
  union all
  select 14, 'oms_sync_rpc.sql', 'execute_oms_dispatch/receive/cancel', case when (select count(*) from has_fn where name like 'execute_oms%' and present) = 3 then 'APPLIED' else 'MISSING' end, null
  union all
  select 15, 'fix_unit_spelling.sql', 'no "peace" unit', case when (select peace_units from data) = 0 then 'APPLIED' else 'NOT IN FORCE' end, (select peace_units from data) || ' rows still say peace'
  union all
  -- Phase 7 -----------------------------------------------------------------
  union all
  select 20, 'phase7_integrity_migration.sql', 'quantity >= 0 constraint', case when exists (select 1 from con where conname like 'inventory_items_quantity%') then 'APPLIED' else 'MISSING' end, null
  union all
  select 21, 'phase7_integrity_migration.sql', 'no negative stock', case when (select negatives from data) = 0 then 'APPLIED' else 'MISSING' end, (select negatives from data) || ' rows negative'
  union all
  select 22, 'phase7_integrity_migration.sql', 'receive_purchase_order credits the PO location', case when exists (select 1 from fn where proname='receive_purchase_order' and args like '%jsonb%') then 'CHECK MANUALLY' else 'MISSING' end, 'the newer version raises "Purchase order ... not found." for an unknown id'
  union all
  -- Phase 8 -----------------------------------------------------------------
  union all
  select 30, 'phase8_product_integrity.sql', 'name-trimming constraints', case when exists (select 1 from con where conname in ('inventory_items_name_en_trimmed','inventory_items_name_ar_trimmed')) then 'APPLIED' else 'MISSING' end, null
  union all
  select 31, 'phase8_product_integrity.sql', 'case-insensitive unique index', case when exists (select 1 from idx where indexname='inventory_items_location_name_en_ci') then 'APPLIED' else 'MISSING' end, (select dup_groups from data) || ' duplicate name group(s) would block it'
  union all
  select 32, 'phase8_product_integrity.sql', 'no untrimmed names', case when (select untrimmed from data) = 0 then 'APPLIED' else 'MISSING' end, (select untrimmed from data) || ' rows untrimmed'
  union all
  select 33, 'catalog-doctor --apply', 'no placeholder categories', case when (select placeholders from data) = 0 then 'APPLIED' else 'MISSING' end, (select placeholders from data) || ' rows'
  union all
  -- Phase 9 -----------------------------------------------------------------
  union all
  select 40, 'phase9_branch_permissions.sql', 'can_edit_location()/can_read_location()/app_user_access()', case when (select count(*) from has_fn where name in ('can_edit_location','can_read_location','app_user_access') and present) = 3 then 'APPLIED' else 'MISSING' end, null
  union all
  -- Phase 10 ----------------------------------------------------------------
  union all
  select 50, 'phase10_app_settings.sql', 'app_settings.updated_by', case when exists (select 1 from colt where table_name='app_settings' and column_name='updated_by') then 'APPLIED' else 'MISSING' end, null
  union all
  select 51, 'phase10_app_settings.sql', 'seed currency + retention_months', case when exists (select 1 from public.app_settings where key='retention_months') then 'APPLIED' else 'MISSING' end, coalesce((select string_agg(key, ', ') from public.app_settings), 'no rows')
  union all
  select 52, 'phase10_app_settings.sql', 'touch_app_settings()', case when (select present from has_fn where name='touch_app_settings') then 'APPLIED' else 'MISSING' end, null
  union all
  -- Phase 11 ----------------------------------------------------------------
  union all
  select 60, 'phase11_item_date_fix.sql', 'execute_add_item / execute_edit_item cast the date', case when (select count(*) from fn where proname in ('execute_add_item','execute_edit_item') and def like '%::date%') = 2 then 'APPLIED' else 'MISSING' end,
    'until this is applied every add/edit fails with 42804: column "expiration_date" is of type date but expression is of type text'
) s
order by ord;

-- ===========================================================================
-- Part 2: row counts, for a sanity check against the app
-- ===========================================================================
select 'inventory_items' as table_name, count(*) from public.inventory_items
union all select 'transactions', count(*) from public.transactions
union all select 'product_catalog', count(*) from public.product_catalog
union all select 'app_users', count(*) from public.app_users
union all select 'suppliers', count(*) from public.suppliers
union all select 'purchase_orders', count(*) from public.purchase_orders
union all select 'purchase_order_items', count(*) from public.purchase_order_items
union all select 'notifications', count(*) from public.notifications
union all select 'audits', count(*) from public.audits
union all select 'push_subscriptions', count(*) from public.push_subscriptions
order by table_name;

-- ===========================================================================
-- Part 3: what the REST API can see, and why it matters
-- ===========================================================================
--   select * from pg_policies where schemaname = 'public' order by tablename, cmd;
--
-- If inventory_items has INSERT/UPDATE/DELETE policies (or none at all while RLS is
-- enabled with no policy), the app can write stock straight over REST. That is the
-- auth item deliberately deferred — but it also means phase5's RPC-only design is
-- not actually enforced, so nothing stops a client from bypassing the guards that
-- phase7 adds.
select tablename, policyname, cmd, permissive, coalesce(qual, '(none)') as using_expr
from pg_policies
where schemaname = 'public'
order by tablename, cmd;
