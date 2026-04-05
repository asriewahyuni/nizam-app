# AI Handover Document: `org.actions.ts` Migration Status

**Updated:** 2026-04-05 (sesi ke-3)  
**Status:** `IN PROGRESS` — Auth actions dan org module selesai. Branch-access selesai.

Dokumen ini menggantikan rencana eksekusi lama. Refactor target untuk sesi ini, yaitu migrasi `modules/organization/actions/org.actions.ts` dari Supabase data access ke Prisma/Auth.js, sudah dieksekusi dan tervalidasi.

---

## 1. Scope Yang Sudah Selesai

File-file berikut **sudah tidak lagi memakai Supabase data client**:

- `modules/organization/actions/org.actions.ts` ✅ (sesi sebelumnya)
- `modules/organization/lib/active-context.server.ts` ✅ (sesi sebelumnya)
- `modules/organization/lib/branch-access.server.ts` ✅ **BARU - sesi ini**
- `modules/auth/actions/auth.actions.ts` ✅ **BARU - sesi ini** (semua fungsi termasuk signInAsTenantOwner, restorePlatformAdminSession, requestPasswordReset, resetEmployeePassword, sendPasswordResetEmail)

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

### C. Pola keamanan yang dipakai

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
npx vitest run __tests__/org.actions.test.ts
```

Hasil:

- TypeScript compile bersih
- test file `__tests__/org.actions.test.ts` lulus

---

## 5. Perubahan Test

`__tests__/org.actions.test.ts` sudah diperbarui dari model mock Supabase lama ke model mock baru berbasis:

- `auth()`
- `prisma`
- `getMembership()`
- `persistMembershipActiveContext()`
- branch access helpers

Jika agent berikutnya mengubah kontrak `org.actions.ts`, test ini harus ikut di-review karena sekarang test memang merefleksikan arsitektur Prisma/Auth yang baru.

---

## 6. Remaining Hotspots Setelah Refactor Ini

Berikut file yang **masih memakai Supabase** dan relevan untuk lanjutan migrasi:

### Prioritas tinggi

- `modules/organization/lib/branch-access.server.ts`
  - masih memakai `createClient()` / `createAdminClient()`
  - `org.actions.ts` sekarang bergantung pada helper ini untuk branch scope
  - ini target paling logis berikutnya

### Prioritas menengah

- `app/(dashboard)/settings/users/page.tsx`
  - masih query `roles` via Supabase
- `app/(dashboard)/hris/page.tsx`
  - masih query `roles` via Supabase

### Masih dalam area organization module

- `modules/organization/actions/billing.actions.ts`
- `modules/organization/actions/hris.actions.ts`
- `modules/organization/actions/audit.actions.ts`
- `modules/organization/actions/approval.actions.ts`

### Masih Supabase-heavy tetapi di luar scope target file

- `modules/demo/actions/demo.actions.ts`
  - wrapper baru sudah ditambahkan
  - tetapi mayoritas implementasinya masih Supabase

### Storage belum dimigrasikan keluar dari Supabase

- `modules/organization/lib/logo-storage.server.ts`
  - masih memakai bucket `brand_assets`
  - ini sengaja dipisahkan agar `org.actions.ts` tetap bersih

---

## 7. Rekomendasi Untuk Agent Selanjutnya

Target yang **paling masuk akal** untuk sesi berikutnya berdasarkan jumlah file dan dampak terbesarnya:

### PRIORITAS 1: Modul HRIS (`modules/hris/`)
File yang harus dimigrasikan:
- `modules/hris/actions/employee.actions.ts` — `createClient` + `createAdminClient`
- `modules/hris/actions/payroll.actions.ts`
- `modules/hris/actions/attendance.actions.ts`
- `modules/hris/actions/leave.actions.ts`
- `modules/hris/actions/expense.actions.ts`
- `modules/hris/actions/self-service.actions.ts`

### PRIORITAS 2: Modul Organization Actions lainnya
- `modules/organization/actions/billing.actions.ts`
- `modules/organization/actions/hris.actions.ts`
- `modules/organization/actions/audit.actions.ts`
- `modules/organization/actions/approval.actions.ts`

### PRIORITAS 3: Page Components (app/)
- `app/(dashboard)/settings/users/page.tsx`
- `app/(dashboard)/hris/page.tsx`

### DEPRIORITIZE (Terlalu besar, lakukan terpisah):
- `modules/accounting/` — Banyak file, tapi tidak berimpact ke autentikasi
- `modules/demo/actions/demo.actions.ts` — Tetap boleh pakai Supabase sebagai wrapper seeding

---

## 8. Caveats / Hal Yang Perlu Diingat

- Jangan rollback `org.actions.ts` ke Supabase lagi.
- Jika agent berikutnya ingin memperketat authorization, cek dulu permission key nyata yang benar-benar dipakai role table. Jangan mengandalkan nama key hipotetis dari dokumen lama.
- `uploadLogo()` saat ini valid, tetapi masih tergantung Supabase Storage wrapper.
- `getActiveOrg()` sudah dinormalisasi untuk kompatibilitas caller lama; ubah shape return ini dengan sangat hati-hati.

---

## 9. File Inventory Dari Sesi Ini

- `modules/organization/actions/org.actions.ts`
- `modules/organization/actions/org-id.actions.ts`
- `modules/organization/lib/branch-access.server.ts`
- `modules/organization/lib/logo-storage.server.ts`
- `modules/demo/actions/demo.actions.ts`
- `__tests__/org.actions.test.ts`

Dokumen ini siap diberikan ke agent berikutnya sebagai status handover terbaru.
