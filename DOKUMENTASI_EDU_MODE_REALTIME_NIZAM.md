# Dokumentasi Lengkap EDU Mode Realtime NIZAM ERP

## Status Dokumen

- Tipe: product spec + technical design + implementation status
- Status: implemented pilot baseline
- Last updated: 2026-04-16
- Scope: fitur `EDU Mode` untuk latihan langsung di dashboard riil, dengan validasi progres otomatis, timer, leaderboard, dan auto-advance soal

## Ringkasan Eksekutif

`EDU Mode` adalah mode latihan yang membuat peserta mengerjakan soal langsung di dashboard NIZAM ERP yang asli, bukan di mockup terpisah. Sistem memonitor dampak transaksi nyata pada data tenant latihan, memvalidasi checkpoint per soal, lalu menggeser peserta ke soal berikutnya secara otomatis atau semi-otomatis.

Jawaban singkat untuk pertanyaan produk:

- Ya, fitur ini bisa dibuat terasa realtime.
- Ya, fitur ini bisa memiliki batas waktu global maupun per soal.
- Implementasi yang paling realistis untuk arsitektur repo saat ini adalah `server-authoritative near-realtime`, bukan realtime database push murni di browser.

Alasannya:

- shell dashboard tunggal sudah ada di `app/(dashboard)/layout.tsx`,
- kurikulum 15 soal sudah ada di `lib/edu/training-simulation.ts`,
- leaderboard dan scoring manual sudah ada di `/edu`,
- runtime database aktif repo ini memakai Railway PostgreSQL melalui wrapper kompatibilitas di `lib/supabase/server.ts`,
- browser client saat ini belum benar-benar memakai realtime push database karena `channel()` di `lib/supabase/client.ts` masih stub.

Karena itu, desain yang direkomendasikan adalah:

1. `EDU Mode` aktif sebagai overlay global di dashboard asli.
2. setiap aksi transaksi penting memicu validasi progres di server,
3. browser melakukan polling ringan saat sesi aktif,
4. timer disimpan dan dihitung secara otoritatif di server,
5. hasil sesi disinkronkan ke tabel leaderboard yang sudah ada.

## Status Implementasi Saat Ini

Bagian ini menggambarkan status real di codebase per 2026-04-16, bukan lagi sekadar desain target.

Yang sudah diimplementasikan:

- runtime database memakai Railway PostgreSQL, bukan Supabase Cloud,
- halaman `/edu` sudah bisa membuat tim dan memulai `EDU Mode` pilot,
- sesi aktif disimpan di tabel:
  - `training_sessions`
  - `training_session_steps`
  - `training_progress_events`
- migration `1226_edu_mode_sessions.sql` sudah dibuat dan telah diaplikasikan ke Railway PostgreSQL,
- dashboard asli sudah memuat overlay global `EduModeShell`,
- state sesi aktif tersedia lewat `GET/POST/DELETE /api/edu/session/active`,
- timer global sesi, progress, mission drawer, dan log event sudah tampil di dashboard,
- validator otomatis sudah aktif untuk soal 1 sampai 5,
- auto-advance ke soal berikutnya sudah aktif saat checkpoint lolos,
- leaderboard `/edu` sudah disinkronkan dari hasil sesi,
- server actions penting sekarang melakukan `action-triggered validation` setelah transaksi sukses.

Hook validasi yang sudah terpasang:

- `createOrganizationQuick`
- `createBranch`
- `createProduct`
- `createContact`
- `createWarehouse`
- `createBankAccount`
- `createBankTransaction`
- `createInterOrgCapitalTransfer`
- `createPurchaseEntry`
- `receivePurchase`

Yang belum selesai:

- validator otomatis soal 6 sampai 15,
- trainer console penuh,
- pause/resume session,
- manual override trainer,
- push realtime berbasis SSE/websocket,
- analytics dan reporting kompetisi lanjutan.

## Latar Belakang Sistem Saat Ini

Fondasi yang sudah tersedia:

- halaman `/edu` dengan `leaderboard` dan `15 skenario soal`,
- data soal, phase, dan rubrik skor di `lib/edu/training-simulation.ts`,
- server loader leaderboard di `modules/edu/lib/training.server.ts`,
- action manual scoring di `modules/edu/actions/training.actions.ts`,
- action start session di `modules/edu/actions/session.actions.ts`,
- validator session di `modules/edu/lib/session.server.ts`,
- helper hook realtime di `modules/edu/lib/progress-hooks.server.ts`,
- schema:
  - `training_events`
  - `training_teams`
  - `training_team_scores`
  - `training_sessions`
  - `training_session_steps`
  - `training_progress_events`

Keterbatasan saat ini:

- trainer flow masih dominan manual untuk soal di luar pilot 1-5,
- belum ada pause/resume dan override trainer,
- belum ada validator otomatis penuh untuk 15 soal,
- belum ada push/realtime database yang usable di browser,
- `Trainer Console` khusus EDU belum dibuat.

## Sasaran Produk

Fitur ini harus memungkinkan:

1. peserta masuk ke tenant latihan masing-masing,
2. peserta mengerjakan soal di modul dashboard yang asli,
3. sistem mendeteksi keberhasilan transaksi dan konteksnya,
4. sistem memvalidasi checkpoint tanpa trainer harus klik manual untuk tiap soal,
5. sistem menjalankan timer kompetisi,
6. sistem meng-update progress dan leaderboard hampir realtime,
7. trainer tetap bisa override hasil ketika ada kasus abu-abu.

## Non-Sasaran

Versi awal tidak harus:

- memakai websocket atau push realtime native di browser,
- mengotomatiskan 100% seluruh 15 soal tanpa pengecualian,
- mendukung mode non-linear penuh,
- menghapus peran trainer sepenuhnya,
- mengganti halaman `/edu` yang sekarang dari nol.

## Istilah Utama

- `event`: satu event pelatihan, misalnya `simulasi-erp-nizam`.
- `team`: tim peserta pada leaderboard.
- `session`: satu run aktif milik satu tim pada tenant latihan tertentu.
- `step`: status pengerjaan satu soal dalam satu session.
- `validator`: service server-side yang memeriksa apakah step sudah selesai.
- `checkpoint`: aspek validasi per soal, minimal `transaction`, `context`, `evidence`.
- `strict linear mode`: peserta hanya dinilai pada soal aktif, lalu lanjut ke soal berikutnya.

## Persona dan Role

### Peserta

- mengerjakan soal di dashboard asli,
- melihat timer, soal aktif, dan status validasi,
- menerima auto-advance atau tombol lanjut setelah soal lolos.

### Trainer

- membuat event dan tim,
- memantau progres live,
- melihat mismatch atau soal yang butuh review,
- melakukan override hasil bila validator kurang cukup.

### Sistem

- membuat dan menjaga sesi aktif,
- menghitung waktu,
- menjalankan validasi otomatis,
- menyinkronkan skor ke leaderboard.

## Prinsip Desain

1. Dashboard asli tetap menjadi area kerja utama.
2. `EDU Mode` hadir sebagai layer, bukan aplikasi terpisah.
3. Timer dan scoring harus authoritative di server.
4. Validasi berbasis outcome data, bukan sekadar route visited.
5. Aksi user harus menghasilkan feedback cepat.
6. Jika validasi ambigu, sistem jatuh ke `needs_review`, bukan memberi skor palsu.

## Mode Operasi yang Direkomendasikan

### Mode 1 - Strict Linear Timed Race

Mode utama yang direkomendasikan.

- hanya 1 soal aktif pada satu waktu,
- jika soal lolos, sistem membuka soal berikutnya,
- ada timer global event,
- ada timer per soal opsional,
- leaderboard di-update otomatis.

### Mode 2 - Guided Practice

- timer bisa nonaktif,
- auto-advance bisa nonaktif,
- peserta tetap mendapat validator live,
- trainer dapat membiarkan peserta eksplorasi lebih bebas.

### Mode 3 - Hybrid Review

Dipakai untuk soal yang tidak 100% objektif, misalnya interpretasi laporan.

- sistem auto-check data dasar,
- peserta wajib menjawab mini-quiz atau menunggu approval trainer,
- baru step dinyatakan complete.

## Gambaran UX

## 1. Lobby `/edu`

Fungsi:

- pilih event,
- buat tim,
- lihat leaderboard,
- lihat daftar 15 soal,
- klik `Mulai Sesi`.

Tambahan UI yang disarankan:

- kartu status event: `tim aktif`, `waktu tersisa`, `mode event`,
- tabel sesi aktif,
- tombol `Resume Session`,
- tombol `Masuk Dashboard Latihan`.

## 2. Dashboard Asli + EDU Overlay

`EDU Mode` ditanam di `app/(dashboard)/layout.tsx`.

Elemen utama:

- top bar tipis untuk timer dan progress,
- mission drawer di kanan,
- toast dan progress banner setelah validasi sukses,
- chip status checkpoint:
  - `Transaksi`
  - `Konteks`
  - `Bukti`

Contoh wireframe:

```text
┌────────────────────────────────────────────────────────────────────┐
│ EDU MODE · Tim Alpha · Soal 5/15 · 18:24 tersisa · 32% selesai    │
├──────────────────────────────────┬─────────────────────────────────┤
│ Sidebar dashboard asli           │ Mission Drawer                  │
│ - Dashboard                      │ Soal 5: Pembelian Kredit        │
│ - Purchasing                     │ Tujuan dan hint                 │
│ - Inventory                      │                                 │
│ - Cash                           │ Checkpoint live                 │
│ - Reports                        │ [✓] Transaksi                  │
│                                  │ [~] Konteks                    │
│ Area kerja asli                  │ [ ] Bukti                      │
│                                  │                                 │
│                                  │ Aktivitas terakhir              │
│                                  │ - PO tersimpan                  │
│                                  │ - Termin cocok                  │
│                                  │ - Stok belum terdeteksi         │
│                                  │                                 │
│                                  │ [Cek Ulang] [Lanjut]            │
└──────────────────────────────────┴─────────────────────────────────┘
```

## 3. Trainer Console

Fungsi:

- memonitor step aktif semua tim,
- melihat log validasi,
- melihat timer,
- force pause,
- force complete,
- override skor,
- menambah penalti atau bonus waktu bila event mengizinkan.

## Realtime Model

## Prinsip

Untuk arsitektur repo saat ini, `realtime` yang disarankan adalah:

- `server-authoritative`
- `action-triggered`
- `polling-assisted`

Ini berarti:

1. setelah transaksi sukses, server langsung menjalankan validasi yang relevan,
2. browser melakukan polling 3-5 detik saat session aktif dan tab visible,
3. trainer board juga melakukan polling 5-10 detik,
4. semua keputusan validasi tetap dihitung dari state database di server.

## Kenapa Bukan Push Database Murni

Saat ini `lib/supabase/client.ts` menyediakan antarmuka mirip Supabase browser client untuk Railway PostgreSQL, tetapi method `channel()` hanya stub. Jadi tidak aman mengandalkan subscription database dari browser untuk fitur inti kompetisi.

Karena itu, SLA yang realistis untuk V1:

- `p50` feedback setelah aksi sendiri: 1-2 detik
- `p95` feedback setelah aksi sendiri: <= 5 detik
- fallback polling penuh: <= 10 detik

Secara pengalaman user, ini sudah cukup dianggap realtime untuk mode latihan.

## Opsi Upgrade Realtime V2

Jika ke depan ingin benar-benar push:

- buat SSE endpoint `app/api/edu/session/[id]/stream/route.ts`, atau
- bangun notification bus server-side, atau
- aktifkan infra realtime browser yang sesungguhnya.

Tetapi V1 tidak membutuhkan itu.

## Model Waktu

## Prinsip Timer

Timer harus otoritatif di server. Browser hanya menampilkan countdown.

Jangan menyimpan waktu hanya di local state. Risiko:

- tab refresh,
- clock user dimanipulasi,
- session dibuka di lebih dari satu device,
- race condition saat pause/resume.

## Jenis Waktu

### 1. Waktu Global Event

- contoh: 180 menit untuk semua soal
- dipakai untuk ranking utama

### 2. Waktu per Soal

Opsional.

- contoh: soal 5 maksimal 12 menit
- jika habis, step bisa:
  - `expired`,
  - `needs_review`,
  - atau auto lanjut dengan penalti

### 3. Waktu Pause

Hanya trainer yang boleh pause.

- pause tidak boleh bergantung pada browser peserta,
- durasi pause harus dikurangi dari timer efektif,
- semua pause dicatat di log.

## Rumus Waktu Efektif

`effective_elapsed_seconds = now - started_at - total_paused_seconds`

