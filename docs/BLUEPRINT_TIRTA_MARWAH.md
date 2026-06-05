# BLUEPRINT EKSEKUSI — TIRTA MARWAH
## Workshop Fleet Internal + Tirta Canvasser Pro
**Versi**: 1.0 | **Tanggal**: 05 Juni 2026 | **Status**: Ready to Build

---

## KONTEKS EKSEKUSI

Dokumen ini adalah spesifikasi teknis lengkap untuk dieksekusi oleh AI melalui prompting.
Setiap bagian harus dieksekusi sesuai urutan. Jangan buat ulang yang sudah ada.

### Yang SUDAH ADA (jangan disentuh kecuali disebutkan):
- `/app/(dashboard)/workshop/` — Workshop modul untuk bengkel komersial (customer eksternal)
- `/modules/workshop/` — actions, types Workshop
- `/app/(dashboard)/sales/co-sales/CoSalesDashboardClient.tsx` — shell kosong (92 baris, mock data)
- Tabel `contacts` — punya field `credit_limit`
- Tabel `sales_invoices` / `journal_lines` — sumber data AR
- Modul `fixed_assets` — untuk registrasi kendaraan fleet

### Holding context:
- Tirta Marwah = anak perusahaan Bintang Marwah Group
- Menginduk Platform Enterprise — tidak ada biaya tambahan platform
- Operasional terpisah, data terisolasi per `org_id`

---

## BAGIAN 1: WORKSHOP FLEET INTERNAL
### Adaptasi Workshop untuk Armada Internal Tirta Marwah

---

### 1.1 SITUASI SAAT INI

Workshop yang ada (`/workshop`) dirancang untuk **bengkel komersial** (kendaraan milik customer eksternal):
- `WorkshopVehicle.contactId` → merujuk ke contact (pemilik kendaraan eksternal)
- Work order menghasilkan invoice ke customer
- Tidak ada koneksi ke `fixed_assets`

Untuk Tirta Marwah, workshop dipakai untuk **fleet internal** (kendaraan milik perusahaan):
- Kendaraan = aset tetap milik Tirta Marwah (motor, mobil box, truk)
- Biaya servis = beban operasional, bukan tagihan ke customer
- Work order tidak menghasilkan invoice keluar

### 1.2 PENDEKATAN

Tambahkan **"Fleet Mode"** ke Workshop yang sudah ada. Jangan buat modul baru.

Mode ditentukan oleh `org_module_instances.settings.fleet_mode = true`.

Saat `fleet_mode = true`:
- Kendaraan diregistrasi dari `fixed_assets` (bukan input manual)
- Work order tidak punya tombol "Buat Invoice"
- Biaya work order otomatis di-journal ke akun beban pemeliharaan
- Tampil kolom "Aset Tetap" di card kendaraan

---

### 1.3 DATABASE MIGRATION

**File**: `supabase/migrations/1323_workshop_fleet_mode.sql`

```sql
-- Tambah kolom fixed_asset_id ke workshop_vehicles
-- agar kendaraan fleet bisa dilink ke aset tetap
ALTER TABLE workshop_vehicles
  ADD COLUMN IF NOT EXISTS fixed_asset_id UUID
    REFERENCES fixed_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vehicle_category VARCHAR(20) DEFAULT 'EXTERNAL';
  -- EXTERNAL (default, bengkel komersial) | INTERNAL (fleet perusahaan)

-- Tambah kolom maintenance_cost_account_id ke workshop_work_orders
-- untuk auto-journal biaya servis ke akun beban yang tepat
ALTER TABLE workshop_work_orders
  ADD COLUMN IF NOT EXISTS maintenance_cost_account_id UUID
    REFERENCES accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT false;

-- Index
CREATE INDEX IF NOT EXISTS idx_workshop_vehicles_fixed_asset
  ON workshop_vehicles(fixed_asset_id)
  WHERE fixed_asset_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workshop_vehicles_category
  ON workshop_vehicles(org_id, vehicle_category);
```

---

### 1.4 TYPES (TAMBAH KE workshop-types.ts)

**File**: `modules/workshop/lib/workshop-types.ts`

Tambahkan field berikut ke interface yang sudah ada:

