-- ==========================================
-- SCRIPT 012: ERP SMART AUDIT TRIGGERS (CCTV)
-- ==========================================
-- Script ini akan memasang kamera pengawas (Trigger) pada 5 titik paling rawan 
-- di NIZAM ERP untuk mencegah fraud / human error.

-- 1. FUNGSI UTAMA PEREKAM (THE BLACK BOX)
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS trigger AS $$
DECLARE
    v_user_id UUID;
    v_org_id UUID;
BEGIN
    -- Coba ambil ID user yang sedang login dari konteks JWT Supabase
    -- Jika dieksekusi oleh sistem (Cron/Service Role), user_id akan null.
    v_user_id := auth.uid();
    
    -- Ambil org_id dari record (karena semua tabel kita punya org_id)
    IF TG_OP = 'DELETE' THEN
        v_org_id := OLD.org_id;
    ELSE
        v_org_id := NEW.org_id;
    END IF;

    -- Rekam aksi ke tabel audit_logs berdasarkan tipe operasi
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_logs (org_id, user_id, action, table_name, record_id, new_data)
        VALUES (v_org_id, v_user_id, 'CREATE', TG_TABLE_NAME, NEW.id, row_to_json(NEW)::jsonb);
        RETURN NEW;
    
    ELSIF TG_OP = 'UPDATE' THEN
        -- Jangan rekam jika datanya sama persis (hanya sentuh timestamp)
        IF row_to_json(OLD)::jsonb = row_to_json(NEW)::jsonb THEN
            RETURN NEW;
        END IF;
        
        -- Gunakan jsonb extraction agar tidak error saat tabel (misal: products) tidak punya kolom "status"
        IF TG_TABLE_NAME IN ('purchases', 'sales', 'journal_entries') 
           AND (row_to_json(NEW)->>'status') = 'VOIDED' 
           AND (row_to_json(OLD)->>'status') != 'VOIDED' THEN
            
            INSERT INTO public.audit_logs (org_id, user_id, action, table_name, record_id, old_data, new_data)
            VALUES (v_org_id, v_user_id, 'VOID', TG_TABLE_NAME, NEW.id, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
        ELSE
            INSERT INTO public.audit_logs (org_id, user_id, action, table_name, record_id, old_data, new_data)
            VALUES (v_org_id, v_user_id, 'UPDATE', TG_TABLE_NAME, NEW.id, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
        END IF;
        RETURN NEW;
    
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.audit_logs (org_id, user_id, action, table_name, record_id, old_data)
        VALUES (v_org_id, v_user_id, 'DELETE', TG_TABLE_NAME, OLD.id, row_to_json(OLD)::jsonb);
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 2. PEMASANGAN CCTV KE 5 TITIK RAWAN KORUPSI
-- ==========================================

-- A. TABEL PRODUK (Mendeteksi perubahan HPP & Harga Jual diam-diam)
DROP TRIGGER IF EXISTS audit_products_trigger ON public.products;
CREATE TRIGGER audit_products_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- B. TABEL JURNAL AKUNTANSI (Pusat Uang - Mendeteksi manipulasi Kas & Laba)
DROP TRIGGER IF EXISTS audit_journal_entries_trigger ON public.journal_entries;
CREATE TRIGGER audit_journal_entries_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.journal_entries
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- C. TABEL PEMBELIAN / PO (Mendeteksi pengadaan fiktif / markup harga Beli)
DROP TRIGGER IF EXISTS audit_purchases_trigger ON public.purchases;
CREATE TRIGGER audit_purchases_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.purchases
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- D. TABEL KONTAK / VENDOR (Mendeteksi "Vendor Siluman" atau perubahan Rekening Vendor)
DROP TRIGGER IF EXISTS audit_contacts_trigger ON public.contacts;
CREATE TRIGGER audit_contacts_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- E. TABEL HAK AKSES SISTEM (Mendeteksi staf yang menaikkan golongannya sendiri jadi Admin)
DROP TRIGGER IF EXISTS audit_org_members_trigger ON public.org_members;
CREATE TRIGGER audit_org_members_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.org_members
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- F. TABEL PENJUALAN (Mendeteksi penghapusan invoice / manipulasi Piutang)
DROP TRIGGER IF EXISTS audit_sales_trigger ON public.sales;
CREATE TRIGGER audit_sales_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
