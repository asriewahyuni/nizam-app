# AI Handover Document: Supabase -> Prisma/Auth Migration Status

**Updated:** 2026-04-05 (sesi ke-14, POS action layer migration)  
**Status:** `IN PROGRESS` — Org + Auth + Branch access selesai. HRIS actions + role management + settings/users member management + audit/billing/approval action slice selesai. Billing UI + invoice print page + pricing catalog UI + admin SaaS backoffice sudah dipindahkan dari Supabase browser ke server actions. Slice contacts/services/accounting shared read model, sales + POS action layer utama, dan sejumlah server page shell juga sudah keluar dari Supabase.

Dokumen ini menggantikan rencana eksekusi lama dan dimaksudkan sebagai handover aktif untuk agent berikutnya. Target awal migrasi `modules/organization/actions/org.actions.ts` sudah lama selesai; sesi-sesi setelah itu melanjutkan migrasi slice organisasi yang masih bergantung ke Supabase.

---

## 0. Snapshot Repo Saat Ini

- Validasi terakhir yang sudah lulus:
  - `npx tsc --noEmit`
  - `npm test`
- Hasil validasi terakhir:
  - `36` file test lulus
  - `178` test lulus
- Footprint Supabase yang masih tersisa setelah sesi ini: `32` file aplikasi (`app/`, `modules/`, `lib/`) masih mengandung import/client call/helper Supabase berdasarkan pencarian import/helper saat ini.
- Validasi tambahan sesi ini yang sudah lulus:
  - `npx tsc --noEmit`
  - `npx vitest run __tests__/sales.actions.test.ts`
- Sesi ini tidak hanya menyelaraskan dokumen; ada migrasi lanjutan nyata pada action layer POS dan helper shared sales write-path.

---

## 1. Scope Yang Sudah Selesai

File-file berikut **sudah tidak lagi memakai Supabase data client**:

- `modules/organization/actions/org.actions.ts` ✅ (sesi sebelumnya)
- `modules/organization/lib/active-context.server.ts` ✅ (sesi sebelumnya)
- `modules/organization/lib/branch-access.server.ts` ✅ (sesi sebelumnya)
- `modules/auth/actions/auth.actions.ts` ✅ (sesi sebelumnya)
- `modules/hris/actions/employee.actions.ts` ✅ (tanpa `createClient`; avatar upload masih lewat Supabase Storage via admin client)
- `modules/hris/actions/attendance.actions.ts` ✅
- `modules/hris/actions/leave.actions.ts` ✅
- `modules/hris/actions/expense.actions.ts` ✅
- `modules/hris/actions/payroll.actions.ts` ✅
- `modules/hris/actions/self-service.actions.ts` ✅
- `modules/organization/actions/hris.actions.ts` ✅
- `app/(dashboard)/hris/page.tsx` ✅
- `app/(dashboard)/hris/HrisClient.tsx` ✅
- `app/(dashboard)/settings/users/page.tsx` ✅ (preload roles)
- `app/(dashboard)/settings/roles/page.tsx` ✅
- `app/(dashboard)/settings/users/UsersClient.tsx` ✅
- `app/api/export/route.ts` ✅
- `modules/organization/actions/audit.actions.ts` ✅
- `app/(dashboard)/settings/audit/page.tsx` ✅
- `modules/organization/actions/billing.actions.ts` ✅
- `modules/organization/actions/approval.actions.ts` ✅
- `app/(dashboard)/billing/page.tsx` ✅
- `app/(dashboard)/billing/invoice/[id]/page.tsx` ✅
- `app/(dashboard)/pricing/page.tsx` ✅
- `modules/settings/actions/audit.actions.ts` ✅
- `modules/saas/actions/admin.actions.ts` ✅
- `app/(dashboard)/admin/page.tsx` ✅
- `modules/accounting/actions/coa.actions.ts` ✅
- `modules/accounting/actions/analytics.actions.ts` ✅
- `modules/accounting/actions/audit.actions.ts` ✅
- `modules/contacts/actions/contact.actions.ts` ✅
- `modules/services/actions/service.actions.ts` ✅
- `modules/sales/actions/sales.actions.ts` ✅
- `modules/sales/actions/pos.actions.ts` ✅
- `app/abs/page.tsx` ✅
- `app/(dashboard)/cash/page.tsx` ✅
- `app/(dashboard)/contacts/page.tsx` ✅
- `app/(dashboard)/services/page.tsx` ✅
- `app/(dashboard)/sales/page.tsx` ✅
- `app/(dashboard)/sales/promos/page.tsx` ✅
- `app/(dashboard)/sales/commission/page.tsx` ✅
- `app/(dashboard)/sales/quotations/page.tsx` ✅
- `app/(dashboard)/sales/pipeline/page.tsx` ✅
- `app/(dashboard)/purchasing/page.tsx` ✅
- `app/(dashboard)/pos/page.tsx` ✅
- `app/(dashboard)/accounting/reimburse/page.tsx` ✅
- `app/(dashboard)/accounting/assets/page.tsx` ✅
- `app/(dashboard)/fleet/page.tsx` ✅
- `app/(dashboard)/profil-saya/page.tsx` ✅

