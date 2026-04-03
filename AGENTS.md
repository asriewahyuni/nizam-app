# AGENTS.md

## Gambaran Umum Codebase Nizam App
Repository `nizam-app` adalah sebuah solusi ERP (Enterprise Resource Planning) modern yang dikembangkan menggunakan TypeScript. Repository ini dirancang secara modular dan terstruktur untuk mendukung fitur seperti autentikasi pengguna, onboarding, dan pengelolaan basis data menggunakan Supabase.

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
  - `supabase/`: Konfigurasi dan helper untuk Supabase.
  - `email/`: Utilitas pengiriman email untuk invoice dan promosi.

- **`scripts/`**:
  Skrip untuk pengaturan dan pemeliharaan. Contoh:
  - `migrate-supabase-to-local.mjs`: Membantu migrasi data Supabase ke database lokal untuk pengujian.

- **`supabase/`**:
  Berisi skrip migrasi database dan implementasi kontrol akses berbasis peran (RBAC).

### 2. **Komponen Utama**
- **Komponen UI / Client-Side**:
  Tersedia dalam folder `app/demo/`, dirancang untuk interaksi dinamis menggunakan React hooks dan animasi (misalnya `DemoClient.tsx`).

- **Backend/Utilitas Server-Side**:
  Integrasi API seperti pengiriman email menggunakan library `Resend` untuk mengelola email transaksional (lihat `sender.ts`).

- **Integrasi Basis Data**:
  Repository ini menggunakan Supabase untuk pengelolaan database. Skrip migrasi database dan konfigurasi Supabase dapat ditemukan di `supabase/`.

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
   - Database: [Supabase](https://supabase.com).
   - Animasi: [Framer Motion](https://www.framer.com/motion/).

5. **Pengujian**:
   - Skrip seperti di `scripts/migrate-supabase-to-local.mjs` memastikan setup pengujian lokal berjalan lancar.

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
  Gunakan referensi dari `.env.example` untuk mengetahui variabel environment yang diperlukan, terutama kredensial Supabase.

### **Menjalankan Proyek Secara Lokal**
- Untuk pengembangan lokal dengan Supabase:
  ```bash
  npm run dev
  ```

### **Skrip dan Utilitas**
1. **Migrasi Database**:
   - Gunakan skrip di `scripts/migrate-supabase-to-local.mjs` untuk migrasi data Supabase secara lokal.

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
- [Dokumentasi Supabase](https://supabase.com/docs)
- [Dokumentasi Next.js](https://nextjs.org/docs)

Selamat Coding!