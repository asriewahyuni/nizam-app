# NIZAM ERP — Comprehensive Codebase Documentation

> **Last updated:** 3 April 2026 — generated from direct repository audit.

---

## 1. Executive Summary

NIZAM ERP is a **multi-tenant cloud ERP** built on **Next.js App Router** and **Supabase (PostgreSQL)**. It consolidates accounting, cash & bank, inventory/WMS, purchasing, sales, POS, CRM, HRIS & payroll, fixed assets, budgeting, tax, zakat (Islamic finance), approval workflows, audit trails, manufacturing, fleet management, service orders, SaaS billing, AI token economy, and a sales page builder — all within a single monorepo.

### Codebase Snapshot

| Metric | Value |
|---|---|
| Page routes (`page.tsx`) | **61** |
| Client components (`*Client.tsx`) | **42** |
| Server action files | **52** |
| Migration SQL files | **153** (latest: `1104`) |
| Test files | **30** |
| API route handlers | **2** (`/api/export`, `/api/sales-pages/lead`) |
| Proxy (middleware) | `proxy.ts` |

---

## 2. Technology Stack

| Layer | Implementation |
|---|---|
| Framework | Next.js **16.2.1** (App Router) |
| UI Runtime | React **19.2.4** |
| Rendering | Server Components + Client Components + Server Actions |
| Request Interception | `proxy.ts` (Next.js 16 Proxy convention) |
| Database | Supabase / PostgreSQL with RLS |
| Auth | Supabase Auth (email/password, NIK/password for staff) |
| Security | RLS + org isolation + role/module gating + branch-level ACL |
| Styling | Tailwind CSS **4.2.2** + custom design tokens + Framer Motion |
| UI Components | Custom `NizamUI` component library + Radix UI primitives |
| Charts | Recharts |
| XLSX Export | ExcelJS |
| OCR / AI | Google Gemini via `@google/generative-ai` |
| Email | Resend |
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
│   └── ui/              # Reusable UI primitives (NizamUI, CurrencyInput, etc.)
├── lib/
│   ├── email/           # Email sender (Resend)
│   ├── hooks/           # Client hooks (useActiveOrgId)
│   ├── saas/            # SaaS module catalog, pricing, platform admin
│   ├── supabase/        # Supabase clients (server, client, middleware, config)
│   └── utils.ts         # cn(), formatRupiah(), formatDate(), generateSlug(), etc.
├── modules/             # Domain business logic (server actions + lib)
│   ├── accounting/      # 17 action files
│   ├── ai/              # Vision OCR + AI token wallet
│   ├── auth/            # Authentication actions
│   ├── cash/            # Bank + reconciliation
│   ├── contacts/        # CRM contacts
│   ├── demo/            # Demo seeding
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
├── __tests__/           # Vitest test suites (30 files)
├── supabase/
│   └── migrations/      # 153 SQL migration files
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
| `lib/supabase/config.ts` | Centralized Supabase connection config (remote/local switch) |
| `lib/supabase/server.ts` | Server-side Supabase client (`createClient`, `createAdminClient`) |
| `lib/supabase/client.ts` | Browser-side Supabase client |
| `next.config.mjs` | Build config: `standalone` output, TypeScript errors ignored |

---

## 4. Architecture

### 4.1 Routing Model

NIZAM uses the **App Router** with route groups:

- **`(auth)`** — login, register, join invitation, forgot/update password
- **`(dashboard)`** — all authenticated business modules (20 subdirectories)
- **Public routes** — `/`, `/demo`, `/abs`, `/onboarding`, `/sp/[orgSlug]/[pageSlug]`
- **API routes** — `/api/export`, `/api/sales-pages/lead`

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

### 4.7 Supabase Client Usage

| Context | Import | Function |
|---|---|---|
| Server Components, Server Actions | `lib/supabase/server.ts` | `createClient()` |
| Admin operations (password reset, etc.) | `lib/supabase/server.ts` | `createAdminClient()` |
| Client Components | `lib/supabase/client.ts` | `createClient()` |
| Middleware | `lib/supabase/middleware.ts` | `createServerClient()` inline |

**Config switching:** `lib/supabase/config.ts` reads `NEXT_PUBLIC_SUPABASE_TARGET`:
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
| Password reset (owner) | `sendPasswordResetEmail(formData)` | Via Supabase email |
| Password reset (staff) | `requestPasswordReset(nik)` → `resetEmployeePassword(...)` | HR-initiated |

### 5.3 Active Organization Resolution

