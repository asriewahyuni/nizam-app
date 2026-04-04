# Finance Manual Test Guide

Dokumen ini dipakai untuk uji manual fitur finance berdasarkan audit kode pada 4 April 2026.

## Tujuan

Memvalidasi bug yang sudah teridentifikasi pada area:

- Kas & Bank
- Aging AR/AP
- Forecast / Proyeksi Kas
- Reimbursement
- Approval workflow

Dokumen ini sengaja fokus pada langkah reproduksi, gejala bug, dan bukti yang perlu dicek. Ini bukan test plan regresi penuh.

## Persiapan Lingkungan

Gunakan salah satu mode berikut:

- `NEXT_PUBLIC_SUPABASE_TARGET=local` untuk pengujian aman di Supabase local.
- Target online hanya jika data uji dipisahkan dari data produksi.

Jalankan aplikasi:

```bash
npm run dev
```

Pastikan user penguji memiliki:

- akses ke modul `Finance`, `Accounting`, dan `Approval`
- minimal 1 unit/cabang aktif
- minimal 1 rekening kas/bank yang sudah terhubung ke akun aset kas

## Data Minimum Yang Disarankan

Sebelum testing, siapkan data dasar berikut:

- 1 akun kas/bank aktif, mis. akun `1101`
- 1 akun piutang, mis. `1201`
- 1 akun hutang, mis. `2101`
- 1 akun beban operasional
- 1 akun pendapatan
- 1 customer
- 1 vendor

## Cara Mencatat Hasil

Untuk setiap skenario, catat:

- waktu uji
- user yang dipakai
- branch aktif
- langkah yang dijalankan
- hasil aktual
- screenshot UI
- hasil query SQL bila dipakai

## Skenario Uji

### FIN-01 — Forecast menghitung nilai penuh dokumen `PARTIAL`

**Tujuan**

Membuktikan bahwa proyeksi kas memakai `grand_total`, bukan outstanding riil.

**Prasyarat**

- ada invoice penjualan status `PARTIAL`
- ada purchase status `PARTIAL`

**Contoh data**

- Sales invoice `SO-TEST-01` total `1.000.000`, sudah dibayar `400.000`, due date `2026-04-10`
- Purchase `PO-TEST-01` total `800.000`, sudah dibayar `300.000`, due date `2026-04-10`

**Langkah**

1. Buat sales invoice tempo.
2. Bayar sebagian invoice tersebut.
3. Buat purchase tempo.
4. Bayar sebagian purchase tersebut.
5. Buka halaman [`/accounting/forecast`](/Users/idyogi/Local-Project/nizamapp/nizam-app/app/(dashboard)/accounting/forecast/page.tsx).
6. Catat nilai `totalProjectedInflow`, `totalProjectedOutflow`, dan saldo harian pada tanggal jatuh tempo.

**Hasil yang benar seharusnya**

- inflow hanya sisa outstanding sales: `600.000`
- outflow hanya sisa outstanding purchase: `500.000`

**Indikasi bug saat ini**

- inflow masih tampil `1.000.000`
- outflow masih tampil `800.000`
- saldo forecast lebih optimistis atau lebih buruk dari angka riil

**Verifikasi SQL opsional**

```sql
select id, sale_number, grand_total, payment_status
from sales
where sale_number = 'SO-TEST-01';

select sale_id, amount, discount_amount
from sales_payments
where sale_id = '<sales_id>';

select id, purchase_number, grand_total, payment_status
from purchases
where purchase_number = 'PO-TEST-01';

select purchase_id, amount, discount_amount
from purchase_payments
where purchase_id = '<purchase_id>';
```

### FIN-02 — Hapus transaksi kas menghilangkan sumber transaksi tetapi hanya me-void jurnal

**Tujuan**

Membuktikan bahwa delete transaksi di Kas & Bank tidak menjaga audit trail sumber transaksi.

**Langkah**

1. Buka halaman [`/cash`](/Users/idyogi/Local-Project/nizamapp/nizam-app/app/(dashboard)/cash/page.tsx).
2. Buat 1 transaksi `OUT`, mis. deskripsi `FIN-02 Test`, nominal `150.000`.
3. Pastikan transaksi muncul di daftar `POSTED`.
4. Buka juga [`/accounting/journal`](/Users/idyogi/Local-Project/nizamapp/nizam-app/app/(dashboard)/accounting/journal/page.tsx) dan catat entry jurnal yang terbentuk.
5. Kembali ke halaman kas, lalu hapus transaksi tadi dari UI.
6. Refresh halaman kas dan jurnal.

