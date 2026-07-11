-- Create product catalog table
CREATE TABLE IF NOT EXISTS product_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_en TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    min_threshold NUMERIC DEFAULT 0,
    barcode TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies for product_catalog
ALTER TABLE product_catalog ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users (and anon for now)
CREATE POLICY "Allow read access to product_catalog"
    ON product_catalog FOR SELECT
    USING (true);

-- Allow write access only to admins (we can use anon for now if strict auth isn't fully set up)
CREATE POLICY "Allow all actions to product_catalog"
    ON product_catalog FOR ALL
    USING (true)
    WITH CHECK (true);

-- Insert initial catalog items based on existing inventory
INSERT INTO product_catalog (name_en, name_ar, description, category, unit, min_threshold, barcode)
SELECT DISTINCT ON (name_en) 
    name_en, 
    name_ar, 
    description, 
    category, 
    unit, 
    min_threshold, 
    barcode
FROM inventory_items
ON CONFLICT DO NOTHING;
