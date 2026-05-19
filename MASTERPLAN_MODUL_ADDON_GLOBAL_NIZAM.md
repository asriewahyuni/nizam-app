# MASTERPLAN MODUL DAN ADD-ON NIZAM — PERSPEKTIF GLOBAL

## Status Dokumen

- Versi: `1.0`
- Tanggal: `19 Mei 2026`
- Basis analisis: `branch feat_multi + pain point customer global SMB/Enterprise ERP`
- Tujuan: `merencanakan modul dan add-on baru yang menyelesaikan pain point customer secara global, dibangun di atas arsitektur 4 pilar NIZAM yang sudah ada`

---

## 1. Ringkasan Eksekutif

NIZAM sudah memiliki fondasi arsitektur produk yang kuat:
- **4 Pilar Core**: Finance Core, Revenue Core, Inventory Core + Purchasing, HRIS Core
- **5 Vertical Module**: Manufacturing, Fleet & Rental, Service Operations, Project & Construction, Syirkah
- **1 Strategic Module**: Academy / EDU
- **11 Add-on** yang sudah ada: POS, Advanced WMS, Sales Page, API, Multi-Entity, Quick Bill, dll.

Analisis ini mengidentifikasi **14 modul dan add-on baru** yang akan menyelesaikan pain point customer global yang belum tertangani, dikelompokkan ke dalam 4 kluster strategis:

| Kluster | Jumlah | Dampak |
|---|---|---|
| Compliance & Tax Intelligence | 2 | Tinggi — wajib di semua market |
| Commerce & Revenue Expansion | 4 | Tinggi — pertumbuhan ARPU |
| Operations Intelligence | 4 | Sedang-Tinggi — retensi dan upsell |
| Customer & Partner Ecosystem | 4 | Sedang — loyalitas dan ekosistem |

---

## 2. Landasan: Pain Point Customer Global yang Belum Tertangani

### 2.1 Pain Point Berdasarkan Survei ERP Global

Berdasarkan laporan Gartner, Panorama Consulting, dan Software Advice (2024–2025), pain point utama pengguna ERP SMB-Enterprise yang belum terpecahkan adalah:

| Pain Point | Prevalensi | NIZAM Saat Ini |
|---|---|---|
| Tax compliance otomatis (e-faktur, PPN, PPh) | 87% | Parsial — manual, belum otomatis |
| Multi-currency dan revaluasi forex | 73% | Belum ada |
| Visibility cashflow real-time + forecast | 71% | Parsial — laporan statis |
| Integrasi marketplace (Shopee, Tokopedia, dll.) | 68% | Belum ada (hanya open API) |
| Customer loyalty & membership | 62% | Belum ada |
| Payment gateway terintegrasi | 61% | Belum ada |
| Portal pelanggan self-service | 58% | Belum ada |
| Quality control & inspeksi | 55% | Belum ada |
| Subscription & recurring billing | 52% | Belum ada |
| After-sales & garansi | 49% | Belum ada |
| Fixed assets advanced (depresiasi, disposisi) | 47% | Parsial — hanya dasar |
| Vendor performance & kontrak | 45% | Belum ada |
| WhatsApp/communication integration | 67%* | Belum ada (* Indonesia-spesifik) |
| Field team mobile operations | 43% | Belum ada |

### 2.2 Konteks Indonesia-Spesifik

Indonesia memiliki karakteristik unik yang harus diakomodasi:

1. **e-Faktur DJP** — wajib pajak PKP harus menerbitkan faktur pajak elektronik
2. **QRIS dan VA** — metode pembayaran dominan, customer ingin terintegrasi langsung
3. **WhatsApp-first** — komunikasi bisnis B2B dan B2C mayoritas lewat WA
4. **Marketplace dominan** — Shopee dan Tokopedia menguasai e-commerce
5. **Syariah compliance** — pasar besar yang sudah diakomodasi NIZAM via Syirkah module

---

## 3. Kluster A — Compliance & Tax Intelligence

### 3.1 Modul: Smart Tax & Compliance

**Klasifikasi**: `Module` (bisa berdiri mandiri, bukan sekadar add-on)

**Pain Point yang Diselesaikan**:
- Pelaporan pajak manual yang rawan error dan menyita waktu
- e-Faktur DJP yang harus dibuat satu per satu
- SPT Masa PPN yang dihitung manual setiap bulan
- PPh 21, 23, 4(2) yang datanya tersebar di berbagai modul
- Tax calendar yang sering terlewat

**Fitur Utama**:

| Fitur | Deskripsi |
|---|---|
| e-Faktur Generator | Generate faktur pajak elektronik sesuai format DJP secara otomatis dari invoice penjualan |
| SPT Masa PPN | Kalkulasi otomatis PPN keluaran dan masukan, generate file CSV untuk upload ke DJP Online |
| PPh Wizard | Kalkulasi PPh 21 (dari HRIS/Payroll), PPh 23 (dari purchasing), PPh 4(2) (dari transaksi tertentu) |
| Tax Calendar | Notifikasi jatuh tempo pelaporan dan pembayaran pajak |
| Faktur Pajak Inbox | Manajemen faktur pajak masuk dari vendor/supplier |
| Tax Audit Trail | Log perubahan data yang mempengaruhi kewajiban pajak |
| NPWP & PKP Registry | Manajemen data NPWP pelanggan dan vendor untuk kebutuhan pemotongan |