`getActiveOrg()` does:
1. Read session user
2. Support demo mode via `nizam_demo_org_id` cookie
3. Get earliest active membership
4. Resolve plan + enabled modules from `saas_packages`
5. Merge `active_addons`
6. Fetch `job_title` from `employees` table
7. Return org context with `orgId`, `role`, `enabledModules`, `permissions`, etc.

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
| `/settings/audit` | Admin audit trail |
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
| `/saas/dokumen/[id]` | SaaS quotation/invoice document view |

---

## 7. Business Modules Detail

### 7.1 Organization & SaaS Core

**Actions:** `modules/organization/actions/` (6 files) + `modules/organization/lib/` (2 files)

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
- BSC metrics

### 7.3 Cash & Bank

**Actions:** `modules/cash/actions/` (2 files)

- CRUD bank accounts
- Cash/bank transactions with linked journal entries
- CSV bank statement upload & parse
- Unmatched mutation listing
- Delete transaction with automatic journal void

### 7.4 Inventory & WMS

**Actions:** `modules/inventory/actions/` (2 files)

- Product master with categories and barcode
- Stock calculation from `stock_movements`
- Stock adjustments, write-offs, inter-warehouse transfers
- Warehouse and warehouse bin management
- Stock ledger per product
- Branch-aware inventory (since migration `1088`)

### 7.5 Purchasing

**Actions:** `modules/purchasing/actions/` (1 file)

- PO creation with landed cost allocation
- Auto-create/update products from PO lines
- Receive purchase with stock + GL sync (atomic RPC)
- Void purchase via atomic RPC
- Purchase payments and returns
- Purchase requests (internal/manufacturing)
- Branch-aware purchasing (since migration `1087`)

### 7.6 Sales, Quotation & POS

**Actions:** `modules/sales/actions/` (3 files) + `modules/sales/lib/` (2 files)

- Sales orders with approval workflow
- Delivery via atomic RPC, void with stock/journal revert
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
- Branch-aware HR (since migrations `1095`–`1098`)

### 7.9 Manufacturing

**Actions:** `modules/factory/actions/` (1 file)

- Bill of Materials (BoM) headers and items
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
- Requires `RESEND_API_KEY` (no fallback)

### 7.14 SaaS Operator

**Actions:** `modules/saas/actions/` (1 file)

- Cross-tenant snapshot (org/package/invoice data)
- SaaS quotation creation with full pricing breakdown (add-ons, tokens, entity/branch pricing, discount, tax)
- Quotation → sale conversion
- Sale payment + plan activation
- Invoice document detail with fallback for schema versions
- Editable anchor/actual pricing per add-on

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
- `DemoBanner` — demo mode indicator
- `FloatingPlanBadge` — plan indicator
- `AdminImpersonationBanner` — admin impersonation indicator

---

## 9. Database & Migrations

### 9.1 Overview

- **153 migration files** in `supabase/migrations/`
- `master_init.sql` — legacy bootstrap SQL (foundation reference)
- Latest migration: `1104_journal_single_branch_backfill.sql`

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
| Zakat | `zakat_haul`, `zakat_haul_events`, `zakat_asset_timeline` |
| AI Tokens | `ai_token_wallets`, `ai_token_usage_logs`, `ai_token_topup_packages`, `ai_token_topup_orders` |

### 9.3 Key Stored Procedures / RPC

| Procedure | Purpose |
|---|---|
| `seed_default_coa` | Seed default chart of accounts for new org |
| `process_purchase_atomic` | Atomic purchase receiving (stock + journal) |
| `void_purchase_atomic` | Atomic purchase void |
| `process_purchase_payment_atomic` | Purchase payment processing |
| `process_purchase_return_atomic` | Purchase return processing |
| `process_sales_delivery_atomic` | Sales delivery (stock + journal) |
| `process_sales_payment_atomic` | Sales payment processing |
| `process_sales_return_atomic` | Sales return processing |
| `process_inventory_adjustment` | Inventory adjustment processing |
| `adjust_inventory_stock` | Direct stock adjustment |
| `update_product_average_cost` | Average cost recalculation |
| `generate_payslips_for_run` | Payslip generation |
| `process_payroll_payment` | Payroll disbursement |
| `void_payroll_run` | Payroll void |
| `process_expense_claim` | Expense claim processing |
| `process_work_order_completion_v2` | Manufacturing WO completion |
| `create_fleet_medical_record` | Fleet maintenance record |
| `process_asset_disposal` | Fixed asset disposal |
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

### 9.5 Storage Buckets

| Bucket | Purpose |
|---|---|
| `brand_assets` | Organization logos |
| `receipts` | Reimbursement proof |
| `avatars` | Employee avatars |
| `billing-proofs` | SaaS billing payment proof |

---

