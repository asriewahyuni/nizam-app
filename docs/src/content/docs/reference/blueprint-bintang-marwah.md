---
title: "Blueprint: BINTANG MARWAH"
description: "**Versi**: 1.0 | **Tanggal**: 05 Juni 2026 | **Status**: Ready to Build"
sidebar:
  label: "Blueprint: BINTANG MARWAH"
---

> Dokumen ini disinkronkan otomatis dari file sumber `BLUEPRINT_BINTANG_MARWAH.md` di root project docs.

## PO Bus — Fitur Lanjutan, Ekspedisi & Portal Agen
**Versi**: 1.0 | **Tanggal**: 05 Juni 2026 | **Status**: Ready to Build

---

## KONTEKS EKSEKUSI

Dokumen ini adalah spesifikasi teknis lengkap untuk dieksekusi oleh AI melalui prompting.
Setiap bagian harus dieksekusi sesuai urutan. Jangan buat ulang yang sudah ada.

### Yang SUDAH ADA (jangan disentuh kecuali disebutkan):
- `/app/(dashboard)/po-bus/` — UI PO Bus lengkap (1597 baris)
- `/modules/po-bus/` — actions (1091 baris) + types (269 baris)
- `supabase/migrations/1319–1322` — semua tabel bus_* sudah ada
- Tabel: `bus_units`, `bus_crew`, `bus_routes`, `bus_schedules`, `bus_tickets`, `bus_checkpoints`
- Tabel: `bus_mechanics`, `bus_service_records`, `bus_tire_records`, `bus_emergency_calls`
- Tabel: `bus_agents`, `bus_pools`, `bus_pool_top_ups`, `bus_pool_settlements`

### Yang BELUM ADA (harus dibangun):
1. Trip-count trigger servis (setiap 12 trip)
2. Source channel tiket (LANGSUNG / TRAVELOKA / TIKET_COM / WHATSAPP)
3. Centralized price enforcement dari HQ
4. Manajemen tiket per agen (stats + rekap komisi)
5. Modul Ekspedisi (baru)
6. Portal Agen Tiket (login terpisah)
7. GPS Live Tracking (Fase 2)
8. WhatsApp Official API (Fase 2)
9. OTA Integration (Fase 2)

---

## BAGIAN 1: PENYEMPURNAAN MODUL PO BUS (Yang Sudah Ada)

Fitur-fitur kecil yang melengkapi modul yang sudah ada.

---

### 1.1 TRIP-COUNT SERVICE TRIGGER

**Tujuan**: Alert otomatis setiap bus melewati 12 perjalanan selesai.

#### Migration

**File**: `supabase/migrations/1325_bus_trip_count.sql`

```sql
-- Tambah trip_count ke bus_units
ALTER TABLE bus_units
  ADD COLUMN IF NOT EXISTS trip_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_service_trip INTEGER NOT NULL DEFAULT 0;
  -- last_service_trip = trip_count saat servis terakhir

-- Tambah kolom triggered_by_trip ke bus_service_records
ALTER TABLE bus_service_records
  ADD COLUMN IF NOT EXISTS triggered_by_trip BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trip_at_service INTEGER;
  -- trip_count saat servis ini dilakukan

CREATE INDEX IF NOT EXISTS idx_bus_units_trip_count
  ON bus_units(org_id, trip_count);
```

#### Action (tambah ke po-bus.actions.ts)

```typescript
// Dipanggil setelah updateBusScheduleStatus(status='TIBA')
export async function incrementBusTripCount(orgId: string, busId: string): Promise<{
  trip_count: number
  needs_service: boolean  // true jika (trip_count - last_service_trip) >= 12
  error?: string
}>
// Logic:
// 1. UPDATE bus_units SET trip_count = trip_count + 1 WHERE id=$1 AND org_id=$2
// 2. SELECT trip_count, last_service_trip FROM bus_units WHERE id=$1
// 3. needs_service = (trip_count - last_service_trip) >= 12
// 4. Return { trip_count, needs_service }
```

Update `updateBusScheduleStatus()` yang sudah ada:
```typescript
// Setelah update status ke 'TIBA', tambahkan:
if (status === 'TIBA' && schedule.bus_id) {
  await incrementBusTripCount(orgId, schedule.bus_id)
}
```

#### UI (di POBusClient.tsx)