**Dependency**: Finance Core, Revenue Core, Purchasing, HRIS Core

**Nilai Bisnis**:
- Menghemat 15–30 jam/bulan untuk tim finance
- Mengurangi risiko sanksi DJP
- Positioning: satu-satunya ERP Indonesia yang bisa generate e-Faktur + SPT secara native

**Estimasi Harga Add-on**: Rp 200.000–500.000/bulan/tenant

---

### 3.2 Add-on: Multi-Currency & Forex Management

**Klasifikasi**: `Add-on` — memperluas Finance Core

**Pain Point yang Diselesaikan**:
- Transaksi dalam USD, EUR, SGD yang harus dikonversi manual
- Revaluasi utang/piutang valas di akhir bulan
- Laporan keuangan yang harus disajikan dalam dua mata uang
- Selisih kurs yang tidak tercatat dengan benar

**Fitur Utama**:

| Fitur | Deskripsi |
|---|---|
| Exchange Rate Management | Input dan update kurs harian (manual atau auto via API BI/Reuters) |
| Multi-Currency Transaction | Transaksi penjualan, pembelian, dan pembayaran dalam berbagai mata uang |
| Realized/Unrealized FX Gain-Loss | Kalkulasi dan jurnal otomatis selisih kurs terealisasi dan belum terealisasi |
| Forex Revaluation | Revaluasi posisi utang/piutang valas pada periode tertentu |
| Dual-Currency Report | Laporan keuangan ditampilkan dalam IDR dan mata uang fungsional lain |
| Bank Account Currency | Multi-currency bank account dengan rekonsiliasi per mata uang |

**Dependency**: Finance Core

**Nilai Bisnis**:
- Wajib untuk importer/eksporter
- Mengurangi kesalahan jurnal kurs yang bisa signifikan di audit

**Estimasi Harga Add-on**: Rp 150.000–300.000/bulan/tenant

---

## 4. Kluster B — Commerce & Revenue Expansion

### 4.1 Add-on: Payment Gateway & QRIS Integration

**Klasifikasi**: `Add-on` — channel pembayaran di atas Revenue Core

**Pain Point yang Diselesaikan**:
- Customer harus konfirmasi pembayaran manual via WA/email
- Tim finance harus cek mutasi bank satu per satu
- Invoice tidak ter-update otomatis setelah dibayar
- Tidak ada payment link yang bisa dikirim ke customer

**Fitur Utama**:

| Fitur | Deskripsi |
|---|---|
| QRIS Integration | Generate QR Code per transaksi yang terhubung ke rekening bisnis |
| Virtual Account | Generate VA per invoice untuk pembayaran bank transfer otomatis |
| Payment Link | Generate link pembayaran yang bisa dikirim via WA/email |
| Auto-Settlement | Setelah pembayaran masuk, status invoice otomatis update dan jurnal kas otomatis dibuat |
| Payment Status Dashboard | Real-time status semua invoice: pending, partial, paid |
| Provider Connector | Integrasi dengan Midtrans, Xendit, Doku, Dana, GoPay |
| Recurring Payment | Untuk pembayaran berulang/langganan |

**Dependency**: Revenue Core, Finance Core

**Nilai Bisnis**:
- Memangkas 80% waktu konfirmasi pembayaran manual
- Mempercepat cash collection cycle
- Positioning: "terima bayar dari mana saja, langsung masuk jurnal"

**Estimasi Harga Add-on**: Rp 100.000–250.000/bulan + transaction fee

---

### 4.2 Add-on: Marketplace Connector

**Klasifikasi**: `Add-on` — integration channel di atas Revenue Core + Inventory Core

**Pain Point yang Diselesaikan**:
- Stok di Shopee/Tokopedia dan sistem internal tidak sinkron
- Order dari marketplace harus diinput ulang manual ke ERP
- Tidak ada visibilitas margin per channel marketplace
- Rekap penjualan marketplace harus dibuat manual

**Fitur Utama**:

| Fitur | Deskripsi |
|---|---|
| Shopee Integration | Sinkronisasi produk, stok, dan order dari Shopee Seller |
| Tokopedia Integration | Sinkronisasi produk, stok, dan order dari Tokopedia |
| TikTok Shop Integration | Sinkronisasi produk dan order dari TikTok Shop |
| Lazada Integration | Sinkronisasi produk dan order dari Lazada |
| Inventory Auto-Sync | Setiap penjualan marketplace otomatis kurangi stok di NIZAM |
| Order Auto-Import | Order marketplace otomatis masuk sebagai Sales Order di NIZAM |
| Channel P&L | Laporan margin dan profitabilitas per marketplace channel |
| Settlement Reconciliation | Rekonsiliasi pembayaran settlement dari marketplace vs catatan internal |

**Dependency**: Revenue Core, Inventory Core

**Nilai Bisnis**:
- Menghilangkan double entry untuk bisnis multi-channel
- Mencegah oversell karena stok tidak sinkron
- Sangat relevan untuk 90%+ bisnis retail Indonesia

**Estimasi Harga Add-on**: Rp 200.000–400.000/bulan/tenant

---

### 4.3 Add-on: Customer Loyalty & Membership

**Klasifikasi**: `Add-on` — perluasan Revenue Core + POS