## 10. Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon key |
| `NEXT_PUBLIC_SUPABASE_TARGET` | Optional | `local` = use local Supabase CLI |
| `SUPABASE_SERVICE_ROLE_KEY` | For admin ops | Employee provisioning, reset password |
| `NEXT_PUBLIC_SUPABASE_LOCAL_URL` | When local | Local Supabase URL |
| `NEXT_PUBLIC_SUPABASE_LOCAL_ANON_KEY` | When local | Local anon key |
| `SUPABASE_LOCAL_SERVICE_ROLE_KEY` | When local | Local service role |
| `GOOGLE_AI_STUDIO_KEY` | For AI features | OCR, AI content generation |
| `RESEND_API_KEY` | For email | Invoice, promo email |
| `NEXT_PUBLIC_SITE_URL` | Optional | Password reset redirect URL |
| `VERCEL_URL` | Auto (Vercel) | Vercel deployment origin |

Connection switching is handled by `lib/supabase/config.ts`. **Changing `NEXT_PUBLIC_SUPABASE_TARGET` requires a restart** — it doesn't hot-reload.

---

## 11. Development Setup & Workflows

### 11.1 Prerequisites

- Node.js ≥ 20.0.0
- Supabase project (or local Supabase CLI + Docker)
- Environment variables configured

### 11.2 Available Scripts

```bash
# Development
npm run dev               # Start Next.js dev server
npm run build             # Production build
npm run start             # Start production server
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
```

### 11.3 Supabase Connection Modes

| Mode | Setup |
|---|---|
| **App → Remote Supabase** | Fill remote env vars, leave `NEXT_PUBLIC_SUPABASE_TARGET` empty |
| **App → Local Supabase** | Run `supabase:start`, fill local env vars, set `TARGET=local` |
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

### 12.2 Test Suites (30 files)

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
| `branch-access.server.test.ts` | Branch ACL |
| `bsc.actions.test.ts` | Balanced scorecard |
| `budget.actions.test.ts` | Budgeting |
| `employee.actions.test.ts` | Employee CRUD |
| `expense.actions.test.ts` | Expense claims |
| `export.route.test.ts` | XLSX export |
| `factory.actions.test.ts` | Manufacturing |
| `forecast.actions.test.ts` | Cash flow forecast |
| `inventory.actions.test.ts` | Inventory operations |
| `leave.actions.test.ts` | Leave management |
| `org.actions.test.ts` | Organization operations |
| `payroll.actions.test.ts` | Payroll processing |
| `purchasing.actions.test.ts` | Purchase operations |
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

6. **Use the correct Supabase client:**
   - Server actions/components: `import { createClient } from '@/lib/supabase/server'`
   - Client components: `import { createClient } from '@/lib/supabase/client'`
   - Admin operations: `import { createAdminClient } from '@/lib/supabase/server'`

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
| Migrations | `NNNN_description.sql` | `1104_journal_single_branch_backfill.sql` |

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

- File naming: `NNNN_description.sql` (next number after `1104`)
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
- Some admin/settings areas use client-side Supabase writes instead of server actions
- ESLint has a backlog of warnings across modules
- Some `<img>` tags should be `next/image`

---

## 15. Complete File Inventories

### 15.1 Server Action Files (52)

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
- `modules/sales/actions/pos.actions.ts`
- `modules/sales/actions/sales-page.actions.ts`
- `modules/sales/actions/sales.actions.ts`
- `modules/services/actions/service.actions.ts`
- `modules/settings/actions/audit.actions.ts`

**Server library files:**
- `modules/ai/lib/ai-token.server.ts`
- `modules/ai/lib/ai-token.ts`
- `modules/organization/lib/branch-access.server.ts`
- `modules/organization/lib/org-context.ts`
- `modules/sales/lib/sales-page.server.ts`
- `modules/sales/lib/sales-page.ts`

</details>

### 15.2 Page Routes (61)

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

**Dashboard (51):**
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
- `app/(dashboard)/settings/users/page.tsx`
- `app/(dashboard)/saas/page.tsx`
- `app/(dashboard)/saas/penawaran/page.tsx`
- `app/(dashboard)/saas/penjualan/page.tsx`
- `app/(dashboard)/saas/dokumen/[id]/page.tsx`

</details>

### 15.3 Client Components (42)

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
- `SaasOperatorClient.tsx`, `SaasDocumentView.tsx`
- `CommissionClient.tsx`, `SalesPageStudioClient.tsx`, `PipelineClient.tsx`
- `PromoClient.tsx`, `QuotationClient.tsx`, `SalesClient.tsx`
- `ServiceOrderClient.tsx`
- `BranchManagementClient.tsx`, `BusinessClient.tsx`, `UsersClient.tsx`
- `AbsClient.tsx`, `DemoClient.tsx`

</details>

---

## 16. Changelog (Recent Updates)

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

---

*This document is auto-maintained. When the codebase changes significantly, re-run the analysis to keep it current.*
