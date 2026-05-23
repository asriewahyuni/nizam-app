# NIZAM Platform — Roadmap Modul & Add-on Global V3
## Perencanaan Produk Berbasis Analisis `feat_multi` + Pain Customer Global

**Versi:** 3.0  
**Tanggal:** 23 Mei 2026  
**Branch Sumber Analisis:** `feat_multi`  
**Dibuat oleh:** Claude AI — Product Architecture Review  
**Status:** FINAL — Siap untuk dieksekusi  

---

## RINGKASAN EKSEKUTIF

Berdasarkan analisis mendalam terhadap branch `feat_multi`, NIZAM telah berhasil membangun fondasi arsitektur modular yang solid dengan **5 Pilar Core + 5 Vertical Domain + 11 Growth Add-on**. Versi ini (`feat_multi`) membawa inovasi kritis:

| Inovasi feat_multi | Dampak Strategis |
|---|---|
| Dynamic Module Entitlement System | Setiap tenant bisa aktifkan/non-aktifkan modul tanpa redeploy |
| Syirkah sebagai Pilar ke-5 | NIZAM jadi satu-satunya ERP global dengan Islamic Finance sebagai core pillar |
| Modular Setup Flow (wizard per modul) | Time-to-value dari 2 minggu → 2 hari |
| Parallel Analytics Service | Query performa 3-5× lebih cepat |
| Modal-based Course Creation (LMS) | UX friction berkurang drastis untuk instruktur |
| Marketplace Sync Engine Foundation | Fondasi untuk koneksi ke 10+ marketplace |
| saas_assessors Architecture | Basis untuk partner & reseller certification program |

Namun, analisis menunjukkan **7 gap besar** yang jika diselesaikan akan membuka akses ke segmen customer baru dan meningkatkan Average Revenue Per User (ARPU) secara signifikan.

**Target Roadmap V3:** Menambahkan **14 Modul Baru** + **20 Add-on Baru** yang secara langsung menyelesaikan pain customer global yang belum terpenuhi, disusun dalam **5 Phase** selama 18 bulan (Q3 2026 – Q4 2027).

---

## BAGIAN 1: ANALISIS KONDISI feat_multi

### 1.1 Apa yang Berhasil Dibangun di feat_multi

```
NIZAM N2 (feat_multi Architecture)
├── Core Pillars (5 — Selalu Aktif)
│   ├── Pilar 1: Finance Core (Accounting, GL, AP/AR, Rekon, Tax)
│   ├── Pilar 2: Revenue Core (Sales, Quotation, Invoicing, POS)
│   ├── Pilar 3: Purchasing + Inventory (PO, PR, Stock, Warehouse)
│   ├── Pilar 4: HRIS Core (Employee, Payroll, Attendance, Leave)
│   └── Pilar 5: Syirkah (Mudharabah, Musyarakah, Bagi Hasil) ← INOVASI
│
├── Vertical Domain (Pilih 1 yang Aktif)
│   ├── Fleet & Rental
│   ├── Manufacturing
│   ├── Service/Workshop
│   ├── Construction/Project
│   └── LMS/Academy ← Strategis
│
└── Growth Add-ons (Multi-select)
    ├── POS, Sales Page, Quick Bill, Advanced WMS
    ├── Open API, Multi-Entity, Seat Pack
    ├── Sales AR Cockpit, Package Tracking
    ├── Fleet Maintenance Pack, Marketplace Sync (beta)
    └── E-Commerce (store + checkout)
```

### 1.2 Gap Kritis yang Ditemukan di feat_multi

#### GAP #1 — Compliance & Regulasi (Pain Level: 🔴 KRITIS)
- Tax Compliance Engine belum ada → semua PKP masih manual
- e-Faktur, SPT, PPh 21/23 tidak terintegrasi
- Tidak ada multi-jurisdiction tax untuk ekspansi ASEAN

#### GAP #2 — Cash Intelligence (Pain Level: 🔴 KRITIS)
- Tidak ada cashflow forecasting → owner buta kondisi likuiditas
- AR/AP aging ada tapi tidak ada early warning otomatis
- Tidak ada cash pooling untuk grup usaha

#### GAP #3 — Customer Lifecycle (Pain Level: 🟠 TINGGI)
- Tidak ada customer self-service portal → CS overload
- Tidak ada dunning management → revenue leakage
- Tidak ada loyalty/rewards program → churn tidak dicegah

#### GAP #4 — Operasional Lapangan (Pain Level: 🟠 TINGGI)
- Field service dispatching masih manual
- Tidak ada mobile-first app untuk karyawan/teknisi
- GPS tracking dan proof of delivery belum ada

#### GAP #5 — Supply Chain Intelligence (Pain Level: 🟠 TINGGI)
- Tidak ada demand forecasting otomatis
- Reorder point manual → stockout/overstock berkala
- MRP untuk manufacturing belum terintegrasi

#### GAP #6 — AI-Native Operations (Pain Level: 🟡 SEDANG)
- AI hanya ada untuk AI Studio (background)
- Belum ada AI co-pilot untuk operasional sehari-hari
- Invoice OCR, purchase AI, dan cashflow AI belum ada

#### GAP #7 — Ekosistem & Integrasi (Pain Level: 🟡 SEDANG)
- Marketplace Sync masih beta, belum production-ready
- Tidak ada Vendor Portal → supplier tetap komunikasi via email
- Payment gateway belum terintegrasi langsung di invoice

---

## BAGIAN 2: PAIN POINT CUSTOMER GLOBAL — ANALISIS MENDALAM

### 2.1 Peta Pain Point Berdasarkan Segmen

#### Segmen A: UKM Produksi & Distribusi (Target: 500K+ entitas di Indonesia)

| Pain Utama | Frekuensi | Biaya Tersembunyi |
|---|---|---|
| Stok habis tiba-tiba / overstock | Setiap minggu | 5-15% revenue hilang |
| Faktur pajak manual & telat | Setiap bulan | Denda + tenaga akuntan |
| Tidak tahu margin per produk | Terus-menerus | Jual rugi tanpa sadar |
| Approval PO lewat WA Group | Setiap hari | Fraud, telat approval |
| Rekonsiliasi bank manual | Akhir bulan | 3-5 hari kerja/bulan |

#### Segmen B: Bisnis Jasa & Berlangganan (Target: 200K+ entitas)

| Pain Utama | Frekuensi | Biaya Tersembunyi |
|---|---|---|
| Invoice recurring dibuat manual | Setiap bulan | Error, terlambat tagih |
| Tidak ada sistem ticketing customer | Harian | Churn 15-30% tahunan |
| Komisi sales salah hitung | Setiap bulan | Demotivasi tim, konflik |
| Kontrak jatuh tempo tidak diingat | Tiap kuartal | Revenue hilang, legal risk |
| Karyawan harus datang ke HRD | Setiap minggu | Produktivitas turun |

#### Segmen C: Retail & E-Commerce (Target: 300K+ penjual aktif)

| Pain Utama | Frekuensi | Biaya Tersembunyi |
|---|---|---|
| Data marketplace tidak masuk ERP | Setiap hari | 2-4 jam entry manual |
| Stok online-offline tidak sinkron | Real-time | Overselling, refund |
| Tidak bisa terima bayar digital di invoice | Per tagihan | Payment terlambat |
| Return dari marketplace tidak terlacak | Mingguan | Kerugian tidak tercatat |
| Tidak ada program loyalty pelanggan | Terus-menerus | Repeat purchase rendah |

#### Segmen D: Perusahaan Menengah & Korporasi (Target: 30K+ entitas)

| Pain Utama | Frekuensi | Biaya Tersembunyi |
|---|---|---|
| Tidak ada konsolidasi laporan multi-entitas | Bulanan | 5-10 hari kerja/bulan |
| Tidak bisa track cashflow 90 hari ke depan | Terus-menerus | Gagal bayar dadakan |
| Tidak ada ESG report untuk investor/mitra asing | Tahunan | Gagal tender/IPO |
| Budget departemen tidak terkontrol | Bulanan | Budget overrun 20-40% |
| Tidak siap audit eksternal | Tahunan | Penundaan, denda, reputasi |

### 2.2 Pain Point ASEAN Global (Ekspansi Regional)

| Negara | Pain Spesifik | Peluang NIZAM |
|---|---|---|
| Malaysia | GST compliance, Islamic finance (Murabahah, Ijarah) | Syirkah sudah ada! Tambah Malaysia GST |
| Filipina | BIR tax compliance, OFW payroll | Tax engine + multi-currency payroll |
| Vietnam | VAT & e-Invoice (HĐKT điện tử) | Tax compliance engine + lokalisasi |
| Thailand | ภาษีมูลค่าเพิ่ม (VAT) + BOI compliance | Compliance module + multi-language |
| Singapura | GST, MAS compliance, multi-currency | Treasury module + banking integration |

---

## BAGIAN 3: MODUL BARU — REKOMENDASI KOMPREHENSIF

### ═══════════════════════════════════════
### KELOMPOK A: CORE FAMILY EXTENSION
### (Perluasan dari 5 Pilar yang Sudah Ada)
### ═══════════════════════════════════════

---

### MODUL A-1: Treasury & Multi-Currency Intelligence

**Klasifikasi:** Finance Core Extension  
**Prioritas:** 🔴 Tier-1 — KRITIS  
**Target Rilis:** Q3 2026

**Pain yang Diselesaikan:**
- Bisnis ekspor/impor tidak bisa catat transaksi multi-mata uang dengan benar
- Selisih kurs tidak terhitung, muncul selisih misterius di laporan
- Owner tidak tahu posisi kas seluruh rekening sekarang
- Tidak ada cash pooling untuk grup usaha

**Fitur Lengkap:**
1. **Multi-Currency Ledger** — Catat transaksi dalam USD, EUR, SGD, MYR, dll. secara paralel dengan IDR
2. **Auto Exchange Rate Fetching** — Ambil kurs otomatis dari Bank Indonesia API, ECB, atau Wise
3. **Realized & Unrealized Forex Gain/Loss** — Jurnal FX gain/loss otomatis di setiap transaksi dan akhir periode
4. **Currency Revaluation Engine** — Revaluasi saldo akhir periode sesuai kurs penutup
5. **Treasury Dashboard** — Posisi kas seluruh rekening (multi-bank, multi-currency) dalam satu tampilan
6. **Cash Pooling** — Saldo konsolidasi antar cabang/entitas untuk keputusan likuiditas grup
7. **Multi-Bank Reconciliation** — Rekon otomatis dari CSV statement 10+ bank lokal/asing
8. **Hedging Record** — Catat forward contract dan lindung nilai sederhana dengan notional amount
9. **FX Exposure Report** — Laporan eksposur mata uang asing per akun dan per periode
10. **Bank Fee Analyzer** — Deteksi dan kategorikan biaya bank secara otomatis

