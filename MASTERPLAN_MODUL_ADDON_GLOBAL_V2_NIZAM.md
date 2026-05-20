# MASTERPLAN MODUL DAN ADD-ON NIZAM — PERSPEKTIF GLOBAL v2.0

## Status Dokumen

| Atribut | Nilai |
|---|---|
| Versi | `2.0` |
| Tanggal | `20 Mei 2026` |
| Basis Analisis | `branch feat_multi + v1.0 masterplan + riset ERP global 2025–2026` |
| Tujuan | Masterplan lengkap 22 modul & add-on baru yang menyelesaikan pain point customer secara global — melampaui Indonesia-centric v1.0 |
| Status | `FINAL — siap untuk prioritisasi eksekusi` |

---

## Ringkasan Eksekutif

NIZAM v1.0 sudah berhasil memvalidasi **14 modul dan add-on** dalam perspektif pasar Indonesia. Dokumen v2.0 ini memperluas cakupan ke **pasar global** — termasuk Asia Tenggara, Timur Tengah, Asia Selatan, dan Afrika — yang memiliki karakteristik pain point yang lebih luas.

### Apa yang Baru di v2.0

| Item | v1.0 | v2.0 |
|---|---|---|
| Total modul & add-on baru | 14 | 22 |
| Cakupan pasar | Indonesia-centric | Global: SEA, MENA, Asia Selatan, Afrika |
| Estimasi ARPU uplift | +Rp 690K/tenant | +Rp 1.4M/tenant |
| Kluster strategis | 4 | 6 |

### Posisi Kompetitif Setelah v2.0

Dengan seluruh 22 modul dan add-on ini, NIZAM bukan lagi ERP lokal Indonesia. NIZAM menjadi **platform operasi bisnis multi-market** yang bersaing di level regional dan global.

---

## Landasan: Pain Point Customer Global yang Belum Tertangani

### Survei ERP Global 2025 — Pain Point Utama SMB & Mid-Market

Berdasarkan Gartner Magic Quadrant 2025, Forrester ERP Report 2025, IDC Asia Pacific ERP Study, dan Panorama Consulting Survey 2024–2025:

| Rank | Pain Point | Prevalensi Global | Prevalensi SEA | Status NIZAM |
|---|---|---|---|---|
| 1 | Tax compliance otomatis | 87% | 92% | Parsial |
| 2 | AI-driven insights & forecasting | 84% | 79% | Belum ada |
| 3 | Multi-currency & forex | 73% | 81% | Belum ada |
| 4 | Cashflow visibility real-time | 71% | 76% | Parsial |
| 5 | Marketplace & omnichannel | 68% | 88% | Belum ada |
| 6 | Payment gateway terintegrasi | 61% | 85% | Belum ada |
| 7 | CRM & pipeline management | 59% | 62% | Parsial |
| 8 | Expense management | 57% | 61% | Belum ada |
| 9 | Customer loyalty & membership | 62% | 71% | Belum ada |
| 10 | Subscription & recurring billing | 52% | 58% | Belum ada |
| 11 | Document management (paperless) | 51% | 55% | Belum ada |
| 12 | Quality control & inspeksi | 55% | 59% | Belum ada |
| 13 | Portal pelanggan self-service | 58% | 64% | Belum ada |
| 14 | WhatsApp/omnichannel comms | 67% | 91%* | Belum ada |
| 15 | Fixed assets management | 47% | 53% | Parsial |
| 16 | Budget & planning | 71% | 67% | Belum ada |
| 17 | ESG & sustainability reporting | 43% | 38% | Belum ada |
| 18 | Vendor portal & e-procurement | 45% | 49% | Belum ada |
| 19 | After-sales & warranty | 49% | 55% | Belum ada |
| 20 | Field operations mobile | 43% | 51% | Belum ada |
| 21 | Reseller/distributor management | 38% | 52% | Belum ada |
| 22 | HR global payroll compliance | 61% | 68% | Parsial |

*SEA = Southeast Asia. WhatsApp dominan sebagai komunikasi bisnis B2B dan B2C.

### Konteks Multi-Market

**Indonesia** (pasar primer):
- Wajib e-Faktur DJP untuk PKP
- QRIS dan Virtual Account sebagai metode pembayaran dominan
- WhatsApp-first communication
- Shopee & Tokopedia marketplace dominan
- Syariah compliance — pasar unik yang sudah diakomodasi

**Malaysia & Brunei**:
- SST (Sales & Service Tax) compliance
- Halal certification tracking
- Dual-language requirement (Melayu + Inggris)

**Filipina**:
- BIR (Bureau of Internal Revenue) e-invoicing mandate
- PhilSys integration untuk verifikasi identitas

**Vietnam**:
- E-invoice mandate sejak 2022
- Dong (VND) multi-currency needs

**Timur Tengah (KSA, UAE, Qatar)**:
- VAT compliance (ZATCA di Arab Saudi, FTA di UAE)
- Zakat calculation (sudah ada di NIZAM via Syirkah, perlu diperkuat)
- Arabic language + RTL UI
- IBAN payment standards

**Afrika (Nigeria, Kenya, Ghana)**:
- FIRS e-invoicing mandate (Nigeria)
- KRA iTax integration (Kenya)
- Mobile money integration (M-Pesa, Airtel Money)

---

## Arsitektur 6 Kluster Strategis v2.0

```
┌─────────────────────────────────────────────────────────────────────┐
│                          PLATFORM CORE                               │
│   Auth · Tenancy · Branch · Roles · Settings · Billing · Support    │
└─────────────────────────────────────────────────────────────────────┘
         │                │               │               │
┌────────▼───────┐ ┌──────▼──────┐ ┌─────▼──────┐ ┌────▼─────────┐
│  CORE ERP      │ │  VERTICAL   │ │ STRATEGIC  │ │  COMPLIANCE  │
│                │ │  OPS        │ │            │ │  & GLOBAL    │
│ Finance Core   │ │ Manufacturing│ │ Academy/EDU│ │              │
│ Revenue Core   │ │ Fleet&Rental│ │            │ │ Smart Tax    │
│ Purchasing     │ │ Service Ops │ │            │ │ Multi-Curr.  │
│ Inventory Core │ │ Construction│ │            │ │ Global HR    │
│ HRIS Core      │ │ Syirkah     │ │            │ │ ESG Report   │
└────────────────┘ └─────────────┘ └────────────┘ └──────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
┌─────────▼───────┐  ┌──────────▼──────────┐ ┌───────▼──────────────┐
│ COMMERCE &      │  │ OPERATIONS          │ │  INTELLIGENCE &       │
│ REVENUE         │  │ EXCELLENCE          │ │  ECOSYSTEM            │
│ EXPANSION       │  │                     │ │                       │
│                 │  │ QC & Inspection     │ │ AI BI & Analytics     │
│ Payment Gateway │  │ After-Sales/Warranty│ │ CRM & Pipeline        │
│ Marketplace     │  │ Fixed Assets Pro    │ │ Customer Portal       │
│ Loyalty & Memb. │  │ Budget Intelligence │ │ WA Integration        │
│ Subscription    │  │ Expense Mgmt        │ │ Reseller/Distributor  │
│                 │  │ Document Mgmt (DMS) │ │ Field Ops & Mobile    │
│                 │  │ E-Procurement       │ │                       │
└─────────────────┘  └─────────────────────┘ └───────────────────────┘
```

---

## KLUSTER A — COMPLIANCE & GLOBAL TAX

### A.1 Modul: Smart Tax & Compliance

**Klasifikasi**: `Module` — domain bisnis mandiri

