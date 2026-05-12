# Nizam ERP — Roadmap Modul & Add-On Global
> Dokumen Strategis | Versi 1.0 | Mei 2026

---

## Ringkasan Eksekutif

Dokumen ini merumuskan modul dan add-on baru yang perlu dikembangkan berdasarkan analisis pain point pelanggan ERP secara global. Analisis dilakukan dengan merujuk kondisi `feat_multi` branch yang sedang aktif dikembangkan, serta gap yang belum tertutup di module registry saat ini.

**Status Saat Ini (feat_multi):**
- 5 Pilar Inti: Finance, Operasional, Marketing, HRIS, Syirkah ✅
- 6 Business Type: Fleet, Manufacturing, Workshop, Job Order, Konstruksi, LMS ✅
- 2 Add-on: POS, Sales Page ✅ — *ecommerce sedang dalam pengembangan*
- SaaS billing & multi-tenant ✅

---

## Bagian 1 — Pain Point Pelanggan Global

### 1.1 Finance & Compliance
| Pain Point | Dampak |
|---|---|
| Tidak ada manajemen multi-mata uang | Bisnis ekspor/impor tidak bisa pakai sistem |
| Pajak masih manual (e-Faktur, PPh 21/23/26) | Risiko denda & audit pajak |
| Tidak ada fixed asset tracking | Penyusutan aset salah, laporan tidak akurat |
| Budget & forecasting tidak ada | Manajemen cash flow hanya reaktif |
| Konsolidasi laporan multi-entitas sulit | Holding company tidak bisa pakai 1 sistem |

### 1.2 Operasional & Supply Chain
| Pain Point | Dampak |
|---|---|
| Tidak ada Manajemen Kualitas (QC/QA) | Produk cacat lolos ke pelanggan |
| Tidak ada manajemen retur & garansi | Proses retur lambat, tidak terdokumentasi |
| Manajemen supplier lemah (vendor scorecard) | Pembelian tidak efisien |
| Tidak ada demand forecasting | Overstock atau stockout |
| Tidak ada lot/serial number tracking | Sulit untuk industri farmasi/food |

### 1.3 Penjualan & Pelanggan
| Pain Point | Dampak |
|---|---|
| Tidak ada customer portal | Pelanggan telepon/WA hanya untuk cek invoice |
| Tidak ada loyalty program & poin | Retention pelanggan rendah |
| Multi-channel commerce tidak terintegrasi | Stok marketplace & toko offline tidak sync |
| Tidak ada recurring/subscription billing | SaaS, laundry, gym tidak bisa otomasi tagihan |
| Tidak ada delivery order & ekspedisi | Pengiriman tidak terlacak |

### 1.4 SDM & Internal
| Pain Point | Dampak |
|---|---|
| Tidak ada expense claim digital | Reimbursement lambat & sering selisih |
| Approval workflow manual | Email bolak-balik, tidak ada audit trail |
| Tidak ada dokumen management | File tersebar di Google Drive, tidak terkontrol |
| Rekrutmen tidak terintegrasi | Data kandidat tidak terhubung ke onboarding karyawan |
| Tidak ada Performance Management | Evaluasi kinerja tidak terukur |

### 1.5 Integrasi & Produktivitas
| Pain Point | Dampak |
|---|---|
| Tidak ada integrasi marketplace (Tokopedia, Shopee) | Double input pesanan online |
| Tidak ada integrasi WhatsApp/notifikasi | Tim tidak tahu update real-time |
| Tidak ada mobile-first experience | Field staff tidak bisa akses |
| Tidak ada API publik / webhook | Sulit integrasi dengan tools lain |
| Tidak ada AI assistant untuk analitik | Insights harus dicari manual |

---

## Bagian 2 — Modul Baru yang Direkomendasikan

### 2.1 FINANCE PILLAR — Ekspansi

#### 🌍 Multi-Currency & Forex
- **Key:** `MultiCurrency`
- **Prioritas:** 🔴 Tinggi
- **Deskripsi:** Transaksi dalam berbagai mata uang (USD, EUR, SGD, MYR, dll), kurs harian otomatis (Bank Indonesia / ECB), selisih kurs otomatis dijurnal, laporan dalam mata uang pelaporan.
- **Pain Point Diselesaikan:** Bisnis ekspor, importir, perusahaan multi-negara.
- **Requires:** `Accounting`, `Finance`

