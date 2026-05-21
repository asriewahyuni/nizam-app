# `lib/supabase/` — Compatibility Wrapper (NOT Supabase Cloud!)

> ⚠️ **PENTING:** Folder ini **TIDAK** menggunakan Supabase Cloud.
> Nama "supabase" hanya legacy untuk menjaga kompatibilitas import statement.

## Apa Ini?

Folder ini adalah **drop-in replacement** untuk Supabase JavaScript SDK, tapi semua query sebenarnya diarahkan ke **Railway PostgreSQL**.

Interface-nya dipertahankan sama dengan Supabase SDK agar:
- Tidak perlu rewrite 200+ file yang sudah pakai `createClient()`, `.from()`, `.rpc()`, dll
- Migrasi dari Supabase ke Railway tetap **zero breaking change** di level kode
- Developer experience tetap familiar

## Arsitektur Real

```
Application Code
       ↓
   lib/supabase/server.ts (compatibility layer)
       ↓
   lib/db/postgres-client.ts (Railway PostgreSQL native client)
       ↓
   Railway PostgreSQL Database
```

**TIDAK ADA** koneksi ke Supabase Cloud (`*.supabase.co`).

## File-File Disini

| File | Fungsi |
|------|--------|
| `server.ts` | Drop-in replacement untuk `createClient()`, `.from()`, `.rpc()`, `.auth.*` |
| `client.ts` | Browser-side client (legacy, sebagian besar tidak dipakai) |
| `auth.server.ts` | Internal auth wrapper (cookie-based, bukan Supabase Auth) |
| `config.ts` | Config compatibility layer |
| `loose.ts` | Type-loose helpers untuk RPC calls |
| `middleware.ts` | Middleware wrapper untuk session handling |

## Auth System

- **Provider:** Internal Auth (Nizam-native)
- **Cookie:** `nizam_internal_session`
- **NOT:** Supabase Auth (sudah disabled permanen)
- **Config:** `AUTH_PROVIDER=internal` di `.env`

## Mengapa Tidak Direname?

Sudah dievaluasi (2026-05-21):

1. **Risk Tinggi:** Rename = update import di 249 file. Risiko regression besar untuk benefit kosmetik.
2. **No User Impact:** User akhir tidak pernah lihat nama folder ini.
3. **No Business Value:** Tidak ngaruh ke UX, performance, atau monetization.
4. **Functional:** Wrapper ini bekerja sempurna, gak ada alasan teknis untuk rename.

**Keputusan:** Biarkan nama lama, tambah dokumentasi (file ini) agar tidak ada kebingungan.

## Untuk Developer Baru

Kalau lu baru join project dan bingung lihat `import { createClient } from '@/lib/supabase/server'`:

✅ **Yang benar:**
- Ini import ke wrapper Railway PostgreSQL
- Tidak ada koneksi ke Supabase Cloud
- `createClient().from('table').select()` = query ke Railway

❌ **Yang salah dipahami:**
- ~~"Project ini pakai Supabase"~~ → TIDAK
- ~~"Perlu Supabase API key"~~ → TIDAK
- ~~"Perlu setup Supabase project"~~ → TIDAK

## Referensi Migrasi

Kalau mau tahu detail migrasi Supabase → Railway:

- `MEMORY.md` (root project) → catatan migration completion
- `RAILWAY_DECOUPLING_PLAN.md` → blueprint migrasi
- `scripts/legacy/` → migration scripts (archived)

## Catatan untuk AI Agent / Future Refactor

Jika di masa depan mau rename folder ini:
1. Branch terpisah (bukan main)
2. Update **semua** import statements dengan sed/replace
3. Run full test suite
4. Verify build success
5. Manual smoke test untuk auth, queries, RPC
6. Estimate: ~2-4 jam kerja + risk regression

Untuk saat ini, **biarkan apa adanya**. Documentation > Refactoring untuk case ini.
