# MASTERPLAN MODUL & ADD-ON NIZAM — Solusi Pain Point Customer Global

## Metadata Dokumen

| Atribut | Nilai |
|---|---|
| Versi | `2.0` |
| Tanggal | `14 Mei 2026` |
| Cabang Referensi | `feat_multi` |
| Penulis | `Product Architecture & AI Analysis` |
| Status | `Draft Strategis — Untuk Keputusan Produk` |
| Tujuan | `Memetakan modul dan add-on baru berdasarkan pain point customer global, disertai prioritas, model bisnis, dan rencana teknis` |

---

## 1. Ringkasan Eksekutif

NIZAM saat ini sudah memiliki fondasi ERP yang solid: Accounting, Finance, Sales, Purchasing, Inventory, HRIS, POS, Manufacturing, Fleet & Rental, Project & Construction, Syirkah, Warehouse, Audit, dan Edu/LMS. Stack teknologi (Next.js + PostgreSQL + Railway) sudah production-ready.

Namun berdasarkan analisis kondisi `feat_multi` dan peta kompetitor global (Odoo, SAP Business One, Xero, QuickBooks, Zoho Books), ada **13 gap kritikal** yang membuat NIZAM kehilangan peluang pasar:

1. Tidak ada **multi-currency & foreign exchange** yang native.
2. Tidak ada **payment gateway layer** yang terstandarisasi.
3. Tidak ada **marketplace/e-commerce sync** otomatis.
4. Tidak ada **WhatsApp Business & notification engine** terintegrasi.
5. Tidak ada **e-Faktur & e-Bupot** untuk kepatuhan pajak Indonesia.
6. Tidak ada **subscription/recurring billing** untuk customer SaaS-within-SaaS.
7. Tidak ada **CRM pipeline visual** yang proper (hanya daftar contact).
8. Tidak ada **mobile-first PWA** dengan offline capability.
9. Tidak ada **field service & dispatch** untuk bisnis dengan teknisi lapangan.
10. Tidak ada **vendor portal** (supplier self-service).
11. Tidak ada **customer portal** (buyer self-service).
12. Tidak ada **landed cost & duty** untuk importir.
13. Tidak ada **AI-driven insight** yang actionable (bukan sekadar laporan).

Dokumen ini merumuskan **9 Modul Baru** dan **18 Add-on Baru** yang menyelesaikan pain point tersebut secara sistematis, dengan estimasi effort, model harga, dan prioritas implementasi.

---

## 2. Analisis Pain Point Customer Global

### 2.1 Segmentasi Customer NIZAM

| Segmen | Ukuran | Pain Utama | Willingness to Pay |
|---|---|---|---|
| UKM Ritel & Dagang | Mayoritas tenant saat ini | Cash flow, stok, invoice | Rendah–Menengah |
| Jasa Profesional (konsultan, agensi) | Berkembang | Time tracking, project billing | Menengah |
| Manufaktur Skala Kecil | Ada di `factory/` | BOM, job costing, QC | Menengah–Tinggi |
| Properti & Konstruksi | Ada di `construction/` | Project milestone, progress billing | Tinggi |
| Koperasi & Syariah | Ada di `koperasi/`, `syirkah/` | Bagi hasil, SHU, compliance | Menengah |
| Importir & Eksportir | Belum terlayani | Multi-currency, landed cost, bea cukai | Tinggi |
| Fleet & Logistik | Ada di `fleet/` | Maintenance, driver, fuel | Menengah–Tinggi |
| Healthcare & Klinik | Belum ada | Rekam medis, BPJS billing | Tinggi |

### 2.2 Pain Point Teratas Berdasarkan Frekuensi Keluhan

```
Rank  Pain Point                                    Dampak Bisnis
----  -------------------------------------------   -----------------
 1    Invoice tidak terkirim otomatis ke WhatsApp   Piutang macet
 2    Tidak bisa bayar vendor multi-bank 1 klik     Hutang terlambat bayar
 3    Stok marketplace tidak sync ke ERP            Oversell, customer marah
 4    Laporan pajak (PPN, PPh) harus manual         Denda, audit risk
 5    Sales tidak punya pipeline visual             Deal hilang tak terlacak
 6    Tidak bisa akses dari HP tanpa loading lama   Produktivitas turun
 7    Vendor tagih lewat WA, tidak masuk sistem     Hutang tidak tercatat
 8    Tidak tahu kapan cash habis bulan depan       Krisis likuiditas mendadak
 9    Teknisi lapangan tidak bisa input job di HP   Delay service report
10    Import barang kena pajak aneh, susah catat    Laporan keuangan salah
```

---

## 3. Arsitektur Produk yang Diperbarui

### 3.1 Peta Capability NIZAM (Target 2026–2027)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PLATFORM CORE                                │
│   Auth · Org/Branch · RBAC · Billing · Dashboard · Support          │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
        ┌───────────────────────┼────────────────────────┐
        ▼                       ▼                        ▼
