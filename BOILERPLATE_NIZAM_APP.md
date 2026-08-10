# Boilerplate Nizam App

> Definisi boilerplate resmi Nizam App, disusun berlapis **dari pondasi ke permukaan**: konfigurasi dasar → koneksi data → autentikasi → utilitas & ERP bridge → modul bisnis → route/halaman → UI/design system → registrasi marketplace → test → deployment.
> Gunakan dokumen ini sebagai cetakan (template) setiap kali membuat modul/fitur baru, bukan hanya referensi bacaan. Setiap layer di bawah **bergantung pada layer di atasnya** — jangan lompat layer (mis. menulis UI langsung ke database tanpa lewat Server Action di layer modul).
> Pelengkap: [`AGENTS.md`](./AGENTS.md) (aturan & filosofi), [`WORKFLOW_TIM_IT_NIZAM.md`](./WORKFLOW_TIM_IT_NIZAM.md) (proses kerja tim), [`docs/developer-guide.md`](./docs/developer-guide.md) (setup lokal).

---

## Peta Layer

```
┌─────────────────────────────────────────────────────────┐
│ 7. Deployment            railway.json, CI, env           │
├─────────────────────────────────────────────────────────┤
│ 6. Test                  __tests__/<domain>.actions.test │
├─────────────────────────────────────────────────────────┤
│ 5. Registrasi Marketplace module-registry.ts              │
├─────────────────────────────────────────────────────────┤
│ 4. UI / Route            app/(dashboard)/<domain>/         │
│                          page.tsx (Server) + Client.tsx    │
├─────────────────────────────────────────────────────────┤
│ 3. Modul Bisnis           modules/<domain>/actions/, /lib/ │
├─────────────────────────────────────────────────────────┤
│ 2. Utilitas & ERP Bridge  lib/utils.ts, lib/erp-bridge/     │
├─────────────────────────────────────────────────────────┤
│ 1. Auth & Koneksi Data    lib/auth/, lib/supabase/, lib/db/ │
├─────────────────────────────────────────────────────────┤
│ 0. Fondasi Proyek         next.config, tsconfig, tailwind   │
└─────────────────────────────────────────────────────────┘
```

---

## Layer 0 — Fondasi Proyek

Konfigurasi dasar yang **tidak diubah** per fitur, hanya diubah saat mengubah kebijakan proyek secara sadar.

