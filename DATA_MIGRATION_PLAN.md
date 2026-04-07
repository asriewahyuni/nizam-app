# Rencana Migrasi Data: Supabase → Database Lokal Docker Saat Ini

> Status: planning only, belum dieksekusi.
> Dibuat untuk repo `nizam-app` berdasarkan konfigurasi environment dan container Docker yang aktif pada 7 April 2026.

## 1. Tujuan

Memigrasikan data dari project Supabase yang dikonfigurasi di environment lokal ke database PostgreSQL lokal yang saat ini dipakai aplikasi melalui Prisma.

Target akhir:

- data bisnis utama berpindah ke database lokal target
- struktur data tetap kompatibel dengan `prisma/schema.prisma`
- user/auth legacy dari Supabase dipetakan ke tabel `user`/NextAuth yang dipakai runtime sekarang
- migrasi dapat dijalankan bertahap, tervalidasi, dan punya rollback plan

---

## 2. Konteks Konfigurasi Saat Ini

### Source (Supabase)

Terlihat tersedia di environment:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PASSWORD`

Artinya source Supabase dapat diakses minimal lewat:

1. Supabase CLI / dashboard export flow
2. service-role API / PostgREST
3. direct PostgreSQL connection **jika** connection string/source DB host diambil dari dashboard Supabase

### Target (database baru yang aktif sekarang)

Runtime repo saat ini memakai:

- `DATABASE_URL` → PostgreSQL lokal
- Prisma adapter di `lib/prisma.ts`

Container Docker aktif yang relevan:

- `supabase_db_nizam-app` → PostgreSQL target lokal, exposed ke host `127.0.0.1:54322`

Sehingga target migrasi saat ini adalah database yang diakses aplikasi melalui:

```txt
postgresql://postgres:***@127.0.0.1:54322/postgres
```

---

## 3. Asumsi Penting

1. Schema target sudah mengikuti state runtime saat ini dan kompatibel dengan `prisma/schema.prisma`.
2. Migrasi ini fokus pada **database records**, bukan object storage lama Supabase.
3. Upload/file asset lama (logo, receipt, billing proof, dsb.) perlu ditangani terpisah jika masih ingin dipertahankan.
4. Direct runtime sudah tidak memakai Supabase client, jadi setelah load data selesai aplikasi harus membaca penuh dari target PostgreSQL lokal.

---

## 4. Scope Data yang Dimigrasikan

### Wajib

- user/auth identity yang dibutuhkan runtime sekarang
- organizations
- org_members
- roles
- branches
- employees
- accounts / chart of accounts
- contacts
- products / warehouses / warehouse_bins / inventory_stocks / stock_movements
- sales / sales_items / quotations / payments / returns
- purchases / purchase_items / payments / returns / requests
- bank_accounts / bank_transactions / bank_mutations
- journal_entries / journal_lines
- reimbursements / reimbursement_items
- approval_requests
- saas config / packages / invoices / AI token tables

### Opsional / Tahap 2

- audit_logs historis penuh
- attendance / leave / payroll historis penuh
- fleet, services, factory, zakat timeline, BSC, analytics data historis detail

### Di luar scope file ini

- bucket/file migration dari Supabase Storage
- sinkronisasi realtime / webhook lama
- legacy Supabase auth session/token artifacts

---

## 5. Strategi Migrasi yang Direkomendasikan

Gunakan strategi **3 tahap**:

### Tahap A — Freeze & Backup

1. Pastikan source Supabase tidak menerima write penting saat cutover final.
2. Backup target lokal sebelum import:

```bash
docker exec -t supabase_db_nizam-app pg_dump -U postgres -d postgres -Fc -f /tmp/pre_migration.dump
docker cp supabase_db_nizam-app:/tmp/pre_migration.dump ./backups/pre_migration.dump
```

3. Simpan snapshot schema target:

```bash
npx prisma db pull
cp prisma/schema.prisma backups/schema.pre-migration.prisma
```

### Tahap B — Extract from Supabase

Pilih salah satu dari dua jalur ini.

#### Opsi 1 — Preferred: direct PostgreSQL export dari Supabase

Ambil connection string Postgres source dari Supabase dashboard, lalu dump table per kelompok:

```bash
pg_dump "$SOURCE_SUPABASE_DB_URL" \
  --data-only \
  --column-inserts \
  --table=public.organizations \
  --table=public.org_members \
  --table=public.branches \
  --file=./migration-data/core_org.sql
