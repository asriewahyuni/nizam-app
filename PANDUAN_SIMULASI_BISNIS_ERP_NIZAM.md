# Panduan Implementasi Skenario `uit.md` di NIZAM ERP

## Tujuan

Dokumen ini menjelaskan bagaimana codebase `nizam-app` saat ini dapat menjalankan skenario latihan pada `uit.md`, baik sebagai:

- simulasi operasional end-to-end,
- bahan pelatihan trainer/peserta,
- dasar penilaian berbasis leaderboard, dan
- capability mapping untuk tim produk atau implementasi.

Untuk status implementasi `EDU Mode` realtime dengan timer, validator otomatis, auto-advance soal, dan overlay di dashboard asli, lihat juga dokumen:

- `DOKUMENTASI_EDU_MODE_REALTIME_NIZAM.md`

## Ringkasan Kesimpulan

Skenario pada `uit.md` pada dasarnya sudah selaras dengan kemampuan inti NIZAM ERP. Sebagian besar alur yang diminta sudah tersedia melalui modul operasional yang aktif di dashboard, dan bahkan versi kurikulum 15 soal yang sangat mirip sudah ada di:

- `lib/edu/training-simulation.ts`
- `app/edu/page.tsx`
- `modules/edu/lib/training.server.ts`
- `modules/edu/actions/training.actions.ts`
- `supabase/migrations/1206_edu_training_scoreboard.sql`

Artinya, `uit.md` bukan requirement yang asing bagi sistem ini. Dokumen tersebut lebih tepat diposisikan sebagai skenario pelatihan formal untuk kapabilitas yang sebagian besar sudah ada.

## Status Umum Kesiapan

Kategori yang dipakai di dokumen ini:

- `SIAP`: sudah ada route, action, dan fondasi data yang mendukung alur.
- `SIAP DENGAN SETUP`: alur tersedia, tetapi butuh konfigurasi role, branch, rekening, atau data awal yang benar.
- `BATASAN`: fondasi ada, tetapi alur persis seperti dokumen belum menjadi jalur UI utama atau masih butuh workaround.

Kesimpulan praktis:

- Multi-entitas holding, branch context, dan consolidated reporting sudah ada.
- Purchasing, inventory, sales, POS, cash/bank, reimbursement, fixed assets, HRIS, audit, approval, dan aging sudah ada.
- Scoring board pelatihan juga sudah ada lewat `/edu`.
- Skenario transfer antar anak perusahaan secara langsung masih perlu dibatasi pada alur yang sudah benar-benar terdokumentasi.

## Prasyarat Agar Simulasi Berjalan Lancar

Sebelum memakai `uit.md` sebagai materi training, environment perlu memenuhi hal berikut:

1. Migrasi database minimal sudah mencakup:
   - fondasi ERP inti,
   - multi-org dan consolidation,
   - inter-org capital transfer,
   - branch context,
   - EDU training scoreboard.

2. Modul yang relevan harus aktif untuk tenant training:
   - `cash`
   - `accounting`
   - `inventory`
   - `purchasing`
   - `sales`
   - `pos`
   - `hris`
   - `reports`

3. Struktur organisasi sudah dibentuk:
   - 1 holding,
   - 2 anak perusahaan,
   - minimal 1 branch aktif per entitas.

4. User trainer atau peserta minimal memiliki akses yang sesuai:
   - owner/admin holding untuk alur parent-child,
   - akses org context dan branch context yang benar,
   - role operasional bila testing dilakukan dengan akun non-owner.

5. Catatan governance yang perlu diketahui:
   - rekening bank dan CoA child org tidak selalu dibuat langsung; pada flow governance saat ini child/branch dapat diarahkan ke request workflow,
   - master data tidak bersifat global-shared lintas entitas secara otomatis; data perlu dibuat atau diimport per entitas bila memang harus muncul di masing-masing org.

## Pemetaan 15 Soal ke Fitur Sistem

