# NIZAM ERP — Roadmap Modul & Add-on Global
## Dokumen Perencanaan Produk: Mengatasi Pain Point Pelanggan Secara Global

---

## Metadata Dokumen

| Field | Nilai |
|---|---|
| Versi | `2.0` |
| Tanggal | `24 Mei 2026` |
| Dasar Analisis | Branch `feat_multi` — arsitektur 4 pilar + business type + add-on |
| Tujuan | Memetakan modul & add-on baru yang menyelesaikan pain point customer secara global |
| Status | `Draft untuk Review Produk` |

---

## 1. Ringkasan Eksekutif

NIZAM saat ini telah memiliki fondasi ERP yang kuat dengan 3 lapisan utama:

- **Platform Core** — fondasi tenant, auth, dan governance
- **Core ERP Families** — Finance, Revenue, Purchasing, Inventory, HRIS
- **Vertical Modules** — Manufacturing, Fleet, Service Ops, Project & Construction, Syirkah

Namun terdapat **gap strategis** yang signifikan antara kapabilitas NIZAM saat ini dengan ekspektasi pasar global. Dokumen ini mengidentifikasi **11 modul baru** dan **14 add-on baru** yang secara langsung menjawab pain point utama customer di pasar Indonesia dan global.

---

## 2. Metodologi Analisis

### 2.1 Sumber Data Pain Point

Pain point dikumpulkan dari beberapa sumber:

1. **Analisis gap** terhadap modul yang sudah ada di `feat_multi`
2. **Benchmark kompetitor** — Odoo, SAP Business One, Xero, QuickBooks, Accurate, Jurnal.id
3. **Kebutuhan pasar lokal** — integrasi ekosistem Indonesia (marketplace, e-faktur, WhatsApp)
4. **Tren global ERP** — AI/automation, omnichannel, subscription economy, compliance
5. **Pola bisnis yang belum terlayani** — aset, properti, klinik, subscription, loyalty

### 2.2 Kriteria Prioritas

Setiap modul/add-on dinilai berdasarkan:

| Dimensi | Keterangan |
|---|---|
| **Customer Impact** | Seberapa banyak customer terbantu |
| **Revenue Potential** | Potensi ACV tambahan |
| **Build Complexity** | Tingkat kesulitan implementasi |
| **Strategic Fit** | Kecocokan dengan arsitektur NIZAM |
| **Market Urgency** | Seberapa cepat pasar butuh ini |

---

## 3. Pain Point Global yang Belum Terlayani

### 3.1 Pain Point Bisnis Umum (Universal)

| # | Pain Point | Dampak | Segment |
|---|---|---|---|
| P01 | Tidak bisa melacak aset tetap & depresiasinya | Laporan keuangan tidak akurat | Semua bisnis |
| P02 | Tidak ada multi-currency untuk transaksi internasional | Tidak bisa ekspansi cross-border | Bisnis ekspor-impor |
| P03 | Anggaran dibuat di Excel, tidak terintegrasi ERP | Tidak ada kontrol belanja real-time | Semua bisnis |
| P04 | Tidak ada manajemen langganan & tagihan berulang | Revenue bocor, renewal manual | SaaS, subscription bisnis |
| P05 | Tidak ada program loyalitas pelanggan terintegrasi | Customer churn tinggi | Retail, F&B, layanan |
| P06 | Tidak ada after-sales & warranty management | Keluhan pelanggan tidak terkelola | Elektronik, otomotif, alat berat |
| P07 | Manajemen dokumen & tanda tangan masih manual | Proses kontrak lambat, kertas boros | Semua bisnis |
| P08 | Tidak ada quality control & pengendalian mutu | Produk cacat tidak terdeteksi dini | Manufaktur, distributor, F&B |
| P09 | Integrasi dengan marketplace online masih manual | Input double, stok tidak sinkron | Retail, distributor |
| P10 | Laporan & analitik terbatas, tidak ada drill-down | Keputusan bisnis lambat & berbasis intuisi | Semua bisnis |

### 3.2 Pain Point Industri Spesifik

| # | Pain Point | Dampak | Segment |
|---|---|---|---|
| P11 | Tidak ada manajemen properti & unit sewa | Kearsipan manual, collection molor | Properti, real estate |
| P12 | Klinik tidak punya sistem rekam medis terintegrasi billing | Admin & dokter kerja double | Klinik, dokter praktek |
| P13 | E-commerce channel banyak tapi tidak terintegrasi | Stok oversell, laporan terpencar | Seller online |
| P14 | Tidak ada ESS untuk karyawan — cuti, klaim, slip gaji | HR overloaded, karyawan tidak puas | Bisnis dengan SDM besar |
| P15 | Tidak ada notifikasi otomatis via WhatsApp | Tagihan terlambat, reminder manual | Semua bisnis |
| P16 | Tax & e-Faktur masih manual, error tinggi | Denda pajak, audit berisiko | Bisnis PKP di Indonesia |
| P17 | Field team tidak bisa akses ERP dari luar kantor | Data lapangan tidak real-time | Konstruksi, distribusi, servis |
| P18 | Tidak ada customer self-service portal | CS overloaded, respons lambat | B2B services |
| P19 | Pengelolaan dana sosial/zakat/waqf tidak terstruktur | Kepatuhan syariah tidak terdokumentasi | Bisnis berbasis syariah |
| P20 | Tidak ada AI untuk deteksi anomali & rekomendasi | Fraud tidak terdeteksi, insight terlambat | Semua bisnis |

---

## 4. Modul Baru yang Diusulkan

### Kriteria Modul
Sebuah capability ditetapkan sebagai **Modul** jika memenuhi:
- Memiliki objek data utama sendiri
- Memiliki alur kerja end-to-end sendiri
- Memiliki persona operator yang jelas
- Cukup besar untuk punya SOP, onboarding, dan sertifikasi sendiri

---

### M01 — Asset Management (Manajemen Aset Tetap)

**Kategori:** Core ERP Extension
**Priority:** 🔴 Critical
**Target Core Family:** Starter+

