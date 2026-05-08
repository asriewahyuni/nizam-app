# 🚀 NIZAM ERP — Roadmap Modul & Add-on Global
**Tanggal:** 8 Mei 2026  
**Branch:** feat_multi  
**Tujuan:** Menyelesaikan pain point pelanggan secara global

---

## 📋 Ringkasan Eksekutif

Nizam App saat ini memiliki fondasi ERP yang kuat dengan 21 modul aktif yang mencakup accounting, inventory, HR, sales, e-commerce, construction, factory, fleet, dan syirkah. Analisis gap terhadap kebutuhan pasar global menunjukkan **12 modul baru** dan **18 add-on strategis** yang dapat mendorong pertumbuhan signifikan — baik dari sisi retensi pengguna, ekspansi pasar, maupun ARR (Annual Recurring Revenue).

---

## 🗂️ Status Modul Existing

| Modul | Status | Kematangan |
|---|---|---|
| Accounting | ✅ Aktif | Matang |
| Cash & Bank | ✅ Aktif | Matang |
| Contacts / CRM | ✅ Aktif | Sedang |
| Dashboard | ✅ Aktif | Sedang |
| E-Commerce | ✅ Aktif | Sedang |
| Edu / Training | ✅ Aktif | Sedang |
| Factory / Produksi | ✅ Aktif | Sedang |
| Fleet / Armada | ✅ Aktif | Awal |
| HRIS | ✅ Aktif | Sedang |
| Inventory | ✅ Aktif | Matang |
| Marketplace Integration | ✅ Aktif | Awal |
| Purchasing | ✅ Aktif | Matang |
| Sales & POS | ✅ Aktif | Matang |
| Services / Job Order | ✅ Aktif | Sedang |
| Construction | ✅ Aktif | Awal |
| Syirkah | ✅ Aktif | Awal |
| SaaS / Billing | ✅ Aktif | Matang |
| AI Module | ✅ Aktif | Awal |
| Organization | ✅ Aktif | Matang |
| Settings & RBAC | ✅ Aktif | Matang |
| Reports | ✅ Aktif | Sedang |

---

## 🌍 Pain Point Pelanggan (Global Analysis)

### Tier 1 — Pain Point Kritis (Kehilangan Deal / Churn Tinggi)

| # | Pain Point | Segmen Terdampak | Frekuensi |
|---|---|---|---|
| 1 | Tidak ada manajemen aset tetap & depresiasi otomatis | Manufaktur, Properti, Logistik | Sangat Tinggi |
| 2 | Tidak ada modul multi-mata uang + kurs otomatis | Eksportir, Importir, Bisnis Global | Sangat Tinggi |
| 3 | Tidak ada pipeline CRM / Sales Funnel visual | Startup, Distributor, Agency | Tinggi |
| 4 | Tidak ada e-Faktur / Tax compliance lokal & global | Semua segmen wajib pajak | Sangat Tinggi |
| 5 | Tidak ada approval workflow multi-level | Enterprise, Korporat | Tinggi |
| 6 | Tidak ada budgeting & forecasting | Semua segmen | Tinggi |

### Tier 2 — Pain Point Pertumbuhan (Ekspansi & Upsell)

| # | Pain Point | Segmen Terdampak |
|---|---|---|
| 7 | Tidak ada manajemen proyek terintegrasi ERP | Konstruksi, IT, Konsultan |
| 8 | Tidak ada loyalty program / reward pelanggan | Retail, F&B, E-Commerce |
| 9 | Tidak ada integrasi WhatsApp untuk notifikasi transaksi | Semua segmen |
| 10 | Tidak ada manajemen kualitas / QC | Manufaktur, F&B, Farmasi |
| 11 | Tidak ada field service management | Teknis, Maintenance, Utilitas |
| 12 | Tidak ada manajemen garansi & after-sales | Elektronik, Otomotif |
| 13 | Tidak ada document management & e-signature | Legal, Keuangan, Properti |
| 14 | Tidak ada subscription billing untuk end-customer | SaaS internal pelanggan, Rental |

### Tier 3 — Diferensiasi Kompetitif (Premium Value)

| # | Pain Point |
|---|---|
| 15 | Tidak ada advanced BI / executive dashboard custom |
| 16 | Tidak ada demand forecasting berbasis AI |
| 17 | Tidak ada manajemen SLA & ticket support internal |
| 18 | Tidak ada integrasi marketplace internasional (Amazon, eBay) |

---

## 🆕 Modul Baru yang Direkomendasikan

---

