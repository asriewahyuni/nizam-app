# NIZAM ERP — Roadmap Modul & Add-on Global
**Dokumen Perencanaan Strategis | Versi 1.0 | Mei 2026**

---

## 1. Ringkasan Eksekutif

Berdasarkan analisis branch `feat_multi`, NIZAM ERP saat ini memiliki **arsitektur 4-pillar** yang kuat: Lite Core → Starter Core → Full Core → Vertical Modules, ditambah ekosistem add-on. Dokumen ini mengidentifikasi gap antara kapabilitas saat ini dengan pain point pelanggan global, lalu merekomendasikan modul dan add-on prioritas untuk 12–18 bulan ke depan.

**Tujuan strategis:**
- Meningkatkan retensi customer dengan menyelesaikan end-to-end workflow
- Membuka segmen pasar baru (ASEAN expansion, industri vertikal)
- Meningkatkan ARPU melalui upsell add-on bernilai tinggi
- Memperkuat competitive moat vs ERP incumbent (SAP, Oracle, Odoo)

---

## 2. Peta Modul Saat Ini

### 2.1 Core Modules (Active)

| Tier | Modul | Status |
|---|---|---|
| Platform Core | Dashboard, Cabang & Divisi, Pengaturan Bisnis, Migrasi Data, Support Ticket | ✅ Released |
| Lite Core | Sales, POS, CRM, Reports | ✅ Released |
| Starter Core | Accounting, Finance, Inventory, Purchasing | ✅ Released |
| Full Core | HRIS, Manufacturing, Audit | ✅ Released |

### 2.2 Vertical Modules (Active)

| Modul | Status |
|---|---|
| Fleet & Rental | ✅ Released |
| Job Order (Jasa) | ✅ Released |
| Project & Construction | ✅ Released |
| LMS (Learning Management) | ✅ Released |
| Syirkah (Islamic Partnership) | ✅ Released |
| E-Commerce / Toko | ✅ Released |
| Workshop | ✅ Released |

### 2.3 Add-ons (Active)

| Add-on | Status |
|---|---|
| POS | ✅ Released |
| Sales Page | ✅ Released |
| Quick Bill | ✅ Released |
| Advanced WMS | 🔄 Planned |
| Open API & Webhooks | 🔄 Planned |
| Multi-Entity | 🔄 Planned |
| Fleet Maintenance Pack | 🔄 Planned |
| Package Tracking | 🔄 Planned |
| Sales AR Cockpit | 🔄 Planned |
| Sales AR Seat Pack | 🔄 Planned |

---

## 3. Analisis Pain Point Pelanggan Global

### 3.1 Pain Point Kritis (Severity: 🔴 Tinggi)

| # | Pain Point | Segmen Terdampak | Dampak Bisnis |
|---|---|---|---|
| P1 | **Cash flow visibility buruk** — owner tidak tahu posisi kas real-time | Semua UKM | Churn tinggi, keputusan bisnis salah |
| P2 | **Kepatuhan pajak multi-jenis** — PPN, PPh 21/23/25/26, e-Faktur, SPT | Semua | Risiko sanksi, manual error |
| P3 | **Piutang tak tertagih** — follow-up AR manual, tidak ada sistem eskalasi | Trading, distribusi | Bad debt, cash crunch |
| P4 | **Inventory tidak akurat** — stok tercatat ≠ fisik, no demand forecasting | Retail, manufaktur | Overstock atau stockout |
| P5 | **Penggajian kompleks** — BPJS, PPh 21, tunjangan, potongan dinamis | Semua punya karyawan | Compliance error, karyawan tidak puas |

### 3.2 Pain Point Signifikan (Severity: 🟠 Sedang-Tinggi)

| # | Pain Point | Segmen Terdampak | Dampak Bisnis |
|---|---|---|---|
| P6 | **Multi-channel sales tidak tersinkron** — marketplace, website, toko offline terpisah | Retail, D2C | Revenue leak, double booking |
| P7 | **Vendor/supplier management lemah** — tidak ada vendor scorecard, e-procurement | Manufacturing, trading | Kualitas tidak terjaga, harga tidak kompetitif |
| P8 | **Tidak ada document management** — kontrak, PO, invoice masih PDF manual | Semua | Hilang dokumen, audit trail buruk |
| P9 | **Subscription & recurring billing manual** — untuk bisnis berlangganan | SaaS, klinik, gym | Revenue leak, late billing |
| P10 | **Tidak ada loyalty program terintegrasi** — customer tidak ada insentif balik | Retail, F&B | Retensi customer rendah |

