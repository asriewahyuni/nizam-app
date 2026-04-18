# DOKUMENTASI OPEN API NIZAM

Dokumen ini diaudit berdasarkan implementasi aktual pada 16 April 2026.

Sumber utama audit:
- `lib/api/openapi.ts`
- `app/api/openapi/route.ts`
- `lib/api/validate-key.ts`
- `lib/api/webhook.ts`
- `app/api/v1/cash/route.ts`
- `app/api/v1/inventory/route.ts`
- `app/api/v1/sales/route.ts`
- `app/api/v1/contacts/route.ts`
- `app/(dashboard)/developers/api/page.tsx`
- `app/(dashboard)/settings/api/ApiSettingsClient.tsx`
- `modules/organization/actions/api-key.actions.ts`
- `supabase/migrations/1200_open_api.sql`
- `supabase/migrations/1201_api_call_logs.sql`

## 1. Ringkasan

Open API Nizam adalah lapisan integrasi REST publik untuk sistem eksternal yang perlu membaca data ERP atau mendorong transaksi ke Nizam. Fitur ini terdiri dari:

- endpoint publik di `/api/v1/*`
- spesifikasi OpenAPI 3.1 mesin-baca di `/api/openapi`
- portal admin internal di `/developers/api`
- API key ber-scope dan bisa dibatasi per cabang
- rate limit, call logging, dan webhook delivery log

Use case utama yang sudah berjalan di kode saat ini:

- membaca daftar rekening kas dan bank
- membuat transaksi kas masuk atau kas keluar
- membaca stok inventori
- membaca data penjualan
- membaca data kontak

Catatan penting:
- spesifikasi OpenAPI mesin-baca saat ini baru mendokumentasikan `/cash` dan `/inventory`
- route `/sales` dan `/contacts` sudah ada, tetapi belum dimasukkan ke `lib/api/openapi.ts`

## 2. Komponen Utama

- `lib/api/openapi.ts`
  Builder spesifikasi OpenAPI 3.1. Mendefinisikan `info`, `servers`, `security`, `paths`, `components.securitySchemes`, dan `components.schemas`.

- `app/api/openapi/route.ts`
  Endpoint GET yang mengembalikan spesifikasi mesin-baca. Base URL diambil dari `NEXT_PUBLIC_APP_URL`, atau fallback ke `origin` request.

- `lib/api/validate-key.ts`
  Utilitas inti untuk:
  - ekstraksi API key dari header
  - validasi format, status aktif, expiry, dan scope
  - rate limiting per menit
  - standardisasi response JSON
  - pencatatan call history

- `app/api/v1/cash/route.ts`
  Endpoint publik untuk baca rekening kas/bank dan membuat transaksi kas.

- `app/api/v1/inventory/route.ts`
  Endpoint publik untuk membaca daftar produk aktif dan stok.

- `app/api/v1/sales/route.ts`
  Endpoint publik untuk membaca data penjualan.

- `app/api/v1/contacts/route.ts`
  Endpoint publik untuk membaca data kontak customer/supplier.

- `lib/api/webhook.ts`
  Pengirim webhook HMAC-SHA256 untuk event integrasi.

- `app/(dashboard)/developers/api/page.tsx` dan `app/(dashboard)/settings/api/ApiSettingsClient.tsx`
  Portal internal owner/admin untuk generate key, konfigurasi cash mapping, dokumentasi visual, tryout request, webhook, dan call history.

## 3. Cara Akses

### Base URL

Base URL publik untuk endpoint bisnis:

```text
https://your-domain.com/api/v1
```

Spesifikasi mesin-baca tersedia di:

```text
https://your-domain.com/api/openapi
```

Portal manajemen internal tersedia di:

```text
/developers/api
```

### Header Response

Endpoint helper `apiSuccess()` dan `apiError()` menambahkan:

```text
Content-Type: application/json
X-Nizam-API: 1.0
```

Endpoint `/api/openapi` mengembalikan:

```text
Content-Type: application/vnd.oai.openapi+json; charset=utf-8
Cache-Control: public, max-age=300
```

Endpoint v1 publik juga dipaksa `no-store` agar hasil tidak di-cache.

## 4. Autentikasi dan Scope

### Mekanisme Autentikasi

API key bisa dikirim dengan dua cara:

```http
x-api-key: nzm_live_xxxxxxxxxxxxxxxxxxxxxxxx
```

atau:

```http
Authorization: Bearer nzm_live_xxxxxxxxxxxxxxxxxxxxxxxx
```

Format key:

```text
nzm_live_<24 karakter random>
```

Implementasi penyimpanan key:

- prefix `nzm_live_` disimpan terpisah
- secret di-hash SHA-256
- full key hanya ditampilkan satu kali saat generate

### Scope yang Didukung

Scope valid yang didefinisikan saat ini:

- `cash:read`
- `cash:write`
- `sales:read`
- `inventory:read`
- `contacts:read`

### Pembatasan Cabang

API key bisa:

- berlaku untuk semua cabang jika `branch_id` kosong
- dibatasi ke satu cabang jika `branch_id` diisi

Khusus `POST /api/v1/cash`:

- jika key tidak branch-scoped, request wajib mengirim `branch_id`
- jika key sudah branch-scoped, `branch_id` pada body tidak boleh berbeda

### Rate Limit

Rate limit disimpan per API key per menit di tabel `api_rate_limit_log`.

Perilaku saat ini:

- default `60 req/menit`
- counter direset per window menit
- saat limit tercapai response menjadi `429`

## 5. Alur Request

Untuk setiap request publik, flow utamanya adalah:

1. ekstrak API key dari header
2. validasi format key
3. cek apakah key aktif
4. cek expiry
5. cek rate limit
6. cek scope
7. eksekusi query sesuai `org_id` dan `branch_id`
8. tulis log ke `api_call_logs`

Metadata yang dicatat ke log:

- `org_id`
- `api_key_id`
- HTTP method
- endpoint path
- status code
- durasi request
- IP address
- user agent
- pesan error singkat bila ada

## 6. Endpoint Matrix

| Endpoint | Method | Scope | Masuk `/api/openapi` | Fungsi |
|---|---|---|---|---|
| `/api/v1/cash` | `GET` | `cash:read` | Ya | Daftar rekening kas/bank aktif + saldo posted |
| `/api/v1/cash` | `POST` | `cash:write` | Ya | Buat transaksi kas masuk/keluar |
| `/api/v1/inventory` | `GET` | `inventory:read` | Ya | Daftar produk aktif + stok |
| `/api/v1/sales` | `GET` | `sales:read` | Tidak | Daftar sales order / invoice |
| `/api/v1/contacts` | `GET` | `contacts:read` | Tidak | Daftar kontak aktif |

## 7. Spesifikasi OpenAPI 3.1

`lib/api/openapi.ts` membangun spesifikasi dengan properti utama berikut:

- `openapi: 3.1.0`
- `info.title: Nizam Open API`
- `info.version: 1.0.0`
- `servers[0].url: <base-url>/api/v1`
- `security: ApiKeyAuth` dan `BearerAuth`
- tag utama: `Cash` dan `Inventory`

### Security Schemes

- `ApiKeyAuth`
  - type: `apiKey`
  - in: `header`
  - name: `x-api-key`

- `BearerAuth`
  - type: `http`
  - scheme: `bearer`
  - bearerFormat: `API Key`

### Schema yang Sudah Didefinisikan

Schema penting yang sudah tersedia di `components.schemas`:

- `CashAccount`
- `CashJournalLineInput`
- `InventoryItem`
- `CashTransactionResult`
- `ResponseMeta`
- `CashListResponse`
- `InventoryListResponse`
- `CreateCashRequest`
- `CreateCashResponse`

### Contoh Ambil Spec

```bash
curl https://your-domain.com/api/openapi
```

Spec ini bisa dipakai untuk:

- Swagger UI
- Postman import
- SDK generator
- validasi kontrak API

## 8. Detail Endpoint

### GET `/api/v1/cash`

Fungsi:

- mengembalikan rekening bank aktif dari tabel `bank_accounts`
- menggabungkan akun kas/bank CoA `11xx` yang aktif meskipun belum punya bridge `bank_accounts`
- menghitung saldo dari jurnal berstatus `POSTED`

Karakteristik penting:

- response memuat `source`
- `source = bank_account` berarti row berasal dari `bank_accounts`
- `source = gl_account` berarti akun berasal langsung dari CoA `11xx`
- `bank_account_id` bisa `null` untuk `gl_account`
- `branch_scope` di meta mengikuti pembatasan API key

Contoh:

```bash
curl "https://your-domain.com/api/v1/cash" \
  -H "x-api-key: nzm_live_<your-key>" \
  -H "Accept: application/json"
```

Status yang umum:

- `200` berhasil
- `401` key hilang, tidak valid, nonaktif, atau expired
- `403` scope `cash:read` tidak ada
- `429` rate limit tercapai

### POST `/api/v1/cash`

Fungsi:

- mencatat kas masuk atau kas keluar ke `bank_transactions`
- dapat memakai mode sederhana dengan satu akun lawan
- dapat memakai mode split jurnal dengan `journal_lines`

Field inti:

- `type`: `in` atau `out`
- `amount`: angka positif
- `description`: wajib
- `reference`: opsional
- `transaction_date`: opsional, default hari ini
- `branch_id`: wajib jika key tidak dibatasi ke cabang tertentu
- `bank_account_id`: opsional
- `account_id`: opsional, bisa menunjuk akun CoA kas/bank `11xx`
- `category_id` atau `counter_account_id`: akun lawan untuk mode sederhana
- `settlement_type`: `general`, `revenue`, `expense`, `receivable`, `payable`, `tax`, `discount`, `other_charge`
- `journal_lines[]`: split jurnal tanpa baris kas/bank

