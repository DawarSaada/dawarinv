-- Phase 4: Cycle Counting & Audit Module Migration

-- 1. Create Audits Table
CREATE TABLE IF NOT EXISTS public.audits (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  location_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('scheduled', 'in_progress', 'pending_review', 'completed', 'cancelled')),
  scheduled_date date,
  completed_date timestamp with time zone,
  created_by text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access" ON public.audits;
CREATE POLICY "Public Access" ON public.audits FOR ALL USING (true);

-- 2. Create Audit Items Table
CREATE TABLE IF NOT EXISTS public.audit_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_id uuid REFERENCES public.audits(id) ON DELETE CASCADE,
  item_id uuid, -- Reference to inventory_items (but could be nullable if item doesn't exist yet)
  item_name_en text NOT NULL,
  item_name_ar text NOT NULL,
  category text,
  unit text,
  expected_quantity numeric NOT NULL,
  counted_quantity numeric,
  variance numeric,
  notes text
);

ALTER TABLE public.audit_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access" ON public.audit_items;
CREATE POLICY "Public Access" ON public.audit_items FOR ALL USING (true);

-- 3. Trigger to auto-calculate variance
CREATE OR REPLACE FUNCTION public.calculate_audit_variance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.counted_quantity IS NOT NULL THEN
    NEW.variance = NEW.counted_quantity - NEW.expected_quantity;
  ELSE
    NEW.variance = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_variance ON public.audit_items;
CREATE TRIGGER trigger_calculate_variance
BEFORE INSERT OR UPDATE ON public.audit_items
FOR EACH ROW EXECUTE FUNCTION public.calculate_audit_variance();


-- 4. RPC Function to Apply Audit Variances (Only Admin)
CREATE OR REPLACE FUNCTION public.apply_audit_variances(
  p_audit_id uuid,
  p_performed_by text
) RETURNS void AS $$
DECLARE
  v_audit record;
  v_item record;
  v_transaction_type text;
  v_adjustment numeric;
BEGIN
  -- Check Audit
  SELECT * INTO v_audit FROM public.audits WHERE id = p_audit_id;
  IF v_audit IS NULL THEN
    RAISE EXCEPTION 'Audit not found';
  END IF;
  
  IF v_audit.status != 'pending_review' THEN
    RAISE EXCEPTION 'Audit must be in pending_review status to apply variances';
  END IF;

  -- Process Items
  FOR v_item IN SELECT * FROM public.audit_items WHERE audit_id = p_audit_id AND variance IS NOT NULL AND variance != 0
  LOOP
    -- Calculate adjustment
    v_adjustment := ABS(v_item.variance);
    IF v_item.variance > 0 THEN
      v_transaction_type := 'receive';
    ELSE
      v_transaction_type := 'usage';
    END IF;

    -- Adjust Inventory
    IF EXISTS (
      SELECT 1 FROM public.inventory_items 
      WHERE location_id = v_audit.location_id 
        AND (name_en = v_item.item_name_en OR name_ar = v_item.item_name_ar)
    ) THEN
      UPDATE public.inventory_items 
      SET quantity = v_item.counted_quantity,
          last_updated = now()
      WHERE location_id = v_audit.location_id 
        AND (name_en = v_item.item_name_en OR name_ar = v_item.item_name_ar);
    ELSE
      -- Create item if it doesn't exist but has a count > 0
      IF v_item.counted_quantity > 0 THEN
        INSERT INTO public.inventory_items (
          location_id, name_en, name_ar, category, quantity, unit, min_threshold
        ) VALUES (
          v_audit.location_id, v_item.item_name_en, v_item.item_name_ar, 
          COALESCE(v_item.category, 'Uncategorized'), v_item.counted_quantity, COALESCE(v_item.unit, 'pcs'), 0
        );
      END IF;
    END IF;

    -- Log transaction
    INSERT INTO public.transactions (
      type, status, from_location, to_location, item_name_en, item_name_ar, quantity, unit, performed_by, notes
    ) VALUES (
      v_transaction_type, 'completed', 
      CASE WHEN v_transaction_type = 'usage' THEN v_audit.location_id ELSE NULL END,
      CASE WHEN v_transaction_type = 'receive' THEN v_audit.location_id ELSE NULL END,
      v_item.item_name_en, v_item.item_name_ar, v_adjustment, COALESCE(v_item.unit, 'pcs'), p_performed_by, 
      'Audit Auto-Correction for Audit: ' || v_audit.title
    );
  END LOOP;

  -- Mark Audit Completed
  UPDATE public.audits 
  SET status = 'completed',
      completed_date = now(),
      updated_at = now()
  WHERE id = p_audit_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
