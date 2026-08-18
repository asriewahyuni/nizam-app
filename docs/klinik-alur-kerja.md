# Alur Kerja Modul Klinik Pratama

Dokumen ini menjelaskan alur operasional modul Klinik Pratama — mulai dari pendaftaran pasien (walk-in maupun booking online), pemeriksaan & rekam medis, apotek, rawat inap, sampai kasir & billing. Modul ini **standalone** (route group sendiri, pola sama seperti Kojasmat) tapi **wajib terhubung ke ERP core** lewat [`lib/erp-bridge/klinik-journals.ts`](../lib/erp-bridge/klinik-journals.ts), sesuai HUKUM BESI ANTI-SILO di `AGENTS.md`.

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
               3. status SELESAI  →  Kasir & Tagihan (gabung layanan+obat+kamar → bayar/void)
```

Poin penting: **nomor antrian, booking, dan admisi rawat inap sama-sama bermuara ke satu tabel `klinik_kunjungan`** — booking online dan rawat inap cuma cara lain untuk membuat/mengisi kunjungan, bukan alur terpisah. Ini supaya rekam medis, resep, dan kasir tidak perlu tahu apakah pasiennya datang lewat booking, walk-in, atau rawat inap.

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
3. **Anti-double-booking ditegakkan di level database**, bukan cuma logic TS: constraint `EXCLUDE USING gist` di `klinik_slot_hold` (`supabase/migrations/1430_klinik_pratama_booking.sql`) menolak dua slot yang tumpang tindih untuk dokter yang sama, walau dua orang klik slot yang sama persis bersamaan. Kalau bentrok, `createBookingSlot` menangkap error `23P01` dan otomatis muat ulang daftar slot. Pola constraint yang sama dipakai lagi untuk tempat tidur rawat inap — lihat §5.

### 2c. Check-in Booking (loket, hari-H)

Section **"Booking Hari Ini — Belum Check-in"** muncul otomatis di atas antrian kalau ada booking `CONFIRMED` untuk poli yang dipilih (`getConfirmedBookingsToday`, [`klinik-booking.actions.ts:154`](../modules/klinik/actions/klinik-booking.actions.ts)).

Klik **"Check-in"** → `checkInBooking` ([`klinik-booking.actions.ts:171`](../modules/klinik/actions/klinik-booking.actions.ts)):
1. Cari `klinik_pasien` dengan `no_hp` yang cocok dengan kontak booking — kalau ketemu, dipakai ulang; kalau tidak, dibuat baru (`createKlinikPasien`).
2. Buat `klinik_kunjungan` lewat `createKunjunganWalkIn` yang sama (dapat nomor antrian normal), lalu tandai `sumber='BOOKING'` dan `staf_medis_id` sesuai dokter yang di-booking.
3. `klinik_slot_hold.status` → `CHECKED_IN`, `kunjungan_id` ditautkan.

### 2d. Manajemen Poli

Tab **Daftar Poli** — beda dari "+ Poli Baru" di §2a yang cuma tambah cepat, tab ini layar manajemen penuh: `getKlinikPoliByBranch(orgId, branchId, includeInactive=true)` menampilkan semua poli termasuk yang nonaktif, `updateKlinikPoli` (ubah kode/nama) dan `setKlinikPoliActive` (aktif/nonaktifkan) — semua admin-gated (`isKlinikOrgAdmin`), di [`klinik.actions.ts`](../modules/klinik/actions/klinik.actions.ts). Menonaktifkan poli tidak menghapus data historis (kunjungan lama tetap tertaut), cuma menyembunyikannya dari dropdown pendaftaran.

### 2e. Layar Antrian Publik (Display Board)

Halaman publik tanpa login: `app/klinik/antrian/[branchId]/page.tsx` + [`AntrianDisplayClient.tsx`](<../app/klinik/antrian/[branchId]/AntrianDisplayClient.tsx>) — dibuka di TV/monitor ruang tunggu, ditautkan lewat tombol **"Buka Layar Antrian"** di kartu "Antrian Hari Ini" (tab Pendaftaran & Antrian).

- `getAntrianDisplayBoard(branchId)` ([`klinik-kunjungan.actions.ts`](../modules/klinik/actions/klinik-kunjungan.actions.ts)) — untuk tiap poli aktif, mengembalikan nomor **"Sedang Dipanggil"** (kunjungan `DIPERIKSA` yang terakhir diupdate) dan daftar nomor **"Menunggu"** (`MENUNGGU`, urut naik). **Sengaja tidak pernah mengembalikan nama pasien** — halaman ini publik tanpa autentikasi, jadi cuma nomor antrian yang aman ditampilkan.
- Poll setiap 8 detik (bukan WebSocket/realtime — cukup untuk layar yang menyala statis berjam-jam, jauh lebih sederhana).
- Highlight "flash" saat nomor sedang-dipanggil berubah dibuat lewat CSS keyframe (`animate-antrian-flash` di `app/globals.css`) yang di-replay lewat teknik **key-remount** (elemen diberi `key={sedang_dipanggil}`, jadi React memasang ulang DOM node-nya begitu nilainya berubah, otomatis mengulang animasinya) — **bukan** `useState`+`setTimeout` di dalam `useEffect`, karena project ini mengaktifkan `react-hooks/set-state-in-effect` yang menolak pola itu (dianggap bisa memicu cascading render).

---

## 3. Rekam Medis

Panel muncul saat baris antrian di-expand (ikon ▾, hanya tampil untuk status **Diperiksa**/**Selesai**) — [`PemeriksaanPanel.tsx`](<../app/(klinik-internal)/klinik/PemeriksaanPanel.tsx>).

- **Draft**: `saveRekamMedisDraft` ([`klinik-rekam-medis.actions.ts:74`](../modules/klinik/actions/klinik-rekam-medis.actions.ts)) — bisa disimpan berkali-kali selama status masih `DRAFT`, tiap perubahan dicatat ke `klinik_rekam_medis_history` (action `CREATED`/`UPDATED`, snapshot before/after dalam JSONB).
- **Finalisasi**: `finalizeRekamMedis` ([`klinik-rekam-medis.actions.ts:153`](../modules/klinik/actions/klinik-rekam-medis.actions.ts)) — set status `FINAL` + `finalized_at`, **dan otomatis mengubah `klinik_kunjungan.status` jadi `SELESAI`** dalam transaksi yang sama. Field klinis (anamnesis/diagnosis/terapi) **terkunci** setelah ini.
- **Addendum**: `addRekamMedisAddendum` ([`klinik-rekam-medis.actions.ts:201`](../modules/klinik/actions/klinik-rekam-medis.actions.ts)) — satu-satunya cara koreksi setelah `FINAL`. Teks baru **ditambahkan** (append, dengan timestamp) ke `catatan`, bukan menimpa field asli — rekam medis wajib telusur secara hukum, jadi tidak ada jalur "edit diam-diam" sama sekali.

### 3a. Riwayat Rekam Medis per Pasien (tab Daftar Pasien)

Sebelumnya rekam medis cuma bisa dilihat lewat baris antrian aktif (per kunjungan). Tab **Daftar Pasien** menambahkan direktori pasien penuh (`getKlinikPasienPage`, paginated + search, [`klinik-pasien.actions.ts`](../modules/klinik/actions/klinik-pasien.actions.ts)) — klik satu pasien untuk expand riwayat lengkapnya lintas semua kunjungan (`getRekamMedisHistoryByPasien`, [`klinik-rekam-medis.actions.ts`](../modules/klinik/actions/klinik-rekam-medis.actions.ts)), ditampilkan **read-only** (bukan form, tidak bisa diedit dari sini — koreksi tetap wajib lewat addendum di panel pemeriksaan kunjungan aslinya).

Setiap kali riwayat lengkap seorang pasien dibuka dari tab ini, dicatat ke `klinik_akses_rekam_log` lewat `logAksesRekamMedis` — tabel ini sudah ada sejak fondasi modul (`1425_klinik_pratama_foundation.sql`) tapi baru dipakai di sini untuk pertama kalinya, sebagai audit trail akses rekam medis lintas-kunjungan.

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
`receiveObat` ([`klinik-resep.actions.ts:238`](../modules/klinik/actions/klinik-resep.actions.ts)) — tab Apotek → **Penerimaan Obat**. Nomor batch + tanggal kadaluarsa **wajib diisi** saat itu juga — kalau tidak, stok tidak bisa dilacak per batch selamanya (unique index `inventory_stocks` men-`COALESCE` batch_number, jadi obat yang masuk tanpa batch langsung numpuk jadi satu baris anonim yang tidak bisa dipecah lagi belakangan). Harga beli per unit juga **wajib diisi** — dikirim sebagai `unit_price` di `stock_movements`, karena trigger `trg_recalculate_average_cost` menghitung ulang `products.average_cost` dari SUM(qty×unit_price)/SUM(qty) setiap ada baris baru; mengirim `0` di sini diam-diam menghancurkan HPP yang dipakai saat dispensing (bug produksi nyata yang pernah terjadi & sudah diperbaiki).

### 4d. Stok Obat
Tab Apotek → **Stok Obat** — daftar stok **saat ini** per produk+batch (`getObatStockByBranch`, [`klinik-resep.actions.ts:224`](../modules/klinik/actions/klinik-resep.actions.ts)), tanggal kadaluarsa yang sudah lewat ditandai merah. Ini snapshot saldo, bukan riwayat — untuk riwayat lihat §4e.

### 4e. Mutasi Obat (riwayat)
Tab **Mutasi Obat** — ledger `stock_movements` yang bisa difilter (jenis, arah masuk/keluar, tanggal, cari nama/SKU) dan dipaginasi (`getKlinikStockMovementsPage`, [`klinik-mutasi-obat.actions.ts`](../modules/klinik/actions/klinik-mutasi-obat.actions.ts)) — mirror langsung dari `getStockMovementsPage` di modul Inventori (`modules/inventory/actions/inventory.actions.ts`), dibatasi ke 3 `reference_type` milik Klinik: `KLINIK_RECEIPT` (penerimaan), `KLINIK_RESEP` (pemakaian saat dispensing), `KLINIK_VOID_RETURN` (retur saat tagihan di-void, §6c).

---

## 5. Rawat Inap

**Konsep baru** di luar cakupan awal (Klinik Pratama secara definisi regulasi Indonesia adalah rawat jalan) — ditambahkan atas permintaan eksplisit untuk mendukung kamar VIP/BPJS dengan penugasan pasien ke tempat tidur. Tab **Rawat Inap** di `KlinikClient.tsx`, logic di [`klinik-kamar.actions.ts`](../modules/klinik/actions/klinik-kamar.actions.ts), skema di `supabase/migrations/1432_klinik_pratama_rawat_inap.sql`.

**Desain kunci: admisi = kunjungan.** Bukan sistem billing/RM paralel — admisi pasien ke tempat tidur otomatis membuat `klinik_kunjungan` (poli dipilih staf, biasanya poli khusus "Rawat Inap"), jadi seluruh mesin RME/Kasir/jurnal yang sudah ada di §3 dan §6 otomatis berlaku begitu pasien dipulangkan, tanpa jalur akuntansi kedua (HUKUM BESI ANTI-SILO).

### 5a. Kamar & Tempat Tidur
`createKlinikKamar` — admin bikin kamar (tipe bebas: VIP/BPJS/Kelas 1/dst, ukuran m², tarif per malam, daftar fasilitas `TEXT[]`) sekaligus N tempat tidur (`klinik_tempat_tidur`, kode `{nama_kamar}-01`, `-02`, dst) dalam satu transaksi. Tiap bed punya status `TERSEDIA` / `TERISI` / `MAINTENANCE` (`setTempatTidurMaintenance` untuk menandai bed sedang diperbaiki, diblokir kalau bed sedang terisi pasien).

### 5b. Admisi
`admitPasienRawatInap` — pilih bed `TERSEDIA` → cari/pilih pasien (`searchKlinikPasien`, sama seperti pendaftaran) → pilih poli + dokter penanggung jawab (opsional) + diagnosis masuk. Transaksional: kunci baris bed (`FOR UPDATE`), buat `klinik_kunjungan` (status langsung `DIPERIKSA`, tidak lewat antrian `MENUNGGU`), insert `klinik_rawat_inap` dengan **snapshot tarif per malam saat itu** (`tarif_per_malam_snapshot` — supaya perubahan tarif kamar di kemudian hari tidak mengubah tagihan pasien yang sudah dirawat), tandai bed `TERISI`.

**Anti-double-booking di level database**: constraint `EXCLUDE USING gist` pada `klinik_rawat_inap` (`tempat_tidur_id` + rentang waktu `admitted_at`..`discharged_at`, hanya untuk status `DIRAWAT`) — pola identik dengan `klinik_slot_hold` di §2b, cuma diterapkan ke rentang multi-hari alih-alih slot 30 menit. Kalau dua staf mencoba mengisi bed yang sama nyaris bersamaan, transaksi kedua ditolak Postgres dengan error `23P01`, ditangkap dan ditampilkan sebagai pesan "Tempat tidur baru saja diisi pasien lain."

### 5c. Discharge → Tagihan Kamar
`dischargePasienRawatInap` — set `klinik_rawat_inap.status='PULANG'` + `discharged_at=NOW()`, bed balik `TERSEDIA`, lalu panggil `updateStatusKunjungan(..., 'SELESAI')` yang sama dipakai alur walk-in biasa — otomatis membuka section Kasir & Tagihan di panel pemeriksaan (§6a). `cancelAdmisiRawatInap` tersedia untuk kesalahan input (bed dibebaskan tanpa membuat tagihan).

Saat tagihan dibuat, `createTagihan` (§6a) otomatis menarik rawat inap berstatus `PULANG` untuk kunjungan itu, menghitung malam (`CEIL` selisih jam, minimal 1 malam) × `tarif_per_malam_snapshot`, jadi baris `klinik_tagihan_detail` berjenis `'kamar'` (jenis baru, ditambahkan ke `klinik_tagihan_detail.jenis` lewat migration 1432 — sebelumnya cuma `'layanan'`/`'obat'`).

---

## 6. Kasir & Billing

Muncul di panel pemeriksaan begitu `klinik_kunjungan.status = 'SELESAI'`.

### 6a. Buat Tagihan
`createTagihan` ([`klinik-tagihan.actions.ts:19`](../modules/klinik/actions/klinik-tagihan.actions.ts)) — menggabungkan tiga sumber otomatis:
- **Layanan**: dipilih manual dari `klinik_tarif_layanan` (kasir centang layanan yang diberikan).
- **Obat**: **otomatis ditarik** dari resep yang sudah `DISPENSED` untuk kunjungan itu, harga pakai `products.selling_price` (**bukan** `average_cost` yang dipakai untuk HPP saat dispensing — dua harga yang beda tujuan).
- **Kamar**: **otomatis ditarik** dari rawat inap berstatus `PULANG` (§5c) — qty=malam, harga=tarif snapshot saat admisi. Ditampilkan sebagai baris info read-only di panel Kasir sebelum tagihan dibuat ("Kamar X (N malam) akan otomatis ditambahkan").

Total tagihan sekarang `total_layanan + total_obat + total_kamar` (kolom `total_kamar` ditambahkan lewat migration 1433).

### 6b. Bayar
`markTagihanLunas` ([`klinik-tagihan.actions.ts:165`](../modules/klinik/actions/klinik-tagihan.actions.ts)) — posting jurnal pendapatan:
- Debit: `kas` (tunai/asuransi) atau `piutang_bpjs` (kalau metode bayar BPJS).
- Kredit: `pendapatan_konsultasi` / `pendapatan_tindakan` / `pendapatan_obat` / `pendapatan_kamar_inap` (role baru, §7), sesuai kategori/jenis tiap baris tagihan.
- `reference_type='KLINIK_PEMBAYARAN'`. **Tidak** posting HPP lagi di sini — HPP obat sudah selesai diposting saat dispensing (§4b), supaya tidak dobel. Rawat inap tidak punya HPP (bukan barang fisik), jadi kamar cuma mengkredit pendapatan, tanpa baris HPP tandingan.

### 6c. Void (batal)
`voidTagihan` ([`klinik-tagihan.actions.ts:190`](../modules/klinik/actions/klinik-tagihan.actions.ts)) — kalau tagihan sudah `LUNAS`:
1. Membalik jurnal pendapatan (tukar debit↔kredit tiap baris asli, termasuk baris kamar kalau ada), `reference_type='KLINIK_VOID'`.
2. **Mengembalikan stok obat** yang sudah di-dispensing untuk kunjungan itu — per batch, pakai `batch_number` yang sama persis dengan yang tercatat saat dispensing.
3. Membalik jurnal HPP obat juga (`reference_type='KLINIK_VOID_HPP'`).

Semua langkah ini **idempoten** — kalau void gagal di tengah jalan (mis. koneksi putus) dan dicoba ulang, tidak ada langkah yang terpasang dobel (masing-masing dicek dulu apakah sudah pernah jalan sebelum dieksekusi ulang).

### 6d. Posting Jurnal Tertunda
Kalau saat transaksi terjadi ada peran akun (`klinik_account_mapping`) yang belum dipetakan admin, jurnalnya **di-skip non-fatal** — transaksi tetap tercatat di modul, cuma belum masuk buku besar. Tab **Pengaturan Akun** menampilkan banner jumlah transaksi yang jurnalnya tertunda, dengan tombol **"Posting Jurnal Tertunda"** → `retryPostUnpostedJournals` ([`klinik-tagihan.actions.ts:337`](../modules/klinik/actions/klinik-tagihan.actions.ts)) yang mencoba posting ulang begitu mapping sudah dilengkapi.

---

## 7. Tenaga Medis & Pengaturan Akun

- **Tab Tenaga Medis**: tautkan karyawan (dari modul HRIS) sebagai dokter/perawat/bidan/apoteker (`createKlinikStafMedis`, [`klinik.actions.ts:92`](../modules/klinik/actions/klinik.actions.ts)) — kredensial STR/SIP disimpan di sini, **bukan** duplikasi data karyawan (FK ke `employees`, sesuai aturan integrasi HRIS di `AGENTS.md`).
- **Tab Pengaturan Akun**: petakan peran akun ke Chart of Account org — dipakai `postJurnal` ([`klinik-journals.ts:51`](../lib/erp-bridge/klinik-journals.ts)) untuk resolve akun mana yang kena debit/kredit di tiap jenis transaksi. Peran yang tersedia: `kas`, `pendapatan_konsultasi`, `pendapatan_tindakan`, `pendapatan_obat`, `pendapatan_kamar_inap` (baru — rawat inap, §5c/§6b), `hpp_obat`, `persediaan_obat`, `piutang_bpjs`, `kerugian_obat_kadaluarsa`. Daftar peran ini generik (`KLINIK_ACCOUNT_ROLES` di [`klinik-account-mapping.shared.ts`](../modules/klinik/lib/klinik-account-mapping.shared.ts)) — semua kode query/save mapping otomatis mengikuti array ini tanpa perlu diubah kalau nambah peran baru lagi nanti.

---

## 8. Skema Status

### `klinik_kunjungan.status`
| Nilai | Arti |
|---|---|
| `MENUNGGU` | Baru daftar/check-in, belum dipanggil. |
| `DIPERIKSA` | Sudah dipanggil (atau baru diadmisi rawat inap, §5b), panel pemeriksaan bisa dibuka. |
| `SELESAI` | Rekam medis sudah difinalisasi, ATAU pasien rawat inap sudah dipulangkan (§5c) — otomatis, bukan diubah manual. Kasir & Tagihan baru muncul di status ini. |
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

### `klinik_tempat_tidur.status`
| Nilai | Arti |
|---|---|
| `TERSEDIA` | Kosong, bisa diisi pasien baru. |
| `TERISI` | Ada pasien `DIRAWAT` di bed ini — dijaga constraint `EXCLUDE`, lihat §5b. |
| `MAINTENANCE` | Sengaja dikosongkan staf (perbaikan/kebersihan), tidak muncul sebagai opsi admisi. |

### `klinik_rawat_inap.status`
| Nilai | Arti |
|---|---|
| `DIRAWAT` | Aktif dirawat — satu-satunya status yang dijaga constraint `EXCLUDE` (§5b). |
| `PULANG` | Sudah dipulangkan (`discharged_at` terisi) — memicu tagihan otomatis di §6a. |
| `DIBATALKAN` | Admisi dibatalkan (kesalahan input) — bed dibebaskan, tidak ada tagihan. |

---

## 9. Tabel Database

| Tabel | Migrasi | Catatan |
|---|---|---|
| `klinik_pasien` | `1425_klinik_pratama_foundation.sql` | Org-level (bukan per-cabang) — satu pasien bisa berobat di cabang manapun dalam grup. `no_rm` auto-generate. |
| `klinik_poli`, `klinik_staf_medis`, `klinik_jadwal_praktik`, `klinik_jadwal_pengecualian`, `klinik_tarif_layanan`, `klinik_account_mapping`, `klinik_akses_rekam_log` | `1425_klinik_pratama_foundation.sql` | Fondasi Fase 1. |
| `klinik_kunjungan` | `1426_klinik_pratama_kunjungan.sql` | `no_antrian` unik per `(branch_id, poli_id, tanggal)`. |
| `klinik_rekam_medis`, `klinik_rekam_medis_history` | `1427_klinik_pratama_rekam_medis.sql` | History append-only. |
| `klinik_resep`, `klinik_resep_detail` | `1428_klinik_pratama_apotek.sql` | + RPC `process_klinik_dispensing`. |
| `klinik_tagihan`, `klinik_tagihan_detail` | `1429_klinik_pratama_kasir.sql` | |
| `klinik_slot_hold` | `1430_klinik_pratama_booking.sql` | `EXCLUDE USING gist` anti-double-booking. |
| `internal_auth_users.user_type` (+`'pasien'`) | `1424_klinik_pratama_user_type.sql` | Belum ada login pasien sungguhan — lihat §10. |
| `journal_entries.reference_type` (+4 nilai `KLINIK_*`) | `1431_klinik_pratama_journal_reference_type.sql` | Lihat §11 — jangan lupa kalau nambah `reference_type` baru lagi. |
| `klinik_kamar`, `klinik_tempat_tidur`, `klinik_rawat_inap` | `1432_klinik_pratama_rawat_inap.sql` | `EXCLUDE USING gist` anti-double-booking bed (§5b). Migration ini juga menambah `'kamar'` ke `klinik_tagihan_detail.jenis` dan kolom `pendapatan_kamar_inap_account_id` ke `klinik_account_mapping`. |
| `klinik_tagihan.total_kamar` | `1433_klinik_pratama_tagihan_kamar.sql` | Mirror `total_layanan`/`total_obat`, ketinggalan dari migration 1432. |

---

## 10. Yang Belum Dibangun (di luar scope saat ini)

- **Portal pasien (`/pasien/*`)** — baru halaman login stub. Booking online tidak butuh akun (guest booking by nama+kontak); pasien ditautkan otomatis lewat nomor HP saat check-in. Kalau nanti pasien perlu login untuk lihat riwayat sendiri, itu pekerjaan terpisah.
- **BPJS P-Care/Vclaim & SATUSEHAT** — field sudah disiapkan (`klinik_pasien.no_bpjs`, `klinik_kunjungan.jenis_kunjungan`, `klinik_tagihan.no_klaim_bpjs`, `klinik_account_mapping.piutang_bpjs_account_id`), tapi integrasi API-nya sengaja ditunda (butuh kredensial resmi & sertifikasi).
- **Pemecahan resep multi-batch** — kalau 1 item resep diambil dari lebih dari satu batch (batch A habis, lanjut batch B), `klinik_resep_detail.batch_number` cuma menyimpan batch **terakhir** yang disentuh. Jejak lengkap tetap ada di `stock_movements` (satu baris per batch, `reference_id` = id resep), cuma tidak nyaman ditampilkan di UI resep. Ditunda karena kompleksitas UI-nya tidak sepadan untuk kasus yang jarang terjadi.
- **Billing rawat inap berjalan (mid-stay)** — tagihan kamar baru ditarik otomatis **setelah** pasien dipulangkan (§5c/§6a). Belum ada estimasi tagihan berjalan/uang muka selama pasien masih `DIRAWAT`, dan belum ada laporan okupansi kamar (tingkat hunian, rata-rata lama inap) — data mentahnya sudah ada di `klinik_rawat_inap`, tinggal laporannya belum dibangun.
- **Perawatan/tindakan selama rawat inap** — resep obat & rekam medis tetap bisa dicatat normal (nempel ke `kunjungan_id` yang sama, §3-§4), tapi belum ada konsep "billing harian per tindakan rawat inap" terpisah dari tarif kamar per malam — semua tindakan selama masa inap masuk sebagai baris `layanan` biasa di tagihan yang sama.

---

## 11. Catatan Teknis Penting

1. **`journal_entries.reference_type` adalah ENUM Postgres**, bukan TEXT bebas — walau `types/database.types.ts` mendefinisikan `JournalReferenceType = string` (tipe TypeScript longgar yang **tidak** merefleksikan constraint DB sesungguhnya). Kalau nanti butuh `reference_type` baru untuk modul Klinik, **wajib** bikin migration `ALTER TYPE journal_reference_type ADD VALUE IF NOT EXISTS '...'` dulu (pola: `1431_klinik_pratama_journal_reference_type.sql`) — kalau lupa, gejalanya adalah crash `global-error.tsx` di halaman manapun yang query `journal_entries` dengan nilai yang belum terdaftar, karena Postgres menolak nilai enum yang tidak dikenal. `stock_movements.reference_type` sebaliknya memang TEXT bebas, tidak kena aturan ini — makanya `KLINIK_RECEIPT`/`KLINIK_RESEP`/`KLINIK_VOID_RETURN` (§4e) tidak butuh migration enum terpisah.
2. **`postJurnal` idempoten** per `(org_id, reference_type, reference_id)` — cek baris `journal_entries` yang sudah ada dulu sebelum insert baru. Aman dipanggil ulang (retry setelah gagal, atau lewat "Posting Jurnal Tertunda").
3. **Kontrol akses pasien lintas-cabang** diturunkan dari kunjungan (`klinik_kunjungan.branch_id`), bukan dari kolom pasien — lihat §2a poin 2 (berlaku juga untuk `getKlinikPasienPage` di §3a). Jangan beri role org `admin` ke kepala klinik cabang kalau memang mau dibatasi hanya lihat data cabangnya sendiri (role `admin` selalu dapat akses semua cabang lewat `FULL_BRANCH_ACCESS_ROLES`).
4. **Jangan gabung posting jurnal ke dalam RPC SQL** yang juga mengubah stok fisik (§4b) — pola ini berlaku untuk pengembangan fitur apotek/inventori lain di masa depan juga, bukan cuma dispensing.
5. **`EXCLUDE USING gist` adalah pola standar modul ini untuk "satu resource fisik, satu pemakai pada satu rentang waktu"** — dipakai 2 kali dengan bentuk identik: `klinik_slot_hold` (dokter × slot 30 menit, §2b) dan `klinik_rawat_inap` (tempat tidur × rentang admisi multi-hari, §5b). Kalau nanti butuh pola serupa lagi (mis. ruang tindakan, alat medis bersama), tiru constraint ini alih-alih validasi manual di TypeScript — DB yang menjamin, bukan aplikasi, sehingga aman dari race condition walau dua staf klik bersamaan.
6. **Kolom `total_kamar` sengaja ditambahkan lewat migration terpisah (1433)**, bukan digabung ke 1432 — ketahuan kurang setelah 1432 sudah diterapkan ke Railway. Pelajaran: kalau nambah jenis baris tagihan baru (`klinik_tagihan_detail.jenis`), jangan lupa kolom total agregatnya juga di tabel header (`klinik_tagihan`), sekaligus di migration yang sama.