Di tab ARMADA, pada card setiap bus unit, tambahkan:
- Badge trip count: `12 Trip` (abu) / `⚠ Perlu Servis` (kuning, jika needs_service)
- Kondisi badge kuning: `(bus.trip_count - bus.last_service_trip) >= 12`

Saat membuat service record baru untuk bus yang `needs_service`:
- Auto-centang field `triggered_by_trip = true`
- Auto-isi `trip_at_service = bus.trip_count`
- Setelah service record disimpan: `UPDATE bus_units SET last_service_trip = trip_count`

---

### 1.2 SOURCE CHANNEL TIKET

**Tujuan**: Lacak dari mana tiket dijual (langsung / OTA / WhatsApp).

#### Migration

**File**: `supabase/migrations/1326_bus_ticket_source.sql`

```sql
ALTER TABLE bus_tickets
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'LANGSUNG';
  -- LANGSUNG | TRAVELOKA | TIKET_COM | WHATSAPP | AGEN

-- Index untuk filter & laporan
CREATE INDEX IF NOT EXISTS idx_bus_tickets_source
  ON bus_tickets(org_id, source);
```

#### Type (update BusTicket di po-bus-types.ts)

```typescript
export type TicketSource = 'LANGSUNG' | 'TRAVELOKA' | 'TIKET_COM' | 'WHATSAPP' | 'AGEN'

// Tambah ke BusTicket:
source: TicketSource
```

#### UI (di POBusClient.tsx)

Di tabel TIKET (tab Operasional → Tiket):
1. Tambah kolom "Sumber" setelah kolom Status
2. Badge per source:
   - LANGSUNG → slate
   - TRAVELOKA → blue
   - TIKET_COM → red
   - WHATSAPP → green
   - AGEN → amber
3. Di modal Jual Tiket, tambah dropdown "Sumber Penjualan" dengan default LANGSUNG

---

### 1.3 CENTRALIZED PRICE ENFORCEMENT

**Tujuan**: Agen tidak bisa jual tiket di bawah atau di atas harga HQ.

#### Action (update createBusTicket di po-bus.actions.ts)

```typescript
// Tambahkan validasi sebelum INSERT:
const route = await getBusRouteBySchedule(payload.schedule_id)
if (route && payload.price !== route.base_price) {
  return {
    error: `Harga tiket harus sesuai tarif rute: ${formatRupiah(route.base_price)}. Tidak bisa diubah.`
  }
}
```

Catatan: validasi ini berjalan di server — tidak bisa di-bypass dari client.

---

### 1.4 MANAJEMEN TIKET PER AGEN

**Tujuan**: Setiap card agen menampilkan stats + rekap komisi, bisa lihat tiket per agen.

#### Action (tambah ke po-bus.actions.ts)

```typescript
export async function getBusAgentStats(orgId: string, agentId: string, month?: string): Promise<{
  total_tickets: number
  total_revenue: number
  commission_earned: number   // total_revenue * (agent.commission_pct / 100)
  unpaid_commission: number   // commission_earned - commission_paid (dari settlements)
  tickets: BusTicket[]        // tiket bulan ini
}>
// Query:
// SELECT COUNT(*), SUM(price) FROM bus_tickets
// WHERE org_id=$1 AND agent_id=$2 AND status IN ('DIBAYAR','DIGUNAKAN')
// AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', $3::date)
```

#### UI (update tab AGEN di POBusClient.tsx)

**Card agen** — tambahkan section stats di bawah info kontak:
```
┌─────────────────────────────────────┐
│ Toko Tiket Maju Jaya        [Edit]  │
│ Bandung · Komisi 3%                 │
│ ─────────────────────────────────── │
│ Bulan ini:                          │
│ 18 tiket · Rp 2.250.000            │
│ Komisi: Rp 67.500                   │
│ Belum dibayar: Rp 67.500            │
│                        [Lihat Tiket]│
└─────────────────────────────────────┘
```

Tombol "Lihat Tiket" → buka drawer/modal:
- Header: nama agen + komisi %
- Tabel tiket yang dijual agen ini (bulan ini):
  `Penumpang | Rute | Tanggal | Harga | Status`
- Summary: total tiket, total revenue, komisi earned
- Tombol "Catat Komisi Dibayar" → buka form:
  - Amount (pre-fill: unpaid_commission)
  - Metode pembayaran (TRANSFER / TUNAI)
  - Nomor referensi
  - Simpan ke `bus_pool_settlements` dengan pool_id = null, agent_id = agentId