`remaining_seconds = max(0, deadline_at - now + paused_adjustment)`

## State Machine Timer

Session:

- `READY`
- `ACTIVE`
- `PAUSED`
- `COMPLETED`
- `EXPIRED`
- `ABANDONED`

Step:

- `LOCKED`
- `ACTIVE`
- `VALIDATING`
- `PASSED`
- `NEEDS_REVIEW`
- `TIMED_OUT`

## Arsitektur Tingkat Tinggi

```text
/edu lobby
  -> create/resume session
  -> assign team + training org
  -> redirect ke /dashboard?edu_session=...

Dashboard layout
  -> mount EduModeShell
  -> load current session state
  -> tampilkan timer + mission drawer

User action di module riil
  -> server action sukses
  -> trigger validateCurrentTrainingSession()
  -> update training_session_steps
  -> sync skor ke training_team_scores
  -> client polling membaca state terbaru
  -> auto-advance / next prompt tampil
```

## Integrasi ke Struktur Repo

### File yang sudah ada

- `app/edu/page.tsx`
- `app/edu/EduSimulationClient.tsx`
- `app/api/edu/session/active/route.ts`
- `lib/edu/training-simulation.ts`
- `modules/edu/lib/training.server.ts`
- `modules/edu/actions/training.actions.ts`
- `modules/edu/actions/session.actions.ts`
- `modules/edu/lib/session.server.ts`
- `modules/edu/lib/progress-hooks.server.ts`
- `components/edu/EduModeShell.tsx`
- `app/(dashboard)/layout.tsx`
- `modules/demo/actions/demo.actions.ts`

### File backlog yang masih direkomendasikan

- `components/edu/EduMissionDrawer.tsx`
- `components/edu/EduTimerBar.tsx`
- `components/edu/EduTrainerConsole.tsx`
- `modules/edu/actions/validator.actions.ts`
- `modules/edu/lib/validator-registry.ts`
- `modules/edu/lib/validators/*.ts`
- `app/api/edu/session/[sessionId]/stream/route.ts`

## Desain Data Model

## Tabel Existing yang Tetap Dipakai

### `training_events`

Tetap dipakai sebagai sumber event.

Perlu diperluas `settings` agar memuat:

- `mode`: `strict_linear` | `guided` | `hybrid`
- `time_limit_minutes`
- `question_time_limit_minutes`
- `realtime_enabled`
- `auto_advance_enabled`
- `allow_trainer_override`
- `demo_template`

### `training_teams`

Tetap dipakai untuk identitas tim dan leaderboard.

### `training_team_scores`

Tetap dipakai sebagai ringkasan scoreboard publik.

## Tabel Baru yang Sudah Diimplementasikan

### `training_sessions`

Satu baris untuk satu run tim.

Kolom utama:

- `id`
- `event_id`
- `team_id`
- `org_id`
- `active_branch_id`
- `status`
- `current_question_id`
- `started_by`
- `started_at`
- `deadline_at`
- `paused_at`
- `total_paused_seconds`
- `completed_at`
- `last_validated_at`
- `last_heartbeat_at`
- `metadata jsonb`

### `training_session_steps`

Satu baris per soal per session.

Kolom utama:

- `id`
- `session_id`
- `question_id`
- `status`
- `started_at`
- `completed_at`
- `deadline_at`
- `elapsed_seconds`
- `transaction_ok`
- `context_ok`
- `evidence_ok`
- `points_awarded`
- `matched_record_ids jsonb`
- `matched_tables jsonb`
- `validator_version`
- `trainer_note`
- `system_note`

### `training_progress_events`

Event log granular untuk debugging dan trainer visibility.

Kolom utama:

- `id`
- `session_id`
- `question_id`
- `event_type`
- `severity`
- `message`
- `source_module`
- `payload jsonb`
- `created_at`
- `created_by`

## Kenapa Perlu `session`

Tanpa `session`, sistem tidak bisa membedakan:

- run lama vs run baru,
- data tenant sisa latihan sebelumnya,
- siapa yang sedang aktif,
- kapan timer dimulai,
- soal mana yang sedang dinilai.

`training_team_scores` saja cukup untuk board manual, tetapi tidak cukup untuk auto progression.

## Sinkronisasi dengan Leaderboard Existing

Setelah step lolos:

