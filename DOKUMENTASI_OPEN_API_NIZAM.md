# DOKUMENTASI OPEN API NIZAM

Dokumen ini disinkronkan dengan implementasi runtime dan smoke test terakhir pada 18 April 2026.

Sumber utama:
- `lib/api/openapi.ts`
- `app/api/openapi/route.ts`
- `lib/api/validate-key.ts`
- `lib/api/webhook.ts`
- `lib/api/inventory-webhook-outbox.ts`
- `app/api/v1/cash/route.ts`
- `app/api/v1/inventory/route.ts`
- `app/api/v1/inventory/movements/route.ts`
- `app/api/v1/inventory/reconciliation/route.ts`
- `app/api/v1/general-ledger/route.ts`
- `app/api/v1/sales/route.ts`
- `app/api/v1/sales/[saleId]/route.ts`
- `app/api/v1/purchases/route.ts`
- `app/api/v1/bank-transactions/route.ts`
- `app/api/v1/contacts/upsert/route.ts`
- `app/api/v1/contacts/route.ts`
- `app/api/internal/open-api/process-webhook-outbox/route.ts`
- `app/(dashboard)/developers/api/page.tsx`
- `app/(dashboard)/settings/api/ApiSettingsClient.tsx`
- `modules/organization/actions/api-key.actions.ts`
- `supabase/migrations/1200_open_api.sql`
- `supabase/migrations/1201_api_call_logs.sql`
- `supabase/migrations/1222_open_api_idempotency.sql`
- `supabase/migrations/1223_open_api_inventory_webhook_outbox.sql`
- `supabase/migrations/1226_open_api_ip_allowlist.sql`

## 1. Ringkasan

Open API Nizam adalah lapisan integrasi REST publik untuk sistem eksternal yang perlu:

- membaca data ERP
- membuat transaksi kas masuk atau kas keluar
- memakai API key ber-scope
- memonitor request dan delivery webhook

Fitur yang aktif di implementasi saat ini:

- endpoint publik di `/api/v1/*`
- spesifikasi OpenAPI 3.1 mesin-baca di `/api/openapi`
- portal internal owner/admin di `/developers/api`
- API key per organisasi, opsional dibatasi satu cabang
- whitelist IP/CIDR opsional per API key
- rate limit per menit
- audit trail request
- subscription webhook untuk event kas, sales, purchase, dan inventory movement
- filter webhook inventory berdasarkan arah mutasi dan `reference_type`
- outbox internal untuk webhook inventory dari tabel `stock_movements`
- idempotency untuk `POST /api/v1/cash`

Endpoint bisnis yang sudah tersedia:

- `GET /api/v1/cash`
- `POST /api/v1/cash`
- `GET /api/v1/inventory`
- `GET /api/v1/inventory/movements`
- `GET /api/v1/inventory/reconciliation`
- `GET /api/v1/general-ledger`
- `GET /api/v1/sales`
- `GET /api/v1/sales/{saleId}`
- `GET /api/v1/purchases`
- `GET /api/v1/bank-transactions`
- `GET /api/v1/contacts`
- `POST /api/v1/contacts/upsert`

## 2. Arsitektur Singkat

Komponen utama:

- `lib/api/openapi.ts`
  Builder spesifikasi OpenAPI 3.1.

- `app/api/openapi/route.ts`
  Route GET yang menyajikan spec mesin-baca.

- `lib/api/validate-key.ts`
  Helper untuk validasi API key, scope, rate limit, error envelope, dan call log.

- `app/api/v1/cash/route.ts`
  Route publik untuk baca rekening kas/bank dan membuat transaksi kas.

- `app/api/v1/inventory/route.ts`
  Route publik untuk baca produk inventory dan stok.

- `app/api/v1/inventory/movements/route.ts`
  Route publik untuk baca kartu stok / riwayat pergerakan inventory dari tabel `public.stock_movements`.

- `app/api/v1/inventory/reconciliation/route.ts`
  Route publik untuk baca rekonsiliasi nilai persediaan antara sub-ledger inventory dan buku besar akun persediaan.