Di tabel TIKET (tab Tiket):
1. Tambah kolom "Agen" setelah kolom Sumber
2. Tambah dropdown filter: `Semua Agen | [nama agen 1] | [nama agen 2] | Langsung`
3. Filter berjalan di client-side (filter dari `localTickets`)

---

## BAGIAN 2: MODUL EKSPEDISI

**Route**: `/ekspedisi`
**Module key**: `Ekspedisi`
**Category**: `addon`

---

### 2.1 DATABASE MIGRATION

**File**: `supabase/migrations/1327_ekspedisi.sql`

```sql
-- ─── ekspedisi_shipments: Manifest kiriman ────────────────────────────────────
CREATE TABLE IF NOT EXISTS ekspedisi_shipments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id       UUID REFERENCES branches(id) ON DELETE SET NULL,

  -- Nomor resi
  tracking_number VARCHAR(30) NOT NULL,   -- auto-generate: EXP/{YYYYMMDD}/{seq}

  -- Pengirim
  sender_name     VARCHAR(200) NOT NULL,
  sender_phone    VARCHAR(50),
  sender_address  TEXT,
  sender_city     VARCHAR(100),

  -- Penerima
  receiver_name   VARCHAR(200) NOT NULL,
  receiver_phone  VARCHAR(50),
  receiver_address TEXT,
  receiver_city   VARCHAR(100),

  -- Detail kiriman
  koli            INTEGER NOT NULL DEFAULT 1,    -- jumlah koli/paket
  weight_kg       NUMERIC(10,2),
  volume_cm3      NUMERIC(15,2),
  description     TEXT,
  declared_value  NUMERIC(20,2),

  -- Tarif
  rate_type       VARCHAR(20) NOT NULL DEFAULT 'PER_KG',
  -- PER_KG | PER_KOLI | PER_VOLUME
  rate_amount     NUMERIC(20,2) NOT NULL DEFAULT 0,
  shipping_cost   NUMERIC(20,2) NOT NULL DEFAULT 0,
  insurance_cost  NUMERIC(20,2) NOT NULL DEFAULT 0,
  total_cost      NUMERIC(20,2) NOT NULL DEFAULT 0,

  -- Pembayaran
  payment_method  VARCHAR(20) NOT NULL DEFAULT 'TUNAI',
  -- TUNAI | TRANSFER | TAGIH_PENERIMA
  payment_status  VARCHAR(20) NOT NULL DEFAULT 'BELUM_BAYAR',
  -- BELUM_BAYAR | LUNAS

  -- Agen
  agent_id        UUID REFERENCES ekspedisi_agents(id) ON DELETE SET NULL,

  -- Status pengiriman
  status          VARCHAR(30) NOT NULL DEFAULT 'DITERIMA',
  -- DITERIMA | DALAM_PERJALANAN | TIBA_KOTA_TUJUAN | TERKIRIM | GAGAL | RETUR

  -- POD
  pod_photo_url   TEXT,
  pod_signed_at   TIMESTAMPTZ,
  pod_receiver_name VARCHAR(200),

  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(org_id, tracking_number)
);

-- ─── ekspedisi_tracking: Log status pengiriman ────────────────────────────────
CREATE TABLE IF NOT EXISTS ekspedisi_tracking (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id     UUID NOT NULL REFERENCES ekspedisi_shipments(id) ON DELETE CASCADE,
  status          VARCHAR(30) NOT NULL,
  location        VARCHAR(200),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── ekspedisi_agents: Agen ekspedisi di kota tujuan ──────────────────────────
CREATE TABLE IF NOT EXISTS ekspedisi_agents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id       UUID REFERENCES branches(id) ON DELETE SET NULL,

  name            VARCHAR(200) NOT NULL,
  code            VARCHAR(20) NOT NULL,
  city            VARCHAR(100) NOT NULL,
  province        VARCHAR(100),
  phone           VARCHAR(50),
  email           VARCHAR(255),
  address         TEXT,

  commission_pct  NUMERIC(5,2) NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(org_id, code)
);

-- ─── ekspedisi_rate_cards: Tarif per rute ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS ekspedisi_rate_cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  origin_city     VARCHAR(100) NOT NULL,
  dest_city       VARCHAR(100) NOT NULL,
  rate_type       VARCHAR(20) NOT NULL DEFAULT 'PER_KG',
  price           NUMERIC(20,2) NOT NULL,
  min_charge      NUMERIC(20,2) NOT NULL DEFAULT 0,   -- biaya minimum
  is_active       BOOLEAN NOT NULL DEFAULT true,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ekspedisi_shipments_org
  ON ekspedisi_shipments(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ekspedisi_shipments_status
  ON ekspedisi_shipments(org_id, status);
CREATE INDEX IF NOT EXISTS idx_ekspedisi_shipments_tracking
  ON ekspedisi_shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_ekspedisi_tracking_shipment
  ON ekspedisi_tracking(shipment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ekspedisi_agents_org
  ON ekspedisi_agents(org_id, is_active);
CREATE INDEX IF NOT EXISTS idx_ekspedisi_rate_cards_route
  ON ekspedisi_rate_cards(org_id, origin_city, dest_city);
```