**Pain Point yang Diselesaikan:** P01

**Deskripsi:**
Modul pengelolaan aset tetap perusahaan secara penuh — dari akuisisi, pencatatan, penyusutan (depreciation), pemeliharaan, hingga disposal. Terintegrasi langsung ke Finance Core untuk jurnal otomatis.

**Fitur Utama:**
- Register aset tetap (tanah, gedung, kendaraan, mesin, peralatan IT)
- Metode penyusutan: Straight-Line, Declining Balance, Unit of Production
- Jurnal penyusutan otomatis & terjadwal
- Revaluasi aset & impairment
- Pelacakan lokasi & penugasan aset ke divisi/karyawan
- Siklus pemeliharaan terjadwal (preventif & korektif)
- Disposal & penjualan aset dengan jurnal otomatis
- Laporan: Daftar Aset, Jadwal Penyusutan, Net Book Value

**Dependency:**
- Finance Core (wajib)
- Purchasing (disarankan — untuk proses akuisisi aset)

**Tabel Database Utama:**
```
fixed_assets, asset_categories, asset_depreciation_schedules,
asset_maintenance_logs, asset_disposals, asset_locations
```

**Integrasi:**
- CoA → akun aset tetap, akumulasi penyusutan, beban penyusutan
- Journal Entry → jurnal otomatis per periode

---

### M02 — Budget & Financial Planning (Anggaran & Perencanaan Keuangan)

**Kategori:** Finance Core Extension
**Priority:** 🔴 Critical
**Target Core Family:** Starter+

**Pain Point yang Diselesaikan:** P03

**Deskripsi:**
Modul perencanaan anggaran yang terintegrasi dengan Finance Core. Memungkinkan bisnis membuat anggaran, memantau realisasi vs rencana, dan melakukan analisis varians secara real-time.

**Fitur Utama:**
- Pembuatan anggaran per periode (bulanan, kuartalan, tahunan)
- Anggaran per departemen / cost center / proyek
- Anggaran per akun CoA (linked ke chart of accounts)
- Workflow persetujuan anggaran (draft → submit → approve → active)
- Monitoring realisasi vs anggaran real-time
- Analisis varians dengan drill-down ke transaksi
- Revisi anggaran & versi historis
- Forecasting otomatis berbasis tren historis
- Laporan: Budget vs Actual, Variance Analysis, Budget Utilization

**Dependency:**
- Finance Core + Accounting (wajib)
- Departemen/Divisi (Platform Core)

**Tabel Database Utama:**
```
budgets, budget_lines, budget_versions, budget_approvals,
budget_realizations, budget_variance_logs
```

---

### M03 — Multi-Currency & Forex Management

**Kategori:** Finance Core Extension
**Priority:** 🟠 High
**Target Core Family:** Starter+

**Pain Point yang Diselesaikan:** P02

**Deskripsi:**
Modul pengelolaan multi-mata uang untuk transaksi internasional, ekspor-impor, dan bisnis lintas negara. Mendukung konversi kurs otomatis, revaluasi, dan pelaporan keuangan konsolidasi multi-currency.

**Fitur Utama:**
- Master mata uang & kurs harian (manual atau auto via API kurs)
- Transaksi penjualan, pembelian, kas/bank dalam mata uang asing
- Realisasi kurs saat pembayaran (realized gain/loss)
- Revaluasi kurs akhir periode (unrealized gain/loss)
- Pelaporan keuangan dalam mata uang fungsional (IDR) dan presentasi (USD, SGD, dll)
- Konsolidasi multi-currency untuk bisnis multi-entitas

**Dependency:**
- Finance Core + Accounting (wajib)
- Sales / Purchasing (untuk transaksi FC)

**Tabel Database Utama:**
```
currencies, exchange_rates, exchange_rate_sources,
forex_revaluation_logs, forex_realized_gains
```

---

### M04 — Loyalty & Membership (Program Loyalitas & Keanggotaan)

**Kategori:** Revenue Core Extension
**Priority:** 🟠 High
**Target Core Family:** Lite+

**Pain Point yang Diselesaikan:** P05

**Deskripsi:**
Modul program loyalitas terintegrasi untuk mempertahankan pelanggan. Mendukung sistem poin, tier member, reward redeem, dan kampanye retensi berbasis perilaku pembelian.

**Fitur Utama:**
- Konfigurasi program poin (earn rate per transaksi, produk, channel)
- Tier member (Bronze, Silver, Gold, Platinum) dengan benefit berbeda
- Redeem poin sebagai diskon atau voucher
- Referral program dengan poin reward otomatis
- Member card digital & barcode
- Riwayat poin & transaksi per member
- Kampanye poin bonus (double point hari tertentu, event khusus)
- Integrasi langsung ke POS & Sales untuk redeem di kasir
- Dashboard analis: retention rate, member growth, poin outstanding
- Notifikasi jatuh tempo poin via WhatsApp/email

**Dependency:**
- Sales + CRM (wajib)
- POS (disarankan untuk redeem di kasir)

**Tabel Database Utama:**
```
loyalty_programs, loyalty_tiers, loyalty_members,
loyalty_point_ledgers, loyalty_rewards, loyalty_redemptions,
loyalty_campaigns
```

---

### M05 — After-Sales & Warranty Management

**Kategori:** Revenue / Service Extension
**Priority:** 🟠 High
**Target Core Family:** Lite+

**Pain Point yang Diselesaikan:** P06

**Deskripsi:**
Modul pengelolaan layanan purna jual — garansi produk, klaim garansi, perbaikan, penggantian unit, dan pelacakan kepuasan pelanggan pasca-pembelian. Relevan untuk bisnis elektronik, otomotif, alat berat, dan produk bergaransi.

**Fitur Utama:**
- Registrasi garansi produk per serial number / nomor seri
- Konfigurasi jenis garansi (pabrikan, toko, extended warranty)
- Pencatatan klaim garansi (normal, out-of-warranty, paid service)
- Work Order perbaikan terintegrasi dengan inventory suku cadang
- SLA tracking — respons time, resolusi time
- Eskalasi otomatis jika SLA terlampaui
- Return Merchandise Authorization (RMA) workflow
- Portal pelacakan klaim untuk pelanggan
- Laporan: claim rate per produk, biaya garansi, SLA compliance

