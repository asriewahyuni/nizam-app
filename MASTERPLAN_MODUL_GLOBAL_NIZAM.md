# MASTERPLAN MODUL & ADD-ON GLOBAL NIZAM ERP
## Solusi Pain Point Customer Skala Global

**Versi:** `2.0`  
**Tanggal:** `10 Mei 2026`  
**Branch Referensi:** `feat_multi` + analisis pasar global  
**Status:** `Dokumen Strategis — Disetujui untuk Roadmap`

---

## 1. RINGKASAN EKSEKUTIF

NIZAM ERP saat ini sudah memiliki fondasi yang kuat:
- **Platform Core**: Auth, Multi-tenant, RBAC, Branch/Entity
- **Core Families**: Accounting, Finance, Sales, Purchasing, Inventory, HRIS
- **Vertical Modules**: Manufacturing, Fleet & Rental, Service Operations, Project & Construction, Syirkah
- **Add-ons**: POS, Sales Page, Warehouse, API Integration, Multi-Entity

Namun, untuk bersaing secara global melawan SAP Business One, Odoo, NetSuite, dan Zoho Books, NIZAM perlu **10 modul tambahan dan 12 add-on baru** yang menyentuh pain point paling dalam dari customer di segmen SME–Mid-Market global.

Dokumen ini menetapkan:
1. Pain point global yang belum tertangani
2. Modul dan add-on yang menjawab pain tersebut
3. Prioritas implementasi berdasarkan impact vs kompleksitas
4. Arsitektur teknis dan integrasi ke stack NIZAM

---

## 2. PETA PAIN POINT CUSTOMER GLOBAL

### 2.1 Pain Point Tier-1: Mendesak & Berdampak Besar

| # | Pain Point | Segmen Terdampak | Kompetitor yang Sudah Menjawab |
|---|---|---|---|
| P1 | **Arus kas tidak terprediksi** — tidak tahu kapan uang habis | Semua bisnis | Float, Pulse, Xero |
| P2 | **Piutang menumpuk** — tidak ada collector workflow otomatis | Dagang, Distributor | HubSpot, Salesforce |
| P3 | **Pajak & compliance manual** — SPT disiapkan di spreadsheet | Semua | Koinly, Taxjar |
| P4 | **Tidak ada visibilitas multi-cabang** — owner tidak tahu kinerja tiap lokasi | Retail, F&B, Franchise | Netsuite, SAP |
| P5 | **Payroll salah / terlambat** — menimbulkan risiko hukum | Semua yang punya karyawan | Gadjian, Talenta |
| P6 | **Stok tidak akurat** — selisih fisik vs sistem menggerogoti margin | Manufacturing, Retail | Fishbowl, DEAR |
| P7 | **Tidak bisa jual online** — terpisah antara ERP dan e-commerce | Retail, FMCG | Shopify + QuickBooks |
| P8 | **Data tersebar** — WhatsApp, spreadsheet, dan ERP tidak sinkron | Semua | Zapier, Monday.com |

### 2.2 Pain Point Tier-2: Penting untuk Retensi & Upsell

| # | Pain Point | Segmen Terdampak |
|---|---|---|
| P9 | Tidak ada sistem approval yang terintegrasi | Perusahaan > 10 karyawan |
| P10 | Laporan tidak bisa dikustomisasi | Semua |
| P11 | Onboarding karyawan baru lama dan tidak terstruktur | Semua yang punya HR |
| P12 | Vendor tidak terkelola dengan baik | Purchasing, Procurement |
| P13 | Tidak ada jejak audit yang memadai | Regulated industries |
| P14 | Margin per produk tidak diketahui secara real-time | Retail, Distributor |
| P15 | Customer service tidak terintegrasi dengan data transaksi | Semua |
| P16 | Tidak ada tools untuk analisis data sendiri tanpa bantuan IT | Owner, Finance |

### 2.3 Pain Point Tier-3: Pembeda Kompetitif (Futuristik)

| # | Pain Point | Potensi Pasar |
|---|---|---|
| P17 | AI tidak membantu pengambilan keputusan bisnis nyata | High — belum banyak ERP yang sungguhan |
| P18 | Tidak ada fitur sustainability/ESG reporting | Berkembang — terutama untuk export |
| P19 | Tidak bisa kolaborasi dengan supplier/customer dalam satu platform | Mid-market |
| P20 | Tidak ada dukungan multi-currency dan multi-bahasa sejati | International/diaspora |

---

## 3. MODUL BARU YANG DIUSULKAN

### MODUL 1: Cash Flow Intelligence (CFI)
**Menjawab:** P1  
**Klasifikasi:** `Core Family Extension`  
**Prioritas:** 🔴 KRITIS

#### Deskripsi
Modul prediksi dan manajemen arus kas berbasis AI yang memberikan visibilitas 7–90 hari ke depan. Bukan sekadar laporan cashflow historis, melainkan proyeksi yang bisa-di-drill-down sampai level invoice.

