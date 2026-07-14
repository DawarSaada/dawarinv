-- Add supplied_items array to suppliers table
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS supplied_items text[] DEFAULT '{}';
