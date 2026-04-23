# NIZAM ERP — Comprehensive Codebase Documentation

> **Last updated:** 19 April 2026 — refreshed to match current repository structure, PostgreSQL-native runtime, POS shift opening journal fix, EDU realtime session schema, Railway migration-history normalization, and migrations through `1226`.

---

## 1. Executive Summary

NIZAM ERP is a **multi-tenant cloud ERP** built on **Next.js App Router** with a **PostgreSQL-native runtime** and a compatibility layer that still preserves parts of the historical Supabase-oriented API surface. It consolidates accounting, cash & bank, inventory/WMS, purchasing, sales, POS, CRM, HRIS & payroll, fixed assets, budgeting, tax, zakat (Islamic finance), approval workflows, audit trails, manufacturing, fleet management, service orders, SaaS billing, AI token economy, education flows, and public sales pages — all within a single monorepo.

### Codebase Snapshot

| Metric | Value |
|---|---|
| Page routes (`page.tsx`) | **78** |
| Client components (`*Client.tsx`) | **52** |
| Server action files | **59** |
| Migration SQL files | **245** (latest: `1226`) |
| Test files | **49** |
| API route handlers | **14** |
| Proxy (middleware) | `proxy.ts` |

---

## 2. Technology Stack

| Layer | Implementation |
|---|---|
| Framework | Next.js **16.2.1** (App Router) |
| UI Runtime | React **19.2.4** |
| Rendering | Server Components + Client Components + Server Actions |
| Request Interception | `proxy.ts` (Next.js 16 Proxy convention) |
| Database | PostgreSQL native via `pg`, Railway-oriented runtime, legacy Supabase compatibility layer |
| Auth | Internal auth runtime + compatibility handling for transitional flows |
| Security | Org isolation, role/module gating, branch-level ACL, and a mix of DB/app-layer enforcement during transition |
| Styling | Tailwind CSS **4.2.2** + custom design tokens + Framer Motion |
| UI Components | Custom `NizamUI` component library + Radix UI primitives |
| Charts | Recharts |
| XLSX Export | ExcelJS |
| OCR / AI | Google Gemini via `@google/generative-ai` + Google Vertex AI via `@google-cloud/vertexai` |
| Email | Resend |
| Icons | Lucide React |
| QR / Barcode | `html5-qrcode`, `qrcode.react`, `react-barcode` |
| Testing | Vitest **4.1.1** + `@vitest/coverage-v8` |
| Node.js | **≥ 20.0.0** (enforced in `package.json` engines) |
| TypeScript | **5.5.4** (strict mode) |
| Build Output | `standalone` |

---

## 3. Repository Structure

### 3.1 Top-Level Directories

```
nizam-app/
├── app/                 # Next.js App Router (all routes)
│   ├── (auth)/          # Login, register, password reset, join invitation
│   ├── (dashboard)/     # Main dashboard + all business modules
│   ├── abs/             # ABS voucher landing page
│   ├── api/             # API route handlers
│   ├── demo/            # Demo mode entry
│   ├── onboarding/      # New organization setup
│   └── sp/              # Public sales pages
├── components/
│   ├── shared/          # Layout components (sidebar, header, wizard, etc.)
│   ├── edu/             # Education shell/components
│   └── ui/              # Reusable UI primitives (NizamUI, CurrencyInput, etc.)
├── docs/                # Developer-facing documentation hub
├── lib/
│   ├── auth/            # Auth provider + internal auth helpers
│   ├── db/              # PostgreSQL connection + native adapter layer
│   ├── email/           # Email sender (Resend)
│   ├── hooks/           # Client hooks (useActiveOrgId)
│   ├── saas/            # SaaS module catalog, pricing, platform admin
│   ├── supabase/        # Compatibility clients, middleware, config, legacy naming
│   └── utils.ts         # cn(), formatRupiah(), formatDate(), generateSlug(), etc.
├── modules/             # Domain business logic (server actions + lib)
│   ├── accounting/      # 17 action files
│   ├── ai/              # Vision OCR + AI token wallet
│   ├── auth/            # Authentication actions
│   ├── cash/            # Bank + reconciliation
│   ├── contacts/        # CRM contacts
│   ├── demo/            # Demo seeding
│   ├── edu/             # Training, competency, edu mode
│   ├── factory/         # Manufacturing
│   ├── fleet/           # Fleet management
│   ├── hris/            # HR + payroll + attendance + leave + expense + self-service
│   ├── inventory/       # Products + warehousing
│   ├── organization/    # Org CRUD, billing, approval, audit, branch access
│   ├── purchasing/      # Purchase orders
│   ├── saas/            # SaaS operator sales actions
│   ├── sales/           # Sales orders, POS, sales pages
│   ├── services/        # Service/job orders
│   └── settings/        # Settings audit
├── types/
│   └── database.types.ts # Auto-generated Supabase types
├── __tests__/           # Vitest test suites (49 files)
├── supabase/
│   └── migrations/      # 245 SQL migration files
├── scripts/             # Data migration scripts
└── public/              # PWA manifest, logo, static assets
```

### 3.2 Key Entry Points

| File | Purpose |
|---|---|
| `app/layout.tsx` | Root layout — metadata, viewport, manifest, global CSS |
| `app/(auth)/layout.tsx` | Auth pages layout (login/register/join) |
| `app/(dashboard)/layout.tsx` | **Main app guard** — session, org, module, RBAC validation |
| `proxy.ts` | Next.js 16 Proxy — session refresh, route protection |
| `lib/supabase/middleware.ts` | Session update, auth/protected page redirect logic |
| `lib/supabase/config.ts` | Compatibility config for remote/local Supabase-oriented flows |
| `lib/supabase/server.ts` | Compatibility adapter exposing `createClient` / `createAdminClient` over PostgreSQL native runtime |
| `lib/supabase/client.ts` | Browser-side Supabase client |
| `lib/db/postgres.ts` | Native PostgreSQL pool and query entry point |
| `next.config.mjs` | Build config: `standalone` output, TypeScript errors ignored |

---

## 4. Architecture

### 4.1 Routing Model

NIZAM uses the **App Router** with route groups:

- **`(auth)`** — login, register, join invitation, forgot/update password
- **`(dashboard)`** — all authenticated business modules (20 subdirectories)
- **Public routes** — `/`, `/demo`, `/abs`, `/onboarding`, `/sp/[orgSlug]/[pageSlug]`
- **API routes** — auth session/signout, edu session, export, DB/health endpoints, OpenAPI, public sales lead, and `/api/v1/*` module endpoints

### 4.2 Root Flow

```
/ → getSession()
├── Not logged in → /login
├── Logged in, no org → Onboarding UI
└── Logged in, has org → /dashboard
```

### 4.3 Dashboard Layout Guard

`app/(dashboard)/layout.tsx` performs:

1. **Session validation** — redirect to `/login` if no session
2. **Active org resolution** — redirect to `/` if no active org
3. **Cross-module notification fetch** — pending approvals, etc.
4. **Module guard** — checks `enabledModules` from SaaS package against route path
5. **RBAC permission guard** — checks `roles.permissions` for non-owner/non-admin
6. **Branch-level access** — filters data by user's assigned branches

Route-to-module mapping uses `RouteModuleEntry` with aliases and permission keys for tolerant matching.

### 4.4 Proxy & Middleware

**`proxy.ts`** — Next.js 16 Proxy that calls `updateSession(request)`.

Matcher excludes:
- `api`, `_next/static`, `_next/image`, `_next/webpack-hmr`
- Metadata files (`favicon.ico`, `robots.txt`, `sitemap.xml`, `manifest.json`)
- Files with extensions
- Prefetch requests

**`lib/supabase/middleware.ts`** — the actual session logic:
- Short-circuits for bypassed paths (internal/metadata)
- Short-circuits for public routes (no auth lookup needed)
- Redirects authenticated users from login → dashboard (with `redirectTo` support)
- Redirects unauthenticated users from protected routes → login (preserving `pathname + search`)
- Validates `redirectTo` to prevent open redirects

### 4.5 Server Actions Pattern

All business logic lives in `modules/*/actions/*.actions.ts`:

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'