#### Fitur Utama
- **Cash Runway Meter**: indikator berapa hari kas tersisa berdasarkan burn rate aktual
- **Cashflow Forecast 30/60/90 hari**: proyeksi berdasarkan AR aging, AP due, recurring expense
- **Scenario Planning**: simulasi "what if" — apa terjadi jika 3 piutang besar terlambat
- **Smart Alert**: notifikasi otomatis jika proyeksi kas di bawah threshold
- **Cash Pooling**: agregasi saldo multi-rekening dan multi-entitas dalam satu layar
- **Pembayaran Terjadwal**: queue pembayaran AP berdasarkan prioritas dan ketersediaan kas

#### Arsitektur Teknis
```
modules/cashflow/
├── actions/
│   ├── forecast.actions.ts      # kalkulasi proyeksi
│   ├── scenario.actions.ts      # simulasi skenario
│   └── alerts.actions.ts        # trigger notifikasi
├── lib/
│   ├── forecast-engine.ts       # algoritma proyeksi
│   └── cashflow-calculator.ts   # agregasi multi-rekening
app/(dashboard)/cashflow/
├── page.tsx
├── ForecastChart.tsx
├── ScenarioPlanner.tsx
└── CashRunwayMeter.tsx
```

#### Database
```sql
-- Tabel proyeksi cashflow
CREATE TABLE cashflow_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  forecast_date date NOT NULL,
  period_days int NOT NULL DEFAULT 30,
  inflow_projected numeric NOT NULL DEFAULT 0,
  outflow_projected numeric NOT NULL DEFAULT 0,
  ending_balance_projected numeric NOT NULL DEFAULT 0,
  confidence_score numeric, -- 0-1
  generated_at timestamptz NOT NULL DEFAULT now()
);

-- Alert threshold per org
CREATE TABLE cashflow_alert_thresholds (
  org_id uuid PRIMARY KEY REFERENCES organizations(id),
  min_runway_days int NOT NULL DEFAULT 30,
  min_balance_amount numeric NOT NULL DEFAULT 0,
  alert_channels text[] NOT NULL DEFAULT '{email}'
);
```

---

### MODUL 2: AR Collections Automation (ACA)
**Menjawab:** P2  
**Klasifikasi:** `Growth Add-on`  
**Prioritas:** 🔴 KRITIS

#### Deskripsi
Sistem otomasi penagihan piutang end-to-end. Dari aging analysis sampai eskalasi collector, semua dikelola dalam satu workflow tanpa keluar dari NIZAM.

#### Fitur Utama
- **AR Aging Dashboard**: visualisasi piutang per bucket (0–30, 31–60, 61–90, >90 hari)
- **Auto-Reminder Engine**: kirim reminder via WhatsApp/Email/SMS otomatis berdasarkan jadwal
- **Collection Workflow**: assign collector, track status (sent → acknowledged → promised → paid)
- **Promise-to-Pay Tracker**: customer bisa konfirmasi tanggal bayar, sistem track otomatis
- **Dispute Management**: workflow untuk piutang yang diklaim sudah dibayar/dipermasalahkan
- **Bad Debt Provision**: hitung cadangan kerugian piutang otomatis sesuai PSAK 71

#### Integrasi
- WhatsApp Business API (Twilio/Meta)
- Email via Mailketing yang sudah ada
- SMS Gateway

#### Database
```sql
CREATE TABLE ar_collection_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  assigned_collector_id uuid,
  reminder_count int NOT NULL DEFAULT 0,
  last_reminder_at timestamptz,
  promise_to_pay_date date,
  promise_amount numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

---

### MODUL 3: Tax Compliance Suite (TCS)
**Menjawab:** P3  
**Klasifikasi:** `Vertical Module`  
**Prioritas:** 🔴 KRITIS

#### Deskripsi
Modul kepatuhan pajak terintegrasi untuk pasar Indonesia (dan roadmap global). Mengotomasi perhitungan, penyiapan laporan, dan reconciliation pajak dari transaksi ERP.

#### Fitur Utama (Indonesia First)
- **PPN Otomatis**: kalkulasi PPN 11% / PPN BM pada setiap transaksi penjualan
- **PPh 21 Wizard**: hitung PPh 21 karyawan bulanan otomatis dari data HRIS
- **PPh 23**: identifikasi dan withholding otomatis pada pembayaran jasa
- **e-Faktur Integration**: generate file CSV untuk upload ke DJP Online
- **SPT Builder**: mapping transaksi ERP ke format SPT Masa/Tahunan
- **Tax Calendar**: reminder deadline setor dan lapor pajak
- **BUP/BUPOT Generator**: buat bukti potong otomatis
- **Koreksi Fiskal**: rekonsiliasi laba komersial vs fiskal

#### Roadmap Global
- GST (Malaysia, Singapore, Australia)
- VAT (Europe, UK)
- Sales Tax (USA — per state)
- Zakat (sudah ada, perlu integrasi lebih dalam)

#### Database
```sql
CREATE TABLE tax_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  tax_type text NOT NULL, -- 'ppn', 'pph21', 'pph23', 'gst', 'vat'
  rate numeric NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  tax_account_id uuid -- link ke CoA
);