**Dependency:**
- Sales / Inventory (wajib)
- Service Operations (disarankan)

**Tabel Database Utama:**
```
warranty_registrations, warranty_claims, warranty_work_orders,
warranty_sla_configs, rma_requests, warranty_parts_usage
```

---

### M06 — Subscription & Recurring Billing

**Kategori:** Revenue Core Extension
**Priority:** 🟠 High
**Target Core Family:** Lite+

**Pain Point yang Diselesaikan:** P04

**Deskripsi:**
Modul pengelolaan bisnis berbasis langganan dan tagihan berulang. Ideal untuk SaaS, layanan berlangganan, kontrak maintenance, dan bisnis dengan model recurring revenue.

**Fitur Utama:**
- Master paket langganan (plan management)
- Siklus tagihan: bulanan, kuartalan, tahunan
- Auto-renewal & cancel workflow
- Prorated billing (tagihan proporsional saat upgrade/downgrade)
- Grace period & dunning management (pengingat tagihan jatuh tempo)
- Churn analysis & retention score
- MRR / ARR dashboard (Monthly / Annual Recurring Revenue)
- Integrasi payment gateway untuk auto-charge
- Laporan: subscriber growth, churn rate, MRR movement

**Dependency:**
- Sales + Finance Core (wajib)
- Billing SaaS (platform context)

**Tabel Database Utama:**
```
subscription_plans, subscriptions, subscription_invoices,
subscription_payments, dunning_logs, mrr_snapshots
```

---

### M07 — Quality Control & Management (QC/QM)

**Kategori:** Operations Core Extension
**Priority:** 🟠 High
**Target Core Family:** Starter+

**Pain Point yang Diselesaikan:** P08

**Deskripsi:**
Modul pengendalian mutu end-to-end untuk bisnis manufaktur, distributor, dan F&B. Memastikan standar kualitas terpenuhi di setiap titik — penerimaan barang, proses produksi, hingga pengiriman ke pelanggan.

**Fitur Utama:**
- Checklist pemeriksaan mutu (QC Checklist) per produk/kategori
- Inspeksi penerimaan barang (Incoming Inspection) terintegrasi Purchasing
- In-Process Inspection selama produksi (integrasi Manufacturing)
- Final Inspection sebelum pengiriman (integrasi Sales/Inventory)
- Pencatatan non-conformance (NCR) dan tindakan korektif (CAPA)
- Batch/lot traceability & expiry tracking
- Sertifikat analisis / Certificate of Analysis (CoA) produk
- Hold & Release workflow untuk produk yang gagal inspeksi
- Laporan: defect rate, rejection rate, CAPA closure rate

**Dependency:**
- Inventory (wajib)
- Manufacturing (sangat disarankan)
- Purchasing (untuk incoming inspection)

**Tabel Database Utama:**
```
qc_checklists, qc_inspections, qc_inspection_lines,
non_conformance_reports, capa_actions, batch_quality_records
```

---

### M08 — Property & Real Estate Management

**Kategori:** Vertical Module (Industri)
**Priority:** 🟡 Medium
**Target Core Family:** Starter+

**Pain Point yang Diselesaikan:** P11

**Deskripsi:**
Modul manajemen properti untuk bisnis real estate, kost-kostan, apartemen, ruko, dan gedung perkantoran. Mendukung pengelolaan unit, perjanjian sewa, tagihan berkala, dan pemeliharaan gedung.

**Fitur Utama:**
- Master properti & unit (gedung, lantai, unit per lantai)
- Perjanjian sewa (Lease Agreement) dengan tanggal mulai-akhir
- Penagihan sewa otomatis (bulanan/kuartalan)
- Pembayaran sewa & pelacakan tunggakan
- Renewal & terminasi kontrak sewa
- Deposit management (penerimaan & pengembalian)
- Work order pemeliharaan gedung & unit
- Laporan okupansi, laporan pendapatan sewa, aging piutang sewa
- Integrasi Finance Core untuk jurnal sewa otomatis

**Dependency:**
- Finance Core + Revenue Core (wajib)
- Purchasing (untuk biaya pemeliharaan)

**Tabel Database Utama:**
```
properties, property_units, lease_agreements,
lease_invoices, lease_payments, tenant_deposits,
property_maintenance_orders
```

---

### M09 — Healthcare & Clinic Management

**Kategori:** Vertical Module (Industri)
**Priority:** 🟡 Medium
**Target Core Family:** Lite+

**Pain Point yang Diselesaikan:** P12

**Deskripsi:**
Modul manajemen klinik dan praktik dokter yang ringan namun komprehensif. Mendukung registrasi pasien, rekam medis sederhana, antrian, penagihan, farmasi, dan laporan kunjungan.

**Fitur Utama:**
- Registrasi & master data pasien
- Manajemen antrian (walk-in & appointment)
- Rekam medis sederhana (SOAP notes, diagnosis ICD-10, tindakan)
- Resep & farmasi terintegrasi inventory obat
- Penagihan pasien (umum, BPJS, asuransi)
- Manajemen dokter & jadwal praktik
- Laporan kunjungan, diagnosa terbanyak, pendapatan per dokter
- Cetak rekam medis & surat rujukan

**Dependency:**
- Sales / Finance Core (untuk penagihan)
- Inventory (untuk farmasi/obat)

**Tabel Database Utama:**
```
patients, medical_records, diagnoses, prescriptions,
clinic_queues, clinic_appointments, clinic_invoices,
doctor_schedules
```

---

### M10 — Document Management & E-Signature

**Kategori:** Platform Capability Extension
**Priority:** 🟠 High
**Target Core Family:** Lite+

**Pain Point yang Diselesaikan:** P07