**Hasil yang benar seharusnya**

- sumber transaksi tetap tersimpan untuk audit, minimal berstatus `VOIDED`
- jurnal dan sumber transaksi tetap konsisten

**Indikasi bug saat ini**

- transaksi hilang dari daftar kas
- jurnal menjadi `VOIDED`
- tidak ada lagi row transaksi sumber yang bisa diaudit dari modul Kas & Bank

**Verifikasi SQL opsional**

```sql
select id, description, status, journal_entry_id
from bank_transactions
where description = 'FIN-02 Test'
order by created_at desc;

select id, description, status, void_reason
from journal_entries
where description = 'FIN-02 Test'
order by created_at desc;
```

### FIN-03 — Shortcut dari Aging ke Cash tidak membawa akun settlement

**Tujuan**

Membuktikan bahwa tombol bayar/terima dari Aging hanya membuka modal kas, tetapi tidak mengikat akun lawan secara aman.

**Prasyarat**

- perlu ada row aging bertipe `JOURNAL`

**Cara termudah menyiapkan data**

1. Buat jurnal manual yang menyentuh akun `1201` atau `2101` tanpa dokumen sales/purchase terkait.
2. Buka halaman [`/accounting/aging`](/Users/idyogi/Local-Project/nizamapp/nizam-app/app/(dashboard)/accounting/aging/page.tsx).
3. Pastikan muncul row `Unallocated (Buku Besar)` dengan nomor seperti `GL-1201-ADJ` atau `GL-2101-ADJ`.

**Langkah**

1. Dari Aging, klik tombol `Terima Bayar` atau `Bayar Tagihan` pada row `JOURNAL`.
2. Pastikan Anda diarahkan ke [`/cash`](/Users/idyogi/Local-Project/nizamapp/nizam-app/app/(dashboard)/cash/page.tsx) dengan modal transaksi terbuka.
3. Perhatikan field yang terisi otomatis.
4. Simpan transaksi tanpa memilih akun lawan yang sesuai dengan piutang/hutang yang sedang diselesaikan, atau pilih akun lain secara sengaja.

**Hasil yang benar seharusnya**

- sistem membawa konteks settlement secara aman
- akun lawan tidak boleh bebas salah pilih
- outstanding aging berkurang pada dokumen/akun yang tepat

**Indikasi bug saat ini**

- modal hanya terisi `type`, `amount`, dan `description`
- akun lawan tetap harus dipilih manual
- user bisa mem-posting ke akun yang salah
- aging tidak benar-benar clear sesuai maksud tombol asal

### FIN-04 — Opsi transfer tampil di UI tetapi backend menolak

**Tujuan**

Membuktikan adanya broken flow pada mode transfer antar rekening.

**Prasyarat**

- tersedia minimal 2 rekening kas/bank aktif

**Langkah**

1. Buka halaman [`/cash`](/Users/idyogi/Local-Project/nizamapp/nizam-app/app/(dashboard)/cash/page.tsx).
2. Klik `Transaksi`.
3. Pilih mode `XFER`.
4. Isi source account, target account, tanggal, deskripsi, dan nominal.
5. Submit.

**Hasil yang benar seharusnya**

- transfer berhasil dibuat sebagai perpindahan antar akun aset

**Indikasi bug saat ini**

- muncul error: `Transfer antar rekening belum didukung pada modul Kas & Bank versi ini.`
- artinya UI menawarkan alur yang memang belum diimplementasikan server

### FIN-05 — Approval reimbursement bisa drift dari approval center

**Tujuan**

Membuktikan bahwa approve/reject dari halaman reimbursement tidak selalu sinkron dengan `approval_requests`.

**Prasyarat**

- ada reimbursement baru berstatus `PENDING`
- reimbursement tersebut dibuat lewat flow normal sehingga juga membuat row `approval_requests`

**Langkah**

1. Submit reimbursement baru dari halaman [`/accounting/reimburse`](/Users/idyogi/Local-Project/nizamapp/nizam-app/app/(dashboard)/accounting/reimburse/page.tsx).
2. Pastikan item muncul di halaman approval [`/accounting/approvals`](/Users/idyogi/Local-Project/nizamapp/nizam-app/app/(dashboard)/accounting/approvals/page.tsx).
3. Kembali ke halaman reimbursement.
4. Approve atau reject langsung dari halaman reimbursement, bukan dari approval center.
5. Buka kembali halaman approval center.

**Hasil yang benar seharusnya**