```typescript
// Tambah ke WorkshopVehicle:
fixedAssetId: string | null      // link ke fixed_assets.id
vehicleCategory: 'EXTERNAL' | 'INTERNAL'  // default EXTERNAL
fixedAsset?: {                   // join saat query
  id: string
  code: string
  name: string
  current_book_value: number
  purchase_date: string
} | null

// Tambah ke WorkshopWorkOrder:
isInternal: boolean              // true = fleet internal, tidak ada invoice
maintenanceCostAccountId: string | null  // akun beban pemeliharaan
```

---

### 1.5 SERVER ACTIONS (TAMBAH KE workshop.actions.ts)

**File**: `modules/workshop/actions/workshop.actions.ts`

Tambahkan fungsi-fungsi berikut (JANGAN ubah fungsi yang sudah ada):

```typescript
// 1. Ambil kendaraan dari fixed_assets untuk registrasi fleet
export async function getFixedAssetsForFleet(orgId: string): Promise<{
  id: string; code: string; name: string; category: string;
  purchase_date: string; current_book_value: number
}[]>
// Query: SELECT id, code, name, category, purchase_date, current_book_value
//        FROM fixed_assets WHERE org_id=$1 AND status='ACTIVE'
//        AND category IN ('Kendaraan','Transportasi','Armada')
//        ORDER BY name ASC

// 2. Registrasi kendaraan fleet dari fixed_asset
export async function createFleetVehicleFromAsset(orgId: string, payload: {
  fixed_asset_id: string    // FK ke fixed_assets
  plate_number: string
  brand: string
  model: string
  year?: number
  color?: string
  engine_number?: string
  chassis_number?: string
  fuel_type?: string
  last_odometer?: number
  notes?: string
}): Promise<{ data?: WorkshopVehicle; error?: string }>
// INSERT ke workshop_vehicles dengan vehicle_category='INTERNAL', fixed_asset_id=payload.fixed_asset_id

// 3. Selesaikan work order internal + auto-journal biaya
export async function completeInternalWorkOrder(orgId: string, workOrderId: string, payload: {
  maintenance_cost_account_id: string   // akun beban pemeliharaan (dari COA)
  notes?: string
}): Promise<{ data?: WorkshopWorkOrder; error?: string }>
// Business logic:
// a. Update work_order status = 'SELESAI'
// b. Hitung total biaya (sum dari work_order_items)
// c. Cari akun kas/bank default org (COA kode 1101 atau 1201)
// d. Buat journal_entry:
//    - description: "Biaya Servis ${vehicle.plateNumber} — WO#${workOrderId}"
//    - status: POSTED
//    - Debit: maintenance_cost_account_id (biaya pemeliharaan)
//    - Credit: akun kas/bank
// e. Return updated work order
```

---

### 1.6 UI CHANGES (WorkshopClient.tsx)

**File**: `app/(dashboard)/workshop/WorkshopClient.tsx`

Tambahkan prop `isFleetMode: boolean` dan `fixedAssets: FixedAssetSummary[]` ke interface Props.

**Perubahan UI saat `isFleetMode = true`:**

1. **Tombol "Registrasi Kendaraan"** → buka modal dengan dropdown fixed_assets (bukan form kosong)
2. **Card kendaraan** → tampilkan badge "INTERNAL" + nilai buku aset
3. **Tombol "Buat Invoice"** → SEMBUNYIKAN (ganti dengan "Selesai & Catat Biaya")
4. **Modal "Selesai & Catat Biaya"**:
   - Dropdown pilih akun beban (dari COA — kategori Beban Operasional)
   - Konfirmasi total biaya
   - Tombol "Konfirmasi" → panggil `completeInternalWorkOrder()`

**Perubahan UI saat `isFleetMode = false` (default):**
- Tidak ada perubahan — Workshop komersial tetap berjalan normal

---

### 1.7 PAGE UPDATE

**File**: `app/(dashboard)/workshop/page.tsx`

Tambahkan di server component:
```typescript
// Baca fleet_mode dari org_module_instances settings
const moduleInstance = await queryPostgres(
  `SELECT settings FROM org_module_instances
   WHERE org_id = $1 AND module_key = 'Workshop' AND status = 'READY'`,
  [orgId]
)
const isFleetMode = moduleInstance.rows[0]?.settings?.fleet_mode === true

// Jika fleet mode, load fixed assets kendaraan
const fixedAssets = isFleetMode ? await getFixedAssetsForFleet(orgId) : []

// Pass ke client
<WorkshopClient isFleetMode={isFleetMode} fixedAssets={fixedAssets} ... />
```

---

