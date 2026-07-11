-- Update 'unit' in product_catalog
UPDATE public.product_catalog 
SET unit = 'piece' 
WHERE lower(unit) = 'peace';

-- Update 'unit' in inventory_items
UPDATE public.inventory_items 
SET unit = 'piece' 
WHERE lower(unit) = 'peace';

-- Update 'unit' in transactions
UPDATE public.transactions 
SET unit = 'piece' 
WHERE lower(unit) = 'peace';