export async function doSomething(formData: FormData) {
  const supabase = await createClient()
  const org = await getActiveOrg()
  if (!org) return { error: 'No active organization' }
  
  // Business logic with org.orgId for tenant isolation
  const { data, error } = await supabase
    .from('some_table')
    .select('*')
    .eq('org_id', org.orgId)
  
  return { data, error: error?.message }
}
```

### 4.6 Client Component Pattern

Pages follow a **thin server page + fat client component** pattern:

```
app/(dashboard)/sales/page.tsx          ← Server Component (minimal, passes props)
app/(dashboard)/sales/SalesClient.tsx   ← Client Component ('use client', all UI)
```

Client components import server actions and call them via `startTransition` or form actions.

### 4.7 Data Access & Compatibility Layer

| Context | Import | Function |
|---|---|---|
| Native PostgreSQL access | `lib/db/postgres.ts` | Pool + direct SQL queries |
| Server Components, Server Actions | `lib/supabase/server.ts` | `createClient()` compatibility adapter |
| Admin operations | `lib/supabase/server.ts` | `createAdminClient()` compatibility adapter |
| Client Components | `lib/supabase/client.ts` | `createClient()` |
| Middleware | `lib/supabase/middleware.ts` | `createServerClient()` inline |

Important notes:

- `lib/supabase/server.ts` no longer represents a purely Supabase-backed server client; it adapts many existing action files to PostgreSQL-native internals.
- `lib/supabase/config.ts` remains for compatibility and environment switching where older flows still expect Supabase configuration.
- File naming in this area is historical. Always inspect implementation, not just the filename.

**Compatibility config switching:** `lib/supabase/config.ts` reads `NEXT_PUBLIC_SUPABASE_TARGET`:
- `'local'` → use `NEXT_PUBLIC_SUPABASE_LOCAL_URL` + local keys
- anything else → use `NEXT_PUBLIC_SUPABASE_URL` + remote keys

---

## 5. Auth, Tenancy & Access Control

### 5.1 Multi-Tenant Model

- Every business table has `org_id` for tenant isolation
- PostgreSQL RLS policies read `auth.uid()` and check org membership
- Key tables: `organizations`, `org_members`, `roles`, `branches`

### 5.2 Authentication Flows

| Flow | Function | Users |
|---|---|---|
| Owner signup | `signUp(formData)` | Business owners |
| Owner login | `signIn(formData)` | Email/password |
| Staff login | `signInWithNik(formData)` | NIK/password |
| Staff invitation | `verifyEmployeeNikByToken(token, nik)` | Join link → `/join/[token]` |
| Staff registration | `registerEmployeeAccount(formData)` | After invitation verification |
| Password reset (owner) | `sendPasswordResetEmail(formData)` | Transitional / provider-dependent |
| Password reset (staff) | `requestPasswordReset(nik)` → `resetEmployeePassword(...)` | HR-initiated |

Current runtime note:

- Middleware still supports `AUTH_PROVIDER=supabase` and `AUTH_PROVIDER=internal`.
- The server adapter in `lib/supabase/server.ts` is already wired around internal auth session semantics for the PostgreSQL-native runtime.
- This means some auth flows are transitional and should be verified against the active environment before operational use.

### 5.3 Active Organization Resolution

`getActiveOrg()` does:
1. Read session user
2. Support demo mode via `nizam_demo_org_id` cookie
3. Get earliest active membership
4. Read persisted active org/branch preference from `org_member_context` (migration `1112`)
5. Resolve plan + enabled modules from `saas_packages`
6. Merge `active_addons`
7. Fetch `job_title` from `employees` table
8. Return org context with `orgId`, `role`, `enabledModules`, `permissions`, etc.

User's last opened organization and branch preference is persisted in `org_member_context` table so the context survives logout and new devices (`active-context.server.ts`).

### 5.4 RBAC & Module Gating

Two-level access control:

1. **Database level:** RLS policies + role/membership checks
2. **Application level:** Dashboard layout guard + sidebar visibility

Permission sources:
- `roles.permissions` — granular per-domain permissions
- `organizations.enabled_modules` — which modules are activated
- `saas_packages.modules` — which modules the plan includes
- `organizations.active_addons` — additional purchased modules

### 5.5 Branch-Level Access

Recent branch context additions (migrations `1087`–`1104`):
- `org_members.allowed_branch_ids` — which branches a user can access
- `modules/organization/lib/branch-access.server.ts` — server-side branch filter
- Most business tables now have `branch_id` for branch-scoped operations
- Purchasing, inventory, sales, services, fleet, HRIS, payroll, factory, fixed assets, budgets, and journal entries are all branch-aware

### 5.6 Platform Admin

Platform admin access is controlled by email allowlist in `lib/saas/platform-admin.ts`:
```typescript
export const PLATFORM_ADMIN_EMAILS = ['bob@executive.id']
```
Guards both `/admin` and `/saas/*` routes.

---

## 6. Route Map

### 6.1 Public & Auth Routes

| Route | Purpose |
|---|---|
| `/` | Root gate — login/onboarding/dashboard redirect |
| `/onboarding` | New organization creation |
| `/demo` | Start demo session |
| `/abs` | ABS voucher landing |
| `/sp/[orgSlug]/[pageSlug]` | Public sales page |
| `/login` | Owner/staff login |
| `/register` | Owner registration |
| `/forgot-password` | Password reset email |
| `/update-password` | Set new password |
| `/join/[token]` | Employee invitation activation |

### 6.2 Dashboard Core

| Route | Purpose |
|---|---|
| `/dashboard` | KPI overview, OCF, runway, pareto analytics |
| `/profil-saya` | Employee self-service profile |
| `/billing` | Organization billing + AI token topup |
| `/billing/invoice/[id]` | Invoice print view |
| `/pricing` | SaaS package listing |
| `/admin` | SaaS admin panel |

### 6.3 Finance & Accounting

| Route | Purpose |
|---|---|
| `/cash` | Bank accounts & transactions |
| `/accounting/journal` | General ledger & manual journals |
| `/accounting/aging` | AR/AP aging |
| `/accounting/approvals` | Approval center |
| `/accounting/assets` | Fixed assets & depreciation |
| `/accounting/audit` | Data integrity audit |
| `/accounting/budgets` | Budgeting & budget vs actual |
| `/accounting/closing` | Fiscal period closing/opening |
| `/accounting/forecast` | Cash flow forecast |
| `/accounting/reimburse` | Reimbursement management |
| `/accounting/tax` | Tax summary |
| `/accounting/zakat` | Zakat tijarah & haul |
| `/settings/accounts` | Chart of Accounts |
| `/settings/accounts/new` | Add account |
| `/settings/accounts/[id]` | Edit account |

### 6.4 Operations

| Route | Purpose |
|---|---|
| `/inventory` | Products, opname, transfers, write-off, barcode |
| `/inventory/warehouses` | Warehouse master |
| `/inventory/warehouses/[id]` | Warehouse bin detail |
| `/inventory/ledger/[id]` | Stock ledger per product |
| `/purchasing` | POs, receiving, payment, returns, purchase requests |
| `/factory` | BoM, work orders, completion |
| `/fleet` | Fleet assets, bookings, routes, schedules, ticketing, crew, attendance, maintenance |
| `/services` | Service/job orders |

### 6.5 Sales & CRM

| Route | Purpose |
|---|---|
| `/contacts` | Customer/supplier CRM |
| `/pos` | POS cash sales |
| `/sales` | Sales orders, delivery, payment, returns |
| `/sales/quotations` | Quotation management |
| `/sales/pipeline` | Sales pipeline (Kanban + realtime) |
| `/sales/commission` | Sales commission |
| `/sales/promos` | Promotions UI |
| `/sales/pages` | Sales Page Studio (landing page builder) |

### 6.6 HRIS & Settings

| Route | Purpose |
|---|---|
| `/hris` | Employees, payroll, attendance, leave, expense, activation |
| `/settings/business` | Business profile, document format, logo, danger zone |
| `/settings/roles` | Role hierarchy & permissions |
| `/settings/users` | Organization membership |
| `/settings/branches` | Branch/division management |
| `/settings/sub-orgs` | Child organization (subsidiaries) management |
| `/settings/audit` | Admin audit trail |
| `/settings/ticketing` | User bug ticketing (menu, waktu kejadian, upload screenshot) |
| `/settings/ticketing/doc-update` | Feed progres perbaikan bug yang dipublikasikan |
| `/audit` | Redirect → `/settings/audit` |

### 6.7 Reports

| Route | Purpose |
|---|---|
| `/reports` | P&L, balance sheet, cash flow |
| `/reports/bsc` | Balanced scorecard |
| `/reports/pareto` | Pareto analysis |

### 6.8 SaaS Operator

| Route | Purpose |
|---|---|
| `/saas` | Redirect → `/saas/penjualan` |
| `/saas/penawaran` | SaaS quotation management |
| `/saas/penjualan` | SaaS sales management |
| `/saas/ticketing` | SaaS operator ticket progress management |
| `/saas/dokumen/[id]` | SaaS quotation/invoice document view |

---

## 7. Business Modules Detail

### 7.1 Organization & SaaS Core

**Actions:** `modules/organization/actions/` (6 files) + `modules/organization/lib/` (3 files)

- Organization create/update, active org resolution
- Branch management with access control
- Invitation token management (real, not mocked)
- Owner-only data reset (transactions or full operational reset)
- Billing invoices, payment proof upload, voucher activation
- Approval queue and history
- Admin-level audit logs

**Key tables:** `organizations`, `org_members`, `branches`, `org_invitations`, `roles`, `saas_packages`, `saas_invoices`, `saas_vouchers`, `approval_requests`, `audit_logs`

### 7.2 Accounting

**Actions:** `modules/accounting/actions/` (17 files)

- Manual journal + auto-post, posting/void with sub-ledger sync
- Balance sheet, P&L, cash flow, general ledger
- XLSX export
- Dashboard analytics + pareto
- AR/AP aging reports
- Aging AR/AP traceability: setiap baris menampilkan sumber (mis. `Piutang Usaha 1201`, `Piutang Salam Vendor 1404`, `Piutang Barang Istishna 1205`, `Hutang Usaha 2101`, `Hutang Salam 2602`, `Hutang Istishna 2603`) serta nomor dokumen SO/PO yang bisa diklik ke halaman transaksi terkait
- Istishna AR/AP support: PO maupun SO dengan mode Istishna kini tampil di Aging Dashboard dengan label dan CoA code yang tepat (`1205` di sisi AR, `2603` di sisi AP). Ringkasan di card stat juga menampilkan sub-total Piutang Istishna dan Hutang Istishna secara terpisah
- GL reconciliation fallback: jika selisih antara saldo GL akun Istishna dengan total modul > Rp10, muncul baris penyesuaian otomatis (GL-1205-ADJ / GL-2603-ADJ)
- Tax ledger summary
- Zakat haul with gold/silver nishab and asset timeline
- Fixed assets: capitalization, depreciation preview/run, disposal
- Budgeting + budget vs actual
- Fiscal period open/close
- Cash flow forecast
- Data integrity audit checks
- Reimbursement with receipt upload + approval
- Shariah account activation/injection
- Price management
- BSC metrics with configurable cycle/scope, perspective weights, KPI definitions, and automatic hybrid score calculation (0..100 and 0..4)

### 7.3 Cash & Bank

**Actions:** `modules/cash/actions/` (2 files)

- CRUD bank accounts (**hanya Parent/Holding**, Child/Branch diarahkan ke request workflow)
- Cash/bank transactions with linked journal entries
- CSV bank statement upload & parse
- Unmatched mutation listing
- Delete transaction with automatic journal void
- **Governance:** `createBankAccount` menolak non-Parent org dengan pesan `requiresRequest: true`; UI menampilkan tombol "Ajukan Rekening" yang mengarah ke `/accounting/coa-requests`

### 7.4 Inventory & WMS

**Actions:** `modules/inventory/actions/` (2 files)

- Product master with categories and barcode
- Stock calculation from `stock_movements`
- Stock adjustments, write-offs, inter-warehouse transfers
- Warehouse and warehouse bin management
- Stock ledger per product
- WMS stock uniqueness hardening via normalized unique index (`1119`)
- Branch-aware inventory (since migration `1088`)

### 7.5 Purchasing

**Actions:** `modules/purchasing/actions/` (1 file)

- PO creation with landed cost allocation
- Auto-create/update products from PO lines
- PO draft lifecycle: save as `DRAFT`, edit existing draft, then publish to `ORDERED`
- Publish from draft recreates approval request using the latest draft content; stale pending approval for the same PO is voided
- Draft PO remains editable from UI; receiving flow is only available after status `ORDERED`
- Receive purchase with stock + GL sync (atomic RPC)
- Idempotency guard on PO receiving to avoid duplicate stock posting when prior run partially succeeded
- Fallback stock sync path when `adjust_inventory_stock` signature/schema/index is not yet compatible (`1118`/`1119`)
- Inventory debit journal allocation per product `asset_account_id` (not only hardcoded `1301`)
- SALAM purchase enforcement: pembayaran vendor diposting ke `Piutang Salam Vendor (1404)`, wajib lunas sebelum barang diterima, dan wajib ada tanggal barang disediakan
- **ISTISHNA purchase workflow** (migration `1136`):
  - Pembelian aset dengan mode ISTISHNA tidak memicu alur manufaktur internal (BoM/SPK)
  - Sifatnya sebagai piutang/aset: setiap DP / cicilan diposting ke akun `1205 — Aset / Piutang Barang Istishna (Pembelian)` di CoA
  - Saat barang diterima (`receivePurchase`), saldo akun `1205` di-transfer ke `1301 Persediaan Barang`
  - Form PO: saat mode TEMPO + ISTISHNA dipilih, tersedia seksi **Down Payment** dengan toggle Nominal (Rp) atau Persentase (%), pilihan rekening sumber DP (Kas/Bank), dan auto-posting DP setelah PO tersimpan
  - Fungsi `ensure_istishna_vendor_asset_account` memastikan akun `1205` selalu ada di CoA sebelum jurnal diproses
- Void purchase via atomic RPC
- Purchase payments and returns
- Purchase requests (internal/manufacturing)
- Branch-aware purchasing (since migration `1087`)

### 7.6 Sales, Quotation & POS

**Actions:** `modules/sales/actions/` (3 files) + `modules/sales/lib/` (2 files)

- Sales orders with approval workflow
- Sales order draft lifecycle: save as `DRAFT`, reopen/edit draft, then publish when ready
- Approval request is created only on publish; updating draft will void stale pending approval for the same SO
- Draft mode allows iterative data entry, while publish mode enforces full validation (due date, payment term, and stock guard for non-SALAM)
- Delivery via atomic RPC with inventory-account resolution per product (`1120`)
- Non-SALAM stock guard: delivery/POS now blocks overselling when physical stock is insufficient
- Non-SALAM invoice creation guard: order creation is blocked when branch stock is insufficient, with explicit suggestion to switch to akad SALAM
- SALAM guard: wajib lunas sebelum delivery, payment diposting ke akun `Hutang Salam (2602)` lalu direklas saat barang dikirim
- Void sale now enforced via `void_sale_atomic` RPC to keep journal, `stock_movements`, and `inventory_stocks` synchronized
- Sales payments and returns
- Quotation create/convert
- POS cash sales with walk-in customer fallback
- Sales Page Studio: generate landing pages with template + AI, publish to `/sp/[orgSlug]/[pageSlug]`
- Sales pipeline Kanban with Supabase Realtime WebSocket
- Commission and promo management
- Lead capture (public API) → auto-create contact + pipeline card
- Branch-aware sales (since migration `1091`)

### 7.7 Contacts / CRM

**Actions:** `modules/contacts/actions/` (1 file)

- Contact list by type (customer/supplier)
- Create customer/supplier
- Used across purchasing, sales, POS, services, fleet

### 7.8 HRIS & Payroll

**Actions:** `modules/hris/actions/` (6 files)

- Employee CRUD, avatar upload, self-service profile update
- Payroll component management, payroll runs
- Payslip generation + payment via RPC
- Attendance tracking (GPS + QR for fleet crew)
- Leave request management with approval
- Expense claims with approval
- Self-service portal for employees
- Invitation-based employee activation
- Branch PIC assignment dari form karyawan (`managed_branches` → sinkron ke `branches.pic_employee_id`)
- Child-to-child employee mutation (same holding) dengan wizard, auto status source `RESIGNED`, opsi assign PIC target, dan audit trail
- Branch-aware HR (since migrations `1095`–`1098`)

### 7.9 Manufacturing

**Actions:** `modules/factory/actions/` (1 file)

- Bill of Materials (BoM) headers and items
- Shared TS unit conversion utility (`modules/factory/lib/unit-conversion.ts`) for UI/server parity
- BoM item quantity is normalized into product base unit before persistence
- Work orders with extra costs and finish goods bins
- Work order completion via RPC v2 (with v1 fallback)
- Purchase request creation from production needs
- Branch-aware factory (since migration `1101`)

### 7.10 Fleet & Rental / PO Bus

**Actions:** `modules/fleet/actions/` (1 file)

- Fleet asset management
- Booking rental with overlap guard + asset status sync
- Route, schedule, ticketing management
- Maintenance/medical records (via RPC)
- Crew management and terminal management
- Crew attendance via GPS + QR
- Branch-aware fleet (since migration `1094`)

### 7.11 Service Orders

**Actions:** `modules/services/actions/` (1 file)

- Service order CRUD and status updates
- Branch-aware services (since migration `1094`)

### 7.12 Demo & ABS

**Actions:** `modules/demo/actions/` (1 file)

- Demo account login/boot (`demo@nizam.app`)
- Demo org cleanup and creation with type-based seeding
- Demo types: `COMPUTER`, `CATERING`, `RESTAURANT`, `SUPPLIER_MBG`, `BLANK`
- Cookie-based demo org tracking (`nizam_demo_org_id`)
- ABS voucher landing with `ABS2024` code

### 7.13 AI & Email

**Files:** `modules/ai/actions/vision.actions.ts`, `modules/ai/lib/ai-token.server.ts`, `modules/ai/lib/ai-token.ts`, `lib/email/sender.ts`

**AI capabilities:**
- OCR receipt/invoice via Gemini
- Token wallet system (debit/credit per AI operation)
- Token balance check before AI generation
- Sales Page AI enrichment via `gemini-2.5-flash`

**Email capabilities:**
- Invoice email sending
- Promo broadcast
- Internal password reset email
- Weekly admin system usage report (analytics + heatmap)
- Requires `MAILKETING_API_TOKEN` and `MAILKETING_FROM_EMAIL` (no fallback)
- CLI trigger: `npm run report:weekly-system-usage`
- Scheduler endpoint: `GET/POST /api/internal/weekly-system-usage-report` + secret header

### 7.14 SaaS Operator

**Actions:** `modules/saas/actions/` (2 files)

- Cross-tenant snapshot (org/package/invoice data)
- SaaS quotation creation with full pricing breakdown (add-ons, tokens, entity/branch pricing, discount, tax)
- Quotation → sale conversion
- Sale payment + plan activation
- Invoice document detail with fallback for schema versions
- Editable anchor/actual pricing per add-on
- Support ticketing lifecycle (create ticket, operator progress update, doc update feed)

**Latest delivery (April 2026):**
- Added `Quick Bill` add-on as `Single Bill` (one-time) in SaaS operator pricing.
- Quotation pricing now supports duration-based calculation: monthly subtotal is multiplied by duration first, then discount and tax are applied.
- Document numbers were shortened:
  - Quotation: `QTN-YYMMDD-XXXX`
  - Invoice: `INV-YYMMDD-XXXX`
- Added quotation management operations:
  - Edit quotation (UNPAID only)
  - Delete quotation (UNPAID only)
- Added sales invoice edit operation:
  - Edit invoice (UNPAID only)
  - Includes automatic journal re-sync safety checks for sale journal consistency.
- Added multiline note extraction/display compatibility for historical documents:
  - Supports labels `Catatan`, `Catatan tambahan`, `Catatan penawaran`, `Catatan invoice`, and `Note`.
  - Supports legacy stored text containing literal `\\n`.
- SaaS document print layout refinements:
  - Header metadata block (invoice number/date) remains aligned on the right in print/PDF mode.
  - Discount row in invoice totals is highlighted for visibility.
- Hydration stability hardening on SaaS operator pages and SaaS document view to prevent SSR/CSR mismatch and hook-order runtime errors.

---

## 8. Shared UI Components

### 8.1 NizamUI (`components/ui/NizamUI.tsx`)

Core reusable components:
- `SafeButton` — button with loading/pending state
- `PageHeader` — consistent page header with breadcrumbs
- `StatCard` — KPI metric card
- `EmptyState` — empty data placeholder
- `SectionCard` / `SectionHeader` — content sections
- `StatusBadge` — status indicator
- `ConfirmDialog` — confirmation modal

### 8.2 Other UI Components

- `CurrencyInput` — formatted Rupiah input
- `SearchableSelect` — searchable dropdown
- `BarcodeScanner` / `BarcodeLabel` — barcode scan/print

### 8.3 Shared Layout Components

- `AppSidebar` — module navigation (role/permission/module aware, collapsible categories, platform admin group)
- `AppHeader` — org info, branch switcher, pending approvals, AI token badge
- `StartupWizard` — first-time onboarding wizard
- `MobileBottomNav` — mobile navigation
- `MobilePullToRefresh` — pull-to-refresh gesture on touch devices (HP/Tablet/iPad) in dashboard scroll container
- `DemoBanner` — demo mode indicator
- `FloatingPlanBadge` — plan indicator
- `AdminImpersonationBanner` — admin impersonation indicator

---

## 9. Database & Migrations

### 9.1 Overview

- **251 migration files** in `supabase/migrations/`
- `master_init.sql` — legacy bootstrap SQL (foundation reference)
- Latest migration: `1232_open_api_ip_allowlist.sql`
- Recent normalization:
  - Duplicate migration versions have been normalized into unique files such as `1199_syirkah_tables.sql`, `1231_fix_inventory_webhook_reversal_legacy_stock_movements.sql`, and `1232_open_api_ip_allowlist.sql`
  - Placeholder continuity files yang masih dipakai saat ini adalah `1227_remote_history_placeholder.sql` dan `1228_remote_history_placeholder.sql`

### 9.2 Core Entities

| Domain | Tables |
|---|---|
| Organization | `organizations`, `org_members`, `roles`, `branches`, `org_invitations` |
| Accounting | `accounts`, `journal_entries`, `journal_lines`, `account_balances` |
| Cash/Bank | `bank_accounts`, `bank_transactions`, `bank_mutations` |
| Inventory | `products`, `stock_movements`, `inventory_stocks`, `inventory_adjustments`, `inventory_adjustment_items`, `warehouses`, `warehouse_bins` |
| Sales | `sales`, `sales_items`, `sales_payments`, `sales_returns` |
| Sales Page | `sales_pages`, `sales_page_leads` |
| Purchasing | `purchases`, `purchase_items`, `purchase_payments`, `purchase_returns`, `purchase_requests` |
| HRIS | `employees`, `payroll_components`, `payroll_runs`, `payslips`, `payslip_lines`, `attendance`, `leave_requests`, `expense_claims` |
| Approval/Audit | `approval_requests`, `audit_logs` |
| Assets | `fixed_assets`, `asset_depreciation_logs` |
| Manufacturing | `production_boms`, `production_bom_items`, `production_work_orders`, `production_wo_costs` |
| Fleet | `fleet_assets`, `fleet_bookings`, `fleet_routes`, `fleet_schedules`, `fleet_tickets`, `fleet_maintenance_labs`, `fleet_terminals` |
| Services | `service_orders` |
| SaaS | `saas_packages`, `saas_invoices`, `saas_vouchers`, `saas_config` |
| Syirkah | `syirkah_contracts`, `syirkah_members` |
| POS Shift | `pos_shift_sessions`, `pos_shift_settlements` |
| Open API | `api_keys`, `api_rate_limit_log`, `api_configurations`, `api_call_logs`, `api_idempotency_keys` |
| Education / Training | `training_events`, `training_teams`, `training_sessions`, `training_session_steps`, `training_progress_events` |
| Zakat | `zakat_haul`, `zakat_haul_events`, `zakat_asset_timeline` |
| BSC / Strategy | `bsc_cycles`, `bsc_perspective_weights`, `bsc_kpis`, `bsc_kpi_measurements`, `v_bsc_latest_kpi_measurements` |
| AI Tokens | `ai_token_wallets`, `ai_token_usage_logs`, `ai_token_topup_packages`, `ai_token_topup_orders` |

### 9.3 Key Stored Procedures / RPC

| Procedure | Purpose |
|---|---|
| `seed_default_coa` | Seed default chart of accounts for new org |
| `process_purchase_atomic` | Atomic purchase receiving (stock + journal) |
| `void_purchase_atomic` | Atomic purchase void |
| `void_sale_atomic` | Atomic sales void with stock rollback |
| `process_purchase_payment_atomic` | Purchase payment processing |
| `process_purchase_return_atomic` | Purchase return processing |
| `process_sales_delivery_atomic` | Sales delivery (stock + journal) |
| `process_sales_payment_atomic` | Sales payment processing |
| `process_sales_return_atomic` | Sales return processing |
| `process_inventory_adjustment` | Inventory adjustment processing |
| `adjust_inventory_stock` | Direct stock adjustment |
| `reverse_inventory_from_stock_movements` | Reverse stock ledger effect into physical stock for atomic void flows |
| `guard_sales_non_salam_stock_after_delivery` | Trigger guard so non-SALAM delivery cannot end with negative stock |
| `ensure_salam_liability_account` | Ensure CoA syariah account `2602` (Hutang Salam) exists and return its account id |
| `ensure_salam_vendor_receivable_account` | Ensure CoA syariah account `1404` (Piutang Salam Vendor) exists and return its account id |
| `ensure_istishna_vendor_asset_account` | Ensure CoA account `1205` (Aset / Piutang Barang Istishna Pembelian) exists and return its account id |
| `resolve_inventory_asset_account` | Resolve inventory account per product / segment (`1301`–`1304`) |
| `ensure_inventory_segment_accounts` | Ensure default segment accounts (WIP, raw material, finished goods) per org |
| `generate_payslips_for_run` | Payslip generation |
| `process_payroll_payment` | Payroll disbursement |
| `void_payroll_run` | Payroll void |
| `process_expense_claim` | Expense claim processing |
| `process_work_order_completion_v2` | Manufacturing WO completion |
| `create_fleet_medical_record` | Fleet maintenance record |
| `process_asset_disposal` | Fixed asset disposal |
| `get_consolidated_org_ids` | Recursive org-tree expansion for holding consolidation (parent + all descendants) |
| `is_org_in_consolidation_tree` | Boolean helper to validate whether an org is inside a specific parent consolidation tree |
| `get_consolidated_org_hierarchy` | Displays parent + direct children org list with hierarchy label for UI display |
| `is_main_organization` | Returns TRUE if org has no `parent_org_id` (i.e. is Holding/Root) |
| `can_manage_finance_master` | Returns TRUE if current user may create/edit CoA or bank accounts directly on an org (must be Main Org + Main Branch context) |
| `bsc_calculate_achievement_percent` | Hitung persentase pencapaian KPI berbasis arah (`HIGHER_BETTER` / `LOWER_BETTER`) |
| `bsc_score_100_from_achievement` | Clamp achievement menjadi skor internal 0..100 |
| `bsc_score_4_from_score_100` | Konversi skor internal 0..100 menjadi skor display 0..4 |
| `fill_bsc_measurement_scores` | Trigger function untuk auto-isi `achievement_percent`, `score_100`, dan `score_4` saat measurement disimpan |
| `submit_coa_request` | Child/Branch submits a CoA account request to Parent for approval |
| `approve_coa_request` | Parent approves request and auto-creates the account in CoA |
| `reject_coa_request` | Parent rejects request with mandatory reason notes |
| `cancel_coa_request` | Requester cancels their own pending request |
| `reset_org_data` | Organization data reset (v2) |

### 9.4 Migration Timeline

| Range | Focus |
|---|---|
| `001`–`048` | Foundation ERP: org, RBAC, CoA, journals, cash/bank, sales/purchasing, inventory, assets, payroll, budgeting, aging, audit, RLS |
| `01_create_saas_packages` | SaaS package system |
| `999` | Final sales returns fix |
| `1000`–`1003` | Manufacturing, fleet, service orders |
| `1004` | Multi-branch infrastructure |
| `1005`–`1036` | Finance expansion, shariah, zakat, barcode, fleet extensions |
| `1040`–`1055` | Fleet medical/crew, storage, employee auth, org slug |
| `1056`–`1080` | Module activation, demo, SaaS billing, vouchers, fleet hardening, reset v2 |
| `1081` | Sales page module |
| `1082` | AI token economy + sales template |
| `1083`–`1084` | SaaS invoice column fixes, discount/tax |
| `1085`–`1086` | Module catalog sync, permission names fix |
| `1087`–`1104` | **Branch context expansion** (purchasing, inventory, sales, reimbursement, services, fleet, HRIS, expenses, payroll, leave, attendance, factory, fixed assets, budgets, journals) |
| `1105` | Fix `process_sales_delivery_atomic` RLS — diubah ke `SECURITY DEFINER` agar insert jurnal delivery melewati RLS dengan benar |
| `1106` | **Cash & Bank branch context** — bank accounts & transactions branch-aware; auto-posted cash journals carry correct `branch_id` |
| `1107` | Orphan journal cleanup — remove legacy journal rows not belonging to any active org |
| `1108` | Sales delivery inventory sync — store source warehouse on sales documents; fix physical stock not decreasing on delivery |
| `1109` | Multi-Org / Multi-Unit hardening — lock down org membership bootstrap, reduce roster visibility, align branch management privileges |
| `1110` | Legacy helper objects consolidation — normalize previously untracked helper migrations with invalid filenames |
| `1111` | Core multi-unit RLS hardening — enforce branch-aware access on core transactional tables; backfill default branch for legacy data |
| `1112` | **Active context preference** — persist user's last active org/unit per membership in `org_member_context` (survives logout + new devices) |
| `1113` | Restore bank transfer journal reference type — correct label for transfers vs generic cash-out |
| `1114`–`1115` | Support ticketing + public doc update progress feed |
| `1116` | Inventory/Sales/Purchase consistency guard (void + return stock synchronization) |
| `1117` | Factory UoM conversion + raw-material stock sync hardening |
| `1118` | Compatibility overload for `adjust_inventory_stock` legacy vs current signature |
| `1119` | `inventory_stocks` WMS unique index repair + duplicate merge cleanup |
| `1120` | Inventory account segmentation consistency (`1302`/`1303`/`1304`) + per-product account resolution in sales/purchase atomic flows |
| `1121` | Void RPC access grant + non-SALAM stock guard trigger after delivery |
| `1122` | SALAM enforcement: wajib lunas sebelum delivery + jurnal Hutang Salam (`2602`) |
| `1123` | Purchase SALAM enforcement: cash-out ke vendor jadi Piutang Salam Vendor (`1404`) + wajib lunas sebelum receive |
| `1124` | Purchase SALAM due-date guard: wajib isi tanggal barang disediakan saat create PO |
| `1125` | HRIS schema repair: ensure `employees.department_id` exists to avoid employee form save failure on legacy schema |
| `1126` | CoA governance hardening: add `parent_org_id`, enforce finance-master mutation only from Main Org + Main Branch authority |
| `1127` | Holding consolidation foundation: add recursive org-tree RPC (`get_consolidated_org_ids`) + membership helper (`is_org_in_consolidation_tree`) |
| `1128` | Sub-org PIC enhancement: add `branches.pic_employee_id` and `get_holding_employees` RPC for manager assignment. Caused PostgREST ambiguous join resolved via explicit `!employees_branch_id_fkey`. |
| `1129` | SaaS limit groundwork (placeholder to sync timeline). |
| `1130` | Branch delete safeguards: prevent deletion of the MAIN branch and any branch that has active stock, HRIS, or financial data. |
| `1131` | SaaS resource limits: add `max_users`, `max_branches`, `max_child_orgs` to `saas_packages`. Includes RLS/Trigger blockers for preventing limits bypass based on tenant sub-plan. |
| `1132` | **Istishna enforcement & liability** — akun `2603 — Hutang Istishna` ditambahkan ke CoA syariah. SO dengan mode ISTISHNA mencatat uang masuk dari pelanggan sebagai Hutang Istishna. |
| `1133` | **Work order deadline** — kolom `deadline` ditambahkan ke `production_work_orders`; deadline PO/SO disalin otomatis ke SPK saat proses produksi diklik. |
| `1134` | **Fix payment status enum** — perbaikan bug `invalid input value for enum document_status: ""` pada fungsi `process_purchase_payment_atomic`. |
| `1135` | **DP description in journals** — memperbarui `process_sales_payment_atomic` agar deskripsi jurnal menyertakan tipe pembayaran, nomor referensi, dan keterangan DP/Uang Muka secara eksplisit. |
| `1136` | **Purchasing Istishna receivable** — menambahkan akun `1205 — Aset / Piutang Barang Istishna (Pembelian)` ke CoA; memperbarui `process_purchase_payment_atomic` agar pembayaran/DP pembelian Istishna diposting ke `1205` (bukan `2101`); serah terima barang Istishna memindahkan saldo `1205` → `1301`. |
| `1137` | **CoA account request workflow** — tabel `coa_account_requests` + enum `coa_request_status`; RPC `submit_coa_request`, `approve_coa_request`, `reject_coa_request`, `cancel_coa_request`; view `coa_request_summary`; trigger `enforce_coa_request_governance`; RLS policies untuk Parent (melihat semua) dan Child/Branch (melihat milik sendiri). |
| `1138` | **Fix CoA governance functions** — repair idempotent untuk `is_main_organization()` dan `can_manage_finance_master()` yang tidak terbuat saat migration 1126 partial fail; backfill `managed_branch_id`; re-attach trigger `enforce_accounts_governance` dan `enforce_accounts_delete_governance`. |
| `1139` | Fix parameter order untuk `submit_coa_request` agar kompatibel dengan call site di action layer. |
| `1140` | Grant execute + permission repair untuk fungsi-fungsi governance CoA request. |
| `1141` | Repair fungsi konsolidasi yang hilang (`get_consolidated_org_ids`, `is_org_in_consolidation_tree`, `get_consolidated_org_hierarchy`). |
| `1142` | Perbaikan cast tipe pada approval CoA request agar stabil pada berbagai environment schema. |
| `1143` | **Inter-org capital transfer RPC** — parent dapat posting transfer modal lintas entitas secara atomik (`OUT` sumber + `IN` tujuan) dengan validasi tree konsolidasi dan validasi akun lawan per entitas. |
| `1144` | Repair sinkronisasi report `bank_transactions` agar konsisten dengan jurnal/cash-bank references. |
| `1145` | Guardrail tambahan untuk inter-org capital transfer (validasi entitas sumber/tujuan dan batasan posting). |
| `1146` | Backfill `reference_type` legacy untuk transfer modal antar organisasi agar histori konsisten. |
| `1147` | Enforce source-counter cash/bank untuk inter-org transfer agar pasangan jurnal sisi lawan selalu valid. |
| `1148` | Fix CoA bootstrap race: governance accounts dapat memastikan `Unit Utama` tersedia saat seed awal akun. |
| `1149` | Tambah trigger bootstrap `MAIN branch` pada saat org dibuat untuk memastikan branch tersedia sebelum trigger seed akun lain berjalan. |
| `1150` | Rebind trigger `trg_accounts_governance` ke `enforce_accounts_governance_v2()` + helper `ensure_main_branch_for_org()` agar race bootstrap lintas environment tertangani. |
| `1151` | **Shariah CoA cleanup** — `inject_shariah_coa` tidak lagi membuat/mengaktifkan akun legacy `3100 Ekuitas Syariah`; menjaga akun Syirkah `3110`/`3120` tetap aktif di bawah parent `3000`; backfill menghapus/menonaktifkan `3100` lama secara aman. |
| `1152` | **BSC configuration + KPI scoring engine** — tabel siklus/weight/KPI/measurement, helper function scoring (achievement %, score 100, score 4), trigger auto-fill score, view latest measurement per KPI, serta RLS berbasis permission `strategy:*`/`reports:read`. |
| `1153`–`1176` | **Railway PostgreSQL Decoupling** — Migrasi data dan logika dari ekosistem Supabase Cloud ke *database* Railway secara penuh. Penggantian Supabase Auth dengan skema otentikasi internal mandiri (`internal_auth_users`), refaktor ekstensif pada *nested query builder* menjadi Native Postgres SQL JOIN dari modul kasir, pembelian hingga pembukuan agar visibilitas saldo & jurnal akurat. Pemutusan SDK _auth_ pada Demo Mode. Sistem ERP kini 100% otonom tanpa dependensi RLS Supabase eksternal. |
| `1177` | Internal auth password resets — tabel `internal_auth_password_resets` untuk token reset sandi native. |
| `1178` | Subscription end enforcement — tambah `organizations.subscription_end` dan normalisasi durasi Trial legacy. |
| `1179` | POS shift foundation — sesi shift POS, settlement audit trail, dan relasi transaksi POS ke shift. |
| `1199`–`1202` | Syirkah + Open API foundations — normalisasi file `syirkah_tables` ke versi unik `1199`, Open API keys/configuration/logging, serta `syirkah_contracts.current_debt`. |
| `1206`–`1213` | Education scoreboard, org expiry sync, sales discount contra journal/backfill, audit FK repair, schema repair `roles.department_ids`, holding role sync, dan refresh injeksi CoA Syariah SALAM/ISTISHNA. |
| `1214`–`1219` | Purchase insurance column, normalisasi `roles.department_ids` ke `text[]`, sinkronisasi arsitektur bundle SaaS, repricing paket, serta aturan Trial 3 hari + one-time claim tracking. |
| `1220` | Harden sales delivery journal idempotency — cegah duplicate journal mentah, auto-heal status `FINISHED`, dan beri error bisnis yang lebih jelas untuk delivery legacy yang setengah sinkron. |
| `1221` | POS shift opening funding metadata — simpan `opening_source_account_id` dan `opening_journal_entry_id` pada `pos_shift_sessions`. |
| `1222` | Open API idempotency keys — tabel `api_idempotency_keys` untuk POST retry yang aman tanpa duplikasi transaksi. |
| `1223`–`1224` | Railway migration history placeholders — file no-op untuk menjaga kontinuitas `supabase_migrations.schema_migrations` ketika histori remote sudah lebih dulu mencatat versi yang file sumbernya tidak lagi tersedia. |
| `1225` | POS shift opening journal enum fix — tambah `POS_SHIFT_OPENING` ke enum `journal_reference_type` agar jurnal modal awal shift bisa diposting. |
| `1226` | EDU realtime session mode — tambah `training_sessions`, `training_session_steps`, dan `training_progress_events` untuk mode latihan realtime. |

### 9.5 Storage Buckets

| Bucket | Purpose |
|---|---|
| `brand_assets` | Organization logos |
| `receipts` | Reimbursement proof + support ticket screenshots |
| `avatars` | Employee avatars |
| `billing-proofs` | SaaS billing payment proof |

---

## 10. Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Recommended | Primary PostgreSQL runtime connection |
| `RAILWAY_DATABASE_URL` | Recommended fallback | Railway PostgreSQL connection |
| `DATABASE_PUBLIC_URL` | Optional fallback | Alternate DB connection source |
| `AUTH_PROVIDER` | Recommended | `internal` or `supabase` depending on environment |
| `INTERNAL_AUTH_SESSION_SECRET` | Required when internal auth | Internal auth cookie/session signing |
| `INTERNAL_AUTH_BOOTSTRAP_PASSWORD` | Optional | Bootstrap helper for internal auth scripts |
| `NEXT_PUBLIC_SUPABASE_URL` | Compatibility / legacy | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Compatibility / legacy | Supabase anon key |
| `NEXT_PUBLIC_SUPABASE_TARGET` | Optional | `local` = use local Supabase CLI compatibility mode |
| `SUPABASE_SERVICE_ROLE_KEY` | Transitional admin ops | Employee provisioning, reset password, legacy scripts |
| `NEXT_PUBLIC_SUPABASE_LOCAL_URL` | When local | Local Supabase URL |
| `NEXT_PUBLIC_SUPABASE_LOCAL_ANON_KEY` | When local | Local anon key |
| `SUPABASE_LOCAL_SERVICE_ROLE_KEY` | When local | Local service role |
| `GOOGLE_AI_STUDIO_KEY` | For AI features | OCR, AI content generation |
| `MAILKETING_API_TOKEN` | For email | Invoice, promo, reset password email via Mailketing |
| `MAILKETING_FROM_EMAIL` | For email | Default alamat pengirim email |
| `WEEKLY_SYSTEM_USAGE_REPORT_RECIPIENTS` | For weekly admin report | Daftar email admin dipisah koma |
| `WEEKLY_SYSTEM_USAGE_REPORT_SECRET` | For scheduler endpoint | Secret untuk trigger laporan mingguan |
| `NEXT_PUBLIC_APP_URL` | Optional | Public base URL fallback |
| `NEXT_PUBLIC_SITE_URL` | Optional | Password reset redirect URL |
| `VERCEL_URL` | Auto (Vercel) | Vercel deployment origin |

Notes:

- Runtime DB access now expects one of `DATABASE_URL`, `RAILWAY_DATABASE_URL`, or `DATABASE_PUBLIC_URL`.
- [`.env.local.example`](/Users/manbook/nizam-app/.env.local.example:1) is still a useful baseline, but it does not fully explain every PostgreSQL-native runtime variable.
- Compatibility switching for older Supabase-oriented flows is still handled by `lib/supabase/config.ts`. Changing `NEXT_PUBLIC_SUPABASE_TARGET` requires a restart.

---

## 11. Development Setup & Workflows

### 11.1 Prerequisites

- Node.js ≥ 20.0.0
- PostgreSQL database access for the active environment
- Optional: Supabase project or local Supabase CLI + Docker for compatibility/testing flows
- Environment variables configured

### 11.2 Available Scripts

```bash
# Development
npm run dev               # Start Next.js dev server
npm run dev:webpack       # Start dev server without Turbopack
npm run build             # Production build
npm run start             # Start production server
npm run perf:local        # Build + start standalone locally
npm run lint              # ESLint

# Testing
npm run test              # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage report
npm run test:erp          # Core ERP tests only
npm run test:erp:coverage # Core ERP tests with coverage

# Supabase
npm run supabase:start           # Start local Supabase
npm run supabase:stop            # Stop local Supabase
npm run supabase:status          # Show local Supabase status
npm run supabase:db:reset        # Reset local database
npm run supabase:migrate-local-data  # Clone online data to local

# Railway / PostgreSQL cutover helpers
npm run db:railway:sync          # Dry-run schema sync
npm run db:railway:sync:apply    # Apply schema sync
npm run db:railway:sync:all      # Apply schema sync including earlier remote-missing migrations
npm run db:railway:data:sync     # Dry-run data sync
npm run db:railway:data:sync:apply # Apply data sync
npm run db:railway:data:sync:rest # Dry-run REST/admin data sync
npm run db:railway:data:sync:rest:apply # Apply REST/admin data sync
npm run db:railway:parity        # Compare Supabase vs Railway schema/data parity
npm run db:railway:readiness     # Cutover readiness checks
npm run db:railway:cutover       # Orchestrated dry-run cutover
npm run db:railway:cutover:apply # Apply cutover flow
npm run db:railway:auth:backfill # Dry-run internal auth/user backfill
npm run db:railway:auth:backfill:apply # Apply auth/user backfill
npm run db:railway:internal-auth:bootstrap # Dry-run bootstrap internal auth users
npm run db:railway:internal-auth:bootstrap:apply # Apply bootstrap internal auth users

# Utilities
npm run templates:migrasi # Generate migration template workbook
```

### 11.3 Runtime and Compatibility Modes

| Mode | Setup |
|---|---|
| **App → PostgreSQL native runtime** | Fill `DATABASE_URL` or `RAILWAY_DATABASE_URL`, configure auth provider |
| **App → Remote Supabase compatibility flow** | Fill remote Supabase env vars, leave `NEXT_PUBLIC_SUPABASE_TARGET` empty |
| **App → Local Supabase compatibility flow** | Run `supabase:start`, fill local env vars, set `NEXT_PUBLIC_SUPABASE_TARGET=local` |
| **Clone Remote → Local** | Keep both env sets, run `supabase:migrate-local-data` |

> ⚠️ After cloning, user passwords are reset to `LocalTest123!`
> ⚠️ Always restart `npm run dev` after changing `NEXT_PUBLIC_SUPABASE_TARGET`

### 11.4 Build Notes

`next.config.mjs` currently ignores TypeScript build errors:
```js
typescript: { ignoreBuildErrors: true }
```
This means production builds will succeed even with type errors. This flag exists due to a backlog of cross-module TypeScript errors.

---

## 12. Testing

### 12.1 Configuration

**Vitest** (`vitest.config.ts`):
- Environment: `node`
- Coverage: `v8` provider, `text` + `html` reporters
- Path alias: `@/` → project root

### 12.2 Test Suites (49 files)

| File | Coverage Area |
|---|---|
| `accounting.test.ts` | Journal balance, zakat nishab, payroll calc |
| `auth.actions.test.ts` | Auth flows |
| `fleet.actions.test.ts` | Fleet booking, maintenance, attendance |
| `middleware.test.ts` | Middleware redirect logic |
| `proxy.test.ts` | Proxy behavior |
| `aging.actions.test.ts` | AR/AP aging |
| `approval.actions.test.ts` | Approval workflows |
| `assets.actions.test.ts` | Fixed assets |
| `attendance.actions.test.ts` | Attendance tracking |
| `bank.actions.test.ts` | Bank account and cash transaction actions |
| `branch-access.server.test.ts` | Branch ACL |
| `bsc.actions.test.ts` | Balanced scorecard |
| `budget.actions.test.ts` | Budgeting |
| `employee.actions.test.ts` | Employee CRUD |
| `expense.actions.test.ts` | Expense claims |
| `export.route.test.ts` | XLSX export |
| `factory.actions.test.ts` | Manufacturing |
| `forecast.actions.test.ts` | Cash flow forecast |
| `inventory.actions.test.ts` | Inventory operations |
| `journal.actions.test.ts` | Journal actions |
| `leave.actions.test.ts` | Leave management |
| `org.actions.test.ts` | Organization operations |
| `payroll.actions.test.ts` | Payroll processing |
| `purchasing.actions.test.ts` | Purchase operations |
| `reconcile.actions.test.ts` | Bank reconciliation actions |
| `reimburse.actions.test.ts` | Reimbursement |
| `reports.actions.test.ts` | Financial reports |
| `sales.actions.test.ts` | Sales operations |
| `self-service.actions.test.ts` | Employee self-service |
| `service.actions.test.ts` | Service orders |
| `supabase.config.test.ts` | Supabase config |
| `tax.actions.test.ts` | Tax calculations |
| `zakat.actions.test.ts` | Zakat calculations |

### 12.3 Test Helpers

- `__tests__/helpers/supabase-mock.ts` — Supabase client mocking utilities

---

## 13. Design System

### 13.1 Color Palette

```css
/* Primary: Deep Tech Blue */
--color-primary-500: #003366;
--color-primary-600: #002d5a;
--color-primary-700: #00264d;

