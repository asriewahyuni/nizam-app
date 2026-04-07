# AGENTS.md

## Gambaran Umum Codebase Nizam App
Repository `nizam-app` adalah sebuah solusi ERP (Enterprise Resource Planning) modern yang dikembangkan menggunakan TypeScript. Repository ini dirancang secara modular dan terstruktur untuk mendukung fitur seperti autentikasi pengguna, onboarding, dan pengelolaan basis data menggunakan Prisma + PostgreSQL, dengan autentikasi berbasis NextAuth.

Panduan ini ditujukan untuk asisten AI agar memahami struktur kode, konvensi, dan alur kerja pengembangan dalam repository ini.

---

## Struktur Codebase
### 1. **Direktori Utama**
- **`app/`**:
  Berisi halaman dan layout bawaan Next.js. Contoh:
  - `page.tsx`: Logika untuk mengarahkan pengguna berdasarkan sesi login dan status organisasi.
  - `layout.tsx`: Mendefinisikan tata letak utama termasuk metadata.
  - `demo/`: Komponen untuk sesi demo (misalnya `DemoClient.tsx`).

- **`lib/`**:
  Library utilitas dan integrasi eksternal.
  - `utils.ts`: Fungsi utilitas umum (misalnya, format mata uang, membuat slug).
  - `prisma.ts`: Bootstrap client Prisma untuk akses database PostgreSQL.
  - `email/`: Utilitas pengiriman email untuk invoice dan promosi.

- **`scripts/`**:
  Skrip untuk pengaturan dan pemeliharaan internal repository.

- **`supabase/`**:
  Berisi arsip migrasi SQL historis proyek. Folder ini dipertahankan sebagai jejak evolusi skema, tetapi runtime aplikasi tidak lagi memakai client/helper Supabase.

### 2. **Komponen Utama**
- **Komponen UI / Client-Side**:
  Tersedia dalam folder `app/demo/`, dirancang untuk interaksi dinamis menggunakan React hooks dan animasi (misalnya `DemoClient.tsx`).

- **Backend/Utilitas Server-Side**:
  Integrasi API seperti pengiriman email menggunakan library `Resend` untuk mengelola email transaksional (lihat `sender.ts`).

- **Integrasi Basis Data**:
  Runtime repository ini sekarang menggunakan Prisma untuk akses PostgreSQL. Guard akses tenant/branch dilakukan di layer aplikasi, bukan lagi melalui client Supabase.

---

## Konvensi dan Praktik Terbaik
1. **Penggunaan Bahasa**:
   - Dominan dikembangkan menggunakan TypeScript (~84% dari keseluruhan repository).
   - Bagian tertentu (misalnya migrasi database) menggunakan PLpgSQL.

2. **Styling**:
   - Kelas TailwindCSS dirapikan menggunakan `clsx` dan `tailwind-merge` melalui fungsi `cn` di `utils.ts`.

3. **Penanganan Error**:
   - Error harus selesai disanitasi (contoh: `getErrorMessage` dalam `email/sender.ts`).

4. **Library Pihak Ketiga**:
   - Email: [Resend API](https://resend.com).
   - Database ORM: [Prisma](https://www.prisma.io/).
   - Animasi: [Framer Motion](https://www.framer.com/motion/).

5. **Pengujian**:
   - Gunakan Vitest (`npm test`) untuk validasi logic unit/integration repository.

6. **Dokumentasi Kode**:
   Setiap modul wajib memiliki komentar dengan deskripsi fungsinya untuk meningkatkan keterbacaan.

---

## Alur Kerja Pengembangan
### **Persiapan Lingkungan**
- Clone repository:
  ```bash
  git clone https://github.com/asriewahyuni/nizam-app.git
  ```
- Instal dependensi:
  ```bash
  npm install
  ```
- Setel environment variables:
  Gunakan referensi dari `.env.example` / `.env.local.example` untuk mengetahui variabel environment yang diperlukan, terutama `DATABASE_URL`, auth secret, dan kredensial email.

### **Menjalankan Proyek Secara Lokal**
- Untuk pengembangan lokal:
  ```bash
  npm run dev
  ```

### **Skrip dan Utilitas**
1. **Migrasi Database**:
   - Gunakan workflow migrasi PostgreSQL/Prisma yang berlaku di repository.

2. **Pengujian Pengiriman Email**:
   - Email (misalnya, invoice) dapat diuji menggunakan utilitas di `lib/email/sender.ts`.

---

## Catatan Penting untuk Asisten AI
1. Ikuti praktik terbaik TypeScript: Gunakan tipe yang ketat dan hindari `any` sebisa mungkin.
2. Jika memperluas fungsi utilitas seperti `lib/utils.ts`, pastikan dapat digunakan ulang.
3. Jangan pernah lakukan hardcode pada konfigurasi; selalu gunakan variabel lingkungan.
4. Validasi input di komponen klien dan sanitasi data sensitif sebelum mengirimkan ke API.

---

Untuk informasi lebih lanjut, para kontributor dapat membuka:
- [Dokumentasi Prisma](https://www.prisma.io/docs)
- [Dokumentasi Next.js](https://nextjs.org/docs)

Selamat Coding!
