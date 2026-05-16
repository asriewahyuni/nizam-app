-- Perpanjang voucher ABS2024 hingga akhir 2026 dan reset agar aktif kembali.
-- Jika belum ada, buat baru.
INSERT INTO saas_vouchers (code, discount_percent, max_uses, uses_count, is_active, expires_at)
VALUES ('ABS2024', 100, 500, 0, true, '2026-12-31 23:59:59+00')
ON CONFLICT (code) DO UPDATE SET
  is_active   = true,
  expires_at  = '2026-12-31 23:59:59+00',
  max_uses    = 500,
  discount_percent = 100;