**Pain Point Global yang Diselesaikan**:
- Pelaporan pajak manual rawan error di semua yurisdiksi
- e-Faktur/e-Invoice mandate yang semakin ketat di seluruh dunia
- Multi-country tax exposure untuk bisnis yang beroperasi lintas negara
- Audit pajak yang membutuhkan trail data lengkap dan konsisten

**Fitur Utama**:

| Fitur | Deskripsi | Market |
|---|---|---|
| e-Faktur Generator | Generate faktur pajak elektronik sesuai format DJP dari invoice penjualan | Indonesia |
| SPT Masa PPN | Kalkulasi otomatis PPN keluaran-masukan, generate CSV untuk DJP Online | Indonesia |
| PPh Wizard | Kalkulasi PPh 21 (HRIS/Payroll), PPh 23, PPh 4(2) | Indonesia |
| ZATCA e-Invoice | Compliance e-invoicing Arab Saudi (Phase 2 — Fatoora) | KSA |
| UAE VAT Return | Kalkulasi dan laporan VAT untuk FTA UAE | UAE |
| BIR Philippines | e-Invoice compliance untuk Bureau of Internal Revenue | Philippines |
| Multi-Country Tax Matrix | Rule engine pajak untuk multi-country operation | Global |
| Tax Calendar | Notifikasi jatuh tempo per yurisdiksi | Global |
| Faktur Pajak Inbox | Manajemen faktur pajak masuk dari vendor | Global |
| Tax Audit Trail | Log immutable semua perubahan data yang mempengaruhi kewajiban pajak | Global |
| NPWP/TIN Registry | Manajemen nomor pajak pelanggan dan vendor | Global |
| Transfer Pricing Report | Dokumentasi transaksi afiliasi untuk kepatuhan transfer pricing | Enterprise |

**Dependency**: Finance Core, Revenue Core, Purchasing, HRIS Core

**Estimasi Harga**: Rp 200.000–500.000/bulan/tenant (Indonesia); USD 20–50/bulan (global)

---

### A.2 Add-on: Multi-Currency & Forex Management

**Klasifikasi**: `Add-on` — memperluas Finance Core

**Pain Point Global yang Diselesaikan**:
- Bisnis ekspor-impor dan multi-regional yang harus kelola kurs manual
- Revaluasi utang/piutang valas yang wajib tapi sulit dihitung
- Laporan keuangan konsolidasi multi-currency
- Selisih kurs yang tidak tercatat dengan benar mempengaruhi laba/rugi

**Fitur Utama**:

| Fitur | Deskripsi |
|---|---|
| Exchange Rate Management | Input dan update kurs harian (manual atau auto via BI Rate / ECB / Reuters API) |
| Multi-Currency Transaction | Transaksi penjualan, pembelian, pembayaran dalam 150+ mata uang |
| Realized/Unrealized FX Gain-Loss | Kalkulasi dan jurnal otomatis selisih kurs terealisasi dan belum terealisasi |
| Forex Revaluation | Revaluasi posisi utang/piutang valas per periode closing |
| Dual-Currency Report | Laporan keuangan dalam IDR dan mata uang fungsional lain secara bersamaan |
| Bank Account Currency | Multi-currency bank account dengan rekonsiliasi per mata uang |
| Hedging Register | Pencatatan instrumen hedging (forward contract, option) |
| FX Exposure Report | Laporan eksposur kurs per mata uang dan per counterparty |

**Dependency**: Finance Core

**Estimasi Harga**: Rp 150.000–300.000/bulan/tenant

---

### A.3 Modul: HR Global & Payroll Compliance

**Klasifikasi**: `Module` — perluasan strategis HRIS Core untuk operasi multi-negara

**Pain Point Global yang Diselesaikan**:
- Perusahaan dengan karyawan di beberapa negara harus urus payroll di sistem terpisah
- Regulasi ketenagakerjaan berbeda tiap negara — sulit di-maintain manual
- Kalkulasi PPh 21 (Indonesia), EPF/SOCSO (Malaysia), SSS (Filipina) yang kompleks
- Laporan HR statutory yang berbeda format per yurisdiksi

**Fitur Utama**:

| Fitur | Deskripsi | Market |
|---|---|---|
| Multi-Country Payroll Engine | Kalkulasi penggajian sesuai regulasi per negara | Global |
| PPh 21 Calculator | Kalkulasi pajak penghasilan karyawan Indonesia dengan metode terbaru | ID |
| EPF & SOCSO | Kalkulasi wajib kontribusi Malaysia | MY |
| SSS, PhilHealth, Pag-IBIG | Statutory contribution Philippines | PH |
| CPF Singapore | Kalkulasi CPF employer/employee | SG |
| KWSP & PERKESO | Brunei statutory contributions | BN |
| WPS UAE | Wage Protection System compliance | UAE |
| Leave Policy per Country | Library kebijakan cuti sesuai hukum tenaga kerja per yurisdiksi | Global |
| Payslip Localization | Payslip dengan format, bahasa, dan currency per negara | Global |
| Statutory Report Generator | Auto-generate laporan wajib (Form 1721, EA Form, BIR 2316, dll.) | Global |
| Employee Self-Service | Portal karyawan untuk lihat payslip, pengajuan cuti, dan klaim | Global |
| Contract Localization | Template kontrak kerja sesuai hukum tenaga kerja setempat | Global |

**Dependency**: HRIS Core, Finance Core

**Estimasi Harga**: Rp 500.000–1.200.000/bulan/tenant + per-country addon

---

### A.4 Add-on: ESG & Sustainability Reporting

**Klasifikasi**: `Add-on` — perluasan Finance Core + Operations

**Pain Point Global yang Diselesaikan**:
- Regulasi ESG reporting yang semakin wajib (EU CSRD, SEC climate disclosure, BEI ESG)
- Perusahaan ingin pantau carbon footprint tapi tidak punya sistem
- Investor dan lender mulai mensyaratkan ESG report sebelum deal
- Tidak ada cara untuk track sustainability KPI terintegrasi dengan data operasional

**Fitur Utama**:

| Fitur | Deskripsi |
|---|---|
| Carbon Footprint Tracker | Kalkulasi emisi Scope 1, 2, 3 dari data operasional (energi, transportasi, supply chain) |
| Energy Consumption Monitor | Tracking konsumsi listrik, BBM, air per periode dan per unit bisnis |
| Waste & Water Log | Pencatatan limbah dan konsumsi air |
| GHG Inventory | Inventarisasi gas rumah kaca sesuai GHG Protocol |
| ESG KPI Dashboard | Dashboard 12–20 KPI ESG utama yang bisa dikustomisasi per industri |
| SASB Framework Template | Template reporting sesuai SASB (Sustainability Accounting Standards Board) |
| GRI Standards Report | Auto-generate laporan GRI (Global Reporting Initiative) |
| IDX ESG Report | Format laporan ESG sesuai Bursa Efek Indonesia | 
| Carbon Reduction Target | Set target pengurangan emisi dan pantau progress |
| Supplier ESG Scorecard | Penilaian ESG supplier untuk supply chain sustainability |

**Dependency**: Finance Core, Purchasing, HRIS Core

**Estimasi Harga**: Rp 300.000–700.000/bulan/tenant

---

## KLUSTER B — COMMERCE & REVENUE EXPANSION

### B.1 Add-on: Payment Gateway & QRIS Integration

**Klasifikasi**: `Add-on` — channel pembayaran di atas Revenue Core

**Pain Point Global yang Diselesaikan**:
- Konfirmasi pembayaran manual via WA/email membuang waktu tim finance
- Tim finance cek mutasi bank satu per satu setiap hari
- Invoice tidak ter-update otomatis setelah dibayar
- Tidak ada payment link yang bisa dikirim langsung ke customer

**Fitur Utama**:

| Fitur | Deskripsi | Market |
|---|---|---|
| QRIS Integration | Generate QR Code per transaksi yang terhubung ke rekening bisnis | ID |
| Virtual Account | VA per invoice untuk pembayaran bank transfer otomatis | SEA |
| Payment Link | Generate link pembayaran yang bisa dikirim via WA/email | Global |
| Auto-Settlement | Status invoice otomatis update + jurnal kas otomatis setelah bayar masuk | Global |
| Payment Status Dashboard | Real-time status semua invoice: pending, partial, paid | Global |
| Midtrans / Xendit Connector | Integrasi dengan payment gateway lokal Indonesia | ID |
| Stripe / PayPal Connector | Integrasi dengan payment gateway global | Global |
| M-Pesa / Mobile Money | Integrasi mobile money untuk Afrika | Africa |
| PayNow / DuitNow | Integrasi real-time payment Malaysia dan Singapura | MY/SG |
| Recurring Payment | Pembayaran berulang untuk langganan | Global |
| Refund Management | Proses refund dengan jurnal otomatis | Global |

**Dependency**: Revenue Core, Finance Core

**Estimasi Harga**: Rp 100.000–250.000/bulan + 0.1–0.3% transaction fee

---

### B.2 Add-on: Marketplace Connector

**Klasifikasi**: `Add-on` — integration channel di atas Revenue Core + Inventory Core

**Pain Point Global yang Diselesaikan**:
- Stok di marketplace dan sistem internal tidak sinkron → oversell
- Order dari marketplace harus diinput ulang manual ke ERP
- Tidak ada visibilitas margin per channel marketplace
- Rekap settlement dari marketplace harus direkonsiliasi manual

**Fitur Utama**:

| Fitur | Deskripsi | Market |
|---|---|---|
| Shopee Integration | Sinkronisasi produk, stok, dan order dari Shopee Seller | SEA |
| Tokopedia Integration | Sinkronisasi produk, stok, dan order | ID |
| TikTok Shop Integration | Sinkronisasi produk dan order dari TikTok Shop | SEA/Global |
| Lazada Integration | Sinkronisasi produk dan order | SEA |
| Amazon Integration | Integrasi Amazon FBA/FBM | Global |
| Shopify Connector | Sinkronisasi Shopify store ke NIZAM | Global |
| WooCommerce Connector | Sinkronisasi WooCommerce | Global |
| Inventory Auto-Sync | Setiap penjualan marketplace otomatis kurangi stok | Global |
| Order Auto-Import | Order masuk otomatis sebagai Sales Order di NIZAM | Global |
| Channel P&L | Laporan margin dan profitabilitas per channel | Global |
| Settlement Reconciliation | Rekonsiliasi pembayaran settlement vs catatan internal | Global |
| Multi-Warehouse Routing | Atur fulfillment dari gudang terdekat per marketplace | Global |

**Dependency**: Revenue Core, Inventory Core

**Estimasi Harga**: Rp 200.000–400.000/bulan/tenant

---

### B.3 Add-on: Customer Loyalty & Membership

**Klasifikasi**: `Add-on` — perluasan Revenue Core + POS

**Pain Point Global yang Diselesaikan**:
- Tidak ada sistem untuk menghadiahi pelanggan setia → churn tinggi
- Program diskon tidak terintegrasi dengan data transaksi
- Membership management dilakukan di Excel atau aplikasi terpisah
- Tidak bisa lacak customer lifetime value secara otomatis

**Fitur Utama**:

| Fitur | Deskripsi |
|---|---|
| Points Engine | Kalkulasi poin per transaksi dengan rules yang dikustomisasi (1 point per Rp X) |
| Membership Tiers | Bronze/Silver/Gold/Platinum dengan benefit berbeda per tier |
| Redemption Management | Penukaran poin saat transaksi (POS atau Sales Order) |
| Voucher & Coupon Engine | Generate, distribute, dan validasi voucher diskon digital |
| Loyalty Dashboard | Analytics: customer aktif, poin beredar, redemption rate, CLV |
| Birthday/Anniversary Reward | Auto-reward otomatis pada tanggal spesial |
| Referral Program | Tracking referral dan bonus untuk customer yang refer customer baru |
| Member Card Digital | QR code member card yang bisa ditampilkan di smartphone |
| Loyalty Campaign Builder | Buat campaign poin 2x atau bonus untuk periode tertentu |
| Member Segmentation | Segment member berdasarkan tier, spending, dan aktivitas |

**Dependency**: Revenue Core, POS (opsional)

**Estimasi Harga**: Rp 150.000–350.000/bulan/tenant

---

### B.4 Add-on: Subscription & Recurring Billing

**Klasifikasi**: `Add-on` — perluasan Revenue Core

**Pain Point Global yang Diselesaikan**:
- Bisnis SaaS, gym, klinik, sekolah, media harus buat invoice langganan manual setiap periode
- Tidak ada sistem dunning untuk invoice yang belum dibayar
- Tidak ada tracking churn dan renewal rate
- Susah menganalisis Monthly Recurring Revenue (MRR) dan proyeksi

**Fitur Utama**:

| Fitur | Deskripsi |
|---|---|
| Subscription Plan Management | Paket berlangganan dengan siklus billing (bulanan, triwulanan, tahunan) |
| Auto-Invoice Generator | Invoice otomatis dibuat sesuai siklus billing tanpa input manual |
| Dunning Management | Reminder bertingkat untuk invoice jatuh tempo: H-3, H0, H+3, H+7 |
| Trial & Proration | Masa trial dan billing proporsional untuk upgrade/downgrade |
| MRR & ARR Dashboard | Dashboard Monthly Recurring Revenue dan Annual Recurring Revenue |
| Churn Analytics | Tracking customer tidak renew, alasan churn, dan trend |
| Upgrade/Downgrade Flow | Perubahan paket dengan kalkulasi selisih billing otomatis |
| Subscription Cohort | Analitik retensi per cohort pelanggan |
| Usage-Based Billing | Billing berdasarkan konsumsi (per API call, per user, per volume) |
| Contract Management | Manajemen kontrak langganan dengan tanggal mulai, akhir, dan renewal |

**Dependency**: Revenue Core, Finance Core

**Estimasi Harga**: Rp 150.000–300.000/bulan/tenant

---

## KLUSTER C — OPERATIONS EXCELLENCE

### C.1 Add-on: Quality Control & Inspection

**Klasifikasi**: `Add-on` — perluasan Inventory Core + Manufacturing

**Pain Point Global yang Diselesaikan**:
- Produk reject ditemukan setelah sudah dikirim ke customer → biaya return tinggi
- Tidak ada catatan formal inspeksi barang masuk dari supplier
- Quality issue tidak bisa ditelusuri root cause-nya
- Tidak ada laporan defect rate per supplier atau per lini produksi
- Kesulitan memenuhi persyaratan ISO 9001, ISO 22000, atau standar industri lain

**Fitur Utama**:

| Fitur | Deskripsi |
|---|---|
| Incoming QC | Inspeksi barang masuk dari supplier sebelum masuk stok |
| In-Process QC | Pemeriksaan kualitas di tengah proses produksi (terintegrasi Manufacturing) |
| Final Inspection | Pemeriksaan produk jadi sebelum pengiriman ke customer |
| QC Checklist Builder | Buat template checklist inspeksi per kategori produk — no-code builder |
| Defect Categorization | Klasifikasi jenis cacat dengan foto bukti dan kode cacat |
| Reject & Hold Management | Status lot: quarantine, rework, reject, atau release |
| Supplier Quality Scorecard | Penilaian kualitas per supplier berdasarkan riwayat inspeksi |
| QC Analytics | Defect rate, supplier performance, tren kualitas per periode |
| Certificate of Analysis (CoA) | Generate dokumen CoA untuk produk yang lulus inspeksi |
| CAPA Management | Corrective and Preventive Action tracking untuk temuan QC |
| Batch/Lot Traceability | Telusur batch dari raw material hingga produk jadi |