1. update `training_session_steps`,
2. hitung poin step,
3. tulis snapshot ke `training_team_scores`,
4. update `training_teams.elapsed_minutes` atau simpan hasil akhir saat session selesai.

Dengan cara ini, UI `/edu` yang ada masih bisa tetap dipakai tanpa dibongkar total.

## Validator Engine

## Prinsip Validator

Validator memeriksa hasil bisnis, bukan sekadar event UI.

Tiap validator mengembalikan:

- `transaction_ok`
- `context_ok`
- `evidence_ok`
- `matched_record_ids`
- `summary`
- `needs_review`

Contoh kontrak:

```ts
type TrainingValidationResult = {
  transactionOk: boolean
  contextOk: boolean
  evidenceOk: boolean
  matchedRecordIds: string[]
  matchedTables: string[]
  summary: string
  needsReview?: boolean
}
```

## Sumber Data Validator

Urutan sumber kebenaran:

1. tabel transaksi primer,
2. tabel detail atau turunan,
3. laporan ringkasan,
4. audit log sebagai bukti tambahan.

Audit log tidak boleh menjadi satu-satunya sumber kebenaran.

## Trigger Validasi

### Trigger primer

Sesudah server action transaksi sukses:

- purchasing
- sales
- cash/bank
- inventory transfer
- reimbursements
- fixed assets
- HRIS transfer

### Trigger sekunder

Polling client:

- peserta: 3-5 detik
- trainer: 5-10 detik

### Trigger manual

- tombol `Cek Ulang`
- trainer override

## Kebijakan Auto-Advance

Jika `transaction_ok`, `context_ok`, dan `evidence_ok` semuanya `true`:

- set step `PASSED`,
- simpan `completed_at`,
- sync score,
- tampilkan toast,
- buka soal berikutnya.

Auto-advance yang direkomendasikan:

- default: tampilkan toast 1.5-2 detik lalu drawer pindah ke soal berikutnya,
- route tidak harus otomatis berubah jika user masih di modul yang relevan,
- tampilkan CTA jelas ke modul target berikutnya.

## Validasi 15 Soal

| No | Soal | Sumber validasi utama | Otomasi |
|---|---|---|---|
| 1 | Struktur grup usaha | `organizations`, `org_members`, `branches` | penuh |
| 2 | Master data dasar | `products`, `contacts`, `warehouses`, `bank_accounts` | penuh |
| 3 | Modal awal per entitas | `bank_transactions`, `journal_entries`, laporan | penuh |
| 4 | Transfer modal holding ke anak | transaksi inter-org, `bank_transactions`, laporan | penuh |
| 5 | Pembelian kredit | `purchases`, `purchase_items`, stok, AP | penuh |
| 6 | Bayar sebagian hutang | `purchase_payments`, `bank_transactions`, aging AP | penuh |
| 7 | Mutasi stok antar gudang | `inventory_transfers`, stock ledger | penuh |
| 8 | Penjualan kredit | `sales`, items, stok, AR, jurnal | penuh |
| 9 | Terima sebagian piutang | `sales_payments`, `bank_transactions`, aging AR | penuh |
| 10 | Penjualan POS tunai | transaksi POS-origin, stok, kas/bank | penuh |
| 11 | Reimbursement | `reimbursements`, approval, payout/jurnal | semi-penuh |
| 12 | Aset tetap | `fixed_assets`, jurnal kapitalisasi, laporan | penuh |
| 13 | Mutasi karyawan | data karyawan, target org, audit trail | semi-penuh |
| 14 | Antar entitas kedua | transfer operasional/intercompany | hybrid |
| 15 | Review laporan konsolidasi | laporan + penjelasan peserta | hybrid |

## Catatan Validator per Soal

### Soal 1

Lulus bila:

- holding ada,
- dua child org ada,
- masing-masing punya minimal satu branch aktif.

### Soal 2

Lulus bila hitungan minimum terpenuhi pada entitas yang benar:

- 3 produk,
- 1 supplier,
- 2 customer,
- 2 gudang,
- rekening bank relevan.

### Soal 3

Lulus bila:

- ada transaksi kas/bank masuk sesuai nominal skenario,
- jurnal seimbang,
- laporan menunjukkan dampak.

### Soal 4

Lulus bila:

- transaksi sumber dan tujuan tercatat,
- relasi parent-child benar,
- saldo bergerak di dua entitas yang tepat.

