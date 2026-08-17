# Alur Kerja Modul Klinik Pratama

Dokumen ini menjelaskan alur operasional modul Klinik Pratama — mulai dari pendaftaran pasien (walk-in maupun booking online), pemeriksaan & rekam medis, apotek, sampai kasir & billing. Modul ini **standalone** (route group sendiri, pola sama seperti Kojasmat) tapi **wajib terhubung ke ERP core** lewat [`lib/erp-bridge/klinik-journals.ts`](../lib/erp-bridge/klinik-journals.ts), sesuai HUKUM BESI ANTI-SILO di `AGENTS.md`.

Rencana arsitektur lengkap (alasan tiap keputusan desain): `/Users/manbook/.claude/plans/deep-swimming-lerdorf.md`.

---

## 1. Ringkasan Alur

```
                     ┌─────────────────────┐
Publik (tanpa login) │  Booking Online      │
                     │  /klinik/daftar/...  │──┐
                     └─────────────────────┘  │
                                               ▼
Staf (loket)   1. Pendaftaran/Check-in  →  klinik_kunjungan (status MENUNGGU)
                        │
                        ▼ (klik "Panggil")
               2. status DIPERIKSA  →  buka panel pemeriksaan:
                        │                 ├─ Rekam Medis (draft → final)
                        │                 └─ Resep → Apotek (dispensing FEFO)
                        ▼ ("Selesaikan Pemeriksaan")
               3. status SELESAI  →  Kasir & Tagihan (gabung layanan+obat → bayar/void)
```

Poin penting: **nomor antrian & booking sama-sama bermuara ke satu tabel `klinik_kunjungan`** — booking online cuma cara lain untuk mengisi antrian (lewat check-in di loket pada hari-H), bukan alur terpisah. Ini supaya rekam medis, resep, dan kasir tidak perlu tahu apakah pasiennya datang lewat booking atau walk-in.

---

## 2. Pendaftaran

### 2a. Walk-in (loket)

UI: tab **Pendaftaran & Antrian** di [`app/(klinik-internal)/klinik/KlinikClient.tsx`](<../app/(klinik-internal)/klinik/KlinikClient.tsx>).

1. Pilih **Poli** (atau buat baru lewat "+ Poli Baru" — `createKlinikPoli`, [`klinik.actions.ts:34`](../modules/klinik/actions/klinik.actions.ts)).
2. Cari pasien (`searchKlinikPasien`, [`klinik-pasien.actions.ts:44`](../modules/klinik/actions/klinik-pasien.actions.ts)) — dibatasi cabang yang bisa diakses staf non-admin lewat `getBranchAccessScope`, kecuali pasien itu pernah punya kunjungan di cabang yang bisa staf akses (supaya pasien lama dari cabang lain tetap ketemu, menghindari rekam medis dobel).
3. Kalau belum terdaftar: **"Pasien belum terdaftar? Daftarkan baru"** → `createKlinikPasien` ([`klinik-pasien.actions.ts:81`](../modules/klinik/actions/klinik-pasien.actions.ts)) — `no_rm` di-generate otomatis (`RM-000001`, dst) dengan retry kalau bentrok (loket lain input bersamaan).
4. Isi jenis kunjungan (Umum/BPJS/Asuransi) + keluhan → **"Daftar & Ambil Nomor Antrian"** → `createKunjunganWalkIn` ([`klinik-kunjungan.actions.ts:34`](../modules/klinik/actions/klinik-kunjungan.actions.ts)) — `no_antrian` di-generate MAX+1 dengan retry per **(cabang, poli, tanggal)**, bukan `COUNT(*)` (pola sama dipakai penomoran jurnal, mencegah tabrakan saat beberapa loket input bersamaan).

### 2b. Booking Online (publik)

Halaman publik tanpa login: `app/klinik/daftar/[branchId]/page.tsx` + [`BookingClient.tsx`](<../app/klinik/daftar/[branchId]/BookingClient.tsx>).