┌──────────────┐      ┌──────────────────┐      ┌────────────────────┐
│  CORE FAMILY │      │ VERTICAL MODULES │      │  ADD-ON ECOSYSTEM  │
│              │      │                  │      │                    │
│ Finance Core │      │ Manufacturing    │      │ WhatsApp Notif     │
│ Revenue Core │      │ Project & Const. │      │ Payment Gateway    │
│ Purchasing   │      │ Fleet & Rental   │      │ Marketplace Sync   │
│ Inventory    │      │ Syirkah/Koperasi │      │ e-Faktur           │
│ HRIS         │      │ Healthcare [NEW] │      │ Multi-Currency     │
│ Accounting   │      │ Property [NEW]   │      │ Landed Cost [NEW]  │
│              │      │ Logistics [NEW]  │      │ Vendor Portal [NEW]│
└──────────────┘      └──────────────────┘      │ Customer Portal    │
                                                 │ Subscription Mgmt  │
                                                 │ Field Service [NEW]│
                                                 │ AI Insight [NEW]   │
                                                 │ Mobile PWA [NEW]   │
                                                 │ CRM Pipeline [NEW] │
                                                 └────────────────────┘
                                                          │
                                              ┌───────────┴──────────┐
                                              │    ACADEMY / EDU     │
                                              │  LMS · Sertifikasi   │
                                              │  Simulasi · BNSP     │
                                              └──────────────────────┘