---

## 2. Ringkasan Implementasi

### A. `org.actions.ts` sekarang memakai:

- `auth()` dari `@/auth`
- `prisma` dari `@/lib/prisma`
- `getMembership()` dari `@/lib/auth/permissions`
- `persistMembershipActiveContext()` dari `active-context.server.ts`

### B. Fungsi yang dimigrasikan ke Prisma

- `createOrganization`
- `createOrganizationQuick`
- `getActiveOrg`
- `getMyOrganizations`
- `setActiveOrg`
- `updateOrgSettings`
- `checkSlugAvailability`
- `uploadLogo`
- `getOrgMembers`
- `destroyOrganization`
- `getBranches`
- `getActiveBranch`
- `setActiveBranch`
- `canSelectAllBranches`
- `createBranch`
- `updateMemberUnitAccess`
- `getInvitations`
- `createInvitationToken`
- `deleteInvitation`
- `getInvitationByCode`

### C. Slice baru yang selesai pada sesi ini

Role management yang sebelumnya tersebar di beberapa page/client component dan masih query langsung ke tabel `roles` via Supabase sekarang sudah dipindahkan ke server actions Prisma/Auth di:

- `modules/organization/actions/hris.actions.ts`

Action yang ditambahkan:

- `getOrgRoles`
- `createOrgRole`
- `updateOrgRole`
- `updateOrgRolePermissions`
- `reorderOrgRoles`
- `deleteOrgRole`

Action membership management yang ditambahkan di `modules/organization/actions/org.actions.ts`:

- `updateOrgMemberRole`
- `removeOrgMember`

Audit migration yang selesai:

- `modules/organization/actions/audit.actions.ts`
  - tidak lagi memakai Supabase RPC/view `get_admin_audit_trail`
  - sekarang memakai `auth()` + `getMembership()` + `prisma.audit_logs`
  - lookup actor (`user_name`, `user_email`) via tabel `users`
- `modules/settings/actions/audit.actions.ts`
  - `getAuditLogs`, `createAuditLog`, dan `resetOrganizationData` sudah pindah ke Prisma/Auth
  - bulk delete lintas tabel untuk reset sekarang memakai server-side SQL via Prisma, tidak lagi `createAdminClient()`

Billing migration yang selesai:

- `modules/organization/actions/billing.actions.ts`
  - `createBillingInvoice`
  - `submitPaymentProof`
  - `applyVoucher`
  - `getBillingDashboardData`
  - `uploadBillingPaymentProof`
  - `getBillingInvoicePrintData`
  - seluruhnya sudah memakai Prisma/Auth, tanpa `createClient()`

Billing UI migration yang selesai:

- `app/(dashboard)/billing/page.tsx`
  - tidak lagi memakai Supabase browser client untuk load config, org, wallet, invoices, atau topup package
  - refresh data sekarang lewat `getBillingDashboardData()`
  - upload bukti bayar sekarang lewat server action `uploadBillingPaymentProof()`
- `app/(dashboard)/billing/invoice/[id]/page.tsx`
  - tidak lagi fetch invoice/config via Supabase browser client
  - sekarang memanggil `getBillingInvoicePrintData()`
- `app/(dashboard)/pricing/page.tsx`
  - tidak lagi load `saas_packages` atau current plan via Supabase browser client
  - sekarang memakai snapshot `getBillingDashboardData()` agar katalog paket dan plan aktif memakai source of truth billing yang sama