---

### 2.2 TYPES

**File baru**: `modules/ekspedisi/lib/ekspedisi-types.ts`

```typescript
export type ShipmentStatus =
  | 'DITERIMA' | 'DALAM_PERJALANAN' | 'TIBA_KOTA_TUJUAN'
  | 'TERKIRIM' | 'GAGAL' | 'RETUR'

export type RateType = 'PER_KG' | 'PER_KOLI' | 'PER_VOLUME'
export type PaymentMethod = 'TUNAI' | 'TRANSFER' | 'TAGIH_PENERIMA'
export type PaymentStatus = 'BELUM_BAYAR' | 'LUNAS'

export type EkspedisiShipment = {
  id: string; org_id: string; branch_id: string | null
  tracking_number: string
  sender_name: string; sender_phone: string | null
  sender_address: string | null; sender_city: string | null
  receiver_name: string; receiver_phone: string | null
  receiver_address: string | null; receiver_city: string | null
  koli: number; weight_kg: number | null; volume_cm3: number | null
  description: string | null; declared_value: number | null
  rate_type: RateType; rate_amount: number
  shipping_cost: number; insurance_cost: number; total_cost: number
  payment_method: PaymentMethod; payment_status: PaymentStatus
  agent_id: string | null; status: ShipmentStatus
  pod_photo_url: string | null; pod_signed_at: string | null
  pod_receiver_name: string | null
  notes: string | null; created_at: string; updated_at: string
  agent?: Pick<EkspedisiAgent, 'id' | 'name' | 'city'> | null
  tracking_logs?: EkspedisiTracking[]
}

export type EkspedisiTracking = {
  id: string; shipment_id: string; status: ShipmentStatus
  location: string | null; notes: string | null; created_at: string
}

export type EkspedisiAgent = {
  id: string; org_id: string; branch_id: string | null
  name: string; code: string; city: string; province: string | null
  phone: string | null; email: string | null; address: string | null
  commission_pct: number; is_active: boolean; notes: string | null
  created_at: string; updated_at: string
}

export type EkspedisiRateCard = {
  id: string; org_id: string
  origin_city: string; dest_city: string
  rate_type: RateType; price: number; min_charge: number
  is_active: boolean; created_at: string; updated_at: string
}
```

---

### 2.3 SERVER ACTIONS

**File baru**: `modules/ekspedisi/actions/ekspedisi.actions.ts`