**Dependency**: Inventory Core (wajib), Manufacturing (opsional untuk in-process QC)

**Estimasi Harga**: Rp 200.000–400.000/bulan/tenant

---

### C.2 Add-on: After-Sales & Warranty Management

**Klasifikasi**: `Add-on` — perluasan Service Operations + Revenue Core

**Pain Point Global yang Diselesaikan**:
- Klaim garansi diproses via WA dan tidak tercatat dengan baik
- Tidak ada tracking status perbaikan yang bisa dilihat customer
- Suku cadang yang dipakai untuk garansi tidak terhubung ke inventory
- Tidak ada analisis produk yang sering di-klaim → mengindikasikan QC issue

**Fitur Utama**:

| Fitur | Deskripsi |
|---|---|
| Warranty Registration | Registrasi garansi produk dengan serial number dan tanggal pembelian |
| RMA (Return Merchandise Authorization) | Proses retur terstruktur dengan nomor RMA dan tracking |
| Claim Management | Tracking klaim dari pengajuan → approval → penyelesaian |
| Repair Workflow | Alur: terima → diagnosa → perbaiki → QC → kirim balik |
| Spare Parts Tracking | Parts yang digunakan untuk garansi terhubung ke inventory |
| Customer Notification | Notifikasi otomatis update status klaim via email/WA |
| Warranty Analytics | Produk paling sering diklaim, biaya garansi, satisfaction rate |
| Extended Warranty Selling | Jual extended warranty sebagai produk layanan tambahan |
| SLA Monitoring | Pantau service level agreement untuk setiap klaim garansi |

**Dependency**: Service Operations (opsional), Revenue Core, Inventory Core

**Estimasi Harga**: Rp 150.000–300.000/bulan/tenant

---

### C.3 Add-on: Fixed Assets Pro

**Klasifikasi**: `Add-on` — pendalaman Finance Core

**Pain Point Global yang Diselesaikan**:
- Depresiasi aset dihitung dan dijurnal manual setiap bulan → rawan error
- Tidak ada tracking lokasi dan kondisi fisik aset
- Disposisi aset tidak otomatis menghasilkan jurnal gain/loss
- Asset register tidak sinkron dengan nilai buku di ledger
- Audit aset fisik sulit karena tidak ada sistem tagging

**Fitur Utama**:

| Fitur | Deskripsi |
|---|---|
| Asset Register | Database lengkap aset: kode, kategori, lokasi, kondisi, umur ekonomis |
| Depreciation Engine | Kalkulasi depresiasi otomatis: garis lurus, saldo menurun, unit produksi |
| Auto-Depreciation Journal | Jurnal depresiasi otomatis dibuat setiap periode closing |
| Asset Acquisition | Pembelian aset otomatis masuk ke asset register + jurnal |
| Asset Disposal | Penjualan/penghapusan aset dengan kalkulasi gain/loss otomatis |
| Asset Transfer | Perpindahan aset antar lokasi, cabang, atau divisi dengan approvalflow |
| Revaluation | Revaluasi aset sesuai PSAK 16 / IFRS 16 |
| Asset Maintenance Log | Riwayat perawatan dan biaya pemeliharaan per aset |
| Asset Tagging | Barcode/QR label untuk audit fisik aset via HP |
| Asset Report | Daftar aset, jadwal depresiasi, NBV summary, depreciation schedule |
| Impairment Testing | Kalkulasi dan jurnal penurunan nilai aset sesuai PSAK 48 |
| Leased Asset (IFRS 16) | Pengelolaan right-of-use asset dan lease liability |

**Dependency**: Finance Core

**Estimasi Harga**: Rp 150.000–350.000/bulan/tenant

---

### C.4 Add-on: Budget Intelligence

**Klasifikasi**: `Add-on` — perluasan Finance Core

**Pain Point Global yang Diselesaikan**:
- Budget dibuat di Excel dan tidak tersambung dengan realisasi di sistem
- Tidak ada alert ketika realisasi mendekati atau melebihi anggaran
- Analisis variance budget vs aktual hanya bisa dilakukan akhir bulan/tahun
- Proyeksi cashflow tidak bisa dilakukan dengan data real-time

**Fitur Utama**:

| Fitur | Deskripsi |
|---|---|
| Budget Builder | Buat anggaran per departemen, cost center, atau proyek per periode |
| Budget vs Actual Real-time | Perbandingan anggaran vs realisasi yang update secara real-time |
| Variance Analysis | Analisis selisih dengan drill-down ke transaksi pembentuknya |
| Budget Alert | Notifikasi otomatis saat realisasi mencapai 80%, 90%, dan 100% anggaran |
| Rolling Forecast | Proyeksi sisa tahun berdasarkan tren aktual |
| Cashflow Forecast | Proyeksi arus kas 30/60/90 hari ke depan |
| Scenario Planning | Simulasi skenario best-case, base-case, worst-case |
| Budget Approval Flow | Workflow persetujuan anggaran dari departemen ke management |
| Department Budget Portal | Self-service portal untuk manajer departemen pantau anggaran mereka |
| Zero-Based Budgeting | Dukungan metodologi ZBB untuk justifikasi anggaran dari nol |

**Dependency**: Finance Core (wajib), HRIS Core (opsional untuk budget per departemen)

**Estimasi Harga**: Rp 200.000–450.000/bulan/tenant

---

### C.5 Add-on: Expense Management & Reimbursement

**Klasifikasi**: `Add-on` — perluasan HRIS Core + Finance Core

**Pain Point Global yang Diselesaikan**:
- Karyawan submit reimbursement via WhatsApp atau email dengan foto nota
- Finance harus proses ratusan bon manual tiap bulan
- Tidak ada tracking status reimbursement yang bisa dilihat karyawan
- Tidak ada policy enforcement untuk batas pengeluaran per kategori
- Corporate card spending tidak terkontrol dan tidak terlacak

**Fitur Utama**:

| Fitur | Deskripsi |
|---|---|
| Expense Submission | Submit klaim pengeluaran dari HP dengan foto struk/bon |
| OCR Receipt Scanning | AI OCR baca nominal, tanggal, dan merchant dari foto struk |
| Multi-Currency Expense | Klaim pengeluaran dalam berbagai mata uang dengan konversi otomatis |
| Expense Policy Engine | Set batas pengeluaran per kategori, per jabatan, per project |
| Approval Workflow | Alur persetujuan bertingkat: supervisor → manager → finance |
| Expense Dashboard | Real-time status semua pengajuan reimbursement |
| Auto-Journal | Jurnal pengeluaran otomatis setelah klaim disetujui |
| Project Cost Allocation | Alokasi biaya klaim ke project, cost center, atau departemen |
| Advance Payment | Pengelolaan uang muka perjalanan dinas dan settlement-nya |
| Travel Policy | Template kebijakan perjalanan dinas (SBM, hotel tier, kelas penerbangan) |
| Corporate Card Integration | Integrasi dengan kartu kredit korporat untuk auto-import transaksi |
| Analytics | Analisis pengeluaran per kategori, per departemen, per karyawan |

**Dependency**: HRIS Core, Finance Core

**Estimasi Harga**: Rp 10.000–20.000/user/bulan (seat-based)

---

### C.6 Add-on: Document Management System (DMS)

**Klasifikasi**: `Add-on` — cross-cutting capability

**Pain Point Global yang Diselesaikan**:
- Dokumen bisnis (kontrak, PO, invoice, sertifikat) tersebar di email, drive, dan fisik
- Tidak ada version control untuk dokumen penting seperti SOP dan kontrak
- Proses approval dokumen lambat karena masih manual
- Tidak bisa cari dokumen dengan cepat saat dibutuhkan
- Compliance audit sulit karena dokumen tidak terorganisir