/* Neutrals */
--color-bg: #f8f9fa;
--color-surface: #ffffff;
--color-border: #e9ecef;
--color-grey-accent: #4a4a4a;
```

### 13.2 Typography

Font stack: `Inter → Outfit → system-ui → sans-serif`

### 13.3 Spacing & Radius

- Border radius: `8px` (sm), `12px` (md), `16px` (lg), `32px` (xl)
- Shadows: Ultra-subtle (`--shadow-sm` through `--shadow-xl`)

### 13.4 Animations

- `fadeIn` — 200ms ease, translateY(6px → 0)
- `slideIn` — 200ms ease, translateX(-8px → 0)
- `pulseSlow` — 2s ease-in-out, opacity cycle

### 13.5 Tailwind v4 Integration

The project uses **Tailwind CSS 4.2.2** with `@tailwindcss/postcss`. Custom colors are defined in both `globals.css` `@theme` blocks and `tailwind.config.ts`.

---

## 14. Conventions for AI Assistants

### 14.1 Critical Rules

1. **Read Next.js 16 docs first.** This project uses Next.js 16, which has breaking changes. Check `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

2. **Always use `'use server'` for server actions.** All business logic goes in `modules/*/actions/*.actions.ts`.

3. **Always check org context.** Every server action must call `getActiveOrg()` and verify `org.orgId` before database operations.