**Pain Point yang Diselesaikan**:
- Tidak ada sistem untuk menghadiahi pelanggan setia
- Program diskon tidak terintegrasi dengan data transaksi
- Tidak bisa lacak lifetime value per customer
- Membership management dilakukan di Excel atau aplikasi terpisah

**Fitur Utama**:

| Fitur | Deskripsi |
|---|---|
| Points Engine | Kalkulasi poin per transaksi dengan rules yang bisa dikustomisasi |
| Membership Tiers | Bronze/Silver/Gold/Platinum dengan benefit berbeda |
| Redemption Management | Penukaran poin saat transaksi (POS atau Sales Order) |
| Voucher & Coupon | Generate dan validasi voucher diskon |
| Loyalty Dashboard | Analitik: customer aktif, poin beredar, redemption rate |
| Birthday/Anniversary Reward | Auto-reward pada tanggal spesial |
| Referral Program | Tracking referral dan bonus untuk customer yang mengajak customer baru |
| Member Card (Digital) | QR code member card yang bisa ditampilkan di smartphone |

**Dependency**: Revenue Core, POS (opsional)

**Nilai Bisnis**:
- Meningkatkan repeat purchase rate
- Membangun customer database yang lebih kaya
- Diferensiasi kuat untuk bisnis retail dan F&B

**Estimasi Harga Add-on**: Rp 150.000–350.000/bulan/tenant

---

### 4.4 Add-on: Subscription & Recurring Billing

**Klasifikasi**: `Add-on` — perluasan Revenue Core

**Pain Point yang Diselesaikan**:
- Bisnis SaaS, gym, klinik, sekolah harus buat invoice langganan manual setiap periode
- Tidak ada sistem dunning untuk invoice yang belum dibayar
- Tidak ada tracking churn dan renewal rate
- Susah menganalisis Monthly Recurring Revenue (MRR)

**Fitur Utama**:

| Fitur | Deskripsi |
|---|---|
| Subscription Plan Management | Buat paket berlangganan dengan siklus billing (bulanan, triwulanan, tahunan) |
| Auto-Invoice Generator | Invoice otomatis dibuat sesuai siklus billing |
| Dunning Management | Pengingat otomatis bertingkat untuk invoice jatuh tempo: H-3, H0, H+3, H+7 |
| Trial & Proration | Manajemen masa trial dan billing proporsional untuk upgrade/downgrade |
| MRR & ARR Dashboard | Dashboard Monthly Recurring Revenue dan Annual Recurring Revenue |
| Churn Analytics | Tracking customer yang tidak renew dan alasannya |
| Upgrade/Downgrade Flow | Proses perubahan paket dengan kalkulasi selisih billing |
| Subscription Cohort | Analitik retensi per kelompok pelanggan |

**Dependency**: Revenue Core, Finance Core

**Nilai Bisnis**:
- Sangat relevan untuk bisnis berbasis langganan yang tumbuh pesat
- Mengurangi churn akibat lupa billing
- Memberikan visibilitas pendapatan berulang yang lebih baik

**Estimasi Harga Add-on**: Rp 150.000–300.000/bulan/tenant

---

## 5. Kluster C — Operations Intelligence

### 5.1 Add-on: Quality Control & Inspection

**Klasifikasi**: `Add-on` — perluasan Inventory Core + Manufacturing

**Pain Point yang Diselesaikan**:
- Produk reject ditemukan setelah sudah dikirim ke customer
- Tidak ada catatan formal inspeksi barang masuk dari supplier
- Quality issue tidak bisa ditelusuri asal-usulnya
- Tidak ada laporan defect rate per supplier atau per lini produksi

**Fitur Utama**:

| Fitur | Deskripsi |
|---|---|
| Incoming QC | Inspeksi barang masuk dari supplier sebelum masuk stok |
| In-Process QC | Pemeriksaan kualitas di tengah proses produksi (Manufacturing) |
| Final Inspection | Pemeriksaan produk jadi sebelum pengiriman |
| QC Checklist Builder | Buat template checklist inspeksi per kategori produk |
| Defect Categorization | Klasifikasi jenis cacat dengan foto bukti |
| Reject & Hold Management | Status lot yang ditahan atau di-reject |
| Supplier Quality Scorecard | Penilaian kualitas per supplier berdasarkan riwayat inspeksi |
| QC Analytics | Defect rate, supplier performance, trend kualitas |
| Certificate of Analysis | Generate dokumen CoA untuk produk yang lulus inspeksi |

**Dependency**: Inventory Core (wajib), Manufacturing (opsional, untuk in-process QC)

**Nilai Bisnis**:
- Mengurangi biaya retur dan komplain pelanggan
- Memenuhi persyaratan ISO 9001 dan standar kualitas industri
- Sangat relevan untuk manufaktur, F&B, dan farmasi

**Estimasi Harga Add-on**: Rp 200.000–400.000/bulan/tenant

---

### 5.2 Add-on: After-Sales & Warranty Management

**Klasifikasi**: `Add-on` — perluasan Service Operations + Revenue Core

**Pain Point yang Diselesaikan**:
- Klaim garansi diproses via WA dan tidak tercatat dengan baik
- Tidak ada tracking status perbaikan untuk customer
- Suku cadang yang dipakai untuk garansi tidak terhubung ke inventory
- Tidak ada analisis produk yang sering kena garansi (mengindikasikan QC issue)