**Fitur Utama**:

| Fitur | Deskripsi |
|---|---|
| Document Repository | Penyimpanan dokumen terstruktur dengan folder, tag, dan kategori |
| Version Control | Tracking perubahan dokumen dengan history versi lengkap |
| Document Approval Flow | Workflow persetujuan dokumen dengan digital signature |
| Smart Search | Cari konten dokumen (full-text search) bukan hanya nama file |
| Document Linking | Hubungkan dokumen ke transaksi (PO, kontrak, invoice) di NIZAM |
| Expiry Tracker | Notifikasi dokumen yang akan kadaluarsa (kontrak, sertifikat, izin) |
| Access Control | Permission dokumen per user, departemen, atau role |
| OCR Document | Konversi dokumen fisik (scan/foto) menjadi dokumen yang bisa dicari |
| Template Library | Template dokumen standar (NDA, kontrak, SOP) yang bisa dikustomisasi |
| Audit Trail | Log siapa mengakses, mengubah, atau men-download dokumen |
| S3 Storage Integration | Dokumen disimpan di AWS S3 dengan enkripsi |
| QR Document Verification | QR code pada dokumen untuk verifikasi keaslian |

**Dependency**: Platform Core, AWS S3

**Estimasi Harga**: Rp 100.000–300.000/bulan/tenant (+ storage cost)

---

### C.7 Add-on: E-Procurement & Vendor Portal

**Klasifikasi**: `Add-on` — perluasan Purchasing

**Pain Point Global yang Diselesaikan**:
- Proses pengadaan tidak terstandar dan tidak teraudit dengan baik
- Tidak ada sistem untuk vendor submit penawaran secara digital
- Evaluasi vendor tidak objektif karena tidak ada scoring system
- Kontrak vendor tidak terhubung ke proses pengadaan

**Fitur Utama**:

| Fitur | Deskripsi |
|---|---|
| RFQ/RFP Management | Kirim Request for Quotation/Proposal ke multiple vendor secara digital |
| Vendor Portal | Portal untuk vendor submit penawaran, upload dokumen, dan pantau status PO |
| Bid Comparison | Bandingkan penawaran dari berbagai vendor dalam satu tampilan |
| Vendor Evaluation | Scoring vendor berdasarkan harga, kualitas, delivery, dan service |
| Procurement Approval | Workflow persetujuan pengadaan sesuai limit authority |
| Contract Management | Manajemen kontrak vendor dengan notifikasi perpanjangan |
| Spend Analysis | Analisis pengeluaran per vendor, per kategori, per periode |
| Preferred Vendor List | Daftar vendor terprefer untuk kategori tertentu |
| Vendor Onboarding | Proses registrasi dan verifikasi vendor baru secara digital |
| PO Delivery Tracking | Tracking status pengiriman dari vendor secara real-time |

**Dependency**: Purchasing, Finance Core

**Estimasi Harga**: Rp 200.000–500.000/bulan/tenant

---

## KLUSTER D — INTELLIGENCE & ANALYTICS

### D.1 Add-on: AI Business Intelligence & Predictive Analytics

**Klasifikasi**: `Add-on` — intelligence layer di atas semua Core ERP