4. **Always filter by `org_id`.** Every query must include `.eq('org_id', org.orgId)` for tenant isolation.

5. **Check branch access.** For branch-aware operations, use `modules/organization/lib/branch-access.server.ts` to filter by user's allowed branches.

6. **Use the correct data access layer:**
   - Native SQL / infra debugging: inspect `lib/db/postgres.ts`
   - Server actions/components: `import { createClient } from '@/lib/supabase/server'`
   - Client components: `import { createClient } from '@/lib/supabase/client'`
   - Admin operations: `import { createAdminClient } from '@/lib/supabase/server'`
   - Remember that `lib/supabase/server.ts` is now a compatibility adapter over PostgreSQL-native internals

7. **Follow the thin page + fat client pattern.** Server `page.tsx` files should be minimal. Put interactive UI in `*Client.tsx` with `'use client'`.

8. **Use NizamUI components** for consistent UI: `SafeButton`, `PageHeader`, `StatCard`, `EmptyState`, `SectionCard`, `StatusBadge`, `ConfirmDialog`.

9. **Use `lib/utils.ts` helpers** for formatting: `cn()`, `formatRupiah()`, `formatDate()`, `generateSlug()`, `getInitials()`.

10. **TypeScript errors don't block build** (due to `ignoreBuildErrors: true`), but always write type-safe code.