### 3.3 Pain Point Emerging (Severity: 🟡 Sedang)

| # | Pain Point | Segmen Terdampak | Dampak Bisnis |
|---|---|---|---|
| P11 | **AI/automation masih manual** — proses berulang tidak terotomasi | Semua | Produktivitas rendah |
| P12 | **Tidak ada customer self-service portal** — order, invoice, status harus tanya sales | B2B | Biaya support tinggi |
| P13 | **Multi-currency & multi-entity** — untuk bisnis ekspansi regional | Growing SME | Laporan konsolidasi manual |
| P14 | **Banking integration lemah** — rekonsiliasi bank masih manual | Semua | Finance team overloaded |
| P15 | **ESG & sustainability reporting** — tuntutan investor dan regulator | Enterprise | Tidak ada data terstruktur |

---

## 4. Modul Baru yang Direkomendasikan

### 4.1 MODUL PRIORITAS 1 — Harus Ada (Q3 2026)

---

#### M1. 💳 Subscription & Recurring Billing

**Menyelesaikan:** P9 — bisnis subscription billing masih manual
**Target segmen:** SaaS lokal, klinik, gym, laundry, co-working space

**Kapabilitas utama:**
- Setup paket berlangganan (bulanan/tahunan/custom cycle)
- Auto-generate invoice pada tanggal billing
- Retry logic untuk pembayaran gagal (dunning management)
- Proration untuk upgrade/downgrade mid-cycle
- Grace period dan auto-suspend otomatis
- Dashboard MRR, churn rate, LTV per customer
- Integrasi ke Accounting (jurnal otomatis per periode)

**Integrasi modul:** Finance, Accounting, CRM, Sales
**Arsitektur:** Vertical Module (Starter Core required)
**Estimasi effort:** 6–8 minggu

---

#### M2. 📄 Document Management & eSign

**Menyelesaikan:** P8 — dokumen kontrak dan legal masih manual PDF
**Target segmen:** Semua — terutama perusahaan jasa, konstruksi, B2B

**Kapabilitas utama:**
- Template dokumen (kontrak, NDA, PO, invoice, SPK)
- Digital signature terintegrasi (in-app + integrasi Privy/Peruri)
- Version control dokumen
- Approval workflow (multi-level sign-off)
- Folder & tagging sistem
- Audit trail per dokumen (siapa buka, edit, sign, kapan)
- Link dokumen ke transaksi ERP (PO, SO, kontrak proyek)

**Integrasi modul:** Sales, Purchasing, Project & Construction, Services
**Arsitektur:** Add-on (tersedia untuk Starter Core ke atas)
**Estimasi effort:** 8–10 minggu

---

#### M3. 🏦 Banking & Payment Integration Hub

**Menyelesaikan:** P14 — rekonsiliasi bank manual, pembayaran terpisah
**Target segmen:** Semua bisnis dengan transaksi digital

**Kapabilitas utama:**
- Koneksi rekening bank via API (BCA, Mandiri, BRI, BNI, BSI)
- Auto-matching transaksi bank ke jurnal ERP
- Virtual account generation per invoice
- Payment link (Midtrans, Xendit, Doku integration)
- Bulk payment disbursement (gaji, vendor)
- Real-time cash position dashboard
- Rekonsiliasi otomatis dengan confidence score

**Integrasi modul:** Finance, Cash, Accounting, HRIS (payroll)
**Arsitektur:** Add-on (tersedia Lite Core ke atas)
**Estimasi effort:** 10–12 minggu

---

#### M4. 🔮 Demand Planning & Supply Chain Intelligence

**Menyelesaikan:** P4 — inventory tidak akurat, tidak ada forecasting
**Target segmen:** Retail, distribusi, manufaktur

**Kapabilitas utama:**
- Demand forecasting berbasis historical sales + seasonal pattern
- Reorder point otomatis dengan safety stock calculation
- Supplier lead time tracking
- Purchase recommendation engine
- Slow-moving & dead stock alert
- ABC/XYZ analysis produk
- Scenario planning (best/worst/expected case)

