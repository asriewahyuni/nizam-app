# Alur Pendaftaran Anggota Kojasmat

Dokumen ini menjelaskan alur pendaftaran anggota baru koperasi syariah Kojasmat — mulai dari wizard publik yang diisi calon anggota, tes masuk, pembayaran, hingga verifikasi manual oleh pengurus (staf) sampai akun anggota aktif.

---

## 1. Ringkasan Alur

```
1. Isi Data Diri  →  2. Upload Dokumen  →  3. Tes Masuk  →  4. Transfer & Upload Bukti  →  5. MENUNGGU verifikasi pengurus  →  6. Pengurus klik Setujui  →  7. Anggota AKTIF
```

Poin penting: **status pendaftaran selalu berhenti di "Menunggu" setelah calon anggota mengupload bukti transfer.** Tidak ada jalur otomatis yang mengaktifkan akun tanpa keputusan eksplisit pengurus. Klik **Setujui** oleh pengurus adalah satu-satunya titik verifikasi bahwa dana benar-benar diterima.

---

## 2. Wizard Publik (Calon Anggota)

Halaman: [`app/anggota/daftar/DaftarClient.tsx`](../app/anggota/daftar/DaftarClient.tsx) — wizard 5 langkah: `data → dokumen → tes → bayar → selesai`.

### Langkah 1 — Data Diri
Server action: `buatPendaftaran` — [`modules/kojasmat/actions/kojasmat-membership.actions.ts:121`](../modules/kojasmat/actions/kojasmat-membership.actions.ts)

- Insert baris baru ke `kojasmat_pendaftaran` dengan `status` default `MENUNGGU`.
- Jika calon anggota mengisi email + password, langsung dibuatkan akun login (`internal_auth_users`, `user_type='anggota'`) supaya bisa lanjut ke portal setelah aktif tanpa menunggu kredensial dari pengurus.

### Langkah 2 — Upload Dokumen
KTP, dan dokumen pendukung lain disimpan ke tabel `kojasmat_dokumen` dengan `referensi_type='PENDAFTARAN'`.

### Langkah 3 — Tes Masuk
Server actions: [`modules/kojasmat/actions/kojasmat-test.actions.ts`](../modules/kojasmat/actions/kojasmat-test.actions.ts)

- `mulaiTestMasuk` (baris 177) — mengambil 20 soal acak dari `kojasmat_bank_soal`, membuat baris `kojasmat_test_masuk` dengan `passing_threshold` (default **70**, dapat diubah pengurus lewat pengaturan modul).
- `submitTestMasuk` (baris 233) — menghitung skor (`jumlah_benar / total_soal * 100`) lalu menandai `status`:
  - `skor >= passing_threshold` → **LULUS**
  - `skor < passing_threshold` → **GAGAL**
- Kalau **GAGAL**, calon anggota hanya diberi tombol "Coba Lagi" (attempt baru) — **tidak ada jalan ke tahap bayar** tanpa lulus. Validasi ini dicek dua kali: di UI (tombol lanjut cuma muncul kalau `LULUS`) dan di server (`submitPembayaranPendaftaran` menolak kalau tes terakhir bukan `LULUS`).

### Langkah 4 — Transfer & Upload Bukti
Server action: `submitPembayaranPendaftaran` — [`kojasmat-test.actions.ts:315`](../modules/kojasmat/actions/kojasmat-test.actions.ts)

1. Validasi ulang tes terakhir harus `LULUS` (defense-in-depth).
2. Simpan file bukti transfer ke `kojasmat_dokumen` (`jenis_dokumen='BUKTI_BAYAR'`).
3. Update `kojasmat_pendaftaran`: `status_bayar='SUDAH'`, `dibayar_at=NOW()`, simpan nominal `simpanan_pokok_dibayar`, `simpanan_wajib_dibayar`, `biaya_admin_dibayar`.
4. **`kojasmat_pendaftaran.status` TIDAK diubah di sini** — tetap `MENUNGGU`.

### Langkah 5 — Selesai (sisi calon anggota)
UI menampilkan pesan "Pembayaran Diterima — Menunggu Verifikasi" ([`DaftarClient.tsx:814`](../app/anggota/daftar/DaftarClient.tsx)) dan menjelaskan bahwa pengurus akan memverifikasi bukti transfer sebelum akun diaktifkan. Calon anggota **belum bisa login** di titik ini.