- `app/api/v1/general-ledger/route.ts`
  Route publik untuk baca jurnal posted buku besar beserta line account per entry.

- `app/api/v1/sales/route.ts`
  Route publik untuk baca data penjualan dari tabel `public.sales`.

- `app/api/v1/sales/[saleId]/route.ts`
  Route publik untuk baca detail penjualan berikut line item, pembayaran, dan retur.

- `app/api/v1/purchases/route.ts`
  Route publik untuk baca data pembelian dari tabel `public.purchases`.

- `app/api/v1/bank-transactions/route.ts`
  Route publik untuk baca mutasi kas/bank dari tabel `public.bank_transactions`.

- `app/api/v1/contacts/route.ts`
  Route publik untuk baca kontak aktif dari tabel `public.contacts`.

- `app/api/v1/contacts/upsert/route.ts`
  Route publik untuk membuat atau memperbarui kontak customer/supplier dengan perilaku upsert.

- `lib/api/webhook.ts`
  Pengirim webhook HMAC-SHA256.

- `app/(dashboard)/developers/api/page.tsx`
- `app/(dashboard)/settings/api/ApiSettingsClient.tsx`
  Portal admin internal untuk key management, mapping kas, webhook, referensi API, tryout, history, dan onboarding checklist.

## 3. Base URL dan Header

Base URL endpoint bisnis:

```text
https://your-domain.com/api/v1
```

Spec mesin-baca:

```text
https://your-domain.com/api/openapi
```

Portal internal:

```text
/developers/api
```

Header response JSON sukses:

```text
Content-Type: application/json
X-Nizam-API: 1.0
```

Header response error:

```text
Content-Type: application/json
X-Nizam-API: 1.0
X-Nizam-Request-Id: <uuid>
```

Header response `/api/openapi`:

```text
Content-Type: application/vnd.oai.openapi+json; charset=utf-8
Cache-Control: public, max-age=300
```

Semua endpoint `/api/v1/*` memakai `Cache-Control: no-store, no-cache, must-revalidate`.

## 4. Autentikasi, Scope, dan Rate Limit

### Autentikasi

API key dapat dikirim melalui:

```http
x-api-key: nzm_live_xxxxxxxxxxxxxxxxxxxxxxxx
```

atau:

```http
Authorization: Bearer nzm_live_xxxxxxxxxxxxxxxxxxxxxxxx
```

### Whitelist IP

Setiap API key bisa memiliki whitelist IP/CIDR opsional.

- jika `ip_allowlist` kosong, key dapat dipakai dari semua IP
- jika `ip_allowlist` terisi, request hanya diterima dari IP yang match
- format yang didukung:
  - IP tunggal, misalnya `203.0.113.10`
  - IPv4 CIDR, misalnya `203.0.113.0/24`
  - IPv6 CIDR, misalnya `2001:db8::/64`
- validasi whitelist dilakukan sebelum rate limit dihitung
- request dari IP di luar whitelist akan menerima `403` dengan `error_code = ip_not_allowed`
- jika whitelist aktif tetapi runtime tidak bisa menentukan IP caller dari proxy header, request akan menerima `403` dengan `error_code = ip_address_unavailable`

Format key:

```text
nzm_live_<24 karakter random>
```

Penyimpanan key:

- prefix `nzm_live_` disimpan terpisah
- secret disimpan dalam bentuk hash SHA-256
- full key hanya ditampilkan satu kali saat generate

### Scope yang Didukung

- `cash:read`
- `cash:write`
- `sales:read`
- `purchases:read`
- `bank_transactions:read`
- `inventory:read`
- `ledger:read`
- `contacts:read`
- `contacts:write`

### Branch Scope

API key bisa:

- berlaku untuk semua cabang jika `branch_id` kosong
- dibatasi ke satu cabang jika `branch_id` terisi

Khusus `POST /api/v1/cash`:

- jika key tidak branch-scoped, body harus mengirim `branch_id`
- jika key branch-scoped, `branch_id` pada body tidak boleh berbeda

### Rate Limit

Rate limit dicatat di `api_rate_limit_log`.