**Integrasi modul:** Inventory, Purchasing, Sales, Manufacturing
**Arsitektur:** Add-on (Starter Core required)
**Estimasi effort:** 8–10 minggu

---

### 4.2 MODUL PRIORITAS 2 — Growth Enabler (Q4 2026)

---

#### M5. 🎁 Loyalty & Rewards Engine

**Menyelesaikan:** P10 — tidak ada insentif customer kembali berbelanja
**Target segmen:** Retail, F&B, e-commerce, klinik kecantikan

**Kapabilitas utama:**
- Poin reward berbasis transaksi (configurable multiplier)
- Tier membership (Bronze/Silver/Gold/Platinum)
- Voucher dan cashback rules engine
- Birthday reward otomatis
- Referral program tracker
- Member card digital (QR code)
- Dashboard loyalty analytics (redemption rate, lifetime value)
- Integrasi ke POS dan Sales Page

**Integrasi modul:** Sales, POS, CRM, E-Commerce
**Arsitektur:** Add-on (Lite Core required)
**Estimasi effort:** 6–8 minggu

---

#### M6. 🛒 Marketplace Integration Hub

**Menyelesaikan:** P6 — channel penjualan tidak tersinkron
**Target segmen:** Seller Tokopedia, Shopee, Lazada, TikTok Shop, Blibli

**Kapabilitas utama:**
- Sync produk & stok real-time ke semua marketplace
- Order aggregator (semua order masuk ke 1 inbox)
- Auto-update status pengiriman
- Omnichannel inventory (stok terpusat, dialokasikan per channel)
- Price management per channel
- Laporan performa per marketplace
- Koneksi ke jasa ekspedisi (JNE, SiCepat, AnterAja, dll)

**Integrasi modul:** Sales, Inventory, E-Commerce, Warehouse
**Arsitektur:** Vertical Module (Lite Core required)
**Estimasi effort:** 10–14 minggu

---

#### M7. 👥 Customer Self-Service Portal

**Menyelesaikan:** P12 — pelanggan B2B harus hubungi sales untuk segalanya
**Target segmen:** Distributor, B2B supplier, jasa profesional

**Kapabilitas utama:**
- Portal login customer (subdomain branded)
- Lihat riwayat order & invoice
- Download invoice PDF & bukti pembayaran
- Submit PO baru langsung dari portal
- Track status pesanan & pengiriman
- Lihat saldo piutang & history pembayaran
- Submit komplain dan lihat status tiket
- Notifikasi WhatsApp/email per event

**Integrasi modul:** Sales, CRM, Finance, Support Ticket
**Arsitektur:** Add-on (Starter Core required)
**Estimasi effort:** 8–10 minggu

---

#### M8. 🤖 AI Operations Assistant

**Menyelesaikan:** P11 — proses berulang masih manual
**Target segmen:** Semua — terutama UKM dengan tim kecil

**Kapabilitas utama:**
- Chatbot internal untuk query data ERP (natural language)
- Auto-categorize transaksi jurnal dari deskripsi
- Smart invoice extraction dari foto/PDF (OCR + AI)
- Anomaly detection di transaksi keuangan
- Summary harian bisnis via WhatsApp
- Draft email follow-up AR otomatis
- Prediksi cash flow 30/60/90 hari ke depan

**Integrasi modul:** Accounting, Finance, Sales, CRM
**Arsitektur:** Add-on premium (semua tier)
**Estimasi effort:** 12–16 minggu

---

### 4.3 MODUL PRIORITAS 3 — Vertical Expansion (Q1–Q2 2027)

---

#### M9. 🏥 Klinik & Healthcare Management

**Menyelesaikan:** Kebutuhan vertikal klinik yang underserved
**Target segmen:** Klinik umum, klinik gigi, klinik kecantikan, puskesmas

**Kapabilitas utama:**
- Manajemen pasien & rekam medis dasar (SOAP)
- Jadwal dokter & antrian digital
- Resep & farmasi sederhana
- BPJS billing & klaim
- Laporan pendapatan per dokter/poli
- Integrasi ke Loyalty (member klinik)

