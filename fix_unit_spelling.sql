-- Fix unit typos ('Peace', 'peice', 'peace') -> 'Piece' across all database tables

-- 1. Master Product Catalog
UPDATE public.product_catalog 
SET unit = 'Piece' 
WHERE lower(trim(unit)) IN ('peace', 'peice');

-- 2. Inventory Items (Branches & Warehouse)
UPDATE public.inventory_items 
SET unit = 'Piece' 
WHERE lower(trim(unit)) IN ('peace', 'peice');

-- 3. Transactions / Audit Trail
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'unit'
  ) THEN
    UPDATE public.transactions 
    SET unit = 'Piece' 
    WHERE lower(trim(unit)) IN ('peace', 'peice');
  END IF;
END $$;

-- 4. Audit Items (Cycle Count Module)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'audit_items' AND column_name = 'unit'
  ) THEN
    UPDATE public.audit_items 
    SET unit = 'Piece' 
    WHERE lower(trim(unit)) IN ('peace', 'peice');
  END IF;
END $$;