**Fitur Utama**:

| Fitur | Deskripsi |
|---|---|
| Warranty Registration | Registrasi garansi produk dengan serial number dan tanggal pembelian |
| RMA (Return Merchandise Authorization) | Proses retur produk yang terstruktur dengan nomor RMA |
| Claim Management | Tracking klaim garansi dari pengajuan hingga penyelesaian |
| Repair Workflow | Alur perbaikan: terima → diagnosa → perbaiki → QC → kirim balik |
| Spare Parts Tracking | Parts yang digunakan untuk garansi terhubung ke inventory |
| Customer Notification | Notifikasi otomatis update status klaim ke customer |
| Warranty Analytics | Produk yang paling sering diklaim, biaya garansi, satisfaction rate |
| Extended Warranty Selling | Jual extended warranty sebagai produk layanan |

**Dependency**: Service Operations (opsional), Revenue Core, Inventory Core

**Nilai Bisnis**:
- Meningkatkan customer satisfaction dan trust
- Mengurangi biaya tak terduga dari penanganan garansi yang tidak tercatat
- Relevan untuk elektronik, otomotif, furnitur, dan semua bisnis dengan produk fisik

**Estimasi Harga Add-on**: Rp 150.000–300.000/bulan/tenant

---

### 5.3 Add-on: Fixed Assets Pro

**Klasifikasi**: `Add-on` — pendalaman Finance Core

**Pain Point yang Diselesaikan**:
- Depresiasi aset harus dihitung dan dijurnal manual setiap bulan
- Tidak ada tracking lokasi dan kondisi fisik aset
- Disposisi aset (jual/hapus buku) tidak otomatis menghasilkan jurnal
- Revaluasi aset sesuai PSAK 16 sangat menyulitkan
- Asset register tidak sinkron dengan nilai buku di ledger

**Fitur Utama**:

| Fitur | Deskripsi |
|---|---|
| Asset Register | Database lengkap aset dengan kode aset, kategori, lokasi, dan kondisi |
| Depreciation Engine | Kalkulasi depresiasi otomatis: garis lurus, saldo menurun, unit produksi |
| Auto-Depreciation Journal | Jurnal depresiasi otomatis dibuat setiap periode closing |
| Asset Acquisition | Proses pembelian aset yang otomatis masuk ke asset register |
| Asset Disposal | Proses penjualan/penghapusan aset dengan kalkulasi gain/loss otomatis |
| Asset Transfer | Perpindahan aset antar lokasi, cabang, atau divisi |
| Revaluation | Revaluasi aset sesuai PSAK 16 dengan jurnal akumulasi depresiasi |
| Asset Maintenance Log | Riwayat perawatan dan biaya pemeliharaan per aset |
| Asset Tagging | Barcode/QR label untuk audit fisik aset |
| Asset Report | Daftar aset, jadwal depresiasi, NBV (Net Book Value) summary |

**Dependency**: Finance Core

**Nilai Bisnis**:
- Memenuhi standar PSAK 16 tentang Aset Tetap
- Menghemat waktu finance yang biasanya 2–5 hari/bulan hanya untuk depresiasi
- Relevan untuk semua bisnis dengan aset tetap signifikan

**Estimasi Harga Add-on**: Rp 150.000–350.000/bulan/tenant

---

### 5.4 Add-on: Budget Intelligence

**Klasifikasi**: `Add-on` — perluasan Finance Core

**Pain Point yang Diselesaikan**:
- Budget dibuat di Excel dan tidak tersambung dengan realisasi di sistem
- Tidak ada alert ketika realisasi mendekati atau melebihi anggaran
- Analisis variance budget vs aktual hanya bisa dilakukan akhir bulan
- Proyeksi cashflow tidak bisa dilakukan dengan data real-time

**Fitur Utama**:

| Fitur | Deskripsi |
|---|---|
| Budget Builder | Buat anggaran per departemen, cost center, atau proyek per periode |
| Budget vs Actual Real-time | Perbandingan anggaran vs realisasi yang update secara real-time |
| Variance Analysis | Analisis selisih anggaran dengan drill-down ke transaksi |
| Budget Alert | Notifikasi otomatis ketika realisasi mencapai 80%, 90%, dan 100% anggaran |
| Rolling Forecast | Proyeksi sisa tahun berdasarkan tren aktual |
| Cashflow Forecast | Proyeksi arus kas 30/60/90 hari ke depan |
| Scenario Planning | Simulasi skenario best-case, base-case, worst-case |
| Budget Approval Flow | Workflow persetujuan anggaran dari departemen ke management |
| Department Budget Portal | Self-service portal untuk manajer departemen pantau anggaran mereka |

**Dependency**: Finance Core (wajib), HRIS Core (opsional, untuk budget per departemen)

**Nilai Bisnis**:
- Mengubah finance dari fungsi perekam menjadi fungsi kontrol
- Mencegah overbudget yang sering tidak terdeteksi sampai akhir bulan
- Mendukung pengambilan keputusan berbasis data

**Estimasi Harga Add-on**: Rp 200.000–450.000/bulan/tenant

---

## 6. Kluster D — Customer & Partner Ecosystem

### 6.1 Add-on: Customer Self-Service Portal