**Deskripsi:**
Modul manajemen dokumen terpusat dengan kemampuan tanda tangan digital. Menggantikan proses dokumen manual dan mempercepat persetujuan kontrak, PO, NDA, dan dokumen bisnis lainnya.

**Fitur Utama:**
- Repository dokumen terpusat (kontrak, PO, MOU, NDA, dll)
- Template dokumen dengan variabel dinamis
- Workflow approval multi-level
- Tanda tangan digital (e-signature) — internal & external signer
- Audit trail tanda tangan (siapa menandatangani, kapan, dari IP mana)
- Reminder dan deadline dokumen
- Versioning dokumen
- Integrasi ke modul Purchasing (PO approval), Sales (kontrak penjualan), HRIS (kontrak kerja)
- Penyimpanan di AWS S3

**Dependency:**
- Platform Core (wajib)
- AWS S3 (storage)

**Tabel Database Utama:**
```
documents, document_templates, document_signers,
document_signature_events, document_approvals,
document_versions
```

---

### M11 — E-Commerce & Marketplace Integration

**Kategori:** Revenue Core Extension / Growth Module
**Priority:** 🔴 Critical
**Target Core Family:** Lite+

**Pain Point yang Diselesaikan:** P09, P13

**Deskripsi:**
Modul integrasi omnichannel untuk mengelola penjualan dari berbagai channel (toko online, marketplace, website) dalam satu platform. Sinkronisasi produk, stok, pesanan, dan pembayaran secara real-time.

**Fitur Utama:**
- Konektor marketplace: Tokopedia, Shopee, Lazada, Bukalapak, TikTok Shop
- Sinkronisasi produk & harga ke semua channel
- Sinkronisasi stok real-time (menghindari overselling)
- Manajemen pesanan terpusat dari semua marketplace
- Auto-fulfillment dari gudang NIZAM ke pesanan marketplace
- Sinkronisasi pembayaran & rekonsiliasi komisi marketplace
- Dashboard omnichannel: penjualan per channel, produk terlaris
- Integrasi ekspedisi (JNE, J&T, SiCepat, Anteraja)

**Dependency:**
- Sales + Inventory (wajib)
- Purchasing (untuk restock)

**Tabel Database Utama:**
```
marketplace_channels, marketplace_products, marketplace_orders,
marketplace_sync_logs, marketplace_commissions,
channel_stock_levels
```

---

## 5. Add-on Baru yang Diusulkan

### Kriteria Add-on
Sebuah capability ditetapkan sebagai **Add-on** jika:
- Nilainya muncul setelah modul induknya aktif
- Dependency ke modul lain kuat
- Lebih cocok dijual sebagai ekspansi, pack, atau accelerator

---

### A01 — WhatsApp Business Notifier

**Jenis:** Growth Add-on
**Pain Point:** P15
**Parent Module:** Sales, Finance Core, HRIS

**Deskripsi:**
Add-on notifikasi otomatis via WhatsApp Business API. Kirim tagihan, reminder pembayaran, konfirmasi pesanan, slip gaji, dan alert penting langsung ke WhatsApp pelanggan/karyawan.

**Fitur:**
- Template pesan WhatsApp yang bisa dikustomisasi
- Trigger otomatis: invoice jatuh tempo, konfirmasi PO, pengiriman, slip gaji
- Bulk messaging untuk kampanye (dengan batasan API)
- Log pengiriman & status delivery
- Integrasi WA Business API (via provider: Twilio, Wablas, Fonnte, dll)
- Webhook untuk respons otomatis sederhana

**Dependency:** Sales atau Finance Core aktif

---

### A02 — AI Insights & Anomaly Detection Pack

**Jenis:** Intelligence Add-on
**Pain Point:** P20, P10
**Parent Module:** Finance Core, Sales, Inventory

**Deskripsi:**
Add-on kecerdasan buatan yang memberikan rekomendasi bisnis, deteksi anomali, dan prediksi berbasis data historis NIZAM menggunakan Google AI Studio / Vertex AI.

**Fitur:**
- Deteksi anomali transaksi keuangan (spike pengeluaran, jurnal tidak wajar)
- Prediksi arus kas (cash flow forecast) 30/60/90 hari
- Rekomendasi stok reorder berbasis tren penjualan
- Analisis pelanggan churn risk
- Natural language query: "Tunjukkan penjualan bulan ini vs bulan lalu"
- AI-generated executive summary harian/mingguan
- Integrasi Google AI Studio untuk embedding & inference

**Dependency:** Finance Core + Sales + Inventory (minimal 2 aktif)

---

### A03 — Tax Automation Pack (e-Faktur & Pajak Indonesia)

**Jenis:** Compliance Add-on
**Pain Point:** P16
**Parent Module:** Finance Core, Sales

**Deskripsi:**
Add-on untuk otomatisasi perpajakan Indonesia — integrasi e-Faktur DJP, perhitungan PPh 21/23/4(2), dan pelaporan SPT.

**Fitur:**
- Integrasi e-Faktur (pembuatan faktur pajak keluaran & masukan)
- Nomor Seri Faktur Pajak (NSFP) management
- Perhitungan otomatis PPN 11%
- Laporan pajak: PPN Keluaran, PPN Masukan, PM-PK, SPT Masa PPN
- PPh 21 terintegrasi Payroll
- PPh 23 & PPh 4(2) untuk pembayaran jasa
- Export data ke format yang kompatibel e-SPT/Coretax DJP
- Rekonsiliasi PPN otomatis

**Dependency:** Finance Core + Sales (untuk faktur penjualan)

---

### A04 — Employee Self-Service (ESS) Pack

**Jenis:** HR Productivity Add-on
**Pain Point:** P14
**Parent Module:** HRIS Core

**Deskripsi:**
Add-on portal mandiri karyawan yang mengurangi beban administrasi HR. Karyawan bisa mengajukan cuti, klaim, melihat slip gaji, dan memperbarui data pribadi secara mandiri.