1. Pasien pilih **Poli** + **Tanggal** → `getAvailableSlots` ([`klinik-booking.actions.ts:29`](../modules/klinik/actions/klinik-booking.actions.ts)) menghitung slot 30 menit dari `klinik_jadwal_praktik` (jadwal rutin dokter) dikurangi `klinik_jadwal_pengecualian` (cuti/libur) dikurangi `klinik_slot_hold` yang sudah terisi.
2. Pilih slot → isi nama + kontak + keluhan → `createBookingSlot` ([`klinik-booking.actions.ts:106`](../modules/klinik/actions/klinik-booking.actions.ts)) — insert ke `klinik_slot_hold` langsung status `CONFIRMED` (tanpa akun/login, mirip booking dokter pada umumnya).
3. **Anti-double-booking ditegakkan di level database**, bukan cuma logic TS: constraint `EXCLUDE USING gist` di `klinik_slot_hold` (`supabase/migrations/1430_klinik_pratama_booking.sql`) menolak dua slot yang tumpang tindih untuk dokter yang sama, walau dua orang klik slot yang sama persis bersamaan. Kalau bentrok, `createBookingSlot` menangkap error `23P01` dan otomatis muat ulang daftar slot.

### 2c. Check-in Booking (loket, hari-H)

Section **"Booking Hari Ini — Belum Check-in"** muncul otomatis di atas antrian kalau ada booking `CONFIRMED` untuk poli yang dipilih (`getConfirmedBookingsToday`, [`klinik-booking.actions.ts:154`](../modules/klinik/actions/klinik-booking.actions.ts)).

Klik **"Check-in"** → `checkInBooking` ([`klinik-booking.actions.ts:171`](../modules/klinik/actions/klinik-booking.actions.ts)):
1. Cari `klinik_pasien` dengan `no_hp` yang cocok dengan kontak booking — kalau ketemu, dipakai ulang; kalau tidak, dibuat baru (`createKlinikPasien`).
2. Buat `klinik_kunjungan` lewat `createKunjunganWalkIn` yang sama (dapat nomor antrian normal), lalu tandai `sumber='BOOKING'` dan `staf_medis_id` sesuai dokter yang di-booking.
3. `klinik_slot_hold.status` → `CHECKED_IN`, `kunjungan_id` ditautkan.

---

## 3. Rekam Medis