### 14.2 File Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Server actions | `*.actions.ts` | `sales.actions.ts` |
| Server library | `*.server.ts` | `branch-access.server.ts` |
| Client component | `*Client.tsx` | `SalesClient.tsx` |
| Page route | `page.tsx` | `app/(dashboard)/sales/page.tsx` |
| Layout | `layout.tsx` | `app/(dashboard)/layout.tsx` |
| Types | `*.types.ts` | `database.types.ts` |
| Tests | `*.test.ts` | `sales.actions.test.ts` |
| Migrations | `NNNN_description.sql` | `1128_sub_org_enhancements.sql` |

### 14.3 Module Structure

Each domain module in `modules/` follows:
```
modules/[domain]/
├── actions/
│   └── [domain].actions.ts   # Server actions ('use server')
└── lib/
    ├── [domain].ts            # Shared types & utilities
    └── [domain].server.ts     # Server-only library code
```

### 14.4 Adding a New Route

1. Create `app/(dashboard)/[route]/page.tsx` (server component)
2. Create `app/(dashboard)/[route]/[Route]Client.tsx` (client component)
3. Add route to `PROTECTED_PAGE_PREFIXES` in `lib/supabase/middleware.ts`
4. Add route-to-module mapping in `app/(dashboard)/layout.tsx`
5. Add menu entry in `components/shared/AppSidebar.tsx`
6. Create server actions in `modules/[domain]/actions/`

### 14.5 Adding a New Migration

- File naming: `NNNN_description.sql` (next number after `1128` is **`1129`**)
- Always make migrations **idempotent** (use `IF NOT EXISTS`, `DO $$ ... $$`)
- Include `NOTIFY pgrst, 'reload schema'` if adding/removing columns
- Add appropriate RLS policies for new tables

### 14.6 Error Handling Pattern

Server actions return `{ data?, error? }`:
```typescript
export async function doThing() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.from('table').select()
    if (error) return { error: error.message }
    return { data }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
```

### 14.7 SaaS Module Catalog

When adding new modules to the SaaS system, update:
1. `lib/saas/module-catalog.ts` — canonical names and aliases
2. `lib/saas/operator-pricing.ts` — pricing configuration
3. Dashboard layout guard — route-to-module mapping
4. Sidebar — menu visibility rules

### 14.8 Known Technical Debt

- `next.config.mjs` ignores TypeScript build errors
- Some admin/settings areas still use client-side Supabase-oriented writes instead of server actions
- ESLint has a backlog of warnings across modules
- Some `<img>` tags should be `next/image`

---

## 15. Complete File Inventories

### 15.1 Server Action Files (47)

<details>
<summary>Click to expand</summary>

- `modules/accounting/actions/aging.actions.ts`
- `modules/accounting/actions/analytics.actions.ts`
- `modules/accounting/actions/assets.actions.ts`
- `modules/accounting/actions/audit.actions.ts`
- `modules/accounting/actions/bsc.actions.ts`
- `modules/accounting/actions/budget.actions.ts`
- `modules/accounting/actions/closing.actions.ts`
- `modules/accounting/actions/coa.actions.ts`
- `modules/accounting/actions/export.actions.ts`
- `modules/accounting/actions/forecast.actions.ts`
- `modules/accounting/actions/journal.actions.ts`
- `modules/accounting/actions/price.actions.ts`
- `modules/accounting/actions/reimburse.actions.ts`
- `modules/accounting/actions/reports.actions.ts`
- `modules/accounting/actions/shariah.actions.ts`
- `modules/accounting/actions/tax.actions.ts`
- `modules/accounting/actions/zakat.actions.ts`
- `modules/ai/actions/vision.actions.ts`
- `modules/auth/actions/auth.actions.ts`
- `modules/cash/actions/bank.actions.ts`
- `modules/cash/actions/reconcile.actions.ts`
- `modules/contacts/actions/contact.actions.ts`
- `modules/demo/actions/demo.actions.ts`
- `modules/factory/actions/factory.actions.ts`
- `modules/fleet/actions/fleet.actions.ts`
- `modules/hris/actions/attendance.actions.ts`
- `modules/hris/actions/employee.actions.ts`
- `modules/hris/actions/expense.actions.ts`
- `modules/hris/actions/leave.actions.ts`
- `modules/hris/actions/payroll.actions.ts`
- `modules/hris/actions/self-service.actions.ts`
- `modules/inventory/actions/inventory.actions.ts`
- `modules/inventory/actions/warehouse.actions.ts`
- `modules/organization/actions/approval.actions.ts`
- `modules/organization/actions/audit.actions.ts`
- `modules/organization/actions/billing.actions.ts`
- `modules/organization/actions/hris.actions.ts`
- `modules/organization/actions/org-id.actions.ts`
- `modules/organization/actions/org.actions.ts`
- `modules/purchasing/actions/purchasing.actions.ts`
- `modules/saas/actions/operator-sales.actions.ts`
- `modules/saas/actions/ticketing.actions.ts`
- `modules/sales/actions/pos.actions.ts`
- `modules/sales/actions/sales-page.actions.ts`
- `modules/sales/actions/sales.actions.ts`
- `modules/services/actions/service.actions.ts`
- `modules/settings/actions/audit.actions.ts`

**Server library files:**
- `modules/ai/lib/ai-token.server.ts`
- `modules/ai/lib/ai-token.ts`
- `modules/factory/lib/unit-conversion.ts`
- `modules/organization/lib/active-context.server.ts`
- `modules/organization/lib/branch-access.server.ts`
- `modules/organization/lib/org-context.ts`
- `modules/sales/lib/sales-page.server.ts`
- `modules/sales/lib/sales-page.ts`

</details>

### 15.2 Page Routes (65)

<details>
<summary>Click to expand</summary>

**Root & Public:**
- `app/page.tsx`
- `app/onboarding/page.tsx`
- `app/demo/page.tsx`
- `app/abs/page.tsx`
- `app/sp/[orgSlug]/[pageSlug]/page.tsx`