**Database Schema Additions:**
```sql
-- currencies, exchange_rates, forex_transactions, cash_pools, hedging_positions
```

**Integrasi:** Finance Core, Accounting Module, Multi-Entity Add-on  
**Target Customer:** Eksportir, importir, perusahaan dengan supplier/pelanggan asing, grup usaha  
**Estimasi ARR Impact:** Buka 200K+ segmen bisnis internasional × Rp 300K/bulan = Rp 60B+/bulan TAM

---

### MODUL A-2: Budget & Cost Control

**Klasifikasi:** Finance Core Extension  
**Prioritas:** 🔴 Tier-1 — KRITIS  
**Target Rilis:** Q3 2026

**Pain yang Diselesaikan:**
- Owner tidak tahu departemen mana yang melebihi budget
- PO tidak dicek terhadap anggaran yang tersedia → budget jebol
- Tidak ada rolling forecast → proyeksi statis dari awal tahun

**Fitur Lengkap:**
1. **Budget Planning** — Susun anggaran per departemen / cost center / proyek / SKU / periode (bulanan, kuartalan, tahunan)
2. **Budget vs Actuals Dashboard** — Real-time perbandingan anggaran vs realisasi dengan traffic light indicator
3. **PO Budget Checking** — Setiap PO dicek terhadap budget tersedia; warning/block jika melebihi
4. **Expense Budget Utilization** — Visualisasi utilisasi anggaran per akun, per departemen
5. **Rolling Forecast** — Update proyeksi anggaran secara berkala berdasarkan realisasi berjalan
6. **Budget Approval Workflow** — Revisi anggaran harus disetujui dengan audit trail
7. **Multi-Level Budget Hierarchy** — Korporat → Divisi → Departemen → Tim
8. **Budget Carry-Over** — Transfer sisa anggaran ke periode berikutnya
9. **Scenario Planning** — Buat multiple scenario (optimistic, base, pessimistic) dan bandingkan
10. **Budget KPI Alerts** — Notifikasi otomatis saat utilisasi mencapai 80%, 90%, 100%

**Integrasi:** Finance Core, Purchasing, Accounting, Approval Workflow Add-on  
**Target Customer:** Perusahaan 20+ karyawan, multi-divisi, kontraktor, perusahaan berbasis proyek

---

### MODUL A-3: Fixed Asset & Depreciation Management

**Klasifikasi:** Finance Core Extension  
**Prioritas:** 🟠 Tier-2 — HIGH  
**Target Rilis:** Q4 2026

**Pain yang Diselesaikan:**
- Aset tetap di spreadsheet → nilai salah, penyusutan tidak konsisten
- Tidak ada tracking lokasi dan penanggung jawab aset
- Dispose/transfer aset tidak pernah dicatat dengan benar

**Fitur Lengkap:**
1. **Asset Register** — Daftar semua aset dengan kategori, lokasi, PIC, tanggal beli, nilai perolehan
2. **Depreciation Engine** — Straight-line, declining balance, sum-of-years-digit, unit-of-production
3. **Auto Depreciation Posting** — Jurnal penyusutan otomatis per periode tanpa input manual
4. **Asset Disposal & Write-off** — Workflow penjualan/penghapusan aset dengan gain/loss otomatis
5. **Asset Transfer** — Pindah aset antar lokasi, divisi, atau entitas dengan audit trail
6. **Revaluation Module** — Naikkan/turunkan nilai aset sesuai penilaian ulang
7. **Maintenance Log** — Catat riwayat perawatan dan biaya per aset
8. **Asset QR Code** — Generate QR code untuk tagging fisik aset di lapangan
9. **NBV Report** — Net Book Value per kategori, per lokasi, per periode
10. **Depreciation Schedule** — Proyeksi penyusutan 5-10 tahun ke depan per aset

**Integrasi:** Finance Core, Fleet Maintenance Pack (opsional), Predictive Maintenance Add-on

---

### MODUL A-4: Payables & Receivables Intelligence

**Klasifikasi:** Finance Core Extension  
**Prioritas:** 🔴 Tier-1 — KRITIS  
**Target Rilis:** Q3 2026

**Pain yang Diselesaikan:**
- Owner tidak tahu kapan harus tagih dan kapan harus bayar
- Tidak ada peringatan dini sebelum cash crunch
- Cash flow forecast dibuat manual di Excel tiap bulan

**Fitur Lengkap:**
1. **AR Aging Intelligence** — Aging AR dengan alert otomatis + strategi penagihan per bucket
2. **AP Aging Intelligence** — Aging AP dengan rekomendasi pembayaran (prioritaskan diskon/hindari penalti)
3. **Cash Flow Forecast** — Proyeksi 7/30/60/90 hari ke depan berbasis AR/AP outstanding + recurring
4. **Auto Payment Reminder** — Kirim reminder ke customer via WhatsApp/Email sebelum dan sesudah jatuh tempo
5. **Dunning Management** — Eskalasi reminder otomatis: sopan → tegas → formal → legal
6. **Supplier Payment Scheduling** — Rekomendasi kapan bayar supplier untuk optimasi cashflow
7. **Early Payment Discount** — Track diskon supplier untuk pembayaran awal dan hitung net benefit
8. **DSO & DPO Analytics** — Days Sales Outstanding dan Days Payable Outstanding tracking real-time
9. **Cash Flow Scenario** — Model optimistic, base, pessimistic secara bersamaan
10. **Invoice Financing Readiness** — Generate report untuk pengajuan factoring/invoice financing ke bank

**Integrasi:** Finance Core, Revenue Core, Purchasing, WhatsApp Integration Add-on

---

### MODUL A-5: Commission & Incentive Management

**Klasifikasi:** Revenue Core Extension  
**Prioritas:** 🟠 Tier-2 — HIGH  
**Target Rilis:** Q4 2026

**Pain yang Diselesaikan:**
- Komisi sales dihitung manual → sering salah → konflik tim
- Tidak ada transparansi komisi → demotivasi
- Tidak ada program insentif yang terintegrasi data penjualan aktual

**Fitur Lengkap:**
1. **Commission Scheme Builder** — Buat skema komisi: persentase revenue/profit, tiered, target-based, mixed
2. **Real-Time Commission Tracker** — Setiap sales rep bisa lihat komisi akumulasi secara real-time
3. **Multi-Level Commission** — Sales Rep → SPV → Manager → Regional Manager
4. **Commission Approval Workflow** — Verifikasi sebelum komisi dibayar
5. **Payroll Integration** — Komisi otomatis masuk komponen payroll → slip gaji langsung
6. **Bonus Campaign Manager** — Buat campaign insentif dengan periode, target, dan hadiah
7. **Sales Contest & Leaderboard** — Gamifikasi tim sales dengan ranking dan reward
8. **Commission Statement** — Laporan komisi bulanan per sales rep (bisa dikirim via email/WA)
9. **Override & Clawback** — Adjust atau tarik kembali komisi jika ada retur/dispute
10. **Commission Analytics** — ROI per skema komisi, sales performa vs incentive cost

**Integrasi:** Revenue Core, HRIS Core, Finance Core

---

### MODUL A-6: Subscription & Recurring Billing

**Klasifikasi:** Revenue Core Extension  
**Prioritas:** 🟠 Tier-2 — HIGH  
**Target Rilis:** Q4 2026

**Pain yang Diselesaikan:**
- Bisnis SaaS/membership buat invoice manual setiap periode → error dan terlambat
- Tidak ada tracking trial conversion, churn, dan MRR
- Revenue recognition tidak sesuai PSAK/IFRS untuk bisnis berlangganan

**Fitur Lengkap:**
1. **Subscription Plan Builder** — Buat paket berlangganan: bulanan, tahunan, semi-annual, custom cycle
2. **Auto Invoice Generation** — Invoice dibuat dan dikirim otomatis sesuai siklus billing
3. **Trial Management** — Kelola periode trial, conversion tracking, dan auto-start billing setelah trial
4. **Proration Engine** — Hitung tagihan proporsional saat upgrade/downgrade di tengah periode
5. **Dunning Management** — Reminder + eskalasi otomatis untuk subscriber yang telat bayar
6. **Deferred Revenue Recognition** — Akui revenue sesuai periode layanan (PSAK 72 / IFRS 15 compliant)
7. **Churn Analysis** — Identifikasi pola churn dan customer berisiko tinggi
8. **MRR/ARR Dashboard** — Monthly/Annual Recurring Revenue, Net MRR Movement, Churn Rate
9. **Cohort Analysis** — Lihat retensi pelanggan berdasarkan bulan akuisisi
10. **Subscription Self-Service** — Customer bisa upgrade/downgrade/cancel sendiri via portal

**Integrasi:** Revenue Core, Finance Core, Customer Success Portal Modul

---

### ═══════════════════════════════════════
### KELOMPOK B: VERTICAL MODULE BARU
### (Domain Bisnis yang Belum Terlayani)
### ═══════════════════════════════════════

---

### MODUL B-1: Tax Compliance Engine

**Klasifikasi:** Compliance Module (Cross-Cutting)  
**Prioritas:** 🔴 Tier-1 — KRITIS (Wajib untuk semua PKP)  
**Target Rilis:** Q3 2026

**Pain yang Diselesaikan:**
- Semua PKP wajib lapor SPT PPN — proses manual memakan 3-5 hari/bulan
- e-Faktur salah → koreksi DJP yang panjang
- PPh 21/23 tidak dihitung otomatis → risiko denda

**Fitur Lengkap:**
1. **PPN Input/Output Tracking** — Setiap transaksi otomatis diklasifikasikan ke PPN masukan/keluaran
2. **e-Faktur Generation** — Generate faktur pajak format XML DJP, siap upload ke e-Faktur DJP
3. **SPT Masa PPN Auto-Rekap** — Rekap SPT Masa PPN otomatis setiap bulan, siap lapor ke DJP
4. **PPh 21 Calculation** — Hitung PPh 21 karyawan terintegrasi dengan payroll HRIS
5. **PPh 23 Withholding** — Track dan hitung pemotongan PPh 23 atas jasa
6. **Tax Calendar & Deadline Manager** — Reminder jatuh tempo pelaporan dan pembayaran pajak
7. **Coretax Ready** — Siap integrasi dengan sistem Coretax DJP (API-based)
8. **Multi-Jurisdiction Tax** — Dukung GST Malaysia, VAT Filipina/Vietnam, GST Singapore
9. **Tax Audit Trail** — Laporan jejak audit untuk pemeriksaan pajak
10. **Tax Reconciliation** — Rekonsiliasi antara buku besar dan SPT sebelum lapor