Perilaku saat ini:

- default `60 req/menit`
- counter dihitung per key per window menit
- saat limit tercapai response adalah `429`

## 5. Error Contract

Response error sudah distandarkan menjadi:

```json
{
  "success": false,
  "error": "Pesan error",
  "message": "Pesan error",
  "error_code": "machine_readable_code",
  "request_id": "uuid"
}
```

Contoh `error_code` yang sekarang dipakai:

- `api_key_missing`
- `api_key_invalid`
- `api_key_not_found`
- `api_key_revoked`
- `api_key_expired`
- `scope_missing`
- `rate_limit_exceeded`
- `branch_scope_mismatch`
- `request_body_invalid`
- `cash_in_counter_account_missing`
- `cash_out_counter_account_missing`
- `idempotency_key_conflict`
- `idempotency_key_in_progress`

Catatan:

- response sukses tidak membawa `request_id`
- response error membawa `X-Nizam-Request-Id` yang sama dengan `request_id` di body

## 6. Endpoint Matrix

| Endpoint | Method | Scope | Masuk `/api/openapi` | Fungsi |
|---|---|---|---|---|
| `/api/v1/cash` | `GET` | `cash:read` | Ya | Daftar rekening kas/bank aktif + saldo posted |
| `/api/v1/cash` | `POST` | `cash:write` | Ya | Buat transaksi kas masuk/keluar |
| `/api/v1/inventory` | `GET` | `inventory:read` | Ya | Daftar produk aktif + stok |
| `/api/v1/inventory/movements` | `GET` | `inventory:read` | Ya | Kartu stok / riwayat mutasi inventory |
| `/api/v1/inventory/reconciliation` | `GET` | `ledger:read` | Ya | Rekonsiliasi nilai inventory vs GL inventory |
| `/api/v1/general-ledger` | `GET` | `ledger:read` | Ya | Daftar jurnal posted beserta line account |
| `/api/v1/sales` | `GET` | `sales:read` | Ya | Daftar penjualan |
| `/api/v1/sales/{saleId}` | `GET` | `sales:read` | Ya | Detail penjualan + item + payment + retur |
| `/api/v1/purchases` | `GET` | `purchases:read` | Ya | Daftar pembelian |
| `/api/v1/bank-transactions` | `GET` | `bank_transactions:read` | Ya | Daftar mutasi kas/bank |
| `/api/v1/contacts` | `GET` | `contacts:read` | Ya | Daftar kontak aktif |
| `/api/v1/contacts/upsert` | `POST` | `contacts:write` | Ya | Buat atau update kontak |

## 7. Spesifikasi OpenAPI 3.1

Builder spec saat ini:

- `openapi: 3.1.0`
- `info.title: Nizam Open API`
- `info.version: 1.5.0`
- `servers[0].url: <base-url>/api/v1`
- `security: ApiKeyAuth` dan `BearerAuth`

Tag yang saat ini sudah didokumentasikan:

- `Cash`
- `Inventory`
- `Sales`
- `Purchases`
- `Bank Transactions`
- `Contacts`

Security schemes:

- `ApiKeyAuth`
  - type: `apiKey`
  - in: `header`
  - name: `x-api-key`

- `BearerAuth`
  - type: `http`
  - scheme: `bearer`
  - bearerFormat: `API Key`

Schema penting yang sekarang tersedia:

- `CashAccount`
- `CashJournalLineInput`
- `InventoryItem`
- `InventoryMovementItem`
- `InventoryReconciliationItem`
- `GeneralLedgerLineItem`
- `GeneralLedgerEntry`
- `SalesItem`
- `SalesDetail`
- `ContactItem`
- `ContactUpsertRequest`
- `PurchaseListItem`
- `BankTransactionItem`
- `CashTransactionResult`
- `ResponseMeta`
- `CashListResponse`
- `InventoryListResponse`
- `InventoryMovementListResponse`
- `InventoryReconciliationListResponse`
- `GeneralLedgerListResponse`
- `SalesListResponse`
- `SalesDetailResponse`
- `PurchaseListResponse`
- `BankTransactionListResponse`
- `ContactsListResponse`
- `ContactUpsertResponse`
- `CreateCashRequest`
- `CreateCashResponse`