### 1. 💰 Fixed Assets & Depreciation Management
**Pain Point:** #1 — Aset tetap dikelola manual di spreadsheet, depresiasi salah, laporan neraca tidak akurat.

**Fitur Utama:**
- Registrasi aset (nama, kategori, lokasi, nilai perolehan, umur ekonomis)
- Metode depresiasi: Garis Lurus, Saldo Menurun, SOYD
- Jadwal depresiasi otomatis dengan jurnal akuntansi terotomatisasi
- Transfer & disposal aset dengan pencatatan gain/loss
- Barcode/QR scan untuk pelacakan fisik aset
- Integrasi langsung ke modul Accounting (COA)
- Laporan: Daftar Aset, Kartu Aset, Schedule Depresiasi, Asset Register

**Integrasi:** Accounting, Inventory, Purchasing (untuk pembelian aset baru)

**Target Segmen:** Manufaktur, Properti, Logistik, Rumah Sakit, Hotel  
**Pricing Tier:** Add-on Premium (Rp 150.000–300.000/bulan)

---

### 2. 🌐 Multi-Currency & Exchange Rate Engine
**Pain Point:** #2 — Bisnis ekspor-impor harus manual konversi kurs, selisih kurs tidak ter-capture di jurnal.

**Fitur Utama:**
- Setup multi-mata uang per organisasi (IDR, USD, SGD, MYR, EUR, dll.)
- Integrasi kurs otomatis via API (Bank Indonesia, ECB, Open Exchange Rates)
- Kurs terkunci per transaksi vs kurs harian
- Realisasi & unrealisasi gain/loss otomatis
- Laporan dalam mata uang fungsional dan pelaporan
- Multi-currency di Sales, Purchasing, Cash, Accounting
- Rekonsiliasi kurs antar periode

**Integrasi:** Accounting, Sales, Purchasing, Cash  
**Target Segmen:** Eksportir, Importir, Holding multinasional  
**Pricing Tier:** Add-on Premium (Rp 200.000–400.000/bulan)

---

### 3. 🎯 CRM Pipeline & Sales Funnel
**Pain Point:** #3 — Tim sales tidak punya visibilitas pipeline, deal tracking manual, forecast revenue tidak akurat.

**Fitur Utama:**
- Kanban board pipeline (Lead → Prospek → Proposal → Negosiasi → Deal/Lost)
- Scoring prospek berbasis aktivitas
- Aktivitas & follow-up reminder (call, meeting, email, WA)
- Integrasi penawaran (Quotation) dari modul Sales langsung di pipeline
- Analitik: Win rate, Average Deal Size, Sales Cycle Length, Revenue Forecast
- Assignment ke sales person, target tracking
- Integrasi dengan modul Contacts
- Email template & sequence automation

**Integrasi:** Contacts, Sales, HRIS (komisi)  
**Target Segmen:** Distributor, Agency, B2B sales-driven  
**Pricing Tier:** Core Plus (Rp 100.000–250.000/bulan)

---

### 4. 🧾 Tax Compliance & e-Invoicing
**Pain Point:** #4 — Pembuatan e-Faktur manual, rawan salah NPWP, tidak terintegrasi ke laporan PPN.

**Fitur Utama:**
- **Indonesia:** Integrasi e-Faktur Pajak (DJP Online API / Coretax)
- **Malaysia:** e-Invoice MyInvois (LHDN)
- **Global:** Compliance VAT, GST
- Validasi NPWP/TIN otomatis sebelum invoice diterbitkan
- Generate XML/JSON e-Faktur dari invoice sales
- Rekap SPT Masa PPN otomatis
- Tax code mapping per produk/layanan
- Ekspor laporan Faktur Pajak Keluaran & Masukan

**Integrasi:** Sales, Purchasing, Accounting  
**Target Segmen:** Semua PKP (Pengusaha Kena Pajak), perusahaan multinasional  
**Pricing Tier:** Add-on Wajib Pasar (Rp 100.000–200.000/bulan)

---

### 5. ✅ Approval Workflow Engine
**Pain Point:** #5 — Approval PO, expense, cuti, dan invoice masih via WhatsApp/email, tidak ada audit trail.

**Fitur Utama:**
- Builder workflow visual (drag-and-drop kondisi & approval step)
- Multi-level approver (berdasarkan role, nilai transaksi, departemen)
- Delegasi approval saat approver tidak tersedia
- Notifikasi real-time (in-app, email, WhatsApp)
- Audit trail lengkap per dokumen
- Deadline & eskalasi otomatis
- Integrasi ke semua modul transaksi (PO, Sales Order, Expense, Leave, Invoice)

