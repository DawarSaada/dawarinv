-- Phase 3: Supplier & Purchase Order Management Migration

-- 1. Create Suppliers Table
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_en text NOT NULL,
  name_ar text NOT NULL,
  contact_person text,
  email text,
  phone text,
  address text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access" ON public.suppliers;
CREATE POLICY "Public Access" ON public.suppliers FOR ALL USING (true);

-- 2. Create Purchase Orders Table
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_number text UNIQUE NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('draft', 'pending', 'approved', 'received', 'cancelled')),
  expected_delivery date,
  total_amount numeric DEFAULT 0,
  notes text,
  created_by text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access" ON public.purchase_orders;
CREATE POLICY "Public Access" ON public.purchase_orders FOR ALL USING (true);

-- 3. Create Purchase Order Items Table
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id uuid REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  item_name_en text NOT NULL,
  item_name_ar text NOT NULL,
  quantity numeric NOT NULL,
  received_quantity numeric DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  total_price numeric NOT NULL DEFAULT 0
);

ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access" ON public.purchase_order_items;
CREATE POLICY "Public Access" ON public.purchase_order_items FOR ALL USING (true);

-- 4. Create trigger to update PO total_amount on item changes
CREATE OR REPLACE FUNCTION public.update_po_total_amount()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.purchase_orders
    SET total_amount = (SELECT COALESCE(SUM(total_price), 0) FROM public.purchase_order_items WHERE po_id = OLD.po_id),
        updated_at = now()
    WHERE id = OLD.po_id;
    RETURN OLD;
  ELSE
    UPDATE public.purchase_orders
    SET total_amount = (SELECT COALESCE(SUM(total_price), 0) FROM public.purchase_order_items WHERE po_id = NEW.po_id),
        updated_at = now()
    WHERE id = NEW.po_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_po_total ON public.purchase_order_items;
CREATE TRIGGER trigger_update_po_total
AFTER INSERT OR UPDATE OR DELETE ON public.purchase_order_items
FOR EACH ROW EXECUTE FUNCTION public.update_po_total_amount();


-- 5. RPC Function to receive Purchase Order items into inventory
CREATE OR REPLACE FUNCTION public.receive_purchase_order(
  p_po_id uuid,
  p_items jsonb, -- Array of { id: uuid, received_quantity: numeric }
  p_performed_by text
) RETURNS void AS $$
DECLARE
  v_item record;
  v_json_item jsonb;
  v_req_qty numeric;
  v_po_status text;
  v_all_received boolean := true;
BEGIN
  -- Check PO status
  SELECT status INTO v_po_status FROM public.purchase_orders WHERE id = p_po_id;
  IF v_po_status NOT IN ('approved', 'pending') THEN
    RAISE EXCEPTION 'Purchase order cannot be received in its current status: %', v_po_status;
  END IF;

  -- Process each item from input
  FOR v_json_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_req_qty := (v_json_item->>'received_quantity')::numeric;

    -- Get PO item details
    SELECT * INTO v_item FROM public.purchase_order_items 
    WHERE id = (v_json_item->>'id')::uuid AND po_id = p_po_id;

    IF v_item IS NOT NULL AND v_req_qty > 0 THEN
      -- 1. Update received_quantity in PO items
      UPDATE public.purchase_order_items 
      SET received_quantity = COALESCE(received_quantity, 0) + v_req_qty
      WHERE id = v_item.id;

      -- 2. Add to warehouse inventory
      IF EXISTS (
        SELECT 1 FROM public.inventory_items 
        WHERE location_id = 'warehouse' 
          AND (name_en = v_item.item_name_en OR name_ar = v_item.item_name_ar)
      ) THEN
        UPDATE public.inventory_items 
        SET quantity = quantity + v_req_qty,
            last_updated = now()
        WHERE location_id = 'warehouse' 
          AND (name_en = v_item.item_name_en OR name_ar = v_item.item_name_ar);
      ELSE
        -- Create new item in warehouse (look up unit and category from catalog if possible, otherwise default)
        INSERT INTO public.inventory_items (
          location_id, name_en, name_ar, category, quantity, unit, min_threshold
        ) 
        SELECT 'warehouse', v_item.item_name_en, v_item.item_name_ar, 
               COALESCE((SELECT category FROM public.product_catalog WHERE name_en = v_item.item_name_en LIMIT 1), 'Uncategorized'), 
               v_req_qty, 
               COALESCE((SELECT unit FROM public.product_catalog WHERE name_en = v_item.item_name_en LIMIT 1), 'pcs'),
               0;
      END IF;

      -- 3. Log the transaction
      INSERT INTO public.transactions (
        type, status, to_location, item_name_en, item_name_ar, quantity, unit, performed_by, notes
      ) VALUES (
        'receive', 'completed', 'warehouse', v_item.item_name_en, v_item.item_name_ar, v_req_qty, 
        COALESCE((SELECT unit FROM public.product_catalog WHERE name_en = v_item.item_name_en LIMIT 1), 'pcs'),
        p_performed_by, 'Received from PO: ' || (SELECT po_number FROM public.purchase_orders WHERE id = p_po_id)
      );
    END IF;
  END LOOP;

  -- Update PO Status to received if all quantities match (simplified logic: just mark received for now, or partial)
  UPDATE public.purchase_orders 
  SET status = 'received',
      updated_at = now()
  WHERE id = p_po_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