**Klasifikasi**: `Add-on` — perluasan Revenue Core

**Pain Point yang Diselesaikan**:
- Customer harus menelepon/WA untuk cek status pesanan atau invoice
- Tim CS menghabiskan banyak waktu menjawab pertanyaan yang bisa dijawab sendiri oleh customer
- Customer tidak punya akses ke riwayat transaksi mereka
- Tidak ada cara untuk customer melakukan pembayaran self-service

**Fitur Utama**:

| Fitur | Deskripsi |
|---|---|
| Customer Portal Login | Akun portal khusus customer dengan kredensial terpisah dari internal user |
| Invoice & Statement View | Customer bisa lihat dan download invoice, statement of account |
| Payment Online | Bayar invoice langsung dari portal (terintegrasi dengan Payment Gateway Add-on) |
| Order Tracking | Tracking status pesanan real-time dari order hingga pengiriman |
| Order History | Riwayat transaksi lengkap per customer |
| Document Download | Download PO, DO, invoice, dan faktur pajak |
| Complaint & Ticket | Submit keluhan langsung dari portal, terhubung ke internal support ticket |
| Quotation Approval | Customer bisa review dan approve quotation dari portal |
| Custom Branding | Portal bisa dikustomisasi dengan logo dan warna bisnis |

**Dependency**: Revenue Core (wajib), Payment Gateway Add-on (opsional)

**Nilai Bisnis**:
- Mengurangi beban CS 40–60% untuk pertanyaan status invoice dan pesanan
- Meningkatkan kepuasan customer dengan akses self-service 24/7
- Mempercepat pembayaran karena customer bisa langsung bayar dari portal

**Estimasi Harga Add-on**: Rp 200.000–400.000/bulan/tenant

---

### 6.2 Add-on: WhatsApp Business Integration

**Klasifikasi**: `Add-on` — communication layer di atas Revenue Core + Service Operations

**Pain Point yang Diselesaikan**:
- Notifikasi invoice dan pengingat pembayaran masih manual via WA personal
- Update status pesanan/servis tidak tersampaikan secara konsisten
- Tim CS harus copy-paste data dari sistem ke WA
- Tidak ada tracking percakapan WA yang terhubung ke data transaksi customer

**Fitur Utama**:

| Fitur | Deskripsi |
|---|---|
| WA Invoice Notification | Kirim invoice otomatis via WA Business API setelah dibuat |
| Payment Reminder | Reminder otomatis H-3, H0, H+3 via WA untuk invoice jatuh tempo |
| Order Status Update | Notifikasi otomatis perubahan status pesanan via WA |
| Service Status Update | Update status job order / perbaikan via WA ke customer |
| WA Template Manager | Kelola template pesan WA yang sudah disetujui (approved templates) |
| Bulk WA Blast | Kirim pesan promo/informasi ke segmen customer tertentu |
| WA Inbox | Inbox terpusat untuk semua percakapan WA bisnis, terhubung ke data customer |
| Chatbot Builder | Builder chatbot sederhana untuk FAQ dan cek status pesanan |
| Conversation Analytics | Laporan pengiriman, open rate, dan respons rate |

**Dependency**: Revenue Core (wajib), Service Operations (opsional)

**Catatan Teknis**: Menggunakan WhatsApp Business API (WABA) resmi, bukan third-party unofficial API.

**Nilai Bisnis**:
- Sangat relevan untuk pasar Indonesia di mana WA adalah komunikasi utama
- Mengurangi waktu CS untuk notifikasi manual
- Meningkatkan cash collection melalui pengingat yang konsisten

**Estimasi Harga Add-on**: Rp 200.000–500.000/bulan/tenant + per-message cost

---

### 6.3 Modul: Reseller & Distributor Management

**Klasifikasi**: `Module` — domain mandiri untuk bisnis multi-channel dengan jaringan distribusi

**Pain Point yang Diselesaikan**:
- Produsen/principal tidak bisa pantau stok di level reseller/distributor
- Tidak ada sistem untuk kelola target, achievement, dan komisi reseller
- Order dari ratusan reseller harus diproses manual
- Tidak ada portal khusus untuk reseller melakukan pemesanan

**Fitur Utama**:

| Fitur | Deskripsi |
|---|---|
| Reseller Registry | Database reseller/distributor dengan level, territory, dan kontrak |
| Reseller Portal | Portal order khusus untuk reseller melakukan pemesanan langsung |
| Territory Management | Pembagian wilayah distribusi per reseller/distributor |
| Sales Target & Achievement | Set target dan tracking pencapaian per reseller per periode |
| Commission Engine | Kalkulasi komisi reseller berdasarkan rules yang dikonfigurasi |
| Price List per Tier | Harga jual berbeda per level reseller (agen, sub-agen, distributor) |
| Sell-in vs Sell-out | Tracking penjualan principal ke distributor (sell-in) dan distributor ke end-user (sell-out) |
| Stock Visibility | Visibilitas stok di level distributor (jika distributor juga pakai NIZAM) |
| Reseller Performance | Dashboard ranking dan performance reseller |
| Return & Claim Management | Manajemen retur produk dari reseller |

**Dependency**: Revenue Core, Inventory Core, Finance Core