**Integrasi:** Purchasing, Sales, HRIS, Accounting, Services  
**Target Segmen:** Enterprise, multi-departemen, korporat  
**Pricing Tier:** Add-on Strategis (Rp 150.000–300.000/bulan)

---

### 6. 📊 Budgeting & Financial Forecasting
**Pain Point:** #6 — Tidak ada kontrol anggaran, realisasi vs budget hanya diketahui saat laporan akhir bulan.

**Fitur Utama:**
- Input budget per departemen, per COA, per periode
- Budget vs Actual real-time di setiap transaksi
- Alert saat realisasi mendekati/melebihi budget
- Rolling forecast berbasis tren historis
- Scenario planning (best case, base case, worst case)
- Approval budget tahunan dengan revision tracking
- Export ke Excel untuk board presentation

**Integrasi:** Accounting, HRIS, Purchasing, Sales  
**Target Segmen:** Semua ukuran bisnis (SME ke Enterprise)  
**Pricing Tier:** Add-on Penting (Rp 100.000–250.000/bulan)

---

### 7. 📁 Project Management (Terintegrasi ERP)
**Pain Point:** #7 — Proyek dikelola di tool terpisah (Trello, Asana), biaya proyek tidak terhubung ke akuntansi.

**Fitur Utama:**
- Manajemen proyek dengan Gantt Chart dan Kanban
- WBS (Work Breakdown Structure) hingga task level
- Resource allocation (SDM, material, peralatan)
- Cost tracking per proyek (tenaga kerja, material, subkon)
- Billing proyek (progress billing, milestone billing)
- Integrasi Construction dan Services module
- Laporan: Project Profitability, Variance Analysis, Resource Utilization

**Integrasi:** Construction, Factory, Services, HRIS, Accounting, Inventory  
**Target Segmen:** Konstruksi, IT consulting, EPC, Event organizer  
**Pricing Tier:** Add-on Premium (Rp 200.000–400.000/bulan)

---

### 8. 🎁 Loyalty & Reward Program
**Pain Point:** #8 — Tidak ada program loyalitas, pelanggan tidak ada insentif untuk repeat order.

**Fitur Utama:**
- Setup program poin (earn & redeem)
- Tier member (Silver, Gold, Platinum) berbasis spending
- Reward: diskon, voucher, cashback, free item
- Birthday reward otomatis
- Referral program dengan tracking
- Integrasi POS dan E-Commerce untuk akumulasi poin
- Dashboard analitik: CLV, Retention Rate, Most Loyal Customers

**Integrasi:** Sales, POS, E-Commerce, Contacts  
**Target Segmen:** Retail, F&B, Beauty, Fashion  
**Pricing Tier:** Add-on Growth (Rp 100.000–200.000/bulan)

---

### 9. 💬 WhatsApp & Omnichannel Notification
**Pain Point:** #9 — Notifikasi transaksi hanya via email yang sering tidak terbaca. Pelanggan minta konfirmasi via WA.

**Fitur Utama:**
- Integrasi WhatsApp Business API (resmi Meta)
- Kirim notifikasi otomatis: invoice, PO, approval request, status order
- Template WA pesan transaksi (invoice, delivery, payment reminder)
- Chatbot WA untuk cek status order pelanggan
- Inbox terpusat: WA, email, in-app notification
- Blast pesan ke segmen pelanggan (marketing)
- Integrasi dengan Loyalty module untuk broadcast reward

**Integrasi:** Sales, Purchasing, E-Commerce, CRM, Loyalty  
**Target Segmen:** Semua segmen (terutama UMKM dan retail)  
**Pricing Tier:** Add-on Komunikasi (Rp 100.000–300.000/bulan + biaya per pesan WA)

---

### 10. 🔍 Quality Management (QC/QA)
**Pain Point:** #10 — Tidak ada pencatatan inspeksi kualitas, produk cacat lolos tanpa track record.

**Fitur Utama:**
- Quality control checklist per produk/proses
- Inspection point: incoming, in-process, outgoing
- NCR (Non-Conformance Report) dan CAPA (Corrective Action)
- SPC (Statistical Process Control) chart
- Sertifikasi batch dan lot tracking
- Supplier quality scorecard
- Integrasi Factory (produksi), Inventory (lot/batch), Purchasing (incoming QC)

**Integrasi:** Factory, Inventory, Purchasing, Services  
**Target Segmen:** Manufaktur, F&B, Farmasi, Elektronik  
**Pricing Tier:** Add-on Industri (Rp 150.000–300.000/bulan)

---