### Soal 5

Lulus bila:

- purchase tersimpan,
- termin 30 hari sesuai,
- stok gudang tujuan bertambah,
- AP dan nilai inventory berubah.

### Soal 6

Lulus bila:

- payment tercatat,
- nilainya parsial,
- outstanding masih tersisa.

### Soal 7

Lulus bila:

- mutasi tercatat dari gudang A ke gudang B,
- kuantitas sesuai,
- total stok perusahaan tetap.

### Soal 8

Lulus bila:

- sales invoice kredit tercatat,
- stok keluar,
- AR bertambah,
- pendapatan tercermin di jurnal.

### Soal 9

Lulus bila:

- penerimaan pembayaran tercatat,
- bank naik,
- AR turun sebagian,
- outstanding tetap ada.

### Soal 10

Lulus bila:

- transaksi POS tersimpan,
- stok retail turun,
- kas/bank bertambah,
- record masuk ke laporan penjualan harian.

### Soal 11

Versi awal disarankan lulus jika:

- reimbursement diajukan,
- minimal approval tercapai,
- jika skenario mensyaratkan bayar, payout juga harus ada.

### Soal 12

Lulus bila:

- record ada di `fixed_assets`,
- jurnal kapitalisasi berhasil,
- aset muncul di neraca.

### Soal 13

Lulus bila:

- employee berpindah ke entitas tujuan,
- riwayat mutasi tercatat,
- optional: PIC cabang dapat diarahkan ke employee tersebut.

### Soal 14

Sebaiknya dibatasi pada skenario yang benar-benar didukung environment.

Rekomendasi V1:

- fokus ke transfer dana operasional antar entitas yang paling terkontrol,
- jangan langsung mengandalkan supply barang sibling-to-sibling bila flow belum distandardisasi penuh.

### Soal 15

Soal ini disarankan hybrid.

Auto-check:

- laporan consolidated tersedia,
- angka utama berubah.

Manual/hybrid:

- peserta menjawab minimal 3 dampak angka,
- trainer menekan `approve review`, atau
- peserta mengisi mini-quiz 3 butir.

## Timer dan Scoring

## Scoring Dasar

Tetap gunakan rubrik yang sudah ada:

- `transaction`: 1 poin
- `context`: 1 poin
- `evidence`: 1 poin

Skor maksimal:

- `15 soal x 3 poin = 45 poin`

## Ranking

Urutan ranking tetap:

1. total skor tertinggi
2. verified tasks lebih banyak
3. correction count lebih sedikit
4. waktu lebih cepat

## Aturan Waktu

Rekomendasi default event:

- `global time limit`: 180 menit
- `warning threshold`: 30 menit tersisa
- `critical threshold`: 10 menit tersisa

Opsi penalti:

- terlambat per soal: `needs_review`
- melebihi total waktu: session `EXPIRED`

## UI dan Komponen

## Komponen Global

### `EduModeShell`

Tanggung jawab:

- load session aktif,
- render timer bar,
- render mission drawer,
- polling state,
- handle toast dan auto-advance.

### `EduTimerBar`

Saat ini belum dipisah sebagai komponen sendiri. Fungsinya masih berada di dalam `EduModeShell`.

Menampilkan:

- nama tim,
- soal aktif,
- countdown,
- progress persentase,
- status pause/expired.

### `EduMissionDrawer`

Saat ini belum dipisah sebagai komponen sendiri. Fungsinya masih berada di dalam `EduModeShell`.

Menampilkan:

- judul soal,
- instruksi,
- indikator sukses,
- checkpoint live,
- tombol `cek ulang`,
- hint,
- CTA ke modul tujuan.

### `EduTrainerConsole`

Masih backlog.

Menampilkan:

- seluruh tim aktif,
- soal aktif tiap tim,
- log mismatch,
- override control,
- pause/resume.

## Integrasi ke Layout

Lokasi injeksi yang direkomendasikan:

- `app/(dashboard)/layout.tsx`

Alur aktual saat ini:

1. cek cookie `nizam_edu_session_id`,
2. load state session aktif,
3. render children normal,
4. render `EduModeShell` di atasnya.

## API dan Server Actions

## Action dan Route yang Sudah Ada

### `startTrainingSession`

Fungsi:

- validasi team,
- assign org latihan,
- buat `training_sessions`,
- buat semua `training_session_steps`,
- set soal pertama aktif,
- set cookie session dan org context,
- kembalikan `sessionId` dan `redirectTo`.

### `getCurrentTrainingSessionState`

Fungsi:

- ambil timer,
- step aktif,
- history,
- checkpoint,
- remaining time.

### `validateCurrentTrainingSession`

Fungsi:

- jalankan validator soal aktif,
- update step,
- jika lolos, jalankan auto-advance,
- sinkronkan score ke `training_team_scores`.

### `clearEduSessionCookie`

- menutup mode di browser dengan menghapus cookie session aktif.

## Route API yang Sudah Ada

- `GET /api/edu/session/active`
- `POST /api/edu/session/active`
- `DELETE /api/edu/session/active`

## Action Backlog

### `pauseTrainingSession`

Hanya trainer.

### `resumeTrainingSession`

Hanya trainer.

### `completeTrainingSession`

- menutup session,
- menulis hasil final ke leaderboard.

### `overrideTrainingStep`

Trainer manual override.

## Integrasi ke Module Actions Existing

Server action yang selesai melakukan write transaksi perlu memicu validasi. Implementasi saat ini memakai helper:

```ts
await nudgeEduModeValidation('source.tag')
```

Yang sudah terpasang:

- `modules/organization/actions/org.actions.ts`
- `modules/inventory/actions/inventory.actions.ts`
- `modules/contacts/actions/contact.actions.ts`
- `modules/inventory/actions/warehouse.actions.ts`
- `modules/purchasing/actions/purchasing.actions.ts`
- `modules/cash/actions/bank.actions.ts`

Yang masih backlog:

- `modules/sales/actions/sales.actions.ts`
- `modules/sales/actions/pos.actions.ts`
- `modules/accounting/actions/reimburse.actions.ts`
- `modules/accounting/actions/assets.actions.ts`
- `modules/hris/actions/employee.actions.ts`

Pola integrasi:

1. transaksi sukses,
2. revalidate path seperti biasa,
3. panggil helper ringan:

```ts
await nudgeEduModeValidation('purchasing.create.purchase')
```

Helper ini:

- membaca cookie session aktif dari request user,
- kalau ada, jalankan validator soal aktif,
- jika tidak ada, no-op.

## Hubungan dengan Demo Tenant

Rekomendasi kuat:

- satu tim = satu tenant demo / org demo sendiri

Alasannya:

- timer tidak saling bentrok,
- data tidak saling menimpa,
- validator lebih sederhana,
- leaderboard lebih fair.

Catatan penting:

`modules/demo/actions/demo.actions.ts` saat ini masih berangkat dari pola demo yang selalu reset org. Untuk kelas paralel, EDU Mode sebaiknya memakai provisioning tenant per tim, bukan semua tim masuk ke satu org demo yang sama.

## Governance dan Keamanan

## Prinsip

Karena fitur ini dipakai untuk scoring, sistem harus defensif terhadap:

- refresh browser,
- multi-tab,
- clock spoofing,
- transaksi salah tenant,
- penilaian pada data run lama.

## Aturan Keamanan

1. session harus terkait ke `org_id` yang spesifik.
2. validator hanya membaca data setelah `session.started_at`.
3. jika perlu, simpan `baseline snapshot` awal untuk pembanding.
4. trainer override wajib dicatat di `training_progress_events`.
5. peserta tidak boleh langsung menulis `training_team_scores`.
6. timer dan auto-advance hanya boleh diputuskan server.

## Performa

Target performa:

- polling peserta: 3-5 detik saat aktif
- polling trainer board: 5-10 detik
- validasi satu step: idealnya <500ms, maksimum 2s untuk query berat

Optimisasi:

- validasi hanya soal aktif,
- filter data `created_at >= session.started_at`,
- gunakan query spesifik per modul,
- hindari full scan laporan jika tidak perlu,
- simpan hasil validasi terakhir dan `last_validated_at`.

## Logging dan Observability

Simpan event berikut:

- session started
- timer paused/resumed
- validator triggered
- checkpoint changed
- auto-advance executed
- trainer override
- session expired/completed

Kegunaan:

- debugging,
- audit fairness,
- analisis UX,
- bukti jika peserta komplain hasil.

## Test Plan