**Auth (5):**
- `app/(auth)/login/page.tsx`
- `app/(auth)/register/page.tsx`
- `app/(auth)/forgot-password/page.tsx`
- `app/(auth)/update-password/page.tsx`
- `app/(auth)/join/[token]/page.tsx`

**Dashboard (55):**
- `app/(dashboard)/dashboard/page.tsx`
- `app/(dashboard)/profil-saya/page.tsx`
- `app/(dashboard)/billing/page.tsx`
- `app/(dashboard)/billing/invoice/[id]/page.tsx`
- `app/(dashboard)/pricing/page.tsx`
- `app/(dashboard)/admin/page.tsx`
- `app/(dashboard)/audit/page.tsx`
- `app/(dashboard)/cash/page.tsx`
- `app/(dashboard)/contacts/page.tsx`
- `app/(dashboard)/inventory/page.tsx`
- `app/(dashboard)/inventory/warehouses/page.tsx`
- `app/(dashboard)/inventory/warehouses/[id]/page.tsx`
- `app/(dashboard)/inventory/ledger/[id]/page.tsx`
- `app/(dashboard)/purchasing/page.tsx`
- `app/(dashboard)/factory/page.tsx`
- `app/(dashboard)/fleet/page.tsx`
- `app/(dashboard)/services/page.tsx`
- `app/(dashboard)/pos/page.tsx`
- `app/(dashboard)/sales/page.tsx`
- `app/(dashboard)/sales/quotations/page.tsx`
- `app/(dashboard)/sales/pipeline/page.tsx`
- `app/(dashboard)/sales/commission/page.tsx`
- `app/(dashboard)/sales/promos/page.tsx`
- `app/(dashboard)/sales/pages/page.tsx`
- `app/(dashboard)/hris/page.tsx`
- `app/(dashboard)/reports/page.tsx`
- `app/(dashboard)/reports/bsc/page.tsx`
- `app/(dashboard)/reports/pareto/page.tsx`
- `app/(dashboard)/accounting/aging/page.tsx`
- `app/(dashboard)/accounting/approvals/page.tsx`
- `app/(dashboard)/accounting/assets/page.tsx`
- `app/(dashboard)/accounting/audit/page.tsx`
- `app/(dashboard)/accounting/budgets/page.tsx`
- `app/(dashboard)/accounting/closing/page.tsx`
- `app/(dashboard)/accounting/forecast/page.tsx`
- `app/(dashboard)/accounting/journal/page.tsx`
- `app/(dashboard)/accounting/reimburse/page.tsx`
- `app/(dashboard)/accounting/tax/page.tsx`
- `app/(dashboard)/accounting/zakat/page.tsx`
- `app/(dashboard)/settings/accounts/page.tsx`
- `app/(dashboard)/settings/accounts/new/page.tsx`
- `app/(dashboard)/settings/accounts/[id]/page.tsx`
- `app/(dashboard)/settings/audit/page.tsx`
- `app/(dashboard)/settings/branches/page.tsx`
- `app/(dashboard)/settings/business/page.tsx`
- `app/(dashboard)/settings/roles/page.tsx`
- `app/(dashboard)/settings/sub-orgs/page.tsx`
- `app/(dashboard)/settings/users/page.tsx`
- `app/(dashboard)/settings/ticketing/page.tsx`
- `app/(dashboard)/settings/ticketing/doc-update/page.tsx`
- `app/(dashboard)/saas/page.tsx`
- `app/(dashboard)/saas/penawaran/page.tsx`
- `app/(dashboard)/saas/penjualan/page.tsx`
- `app/(dashboard)/saas/ticketing/page.tsx`
- `app/(dashboard)/saas/dokumen/[id]/page.tsx`

</details>

### 15.3 Client Components (46)

<details>
<summary>Click to expand</summary>

- `AgingClient.tsx`, `ApprovalClient.tsx`, `AssetClient.tsx`, `AuditClient.tsx` (accounting + settings)
- `BudgetClient.tsx`, `ClosingClient.tsx`, `ForecastClient.tsx`, `JournalClient.tsx`
- `ReimbursementClient.tsx`, `TaxClient.tsx`, `ZakatClient.tsx`
- `AuditTrailClient.tsx` (standalone audit)
- `CashClient.tsx`, `ContactClient.tsx`, `DashboardClient.tsx`
- `ManufacturingClient.tsx`, `FleetClient.tsx`, `HrisClient.tsx`
- `InventoryClient.tsx`, `StockLedgerClient.tsx`, `WarehouseDetailClient.tsx`, `WarehouseClient.tsx`
- `POSClient.tsx`, `ProfilSayaClient.tsx`, `PurchasingClient.tsx`
- `BSCClient.tsx`, `ParetoClient.tsx`, `ReportsClient.tsx`
- `SaasOperatorClient.tsx` (at `/saas/`), `SaasTicketingClient.tsx` (at `/saas/ticketing/`)
- `SaasDocumentView.tsx` embedded inside `app/(dashboard)/saas/dokumen/[id]/page.tsx`
- `CommissionClient.tsx`, `SalesPageStudioClient.tsx`, `PipelineClient.tsx`
- `PromoClient.tsx`, `QuotationClient.tsx`, `SalesClient.tsx`
- `ServiceOrderClient.tsx`
- `BranchManagementClient.tsx`, `BusinessClient.tsx`, `SubOrgClient.tsx`, `UsersClient.tsx`
- `TicketingClient.tsx`, `TicketingDocUpdateClient.tsx`
- `SaasTicketingClient.tsx`
- `AbsClient.tsx`, `DemoClient.tsx`

</details>

---

## 16. Changelog (Recent Updates)

### POS Shift Opening, EDU Realtime Sessions, and Railway Migration History Normalization (April 2026)

- **Migration history normalization for Railway / Supabase CLI compatibility:**
  - Duplicate migration versions dinormalisasi menjadi file unik:
    - `1199_syirkah_tables.sql`
    - `1226_edu_mode_sessions.sql`
    - `1231_fix_inventory_webhook_reversal_legacy_stock_movements.sql`
    - `1232_open_api_ip_allowlist.sql`
  - Placeholder yang tetap dipakai untuk menjaga kontinuitas histori remote:
    - `1227_remote_history_placeholder.sql`
    - `1228_remote_history_placeholder.sql`
  - Tujuan utamanya adalah menjaga kontinuitas `supabase_migrations.schema_migrations` ketika histori remote lebih dulu menyimpan versi yang file sumbernya sudah tidak ada di repo aktif.
  - Setelah normalisasi ini, histori lokal kembali satu arah dan tidak lagi bentrok pada versi `1223` sampai `1226`.

- **POS shift opening journal hardening:**
  - `1221_pos_shift_opening_funding.sql` menambahkan metadata `opening_source_account_id` dan `opening_journal_entry_id` pada `pos_shift_sessions`.
  - `1225_add_pos_shift_opening_reference_type.sql` menambahkan enum `POS_SHIFT_OPENING` ke `journal_reference_type`.
  - Ini memperbaiki kegagalan jurnal modal awal shift dengan error `invalid input value for enum journal_reference_type: "POS_SHIFT_OPENING"`.

- **Sales delivery journal idempotency hardening (`1220_harden_sales_delivery_journal_idempotency.sql`):**
  - Mencegah duplicate key mentah pada jurnal delivery `SALE`.
  - Auto-heal `sales.status = 'FINISHED'` ketika jurnal dan mutasi stok legacy memang sudah ada.
  - Menghasilkan error bisnis yang lebih jelas saat data lama belum sinkron penuh.

- **Open API hardening:**
  - `1222_open_api_idempotency.sql` menambahkan `api_idempotency_keys` agar retry POST dari integrasi eksternal tidak menggandakan transaksi.

- **EDU realtime session mode (`1226_edu_mode_sessions.sql`):**
  - Menambahkan `training_sessions`, `training_session_steps`, dan `training_progress_events`.
  - Struktur ini dipakai untuk mode latihan realtime, step validation per soal, heartbeat, pause/resume, dan event log pelatihan.

### BSC Configuration + Shariah CoA Cleanup (April 2026)

- **Migration `1151_remove_shariah_equity_from_coas.sql`:**
  - `inject_shariah_coa` tidak lagi create/activate akun `3100 Ekuitas Syariah`.
  - Akun Syirkah `3110` dan `3120` dipertahankan aktif di bawah parent `3000`.
  - Backfill membersihkan akun `3100` legacy: delete jika tidak direferensikan, fallback deactivate jika masih terikat FK.
- **Migration `1152_bsc_configuration_and_scoring.sql`:**
  - Added BSC configuration model per org + scope branch + cycle:
    - `bsc_cycles`
    - `bsc_perspective_weights`
    - `bsc_kpis`
    - `bsc_kpi_measurements`
  - Added scoring helper functions:
    - `bsc_calculate_achievement_percent(...)`
    - `bsc_score_100_from_achievement(...)`
    - `bsc_score_4_from_score_100(...)`
  - Added trigger `trg_fill_bsc_measurement_scores` (`fill_bsc_measurement_scores`) for automatic score computation.
  - Added view `v_bsc_latest_kpi_measurements` to fetch latest measurement per KPI.
  - Added RLS policies for strategy/report readers and strategy writers.

### Organization Onboarding Bootstrap Hardening (April 2026)

- **Issue:** pembuatan organisasi gagal dengan pesan `Unit Utama organisasi <id> belum tersedia.` ketika trigger seed akun berjalan sebelum branch default tersedia.
- **DB fixes shipped:**
  - `1148_fix_coa_seed_requires_default_branch.sql`
  - `1149_bootstrap_main_branch_before_org_account_seeds.sql`
  - `1150_rebind_accounts_governance_with_branch_ensure.sql`
- **App-layer hardening (`modules/organization/actions/org.actions.ts`):**
  - Create org payload menandai `skip_coa_seed: true`, lalu melakukan seed CoA ulang setelah branch default siap.
  - Fallback branch bootstrap: jika insert `MAIN` branch duplicate (`23505`), action re-use branch existing dan lanjutkan flow.
  - Fallback admin client: jika `createAdminClient()` unavailable (mis. env `SUPABASE_SERVICE_ROLE_KEY` belum lengkap), flow tetap lanjut via session client.
  - Error mapping onboarding diperjelas untuk mempercepat diagnosis migration/schema mismatch.
- **Operational note:** Pastikan SQL dijalankan pada project Supabase yang sama dengan `NEXT_PUBLIC_SUPABASE_URL`; mismatch project dapat menghasilkan false diagnosis seperti `relation public.accounts does not exist`.

### Finance Governance + Cash/Bank Consolidation Updates (April 2026)

- **Zakat scope fix (Perdagangan only):**
  - Updated `modules/accounting/actions/zakat.actions.ts` and `app/(dashboard)/accounting/zakat/ZakatClient.tsx` so zakat perdagangan hanya dihitung untuk aktivitas perdagangan/persediaan.
  - Aktivitas layanan jasa/labour tidak lagi diperlakukan sebagai objek zakat perdagangan.
  - Added test coverage update in `__tests__/zakat.actions.test.ts` untuk memastikan service-only flow tidak memunculkan zakat perdagangan.

- **CoA parent-child synchronization hardening:**
  - Parent CoA sekarang disinkronkan ke child agar struktur akun konsisten antara parent dan anak/cabang.
  - Update parent pada account master otomatis dipropagasi ke descendant org melalui sinkronisasi by account code, termasuk parent account mapping.
  - Child membuka halaman CoA akan menarik pembaruan parent terbaru sebelum render daftar akun.

- **Runtime fix for CoA permission RPC call:**
  - Fixed runtime error `Cannot read properties of undefined (reading 'rest')` pada `checkCanManageCoA`.
  - Root cause: kehilangan konteks method pada destructuring `rpc`.
  - Fix: panggil RPC langsung melalui `(supabase as any).rpc(...)` agar context client tetap valid.

- **Bank account visibility from parent across entities:**
  - Parent dashboard kas kini menampilkan rekening bank lintas konsolidasi (parent + child/cabang) menggunakan `get_consolidated_org_ids`.
  - Rekening lintas entitas diberi label org/cabang untuk visibilitas transfer modal.

