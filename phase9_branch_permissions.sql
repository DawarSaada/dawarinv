-- Phase 9: Branch-level write permissions (database side)
--
-- The app decides access in services/permissions.ts. This migration adds the same
-- rule set in SQL so it can be enforced where the data is, and so that when
-- Supabase Auth + RLS land there is one place to change.
--
-- The rule, as agreed:
--   admin                        -> read/write everywhere
--   everyone else                -> read/write own branch (and any branch granted in
--                                   accessible_branches), read-only elsewhere
--   a branch listed in "x:read"  -> never writable for that user
--
-- Important and deliberate: this migration adds the *primitive* only. It does not
-- yet rewire the existing RPCs, because with the anon key and permissive RLS
-- ("USING (true)") a direct REST write bypasses any RPC guard anyway — so
-- rewriting five function signatures would add deployment risk without adding
-- security. Wire these into the policies at the same time as Auth. See
-- PRODUCTION_AUDIT.md (auth risk).

begin;

-- ---------------------------------------------------------------------------
-- 1. Resolve a user from whatever identifier the caller has
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_user_access(p_actor text)
RETURNS TABLE (
  user_id uuid,
  username text,
  role text,
  home_branch text,
  full_grants text[],
  read_grants text[]
) AS $$
  SELECT
    u.id,
    u.username,
    u.role,
    u.branch_code,
    -- accessible_branches holds both kinds; the ":read" suffix marks read-only.
    coalesce(array(SELECT b FROM unnest(coalesce(u.accessible_branches, '{}'::text[])) AS b
                   WHERE b NOT LIKE '%:read'), '{}'::text[]),
    coalesce(array(SELECT replace(b, ':read', '') FROM unnest(coalesce(u.accessible_branches, '{}'::text[])) AS b
                   WHERE b LIKE '%:read'), '{}'::text[])
  FROM public.app_users u
  WHERE u.username = p_actor OR u.name = p_actor
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 2. The permission decision
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_edit_location(p_actor text, p_location text)
RETURNS boolean AS $$
DECLARE
  v_user record;
  v_role text;
BEGIN
  IF p_actor IS NULL OR p_actor = '' OR p_location IS NULL OR p_location = '' THEN
    RETURN false;
  END IF;

  SELECT * INTO v_user FROM public.app_user_access(p_actor);
  IF NOT FOUND THEN
    -- An unknown actor is not an admin; fail closed.
    RETURN false;
  END IF;

  v_role := v_user.role;

  IF v_role = 'admin' THEN
    RETURN true;
  END IF;

  -- An explicit read-only grant always wins.
  IF p_location = ANY (v_user.read_grants) THEN
    RETURN false;
  END IF;

  -- Own branch, or an explicit full grant.
  IF v_user.home_branch = p_location OR p_location = ANY (v_user.full_grants) THEN
    RETURN true;
  END IF;

  -- Warehouse and mammal staff manage the central sites.
  IF v_role = 'warehouse_manager' AND p_location IN ('warehouse', 'mammal') THEN
    RETURN true;
  END IF;

  IF v_role = 'mammal_employee' AND p_location = 'mammal' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- Read access is everything visible: own, granted (both kinds), plus the central
-- sites for management roles. Deny only what the UI would never show.
CREATE OR REPLACE FUNCTION public.can_read_location(p_actor text, p_location text)
RETURNS boolean AS $$
DECLARE
  v_user record;
BEGIN
  IF p_actor IS NULL OR p_actor = '' OR p_location IS NULL OR p_location = '' THEN
    RETURN false;
  END IF;

  SELECT * INTO v_user FROM public.app_user_access(p_actor);
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_user.role = 'admin' THEN
    RETURN true;
  END IF;

  IF v_user.home_branch = p_location
     OR p_location = ANY (v_user.full_grants)
     OR p_location = ANY (v_user.read_grants) THEN
    RETURN true;
  END IF;

  RETURN v_user.role IN ('branch_manager', 'warehouse_manager');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 3. Example enforcement (commented: apply together with Auth, see header)
-- ---------------------------------------------------------------------------
-- Once requests carry an authenticated identity, the pattern becomes:
--
--   CREATE POLICY "write own branch" ON public.inventory_items
--     FOR ALL USING (public.can_edit_location(current_setting('app.actor', true), location_id));
--
--   CREATE POLICY "read visible branches" ON public.inventory_items
--     FOR SELECT USING (public.can_read_location(current_setting('app.actor', true), location_id));
--
-- and the "Public Access" USING (true) policy gets dropped.

commit;

-- Verify:
--   select username, role, branch_code, unnest(coalesce(accessible_branches, '{}')) from public.app_users order by 1;
--   select public.can_edit_location('admin', 'b01');            -- true
--   select public.can_edit_location('Jawafa manager', 'b02');   -- false
--   select public.can_read_location('Jawafa manager', 'b02');   -- true