## BAGIAN 2: TIRTA CANVASSER PRO
### Build dari nol — extend `/sales/co-sales`

---

### 2.1 ARSITEKTUR

```
/sales/co-sales/                     ← route utama canvasser
  page.tsx                           ← server component (sudah ada, perlu diupdate)
  CoSalesDashboardClient.tsx         ← REPLACE seluruhnya (saat ini mock)
  [vanId]/
    page.tsx                         ← NEW: halaman per van/canvasser
    VanOperationalClient.tsx         ← NEW: order taking + AR + stok
```

---

### 2.2 DATABASE MIGRATION

**File**: `supabase/migrations/1324_canvasser_pro.sql`

```sql
-- ─── canvasser_vans: Unit kendaraan canvasser ─────────────────────────────────
CREATE TABLE IF NOT EXISTS canvasser_vans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id       UUID REFERENCES branches(id) ON DELETE SET NULL,

  code            VARCHAR(20) NOT NULL,         -- e.g. "VAN-01"
  name            VARCHAR(100) NOT NULL,         -- e.g. "Van Budi - Selatan"
  plate_number    VARCHAR(20),
  driver_name     VARCHAR(150) NOT NULL,
  driver_phone    VARCHAR(50),

  fixed_asset_id  UUID REFERENCES fixed_assets(id) ON DELETE SET NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  notes           TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(org_id, code)
);

-- ─── canvasser_sessions: Sesi harian per van ──────────────────────────────────
CREATE TABLE IF NOT EXISTS canvasser_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  van_id          UUID NOT NULL REFERENCES canvasser_vans(id) ON DELETE CASCADE,

  session_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  status          VARCHAR(20) NOT NULL DEFAULT 'AKTIF',
  -- AKTIF | SELESAI

  -- Stok awal (dimuat saat berangkat)
  opening_stock   JSONB NOT NULL DEFAULT '[]',
  -- [{ product_id, product_name, qty_loaded, unit }]

  -- Stok akhir (rekonsiliasi saat kembali)
  closing_stock   JSONB DEFAULT NULL,
  -- [{ product_id, product_name, qty_return, unit }]

  -- Kas
  total_cash_collected  NUMERIC(20,2) NOT NULL DEFAULT 0,
  total_ar_collected    NUMERIC(20,2) NOT NULL DEFAULT 0,
  total_sales           NUMERIC(20,2) NOT NULL DEFAULT 0,

  notes           TEXT,
  closed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── canvasser_visits: Kunjungan per outlet ───────────────────────────────────
CREATE TABLE IF NOT EXISTS canvasser_visits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id      UUID NOT NULL REFERENCES canvasser_sessions(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,

  visit_order     INTEGER NOT NULL DEFAULT 0,   -- urutan kunjungan
  contact_name    VARCHAR(200) NOT NULL,         -- snapshot nama outlet
  address         TEXT,

  status          VARCHAR(20) NOT NULL DEFAULT 'BELUM',
  -- BELUM | DALAM_PERJALANAN | SELESAI | SKIP

  -- AR snapshot saat kunjungan
  ar_outstanding  NUMERIC(20,2) NOT NULL DEFAULT 0,
  credit_limit    NUMERIC(20,2) NOT NULL DEFAULT 0,
  ar_status       VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
  -- NORMAL | MENDEKATI_LIMIT | BLOKIR

  -- GPS
  arrived_at      TIMESTAMPTZ,
  departed_at     TIMESTAMPTZ,
  gps_lat         NUMERIC(10,6),
  gps_lng         NUMERIC(10,6),

  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── canvasser_orders: Pesanan yang diambil saat kunjungan ───────────────────
CREATE TABLE IF NOT EXISTS canvasser_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id      UUID NOT NULL REFERENCES canvasser_sessions(id) ON DELETE CASCADE,
  visit_id        UUID NOT NULL REFERENCES canvasser_visits(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,

  order_number    VARCHAR(30) NOT NULL,          -- auto-generate: CO/YYYYMMDD/NNN
  payment_method  VARCHAR(20) NOT NULL DEFAULT 'TUNAI',
  -- TUNAI | TRANSFER | KREDIT

  subtotal        NUMERIC(20,2) NOT NULL DEFAULT 0,
  discount        NUMERIC(20,2) NOT NULL DEFAULT 0,
  total           NUMERIC(20,2) NOT NULL DEFAULT 0,

  status          VARCHAR(20) NOT NULL DEFAULT 'SELESAI',
  -- SELESAI | BATAL

  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── canvasser_order_items: Item per pesanan ──────────────────────────────────
CREATE TABLE IF NOT EXISTS canvasser_order_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES canvasser_orders(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id) ON DELETE SET NULL,

  product_name    VARCHAR(200) NOT NULL,         -- snapshot
  qty             NUMERIC(10,2) NOT NULL,
  unit            VARCHAR(30) NOT NULL DEFAULT 'pcs',
  unit_price      NUMERIC(20,2) NOT NULL,        -- dari price list HQ — tidak bisa diubah
  subtotal        NUMERIC(20,2) NOT NULL
);

-- ─── canvasser_ar_collections: Tagihan AR yang berhasil dikumpulkan ───────────
CREATE TABLE IF NOT EXISTS canvasser_ar_collections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id      UUID NOT NULL REFERENCES canvasser_sessions(id) ON DELETE CASCADE,
  visit_id        UUID NOT NULL REFERENCES canvasser_visits(id) ON DELETE CASCADE,
  contact_id      UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  amount          NUMERIC(20,2) NOT NULL CHECK (amount > 0),
  payment_method  VARCHAR(20) NOT NULL DEFAULT 'TUNAI',
  reference_no    VARCHAR(100),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_canvasser_vans_org ON canvasser_vans(org_id, is_active);
CREATE INDEX IF NOT EXISTS idx_canvasser_sessions_van ON canvasser_sessions(van_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_canvasser_sessions_date ON canvasser_sessions(org_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_canvasser_visits_session ON canvasser_visits(session_id, visit_order);
CREATE INDEX IF NOT EXISTS idx_canvasser_orders_session ON canvasser_orders(session_id);
CREATE INDEX IF NOT EXISTS idx_canvasser_ar_collections_session ON canvasser_ar_collections(session_id);
```

