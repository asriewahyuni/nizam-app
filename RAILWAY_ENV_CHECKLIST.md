# Railway Environment Checklist

Checklist ini dipakai untuk memastikan service `nizam-app` di Railway konsisten dengan arsitektur runtime saat ini: **NextAuth + Prisma + PostgreSQL**.

## 1. Wajib untuk App Boot

### `DATABASE_URL`

Harus menunjuk ke PostgreSQL Railway target.

Contoh:

```env
DATABASE_URL=postgresql://postgres:<password>@maglev.proxy.rlwy.net:25780/railway
```

Dipakai oleh:

- `lib/prisma.ts`
- `auth.ts`
- semua server actions Prisma

### `AUTH_SECRET`

Dipakai oleh NextAuth/Auth.js dan proxy auth.

```env
AUTH_SECRET=<random-long-secret>
```

Catatan:

- `proxy.ts` menerima `NEXTAUTH_SECRET || AUTH_SECRET`
- cukup set `AUTH_SECRET` jika ingin sederhana

### `NEXTAUTH_URL`

Harus mengarah ke URL publik Railway untuk app.

```env
NEXTAUTH_URL=https://<your-app-domain>.up.railway.app
```

Dipakai untuk callback/session/auth URL resolution.

---

## 2. Sangat Disarankan

### `NEXT_PUBLIC_SITE_URL`

Dipakai di client untuk membentuk URL absolut tertentu.

```env
NEXT_PUBLIC_SITE_URL=https://<your-app-domain>.up.railway.app
```

### `APP_URL`

Dipakai pada reset password link builder di `modules/auth/actions/auth.actions.ts`.

```env
APP_URL=https://<your-app-domain>.up.railway.app
```

Fallback di code:

1. `APP_URL`
2. `NEXT_PUBLIC_APP_URL`
3. `http://localhost:3000`

Jadi untuk production Railway, set `APP_URL` agar email reset password tidak mengarah ke localhost.

---

## 3. Opsional, Tergantung Fitur yang Dipakai

### Email / Resend

Jika fitur invoice email, promo broadcast, atau reset password email dipakai:

```env
RESEND_API_KEY=<your-resend-key>
```

Dipakai oleh:

- `lib/email/sender.ts`

Tanpa ini:

- app tetap bisa boot
- tapi email delivery akan gagal

### AI Features

Jika fitur AI/sales page/vision dipakai:

```env
GOOGLE_AI_STUDIO_KEY=<your-google-ai-studio-key>
```

Dipakai oleh:

- `modules/sales/lib/sales-page.server.ts`
- `modules/ai/actions/vision.actions.ts`

### Object Storage / Spaces

Jika app masih memakai DigitalOcean Spaces / S3-compatible storage di flow tertentu:

```env
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
AWS_DEFAULT_REGION=sgp1
AWS_BUCKET=nizam
AWS_USE_PATH_STYLE_ENDPOINT=false
AWS_ENDPOINT=https://sgp1.digitaloceanspaces.com/
AWS_URL=https://nizam.sgp1.digitaloceanspaces.com
```

Catatan:

- beberapa upload flow sekarang sudah dipindah ke public/local helper
- tapi bila service tertentu masih mengandalkan object storage eksternal, env ini perlu tetap tersedia

---

## 4. Tidak Perlu Lagi untuk Runtime App Ini

Setelah migrasi selesai, env berikut **bukan dependency runtime utama app**:

```env
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ACCESS_TOKEN
SUPABASE_PASSWORD
```

Catatan:

- masih boleh disimpan untuk arsip/migrasi/debug
- tapi app production Railway sekarang **tidak bergantung** pada env Supabase di atas untuk boot/runtime utama

---

## 5. Checklist Minimum Railway Dashboard

Untuk service `nizam-app`, pastikan minimal ini ada:

- [ ] `DATABASE_URL`
- [ ] `AUTH_SECRET`
- [ ] `NEXTAUTH_URL`
- [ ] `APP_URL`
- [ ] `NEXT_PUBLIC_SITE_URL`

Jika fitur email dipakai:

- [ ] `RESEND_API_KEY`

Jika fitur AI dipakai:

- [ ] `GOOGLE_AI_STUDIO_KEY`

Jika fitur storage eksternal dipakai:

- [ ] `AWS_ACCESS_KEY_ID`
- [ ] `AWS_SECRET_ACCESS_KEY`
- [ ] `AWS_DEFAULT_REGION`
- [ ] `AWS_BUCKET`
- [ ] `AWS_ENDPOINT`
- [ ] `AWS_URL`

---

## 6. Checklist Konsistensi App ↔ DB Railway

Sesudah env diset:

1. deploy service `nizam-app`
2. pastikan runtime log menampilkan start command standalone:

```txt
HOSTNAME=0.0.0.0 node .next/standalone/server.js
```

3. jalankan smoke check:

- [ ] halaman login terbuka
- [ ] login owner berhasil
- [ ] dashboard terbuka
- [ ] org aktif terbaca
- [ ] page penting (`/cash`, `/hris`, `/inventory`, `/factory`, `/contacts`, `/purchasing`) terbuka

4. validasi auth runtime tables di DB Railway:

- [ ] `auth.users` ada
- [ ] `public.users` ada
- [ ] jumlah `public.users` sesuai sinkronisasi auth runtime

---

## 7. Kondisi Repo Saat Ini yang Sudah Relevan untuk Railway

Repo sudah dipersiapkan untuk deploy Railway dengan:

- `package.json`
  - `build = prisma generate && next build`
  - `start = HOSTNAME=0.0.0.0 node .next/standalone/server.js`
  - `postinstall = prisma generate`
- `nixpacks.toml`
  - install/build/start command eksplisit agar tidak tergantung auto-detect stale

---

## 8. Catatan Operasional

Jika ingin audit env yang benar-benar sudah terpasang di Railway, jalankan ulang:

```bash
railway login
railway variables --service "nizam-app"
```

Saat checklist ini dibuat, command `railway variables` sedang mengembalikan `Unauthorized`, jadi checklist ini disusun dari **codebase aktif** dan **bukan snapshot langsung dari dashboard Railway**.