**Arsitektur:** Vertical Module (Starter Core required)

---

#### M10. 🏢 Property & Aset Management

**Menyelesaikan:** Kebutuhan bisnis properti dan pengelola gedung
**Target segmen:** Developer properti, pengelola ruko/kos/apartemen, REIT kecil

**Kapabilitas utama:**
- Portfolio properti (unit, lantai, gedung)
- Kontrak sewa & perpanjangan otomatis
- Tagihan sewa dan service charge
- Maintenance request tenant
- Laporan occupancy rate
- Depresiasi aset properti terintegrasi ke Accounting

**Arsitektur:** Vertical Module (Starter Core required)

---

#### M11. 🍽️ F&B & Restaurant Management

**Menyelesaikan:** Kebutuhan spesifik restoran yang tidak terlayani POS biasa
**Target segmen:** Restoran, kafe, cloud kitchen, franchise F&B

**Kapabilitas utama:**
- Table management & QR order
- Kitchen Display System (KDS)
- Recipe costing & food cost tracking
- Split bill & split payment
- Void & refund workflow
- Menu engineering analytics
- Integrasi ke Loyalty (frequent diner)

**Arsitektur:** Vertical Module (Lite Core required)

---

#### M12. 🌍 Multi-Currency & Cross-Border

**Menyelesaikan:** P13 — bisnis ekspansi regional butuh multi-currency
**Target segmen:** Eksportir, importir, perusahaan dengan operasi ASEAN

**Kapabilitas utama:**
- Transaksi dalam USD, SGD, MYR, EUR, dll
- Kurs otomatis (live rate via API)
- Realisasi selisih kurs (realized/unrealized FX gain/loss)
- Laporan dalam mata uang fungsional + pelaporan
- Multi-entity konsolidasi cross-currency

**Arsitektur:** Add-on (Starter Core required)

---

## 5. Add-on Prioritas yang Direkomendasikan

### 5.1 Add-on Segera (Percepat Development)

| Add-on | Menyelesaikan Pain Point | Prioritas | Arsitektur |
|---|---|---|---|
| **AR Collection Automation** | P3 — piutang tak tertagih | 🔴 Q3 2026 | Add-on: Starter+ |
| **Tax Compliance Pack** | P2 — kepatuhan pajak | 🔴 Q3 2026 | Add-on: Starter+ |
| **WhatsApp Business Integration** | P3, P12 — komunikasi manual | 🔴 Q3 2026 | Add-on: Lite+ |
| **Vendor Portal** | P7 — supplier management lemah | 🟠 Q4 2026 | Add-on: Starter+ |
| **Advanced Reporting & BI** | P1 — cash flow visibility | 🟠 Q4 2026 | Add-on: Lite+ |
| **eSign Integration (Privy/Peruri)** | P8 — dokumen manual | 🟠 Q4 2026 | Add-on: Starter+ |

### 5.2 Detail Add-on Kritis

---

#### A1. 📬 AR Collection Automation

**Fungsi:** Sistem eskalasi piutang otomatis berbasis aging
- Reminder otomatis H-7, H-3, H0, H+7, H+14, H+30 via WhatsApp/email
- Eskalasi ke supervisor jika belum bayar setelah X hari
- Promise-to-pay recording
- Dispute management workflow
- Collector assignment & performance tracking
- Integrasi langsung ke AR Cockpit

**Harga estimasi:** Rp 150.000–300.000/bulan add-on

---

#### A2. 🧾 Tax Compliance Pack Indonesia

**Fungsi:** Automasi kepatuhan pajak end-to-end
- e-Faktur generation & upload ke DJP
- PPh 21 gross-up calculator (bulanan & tahunan)
- PPh 23 withholding on vendor payment
- SPT Masa PPN draft otomatis
- Bukti potong digital
- eFiling integration (jika API tersedia)
- Tax calendar & deadline reminder

**Harga estimasi:** Rp 200.000–500.000/bulan add-on

---

#### A3. 💬 WhatsApp Business Hub

**Fungsi:** Semua notifikasi dan komunikasi bisnis via WhatsApp
- Notifikasi otomatis: invoice terbit, PO approved, stok menipis, gaji transfer
- AR reminder via WhatsApp (terhubung ke A1)
- Customer chat terpusat (inbox CRM)
- Broadcast promo ke segmen customer
- Quick reply template
- OTP & verifikasi via WA