- **Inter-organization capital transfer (Parent → Child/Cabang):**
  - Added migration `1143_interorg_capital_transfer.sql` dengan RPC baru `create_interorg_capital_transfer(...)` (`SECURITY DEFINER`):
    - Validasi otorisasi parent via `can_manage_finance_master`.
    - Validasi target berada dalam tree konsolidasi parent (`is_org_in_consolidation_tree`).
    - Validasi rekening sumber/tujuan dan akun lawan per entitas.
    - Posting atomik dua sisi: `OUT` di parent + `IN` di entitas tujuan, keduanya `POSTED` agar auto-journal tetap berjalan.
  - Added server action `createInterOrgCapitalTransfer` di `modules/cash/actions/bank.actions.ts`.
  - Updated `CashClient` transfer modal:
    - Parent dapat memilih rekening target lintas entitas.
    - Jika target beda org, UI meminta dua akun lawan (sisi sumber dan sisi tujuan) dan memanggil RPC inter-org.
    - Jika target satu org, flow transfer internal lama tetap dipakai.
    - Added **available cash indicator** di field `Total Amount` untuk transaksi `OUT/TRANSFER`:
      - Menampilkan saldo kas/bank tersedia dari rekening sumber.
      - Menampilkan warning jika nominal melebihi saldo tersedia.
      - Tombol submit otomatis disabled saat nominal melampaui available kas.
  - Added/updated test coverage di `__tests__/bank.actions.test.ts` untuk RPC transfer modal antar entitas.

### HRIS Child-to-Child Employee Mutation + Branch PIC Workflow (April 2026)

- Fixed runtime error `ReferenceError: branches is not defined` di HRIS modal employee dengan alias prop aman (`branches: branchOptions`) pada `HrisClient`.
- Added branch PIC assignment workflow langsung dari form employee:
  - Multi-select cabang yang dikelola karyawan (`managed_branches` payload).
  - `createEmployee`/`updateEmployee` kini sinkronisasi `branches.pic_employee_id` sesuai pilihan terbaru.
- Added server actions baru di `modules/hris/actions/employee.actions.ts`:
  - `transferEmployeeToChildOrg(orgId, payload)` untuk mutasi karyawan lintas child dalam holding yang sama.
  - `getEmployeeTransferHistory(orgId)` untuk membaca 20 log mutasi terbaru.
- Mutasi workflow (`transferEmployeeToChildOrg`) mencakup:
  - Validasi akses owner/admin pada child asal **dan** membership owner/admin pada holding.
  - Validasi child tujuan aktif, masih satu holding, cabang tujuan valid, dan anti-duplikasi NIK.
  - Clone profil employee ke child tujuan.
  - Menandai employee asal sebagai `RESIGNED` + set `end_date`.
  - Melepas PIC cabang lama (`pic_employee_id = null`) dan opsi set PIC cabang tujuan.
  - Upsert `org_members` tujuan untuk user yang sudah terhubung (`employees.user_id`) agar akun tetap bisa akses child baru.
  - Menulis audit trail ke `audit_logs` pada org asal dan tujuan dengan `table_name = 'EMPLOYEE_CHILD_TRANSFER'`.
- Updated `app/(dashboard)/hris/page.tsx`:
  - Menyediakan `transferTargets` otomatis dari org membership user (child lain dalam holding yang sama, role owner/admin, dan punya cabang aktif).
  - Memuat `initialTransferHistory` via `getEmployeeTransferHistory`.
- Updated `app/(dashboard)/hris/HrisClient.tsx`:
  - Tombol mutasi (`ArrowRightLeft`) pada card employee.
  - Modal wizard mutasi (pilih child, cabang, opsi assign PIC target, catatan mutasi).
  - Panel “Riwayat Mutasi Antar Child” di tab Employees.
  - Toast/refresh integration dan optimistic append ke history lokal.

> Catatan: fitur ini memanfaatkan tabel existing (`audit_logs`, `employees`, `branches`, `org_members`, `organizations`) dan **tidak memerlukan migration baru**.

### CoA & Bank Account Governance — Child/Branch Request Workflow (April 2026)

Mengimplementasikan sistem pengendalian hierarki rekening keuangan: hanya Parent/Holding yang boleh membuat rekening CoA dan rekening bank secara langsung. Child org dan Branch wajib mengajukan request.

**Masalah yang diselesaikan:** Child org bisa menambah rekening CoA dan rekening bank langsung tanpa approval dari Parent/Holding.

**Migrasi baru:**

- `1137_coa_account_request_workflow.sql` — tabel `coa_account_requests`, enum `coa_request_status` (`pending`/`approved`/`rejected`/`cancelled`), 4 RPC (submit/approve/reject/cancel), view `coa_request_summary`, trigger `enforce_coa_request_governance`, dan RLS policies.
- `1138_fix_coa_governance_functions.sql` — repair idempotent: menambah kolom `parent_org_id` (organizations) dan `managed_branch_id` (accounts) jika belum ada, backfill data, lalu CREATE OR REPLACE `is_main_organization()` dan `can_manage_finance_master()` yang gagal dibuat di migration 1126.

**3 Lapis Proteksi (CoA & Bank Account):**

| Layer | Lokasi | Mekanisme |
|---|---|---|
| **1. UI** | `accounts/page.tsx`, `CashClient.tsx` | Child/Branch hanya melihat tombol "Ajukan Rekening" yang redirect ke `/accounting/coa-requests` |
| **2. Server Action** | `coa.actions.ts → createAccount()`, `bank.actions.ts → createBankAccount()` | `checkCanManageCoA()` → `can_manage_finance_master()` RPC → return `{ error, requiresRequest: true }` |
| **3. Database** | Trigger `enforce_accounts_governance` | `can_manage_finance_master()` dipanggil level PostgreSQL → `RAISE EXCEPTION` |

**Route guard baru:**
`app/(dashboard)/settings/accounts/new/page.tsx` dikonversi dari pure client component menjadi **server component** dengan redirect:
```ts
if (!canManageDirect) redirect('/accounting/coa-requests')
```
Form dipindahkan ke `NewAccountForm.tsx` (client component terpisah).

**Halaman baru:**
- `/accounting/coa-requests` — CoA request dashboard: Parent melihat semua pending request (approve/reject), Child/Branch melihat form pengajuan + riwayat request mereka.
- `CoaRequestClient.tsx` — komponen UI untuk kedua tampilan (view berbeda tergantung `isParentOrg`).

**Alur governance:**
```
Child/Branch → Ajukan request di /accounting/coa-requests
    ↓
Parent/Holding menerima notifikasi (list "Permintaan Masuk")
    ↓
Parent Approve → akun otomatis dibuat via approve_coa_request() RPC
Parent Reject  → request ditolak dengan catatan alasan wajib
```

**Database functions:**
- `is_main_organization(p_org_id UUID)` — TRUE jika org tidak punya `parent_org_id` (Holding/Root).
- `can_manage_finance_master(p_org_id UUID)` — TRUE jika user adalah member aktif di Main Org dengan role owner/admin (atau permission `coa:write`/`accounting:write`) DAN sedang berada di konteks Main Branch.

### Sub-Org PIC Assignment Fix (April 2026)

Memperbaiki bug di mana dropdown PIC Direktur/Manager pada halaman Anak Perusahaan (`/settings/sub-orgs`) kosong atau tidak berfungsi.

**Root cause — 3 bug:**

1. **RLS Branch memotong daftar karyawan:** `getEmployees(orgId, null)` menggunakan `createClient()` yang terikat sesi user + `resolveAccessibleBranchSelection`. Jika user sedang pada context branch tertentu (bukan "semua cabang"), fungsi ini memfilter karyawan hanya dari branch tersebut — sehingga dropdown PIC kosong atau tidak lengkap.
2. **Props `canMutate` & `picFeatureEnabled` tidak diterima client:** Interface `Props` di `SubOrgClient.tsx` tidak mendefinisikan kedua props tersebut padahal `page.tsx` sudah mengirimkan — menyebabkan feature flag tidak terbaca.
3. **Tidak ada loading/feedback saat assign PIC:** Tidak ada state loading per-card sehingga user tidak mendapat respons visual dan bisa klik berkali-kali.

**Perbaikan:**

- Added `getHoldingEmployees(orgId)` di `modules/organization/actions/org.actions.ts` — menggunakan `createAdminClient()` untuk mengambil **semua karyawan holding** melewati RLS branch, mengembalikan `id, first_name, last_name, job_title, branch_id`.
- Updated `app/(dashboard)/settings/sub-orgs/page.tsx`: ganti `getEmployees` → `getHoldingEmployees`.
- Updated `app/(dashboard)/settings/sub-orgs/SubOrgClient.tsx`:
  - Tambahkan `canMutate` dan `picFeatureEnabled` ke interface `Props` (dengan default aman).
  - Tambahkan `assigningPICChildId` state (loading spinner per-card) untuk mencegah double-click.
  - Tambahkan `localManagerMap` state untuk **optimistic update** — selector langsung berubah tanpa `window.location.reload()`.
  - Guard tombol Hapus dengan `canMutate` (hanya owner).
  - Tampilkan badge nama manager yang sudah dipilih (green badge) di atas dropdown.
  - Tampilkan pesan informatif jika karyawan kosong atau fitur belum aktif (migrasi 1128 belum jalan).

### Cash & Bank Branch Context + Multi-Unit RLS Hardening (April 2026)

- Added migration `1106_cash_bank_branch_context.sql`: bank accounts dan bank transactions kini branch-aware; jurnal kas yang di-auto-post membawa `branch_id` yang benar.
- Added migration `1109_multi_org_multi_unit_hardening.sql`: memperketat bootstrap membership org, membatasi visibilitas roster, dan menyelaraskan hak manajemen cabang.
- Added migration `1111_core_multi_unit_rls_hardening.sql`: enforce branch-aware RLS pada tabel transaksional inti; backfill default branch untuk data legacy.

### Active Context Preference Persistence (April 2026)

- Added migration `1112_active_context_preferences.sql` untuk tabel `org_member_context` menyimpan preferensi last-active org dan branch per keanggotaan di database.
- Updated `modules/organization/lib/active-context.server.ts` untuk membaca dan menulis preferensi ini, sehingga context user bertahan setelah logout dan di device baru.
- `getActiveOrg()` kini membaca `org_member_context` sebelum fallback ke membership pertama.

### Sales Delivery Inventory Sync + RLS Fix (April 2026)

- Added migration `1105_fix_sales_delivery_atomic_rls.sql`: `process_sales_delivery_atomic` diubah ke `SECURITY DEFINER` agar insert jurnal melewati RLS dengan benar.
- Added migration `1107_orphan_journal_cleanup.sql`: membersihkan baris jurnal legacy yang tidak lagi milik org mana pun.
- Added migration `1108_sales_delivery_inventory_sync.sql`: menyimpan warehouse sumber pada dokumen penjualan; memperbaiki stok fisik yang tidak berkurang saat pengiriman.
- Added migration `1113_restore_bank_transfer_reference_type.sql`: mengembalikan label reference type transfer bank yang benar (`bank_transfer`, bukan `cash_out`).

### Legacy Consolidation & Helper Normalization (April 2026)

- Added migration `1110_legacy_helper_objects.sql`: menormalisasi helper migration yang sebelumnya menggunakan nama file tidak valid dan dilewati Supabase CLI.

### Sub Organization Manager Assignment (April 2026)

- Added migration `1128_sub_org_enhancements.sql` to add `organizations.manager_employee_id` (FK to `employees`) and supporting index for better assignment query performance.
- Updated Sub-Org management UI (`app/(dashboard)/settings/sub-orgs/SubOrgClient.tsx`) with PIC Direktur/Manager selector per child organization.
- Added action-path integration for manager assignment (`assignSubOrgManager`) to persist and update child org PIC directly from the settings page.

### Holding & Organization Consolidation (April 2026)

- Added feature for multi-unit holding consolidation allowing parent organizations to fetch financial reporting aggregated across their child organizations.
- Added database migration `1127_organization_consolidation_foundation.sql` introducing `get_consolidated_org_ids()` RPC (recursive CTE traversal) and helper `is_org_in_consolidation_tree()` for membership checks.
- Core accounting server actions (`getBalanceSheet`, `getProfitLoss`, `getCashFlow`) now accept a `consolidated` boolean parameter. When enabled, transactions from all descendant organizations are queried and aggregated.
- Changed account balance aggregation in `reports.actions.ts` to group by `account_code` rather than `account_id`, allowing standardized Cross-Org Chart of Accounts to be correctly summed up.
- Upgraded `getPostedEntryIds` to automatically map out child org branch IDs using the recursive RPC when requested.
- Created UI for Child Organizations at `app/(dashboard)/settings/sub-orgs/SubOrgClient.tsx` allowing Owners and Admins to register child units directly.
- Added "Mode Holding (Gabungan)" toggle in `app/(dashboard)/reports/ReportsClient.tsx` for easy one-click switching between single entity and consolidated views.

### Business Settings Document Format Panel Restore (April 2026)

- Updated `app/(dashboard)/settings/business/BusinessClient.tsx` to restore editable format fields in UI for:
  - `emp_format` (prefix/pola NIK karyawan)
  - `po_format`, `so_format`, and `inv_format` (format kode dokumen bisnis)
- Added helper note in UI for supported placeholders: `{YYYY}`, `{YY}`, `{MM}`, `{DD}`, and numeric token like `{0000}`.

### HRIS Employee Card Delete Action (April 2026)

