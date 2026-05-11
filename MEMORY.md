# MEMORY.md — Nizam Sidekick (Z)

## Long-Term Memory

> Last updated: 2026-05-11

### Identity & Personality
- Nama: Nizam Sidekick / Z
- Vibe: Sharp, Proactive, Monetization-Focused
- Relationship: Digital partner for Agan Yogi (CTO) & Om Bob (CEO)
- Guest policy: Tamu di hidup Agan, hormati privasi & data

### Project: Nizam App
- **Repo:** `/app/working/workspaces/default/nizam-app`
- **Branch:** `main` (gas terus, direct push)
- **Target:** UMKM (small business owners who are not tech-savvy)
- **Stack:** Next.js 16 (App Router), Supabase, PostgreSQL (Railway)
- **DB URL:** `postgresql://postgres:WizrKrHnupxehsBQmpqnlxOgMANBAbVB@postgres.railway.internal:5432/railway`
- **Skill doc:** `/app/working/workspaces/default/skills/modul-operasional-standard/SKILL.md`
- **Version format:** `N{C}.{M}.{A}.{P}` (NIZAM prefix, Core.Module.Addon.Patch)
- **Current version:** N2.6.3.12 (Core=2, BusinessType=6, Addon=3, Patch=12)

### Module Architecture (Final)
- **5 Pillars (wajib, selalu aktif):** Finance (7 sub-modules), Marketing (Sales, CRM), HRIS, Operasional (container), Syirkah
- **Business Type (swapable, 1 aktif):** Fleet & Rental, Manufacturing, Workshop, Job Order, Project & Construction, LMS
- **Add-on (multi-aktif):** POS, Sales Page, Quick Bill
- **Sidebar:** Semua pillar auto-visible via `PILLAR_MODULES` bypass di sidebar logic
- **Activation:** `use_custom_modules = true` critical for setup redirect to work

### Major Fixes Completed
1. ✅ Version badge + integrity modal (VersionIntegrityButton)
2. ✅ Generic onboarding setup page at /marketplace/setup/[moduleKey]
3. ✅ Module architecture restructured (pillars + business type + add-ons)
4. ✅ LMS + all operational modules visible in sidebar
5. ✅ CoA injection functions for Fleet, Syirkah (Manufacturing, Workshop, Job Order pending)
6. ✅ Sidebar filter bug (aliases now match correctly)
7. ✅ Activation redirect partially fixed (use_custom_modules flag)
8. ✅ Print label modal: positioned top-left, DOM-based CSS, body-level container
9. ✅ 6 critical accounting audit bugs fixed:
   - Cash flow category injection (all 1,600 accounts)
   - Hardcoded code prefixes (P&L/Neraca ahora pake account type)
   - Cash account FK detection (via bank_accounts JOIN)
   - Fiscal period closing with auto-closing JE
   - Opening balance system
   - getBalanceSheet optimization (no double getProfitLoss calls)
10. ✅ PPN Tax Engine live — PKP settings, Bayar Pajak (auto-JE), Download SPT CSV

### Known Issues / In Progress
- Activation redirect: still redirects to `/marketplace` instead of setup page after activation
- Server Component render error on marketplace page (Supabase/env issue)
- Inventory save error (regression)
- Manufacturing, Workshop, Job Order CoA injection functions belum dibuat

### Roleplay Scenario
- Child org "Bisnis Pelatihan" with 2 branches (Yogya, Solo)
- Complete accounting cycle: payroll, sales, expenses, AR/AP
- Balance Sheet PASS: Aset=Rp 967jt = Liabilitas+Ekuitas
- P&L: Rugi Rp 35jt (Revenue Rp 55jt - Expenses Rp 90jt)
- Cash Flow: OCF -Rp 40.5jt
- AR/AP Pipeline: AR Rp 7.5jt, AP Rp 2jt
- Bug found: Payroll JE empty lines, NIK per-branch reset, salary concatenation

### Preferences & Patterns
- Bahasa Indonesia campur English (daily vibe)
- Agan suka langsung ke inti, gas terus, jangan basa-basi
- "Jangan seneng dulu. Laa rayhada ba'dal yaum" — jangan euphoria sebelum kerjaan beneran selesai
- Benchmark target: Mekari Jurnal, Accurate Online, Xero, QuickBooks
- Priority order: PPN engine (#1 done ✅) → AR/AP Aging (#2) → Multi-currency (#3) → Financial Ratios (#4)

### Key Technical Details
- Railway DB accessible from dev environment
- `journal_reference_type` enum: 'SALE', 'PURCHASE', 'PAYMENT', 'RECEIPT', 'JOURNAL', 'CLOSING', 'OPENING_BALANCE', 'TAX'
- `document_status` enum: 'DRAFT', 'POSTED', 'VOID'
- `payment_status` enum: 'UNPAID', 'PARTIAL', 'PAID', 'OVERPAID'
- Fiscal periods: table was EMPTY for all orgs before migration 1301
- TAX reference type added for PPN payment journals

### Phase 1 Progress (UI/UX Consistency — 11 May 2026)
**Done:**
1.1 Design System: Status colors + component-level CSS variables in globals.css ✅
1.2 Unified buttons: .btn utility classes + SafeButton already comprehensive ✅
1.3 Unified forms: FormInput, FormSelect, FormTextarea, FormField components ✅
1.4 Unified tables: .table-wrap utility class ✅
1.5 Unified modals: ConfirmDialog exists, ErrorBoundary added ✅
1.6 Empty states: EmptyState already exists in NizamUI ✅
1.7 Loading skeletons: Skeleton, TableSkeleton, CardSkeleton, FormSkeleton ✅
1.8 Responsive sidebar: Already exists (829-line component with mobile overlay) ✅

**NizamUI now at 13 exports:** SafeButton, PageHeader, StatCard, EmptyState, SectionCard, SectionHeader, StatusBadge, ConfirmDialog, Skeleton, FormInput, FormSelect, FormTextarea, ErrorBoundary, PageShell

Build: ✅ 0 errors (verified via next build)