| File | Peran |
|---|---|
| `package.json` → `engines.node` | Kunci versi Node `20.19.x` |
| `tsconfig.json` | `strict: true`, alias `@/*` → root, target `ES2017`, `moduleResolution: bundler` |
| `next.config.mjs` | `output: 'standalone'` (wajib untuk `startCommand` Railway), Sentry source map upload, `serverActions.bodySizeLimit: 500mb` untuk upload file besar |
| `tailwind.config.ts` | `darkMode: 'class'`, font `Inter` (`--font-inter`), radius kustom `xl/2xl`, animasi `fade-in`/`slide-in`/`pulse-slow` |
| `eslint.config.mjs` | Aturan lint aktif — jalankan `npm run lint` sebelum PR |
| `railway.json` | Kontrak build & start command produksi (lihat [Layer 7](#layer-7--deployment)) |

**Aturan fondasi:** alias import selalu `@/...` (bukan relative path panjang `../../../`), sesuai `paths` di `tsconfig.json`. Semua modul baru wajib comply ke `strict: true` — hindari `any` kecuali benar-benar unavoidable (lihat pola `LooseDb`/`as any` di Layer 1 untuk kasus yang memang diterima).

---

## Layer 1 — Auth & Koneksi Data

Ini adalah fondasi akses data. **Semua** modul baru wajib start dari sini, tidak boleh bikin koneksi database sendiri.

### 1.1 Koneksi database

```ts
import { createClient } from '@/lib/supabase/server'   // server-side, interface mirip Supabase SDK
import type { LooseDb } from '@/lib/supabase/loose'    // helper type saat query dinamis/kompleks

const supabase = await createClient()
const db = supabase as unknown as LooseDb               // dipakai saat .from()/.select() sulit ditype ketat
```

Untuk query raw / agregasi kompleks yang tidak nyaman lewat query builder:

```ts
import { queryPostgres } from '@/lib/db/postgres'

const res = await queryPostgres<Record<string, unknown>>(
  `SELECT id, name FROM public.fixed_assets WHERE org_id = $1`,
  [orgId]
)
```

**Larangan mutlak:** `import { createClient } from '@supabase/supabase-js'` — ini bukan wrapper Railway, dan tidak akan tersambung ke database yang benar.

### 1.2 Konteks organisasi & cabang

Setiap Server Action yang membaca/menulis data tenant **wajib** resolve `orgId` dan `branchId` di awal — jangan asumsikan.

```ts
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'

// Di page.tsx (Server Component):
const orgData = await getActiveOrg()
if (!orgData) return redirect('/onboarding')
const orgId = orgData.org.id

// Di Server Action modul:
async function requireBranch(orgId: string) {
  const sel = await resolveAccessibleBranchSelection(orgId, branchId)
  if ('error' in sel || !sel.branchId) {
    return { error: 'Pilih Cabang aktif terlebih dahulu.' }
  }
  return { branchId: sel.branchId as string }
}
```

### 1.3 Sesi user (internal auth)

```ts
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'

const session = await getInternalAuthSession()
if (!session) return redirect('/login')
```

Tidak ada mode lain selain `AUTH_PROVIDER=internal` — jangan tulis cabang kode untuk Supabase Auth.

---

## Layer 2 — Utilitas & ERP Bridge

### 2.1 Utilitas umum (`lib/utils.ts`)

| Fungsi | Kegunaan |
|---|---|
| `cn(...)` | Merge class Tailwind (`clsx` + `tailwind-merge`) — wajib dipakai untuk semua className dinamis |
| `formatRupiah(amount, compact?)` | Format mata uang Rp |
| `formatDate(date, style?)` | Format tanggal `'short' \| 'long'` |
| `generateSlug(name)` | Slug dari string |
| `getInitials(name)` | Inisial nama untuk avatar |
| `toPgArray(arr)` | Format array untuk literal PostgreSQL |
| `stripHtml(html)` | Bersihkan tag HTML dari string |

Jangan menulis ulang fungsi ini di modul baru — extend `lib/utils.ts` jika perlu variasi baru yang reusable lintas modul.

### 2.2 ERP Bridge — wajib untuk transaksi uang (`lib/erp-bridge/finances.ts`)

```ts
import { ERPBridge } from '@/lib/erp-bridge/finances'

await ERPBridge.recordRevenue({
  orgId, branchId, amount, date, description,
  referenceType: 'WORKSHOP',      // string identitas modul asal transaksi
  referenceId: workOrderId,
  debitAccountId, creditAccountId,
  autoPost: true,
})
```

`recordRevenue` otomatis membuat `journal_entries` (baris debit/kredit seimbang) dan mengirim notifikasi Slack untuk transaksi ≥ Rp 10.000.000. Fungsi paralel: `ERPBridge.recordExpense(...)`, `ERPBridge.recordCOGS(...)`. **Dilarang** `INSERT` manual ke `journal_entries`/`cash_transactions` — itu adalah pelanggaran aturan anti-silo di [`AGENTS.md`](./AGENTS.md).

### 2.3 Operational Bridge — wajib untuk dokumen operasional → invoice (`modules/operational-bridge/actions/bridge.actions.ts`)

```ts
import { createInvoiceFromWorkOrder, getVehicleForSpkPrefill } from '@/modules/operational-bridge/actions/bridge.actions'
```

Fungsi yang tersedia: `createInvoiceFromOperational`, `createInvoiceFromWorkOrder`, `createInvoiceFromLmsBatch`, `createPurchaseFromOperational`, `getVehicleForSpkPrefill`. Pakai ini alih-alih menulis `INSERT INTO sales` manual dari modul operasional baru.

---

## Layer 3 — Modul Bisnis (`modules/<domain>/`)

### 3.1 Struktur folder baku

```
modules/<domain>/
  actions/
    <domain>.actions.ts   # 'use server' — satu-satunya pintu masuk mutasi/query dari UI
  lib/
    <domain>-types.ts     # interface/type domain, tanpa logic
```

### 3.2 Boilerplate tipe (`modules/<domain>/lib/<domain>-types.ts`)

```ts
// Tipe data untuk modul <deskripsi singkat domain>.

export type <Domain>Status =
  | 'DRAFT'
  | 'AKTIF'
  | 'SELESAI'
  | 'BATAL'

export interface <Domain>Record {
  id: string
  orgId: string
  branchId: string | null
  // ...field spesifik domain
  createdAt: string
}
```

### 3.3 Boilerplate Server Action (`modules/<domain>/actions/<domain>.actions.ts`)

Pola nyata ini diambil dari modul yang sudah berjalan di produksi (`modules/workshop/actions/workshop.actions.ts`) — ikuti persis strukturnya:

```ts
'use server'

// Server actions untuk modul <deskripsi singkat domain>.

import type { LooseDb } from '@/lib/supabase/loose'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'
import { ERPBridge } from '@/lib/erp-bridge/finances'
import type { <Domain>Record, <Domain>Status } from '@/modules/<domain>/lib/<domain>-types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function requireBranch(orgId: string): Promise<{ branchId: string } | { error: string }> {
  const sel = await resolveAccessibleBranchSelection(orgId)
  if ('error' in sel || !sel.branchId) {
    return { error: 'Pilih Cabang aktif terlebih dahulu.' }
  }
  return { branchId: sel.branchId as string }
}

// ─── Query ────────────────────────────────────────────────────────────────────

export async function get<Domain>Records(orgId: string, branchId?: string | null): Promise<<Domain>Record[]> {
  const supabase = await createClient()
  const db = supabase as unknown as LooseDb

  let q = db.from('<domain>_records').select('*').eq('org_id', orgId)
  if (branchId) q = q.eq('branch_id', branchId)

  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) { console.error('get<Domain>Records:', error); return [] }

  return (data || []).map((r: Record<string, unknown>) => ({
    id: String(r.id || ''),
    orgId: String(r.org_id || ''),
    branchId: r.branch_id ? String(r.branch_id) : null,
    createdAt: String(r.created_at || ''),
  }))
}

// ─── Mutasi ───────────────────────────────────────────────────────────────────

export async function create<Domain>Record(orgId: string, formData: FormData) {
  const branchSel = await requireBranch(orgId)
  if ('error' in branchSel) return { error: branchSel.error }

  const supabase = await createClient()
  const db = supabase as unknown as LooseDb

  const { data, error } = await db
    .from('<domain>_records')
    .insert({ org_id: orgId, branch_id: branchSel.branchId /* ...field lain dari formData */ })
    .select()
    .single()

  if (error) return { error: error.message }

  // Jika mutasi ini menerima/mengeluarkan uang, WAJIB panggil ERPBridge — lihat Layer 2.2.
  // await ERPBridge.recordRevenue({ ... referenceType: '<DOMAIN>', referenceId: data.id })

  revalidatePath('/<domain>')
  return { data }
}
```

**Pola error yang konsisten:** semua Server Action mengembalikan `{ data }` atau `{ error: string }` — bukan throw. Client component mengecek `'error' in result` sebelum memakai `result.data`.

---

## Layer 4 — UI / Route (`app/(dashboard)/<domain>/`)

Pola split **Server Component (fetch data) + Client Component (interaktivitas)**, diambil dari `app/(dashboard)/workshop/`:

### 4.1 `page.tsx` (Server Component — hanya fetch & compose, tanpa state)

```tsx
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { get<Domain>Records } from '@/modules/<domain>/actions/<domain>.actions'
import { <Domain>Client } from './<Domain>Client'
import { redirect } from 'next/navigation'

export const revalidate = 0

export default async function <Domain>Page() {
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')
  const orgId = orgData.org.id

  const records = await get<Domain>Records(orgId)

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <<Domain>Client orgId={orgId} records={records} />
    </div>
  )
}
```

### 4.2 `<Domain>Client.tsx` (Client Component — state, interaksi, panggil Server Action)

```tsx
'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Search } from 'lucide-react'          // Lucide, BUKAN emoji, untuk icon struktural
import { cn, formatRupiah, formatDate } from '@/lib/utils'
import { create<Domain>Record } from '@/modules/<domain>/actions/<domain>.actions'
import type { <Domain>Record } from '@/modules/<domain>/lib/<domain>-types'

interface Props {
  orgId: string
  records: <Domain>Record[]
}

export function <Domain>Client({ orgId, records }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  // ...state & handler
  return (
    <div className="space-y-6">
      {/* Card putih, rounded-2xl, border-slate-200/80, shadow-sm — lihat Layer "Design System" */}
    </div>
  )
}
```

### 4.3 Komponen shared yang sudah tersedia — pakai, jangan reinvent

`components/ui/`: `NizamUI.tsx` (termasuk `useConfirm()` untuk dialog konfirmasi), `CurrencyInput.tsx`, `SearchableSelect.tsx`, `PrintButton.tsx`, `QRCodeClient.tsx`, `SafeResponsiveContainer.tsx`.

---

## Layer 5 — Design System (default Nizam, bukan skill generik)

Skill `.claude/skills/ui-ux-pro-max/SKILL.md` mendukung 67 style lintas berbagai jenis produk — untuk Nizam App, **default yang benar sudah ditetapkan** dan tidak perlu dieksplorasi ulang tiap kali: **Modern Clean Fintech / SaaS UI (Card-Based Minimalism)**, sesuai AGENTS.md.

| Token | Nilai default Nizam |
|---|---|
| Card surface | `bg-white rounded-2xl border border-slate-200/80 shadow-sm` |
| Background halaman | `bg-slate-50` (`#F8FAFC`) |
| Font | `Inter` (`var(--font-inter)`, sudah di-setup di `tailwind.config.ts`) |
| Angka nominal | `tabular-nums font-bold` / `font-extrabold` |
| Status sukses/lunas | `bg-emerald-50 text-emerald-800` |
| Status pending | `bg-amber-100 text-amber-800` (`#fef3c7`) |
| Status gagal/batal | `bg-rose-50 text-rose-800` (`#ffe4e6`) |
| Warna brand utama | **Dinamis** dari `store.brandColor` / `org.brandColor` — tidak boleh hardcode kecuali org `coreisec` (`#004da4` primary, `#c69232` accent) |
| Icon interaktif/struktural | `lucide-react` — tidak ada emoji |

**Pengecualian yang sudah berjalan (bukan pelanggaran, ini pola yang disengaja):** field `icon` di `ModuleDefinition` (`modules/marketplace/lib/module-registry.ts`) memang berupa emoji string (`'🔧'`, `'📦'`, dst.) dan dirender langsung sebagai teks di kartu marketplace (`app/(dashboard)/marketplace/page.tsx`, `admin/page.tsx`). Ini konvensi legacy khusus untuk *badge modul di katalog*, bukan icon aksi/tombol — jangan generalisasi pola ini ke tombol atau navigasi.

Untuk halaman/komponen baru yang butuh eksplorasi gaya di luar default (landing page publik, dsb.), baru jalankan:

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<jenis_produk> <keyword>" --design-system -p "Nizam ERP"
```

---

## Layer 6 — Registrasi Marketplace (`modules/marketplace/lib/module-registry.ts`)

Modul baru **tidak otomatis muncul** di aplikasi — harus didaftarkan di `module-registry.ts` agar bisa diaktifkan lewat marketplace dan mendapat entri `org_module_instances`.

```ts
{
  key: '<Domain>',                       // identitas unik, dipakai di org_module_instances.module_key
  name: '<Nama Tampilan>',
  tagline: 'Satu kalimat value proposition',
  description: 'Deskripsi lebih lengkap untuk halaman detail modul.',
  icon: '🔧',                            // emoji, lihat pengecualian di Layer 5
  color: 'bg-stone-600',
  href: '/<domain>',
  isCore: false,                         // true hanya untuk 5 pilar wajib (Accounting, Finance, Purchasing, Inventory, Sales/CRM, HRIS)
  category: 'business_type',             // 'finance' | 'operasional' | 'marketing' | 'hris' | 'syirkah' | 'business_type' | 'addon' | 'special'
  defaultSettings: {},
  onboardingSteps: [
    { id: 'settings', title: 'Judul langkah', description: 'Penjelasan langkah setup awal.' },
  ],
  requires: ['Inventory', 'Sales'],      // modul lain yang wajib aktif duluan
}
```

Kategori `business_type` hanya boleh **satu yang aktif** per organisasi (swapable — Fleet & Rental, Manufacturing, Workshop, Job Order, Project, LMS saling eksklusif). Kategori `addon` boleh multi-aktif tanpa memengaruhi business type.

---

## Layer 7 — Test (`__tests__/<domain>.actions.test.ts`)

Pola nyata dari `__tests__/fleet.actions.test.ts` — mock semua dependency layer bawah, test logic Server Action secara terisolasi:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, failure, success } from './helpers/supabase-mock'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
  resolveAccessibleBranchSelection: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/modules/organization/lib/branch-access.server', () => ({
  resolveAccessibleBranchSelection: mocks.resolveAccessibleBranchSelection,
}))

import { create<Domain>Record } from '@/modules/<domain>/actions/<domain>.actions'

describe('<Domain> Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-1'] },
      branchId: 'branch-1',
    })
  })

  it('menolak input yang tidak valid', async () => {
    mocks.createClient.mockResolvedValue(createSupabaseMock().client)
    const result = await create<Domain>Record('org-1', new FormData())
    expect(result).toHaveProperty('error')
  })
})
```

Jalankan `npm run test` (semua) atau target file spesifik saat development; `npm run test:erp` wajib tetap hijau karena itu subset yang juga dicek CI.

---

## Layer 8 — Migrasi Database (`supabase/migrations/`)

```
supabase/migrations/<NNNN>_<domain>_<deskripsi_singkat>.sql
```

- Nomor urut naik dari nomor tertinggi yang sudah ada (cek `ls supabase/migrations/ | tail`).
- Tabel baru untuk modul bisnis minimal punya `org_id`, `branch_id`, `created_at` untuk konsisten dengan pola isolasi tenant di Layer 1.3.
- Jalankan `npm run db:migrate` secara lokal untuk verifikasi sebelum PR.
- Detail penuh alur eksekusi (hook `post-commit`, auto-run saat `npm run start`) ada di [`WORKFLOW_TIM_IT_NIZAM.md` §6](./WORKFLOW_TIM_IT_NIZAM.md#6-alur-kerja-database--migrasi-sql).

---

## Layer 9 — Deployment

Tidak ada yang perlu diubah per modul di layer ini — `railway.json`, `next.config.mjs` (`output: 'standalone'`), dan dua workflow GitHub Actions (`vitest-ci.yml`, `build-and-push.yml`) sudah menjadi fondasi bersama semua modul. Detail penuh: [`WORKFLOW_TIM_IT_NIZAM.md` §10–11](./WORKFLOW_TIM_IT_NIZAM.md#10-cicd-pipeline).

---

## Checklist Boilerplate Modul Baru (urutan pengerjaan)

1. [ ] `modules/<domain>/lib/<domain>-types.ts` — definisikan tipe.
2. [ ] `modules/<domain>/actions/<domain>.actions.ts` — Server Actions, pola `{ data } / { error }`, resolve `orgId`/`branchId` di setiap fungsi.
3. [ ] Jika transaksi uang → panggil `ERPBridge`; jika barang fisik → catat `inventory_movements`; jika staf → tautkan `employees`.
4. [ ] `supabase/migrations/<NNNN>_<domain>_....sql` — schema baru, nomor urut benar, `npm run db:migrate` sukses lokal.
5. [ ] `app/(dashboard)/<domain>/page.tsx` + `<Domain>Client.tsx` — split Server/Client, styling ikut Layer 5.
6. [ ] Daftarkan modul di `modules/marketplace/lib/module-registry.ts` (jika ini modul baru, bukan fitur di modul existing).
7. [ ] `__tests__/<domain>.actions.test.ts` — minimal test happy-path + satu validasi gagal.
8. [ ] `npm run lint` dan `npm run test` bersih sebelum PR.