**Fitur:**
- Portal karyawan (web & mobile-friendly)
- Pengajuan & persetujuan cuti online
- Pengajuan lembur & klaim reimbursement
- Akses slip gaji digital
- Pembaruan data pribadi (no. rekening, alamat, kontak darurat)
- Pengajuan koreksi absensi
- Riwayat training & sertifikasi dari Academy module
- Notifikasi approval via email & WhatsApp (integrasi A01)
- Manager dashboard: approve/reject langsung dari portal

**Dependency:** HRIS Core (wajib), Payroll submodule

---

### A05 — Advanced Reporting & BI Pack

**Jenis:** Intelligence Add-on
**Pain Point:** P10
**Parent Module:** Reports (semua modul)

**Deskripsi:**
Add-on laporan lanjutan dengan kemampuan custom dashboard, drill-down interaktif, scheduled report, dan koneksi ke tools BI eksternal.

**Fitur:**
- Custom dashboard builder (drag-and-drop widgets)
- Drill-down dari laporan ringkasan ke transaksi detail
- Scheduled report (kirim otomatis ke email setiap hari/minggu/bulan)
- Export ke Excel, PDF, CSV dengan format yang bisa dikustomisasi
- Cross-module analytics (Sales × Finance × Inventory)
- KPI tracker dengan target & aktual
- Connector ke Power BI, Google Looker Studio, Metabase
- Laporan komparasi periode (YoY, MoM)

**Dependency:** Reports module + minimal 2 core module aktif

---

### A06 — Customer Self-Service Portal

**Jenis:** Growth Add-on
**Pain Point:** P18
**Parent Module:** Sales, CRM

**Deskripsi:**
Portal pelanggan berbasis web di mana pelanggan B2B bisa melihat invoice, status pesanan, histori pembelian, dan mengajukan tiket layanan tanpa menghubungi CS.

**Fitur:**
- Login portal pelanggan dengan akun terpisah dari internal user
- Lihat & unduh invoice dan faktur pajak
- Status pesanan & tracking pengiriman
- Histori pembelian & kontrak
- Pengajuan komplain & tiket layanan
- Pembayaran invoice langsung dari portal (integrasi payment gateway)
- Chat / request dokumen ke sales person
- White-label portal (custom domain pelanggan)

**Dependency:** Sales + CRM (wajib)

---

### A07 — GPS & Field Operations Pack

**Jenis:** Operations Add-on
**Pain Point:** P17
**Parent Module:** Fleet & Rental, Service Operations, Manufacturing

**Deskripsi:**
Add-on pelacakan lapangan berbasis GPS untuk tim field service, armada kendaraan, dan tenaga penjualan luar. Mendukung check-in lokasi, rute perjalanan, dan laporan kunjungan.

**Fitur:**
- GPS live tracking armada & field staff
- Check-in/out lokasi dengan foto & geofencing
- Rute optimasi untuk kunjungan/pengiriman
- Laporan kunjungan pelanggan
- Integrasi work order Service Operations
- Overtime & perjalanan dinas logging
- Heatmap kunjungan sales
- Alert jika kendaraan keluar zona yang ditentukan

**Dependency:** Fleet & Rental ATAU Service Operations (minimal salah satu)

---

### A08 — Zakat, Infaq & Waqf (ZIW) Pack

**Jenis:** Syariah Compliance Add-on
**Pain Point:** P19
**Parent Module:** Finance Core, Syirkah

**Deskripsi:**
Add-on kepatuhan syariah untuk pengelolaan kewajiban zakat perusahaan, distribusi infaq/sedekah, dan manajemen wakaf produktif. Terintegrasi dengan laporan keuangan syariah.

**Fitur:**
- Kalkulasi zakat perusahaan (zakat maal, zakat perdagangan)
- Kalkulasi zakat gaji karyawan terintegrasi Payroll
- Distribusi zakat ke mustahiq dengan dokumentasi
- Manajemen dana infaq & sedekah korporat
- Aset wakaf & investasi wakaf produktif
- Laporan zakat tahunan (untuk pelaporan ke BAZNAS)
- Integrasi CoA syariah (akun zakat, akun amanah)
- Kompatibel dengan laporan PSAK 109 (Zakat, Infaq, Sedekah)

**Dependency:** Finance Core (wajib), Syirkah (sangat disarankan)

---

### A09 — Marketplace Sync Add-on

**Jenis:** Integration Add-on
**Pain Point:** P09, P13
**Parent Module:** E-Commerce Module (M11)

**Deskripsi:**
Pelengkap E-Commerce Module untuk penambahan channel marketplace tambahan, sinkronisasi lebih cepat, dan fitur manajemen seller yang lebih advanced.

**Fitur:**
- Penambahan channel: Blibli, Zalora, Sociolla, Grab, Gojek, dsb
- Real-time stock broadcast ke semua channel (<60 detik)
- Price rule per channel (harga berbeda di tiap marketplace)
- Bundling produk per channel
- Marketplace analytics per SKU per channel
- Auto-repricing berbasis kompetitor
- Multi-account per marketplace (untuk bisnis dengan banyak toko)

**Dependency:** E-Commerce Module (M11) aktif

---

### A10 — Audit Trail Plus Pack

**Jenis:** Governance Add-on
**Pain Point:** Compliance, Fraud Prevention
**Parent Module:** Finance Core, Audit

**Deskripsi:**
Add-on pelacakan perubahan data yang lebih dalam untuk kebutuhan audit, kepatuhan, dan investigasi internal. Setiap perubahan data penting terekam lengkap dengan konteks who/what/when/why.

**Fitur:**
- Full audit trail per transaksi (create/update/delete/approve)
- User activity log dengan IP, device, waktu
- Perubahan master data (harga, CoA, vendor, karyawan)
- Anomaly alert: transaksi dihapus, jurnal dibalik mendadak, perubahan bank
- Audit report siap untuk kebutuhan KAP/external auditor
- Data retention policy yang bisa dikonfigurasi
- Export audit log ke format yang bisa dibaca auditor (Excel/PDF)
- Integrasi dengan modul Audit yang sudah ada

**Dependency:** Finance Core + Audit module

---

### A11 — Advanced WMS+ (Warehouse Management System Lanjut)