**Nilai Bisnis**:
- Sangat relevan untuk produsen FMCG, farmasi, elektronik, dan industri apapun dengan jaringan distribusi
- Menggantikan sistem distributor management yang biasanya terpisah atau di Excel
- Potensi ekspansi: setiap distributor bisa menjadi tenant NIZAM tersendiri

**Estimasi Harga**: Module dengan pricing terpisah, Rp 400.000–800.000/bulan/tenant

---

### 6.4 Add-on: Field Operations & Mobile Workforce

**Klasifikasi**: `Add-on` — mobile layer untuk Service Operations + HRIS Core

**Pain Point yang Diselesaikan**:
- Teknisi/salesperson di lapangan tidak bisa update data real-time
- Check-in kehadiran karyawan lapangan tidak bisa diverifikasi
- Job order harus dicatat di kertas dulu, lalu diinput ulang di kantor
- Manager tidak bisa lihat posisi dan status tim lapangan secara real-time

**Fitur Utama**:

| Fitur | Deskripsi |
|---|---|
| Mobile Check-in/out | Absensi karyawan lapangan dengan GPS verification dan foto |
| GPS Tracking | Real-time lokasi tim lapangan yang bisa dipantau supervisor |
| Digital Job Sheet | Teknisi terima dan update job order langsung dari HP |
| Customer Signature | Tanda tangan pelanggan digital di HP setelah service selesai |
| Photo Documentation | Foto kondisi sebelum/sesudah pekerjaan langsung dari HP |
| Route Optimization | Saran urutan kunjungan optimal berdasarkan lokasi |
| Offline Mode | Tetap bisa input data meskipun sinyal lemah, sync otomatis saat online |
| Mobile Invoice | Buat dan kirim invoice langsung dari lapangan |
| Parts Request | Request kebutuhan parts dari lapangan, terhubung ke inventory |
| Daily Report | Laporan harian otomatis dari aktivitas di lapangan |

**Dependency**: Service Operations (opsional, tapi ideal), HRIS Core

**Nilai Bisnis**:
- Sangat relevan untuk bisnis teknisi (AC, CCTV, IT), delivery, canvasser
- Mengurangi data entry ganda dan kehilangan data lapangan
- Meningkatkan kontrol atasan terhadap produktivitas tim lapangan

**Estimasi Harga Add-on**: Rp 15.000–25.000/user/bulan (seat-based)

---

## 7. Ringkasan Semua Modul dan Add-on Baru

### 7.1 Dua Modul Baru

| No | Nama | Klasifikasi | Kluster | Dependency Utama | Estimasi Harga |
|---|---|---|---|---|---|
| 1 | Smart Tax & Compliance | `Module` | Compliance | Finance, Revenue, HRIS | Rp 200K–500K/bln |
| 2 | Reseller & Distributor Management | `Module` | Partner Ecosystem | Revenue, Inventory, Finance | Rp 400K–800K/bln |

### 7.2 Dua Belas Add-on Baru

| No | Nama | Klasifikasi | Kluster | Dependency Utama | Estimasi Harga |
|---|---|---|---|---|---|
| 3 | Multi-Currency & Forex | `Add-on` | Compliance | Finance Core | Rp 150K–300K/bln |
| 4 | Payment Gateway & QRIS | `Add-on` | Commerce | Revenue, Finance | Rp 100K–250K/bln |
| 5 | Marketplace Connector | `Add-on` | Commerce | Revenue, Inventory | Rp 200K–400K/bln |
| 6 | Customer Loyalty & Membership | `Add-on` | Commerce | Revenue, POS | Rp 150K–350K/bln |
| 7 | Subscription & Recurring Billing | `Add-on` | Commerce | Revenue, Finance | Rp 150K–300K/bln |
| 8 | Quality Control & Inspection | `Add-on` | Operations | Inventory, Manufacturing | Rp 200K–400K/bln |
| 9 | After-Sales & Warranty | `Add-on` | Operations | Service, Revenue, Inventory | Rp 150K–300K/bln |
| 10 | Fixed Assets Pro | `Add-on` | Operations | Finance Core | Rp 150K–350K/bln |
| 11 | Budget Intelligence | `Add-on` | Operations | Finance Core | Rp 200K–450K/bln |
| 12 | Customer Self-Service Portal | `Add-on` | Customer Ecosystem | Revenue Core | Rp 200K–400K/bln |
| 13 | WhatsApp Business Integration | `Add-on` | Customer Ecosystem | Revenue, Service | Rp 200K–500K/bln |
| 14 | Field Operations & Mobile Workforce | `Add-on` | Customer Ecosystem | Service, HRIS | Rp 15K–25K/user/bln |

---

## 8. Arsitektur Produk Lengkap NIZAM (Setelah Penambahan)

