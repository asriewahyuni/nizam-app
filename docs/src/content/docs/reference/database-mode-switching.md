---
title: "Mode Database dan Runtime"
description: "Dokumen ini menjelaskan cara memindahkan aplikasi NIZAM antara database lokal dan Railway, plus cara memastikan aplikasi sedang memakai database yang mana."
sidebar:
  label: "Mode Database dan Runtime"
---

> Dokumen ini disinkronkan otomatis dari file sumber `database-mode-switching.md` di root project docs.

Dokumen ini menjelaskan cara memindahkan aplikasi NIZAM antara database lokal dan Railway, plus cara memastikan aplikasi sedang memakai database yang mana.

## Kapan Pakai `.env` dan Kapan Pakai `.env.local`

Gunakan aturan sederhana ini:

- **`.env`**
  Dipakai sebagai **baseline** atau referensi default project.
- **`.env.local`**
  Dipakai untuk **override di mesin Anda sendiri**.

Dalam praktik repo ini:

- kalau variabel yang sama ada di `.env` dan `.env.local`, anggap `.env.local` yang menang
- kalau Anda ingin pindah aplikasi dari lokal ke Railway atau sebaliknya, file yang biasa Anda edit adalah **`.env.local`**
- `.env` sebaiknya jangan dijadikan tempat gonta-ganti mode kerja harian

Cara berpikir paling aman:

- `.env` = bawaan atau acuan dasar project
- `.env.local` = pilihan runtime aktif milik laptop atau mesin Anda

### Kapan edit `.env`

Edit `.env` hanya kalau Anda memang ingin mengubah **baseline bersama** atau referensi default project, misalnya:

- tim memang sepakat mengganti nilai acuan bawaan
- Anda sedang merapikan template atau referensi env project
- Anda sedang mengubah konfigurasi default yang memang harus berlaku umum

### Kapan edit `.env.local`

Edit `.env.local` kalau Anda ingin mengubah **cara aplikasi berjalan di mesin Anda sekarang**, misalnya:

- pindah dari DB lokal ke Railway
- pindah dari Railway ke DB lokal
- mencoba database clone lokal
- mengganti secret atau URL hanya untuk laptop Anda

Untuk kebutuhan kerja harian, hampir selalu yang Anda ubah adalah **`.env.local`**.

## Inti Yang Paling Penting

Di codebase ini, sumber database runtime utama dibaca dengan urutan ini:

1. `DATABASE_URL`
2. `RAILWAY_DATABASE_URL`
3. `DATABASE_PUBLIC_URL`

Artinya:

- kalau `DATABASE_URL` diisi ke localhost, aplikasi akan pakai database lokal
- kalau `DATABASE_URL` diisi ke Railway, aplikasi akan pakai Railway
- kalau `DATABASE_URL` dikosongkan, aplikasi akan jatuh ke `RAILWAY_DATABASE_URL` bila variabel itu ada
- kalau nilai ini ada di `.env` dan `.env.local`, anggap nilai dari `.env.local` yang dipakai saat kerja lokal

File referensinya ada di [`lib/db/postgres.ts`](/Users/idyogi/Local-Project/nizamapp/nizam-app/lib/db/postgres.ts:1).

## Cara Cek Mode Aktif

### Cara paling mudah

Jalankan:

```bash
npm run db:runtime:show
```

Command ini akan menampilkan:

- mode aktif: `local-postgres`, `railway-postgres`, atau `remote-postgres`
- env yang sedang menang: `DATABASE_URL`, `RAILWAY_DATABASE_URL`, atau `DATABASE_PUBLIC_URL`
- host, port, dan nama database aktif

Script-nya ada di [`scripts/show-runtime-db.mjs`](/Users/idyogi/Local-Project/nizamapp/nizam-app/scripts/show-runtime-db.mjs:1).

### Cara kedua

Lihat langsung nilai `DATABASE_URL` di [`.env.local`](/Users/idyogi/Local-Project/nizamapp/nizam-app/.env.local:1).

- jika host-nya `127.0.0.1`, `localhost`, atau `::1`, berarti aplikasi sedang ke lokal
- jika host-nya `*.rlwy.net` atau `*.railway.internal`, berarti aplikasi sedang ke Railway

### Cara ketiga

Saat aplikasi hidup, buka:

- `/api/healthz`
- `/api/healthz-db`

Sekarang endpoint itu sudah menampilkan:

- `runtimeDatabaseMode`
- `runtimeDatabaseSource`

Catatan:

- `supabaseTarget` di `/api/healthz` adalah indikator legacy
- `supabaseTarget` **bukan** sumber kebenaran database runtime

## Cara Ubah ke Railway

### Opsi paling aman

Di [`.env.local`](/Users/idyogi/Local-Project/nizamapp/nizam-app/.env.local:1):

1. ubah `DATABASE_URL` menjadi URL Railway
2. atau kosongkan `DATABASE_URL` agar runtime jatuh ke `RAILWAY_DATABASE_URL`
3. simpan file
4. restart aplikasi

Contoh paling jelas:

```ini
DATABASE_URL=postgresql://postgres:...@maglev.proxy.rlwy.net:25780/railway
RAILWAY_DATABASE_URL=postgresql://postgres:...@maglev.proxy.rlwy.net:25780/railway
```

Setelah itu:

```bash
npm run db:runtime:show
npm run dev
```

Yang harus Anda lihat:

- mode: `railway-postgres`
- sumber env: biasanya `DATABASE_URL`

### Opsi fallback

Kalau Anda ingin tetap menyimpan `RAILWAY_DATABASE_URL` sebagai sumber online utama:

1. hapus isi `DATABASE_URL`
2. pastikan `RAILWAY_DATABASE_URL` tetap berisi URL Railway
3. restart aplikasi

Contoh:

```ini
DATABASE_URL=
RAILWAY_DATABASE_URL=postgresql://postgres:...@maglev.proxy.rlwy.net:25780/railway
```

Hasilnya runtime akan jatuh ke `RAILWAY_DATABASE_URL`.

## Cara Ubah ke Lokal

Di [`.env.local`](/Users/idyogi/Local-Project/nizamapp/nizam-app/.env.local:1):

1. isi `DATABASE_URL` dengan URL PostgreSQL lokal
2. biarkan `RAILWAY_DATABASE_URL` tetap ada untuk kebutuhan clone atau referensi
3. restart aplikasi

Contoh:

```ini
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5431/nizamapp
RAILWAY_DATABASE_URL=postgresql://postgres:...@maglev.proxy.rlwy.net:25780/railway
```

Setelah itu:

```bash
npm run db:runtime:show
npm run dev
```

Yang harus Anda lihat:

- mode: `local-postgres`
- sumber env: `DATABASE_URL`

## Workflow Yang Disarankan

### Jika mau kerja harian di lokal

1. clone data dari Railway ke lokal jika perlu

```bash
npm run db:clone:local
```

2. pakai `DATABASE_URL` lokal
3. cek dengan `npm run db:runtime:show`
4. jalankan `npm run dev`

### Jika mau balik cek data langsung ke Railway

1. ganti `DATABASE_URL` ke Railway atau kosongkan
2. cek dengan `npm run db:runtime:show`
3. restart `npm run dev`

## Hal Yang Sering Membingungkan

### 1. `NEXT_PUBLIC_SUPABASE_TARGET=remote`, tapi database ternyata lokal

Itu bisa terjadi dan memang normal di codebase ini.

Penyebabnya:

- `NEXT_PUBLIC_SUPABASE_TARGET` hanya sisa indikator compatibility layer
- runtime data utama tetap dibaca dari `DATABASE_URL` lalu fallback ke `RAILWAY_DATABASE_URL`

### 2. `AUTH_PROVIDER=internal` apakah harus diubah saat pindah database?

Biasanya tidak.

Kalau Anda tetap memakai tabel auth internal di database lokal maupun Railway, `AUTH_PROVIDER=internal` tetap bisa dipakai.

### 3. Kenapa Railway URL masih ada walau saya kerja di lokal?

Supaya:

- Anda bisa clone ulang dari online ke lokal
- Anda bisa cepat balik ke Railway tanpa mencari URL lagi

## Checklist Setelah Ganti Mode

Setelah mengubah koneksi database:

1. jalankan `npm run db:runtime:show`
2. restart aplikasi
3. cek `GET /api/healthz`
4. cek `GET /api/healthz-db`
5. buka `/login`
6. pastikan data yang muncul sesuai target yang Anda inginkan