- Added `deleteEmployee` server action in `modules/hris/actions/employee.actions.ts` with branch-scope access guard (`ensureEmployeeBranchAccess`) before delete execution.
- Added delete button (`Trash`) on each employee card in `app/(dashboard)/hris/HrisClient.tsx` with confirmation dialog and toast feedback.
- Added unit test `deletes employee only inside accessible branch` in `__tests__/employee.actions.test.ts`.

### HRIS Employee `department_id` Compatibility Fix (April 2026)

- Added migration `1125_hris_department_id_schema_repair.sql` to ensure enum `nizam_department` and kolom `employees.department_id` tersedia secara idempotent di environment legacy.
- Updated `modules/hris/actions/employee.actions.ts` with fallback write retry: jika backend mengembalikan error schema cache untuk `department_id`, create/update employee otomatis retry tanpa field tersebut agar proses simpan tetap berhasil.
- Added tests in `__tests__/employee.actions.test.ts` untuk memastikan fallback create/update berjalan pada schema lama.

### Aging AR/AP Source Traceability (April 2026)

- Updated `modules/accounting/actions/aging.actions.ts` untuk menambahkan metadata sumber pada baris aging (`source_label`, `source_account_code`, `doc_href`) termasuk sumber syariah `1404` (Piutang Salam Vendor) dan `2602` (Hutang Salam).
- Updated `AgingClient.tsx`: nomor dokumen SO/PO sekarang clickable ke halaman detail transaksi, dan tabel menampilkan kolom sumber AR/AP agar asal saldo lebih mudah ditelusuri.
- Updated `AgingClient.tsx` summary cards: nominal `Piutang Salam (1404)` dan `Hutang Salam (2602)` sekarang tampil eksplisit di kartu AR/AP bagian atas.
- Perhitungan kartu summary SALAM sekarang membaca seluruh baris bersumber akun `1404`/`2602` (termasuk baris rekonsiliasi GL), bukan hanya baris modul transaksi.
- Updated aging reconciliation rows agar penyesuaian GL terpisah per akun utama (`1201`, `1404`, `2101`, `2602`) sehingga sumber outstanding dari modul vs buku besar lebih transparan.
- Hardened SALAM detection di aging agar tidak case-sensitive (`SALAM`/`salam`) dan tetap membaca dokumen legacy dengan `branch_id IS NULL` saat user sedang berada pada context cabang aktif.
- Fixed compatibility bug: environment lama tanpa kolom `branch_id` di `purchase_payments`/`purchase_returns` kini tetap menghitung saldo SALAM dengan benar (tanpa memfilter branch di tabel child tersebut).

### Purchase SALAM Due-Date Guard (April 2026)

- Added migration `1124_purchase_salam_due_date_guard.sql`.
- Updated `process_purchase_atomic` to reject SALAM PO creation without `p_due_date`.
- Updated Purchasing UI and server action guard: akad SALAM sekarang wajib mengisi tanggal barang disediakan pada saat create PO.

### Purchase SALAM Receivable Enforcement (April 2026)

- Added migration `1123_purchase_salam_receivable_enforcement.sql`.
- Added helper RPC `ensure_salam_vendor_receivable_account` untuk memastikan akun syariah `1404 - Piutang Salam Vendor` tersedia di CoA.
- Updated `process_purchase_payment_atomic`: pembayaran pembelian mode SALAM mendebit `Piutang Salam Vendor (1404)` (bukan `Hutang Usaha 2101`) dan wajib lunas penuh.
- Updated purchasing receive guard: penerimaan barang akad SALAM ditolak jika `payment_status` belum `PAID`.
- Updated purchasing GL sync: saat barang SALAM diterima, kredit jurnal menggunakan `Piutang Salam Vendor (1404)` untuk reklasifikasi menjadi persediaan.
- Updated Purchasing UI: mode SALAM memaksa termin `LUNAS`, pembayaran bisa dilakukan pada status `ORDERED`, dan payment modal membatasi pelunasan penuh.
- Updated syariah CoA inject/toggle di action layer agar akun `1404` ikut disiapkan dan dikelola bersama akun syariah lain.

### SALAM Enforcement + Liability Account (April 2026)

- Added migration `1122_salam_enforcement_and_liability_account.sql`.
- Added helper RPC `ensure_salam_liability_account` to ensure akun syariah `2602 - Hutang Salam` tersedia di CoA.
- Updated `process_sales_payment_atomic`: transaksi SALAM wajib lunas penuh dan credit diposting ke `Hutang Salam (2602)` (bukan `Piutang 1201`).
- Updated `process_sales_delivery_atomic`: delivery SALAM ditolak bila belum `PAID`; saat delivery akun debit menggunakan `Hutang Salam` untuk reklasifikasi kewajiban menjadi pendapatan.
- Updated Sales UI/backend guard: mode SALAM memaksa metode bayar `LUNAS`, jatuh tempo tetap wajib diisi untuk target pengiriman, serta validasi stok pecahan tetap tampil (`0.n`) pada area stok.
- Hardened sales order creation: invoice non-SALAM langsung ditolak jika stok unit tidak mencukupi, dengan prompt untuk beralih ke akad SALAM agar pesanan tetap tercatat tanpa mengurangi stok saat input invoice.

### Sales Void RPC Access + Non-SALAM Stock Guard (April 2026)

- Added migration `1121_sales_void_rpc_and_stock_guard.sql`.
- Added compatibility wrapper for legacy `void_sale_atomic` signature order so old/new call shapes remain executable.
- Granted `authenticated` execute access to available `void_sale_atomic` and `void_purchase_atomic` function variants.
- Added trigger function `guard_sales_non_salam_stock_after_delivery` to block non-SALAM delivery from ending with negative stock.
- Hardened server actions (`deliverSale`, `processPosTransaction`) with pre-delivery stock validation and clear oversell error messaging.
- Expanded tests for stock guard + atomic/fallback void sales path (`sales.actions.test.ts`).

### Inventory Account Segmentation Consistency (April 2026)

- Added migration `1120_inventory_account_segmentation_consistency.sql`.
- Added account segmentation bootstrap for inventory assets: `1302` (WIP), `1303` (bahan baku), `1304` (barang jadi), including trigger on org creation + backfill for existing orgs.
- Added `resolve_inventory_asset_account` to pick inventory account per product/segment, replacing hardcoded posting assumptions on `1301`.
- Updated atomic flows (`process_sales_delivery_atomic`, `process_sales_return_atomic`, `process_purchase_return_atomic`) to post inventory journal lines by resolved product account.
- Expanded audit/reconciliation layer from single account `1301` to inventory block `1301`–`1399`.
- Balance sheet server/client now supports parent-child account hierarchy (`parent_id`) and can render structured rows in report UI.

### Inventory Stock Compatibility & WMS Index Repair (April 2026)

- Added migration `1118_adjust_inventory_stock_signature_compat.sql` to keep both 4-arg and 6-arg `adjust_inventory_stock` signatures available.
- Added migration `1119_inventory_stocks_wms_unique_index_repair.sql`.
- Migration `1119` merges duplicate stock rows first, then enforces normalized WMS unique index (`product_id + warehouse_id + coalesce(batch_number) + coalesce(bin_id)`).
- Purchasing receive flow now has compatibility fallback when RPC signature/index/schema cache is not ready yet, including direct stock sync fallback path.

### Factory UoM Conversion + Stock Sync (April 2026)

- Added migration `1117_factory_uom_conversion_and_stock_sync.sql`.
- Added DB helpers to normalize/convert units (`Kg ↔ Gram`, `Liter ↔ Ml`, `Meter ↔ Cm`, `Pcs ↔ Unit`).
- Hardened `process_work_order_completion` and `process_work_order_completion_v2` so BoM quantity always converted into product base unit before stock valuation and journal posting.
- Added physical stock sync for raw material consumption in production completion flow using `adjust_inventory_stock`, so `stock_movements` and `inventory_stocks` stay aligned.
- Improved BoM persistence in server action layer to normalize item quantity into the product base unit before insert/update.

### Inventory-Sales-Purchase Consistency Guard (April 2026)

- Added migration `1116_inventory_sales_purchase_consistency_guard.sql`.
- Hardened atomic void for sales (`void_sale_atomic`) so journal, stock movements, and physical stock stay synchronized.
- Updated server action `voidSale` to call `void_sale_atomic` directly (single atomic source of truth).
- Hardened atomic void for purchases (`void_purchase_atomic`) with inventory rollback.
- Upgraded `process_purchase_return_atomic` to always sync `inventory_stocks` via `adjust_inventory_stock`.
- Added idempotency guard in purchase receiving flow to prevent duplicate stock posting when previous attempts partially succeeded.

### UX & Test Coverage Updates (April 2026)

- Warehouse creation flow now redirects to warehouse detail with `?createBin=1` and auto-opens create-bin modal for faster onboarding.
- Manufacturing UI uses shared unit-conversion helper for raw-material requirement simulation and costing preview.
- Added/expanded tests for:
  - BoM unit normalization before persistence (`factory.actions.test.ts`)
  - Purchasing fallback paths (`adjust_inventory_stock` signature/index mismatch, schema-cache warehouse column miss)
  - Purchasing idempotency behavior on duplicate stock movement attempts
  - Sales void atomic RPC behavior (`sales.actions.test.ts`)

### Config Navigation: Ticketing Menu (April 2026)

- Added new sidebar item `Ticketing` under the `Config` group.
- Added route `/settings/ticketing` with active bug-report form.
- Added fields to capture bug context: `menu/lokasi ditemukan`, `kapan ditemukan`, dan `pada saat apa bug terjadi`.
- Added screenshot upload support from the ticket form (stored in Supabase Storage).
- Added route `/settings/ticketing/doc-update` for user-facing progress feed.
- Added route `/saas/ticketing` for operator progress management and publication control.
- Added migration `1114_support_ticketing.sql` for `support_tickets` table + RLS.
- Added migration `1115_support_ticket_updates_doc_update.sql` for progress timeline + public doc update.
- Fixed runtime error in `/saas/ticketing` form submit by preserving HTML form reference before async transition.
- Added mobile/tablet/iPad pull-to-refresh interaction in dashboard layout to support PWA usage on touch devices.

### Branch Context Expansion (April 2026)

Major initiative to add branch-level scoping across all business modules:

- **1087–1089:** Purchasing + Inventory branch context with backfill
- **1090:** Default branch bootstrap for existing orgs
- **1091:** Sales, approval, and delivery branch context
- **1092:** Reimbursement branch context
- **1093:** Org member branch ACL (`allowed_branch_ids`)
- **1094:** Services and fleet branch context
- **1095–1098:** HRIS, expense, payroll, leave, attendance branch context
- **1099–1100:** Legacy scope fix and leave approval backfill
- **1101:** Factory/manufacturing branch context
- **1102:** Fixed assets branch context
- **1103:** Budget branch context
- **1104:** Journal single-branch backfill

### SaaS Operator Module (March 2026)

- Dedicated routes `/saas/*` for platform operators
- Quotation + sales pipeline without needing `/admin`
- Document view with pricing breakdown (add-ons, tokens, entity/branch, discount/tax)
- Editable anchor/actual pricing per add-on

### AI Token Economy (March 2026)

- Token wallet per tenant, usage logging
- Token topup packages and orders
- AI balance badge in header
- Token debit on Sales Page AI generation

### Sales Page Builder (March 2026)

- Template-based landing page generator
- AI enrichment via Gemini
- Public rendering at `/sp/[orgSlug]/[pageSlug]`
- Lead capture → CRM pipeline integration
- Supabase Realtime for live lead notifications

### Self-Service HRIS Expansion (Late March–April 2026)

- Employee self-service portal
- Attendance, leave management
- Expense claims
- Branch-aware HRIS operations

### HRIS Multi-PIC Assignment (April 2026)

- Employee form HRIS sekarang mendukung penugasan PIC ke banyak cabang sekaligus (`managed_branches`) dan banyak anak perusahaan sekaligus (`managed_child_orgs`).
- Action `createEmployee` dan `updateEmployee` melakukan sinkronisasi assignment:
  - `branches.pic_employee_id` untuk PIC cabang multi-select.
  - `organizations.manager_employee_id` untuk PIC Direktur/Manager multi anak perusahaan (scope holding aktif).
- Saat karyawan `RESIGNED` atau dimutasi antar entitas holding, assignment PIC anak perusahaan dilepas otomatis agar tidak meninggalkan referensi stale.
- Ditambahkan fallback kompatibilitas schema lama: jika kolom `manager_employee_id` belum tersedia, proses simpan employee tetap berjalan.
- UI HRIS (`/hris`) menampilkan blok baru “Penugasan PIC Anak Perusahaan (Opsional)” pada modal create/edit karyawan.
- Added test coverage di `__tests__/employee.actions.test.ts` untuk memastikan sinkronisasi multi anak perusahaan berjalan konsisten.

---

*This document is auto-maintained. When the codebase changes significantly, re-run the analysis to keep it current.*