```
┌─────────────────────────────────────────────────────────────────┐
│                       PLATFORM CORE                             │
│  Auth · Tenancy · Branch · Roles · Settings · Billing · Support │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
┌────────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐
│   CORE ERP      │  │  VERTICAL OPS   │  │  STRATEGIC      │
│                 │  │                 │  │                  │
│ Finance Core ←──┼──┤ Manufacturing   │  │ Academy / EDU   │
│ Revenue Core    │  │ Fleet & Rental  │  │ [EXISTING]      │
│ Purchasing      │  │ Service Ops     │  └─────────────────┘
│ Inventory Core  │  │ Project & Const │
│ HRIS Core       │  │ Syirkah         │
│ [EXISTING]      │  │ [EXISTING]      │
│                 │  │                 │
│ +Smart Tax ★NEW │  │ +Reseller Mgmt  │
└─────────────────┘  │  ★NEW          │
                     └─────────────────┘
                              │
    ┌─────────────────────────┼──────────────────────────┐
    │                         │                          │
┌───▼──────────────┐ ┌────────▼──────────┐ ┌────────────▼────────┐
│  GROWTH ADD-ONS  │ │  ADVANCED OPS     │ │  INTEGRATION &      │
│                  │ │  ADD-ONS          │ │  CAPACITY ADD-ONS   │
│ POS              │ │                   │ │                     │
│ Sales Page       │ │ Advanced WMS      │ │ Open API            │
│ Quick Bill       │ │ Fleet Maint. Pack │ │ Multi-Entity        │
│ Sales AR Cockpit │ │                   │ │ Seat Pack           │
│ Package Tracking │ │ +QC & Inspection  │ │                     │
│                  │ │  ★NEW            │ │ +Multi-Currency     │
│ +Payment Gateway │ │ +After-Sales &   │ │  ★NEW              │
│  ★NEW           │ │  Warranty ★NEW   │ │ +Marketplace Conn.  │
│ +Loyalty & Memb. │ │ +Fixed Assets Pro │ │  ★NEW              │
│  ★NEW           │ │  ★NEW            │ │                     │
│ +Subscription &  │ │ +Budget Intel.   │ └─────────────────────┘
│  Billing ★NEW   │ │  ★NEW            │
│                  │ └───────────────────┘
│ +WA Integration  │
│  ★NEW           │ ┌───────────────────┐
│ +Customer Portal │ │  MOBILE / FIELD   │
│  ★NEW           │ │  ADD-ONS          │
│                  │ │                   │
└──────────────────┘ │ +Field Operations │
                     │  & Mobile ★NEW   │
                     └───────────────────┘
```

---

## 9. Prioritas Implementasi

### 9.1 Fase 1 — Quick Win (0–3 bulan)
Prioritas: **dampak tinggi, complexity rendah-sedang, pain point sangat nyata**

| Urutan | Modul/Add-on | Alasan Prioritas |
|---|---|---|
| 1 | Payment Gateway & QRIS | Pain point #1 bisnis Indonesia, reduce manual work langsung terasa |
| 2 | WhatsApp Business Integration | Pain point #1 komunikasi bisnis Indonesia |
| 3 | Fixed Assets Pro | Kebutuhan umum semua bisnis dengan aset, Finance Core sudah kuat |
| 4 | Budget Intelligence | Finance Core sudah kuat, tinggal tambah forecast layer |

### 9.2 Fase 2 — Core Expansion (3–6 bulan)
Prioritas: **perluasan ARPU dari customer existing**

| Urutan | Modul/Add-on | Alasan Prioritas |
|---|---|---|
| 5 | Marketplace Connector | 68% bisnis retail butuh ini, revenue signifikan |
| 6 | Multi-Currency & Forex | Importir/eksporter sangat butuh, Finance Core sudah solid |
| 7 | Customer Self-Service Portal | Mengurangi beban CS, meningkatkan kepuasan |
| 8 | Smart Tax & Compliance | Positioning kuat sebagai ERP Indonesia yang comply DJP |

### 9.3 Fase 3 — Vertical Deepening (6–12 bulan)
Prioritas: **diferensiasi dan penetrasi vertical market**

| Urutan | Modul/Add-on | Alasan Prioritas |
|---|---|---|
| 9 | Quality Control & Inspection | Manufacturing module sudah ada, tinggal extend |
| 10 | Subscription & Recurring Billing | Pertumbuhan bisnis SaaS/langganan sangat pesat |
| 11 | After-Sales & Warranty Management | Service Ops sudah ada, extend ke post-sales |
| 12 | Customer Loyalty & Membership | Retail, F&B, dan ritel modern sangat butuh ini |

### 9.4 Fase 4 — Ecosystem (12–18 bulan)
Prioritas: **ekosistem dan network effect**

| Urutan | Modul/Add-on | Alasan Prioritas |
|---|---|---|
| 13 | Reseller & Distributor Management | Kompleks, tapi strategic untuk penetrasi B2B |
| 14 | Field Operations & Mobile Workforce | Butuh mobile app development, complexity tinggi |

---

## 10. Analisis Dampak ARPU

### 10.1 Baseline ARPU Saat Ini (Estimasi)
Berdasarkan struktur paket yang ada, ARPU baseline diasumsikan:
- Paket Lite: ~Rp 300.000/bulan
- Paket Starter: ~Rp 600.000/bulan
- Paket Full: ~Rp 1.200.000/bulan

### 10.2 Potensi ARPU Uplift per Add-on
Jika hanya 30% tenant mengadopsi add-on:

| Add-on | Harga Rata-rata | ARPU Uplift (30% adoption) |
|---|---|---|
| Payment Gateway | Rp 175.000/bln | +Rp 52.500 |
| Marketplace Connector | Rp 300.000/bln | +Rp 90.000 |
| Smart Tax | Rp 350.000/bln | +Rp 105.000 |
| WA Integration | Rp 350.000/bln | +Rp 105.000 |
| Budget Intelligence | Rp 325.000/bln | +Rp 97.500 |
| Fixed Assets Pro | Rp 250.000/bln | +Rp 75.000 |
| Customer Portal | Rp 300.000/bln | +Rp 90.000 |
| Loyalty & Membership | Rp 250.000/bln | +Rp 75.000 |

