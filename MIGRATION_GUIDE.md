# Panduan Lengkap Migrasi NIZAM ERP: Supabase ke PostgreSQL

Dokumen ini adalah cetak biru teknis resmi untuk tim pengembang yang akan mengeksekusi perpindahan database dan autentikasi NIZAM ERP agar 100% mandiri lepas dari ekosistem khusus Supabase.

## Ringkasan Eksekutif Terpilih

Karena mengutamakan **stabilitas, keamanan, dan keandalan (safest choice)**, teknologi transisi yang telah ditetapkan adalah:
1. **Database Murni**: PostgreSQL standar.
2. **ORM Akses Data**: Prisma ORM. 
3. **Autentikasi**: NextAuth.js (Auth.js) dipadukan dengan Prisma Adapter.

Keuntungan strategi ini adalah: NIZAM ERP akan aman dari *vendor lock-in* (dapat langsung dideploy di layanan AWS, VPS, atau GCP murni) dan tipe datanya akan terlindungi secara *end-to-end* oleh Prisma.

## Progress Snapshot (2026-04-05)

Status migrasi yang sudah terkonfirmasi selesai:

- `modules/auth/actions/auth.actions.ts`
- `modules/organization/lib/active-context.server.ts`
- `modules/organization/actions/org.actions.ts`
- `modules/organization/actions/org-id.actions.ts`

Catatan implementasi penting:

- `org.actions.ts` sudah memakai `auth()` + Prisma, tanpa Supabase client langsung.
- Upload logo masih memakai Supabase Storage lewat wrapper `modules/organization/lib/logo-storage.server.ts`.
- Demo seeding masih Supabase-heavy, tetapi `org.actions.ts` sekarang hanya memanggil wrapper `seedDemoOrganization(...)`.
- Helper branch scope `modules/organization/lib/branch-access.server.ts` **belum** selesai dimigrasikan dan merupakan target lanjutan yang paling logis.

---

## 🏗️ 1. Fase Persiapan Basis Data (Prisma & Skema)

Langkah pertama adalah membuat *single source of truth* untuk semua skema tabel menggunakan Prisma, sekaligus memindahkan tabel user Supabase ke publik.

### A. Konversi Tabel `auth.users` ke Publik
Supabase menyimpan pengguna di skema `auth`. Kita perlu tabel baru di skema `public` yang kompatibel dengan NextAuth. Model dasar Prisma yang diperlukan:

```prisma
// schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id            String    @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  email         String    @unique
  password      String?   // Akan diisi dengan bcrypt hash hasil export Supabase
  name          String?
  image         String?
  emailVerified DateTime?
  createdAt     DateTime  @default(now()) @map("created_at")
  
  // Relasi Sistem Nizam ERP
  memberships   OrgMember[]
  journals      JournalEntry[]
  // dll...

  @@map("users")
}
```

### B. Membawa Logika RLS ke Backend Next.js
*Row Level Security (RLS)* milik Supabase secara otomatis mengamankan baris tabel. Pada Prisma, **kitalah yang menulis izinnya**.
Setiap akses database akan mengimplementasikan fungsi khusus `checkTenantAccess(userId, orgId)` sebelum kueri Prisma dijalankan.

**Contoh Refactoring Kode:**
```typescript
// SEBELUM (Supabase - RLS mengamankan otomatis)
const { data } = await supabase.from('accounts').select('*');

// SESUDAH (Prisma - eksplisit)
import prisma from "@/lib/prisma";

export async function getAccounts(orgId: string, userId: string) {
  // 1. Verifikasi Akses Tenant
  const membership = await prisma.orgMember.findFirst({
    where: { org_id: orgId, user_id: userId, is_active: true }
  });
  if (!membership) throw new Error("Unauthorized Tenant");

  // 2. Kueri ke DB dengan memastikan org_id dipakai
  return await prisma.accounts.findMany({
    where: { org_id: orgId }
  });
}
```

---

## 🔐 2. Fase Autentikasi (NextAuth)

### A. Setup Instalasi
Modul `@supabase/ssr` harus dihapus dari semua *route* login dan *middleware*. Sebaliknya, gunakan metode inisiasi pada *CredentialsProvider* bawaan NextAuth.

```typescript
// auth.ts (Konfigurasi NextAuth)
import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import prisma from "./lib/prisma"
import bcrypt from "bcrypt"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" }, // Karena kredensial, wajib pakai JWT
  providers: [
    CredentialsProvider({
      name: "Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        
        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });
        
        // Cek pass dengan enkripsi (disamakan dengan Supabase hash)
        if (user && user.password && bcrypt.compareSync(credentials.password, user.password)) {
          return user;
        }
        return null;
      }
    })
  ]
})
```

---

## 🗄️ 3. Proses Export-Import Data Aktual

Keamanan pada perpindahan data produksi adalah kritikal.
Proses harus dieksekusi dengan tahapan berikut saat aplikasi *maintenance*:

1. **Jeda Aktivitas (*Downtime* 1-2 Jam)**
   - Akses publik `nizam-app` ditutup sementara ke pengguna.
2. **Dump Data Ekstrak**
   - Lakukan ekspor pada Supabase melalui terminal *Command Line*:
     ```bash
     supabase db dump --data-only -f backup_data.sql
     ```
   - Secara khusus mengekstrak data dari skema `auth.users` ke file tersendiri:
     ```sql
     COPY (SELECT id, email, encrypted_password, raw_user_meta_data FROM auth.users) TO '/tmp/auth_users.csv' WITH CSV HEADER;
     ```
3. **Membangun Model Awal pada Server PostgreSQL Baru**
   - Lakukan `npx prisma db push` ke *database* baru. Ini akan menghasilkan struktur tabel bersih.
4. **Restorasi Data (Sedot ke PostgreSQL Baru)**
   - Integrasikan *file* `auth_users.csv` ke dalam tabel `users` publik. (Hash `encrypted_password` dari Supabase dapat dibaca oleh library `bcrypt`).
   - Masukkan (*import*) data lainnya (`organizations`, `org_members`, `journal_entries`, `accounts`, dll).

---

## 🔄 4. Penyesuaian Middleware Next.js

Peraturan navigasi rute privat (Private Route) seperti sesi wajib *(dashboard)* atau redirect ke `/(auth)/login` jika pengguna tidak dikenali harus ditulis ulang pada *middleware.ts* yang baru menggunakan abstraksi NextAuth.

```typescript
// middleware.ts 
import { auth } from "@/auth"

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthRoute = req.nextUrl.pathname.startsWith('/login');

  if (!isLoggedIn && !isAuthRoute) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }
})

// Mencegah Middleware terpanggil pada aset statis
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
```

---

## ✅ Kriteria Kesuksesan (Checklists Penyelesaian)

- [ ] Prisma diinstal dan berhasil *pull* skema *database*.
- [ ] Login, Regstrasi, Reset Password berfungsi penuh via NextAuth.
- [ ] Middleware berjalan untuk memblokir laman privat bagi *user* tak terautentikasi.
- [ ] Berfungsi fungsi RLS Supabase terganti dengan *Authorization Layer* di App backend NIZAM ERP. Terbukti mencegah pengguna A mengakses Jurnal Karyawan B yang berbeda *branch*/organisasi.
- [ ] Data profil, karyawan (employees), dan kehadiran (*attendance*) semua terhubungkan ke tabel ID `users` yang baru. 
- [ ] Lulus pengujian E2E *(End to End CI/CD validation)*.