---

### 2.3 TYPES

**File baru**: `modules/canvasser/lib/canvasser-types.ts`

```typescript
export type CanvasserVan = {
  id: string; org_id: string; branch_id: string | null
  code: string; name: string; plate_number: string | null
  driver_name: string; driver_phone: string | null
  fixed_asset_id: string | null; is_active: boolean; notes: string | null
  created_at: string; updated_at: string
}

export type SessionStatus = 'AKTIF' | 'SELESAI'

export type CanvasserSession = {
  id: string; org_id: string; van_id: string
  session_date: string; status: SessionStatus
  opening_stock: StockItem[]; closing_stock: StockItem[] | null
  total_cash_collected: number; total_ar_collected: number; total_sales: number
  notes: string | null; closed_at: string | null; created_at: string
  van?: Pick<CanvasserVan, 'id' | 'code' | 'name' | 'driver_name'>
}

export type StockItem = {
  product_id: string; product_name: string; qty_loaded: number
  qty_sold?: number; qty_return?: number; unit: string
}

export type VisitStatus = 'BELUM' | 'DALAM_PERJALANAN' | 'SELESAI' | 'SKIP'
export type ARStatus = 'NORMAL' | 'MENDEKATI_LIMIT' | 'BLOKIR'

export type CanvasserVisit = {
  id: string; org_id: string; session_id: string; contact_id: string | null
  visit_order: number; contact_name: string; address: string | null
  status: VisitStatus
  ar_outstanding: number; credit_limit: number; ar_status: ARStatus
  arrived_at: string | null; departed_at: string | null
  gps_lat: number | null; gps_lng: number | null
  notes: string | null; created_at: string
  orders?: CanvasserOrder[]
  ar_collections?: CanvasserARCollection[]
}

export type PaymentMethod = 'TUNAI' | 'TRANSFER' | 'KREDIT'

export type CanvasserOrder = {
  id: string; org_id: string; session_id: string
  visit_id: string; contact_id: string | null
  order_number: string; payment_method: PaymentMethod
  subtotal: number; discount: number; total: number
  status: 'SELESAI' | 'BATAL'
  notes: string | null; created_at: string
  items?: CanvasserOrderItem[]
}

export type CanvasserOrderItem = {
  id: string; order_id: string; product_id: string | null
  product_name: string; qty: number; unit: string
  unit_price: number; subtotal: number
}

export type CanvasserARCollection = {
  id: string; org_id: string; session_id: string
  visit_id: string; contact_id: string
  amount: number; payment_method: PaymentMethod
  reference_no: string | null; notes: string | null; created_at: string
}

// Untuk AR display — computed dari sales invoices
export type ContactARSummary = {
  contact_id: string
  contact_name: string
  credit_limit: number
  outstanding_total: number      // total AR belum lunas
  overdue_30: number            // jatuh tempo 0–30 hari
  overdue_60: number            // jatuh tempo 31–60 hari
  overdue_90plus: number        // jatuh tempo > 60 hari
  ar_status: ARStatus           // computed
  last_payment_date: string | null
}
```