CREATE TABLE tax_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  source_type text NOT NULL, -- 'invoice', 'payment', 'payroll'
  source_id uuid NOT NULL,
  tax_type text NOT NULL,
  tax_base numeric NOT NULL,
  tax_amount numeric NOT NULL,
  period_month int NOT NULL,
  period_year int NOT NULL,
  status text NOT NULL DEFAULT 'computed', -- computed, reported, paid
  efaktur_number text -- nomor seri faktur pajak
);
```

---

### MODUL 4: Multi-Location Intelligence (MLI)
**Menjawab:** P4  
**Klasifikasi:** `Core Family Extension`  
**Prioritas:** 🟠 TINGGI

#### Deskripsi
Dashboard eksekutif khusus untuk bisnis multi-cabang/franchise yang memberikan visibilitas komparatif antar lokasi dalam satu layar.

#### Fitur Utama
- **Branch Performance Matrix**: bandingkan revenue, margin, dan cost antar cabang
- **Benchmarking Engine**: cabang A vs rata-rata jaringan vs cabang terbaik
- **KPI per Lokasi**: set target berbeda per cabang, track aktual vs target
- **Heatmap Performa**: visualisasi geografis untuk jaringan besar
- **Transfer Antar Cabang**: internal transfer inventory/kas dengan trail akuntansi
- **Consolidated P&L**: laporan konsolidasi dengan eliminasi intercompany
- **Branch Manager Dashboard**: tampilan terbatas khusus branch manager (role-based)

---

### MODUL 5: Vendor Relationship Management (VRM)
**Menjawab:** P12  
**Klasifikasi:** `Core Family Extension (Purchasing)`  
**Prioritas:** 🟠 TINGGI

#### Deskripsi
Manajemen hubungan vendor yang komprehensif di luar sekadar Purchase Order — mencakup evaluasi, onboarding, kontrak, dan portal self-service vendor.

#### Fitur Utama
- **Vendor Scorecard**: evaluasi vendor berdasarkan ketepatan harga, kualitas, dan lead time
- **Vendor Portal**: vendor bisa submit invoice, lihat PO, dan konfirmasi pengiriman
- **Tender/RFQ Management**: buat permintaan penawaran, bandingkan dari multiple vendor
- **Kontrak Vendor**: simpan dan track kontrak, reminder renewal otomatis
- **Approved Vendor List (AVL)**: whitelist vendor per kategori barang
- **Vendor Onboarding Workflow**: KYC dokumen, legal check, approval

---

### MODUL 6: Smart Inventory Optimization (SIO)
**Menjawab:** P6  
**Klasifikasi:** `Advanced Add-on (Inventory)`  
**Prioritas:** 🟠 TINGGI

#### Deskripsi
Layer kecerdasan di atas modul Inventory untuk optimasi stok — dari prediksi kebutuhan sampai reorder otomatis.

#### Fitur Utama
- **Demand Forecasting**: prediksi kebutuhan berbasis historis penjualan + tren musiman
- **Reorder Point Calculator**: hitung titik reorder otomatis per SKU per lokasi
- **Auto Purchase Request**: buat PR otomatis ketika stok menyentuh reorder point
- **ABC-XYZ Analysis**: klasifikasi produk berdasarkan nilai dan variabilitas demand
- **Dead Stock Identifier**: flagging produk tidak bergerak > N hari
- **Stockout Predictor**: alert sebelum kehabisan stok terjadi
- **Multi-Warehouse Balancing**: rekomendasi transfer antar gudang untuk balance stok

---

### MODUL 7: Omnichannel Commerce Hub (OCH)
**Menjawab:** P7  
**Klasifikasi:** `Vertical Module`  
**Prioritas:** 🟠 TINGGI

#### Deskripsi
Hub yang menyatukan penjualan dari semua channel (POS, Sales Page, Marketplace, WhatsApp Commerce) ke dalam satu order management dan satu stock truth.

#### Fitur Utama
- **Marketplace Connector**: sinkronisasi produk dan order dari Tokopedia, Shopee, Lazada
- **WhatsApp Commerce**: terima order via WhatsApp, langsung masuk sistem
- **Order Management Center (OMC)**: semua order dari semua channel di satu tempat
- **Unified Product Catalog**: satu master produk, publish ke semua channel
- **Cross-Channel Inventory**: stok real-time dishare antar channel, tidak double-sell
- **Fulfillment Manager**: pick-pack-ship dari satu antarmuka
- **Returns & Refund Management**: workflow retur terintegrasi ke akuntansi

#### Integrasi
- Tokopedia API / Shopee Open API
- WhatsApp Business API
- JNE, JNT, SiCepat (shipping)

---

### MODUL 8: Approval & Workflow Engine (AWE)
**Menjawab:** P9  
**Klasifikasi:** `Platform Core Extension`  
**Prioritas:** 🟠 TINGGI

#### Deskripsi
Engine approval yang bisa dikonfigurasi tanpa koding untuk semua jenis transaksi dan dokumen di NIZAM.

#### Fitur Utama
- **Visual Workflow Builder**: drag-and-drop builder untuk approval flow
- **Multi-Level Approval**: tier approval berdasarkan nominal, department, atau jenis transaksi
- **Delegation**: delegasi approval saat approver cuti
- **Mobile Approval**: approve transaksi via mobile browser atau notifikasi
- **Audit Trail Approval**: rekaman lengkap siapa approve apa dan kapan
- **Conditional Rules**: approval diperlukan jika > Rp X atau jika department Y
- **SLA Approval**: eskalasi otomatis jika approval tidak direspon dalam N jam

#### Database
```sql
CREATE TABLE workflow_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  name text NOT NULL,
  document_type text NOT NULL, -- 'purchase_order', 'expense', 'payroll', etc.
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES workflow_definitions(id),
  step_order int NOT NULL,
  approver_role text, -- atau specific user
  approver_user_id uuid,
  condition_type text, -- 'always', 'amount_gt', 'department'
  condition_value jsonb,
  sla_hours int DEFAULT 24
);