Contoh ambil spec:

```bash
curl https://your-domain.com/api/openapi
```

## 8. Detail Endpoint

### GET `/api/v1/cash`

Fungsi:

- membaca rekening aktif dari `bank_accounts`
- menggabungkan akun kas/bank CoA `11xx` yang belum punya bridge `bank_accounts`
- menghitung saldo dari jurnal `POSTED`

Karakteristik:

- `source = bank_account` berarti row berasal dari `bank_accounts`
- `source = gl_account` berarti row berasal langsung dari CoA `11xx`
- `bank_account_id` dapat `null` untuk `gl_account`
- meta `branch_scope` mengikuti scope API key

Status umum:

- `200`
- `401`
- `403`
- `429`

### POST `/api/v1/cash`

Fungsi:

- membuat transaksi kas masuk atau kas keluar ke `bank_transactions`
- mendukung mode sederhana satu akun lawan
- mendukung split jurnal melalui `journal_lines`

Field inti:

- `type`: `in` atau `out`
- `amount`: angka positif
- `description`: wajib
- `reference`: opsional
- `transaction_date`: opsional, default hari ini
- `branch_id`: wajib bila key tidak branch-scoped
- `bank_account_id`: opsional
- `account_id`: opsional, dapat menunjuk akun CoA `11xx`
- `category_id` atau `counter_account_id`: akun lawan sederhana
- `settlement_type`: `general`, `revenue`, `expense`, `receivable`, `payable`, `tax`, `discount`, `other_charge`
- `journal_lines[]`: split jurnal tanpa baris kas/bank

Aturan penting:

- `auto_post` default `true` bila tidak diisi pada konfigurasi
- bila `account_id` menunjuk akun `11xx` dan bridge belum ada, sistem membuat `bank_accounts` otomatis
- `journal_lines` hanya boleh dipakai ketika `auto_post = true`
- setiap line harus punya tepat satu sisi `debit` atau `credit`
- total `journal_lines` plus baris kas/bank harus balance
- untuk `type = out`, transaksi ditolak bila saldo posted tidak cukup
- akun lawan tidak boleh sama dengan akun kas/bank

### Idempotency

`POST /api/v1/cash` sekarang mendukung idempotency dengan dua cara:

- header `Idempotency-Key`
- field body `idempotency_key`

Aturan:

- jika header dan body sama-sama dikirim, nilainya harus sama
- payload yang sama + key yang sama akan replay response sukses sebelumnya
- payload berbeda + key yang sama akan `409`
- key yang masih diproses akan `409`

Header tambahan:

```text
Idempotency-Key: <same-key>
X-Idempotent-Replay: true
```

`X-Idempotent-Replay` hanya muncul saat response berasal dari replay.

Status umum:

- `200`
- `400`
- `401`
- `403`
- `409`
- `422`
- `429`

Contoh sederhana:

```bash
curl https://your-domain.com/api/v1/cash \
  -X POST \
  -H "x-api-key: nzm_live_<your-key>" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: cash-inv-2026-001" \
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

### GET `/api/v1/inventory`

Fungsi:

- membaca produk aktif
- mengagregasi stok inventory
- mendukung filter nama produk

Query parameter:

- `limit`: default `100`, maksimum `500`
- `search`: filter nama produk, case-insensitive

Status umum:

- `200`
- `401`
- `403`
- `429`

### GET `/api/v1/inventory/movements`

Fitur saat ini:

- scope `inventory:read`
- filter `limit`, `product_id`, `reference_type`, `direction`, `date_from`, `date_to`, `search`
- membaca kartu stok dari tabel `public.stock_movements`

Field utama response:

- `id`
- `product_id`
- `product_code`
- `product_name`
- `product_unit`
- `product_category`
- `movement_date`
- `quantity`
- `direction`
- `unit_price`
- `reference_type`
- `reference_id`
- `notes`
- `branch_id`
- `created_at`

Catatan:

- `quantity` tetap signed agar integrator bisa menghitung saldo berjalan
- `direction` disediakan sebagai helper `in` / `out` / `neutral`
- `reference_type` saat ini bisa berisi nilai seperti `SALE`, `PURCHASE`, `ADJUSTMENT`, `PRODUCTION_OUTPUT`, `PRODUCTION_CONSUMPTION`

Status umum:

- `200`
- `400`
- `401`
- `403`
- `429`

### GET `/api/v1/inventory/reconciliation`

Fitur saat ini:

- scope `ledger:read`
- filter `limit`, `product_id`, `as_of_date`, `variance_only`, `search`
- membandingkan nilai inventory sub-ledger dari `stock_movements` dengan saldo buku besar akun `1301-1399`

Field utama response:

- `product_id`
- `product_code`
- `product_name`
- `product_unit`
- `product_category`
- `stock_qty`
- `avg_cost`
- `on_hand_value`
- `ledger_value`
- `variance`

Catatan:

- `on_hand_value` dihitung dari `stock_qty * average_cost`
- `ledger_value` di level produk adalah alokasi proporsional dari total saldo GL inventory, bukan posting GL per item secara langsung
- metadata juga membawa `on_hand_value`, `gl_inventory_balance`, `inventory_variance`, `valuation_method`, dan `gl_account_range`

Status umum:

- `200`
- `400`
- `401`
- `403`
- `429`

### GET `/api/v1/general-ledger`

Fitur saat ini:

- scope `ledger:read`
- filter `limit`, `date_from`, `date_to`, `account_id`, `account_code`, `reference_type`, `search`
- hanya mengembalikan jurnal `POSTED`

Field utama response:

- `id`
- `entry_number`
- `entry_date`
- `description`
- `reference_type`
- `reference_id`
- `status`
- `notes`
- `posted_at`
- `created_at`
- `branch_id`
- `total_debit`
- `total_credit`
- `journal_lines`

Catatan:

- filter `account_id` / `account_code` bekerja berdasarkan keberadaan line akun di suatu entry
- tetapi response tetap mengembalikan seluruh `journal_lines` dari entry yang match

Status umum:

- `200`
- `400`
- `401`
- `403`
- `429`

### GET `/api/v1/sales`

Fitur saat ini:

- scope `sales:read`
- filter `limit`, `status`, `date_from`, `date_to`
- membaca data dari tabel `public.sales`
- menghormati pembatasan cabang dari API key

Response item:

- `id`
- `so_number`
- `customer_name`
- `total_amount`
- `status`
- `branch_id`
- `order_date`
- `created_at`

Status umum:

- `200`
- `401`
- `403`
- `429`

### GET `/api/v1/sales/{saleId}`

Fitur saat ini:

- scope `sales:read`
- membaca satu dokumen penjualan berdasarkan `saleId`
- mengembalikan header dokumen, `items`, `payments`, dan `returns`
- menghormati pembatasan cabang dari API key

Field utama response:

- `id`
- `so_number`
- `customer_id`
- `customer_name`
- `total_amount`
- `tax_amount`
- `discount_amount`
- `grand_total`
- `status`
- `payment_status`
- `branch_id`
- `branch_name`
- `warehouse_id`
- `warehouse_name`
- `order_date`
- `due_date`
- `items[]`
- `payments[]`
- `returns[]`

Status umum:

- `200`
- `401`
- `403`
- `404`
- `429`

### GET `/api/v1/purchases`

Fitur saat ini:

- scope `purchases:read`
- filter `limit`, `status`, `payment_status`, `date_from`, `date_to`
- membaca data dari tabel `public.purchases`
- menghormati pembatasan cabang dari API key

Response item:

- `id`
- `po_number`
- `vendor_name`
- `total_amount`
- `status`
- `payment_status`
- `branch_id`
- `purchase_date`
- `due_date`
- `item_count`
- `created_at`

Status umum:

- `200`
- `401`
- `403`
- `429`

### GET `/api/v1/bank-transactions`

Fitur saat ini:

- scope `bank_transactions:read`
- filter `limit`, `type`, `status`, `date_from`, `date_to`, `search`
- membaca data dari tabel `public.bank_transactions`
- menghormati pembatasan cabang dari API key

Field utama response:

- `id`
- `bank_account_id`
- `cash_account_id`
- `cash_account_code`
- `cash_account_name`
- `bank_name`
- `account_number`
- `description`
- `amount`
- `type`
- `reference_number`
- `status`
- `category_id`
- `category_code`
- `category_name`
- `journal_entry_id`
- `branch_id`
- `transaction_date`
- `created_at`

Catatan:

- `type` dinormalisasi menjadi `in` / `out`
- `search` melakukan pencarian pada `description` dan `reference_number`

Status umum:

- `200`
- `401`
- `403`
- `429`

### GET `/api/v1/contacts`

Fitur saat ini:

- scope `contacts:read`
- filter `limit`, `type`, `search`
- membaca kontak aktif dari tabel `public.contacts`

Field yang sekarang benar-benar ada di response:

- `id`
- `name`
- `email`
- `phone`
- `phone_wa`
- `instagram`
- `address`
- `type`
- `is_active`
- `created_at`

Status umum:

- `200`
- `401`
- `403`
- `429`

### POST `/api/v1/contacts/upsert`

Fitur saat ini:

- scope `contacts:write`
- membuat kontak baru atau memperbarui kontak lama dengan satu endpoint
- urutan pencocokan: `id`, `email`, `phone_wa`, `phone`, lalu `name` pada tipe kontak yang sama
- bila kontak lama ditemukan, response tetap `200` dengan metadata `action = updated`

Field request:

- `id`
- `name`
- `type`
- `email`
- `phone`
- `phone_wa`
- `instagram`
- `address`
- `is_active`

Metadata response:

- `meta.action`: `created` atau `updated`
- `meta.matched_by`: `id`, `email`, `phone_wa`, `phone`, `name`, atau `insert`

Status umum:

- `200`
- `400`
- `401`
- `403`
- `429`

## 9. Portal Admin `/developers/api`

Portal hanya bisa diakses oleh:

- `owner`
- `admin`

Fitur portal:

- generate API key
- tampilkan full key sekali setelah generate
- revoke key
- atur scope
- atur `branch_id`
- atur `rate_limit_rpm`
- atur `expires_at`
- simpan konfigurasi cash-in dan cash-out
- simpan konfigurasi webhook
- dokumentasi visual endpoint
- tab tryout request dari browser
- history request API
- history delivery webhook
- onboarding checklist kesiapan integrasi

Checklist onboarding saat ini memeriksa:

- API key aktif
- akun kas/bank `11xx`
- bridge `bank_accounts`
- default cash-in mapping
- default cash-out mapping
- webhook aktif

## 10. Webhook

Konfigurasi webhook disimpan di `api_configurations`.

Field utama:

- `webhook_url`
- `webhook_secret`
- `webhook_events`
- `webhook_is_active`
- `webhook_inventory_directions`
- `webhook_inventory_reference_types`

Event yang sekarang bisa dipilih di pengaturan:

- `cash_in`
- `cash_out`
- `sale`
- `purchase`
- `inventory_movement`

Header yang dikirim:

```text
Content-Type: application/json
X-Nizam-Webhook-Event: <event>
X-Nizam-Webhook-Signature: sha256=<hex>
X-Nizam-Webhook-Timestamp: <unix-ms>
User-Agent: Nizam-Webhook/1.0
```

Event type yang didefinisikan:

- `cash_in`
- `cash_out`
- `sale`
- `purchase`
- `inventory_movement`

Khusus `inventory_movement`:

- deteksi stok masuk/keluar didasarkan pada tanda `quantity` di `stock_movements`, bukan pada pemilihan akun buku besar
- `quantity > 0` dianggap `direction = in`
- `quantity < 0` dianggap `direction = out`
- void sale akan menghasilkan movement kompensasi dengan `reference_type = SALE_VOID`
- void purchase akan menghasilkan movement kompensasi dengan `reference_type = PURCHASE_VOID`
- jika `webhook_inventory_directions` kosong, semua arah dikirim
- jika `webhook_inventory_reference_types` kosong, semua `reference_type` dikirim

Payload inventory movement yang dikirim saat ini memuat snapshot utama:

- `movement_id`
- `product_id`
- `product_code`
- `product_name`
- `movement_date`
- `quantity`
- `direction`
- `unit_price`
- `reference_type`
- `reference_id`
- `notes`
- `branch_id`

Contoh header yang diterima implementor:

```text
Content-Type: application/json
X-Nizam-Webhook-Event: inventory_movement
X-Nizam-Webhook-Signature: sha256=<hex>
X-Nizam-Webhook-Timestamp: <unix-ms>
User-Agent: Nizam-Webhook/1.0
```

Contoh verifikasi signature di server implementor:

```ts
import crypto from 'node:crypto'