---

### 2.4 SERVER ACTIONS

**File baru**: `modules/canvasser/actions/canvasser.actions.ts`

```typescript
'use server'
// Semua actions di sini

// ── Van Management ────────────────────────────────────────────────────────────

export async function getCanvasserVans(orgId: string): Promise<CanvasserVan[]>
// SELECT * FROM canvasser_vans WHERE org_id=$1 AND is_active=true ORDER BY code ASC

export async function createCanvasserVan(orgId: string, payload: {
  code: string; name: string; driver_name: string
  plate_number?: string; driver_phone?: string; fixed_asset_id?: string; notes?: string
}): Promise<{ data?: CanvasserVan; error?: string }>

export async function updateCanvasserVan(orgId: string, vanId: string, payload: Partial<{
  name: string; driver_name: string; plate_number: string
  driver_phone: string; is_active: boolean; notes: string
}>): Promise<{ data?: CanvasserVan; error?: string }>

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function getTodaySession(orgId: string, vanId: string): Promise<CanvasserSession | null>
// SELECT * FROM canvasser_sessions WHERE org_id=$1 AND van_id=$2
//   AND session_date = CURRENT_DATE ORDER BY created_at DESC LIMIT 1

export async function createSession(orgId: string, payload: {
  van_id: string
  opening_stock: StockItem[]    // produk & qty yang dimuat ke van
}): Promise<{ data?: CanvasserSession; error?: string }>
// Validasi: cek tidak ada sesi AKTIF hari ini untuk van yang sama
// INSERT INTO canvasser_sessions

export async function closeSession(orgId: string, sessionId: string, payload: {
  closing_stock: StockItem[]   // stok sisa yang kembali ke depo
  notes?: string
}): Promise<{ data?: CanvasserSession; error?: string }>
// UPDATE status='SELESAI', closing_stock, closed_at=NOW()
// Hitung total_cash_collected, total_ar_collected, total_sales dari relasi

// ── Visits ────────────────────────────────────────────────────────────────────

export async function getSessionVisits(orgId: string, sessionId: string): Promise<CanvasserVisit[]>
// SELECT visits.*, orders (array), ar_collections (array)
// FROM canvasser_visits WHERE session_id=$1 ORDER BY visit_order ASC

export async function addVisit(orgId: string, sessionId: string, payload: {
  contact_id: string
  visit_order: number
  address?: string
}): Promise<{ data?: CanvasserVisit; error?: string }>
// a. Ambil contact.credit_limit
// b. Hitung ar_outstanding dari sales_invoices:
//    SELECT COALESCE(SUM(amount_due - amount_paid), 0) FROM sales_invoices
//    WHERE contact_id=$1 AND status NOT IN ('PAID','CANCELLED')
// c. Tentukan ar_status:
//    - outstanding = 0 → NORMAL
//    - outstanding >= credit_limit * 0.8 → MENDEKATI_LIMIT
//    - outstanding >= credit_limit → BLOKIR
// d. INSERT canvasser_visits

export async function updateVisitStatus(orgId: string, visitId: string,
  status: VisitStatus, gps?: { lat: number; lng: number }
): Promise<{ error?: string }>
// UPDATE canvasser_visits SET status, arrived_at/departed_at, gps_lat, gps_lng

// ── Orders ────────────────────────────────────────────────────────────────────

export async function createOrder(orgId: string, payload: {
  session_id: string; visit_id: string; contact_id: string
  payment_method: PaymentMethod
  items: { product_id: string; qty: number; unit_price: number }[]
  notes?: string
}): Promise<{ data?: CanvasserOrder; error?: string }>
// Business rules:
// 1. Cek visit.ar_status — jika BLOKIR dan payment_method=KREDIT → return error:
//    "Customer ini diblokir karena melebihi credit limit. Hanya transaksi TUNAI yang diizinkan."
// 2. Validasi unit_price: HARUS sama dengan products.selling_price (HQ price lock)
//    Jika berbeda → return error "Harga tidak sesuai price list HQ"
// 3. Generate order_number: CO/{YYYYMMDD}/{3-digit-seq}
// 4. INSERT canvasser_orders + canvasser_order_items
// 5. Kurangi stok van (update opening_stock di session — atau track di closing)

export async function cancelOrder(orgId: string, orderId: string): Promise<{ error?: string }>
// UPDATE canvasser_orders SET status='BATAL'

// ── AR Collection ─────────────────────────────────────────────────────────────

export async function recordARCollection(orgId: string, payload: {
  session_id: string; visit_id: string; contact_id: string
  amount: number; payment_method: PaymentMethod; reference_no?: string; notes?: string
}): Promise<{ data?: CanvasserARCollection; error?: string }>
// INSERT canvasser_ar_collections
// Note: Pencatatan ke journal/AR dilakukan saat session ditutup (closeSession)
// agar tidak ada partial posting

// ── AR Summary (untuk display di kunjungan) ───────────────────────────────────

export async function getContactARSummary(orgId: string, contactId: string): Promise<ContactARSummary>
// Query:
// SELECT
//   c.id, c.name, c.credit_limit,
//   COALESCE(SUM(CASE WHEN si.due_date >= NOW() THEN si.amount_due - si.amount_paid END), 0) AS overdue_30,
//   ... (aging buckets)
// FROM contacts c
// LEFT JOIN sales_invoices si ON si.contact_id = c.id AND si.status NOT IN ('PAID','CANCELLED')
// WHERE c.id = $1 AND c.org_id = $2
// GROUP BY c.id

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getTodayDashboard(orgId: string): Promise<{
  active_vans: number
  total_sales_today: number
  total_cash_collected: number
  total_ar_collected: number
  vans: Array<CanvasserVan & { session: CanvasserSession | null; visits_done: number; visits_total: number }>
}>
```

