# Regression Checklist Pasca Migrasi Prisma/Auth

Checklist ini dipakai untuk memastikan versi hasil migrasi tetap setara secara fungsional dengan baseline lama yang stabil.

## 1. Prasyarat

- database target lokal sudah terisi data hasil migrasi
- auth runtime sudah sinkron (`auth.users` → `public.users`)
- dev server bisa dijalankan di `http://localhost:3000`
- `DEFAULT_PASSWORD` di `.env` valid untuk user hasil reset massal

## 2. Verifikasi Otomatis Minimum

Jalankan:

```bash
./scripts/run_regression_smoke.sh
```

Script ini memverifikasi:

- `npx tsc --noEmit`
- `npm test`
- `npm run build`
- konsistensi auth runtime:
  - `auth.users`
  - `public.users`

## 3. Verifikasi Fungsional Manual Prioritas Tinggi

### Auth

- [ ] login owner via email + default password berhasil ke `/dashboard`
- [ ] login staff via NIK + default password berhasil ke `/dashboard`
- [ ] redirect `/login` → `/dashboard` untuk sesi aktif berjalan

### Org / Context

- [ ] organisasi aktif terbaca benar di header
- [ ] branch aktif tampil benar
- [ ] halaman parent/holding tidak crash saat melihat data konsolidasi

### Cash & Bank

- [ ] `/cash` terbuka tanpa 500
- [ ] saldo rekening tampil
- [ ] kode akun GL tampil di card rekening
- [ ] modal transaksi terbuka normal

### HRIS

- [ ] `/hris` terbuka tanpa error serialisasi React/Next
- [ ] daftar karyawan tampil
- [ ] basic salary tampil normal
- [ ] edit employee modal terisi tanpa crash

### Billing

- [ ] `/billing` terbuka tanpa stuck di loading berkepanjangan
- [ ] paket aktif tampil
- [ ] riwayat invoice tampil
- [ ] upload bukti transfer membuka flow normal

### Profil Saya

- [ ] `/profil-saya` terbuka normal
- [ ] data employee/branch tampil
- [ ] form profil bisa dibuka tanpa error console

## 4. Query / Data Integrity Checks

Pastikan hasil berikut masuk akal:

```sql
select count(*) from auth.users;
select count(*) from public.users;
select count(*) from public.organizations;
select count(*) from public.org_members;
select count(*) from public.branches;
select count(*) from public.employees;
select count(*) from public.accounts;
select count(*) from public.contacts;
select count(*) from public.products;
```

Dan:

```sql
select count(*)
from public.users pu
join auth.users au on au.id = pu.id
where au.deleted_at is null;
```

## 5. Known Regression Targets

Area yang pernah bermasalah dan harus dipantau setiap kali ada perubahan besar:

- shape relasi Prisma vs shape alias Supabase lama
  - contoh: `account` vs `accounts`
- `Prisma.Decimal` bocor ke Client Component
- auth runtime table mismatch (`auth.users` ada tapi `public.users` belum sinkron)
- halaman client yang menunggu loading snapshot terlalu lama

## 6. Exit Criteria

Rilis dianggap aman jika:

- [ ] typecheck lulus
- [ ] test suite lulus
- [ ] build lulus
- [ ] login owner + staff lulus
- [ ] `/cash`, `/hris`, `/billing`, `/profil-saya` lulus smoke test
- [ ] tidak ada error console aplikasi yang relevan pada flow kritis