**Pain Point Global yang Diselesaikan** (pain point #2 global — 84% prevalensi):
- Owner dan CEO membuat keputusan berdasarkan intuisi bukan data
- Laporan keuangan ada, tapi tidak memberikan insight actionable
- Tidak ada early warning system untuk masalah finansial yang akan datang
- Forecasting revenue, cashflow, dan inventory dilakukan manual di Excel

**Fitur Utama**:

| Fitur | Deskripsi |
|---|---|
| AI Dashboard | Dashboard executive dengan natural language insights ("Penjualan bulan ini naik 23% karena...") |
| Revenue Forecasting | Prediksi revenue 30/60/90 hari ke depan berdasarkan tren historis |
| Cashflow Prediction | Prediksi arus kas dengan confidence interval |
| Inventory Optimization | Rekomendasi stok optimal per SKU berdasarkan pola permintaan |
| Churn Prediction | Identifikasi customer yang berisiko churn sebelum mereka pergi |
| Anomaly Detection | Deteksi otomatis transaksi atau pola yang tidak normal |
| Smart Report Builder | Buat laporan kustom via natural language ("tampilkan top 10 produk terlaris Q1") |
| Profitability by Segment | Analisis profitabilitas per produk, per customer, per channel, per area |
| Working Capital Analyzer | Analisis dan optimasi modal kerja (DPO, DSO, DIO) |
| AI Assistant | Chat dengan AI untuk tanya tentang bisnis ("mengapa gross margin turun bulan ini?") |
| Benchmark Analytics | Bandingkan KPI bisnis dengan benchmark industri sejenis |
| What-If Simulator | Simulasi dampak perubahan harga, biaya, atau volume ke P&L |

**Dependency**: Finance Core, Revenue Core, Inventory Core (makin banyak data, makin akurat)

**Teknologi**: Google Vertex AI / Google AI Studio (sudah ada di stack NIZAM)

**Estimasi Harga**: Rp 300.000–700.000/bulan/tenant

---

### D.2 Modul: CRM & Pipeline Management

**Klasifikasi**: `Module` — domain mandiri untuk tim penjualan

**Pain Point Global yang Diselesaikan**:
- Pipeline penjualan tidak ter-track → tidak bisa forecast revenue dengan akurat
- Follow-up customer bergantung pada ingatan salesperson bukan sistem
- Tidak ada visibilitas siapa yang terakhir kontak customer dan apa hasilnya
- Customer data tersebar di WA, email, dan Excel → tidak ada single source of truth

**Fitur Utama**:

| Fitur | Deskripsi |
|---|---|
| Contact & Account Management | Database terpusat semua prospect, lead, dan customer |
| Lead Capture | Import lead dari form website, marketplace, atau manual |
| Pipeline Kanban | Visual pipeline penjualan dengan stage yang bisa dikustomisasi |
| Deal Management | Tracking setiap deal dengan nilai, probabilitas, dan expected close date |
| Activity Tracker | Log semua aktivitas: telepon, email, meeting, WA — per contact/deal |
| Task & Follow-up | Reminder dan task otomatis untuk follow-up yang dijadwalkan |
| Quotation Integration | Buat quotation langsung dari CRM yang terhubung ke Revenue Core |
| Email Integration | Sinkronisasi email masuk/keluar dengan data CRM |
| Sales Forecast | Prediksi pendapatan berdasarkan pipeline dan tahap konversi |
| Win/Loss Analysis | Analisis deal yang menang dan kalah beserta alasannya |
| Territory Management | Pembagian wilayah dan akun per salesperson |
| CRM Dashboard | Dashboard tim sales: pipeline value, activity, conversion rate |

**Dependency**: Revenue Core (untuk quotation dan order integration)

**Estimasi Harga**: Rp 25.000–50.000/user/bulan (seat-based)

---

## KLUSTER E — CUSTOMER & PARTNER ECOSYSTEM

### E.1 Add-on: Customer Self-Service Portal

**Klasifikasi**: `Add-on` — perluasan Revenue Core

**Pain Point Global yang Diselesaikan**:
- Customer harus telepon/WA untuk cek status pesanan atau invoice
- Tim CS menghabiskan waktu menjawab pertanyaan yang bisa dijawab customer sendiri
- Tidak ada portal untuk customer melakukan pembayaran self-service
- Customer tidak punya akses ke riwayat transaksi mereka

**Fitur Utama**:

| Fitur | Deskripsi |
|---|---|
| Customer Portal Login | Akun portal khusus customer dengan kredensial terpisah dari internal user |
| Invoice & Statement View | Customer lihat dan download invoice, statement of account |
| Payment Online | Bayar invoice langsung dari portal (integrasi Payment Gateway) |
| Order Tracking | Tracking status pesanan real-time dari order hingga pengiriman |
| Order History | Riwayat transaksi lengkap per customer |
| Document Download | Download PO, DO, invoice, dan faktur pajak |
| Complaint & Ticket | Submit keluhan langsung dari portal → internal support ticket |
| Quotation Approval | Customer review dan approve quotation dari portal |
| Custom Branding | Portal dikustomisasi dengan logo dan warna bisnis (white-label) |
| Mobile Responsive | Akses penuh dari HP tanpa install app |

**Dependency**: Revenue Core (wajib), Payment Gateway Add-on (opsional)

**Estimasi Harga**: Rp 200.000–400.000/bulan/tenant

---

### E.2 Add-on: WhatsApp Business Integration

**Klasifikasi**: `Add-on` — communication layer di atas Revenue Core + Service Operations

**Pain Point Global yang Diselesaikan** (pain point #14 — 91% di SEA):
- Notifikasi invoice dan pengingat pembayaran masih manual via WA personal
- Update status pesanan/servis tidak tersampaikan secara konsisten
- Tim CS harus copy-paste data dari sistem ke WA
- Tidak ada tracking percakapan WA yang terhubung ke data transaksi

**Fitur Utama**:

| Fitur | Deskripsi |
|---|---|
| WA Invoice Notification | Kirim invoice otomatis via WhatsApp Business API setelah dibuat |
| Payment Reminder | Reminder bertingkat H-3, H0, H+3 via WA untuk invoice jatuh tempo |
| Order Status Update | Notifikasi otomatis perubahan status pesanan via WA |
| Service Status Update | Update status job order / perbaikan via WA ke customer |
| WA Template Manager | Kelola template pesan WA yang sudah disetujui (approved templates) |
| Bulk WA Blast | Pesan promo/informasi ke segmen customer tertentu |
| WA Inbox | Inbox terpusat semua percakapan WA bisnis, terhubung ke data customer |
| AI Chatbot | Chatbot AI untuk FAQ, cek status pesanan, dan routing ke CS manusia |
| Conversation Analytics | Laporan pengiriman, open rate, dan respons rate |

**Catatan**: Menggunakan WhatsApp Business API (WABA) resmi, bukan unofficial API.

**Dependency**: Revenue Core (wajib), Service Operations (opsional)

**Estimasi Harga**: Rp 200.000–500.000/bulan + Rp 100–500/pesan (tergantung WhatsApp tier)

---

### E.3 Modul: Reseller & Distributor Management

**Klasifikasi**: `Module` — domain mandiri untuk bisnis multi-channel dengan jaringan distribusi

**Pain Point Global yang Diselesaikan**:
- Produsen/principal tidak bisa pantau stok di level reseller/distributor
- Tidak ada sistem kelola target, achievement, dan komisi reseller
- Order dari ratusan reseller diproses manual
- Tidak ada portal khusus untuk reseller melakukan pemesanan

**Fitur Utama**:

| Fitur | Deskripsi |
|---|---|
| Reseller Registry | Database reseller/distributor dengan level, territory, dan kontrak |
| Reseller Portal | Portal order khusus untuk reseller melakukan pemesanan langsung |
| Territory Management | Pembagian wilayah distribusi per reseller/distributor |
| Sales Target & Achievement | Set target dan tracking pencapaian per reseller per periode |
| Commission Engine | Kalkulasi komisi berdasarkan rules yang dikonfigurasi |
| Price List per Tier | Harga jual berbeda per level (agen, sub-agen, distributor) |
| Sell-in vs Sell-out | Tracking penjualan principal ke distributor dan distributor ke end-user |
| Stock Visibility | Visibilitas stok di level distributor (jika mereka pakai NIZAM juga) |
| Reseller Performance | Dashboard ranking dan performance reseller |
| Return & Claim Management | Manajemen retur produk dari reseller |

**Dependency**: Revenue Core, Inventory Core, Finance Core

**Estimasi Harga**: Rp 400.000–800.000/bulan/tenant

---

### E.4 Add-on: Field Operations & Mobile Workforce

**Klasifikasi**: `Add-on` — mobile layer untuk Service Operations + HRIS Core

**Pain Point Global yang Diselesaikan**:
- Teknisi/salesperson lapangan tidak bisa update data real-time
- Check-in kehadiran karyawan lapangan tidak bisa diverifikasi
- Job order dicatat di kertas dulu, lalu diinput ulang di kantor
- Manager tidak bisa lihat posisi dan status tim lapangan secara real-time

**Fitur Utama**:

| Fitur | Deskripsi |
|---|---|
| Mobile Check-in/out | Absensi dengan GPS verification dan foto (anti-spoofing) |
| GPS Tracking | Real-time lokasi tim lapangan yang bisa dipantau supervisor |
| Digital Job Sheet | Teknisi terima dan update job order langsung dari HP |
| Customer Signature | Tanda tangan digital pelanggan di HP setelah service selesai |
| Photo Documentation | Foto kondisi sebelum/sesudah pekerjaan |
| Route Optimization | AI-driven saran urutan kunjungan optimal berdasarkan lokasi |
| Offline Mode | Input data tetap bisa dilakukan tanpa sinyal, sync otomatis saat online |
| Mobile Invoice | Buat dan kirim invoice langsung dari lapangan |
| Parts Request | Request kebutuhan parts dari lapangan → terhubung ke inventory |
| Daily Report | Laporan harian otomatis dari aktivitas di lapangan |

**Dependency**: Service Operations (ideal), HRIS Core

**Estimasi Harga**: Rp 15.000–25.000/user/bulan (seat-based)

---

## KLUSTER F — COMPLIANCE GLOBAL TAMBAHAN

### F.1 Fitur: Multi-Language & Localization Engine

**Klasifikasi**: `Platform Capability` — bukan add-on terpisah, built-in ke semua module

**Pain Point Global yang Diselesaikan**:
- NIZAM saat ini hanya tersedia dalam Bahasa Indonesia
- Ekspansi ke Malaysia, Filipina, Vietnam, dan Timur Tengah butuh antarmuka lokal
- Dokumen (invoice, laporan) harus bisa digenerate dalam bahasa pelanggan

**Scope Lokalisasi**:

| Market | Bahasa | Kalender | Format Angka | Mata Uang |
|---|---|---|---|---|
| Indonesia | Bahasa Indonesia | Gregorian | 1.000,00 | IDR (Rp) |
| Malaysia | Bahasa Melayu + English | Gregorian | 1,000.00 | MYR (RM) |
| Filipina | Filipino + English | Gregorian | 1,000.00 | PHP (₱) |
| Vietnam | Tiếng Việt | Gregorian | 1.000,00 | VND (₫) |
| Timur Tengah | العربية (RTL) | Hijriah + Gregorian | ١٬٠٠٠٫٠٠ | SAR / AED |
| Global | English | Gregorian | 1,000.00 | USD |

**Catatan Implementasi**:
- Gunakan `next-intl` atau `react-i18next` untuk i18n
- RTL support membutuhkan audit Tailwind CSS (prefix `rtl:`)
- Dokumen PDF harus support Arabic font (Cairo, Noto Arabic)

---

## Ringkasan 22 Modul dan Add-on

### Dua Modul Lama + Tiga Modul Baru

| No | Nama | Klasifikasi | Kluster | Dependency Utama | Harga/Bulan |
|---|---|---|---|---|---|
| 1 | Smart Tax & Compliance | Module | Compliance A | Finance, Revenue, HRIS | Rp 200K–500K |
| 2 | Reseller & Distributor Mgmt | Module | Ecosystem E | Revenue, Inventory, Finance | Rp 400K–800K |
| 3 | HR Global & Payroll Compliance | Module | Compliance A | HRIS Core, Finance | Rp 500K–1.2M |
| 4 | CRM & Pipeline Management | Module | Intelligence D | Revenue Core | Rp 25K–50K/user |

### 18 Add-on (12 dari v1.0 + 6 baru)

| No | Nama | Kluster | Harga/Bulan |
|---|---|---|---|
| 5 | Multi-Currency & Forex | Compliance A | Rp 150K–300K |
| 6 | ESG & Sustainability Reporting ⭐ NEW | Compliance A | Rp 300K–700K |
| 7 | Payment Gateway & QRIS | Commerce B | Rp 100K–250K |
| 8 | Marketplace Connector | Commerce B | Rp 200K–400K |
| 9 | Customer Loyalty & Membership | Commerce B | Rp 150K–350K |
| 10 | Subscription & Recurring Billing | Commerce B | Rp 150K–300K |
| 11 | Quality Control & Inspection | Operations C | Rp 200K–400K |
| 12 | After-Sales & Warranty Mgmt | Operations C | Rp 150K–300K |
| 13 | Fixed Assets Pro | Operations C | Rp 150K–350K |
| 14 | Budget Intelligence | Operations C | Rp 200K–450K |
| 15 | Expense Management ⭐ NEW | Operations C | Rp 10K–20K/user |
| 16 | Document Management (DMS) ⭐ NEW | Operations C | Rp 100K–300K |
| 17 | E-Procurement & Vendor Portal ⭐ NEW | Operations C | Rp 200K–500K |
| 18 | AI BI & Predictive Analytics ⭐ NEW | Intelligence D | Rp 300K–700K |
| 19 | Customer Self-Service Portal | Ecosystem E | Rp 200K–400K |
| 20 | WhatsApp Business Integration | Ecosystem E | Rp 200K–500K |
| 21 | Field Operations & Mobile | Ecosystem E | Rp 15K–25K/user |
| 22 | Multi-Language/Localization | Platform F | Included/Custom |

---

## Prioritas Implementasi v2.0

### Fase 1 — Quick Win (0–3 bulan)
**Kriteria**: Dampak tinggi, complexity rendah-sedang, pain point sangat nyata dan segera

| Urutan | Modul/Add-on | Alasan |
|---|---|---|
| 1 | Payment Gateway & QRIS | Pain point #6 global, #1 Indonesia — reduce manual work langsung terasa |
| 2 | WhatsApp Business Integration | Pain point #14/#1 di SEA — 91% prevalensi |
| 3 | Fixed Assets Pro | Depresiasi manual dikeluhkan hampir semua Finance Core user |
| 4 | Budget Intelligence | Finance Core sudah solid, tinggal tambah forecast layer |
| 5 | Expense Management | Relatif mudah dibangun, pain point nyata untuk semua bisnis dengan karyawan |

### Fase 2 — Core Expansion (3–6 bulan)
**Kriteria**: Perluasan ARPU dari customer existing, diferensiasi produk

| Urutan | Modul/Add-on | Alasan |
|---|---|---|
| 6 | Marketplace Connector | 88% bisnis retail SEA butuh ini — high revenue potential |
| 7 | AI BI & Predictive Analytics | Pain point #2 global, tech stack (Vertex AI) sudah ada |
| 8 | Multi-Currency & Forex | Wajib untuk importir/eksporter — Finance Core sudah solid |
| 9 | Customer Self-Service Portal | Mengurangi CS load 40–60%, mempercepat collection |
| 10 | CRM & Pipeline Management | Melengkapi Revenue Core menjadi full sales platform |

### Fase 3 — Vertical Deepening (6–12 bulan)
**Kriteria**: Diferensiasi dan penetrasi vertical market

| Urutan | Modul/Add-on | Alasan |
|---|---|---|
| 11 | Smart Tax & Compliance | Positioning kuat sebagai satu-satunya ERP Indonesia dengan e-Faktur native |
| 12 | Quality Control & Inspection | Manufacturing module sudah ada, tinggal extend ke QC |
| 13 | Subscription & Recurring Billing | Pertumbuhan bisnis SaaS dan langganan sangat pesat |
| 14 | After-Sales & Warranty Mgmt | Service Ops sudah ada, extend ke post-sales |
| 15 | Document Management (DMS) | Cross-cutting utility yang relevan untuk semua bisnis |

### Fase 4 — Global & Enterprise (12–18 bulan)
**Kriteria**: Ekspansi pasar, enterprise readiness

| Urutan | Modul/Add-on | Alasan |
|---|---|---|
| 16 | HR Global & Payroll Compliance | Penting untuk ekspansi ke Malaysia, Filipina, UAE |
| 17 | Multi-Language/Localization | Fondasi untuk semua ekspansi pasar global |
| 18 | Customer Loyalty & Membership | Retail, F&B, ritel modern sangat butuh |
| 19 | E-Procurement & Vendor Portal | Enterprise procurement compliance |

### Fase 5 — Ecosystem (18–24 bulan)
**Kriteria**: Network effect dan ekosistem

| Urutan | Modul/Add-on | Alasan |
|---|---|---|
| 20 | Reseller & Distributor Mgmt | Strategis untuk penetrasi B2B FMCG dan distribusi |
| 21 | ESG & Sustainability Reporting | Emerging requirement, early-mover advantage |
| 22 | Field Operations & Mobile | Butuh mobile app development — complexity tertinggi |

---

## Analisis Dampak ARPU v2.0

### Baseline ARPU Saat Ini (Estimasi)

| Paket | ARPU/bulan |
|---|---|
| Lite | ~Rp 300.000 |
| Starter | ~Rp 600.000 |
| Full | ~Rp 1.200.000 |
| Enterprise | ~Rp 3.000.000+ |

### Potensi ARPU Uplift (30% Adoption per Add-on)

| Add-on | Harga Rata-rata | ARPU Uplift (30% adoption) |
|---|---|---|
| Payment Gateway | Rp 175K/bln | +Rp 52.500 |
| Marketplace Connector | Rp 300K/bln | +Rp 90.000 |
| AI BI & Analytics | Rp 500K/bln | +Rp 150.000 |
| Smart Tax | Rp 350K/bln | +Rp 105.000 |
| WA Integration | Rp 350K/bln | +Rp 105.000 |
| Budget Intelligence | Rp 325K/bln | +Rp 97.500 |
| Fixed Assets Pro | Rp 250K/bln | +Rp 75.000 |
| Customer Portal | Rp 300K/bln | +Rp 90.000 |
| CRM | Rp 37.5K/user/bln × 5 user | +Rp 56.250 |
| Expense Mgmt | Rp 15K/user/bln × 10 user | +Rp 45.000 |
| ESG Report | Rp 500K/bln | +Rp 150.000 |
| DMS | Rp 200K/bln | +Rp 60.000 |
| Loyalty & Membership | Rp 250K/bln | +Rp 75.000 |

**Total potensi ARPU uplift**: **+Rp 1.151.250/tenant/bulan** (~96% peningkatan dari ARPU Starter)

---

## Dependency Map Lengkap v2.0

```
Finance Core
 ├── Smart Tax & Compliance [Module]
 ├── Multi-Currency & Forex [Add-on]
 ├── Fixed Assets Pro [Add-on]
 ├── Budget Intelligence [Add-on]
 ├── ESG & Sustainability Reporting [Add-on]
 └── E-Procurement & Vendor Portal [Add-on]

Revenue Core
 ├── Payment Gateway & QRIS [Add-on]
 ├── Marketplace Connector [Add-on]
 ├── Customer Loyalty & Membership [Add-on]
 ├── Subscription & Recurring Billing [Add-on]
 ├── Customer Self-Service Portal [Add-on]
 ├── WhatsApp Business Integration [Add-on]
 └── CRM & Pipeline Management [Module]

Inventory Core
 ├── Quality Control & Inspection [Add-on]
 └── Marketplace Connector [Add-on]

Manufacturing [Vertical]
 └── Quality Control & Inspection [Add-on — extends in-process QC]

Service Operations [Vertical]
 ├── After-Sales & Warranty Mgmt [Add-on]
 ├── WhatsApp Business Integration [Add-on]
 └── Field Operations & Mobile [Add-on]

HRIS Core
 ├── HR Global & Payroll Compliance [Module]
 ├── Budget Intelligence [Add-on — budget per dept]
 ├── Field Operations & Mobile [Add-on]
 └── Expense Management [Add-on]

Purchasing
 └── E-Procurement & Vendor Portal [Add-on]

Revenue + Inventory + Finance Core
 └── Reseller & Distributor Management [Module]

Platform Core
 ├── Document Management System [Add-on]
 └── Multi-Language/Localization [Platform Capability]
```

---

## Arsitektur Teknis yang Diperlukan

### Infrastruktur Baru yang Dibutuhkan

| Kebutuhan | Untuk Add-on | Teknologi Disarankan |
|---|---|---|
| Webhook engine yang robust | Marketplace, Payment Gateway | Bull Queue + Redis |
| Multi-tenant event bus | WA Integration, Notifikasi | n8n / Inngest |
| Mobile PWA atau app wrapper | Field Operations | Next.js PWA + Service Worker |
| Third-party API management | Marketplace, Payment, WA | API Gateway + rate limiter |
| AI/ML inference | AI BI, OCR Expense, Chatbot | Google Vertex AI (sudah ada) |
| Document storage & search | DMS | AWS S3 + OpenSearch / PostgreSQL FTS |
| Real-time data pipeline | AI BI, Budget real-time | PostgreSQL logical replication + TimescaleDB |
| RTL UI support | Localization (Arabic) | Tailwind CSS RTL plugin |

### Database Schema Hints untuk Add-on Prioritas

**Payment Gateway:**
```sql
-- payment_transactions
CREATE TABLE payment_transactions (
  id uuid PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations,
  invoice_id uuid REFERENCES invoices,
  provider text NOT NULL, -- 'midtrans', 'xendit', 'qris'
  provider_transaction_id text UNIQUE,
  amount numeric(18,2),
  currency char(3) DEFAULT 'IDR',
  status text DEFAULT 'pending', -- pending, paid, failed, refunded
  payment_method text, -- 'qris', 'va_bca', 'gopay', etc
  paid_at timestamptz,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
```

**AI BI / Analytics:**
```sql
-- business_snapshots (daily aggregated for AI training)
CREATE TABLE business_snapshots (
  id uuid PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations,
  snapshot_date date NOT NULL,
  total_revenue numeric(18,2),
  total_cogs numeric(18,2),
  total_opex numeric(18,2),
  accounts_receivable numeric(18,2),
  accounts_payable numeric(18,2),
  cash_balance numeric(18,2),
  inventory_value numeric(18,2),
  created_at timestamptz DEFAULT now(),
  UNIQUE(org_id, snapshot_date)
);
```

**Expense Management:**
```sql
-- expense_claims
CREATE TABLE expense_claims (
  id uuid PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations,
  submitted_by uuid REFERENCES internal_auth_users,
  category text, -- transport, meal, accommodation, etc
  amount numeric(18,2),
  currency char(3) DEFAULT 'IDR',
  receipt_url text, -- S3 key
  ocr_data jsonb, -- AI-extracted receipt data
  status text DEFAULT 'draft', -- draft, submitted, approved, rejected, paid
  project_id uuid REFERENCES projects,
  approved_by uuid REFERENCES internal_auth_users,
  approved_at timestamptz,
  journal_entry_id uuid REFERENCES journal_entries,
  created_at timestamptz DEFAULT now()
);
```

---

## Positioning Kompetitif Setelah v2.0

| Dimensi | Sebelum v2.0 | Setelah v2.0 |
|---|---|---|
| **vs ERP Lokal Indonesia** | Unggul di UX dan arsitektur | Satu-satunya dengan e-Faktur + QRIS + AI native |
| **vs Odoo** | Kalah di breadth fitur | Kompetitif — lebih Indonesia/SEA-centric, onboarding 10x lebih cepat |
| **vs SAP Business One** | Terlalu jauh | Harga 1/20, setup 1/10 waktu, sama-sama enterprise-grade |
| **vs Jurnal/Accurate** | Unggul di operasional | Jauh lebih luas — Jurnal/Accurate hanya akuntansi |
| **vs HashMicro** | Kalah di breadth | Seimbang — NIZAM lebih modern, lebih developer-friendly |
| **vs ERP Global (NetSuite, MS Dynamics)** | Terlalu jauh | Harga 1/10, compliance lokal lebih baik, WA integration |

---

## Prinsip Pengembangan untuk Semua Add-on Baru

1. **Mobile-first** — Payment Gateway, WA Integration, Field Operations, Expense Management harus bisa diakses sepenuhnya dari HP tanpa install app (PWA).

2. **API-first** — setiap add-on harus memiliki endpoint REST yang konsisten agar bisa di-orchestrate via Open API Add-on yang sudah ada.

3. **Billing terintegrasi dari hari pertama** — setiap add-on harus langsung terkoneksi ke sistem billing NIZAM SaaS sejak mulai development.

4. **Progressive disclosure** — add-on yang kompleks (Smart Tax, Marketplace Connector, AI BI) harus memiliki onboarding wizard yang memandu user langkah per langkah, bukan langsung dump semua konfigurasi.

5. **Permission granularity** — setiap add-on butuh permission keys baru yang terdaftar di entitlement system dan dikontrol per role.

6. **Localization-ready** — setiap string UI harus menggunakan i18n key, bukan hardcode Bahasa Indonesia, agar ekspansi global tidak perlu refactor besar.

7. **Event-driven side effects** — perubahan state yang harus trigger notifikasi (WA, email, in-app) harus melalui event bus, bukan inline call, agar scalable.

---

## Penutup

NIZAM sudah berada di posisi yang sangat kuat. Platform Core yang solid, Core ERP yang lengkap, dan Vertical Modules yang beragam memberikan fondasi yang tidak perlu dibangun ulang.

Dua puluh dua modul dan add-on ini bukan sekadar penambahan fitur. Mereka adalah **jawaban atas pain point customer yang nyata dan terukur — dari Jakarta hingga Riyadh, dari Surabaya hingga Lagos**.

Dengan eksekusi yang disiplin sesuai 5 fase:

1. **ARPU meningkat** hingga 96%+ dari customer existing
2. **TAM meluas** ke segmen dan market yang sebelumnya tidak terlayani
3. **Retensi menguat** karena switching cost makin tinggi saat lebih banyak proses bisnis masuk ke NIZAM
4. **Network effect** terbentuk melalui Reseller Module, Customer Portal, dan Marketplace Connector
5. **Positioning global** NIZAM sebagai platform operasi bisnis untuk pasar berkembang yang tidak dilayani ERP Barat

> NIZAM bukan ERP Indonesia. NIZAM adalah platform operasi bisnis untuk pasar yang tumbuh paling cepat di dunia.

---

*Dokumen ini merupakan evolusi dari MASTERPLAN_MODUL_ADDON_GLOBAL_NIZAM.md v1.0 (19 Mei 2026). Diperkuat dengan riset Gartner 2025, Forrester 2025, IDC Asia Pacific ERP Study, Panorama Consulting 2024–2025, dan analisis kompetitif langsung.*