- status reimbursement dan approval request selalu sama
- item approved tidak lagi muncul di daftar pending approval

**Indikasi bug saat ini**

- reimbursement berubah jadi `APPROVED` atau `REJECTED`
- approval center masih menampilkan request yang sama sebagai `PENDING`

**Verifikasi SQL opsional**

```sql
select id, claim_number, status
from reimbursements
order by created_at desc
limit 5;

select id, source_type, source_id, status
from approval_requests
where source_type = 'REIMBURSEMENT'
order by requested_at desc
limit 5;
```

### FIN-06 — Import CSV mutasi bank rapuh terhadap file kosong, koma, dan format tanggal

**Tujuan**

Membuktikan parser CSV rekonsiliasi belum robust untuk file bank nyata.

**Siapkan 3 file**

`empty.csv`

```csv

```

`comma-description.csv`

```csv
date,description,amount,type,balance
2026-04-04,"TRANSFER, BIAYA ADMIN",-2500,OUT,997500
```

`id-date-format.csv`

```csv
date,description,amount,type,balance
04/04/2026,SETOR TUNAI,100000,IN,1097500
```

**Langkah**

1. Buka tab rekonsiliasi di halaman [`/cash`](/Users/idyogi/Local-Project/nizamapp/nizam-app/app/(dashboard)/cash/page.tsx).
2. Pilih rekening target.
3. Upload `empty.csv`.
4. Ulangi dengan `comma-description.csv`.
5. Ulangi dengan `id-date-format.csv`.

**Hasil yang benar seharusnya**

- file kosong ditolak dengan pesan validasi yang jelas
- deskripsi dengan koma tetap terbaca utuh
- format tanggal yang didukung bank tervalidasi atau ditolak dengan pesan yang jelas

**Indikasi bug saat ini**

- file kosong bisa menghasilkan error parsing yang tidak rapi
- deskripsi dengan koma pecah ke kolom yang salah
- tanggal non-ISO rawan tersimpan salah atau gagal diparse

### FIN-07 — Validasi tanggal “hari ini” di Kas/Aging rawan bias UTC

**Tujuan**

Membuktikan beberapa tampilan finance masih memakai `new Date().toISOString().split('T')[0]`, yang rawan beda hari di timezone Asia/Jakarta.

**Skenario yang disarankan**

- jalankan uji sekitar pukul `00:00` sampai `07:00` WIB

**Langkah**

1. Buat transaksi kas `OUT` tepat setelah lewat tengah malam WIB.
2. Buka kartu `Pengeluaran Hari Ini` di halaman kas.
3. Bandingkan nominal kartu dengan transaksi yang baru dibuat.
4. Di halaman aging, buat atau cek dokumen dengan due date sama dengan tanggal lokal hari ini.
5. Bandingkan bucket aging dengan tanggal lokal sebenarnya.

**Hasil yang benar seharusnya**

- transaksi hari ini menurut WIB masuk ke kartu `Pengeluaran Hari Ini`
- bucket aging mengikuti tanggal lokal bisnis

**Indikasi bug saat ini**

- transaksi yang baru dibuat tidak dihitung sebagai “hari ini”
- bucket aging bisa maju atau mundur satu hari

## Prioritas Uji Manual

Jika waktu terbatas, jalankan urutan ini terlebih dahulu:

1. `FIN-02`
2. `FIN-01`
3. `FIN-05`
4. `FIN-04`
5. `FIN-03`

## Referensi Kode

Area yang relevan untuk investigasi setelah uji manual:

- [`modules/cash/actions/bank.actions.ts`](/Users/idyogi/Local-Project/nizamapp/nizam-app/modules/cash/actions/bank.actions.ts)
- [`modules/cash/actions/reconcile.actions.ts`](/Users/idyogi/Local-Project/nizamapp/nizam-app/modules/cash/actions/reconcile.actions.ts)
- [`modules/accounting/actions/forecast.actions.ts`](/Users/idyogi/Local-Project/nizamapp/nizam-app/modules/accounting/actions/forecast.actions.ts)
- [`modules/accounting/actions/aging.actions.ts`](/Users/idyogi/Local-Project/nizamapp/nizam-app/modules/accounting/actions/aging.actions.ts)
- [`modules/accounting/actions/reimburse.actions.ts`](/Users/idyogi/Local-Project/nizamapp/nizam-app/modules/accounting/actions/reimburse.actions.ts)
- [`modules/organization/actions/approval.actions.ts`](/Users/idyogi/Local-Project/nizamapp/nizam-app/modules/organization/actions/approval.actions.ts)