## Unit Test

Wajib untuk:

- kalkulasi timer,
- state machine session,
- masing-masing validator utama,
- sinkronisasi ke `training_team_scores`.

## Integration Test

Minimal skenario:

1. buat session baru -> soal 1 aktif
2. lengkapi data soal 1 -> validator pass -> soal 2 aktif
3. lakukan transaksi salah entitas -> context fail
4. lakukan transaksi benar tapi bukti belum cukup -> evidence fail
5. timer habis -> session expired
6. trainer override -> skor sinkron ke leaderboard

## Manual QA

Checklist:

- dashboard tanpa `edu_session` tetap normal,
- timer tetap benar setelah refresh,
- multi-tab tidak menggandakan auto-advance,
- leaderboard berubah setelah step selesai,
- trainer melihat progress hampir realtime,
- pause/resume memengaruhi countdown dengan benar.

## Rollout Plan

## Phase 1

Fondasi data dan shell:

- migration session tables,
- `EduModeShell`,
- timer server-authoritative,
- start/resume session,
- polling state.

Status: selesai untuk pilot.

## Phase 2

Validator otomatis untuk soal objektif:

- 1 sampai 10
- 12

Status: in progress. Saat ini baru 1 sampai 5 yang aktif.

## Phase 3

Hybrid validator:

- 11
- 13
- 14
- 15

Status: belum dimulai.

## Phase 4

Trainer console penuh dan analytics:

- override tools,
- event metrics,
- report kompetisi.

Status: belum dimulai.

## Risiko dan Mitigasi

### Risiko: realtime terasa lambat

Mitigasi:

- panggil validator langsung setelah server action sukses,
- polling sebagai backup.

### Risiko: data tenant bekas run lama terbaca

Mitigasi:

- filter sejak `session.started_at`,
- gunakan tenant per tim,
- bila perlu buat baseline snapshot.

### Risiko: soal hybrid terlalu ambigu

Mitigasi:

- tandai `needs_review`,
- sediakan trainer override.

### Risiko: terlalu banyak coupling ke tiap module action

Mitigasi:

- pakai helper tunggal `nudgeEduModeValidation`,
- jangan tanam logika validator di modul bisnis.

## Definisi Selesai

Fitur dianggap siap bila:

1. peserta dapat memulai session dari `/edu` -> `DONE`
2. peserta masuk ke dashboard asli dengan overlay `EDU Mode` -> `DONE`
3. sistem menampilkan countdown global secara benar -> `DONE`
4. soal aktif tervalidasi otomatis berdasarkan outcome data -> `DONE` untuk soal 1-5
5. sistem menggeser ke soal berikutnya setelah step lolos -> `DONE` untuk soal 1-5
6. leaderboard `/edu` ikut berubah -> `DONE`
7. trainer dapat pause/resume dan override -> `BACKLOG`
8. minimal 10 soal pertama dapat otomatis penuh -> `BACKLOG`
9. soal hybrid jatuh ke `needs_review` dengan jalur trainer yang jelas -> `BACKLOG`
10. timer tetap konsisten setelah refresh, multi-tab, dan reconnect -> `DONE` untuk skenario standar session aktif

## Rekomendasi Implementasi Praktis

Jika harus memilih jalur paling efektif untuk eksekusi:

1. pertahankan pilot saat ini sebagai baseline stabil,
2. lanjutkan validator otomatis soal 6-15,
3. tambahkan trainer control untuk pause/resume/override,
4. pertahankan polling 3-5 detik plus `action-triggered validation`,
5. sisakan push/SSE murni sebagai optimisasi V2.

## Kesimpulan

`EDU Mode` realtime bertimer sudah berhasil masuk ke repo ini dalam bentuk pilot fungsional tanpa mengganti fondasi dashboard yang sudah ada. Kunci desain yang dipakai adalah:

- sesi latihan per tim,
- timer yang authoritative di server,
- validator berbasis outcome transaksi nyata,
- overlay global di dashboard,
- sinkronisasi hasil ke leaderboard existing,
- near-realtime polling plus action-triggered validation.

Status saat ini sudah cukup untuk pilot kelas nyata pada soal 1-5. Pekerjaan berikutnya adalah memperluas validator ke soal 6-15 dan menambahkan tooling trainer agar mode ini siap dipakai lebih luas.