const signature = req.headers['x-nizam-webhook-signature']
const rawBody = Buffer.isBuffer(req.rawBody)
  ? req.rawBody
  : Buffer.from(String(req.rawBody || ''), 'utf8')

const expected = 'sha256=' + crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(rawBody)
  .digest('hex')

if (signature !== expected) {
  throw new Error('Invalid signature')
}
```

Catatan:

- gunakan body mentah sebelum `JSON.parse`
- jangan gunakan `JSON.stringify(req.body)` untuk verifikasi HMAC
- di Next.js route handler Anda bisa memakai `await request.text()`, sedangkan di Express gunakan middleware yang menyimpan raw body

Contoh payload `inventory_movement` stok masuk hasil smoke test:

```json
{
  "event": "inventory_movement",
  "org_id": "4d253fb0-9dd2-42e2-86b4-2706ff7a701c",
  "branch_id": "67d61da3-0c58-412e-abcd-d0cd1a0a3550",
  "timestamp": "2026-04-18T13:21:29.248Z",
  "data": {
    "notes": "SMOKE WEBHOOK IN",
    "quantity": 5,
    "branch_id": "67d61da3-0c58-412e-abcd-d0cd1a0a3550",
    "direction": "in",
    "created_at": "2026-04-18T13:21:29.049297+00:00",
    "product_id": "f2a248c1-f0d1-46dd-8771-7c6e6f2fae30",
    "unit_price": 12500,
    "movement_id": "2eb6dab4-9208-45e7-b946-d14371f13ca3",
    "product_code": "SMOKE-WH-1776518488399",
    "product_name": "Produk Smoke Webhook",
    "product_unit": "Pcs",
    "reference_id": "411f110b-d1c1-4129-8c0d-3e59751f4f73",
    "movement_date": "2026-04-18T13:21:29.049297+00:00",
    "reference_type": "PURCHASE",
    "product_category": "Smoke Test"
  }
}
```

Contoh payload `inventory_movement` stok keluar hasil smoke test:

```json
{
  "event": "inventory_movement",
  "org_id": "4d253fb0-9dd2-42e2-86b4-2706ff7a701c",
  "branch_id": "67d61da3-0c58-412e-abcd-d0cd1a0a3550",
  "timestamp": "2026-04-18T13:21:29.472Z",
  "data": {
    "notes": "SMOKE WEBHOOK OUT",
    "quantity": -2,
    "branch_id": "67d61da3-0c58-412e-abcd-d0cd1a0a3550",
    "direction": "out",
    "created_at": "2026-04-18T13:21:29.049297+00:00",
    "product_id": "f2a248c1-f0d1-46dd-8771-7c6e6f2fae30",
    "unit_price": 12500,
    "movement_id": "bc164441-29b4-4e96-b053-c0c59e124f67",
    "product_code": "SMOKE-WH-1776518488399",
    "product_name": "Produk Smoke Webhook",
    "product_unit": "Pcs",
    "reference_id": "5e70e892-6531-456b-8330-d8ba48dda2f7",
    "movement_date": "2026-04-18T13:21:29.049297+00:00",
    "reference_type": "SALE",
    "product_category": "Smoke Test"
  }
}
```

Catatan implementasi saat ini:

- `cash_in` dan `cash_out` tetap dikirim langsung dari route publik
- `inventory_movement` dikumpulkan via outbox `api_webhook_outbox` dari trigger `AFTER INSERT` pada `stock_movements`, termasuk movement kompensasi saat void sale/purchase
- worker internal Next standalone memanggil route privat `/api/internal/open-api/process-webhook-outbox` setiap beberapa detik untuk mengosongkan outbox
- delivery dicatat ke `api_webhook_deliveries`
- timeout outbound request adalah `10 detik`

## 11. Tabel dan Migrasi Pendukung

Tabel utama Open API:

- `api_keys`
  Metadata API key, scope, branch scope, expiry, rate limit, dan status aktif.

- `api_rate_limit_log`
  Counter request per key per menit.

- `api_configurations`
  Mapping default cash-in/cash-out dan konfigurasi webhook.

- `api_webhook_deliveries`
  Log delivery webhook.

- `api_call_logs`
  Audit trail request ke Open API.

- `api_idempotency_keys`
  Penyimpanan idempotency write request untuk `POST /api/v1/cash`.

- `api_webhook_outbox`
  Queue internal untuk event webhook inventory yang berasal dari `stock_movements`.

RLS saat ini:

- `api_keys` hanya dikelola owner/admin
- `api_configurations` hanya dikelola owner/admin
- `api_webhook_deliveries` hanya dilihat owner/admin
- `api_call_logs` hanya dilihat owner/admin
- `api_rate_limit_log` dan `api_idempotency_keys` dipakai server-side

Migrasi Open API yang relevan:

- `1200_open_api.sql`
- `1201_api_call_logs.sql`
- `1222_open_api_idempotency.sql`
- `1223_open_api_inventory_webhook_outbox.sql`

## 12. Environment

Open API saat ini berjalan di atas PostgreSQL native, bukan bergantung pada Supabase Cloud runtime.

Environment penting:

- `DATABASE_URL`
- `RAILWAY_DATABASE_URL`
- `DATABASE_PUBLIC_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SITE_URL`
- `INTERNAL_WEBHOOK_WORKER_TOKEN` untuk route privat worker inventory. Saat `npm start`, token ini akan dibuat otomatis bila tidak diset.

Catatan:

- folder `supabase/migrations/` masih dipakai sebagai lokasi file SQL migration
- `createAdminClient()` di layer kompatibilitas saat ini diarahkan ke PostgreSQL native

## 13. Hasil Verifikasi Terakhir

Smoke test terbaru pada tenant uji `coba@xales.id` memverifikasi:

- `/api/openapi` `200` dan versi `1.5.0`
- `/api/v1/sales` `200`
- `/api/v1/contacts` `200`
- `POST /api/v1/cash` `200`
- replay idempotency `POST /api/v1/cash` `200` dengan `X-Idempotent-Replay: true`
- payload berbeda dengan key yang sama menghasilkan `409 idempotency_key_conflict`

Verifikasi test untuk paket `v1.2`:

- route baru `/api/v1/purchases` lulus unit test
- route baru `/api/v1/bank-transactions` lulus unit test
- route baru `/api/v1/sales/{saleId}` lulus unit test
- route baru `/api/v1/contacts/upsert` lulus unit test
- route baru `/api/v1/inventory/movements` lulus unit test
- route baru `/api/v1/inventory/reconciliation` lulus unit test
- route baru `/api/v1/general-ledger` lulus unit test
- spec `/api/openapi` sinkron dengan endpoint dan schema baru

## 14. Rekomendasi Penggunaan

Urutan penggunaan yang direkomendasikan:

1. owner/admin membuat API key dari `/developers/api`
2. pilih scope minimum sesuai kebutuhan
3. siapkan akun kas/bank `11xx` dan bridge `bank_accounts` bila integrasi write kas akan dipakai
4. isi `api_configurations` untuk default cash-in/cash-out
5. gunakan `/api/openapi` untuk import kontrak ke tool integrasi
6. untuk semua write request, kirim `Idempotency-Key`
7. monitor history request dan delivery webhook di portal admin