```

---

## 4. Modul Baru yang Direkomendasikan

### MODUL-01: Healthcare & Klinik

**Pain yang Diselesaikan:** Klinik dan rumah sakit kecil tidak punya sistem terintegrasi antara rekam medis, billing pasien, dan akuntansi.

**Capability:**
- Manajemen pasien & rekam medis dasar (SOAP notes)
- Billing rawat jalan & rawat inap
- Klaim BPJS Kesehatan (bridging ke sistem P-Care / FKTP)
- Stok obat & farmasi terintegrasi dengan Inventory Core
- Jadwal dokter & manajemen antrian
- Laporan kunjungan & pendapatan per dokter

**Target Customer:** Klinik pratama, dokter praktek mandiri, apotek kecil

**Dependency:** Finance Core, Inventory Core, HRIS

**Estimasi Effort:** 16–20 minggu (tim 3 orang)

**Harga Rekomen:** Rp 1.500.000/bulan (modul independen)

**Prioritas:** ⭐⭐⭐⭐ (High — pasar besar, kompetitor sedikit yang integratif)

---

### MODUL-02: Property & Real Estate

**Pain yang Diselesaikan:** Developer properti dan agen real estate tidak bisa tracking unit, booking, cicilan, dan komisi dalam satu sistem.

**Capability:**
- Master unit (blok, nomor, tipe, status: available/booked/sold)
- Booking & akad: progress billing per termin
- Manajemen cicilan dan saldo piutang per unit
- Komisi agen & reseller otomatis
- Laporan penjualan per cluster/proyek
- Sertifikat & dokumen legal tracking

**Target Customer:** Developer perumahan skala menengah, agen properti

**Dependency:** Finance Core, Revenue Core, Construction (opsional)

**Estimasi Effort:** 12–16 minggu

**Harga Rekomen:** Rp 2.000.000/bulan

**Prioritas:** ⭐⭐⭐⭐ (High — belum ada ERP lokal yang fokus)

---

### MODUL-03: Logistics & Kurir Internal

**Pain yang Diselesaikan:** Perusahaan dengan armada pengiriman sendiri tidak bisa track shipment, driver, dan biaya distribusi secara real-time.

**Capability:**
- Order pengiriman (DO — Delivery Order)
- Penugasan driver & kendaraan per DO
- Tracking status pengiriman (pickup → transit → delivered)
- Proof of Delivery (POD) via foto dari HP
- Biaya pengiriman per DO → integrasi COGS
- Laporan efisiensi armada & driver

**Target Customer:** Distributor, FMCG, toko online dengan armada sendiri

**Dependency:** Inventory Core, Fleet & Rental, Sales

**Estimasi Effort:** 10–14 minggu

**Harga Rekomen:** Rp 1.200.000/bulan

**Prioritas:** ⭐⭐⭐⭐ (High — extend Fleet yang sudah ada)

---

### MODUL-04: Subscription & Recurring Billing

**Pain yang Diselesaikan:** Bisnis SaaS, media, laundry langganan, gym, dan kontraktor retainer tidak bisa generate invoice berulang otomatis.

**Capability:**
- Produk/layanan dengan billing cycle (harian/bulanan/tahunan)
- Auto-generate invoice di tanggal tagih
- Payment reminder otomatis (email + WhatsApp)
- Dunning management: eskalasi otomatis jika belum bayar
- Laporan MRR, ARR, churn, dan lifetime value
- Pause/cancel/upgrade/downgrade subscription

**Target Customer:** SaaS lokal, gym, laundry, media, jasa retainer

**Dependency:** Finance Core, Revenue Core

**Estimasi Effort:** 8–12 minggu

**Harga Rekomen:** Rp 800.000/bulan

**Prioritas:** ⭐⭐⭐⭐⭐ (Highest — NIZAM sendiri membutuhkan ini untuk billing tenant)

---

### MODUL-05: Field Service & Dispatch

**Pain yang Diselesaikan:** Perusahaan servis (AC, genset, IT, plumbing) tidak bisa schedule teknisi, track pekerjaan di lapangan, dan billing dari HP.

**Capability:**
- Work order management: create, assign, schedule
- Dispatch board: kalender teknisi real-time
- Mobile interface untuk teknisi: update status, foto, tanda tangan digital
- Spare part usage dari HP → auto potong stok
- Invoice dari lapangan setelah selesai
- SLA tracking & eskalasi

**Target Customer:** Servis AC, genset, IT support, property management

**Dependency:** Inventory Core, Revenue Core, Job Order (Jasa)

**Estimasi Effort:** 14–18 minggu

**Harga Rekomen:** Rp 1.500.000/bulan + Rp 50.000/seat teknisi

**Prioritas:** ⭐⭐⭐⭐ (High)

---

### MODUL-06: E-Commerce & Marketplace Hub

**Pain yang Diselesaikan:** Seller multi-channel (Tokopedia, Shopee, Lazada, TikTok Shop) harus input order manual ke ERP, stok tidak sync, laporan terpisah-pisah.

**Capability:**
- Koneksi API ke Tokopedia, Shopee, Lazada, TikTok Shop, WooCommerce
- Sinkronisasi stok 2 arah: ERP ↔ Marketplace
- Auto-import order marketplace ke Sales NIZAM
- Rekonsiliasi omzet marketplace vs pencairan dana
- Laporan performa per channel & per SKU
- Pengelolaan flash sale & voucher dari satu dashboard

**Target Customer:** Brand owner, reseller online, UMKM e-commerce

**Dependency:** Inventory Core, Revenue Core, Sales

**Estimasi Effort:** 16–20 minggu

**Harga Rekomen:** Rp 1.200.000/bulan (termasuk 2 channel), Rp 300.000/channel tambahan

**Prioritas:** ⭐⭐⭐⭐⭐ (Highest — ini adalah penentu market fit untuk UMKM digital)

---

### MODUL-07: Multi-Currency & Treasury

**Pain yang Diselesaikan:** Importir, eksportir, dan perusahaan multi-negara tidak bisa catat transaksi dalam mata uang asing dengan kurs otomatis.

**Capability:**
- Faktur penjualan/pembelian dalam mata uang asing (USD, EUR, SGD, MYR, dll.)
- Kurs otomatis dari Bank Indonesia / API forex real-time
- Akun bank multi-currency
- Gain/loss selisih kurs otomatis saat settlement
- Laporan konsolidasi dalam IDR (functional currency)
- Hedging notes untuk eksposur mata uang asing

**Target Customer:** Importir, eksportir, perusahaan dengan cabang luar negeri

**Dependency:** Finance Core, Accounting, Purchasing, Sales

**Estimasi Effort:** 10–14 minggu

**Harga Rekomen:** Rp 800.000/bulan

**Prioritas:** ⭐⭐⭐⭐ (High — blocker untuk segmen importir/eksportir)

---

### MODUL-08: CRM Pipeline & Sales Automation

**Pain yang Diselesaikan:** Tim sales tidak punya pipeline visual, tidak ada reminder follow-up, tidak ada tracking deal-to-close.

**Capability:**
- Pipeline Kanban: Lead → Qualified → Proposal → Negotiation → Won/Lost
- Activity log per deal: call, meeting, email, WhatsApp
- Reminder otomatis untuk follow-up yang overdue
- Quotation langsung dari deal card
- Win/loss analysis & conversion rate per sales rep
- Target sales per bulan & tracking pencapaian
- Integrasi dengan WhatsApp Business (kirim pesan dari CRM)

**Target Customer:** Semua tenant dengan tim sales B2B

**Dependency:** Revenue Core, Sales, Contacts

**Estimasi Effort:** 8–12 minggu

**Harga Rekomen:** Rp 600.000/bulan + Rp 100.000/seat sales rep

**Prioritas:** ⭐⭐⭐⭐⭐ (Highest — ini adalah differentiator vs kompetitor ERP lokal)

---

### MODUL-09: AI Business Intelligence

**Pain yang Diselesaikan:** Owner dan CFO mendapat laporan angka, bukan insight. Mereka tidak tahu *mengapa* revenue turun atau *kapan* cash akan habis.

**Capability:**
- Cash flow forecasting 30/60/90 hari berbasis data historis
- Anomali detection: transaksi tidak wajar, stok yang janggal
- Revenue attribution: produk mana yang paling profitable
- Churn prediction untuk subscription customer
- "Ask your data" chat interface (natural language ke SQL)
- Weekly digest otomatis ke WhatsApp/email owner
- Rekomendasi actionable: "Piutang Rp X jatuh tempo 3 hari, kirim reminder?"

**Target Customer:** Semua tenant, terutama owner dan CFO

**Dependency:** Semua modul core (baca dari semua tabel)

**Teknologi:** Google Vertex AI + Google AI Studio (sudah ada di stack)

**Estimasi Effort:** 12–16 minggu (iteratif)

**Harga Rekomen:** Rp 500.000/bulan (add-on insight layer)

**Prioritas:** ⭐⭐⭐⭐⭐ (Highest — differentiator jangka panjang)

---

## 5. Add-on Baru yang Direkomendasikan

### ADD-ON-01: WhatsApp Business Notification Engine

**Pain:** Customer tidak menerima notifikasi invoice, jatuh tempo, dan konfirmasi pesanan secara real-time.

**Capability:**
- Kirim invoice PDF via WhatsApp 1 klik
- Reminder otomatis H-3, H-1, dan H jatuh tempo piutang
- Konfirmasi order ke buyer otomatis
- Notifikasi approval (PO, reimbursement, cuti) ke approver
- Template pesan yang dapat dikustomisasi per tenant
- Log pengiriman & status (delivered/read)

**Dependency:** Revenue Core, Finance Core

**Integrasi:** WhatsApp Business API (Fonnte / Wablas / resmi Meta)

**Harga:** Rp 200.000/bulan + biaya pesan (atau paket kuota)

**Prioritas:** ⭐⭐⭐⭐⭐

---

### ADD-ON-02: Payment Gateway Integration

**Pain:** Customer harus transfer manual lalu konfirmasi ke operator. Proses lambat dan rawan human error.

**Capability:**
- Generate payment link dari invoice (Midtrans / Xendit / Duitku)
- Virtual account per invoice
- Auto-reconcile saat pembayaran masuk
- Mendukung: transfer bank, QRIS, kartu kredit, e-wallet
- Laporan settlement & fee payment gateway

**Dependency:** Revenue Core, Finance Core

**Harga:** Rp 150.000/bulan + persentase transaksi (atau flat MDR)

**Prioritas:** ⭐⭐⭐⭐⭐

---

### ADD-ON-03: e-Faktur & e-Bupot (Pajak Indonesia)

**Pain:** Wajib Pajak PKP harus upload faktur pajak ke DJP secara manual. e-Bupot PPh juga terpisah.

**Capability:**
- Generate faktur pajak sesuai format DJP (CSV/XML)
- Validasi NPWP dan NIK pembeli
- Upload batch ke e-Faktur DJP (via API / file)
- e-Bupot PPh 23, 21, 4(2) otomatis dari transaksi
- Dashboard rekap PPN Keluaran vs Masukan
- SPT Masa PPN rekonsiliasi

**Dependency:** Accounting, Revenue Core, Purchasing

**Harga:** Rp 300.000/bulan

**Prioritas:** ⭐⭐⭐⭐⭐ (wajib untuk PKP)

---

### ADD-ON-04: Landed Cost & Import Duty

**Pain:** Importir tidak bisa mengalokasikan bea masuk, pajak impor, dan ongkos freight ke harga pokok barang secara otomatis.

**Capability:**
- Landed cost allocation ke PO / Penerimaan Barang
- Metode alokasi: nilai, berat, volume, atau manual
- Item: bea masuk, PPN impor, PPh impor, freight, asuransi, biaya handling
- Rekonsiliasi PIB (Pemberitahuan Impor Barang)
- Harga pokok barang diperbarui otomatis setelah landed cost

**Dependency:** Purchasing, Inventory Core

**Harga:** Rp 250.000/bulan

**Prioritas:** ⭐⭐⭐⭐

---

### ADD-ON-05: Vendor Portal (Supplier Self-Service)

**Pain:** Vendor sering menagih lewat WA/telepon karena tidak tahu status PO dan pembayaran.

**Capability:**
- Portal login khusus vendor (tanpa akses ke data internal)
- Vendor lihat: PO yang ditujukan ke mereka, status, outstanding
- Vendor upload invoice & dokumen pendukung
- Status pembayaran real-time
- Konfirmasi penerimaan PO dari vendor
- Notifikasi saat pembayaran diproses

**Dependency:** Purchasing, Finance Core

**Harga:** Rp 200.000/bulan + Rp 50.000/10 vendor aktif

**Prioritas:** ⭐⭐⭐⭐

---

### ADD-ON-06: Customer Portal (Buyer Self-Service)

**Pain:** Buyer sering WA untuk cek status pesanan, invoice, dan riwayat transaksi.

**Capability:**
- Portal login untuk customer (view-only, kontrol ketat)
- Lihat: pesanan, delivery status, invoice outstanding
- Download invoice & faktur pajak mandiri
- Bayar invoice via payment link langsung dari portal
- Submit complaint/return request

**Dependency:** Revenue Core, Sales

**Harga:** Rp 200.000/bulan + Rp 50.000/10 customer aktif

**Prioritas:** ⭐⭐⭐⭐

---

### ADD-ON-07: Mobile PWA (Progressive Web App)

**Pain:** Akses via HP lambat dan tidak bisa dipakai offline. Tidak ada versi mobile yang proper.

**Capability:**
- PWA installable di Android & iOS tanpa App Store
- Mode offline untuk input transaksi dasar (sync saat online)
- Notifikasi push untuk approval, reminder, dan alert
- UI yang dioptimasi untuk layar kecil (semua modul)
- Barcode scanner via kamera HP untuk stok opname & POS
- Biometrik login (fingerprint/face ID)

**Dependency:** Semua modul

**Harga:** Bundled dengan paket (bukan add-on berbayar terpisah)

**Prioritas:** ⭐⭐⭐⭐⭐ (ini adalah hygiene factor — wajib ada)

---

### ADD-ON-08: Approval Workflow Engine

**Pain:** Setiap PO, pengeluaran, dan transaksi besar harus disetujui tapi tidak ada alur persetujuan yang formal dan teraudit.

**Capability:**
- Builder approval chain: siapa approve apa, berapa limit
- Notifikasi ke approver (in-app + WhatsApp)
- Eskalasi otomatis jika tidak direspons dalam X jam
- Audit trail lengkap: siapa approve/reject kapan
- Multi-level approval (staff → manager → direktur)
- Delegasi approval saat approver tidak ada

**Dependency:** Semua modul (lintas domain)

**Harga:** Rp 150.000/bulan

**Prioritas:** ⭐⭐⭐⭐⭐

---

### ADD-ON-09: Rekonsiliasi Bank Otomatis

**Pain:** Rekonsiliasi bank masih manual: download mutasi → cocokkan satu-satu → koreksi jurnal.

**Capability:**
- Import mutasi bank via file (CSV/Excel) atau koneksi API bank
- Auto-match mutasi dengan transaksi di ERP (fuzzy match)
- Flag transaksi yang belum teridentifikasi
- Satu klik konfirmasi atau buat jurnal baru dari mutasi
- Laporan status rekonsiliasi real-time
- Support: BCA, Mandiri, BRI, BNI, BSI, CIMB Niaga

**Dependency:** Finance Core, Accounting

**Harga:** Rp 200.000/bulan

**Prioritas:** ⭐⭐⭐⭐⭐

---

### ADD-ON-10: Stok Opname Digital

**Pain:** Stok opname masih pakai kertas atau Excel, hasilnya lambat dimasukkan ke ERP.

**Capability:**
- Buat sesi stok opname per gudang/lokasi
- Scan barcode dari HP untuk input hitungan fisik
- Bandingkan stok sistem vs fisik secara real-time
- Auto-generate jurnal penyesuaian stok setelah konfirmasi
- Laporan selisih (variance) per item dan kategori
- Multi-counter: beberapa orang opname secara paralel

**Dependency:** Inventory Core, Warehouse

**Harga:** Rp 150.000/bulan

**Prioritas:** ⭐⭐⭐⭐

---

### ADD-ON-11: Commission & Reseller Management

**Pain:** Tracking komisi sales dan reseller masih manual di spreadsheet.

**Capability:**
- Skema komisi fleksibel: flat, persentase, tiered, kumulatif
- Komisi otomatis terhitung saat invoice lunas
- Dashboard sales rep: lihat komisi yang earned vs paid
- Payout approval flow
- Laporan komisi per periode, per rep, per produk
- Multi-level MLM (opsional)

**Dependency:** Revenue Core, Sales, Finance Core

**Harga:** Rp 250.000/bulan

**Prioritas:** ⭐⭐⭐

---

### ADD-ON-12: Quality Control & Inspeksi

**Pain:** Manufaktur dan importir tidak punya modul QC: barang masuk langsung masuk stok tanpa inspeksi.

**Capability:**
- Checklist QC saat penerimaan barang (inbound QC)
- QC proses produksi (in-process QC)
- QC sebelum pengiriman (outgoing QC)
- Status: pass / fail / conditional pass
- Laporan defect rate per supplier & per produk
- Quarantine stok yang gagal QC

**Dependency:** Inventory Core, Purchasing, Manufacturing

**Harga:** Rp 200.000/bulan

**Prioritas:** ⭐⭐⭐

---

### ADD-ON-13: Budget & Cost Center Management

**Pain:** CFO tidak bisa monitor pengeluaran vs anggaran per divisi secara real-time.

**Capability:**
- Buat anggaran per cost center / departemen / proyek
- Mapping transaksi ke cost center saat input
- Alert saat 80% anggaran terpakai
- Dashboard budget vs actual per periode
- Laporan varian anggaran untuk review manajemen
- Export untuk rapat board

**Dependency:** Accounting, Finance Core, HRIS

**Harga:** Rp 300.000/bulan

**Prioritas:** ⭐⭐⭐⭐

---

### ADD-ON-14: Document Management & e-Sign

**Pain:** Kontrak, SPK, dan dokumen penting masih dikirim fisik atau via email tanpa versi kontrol.

**Capability:**
- Upload dan simpan dokumen ke storage (S3 yang sudah ada)
- Kategorisasi: kontrak, PKS, SPK, PO, invoice, sertifikat
- e-Sign terintegrasi (tanda tangan digital berbasis OTP)
- Versi kontrol: track perubahan dokumen
- Notifikasi saat dokumen hampir expired
- Akses berbasis role

**Dependency:** Platform Core, semua modul

**Teknologi:** AWS S3 (sudah ada), integrasi e-sign lokal

**Harga:** Rp 150.000/bulan + storage (Rp 10.000/GB)

**Prioritas:** ⭐⭐⭐

---

### ADD-ON-15: HR Self-Service & ESS

**Pain:** Karyawan harus minta HRD untuk slip gaji, pengajuan cuti, dan update data diri.

**Capability:**
- Portal karyawan: lihat slip gaji, histori absensi, saldo cuti
- Pengajuan cuti & reimburstement dari HP
- Update data diri (alamat, rekening, kontak darurat)
- Notifikasi keputusan approval langsung ke HP
- Download slip gaji sebagai PDF
- Kalender cuti tim

**Dependency:** HRIS

**Harga:** Rp 50.000/bulan/10 karyawan (min 50.000)

**Prioritas:** ⭐⭐⭐⭐

---

### ADD-ON-16: Point of Sale Advanced

**Pain:** POS dasar tidak mendukung split payment, loyalty point, dan manajemen meja (untuk F&B).

**Capability:**
- Split payment: bayar sebagian cash, sebagian QRIS
- Loyalty point: akumulasi dan redeem poin
- Table management untuk restoran/kafe
- Kitchen display system (KDS) untuk dapur
- Modifier produk: ukuran, topping, level pedas
- Struk digital via WA/email

**Dependency:** POS Core, Revenue Core

**Harga:** Rp 300.000/bulan

**Prioritas:** ⭐⭐⭐

---

### ADD-ON-17: API & Webhook Advanced

**Pain:** Integrasi ke sistem legacy atau custom app butuh webhook real-time dan API yang lebih granular.

**Capability:**
- Webhook untuk semua event (invoice paid, stock low, dll.)
- API rate limit lebih tinggi untuk enterprise
- Custom field via API
- OAuth 2.0 untuk third-party integration
- API key management & audit log
- Sandbox environment untuk testing

**Dependency:** Platform Core, semua modul

**Harga:** Rp 500.000/bulan (enterprise tier)

**Prioritas:** ⭐⭐⭐

---

### ADD-ON-18: Multi-Entity Consolidation Advanced

**Pain:** Holding company dengan 5+ entitas tidak bisa konsolidasi laporan keuangan otomatis dengan eliminasi intercompany.

**Capability:**
- Konsolidasi neraca & P&L lintas entitas otomatis
- Eliminasi transaksi intercompany
- Alokasi overhead dari induk ke anak
- Laporan per entitas + laporan konsolidasi
- Multi-mata uang dalam konsolidasi
- Drill-down dari angka konsolidasi ke transaksi asli

**Dependency:** Accounting, Multi-Entity (PT/CV), Multi-Currency

**Harga:** Rp 1.000.000/bulan

**Prioritas:** ⭐⭐⭐⭐

---

## 6. Matriks Prioritas Implementasi

### 6.1 Quick Wins (0–3 Bulan)

| Item | Type | Effort | Revenue Impact |
|---|---|---|---|
| WhatsApp Notification Engine | Add-on | 4 minggu | Sangat Tinggi |
| Rekonsiliasi Bank Otomatis | Add-on | 4 minggu | Tinggi |
| e-Faktur & e-Bupot | Add-on | 6 minggu | Sangat Tinggi |
| Approval Workflow Engine | Add-on | 4 minggu | Tinggi |
| CRM Pipeline & Sales Automation | Modul | 8 minggu | Sangat Tinggi |
| Mobile PWA Optimization | Add-on | 6 minggu | Sangat Tinggi |

### 6.2 Core Growth (3–9 Bulan)

| Item | Type | Effort | Revenue Impact |
|---|---|---|---|
| Payment Gateway Integration | Add-on | 6 minggu | Sangat Tinggi |
| Marketplace/E-Commerce Hub | Modul | 16 minggu | Sangat Tinggi |
| Multi-Currency & Treasury | Modul | 12 minggu | Tinggi |
| Subscription & Recurring Billing | Modul | 10 minggu | Tinggi |
| HR Self-Service & ESS | Add-on | 5 minggu | Menengah |
| Budget & Cost Center | Add-on | 6 minggu | Menengah |
| Document Management & e-Sign | Add-on | 6 minggu | Menengah |

### 6.3 Market Expansion (9–18 Bulan)

| Item | Type | Effort | Revenue Impact |
|---|---|---|---|
| AI Business Intelligence | Modul | 14 minggu | Sangat Tinggi (jangka panjang) |
| Field Service & Dispatch | Modul | 16 minggu | Tinggi |
| Healthcare & Klinik | Modul | 18 minggu | Sangat Tinggi |
| Property & Real Estate | Modul | 14 minggu | Tinggi |
| Logistics & Kurir Internal | Modul | 12 minggu | Menengah–Tinggi |
| Landed Cost & Import Duty | Add-on | 5 minggu | Menengah |
| Vendor Portal | Add-on | 6 minggu | Menengah |
| Customer Portal | Add-on | 6 minggu | Menengah |
| Multi-Entity Consolidation | Add-on | 8 minggu | Tinggi |

---

## 7. Model Harga yang Direkomendasikan

### 7.1 Paket Bundle Baru

```
┌─────────────────────────────────────────────────────────────┐
│ NIZAM STARTER                                    Rp 299.000 │
│ Finance + Sales + Inventory + Purchasing + Reports           │
│ + WhatsApp Notif (100 pesan/bulan)                          │
│ + Rekonsiliasi Bank (1 akun)                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ NIZAM PROFESSIONAL                               Rp 699.000 │
│ Semua Starter + HRIS + CRM Pipeline + e-Faktur              │
│ + Payment Gateway + Mobile PWA                               │
│ + WhatsApp Notif (500 pesan/bulan)                          │
│ + Approval Workflow                                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ NIZAM ENTERPRISE                               Rp 1.499.000 │
│ Semua Professional + Manufacturing + Audit                   │
│ + Multi-Entity + AI Insight                                  │
│ + Vendor & Customer Portal                                   │
│ + API Advanced + Budget & Cost Center                        │
│ + Dedicated onboarding & support                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ NIZAM VERTICAL (per industri)              mulai Rp 999.000 │
│ Healthcare, Property, Logistics, Fleet — custom bundle       │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Add-on À La Carte