---

## 3. Verifikasi & Persetujuan Manual (Pengurus)

Panel admin: `TabPermohonan` di [`app/(kojasmat-internal)/kojasmat/KojasmatClient.tsx`](<../app/(kojasmat-internal)/kojasmat/KojasmatClient.tsx>) — tab **Permohonan**, filter default `MENUNGGU`.

Untuk setiap pendaftaran, pengurus melihat:
- Data diri & dokumen (termasuk bukti transfer yang diupload)
- Riwayat tes masuk (skor, status LULUS/GAGAL, jumlah percobaan)
- Rincian pembayaran: Simpanan Pokok, Simpanan Wajib, Admin Keanggotaan, total, tanggal bayar

Lalu pengurus memilih salah satu aksi:

| Aksi | Server action | Efek |
|---|---|---|
| **Setujui** | `setujuiPendaftaran` | Lihat detail di §4 |
| **Tolak** | `tolakPendaftaran` | `status='DITOLAK'`, tersimpan catatan alasan |
| **Minta Revisi** | `mintaRevisiPendaftaran` | `status='DIREVISI'`, calon anggota bisa perbaiki data/dokumen lalu submit ulang |

Semua aksi ini butuh sesi staf yang login (`getInternalAuthSession()`) — **bukan** aksi self-service publik.

---

## 4. `setujuiPendaftaran` — Titik Aktivasi

Fungsi: [`modules/kojasmat/actions/kojasmat-membership.actions.ts:setujuiPendaftaran`](../modules/kojasmat/actions/kojasmat-membership.actions.ts)

```ts
const data = await createAnggotaFromPendaftaran(pend, {
  status: pend.status_bayar === 'SUDAH' ? 'AKTIF' : 'CALON',
  reviewedBy: getInternalUserId(session),
})
```

- **`status_bayar === 'SUDAH'`** (calon anggota sudah lulus tes + upload bukti transfer, dan pengurus baru saja memverifikasinya lewat klik Setujui) → anggota langsung **AKTIF**:
  - `kojasmat_anggota.status='AKTIF'`, `is_verified=TRUE`
  - Setoran Simpanan Pokok & Simpanan Wajib diposting ke `kojasmat_simpanan_mutasi` (via `postSimpananMutasi`) — masuk jurnal akuntansi
  - Biaya Admin Keanggotaan diposting ke jurnal pendapatan (`jurnalPendapatanBiayaAdmin`)
  - Akun login (`internal_auth_users`) dipastikan ada — dibuatkan kalau belum (mis. pendaftaran lama tanpa akun dari Langkah 1)
  - `kojasmat_pendaftaran.status='DISETUJUI'`, `ditinjau_oleh=<user pengurus>`, `ditinjau_at=NOW()`
- **`status_bayar !== 'SUDAH'`** (pendaftaran offline/manual tanpa pembayaran online — misal input langsung oleh staf) → anggota dibuat dengan status **CALON**, `is_verified=FALSE`, **tanpa** posting setoran (karena belum ada pembayaran tercatat untuk diposting).

Hasil approve menampilkan **modal kredensial** ke pengurus (kode anggota + password sementara + tombol "Salin Pesan WA") untuk diteruskan ke anggota — pola yang sama dipakai di form "Anggota Baru" manual dan hasil bulk import Excel.

---

## 5. Skema Status

### `kojasmat_pendaftaran.status`
| Nilai | Arti |
|---|---|
| `MENUNGGU` | Default. Menunggu tindakan pengurus (baik belum bayar, maupun sudah bayar tapi belum diverifikasi). |
| `DIREVISI` | Pengurus minta calon anggota memperbaiki data/dokumen. |
| `DISETUJUI` | Sudah diproses lewat `setujuiPendaftaran` (baik jadi CALON atau AKTIF — cek `kojasmat_anggota.status` untuk detail). |
| `DITOLAK` | Ditolak pengurus, tidak lanjut jadi anggota. |

### `kojasmat_pendaftaran.status_bayar`
Kolom terpisah dari `status` — independen, menandakan apakah bukti transfer sudah diupload atau belum:
| Nilai | Arti |
|---|---|
| `BELUM` | Belum upload bukti transfer (atau belum lulus tes, sehingga belum bisa lanjut ke tahap bayar). |
| `SUDAH` | Bukti transfer sudah diupload — **belum tentu berarti dana sudah diverifikasi diterima**, itulah kenapa persetujuan pengurus tetap wajib. |