#### 🧾 Tax Management (e-Faktur & PPh)
- **Key:** `TaxManagement`
- **Prioritas:** 🔴 Tinggi
- **Deskripsi:** Integrasi e-Faktur DJP (PPN Masukan/Keluaran), kalkulasi PPh 21, 23, 26 otomatis, pelaporan SPT Masa, dan rekonsiliasi pajak.
- **Pain Point Diselesaikan:** Compliance perpajakan Indonesia, mengurangi risiko denda.
- **Requires:** `Accounting`, `Finance`

#### 🏛️ Fixed Assets Management
- **Key:** `FixedAssets`
- **Prioritas:** 🔴 Tinggi
- **Deskripsi:** Registrasi aset tetap, metode penyusutan (SL, Declining, Sum-of-Years), disposal, revaluasi, dan laporan aset.
- **Pain Point Diselesaikan:** Pencatatan aset yang akurat, penyusutan otomatis, laporan untuk auditor.
- **Requires:** `Accounting`, `Finance`

#### 📈 Budget & Forecasting
- **Key:** `Budgeting`
- **Prioritas:** 🟡 Menengah
- **Deskripsi:** Perencanaan anggaran per departemen/cost center, perbandingan realisasi vs budget (variance analysis), forecasting cash flow 3/6/12 bulan.
- **Pain Point Diselesaikan:** Cash flow management proaktif, efisiensi operasional.
- **Requires:** `Accounting`, `Finance`, `Reports`

#### 🏢 Konsolidasi Multi-Entitas
- **Key:** `Consolidation`
- **Prioritas:** 🟡 Menengah
- **Deskripsi:** Konsolidasi laporan keuangan dari beberapa entitas (anak perusahaan), eliminasi transaksi antar perusahaan, laporan holding.
- **Pain Point Diselesaikan:** Holding company, group of companies yang sudah multi-org.
- **Requires:** `Accounting`, `Reports`

---

### 2.2 OPERASIONAL — Business Type Baru

#### 🏥 Klinik & Kesehatan
- **Key:** `Clinic`
- **Prioritas:** 🔴 Tinggi
- **Deskripsi:** Business type untuk klinik/puskesmas: pendaftaran pasien, rekam medis sederhana, apotek, billing BPJS, dan laporan kunjungan.
- **Segmen:** Klinik pratama, dokter praktek, fisioterapi.
- **Requires:** `Finance`, `Inventory`

#### 🍽️ Restoran & F&B
- **Key:** `Restaurant`
- **Prioritas:** 🔴 Tinggi
- **Deskripsi:** Business type untuk F&B: manajemen meja/table, kitchen display, menu engineering, food costing, dan integrasi POS khusus F&B.
- **Segmen:** Restoran, kafe, catering, cloud kitchen.
- **Requires:** `Inventory`, `Sales`, `POS`

#### 🏠 Properti & Real Estate
- **Key:** `Property`
- **Prioritas:** 🟡 Menengah
- **Deskripsi:** Business type untuk developer/agen properti: unit tracking, kontrak KPR, cicilan, booking fee, dan laporan progres proyek.
- **Segmen:** Developer perumahan, agen properti, kos-kosan.
- **Requires:** `Finance`, `Sales`

#### 👔 Distribusi & Agen
- **Key:** `Distribution`
- **Prioritas:** 🟡 Menengah
- **Deskripsi:** Business type untuk distributor: manajemen area/wilayah, agen/sub-distributor, target & realisasi, dan route planning salesman.
- **Segmen:** Distributor FMCG, agen sembako, distributor spare part.
- **Requires:** `Inventory`, `Sales`, `CRM`

---

### 2.3 MARKETING PILLAR — Ekspansi

#### 🎯 Marketing Automation
- **Key:** `MarketingAuto`
- **Prioritas:** 🟡 Menengah
- **Deskripsi:** Email campaign, segmentasi pelanggan, drip campaign otomatis berdasarkan trigger (pembelian pertama, ulang tahun, tidak belanja 30 hari), dan tracking open rate.
- **Requires:** `CRM`, `Sales`

#### 🌐 Omnichannel Commerce
- **Key:** `Omnichannel`
- **Prioritas:** 🔴 Tinggi
- **Deskripsi:** Sinkronisasi stok & pesanan dari marketplace (Tokopedia, Shopee, Lazada, TikTok Shop) ke sistem Nizam secara real-time, satu dashboard untuk semua channel.
- **Pain Point Diselesaikan:** Double input, stok tidak sync, pesanan terlewat.
- **Requires:** `Inventory`, `Sales`