| Add-on | Harga/Bulan |
|---|---|
| WhatsApp Notif (unlimited) | Rp 200.000 |
| Payment Gateway | Rp 150.000 + MDR |
| e-Faktur & e-Bupot | Rp 300.000 |
| Rekonsiliasi Bank | Rp 200.000 |
| Approval Workflow | Rp 150.000 |
| Landed Cost | Rp 250.000 |
| Vendor Portal | Rp 200.000 |
| Customer Portal | Rp 200.000 |
| HR Self-Service | Rp 50.000/10 karyawan |
| Document Management | Rp 150.000 |
| AI Insight | Rp 500.000 |
| Multi-Currency | Rp 800.000 |
| Commission Management | Rp 250.000 |
| QC & Inspeksi | Rp 200.000 |
| Budget & Cost Center | Rp 300.000 |
| POS Advanced | Rp 300.000 |
| Stok Opname Digital | Rp 150.000 |
| API & Webhook Advanced | Rp 500.000 |

---

## 8. Arsitektur Teknis Implementasi

### 8.1 Prinsip Teknis

1. **Semua modul baru** mengikuti pola yang ada: `app/(dashboard)/<modul>/` untuk UI, `modules/<modul>/` untuk business logic.
2. **Database** tetap Railway PostgreSQL via `queryPostgres()` — tidak ada ORM baru.
3. **API eksternal** (WhatsApp, payment gateway, marketplace) di-abstract ke `lib/integrations/<provider>/`.
4. **Mobile PWA**: gunakan Next.js built-in PWA support + `next-pwa` package.
5. **AI Insight**: gunakan Google Vertex AI yang sudah ada di stack (`@google-cloud/vertexai`).
6. **e-Sign**: integrasi ke Privy atau PrivyID sebagai provider e-sign lokal Indonesia.