**Jenis:** Advanced Operations Add-on
**Pain Point:** Operasional Gudang Kompleks
**Parent Module:** Inventory Core

**Deskripsi:**
Evolusi dari Advanced WMS yang sudah ada — menambahkan kapabilitas wave picking, cross-docking, barcode scanning workflow, dan integrasi otomasi gudang.

**Fitur:**
- Bin location management (rak, baris, level, posisi)
- Wave picking & batch picking untuk efisiensi picker
- Cross-docking (transfer langsung dari receiving ke shipping)
- Barcode / QR scanning workflow (mobile-friendly)
- FEFO / FIFO / LIFO picking strategy
- Cycle count & inventory reconciliation
- Labor productivity tracking per picker/packer
- Slotting optimization recommendation
- Integrasi conveyor / WCS (warehouse control system) via API

**Dependency:** Inventory Core + Advanced WMS (yang sudah ada)

---

### A12 — Payment Gateway Integration Pack

**Jenis:** Integration Add-on
**Pain Point:** Proses pembayaran digital masih manual
**Parent Module:** Sales, Finance Core

**Deskripsi:**
Add-on integrasi payment gateway populer di Indonesia untuk penerimaan pembayaran digital secara otomatis terintegrasi ke Finance Core.

**Fitur:**
- Midtrans, Xendit, DOKU, PaymentGate — pilihan provider
- Virtual Account (VA) per pelanggan / per invoice
- QRIS untuk pembayaran di tempat (POS integration)
- Auto-reconcile pembayaran ke invoice yang sesuai
- Split payment (satu invoice, beberapa metode)
- Refund & void management
- Laporan settlement harian dari payment gateway
- Notifikasi pembayaran real-time ke pelanggan & tim finance

**Dependency:** Finance Core + Sales (wajib)

---

### A13 — Bulk Import & Data Migration Pack

**Jenis:** Platform Add-on
**Pain Point:** Migrasi data dari sistem lama memakan waktu lama
**Parent Module:** Platform Core

**Deskripsi:**
Add-on untuk mempercepat migrasi data dari sistem lama (Excel, Accurate, MYOB, Jurnal.id) ke NIZAM. Menyediakan template import terstandar dan validator data otomatis.

**Fitur:**
- Template import Excel untuk setiap modul (produk, vendor, customer, transaksi)
- Validasi data sebelum import (cek duplikat, format, mandatory field)
- Mapping field custom (dari format sumber ke format NIZAM)
- Import histori transaksi dengan opening balance otomatis
- Undo/rollback import yang gagal
- Progress tracking import (real-time)
- Dukungan format: CSV, Excel, JSON, XML
- Migration checklist & status report

**Dependency:** Platform Core (semua modul)

---

### A14 — Multi-Language & Localization Pack

**Jenis:** Platform Add-on
**Pain Point:** ERP hanya tersedia dalam Bahasa Indonesia, tidak bisa digunakan tim internasional
**Parent Module:** Platform Core

**Deskripsi:**
Add-on multi-bahasa untuk mendukung bisnis dengan karyawan atau operasi lintas negara. UI tersedia dalam beberapa bahasa, laporan bisa digenerate dalam bahasa yang dipilih.

**Fitur:**
- Antarmuka tersedia: Bahasa Indonesia, English, Arabic, Mandarin
- User bisa memilih bahasa preferensi masing-masing
- Laporan keuangan multi-bahasa (untuk kebutuhan investor/partner asing)
- Format tanggal, angka, dan mata uang per locale
- Invoice & dokumen output dalam bahasa pilihan pelanggan
- RTL (Right-to-Left) support untuk Arabic

**Dependency:** Platform Core

---

## 6. Matriks Prioritas & Roadmap

### 6.1 Prioritas Pengembangan

| Kode | Nama | Tipe | Prioritas | Quarter Target |
|---|---|---|---|---|
| M11 | E-Commerce & Marketplace Integration | Module | 🔴 Critical | Q3 2026 |
| M01 | Asset Management | Module | 🔴 Critical | Q3 2026 |
| M02 | Budget & Financial Planning | Module | 🔴 Critical | Q3 2026 |
| A01 | WhatsApp Business Notifier | Add-on | 🔴 Critical | Q3 2026 |
| A03 | Tax Automation Pack | Add-on | 🔴 Critical | Q3 2026 |
| A12 | Payment Gateway Integration Pack | Add-on | 🔴 Critical | Q3 2026 |
| M04 | Loyalty & Membership | Module | 🟠 High | Q4 2026 |
| M05 | After-Sales & Warranty | Module | 🟠 High | Q4 2026 |
| M07 | Quality Control & Management | Module | 🟠 High | Q4 2026 |
| M10 | Document Management & E-Signature | Module | 🟠 High | Q4 2026 |
| M03 | Multi-Currency & Forex | Module | 🟠 High | Q4 2026 |
| M06 | Subscription & Recurring Billing | Module | 🟠 High | Q4 2026 |
| A02 | AI Insights & Anomaly Detection | Add-on | 🟠 High | Q4 2026 |
| A04 | Employee Self-Service (ESS) | Add-on | 🟠 High | Q4 2026 |
| A05 | Advanced Reporting & BI | Add-on | 🟠 High | Q4 2026 |
| A06 | Customer Self-Service Portal | Add-on | 🟠 High | Q1 2027 |
| A07 | GPS & Field Operations | Add-on | 🟠 High | Q1 2027 |
| A08 | Zakat, Infaq & Waqf Pack | Add-on | 🟡 Medium | Q1 2027 |
| M08 | Property & Real Estate | Module | 🟡 Medium | Q1 2027 |
| M09 | Healthcare & Clinic | Module | 🟡 Medium | Q2 2027 |
| A09 | Marketplace Sync (Advanced) | Add-on | 🟡 Medium | Q1 2027 |
| A10 | Audit Trail Plus | Add-on | 🟡 Medium | Q2 2027 |
| A11 | Advanced WMS+ | Add-on | 🟡 Medium | Q2 2027 |
| A13 | Bulk Import & Data Migration | Add-on | 🟡 Medium | Q3 2026 |
| A14 | Multi-Language & Localization | Add-on | 🟡 Medium | Q2 2027 |