**Regulasi yang Dikover:** PPN, PPh 21, PPh 23, PPh 4(2), PPN Impor  
**Integrasi:** Finance Core, Revenue Core, Purchasing, HRIS Core  
**TAM:** 900K+ PKP di Indonesia + ekspansi ASEAN

---

### MODUL B-2: Omnichannel Commerce

**Klasifikasi:** Vertical Module (Commerce)  
**Prioritas:** 🟠 Tier-2 — HIGH  
**Target Rilis:** Q4 2026

**Pain yang Diselesaikan:**
- Data penjualan di Tokopedia, Shopee, Lazada tidak masuk ERP → entry manual 2-4 jam/hari
- Stok online-offline tidak sinkron → overselling dan refund
- Tidak bisa bandingkan margin antar channel

**Fitur Lengkap:**
1. **Marketplace Connector Suite** — Integrasi production-ready: Tokopedia, Shopee, Lazada, TikTok Shop, Blibli
2. **Centralized Order Hub** — Semua order dari semua channel dalam satu inbox
3. **Real-Time Inventory Sync** — Satu update stok langsung terpush ke semua channel secara bersamaan
4. **Unified Product Catalog** — Kelola listing produk di semua platform dari satu tempat
5. **Price Management** — Set harga per channel atau global price push ke semua platform
6. **Omnichannel Fulfillment** — Pilih gudang untuk pemenuhan order berdasarkan lokasi terdekat
7. **Return & Refund Hub** — Semua return dari semua channel terlacak dan diproses terpusat
8. **Channel P&L Analytics** — Perbandingan margin, sell-through, dan biaya per channel
9. **Marketplace Fee Auto-Deduction** — Biaya marketplace otomatis masuk komponen HPP
10. **Cross-Channel Customer Merge** — Customer yang sama di berbagai platform digabung jadi satu profil

**Integrasi:** Inventory Core, Revenue Core, Finance Core  
**Target Customer:** Retail online-offline, brand D2C, distributor

---

### MODUL B-3: Customer Success & Self-Service Portal

**Klasifikasi:** Vertical Module (Customer Experience)  
**Prioritas:** 🟠 Tier-2 — HIGH  
**Target Rilis:** Q1 2027

**Pain yang Diselesaikan:**
- CS overload dengan pertanyaan "kapan barang sampai?", "invoice mana?", "sudah dibayar belum?"
- Tidak ada portal mandiri untuk customer B2B yang ingin cek status sendiri
- Customer tidak loyal karena pengalaman post-sales buruk

**Fitur Lengkap:**
1. **Customer Self-Service Portal** — Login sendiri, lihat status order, invoice, dan histori pembayaran
2. **Online Payment Link** — Tombol bayar langsung dari portal dengan payment gateway
3. **B2B Order Portal** — Customer B2B bisa buat order sendiri via portal tanpa telepon sales
4. **Dispute & Claim Management** — Customer bisa raise dispute, lacak status, dan resolve online
5. **Statement of Account (SOA)** — Download SOA terupdate kapan saja
6. **Delivery Tracking** — Tracking status pengiriman real-time dari portal
7. **CSAT/NPS Survey** — Survei kepuasan otomatis post-transaksi dengan analytics
8. **Document Download Center** — Download invoice, PO confirmation, COA, dan dokumen lain sendiri
9. **Communication Log** — Semua komunikasi customer-bisnis tersimpan rapi di satu thread
10. **Customer Knowledge Base** — FAQ dan panduan self-help untuk mengurangi pertanyaan repetitif

**Integrasi:** Revenue Core, Finance Core, CRM

---

### MODUL B-4: Supply Chain Planning & Intelligence

**Klasifikasi:** Vertical Module (Operations)  
**Prioritas:** 🟠 Tier-2 — HIGH  
**Target Rilis:** Q1 2027

**Pain yang Diselesaikan:**
- Buyer tidak tahu kapan harus reorder → stockout atau overstock berulang
- Demand forecasting manual tidak akurat
- Lead time supplier tidak diperhitungkan dalam planning

**Fitur Lengkap:**
1. **Demand Forecasting Engine** — Prediksi demand berdasarkan moving average, trend, dan seasonal factor
2. **Reorder Point Automation** — Hitung ROP otomatis berdasarkan demand forecast + safety stock + lead time
3. **Auto Purchase Suggestion** — Generate usulan PO otomatis saat stok mendekati ROP
4. **Master Production Schedule (MPS)** — Jadwal produksi berbasis demand untuk manufacturer
5. **Material Requirements Planning (MRP)** — Kalkulasi kebutuhan bahan berdasarkan MPS + BoM
6. **Supplier Lead Time Database** — Track dan update lead time aktual per supplier per item
7. **Supply Chain Risk Dashboard** — Identifikasi supplier tunggal (single-source risk), volatilitas stok
8. **What-If Scenario Planning** — Simulasi: "jika demand naik 30%, kapan stok habis?"
9. **ABC Analysis Automation** — Klasifikasi item A/B/C berdasarkan nilai dan volume otomatis
10. **Slow-Moving & Dead Stock Alert** — Deteksi item yang tidak bergerak dan rekomendasi tindakan

**Integrasi:** Inventory Core, Purchasing, Manufacturing Vertical

---

### MODUL B-5: Field Service Management

**Klasifikasi:** Vertical Module (Operations)  
**Prioritas:** 🟡 Tier-3 — MEDIUM  
**Target Rilis:** Q2 2027

**Pain yang Diselesaikan:**
- Dispatching teknisi/tenaga lapangan masih via telepon dan WA → tidak terlacak
- Laporan pekerjaan lapangan tidak konsisten → sulit invoice
- Spare part yang dipakai di lapangan tidak masuk sistem stok

**Fitur Lengkap:**
1. **Work Order Dispatching** — Assign teknisi ke job dari dashboard dengan drag-and-drop
2. **Mobile Field App** — Teknisi terima notifikasi, navigasi ke lokasi, dan laporan dari HP
3. **GPS Route Optimization** — Rute optimal untuk teknisi dengan multiple job per hari
4. **Digital Field Form** — Checklist, foto, catatan teknis, dan tanda tangan customer dari mobile
5. **Spare Part Consumption** — Scan part yang dipakai di lapangan → deduct stok otomatis
6. **SLA Tracking** — Monitor response time dan resolution time vs target SLA
7. **Customer Digital Sign-Off** — Konfirmasi pekerjaan selesai dengan tanda tangan digital customer
8. **Field Team Performance Dashboard** — Produktivitas, utilisasi, dan skor kepuasan per teknisi
9. **Preventive Maintenance Schedule** — Jadwal kunjungan rutin otomatis berdasarkan kontrak
10. **Field Invoice Generation** — Generate invoice langsung setelah pekerjaan selesai di lapangan

**Integrasi:** Service Operations Vertical, Inventory Core, HRIS Core

---

### MODUL B-6: ESG & Sustainability Reporting

**Klasifikasi:** Vertical Module (Governance & Compliance)  
**Prioritas:** 🟡 Tier-3 — MEDIUM (Tren Global Naik Cepat)  
**Target Rilis:** Q2 2027

**Pain yang Diselesaikan:**
- Perusahaan gagal tender atau gagal dapat investor karena tidak ada laporan ESG
- Tidak ada tracking emisi karbon dari operasional bisnis
- Tidak bisa membuktikan praktik bisnis berkelanjutan ke mitra asing

**Fitur Lengkap:**
1. **Carbon Emission Tracking** — Scope 1 (langsung), Scope 2 (energi), Scope 3 (rantai pasok) per operasional
2. **Energy Consumption Monitoring** — Konsumsi listrik, bahan bakar, dan air per lokasi dan divisi
3. **Waste Management Log** — Catat jenis, volume, dan penanganan limbah
4. **Social Impact Metrics** — Ketenagakerjaan, kesetaraan gender, K3, upah layak, pengembangan SDM
5. **Supplier ESG Scoring** — Evaluasi supplier berdasarkan kriteria ESG (lingkungan, sosial, tata kelola)
6. **ESG Report Builder** — Generate laporan sesuai standar GRI, SASB, TCFD, OJK (Indonesia)
7. **ESG Target Setting & Tracking** — Tetapkan target net-zero atau reduction target dan pantau progress
8. **ESG Dashboard Eksekutif** — Ringkasan ESG untuk direksi dan investor dalam satu tampilan
9. **ESG Benchmark** — Bandingkan performa ESG dengan rata-rata industri
10. **Regulatory Compliance Checker** — Verifikasi kepatuhan terhadap regulasi ESG yang berlaku

**Integrasi:** Finance Core, HRIS Core, Purchasing, Fleet & Rental  
**Target Customer:** Perusahaan IPO-ready, partner MNC, eksportir ke Eropa/Jepang

---

### MODUL B-7: Reseller & Distributor Management

**Klasifikasi:** Vertical Module (Commerce)  
**Prioritas:** 🟠 Tier-2 — HIGH  
**Target Rilis:** Q1 2027

**Pain yang Diselesaikan:**
- Principal tidak bisa monitor kinerja distributor/reseller secara real-time
- Territory management manual → konflik wilayah penjualan
- Pricing policy per tier distributor tidak terkontrol

**Fitur Lengkap:**
1. **Distributor/Reseller Registry** — Database semua mitra distribusi dengan tier, wilayah, dan kontrak
2. **Territory Management** — Assign dan proteksi wilayah penjualan per reseller/distributor
3. **Tiered Pricing Engine** — Harga berbeda per tier (platinum, gold, silver) terintegrasi di SO
4. **Target & Quota Management** — Set target penjualan per mitra dan track pencapaian real-time
5. **Sell-Through Analytics** — Lihat penjualan dari distributor ke end-user (secondary sales)
6. **Channel Incentive Program** — Skema insentif khusus untuk mitra distribusi
7. **Reseller Order Portal** — Mitra bisa buat PO ke principal via portal online
8. **Credit Limit per Distributor** — Kontrol batas kredit dan blokir order jika melebihi limit
9. **Distributor Statement** — SOA, aging, dan invoice history per distributor
10. **Channel Conflict Alert** — Deteksi potensi konflik saluran distribusi (overlap wilayah)

**Integrasi:** Revenue Core, Finance Core, Inventory Core

---

### MODUL B-8: Healthcare & Clinic Management

**Klasifikasi:** Vertical Module (Healthcare)  
**Prioritas:** 🟡 Tier-3 — MEDIUM  
**Target Rilis:** Q3 2027