```typescript
'use server'

// ── Shipments ─────────────────────────────────────────────────────────────────

export async function getEkspedisiShipments(orgId: string, filters?: {
  status?: ShipmentStatus; date_from?: string; date_to?: string
  agent_id?: string; search?: string  // cari di tracking_number / receiver_name
}): Promise<EkspedisiShipment[]>
// SELECT shipments + JOIN agents ORDER BY created_at DESC LIMIT 200

export async function getShipmentByTracking(
  orgId: string, trackingNumber: string
): Promise<EkspedisiShipment | null>
// SELECT + tracking_logs ORDER BY created_at ASC

export async function createShipment(orgId: string, payload: {
  sender_name: string; sender_phone?: string; sender_city?: string
  receiver_name: string; receiver_phone?: string; receiver_city?: string
  receiver_address?: string
  koli: number; weight_kg?: number; volume_cm3?: number
  description?: string; declared_value?: number
  rate_type: RateType; rate_amount: number
  insurance_cost?: number
  payment_method: PaymentMethod
  agent_id?: string
  notes?: string
}): Promise<{ data?: EkspedisiShipment; error?: string }>
// Business logic:
// 1. Generate tracking_number: 'EXP/' + YYYYMMDD + '/' + seq (3 digit, zero-padded)
//    seq = COUNT(*) + 1 WHERE DATE(created_at) = today AND org_id=$1
// 2. Hitung shipping_cost:
//    - PER_KG: rate_amount * weight_kg
//    - PER_KOLI: rate_amount * koli
//    - PER_VOLUME: rate_amount * volume_cm3 / 1000000
//    - Terapkan min_charge jika ada rate card yang cocok
// 3. total_cost = shipping_cost + (insurance_cost || 0)
// 4. INSERT shipments
// 5. INSERT tracking_logs entry: status='DITERIMA', location=org.city

export async function updateShipmentStatus(
  orgId: string, shipmentId: string,
  status: ShipmentStatus,
  payload: { location?: string; notes?: string }
): Promise<{ error?: string }>
// 1. UPDATE ekspedisi_shipments SET status, updated_at
// 2. INSERT ekspedisi_tracking (log entry)
// revalidatePath('/ekspedisi')

export async function recordPOD(orgId: string, shipmentId: string, payload: {
  pod_receiver_name: string
  pod_photo_url?: string
}): Promise<{ error?: string }>
// UPDATE SET pod_receiver_name, pod_photo_url, pod_signed_at=NOW(), status='TERKIRIM'
// + INSERT tracking log

// ── Agents ────────────────────────────────────────────────────────────────────

export async function getEkspedisiAgents(orgId: string): Promise<EkspedisiAgent[]>
export async function createEkspedisiAgent(orgId: string, payload: {
  name: string; code: string; city: string; province?: string
  phone?: string; email?: string; commission_pct?: number
}): Promise<{ data?: EkspedisiAgent; error?: string }>
export async function updateEkspedisiAgent(orgId: string, agentId: string,
  payload: Partial<EkspedisiAgent>
): Promise<{ error?: string }>

// ── Rate Cards ────────────────────────────────────────────────────────────────

export async function getEkspedisiRateCards(orgId: string): Promise<EkspedisiRateCard[]>
export async function upsertRateCard(orgId: string, payload: {
  origin_city: string; dest_city: string
  rate_type: RateType; price: number; min_charge?: number
}): Promise<{ error?: string }>

export async function lookupRate(orgId: string, origin: string, dest: string): Promise<
  EkspedisiRateCard | null
>
// SELECT * FROM ekspedisi_rate_cards
// WHERE org_id=$1 AND LOWER(origin_city)=LOWER($2) AND LOWER(dest_city)=LOWER($3)
// AND is_active=true LIMIT 1
```

---

### 2.4 UI

**File baru**: `app/(dashboard)/ekspedisi/page.tsx` (server component)
**File baru**: `app/(dashboard)/ekspedisi/EkspedisiClient.tsx` (client component)

#### Layout EkspedisiClient

**4 tab utama:**

**Tab 1: KIRIMAN** (default)
- Stats bar: Total Kiriman, Dalam Perjalanan, Terkirim Hari Ini, Pending Pembayaran
- Filter: status dropdown + date range + search (tracking number / nama penerima)
- Tabel kiriman:
  ```
  No. Resi | Pengirim → Penerima | Koli/Berat | Status | Pembayaran | Biaya | Aksi
  ```
- Tombol "Buat Kiriman" → modal form createShipment
- Klik baris → drawer detail kiriman:
  - Info lengkap pengirim & penerima
  - Timeline status (tracking log)
  - Tombol update status: "Dalam Perjalanan" / "Tiba Kota Tujuan" / "Terkirim" / "Gagal"
  - Tombol "Catat POD" (muncul saat status = TIBA_KOTA_TUJUAN)

**Tab 2: AGEN**
- Grid card agen: nama, kota, komisi %, jumlah kiriman bulan ini
- Tombol "Tambah Agen"
- Edit / nonaktifkan agen

**Tab 3: TARIF**
- Tabel rate card per rute (origin → dest, tipe, harga, min charge)
- Tombol "Tambah Tarif"
- Inline edit per baris

**Tab 4: LAPORAN**
- Filter: bulan/range
- Tabel rekap:
  - Volume kiriman per status
  - Pendapatan per agen
  - On-time delivery rate (% terkirim dalam estimasi)
  - Kiriman pending pembayaran

---

### 2.5 REGISTRASI MARKETPLACE

Tambahkan ke `ADDON_MODULES` di `module-registry.ts`:

```typescript
{
  key: 'Ekspedisi',
  name: 'Ekspedisi',
  tagline: 'Manajemen kiriman barang & jasa pengiriman',
  description: 'Manifest pengiriman, rate card per rute, tracking status, proof of delivery, manajemen agen ekspedisi, dan rekonsiliasi kas tagihan.',
  icon: '📦',
  color: 'bg-orange-600',
  href: '/ekspedisi',
  isCore: false,
  isAddon: true,
  category: 'addon',
  onboardingSteps: [
    {
      id: 'settings',
      title: 'Setup Tarif & Agen',
      description: 'Tambahkan rate card tarif per rute dan daftarkan agen ekspedisi di kota tujuan.'
    }
  ],
  tags: ['ekspedisi', 'pengiriman', 'logistik', 'manifest', 'tracking'],
  requires: ['Finance'],
}
```

---

## BAGIAN 3: PORTAL AGEN TIKET

**Tujuan**: Login terpisah untuk agen tiket bus. Agen bisa pantau tiket & komisi sendiri tanpa akses ke dashboard HQ.

---

### 3.1 APPROACH

Gunakan sistem auth yang sudah ada (`internal_auth_users`). Agen diberi akun dengan:
- `role = 'agent'` di `org_members`
- Permission: hanya akses `/portal-agen`
- Tidak bisa akses `/po-bus`, `/dashboard`, atau modul lain

---

### 3.2 DATABASE MIGRATION

**File**: `supabase/migrations/1328_agent_portal.sql`

```sql
-- Link bus_agents ke internal_auth_users (opsional, untuk login portal)
ALTER TABLE bus_agents
  ADD COLUMN IF NOT EXISTS auth_user_id UUID
    REFERENCES internal_auth_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bus_agents_auth_user
  ON bus_agents(auth_user_id)
  WHERE auth_user_id IS NOT NULL;
```

---

### 3.3 ROUTE

**File baru**: `app/(dashboard)/portal-agen/page.tsx`
**File baru**: `app/(dashboard)/portal-agen/PortalAgenClient.tsx`

Akses dikontrol di middleware: jika user `role = 'agent'` dan mencoba akses selain `/portal-agen/*` → redirect ke `/portal-agen`.

---

### 3.4 UI PortalAgenClient

Props:
```typescript
interface Props {
  orgId: string
  agentId: string        // dari bus_agents.auth_user_id match
  agentName: string
  commissionPct: number
}
```

**4 section:**

**Section 1 — Header Agen**
```
Selamat datang, [Nama Agen]
Komisi: 3% per tiket terjual
```

**Section 2 — Stats Bulan Ini**
```
[ Tiket Terjual: 18 ] [ Revenue: Rp 2.250.000 ] [ Komisi Earned: Rp 67.500 ] [ Belum Dibayar: Rp 67.500 ]
```

**Section 3 — Tabel Tiket Bulan Ini**
Kolom: No. Tiket | Penumpang | Rute | Tgl Keberangkatan | Harga | Status | Komisi

Filter: bulan (dropdown) — default bulan ini

**Section 4 — Riwayat Komisi**
Tabel settlement komisi yang sudah dibayar:
Periode | Tiket | Revenue | Komisi | Status | Tgl Dibayar

---

### 3.5 SERVER ACTIONS

Tambahkan ke `po-bus.actions.ts`:

```typescript
export async function getAgentPortalData(orgId: string, agentId: string, month: string): Promise<{
  agent: BusAgent
  tickets: BusTicket[]
  stats: {
    total_tickets: number; total_revenue: number
    commission_earned: number; commission_paid: number; commission_unpaid: number
  }
  settlements: BusPoolSettlement[]
}>
```

---

## BAGIAN 4: FASE 2 (Spesifikasi Awal — Implementasi Kemudian)

### 4.1 GPS LIVE TRACKING

**Pendekatan**: Device GPS di bus mengirim koordinat ke endpoint Nizam via HTTP POST setiap 30 detik.

**Migration** (1329):
```sql
CREATE TABLE bus_gps_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bus_id     UUID NOT NULL REFERENCES bus_units(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES bus_schedules(id) ON DELETE SET NULL,
  lat        NUMERIC(10,6) NOT NULL,
  lng        NUMERIC(10,6) NOT NULL,
  speed_kmh  NUMERIC(5,1),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON bus_gps_logs(bus_id, recorded_at DESC);
```