CREATE TABLE approval_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL,
  document_type text NOT NULL,
  document_id uuid NOT NULL,
  current_step int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending', -- pending, approved, rejected, cancelled
  initiated_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

---

### MODUL 9: Business Intelligence & Custom Reports (BIR)
**Menjawab:** P10, P16  
**Klasifikasi:** `Strategic Add-on`  
**Prioritas:** 🟡 SEDANG

#### Deskripsi
Layer analitik self-service yang memungkinkan owner dan finance membangun laporan kustom tanpa bantuan IT.

#### Fitur Utama
- **Report Builder**: drag-and-drop builder laporan dari semua tabel bisnis
- **Pivot Table Interaktif**: pivot data langsung di browser
- **Custom Dashboard Tiles**: tambahkan metrik apapun ke dashboard personal
- **Scheduled Reports**: kirim laporan otomatis via email setiap hari/minggu/bulan
- **Data Export Fleksibel**: export ke XLSX, CSV, PDF dengan template kustom
- **KPI Builder**: definisi KPI sendiri dengan formula kustom
- **Drill-Down Navigation**: klik angka di laporan, masuk ke detail transaksi
- **Benchmark Library**: template laporan best-practice per industri

---

### MODUL 10: Customer Success Portal (CSP)
**Menjawab:** P15  
**Klasifikasi:** `Growth Add-on`  
**Prioritas:** 🟡 SEDANG

#### Deskripsi
Portal self-service untuk customer bisnis (B2B) yang memungkinkan mereka melihat status order, invoice, dan history transaksi tanpa harus menghubungi admin.

#### Fitur Utama
- **Customer Portal**: login khusus customer untuk lihat invoice, order, delivery status
- **Online Invoice Payment**: customer bayar invoice langsung via portal (payment gateway)
- **Statement of Account**: customer unduh statement akun sendiri
- **Order Tracking**: real-time tracking pengiriman
- **Complaint & Dispute**: submit keluhan, track resolusi
- **Product Catalog Access**: customer lihat katalog dan harga khusus mereka
- **Contract & Document Access**: simpan dan akses dokumen kontrak

---

## 4. ADD-ON BARU YANG DIUSULKAN

### ADD-ON 1: WhatsApp Notification Hub
**Menjawab:** P2, P8  
**Induk:** Platform Core  

Kirim notifikasi bisnis via WhatsApp otomatis: invoice ready, payment due, approval waiting, shipment dispatched, low stock alert.

**Fitur:**
- Template pesan per event bisnis
- Blast ke customer/vendor/karyawan
- Two-way: customer bisa reply konfirmasi
- Riwayat pesan terorganisir per kontak

---

### ADD-ON 2: E-Signature & Document Vault
**Menjawab:** P13  
**Induk:** Platform Core  

Tanda tangan digital dan penyimpanan dokumen legal terintegrasi.

**Fitur:**
- Tanda tangan digital di atas dokumen NIZAM (kontrak, PO, invoice)
- Sertifikat tanda tangan yang bisa diverifikasi
- Document vault terorganisir per kategori
- Expiry reminder untuk dokumen berkala

---

### ADD-ON 3: Expense Management Pro
**Menjawab:** P5 (partial), P9  
**Induk:** Finance Core  