---

### 6.2 Peta Ketergantungan (Dependency Map)

```
Platform Core
    └── Finance Core
            ├── M01 Asset Management
            ├── M02 Budget & Financial Planning
            ├── M03 Multi-Currency & Forex
            ├── A03 Tax Automation Pack
            ├── A08 ZIW Pack
            ├── A10 Audit Trail Plus
            └── A12 Payment Gateway
    └── Revenue Core (Sales + CRM)
            ├── M04 Loyalty & Membership
            ├── M05 After-Sales & Warranty
            ├── M06 Subscription & Recurring Billing
            ├── M11 E-Commerce & Marketplace
            ├── A06 Customer Self-Service Portal
            └── A09 Marketplace Sync
    └── Inventory Core
            ├── M07 Quality Control & QM
            ├── A11 Advanced WMS+
            └── (M11 E-Commerce shared)
    └── HRIS Core
            ├── A04 ESS Pack
            └── A08 ZIW Pack (payroll zakat)
    └── Vertical Modules
            ├── M08 Property (via Finance + Sales)
            ├── M09 Healthcare (via Sales + Inventory)
            └── A07 GPS Pack (via Fleet / Service)
    └── Platform-level Add-ons
            ├── M10 Document & E-Signature
            ├── A13 Bulk Import Pack
            └── A14 Multi-Language Pack
    └── Cross-module Add-ons
            ├── A01 WhatsApp Notifier
            ├── A02 AI Insights Pack
            └── A05 Advanced BI Pack
```

---

## 7. Implikasi ke Arsitektur Produk

### 7.1 Perluasan Core Families

Dengan tambahan modul baru, Core Family NIZAM berkembang menjadi:

| Core Family | Isi Lama | Tambahan Baru |
|---|---|---|
| Finance Core | Accounting, Finance, Cash & Bank | + Asset Management, + Budget Planning, + Multi-Currency |
| Revenue Core | Sales, CRM, POS | + Loyalty, + After-Sales, + Subscription, + E-Commerce |
| Inventory Core | Inventory, Warehouse | + Quality Control |
| HRIS Core | HRIS, Attendance, Payroll | (tetap, ESS jadi add-on) |

### 7.2 Vertical Module Baru

```
Vertical Modules (Existing):
  - Manufacturing
  - Fleet & Rental
  - Service Operations
  - Project & Construction
  - Syirkah

Vertical Modules (Proposed New):
  - Property & Real Estate (M08)
  - Healthcare & Clinic (M09)
  - E-Commerce & Marketplace (M11)*
  
*M11 bisa dianggap "Retail/Commerce Vertical" atau "Revenue Core Extension",
  tergantung keputusan GTM.
```

### 7.3 Pengelompokan Add-on

| Kelompok Add-on | Add-on |
|---|---|
| **Growth & Channel** | WhatsApp Notifier, Customer Portal, Payment Gateway, Marketplace Sync |
| **Intelligence & AI** | AI Insights Pack, Advanced BI Pack |
| **Compliance & Governance** | Tax Automation, Audit Trail Plus, ZIW Pack |
| **HR Productivity** | ESS Pack |
| **Advanced Operations** | GPS & Field Ops, Advanced WMS+, Quality Control Pack |
| **Platform & Integration** | Bulk Import, Multi-Language, Document E-Sign |
| **Finance Extensions** | (sebagian masuk Module: Multi-Currency, Budget) |

---

## 8. Implikasi ke Packaging & Pricing

### 8.1 Paket yang Disarankan dengan Modul Baru

```
PAKET LITE (Entry)
→ Platform Core + Sales + CRM + POS + Reports
→ Add-on opsional: WhatsApp Notifier, Payment Gateway

PAKET STARTER (Growth)
→ Lite + Accounting + Finance + Inventory + Purchasing
→ Add-on opsional: Tax Automation, E-Commerce, Loyalty

PAKET FULL CORE (Professional)
→ Starter + HRIS + Manufacturing + Audit
→ + Asset Management, Budget Planning, Quality Control
→ Add-on opsional: ESS Pack, AI Insights, Advanced BI

PAKET ENTERPRISE (Custom)
→ Full Core + Semua Vertical Modules yang relevan
→ + Multi-Currency, Subscription Billing, Document E-Sign
→ Add-on: Multi-Entity, Open API, Audit Trail Plus, Multi-Language

PAKET VERTIKAL (Industri)
→ Paket khusus per industri:
  - Retail/F&B: Starter + Loyalty + POS + E-Commerce
  - Kontraktor: Starter + Project & Construction + Asset + QC
  - Klinik: Lite + Healthcare + Inventory (farmasi)
  - Properti: Starter + Property + Finance + Document
  - Syariah: Starter + Syirkah + ZIW Pack
```

### 8.2 Estimasi Potensi ACV Tambahan

| Kategori | Modul/Add-on Baru | Estimasi ACV/Tenant |
|---|---|---|
| Critical — wajib ada | M01, M02, M11, A01, A03, A12 | Rp 5–15 juta/bulan |
| High — upsell kuat | M04, M05, M07, M10, A02, A04, A05 | Rp 3–8 juta/bulan |
| Vertical — industri spesifik | M08, M09 | Rp 4–10 juta/bulan |
| Platform — enabling | A13, A14 | Rp 1–3 juta/bulan |

---

## 9. Implikasi ke Sertifikasi NIZAM Academy

Modul dan add-on baru menghasilkan jalur sertifikasi tambahan:

### 9.1 Jalur Sertifikasi Modul Baru