---

### 2.5 UI COMPONENTS

#### 2.5.1 CoSalesDashboardClient.tsx (REPLACE SELURUHNYA)

**File**: `app/(dashboard)/sales/co-sales/CoSalesDashboardClient.tsx`

Props:
```typescript
interface Props {
  orgId: string
  branchId: string | null
  vans: CanvasserVan[]
  todayDashboard: {
    active_vans: number
    total_sales_today: number
    total_cash_collected: number
    total_ar_collected: number
    vans: Array<CanvasserVan & { session: CanvasserSession | null; visits_done: number; visits_total: number }>
  }
}
```

Layout (4 section):

**Section 1 — Stats Bar**
```
[ Kendaraan Aktif: N ] [ Total Penjualan: Rp X ] [ Kas Terkumpul: Rp X ] [ AR Ditagih: Rp X ]
```

**Section 2 — Daftar Van + Status Sesi**
Grid card per van, masing-masing menampilkan:
- Nama van + driver
- Status sesi hari ini: AKTIF (hijau) / SELESAI (abu) / BELUM MULAI (slate)
- Progress kunjungan: "8 / 12 outlet selesai"
- Total penjualan sesi ini
- Tombol "Lihat Detail" → `/sales/co-sales/{vanId}`
- Tombol "Mulai Sesi" jika belum ada sesi hari ini → buka modal buat sesi

**Section 3 — Modal Buat Sesi**
- Pilih van
- Input stok awal: tabel produk (dari `products` yang active) + input qty per produk
- Tombol "Mulai" → `createSession()`

**Section 4 — Tombol Tambah Van**
- Form: kode, nama, driver, plat, telepon, optional link fixed_asset

---

#### 2.5.2 VanOperationalClient.tsx (BARU)

**File**: `app/(dashboard)/sales/co-sales/[vanId]/VanOperationalClient.tsx`

Ini adalah halaman utama operasional per van. Terdiri dari 3 tab:

**Tab 1: KUNJUNGAN**

Daftar outlet yang harus dikunjungi hari ini, diurutkan berdasarkan `visit_order`.

Per card outlet:
```
┌─────────────────────────────────────────────────────┐
│ [STATUS BADGE] Toko Berkah Jaya              [urutan]│
│ Jl. Sudirman No. 12, Bandung                        │
│                                                     │
│ AR: Rp 2.500.000 / Limit Rp 5.000.000              │
│ ████████░░░░░░░░ 50% — NORMAL                       │  ← progress bar
│                                                     │
│ [Mulai Kunjungi]  [Catat Order]  [Tagih AR]  [Skip] │
└─────────────────────────────────────────────────────┘
```

