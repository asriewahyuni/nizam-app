-- Ubah pencairan komisi reseller dari basis nilai invoice (accrual) ke basis pembayaran
-- yang sudah diterima (cash-basis) — komisi hanya dihitung dari termin yang sudah dibayar
-- customer, bukan dari nilai penuh invoice yang mungkin belum lunas.
-- Tabel sales_commission_settlement_items masih kosong (fitur baru dibuat, belum ada
-- pencairan nyata) sehingga aman diubah langsung tanpa migrasi data.

ALTER TABLE public.sales_commission_settlement_items
  DROP CONSTRAINT IF EXISTS sales_commission_settlement_items_sale_id_key;

ALTER TABLE public.sales_commission_settlement_items
  ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES public.sales_payments(id) ON DELETE RESTRICT;

ALTER TABLE public.sales_commission_settlement_items
  ALTER COLUMN payment_id SET NOT NULL;

ALTER TABLE public.sales_commission_settlement_items
  ADD CONSTRAINT sales_commission_settlement_items_payment_id_key UNIQUE (payment_id);

CREATE INDEX IF NOT EXISTS idx_sales_commission_settlement_items_payment
  ON public.sales_commission_settlement_items(payment_id);