- `app/(dashboard)/admin/page.tsx`
  - tidak lagi instantiate Supabase browser client untuk load tenant, paket, invoice, config SaaS, token AI, atau mutasi backoffice
  - seluruh refresh/mutasi sekarang lewat server actions Prisma/Auth
- action layer baru untuk backoffice SaaS:
  - `modules/saas/actions/admin.actions.ts`
  - menyediakan snapshot loader + CRUD tenant/paket/token + approval/cancel/delete invoice via Prisma/Auth
- wrapper storage baru:
  - `modules/organization/lib/billing-proof-storage.server.ts`
  - upload `billing-proofs` sekarang lewat Supabase admin storage wrapper di server, bukan browser

Shared module migration yang selesai pada sesi ini:

- `modules/accounting/actions/coa.actions.ts`
  - `getChartOfAccounts`, `createAccount`, `updateAccount`, `deleteAccount`, `getAccountBalances`, `seedInitialCoA`, dan `setShariahAccountsActive` sudah pindah ke Prisma/Auth
  - pembacaan view `account_balances` dan RPC `seed_default_coa` sekarang lewat server-side SQL Prisma, bukan Supabase query builder/RPC
- `modules/accounting/actions/analytics.actions.ts`
  - dashboard analytics sekarang dihitung dari Prisma relation graph (`journal_entries`, `journal_lines`, `sales`, `sales_items`, `products`, `contacts`)
- `modules/accounting/actions/audit.actions.ts`
  - audit integritas accounting sekarang memakai Prisma, termasuk cek jurnal unbalanced, depresiasi tertunda, dan variance persediaan
- `modules/contacts/actions/contact.actions.ts`
  - CRUD kontak aktif sekarang berbasis Prisma/Auth
- `modules/services/actions/service.actions.ts`
  - list/create/update status job order sekarang berbasis Prisma + branch access helper

Server page cleanup yang selesai pada sesi ini:

- page shell berikut tidak lagi instantiate Supabase server/browser client untuk auth atau preload sederhana:
  - `app/abs/page.tsx`
  - `app/(dashboard)/cash/page.tsx`
  - `app/(dashboard)/contacts/page.tsx`
  - `app/(dashboard)/services/page.tsx`
  - `app/(dashboard)/sales/page.tsx`
  - `app/(dashboard)/sales/promos/page.tsx`
  - `app/(dashboard)/sales/commission/page.tsx`
  - `app/(dashboard)/sales/quotations/page.tsx`
  - `app/(dashboard)/sales/pipeline/page.tsx`
  - `app/(dashboard)/purchasing/page.tsx`
  - `app/(dashboard)/pos/page.tsx`
  - `app/(dashboard)/accounting/reimburse/page.tsx`
  - `app/(dashboard)/accounting/assets/page.tsx`
  - `app/(dashboard)/fleet/page.tsx`
  - `app/(dashboard)/profil-saya/page.tsx`
- `app/(dashboard)/cash/page.tsx`
  - helper `getBankAccountsWithBalance()` sekarang memakai Prisma + raw SQL ke view `account_balances`, bukan Supabase
- `app/(dashboard)/profil-saya/page.tsx`
  - lookup employee aktif sekarang langsung lewat Prisma relation `employees -> branches`

Approval migration yang selesai:

- `modules/organization/actions/approval.actions.ts`
  - `getPendingApprovals`
  - `getApprovalHistory`
  - `getApprovalDetail`
  - `getPendingApprovalsCount`
  - `decideApproval`
  - `getApprovalForSource`
  - seluruhnya sudah memakai `auth()` + `getMembership()` + Prisma + branch access helper
  - enrichment `requester/approver` sekarang via tabel `users`
  - shape detail legacy untuk modal (`items/account`, `branch`, `employee`, nested `contacts/products`) dipertahankan
  - serialisasi `Decimal`/tanggal dinormalisasi agar aman ke client

Selain itu:

- `getResetRequestsCount()` di file yang sama juga sudah pindah ke Prisma.
- `HrisClient` tidak lagi membuat Supabase browser client untuk CRUD posisi/jabatan.
- `settings/roles/page.tsx` tidak lagi memakai Supabase client untuk load/update/delete/reorder role.
- `hris/page.tsx` dan `settings/users/page.tsx` tidak lagi preload `roles` lewat Supabase server client.
- `settings/users/UsersClient.tsx` tidak lagi update/delete `org_members` via Supabase browser client.
- `app/api/export/route.ts` tidak lagi memakai Supabase untuk auth, verifikasi membership, atau lookup organisasi.
- halaman audit settings sekarang memanggil action audit yang berbasis Prisma dengan scope org aktif.
- billing actions sekarang punya membership guard eksplisit di app layer, tidak lagi mengandalkan Supabase session/RLS.
- approval actions sekarang tidak lagi memakai Supabase query builder; side effect dokumen sumber (`sales`, `purchases`, `reimbursements`, `leave_requests`) juga sudah Prisma.
- billing page dan invoice print page tidak lagi instantiate `createClient()` di sisi browser untuk kebutuhan data-layer.
- `modules/sales/actions/sales.actions.ts` sekarang tidak lagi instantiate Supabase client untuk list/create/update/void sales, quotation, pipeline card, atau precheck pembayaran/retur.
- fungsi SQL legacy `process_sales_delivery_atomic`, `process_sales_payment_atomic`, dan `process_sales_return_atomic` tetap dipakai, tetapi sekarang dipanggil via Prisma transaction dengan injeksi `request.jwt.claim.sub` agar engine SQL lama tetap membaca konteks user tanpa client Supabase.
- `modules/sales/actions/pos.actions.ts` sekarang tidak lagi instantiate Supabase client untuk validasi produk, lookup/create customer, insert sales header/items, atau pemanggilan auto-delivery/payment POS.
- helper write-path baru:
  - `modules/sales/lib/sales-write.server.ts`
  - menampung `withDbUserContext()`, `insertSaleHeader()`, dan util error/number normalization agar `sales.actions.ts` dan `pos.actions.ts` memakai source of truth yang sama.

### D. Pola keamanan yang dipakai

Rencana awal mengasumsikan ada helper `checkPermission(session, orgId, ...)` dengan signature session-based. Itu **tidak sesuai** dengan helper aktual di repo saat ini.

Helper yang benar-benar tersedia sekarang adalah:

- `getMembership(userId, orgId)`
- `requireMembership(userId, orgId)`
- `requirePermission(userId, orgId, requiredPermissionKeys)`

Untuk refactor ini, implementasi memakai:

1. `auth()` untuk memperoleh user
2. `getMembership(user.id, orgId)` untuk memastikan tenant isolation
3. role gate atau permission gate lokal di dalam `org.actions.ts`

Catatan penting:

- Untuk jalur yang sebelumnya memang dibatasi ke `owner/admin`, perilaku itu dipertahankan.
- Saya **tidak memaksa** penggunaan permission key seperti `settings.branches.manage` dari rencana lama karena key tersebut tidak terbukti eksis secara konsisten di codebase saat ini.
- Permission matching yang dipakai masih berbasis substring seperti pola existing ACL di repo.

---

## 3. Keputusan Teknis Penting

### A. `createOrganizationRecord()` memakai transaction

Pembuatan organisasi, owner membership, dan default branch sekarang dibungkus dalam satu `prisma.$transaction()`.

### B. Normalisasi shape `getActiveOrg()`

`getActiveOrg()` sekarang mengembalikan organization object yang dinormalisasi ke shape legacy yang masih diharapkan UI:

- timestamp dikonversi ke string ISO
- `settings` dipastikan object
- field seperti `active_addons`, `enabled_modules`, `owner_email`, `is_demo` tetap tersedia

Ini penting karena beberapa caller UI masih memakai asumsi tipe lama.

### C. Upload logo dipisah ke wrapper storage

`org.actions.ts` sudah bersih dari Supabase client/storage call langsung.  
Namun upload aset logo **masih** memakai Supabase Storage melalui wrapper baru:

- `modules/organization/lib/logo-storage.server.ts`

Artinya:

- migrasi data-layer untuk `org.actions.ts` selesai
- migrasi storage layer **belum** selesai secara repo-wide

### D. Demo seeding dipisah ke wrapper

Untuk menjaga `org.actions.ts` tetap bebas dari Supabase client call, ditambahkan wrapper:

- `seedDemoOrganization(orgId, demoType)` di `modules/demo/actions/demo.actions.ts`

Wrapper ini tetap mendelegasikan ke alur demo lama yang masih Supabase-heavy.

---

## 4. Validasi Yang Sudah Dilakukan

Perintah yang sudah dijalankan dan lulus:

```bash
npx tsc --noEmit
npm test
```

Hasil:

- TypeScript compile bersih
- seluruh test suite (Vitest) lulus
- test baru `__tests__/organization-hris.actions.test.ts` lulus
- `__tests__/org.actions.test.ts` diperbarui untuk member role/remove guards dan lulus
- `__tests__/organization-audit.actions.test.ts` lulus
- `__tests__/billing.actions.test.ts` lulus
- `__tests__/approval.actions.test.ts` sudah direwrite ke Prisma/Auth mock dan lulus
- `__tests__/billing.actions.test.ts` diperluas untuk snapshot loader, upload proof wrapper, invoice print data loader, dan package catalog tanpa org aktif
- `__tests__/service.actions.test.ts` direwrite dari mock Supabase ke mock Prisma agar tetap menguji branch scoping pada service order slice
- Catatan: `npm run lint` di repo ini masih fail karena banyak issue lint legacy (bukan efek perubahan HRIS saja)

---

## 5. Perubahan Test

Test yang sudah diperbarui dari model mock Supabase lama ke model mock baru berbasis Prisma/Auth:

- `auth()`
- `prisma`
- `getMembership()`
- `persistMembershipActiveContext()`
- branch access helpers

File test yang disentuh pada sesi HRIS migration:

- `__tests__/attendance.actions.test.ts`
- `__tests__/employee.actions.test.ts`
- `__tests__/leave.actions.test.ts`
- `__tests__/expense.actions.test.ts`
- `__tests__/payroll.actions.test.ts`
- `__tests__/self-service.actions.test.ts`
- `__tests__/proxy.test.ts` (update mock karena `proxy.ts` tidak lagi lewat Supabase middleware)
- `__tests__/branch-access.server.test.ts` (mock Prisma + `auth()`)
- `__tests__/auth.actions.test.ts` (mock Prisma + NextAuth)
- `__tests__/service.actions.test.ts` (mock Prisma + branch access helper)

---

## 6. Remaining Hotspots Setelah Refactor Ini

Berikut file yang **masih memakai Supabase** dan relevan untuk lanjutan migrasi:

### Prioritas tinggi

- `modules/purchasing/actions/purchasing.actions.ts`
  - domain purchasing page shell sudah bersih, tetapi action layer dan approval/journal flow masih Supabase-heavy
- `modules/inventory/actions/inventory.actions.ts`
- `modules/inventory/actions/warehouse.actions.ts`
  - setelah `sales.actions.ts` dan `pos.actions.ts` pindah, cluster ini menjadi blocker terbesar berikutnya untuk dashboard POS/purchasing/inventory
- `modules/saas/actions/operator-sales.actions.ts`
  - masih Supabase-heavy untuk penawaran/penjualan operator SaaS, jurnal otomatis, dan dokumen operator
  - tetap jadi hotspot SaaS/operator terbesar yang tersisa
- `modules/saas/actions/ticketing.actions.ts`
  - masih memakai Supabase untuk auth scoped query, attachment upload, dan status ticket

### Prioritas menengah

- `modules/cash/actions/bank.actions.ts`
- `modules/cash/actions/reconcile.actions.ts`
  - page shell cash sudah bersih, tetapi mutasi transaksi/rekonsiliasi masih Supabase
- `modules/accounting/actions/aging.actions.ts`
- `modules/accounting/actions/assets.actions.ts`
- `modules/accounting/actions/bsc.actions.ts`
- `modules/accounting/actions/budget.actions.ts`
- `modules/accounting/actions/closing.actions.ts`
- `modules/accounting/actions/export.actions.ts`
- `modules/accounting/actions/forecast.actions.ts`
- `modules/accounting/actions/journal.actions.ts`
- `modules/accounting/actions/reimburse.actions.ts`
- `modules/accounting/actions/reports.actions.ts`
- `modules/accounting/actions/shariah.actions.ts`
- `modules/accounting/actions/tax.actions.ts`
- `modules/accounting/actions/zakat.actions.ts`
  - cluster accounting lain masih besar, tetapi sekarang page shell utamanya sudah tidak langsung pakai Supabase
- `modules/fleet/actions/fleet.actions.ts`
- `modules/factory/actions/factory.actions.ts`
  - page shell sudah lebih bersih, tetapi action layer domain ini masih Supabase
- `modules/organization/lib/billing-proof-storage.server.ts`
  - billing proof sudah pindah ke server wrapper, tetapi storage backend masih Supabase