**Harga estimasi:** Rp 99.000–199.000/bulan + biaya per pesan

---

#### A4. 📊 Advanced BI & Analytics Dashboard

**Fungsi:** Business intelligence self-service untuk owner dan manager
- Custom dashboard builder (drag & drop)
- 50+ widget siap pakai (revenue, cost, margin, EBITDA, dll)
- Drill-down dari summary ke transaksi
- Comparative analysis (vs periode lalu, vs budget, vs target)
- Automated report scheduling (email harian/mingguan)
- Mobile-optimized view untuk owner on-the-go

**Harga estimasi:** Rp 200.000–400.000/bulan add-on

---

## 6. Matriks Prioritas & Roadmap

### 6.1 Priority Matrix (Impact vs Effort)

```
HIGH IMPACT
    |  M3-Banking    M1-Subscription   M8-AI Ops
    |  A1-AR Auto    M4-Demand Plan     M6-Marketplace
    |  A2-Tax Pack   M2-DocMgmt        M7-Portal
    |  A3-WhatsApp   M5-Loyalty
    |
    |  M12-FX        M9-Klinik         M11-F&B
    |  A4-BI         M10-Property
    |
LOW IMPACT
    |__________________________|_____________________
           LOW EFFORT              HIGH EFFORT
```

### 6.2 Timeline Roadmap

#### Q3 2026 (Juli–September) — Foundation Gaps
- ✅ Percepat: Advanced WMS, Multi-Entity, Open API & Webhooks
- 🆕 **M1** Subscription & Recurring Billing
- 🆕 **A1** AR Collection Automation
- 🆕 **A2** Tax Compliance Pack Indonesia
- 🆕 **A3** WhatsApp Business Hub

#### Q4 2026 (Oktober–Desember) — Growth Enablers
- 🆕 **M2** Document Management & eSign
- 🆕 **M3** Banking & Payment Integration Hub
- 🆕 **M4** Demand Planning & Supply Chain Intelligence
- 🆕 **M5** Loyalty & Rewards Engine
- 🆕 **A4** Advanced BI & Analytics Dashboard

#### Q1 2027 (Januari–Maret) — Market Expansion
- 🆕 **M6** Marketplace Integration Hub
- 🆕 **M7** Customer Self-Service Portal
- 🆕 **M8** AI Operations Assistant
- 🆕 **M12** Multi-Currency & Cross-Border

#### Q2 2027 (April–Juni) — Vertical Deep Dive
- 🆕 **M9** Klinik & Healthcare Management
- 🆕 **M10** Property & Aset Management
- 🆕 **M11** F&B & Restaurant Management

---

## 7. Estimasi Revenue Impact

| Modul/Add-on | Estimasi Harga/Bulan | Target Adopsi Tahun 1 | ARR Potential |
|---|---|---|---|
| Subscription & Billing (M1) | Rp 150.000 | 500 org | Rp 900 juta |
| Banking Integration (M3) | Rp 250.000 | 800 org | Rp 2,4 miliar |
| AR Collection Auto (A1) | Rp 200.000 | 600 org | Rp 1,44 miliar |
| Tax Compliance Pack (A2) | Rp 300.000 | 1.000 org | Rp 3,6 miliar |
| WhatsApp Hub (A3) | Rp 150.000 | 1.200 org | Rp 2,16 miliar |
| Loyalty Engine (M5) | Rp 200.000 | 400 org | Rp 960 juta |
| Marketplace Hub (M6) | Rp 350.000 | 300 org | Rp 1,26 miliar |
| **TOTAL ARR POTENTIAL** | | | **~Rp 12,7 miliar** |

---

## 8. Rekomendasi Arsitektur Teknis

### 8.1 Prinsip Pengembangan

1. **Module-first, not monolith** — setiap modul baru harus mandiri di `modules/<domain>/`
2. **Event-driven internal** — gunakan internal event bus untuk trigger antar modul (hindari tight coupling)
3. **Progressive disclosure** — modul baru selalu masuk sebagai `released: false` di `addon-registry.ts` sampai QA selesai
4. **Zero-downtime activation** — modul diaktivasi via entitlement, bukan deployment baru
5. **Compliance by design** — data pajak, BPJS, audit trail harus immutable dari awal

