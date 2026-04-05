# AI Handover Document: `org.actions.ts` Migration Status

**Updated:** 2026-04-05 (sesi ke-4)  
**Status:** `IN PROGRESS` — Org + Auth + Branch access selesai. HRIS actions + role management UI slice selesai.

Dokumen ini menggantikan rencana eksekusi lama. Refactor target untuk sesi ini, yaitu migrasi `modules/organization/actions/org.actions.ts` dari Supabase data access ke Prisma/Auth.js, sudah dieksekusi dan tervalidasi.

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

Selain itu:

- `getResetRequestsCount()` di file yang sama juga sudah pindah ke Prisma.
- `HrisClient` tidak lagi membuat Supabase browser client untuk CRUD posisi/jabatan.
- `settings/roles/page.tsx` tidak lagi memakai Supabase client untuk load/update/delete/reorder role.
- `hris/page.tsx` dan `settings/users/page.tsx` tidak lagi preload `roles` lewat Supabase server client.

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

---

## 6. Remaining Hotspots Setelah Refactor Ini

Berikut file yang **masih memakai Supabase** dan relevan untuk lanjutan migrasi:

### Prioritas tinggi

- `app/(dashboard)/settings/users/UsersClient.tsx`
  - masih update/delete `org_members` via Supabase client
- `modules/organization/actions/approval.actions.ts`
  - masih full Supabase query + mutation
- `modules/organization/actions/audit.actions.ts`
  - masih Supabase
- `modules/organization/actions/billing.actions.ts`
  - masih Supabase

### Prioritas menengah

- `app/api/export/route.ts`
  - masih query `org_members` via Supabase
- `modules/organization/actions/org-id.actions.ts`
  - aman, tetapi tetap perlu dicek jika ada asumsi lama terkait context persistence

### Masih Supabase-heavy tetapi di luar scope target file

- `modules/demo/actions/demo.actions.ts`
  - wrapper baru sudah ditambahkan
  - tetapi mayoritas implementasinya masih Supabase

### Storage belum dimigrasikan keluar dari Supabase

- `modules/organization/lib/logo-storage.server.ts`
  - masih memakai bucket `brand_assets`
  - ini sengaja dipisahkan agar `org.actions.ts` tetap bersih
- `modules/hris/actions/employee.actions.ts` (avatar upload)
  - masih upload ke bucket `avatars` via Supabase Storage admin client

---

## 7. Rekomendasi Untuk Agent Selanjutnya

Target yang **paling masuk akal** untuk sesi berikutnya berdasarkan jumlah file dan dampak terbesarnya:

### PRIORITAS 1: HRIS UI (hapus Supabase direct call di app/)
- `app/(dashboard)/settings/users/UsersClient.tsx`
- `app/api/export/route.ts`

### PRIORITAS 2: Modul Organization Actions lainnya
- `modules/organization/actions/billing.actions.ts`
- `modules/organization/actions/audit.actions.ts`
- `modules/organization/actions/approval.actions.ts`

### PRIORITAS 3: Page Components (app/)
- audit lagi page/client lain yang masih instantiate `createClient()` hanya untuk mutasi ringan

### DEPRIORITIZE (Terlalu besar, lakukan terpisah):
- `modules/accounting/` — Banyak file, tapi tidak berimpact ke autentikasi
- `modules/demo/actions/demo.actions.ts` — Tetap boleh pakai Supabase sebagai wrapper seeding

---

## 8. Caveats / Hal Yang Perlu Diingat

- Jangan rollback `org.actions.ts` ke Supabase lagi.
- Jika agent berikutnya ingin memperketat authorization, cek dulu permission key nyata yang benar-benar dipakai role table. Jangan mengandalkan nama key hipotetis dari dokumen lama.
- `uploadLogo()` saat ini valid, tetapi masih tergantung Supabase Storage wrapper.
- `approveExpenseClaim()` sekarang tidak lagi pakai SQL RPC Supabase; ia membuat journal entry + lines via Prisma transaction. Saat ini `entry_number` diisi string kosong untuk entry auto; jika UI/accounting butuh format nomor entry, perlu disesuaikan dengan generator yang dipakai di modul accounting.
- `getActiveOrg()` sudah dinormalisasi untuk kompatibilitas caller lama; ubah shape return ini dengan sangat hati-hati.

---

## 9. File Inventory Dari Sesi Ini

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
  - `__tests__/organization-hris.actions.test.ts`

Dokumen ini siap diberikan ke agent berikutnya sebagai status handover terbaru.
