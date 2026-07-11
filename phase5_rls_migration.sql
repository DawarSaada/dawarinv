-- Phase 5: RLS Policies and Security Definer RPCs

-- 1. Create execute_add_item RPC
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

-- 2. Create execute_edit_item RPC
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

-- 3. Create execute_delete_items RPC
CREATE OR REPLACE FUNCTION public.execute_delete_items(
    p_item_ids uuid[]
) RETURNS void AS $$
BEGIN
    DELETE FROM public.inventory_items WHERE id = ANY(p_item_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create execute_bulk_edit_items RPC
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

-- 5. Create execute_cleanup_transactions RPC
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

-- Enable Row-Level Security on all tables
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing permissive policies to prevent duplicate policy errors
DROP POLICY IF EXISTS "Public Access" ON public.locations;
DROP POLICY IF EXISTS "Public Access" ON public.app_users;
DROP POLICY IF EXISTS "Public Access" ON public.inventory_items;
DROP POLICY IF EXISTS "Public Access" ON public.transactions;
DROP POLICY IF EXISTS "Allow all actions to notifications" ON public.notifications;

DROP POLICY IF EXISTS "Allow public SELECT on locations" ON public.locations;
DROP POLICY IF EXISTS "Allow public SELECT on app_users" ON public.app_users;
DROP POLICY IF EXISTS "Allow public INSERT on app_users" ON public.app_users;
DROP POLICY IF EXISTS "Allow public UPDATE on app_users" ON public.app_users;
DROP POLICY IF EXISTS "Allow public DELETE on app_users" ON public.app_users;
DROP POLICY IF EXISTS "Allow public SELECT on inventory_items" ON public.inventory_items;
DROP POLICY IF EXISTS "Allow public SELECT on transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow public SELECT on notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow public UPDATE on notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow public DELETE on notifications" ON public.notifications;

-- Create restrictive policies

-- locations: Read-only for everyone, writes blocked directly (managed via migration / db setup)
CREATE POLICY "Allow public SELECT on locations" 
    ON public.locations FOR SELECT USING (true);

-- app_users: View, insert, update and delete allowed client-side for user management
CREATE POLICY "Allow public SELECT on app_users" 
    ON public.app_users FOR SELECT USING (true);
CREATE POLICY "Allow public INSERT on app_users" 
    ON public.app_users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public UPDATE on app_users" 
    ON public.app_users FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public DELETE on app_users" 
    ON public.app_users FOR DELETE USING (true);

-- inventory_items: Read-only directly. All modifications (INSERT/UPDATE/DELETE) must go through SECURITY DEFINER RPCs.
CREATE POLICY "Allow public SELECT on inventory_items" 
    ON public.inventory_items FOR SELECT USING (true);

-- transactions: Read-only directly. All modifications (INSERT/UPDATE/DELETE) must go through SECURITY DEFINER RPCs.
CREATE POLICY "Allow public SELECT on transactions" 
    ON public.transactions FOR SELECT USING (true);

-- notifications: Read-only for SELECT. INSERT is blocked directly (handled by database trigger).
-- UPDATE and DELETE allowed for marking notifications as read/dismissing.
CREATE POLICY "Allow public SELECT on notifications" 
    ON public.notifications FOR SELECT USING (true);
CREATE POLICY "Allow public UPDATE on notifications" 
    ON public.notifications FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public DELETE on notifications" 
    ON public.notifications FOR DELETE USING (true);