Aturan penting:

- `auto_post` default bernilai `true` bila tidak diisi di konfigurasi
- jika `account_id` menunjuk akun CoA `11xx` dan bridge `bank_accounts` belum ada, sistem akan membuat bridge otomatis
- urutan pencarian rekening untuk write adalah:
  1. `bank_account_id`
  2. `account_id`
  3. default account dari `api_configurations`
  4. satu-satunya `bank_account` aktif pada cabang tersebut
- `journal_lines` hanya boleh dipakai saat `auto_post = true`
- setiap line harus punya tepat satu sisi: `debit` atau `credit`
- total `journal_lines` plus baris kas/bank harus balance
- untuk `type = out`, sistem menolak transaksi jika saldo posted tidak cukup
- akun lawan tidak boleh sama dengan akun kas/bank

Mapping akun lawan dapat berasal dari:

- body request
- `cash_in_params`
- `cash_out_params`

Key konfigurasi JSON yang dikenali:

- `default_description`
- `auto_post`
- `counter_account_id`
- `revenue_account_id`
- `expense_account_id`
- `receivable_account_id`
- `payable_account_id`
- `tax_account_id`
- `discount_account_id`
- `other_charge_account_id`
- `other_fee_account_id`

Contoh kas masuk sederhana:

```bash
curl https://your-domain.com/api/v1/cash \
  -X POST \
  -H "x-api-key: nzm_live_<your-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "in",
    "amount": 250000,
    "description": "Pelunasan invoice INV-2026-001",
    "reference": "INV-2026-001",
    "branch_id": "branch-uuid",
    "transaction_date": "2026-04-15",
    "account_id": "cash-account-uuid",
    "settlement_type": "receivable"
  }'
```

Contoh kas keluar split jurnal:

```bash
curl https://your-domain.com/api/v1/cash \
  -X POST \
  -H "x-api-key: nzm_live_<your-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "out",
    "amount": 15000,
    "description": "Push marketplace pembelian buku",
    "reference": "PO-MP-BOOK-2026-0001",
    "branch_id": "branch-uuid",
    "transaction_date": "2026-04-15",
    "account_id": "cash-account-uuid",
    "journal_lines": [
      { "account_id": "inventory-account-uuid", "debit": 19200, "memo": "Persediaan" },
      { "account_id": "tax-account-uuid", "debit": 1920, "memo": "PPN masukan" },
      { "account_id": "other-charge-account-uuid", "debit": 2000, "memo": "Ongkir" },
      { "account_id": "discount-account-uuid", "credit": 1000, "memo": "Diskon" },
      { "account_id": "payable-account-uuid", "credit": 7120, "memo": "Sisa hutang" }
    ]
  }'
```

Status yang umum:

- `200` berhasil
- `400` JSON/body tidak valid
- `401` autentikasi gagal
- `403` scope `cash:write` tidak ada
- `422` konfigurasi rekening, akun lawan, saldo, atau jurnal tidak valid
- `429` rate limit tercapai

### GET `/api/v1/inventory`

Fungsi:

- membaca produk aktif
- mengagregasi stok dari `inventory_stocks`
- memfilter warehouse aktif
- mendukung filter nama produk

Query parameter:

- `limit`: default `100`, maksimum `500`
- `search`: filter nama produk, case-insensitive

Contoh:

```bash
curl "https://your-domain.com/api/v1/inventory?limit=20&search=buku" \
  -H "x-api-key: nzm_live_<your-key>" \
  -H "Accept: application/json"
```

Status yang umum:

- `200` berhasil
- `401` autentikasi gagal
- `403` scope `inventory:read` tidak ada
- `429` rate limit tercapai

### GET `/api/v1/sales`

Endpoint ini sudah diimplementasikan tetapi belum masuk spesifikasi OpenAPI mesin-baca.

Fitur saat ini:

- scope `sales:read`
- filter `limit`, `status`, `date_from`, `date_to`
- membaca `sales_orders`
- otomatis menghormati pembatasan cabang dari API key

### GET `/api/v1/contacts`

Endpoint ini sudah diimplementasikan tetapi belum masuk spesifikasi OpenAPI mesin-baca.

Fitur saat ini:

- scope `contacts:read`
- filter `limit`, `type`, `search`
- membaca kontak aktif dari tabel `contacts`

## 9. Konfigurasi Open API di Portal Admin

Portal `/developers/api` hanya bisa diakses oleh role:

- `owner`
- `admin`

Fitur portal yang tersedia:

- generate API key baru
- menampilkan full key sekali setelah generate
- revoke key
- mengatur scope
- mengatur pembatasan `branch_id`
- mengatur `rate_limit_rpm`
- mengatur `expires_at`
- menyimpan konfigurasi cash-in dan cash-out
- menyimpan konfigurasi webhook
- melihat dokumentasi visual endpoint
- mencoba request langsung dari browser pada tab "Try API"
- melihat riwayat panggilan API
- melihat riwayat delivery webhook

Perilaku konfigurasi:

- konfigurasi cash dan webhook disimpan di `api_configurations`
- saat route kas membaca konfigurasi, sistem lebih dulu mencari konfigurasi cabang spesifik
- jika tidak ada, sistem fallback ke konfigurasi default organisasi dengan `branch_id = null`

## 10. Webhook

Konfigurasi webhook disimpan di `api_configurations`.

Field penting:

- `webhook_url`
- `webhook_secret`
- `webhook_events`
- `webhook_is_active`

Header yang dikirim:

```text
Content-Type: application/json
X-Nizam-Webhook-Event: <event>
X-Nizam-Webhook-Signature: sha256=<hex>
X-Nizam-Webhook-Timestamp: <unix-ms>
User-Agent: Nizam-Webhook/1.0
```

Payload dasar:

```json
{
  "event": "cash_in",
  "org_id": "org-uuid",
  "branch_id": "branch-uuid",
  "timestamp": "2026-04-16T10:00:00.000Z",
  "data": {}
}
```

Event type yang didefinisikan:

- `cash_in`
- `cash_out`
- `sale`
- `purchase`

Catatan implementasi saat ini:

- `deliverWebhook()` mendukung keempat event di atas
- trigger nyata yang terlihat di kode saat ini baru berasal dari `POST /api/v1/cash`, yaitu `cash_in` dan `cash_out`
- delivery dicatat ke tabel `api_webhook_deliveries`
- timeout outbound request adalah `10 detik`

## 11. Tabel dan Migrasi Pendukung

Tabel utama yang dibentuk oleh migrasi Open API:

- `api_keys`
  Menyimpan metadata API key, scope, branch scope, expiry, rate limit, request counter, dan status aktif.

- `api_rate_limit_log`
  Menyimpan counter request per key per menit.

- `api_configurations`
  Menyimpan default account mapping cash-in/cash-out dan konfigurasi webhook.

- `api_webhook_deliveries`
  Menyimpan status pengiriman webhook.

- `api_call_logs`
  Menyimpan audit trail setiap request ke Open API.

RLS saat ini:

- `api_keys` hanya bisa dikelola owner/admin organisasi
- `api_configurations` hanya bisa dikelola owner/admin organisasi
- `api_webhook_deliveries` hanya bisa dilihat owner/admin organisasi
- `api_call_logs` hanya bisa dilihat owner/admin organisasi
- `api_rate_limit_log` dipakai service role, tidak memerlukan RLS untuk user biasa

## 12. Environment Variable Terkait

Open API tidak memiliki env var khusus tersendiri, tetapi bergantung pada:

- `NEXT_PUBLIC_APP_URL`
  Dipakai sebagai fallback base URL untuk `/api/openapi`.

- `NEXT_PUBLIC_SITE_URL`
  Legacy alias yang masih dipakai di beberapa flow lama.

- `SUPABASE_SERVICE_ROLE_KEY` atau `SUPABASE_LOCAL_SERVICE_ROLE_KEY`
  Diperlukan oleh `createAdminClient()` untuk validasi key, rate limit log, webhook log, dan call log.

## 13. Known Gaps dan Catatan Implementasi

- Badge endpoint di portal internal menampilkan `/cash`, `/sales`, `/inventory`, dan `/contacts`, tetapi spesifikasi OpenAPI mesin-baca baru mencakup `/cash` dan `/inventory`.
- Dokumentasi visual di portal internal juga saat ini hanya fokus pada tiga operasi: read cash, read inventory, dan create cash.
- Event webhook `sale` dan `purchase` sudah disiapkan di tipe dan konfigurasi, tetapi trigger konkretnya belum terlihat pada route publik yang diaudit.
- Versi spesifikasi masih `1.0.0`, jadi setiap penambahan endpoint ke `lib/api/openapi.ts` sebaiknya diikuti update versioning dan contoh payload.

## 14. Rekomendasi Penggunaan

Untuk integrasi eksternal yang stabil, urutan penggunaan yang direkomendasikan adalah:

1. owner/admin membuat API key dari `/developers/api`
2. pilih scope minimal sesuai kebutuhan integrasi
3. bila integrasi kas dipakai, set `api_configurations` untuk cash-in/cash-out dan webhook
4. gunakan `/api/openapi` untuk import ke tool integrasi
5. monitor penggunaan lewat tab history dan webhook delivery di portal admin