**Pain yang Diselesaikan:**
- Klinik dan fasilitas kesehatan tidak punya sistem terintegrasi yang terjangkau
- Pencatatan pasien masih manual atau sistem terpisah dari keuangan
- BPJS billing manual dan sering error

**Fitur Lengkap:**
1. **Patient Registry & EMR** — Rekam medis elektronik pasien (Electronic Medical Record)
2. **Appointment & Queue Management** — Penjadwalan, antrean, dan notifikasi pasien
3. **BPJS Integration** — Klaim BPJS semi-otomatis sesuai format P-Care dan Vedika
4. **Pharmacy & Drug Inventory** — Manajemen stok obat dengan expired date tracking
5. **Lab & Diagnostic Results** — Upload dan kelola hasil lab terintegrasi rekam medis
6. **Clinical Billing** — Invoice pasien terintegrasi kasir dan sistem keuangan
7. **Doctor & Staff Scheduling** — Jadwal dokter dan shift staf klinik
8. **Patient Communication** — Reminder jadwal kontrol via WhatsApp/SMS
9. **Multi-Unit Clinic Management** — Kelola jaringan klinik dari satu dashboard
10. **Health Analytics** — Statistik kunjungan, penyakit, dan pendapatan per dokter/poli

**Integrasi:** Finance Core, HRIS Core, Inventory Core

---

## BAGIAN 4: ADD-ON BARU — REKOMENDASI LENGKAP

### ════════════════════════════
### KATEGORI: GROWTH ADD-ONS
### ════════════════════════════

---

### ADD-ON G-1: Payment Gateway Integration

**Prioritas:** 🔴 Tier-1 — KRITIS (Quick Win)  
**Target Rilis:** Q3 2026 (Pertama dikerjakan)

**Pain:** Customer bisa terima invoice tapi tidak ada cara bayar digital yang mudah → payment terlambat.

**Fitur:**
- **Payment Link per Invoice** — Setiap invoice punya tombol "Bayar Sekarang" yang bisa diklik customer
- **Multi-Gateway Support** — Midtrans, Xendit, Doku — pilih sesuai kebutuhan
- **Virtual Account per Transaksi** — Customer bayar ke VA unik → system auto-match
- **QRIS Payment** — Scan QR untuk bayar langsung di POS atau invoice
- **Auto-Reconcile** — Payment masuk langsung tutup invoice tanpa input manual
- **Installment Tracking** — Catat cicilan dan track outstanding per angsuran
- **Payment Success Webhook** — Invoice tutup otomatis saat payment dikonfirmasi gateway
- **Payment Analytics** — Waktu rata-rata pembayaran, konversi payment link, metode favorit

**Dependencies:** Revenue Core, Finance Core  
**Estimated ARR Impact:** Percepat collection cycle rata-rata 7-14 hari → direct revenue impact

---

### ADD-ON G-2: WhatsApp Business Automation

**Prioritas:** 🔴 Tier-1 — KRITIS (SEA-specific)  
**Target Rilis:** Q3 2026

**Pain:** 90%+ komunikasi bisnis di Asia Tenggara via WhatsApp, tapi ERP tidak terintegrasi.

**Fitur:**
- **Auto Invoice & Quotation via WA** — Kirim invoice/quotation langsung via WhatsApp tanpa keluar sistem
- **Payment Reminder WA** — Reminder H-3, H-1, H+1, H+7 otomatis via WA
- **Order Confirmation WA** — Notifikasi konfirmasi order ke customer setelah SO dibuat
- **Delivery Status WA** — Update status pengiriman otomatis ke customer via WA
- **WA Order Bot** — Customer order via WA → masuk ke sistem sebagai SO (AI-powered)
- **Collection Bot** — Bot dunning yang bisa balas pertanyaan basic customer soal invoice
- **Two-Way Message Log** — Semua pesan WA tersimpan di profil customer di CRM
- **Broadcast Campaign** — Kirim pesan promosi atau pengumuman ke segmen customer tertentu

**Dependencies:** Revenue Core, CRM, Finance Core  
**API:** WhatsApp Business API (Meta Official / Penyedia: Zingle, Wati, Qiscus)

---

### ADD-ON G-3: Loyalty & Rewards Program

**Prioritas:** 🟠 Tier-2  
**Target Rilis:** Q4 2026

**Pain:** Tidak ada mekanisme untuk mempertahankan customer → repeat purchase rendah → churn tinggi.

**Fitur:**
- **Points Earning Engine** — Konfigurasi aturan point: per Rp X belanja = Y point, per kategori, per produk
- **Tier Membership** — Silver/Gold/Platinum/Diamond dengan benefit berbeda per tier
- **Points Redemption** — Tukar point di POS, SO, atau customer portal
- **Birthday Reward Automation** — Hadiah/diskon otomatis di hari ulang tahun customer
- **Referral Program** — Tracking kode referral dan komisi referrer otomatis
- **Loyalty Dashboard** — Points balance, tier progress, histori redeem per customer
- **Program Analytics** — Points liability, redemption rate, program ROI, impact on LTV
- **WA Integration** — Notifikasi points balance dan poin expiry via WhatsApp

**Dependencies:** POS Add-on, Revenue Core, CRM

---

### ADD-ON G-4: AI Cashflow Advisor

**Prioritas:** 🟠 Tier-2  
**Target Rilis:** Q1 2027

**Pain:** Owner tidak tahu apakah kas cukup 30-90 hari ke depan → keputusan reaktif, bukan proaktif.

**Fitur:**
- **AI Cashflow Forecast** — Prediksi arus kas 7/14/30/60/90 hari berbasis AR/AP outstanding + pattern historis
- **Scenario Modeling** — "Bagaimana jika customer X bayar terlambat 2 minggu?"
- **Early Warning System** — Alert otomatis jika proyeksi kas mendekati batas minimum
- **Action Recommendations** — AI merekomendasikan: tagih customer X, tunda bayar vendor Y, dll.
- **Natural Language Summary** — Ringkasan arus kas dalam bahasa Indonesia yang mudah dipahami
- **Optimal Payment Timing** — Rekomendasi kapan bayar supplier untuk maksimalkan hari kas
- **Open Banking Integration** — Saldo rekening real-time dari API bank (opsional, jika bank mendukung)
- **Finance Q&A Bot** — Tanya kondisi keuangan via chat: "Berapa kas kita bulan depan?"

**Dependencies:** Finance Core, Payables & Receivables Intelligence Module, AI Backend (Google AI Studio)

---

### ADD-ON G-5: Franchise & Multi-Outlet Management

**Prioritas:** 🟠 Tier-2  
**Target Rilis:** Q1 2027

**Pain:** Franchisor tidak bisa monitor semua outlet dari satu tempat; standar operasi berbeda-beda.

**Fitur:**
- **Franchisor Command Center** — Monitor semua outlet: sales, stok, kas, dan compliance dalam satu dashboard
- **Royalty Fee Engine** — Hitung dan invoice royalty fee otomatis ke franchisee setiap periode
- **Standardized Price Push** — Push harga dan menu dari pusat ke semua outlet sekaligus
- **Outlet Performance Ranking** — Bandingkan performa outlet: revenue, margin, waste, customer score
- **Compliance Checklist** — Checklist SOP rutin per outlet dengan reminder dan escalation
- **Inter-Outlet Transfer** — Transfer stok antar outlet dengan dokumen lengkap
- **Consolidated Report** — Laporan keuangan gabungan semua outlet dalam format konsolidasi
- **Franchisee Self-Reporting** — Outlet laporkan data ke pusat via portal terstandarisasi

**Dependencies:** Multi-Entity Add-on, Revenue Core, Inventory Core, Finance Core

---

### ═════════════════════════════════════
### KATEGORI: PRODUCTIVITY ADD-ONS
### ═════════════════════════════════════

---

### ADD-ON P-1: Smart Invoice OCR & AI Data Entry

**Prioritas:** 🟠 Tier-2  
**Target Rilis:** Q4 2026

**Pain:** Input faktur pembelian dari supplier secara manual = 30-60 menit/hari, error rate tinggi.

**Fitur:**
- **PDF/Foto Upload** — Upload faktur supplier (PDF, JPG, PNG) → ekstrak data otomatis
- **AI OCR Engine** — Kenali: vendor, tanggal, nomor, line items, qty, harga, total, PPN
- **Preview & Confirm** — Review hasil OCR sebelum create Purchase Invoice (human-in-the-loop)
- **Batch Upload** — Upload 50+ faktur sekaligus untuk diproses paralel
- **Duplicate Detection** — Deteksi faktur yang sama diinput dua kali (nomor + vendor + total)
- **Vendor Auto-Match** — Cocokkan nama vendor di faktur ke master vendor di sistem
- **Line Item Matching** — Cocokkan item di faktur ke purchase order yang sudah ada
- **Learning Engine** — Sistem belajar dari koreksi user → akurasi meningkat seiring waktu

**Dependencies:** Purchasing, Finance Core, AI Backend

---

### ADD-ON P-2: AI Purchase Assistant

**Prioritas:** 🟠 Tier-2  
**Target Rilis:** Q1 2027

**Pain:** Buyer tidak tahu harga wajar, tidak ada rekomendasi supplier terbaik, tidak ada fraud detection.

**Fitur:**
- **Price Benchmarking** — Bandingkan harga PO dengan harga historis dan estimasi pasar
- **Supplier Recommendation** — Rekomendasikan supplier terbaik berdasarkan harga, lead time, dan rating
- **Anomaly Detection** — Flagging PO dengan harga di luar range normal (indikasi fraud)
- **PO Auto-Fill from Email** — Parse email penawaran supplier → auto-fill PO draft
- **Smart Reorder Suggestion** — Rekomendasikan item untuk dibeli berdasarkan pattern historis
- **Spend Analytics** — Analisis pengeluaran: by supplier, by category, by department
- **Negotiation Intelligence** — Identifikasi peluang negosiasi berdasarkan volume dan histori harga

**Dependencies:** Purchasing, Inventory Core, AI Backend

---

### ADD-ON P-3: Advanced Analytics & BI

**Prioritas:** 🟠 Tier-2  
**Target Rilis:** Q4 2026

**Pain:** Laporan standar tidak cukup untuk keputusan strategis; owner butuh drill-down dan cross-module.

**Fitur:**
- **Custom Dashboard Builder** — Drag & drop widget untuk buat dashboard personal
- **Cross-Module Analytics** — Gabung data Sales + Inventory + Finance dalam satu chart
- **Cohort Analysis** — Retensi customer berdasarkan bulan akuisisi
- **Trend & Seasonality** — Deteksi tren dan musiman dari data historis
- **Benchmark Antar Entitas** — Bandingkan performa cabang / salesperson / produk
- **Scheduled Report** — Kirim laporan PDF otomatis via email/WA setiap hari/minggu/bulan
- **Google Sheets Sync** — Export data real-time ke Google Sheets untuk analisis custom
- **Power BI Connector** — Koneksi ke Power BI untuk visualisasi enterprise