Manajemen pengeluaran karyawan berbasis mobile-first dengan OCR struk otomatis.

**Fitur:**
- Foto struk → ekstrak nominal otomatis via AI OCR (sudah ada di NIZAM)
- Approval expense berdasarkan workflow
- Policy engine: tolak otomatis jika melebihi limit
- Reimbursement tracking sampai pembayaran
- Integrasi ke jurnal akuntansi

---

### ADD-ON 4: Subscription & Recurring Billing
**Menjawab:** P1 (predictable income)  
**Induk:** Revenue Core  

Kelola kontrak berlangganan dan billing berkala otomatis.

**Fitur:**
- Setup kontrak recurring (bulanan/tahunan)
- Auto-generate invoice sesuai jadwal
- Proration untuk upgrade/downgrade mid-period
- Dunning management untuk pembayaran gagal
- Revenue recognition sesuai PSAK

---

### ADD-ON 5: Asset & Depreciation Manager
**Menjawab:** P3 (tax), P10  
**Induk:** Finance Core  

Manajemen aset tetap dengan kalkulasi penyusutan otomatis.

**Fitur:**
- Register aset dengan data lengkap (nomor, lokasi, PIC)
- Metode penyusutan: straight-line, double-declining, SOYD
- Jurnal penyusutan otomatis bulanan
- Aset disposal workflow dengan gain/loss calculation
- Fisik vs buku reconciliation (opname aset)
- Integrasi ke laporan pajak (penyusutan fiskal)

---

### ADD-ON 6: Payroll Pro Pack
**Menjawab:** P5  
**Induk:** HRIS Core  

Extension payroll dengan fitur enterprise:

**Fitur:**
- Multi-skema kompensasi (gaji pokok, komisi, bonus, insentif)
- BPJS Ketenagakerjaan + BPJS Kesehatan auto-calculate
- PPh 21 progressive bracket otomatis
- Slip gaji digital dengan QR verification
- Payroll simulation sebelum finalisasi
- Bank disbursement file (BCA, Mandiri, BNI, BRI)
- Payroll history & correction audit trail

---

### ADD-ON 7: HR Self-Service (ESS/MSS)
**Menjawab:** P11  
**Induk:** HRIS Core  

Portal swalayan karyawan dan manajer.

**Fitur:**
- **ESS (Employee)**: lihat slip gaji, ajukan cuti, submit expense, update data
- **MSS (Manager)**: approve cuti/expense tim, lihat KPI tim, akses laporan HR
- Absensi via GPS (check-in/out dari mobile)
- Leave balance real-time
- Onboarding checklist untuk karyawan baru

---

### ADD-ON 8: Marketplace Connector Pro
**Menjawab:** P7  
**Induk:** Omnichannel Commerce Hub / Inventory  

Sinkronisasi dua arah dengan marketplace Indonesia dan regional.

**Koneksi:**
- Tokopedia Official Store API
- Shopee Open API
- Lazada Seller API
- TikTok Shop
- Bukalapak (roadmap)

**Fitur:**
- Sinkronisasi stok otomatis (update semua channel jika stok berubah)
- Pull order otomatis masuk ke NIZAM Order Management
- Sinkronisasi harga dari master catalog NIZAM
- Laporan penjualan per platform dalam satu view

---

### ADD-ON 9: AI Business Advisor
**Menjawab:** P17  
**Induk:** Platform Core  

AI yang membaca data bisnis dan memberikan rekomendasi actionable, bukan sekadar ringkasan.

**Fitur:**
- **Financial Health Score**: scoring otomatis kesehatan keuangan bisnis
- **Anomaly Detection**: deteksi transaksi tidak wajar atau pengeluaran spike
- **Smart Recommendations**: "Piutang Anda meningkat 40% — pertimbangkan review credit limit customer X"
- **Natural Language Query**: tanya dalam bahasa natural, dapatkan angka ("Berapa margin produk A bulan lalu?")
- **Predictive Alerts**: "Berdasarkan tren, inventory akan habis dalam 12 hari"
- **Competitive Benchmarking**: bandingkan metrik dengan industri sejenis (anonim/aggregate)

---

### ADD-ON 10: Audit & Compliance Pack
**Menjawab:** P13  
**Induk:** Finance Core  

Penguatan audit trail dan compliance untuk bisnis yang butuh standar lebih tinggi.

**Fitur:**
- Immutable audit log di semua transaksi
- User activity monitoring
- Suspicious transaction flagging
- Compliance checklist per regulasi (OJK, BI, DJP)
- Internal audit workflow
- External auditor read-only access portal

---

### ADD-ON 11: Multi-Currency & Forex Manager
**Menjawab:** P20  
**Induk:** Finance Core  

Support transaksi multi-mata uang untuk bisnis yang punya exposure forex.