| Modul | Sertifikasi | Level |
|---|---|---|
| M01 Asset Management | Certified Asset Manager | Intermediate |
| M02 Budget Planning | Certified Budget Analyst | Intermediate |
| M03 Multi-Currency | Certified Forex Accountant | Advanced |
| M04 Loyalty & Membership | Certified Loyalty Program Manager | Beginner |
| M05 After-Sales & Warranty | Certified Service Manager | Intermediate |
| M06 Subscription Billing | Certified Revenue Operations | Intermediate |
| M07 Quality Control | Certified Quality Controller | Intermediate |
| M08 Property Management | Certified Property Manager | Intermediate |
| M09 Healthcare & Clinic | Certified Clinic Administrator | Intermediate |
| M10 Document & E-Sign | Certified Document Controller | Beginner |
| M11 E-Commerce | Certified Omnichannel Manager | Intermediate |

### 9.2 Jalur Sertifikasi Add-on

| Add-on | Sertifikasi | Level |
|---|---|---|
| A01 WhatsApp Notifier | Certified CRM Automation Specialist | Beginner |
| A02 AI Insights | Certified AI Analytics User | Intermediate |
| A03 Tax Automation | Certified Tax Compliance Officer | Advanced |
| A04 ESS Pack | Certified HR Self-Service Admin | Beginner |
| A05 Advanced BI | Certified BI & Analytics User | Intermediate |
| A07 GPS & Field Ops | Certified Field Operations Manager | Intermediate |
| A08 ZIW Pack | Certified Syariah Finance Officer | Advanced |

---

## 10. Ringkasan Final

### 10.1 Modul Baru (11 Modul)

| No | Kode | Nama | Kategori | Prioritas |
|---|---|---|---|---|
| 1 | M01 | Asset Management | Core Extension | 🔴 Critical |
| 2 | M02 | Budget & Financial Planning | Core Extension | 🔴 Critical |
| 3 | M03 | Multi-Currency & Forex | Core Extension | 🟠 High |
| 4 | M04 | Loyalty & Membership | Revenue Extension | 🟠 High |
| 5 | M05 | After-Sales & Warranty | Service Extension | 🟠 High |
| 6 | M06 | Subscription & Recurring Billing | Revenue Extension | 🟠 High |
| 7 | M07 | Quality Control & Management | Operations Extension | 🟠 High |
| 8 | M08 | Property & Real Estate | Vertical Module | 🟡 Medium |
| 9 | M09 | Healthcare & Clinic | Vertical Module | 🟡 Medium |
| 10 | M10 | Document Management & E-Signature | Platform Extension | 🟠 High |
| 11 | M11 | E-Commerce & Marketplace Integration | Revenue/Commerce | 🔴 Critical |

### 10.2 Add-on Baru (14 Add-on)

| No | Kode | Nama | Kategori | Prioritas |
|---|---|---|---|---|
| 1 | A01 | WhatsApp Business Notifier | Growth | 🔴 Critical |
| 2 | A02 | AI Insights & Anomaly Detection | Intelligence | 🟠 High |
| 3 | A03 | Tax Automation Pack (e-Faktur) | Compliance | 🔴 Critical |
| 4 | A04 | Employee Self-Service (ESS) | HR Productivity | 🟠 High |
| 5 | A05 | Advanced Reporting & BI Pack | Intelligence | 🟠 High |
| 6 | A06 | Customer Self-Service Portal | Growth | 🟠 High |
| 7 | A07 | GPS & Field Operations Pack | Operations | 🟠 High |
| 8 | A08 | Zakat, Infaq & Waqf Pack | Syariah Compliance | 🟡 Medium |
| 9 | A09 | Marketplace Sync (Advanced) | Integration | 🟡 Medium |
| 10 | A10 | Audit Trail Plus Pack | Governance | 🟡 Medium |
| 11 | A11 | Advanced WMS+ | Operations | 🟡 Medium |
| 12 | A12 | Payment Gateway Integration Pack | Integration | 🔴 Critical |
| 13 | A13 | Bulk Import & Data Migration Pack | Platform | 🟡 Medium |
| 14 | A14 | Multi-Language & Localization Pack | Platform | 🟡 Medium |

---

## 11. Rekomendasi Eksekutif

Berdasarkan analisis ini, saya merekomendasikan:

### Immediate Action (Q3 2026)
1. **Mulai M01 (Asset Management)** — pain point universal, dependency rendah, ROI tinggi
2. **Mulai M02 (Budget Planning)** — diminta hampir semua customer enterprise
3. **Mulai A01 (WhatsApp Notifier)** — quick win, implementasi relatif cepat, dampak besar
4. **Mulai A03 (Tax Automation)** — kebutuhan regulasi Indonesia, mengurangi risiko compliance
5. **Mulai A12 (Payment Gateway)** — pendukung koleksi pembayaran digital
6. **Mulai A13 (Bulk Import)** — mempercepat onboarding customer baru

### Strategic Priority (Q4 2026)
1. **M11 (E-Commerce Integration)** — pasar e-commerce Indonesia tumbuh 20%+ YoY
2. **M04 (Loyalty)** — retention > acquisition, customer lifetime value
3. **M07 (Quality Control)** — fondasi untuk bisnis manufaktur & FMCG
4. **A02 (AI Insights)** — diferensiasi kompetitif jangka panjang
5. **A04 (ESS)** — mengurangi biaya operasional HR secara signifikan

### Vertical Expansion (2027)
1. **M08 (Property)** — segmen properti Indonesia besar dan belum terlayani ERP lokal
2. **M09 (Healthcare)** — klinik Indonesia membutuhkan sistem terintegrasi yang terjangkau
3. **A08 (ZIW Pack)** — diferensiasi kuat vs kompetitor non-syariah

---

*Dokumen ini dibuat berdasarkan analisis mendalam terhadap branch `feat_multi` dan gap analysis terhadap kebutuhan pasar global.*
*Seluruh keputusan implementasi final ada di tangan tim produk NIZAM.*

---

**Generated:** 24 Mei 2026
**Branch Referensi:** `feat_multi`
**Dokumen Terkait:**
- `KLASIFIKASI_MODULE_DAN_ADDON_NIZAM.md`
- `GTM_NIZAM_MODULE_DAN_ADDON.md`
- `lib/saas/module-catalog.ts`