---

### 2.4 HRIS PILLAR — Ekspansi

#### 💸 Expense Management
- **Key:** `Expense`
- **Prioritas:** 🔴 Tinggi
- **Deskripsi:** Pengajuan klaim reimburse digital dengan foto nota, approval multi-level, batas anggaran per kategori, dan otomatis jurnal ke akuntansi.
- **Pain Point Diselesaikan:** Proses reimbursement yang lambat dan tidak terdokumentasi.
- **Requires:** `Finance`, `HRIS`

#### 🎯 Performance Management (KPI)
- **Key:** `PerformanceMgmt`
- **Prioritas:** 🟡 Menengah
- **Deskripsi:** Setting KPI per jabatan, self-assessment, review 360°, histori evaluasi kinerja, dan koneksi ke kenaikan gaji/promosi.
- **Requires:** `HRIS`

#### 🧑‍💼 Recruitment & Onboarding
- **Key:** `Recruitment`
- **Prioritas:** 🟡 Menengah
- **Deskripsi:** Lowongan kerja internal, tracking kandidat (ATS sederhana), proses interview, offer letter, dan otomatis onboarding karyawan baru ke HRIS.
- **Requires:** `HRIS`

---

## Bagian 3 — Add-On Baru yang Direkomendasikan

### 3.1 Add-On Penjualan & Pelanggan

#### 🛒 E-Commerce (Full)
- **Key:** `Ecommerce`
- **Status:** Sedang dikembangkan di `feat_multi`
- **Deskripsi:** Toko online terintegrasi penuh dengan stok & akuntansi, checkout, payment gateway (Midtrans/Xendit), dan manajemen order.

#### 👤 Customer Portal
- **Key:** `CustomerPortal`
- **Prioritas:** 🔴 Tinggi
- **Deskripsi:** Portal mandiri untuk pelanggan: cek invoice, status pengiriman, riwayat pesanan, download dokumen, dan bayar invoice online.
- **Pain Point Diselesaikan:** Mengurangi volume pertanyaan pelanggan ke tim CS.
- **Requires:** `Sales`, `Finance`

#### 🎁 Loyalty & Rewards
- **Key:** `Loyalty`
- **Prioritas:** 🟡 Menengah
- **Deskripsi:** Program poin reward untuk pelanggan (earn & redeem), tier membership (Bronze/Silver/Gold), voucher, cashback, dan laporan efektivitas program.
- **Requires:** `Sales`, `CRM`, `POS`

#### 🔄 Subscription Billing
- **Key:** `SubscriptionBilling`
- **Prioritas:** 🔴 Tinggi
- **Deskripsi:** Tagihan berulang otomatis (mingguan/bulanan/tahunan), trial period, upgrade/downgrade plan, dunning management (pengingat tagihan jatuh tempo), dan laporan MRR/ARR/Churn.
- **Pain Point Diselesaikan:** SaaS, laundry berlangganan, gym membership, kos-kosan.
- **Requires:** `Sales`, `Finance`

#### 🚚 Delivery & Ekspedisi
- **Key:** `Delivery`
- **Prioritas:** 🟡 Menengah
- **Deskripsi:** Integrasi ekspedisi (JNE, JNT, SiCepat, Anteraja, Gojek), print label, tracking resi real-time, dan otomatis update status pengiriman.
- **Requires:** `Sales`, `Inventory`

### 3.2 Add-On Operasional

#### ✅ Quality Control (QC/QA)
- **Key:** `QualityControl`
- **Prioritas:** 🟡 Menengah
- **Deskripsi:** Checklist QC untuk penerimaan barang dan produksi, inspeksi barang masuk/keluar, laporan defect, dan hold/reject management.
- **Requires:** `Inventory`, `Manufacturing`

#### 📦 Lot & Serial Number
- **Key:** `LotSerial`
- **Prioritas:** 🟡 Menengah
- **Deskripsi:** Tracking produk dengan nomor lot/batch (untuk farmasi, makanan, elektronik), expired date tracking, dan traceability dari supplier ke pelanggan.
- **Requires:** `Inventory`

#### 🔄 Return & Warranty Management
- **Key:** `ReturnWarranty`
- **Prioritas:** 🟡 Menengah
- **Deskripsi:** Proses retur penjualan/pembelian terstruktur, klaim garansi, repair order, dan otomatis adjustment stok & jurnal.
- **Requires:** `Sales`, `Inventory`