- `modules/organization/lib/logo-storage.server.ts`
  - upload logo sudah dibungkus wrapper server, tetapi storage backend masih Supabase
- `modules/hris/actions/employee.actions.ts`
  - avatar upload masih ke bucket `avatars` via Supabase Storage admin client

### Masih Supabase-heavy tetapi di luar scope target file

- `modules/demo/actions/demo.actions.ts`
  - wrapper baru sudah ditambahkan
  - tetapi mayoritas implementasinya masih Supabase

### Bukan hotspot utama, tetapi perlu diingat

- `app/(auth)/update-password/page.tsx`
  - masih terikat ke Supabase auth magic-link/session update flow lama
  - ini kemungkinan butuh keputusan produk/auth flow, bukan sekadar refactor query builder
- `app/(dashboard)/sales/pipeline/PipelineClient.tsx`
  - masih memakai Supabase browser client untuk realtime `postgres_changes`
- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `lib/supabase/middleware.ts`
  - tiga file ini baru bisa dihapus setelah seluruh caller feature layer hilang

---

## 7. Rekomendasi Untuk Agent Selanjutnya

Target yang **paling masuk akal** untuk sesi berikutnya berdasarkan jumlah file dan dampak terbesarnya:

### PRIORITAS 1: Core Sales / Purchasing Backbone
- `modules/purchasing/actions/purchasing.actions.ts`
- `modules/inventory/actions/inventory.actions.ts`
- `modules/inventory/actions/warehouse.actions.ts`
- alasan:
  - page shell penjualan/purchasing/POS sudah bersih, dan sales + POS write-path sudah keluar dari Supabase; value tertinggi berikutnya ada di purchasing + inventory backbone
  - setelah tiga file ini pindah, banyak route dashboard operasional akan otomatis mendekati zero Supabase

### PRIORITAS 2: Billing / Operator Backoffice
- `modules/saas/actions/operator-sales.actions.ts`
- lanjutkan ke `/saas/penawaran`, `/saas/penjualan`, dan `/saas/dokumen/[id]` supaya domain operator SaaS benar-benar keluar dari Supabase

### PRIORITAS 3: Ticketing + Cash
- `modules/saas/actions/ticketing.actions.ts`
- `modules/cash/actions/bank.actions.ts`
- `modules/cash/actions/reconcile.actions.ts`
- domain masih dekat dengan slice yang sudah dibersihkan (admin, billing, cash page shell)

### PRIORITAS 4: Storage Wrappers
- `modules/organization/lib/billing-proof-storage.server.ts`
- `modules/organization/lib/logo-storage.server.ts`
- `modules/hris/actions/employee.actions.ts`
- ini bukan data-layer blocker lagi, tetapi masih relevan jika target akhir adalah zero direct Supabase storage usage di feature layer

### DEPRIORITIZE
- `app/(auth)/update-password/page.tsx` — jangan disentuh tanpa keputusan reset-password flow pengganti
- `modules/accounting/` yang tersisa di luar `journal/reimburse/assets` — besar, tetapi sekarang tidak lagi menahan cleanup page shell
- `modules/demo/actions/demo.actions.ts` — masih wajar dibiarkan sebagai wrapper seeding terisolasi

---

## 8. Caveats / Hal Yang Perlu Diingat

- Jangan rollback `org.actions.ts` ke Supabase lagi.
- Jika agent berikutnya ingin memperketat authorization, cek dulu permission key nyata yang benar-benar dipakai role table. Jangan mengandalkan nama key hipotetis dari dokumen lama.
- `uploadLogo()` saat ini valid, tetapi masih tergantung Supabase Storage wrapper.
- `uploadBillingPaymentProof()` sekarang server-side dan aman untuk memutus browser client, tetapi bucket backend-nya tetap Supabase (`billing-proofs`).
- `approveExpenseClaim()` sekarang tidak lagi pakai SQL RPC Supabase; ia membuat journal entry + lines via Prisma transaction. Saat ini `entry_number` diisi string kosong untuk entry auto; jika UI/accounting butuh format nomor entry, perlu disesuaikan dengan generator yang dipakai di modul accounting.
- `getActiveOrg()` sudah dinormalisasi untuk kompatibilitas caller lama; ubah shape return ini dengan sangat hati-hati.
- `getBillingDashboardData()` saat ini menghitung `package_limit.max_orgs` dan `max_warehouses` dari `saas_packages`, bukan dari field organisasi, karena schema Prisma saat ini tidak punya sumber limit terpisah yang jelas.
- `getBillingDashboardData()` sementara mengisi `package_limit.max_users = 10` sebagai fallback UI karena tidak ada field canonical di schema saat ini. Jika seat limit perlu akurat, definisikan sumber datanya dulu sebelum merombak UI.
- Di billing page, flag demo sekarang dibaca dari `activeOrg.is_demo` top-level, bukan dari `settings.is_demo`.
- `app/(auth)/update-password/page.tsx` masih Supabase-specific; route ini sekarang menjadi salah satu blocker terakhir untuk benar-benar menghapus helper auth Supabase lama.

