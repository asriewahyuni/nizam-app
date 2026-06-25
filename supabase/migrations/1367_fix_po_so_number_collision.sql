-- ============================================================
-- MIGRATION 1367: Fix PO and SO number collision
--
-- Masalah: set_purchase_number() dan set_sale_number() menggunakan COUNT(*) 
-- untuk menentukan nomor urut. Ini menyebabkan collision jika ada draft PO/SO
-- yang dihapus, karena COUNT(*) berkurang tapi nomor sebelumnya sudah dipakai.
--
-- Fix: Ubah logic menjadi menggunakan MAX(purchase_number) dan MAX(sale_number).
-- ============================================================

CREATE OR REPLACE FUNCTION set_purchase_number()
RETURNS TRIGGER AS $$
DECLARE
  v_year   TEXT := TO_CHAR(NOW(), 'YYYY');
  v_prefix TEXT;
  v_last   TEXT;
  v_seq    INT;
BEGIN
  IF NEW.purchase_number IS NULL OR NEW.purchase_number = '' THEN
    v_prefix := 'PO-' || v_year || '-';
    
    SELECT MAX(purchase_number) INTO v_last 
    FROM purchases 
    WHERE org_id = NEW.org_id 
      AND purchase_number LIKE v_prefix || '%';
      
    IF v_last IS NOT NULL THEN
      v_seq := SUBSTRING(v_last FROM LENGTH(v_prefix) + 1)::INT + 1;
    ELSE
      v_seq := 1;
    END IF;
    
    NEW.purchase_number = v_prefix || LPAD(v_seq::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_sale_number()
RETURNS TRIGGER AS $$
DECLARE
  v_year   TEXT := TO_CHAR(NOW(), 'YYYY');
  v_prefix TEXT;
  v_last   TEXT;
  v_seq    INT;
BEGIN
  IF NEW.sale_number IS NULL OR NEW.sale_number = '' THEN
    v_prefix := 'SO-' || v_year || '-';
    
    SELECT MAX(sale_number) INTO v_last 
    FROM sales 
    WHERE org_id = NEW.org_id 
      AND sale_number LIKE v_prefix || '%';
      
    IF v_last IS NOT NULL THEN
      v_seq := SUBSTRING(v_last FROM LENGTH(v_prefix) + 1)::INT + 1;
    ELSE
      v_seq := 1;
    END IF;
    
    NEW.sale_number = v_prefix || LPAD(v_seq::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

NOTIFY pgrst, 'reload schema';