```

Lakukan dump bertahap per domain, bukan satu file raksasa.

#### Opsi 2 — Fallback: Supabase CLI + SQL export

Jika direct DB URL tidak tersedia, gunakan project ref + access token:

```bash
supabase link --project-ref <PROJECT_REF>
supabase db dump --data-only -f ./migration-data/source_data.sql
```

Lalu pecah file dump menjadi beberapa domain saat proses load.

### Tahap C — Transform & Load ke target lokal

Load ke target lokal lewat host `127.0.0.1:54322` atau langsung via container `supabase_db_nizam-app`.

Rekomendasi: gunakan **staging tables** terlebih dahulu untuk tabel sensitif.

Contoh:

```sql
create schema if not exists migration_staging;
```

Lalu:

1. import raw source ke staging
2. normalisasi kolom/enum/relasi
3. upsert ke tabel final secara eksplisit

---

## 6. Urutan Load Data

Urutan penting agar foreign key aman:

### Wave 1 — Identity & Tenant

1. `user`
2. `organizations`
3. `roles`
4. `branches`
5. `org_members`
6. `employees`

### Wave 2 — Master Data

7. `accounts`
8. `contacts`
9. `products`
10. `warehouses`
11. `warehouse_bins`
12. `bank_accounts`
13. `saas_packages`, `saas_config`, AI token package/config tables

### Wave 3 — Transaction Data

14. `sales`, `sales_items`, `sales_payments`, `sales_returns`
15. `purchases`, `purchase_items`, `purchase_payments`, `purchase_returns`, `purchase_requests`
16. `journal_entries`, `journal_lines`
17. `inventory_stocks`, `stock_movements`, `inventory_adjustments`
18. `reimbursements`, `reimbursement_items`
19. `approval_requests`
20. `attendance`, `leave_requests`, `payroll_runs`, dll sesuai kebutuhan historis

### Wave 4 — Optional Historical/Derived Data

21. `audit_logs`
22. `zakat_*`
23. analytics/supporting history tables lainnya

---

## 7. Transform Rules yang Wajib Diperhatikan

### 7.1 User/Auth mapping

Runtime sekarang memakai tabel `user`/NextAuth, bukan Supabase session runtime.

Karena itu perlu mapping:

- source `auth.users.id` / `public.users.id` → target `user.id`
- source email → target `user.email`
- password hash lama dipertahankan jika masih kompatibel, atau dipaksa reset jika tidak
- metadata Supabase tidak dibawa mentah kecuali masih dipakai aplikasi

Jika hash lama tidak kompatibel dengan flow login sekarang, opsi aman:

- migrasikan identity tanpa password
- tandai user untuk reset password massal setelah cutover

### 7.2 Enum & status values

Pastikan nilai source cocok dengan enum Prisma saat ini, misalnya:

- status sales/purchase
- role membership
- employment status
- approval status
- account type / normal balance

Jika ada nilai lama yang sudah tidak valid, map ke nilai target terdekat atau parkir di staging untuk review manual.

### 7.3 Decimal / numeric

Jangan import angka uang via float JSON. Gunakan SQL dump/COPY agar presisi `Decimal` tetap aman.

### 7.4 Timestamps

Pertahankan timezone source (`timestamptz`) dan jangan cast ke local naive timestamp.

### 7.5 Branch scoping

Banyak tabel kini branch-aware. Jika source lama belum konsisten punya `branch_id`, siapkan fallback rule:

- isi dari branch default organisasi
- atau biarkan `NULL` hanya untuk tabel yang memang mengizinkan

---

## 8. Rencana Eksekusi Praktis

### Step 1 — Validasi target aktif

```bash
docker ps
docker exec -it supabase_db_nizam-app psql -U postgres -d postgres -c '\dt'
```

### Step 2 — Buat folder kerja migrasi

```bash
mkdir -p migration-data backups migration-logs
```

### Step 3 — Export source per domain

Minimal buat file terpisah:

- `01_users.sql`
- `02_org_core.sql`
- `03_master_data.sql`
- `04_sales.sql`
- `05_purchasing.sql`
- `06_accounting.sql`
- `07_hris.sql`
- `08_optional_history.sql`

### Step 4 — Load ke staging/local

```bash
psql "$DATABASE_URL" -f ./migration-data/01_users.sql
psql "$DATABASE_URL" -f ./migration-data/02_org_core.sql
```

Atau lewat docker container:

```bash
docker cp ./migration-data/01_users.sql supabase_db_nizam-app:/tmp/01_users.sql
docker exec -it supabase_db_nizam-app psql -U postgres -d postgres -f /tmp/01_users.sql
```

### Step 5 — Sinkronkan auth runtime setelah load

```bash
./scripts/sync_auth_runtime_users.sh
```

Langkah ini penting karena source Supabase menyimpan identity di `auth.users`, sedangkan runtime aplikasi sekarang membaca login user dari `public.users` via Prisma/Auth.js.

### Step 6 — Jalankan smoke validation

Contoh query:

```sql
select count(*) from organizations;
select count(*) from org_members;
select count(*) from accounts;
select count(*) from sales;
select count(*) from purchases;
select count(*) from journal_entries;
```

### Step 7 — Jalankan app verification

```bash
npx tsc --noEmit
npm test
npm run build
```

### Step 8 — Functional verification

Checklist minimal:

- login owner berhasil
- login staff/NIK berhasil atau reset password flow tersedia
- dashboard memuat org aktif
- switch org/branch berhasil
- CoA, cash, purchasing, sales, POS, HRIS bisa membuka data
- laporan utama (`/reports`, `/accounting/*`) tidak error

---

## 9. Validasi Pasca-Migrasi

Bandingkan source vs target untuk tabel kritis:

### Count validation

- organizations
- org_members
- branches
- employees
- accounts
- contacts
- products
- sales / purchases / journal_entries

### Spot-check relational integrity

- setiap `org_members.user_id` ada di `user`
- setiap `employees.org_id` ada di `organizations`
- setiap `journal_lines.entry_id` ada di `journal_entries`
- setiap `sales.branch_id` valid atau null sesuai schema

### Financial reconciliation

- total journal entries sebelum/sesudah
- total AR/AP sample tenant
- stok sample gudang vs stock movement trail

---

## 10. Rollback Plan

Jika load gagal atau data tidak konsisten:

1. stop aplikasi/write access
2. drop/recreate target DB atau restore backup sebelum migrasi
3. import ulang snapshot backup lokal

Contoh rollback:

```bash
docker cp ./backups/pre_migration.dump supabase_db_nizam-app:/tmp/pre_migration.dump
docker exec -it supabase_db_nizam-app dropdb -U postgres --if-exists postgres
docker exec -it supabase_db_nizam-app createdb -U postgres postgres
docker exec -it supabase_db_nizam-app pg_restore -U postgres -d postgres /tmp/pre_migration.dump
```

---

## 11. Risiko & Mitigasi

### Risiko 1 — Hash password legacy tidak kompatibel

Mitigasi:

- migrasikan user identity dulu
- paksa reset password untuk akun yang gagal login

### Risiko 2 — Enum/status lama tidak cocok dengan schema sekarang

Mitigasi:

- gunakan staging tables
- map nilai lama secara eksplisit sebelum upsert final

### Risiko 3 — Branch scoping data lama tidak lengkap

Mitigasi:

- buat branch default mapping per org
- audit tabel branch-aware satu per satu sebelum final cutover

### Risiko 4 — Financial data loaded tapi derived records tidak sinkron

Mitigasi:

- jalankan reconciliation query
- re-run generator/repair scripts internal untuk inventory/journal jika diperlukan

---

## 12. Deliverables yang Disarankan Setelah Planning Ini

Langkah implementasi berikutnya sebaiknya menghasilkan artefak berikut:

1. `migration-data/README.md`
2. `scripts/export_supabase_data.sh`
3. `scripts/load_local_target.sh`
4. `scripts/validate_migration.sql`
5. `scripts/reset_target_from_backup.sh`

---

## 13. Keputusan Teknis yang Disarankan

- **Gunakan direct Postgres export/import bila tersedia**; ini paling aman untuk presisi dan relasi.
- **Jangan migrasikan langsung ke tabel final tanpa staging** untuk domain auth/finance/inventory.
- **Pisahkan migrasi auth dari migrasi transaksi** agar rollback lebih mudah.
- **Jadikan target lokal Docker ini sebagai rehearsal environment** sebelum cutover ke environment permanen lain.

---

## 14. Ringkasan Singkat

Dengan konfigurasi saat ini:

- source = Supabase dari `.env`
- target = PostgreSQL lokal aktif di Docker (`supabase_db_nizam-app`, port host `54322`)

Rencana terbaik adalah:

1. backup target lokal
2. export source Supabase per domain
3. load ke staging/target lokal sesuai urutan relasi
4. transform auth + enum + branch mapping
5. validasi count, relasi, dan finansial
6. verifikasi aplikasi (`tsc`, test, build, smoke test UI)

Dokumen ini siap dipakai sebagai blueprint untuk implementasi script migrasi pada langkah berikutnya.