Warna AR status:
- NORMAL → hijau (< 80% limit)
- MENDEKATI_LIMIT → kuning (80–99% limit)
- BLOKIR → merah (>= 100% limit atau credit_limit = 0 dan ada AR)

Tombol "Catat Order" → buka modal order:
- Daftar produk + qty + harga (read-only dari price list)
- Pilih metode bayar (TUNAI / TRANSFER / KREDIT)
- Jika ar_status = BLOKIR dan pilih KREDIT → tampil error merah:
  *"Customer ini diblokir. Hanya transaksi TUNAI atau TRANSFER yang diizinkan."*
- Total otomatis
- Tombol "Konfirmasi Order"

Tombol "Tagih AR" → buka modal collection:
- Tampilkan AR outstanding detail (invoice-level jika tersedia)
- Input jumlah yang dibayar
- Metode: TUNAI / TRANSFER (+ no referensi jika transfer)
- Tombol "Catat Pembayaran"

**Tab 2: STOK VAN**

Tabel stok kendaraan saat ini:
```
Produk          | Dimuat | Terjual | Sisa
Galon 19L       |   50   |   23    |  27
Botol 600ml     |  100   |   45    |  55
```

Qty terjual dihitung dari `canvasser_order_items` sesi ini.

**Tab 3: REKAP SESI**

Summary penjualan:
- Total penjualan: Rp X
- Tunai: Rp X / Transfer: Rp X / Kredit: Rp X
- Total AR ditagih: Rp X
- Outlet dikunjungi: N dari M
- Tabel semua order hari ini

Tombol "Tutup Sesi":
- Buka modal input stok sisa (qty return per produk)
- Konfirmasi rekap akhir
- Tombol "Selesai & Tutup" → `closeSession()`

---

### 2.6 PAGE.TSX (UPDATE)

**File**: `app/(dashboard)/sales/co-sales/page.tsx`

```typescript
import { getActiveOrg } from '@/lib/auth/getActiveOrg'
import { getCanvasserVans, getTodayDashboard } from '@/modules/canvasser/actions/canvasser.actions'
import { CoSalesDashboardClient } from './CoSalesDashboardClient'

export default async function CoSalesPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/login')

  const [vans, todayDashboard] = await Promise.all([
    getCanvasserVans(orgData.org.id),
    getTodayDashboard(orgData.org.id),
  ])

  return (
    <CoSalesDashboardClient
      orgId={orgData.org.id}
      branchId={orgData.activeBranchId}
      vans={vans}
      todayDashboard={todayDashboard}
    />
  )
}
```

**File baru**: `app/(dashboard)/sales/co-sales/[vanId]/page.tsx`

```typescript
// Fetch: van detail, today session, visits dengan orders & collections
// Pass ke VanOperationalClient
```

---

## BAGIAN 3: INTEGRASI & BUSINESS RULES

### 3.1 AR Calculation (sumber data)

AR outstanding per contact dihitung dari:
```sql
SELECT
  COALESCE(SUM(grand_total - COALESCE(amount_paid, 0)), 0) AS outstanding
FROM sales_invoices
WHERE contact_id = $1
  AND org_id = $2
  AND status NOT IN ('PAID', 'CANCELLED', 'VOID')
```

Jika tabel `sales_invoices` tidak tersedia, fallback ke `journal_lines`:
```sql
-- Cari saldo AR dari jurnal (akun piutang dagang)
SELECT COALESCE(SUM(debit - credit), 0) AS outstanding
FROM journal_lines jl
JOIN accounts a ON a.id = jl.account_id
WHERE a.org_id = $1
  AND a.code IN ('1301', '1302', '1300')  -- kode piutang dagang
  AND jl.contact_id = $2
```

### 3.2 AR Status Logic

```typescript
function computeARStatus(outstanding: number, credit_limit: number): ARStatus {
  if (credit_limit <= 0) {
    // Tidak ada credit limit → tidak ada blokir
    return outstanding > 0 ? 'MENDEKATI_LIMIT' : 'NORMAL'
  }
  if (outstanding >= credit_limit) return 'BLOKIR'
  if (outstanding >= credit_limit * 0.8) return 'MENDEKATI_LIMIT'
  return 'NORMAL'
}
```

### 3.3 Price Lock Logic