### 8.2 Database Schema Principles

- Setiap modul baru butuh prefix tabel yang konsisten (misal: `sub_*` untuk Subscription, `doc_*` untuk Document Management)
- Selalu include `org_id`, `created_at`, `updated_at`, `deleted_at` (soft delete)
- Migrasi via `supabase/migrations/` dengan naming convention: `YYYYMMDDHHMMSS_<deskripsi>.sql`

### 8.3 Integrasi Eksternal Prioritas

| Service | Keperluan | Modul |
|---|---|---|
| **Midtrans / Xendit** | Payment gateway | M3, M1, M5 |
| **WhatsApp Business API** | Notifikasi & chat | A3 |
| **DJP e-Faktur API** | Tax compliance | A2 |
| **Bank Open API** (BCA, Mandiri) | Rekonsiliasi | M3 |
| **Privy / Peruri** | eSign legal | M2 |
| **Tokopedia, Shopee API** | Marketplace sync | M6 |
| **Google Vertex AI** | AI features | M8 |
| **Raja Ongkir / Shipper** | Ekspedisi | M6, Package Tracking |

---

## 9. Competitive Positioning

| Fitur | NIZAM | Odoo | SAP B1 | Accurate | Jurnal |
|---|---|---|---|---|---|
| Subscription Billing | 🆕 Roadmap | ✅ | ✅ | ❌ | ❌ |
| Syirkah/Sharia | ✅ Unik | ❌ | ❌ | ❌ | ❌ |
| AI Operations | 🆕 Roadmap | ⚠️ Partial | ⚠️ Partial | ❌ | ❌ |
| Marketplace Hub | 🆕 Roadmap | ✅ (mahal) | ❌ | ❌ | ❌ |
| Tax Compliance ID | ⚠️ Partial | ⚠️ Manual | ⚠️ Mahal | ✅ | ✅ |
| Harga UKM-friendly | ✅ | ⚠️ | ❌ | ✅ | ✅ |
| Customer Portal | 🆕 Roadmap | ✅ | ✅ | ❌ | ❌ |
| Loyalty Engine | 🆕 Roadmap | ✅ (add-on) | ❌ | ❌ | ❌ |

**Keunggulan kompetitif NIZAM yang harus diperkuat:**
1. **Syirkah module** — satu-satunya ERP dengan fitur akuntansi kemitraan Islam native
2. **Harga UKM-friendly** dengan modular pricing
3. **Bahasa & regulasi Indonesia-first** (e-Faktur, BPJS, PPh native)
4. **All-in-one** dari kasir hingga konsolidasi multi-entity

---

## 10. Quick Wins (< 4 Minggu)

Sebelum memulai modul baru besar, ada beberapa improvement cepat bernilai tinggi:

1. **Sales AR Cockpit** — percepat dari planned ke released (framework sudah ada di addon-registry)
2. **Package Tracking public page** — extend `/toko` dengan tracking real-time
3. **Multi-Entity konsolidasi** — modul sudah planned, dorong ke Q3 2026
4. **Open API docs** — endpoint `/api/openapi` sudah ada, lengkapi dokumentasi Swagger
5. **Mobile PWA** — optimalkan UI untuk mobile owner (mayoritas akses via HP)

---

## 11. Kesimpulan

NIZAM ERP sudah memiliki fondasi arsitektur yang solid dengan 17+ modul aktif. Gap terbesar ada di:

- **Cash flow intelligence** → Banking Integration + AI forecasting
- **Compliance automation** → Tax Pack + eSign
- **Revenue expansion tools** → Subscription Billing + Loyalty + Marketplace Hub
- **Self-service customer** → Customer Portal + WhatsApp Hub

Dengan eksekusi roadmap Q3–Q4 2026, NIZAM berpotensi menambah **Rp 12,7 miliar ARR** dari add-on saja, sambil memperkuat posisi sebagai **ERP paling lengkap untuk UKM Indonesia** dengan aspirasi ASEAN.

---

*Dokumen ini dibuat berdasarkan analisis branch `feat_multi` oleh AI Engineering Assistant.*
*Last updated: 15 Mei 2026*
