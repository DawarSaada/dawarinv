-- Phase 2: Notifications Migration

-- 1. Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id text REFERENCES public.locations(id) ON DELETE CASCADE,
  item_id uuid, -- Optional link to inventory item or transaction
  type text NOT NULL CHECK (type IN ('low_stock', 'transfer', 'system')),
  message_en text NOT NULL,
  message_ar text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS and add public access policy
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access" ON public.notifications;
CREATE POLICY "Public Access" ON public.notifications FOR ALL USING (true);

-- 2. Trigger for Low Stock Alerts
CREATE OR REPLACE FUNCTION public.check_low_stock_and_notify()
RETURNS TRIGGER AS $$
BEGIN
  -- If quantity drops below threshold (or threshold increases)
  IF NEW.quantity <= NEW.min_threshold AND (OLD.quantity > OLD.min_threshold OR OLD.min_threshold != NEW.min_threshold) THEN
    INSERT INTO public.notifications (location_id, item_id, type, message_en, message_ar)
    VALUES (
      NEW.location_id,
      NEW.id,
      'low_stock',
      'Low Stock Alert: ' || NEW.name_en || ' has dropped to ' || NEW.quantity || ' ' || NEW.unit,
      'تنبيه نقص المخزون: ' || NEW.name_ar || ' انخفض إلى ' || NEW.quantity || ' ' || NEW.unit
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_inventory_update_check_stock ON public.inventory_items;
CREATE TRIGGER on_inventory_update_check_stock
  AFTER UPDATE OF quantity, min_threshold ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.check_low_stock_and_notify();

-- 3. Trigger for Transfer Alerts
CREATE OR REPLACE FUNCTION public.notify_target_on_transfer()
RETURNS TRIGGER AS $$
BEGIN
  -- Only notify when a transfer reaches pending_target (or if direct completed without pending source)
  IF NEW.type = 'transfer' AND NEW.status = 'pending_target' AND (OLD.status IS NULL OR OLD.status != 'pending_target') THEN
    INSERT INTO public.notifications (location_id, item_id, type, message_en, message_ar)
    VALUES (
      NEW.to_location,
      NEW.id,
      'transfer',
      'Incoming Transfer: ' || NEW.quantity || ' ' || NEW.unit || ' of ' || NEW.item_name_en || ' from ' || NEW.from_location,
      'تحويل قادم: ' || NEW.quantity || ' ' || NEW.unit || ' من ' || NEW.item_name_ar || ' من ' || NEW.from_location
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_transaction_insert_update_notify ON public.transactions;
CREATE TRIGGER on_transaction_insert_update_notify
  AFTER INSERT OR UPDATE OF status ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_target_on_transfer();