**Fitur:**
- Setting kurs per hari (manual atau auto dari Bank Indonesia API)
- Invoice dan pembayaran dalam mata uang asing
- Kalkulasi selisih kurs otomatis (realized/unrealized)
- Laporan exposure forex per mata uang
- Hedging tracker (opsional)
- Konsolidasi laporan ke mata uang fungsional

---

### ADD-ON 12: Supply Chain Visibility (SCV)
**Menjawab:** P6, P8  
**Induk:** Purchasing + Inventory  

Visibilitas end-to-end dari PO ke penerimaan dengan tracking real-time.

**Fitur:**
- Track status PO: dikirim → diproses → dalam perjalanan → diterima
- Integrasi nomor resi pengiriman supplier
- ETA prediction per PO
- Partial delivery tracking
- Quality control gate (terima barang hanya setelah QC lulus)
- Supplier lead time analytics

---

## 5. PRIORITAS IMPLEMENTASI

### Fase 1: Q3 2026 — Revenue & Cash (3 bulan)
> Modul yang langsung berdampak ke revenue NIZAM dan menjawab pain paling mendesak

| Modul/Add-on | Estimasi Effort | Impact |
|---|---|---|
| Cash Flow Intelligence | 6 minggu | ⭐⭐⭐⭐⭐ |
| AR Collections Automation | 4 minggu | ⭐⭐⭐⭐⭐ |
| Tax Compliance Suite (Indonesia) | 8 minggu | ⭐⭐⭐⭐⭐ |
| Expense Management Pro | 3 minggu | ⭐⭐⭐⭐ |
| WhatsApp Notification Hub | 2 minggu | ⭐⭐⭐⭐ |

### Fase 2: Q4 2026 — Operations Excellence (3 bulan)
> Modul yang meningkatkan retensi dan membuka upsell

| Modul/Add-on | Estimasi Effort | Impact |
|---|---|---|
| Approval & Workflow Engine | 6 minggu | ⭐⭐⭐⭐⭐ |
| Smart Inventory Optimization | 5 minggu | ⭐⭐⭐⭐ |
| Multi-Location Intelligence | 4 minggu | ⭐⭐⭐⭐ |
| Payroll Pro Pack | 4 minggu | ⭐⭐⭐⭐ |
| Asset & Depreciation Manager | 3 minggu | ⭐⭐⭐ |

### Fase 3: Q1 2027 — Growth & Commerce (3 bulan)
> Modul untuk ekspansi channel dan pertumbuhan ARPU

| Modul/Add-on | Estimasi Effort | Impact |
|---|---|---|
| Omnichannel Commerce Hub | 10 minggu | ⭐⭐⭐⭐⭐ |
| Marketplace Connector Pro | 4 minggu | ⭐⭐⭐⭐ |
| Vendor Relationship Management | 5 minggu | ⭐⭐⭐⭐ |
| HR Self-Service (ESS/MSS) | 4 minggu | ⭐⭐⭐⭐ |
| Subscription & Recurring Billing | 3 minggu | ⭐⭐⭐ |

### Fase 4: Q2 2027 — Intelligence & Scale (3 bulan)
> Modul yang menjadi moat kompetitif jangka panjang

| Modul/Add-on | Estimasi Effort | Impact |
|---|---|---|
| Business Intelligence & Custom Reports | 8 minggu | ⭐⭐⭐⭐⭐ |
| AI Business Advisor | 10 minggu | ⭐⭐⭐⭐⭐ |
| Customer Success Portal | 6 minggu | ⭐⭐⭐⭐ |
| Multi-Currency & Forex Manager | 4 minggu | ⭐⭐⭐ |
| Supply Chain Visibility | 4 minggu | ⭐⭐⭐ |
| Audit & Compliance Pack | 3 minggu | ⭐⭐⭐ |
| E-Signature & Document Vault | 3 minggu | ⭐⭐⭐ |

---

## 6. KLASIFIKASI FINAL GTM

### Platform Core (Tidak Dijual Terpisah)
- Auth, Tenancy, Org, Branch, RBAC, Billing, Dashboard Shell, Support

### Core Families (Basis Paket)
1. Finance Core *(sudah ada — perkuat dengan Tax Suite + Asset Manager)*
2. Revenue Core *(sudah ada — perkuat dengan AR Collections + Subscription Billing)*
3. Purchasing *(sudah ada — perkuat dengan VRM + SCV)*
4. Inventory Core *(sudah ada — perkuat dengan SIO)*
5. HRIS Core *(sudah ada — perkuat dengan Payroll Pro + ESS/MSS)*

### Vertical Modules (Upsell Spesifik)
1. Manufacturing *(sudah ada)*
2. Fleet & Rental *(sudah ada)*
3. Service Operations *(sudah ada)*
4. Project & Construction *(sudah ada)*
5. Syirkah *(sudah ada)*
6. **Tax Compliance Suite** *(baru)*
7. **Omnichannel Commerce Hub** *(baru)*

