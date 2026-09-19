-- ============================================================
-- Trigger: Auto-seed ALL catalog items when a new branch location is created
-- Run this once in the Supabase SQL Editor for the Inventory project:
-- https://supabase.com/dashboard/project/wmopyqckfwlfeepsappe/sql/new
-- ============================================================

-- Step 1: Create the function
CREATE OR REPLACE FUNCTION seed_catalog_to_new_location()
RETURNS TRIGGER AS $$
BEGIN
  -- Only auto-seed branch locations, not warehouse/mammal central ones
  IF NEW.type = 'branch' THEN
    INSERT INTO inventory_items (
      location_id,
      name_en,
      name_ar,
      category,
      quantity,
      unit,
      min_threshold,
      last_updated
    )
    -- Use DISTINCT ON name_ar to avoid duplicate Arabic name conflicts
    SELECT DISTINCT ON (TRIM(LOWER(pc.name_ar)))
      NEW.id,
      TRIM(pc.name_en),
      TRIM(pc.name_ar),
      COALESCE(pc.category, 'Groceries'),
      0,
      TRIM(COALESCE(pc.unit, 'Piece')),
      COALESCE(pc.min_threshold, 0),
      NOW()
    FROM product_catalog pc
    WHERE TRIM(pc.name_ar) != ''
    ORDER BY TRIM(LOWER(pc.name_ar)), pc.created_at ASC
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Drop old trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_seed_catalog_on_new_location ON locations;

CREATE TRIGGER trigger_seed_catalog_on_new_location
  AFTER INSERT ON locations
  FOR EACH ROW
  EXECUTE FUNCTION seed_catalog_to_new_location();

-- ============================================================
-- Verification: Check trigger was created
-- ============================================================
SELECT trigger_name, event_manipulation, event_object_table, action_timing
FROM information_schema.triggers
WHERE trigger_name = 'trigger_seed_catalog_on_new_location';