**Dependencies:** Reports Module, semua modul aktif

---

### ADD-ON P-4: Document Management System (DMS)

**Prioritas:** 🟡 Tier-3  
**Target Rilis:** Q2 2027

**Pain:** Dokumen bisnis tersebar di email, Google Drive, dan WhatsApp → sulit ditemukan saat audit.

**Fitur:**
- **Centralized Repository** — Folder terstruktur untuk semua dokumen bisnis
- **Transaction Auto-Attach** — Dokumen otomatis terlampir ke PO/SO/Invoice yang sesuai
- **Version Control** — Track versi dokumen dengan history perubahan
- **Full-Text Search** — Cari isi dokumen (bukan hanya nama file) di seluruh repository
- **Document Approval Workflow** — Dokumen perlu diapprove sebelum final
- **Expiry Tracking** — Alert untuk sertifikat, izin usaha, asuransi, dan kontrak yang akan kadaluarsa
- **Secure External Sharing** — Bagikan dokumen via link ber-expiry tanpa perlu login
- **Audit Trail** — Catat siapa yang buka, edit, atau download dokumen kapan

**Dependencies:** Cross-cutting (semua modul)

---

### ══════════════════════════════════════
### KATEGORI: GOVERNANCE ADD-ONS
### ══════════════════════════════════════

---

### ADD-ON GV-1: Approval Workflow Engine

**Prioritas:** 🔴 Tier-1 — KRITIS (Universal Pain)  
**Target Rilis:** Q3 2026

**Pain:** Proses approval PO, reimbursement, cuti, dan lain-lain via WhatsApp Group → tidak terlacak, fraud-prone.

**Fitur:**
- **Visual Workflow Builder** — Definisikan langkah approval, approver, kondisi, dan routing secara visual
- **Multi-Channel Approval** — Approve via email, WhatsApp, mobile notifikasi, atau in-app
- **Delegation of Authority** — Approver cuti → approve otomatis dialihkan ke delegate
- **Approval History & Audit Trail** — Semua keputusan tercatat: siapa, kapan, keputusan apa, komentar apa
- **SLA Escalation** — Jika tidak diapprove dalam X hari → eskalasi otomatis ke atasan
- **Conditional Routing** — Nilai > Rp 10M → butuh approval direktur; nilai < Rp 1M → cukup SPV
- **Multi-Level: Sequential & Parallel** — Approval satu per satu atau semua approver sekaligus
- **Rejection Workflow** — Alur penolakan dengan mandatory komentar dan opsi revisi

**Dependencies:** Purchasing, Sales, HRIS Core, Finance Core

---

### ADD-ON GV-2: Contract Lifecycle Management (CLM)

**Prioritas:** 🟡 Tier-3  
**Target Rilis:** Q2 2027

**Pain:** Kontrak dengan pelanggan dan supplier disimpan di folder acak → jatuh tempo tidak diingat → legal risk.

**Fitur:**
- **Contract Repository** — Repositori terpusat semua kontrak dengan metadata lengkap
- **Key Date Tracking** — Mulai, berakhir, renewal, review date — dengan reminder otomatis
- **Contract Value Tracking** — Linking nilai kontrak ke PO/SO yang dieksekusi
- **E-Signature Integration** — Tanda tangan digital via DocuSign/VIDA/PrivyID
- **Milestone Billing** — Tagih berdasarkan milestone yang tercapai dalam kontrak
- **Vendor/Customer Contract Scorecard** — Evaluasi kepatuhan mitra terhadap isi kontrak
- **Contract Template Library** — Template kontrak standar yang bisa dikustomisasi
- **Renewal Automation** — Perpanjang kontrak otomatis dengan notifikasi ke kedua pihak

**Dependencies:** Revenue Core, Purchasing, CRM

---

### ADD-ON GV-3: Vendor Self-Service Portal

**Prioritas:** 🟡 Tier-3  
**Target Rilis:** Q3 2027

**Pain:** Komunikasi dengan supplier masih via email → status PO tidak transparan → dispute sering terjadi.

**Fitur:**
- **PO Visibility** — Supplier lihat dan konfirmasi PO yang diterima
- **Invoice Submission** — Supplier upload faktur digital langsung ke sistem
- **Delivery Scheduling** — Koordinasi jadwal pengiriman antara buyer dan supplier
- **Supplier Rating & Scorecard** — Evaluasi performa supplier: harga, lead time, kualitas, ketepatan
- **RFQ Online** — Minta penawaran harga ke multiple supplier sekaligus via portal
- **Supplier Onboarding Digital** — Formulir pendaftaran supplier baru secara digital
- **Compliance Document Repository** — Supplier upload NPWP, PKP, SIUP, dan sertifikat lain

**Dependencies:** Purchasing, Finance Core

---

### ═══════════════════════════════════════
### KATEGORI: ADVANCED OPS ADD-ONS
### ═══════════════════════════════════════

---

### ADD-ON O-1: Barcode & QR Inventory Scanner

**Prioritas:** 🟠 Tier-2  
**Target Rilis:** Q4 2026

**Pain:** Penerimaan barang dan stock opname masih manual → lambat, error-prone, dan tidak real-time.

**Fitur:**
- **Mobile Barcode Scanner** — Kamera HP bisa scan barcode/QR tanpa hardware tambahan
- **QR Code Generation** — Generate QR code untuk setiap produk, lokasi, dan aset
- **Receiving via Scan** — Scan barang masuk → update stok otomatis berdasarkan PO
- **Stock Opname via Scan** — Scan stok fisik → bandingkan dengan sistem → selisih langsung terlihat
- **Serial & Batch Tracking** — Track nomor seri dan batch via barcode sepanjang lifecycle produk
- **Label Printing** — Print label barcode/QR langsung dari sistem ke printer thermal

**Dependencies:** Inventory Core, Advanced WMS

---

### ADD-ON O-2: Route & Delivery Optimization

**Prioritas:** 🟡 Tier-3  
**Target Rilis:** Q2 2027

**Pain:** Pengiriman tidak dioptimasi → biaya logistik membengkak, on-time rate rendah.

**Fitur:**
- **Daily Route Planning** — Rute pengiriman optimal per driver per hari secara otomatis
- **Vehicle Load Optimization** — Maksimalkan kapasitas angkut sebelum dispatch
- **Real-Time Driver Tracking** — GPS tracking semua armada pengiriman
- **Proof of Delivery (POD)** — Foto + tanda tangan digital dari penerima di lapangan
- **Delivery Performance Analytics** — On-time rate, cost per km, delivery per driver
- **Customer ETA Notification** — Kirim estimasi waktu tiba ke customer secara otomatis
- **Return Pickup Scheduling** — Jadwalkan pickup barang retur dari customer

**Dependencies:** Sales, Inventory Core, Fleet & Rental (opsional)

---

### ADD-ON O-3: Predictive Maintenance (IoT-Ready)

**Prioritas:** 🟡 Tier-3 (Future-Ready)  
**Target Rilis:** Q3 2027

**Pain:** Perusahaan dengan armada/mesin tidak tahu kapan akan breakdown → maintenance reaktif = biaya lebih tinggi.

**Fitur:**
- **Maintenance Schedule Automation** — Jadwal service berdasarkan jam operasional / kilometer / kalender
- **Breakdown Pattern Analysis** — AI deteksi pola kerusakan dari histori dan rekomendasikan pencegahan
- **IoT Sensor Integration (Future)** — Siap terima data dari sensor suhu, getaran, rpm (API-based)
- **Predictive Alert** — Notifikasi sebelum komponen diperkirakan gagal
- **Maintenance Cost per Asset** — Hitung dan track TCO (Total Cost of Ownership) per aset
- **Spare Part Inventory Integration** — Deduct part yang dipakai maintenance dari stok otomatis
- **Vendor Maintenance Scheduling** — Koordinasi jadwal dengan vendor service eksternal

**Dependencies:** Fixed Asset Management Module, Fleet Maintenance Pack

---

### ADD-ON O-4: HR Self-Service Mobile App

**Prioritas:** 🟠 Tier-2  
**Target Rilis:** Q4 2026

**Pain:** Karyawan harus datang ke kantor / HRD untuk proses cuti, reimburse, atau lihat slip gaji.

**Fitur:**
- **Mobile App (PWA)** — Progressive Web App yang bisa di-install di iOS dan Android
- **Leave Request & Approval** — Ajukan dan approve cuti dari mana saja
- **Reimbursement Submission** — Upload foto struk dan submit reimburse via mobile
- **Payslip Access** — Lihat dan download slip gaji histori kapan saja
- **GPS Attendance** — Absensi masuk/pulang dengan verifikasi lokasi GPS + foto selfie
- **Announcement & Broadcast** — HRD kirim pengumuman ke semua karyawan via app
- **Employee Directory** — Cari kontak karyawan di semua divisi dan cabang
- **Training Schedule** — Lihat jadwal pelatihan dan daftar dari mobile

**Dependencies:** HRIS Core

---

### ════════════════════════════════════════
### KATEGORI: INTEGRATION ADD-ONS
### ════════════════════════════════════════

---

### ADD-ON I-1: E-Commerce Auto-Sync (Production)

**Prioritas:** 🟠 Tier-2  
**Target Rilis:** Q4 2026 (upgrade dari beta di feat_multi)

**Pain:** Marketplace Sync di feat_multi masih beta → butuh stabilisasi dan lebih banyak channel.

**Fitur (Production-Ready):**
- **Real-Time Order Sync** — Tokopedia, Shopee, Lazada, TikTok Shop, Blibli
- **Inventory Level Push** — Satu update stok → push ke semua marketplace dalam <60 detik
- **Auto Invoice Creation** — Order masuk → invoice otomatis dibuat di sistem
- **Return & Refund Sync** — Return dari marketplace → stok balik dan adjustment otomatis
- **Marketplace Fee Auto-Deduction** — Biaya platform (8-15%) otomatis masuk COGS
- **Multi-Warehouse Fulfillment** — Pilih gudang pemenuhan per marketplace secara otomatis
- **Error Monitoring** — Dashboard status sync dengan alert jika ada kegagalan sinkronisasi

**Dependencies:** Inventory Core, Revenue Core, Finance Core

---

### ADD-ON I-2: Open Banking & Bank Statement Import

**Prioritas:** 🟠 Tier-2  
**Target Rilis:** Q1 2027

**Pain:** Rekonsiliasi bank manual memakan 3-5 hari kerja per bulan per perusahaan.