### Phase 1 - Setup Multi-Entity

| No | Soal | Route/Modul | Cara sistem melakukannya | Status |
|---|---|---|---|---|
| 1 | Membuat struktur grup usaha | `/settings/sub-orgs`, `/settings/branches`, header org/branch switcher | NIZAM sudah punya child organization management, branch management, active org context, dan hierarchy untuk holding consolidation. | `SIAP` |
| 2 | Menyiapkan master data dasar | `/inventory`, `/inventory/warehouses`, `/contacts`, `/cash` | Produk, gudang, supplier/customer, dan rekening bank sudah punya modul sendiri. Data bersifat org-aware dan branch-aware. Untuk child org, rekening bank bisa mengikuti governance request workflow. | `SIAP DENGAN SETUP` |
| 3 | Input modal awal per entitas | `/cash`, `/accounting/journal`, `/reports` | Saldo awal dapat dicatat sebagai transaksi kas/bank masuk dengan akun lawan modal/ekuitas, atau lewat jurnal pembuka bila diperlukan. Dampaknya mengalir ke jurnal dan laporan keuangan. | `SIAP DENGAN SETUP` |
| 4 | Transfer modal dari holding ke anak | `/cash` | Sudah ada flow inter-org capital transfer dari parent ke child dengan dua sisi posting atomik, validasi tree holding, dan dampak ke laporan. | `SIAP` |

### Phase 2 - Operasional Harian

| No | Soal | Route/Modul | Cara sistem melakukannya | Status |
|---|---|---|---|---|
| 5 | Pembelian persediaan secara kredit | `/purchasing` | Purchase order, receiving, hutang usaha, dan jurnal pembelian sudah tersedia. Receiving akan menaikkan stok dan nilai persediaan. | `SIAP` |
| 6 | Pembayaran sebagian hutang supplier | `/purchasing`, `/cash`, `/accounting/aging` | Pembayaran purchase dapat diproses parsial dan aging AP tetap menampilkan sisa outstanding. | `SIAP` |
| 7 | Mutasi stok antar gudang | `/inventory`, `/inventory/ledger/[id]` | Sudah ada `createInventoryTransfer()` dan stock ledger untuk memverifikasi perpindahan antar gudang tanpa mengubah total stok perusahaan. | `SIAP` |
| 8 | Penjualan kredit ke customer grosir | `/sales` | Sales order, delivery, pengurangan stok, AR, dan auto journal penjualan sudah tersedia. | `SIAP` |
| 9 | Pelunasan sebagian piutang customer | `/sales`, `/cash`, `/accounting/aging` | Pembayaran penjualan dapat diposting parsial dan aging AR tetap menampilkan sisa tagihan. | `SIAP` |
| 10 | Penjualan retail melalui POS | `/pos` | POS cash sales, walk-in customer fallback, pengurangan stok, dan penerimaan kas/bank sudah tersedia. | `SIAP` |

### Phase 3 - Kontrol dan Konsolidasi

| No | Soal | Route/Modul | Cara sistem melakukannya | Status |
|---|---|---|---|---|
| 11 | Reimbursement biaya operasional | `/accounting/reimburse`, `/accounting/approvals` | Pengajuan, approval, dan pembayaran reimbursement sudah ada. Jurnal beban dan pengurangan kas/bank mengikuti status approval dan payment. | `SIAP` |
| 12 | Pembelian dan pencatatan aset tetap | `/accounting/assets` | Sudah ada fixed asset creation, depreciation preview/run, disposal, dan tampil di neraca. | `SIAP` |
| 13 | Mutasi karyawan dari holding ke anak perusahaan | `/hris`, `/settings/sub-orgs` | Sudah ada flow mutasi karyawan antar entitas dalam holding yang sama, audit trail, dan opsi assign PIC ke branch tujuan. | `SIAP` |
| 14 | Transaksi antar entitas kedua | `/cash` atau alur operasional lain sesuai environment | Jalur yang benar-benar terdokumentasi saat ini adalah transfer modal parent ke child. Untuk transfer langsung child ke child, atau supply barang antar entitas dengan penandaan intercompany yang eksplisit, perlu pembatasan skenario atau ekstensi flow yang lebih spesifik. | `BATASAN` |
| 15 | Review laporan konsolidasi dan closing ringan | `/reports`, `/accounting/closing` | Neraca, Laba Rugi, dan Arus Kas sudah mendukung mode consolidated untuk parent + descendants. Closing juga sudah punya modul terpisah. | `SIAP` |