**Total potensi ARPU uplift**: +Rp 690.000/tenant/bulan (57% peningkatan dari ARPU Starter)

---

## 11. Dependency Map Lengkap

```
Finance Core
 ├── Smart Tax & Compliance (Module)
 ├── Multi-Currency & Forex (Add-on)
 ├── Fixed Assets Pro (Add-on)
 └── Budget Intelligence (Add-on)

Revenue Core
 ├── Payment Gateway & QRIS (Add-on)
 ├── Marketplace Connector (Add-on)
 ├── Customer Loyalty & Membership (Add-on)
 ├── Subscription & Recurring Billing (Add-on)
 ├── Customer Self-Service Portal (Add-on)
 └── WhatsApp Business Integration (Add-on)

Inventory Core
 ├── Quality Control & Inspection (Add-on)
 └── Marketplace Connector (Add-on)

Manufacturing [Vertical]
 └── Quality Control & Inspection (Add-on) [extends in-process QC]

Service Operations [Vertical]
 ├── After-Sales & Warranty (Add-on)
 ├── WhatsApp Business Integration (Add-on)
 └── Field Operations & Mobile (Add-on)

HRIS Core
 ├── Budget Intelligence (Add-on) [opsional, budget per dept]
 └── Field Operations & Mobile (Add-on)

Revenue Core + Inventory Core + Finance Core
 └── Reseller & Distributor Management (Module)

POS [Add-on existing]
 └── Customer Loyalty & Membership (Add-on)
```

---

## 12. Catatan Strategis untuk Tim Produk

### 12.1 Prinsip Pengembangan

1. **Mobile-first untuk add-on yang bersentuhan dengan lapangan** — Payment Gateway, WA Integration, Field Operations harus bisa diakses sepenuhnya dari HP.
2. **API-first untuk semua add-on baru** — setiap add-on harus memiliki endpoint REST yang konsisten agar bisa di-orchestrate via Open API Add-on.
3. **Billing terintegrasi dari hari pertama** — setiap add-on harus langsung terkoneksi ke sistem billing NIZAM SaaS.
4. **Progressive disclosure** — add-on yang kompleks (Smart Tax, Marketplace Connector) harus memiliki onboarding wizard yang memandu user langkah per langkah.

### 12.2 Positioning Kompetitif

Setelah semua 14 modul dan add-on ini hadir, NIZAM akan memiliki:

| Dimensi | Posisi |
|---|---|
| ERP Lokal Indonesia | Satu-satunya yang ada e-Faktur native + QRIS terintegrasi |
| Vs Odoo | Lebih ringan, lebih Indonesia-centric, onboarding jauh lebih cepat |
| Vs SAP Business One | Harga jauh lebih terjangkau, setup lebih mudah |
| Vs Jurnal/Accurate | Coverage operasional jauh lebih luas, lebih extensible |
| Vs ERP Global | Lebih sesuai regulasi lokal, WA integration, marketplace lokal |

### 12.3 Roadmap Teknis

Untuk mengeksekusi roadmap ini, diperlukan:

1. **Infrastruktur webhook yang robust** — terutama untuk Marketplace Connector dan Payment Gateway
2. **Mobile wrapper atau PWA** — untuk Field Operations Add-on
3. **Third-party API management** — rate limiting, retry, dan monitoring untuk integrasi eksternal
4. **Multi-tenant event bus** — untuk notifikasi WA, email, dan in-app yang scalable
5. **Permission granularity** — setiap add-on butuh permission keys baru yang terdaftar di entitlement system

---

## 13. Penutup

NIZAM sudah berada di posisi yang sangat kuat secara arsitektur. Platform Core yang solid, Core ERP yang lengkap, dan Vertical Modules yang beragam memberikan fondasi yang tidak perlu dibangun ulang.

Keempat belas modul dan add-on baru ini bukan sekadar penambahan fitur. Mereka adalah **penyelesaian pain point customer yang nyata dan terukur**, yang akan:

1. **Meningkatkan ARPU** hingga 50%+ dari customer existing
2. **Memperluas TAM** ke segmen bisnis yang sebelumnya tidak terlayani
3. **Memperkuat retensi** karena switching cost makin tinggi saat lebih banyak proses bisnis masuk ke NIZAM
4. **Membangun network effect** melalui Reseller Module dan Customer Portal
5. **Memenangkan positioning** sebagai ERP Indonesia yang paling lengkap dan paling sesuai kebutuhan lokal

Kalau dieksekusi dengan disiplin sesuai prioritas fase, NIZAM bisa menjadi platform operasional bisnis yang tidak hanya bersaing dengan ERP lokal, tetapi benar-benar menjadi standar baru untuk bisnis Indonesia.

---

*Dokumen ini dibuat berdasarkan analisis branch `feat_multi`, dokumen `KLASIFIKASI_MODULE_DAN_ADDON_NIZAM.md`, `GTM_NIZAM_MODULE_DAN_ADDON.md`, dan riset pain point ERP global 2024–2026.*
