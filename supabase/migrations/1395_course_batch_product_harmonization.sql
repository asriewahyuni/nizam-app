-- Harmonisasi Course-Batch-Product: Product bisa pin ke batch spesifik dari
-- course yang sama, kuota batch ditegakkan sungguhan di checkout, dan
-- overbooking (race manual transfer) ditandai untuk ditindaklanjuti admin
-- alih-alih menolak pembeli yang sudah bayar.

ALTER TABLE public.commerce_product_courses
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.lms_course_batches(id) ON DELETE SET NULL;
-- NULL = akses umum course (perilaku semua baris existing sampai sekarang, tidak berubah)

ALTER TABLE public.commerce_order_entitlements
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.lms_course_batches(id) ON DELETE SET NULL;
-- Snapshot batch di order-time supaya edit batch nanti tidak mengubah riwayat pembeli yang sudah bayar

ALTER TABLE public.learning_access_grants
  ADD CONSTRAINT learning_access_grants_batch_id_fkey
  FOREIGN KEY (batch_id) REFERENCES public.lms_course_batches(id) ON DELETE SET NULL;

ALTER TABLE public.learning_enrollments
  ADD CONSTRAINT learning_enrollments_batch_id_fkey
  FOREIGN KEY (batch_id) REFERENCES public.lms_course_batches(id) ON DELETE SET NULL;

ALTER TABLE public.learning_access_grants
  ADD COLUMN IF NOT EXISTS is_overbooked BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.lms_course_batches.store_product_id IS
  'DEPRECATED — arah salah (batch->product). Pakai commerce_product_courses.batch_id (product->batch) sebagai gantinya. Akan di-drop setelah kolom baru terbukti jalan di produksi.';