### 3.3 Add-On Produktivitas & Integrasi

#### 📋 Approval Workflow Engine
- **Key:** `ApprovalWorkflow`
- **Prioritas:** 🔴 Tinggi
- **Deskripsi:** Konfigurasi alur approval untuk transaksi (PO, expense, invoice) dengan multi-level approver, batas nominal, delegasi, dan notifikasi real-time.
- **Pain Point Diselesaikan:** Approval yang lambat dan tidak ada audit trail.
- **Requires:** Semua modul transaksi

#### 📁 Document Management
- **Key:** `DocumentMgmt`
- **Prioritas:** 🟡 Menengah
- **Deskripsi:** Penyimpanan dokumen bisnis terpusat (kontrak, invoice, sertifikat), versi dokumen, kategori, pencarian full-text, dan e-signature sederhana.
- **Requires:** `Finance`, `Sales`

#### 🤖 AI Business Assistant
- **Key:** `AIAssistant`
- **Prioritas:** 🟡 Menengah
- **Deskripsi:** Chat dengan data bisnis: "Bulan ini penjualan naik berapa?", "Stok produk apa yang hampir habis?", "Siapa pelanggan terbesar bulan ini?", menggunakan Google Vertex AI.
- **Requires:** `Reports`, `Accounting`

#### 📲 WhatsApp Notification
- **Key:** `WhatsAppNotif`
- **Prioritas:** 🔴 Tinggi
- **Deskripsi:** Notifikasi otomatis ke WhatsApp untuk: invoice jatuh tempo, approval menunggu, stok minimum tercapai, dan konfirmasi pesanan ke pelanggan.
- **Pain Point Diselesaikan:** Tim tidak aware update real-time, komunikasi pelanggan lambat.
- **Requires:** `Sales`, `Finance`

#### 🔌 API Gateway & Webhook
- **Key:** `APIGateway`
- **Prioritas:** 🟡 Menengah
- **Deskripsi:** Public REST API dengan OAuth2, webhook untuk event penting (invoice baru, pembayaran diterima, stok di bawah minimum), dan dokumentasi API interaktif.
- **Requires:** Semua modul

#### 📊 Advanced Analytics & BI
- **Key:** `AdvancedBI`
- **Prioritas:** 🟡 Menengah
- **Deskripsi:** Dashboard custom drag-and-drop, drill-down report, analitik prediktif (churn pelanggan, demand forecasting), dan export ke Excel/Google Sheets otomatis.
- **Requires:** `Reports`, `Accounting`

---

## Bagian 4 — Roadmap Prioritasi

### Phase 1 (Q3 2026) — Must Have
*Menyelesaikan pain point terbesar, paling banyak diminta*

| # | Item | Tipe | Estimasi |
|---|---|---|---|
| 1 | Tax Management (e-Faktur + PPh) | Modul Pilar | 6 minggu |
| 2 | Fixed Assets Management | Modul Pilar | 4 minggu |
| 3 | Customer Portal | Add-On | 4 minggu |
| 4 | Subscription Billing | Add-On | 5 minggu |
| 5 | WhatsApp Notification | Add-On | 2 minggu |
| 6 | Approval Workflow Engine | Add-On | 5 minggu |
| 7 | Expense Management | Modul HRIS | 3 minggu |
| 8 | Omnichannel Commerce | Modul Marketing | 8 minggu |

### Phase 2 (Q4 2026) — Should Have
*Ekspansi segmen dan peningkatan operasional*

| # | Item | Tipe | Estimasi |
|---|---|---|---|
| 1 | Multi-Currency & Forex | Modul Pilar | 6 minggu |
| 2 | Restoran & F&B (Business Type) | Business Type | 6 minggu |
| 3 | Klinik & Kesehatan (Business Type) | Business Type | 8 minggu |
| 4 | Lot & Serial Number | Add-On | 3 minggu |
| 5 | Delivery & Ekspedisi | Add-On | 4 minggu |
| 6 | Loyalty & Rewards | Add-On | 4 minggu |

### Phase 3 (Q1 2027) — Nice to Have
*Diferensiasi kompetitif & enterprise*

| # | Item | Tipe | Estimasi |
|---|---|---|---|
| 1 | Budget & Forecasting | Modul Pilar | 6 minggu |
| 2 | Konsolidasi Multi-Entitas | Modul Pilar | 8 minggu |
| 3 | AI Business Assistant | Add-On | 6 minggu |
| 4 | Property & Real Estate (Business Type) | Business Type | 8 minggu |
| 5 | Quality Control | Add-On | 4 minggu |
| 6 | Performance Management | Modul HRIS | 5 minggu |
| 7 | API Gateway & Webhook | Add-On | 6 minggu |
| 8 | Advanced Analytics & BI | Add-On | 8 minggu |

