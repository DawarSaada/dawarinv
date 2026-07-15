-- Phase 6: Branch Purchase Orders Migration

-- 1. Add location_id to purchase_orders table
ALTER TABLE public.purchase_orders 
  ADD COLUMN IF NOT EXISTS location_id text DEFAULT 'warehouse';

-- Update existing POs to belong to the warehouse
UPDATE public.purchase_orders SET location_id = 'warehouse' WHERE location_id IS NULL;

-- 2. Add an index for faster querying by location
CREATE INDEX IF NOT EXISTS idx_purchase_orders_location_id 
  ON public.purchase_orders(location_id);