### Strategic Module
1. Academy / EDU *(sudah ada — perkuat)*
2. **Business Intelligence & Custom Reports** *(baru)*

### Growth Add-ons
1. POS *(sudah ada)*
2. Sales Page *(sudah ada)*
3. Quick Bill *(sudah ada)*
4. Sales AR Cockpit *(sudah ada)*
5. Package Tracking *(sudah ada)*
6. **AR Collections Automation** *(baru)*
7. **WhatsApp Notification Hub** *(baru)*
8. **Marketplace Connector Pro** *(baru)*
9. **Customer Success Portal** *(baru)*

### Advanced Ops Add-ons
1. Advanced WMS *(sudah ada)*
2. Fleet Maintenance Pack *(sudah ada)*
3. **Smart Inventory Optimization** *(baru)*
4. **Supply Chain Visibility** *(baru)*

### Intelligence Add-ons
1. **Cash Flow Intelligence** *(baru)*
2. **AI Business Advisor** *(baru)*
3. **Multi-Location Intelligence** *(baru)*

### Compliance Add-ons
1. **Audit & Compliance Pack** *(baru)*
2. **E-Signature & Document Vault** *(baru)*
3. **Multi-Currency & Forex Manager** *(baru)*

### Platform Extension Add-ons
1. **Approval & Workflow Engine** *(baru)*
2. **Expense Management Pro** *(baru)*
3. **Subscription & Recurring Billing** *(baru)*
4. **Asset & Depreciation Manager** *(baru)*

### Integration & Capacity Add-ons
1. Open API *(sudah ada)*
2. Multi-Entity *(sudah ada)*
3. Seat Pack *(sudah ada)*
4. **HR Self-Service (ESS/MSS)** *(baru)*

---

## 7. IMPLIKASI KE PRICING

### Prinsip Pricing Baru

```
Total ACV = Base Package + Vertical Uplift + Add-on Uplift + Capacity Uplift + Enablement
```

### Estimasi Kontribusi Revenue per Modul Baru

| Modul/Add-on | Target ARPU Kontribusi | Model Harga |
|---|---|---|
| Cash Flow Intelligence | +Rp 150.000/org/bln | Bundle atau add-on |
| AR Collections Automation | +Rp 200.000/org/bln | Add-on |
| Tax Compliance Suite | +Rp 250.000/org/bln | Vertical module |
| Approval & Workflow Engine | +Rp 100.000/org/bln | Platform extension |
| Omnichannel Commerce Hub | +Rp 400.000/org/bln | Vertical module |
| AI Business Advisor | +Rp 300.000/org/bln | Intelligence add-on |
| Marketplace Connector Pro | +Rp 150.000/org/bln | Add-on per channel |
| Business Intelligence | +Rp 200.000/org/bln | Strategic add-on |
| Payroll Pro Pack | +Rp 175.000/org/bln | HRIS extension |
| WhatsApp Hub | +Rp 75.000/org/bln | Platform add-on |

**Proyeksi uplift ARPU per customer jika mengambil 5 modul baru:** +Rp 875.000/bln

---

## 8. ARSITEKTUR TEKNIS TERPADU

### 8.1 Pola Implementasi Standar

Setiap modul baru mengikuti pola berikut:

```
modules/{nama-modul}/
├── actions/
│   ├── {entity}.actions.ts     # Server Actions
│   └── index.ts                # Re-export
├── lib/
│   ├── {entity}.queries.ts     # Database queries
│   ├── {entity}.types.ts       # TypeScript types
│   └── {entity}.utils.ts       # Business logic helpers
app/(dashboard)/{nama-modul}/
├── page.tsx                     # Server component entry
├── layout.tsx                   # Module layout
├── {Feature}Client.tsx          # Client component
└── components/                  # Module-specific UI
```

### 8.2 Gating Capability

Setiap modul baru ditambahkan ke `lib/saas/module-catalog.ts`:

```typescript
// Modul baru di SAAS_ADDON_ITEMS atau SAAS_VERTICAL_MODULE_ITEMS
export const SAAS_INTELLIGENCE_ADDON_ITEMS = [
  { label: 'Cash Flow Intelligence', value: 'Cash Flow Intelligence' },
  { label: 'AI Business Advisor', value: 'AI Business Advisor' },
  { label: 'Multi-Location Intelligence', value: 'Multi-Location Intelligence' },
] as const

export const SAAS_COMPLIANCE_ADDON_ITEMS = [
  { label: 'Tax Compliance Suite', value: 'Tax Compliance Suite' },
  { label: 'Audit & Compliance Pack', value: 'Audit & Compliance Pack' },
  { label: 'E-Signature & Document Vault', value: 'E-Signature & Document Vault' },
] as const
```

### 8.3 Database Migration Pattern

Setiap modul baru memiliki migration SQL tersendiri:

```
supabase/migrations/
├── 1230_cashflow_intelligence.sql
├── 1231_ar_collections.sql
├── 1232_tax_compliance_suite.sql
├── 1233_approval_workflow_engine.sql
└── ...
```

### 8.4 Integrasi AI

Modul yang memerlukan AI menggunakan stack yang sudah ada:
- **Google AI Studio** (`@google/generative-ai`) untuk real-time inference
- **Vertex AI** untuk batch processing dan model yang lebih besar
- **AI Token Wallet** NIZAM untuk kontrol biaya per org

---

## 9. ANALISIS KOMPETITIF

### Positioning vs Kompetitor

| Capability | Odoo | NetSuite | Zoho | SAP B1 | **NIZAM (Target)** |
|---|---|---|---|---|---|
| Multi-tenant SaaS native | ✓ | ✓ | ✓ | ✗ | ✓ |
| Bahasa Indonesia UX | ✗ | ✗ | Partial | ✗ | ✓ |
| Pasar Syariah | ✗ | ✗ | ✗ | ✗ | ✓ |
| Cash Flow Forecast | Plugin | ✓ | ✗ | Plugin | **Target ✓** |
| AR Automation | ✓ | ✓ | ✓ | ✓ | **Target ✓** |
| Tax Indonesia Native | Plugin | Plugin | Plugin | Plugin | **Target ✓** |
| Academy/EDU terintegrasi | ✗ | ✗ | ✗ | ✗ | ✓ Unggul |
| AI Advisor native | Beta | ✗ | ✗ | Beta | **Target ✓** |
| Marketplace Indonesia | Plugin | ✗ | ✗ | ✗ | **Target ✓** |
| SME-friendly pricing | ✗ | ✗ | Partial | ✗ | ✓ Unggul |

**Kesimpulan**: NIZAM bisa mengungguli kompetitor global di konteks Indonesia dan pasar syariah, sambil menutup gap fitur yang selama ini menjadi kelemahan.

---

## 10. RISIKO DAN MITIGASI

| Risiko | Kemungkinan | Dampak | Mitigasi |
|---|---|---|---|
| Over-engineering sebelum ada demand | Tinggi | Waste resource | Validasi dengan 5 customer sebelum build full |
| Kompleksitas integrasi marketplace | Sedang | Delay delivery | Mulai dengan 1 marketplace (Tokopedia) |
| AI cost tidak terkontrol | Sedang | Margin tergerus | AI Token Wallet sudah ada — wajib dipakai |
| Regulasi pajak berubah | Tinggi | Technical debt | Desain tax engine sebagai konfigurasi, bukan hardcode |
| Scope creep per modul | Tinggi | Delay | Tetapkan MVP per modul, upsell fitur advance |
| Duplikasi dengan fitur yang sudah ada | Sedang | Confusion UX | Audit mendalam sebelum build dimulai |

---

## 11. KEPUTUSAN AKHIR

### 10 Modul Baru (Terurut Prioritas)
1. Cash Flow Intelligence
2. AR Collections Automation
3. Tax Compliance Suite
4. Approval & Workflow Engine
5. Multi-Location Intelligence
6. Smart Inventory Optimization
7. Omnichannel Commerce Hub
8. Business Intelligence & Custom Reports
9. Vendor Relationship Management
10. Customer Success Portal

### 12 Add-on Baru (Terurut Prioritas)
1. WhatsApp Notification Hub
2. Expense Management Pro
3. Payroll Pro Pack
4. Asset & Depreciation Manager
5. HR Self-Service (ESS/MSS)
6. Marketplace Connector Pro
7. AI Business Advisor
8. Subscription & Recurring Billing
9. Audit & Compliance Pack
10. Multi-Currency & Forex Manager
11. Supply Chain Visibility
12. E-Signature & Document Vault

---

## 12. PENUTUP

NIZAM sudah punya fondasi yang kuat. Dengan menambahkan 10 modul dan 12 add-on ini secara bertahap dalam 4 fase, NIZAM bisa:

1. **Menutup gap kompetitif** dengan Odoo dan Zoho di segmen SME
2. **Membuka pasar yang belum tersentuh**: franchise/multi-cabang, distributor, bisnis syariah formal
3. **Meningkatkan ARPU** rata-rata 3–5x dari customer yang saat ini ada
4. **Membangun moat** yang sulit ditiru: Academy + AI + Tax Indonesia + Syariah dalam satu platform
5. **Menyiapkan ekspansi regional**: Malaysia, Singapura, Middle East (dengan Multi-Currency + GST/VAT)

Dokumen ini adalah panduan hidup — akan diperbarui setiap kuartal berdasarkan feedback customer dan dinamika pasar.

---

*Dokumen ini disiapkan berdasarkan analisis branch `feat_multi`, codebase NIZAM ERP, dan riset pain point customer global.*  
*Dihasilkan: 10 Mei 2026*