### 11. 🔧 Field Service Management (FSM)
**Pain Point:** #11 — Teknisi lapangan tidak terhubung ke sistem, laporan kunjungan manual.

**Fitur Utama:**
- Dispatch dan scheduling teknisi (drag-and-drop kalender)
- Mobile app untuk teknisi: checkin, foto, signature pelanggan
- Work order dengan SLA tracking
- Parts request & consumption dari gudang
- GPS tracking real-time posisi teknisi
- Customer rating per kunjungan
- Invoicing otomatis setelah service selesai

**Integrasi:** Services, Inventory, HRIS, Fleet, Accounting  
**Target Segmen:** HVAC, Elektronik, Utilitas, Telekomunikasi, Otomotif  
**Pricing Tier:** Add-on Operasional (Rp 150.000–350.000/bulan)

---

### 12. 🤖 AI Business Intelligence & Predictive Analytics
**Pain Point:** #16 & #15 — Data banyak tapi tidak bisa diubah jadi insight actionable.

**Fitur Utama:**
- Natural language query: "Berapa revenue bulan lalu dibanding tahun lalu?" → langsung jawaban
- Demand forecasting untuk inventory (mengurangi stockout & overstock)
- Churn prediction pelanggan berbasis pola pembelian
- Anomaly detection untuk transaksi mencurigakan
- Executive AI summary harian/mingguan otomatis ke WhatsApp/email
- Rekomendasi upsell/cross-sell berbasis histori transaksi
- Cash flow forecasting 30/60/90 hari ke depan

**Integrasi:** Semua modul (AI overlay)  
**Target Segmen:** Semua (terutama manajemen level atas)  
**Pricing Tier:** Add-on Premium AI (Rp 300.000–600.000/bulan)

---

## 🔌 Add-on Strategis untuk Modul Existing

| # | Add-on | Modul Dasar | Value |
|---|---|---|---|
| 1 | **e-Faktur Pajak Indonesia** | Sales, Purchasing | Compliance wajib PKP |
| 2 | **Payroll BPJS & PPh 21 Calculator** | HRIS | Compliance HR Indonesia |
| 3 | **Shopee/Tokopedia/Lazada Sync** | Marketplace, Inventory | Sinkron stok & order |
| 4 | **Amazon/eBay Global Sync** | Marketplace, Inventory | Ekspansi global |
| 5 | **Barcode & Label Printing** | Inventory, Factory | Operasional gudang |
| 6 | **Serial Number & Lot Tracking** | Inventory, Factory | Manufaktur & farmasi |
| 7 | **Multi-Warehouse Advanced** | Inventory | Transfer antar gudang |
| 8 | **Route Planning & Delivery** | Fleet, Sales | Optimasi pengiriman |
| 9 | **Recurring Invoice / Subscription** | Sales, Accounting | Model bisnis berlangganan |
| 10 | **Digital Signature (e-Sign)** | Sales, Purchasing, Syirkah | Efisiensi dokumen legal |
| 11 | **Bank Reconciliation Auto-Import** | Cash, Accounting | Hemat 80% waktu rekonsiliasi |
| 12 | **Custom Report Builder** | Reports | Laporan ad-hoc tanpa developer |
| 13 | **Multi-Branch Consolidation** | Accounting, Dashboard | Laporan konsolidasi holding |
| 14 | **Biometric Attendance Integration** | HRIS | Presisi absensi |
| 15 | **Commission Calculator Advanced** | Sales, HRIS | Motivasi tim penjualan |
| 16 | **Property / Unit Management** | Services, Inventory | Properti & kos-kosan |
| 17 | **Food & Beverage Recipe Management** | Factory, Inventory | Restoran & FMCG |
| 18 | **Rental & Asset Booking** | Fleet, Inventory | Bisnis rental |

---

## 🗺️ Roadmap Implementasi

### Q3 2026 — Quick Wins (Time to Value ≤ 2 bulan)
| Prioritas | Modul/Add-on | Effort | Impact |
|---|---|---|---|
| 🔴 P1 | e-Faktur / Tax Compliance | M | Very High |
| 🔴 P1 | Approval Workflow Engine | M | High |
| 🔴 P1 | Payroll BPJS & PPh 21 | S | High |
| 🟡 P2 | Recurring Invoice / Subscription | S | Medium |
| 🟡 P2 | Bank Reconciliation Auto-Import | S | High |
| 🟡 P2 | Barcode & Label Printing | S | Medium |

