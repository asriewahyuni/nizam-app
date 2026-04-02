-- ============================================================
-- MIGRATION 0171: Transaction Delete Protection
-- Split from migration 017 for local Supabase CLI compatibility.
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_transaction_protection()
RETURNS TRIGGER AS $$
BEGIN
    -- Jika ada jurnal dengan reference_id ini yang sudah POSTED, blokir delete.
    IF EXISTS (SELECT 1 FROM public.journal_entries WHERE reference_id = OLD.id AND status = 'POSTED') THEN
        RAISE EXCEPTION 'TRANSAKSI TERKUNCI: Transaksi ini sudah memiliki jurnal yang sah. Batalkan jurnal terlebih dahulu.';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_purchase_delete ON public.purchases;
CREATE TRIGGER trg_protect_purchase_delete
    BEFORE DELETE ON public.purchases
    FOR EACH ROW EXECUTE FUNCTION check_transaction_protection();

DROP TRIGGER IF EXISTS trg_protect_sales_delete ON public.sales;
CREATE TRIGGER trg_protect_sales_delete
    BEFORE DELETE ON public.sales
    FOR EACH ROW EXECUTE FUNCTION check_transaction_protection();
