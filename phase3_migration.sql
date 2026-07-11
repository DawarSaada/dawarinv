-- Phase 3: Automated Low-Stock Alerts
-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id TEXT REFERENCES locations(id) ON DELETE CASCADE,
    item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- e.g., 'low_stock'
    message_en TEXT NOT NULL,
    message_ar TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all actions to notifications"
    ON notifications FOR ALL
    USING (true)
    WITH CHECK (true);

-- Create a database trigger to check stock levels
CREATE OR REPLACE FUNCTION check_low_stock()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if quantity dropped below threshold
    IF NEW.quantity <= NEW.min_threshold AND OLD.quantity > OLD.min_threshold THEN
        -- Insert a notification
        INSERT INTO notifications (location_id, item_id, type, message_en, message_ar)
        VALUES (
            NEW.location_id, 
            NEW.id, 
            'low_stock', 
            'Low stock alert for ' || NEW.name_en || '. Current quantity: ' || NEW.quantity,
            'تنبيه بنقص مخزون ' || NEW.name_ar || '. الكمية الحالية: ' || NEW.quantity
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists to replace it safely
DROP TRIGGER IF EXISTS trg_check_low_stock ON inventory_items;

-- Attach trigger to inventory_items
CREATE TRIGGER trg_check_low_stock
AFTER UPDATE OF quantity ON inventory_items
FOR EACH ROW
EXECUTE FUNCTION check_low_stock();