### `kojasmat_anggota.status`
| Nilai | Arti |
|---|---|
| `CALON` | Anggota dari pendaftaran yang di-approve tanpa pembayaran online tercatat (`is_verified=FALSE`). |
| `AKTIF` | Anggota penuh, sudah lolos verifikasi pembayaran pengurus (`is_verified=TRUE`). |
| `TIDAK_AKTIF` | Nonaktif (diatur manual belakangan). |
| `DIBEKUKAN` | Dibekukan — login diblokir (lihat `signInAsAnggota`). |

---

## 6. Tabel Database Terkait

| Tabel | Migrasi | Catatan |
|---|---|---|
| `kojasmat_pendaftaran` | `1354_kojasmat_membership_complete.sql`, `1378_kojasmat_pendaftaran_pembayaran.sql`, `1380_kojasmat_pendaftaran_simpanan_wajib_dibayar.sql` | `status`, `status_bayar`, nominal bayar, `bukti_bayar_dokumen_id` |
| `kojasmat_test_masuk` | `1377_kojasmat_test_masuk.sql` | `skor`, `passing_threshold`, `status` (`BERLANGSUNG`/`LULUS`/`GAGAL`), `attempt_number` |
| `kojasmat_bank_soal` | `1377_kojasmat_test_masuk.sql` | Bank soal untuk tes masuk |
| `kojasmat_dokumen` | — | Dokumen KTP, bukti transfer (`jenis_dokumen='BUKTI_BAYAR'`), dsb. `referensi_type` berpindah dari `PENDAFTARAN` ke `ANGGOTA` saat approve. |
| `kojasmat_anggota` | `1351_kojasmat_rebuild.sql` | `user_id` → FK ke `internal_auth_users(id)` (**bukan** `legacy_user_id` — lihat §7) |
| `kojasmat_simpanan` / `kojasmat_simpanan_mutasi` | — | 3 rekening otomatis (POKOK/WAJIB/SUKARELA) dibuat saat anggota dibuat |
| `internal_auth_users` | — | Kredensial login anggota (email/NIK + password scrypt) |

---

## 7. Login Anggota — Resolusi User ID

Anggota login lewat `/anggota/login` dengan **kode anggota + password**, bukan email langsung. Detail lengkap: [`modules/kojasmat/actions/kojasmat-auth.actions.ts`](../modules/kojasmat/actions/kojasmat-auth.actions.ts).

Catatan penting: `session.user.id` dari `getInternalAuthSession()` berisi **legacy_user_id** (id lama dari `auth.users`) kalau ada, **bukan** `internal_auth_users.id` — sedangkan `kojasmat_anggota.user_id` adalah FK ke `internal_auth_users(id)`. Dua ID ini **berbeda UUID**. Untuk mencari data anggota dari sesi yang sedang login, selalu resolve dulu lewat `resolveInternalUserId(session)` dari [`lib/auth/internal-auth.shared.ts`](../lib/auth/internal-auth.shared.ts) — jangan pakai `session.user.id` mentah untuk query `kojasmat_anggota.user_id`.

---

## 8. Riwayat Perubahan Penting

- **Sebelumnya**: begitu tes `LULUS` + bukti transfer diupload, sistem otomatis mengaktifkan anggota (`cobaAktivasiOtomatis`) tanpa keterlibatan pengurus sama sekali — file bukti transfer diupload sudah cukup untuk dianggap "dana diterima", tanpa verifikasi manual apa pun.
- **Sekarang**: jalur otomatis tersebut dihapus. Status pendaftaran selalu berhenti di `MENUNGGU` setelah pembayaran disubmit; pengurus wajib klik **Setujui** secara manual, dan klik itulah yang memicu aktivasi anggota + posting setoran ke jurnal.
- Anggota yang dibuat manual (form "Anggota Baru") maupun lewat bulk import Excel sekarang otomatis diprovisikan akun login (`internal_auth_users`) — sebelumnya anggota hasil input manual/bulk tidak pernah punya kredensial sama sekali sehingga tidak bisa login walau kode anggota benar.