**Fitur:**
- **Bank Statement Import** — Upload CSV/MT940 statement dari 20+ bank lokal
- **Auto Transaction Matching** — Cocokkan transaksi bank ke invoice/PO/jurnal otomatis
- **Open Banking API (Future)** — Koneksi langsung ke rekening bank (sesuai regulasi OJK PBI)
- **Multi-Bank Dashboard** — Lihat saldo semua rekening di satu tampilan
- **Unmatched Transaction Queue** — Antrian transaksi yang belum cocok untuk review manual
- **Bank Fee Categorization** — Biaya admin bank dikategorikan otomatis ke akun yang benar

**Dependencies:** Finance Core, Treasury Module

---

### ADD-ON I-3: Open API & Webhook Suite (Advanced)

**Prioritas:** 🟠 Tier-2  
**Target Rilis:** Q3 2026 (upgrade dari Open API yang sudah ada)

**Pain:** Customer enterprise butuh integrasi dua arah dengan sistem internal mereka.

**Fitur (Advanced dari yang sudah ada):**
- **REST API v2** — Full CRUD API untuk semua entitas utama (Invoice, PO, Product, Employee, dll.)
- **Webhook Manager** — Configure webhook untuk semua event (invoice created, payment received, dll.)
- **API Key Management** — Multiple API key dengan scope dan rate limit berbeda
- **OAuth 2.0** — Autentikasi standar untuk integrasi third-party
- **GraphQL Endpoint** — Query fleksibel untuk BI tools dan dashboard custom
- **API Documentation Portal** — Developer portal dengan sandbox dan code examples
- **Rate Limiting & Quota** — Kontrol penggunaan API per key
- **Integration Marketplace** — Library pre-built connector: Zapier, Make (Integromat), n8n

**Dependencies:** Open API Add-on yang sudah ada (upgrade)

---

## BAGIAN 5: MATRIKS PRIORITAS & ROADMAP IMPLEMENTASI

### 5.1 Skoring Prioritas

Setiap modul/add-on dinilai berdasarkan 4 dimensi:

| Dimensi | Bobot | Deskripsi |
|---|---|---|
| **Revenue Impact** | 35% | Potensi ARPU uplift atau TAM baru |
| **Pain Severity** | 30% | Seberapa parah pain dan frekuensinya |
| **Implementation Complexity** | 20% | Estimasi waktu dan resource |
| **Strategic Moat** | 15% | Differensiasi jangka panjang |

### 5.2 Matriks Keputusan

| Item | Revenue | Pain | Complexity | Moat | SCORE | Phase |
|---|---|---|---|---|---|---|
| Payment Gateway | 9 | 9 | 2 | 6 | **8.1** | 1 |
| Approval Workflow | 8 | 9 | 3 | 7 | **7.9** | 1 |
| Tax Compliance Engine | 8 | 10 | 6 | 9 | **8.6** | 1 |
| WhatsApp Automation | 8 | 9 | 4 | 8 | **8.0** | 1 |
| Payables & Receivables Intelligence | 8 | 9 | 4 | 7 | **7.8** | 1 |
| Treasury & Multi-Currency | 9 | 8 | 7 | 8 | **8.1** | 2 |
| Budget & Cost Control | 7 | 8 | 5 | 6 | **7.2** | 2 |
| Smart Invoice OCR | 6 | 7 | 4 | 7 | **6.5** | 2 |
| Commission Management | 7 | 8 | 5 | 6 | **7.2** | 2 |
| HR Mobile App | 6 | 7 | 5 | 5 | **6.2** | 2 |
| E-Commerce Auto-Sync | 8 | 7 | 5 | 7 | **7.2** | 2 |
| Subscription Billing | 7 | 7 | 5 | 7 | **6.9** | 2 |
| AI Cashflow Advisor | 7 | 8 | 6 | 8 | **7.4** | 3 |
| Omnichannel Commerce | 8 | 7 | 7 | 7 | **7.4** | 3 |
| Supply Chain Planning | 7 | 7 | 7 | 7 | **7.0** | 3 |
| Customer Success Portal | 7 | 7 | 6 | 6 | **6.9** | 3 |
| Fixed Asset Management | 6 | 7 | 5 | 5 | **6.3** | 3 |
| Advanced Analytics & BI | 7 | 6 | 5 | 6 | **6.4** | 3 |
| Reseller & Distributor Mgmt | 7 | 6 | 6 | 7 | **6.6** | 3 |
| Field Service Management | 6 | 7 | 7 | 7 | **6.6** | 4 |
| ESG & Sustainability | 6 | 5 | 6 | 9 | **6.2** | 4 |
| Franchise Management | 6 | 6 | 6 | 7 | **6.2** | 4 |
| Healthcare Module | 6 | 7 | 9 | 8 | **6.8** | 4 |
| Contract Lifecycle Mgmt | 5 | 6 | 5 | 6 | **5.6** | 4 |
| Predictive Maintenance | 5 | 5 | 7 | 8 | **5.6** | 4 |
| Vendor Portal | 5 | 5 | 5 | 6 | **5.3** | 4 |

---

### 5.3 PHASE 1 — Q3 2026: Foundation & Quick Wins
**Goal: Selesaikan pain Tier-1 yang paling universal. Unblock revenue.**

| # | Item | Tipe | Timeline | Dev Effort |
|---|---|---|---|---|
| 1 | Payment Gateway Integration | Add-on | Jul 2026 | 3 minggu |
| 2 | Approval Workflow Engine | Add-on | Agt 2026 | 4 minggu |
| 3 | WhatsApp Business Automation | Add-on | Agt 2026 | 3 minggu |
| 4 | Tax Compliance Engine | Modul | Sep 2026 | 8 minggu |
| 5 | Payables & Receivables Intelligence | Modul | Sep 2026 | 5 minggu |
| 6 | Open API v2 & Webhook Suite | Add-on | Sep 2026 | 3 minggu |
| 7 | E-Commerce Auto-Sync (Stable) | Add-on | Sep 2026 | 4 minggu |

**Expected Outcomes Phase 1:**
- 🎯 ARPU uplift +Rp 500K-2M/bulan per tenant
- 🎯 Buka akses ke 900K+ PKP yang butuh Tax Compliance
- 🎯 Percepat payment collection cycle 7-14 hari
- 🎯 Marketplace Sync stable → akses 300K+ penjual online

---

### 5.4 PHASE 2 — Q4 2026: Growth & Vertical Depth
**Goal: Tingkatkan ARPU dari customer existing + buka vertical baru.**

| # | Item | Tipe | Timeline | Dev Effort |
|---|---|---|---|---|
| 8 | Treasury & Multi-Currency | Modul | Okt 2026 | 8 minggu |
| 9 | Budget & Cost Control | Modul | Okt 2026 | 6 minggu |
| 10 | Commission & Incentive Management | Modul | Nov 2026 | 5 minggu |
| 11 | Subscription & Recurring Billing | Modul | Nov 2026 | 6 minggu |
| 12 | Smart Invoice OCR | Add-on | Nov 2026 | 4 minggu |
| 13 | HR Self-Service Mobile App | Add-on | Des 2026 | 6 minggu |
| 14 | Advanced Analytics & BI | Add-on | Des 2026 | 5 minggu |
| 15 | Barcode & QR Inventory Scanner | Add-on | Des 2026 | 3 minggu |

**Expected Outcomes Phase 2:**
- 🎯 Buka segmen eksportir/importir (200K+ entitas) via Multi-Currency
- 🎯 Upsell Budget Control ke semua tenant 20+ karyawan (+60% eligible tenant)
- 🎯 Recurring Billing → buka pasar SaaS/membership
- 🎯 HR Mobile → drive adoption HRIS ke karyawan langsung

---

### 5.5 PHASE 3 — Q1 2027: Scale & Ecosystem
**Goal: Bangun moat ekosistem dan masuk segmen enterprise.**

| # | Item | Tipe | Timeline | Dev Effort |
|---|---|---|---|---|
| 16 | Omnichannel Commerce | Modul | Jan 2027 | 10 minggu |
| 17 | Supply Chain Planning (SCP) | Modul | Jan 2027 | 8 minggu |
| 18 | Customer Success & Portal | Modul | Feb 2027 | 7 minggu |
| 19 | Fixed Asset Management | Modul | Feb 2027 | 5 minggu |
| 20 | AI Cashflow Advisor | Add-on | Mar 2027 | 6 minggu |
| 21 | AI Purchase Assistant | Add-on | Mar 2027 | 5 minggu |
| 22 | Reseller & Distributor Management | Modul | Mar 2027 | 7 minggu |
| 23 | Loyalty & Rewards Program | Add-on | Mar 2027 | 5 minggu |
| 24 | Open Banking & Bank Statement Import | Add-on | Mar 2027 | 4 minggu |

**Expected Outcomes Phase 3:**
- 🎯 Omnichannel: masuk pasar 500K+ penjual marketplace
- 🎯 SCP: manufacturer & distributor besar → +Rp 5-20M/bulan per tenant
- 🎯 AI add-ons: differensiator vs Accurate/Jurnal
- 🎯 Customer Portal: kurangi churn 15-25%

---

### 5.6 PHASE 4 — Q2-Q3 2027: Enterprise & Global
**Goal: Positioning sebagai platform enterprise & siap ekspansi ASEAN.**

| # | Item | Tipe | Timeline | Dev Effort |
|---|---|---|---|---|
| 25 | Field Service Management | Modul | Apr 2027 | 9 minggu |
| 26 | ESG & Sustainability Reporting | Modul | Apr 2027 | 8 minggu |
| 27 | Healthcare & Clinic Management | Modul | Mei 2027 | 12 minggu |
| 28 | Franchise & Multi-Outlet Management | Add-on | Mei 2027 | 7 minggu |
| 29 | Contract Lifecycle Management | Add-on | Jun 2027 | 6 minggu |
| 30 | Document Management System | Add-on | Jun 2027 | 5 minggu |
| 31 | Route & Delivery Optimization | Add-on | Jul 2027 | 6 minggu |
| 32 | Vendor Self-Service Portal | Add-on | Jul 2027 | 5 minggu |
| 33 | Predictive Maintenance (IoT-Ready) | Add-on | Agt 2027 | 7 minggu |

**Expected Outcomes Phase 4:**
- 🎯 ESG: buka enterprise segment (5K+ perusahaan, Rp 5M+/bulan)
- 🎯 Healthcare: new vertical 50K+ klinik Indonesia
- 🎯 Franchise: F&B chain dan retail franchise market
- 🎯 Fondasi ekspansi ASEAN: Malaysia, Filipina, Vietnam

---