---

## Bagian 5 — Segmen Pasar & Proyeksi Dampak

### Target Segmen per Modul

| Segmen | Modul Utama yang Relevan | Potensi Pasar |
|---|---|---|
| Distributor & Trading | Omnichannel, Lot/Serial, Multi-Currency | Sangat Besar |
| Manufaktur | QC, Lot/Serial, Fixed Assets, Budget | Besar |
| Jasa & Konsultan | Subscription Billing, Expense, Approval | Besar |
| Retail & F&B | POS, Loyalty, Delivery, Restaurant | Sangat Besar |
| Klinik & Kesehatan | Clinic Business Type, HRIS, Inventory | Menengah |
| Startup & SaaS | Subscription Billing, API Gateway, AI | Besar |
| Holding & Group | Konsolidasi, Multi-Currency, Budget | Menengah/Tinggi Nilai |

### KPI Sukses

- **Adoption Rate**: % tenant yang mengaktifkan modul baru dalam 90 hari
- **Churn Reduction**: Target penurunan churn 30% setelah Approval Workflow + Customer Portal
- **ARPU Increase**: Target kenaikan ARPU 40% dengan add-on berbayar
- **NPS Score**: Target NPS > 50 setelah WhatsApp Notif + Tax Management

---

## Bagian 6 — Arsitektur Teknis

### Prinsip Pengembangan Modul Baru

1. **Ikuti module-registry pattern** — Daftarkan di `modules/marketplace/lib/module-registry.ts`
2. **COA Injection** — Setiap modul baru harus punya `coaInjectionFn` untuk setup akun otomatis
3. **Onboarding Steps** — Minimal 2 langkah onboarding untuk guided setup
4. **Server-side queries** — Selalu via `queryPostgres()` atau `lib/supabase/server.ts`
5. **Pillar compatibility** — Semua modul harus menyatakan `requires` dengan benar
6. **Permission granular** — Terintegrasi dengan sistem roles/permissions yang ada

### Pola Add-On yang Direkomendasikan

```typescript
// Contoh pendaftaran add-on baru
{
  key: 'CustomerPortal',
  name: 'Portal Pelanggan',
  tagline: 'Beri pelanggan akses mandiri ke invoice & pesanan',
  description: '...',
  icon: '👤',
  color: 'bg-blue-600',
  href: '/portal',
  isCore: false,
  isAddon: true,
  category: 'addon',
  onboardingSteps: [
    { id: 'branding', title: 'Branding Portal', description: 'Set logo dan warna portal pelanggan.' },
    { id: 'access', title: 'Atur Akses', description: 'Pilih dokumen apa saja yang bisa diakses pelanggan.' },
  ],
  requires: ['Sales', 'Finance'],
}
```

---

## Lampiran — Daftar Lengkap Modul (Current + Roadmap)

### Current (feat_multi)
- ✅ Accounting, Finance, Purchasing, Inventory, Warehouse, Reports, Audit
- ✅ Sales, CRM
- ✅ HRIS & Payroll
- ✅ Syirkah
- ✅ Fleet & Rental, Manufacturing, Workshop, Job Order, Konstruksi, LMS
- ✅ POS, Sales Page
- 🔧 E-Commerce (in progress)

### Roadmap Phase 1
- 📋 Tax Management, Fixed Assets, Customer Portal, Subscription Billing
- 📋 WhatsApp Notification, Approval Workflow, Expense Management, Omnichannel

### Roadmap Phase 2
- 📋 Multi-Currency, Restaurant (BT), Clinic (BT), Lot/Serial
- 📋 Delivery & Ekspedisi, Loyalty & Rewards

### Roadmap Phase 3
- 📋 Budget & Forecasting, Konsolidasi, AI Assistant, Property (BT)
- 📋 QC, Performance Management, API Gateway, Advanced BI

---

*Dokumen ini diperbarui secara berkala seiring perkembangan roadmap. Untuk diskusi lebih lanjut, hubungi tim produk Nizam.*

**Total Modul Saat Ini:** 18 modul aktif  
**Target Roadmap:** +22 modul/add-on baru  
**Total Ekosistem Target:** 40+ modul