```typescript
// Di createOrder() server action:
for (const item of payload.items) {
  const product = await getProductById(item.product_id)
  if (Math.abs(item.unit_price - product.selling_price) > 0.01) {
    return { error: `Harga produk "${product.name}" tidak sesuai price list. Harga HQ: ${formatRupiah(product.selling_price)}` }
  }
}
```

### 3.4 Journal Entry saat Close Session

Saat `closeSession()` dipanggil:
```
1. Hitung total penjualan TUNAI → Debit Kas, Credit Pendapatan Penjualan
2. Hitung total penjualan KREDIT → Debit Piutang Dagang, Credit Pendapatan Penjualan
3. Hitung total AR dikumpulkan → Debit Kas, Credit Piutang Dagang
4. Semua dalam 1 journal entry: "Setoran Canvasser [Van Name] — [Tanggal]"
```

Gunakan akun COA:
- Kas: kode `1101`
- Piutang Dagang: kode `1301`
- Pendapatan Penjualan: kode `4001`

---

## BAGIAN 4: URUTAN EKSEKUSI

Eksekusi dalam urutan ini untuk menghindari dependency error:

```
1. Jalankan migration 1323_workshop_fleet_mode.sql
2. Jalankan migration 1324_canvasser_pro.sql
3. Update modules/workshop/lib/workshop-types.ts (tambah field baru)
4. Update modules/workshop/actions/workshop.actions.ts (tambah 3 fungsi baru)
5. Update app/(dashboard)/workshop/page.tsx (tambah isFleetMode)
6. Update app/(dashboard)/workshop/WorkshopClient.tsx (tambah fleet mode UI)
7. Buat modules/canvasser/lib/canvasser-types.ts (file baru)
8. Buat modules/canvasser/actions/canvasser.actions.ts (file baru)
9. Replace app/(dashboard)/sales/co-sales/CoSalesDashboardClient.tsx
10. Update app/(dashboard)/sales/co-sales/page.tsx
11. Buat app/(dashboard)/sales/co-sales/[vanId]/page.tsx (file baru)
12. Buat app/(dashboard)/sales/co-sales/[vanId]/VanOperationalClient.tsx (file baru)
13. Daftarkan 'Tirta Canvasser' ke modules/marketplace/lib/module-registry.ts
14. Commit & push
```

---

## BAGIAN 5: REGISTRASI DI MARKETPLACE

### 5.1 Workshop (sudah ada — update saja)

Di `module-registry.ts`, cari entry `key: 'Workshop'` dan tambahkan:
```typescript
defaultSettings: { fleet_mode: false },
// fleet_mode: true diset manual via admin saat onboarding Tirta Marwah
```

### 5.2 Tirta Canvasser Pro (baru)

Tambahkan ke `ADDON_MODULES`:
```typescript
{
  key: 'Tirta Canvasser',
  name: 'Tirta Canvasser Pro',
  tagline: 'Aplikasi sales lapangan distribusi dengan AR display',
  description: 'Manajemen kunjungan harian, van stock, order taking, tampilan AR per customer, credit limit enforcement, dan cash collection untuk tim canvassing distribusi AMDK/FMCG.',
  icon: '🚐',
  color: 'bg-cyan-600',
  href: '/sales/co-sales',
  isCore: false,
  isAddon: true,
  category: 'addon',
  onboardingSteps: [
    {
      id: 'settings',
      title: 'Daftarkan Kendaraan Canvasser',
      description: 'Tambahkan unit kendaraan (van/motor) dan data driver untuk memulai operasional canvassing.'
    }
  ],
  tags: ['canvassing', 'distribusi', 'AMDK', 'sales lapangan', 'AR', 'mobile POS'],
  requires: ['Sales', 'Inventory'],
}
```

---

## CATATAN IMPLEMENTASI

1. **Gunakan `queryPostgres()` langsung** untuk query yang perlu bypass RLS (canvasser_sessions, canvasser_orders)
2. **Gunakan `createClient()` dari `lib/supabase/server.ts`** untuk query yang perlu RLS (contacts, products, accounts)
3. **Semua komponen UI** menggunakan komponen NizamUI yang sudah ada (`cn()`, `formatRupiah()`, `formatDate()`)
4. **Icons**: hanya Lucide React — tidak ada emoji sebagai icon struktural
5. **Error handling**: pattern `{ data, error }` konsisten di semua actions
6. **revalidatePath('/sales/co-sales')** setelah setiap mutation