Panel muncul saat baris antrian di-expand (ikon ▾, hanya tampil untuk status **Diperiksa**/**Selesai**) — [`PemeriksaanPanel.tsx`](<../app/(klinik-internal)/klinik/PemeriksaanPanel.tsx>).

- **Draft**: `saveRekamMedisDraft` ([`klinik-rekam-medis.actions.ts:74`](../modules/klinik/actions/klinik-rekam-medis.actions.ts)) — bisa disimpan berkali-kali selama status masih `DRAFT`, tiap perubahan dicatat ke `klinik_rekam_medis_history` (action `CREATED`/`UPDATED`, snapshot before/after dalam JSONB).
- **Finalisasi**: `finalizeRekamMedis` ([`klinik-rekam-medis.actions.ts:153`](../modules/klinik/actions/klinik-rekam-medis.actions.ts)) — set status `FINAL` + `finalized_at`, **dan otomatis mengubah `klinik_kunjungan.status` jadi `SELESAI`** dalam transaksi yang sama. Field klinis (anamnesis/diagnosis/terapi) **terkunci** setelah ini.
- **Addendum**: `addRekamMedisAddendum` ([`klinik-rekam-medis.actions.ts:201`](../modules/klinik/actions/klinik-rekam-medis.actions.ts)) — satu-satunya cara koreksi setelah `FINAL`. Teks baru **ditambahkan** (append, dengan timestamp) ke `catatan`, bukan menimpa field asli — rekam medis wajib telusur secara hukum, jadi tidak ada jalur "edit diam-diam" sama sekali.

---

## 4. Apotek

Ada 2 tempat resep bisa dikerjakan:
- **Nempel di panel pemeriksaan** (dokter buat resep langsung saat periksa pasien).
- **Tab Apotek terpisah** — untuk apoteker yang perlu lihat semua resep yang perlu diserahkan lintas pasien tanpa klik satu-satu baris antrian.

### 4a. Buat Resep
`createResep` ([`klinik-resep.actions.ts:56`](../modules/klinik/actions/klinik-resep.actions.ts)) — dokter cari obat (`searchKlinikObat`, hanya `products.type='INVENTORY'`), tentukan jumlah + aturan pakai, pilih gudang apotek. Status awal `PENDING`.

### 4b. Dispensing (serahkan obat)
`dispenseResep` ([`klinik-resep.actions.ts:133`](../modules/klinik/actions/klinik-resep.actions.ts)) — **dua langkah wajib terpisah**, jangan digabung:

1. **RPC `process_klinik_dispensing`** (`supabase/migrations/1428_klinik_pratama_apotek.sql`) — fisik saja:
   - Pilih batch **FEFO** (expired paling dekat duluan).
   - **Blok keras** batch yang sudah kadaluarsa — tidak pernah dipakai walau itu satu-satunya stok tersisa (`RAISE EXCEPTION`, staf harus write-off manual lewat modul Inventori, bukan lewat dispensing pasien).
   - **Hard fail** kalau stok kurang (bukan diam-diam clamp ke 0).
   - Idempoten — panggil ulang untuk resep yang sudah `DISPENSED` cuma no-op.
2. **`postJurnal`** (layer TS, dipanggil setelah RPC sukses) — posting HPP obat (Dr HPP Obat / Cr Persediaan Obat), `reference_type='KLINIK_DISPENSING'`.

Kenapa dipisah: trigger `check_closed_period()` bisa `RAISE EXCEPTION` untuk periode fiskal tertutup. Kalau jurnal ada **di dalam** RPC yang sama dengan potong stok, exception itu ikut membatalkan pengurangan stok — artinya penutupan buku bulan lalu bisa memblokir pemberian obat ke pasien hari ini. Tidak bisa diterima di fasilitas kesehatan.

### 4c. Penerimaan Obat (stok masuk)
`receiveObat` ([`klinik-resep.actions.ts:238`](../modules/klinik/actions/klinik-resep.actions.ts)) — tab Apotek → **Penerimaan Obat**. Nomor batch + tanggal kadaluarsa **wajib diisi** saat itu juga — kalau tidak, stok tidak bisa dilacak per batch selamanya (unique index `inventory_stocks` men-`COALESCE` batch_number, jadi obat yang masuk tanpa batch langsung numpuk jadi satu baris anonim yang tidak bisa dipecah lagi belakangan).

### 4d. Stok Obat
Tab Apotek → **Stok Obat** — daftar stok per produk+batch (`getObatStockByBranch`, [`klinik-resep.actions.ts:224`](../modules/klinik/actions/klinik-resep.actions.ts)), tanggal kadaluarsa yang sudah lewat ditandai merah.

---

## 5. Kasir & Billing

Muncul di panel pemeriksaan begitu `klinik_kunjungan.status = 'SELESAI'`.

### 5a. Buat Tagihan
`createTagihan` ([`klinik-tagihan.actions.ts:19`](../modules/klinik/actions/klinik-tagihan.actions.ts)) — menggabungkan dua sumber otomatis:
- **Layanan**: dipilih manual dari `klinik_tarif_layanan` (kasir centang layanan yang diberikan).
- **Obat**: **otomatis ditarik** dari resep yang sudah `DISPENSED` untuk kunjungan itu, harga pakai `products.selling_price` (**bukan** `average_cost` yang dipakai untuk HPP saat dispensing — dua harga yang beda tujuan).

### 5b. Bayar
`markTagihanLunas` ([`klinik-tagihan.actions.ts:165`](../modules/klinik/actions/klinik-tagihan.actions.ts)) — posting jurnal pendapatan:
- Debit: `kas` (tunai/asuransi) atau `piutang_bpjs` (kalau metode bayar BPJS).
- Kredit: `pendapatan_konsultasi` / `pendapatan_tindakan` / `pendapatan_obat`, sesuai kategori tiap baris tagihan.
- `reference_type='KLINIK_PEMBAYARAN'`. **Tidak** posting HPP lagi di sini — HPP obat sudah selesai diposting saat dispensing (§4b), supaya tidak dobel.

### 5c. Void (batal)
`voidTagihan` ([`klinik-tagihan.actions.ts:190`](../modules/klinik/actions/klinik-tagihan.actions.ts)) — kalau tagihan sudah `LUNAS`:
1. Membalik jurnal pendapatan (tukar debit↔kredit tiap baris asli), `reference_type='KLINIK_VOID'`.
2. **Mengembalikan stok obat** yang sudah di-dispensing untuk kunjungan itu — per batch, pakai `batch_number` yang sama persis dengan yang tercatat saat dispensing.
3. Membalik jurnal HPP obat juga (`reference_type='KLINIK_VOID_HPP'`).

Semua 3 langkah ini **idempoten** — kalau void gagal di tengah jalan (mis. koneksi putus) dan dicoba ulang, tidak ada langkah yang terpasang dobel (masing-masing dicek dulu apakah sudah pernah jalan sebelum dieksekusi ulang).

### 5d. Posting Jurnal Tertunda
Kalau saat transaksi terjadi ada peran akun (`klinik_account_mapping`) yang belum dipetakan admin, jurnalnya **di-skip non-fatal** — transaksi tetap tercatat di modul, cuma belum masuk buku besar. Tab **Pengaturan Akun** menampilkan banner jumlah transaksi yang jurnalnya tertunda, dengan tombol **"Posting Jurnal Tertunda"** → `retryPostUnpostedJournals` ([`klinik-tagihan.actions.ts:337`](../modules/klinik/actions/klinik-tagihan.actions.ts)) yang mencoba posting ulang begitu mapping sudah dilengkapi.

---

## 6. Tenaga Medis & Pengaturan Akun

- **Tab Tenaga Medis**: tautkan karyawan (dari modul HRIS) sebagai dokter/perawat/bidan/apoteker (`createKlinikStafMedis`, [`klinik.actions.ts:92`](../modules/klinik/actions/klinik.actions.ts)) — kredensial STR/SIP disimpan di sini, **bukan** duplikasi data karyawan (FK ke `employees`, sesuai aturan integrasi HRIS di `AGENTS.md`).
- **Tab Pengaturan Akun**: petakan peran akun (`kas`, `pendapatan_konsultasi`, `pendapatan_obat`, `hpp_obat`, dst) ke Chart of Account org — dipakai `postJurnal` ([`klinik-journals.ts:51`](../lib/erp-bridge/klinik-journals.ts)) untuk resolve akun mana yang kena debit/kredit di tiap jenis transaksi.

---

## 7. Skema Status

### `klinik_kunjungan.status`
| Nilai | Arti |
|---|---|
| `MENUNGGU` | Baru daftar/check-in, belum dipanggil. |
| `DIPERIKSA` | Sudah dipanggil, panel pemeriksaan bisa dibuka. |
| `SELESAI` | Rekam medis sudah difinalisasi — otomatis dari `finalizeRekamMedis`, bukan diubah manual. Kasir & Tagihan baru muncul di status ini. |
| `BATAL` | Dibatalkan dari status `MENUNGGU` (tombol Batalkan). |

### `klinik_resep.status`
| Nilai | Arti |
|---|---|
| `PENDING` | Resep dibuat, obat belum diserahkan. |
| `DISPENSED` | Obat sudah diserahkan — stok sudah terpotong & HPP sudah diposting. |
| `BATAL` | (disiapkan skemanya, belum ada UI pembatalan resep di fase ini). |

### `klinik_tagihan.status`
| Nilai | Arti |
|---|---|
| `BELUM_BAYAR` | Tagihan dibuat, belum dibayar. |
| `LUNAS` | Sudah dibayar, jurnal pendapatan terposting. |
| `VOID` | Dibatalkan — jurnal dibalik, stok obat (kalau ada) dikembalikan. |

### `klinik_rekam_medis.status`
| Nilai | Arti |
|---|---|
| `DRAFT` | Masih bisa diedit langsung. |
| `FINAL` | Terkunci — koreksi lanjutan wajib lewat addendum (§3). |

### `klinik_slot_hold.status`
| Nilai | Arti |
|---|---|
| `CONFIRMED` | Booking publik berhasil dibuat, menunggu check-in. |
| `CHECKED_IN` | Sudah check-in di loket, `kunjungan_id` tertaut. |
| `HELD` / `EXPIRED` | Disiapkan skemanya untuk alur hold-sementara (belum dipakai — booking saat ini langsung `CONFIRMED`, lihat §2b). |
| `CANCELLED` | Dibatalkan. |

---

## 8. Tabel Database

| Tabel | Migrasi | Catatan |
|---|---|---|
| `klinik_pasien` | `1425_klinik_pratama_foundation.sql` | Org-level (bukan per-cabang) — satu pasien bisa berobat di cabang manapun dalam grup. `no_rm` auto-generate. |
| `klinik_poli`, `klinik_staf_medis`, `klinik_jadwal_praktik`, `klinik_jadwal_pengecualian`, `klinik_tarif_layanan`, `klinik_account_mapping`, `klinik_akses_rekam_log` | `1425_klinik_pratama_foundation.sql` | Fondasi Fase 1. |
| `klinik_kunjungan` | `1426_klinik_pratama_kunjungan.sql` | `no_antrian` unik per `(branch_id, poli_id, tanggal)`. |
| `klinik_rekam_medis`, `klinik_rekam_medis_history` | `1427_klinik_pratama_rekam_medis.sql` | History append-only. |
| `klinik_resep`, `klinik_resep_detail` | `1428_klinik_pratama_apotek.sql` | + RPC `process_klinik_dispensing`. |
| `klinik_tagihan`, `klinik_tagihan_detail` | `1429_klinik_pratama_kasir.sql` | |
| `klinik_slot_hold` | `1430_klinik_pratama_booking.sql` | `EXCLUDE USING gist` anti-double-booking. |
| `internal_auth_users.user_type` (+`'pasien'`) | `1424_klinik_pratama_user_type.sql` | Belum ada login pasien sungguhan — lihat §9. |
| `journal_entries.reference_type` (+4 nilai `KLINIK_*`) | `1431_klinik_pratama_journal_reference_type.sql` | Lihat §10 — jangan lupa kalau nambah `reference_type` baru lagi. |

---

## 9. Yang Belum Dibangun (di luar scope saat ini)

- **Portal pasien (`/pasien/*`)** — baru halaman login stub. Booking online tidak butuh akun (guest booking by nama+kontak); pasien ditautkan otomatis lewat nomor HP saat check-in. Kalau nanti pasien perlu login untuk lihat riwayat sendiri, itu pekerjaan terpisah.
- **BPJS P-Care/Vclaim & SATUSEHAT** — field sudah disiapkan (`klinik_pasien.no_bpjs`, `klinik_kunjungan.jenis_kunjungan`, `klinik_tagihan.no_klaim_bpjs`, `klinik_account_mapping.piutang_bpjs_account_id`), tapi integrasi API-nya sengaja ditunda (butuh kredensial resmi & sertifikasi).
- **Pemecahan resep multi-batch** — kalau 1 item resep diambil dari lebih dari satu batch (batch A habis, lanjut batch B), `klinik_resep_detail.batch_number` cuma menyimpan batch **terakhir** yang disentuh. Jejak lengkap tetap ada di `stock_movements` (satu baris per batch, `reference_id` = id resep), cuma tidak nyaman ditampilkan di UI resep. Ditunda karena kompleksitas UI-nya tidak sepadan untuk kasus yang jarang terjadi.
- **Nomor antrian tampilan publik (display board)** — belum ada layar TV/nomor panggil untuk ruang tunggu.

---

## 10. Catatan Teknis Penting

1. **`journal_entries.reference_type` adalah ENUM Postgres**, bukan TEXT bebas — walau `types/database.types.ts` mendefinisikan `JournalReferenceType = string` (tipe TypeScript longgar yang **tidak** merefleksikan constraint DB sesungguhnya). Kalau nanti butuh `reference_type` baru untuk modul Klinik, **wajib** bikin migration `ALTER TYPE journal_reference_type ADD VALUE IF NOT EXISTS '...'` dulu (pola: `1431_klinik_pratama_journal_reference_type.sql`) — kalau lupa, gejalanya adalah crash `global-error.tsx` di halaman manapun yang query `journal_entries` dengan nilai yang belum terdaftar, karena Postgres menolak nilai enum yang tidak dikenal. `stock_movements.reference_type` sebaliknya memang TEXT bebas, tidak kena aturan ini.
2. **`postJurnal` idempoten** per `(org_id, reference_type, reference_id)` — cek baris `journal_entries` yang sudah ada dulu sebelum insert baru. Aman dipanggil ulang (retry setelah gagal, atau lewat "Posting Jurnal Tertunda").
3. **Kontrol akses pasien lintas-cabang** diturunkan dari kunjungan (`klinik_kunjungan.branch_id`), bukan dari kolom pasien — lihat §2a poin 2. Jangan beri role org `admin` ke kepala klinik cabang kalau memang mau dibatasi hanya lihat data cabangnya sendiri (role `admin` selalu dapat akses semua cabang lewat `FULL_BRANCH_ACCESS_ROLES`).
4. **Jangan gabung posting jurnal ke dalam RPC SQL** yang juga mengubah stok fisik (§4b) — pola ini berlaku untuk pengembangan fitur apotek/inventori lain di masa depan juga, bukan cuma dispensing.