### 8.2 Struktur Direktori Baru

```
lib/
  integrations/
    whatsapp/          # WhatsApp Business API abstraction
    payment-gateway/   # Midtrans, Xendit adapter
    marketplace/       # Tokopedia, Shopee, Lazada adapter
    bank/              # Mutasi bank import adapter
    efaktur/           # DJP e-Faktur API
    esign/             # PrivyID / Privy adapter

modules/
  crm/                 # CRM Pipeline (baru)
  subscription/        # Recurring Billing (baru)
  field-service/       # Field Service & Dispatch (baru)
  healthcare/          # Healthcare & Klinik (baru)
  property/            # Property & Real Estate (baru)
  logistics/           # Logistics & Kurir (baru)
  multi-currency/      # Multi-Currency Treasury (baru)
  ai-insight/          # AI BI Layer (baru)

app/(dashboard)/
  crm/
  subscription/
  field-service/
  healthcare/
  property/
  logistics/
```

### 8.3 Database — Tabel Utama Baru

```sql
-- CRM
crm_pipelines, crm_deals, crm_activities, crm_stages

-- Subscription
subscription_plans, subscription_subscriptions,
subscription_invoices, subscription_dunning_log

-- Multi-Currency
currency_rates, currency_accounts, fx_gain_loss_journal

-- WhatsApp
notification_templates, notification_log, notification_queue

-- Field Service
work_orders, technician_assignments, wo_checklist,
wo_parts_used, wo_photos

-- Healthcare
patients, medical_records, clinic_schedules,
clinic_billing, bpjs_claims

-- Property
property_projects, property_units, property_bookings,
property_installments, property_agents
```