## Dasar Teknis yang Membuat Skenario Ini Bisa Jalan

Berikut fondasi teknis terpenting yang membuat `uit.md` kompatibel dengan sistem:

- Multi-org dan consolidation tree:
  - `get_consolidated_org_ids`
  - `is_org_in_consolidation_tree`
  - `get_consolidated_org_hierarchy`

- Transfer modal antar entitas:
  - `modules/cash/actions/bank.actions.ts`
  - migration `1143_interorg_capital_transfer.sql`
  - migration `1145_interorg_capital_transfer_guardrails.sql`
  - migration `1147_enforce_interorg_source_counter_cash_bank.sql`

- Laporan parent-only vs consolidated:
  - `modules/accounting/actions/reports.actions.ts`
  - `app/(dashboard)/reports/page.tsx`
  - `app/(dashboard)/reports/ReportsClient.tsx`

- Purchasing dan AP:
  - `modules/purchasing/actions/purchasing.actions.ts`
  - aging di `modules/accounting/actions/aging.actions.ts`

- Inventory dan warehouse transfer:
  - `modules/inventory/actions/inventory.actions.ts`
  - `modules/inventory/actions/warehouse.actions.ts`
  - migration `045_inventory_transfers.sql`

- Sales, AR, dan POS:
  - `modules/sales/actions/sales.actions.ts`
  - `modules/sales/actions/pos.actions.ts`
  - migration `1026_allow_pos_walkin_customers.sql`
  - migration `1174_enable_cashier_pos_write_for_pos_flow.sql`

- Cash/bank dan branch-aware posting:
  - `modules/cash/actions/bank.actions.ts`
  - migration `1106_cash_bank_branch_context.sql`

- Reimbursement:
  - `modules/accounting/actions/reimburse.actions.ts`
  - migration `1092_reimbursement_branch_context.sql`

- Fixed assets:
  - `modules/accounting/actions/assets.actions.ts`
  - migration `013_fixed_assets.sql`
  - migration `1102_fixed_assets_branch_context.sql`

- Mutasi karyawan antar entitas holding:
  - `modules/hris/actions/employee.actions.ts`
  - `app/(dashboard)/hris/HrisClient.tsx`

- Audit dan approval:
  - `modules/organization/actions/audit.actions.ts`
  - `modules/organization/actions/approval.actions.ts`
  - `app/(dashboard)/accounting/approvals/page.tsx`
  - `app/(dashboard)/settings/audit/page.tsx`

## Hubungan `uit.md` dengan Modul `/edu`

Ini poin penting untuk tim produk dan trainer:

- `lib/edu/training-simulation.ts` sudah berisi 15 pertanyaan yang hampir identik dengan `uit.md`.
- `/edu` sudah menampilkan kurikulum 15 soal dan leaderboard.
- `training_events`, `training_teams`, dan `training_team_scores` sudah tersedia di schema.
- pilot `EDU Mode` realtime sudah menambahkan `training_sessions`, `training_session_steps`, dan `training_progress_events`.
- peserta sekarang bisa memulai session dari `/edu` lalu masuk ke dashboard asli dengan overlay realtime.
- Trainer sudah bisa membuat tim dan memberi skor per soal melalui action:
  - `createTrainingTeam`
  - `updateTrainingQuestionScore`
  - `updateTrainingTeamElapsedMinutes`

Implikasinya:

- Jika tujuan user adalah menjadikan `uit.md` sebagai simulasi kelas, sistem ini sebenarnya sudah punya fondasi aplikasi pelatihannya.
- Yang paling dibutuhkan bukan membangun fitur baru dari nol, tetapi menyamakan wording, data seed, dan SOP trainer agar `uit.md` menjadi artefak resmi yang sinkron dengan `/edu`.

## Cara Menjalankan `uit.md` Sebagai Pelatihan Nyata

Alur implementasi yang disarankan:

1. Buat satu event training di `/edu` dengan slug yang konsisten.
2. Sediakan satu tenant demo per tim, bukan satu tenant bersama.
3. Seed struktur holding, branch, dan master data minimum bila ingin menghemat waktu setup.
4. Gunakan 15 soal di `lib/edu/training-simulation.ts` sebagai versi sistem dari `uit.md`.
5. Minta trainer menilai tiga aspek yang sama seperti di dokumen:
   - transaksi berhasil,
   - konteks entitas benar,
   - bukti perubahan saldo/laporan valid.
6. Gunakan `/reports`, `/accounting/aging`, `/accounting/journal`, `/inventory/ledger/[id]`, dan `/settings/audit` sebagai layar verifikasi utama.

## Gap dan Catatan Jujur

Beberapa hal perlu disebutkan apa adanya agar dokumentasi ini tetap akurat:

- Skenario nomor 14 belum ideal bila dipaksa sebagai transfer langsung antar anak perusahaan melalui satu jalur resmi yang sama kuatnya dengan parent-to-child inter-org capital transfer.
- Master data lintas entitas saat ini lebih tepat dianggap sebagai data per-org yang bisa diseed/import, bukan shared master tunggal lintas semua entitas.
- Setup rekening bank child org dapat terkena governance holding, sehingga trainer sebaiknya menyiapkan rekening terlebih dahulu atau memasukkan langkah request-approval ke skenario.
- Modal awal per entitas bisa dilakukan dengan kemampuan accounting yang ada, tetapi bukan berarti sudah ada wizard khusus bernama "modal awal".

## Rekomendasi Lanjutan

Jika ingin membuat skenario `uit.md` menjadi paket pelatihan resmi yang sepenuhnya mulus, prioritas terbaik adalah:

1. Sinkronkan `uit.md` dengan `lib/edu/training-simulation.ts` agar tidak ada drift skenario.
2. Buat seed data training per tim untuk holding, child org, branch, produk, supplier, customer, gudang, dan rekening.
3. Tambahkan dokumentasi trainer untuk langkah verifikasi per soal.
4. Pertimbangkan flow intercompany sibling-to-sibling yang lebih eksplisit bila soal nomor 14 ingin dijadikan jalur standar.

## Bukti Tambahan dari Test Suite

Kesiapan modul-modul ini juga tercermin dari test suite yang sudah ada:

- `__tests__/bank.actions.test.ts`
- `__tests__/purchasing.actions.test.ts`
- `__tests__/inventory.actions.test.ts`
- `__tests__/sales.actions.test.ts`
- `__tests__/assets.actions.test.ts`
- `__tests__/reimburse.actions.test.ts`
- `__tests__/reports.actions.test.ts`

## Kesimpulan Akhir

NIZAM ERP sudah cukup matang untuk menjalankan isi `uit.md` sebagai simulasi bisnis ERP multi-entitas. Secara praktis, sistem ini sudah bisa:

- menjalankan mayoritas alur transaksi yang diminta,
- menunjukkan dampaknya ke stok, kas, hutang, piutang, aset, dan laporan,
- mendukung mode holding dan consolidated reporting,
- serta menyediakan fondasi leaderboard pelatihan melalui `/edu`.

Pekerjaan utama berikutnya bukan membuktikan apakah sistem bisa, tetapi merapikan packaging pelatihannya agar skenario, seed data, scoring, dan batasan flow saling konsisten.