## BAGIAN 6: ARSITEKTUR PLATFORM FINAL (POST-ROADMAP V3)

```
╔══════════════════════════════════════════════════════════════╗
║                    NIZAM PLATFORM N3.0                       ║
║           "The Complete Business Operating System"           ║
╚══════════════════════════════════════════════════════════════╝

Platform Core (Selalu Aktif — Tidak Bisa Dinonaktifkan)
├── Auth & Multi-Tenancy
├── Organization & Branch Management
├── Roles, Permissions & Data Isolation
├── Dashboard Shell & Navigation
├── Notifications & Alerts Hub
└── Billing, Subscription & Support

═══════════════════════════════════════════
CORE PILLARS (5 Pilar — Selalu Aktif)
═══════════════════════════════════════════
Pilar 1: Finance Core
├── General Ledger & Chart of Accounts
├── Accounts Payable & Receivable
├── Bank Reconciliation
├── Period Closing & Financial Reports
├── [NEW] Treasury & Multi-Currency
├── [NEW] Budget & Cost Control
├── [NEW] Fixed Asset Management
└── [NEW] Payables & Receivables Intelligence

Pilar 2: Revenue Core
├── Sales Order & Quotation
├── Invoicing & Credit Note
├── Customer & CRM
├── [NEW] Commission & Incentive Management
└── [NEW] Subscription & Recurring Billing

Pilar 3: Purchasing + Inventory
├── Purchase Requisition & Order
├── Goods Receiving & Vendor Management
├── Inventory & Stock Management
├── Multi-Warehouse
└── [Phase 3 Extension] Supply Chain Planning

Pilar 4: HRIS Core
├── Employee Registry & Organization
├── Payroll Processing
├── Attendance & Leave Management
└── Expense Reimbursement

Pilar 5: Syirkah (Islamic Finance) ← UNIQUE DIFFERENTIATOR
├── Mudharabah (Profit-Sharing)
├── Musyarakah (Partnership)
├── Bagi Hasil Engine
└── Islamic Finance Reports

═══════════════════════════════════════════
COMPLIANCE MODULE (Wajib untuk PKP)
═══════════════════════════════════════════
└── [NEW] Tax Compliance Engine
    ├── Indonesia: PPN, PPh 21, PPh 23, e-Faktur, Coretax
    └── ASEAN: Malaysia GST, Philippines BIR, Vietnam VAT

═══════════════════════════════════════════
VERTICAL MODULES (Pilih sesuai industri)
═══════════════════════════════════════════
├── Manufacturing (existing)
├── Fleet & Rental (existing)
├── Service/Workshop (existing)
├── Project & Construction (existing)
├── Academy / LMS (existing — Strategic)
├── [NEW] Omnichannel Commerce
├── [NEW] Reseller & Distributor Management
├── [NEW] Customer Success & Portal
├── [NEW] Field Service Management
├── [NEW] ESG & Sustainability Reporting
└── [NEW] Healthcare & Clinic Management

═══════════════════════════════════════════
GROWTH ADD-ONS (Multi-selectable)
═══════════════════════════════════════════
├── POS (existing)
├── Sales Page (existing)
├── Quick Bill (existing)
├── Sales AR Cockpit (existing)
├── Package Tracking (existing)
├── [NEW] Payment Gateway Integration ← PRIORITY #1
├── [NEW] WhatsApp Business Automation ← PRIORITY #2
├── [NEW] Loyalty & Rewards Program
├── [NEW] Franchise & Multi-Outlet Management
└── [NEW] AI Cashflow Advisor

═══════════════════════════════════════════
PRODUCTIVITY ADD-ONS
═══════════════════════════════════════════
├── [NEW] Smart Invoice OCR
├── [NEW] AI Purchase Assistant
├── [NEW] Advanced Analytics & BI
└── [NEW] HR Self-Service Mobile App

═══════════════════════════════════════════
GOVERNANCE ADD-ONS
═══════════════════════════════════════════
├── [NEW] Approval Workflow Engine ← PRIORITY #3
├── [NEW] Contract Lifecycle Management
└── [NEW] Document Management System

═══════════════════════════════════════════
ADVANCED OPS ADD-ONS
═══════════════════════════════════════════
├── Advanced WMS (existing)
├── Fleet Maintenance Pack (existing)
├── [NEW] Barcode & QR Inventory Scanner
├── [NEW] Route & Delivery Optimization
└── [NEW] Predictive Maintenance (IoT-Ready)

═══════════════════════════════════════════
INTEGRATION & CAPACITY ADD-ONS
═══════════════════════════════════════════
├── Open API (existing) → [UPGRADE] Open API v2 + Webhooks
├── Multi-Entity (existing)
├── Seat Pack (existing)
├── [NEW] E-Commerce Auto-Sync (Production)
├── [NEW] Open Banking & Bank Statement Import
└── [NEW] Vendor Self-Service Portal
```

---

## BAGIAN 7: SEGMENTASI & PAKET CUSTOMER

### 7.1 NIZAM Starter — UKM Kecil (< Rp 5M/bulan revenue)

**Target:** Warung, toko retail kecil, jasa freelance, F&B single outlet

| Komponen | Detail |
|---|---|
| Core | Revenue Core + Inventory Core + Finance Core (basic) |
| Add-ons Bundled | POS, Quick Bill, Payment Gateway |
| Add-ons Optional | WhatsApp Automation, Loyalty Program |
| Price Range | Rp 299K – 599K/bulan |
| Value Prop | "Dari buku kas ke ERP dalam 1 hari" |

---

### 7.2 NIZAM Business — UKM Berkembang (Rp 5M–500M/bulan)

**Target:** Distributor kecil, manufaktur skala menengah, jasa B2B, retailer multi-outlet

| Komponen | Detail |
|---|---|
| Core | 5 Pilar Lengkap |
| Vertical | 1 Vertical sesuai industri |
| Add-ons Bundled | Approval Workflow, E-Commerce Sync, Tax Compliance |
| Add-ons Optional | Budget Control, Commission, HR Mobile, WhatsApp |
| Price Range | Rp 1.5M – 5M/bulan |
| Value Prop | "Operasional terkontrol, keputusan berbasis data" |

---

### 7.3 NIZAM Enterprise — Perusahaan Menengah (> Rp 500M/bulan)

**Target:** Grup usaha, distributor nasional, manufacturer, perusahaan multi-cabang

| Komponen | Detail |
|---|---|
| Core | 5 Pilar + Tax Compliance + Treasury + Budget |
| Vertical | Multi-vertical aktif |
| Add-ons Bundled | Multi-Entity, Open API v2, Approval Workflow, Smart OCR |
| Add-ons Optional | ESG Reporting, AI Cashflow, CLM, DMS, Franchise |
| Price Range | Rp 10M – 50M/bulan |
| Value Prop | "Grup usaha dikelola dari satu platform" |

---

### 7.4 NIZAM Commerce — Retail & E-Commerce

**Target:** Brand D2C, penjual marketplace aktif, toko online-offline

| Komponen | Detail |
|---|---|
| Core | Revenue + Inventory + Finance Core |
| Vertical | Omnichannel Commerce |
| Add-ons Bundled | E-Commerce Auto-Sync, POS, Payment Gateway, Loyalty |
| Add-ons Optional | WhatsApp Automation, Subscription Billing |
| Price Range | Rp 999K – 3M/bulan |
| Value Prop | "Semua channel dalam satu sistem" |

---

### 7.5 NIZAM Islamic — Bisnis Syariah

**Target:** BMT, koperasi syariah, lembaga zakat, usaha berbasis syirkah

| Komponen | Detail |
|---|---|
| Core | 5 Pilar + Syirkah (core) |
| Add-ons Optional | Subscription, Payment Gateway, Tax Compliance |
| Differentiator | Satu-satunya ERP dengan Syirkah sebagai core native |
| Price Range | Rp 500K – 3M/bulan |
| Value Prop | "ERP yang halal, dari struktur hingga laporan" |

---

## BAGIAN 8: ANALISIS KOMPETITIF GLOBAL

### 8.1 Positioning Map

```
                    ENTERPRISE
                         │
        SAP │             │
      Oracle│             │        ← NIZAM Enterprise Target
            │             │
    ─────────┼─────────────┼──────── COVERAGE
   NARROW    │             │         BROAD
            │    Odoo     │
            │             │   NIZAM ●
    Accurate │             │
      Jurnal │             │
             │             │
                    SMB
```

### 8.2 Keunggulan NIZAM vs Kompetitor Utama

| Dimensi | SAP/Oracle | Odoo | Accurate/Jurnal | **NIZAM** |
|---|---|---|---|---|
| Time-to-Value | 6-24 bulan | 2-6 bulan | 1-4 minggu | **1-5 hari** |
| Total Cost (5 tahun) | Miliaran | Ratusan juta | Puluhan juta | **Puluhan juta** |
| Syirkah/Islamic Finance | ❌ | ❌ Komunitas | ❌ | ✅ **Native Core** |
| Tax Indonesia (DJP) | ❌ Custom | ❌ Partial | ✅ Basic | ✅ **Full Engine** |
| AI-Native | ❌ | ❌ | ❌ | ✅ **Built-in** |
| Academy/LMS Built-in | ❌ | ❌ | ❌ | ✅ **Strategic Module** |
| ASEAN-Ready | ⚠️ Mahal | ⚠️ | ❌ | ✅ **Roadmap Ready** |
| Self-Onboarding | ❌ | ⚠️ | ✅ | ✅ **Wizard-based** |
| WhatsApp Native | ❌ | ❌ | ❌ | ✅ **Add-on** |

### 8.3 Moat Kompetitif yang Harus Dijaga & Diperdalam

1. **🕌 Syirkah sebagai Core Pillar** — Tidak ada ERP di dunia yang punya ini sebagai native core. Ini moat yang tidak bisa ditiru mudah karena butuh pemahaman fiqh muamalah mendalam.

2. **🎓 Academy/LMS sebagai Strategic Module** — Jadikan training marketplace dan certification program. Mitra implementor yang bersertifikat NIZAM = barrier to exit.

3. **🇮🇩 Deep Local Compliance** — DJP, BI regulation, BPJS, UU Ketenagakerjaan. Knowledge ini tidak mudah direplikasi ERP global.

4. **⚡ AI-Native (OCR, Advisor, Purchase AI)** — Integrasikan AI sebelum kompetitor lokal. Ini akan jadi differensiator dalam 2-3 tahun ke depan.

5. **💬 WhatsApp-First Communication** — Di SEA, bisnis hidup di WhatsApp. Ini SEA-specific advantage yang ERP global tidak bisa match.

---

## BAGIAN 9: ESTIMASI POTENSI REVENUE