### Q4 2026 — Core Expansion (Time to Value 2-4 bulan)
| Prioritas | Modul/Add-on | Effort | Impact |
|---|---|---|---|
| 🔴 P1 | Budgeting & Forecasting | M | Very High |
| 🔴 P1 | Fixed Assets & Depreciation | M | Very High |
| 🔴 P1 | CRM Pipeline & Sales Funnel | L | High |
| 🟡 P2 | WhatsApp Notification Integration | M | High |
| 🟡 P2 | Shopee/Tokopedia/Lazada Full Sync | M | High |
| 🟡 P2 | Serial Number & Lot Tracking | M | Medium |

### Q1 2027 — Growth Modules (Time to Value 3-5 bulan)
| Prioritas | Modul/Add-on | Effort | Impact |
|---|---|---|---|
| 🔴 P1 | Multi-Currency Engine | L | Very High |
| 🔴 P1 | Project Management ERP | L | High |
| 🟡 P2 | Loyalty & Reward Program | M | High |
| 🟡 P2 | Quality Management (QC/QA) | M | Medium |
| 🟡 P2 | Custom Report Builder | M | High |

### Q2 2027 — Premium Differentiators
| Prioritas | Modul/Add-on | Effort | Impact |
|---|---|---|---|
| 🔴 P1 | AI BI & Predictive Analytics | L | Very High |
| 🟡 P2 | Field Service Management | L | High |
| 🟡 P2 | Multi-Branch Consolidation | M | High |
| 🟢 P3 | Amazon/eBay Global Sync | L | Medium |

---

## 💡 Estimasi Dampak Revenue

| Kategori | Modul Baru | Add-on | Estimasi ARR Tambahan |
|---|---|---|---|
| Compliance (wajib) | e-Faktur, Tax | BPJS/PPh | Rp 2–5 M/tahun |
| Operasional kritis | Fixed Assets, Budget | Bank Recon, Barcode | Rp 3–7 M/tahun |
| Growth modules | CRM, Loyalty, WA | Shopee/Tokopedia sync | Rp 4–8 M/tahun |
| Premium AI | AI BI, Forecasting | – | Rp 5–12 M/tahun |
| **Total Potensi** | | | **Rp 14–32 M/tahun** |

*Asumsi: 200–500 tenant aktif pada akhir 2027, penetrasi add-on 30–60%*

---

## 🎯 Rekomendasi Strategis

### 1. Compliance First Strategy
Mulai dari **e-Faktur** dan **BPJS/PPh 21** — ini bukan pilihan bagi pelanggan, ini kewajiban. Menjadi ERP yang selesaikan compliance lokal = **sticky product** yang sulit dicabut.

### 2. Land and Expand dengan Add-on
Jual paket core dengan harga kompetitif, tawarkan add-on bertahap. Model ini terbukti di HubSpot, Salesforce, dan Xero. Nizam bisa replikasi di pasar Indonesia dan Asia Tenggara.

### 3. AI sebagai Diferensiasi Jangka Panjang
Modul AI sudah ada di codebase. Arahkan ke **decision support** yang nyata: "Stok mana yang harus di-reorder minggu ini?" bukan sekadar chatbot.

### 4. Vertikal Fokus: Manufaktur + Retail
Dua vertikal ini punya willingness-to-pay tertinggi di Indonesia dan sudah ada fondasi (Factory + Inventory + POS). Lengkapi dengan QC, Fixed Assets, dan Lot Tracking untuk dominasi segmen ini.

### 5. Ecosystem Play
Marketplace sync (Shopee, Tokopedia) dan WhatsApp integration adalah **table stakes** di Indonesia 2026. Tanpa ini, banyak UMKM tidak akan pindah dari solusi yang lebih sederhana.

---

## 📌 Kesimpulan

Nizam ERP memiliki fondasi teknis yang sangat solid untuk berkompetisi di level enterprise. Dengan menambahkan **12 modul baru** dan **18 add-on strategis** yang diurutkan berdasarkan pain point global, Nizam berpotensi:

- Meningkatkan **NRR (Net Revenue Retention)** dari ~100% ke 120-130%
- Menurunkan **churn** karena compliance modules membuat produk wajib dipakai
- Membuka **segmen enterprise** dengan Project Management, Multi-currency, dan Approval Workflow
- Memperkuat posisi di **pasar Asia Tenggara** dengan tax compliance multi-negara

**Langkah segera:** Kickoff e-Faktur + Approval Workflow + Fixed Assets di Q3 2026.

---

*Dokumen ini dibuat berdasarkan analisis codebase branch `feat_multi` tanggal 8 Mei 2026.*
*Contact: nizamcore_bot | @asriewahyuni*
