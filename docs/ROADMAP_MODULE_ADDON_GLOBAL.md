# NIZAM Platform — Roadmap Modul & Add-on Global
## Dokumen Perencanaan Produk: Menyelesaikan Pain Customer Secara Global

**Versi:** 2.0  
**Tanggal:** 21 Mei 2026  
**Branch Sumber Analisis:** `feat_multi` (commit `721fc78` — UI/UX Pro Max Skill v2.5.0)  
**Tujuan:** Memetakan modul dan add-on baru yang relevan secara global untuk menyelesaikan pain point customer nyata di berbagai industri dan geografi.  
**Status:** Dokumen Hidup — Update dari v1.0 (16 Mei 2026)

---

## Daftar Isi

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [State of the Platform — Analisis feat_multi](#2-state-of-the-platform--analisis-feat_multi)
3. [Peta Pain Point Customer Global](#3-peta-pain-point-customer-global)
4. [12 Modul Baru yang Direkomendasikan](#4-12-modul-baru-yang-direkomendasikan)
5. [18 Add-on Baru yang Direkomendasikan](#5-18-add-on-baru-yang-direkomendasikan)
6. [Matriks Prioritas & Roadmap 4 Phase](#6-matriks-prioritas--roadmap-4-phase)
7. [Arsitektur Produk Final Post-Roadmap](#7-arsitektur-produk-final-post-roadmap)
8. [Segmentasi Customer & Paket Rekomendasi](#8-segmentasi-customer--paket-rekomendasi)
9. [Differensiator Kompetitif Global](#9-differensiator-kompetitif-global)
10. [Estimasi Potensi Revenue Per Kategori](#10-estimasi-potensi-revenue-per-kategori)
11. [Kesimpulan & Rekomendasi Tindakan](#11-kesimpulan--rekomendasi-tindakan)

---

## 1. Ringkasan Eksekutif

### Posisi NIZAM Hari Ini (per 21 Mei 2026)

NIZAM adalah platform ERP SaaS multi-tenant dengan arsitektur 5 pilar yang solid, menjangkau SME hingga enterprise di Indonesia dengan keunggulan native Islamic Finance (Syirkah). Saat ini platform memiliki:

- **43 kapabilitas total**: 23 core module + 6 business-type vertical + 14 add-on
- **6 tier paket**: Demo → Trial → Lite → Basic → Pro → Enterprise
- **Arsitektur multi-entity**: org hierarchy, konsolidasi, inter-org transfer
- **1.260+ migrasi database**: schema produksi yang matang
- **Compliance Indonesia-native**: PSAK, zakat, Syariah, DJP-ready

### Gap Strategis yang Ditemukan

Analisis feat_multi mengungkap **7 area gap** yang membatasi pertumbuhan ke customer global:

| # | Area Gap | Dampak |
|---|---|---|
| 1 | Compliance & regulasi lintas negara | Tidak bisa expand ke Malaysia, UAE, Afrika |
| 2 | Supply chain visibility end-to-end | Kehilangan distributor & manufacturer besar |
| 3 | Customer experience post-sales | Churn B2B, CS overhead tinggi |
| 4 | AI-native operations | Kehilangan differensiasi vs ERP modern |
| 5 | ESG & keberlanjutan bisnis | Tidak bisa masuk enterprise & MNC segment |
| 6 | Treasury & cash management lanjutan | Kehilangan eksportir/importir & holding |
| 7 | Marketplace & omnichannel commerce | E-commerce merchant tidak terintegrasi |

**Rekomendasi Dokumen Ini:** 12 modul baru + 18 add-on baru → total **73 kapabilitas** post-roadmap

---

## 2. State of the Platform — Analisis feat_multi

### 2.1 Modul yang Sudah Ada (Inventarisasi Lengkap)

#### Core Modules (23 total)

| Module | Key | Klasifikasi | Maturity |
|--------|-----|-------------|----------|
| Akuntansi & Jurnal | `accounting` | Finance Core | ✅ Production |
| Kas & Bank | `finance` | Finance Core | ✅ Production |
| Pembelian | `purchasing` | Finance Core | ✅ Production |
| Inventori | `inventory` | Finance Core | ✅ Production |
| Gudang (WMS) | `warehouse` | Finance Core | ✅ Production |
| Laporan | `reports` | Finance Core | ✅ Production |
| Audit & Stok Opname | `audit` | Finance Core | ✅ Production |
| Penjualan | `sales` | Revenue Core | ✅ Production |
| CRM / Kontak | `crm` | Revenue Core | ✅ Production |
| HRIS & Payroll | `hris` | HRIS Core | ✅ Production |
| Syirkah (Bagi Hasil) | `syirkah` | Special/Pilar 4 | ✅ Production |
| Manufacturing | `factory` | Business Type | ✅ Production |
| Fleet & Rental | `fleet` | Business Type | ✅ Production |
| Workshop & Service | `workshop` | Business Type | ✅ Production |
| Job Order (Jasa) | `services` | Business Type | ✅ Production |
| Project & Construction | `construction` | Business Type | ✅ Production |
| LMS / Pelatihan | `lms` | Business Type | ✅ Production |
| Dashboard | `dashboard` | Platform Core | ✅ Production |
| Pengaturan Bisnis | `settings` | Platform Core | ✅ Production |
| Cabang & Divisi | `branches` | Platform Core | ✅ Production |
| Migrasi Data | `migration` | Platform Core | ✅ Production |
| SaaS Billing | `saas` | Platform Core | ✅ Production |
| E-Commerce | `ecommerce` | Commerce | ✅ Production |

#### Add-ons yang Sudah Ada (14 total)

| Add-on | Harga/bulan | Status |
|--------|-------------|--------|
| POS (Kasir) | Included | ✅ Live |
| Sales Page | Rp 149.000 | ✅ Live |
| Quick Bill | Rp 49.000/transaksi | ✅ Live |
| Advanced WMS | Rp 99.000 | ✅ Live |
| Multi-Entity (PT/CV) | Rp 199.000 | ✅ Live |
| Fleet Maintenance Pack | Rp 149.000 | ✅ Live |
| Package Tracking | Rp 149.000 | ✅ Live |
| Sales AR Cockpit | Rp 99.000 | ✅ Live |
| Sales AR Seat Pack | Rp 69.000 | ✅ Live |
| Open API & Webhooks | Rp 249.000 | ✅ Live |
| Advanced WMS (full) | TBA | 🚧 Planned |
| Open API (extended) | TBA | 🚧 Planned |
| Multi-Entity (enterprise) | TBA | 🚧 Planned |
| Sales AR Cockpit (premium) | TBA | 🚧 Planned |

### 2.2 Kekuatan Teknis yang Bisa Dimanfaatkan

1. **Multi-tenant RLS** — setiap tabel sudah org-scoped, add module baru tinggal ikut pola
2. **Marketplace + onboarding flow** — CoA injection, settings, activation sudah tersedia; modul baru bisa live dalam 1 hari
3. **Org hierarchy & consolidation** — fondasi untuk franchise, multi-entity, holding company module
4. **AI backend (Vertex AI + AI Studio)** — siap digunakan untuk AI add-on baru
5. **Open API (1200+)** — webhook outbox sudah ada; tinggal expose endpoint baru
6. **Syirkah native** — differensiasi unik yang bisa diperluas ke market Muslim global

---

## 3. Peta Pain Point Customer Global

### 3.1 Pain Point Tier-1 — Kehilangan Revenue Langsung

| Pain Point | Segmen Customer | Geografi | Dampak Bisnis |
|---|---|---|---|
| Tidak bisa kelola multi-mata uang | Eksportir, importir, bisnis asing | ID, MY, UAE, Afrika | Selisih kurs tidak tercatat, rugi tersembunyi |
| Invoice manual, tidak ada payment link | Semua B2B | Global | Revenue terlambat masuk 15–45 hari |
| Tidak ada approval workflow | Perusahaan 20+ karyawan | Global | Bottleneck operasional, fraud, human error |
| Stok di online & offline tidak sync | Retail chain, e-commerce | ID, MY, SG | Oversell, customer kecewa, reputasi rusak |
| Tidak ada portal customer mandiri | Distributor, B2B service | Global | CS overload, churn, biaya CS tinggi |

### 3.2 Pain Point Tier-2 — Growth Blocker

| Pain Point | Segmen Customer | Geografi | Dampak Bisnis |
|---|---|---|---|
| Tagihan recurring dibuat manual | SaaS, rental, membership | Global | Revenue leakage, admin overhead |
| Tidak ada demand forecast | Distributor, manufacturer | ID, MY | Overstock atau stockout berkala |
| Fixed asset manual di spreadsheet | Perusahaan dengan banyak aset | Global | Penyusutan salah, laporan tidak akurat |
| Komisi sales manual dan tidak transparan | Bisnis sales-driven | Global | Moral tim rendah, perhitungan salah |
| Tidak ada analitik lanjutan | Semua segmen menengah ke atas | Global | Keputusan berdasarkan feeling, bukan data |

### 3.3 Pain Point Tier-3 — Compliance & Governance

| Pain Point | Segmen Customer | Geografi | Dampak Bisnis |
|---|---|---|---|
| Tidak siap laporan pajak otomatis | Semua PKP | ID (DJP), MY (LHDN), UAE (VAT) | Risiko denda, audit, reputasi rusak |
| Tidak ada ESG reporting | Enterprise, ekspor ke EU/Jepang | Global enterprise | Tidak memenuhi syarat tender atau investor |
| Kontrak dengan supplier/customer tidak terlacak | Semua segmen | Global | Renewal terlewat, dispute tidak terdokumentasi |
| Tidak ada DMS (document management) | Perusahaan 50+ karyawan | Global | Dokumen hilang, compliance audit gagal |
| Tidak ada field service tracking | Servis, maintenance, utilitas | Global | Produktivitas teknisi tidak terukur |

### 3.4 Pain Point Global Muslim Market (1,8 Miliar Potensi)

| Pain Point | Detail | Market | Peluang |
|---|---|---|---|
| ERP tidak Syariah-compliant | Riba tracking, bagi hasil, zakat tidak ada | ID, MY, UAE, Pakistan, Afrika | Nizam sudah unggul — perlu diperluas |
| Tidak ada Zakat Business Module | Kalkulasi zakat usaha, distribusi | ID, MY | Module zakat terintegrasi |
| Tidak ada wakaf management | Aset wakaf, penyaluran, laporan | ID, MY, UAE | Vertikal wakaf |
| Tidak bisa generate laporan halal compliance | Produsen halal, F&B | ID, MY, GCC | Halal compliance add-on |

---

## 4. 12 Modul Baru yang Direkomendasikan

---

### 4.1 Treasury & Multi-Currency

**Klasifikasi:** Core Family Extension (Finance Core)  
**Prioritas:** 🔴 Tier-1 — Urgensi Tinggi  
**Harga Target:** Rp 299.000/bulan (add-on) atau bundled di paket Pro ke atas  
**Effort:** 🟡 Medium (3–4 sprint)  
**Geografi:** Indonesia, Malaysia, UAE, Afrika

**Pain yang Diselesaikan:**
- Bisnis ekspor/impor tidak bisa mencatat transaksi multi-mata uang dengan benar
- Selisih kurs tidak masuk laporan keuangan (kerugian tersembunyi)
- Tidak ada cash pooling untuk group usaha multi-entitas

**Fitur Utama:**
1. Multi-currency ledger — pencatatan dalam mata uang asing (USD, EUR, MYR, SAR, dsb.)
2. Exchange rate fetching otomatis (API Bank Indonesia / ECB / Wise)
3. Realized & unrealized forex gain/loss otomatis
4. Currency revaluation akhir periode
5. Cash pooling antar cabang/entitas dalam satu dashboard
6. Treasury dashboard — posisi kas semua rekening dalam satu tampilan
7. Bank reconciliation multi-bank
8. Hedging record (lindung nilai sederhana)

**Database Schema (Tambahan):**
```sql
-- currencies: code, name, symbol, is_active
-- exchange_rates: from_currency, to_currency, rate, effective_date, source
-- forex_transactions: journal_entry_id, amount_foreign, currency, rate, realized_gain_loss
-- cash_pool_accounts: org_id, bank_account_id, pool_group
```

**Dependencies:** Finance Core, Accounting  
**Market:** Eksportir, importir, bisnis dengan supplier/pelanggan asing, grup usaha multi-entitas  
**Estimasi Impact:** Membuka segmen eksportir/importir — pasar UKM ekspor Indonesia saja >500.000 entitas

---

### 4.2 Budget & Cost Control

**Klasifikasi:** Core Family Extension (Finance Core)  
**Prioritas:** 🔴 Tier-1 — Urgensi Tinggi  
**Harga Target:** Rp 199.000/bulan (add-on) atau bundled di paket Basic ke atas  
**Effort:** 🟡 Medium (2–3 sprint)  
**Geografi:** Global

**Pain yang Diselesaikan:**
- Tidak ada kontrol budget departemen/divisi/proyek
- Owner tidak tahu mana departemen yang melebihi budget
- Purchase order tidak dicek terhadap budget yang tersedia

**Fitur Utama:**
1. Budget planning per departemen / cost center / proyek / periode
2. Budget vs actuals dashboard real-time
3. PO budget checking — warning atau block jika melebihi budget
4. Expense budget utilization report
5. Rolling forecast — update proyeksi berdasarkan realisasi berjalan
6. Budget approval workflow
7. Budget revision dengan audit trail
8. Multi-level budget: korporat → divisi → departemen

**Database Schema (Tambahan):**
```sql
-- budget_plans: org_id, period, dept_id, account_id, amount, version
-- budget_vs_actuals: (view) budget_plans JOIN journal_entries
-- budget_checkpoints: triggered on PO creation
```

**Dependencies:** Finance Core, Purchasing, Accounting  
**Market:** Perusahaan 20+ karyawan, multi-divisi, multi-cabang, proyek skala menengah

---

### 4.3 Fixed Asset Management (FAM)

**Klasifikasi:** Core Family Extension (Finance Core)  
**Prioritas:** 🟠 Tier-2 — Growth Blocker  
**Harga Target:** Bundled di Finance Core (Starter ke atas)  
**Effort:** 🟡 Medium (3–4 sprint)  
**Geografi:** Global

**Pain yang Diselesaikan:**
- Aset tetap dicatat manual di spreadsheet
- Penyusutan salah atau tidak konsisten
- Tidak ada tracking lokasi dan kondisi aset

**Fitur Utama:**
1. Asset register — kategori, lokasi, penanggung jawab
2. Depreciation engine: straight-line, declining balance, sum-of-years-digits
3. Automatic depreciation journal posting (batch bulanan)
4. Asset disposal & write-off workflow
5. Asset transfer (pindah lokasi/divisi)
6. Maintenance log (integrasi Fleet Maintenance Pack)
7. Revaluation aset (PSAK 16 compliance)
8. Laporan: NBV, depreciation schedule, asset aging

**Database Schema (Tambahan):**
```sql
-- fixed_assets: org_id, category, acquisition_cost, useful_life, method, location_id
-- depreciation_schedules: asset_id, period, amount, posted
-- asset_disposals: asset_id, disposal_type, proceeds, gain_loss
```

**Dependencies:** Finance Core, Accounting  
**Market:** Perusahaan dengan banyak kendaraan, mesin, properti, peralatan IT

---

### 4.4 Tax Compliance Engine

**Klasifikasi:** Vertical Module (Compliance)  
**Prioritas:** 🔴 Tier-1 — Urgensi Tinggi  
**Harga Target:** Rp 349.000/bulan  
**Effort:** 🔴 High (5–8 sprint, karena regulasi spesifik)  
**Geografi:** Indonesia (DJP), Malaysia (LHDN), UAE (VAT), ekspansi regional

**Pain yang Diselesaikan:**
- Pelaporan PPN manual dan error-prone
- Tidak ada rekap faktur pajak otomatis
- Tidak siap e-Faktur atau integrasi DJP

**Fitur Utama:**
1. PPN input/output tracking otomatis dari setiap transaksi
2. e-Faktur generation (format XML DJP Indonesia, e-LHDN Malaysia)
3. Rekap SPT Masa PPN otomatis
4. PPh 21 calculation (terintegrasi HRIS/Payroll)
5. PPh 23 withholding tracking
6. Tax calendar & deadline reminder
7. Tax audit trail report
8. Multi-tax jurisdiction (Malaysia GST, Singapore GST, UAE VAT)

**Database Schema (Tambahan):**
```sql
-- tax_transactions: source_id, source_type, tax_type, base_amount, tax_amount, status
-- tax_invoices: efaktur_number, npwp_seller, npwp_buyer, xml_payload, submission_status
-- tax_periods: org_id, period, type, due_date, filed_at
```

**Dependencies:** Finance Core, Sales, Purchasing, HRIS Core  
**Market:** Semua PKP (~900.000 entitas di Indonesia), ekspansi regional

---

### 4.5 Subscription & Recurring Billing

**Klasifikasi:** Vertical Module (Revenue)  
**Prioritas:** 🟠 Tier-2 — Growth Blocker  
**Harga Target:** Rp 249.000/bulan  
**Effort:** 🟡 Medium (3–4 sprint)  
**Geografi:** Global

**Pain yang Diselesaikan:**
- Bisnis langganan harus buat invoice manual setiap bulan
- Tidak ada tracking trial, renewal, churn
- Revenue recognition tidak akurat untuk bisnis berlangganan

**Fitur Utama:**
1. Subscription plan management (bulanan, tahunan, custom cycle)
2. Automatic invoice generation berdasarkan siklus billing
3. Trial management & conversion tracking
4. Dunning management (reminder sebelum/sesudah jatuh tempo)
5. Proration billing (charge proporsional saat upgrade/downgrade)
6. Deferred revenue recognition (PSAK 72 / ASC 606)
7. Churn analysis dan cohort report
8. MRR/ARR dashboard

**Database Schema (Tambahan):**
```sql
-- subscription_plans: org_id, name, price, interval, trial_days
-- subscriptions: customer_id, plan_id, status, current_period_start, current_period_end
-- subscription_invoices: subscription_id, period, amount, status, due_date
-- deferred_revenue: subscription_id, period, recognized_amount
```

**Dependencies:** Revenue Core, Finance Core  
**Market:** SaaS, media digital, rental berlangganan, lembaga pendidikan, layanan membership

---

### 4.6 Omnichannel Commerce

**Klasifikasi:** Vertical Module (Commerce)  
**Prioritas:** 🟠 Tier-2 — Growth Blocker  
**Harga Target:** Rp 399.000/bulan  
**Effort:** 🔴 High (6–8 sprint, karena integrasi marketplace)  
**Geografi:** Indonesia (Tokopedia, Shopee, Lazada, TikTok), Malaysia, Filipina

**Pain yang Diselesaikan:**
- Data penjualan online tidak terintegrasi ke ERP
- Stok tidak sinkron antara online dan offline
- Tidak bisa kelola banyak channel dalam satu dasbor

**Fitur Utama:**
1. Marketplace connector: Tokopedia, Shopee, Lazada, TikTok Shop (via official API)
2. Centralized order management semua channel dalam satu tampilan
3. Real-time inventory sync lintas channel
4. Unified customer database (customer yang sama di berbagai platform)
5. Omnichannel fulfillment: pilih gudang terdekat, cross-docking
6. Return & refund management multi-channel
7. Channel performance analytics (margin per channel, sell-through rate)
8. Centralized price management — push harga ke semua channel sekaligus

**Dependencies:** Inventory Core, Revenue Core, E-Commerce module  
**Market:** Retail online-offline, brand D2C, distributor yang jualan di marketplace

---

### 4.7 Customer Success & Self-Service Portal

**Klasifikasi:** Vertical Module (Customer Experience)  
**Prioritas:** 🟠 Tier-2 — Growth Blocker  
**Harga Target:** Rp 199.000/bulan  
**Effort:** 🟡 Medium (3–4 sprint)  
**Geografi:** Global

**Pain yang Diselesaikan:**
- Customer B2B harus telepon/WA untuk cek status order atau invoice
- Tim CS overload dengan pertanyaan repetitif
- Tidak ada portal mandiri untuk customer

**Fitur Utama:**
1. Customer self-service portal — login sendiri, lihat status order, invoice, pembayaran
2. Online payment link terintegrasi dari portal
3. Dispute & claim management digital
4. Customer support ticket (terintegrasi tiket internal)
5. Customer Statement of Account (SOA) downloadable
6. Delivery tracking integration
7. Customer satisfaction survey (CSAT/NPS) post-transaksi
8. B2B order portal — customer bisa input order sendiri

**Database Schema (Tambahan):**
```sql
-- customer_portal_tokens: customer_id, token, expires_at
-- customer_disputes: invoice_id, reason, status, resolution
-- customer_nps_responses: customer_id, score, comment, created_at
```

**Dependencies:** Revenue Core, Finance Core, CRM  
**Market:** Distributor B2B, jasa berlangganan, bisnis dengan volume transaksi tinggi

---

### 4.8 Supply Chain Planning (SCP)

**Klasifikasi:** Vertical Module (Operations)  
**Prioritas:** 🟠 Tier-2  
**Harga Target:** Rp 349.000/bulan  
**Effort:** 🔴 High (5–7 sprint, karena ML/forecasting)  
**Geografi:** Global (manufacturer, distributor)

**Pain yang Diselesaikan:**
- Buyer tidak tahu kapan harus reorder
- Tidak ada demand forecasting berbasis data historis
- Lead time supplier tidak diperhitungkan dalam planning

**Fitur Utama:**
1. Reorder point automation — berbasis lead time dan safety stock
2. Demand forecasting (moving average, trend, seasonal decomposition)
3. Master Production Schedule (MPS) untuk manufacturer
4. Material Requirements Planning (MRP) — terintegrasi BoM Manufacturing
5. Supplier lead time tracking dan scoring
6. Purchase suggestion otomatis berdasarkan stok dan forecast
7. Supply chain risk dashboard (supplier dependency, stockout risk score)
8. What-if scenario planning (bagaimana jika demand naik 20%?)

**Dependencies:** Inventory Core, Purchasing, Manufacturing (untuk MRP)  
**Market:** Manufacturer, distributor dengan volume besar, bisnis musiman

---

### 4.9 Field Service Management (FSM)

**Klasifikasi:** Vertical Module (Operations)  
**Prioritas:** 🟡 Tier-3  
**Harga Target:** Rp 249.000/bulan  
**Effort:** 🟡 Medium (4–5 sprint)  
**Geografi:** Global

**Pain yang Diselesaikan:**
- Tidak ada sistem dispatching teknisi/tenaga lapangan
- Laporan pekerjaan lapangan manual
- Tidak bisa track lokasi dan produktivitas tim lapangan

**Fitur Utama:**
1. Work order dispatching — assign teknisi ke job dari dashboard
2. Mobile check-in/check-out — teknisi konfirmasi via PWA mobile
3. GPS route visualization dan history
4. Digital form lapangan (foto, tanda tangan, checklist)
5. Spare part consumption dari lapangan — deduct stok otomatis
6. SLA tracking (response time, resolution time per kontrak)
7. Customer sign-off digital
8. Field team performance dashboard

**Dependencies:** Service Operations, Inventory Core, HRIS Core  
**Market:** Bengkel, servis AC/elektronik, kontraktor, utility, jasa instalasi

---

### 4.10 Payables & Receivables Intelligence

**Klasifikasi:** Core Family Extension (Finance Core)  
**Prioritas:** 🔴 Tier-1  
**Harga Target:** Rp 199.000/bulan  
**Effort:** 🟢 Low-Medium (2–3 sprint)  
**Geografi:** Global

**Pain yang Diselesaikan:**
- Tidak ada early warning untuk cash crunch
- Tidak tahu kapan harus tagih dan kapan harus bayar
- Tidak ada forecast arus kas yang actionable

**Fitur Utama:**
1. Aging AR/AP dengan alert otomatis (overdue, near-due)
2. Cash flow forecast 30/60/90 hari (berbasis AR/AP outstanding)
3. Automatic payment reminder ke customer via WhatsApp/Email
4. Supplier payment scheduling — prioritaskan berdasarkan diskon atau penalti
5. Early payment discount management (2/10 net 30)
6. Factoring readiness report
7. DSO (Days Sales Outstanding) dan DPO analytics
8. Cashflow scenario: optimistic, base, pessimistic

**Dependencies:** Finance Core, Revenue Core, Purchasing  
**Market:** Semua bisnis B2B dengan piutang signifikan, distributor, kontraktor

---

### 4.11 ESG & Sustainability Reporting

**Klasifikasi:** Vertical Module (Governance & Compliance)  
**Prioritas:** 🟡 Tier-3 — Tren Global Naik Cepat  
**Harga Target:** Rp 499.000/bulan (enterprise segment)  
**Effort:** 🔴 High (5–7 sprint)  
**Geografi:** Global enterprise, ekspor ke EU/Jepang, perusahaan tbk

**Pain yang Diselesaikan:**
- Tidak bisa memenuhi persyaratan ESG dari investor atau mitra asing
- Tidak ada tracking emisi karbon atau konsumsi energi
- Tidak ada laporan keberlanjutan standar global

**Fitur Utama:**
1. Carbon emission tracking (Scope 1, 2, 3 — terintegrasi operasional Fleet/Factory)
2. Energy consumption tracking per lokasi/divisi
3. Waste management log
4. Social impact metrics (karyawan, gender diversity, K3)
5. ESG report builder (format GRI, SASB, TCFD, OJK Sustainability Report)
6. Supplier ESG scoring
7. ESG target setting & progress tracking
8. ESG dashboard untuk direksi dan investor

**Dependencies:** Finance Core, HRIS Core, Purchasing, Fleet & Rental  
**Market:** Perusahaan IPO-ready, bermitra dengan MNC, ekspor ke EU, penerima hibah internasional

---

### 4.12 Commission & Incentive Management

**Klasifikasi:** Core Family Extension (Revenue Core)  
**Prioritas:** 🟠 Tier-2  
**Harga Target:** Rp 149.000/bulan  
**Effort:** 🟢 Low-Medium (2–3 sprint)  
**Geografi:** Global

**Pain yang Diselesaikan:**
- Perhitungan komisi sales manual dan sering salah
- Tidak ada transparansi komisi untuk tim sales
- Insentif tidak terhubung dengan data transaksi aktual

**Fitur Utama:**
1. Commission scheme builder (%, tiered, target-based, profit-based)
2. Real-time commission tracker per sales rep
3. Commission approval workflow sebelum dibayar
4. Terintegrasi payroll (bayar via slip gaji)
5. Multi-level commission (rep → supervisor → regional manager)
6. Bonus & incentive campaign management
7. Commission statement bulanan
8. Sales contest & leaderboard gamification

**Dependencies:** Revenue Core, HRIS Core, Finance Core  
**Market:** Perusahaan dengan tim sales, distributor, agency, broker properti

---

## 5. 18 Add-on Baru yang Direkomendasikan

---

### 5.1 Payment Gateway Integration
**Klasifikasi:** Growth Add-on | **Prioritas:** 🔴 Tier-1 | **Harga:** Rp 149.000/bulan + 0.5% transaction fee (capped)

**Pain:** Invoice dikirim tapi customer tidak punya cara bayar yang mudah.

**Fitur:**
- Payment link terintegrasi di setiap invoice (Midtrans, Xendit, Doku)
- Auto-reconcile payment yang masuk ke sistem
- Virtual account per transaksi atau per customer
- QRIS payment support (Indonesia-native)
- Installment payment tracking
- Payment success webhook → auto-close invoice

**Dependencies:** Revenue Core, Finance Core

---

### 5.2 WhatsApp Business Integration
**Klasifikasi:** Growth Add-on | **Prioritas:** 🔴 Tier-1 (SEA-specific) | **Harga:** Rp 199.000/bulan + per-message (API cost pass-through)

**Pain:** Customer di Asia Tenggara mengharapkan komunikasi bisnis via WhatsApp, bukan email.

**Fitur:**
- Send invoice, quotation, payment reminder via WhatsApp otomatis
- WhatsApp order bot (customer order via WA → masuk ke sistem)
- Delivery status update real-time via WA
- Collection reminder / dunning via WA
- Two-way messaging log tersimpan di CRM
- HR: slip gaji & pengumuman via WA

**Dependencies:** Revenue Core, CRM, Finance Core

---

### 5.3 Approval Workflow Engine
**Klasifikasi:** Governance Add-on | **Prioritas:** 🔴 Tier-1 | **Harga:** Rp 199.000/bulan

**Pain:** Approval PO, reimbursement, cuti via WhatsApp Group atau manual — tidak terlacak.

**Fitur:**
- Visual workflow builder (define langkah, approver, kondisi, routing)
- Approval via email, WhatsApp, atau notifikasi in-app
- Delegation of authority saat approver cuti
- Complete approval history dan audit trail
- Eskalasi otomatis jika melampaui SLA
- Multi-level: sequential atau parallel
- Conditional routing (nilai > X → butuh direktur)

**Dependencies:** Semua modul transaksional (Purchasing, Sales, HRIS, Finance)

---

### 5.4 AI Purchase Assistant
**Klasifikasi:** AI Productivity Add-on | **Prioritas:** 🔴 Tier-1 | **Harga:** Rp 199.000/bulan

**Pain:** Buyer tidak tahu harga wajar, tidak ada rekomendasi supplier terbaik.

**Fitur:**
- AI price benchmarking (bandingkan harga pembelian vs. pasar)
- Supplier recommendation berdasarkan harga, lead time, histori
- Anomali detection: PO dengan harga di luar range normal (fraud prevention)
- Auto-fill PO dari email atau PDF supplier (via OCR + AI extraction)
- Smart reorder suggestion berbasis pattern historis

**Dependencies:** Purchasing, Inventory Core, AI/LLM backend (Vertex AI)

---

### 5.5 Smart Invoice OCR
**Klasifikasi:** Productivity Add-on | **Prioritas:** 🟠 Tier-2 | **Harga:** Rp 149.000/bulan + Rp 500/dokumen di atas 100 lembar/bulan

**Pain:** Input faktur pembelian dari supplier masih manual, lambat, sering salah ketik.

**Fitur:**
- Upload PDF/foto faktur → otomatis extract: vendor, tanggal, nomor, item, qty, harga, total
- Preview dan konfirmasi sebelum create purchase invoice
- Batch upload faktur
- Duplikasi detection (faktur yang sama diinput dua kali)
- Belajar dari koreksi user (feedback loop)

**Dependencies:** Purchasing, Finance Core, AI/OCR backend

---

### 5.6 Advanced Analytics & BI Dashboard
**Klasifikasi:** Growth Add-on | **Prioritas:** 🟠 Tier-2 | **Harga:** Rp 299.000/bulan

**Pain:** Laporan standar tidak cukup untuk keputusan strategis; owner butuh drill-down.

**Fitur:**
- Custom dashboard builder (drag & drop widget)
- Cross-module analytics (sales + inventory + finance dalam satu chart)
- Cohort analysis untuk customer
- Trend & seasonality analysis
- Benchmark antar cabang / salesperson / produk
- Scheduled report (kirim PDF otomatis via email/WA)
- Data export ke Google Sheets / Power BI / Excel

**Dependencies:** Reports Module, semua modul aktif

---

### 5.7 HR Self-Service (Mobile PWA)
**Klasifikasi:** HRIS Add-on | **Prioritas:** 🟠 Tier-2 | **Harga:** Rp 99.000/bulan (+ Rp 5.000/karyawan aktif)

**Pain:** Karyawan harus ke HRD untuk cuti, reimburse, atau lihat slip gaji.

**Fitur:**
- PWA mobile karyawan (iOS/Android via browser, no app store required)
- Request cuti & approval via mobile
- Submit reimbursement dengan foto struk (OCR otomatis)
- Lihat slip gaji dan histori payroll
- Absensi via GPS + foto selfie (anti-spoofing)
- Pengumuman dan broadcast dari HRD
- Employee directory

**Dependencies:** HRIS Core

---

### 5.8 Barcode & QR Inventory Scanner
**Klasifikasi:** Advanced Ops Add-on | **Prioritas:** 🟠 Tier-2 | **Harga:** Rp 99.000/bulan

**Pain:** Receiving barang dan stock opname masih manual, lambat, dan error-prone.

**Fitur:**
- Mobile barcode scanner (kamera HP jadi scanner via browser)
- QR code generation untuk setiap produk/lokasi/bin
- Goods receiving via scan → otomatis update stok
- Stock opname via scan → bandingkan vs. sistem
- Serial number & batch tracking via barcode
- Label printing integration (PDF, ZPL)

**Dependencies:** Inventory Core, Advanced WMS

---

### 5.9 E-Commerce Auto-Sync
**Klasifikasi:** Integration Add-on | **Prioritas:** 🟠 Tier-2 | **Harga:** Rp 199.000/bulan (per channel pertama, Rp 99.000/channel tambahan)

**Pain:** Data penjualan marketplace tidak masuk ERP secara otomatis.

**Fitur:**
- Real-time sync order dari Tokopedia, Shopee, Lazada, TikTok Shop
- Inventory level push ke semua marketplace
- Auto-create invoice dari marketplace order
- Return & refund sync dari marketplace
- Marketplace fee deduction otomatis dalam laporan profit

**Dependencies:** Omnichannel Commerce Module atau Revenue Core (versi lite)

---

### 5.10 Franchise & Multi-Outlet Management
**Klasifikasi:** Capacity Add-on | **Prioritas:** 🟠 Tier-2 | **Harga:** Rp 349.000/bulan (untuk franchisor)

**Pain:** Bisnis franchise tidak bisa monitor semua outlet dari satu tempat.

**Fitur:**
- Franchisor dashboard (monitor semua outlet dalam satu layar)
- Royalty fee calculation dan invoicing otomatis ke franchisee
- Standardized menu/price push ke semua outlet sekaligus
- Outlet performance comparison (sales, margin, waste)
- Compliance checklist per outlet
- Inter-outlet inventory transfer
- Consolidated financial report semua outlet

**Dependencies:** Multi-Entity Add-on, Revenue Core, Inventory Core, Finance Core

---

### 5.11 Contract Management
**Klasifikasi:** Governance Add-on | **Prioritas:** 🟡 Tier-3 | **Harga:** Rp 149.000/bulan

**Pain:** Kontrak dengan pelanggan/supplier disimpan di folder tanpa reminder jatuh tempo.

**Fitur:**
- Contract repository (upload & kelola semua kontrak)
- Key date tracking (start, end, renewal, review date)
- Auto-reminder sebelum kontrak jatuh tempo
- Contract value tracking — link ke PO/SO
- E-signature integration (native atau via API DocuSign/Adobe Sign)
- Vendor/customer contract scorecard
- Contract template library

**Dependencies:** Revenue Core, Purchasing, CRM

---

### 5.12 Loyalty & Rewards Program
**Klasifikasi:** Growth Add-on | **Prioritas:** 🟡 Tier-3 | **Harga:** Rp 149.000/bulan

**Pain:** Tidak ada program loyalitas pelanggan yang terintegrasi dengan transaksi.

**Fitur:**
- Points earning rules (per Rp X transaksi = Y points)
- Points redemption di POS atau sales order
- Tier membership (Silver, Gold, Platinum) dengan benefit berbeda
- Birthday reward automation
- Referral program tracking
- Loyalty analytics (churn rate, points liability, redemption rate)
- Notifikasi points via WhatsApp (terintegrasi WA add-on)

**Dependencies:** POS Add-on, Revenue Core, CRM

---

### 5.13 Document Management System (DMS)
**Klasifikasi:** Governance Add-on | **Prioritas:** 🟡 Tier-3 | **Harga:** Rp 149.000/bulan (5 GB included)

**Pain:** Dokumen bisnis tersebar di email, Google Drive, dan WhatsApp.

**Fitur:**
- Centralized document repository dengan folder structure
- Auto-attach dokumen ke transaksi terkait (PO, invoice, proyek)
- Version control dokumen
- Full-text search di semua dokumen
- Document approval workflow
- Expiry tracking (sertifikat, izin, asuransi, kontrak)
- Secure sharing via link ber-expiry

**Dependencies:** Semua modul (cross-cutting)

---

### 5.14 Route & Delivery Optimization
**Klasifikasi:** Advanced Ops Add-on | **Prioritas:** 🟡 Tier-3 | **Harga:** Rp 199.000/bulan

**Pain:** Pengiriman barang tidak dioptimasi, biaya logistik membengkak.

**Fitur:**
- Daily delivery route planning otomatis (TSP/VRP algorithm)
- Vehicle load optimization
- Real-time driver tracking via GPS
- Proof of delivery (foto + tanda tangan digital)
- Delivery performance analytics (on-time rate, cost per km)
- Customer ETA notification
- Return pickup scheduling

**Dependencies:** Sales, Fleet & Rental (opsional), Inventory Core

---

### 5.15 Vendor Portal
**Klasifikasi:** Integration Add-on | **Prioritas:** 🟡 Tier-3 | **Harga:** Rp 149.000/bulan

**Pain:** Komunikasi dengan supplier masih manual via email; status PO tidak transparan.

**Fitur:**
- Supplier self-service portal: lihat dan konfirmasi PO
- Supplier invoice submission digital
- Delivery schedule coordination
- Supplier rating & scorecard
- RFQ (Request for Quotation) online
- Supplier onboarding form digital
- Communication log terintegrasi

**Dependencies:** Purchasing, Finance Core

---

### 5.16 AI Cashflow Advisor
**Klasifikasi:** AI Productivity Add-on | **Prioritas:** 🟠 Tier-2 | **Harga:** Rp 249.000/bulan

**Pain:** Owner tidak tahu apakah bisnis akan cukup kas 30–90 hari ke depan.

**Fitur:**
- AI cashflow forecast berbasis data historis + AR/AP outstanding
- "What-if" scenario modeling (bagaimana jika tagih 7 hari lebih cepat? ada CapEx besar?)
- Rekomendasi tindakan (kapan harus tarik pinjaman, kapan bisa invest)
- Alert dini potensi cash crunch (7, 14, 30 hari ke depan)
- Natural language summary arus kas ("Bulan ini arus kas negatif karena...")
- Open banking integration (opsional, untuk real-time bank balance)

**Dependencies:** Finance Core, Payables & Receivables Intelligence, AI backend

---

### 5.17 Predictive Maintenance (IoT-Ready)
**Klasifikasi:** Advanced Ops Add-on | **Prioritas:** 🟡 Tier-3 | **Harga:** Rp 199.000/bulan

**Pain:** Perusahaan dengan mesin atau armada tidak tahu kapan mesin akan rusak — reaktif, bukan preventif.

**Fitur:**
- Maintenance schedule otomatis berdasarkan jam operasional atau kilometer
- IoT sensor integration (temperature, vibration, mileage) — future roadmap
- Predictive alert berdasarkan pattern breakdown historis
- Maintenance cost per aset per periode
- Spare part inventory integration (deduct saat maintenance)
- Vendor maintenance scheduling

**Dependencies:** Fixed Asset Management, Fleet Maintenance Pack, Manufacturing

---

### 5.18 Training & Certification Marketplace
**Klasifikasi:** Academy Strategic Add-on | **Prioritas:** 🟠 Tier-2 | **Harga:** Revenue sharing: NIZAM 30% / Instruktur 70%

**Pain:** NIZAM sudah punya Academy/EDU, tetapi konten pelatihan terbatas pada konten internal saja.

**Fitur:**
- Open marketplace untuk trainer/instruktur eksternal publish konten di NIZAM
- Revenue sharing model otomatis untuk instruktur
- Customer bisa beli kursus dari marketplace → belajar langsung di platform
- Sertifikasi resmi NIZAM untuk implementor dan user
- Partner program: reseller, implementor, trainer bisa sertifikasi
- Cohort-based learning (belajar bersama seangkatan)
- Live session integration (Zoom/Google Meet embed)

**Dependencies:** Academy/EDU Module

---

## 6. Matriks Prioritas & Roadmap 4 Phase

### 6.1 Kriteria Prioritas

| Dimensi | Bobot | Penjelasan |
|---|---|---|
| Pain Severity | 35% | Seberapa besar kerugian customer jika tidak ada fitur ini |
| Market Size | 25% | Jumlah customer potensial yang butuh |
| Build Effort | 20% | Complexity dan resource yang dibutuhkan |
| Revenue Impact | 20% | Potensi upsell/new revenue untuk NIZAM |

### 6.2 Skor Prioritas Per Item

| Item | Pain | Market | Effort (inv) | Revenue | Total |
|---|---|---|---|---|---|
| Payment Gateway | 9 | 10 | 8 | 9 | **90** |
| Approval Workflow | 9 | 9 | 8 | 8 | **85** |
| WhatsApp Integration | 8 | 10 | 7 | 8 | **83** |
| Tax Compliance Engine | 10 | 9 | 5 | 9 | **82** |
| Payables & Receivables Intel | 9 | 9 | 8 | 7 | **82** |
| Treasury & Multi-Currency | 8 | 7 | 7 | 9 | **77** |
| Budget & Cost Control | 8 | 8 | 8 | 7 | **77** |
| AI Purchase Assistant | 7 | 8 | 7 | 8 | **75** |
| Commission Management | 7 | 8 | 9 | 7 | **75** |
| Smart Invoice OCR | 7 | 8 | 8 | 7 | **74** |
| Subscription Billing | 7 | 7 | 8 | 8 | **74** |
| Omnichannel Commerce | 8 | 8 | 4 | 8 | **71** |

### 6.3 Phase 1 — Q3 2026 (Quick Wins & Tier-1 Pain)

**Tema:** Unblock Revenue & Governance

| Item | Tipe | Effort | Revenue Uplift |
|---|---|---|---|
| Payment Gateway Integration | Add-on | 🟢 3 sprint | Rp 149K/mo + transactional |
| Approval Workflow Engine | Add-on | 🟡 4 sprint | Rp 199K/mo |
| WhatsApp Business Integration | Add-on | 🟡 4 sprint | Rp 199K/mo |
| Payables & Receivables Intelligence | Module | 🟢 2 sprint | Rp 199K/mo |
| Tax Compliance Engine (Indonesia only) | Module | 🟡 5 sprint | Rp 349K/mo |

**Expected Output Q3 2026:** +5 kapabilitas baru, target ARR uplift Rp 2–5B dari early adopters

---

### 6.4 Phase 2 — Q4 2026 (Growth & Vertical Depth)

**Tema:** Grow per-customer revenue & open new segments

| Item | Tipe | Effort | Revenue Uplift |
|---|---|---|---|
| Treasury & Multi-Currency | Module | 🟡 4 sprint | Rp 299K/mo |
| Budget & Cost Control | Module | 🟡 3 sprint | Rp 199K/mo |
| AI Purchase Assistant | Add-on | 🟡 3 sprint | Rp 199K/mo |
| Smart Invoice OCR | Add-on | 🟢 2 sprint | Rp 149K/mo |
| Commission & Incentive Mgmt | Module | 🟢 3 sprint | Rp 149K/mo |
| Subscription & Recurring Billing | Module | 🟡 4 sprint | Rp 249K/mo |

**Expected Output Q4 2026:** +6 kapabilitas, ARPU naik 30–40%

---

### 6.5 Phase 3 — Q1 2027 (Scale & Ecosystem)

**Tema:** Self-serve customer + commerce ecosystem

| Item | Tipe | Effort | Revenue Uplift |
|---|---|---|---|
| Omnichannel Commerce | Module | 🔴 7 sprint | Rp 399K/mo |
| Supply Chain Planning | Module | 🔴 6 sprint | Rp 349K/mo |
| Customer Success & Portal | Module | 🟡 4 sprint | Rp 199K/mo |
| Fixed Asset Management | Module | 🟡 4 sprint | Bundled |
| Advanced Analytics & BI | Add-on | 🟡 4 sprint | Rp 299K/mo |
| HR Self-Service Mobile (PWA) | Add-on | 🟡 3 sprint | Rp 99K/mo + per-seat |

**Expected Output Q1 2027:** Platform lengkap untuk enterprise SME, ARPU naik 50–80%

---

### 6.6 Phase 4 — Q2–Q3 2027 (Enterprise & Global)

**Tema:** Enterprise compliance, AI-native, global expansion

| Item | Tipe | Effort | Target Market |
|---|---|---|---|
| ESG & Sustainability Reporting | Module | 🔴 7 sprint | Enterprise, IPO-ready |
| Field Service Management | Module | 🟡 5 sprint | Service, utility, maintenance |
| Franchise & Multi-Outlet | Add-on | 🟡 4 sprint | F&B chain, retail chain |
| Training & Certification Marketplace | Add-on | 🟡 4 sprint | Academy ecosystem |
| Vendor Portal | Add-on | 🟢 3 sprint | Procurement digital |
| AI Cashflow Advisor | Add-on | 🟡 4 sprint | All finance users |
| Predictive Maintenance | Add-on | 🔴 5 sprint | Fleet, manufacturing |
| Tax Compliance (Multi-Country) | Module Extension | 🔴 6 sprint | MY, UAE, SG, Africa |

---

## 7. Arsitektur Produk Final Post-Roadmap

```
NIZAM Platform (73 kapabilitas)
│
├── 🏛️ Platform Core (selalu included)
│   ├── Auth & Tenancy
│   ├── Organization & Branch
│   ├── Roles & Permissions
│   ├── Dashboard Shell
│   └── Billing & Support
│
├── 💰 Finance Core Family
│   ├── Akuntansi & Jurnal [existing]
│   ├── Kas & Bank [existing]
│   ├── Laporan Keuangan [existing]
│   ├── Audit & Stok Opname [existing]
│   ├── [NEW v2] Treasury & Multi-Currency
│   ├── [NEW v2] Budget & Cost Control
│   ├── [NEW v2] Fixed Asset Management
│   └── [NEW v2] Payables & Receivables Intelligence
│
├── 📈 Revenue Core Family
│   ├── Penjualan & Quotation [existing]
│   ├── CRM & Contacts [existing]
│   ├── [NEW v2] Commission & Incentive Management
│   └── [NEW v2] Subscription & Recurring Billing
│
├── 🛒 Operations Core
│   ├── Pembelian [existing]
│   ├── Inventori [existing]
│   └── Gudang (WMS) [existing]
│
├── 👥 HRIS Core
│   └── HRIS & Payroll [existing]
│
├── 🏭 Vertical Modules (pilih sesuai industri)
│   ├── Manufacturing [existing]
│   ├── Fleet & Rental [existing]
│   ├── Workshop & Service [existing]
│   ├── Job Order (Jasa) [existing]
│   ├── Project & Construction [existing]
│   ├── Syirkah (Islamic Partnership) [existing]
│   ├── LMS / Pelatihan [existing]
│   ├── [NEW v2] Omnichannel Commerce
│   ├── [NEW v2] Supply Chain Planning
│   ├── [NEW v2] Customer Success & Portal
│   ├── [NEW v2] Field Service Management
│   └── [NEW v2] ESG & Sustainability Reporting
│
├── ⚖️ Compliance Module
│   └── [NEW v2] Tax Compliance Engine (ID → MY → UAE → SG)
│
├── 🎓 Strategic Module
│   └── Academy / EDU [existing]
│
├── 💳 Growth Add-ons
│   ├── POS [existing]
│   ├── Sales Page [existing]
│   ├── Quick Bill [existing]
│   ├── Sales AR Cockpit [existing]
│   ├── Package Tracking [existing]
│   ├── [NEW v2] Payment Gateway Integration
│   ├── [NEW v2] WhatsApp Business Integration
│   ├── [NEW v2] Loyalty & Rewards Program
│   └── [NEW v2] AI Cashflow Advisor
│
├── 🤖 AI Productivity Add-ons
│   ├── [NEW v2] AI Purchase Assistant
│   ├── [NEW v2] Smart Invoice OCR
│   └── [NEW v2] Advanced Analytics & BI
│
├── ⚙️ Governance Add-ons
│   ├── [NEW v2] Approval Workflow Engine
│   ├── [NEW v2] Contract Management
│   └── [NEW v2] Document Management System
│
├── 🔧 Advanced Ops Add-ons
│   ├── Advanced WMS [existing]
│   ├── Fleet Maintenance Pack [existing]
│   ├── [NEW v2] Barcode & QR Inventory Scanner
│   ├── [NEW v2] Route & Delivery Optimization
│   └── [NEW v2] Predictive Maintenance
│
├── 🔌 Integration & Capacity Add-ons
│   ├── Open API & Webhooks [existing]
│   ├── Multi-Entity (PT/CV) [existing]
│   ├── [NEW v2] E-Commerce Auto-Sync
│   └── [NEW v2] Vendor Portal
│
└── 🚀 Capacity & Ecosystem Add-ons
    ├── [NEW v2] HR Self-Service Mobile (PWA)
    ├── [NEW v2] Franchise & Multi-Outlet Management
    └── [NEW v2] Training & Certification Marketplace
```

**Total: 73 kapabilitas (43 existing + 30 new)**

---

## 8. Segmentasi Customer & Paket Rekomendasi

### 8.1 Usaha Kecil & Retail (Revenue < Rp 5M/bulan)

**Profil:** 1–5 karyawan, operasional sederhana, butuh start cepat

**Paket Rekomendasi: NIZAM Lite + Add-ons**
- Base: Revenue Core + Inventory Core + Finance Core
- Essential Add-ons: POS, Quick Bill, Payment Gateway, WhatsApp Integration

**Pain yang Diselesaikan:**
- Tidak ada catatan penjualan yang rapi
- Invoice manual, tidak bisa terima bayar digital
- Tidak ada info stok real-time

**ARPU Target:** Rp 400.000–700.000/bulan

---

### 8.2 UKM Berkembang (Revenue Rp 5M–500M/bulan)

**Profil:** 10–50 karyawan, multi-divisi atau multi-cabang, butuh kontrol

**Paket Rekomendasi: NIZAM Basic/Pro + Key Add-ons**
- Base: Semua Core Families
- Governance: Approval Workflow, Budget & Cost Control
- Productivity: Smart Invoice OCR, Advanced Analytics
- Vertical: sesuai industri

**Pain yang Diselesaikan:**
- Kontrol pengeluaran tidak ada
- Approval tidak terlacak
- Laporan untuk keputusan tidak tersedia

**ARPU Target:** Rp 1.500.000–3.500.000/bulan

---

### 8.3 Perusahaan Menengah (Revenue > Rp 500M/bulan)

**Profil:** 50–500 karyawan, multi-entitas, butuh governance dan compliance

**Paket Rekomendasi: NIZAM Enterprise**
- Base: Semua Core Families + Tax Compliance + ESG
- Finance: Treasury & Multi-Currency + Fixed Asset Management
- Intelligence: Payables & Receivables Intel + AI Cashflow Advisor
- Capacity: Multi-Entity + Franchise Management (jika relevan)

**Pain yang Diselesaikan:**
- Tidak siap audit eksternal
- Budget tidak terkontrol
- Tidak ada visibilitas cashflow ke depan

**ARPU Target:** Rp 5.000.000–15.000.000/bulan

---

### 8.4 Bisnis E-Commerce & Omnichannel

**Profil:** Penjual di marketplace + toko fisik, butuh sinkronisasi data

**Paket Rekomendasi: NIZAM Commerce Bundle**
- Vertical: Omnichannel Commerce
- Add-ons: E-Commerce Auto-Sync, POS, Payment Gateway, Loyalty Program, WhatsApp

**Pain yang Diselesaikan:**
- Data marketplace tidak terintegrasi ke ERP
- Stok di online dan offline tidak sinkron
- Tidak ada analitik per channel

**ARPU Target:** Rp 800.000–2.000.000/bulan

---

### 8.5 Industri Regulated & Global-Ready

**Profil:** Perusahaan ekspor, tbk, atau yang bermitra dengan MNC

**Paket Rekomendasi: NIZAM Compliance**
- Module: ESG Reporting + Tax Compliance (multi-country)
- Governance: Contract Management + DMS + Approval Workflow + Vendor Portal
- Finance: Treasury & Multi-Currency

**Pain yang Diselesaikan:**
- Tidak memenuhi persyaratan ESG investor asing
- Tidak siap laporan due diligence
- Tidak ada multi-currency

**ARPU Target:** Rp 7.000.000–25.000.000/bulan

---

### 8.6 Bisnis dengan Basis Muslim (Indonesia, Malaysia, GCC, Afrika)

**Profil:** Butuh compliance Syariah, zakat, bagi hasil

**Paket Rekomendasi: NIZAM Syariah**
- Module: Syirkah (core) + Tax Compliance (Zakat business)
- Add-ons: Wakaf Management (future), Halal Compliance (future)
- Finance: Akuntansi dengan chart of accounts Syariah

**Pain yang Diselesaikan:**
- ERP konvensional tidak bisa handle riba tracking
- Tidak ada kalkulasi bagi hasil otomatis
- Tidak ada laporan zakat usaha

**Potensi Market:** 1,8 miliar Muslim global, estimasi TAM ERP Syariah >$10B

---

## 9. Differensiator Kompetitif Global

### 9.1 Versus SAP / Oracle (Enterprise ERP)

| Dimensi | SAP / Oracle | NIZAM |
|---|---|---|
| Time-to-value | 6–24 bulan | 2–8 minggu |
| Total cost (3 tahun) | Ratusan juta–miliaran | Puluhan juta/tahun |
| Kemudahan implementasi | Butuh konsultan mahal | Self-service + Academy |
| Syariah / Syirkah native | ❌ Tidak ada | ✅ Native module |
| Compliance lokal (DJP, BI, OJK) | Custom, mahal | ✅ Built-in |
| Time-to-new-module | 6–24 bulan | 2–6 minggu (marketplace) |
| Mobile-first | Terbatas | ✅ PWA-ready |

---

### 9.2 Versus Accurate / Jurnal (Akuntansi SaaS Lokal)

| Dimensi | Accurate / Jurnal | NIZAM |
|---|---|---|
| Scope | Akuntansi + Sales dasar | Full ERP platform |
| Vertical operations | ❌ Tidak ada | ✅ 6 business type verticals |
| AI capabilities | Minimal | ✅ OCR, Advisor, Purchasing AI |
| Ecosystem (Academy, Partner) | Minimal | ✅ Strategis |
| Multi-entity / holding | Terbatas | ✅ Native dengan konsolidasi |
| Islamic finance | ❌ Tidak ada | ✅ Syirkah, Zakat, Syariah CoA |

---

### 9.3 Versus Odoo (Open-Source ERP)

| Dimensi | Odoo | NIZAM |
|---|---|---|
| Kemudahan kustomisasi | Sangat tinggi tapi kompleks | ✅ Modular marketplace |
| Biaya total (TCO) | Tinggi (implementasi + hosting + consultant) | ✅ Terprediksi, all-in |
| Syariah & lokal compliance | Komunitas, tidak native | ✅ Native |
| Academy built-in | ❌ Tidak ada | ✅ Modul strategis |
| Support bahasa Indonesia | ❌ Tidak native | ✅ Native |
| Time-to-live | 3–12 bulan | ✅ 2–8 minggu |

---

### 9.4 Versus HashMicro / Bee Accounting (Regional SaaS)

| Dimensi | HashMicro / Bee | NIZAM |
|---|---|---|
| Syirkah / Bagi Hasil | ❌ | ✅ |
| Multi-entity + consolidation | Terbatas | ✅ Native |
| Marketplace module ecosystem | ❌ | ✅ |
| AI-native features | ❌ | ✅ (OCR, Advisor, Purchase AI) |
| Open API | Terbatas | ✅ Full REST + Webhook |
| Global Muslim market | ❌ | ✅ Positioning strategis |

---

## 10. Estimasi Potensi Revenue Per Kategori

*(Estimasi illustratif berbasis market sizing Indonesia + ekspansi regional)*

| Kategori | TAM Indonesia | NIZAM Achievable (3 tahun) | Est. ARR |
|---|---|---|---|
| Core ERP UKM | ~2 juta UKM layak | 50.000 tenant × Rp 2M/bulan | Rp 1,2T/tahun |
| Tax Compliance Module | ~900.000 PKP | 30.000 × Rp 349K/bulan (add-on) | Rp 125B/tahun |
| Omnichannel Commerce | ~500.000 penjual online aktif | 20.000 × Rp 400K/bulan | Rp 96B/tahun |
| HRIS + Payroll | ~3 juta perusahaan | 50.000 × Rp 300K/bulan | Rp 180B/tahun |
| Manufacturing Vertical | ~30.000 pabrik menengah | 3.000 × Rp 3M/bulan | Rp 108B/tahun |
| ESG Reporting | ~5.000 enterprise | 500 × Rp 5M/bulan | Rp 30B/tahun |
| Academy / Certification | Semua tenant + ekosistem | Revenue sharing + per-seat | Rp 20B/tahun |
| Syariah (Malaysia, GCC) | Muslim SME global | 5.000 × Rp 2M/bulan | Rp 120B/tahun |
| **TOTAL POTENTIAL ARR (3 thn)** | | | **~Rp 1,9 Triliun** |

---

## 11. Kesimpulan & Rekomendasi Tindakan

### 11.1 Tiga Modul Paling Kritis — Kerjakan Pertama

1. **Payment Gateway Integration (Add-on)**
   - Langsung unblock revenue collection; dampak terasa dalam 1 minggu setelah live
   - Semua tenant yang kirim invoice butuh ini
   - Effort rendah, impact tinggi

2. **Tax Compliance Engine (Module)**
   - Compliance obligation yang wajib — semua PKP harus siap e-Faktur
   - Immediate upsell ke 900K+ PKP existing dan new
   - Membuat NIZAM jadi "must-have" bukan "nice-to-have"

3. **Approval Workflow Engine (Add-on)**
   - Pain paling universal — semua segmen dan ukuran bisnis merasakan ini
   - Cross-module impact (PO, reimbursement, cuti, invoice credit)
   - Sticky feature — setelah pakai susah lepas

---

### 11.2 Tiga Modul Paling Strategis — Jangka Panjang

1. **Treasury & Multi-Currency**
   - Membuka pasar bisnis ekspor/impor yang selama ini tidak bisa dilayani
   - Foundation untuk ekspansi NIZAM ke Malaysia, UAE, dan Afrika

2. **Omnichannel Commerce**
   - Memasuki era commerce post-marketplace yang berkembang sangat cepat
   - Integrasi Tokopedia/Shopee = 70% e-commerce Indonesia

3. **ESG & Sustainability Reporting**
   - Positioning NIZAM sebagai enterprise-ready untuk IPO-ready company
   - Regulasi ESG global (EU CSRD, OJK SFDR-like) akan jadi mandatory 2027–2028

---

### 11.3 Empat Differensiator yang Harus Dijaga & Diperdalam

1. **Syirkah** — Tidak ada ERP lain yang punya ini secara native; pertahankan dan perluas ke Wakaf, Zakat Business, Halal Compliance
2. **Academy / EDU** — Bangun Training & Certification Marketplace; jadikan moat utama yang susah ditiru
3. **Local Compliance** (DJP e-Faktur, BI regulation, OJK) — Keunggulan yang tidak mudah ditiru ERP global
4. **AI-native dari awal** (OCR, Advisor, Purchase AI) — Adopsi AI sejak dini sebelum kompetitor catching up

---

### 11.4 Langkah Teknis Implementasi (Per Modul Baru)

Setiap modul/add-on baru di NIZAM harus melalui alur berikut:

```
1. Product Discovery (1 week)
   └── Customer interview + competitive analysis + wireframe

2. Architecture Review (3 days)
   └── Schema design + API design + module-registry entry + CoA injection plan

3. Database Migration (1 sprint)
   └── SQL migration file + RLS policies + org-scoped FK

4. Backend / Actions (1–3 sprint)
   └── Server actions + validation + tests (Vitest)

5. UI/UX (1–2 sprint)
   └── TailwindCSS + shadcn/ui + Framer Motion
   └── Marketplace onboarding step (CoA → Settings → Go Live)

6. QA & Security Review (1 sprint)
   └── Penetration test + audit trail check + permission test

7. Beta Release
   └── 5–10 pilot customers + feedback loop

8. General Release
   └── Pricing activation + marketplace listing + changelog
```

---

*Dokumen ini dibuat berdasarkan analisis mendalam terhadap branch `feat_multi` (commit `721fc78`), arsitektur produk NIZAM, dan pemetaan pain point customer global.*

*Update v2.0 dari v1.0 (16 Mei 2026): Tambah skor prioritas, implementasi roadmap 4-phase, database schema hints, arsitektur produk lengkap 73 kapabilitas, segmentasi customer 6 profil, dan rekomendasi langkah teknis per modul.*

*Untuk pertanyaan teknis atau product: tim engineering lihat `lib/saas/module-catalog.ts` dan `modules/marketplace/lib/module-registry.ts` sebagai reference implementasi.*