---

## 9. Risiko dan Mitigasi

| Risiko | Dampak | Kemungkinan | Mitigasi |
|---|---|---|---|
| Marketplace API berubah tanpa notif | Sync berhenti | Tinggi | Webhook fallback + monitoring alert |
| DJP e-Faktur API tidak stabil | Gagal upload pajak | Menengah | Fallback ke export CSV manual |
| WhatsApp Business API kena limit | Notif tidak terkirim | Menengah | Multi-provider fallback (Fonnte→Wablas) |
| Modul healthcare membutuhkan regulasi | Delay launch | Tinggi | Mulai dengan fitur non-regulated, hindari EMR regulated |
| AI Insight memberikan insight salah | Keputusan bisnis keliru | Menengah | Selalu tampilkan data sumber, disclaimer jelas |
| PWA offline sync conflict | Data rusak | Rendah | Last-write-wins + conflict log untuk review manual |

---

## 10. KPI Sukses

### 10.1 Product KPI (12 Bulan)

| Metrik | Baseline | Target 12 Bulan |
|---|---|---|
| Jumlah modul tersedia | 12 | 21 |
| Jumlah add-on tersedia | 9 | 27 |
| Rata-rata add-on per tenant | 1.2 | 3.5 |
| NPS tenant | - | ≥ 50 |
| Churn rate bulanan | - | < 3% |
| Feature adoption rate (CRM) | - | ≥ 40% tenant |
| WhatsApp notif sent/bulan | 0 | 500.000 |