### 9.1 TAM (Total Addressable Market) Indonesia

| Segmen | Jumlah Entitas | ARPU NIZAM | TAM Bulanan |
|---|---|---|---|
| UKM Kecil (Starter) | 64 juta UKM | Rp 299K-599K | ~Rp 25-40T/bulan |
| UKM Berkembang (Business) | 800.000 | Rp 1.5M-5M | ~Rp 1.2-4T/bulan |
| Perusahaan Menengah (Enterprise) | 80.000 | Rp 10M-50M | ~Rp 800M-4T/bulan |
| PKP yang butuh Tax Compliance | 900.000 | +Rp 300K-1M | ~Rp 270M-900M/bulan |
| Penjual Marketplace (Commerce) | 500.000 aktif | Rp 999K-3M | ~Rp 500M-1.5T/bulan |

### 9.2 Proyeksi Revenue NIZAM (Conservative Scenario)

| Tahun | Tenant | ARPU | MRR | ARR |
|---|---|---|---|---|
| 2026 (akhir) | 5.000 | Rp 2M | Rp 10M | Rp 120M |
| 2027 (Q2) | 15.000 | Rp 2.5M | Rp 37.5M | Rp 450M |
| 2027 (akhir) | 30.000 | Rp 3M | Rp 90M | Rp 1.08M |
| 2028 (dengan ASEAN) | 80.000 | Rp 3.5M | Rp 280M | Rp 3.36M |

### 9.3 ARPU Uplift per Modul/Add-on Baru

| Modul / Add-on | ARPU Uplift Estimasi |
|---|---|
| Payment Gateway | +Rp 100K-300K/bulan |
| Tax Compliance Engine | +Rp 300K-1M/bulan |
| WhatsApp Automation | +Rp 200K-500K/bulan |
| Treasury & Multi-Currency | +Rp 500K-2M/bulan |
| Budget & Cost Control | +Rp 200K-800K/bulan |
| Commission Management | +Rp 200K-500K/bulan |
| Subscription Billing | +Rp 300K-800K/bulan |
| Omnichannel Commerce | +Rp 500K-2M/bulan |
| AI Cashflow Advisor | +Rp 300K-1M/bulan |
| ESG Reporting | +Rp 1M-5M/bulan |

---

## BAGIAN 10: REKOMENDASI TINDAKAN SEGERA

### 10.1 Quick Wins (Dalam 30 Hari — Bulan Juni 2026)

1. **✅ Stabilkan feat_multi → Merge ke main**
   - Fix regresi inventory, payroll JE, dan marketplace page error
   - Selesaikan onboarding wizard untuk semua 9 modul operasional

2. **🔧 Mulai Payment Gateway Integration**
   - Ini Add-on dengan ROI paling cepat → percepat collection → langsung terasa customer
   - Integrasi Midtrans + Xendit (2 provider terbesar Indonesia)

3. **📋 Selesaikan Approval Workflow Engine**
   - Pain paling universal → bisa di-upsell ke SEMUA tenant
   - Mulai dari PO approval workflow → expand ke semua entitas

4. **📱 WhatsApp Integration (MVP)**
   - Minimal: kirim invoice via WA + payment reminder
   - Ini fitur yang customer paling banyak tanya

### 10.2 Strategic Priorities (3 Bulan — Q3 2026)

1. **Tax Compliance Engine** — Ini compliance obligation, bukan optional. Semua PKP HARUS punya ini. Jika NIZAM tidak provide, mereka cari sistem lain.

2. **Payables & Receivables Intelligence** — Cash flow management adalah lifeline UKM. Ini modul yang akan membuat customer tidak bisa pergi karena terlalu valuable.

3. **E-Commerce Auto-Sync (Stable)** — Marketplace Sync ada di feat_multi tapi masih beta. Stabilkan ke production-grade untuk 5 marketplace utama.

### 10.3 Differensiator Jangka Panjang (6-18 Bulan)

1. **AI-Native Platform** — Jangan hanya add AI sebagai fitur. Integrasikan AI ke setiap workflow: AI yang detect anomali, AI yang suggest aksi, AI yang draft laporan otomatis.

2. **Partner Ecosystem** — saas_assessors table di feat_multi adalah fondasi. Bangun program sertifikasi implementor, reseller program, dan training marketplace di atas Academy/LMS.

3. **ASEAN Expansion Roadmap** — Tax Compliance Engine harus multi-jurisdiction dari hari pertama. Malaysia, Filipina, Vietnam adalah pasar natural berikutnya.

4. **Open Banking Integration** — Saat regulasi OJK API banking mature (2027), NIZAM harus sudah siap. Ini akan menjadi game-changer untuk rekonsiliasi dan cash forecasting.

---

## LAMPIRAN A: DEPENDENCY MAP

```
Payment Gateway ──────────────────→ Revenue Core, Finance Core
WhatsApp Automation ──────────────→ Revenue Core, CRM, Finance Core
Approval Workflow ────────────────→ Purchasing, Sales, HRIS, Finance Core
Tax Compliance ───────────────────→ Finance Core, Revenue Core, Purchasing, HRIS Core
Payables/Receivables Intelligence→ Finance Core, Revenue Core, Purchasing
Treasury & Multi-Currency ────────→ Finance Core, Accounting
Budget & Cost Control ────────────→ Finance Core, Purchasing
Commission Management ────────────→ Revenue Core, HRIS Core, Finance Core
Subscription Billing ─────────────→ Revenue Core, Finance Core
Fixed Asset ──────────────────────→ Finance Core, Accounting
Omnichannel Commerce ─────────────→ Inventory Core, Revenue Core, Finance Core
Supply Chain Planning ────────────→ Inventory Core, Purchasing, Manufacturing
Customer Success Portal ──────────→ Revenue Core, Finance Core, CRM
Reseller & Distributor Mgmt ──────→ Revenue Core, Finance Core, Inventory Core
Field Service Management ─────────→ Service Vertical, Inventory Core, HRIS Core
ESG Reporting ────────────────────→ Finance Core, HRIS Core, Purchasing, Fleet
Healthcare ───────────────────────→ Finance Core, HRIS Core, Inventory Core
AI Cashflow Advisor ──────────────→ Finance Core, Payables/Receivables Intelligence
AI Purchase Assistant ────────────→ Purchasing, Inventory Core, AI Backend
Smart Invoice OCR ────────────────→ Purchasing, Finance Core, AI Backend
Advanced Analytics ───────────────→ Reports Module, All Active Modules
HR Mobile App ────────────────────→ HRIS Core
Contract Lifecycle ───────────────→ Revenue Core, Purchasing, CRM
Document Management ──────────────→ All Modules (Cross-cutting)
Franchise Management ─────────────→ Multi-Entity, Revenue Core, Inventory Core, Finance Core
E-Commerce Auto-Sync ─────────────→ Inventory Core, Revenue Core, Finance Core
Open Banking ─────────────────────→ Finance Core, Treasury Module
Vendor Portal ────────────────────→ Purchasing, Finance Core
Predictive Maintenance ───────────→ Fixed Asset, Fleet Maintenance Pack
Barcode Scanner ──────────────────→ Inventory Core, Advanced WMS
Route Optimization ───────────────→ Sales, Inventory Core
Loyalty Program ──────────────────→ POS, Revenue Core, CRM
```

---

## LAMPIRAN B: DEFINISI TINGKAT KEMATANGAN MODUL

Setiap modul NIZAM harus mencapai Level 3 sebelum dianggap production-ready:

| Level | Definisi | Kriteria |
|---|---|---|
| L0 | Planned | Ada di roadmap, belum ada kode |
| L1 | Alpha | Ada kode dasar, hanya untuk internal testing |
| L2 | Beta | Customer bisa pakai, tapi dengan caveat |
| L3 | GA (Generally Available) | Stable, documented, bisa di-onboard mandiri |
| L4 | Mature | Semua edge case handled, performance optimal |
| L5 | Market Leading | Differensiator signifikan vs semua kompetitor |

**Current State:**
- Finance Core, Revenue Core, HRIS: Level 3-4
- Accounting, Sales, Purchasing: Level 3
- Manufacturing, Fleet, Service: Level 2-3
- LMS/Academy: Level 2
- Syirkah: Level 2 (butuh diperdalam ke L4)
- Marketplace Sync: Level 1-2 (perlu naik ke L3)

---

## LAMPIRAN C: TECHNICAL STANDARDS UNTUK SEMUA MODUL BARU

Semua modul dan add-on baru wajib memenuhi standar berikut sebelum rilis:

1. **Database:** Schema migration via file SQL di `supabase/migrations/`, terdokumentasi
2. **Actions:** Server actions di `modules/<domain>/actions/` dengan `{ data, error }` return pattern
3. **Types:** TypeScript types ketat, tidak ada `any` yang dibiarkan
4. **Error Handling:** Semua error disanitasi sebelum dikembalikan ke client
5. **Auth:** Semua endpoint dicek dengan `getInternalAuthSession()`
6. **Entitlement:** Setiap modul baru harus didaftarkan di module entitlement system
7. **Setup Flow:** Setiap modul baru harus punya onboarding wizard minimal 1 langkah
8. **Tests:** Minimal 3 unit test untuk business logic kritis
9. **Documentation:** README modul + JSDoc pada semua fungsi publik
10. **UI Standards:** Semua UI ikuti aturan NIZAM UI (Lucide icons, cursor-pointer, contrast 4.5:1)

---

*Dokumen ini dibuat berdasarkan analisis mendalam terhadap branch `feat_multi` (commit terbaru: install UI/UX Pro Max Skill v2.5.0, modal-based LMS, parallel analytics, marketplace sync optimization, modular setup flow, Syirkah sebagai Pilar ke-5), serta pemetaan komprehensif pain point customer global di segmen UKM dan korporasi Indonesia & ASEAN.*

*Versi ini (V3) adalah dokumen living yang akan diperbarui setiap kuartal berdasarkan feedback customer, traksi pasar, dan perkembangan teknologi.*

*Untuk implementasi: setiap modul/add-on harus melalui → Product Discovery → Architecture Review → Database Schema Design → API Contract → UI/UX Design System → Development → QA → Staged Rollout → GA Release.*

---
**Total Deliverable Roadmap V3:**
- 🔵 **8 Modul Core Extension** (A1-A6 + Tax Compliance + 1 lainnya)
- 🟢 **8 Vertical Module Baru** (B1-B8)
- 🟡 **20 Add-on Baru** (G, P, GV, O, I series)
- 📅 **4 Phase** selama **18 bulan** (Q3 2026 – Q4 2027)
- 🎯 **Target:** N3.0 — The Complete Business Operating System for ASEAN