---

## 9. File Inventory Dari Sesi-Sesi Terakhir

- HRIS actions:
  - `modules/hris/actions/employee.actions.ts`
  - `modules/hris/actions/attendance.actions.ts`
  - `modules/hris/actions/leave.actions.ts`
  - `modules/hris/actions/expense.actions.ts`
  - `modules/hris/actions/payroll.actions.ts`
  - `modules/hris/actions/self-service.actions.ts`
- Test updates:
  - `__tests__/attendance.actions.test.ts`
  - `__tests__/employee.actions.test.ts`
  - `__tests__/leave.actions.test.ts`
  - `__tests__/expense.actions.test.ts`
  - `__tests__/payroll.actions.test.ts`
  - `__tests__/self-service.actions.test.ts`
  - `__tests__/proxy.test.ts`
  - `__tests__/branch-access.server.test.ts`
  - `__tests__/auth.actions.test.ts`
- Test infra:
  - `vitest.config.ts`
- Role management migration:
  - `modules/organization/actions/hris.actions.ts`
  - `app/(dashboard)/hris/page.tsx`
  - `app/(dashboard)/hris/HrisClient.tsx`
  - `app/(dashboard)/settings/users/page.tsx`
  - `app/(dashboard)/settings/roles/page.tsx`
  - `app/(dashboard)/settings/users/UsersClient.tsx`
  - `app/api/export/route.ts`
  - `app/(dashboard)/settings/audit/page.tsx`
  - `modules/organization/actions/audit.actions.ts`
  - `modules/settings/actions/audit.actions.ts`
  - `modules/organization/actions/billing.actions.ts`
  - `modules/organization/actions/approval.actions.ts`
  - `modules/accounting/actions/coa.actions.ts`
  - `modules/accounting/actions/analytics.actions.ts`
  - `modules/accounting/actions/audit.actions.ts`
  - `modules/contacts/actions/contact.actions.ts`
  - `modules/services/actions/service.actions.ts`
  - `modules/organization/lib/billing-proof-storage.server.ts`
  - `app/(dashboard)/billing/page.tsx`
  - `app/(dashboard)/billing/invoice/[id]/page.tsx`
  - `app/(dashboard)/pricing/page.tsx`
  - `modules/saas/actions/admin.actions.ts`
  - `app/(dashboard)/admin/page.tsx`
  - `app/abs/page.tsx`
  - `app/(dashboard)/cash/page.tsx`
  - `app/(dashboard)/contacts/page.tsx`
  - `app/(dashboard)/services/page.tsx`
  - `app/(dashboard)/sales/page.tsx`
  - `app/(dashboard)/sales/promos/page.tsx`
  - `app/(dashboard)/sales/commission/page.tsx`
  - `app/(dashboard)/sales/quotations/page.tsx`
  - `app/(dashboard)/sales/pipeline/page.tsx`
  - `app/(dashboard)/purchasing/page.tsx`
  - `app/(dashboard)/pos/page.tsx`
  - `app/(dashboard)/accounting/reimburse/page.tsx`
  - `app/(dashboard)/accounting/assets/page.tsx`
  - `app/(dashboard)/fleet/page.tsx`
  - `app/(dashboard)/profil-saya/page.tsx`
  - `__tests__/org.actions.test.ts`
  - `__tests__/export.route.test.ts`
  - `__tests__/organization-audit.actions.test.ts`
  - `__tests__/billing.actions.test.ts`
  - `__tests__/approval.actions.test.ts`
  - `__tests__/organization-hris.actions.test.ts`
  - `__tests__/service.actions.test.ts`

Dokumen ini siap diberikan ke agent berikutnya sebagai status handover terbaru.