### 10.2 Revenue KPI

| Metrik | Target |
|---|---|
| ARPU (Average Revenue Per User) | Naik 60% dalam 12 bulan |
| Add-on revenue % dari total | ≥ 30% |
| Vertical module adoption | ≥ 200 tenant di Healthcare/Property |
| Enterprise tier customers | ≥ 50 tenant |

---

## 11. Rekomendasi Aksi Segera (Next 30 Hari)

1. **Validasi dengan customer** — lakukan 10 customer interview untuk konfirmasi ranking pain point.
2. **Pilih 3 quick win** — WhatsApp Notif + Rekonsiliasi Bank + CRM Pipeline sebagai sprint pertama.
3. **Buat RFC teknis** untuk integrasi WhatsApp Business API.
4. **Tentukan partnership** dengan payment gateway (Midtrans atau Xendit) dan marketplace (Tokopedia Open API).
5. **Assign tim** — 1 PM, 2 backend, 2 frontend, 1 QA untuk sprint quick win.
6. **Setup staging environment** khusus untuk integrasi eksternal.
7. **Draft legal agreement** untuk e-Faktur (perlu PKS dengan DJP atau mitra).

---

## 12. Kesimpulan

NIZAM sudah punya fondasi yang sangat kuat. Gap terbesar bukan di core ERP — gap terbesar ada di **ekosistem integrase** (WhatsApp, payment, marketplace, pajak) dan **vertical depth** (healthcare, property, logistics).

Strategi yang paling efisien adalah:

1. **Tutup gap integrasi dulu** → ini yang paling terasa oleh customer harian.
2. **Bangun CRM Pipeline** → ini yang paling membedakan NIZAM dari kompetitor lokal.
3. **Masuk Healthcare** → pasar besar, kompetitor lemah, willingness to pay tinggi.
4. **AI Insight sebagai moat jangka panjang** → tidak ada ERP lokal yang punya ini secara native.

Dengan 9 modul baru dan 18 add-on baru ini, NIZAM dapat menaikkan ARPU 60% dan mengunci customer dalam ekosistem yang semakin sulit digantikan oleh kompetitor.

---

*Dokumen ini dihasilkan berdasarkan analisis mendalam codebase NIZAM (branch: feat_multi), dokumen strategi yang ada (KLASIFIKASI_MODULE_DAN_ADDON_NIZAM.md, GTM_NIZAM_MODULE_DAN_ADDON.md), dan benchmarking terhadap produk ERP global dan lokal.*
