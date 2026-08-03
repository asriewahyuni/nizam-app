---
name: arief-ide
description: "Alur kerja coding personal Arief untuk repo nizam-app. Berisi checklist pre-flight (lint, typecheck, test) sebelum mulai dan sebelum menyelesaikan perubahan kode, konvensi commit message yang konsisten dengan histori repo, serta pengingat aturan wajib dari AGENTS.md (komentar modul, larangan Supabase SDK langsung, integrasi ERP anti-silo). Aktifkan setiap kali Arief mengimplementasikan, memperbaiki, atau mereview kode di nizam-app dari IDE."
---

# Arief IDE Workflow

Checklist pribadi Arief untuk bekerja di repo `nizam-app` melalui IDE (VS Code / Cursor / editor lain). Skill ini melengkapi `AGENTS.md` — bukan menggantikannya. Jika ada konflik, `AGENTS.md` yang menang.

## Kapan Dipakai

Aktifkan skill ini setiap kali Arief:
- Mengimplementasikan fitur atau memperbaiki bug di codebase
- Melakukan refactor pada file yang sudah ada
- Meminta review sebelum commit/push
- Menyiapkan perubahan untuk dijadikan pull request

## Sebelum Mulai Coding

1. Baca ulang bagian `AGENTS.md` yang relevan dengan area yang disentuh (mis. bagian Database, Auth, atau Aturan Wajib Integrasi ERP Core jika menyentuh modul transaksi/inventori/HRIS).
2. Cek apakah ada helper yang sudah ada di `lib/` (`lib/db/`, `lib/auth/`, `lib/erp-bridge/`, `lib/utils.ts`) sebelum menulis logic baru — jangan duplikasi.
3. Konfirmasi branch kerja benar (jangan commit langsung ke `main`).

## Saat Coding

- TypeScript ketat: tipe eksplisit, hindari `any`.
- Tailwind class dirapikan lewat `cn()` dari `lib/utils.ts`, bukan string concat manual.
- Query database selalu server-side lewat `lib/db/postgres.ts` atau `lib/supabase/server.ts` — jangan pernah import `@supabase/supabase-js` langsung untuk query data.
- Setiap modul baru wajib punya komentar singkat deskripsi fungsi (AGENTS.md aturan 8).
- Jika fitur menyentuh uang, stok fisik, atau staf: ikuti Aturan Wajib Integrasi ERP Core — jangan buat fitur silo. Cek `lib/erp-bridge/` dulu sebelum menulis wrapper baru.
- Jika menyentuh UI: ikuti alur UI/UX Pro Max Skill (`.claude/skills/ui-ux-pro-max/SKILL.md`) dan Standar Design Language di `AGENTS.md`.

## Pre-Flight — Sebelum Menyatakan Selesai

Jalankan sesuai area yang disentuh, jangan lewati begitu saja:

```bash
npm run lint                 # wajib jika ada file .ts/.tsx yang diubah
npx tsc --noEmit              # cek type error sebelum commit
npm run test                  # atau npm run test:erp jika hanya menyentuh modul ERP inti
```

Jika salah satu gagal karena kode yang diubah, perbaiki dulu — jangan commit dengan lint/type/test merah.

## Konvensi Commit Message

Ikuti gaya yang sudah konsisten di histori repo ini (lihat `git log --oneline`):

- Format: `<type>: <deskripsi singkat present-tense, huruf kecil, tanpa titik di akhir>`
- Type yang dipakai: `feat`, `fix`, `refactor` (sesuai pola commit terakhir di repo — jangan perkenalkan type baru seperti `chore`/`docs` kecuali memang sudah ada presedennya).
- Deskripsi menjelaskan efek perubahan, bukan proses (mis. `fix: update text from Lipat Semua Bab to Tutup Semua Bab in AdminLessonList`, bukan `fix: perbaikan teks`).

## Pre-Delivery Checklist

- [ ] Lint bersih
- [ ] `tsc --noEmit` bersih
- [ ] Test relevan lulus (`npm run test` / `npm run test:erp`)
- [ ] Tidak ada import `@supabase/supabase-js` baru untuk query data
- [ ] Modul baru punya komentar deskripsi singkat
- [ ] Transaksi uang/stok/staf (jika ada) sudah terhubung ke `lib/erp-bridge/` — bukan silo
- [ ] Commit message mengikuti konvensi repo