**API Endpoint**: `POST /api/po-bus/gps` (public, auth via `x-bus-token` header)
- Insert ke `bus_gps_logs`
- Update `bus_units.last_gps_lat`, `last_gps_lng`, `last_gps_at`

**UI**: Map component di tab baru "GPS" di POBusClient — polling setiap 15 detik via `router.refresh()`.

---

### 4.2 WHATSAPP OFFICIAL API

**Pendekatan**: Webhook dari Meta Cloud API → `POST /api/po-bus/whatsapp-webhook`

**Flow**:
1. Customer WA ke nomor bisnis: "Pesan tiket Jakarta Bandung besok jam 08.00"
2. Bot parse: rute + tanggal + jam
3. Cari jadwal yang cocok di `bus_schedules`
4. Kirim balasan dengan detail + harga
5. Customer konfirmasi → `createBusTicket()` dengan `source='WHATSAPP'`
6. Kirim nomor tiket + detail ke WA customer

**File**: `app/api/po-bus/whatsapp-webhook/route.ts`

---

### 4.3 OTA INTEGRATION (TRAVELOKA & TIKET.COM)

**Pendekatan**: Pull-based webhook — OTA kirim notifikasi booking ke endpoint Nizam.

**File**: `app/api/po-bus/ota-webhook/route.ts`
- Validasi payload dari OTA (signature verification)
- Parse: schedule_id (mapped dari external ID), passenger data, seat number
- `createBusTicket()` dengan `source='TRAVELOKA'` atau `source='TIKET_COM'`
- Kirim konfirmasi ke OTA

**Inventory sync**: Setiap bus_tickets dengan status `DIPESAN` atau `DIBAYAR` mengurangi kursi tersedia. OTA perlu endpoint `GET /api/po-bus/availability?schedule_id=X` untuk cek kursi real-time.

---

## BAGIAN 5: URUTAN EKSEKUSI

```
=== FASE 1: PENYEMPURNAAN PO BUS ===
1.  Migration 1325_bus_trip_count.sql
2.  Migration 1326_bus_ticket_source.sql
3.  Update po-bus-types.ts (tambah trip_count, source)
4.  Update po-bus.actions.ts:
    - Tambah incrementBusTripCount()
    - Update updateBusScheduleStatus() untuk call increment
    - Tambah getBusAgentStats()
    - Update createBusTicket() tambah price enforcement + source field
5.  Update POBusClient.tsx:
    - Badge trip count di card armada
    - Kolom Sumber + Agen di tabel tiket
    - Filter per agen di tab Tiket
    - Stats + drawer detail di card Agen

=== FASE 2: EKSPEDISI ===
6.  Migration 1327_ekspedisi.sql
7.  Buat modules/ekspedisi/lib/ekspedisi-types.ts
8.  Buat modules/ekspedisi/actions/ekspedisi.actions.ts
9.  Buat app/(dashboard)/ekspedisi/page.tsx
10. Buat app/(dashboard)/ekspedisi/EkspedisiClient.tsx
11. Tambah Ekspedisi ke module-registry.ts

=== FASE 3: PORTAL AGEN ===
12. Migration 1328_agent_portal.sql
13. Buat app/(dashboard)/portal-agen/page.tsx
14. Buat app/(dashboard)/portal-agen/PortalAgenClient.tsx
15. Tambah getAgentPortalData() ke po-bus.actions.ts
16. Update middleware untuk restrict akses agen ke /portal-agen

=== FINAL ===
17. Commit & push semua perubahan
```

---

## CATATAN IMPLEMENTASI

1. **Semua tabel bus_*** sudah punya `org_id` — semua query wajib filter `org_id`
2. **queryPostgres()** untuk bypass RLS pada tabel dengan RLS aktif
3. **createClient()** untuk query yang butuh RLS (contacts, accounts)
4. **revalidatePath('/po-bus')** setelah setiap mutation di po-bus.actions.ts
5. **revalidatePath('/ekspedisi')** setelah setiap mutation di ekspedisi.actions.ts
6. **Icons**: Lucide React only — tidak ada emoji sebagai icon struktural
7. **Styling**: TailwindCSS + `cn()` dari `lib/utils.ts`
8. **Error pattern**: `{ data?, error? }` konsisten di semua actions
9. **Tracking number format**: `EXP/20260605/001` — seq reset tiap hari
10. **Trip count**: increment hanya saat status `TIBA` — bukan BATAL/BERANGKAT
