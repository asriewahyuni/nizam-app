# ROADMAP MODUL & ADD-ON NIZAM ERP — GLOBAL EXPANSION PLAN
**Versi:** 1.0.0 | **Tanggal:** 2026-05-17 | **Status:** Draft Strategis

---

## RINGKASAN EKSEKUTIF

Dokumen ini memetakan modul dan add-on baru yang direkomendasikan untuk Nizam ERP berdasarkan analisis mendalam terhadap arsitektur `feat_multi`, pain point pelanggan global, dan tren pasar ERP 2025–2027.

Nizam saat ini memiliki fondasi kuat di:
- **4 Pilar Core**: Lite (Sales/POS/CRM/Reports) → Starter (+ Accounting/Finance/Inventory/Purchasing) → Full (+ HRIS/Manufacturing/Audit)
- **Vertical Modules**: Fleet, Services, Construction, LMS, Syirkah, E-Commerce
- **Add-ons**: POS, Sales Page, Quick Bill, Advanced WMS (planned), API (planned), Multi-Entity (planned)

**Gap utama yang perlu diisi** adalah area yang secara global menjadi penyebab churn tertinggi pada ERP mid-market: *compliance otomatis, visibilitas supply chain end-to-end, manajemen pelanggan post-sales, dan kecerdasan data operasional.*

---

## BAGIAN 1 — ANALISIS PAIN POINT PELANGGAN GLOBAL

### 1.1 Pain Point Universal (Semua Segmen Bisnis)

| # | Pain Point | Dampak Bisnis | Frekuensi Keluhan |
|---|---|---|---|
| P1 | Rekonsiliasi bank manual, lambat, dan error-prone | Kehilangan cash visibility harian | ★★★★★ |
| P2 | Tidak ada portal pelanggan untuk invoice & status order | Support ticket meningkat, kepuasan turun | ★★★★★ |
| P3 | Laporan pajak tidak otomatis, compliance risk | Denda & audit risiko | ★★★★★ |
| P4 | Tidak ada notifikasi real-time ke pelanggan/vendor | Komunikasi lambat, trust turun | ★★★★☆ |
| P5 | Data tersebar di banyak tools (Excel, WhatsApp, email) | Double-entry, data tidak akurat | ★★★★☆ |
| P6 | Tidak bisa approve dari mobile/HP | Bottleneck approval chain | ★★★★☆ |
| P7 | Tidak ada demand forecasting & otomasi reorder | Stockout atau overstock | ★★★☆☆ |
| P8 | Integrasi marketplace manual (Tokopedia, Shopee, dll.) | Penjualan tidak tersinkron, order missed | ★★★★☆ |
| P9 | Multi-currency tidak terotomasi (forex rate) | Selisih kurs tidak terlacak | ★★★☆☆ |
| P10 | Tidak ada sistem after-sales terstruktur | Garansi & servis tidak terlacak | ★★★☆☆ |

### 1.2 Pain Point Per Segmen Industri

**Ritel & F&B:**
- Loyalty program / poin reward tidak ada
- Manajemen promo & voucher multi-outlet terbatas
- Kitchen Display System (KDS) untuk F&B tidak ada
- Split bill & table management tidak ada

**Manufaktur & Kontraktor:**
- Material Requirements Planning (MRP) belum ada
- Subcontract work order management tidak ada
- Progress billing otomatis dari milestones konstruksi terbatas
- Quality Control (QC) checklist tidak terintegrasi

**Jasa & Profesional:**
- Time tracking & billing per jam tidak ada
- Resource scheduling / booking kalender tidak ada
- Client portal untuk approval proposal tidak ada
- SLA tracking untuk tiket layanan tidak ada

**HRIS / SDM:**
- Recruitment pipeline (ATS) tidak ada
- Performance management / OKR tidak ada
- Pelatihan online terintegrasi dengan sertifikat terbatas
- Offboarding checklist otomatis tidak ada

**Keuangan & Akuntansi:**
- Konsolidasi laporan multi-entity tidak ada
- Cash flow forecasting otomatis terbatas
- Automated dunning (penagihan otomatis) tidak ada
- Audit trail yang dapat diekspor untuk BPK/KAP tidak ada

---

## BAGIAN 2 — MODUL BARU YANG DIREKOMENDASIKAN

### 2.1 MODUL CORE EXTENSION

---

#### 🏦 M-01: TREASURY & CASH FLOW INTELLIGENCE
**Tier:** Full Core Extension | **Priority:** CRITICAL

**Pain yang diselesaikan:** P1, P9 — Rekonsiliasi bank manual + multi-currency tidak otomatis

**Fitur Utama:**
- Auto bank reconciliation via bank statement import (CSV/MT940/OFX) atau Open Banking API
- Daily cash position dashboard dengan drill-down per rekening & cabang
- Cash flow forecasting 7/30/90 hari berdasarkan AR/AP + pipeline
- Multi-currency dengan auto forex rate (ECB/BI/Wise rate feed)
- Sweep rules: aturan otomatis transfer antar rekening jika saldo di bawah threshold
- Interest & charges tracker untuk pinjaman bank

**Integrasi:**
- → Accounting (jurnal otomatis rekonsiliasi)
- → AR/AP untuk proyeksi cash flow
- → Multi-Entity untuk konsolidasi kas group

**Estimasi Effort:** 6–8 sprint | **Target Release:** Q3 2026

---

#### 📑 M-02: TAX COMPLIANCE ENGINE
**Tier:** Full Core Extension | **Priority:** CRITICAL

**Pain yang diselesaikan:** P3 — Laporan pajak tidak otomatis, compliance risk

**Fitur Utama:**
- e-Faktur Indonesia: generate, validasi, upload ke DJP via API
- e-SPT PPh 21/23/25 otomatis dari data payroll & transaksi
- PPN 12% auto-calculate dengan tracking Faktur Masukan/Keluaran
- Malaysia GST/SST engine (multi-country compliance)
- Tax calendar dengan reminder & deadline tracker
- Audit support: rekap pajak siap diperiksa per periode
- Withholding tax management (PPh Pasal 23/26)

**Integrasi:**
- → Accounting (jurnal pajak)
- → HRIS Payroll (PPh 21 karyawan)
- → Purchasing (PPN masukan)
- → Sales (PPN keluaran)

**Estimasi Effort:** 8–10 sprint | **Target Release:** Q3 2026

---

#### 🔔 M-03: OMNICHANNEL NOTIFICATION HUB
**Tier:** Starter Core Add-on | **Priority:** HIGH

**Pain yang diselesaikan:** P4, P5 — Komunikasi lambat, data tersebar

**Fitur Utama:**
- WhatsApp Business API integration (kirim invoice, reminder, notif status)
- Email transaksional dengan template builder drag-and-drop
- SMS gateway (Twilio, Zenziva, local providers)
- In-app notification center dengan read/unread tracking
- Workflow notification: trigger otomatis berdasarkan event ERP
  - "Invoice jatuh tempo 3 hari lagi" → WhatsApp ke pelanggan
  - "PO disetujui" → email ke vendor
  - "Stok di bawah reorder point" → notif ke tim gudang
- Broadcast marketing sederhana ke segmen kontak
- Template library: invoice, reminder, selamat ulang tahun, dll.

**Integrasi:**
- → CRM Contacts (segmentasi penerima)
- → Sales/Billing (trigger invoice)
- → Purchasing (trigger PO)
- → Inventory (trigger reorder)

**Estimasi Effort:** 5–6 sprint | **Target Release:** Q4 2026

---

#### 👥 M-04: CUSTOMER PORTAL
**Tier:** Vertical Module | **Priority:** HIGH

**Pain yang diselesaikan:** P2 — Tidak ada portal pelanggan self-service

**Fitur Utama:**
- Akses pelanggan ke invoice, tagihan, & riwayat transaksi tanpa login ERP penuh
- Pembayaran langsung dari portal (integrasi payment gateway)
- Tracking status order & pengiriman secara real-time
- Upload dokumen (bukti transfer, dokumen pendukung)
- Raise & track support ticket dari portal
- Statement of Account (SoA) download PDF/Excel
- Approval proposal & quotation online (e-signature sederhana)
- White-label: domain custom, logo & warna brand perusahaan

**Integrasi:**
- → Sales (quotation, invoice)
- → Contacts/CRM (data pelanggan)
- → Notification Hub (kirim link akses)
- → Payment Gateway add-on

**Estimasi Effort:** 6–8 sprint | **Target Release:** Q1 2027

---

#### 🛒 M-05: MARKETPLACE CONNECTOR
**Tier:** Vertical Module / Add-on | **Priority:** HIGH

**Pain yang diselesaikan:** P8 — Integrasi marketplace manual

**Fitur Utama:**
- Sinkronisasi produk & stok otomatis ke/dari:
  - Tokopedia, Shopee, Lazada (Indonesia)
  - TikTok Shop
  - Bukalapak, Blibli
  - Lazada Malaysia, Shopee Malaysia
- Order aggregation: semua order masuk ke satu inbox ERP
- Auto-fulfillment: order confirmed → otomatis buat picking list
- Price sync: update harga dari ERP ke semua channel sekaligus
- Return management: retur marketplace masuk ke inventory
- Komisi & biaya marketplace dihitung otomatis ke COGS

**Integrasi:**
- → Inventory (stok real-time)
- → Sales (order processing)
- → Accounting (jurnal penjualan channel)
- → E-Commerce module (unified catalogue)

**Estimasi Effort:** 8–10 sprint | **Target Release:** Q2 2027

---

### 2.2 MODUL VERTIKAL BARU

---

#### 🏥 M-06: KLINIK & HEALTHCARE
**Tier:** Vertical Module | **Priority:** MEDIUM**

**Pain yang diselesaikan:** Tidak ada solusi ERP untuk klinik/RS kecil

**Fitur Utama:**
- Registrasi & antrean pasien (online + walk-in)
- Medical record sederhana (SOAP notes, diagnosa ICD-10)
- Resep digital & linkage ke apotek/inventory obat
- Billing klinik: konsultasi, tindakan, obat dalam satu tagihan
- BPJS billing & klaim management
- Jadwal dokter & booking appointment
- Referral & surat keterangan dokter digital
- Dashboard: pasien per hari, pendapatan, utilisasi kamar/poli

**Target Market:** Klinik pratama, dokter praktek mandiri, klinik gigi, bidan praktek

**Estimasi Effort:** 10–12 sprint | **Target Release:** Q2 2027

---

#### 🏨 M-07: HOSPITALITY (HOTEL & PROPERTI SEWA)
**Tier:** Vertical Module | **Priority:** MEDIUM

**Pain yang diselesaikan:** Fleet & Rental tidak cukup untuk bisnis hospitality

**Fitur Utama:**
- Room/unit inventory management dengan tipe kamar & rate plan
- Front desk: check-in, check-out, walk-in, reservasi
- Channel manager: sync ke Booking.com, Agoda, Airbnb
- Housekeeping management: status kamar, jadwal cleaning
- F&B integration: room service, minibar charging ke kamar
- Rate management: weekend rate, early bird, promo, corporate rate
- Guest profile & loyalty history
- Laporan occupancy, RevPAR, ADR

**Target Market:** Guest house, hotel butik, villa sewa, kost premium, apartemen sewa

**Estimasi Effort:** 12–14 sprint | **Target Release:** Q3 2027

---

#### 📐 M-08: KONTRAKTOR & PROPERTI DEVELOPER
**Tier:** Vertical Module Extension | **Priority:** HIGH (Extension dari Construction)

**Pain yang diselesaikan:** Modul Construction ada tapi butuh fitur properti developer

**Fitur Utama (Extension dari Construction yang ada):**
- Booking unit properti & PPJB management
- Progress billing otomatis berbasis termin konstruksi
- Site cost control: RAB vs realisasi per kluster/tower
- Subcontractor management: SPK, termin, retensi
- Material procurement planning (link ke Purchasing)
- Sertifikat & IMB tracker per unit
- KPR linkage: tracking persetujuan KPR bank per pembeli
- HOC (House Ownership Certificate) document management

**Estimasi Effort:** 6–8 sprint (di atas Construction) | **Target Release:** Q4 2026

---

#### ⚙️ M-09: AFTER-SALES & WARRANTY MANAGEMENT
**Tier:** Vertical Module | **Priority:** HIGH

**Pain yang diselesaikan:** P10 — Garansi & servis tidak terlacak

**Fitur Utama:**
- Registrasi produk terjual + serial number tracking
- Garansi digital per unit: tanggal mulai, masa berlaku, syarat
- Tiket servis: buka, assign teknisi, tracking progress, tutup
- SLA management: response time & resolution time monitoring
- Spare parts management: stok komponen servis, pemakaian per tiket
- Customer portal integration: pelanggan bisa cek status servis
- Biaya servis: labor + parts → otomatis buat invoice
- Return merchandise authorization (RMA) workflow

**Target Market:** Elektronik, kendaraan, peralatan industri, HVAC

**Estimasi Effort:** 8–10 sprint | **Target Release:** Q1 2027

---

#### 📊 M-10: ANALYTICS & BUSINESS INTELLIGENCE (BI)
**Tier:** Premium Add-on / Full Core Extension | **Priority:** HIGH

**Pain yang diselesaikan:** P5 — Laporan tersebar, tidak ada single source of truth

**Fitur Utama:**
- Drag-and-drop report builder: custom metric & dimension tanpa coding
- Executive dashboard: P&L, cashflow, AR/AP, inventory turnover dalam satu layar
- Drill-through: klik angka → lihat transaksi detailnya
- Scheduled reports: laporan dikirim otomatis via email/WhatsApp
- Cross-module analytics: gabungkan data sales + inventory + HRIS
- KPI tracker: set target, monitor aktual, alert jika deviasi
- Cohort analysis: retensi pelanggan, LTV, churn
- Export ke Excel, PDF, Google Sheets (via Google Sheets API)

**Integrasi:** Semua modul (data warehouse internal)

**Estimasi Effort:** 8–10 sprint | **Target Release:** Q1 2027

---

#### 🤖 M-11: AI OPERATIONS ASSISTANT
**Tier:** Platform Add-on | **Priority:** MEDIUM-HIGH

**Pain yang diselesaikan:** P7 — Tidak ada demand forecasting & insight otomatis

**Fitur Utama:**
- Demand forecasting: prediksi kebutuhan stok 30/60/90 hari (ML berbasis historical data)
- Auto-reorder suggestions: "Stok produk X cukup untuk 12 hari, reorder sekarang?"
- Cash flow prediction: estimasi saldo 30 hari ke depan berdasarkan AR/AP
- Anomaly detection: "Pengeluaran kategori X bulan ini 40% di atas rata-rata"
- Smart categorization: auto-tag transaksi ke akun CoA yang tepat
- Invoice data extraction: upload foto/PDF invoice → auto-isi form
- Chatbot asisten: tanya via chat "Berapa total penjualan bulan lalu?" → jawab instan
- Berbasis Google Vertex AI (sudah terintegrasi di stack)

**Estimasi Effort:** 8–10 sprint | **Target Release:** Q2 2027

---

#### 📋 M-12: PROCUREMENT INTELLIGENCE & VENDOR MANAGEMENT
**Tier:** Full Core Extension | **Priority:** MEDIUM-HIGH

**Pain yang diselesaikan:** P5, P7 — Procurement tidak terotomasi, vendor tidak terkelola

**Fitur Utama:**
- Vendor portal: vendor upload penawaran, konfirmasi PO, update status pengiriman
- Vendor scorecard: rating berdasarkan ketepatan, kualitas, harga
- RFQ (Request for Quotation): kirim RFQ ke multiple vendor, bandingkan penawaran
- Blanket PO: PO jangka panjang dengan call-off order
- Auto PO creation: trigger dari reorder point inventory
- Spend analysis: berapa yang dibelanjakan per vendor, per kategori
- 3-way matching: PO → GRN → Invoice matching otomatis
- Supplier contract management: kontrak, harga kesepakatan, tanggal berlaku

**Integrasi:**
- → Purchasing (extension)
- → Inventory (reorder trigger)
- → Accounting (AP matching)

**Estimasi Effort:** 6–8 sprint | **Target Release:** Q3 2026

---

## BAGIAN 3 — ADD-ON BARU YANG DIREKOMENDASIKAN

### 3.1 Add-on Fungsional

---

#### 🔁 A-01: PAYMENT GATEWAY INTEGRATION
**Key:** `payment-gateway` | **Priority:** CRITICAL

**Deskripsi:** Terima pembayaran online langsung dari Nizam — link pembayaran, QR QRIS, VA bank.

**Provider yang didukung:**
- Midtrans (QRIS, VA BCA/BNI/BRI/Mandiri, e-wallet GoPay/OVO/DANA/ShopeePay)
- Xendit (Link aja, credit card)
- Stripe (untuk pelanggan global/USD)
- Doku, iPaymu (backup)

**Fitur:**
- Payment link otomatis di-generate dari invoice
- Auto-reconcile: pembayaran masuk → invoice otomatis marked Paid
- Split payment: satu invoice bisa dibayar dalam beberapa kali
- Refund management terintegrasi
- Laporan settlement per payment gateway

**Harga Add-on:** Rp 150.000/bulan + transaction fee

---

#### 📱 A-02: MOBILE APPROVAL APP
**Key:** `mobile-approval` | **Priority:** HIGH

**Deskripsi:** Approve PO, invoice, reimbursement, leave request langsung dari HP tanpa buka laptop.

**Fitur:**
- Push notification untuk pending approval
- Approve/reject dengan 1 tap + komentar
- Preview dokumen pendukung di mobile
- Approval history & audit trail
- Offline mode: approve tersimpan lokal, sync saat online
- Biometric authentication (fingerprint/FaceID)

**Platform:** Progressive Web App (PWA) — tidak perlu install dari app store

**Harga Add-on:** Rp 50.000/bulan (per 5 approver)

---

#### 🏷️ A-03: LOYALTY & REWARDS ENGINE
**Key:** `loyalty-rewards` | **Priority:** HIGH (terutama untuk ritel & F&B)

**Deskripsi:** Program loyalitas pelanggan: poin, tier, voucher, cashback.

**Fitur:**
- Poin reward otomatis dari setiap transaksi (configurable rate)
- Tier membership: Bronze, Silver, Gold, Platinum dengan benefit berbeda
- Voucher & promo: generate, distribute, redeem di POS/Sales
- Referral program: pelanggan ajak teman → dapat poin
- Birthday reward: otomatis kirim voucher di hari ulang tahun
- Leaderboard: gamifikasi untuk repeat buyer
- Loyalty card digital: QR code per pelanggan

**Integrasi:** → POS, Sales, CRM, Notification Hub

**Harga Add-on:** Rp 200.000/bulan

---

#### ⏱️ A-04: TIME TRACKING & BILLABLE HOURS
**Key:** `time-tracking` | **Priority:** HIGH (untuk bisnis jasa & profesional)

**Deskripsi:** Catat waktu kerja per project/klien, auto-generate invoice berbasis jam.

**Fitur:**
- Timer: start/stop langsung dari task atau project
- Manual time entry dengan approval manager
- Billable vs non-billable hours per proyek
- Auto-invoice: dari timesheet → invoice ke klien
- Resource utilization: berapa % waktu tiap karyawan terisi
- Budget hours vs aktual per proyek
- Integrasi dengan Google Calendar / Outlook Calendar
- Laporan produktivitas: revenue per hour, profitability per klien

**Integrasi:** → HRIS, Projects/Construction, Sales (billing)

**Harga Add-on:** Rp 100.000/bulan

---

#### 🔗 A-05: OPEN BANKING & BANK STATEMENT AUTO-IMPORT
**Key:** `open-banking` | **Priority:** HIGH

**Deskripsi:** Auto-import mutasi rekening bank setiap hari untuk rekonsiliasi otomatis.

**Fitur:**
- Koneksi ke 20+ bank Indonesia (BCA, BNI, BRI, Mandiri, dll.) via API/screen scraping aman
- Auto-import mutasi harian / real-time
- AI matching: cocokkan mutasi dengan invoice/PO yang ada
- Unmatched items: flagged untuk review manual
- Multi-rekening dalam satu view
- Export statement ke format akuntansi

**Integrasi:** → Cash/Finance, Accounting, Treasury module

**Harga Add-on:** Rp 150.000/bulan

---

#### 📦 A-06: BARCODE & QR INVENTORY SCANNER
**Key:** `barcode-scanner` | **Priority:** MEDIUM-HIGH

**Deskripsi:** Gunakan HP sebagai scanner barcode/QR untuk operasional gudang tanpa hardware khusus.

**Fitur:**
- Scan via kamera HP (web-based, tidak perlu app install)
- Dukungan barcode 1D (EAN, UPC, Code128) dan 2D (QR Code, DataMatrix)
- Operasi: receive goods, stock opname, pick & pack, bin transfer
- Batch scanning: scan banyak item sekaligus
- Print label barcode/QR dari browser
- Offline mode: scan tersimpan lokal, sync saat ada koneksi
- Integrasi dengan Bluetooth scanner (HID mode)

**Integrasi:** → Inventory, Warehouse/Advanced WMS

**Harga Add-on:** Rp 100.000/bulan

---

#### 📝 A-07: DIGITAL SIGNATURE & DOCUMENT MANAGEMENT
**Key:** `e-sign` | **Priority:** MEDIUM-HIGH

**Deskripsi:** Tanda tangan digital yang sah secara hukum untuk kontrak, PO, invoice, dan dokumen internal.

**Fitur:**
- E-signature untuk dokumen ERP (PO, kontrak, perjanjian)
- Multi-signer workflow: urutan tanda tangan yang teratur
- Audit trail lengkap: siapa, kapan, dari IP mana
- Integrasi PrivyID / Peruri untuk tanda tangan bersertipikat
- Document vault: penyimpanan dokumen terstruktur & searchable
- Template dokumen: kontrak standar, NDA, SPK
- Expiry reminder: dokumen kontrak yang akan habis masa berlakunya

**Integrasi:** → Purchasing (PO), Sales (kontrak), HRIS (kontrak kerja)

**Harga Add-on:** Rp 150.000/bulan (termasuk 50 e-sign/bulan)

---

#### 🌍 A-08: MULTI-CURRENCY PRO
**Key:** `multi-currency-pro` | **Priority:** MEDIUM-HIGH

**Deskripsi:** Transaksi dalam 30+ mata uang dengan auto-forex rate dan laporan konsolidasi.

**Fitur:**
- Auto-fetch forex rate harian (Bank Indonesia, ECB, Wise)
- Transaksi invoice/PO dalam mata uang asing
- Realized/unrealized forex gain & loss otomatis dijurnal
- Functional currency: laporan keuangan dalam IDR atau USD
- Multi-currency bank account management
- Hedging exposure report

**Integrasi:** → Accounting, Sales, Purchasing, Treasury

**Harga Add-on:** Rp 200.000/bulan

---

#### 🎯 A-09: SALES PERFORMANCE & COMMISSION ENGINE
**Key:** `sales-commission` | **Priority:** MEDIUM

**Deskripsi:** Hitung komisi sales otomatis berdasarkan aturan yang bisa dikonfigurasi.

**Fitur:**
- Commission rule builder: % dari revenue, profit, atau quantity
- Tiered commission: semakin besar target tercapai, semakin tinggi %
- Deduction rules: retur & diskon mengurangi basis komisi
- Commission approval workflow
- Sales leaderboard & target tracking dashboard
- Payout integration: komisi langsung ke payroll HRIS
- Territory management: assign wilayah per sales

**Integrasi:** → Sales, HRIS Payroll, CRM

**Harga Add-on:** Rp 100.000/bulan

---

#### 🏗️ A-10: MRP (MATERIAL REQUIREMENTS PLANNING)
**Key:** `mrp` | **Priority:** HIGH (untuk manufaktur)

**Deskripsi:** Rencanakan kebutuhan material berdasarkan jadwal produksi dan BOM.

**Fitur:**
- MPS (Master Production Schedule): rencana produksi jangka menengah
- MRP run: hitung kebutuhan material dari BOM + stok saat ini + safety stock
- Auto-generate purchase requisition dari MRP output
- Kapasitas mesin & tenaga kerja (Rough-Cut Capacity Planning)
- Lead time awareness: hitung PO harus dibuat kapan
- What-if simulation: "Jika produksi 1.000 unit bulan depan, apa yang perlu dibeli?"

**Integrasi:** → Factory/Manufacturing, Inventory, Purchasing

**Harga Add-on:** Rp 300.000/bulan

---

#### 🚀 A-11: ONBOARDING & CHANGE MANAGEMENT ACCELERATOR
**Key:** `onboarding-pro` | **Priority:** MEDIUM

**Deskripsi:** Paket implementasi terstruktur untuk pelanggan baru agar go-live lebih cepat.

**Fitur:**
- Guided setup wizard per modul yang dipilih
- Data migration template (Excel → ERP) dengan validator
- Opening balance wizard: setup saldo awal neraca
- Training video library terintegrasi di dalam aplikasi (link ke LMS)
- Progress tracker: X dari Y langkah setup selesai
- Dedicated implementer chat support

**Harga Add-on:** Rp 500.000 (one-time) + Rp 50.000/bulan (ongoing support tools)

---

#### 🔐 A-12: ADVANCED SECURITY & COMPLIANCE PACK
**Key:** `security-compliance` | **Priority:** MEDIUM

**Deskripsi:** Keamanan enterprise dan alat compliance untuk bisnis yang membutuhkan audit trail ketat.

**Fitur:**
- SSO (Single Sign-On): Google Workspace, Microsoft 365, SAML 2.0
- IP whitelist: akses hanya dari jaringan tertentu
- Session management: force logout, max session per user
- 2FA wajib untuk role tertentu
- Data export audit log (siap untuk audit eksternal)
- GDPR/PDPA compliance tools: data subject request, data retention policy
- Penetration testing report (per tahun, dari Nizam security team)

**Harga Add-on:** Rp 300.000/bulan

---

### 3.2 Add-on Kapasitas

| Add-on | Key | Deskripsi | Harga |
|---|---|---|---|
| Extra Branch | `extra-branch` | Tambah 5 cabang/divisi di atas limit paket | Rp 50.000/5 cabang/bulan |
| Extra User Seat | `extra-seat` | Tambah 5 user di atas limit paket | Rp 50.000/5 user/bulan |
| Extra Storage | `extra-storage` | Tambah 10 GB penyimpanan file & lampiran | Rp 25.000/10 GB/bulan |
| Extra API Calls | `extra-api` | Tambah 10.000 API call/bulan | Rp 50.000/10k calls/bulan |
| Dedicated DB | `dedicated-db` | Database instance terpisah untuk isolasi penuh | Rp 500.000/bulan |

---

## BAGIAN 4 — ARSITEKTUR PAKET YANG DIREKOMENDASIKAN

```
┌─────────────────────────────────────────────────────────────────┐
│                    NIZAM PLATFORM CORE                          │
│     Dashboard · Cabang · Settings · Audit · Support            │
└──────────────┬──────────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────────────┐
│ LITE CORE    │ Sales · POS · CRM · Reports                      │
├──────────────┼──────────────────────────────────────────────────┤
│ STARTER CORE │ + Accounting · Finance · Inventory · Purchasing  │
├──────────────┼──────────────────────────────────────────────────┤
│ FULL CORE    │ + HRIS · Manufacturing · Audit                   │
└──────────────┴──────────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────────────┐
│ VERTICAL MODULES (pilih sesuai industri)                        │
│  Fleet & Rental │ Job Order │ Construction │ LMS               │
│  E-Commerce │ Syirkah │ Klinik* │ Hospitality* │ After-Sales*  │
└──────────────┬──────────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────────────┐
│ ADD-ONS (stackable, per modul yang relevan)                     │
│  Payment Gateway │ Loyalty & Rewards │ Marketplace Connector   │
│  Mobile Approval │ Time Tracking │ Open Banking │ MRP          │
│  E-Sign │ Multi-Currency Pro │ Sales Commission │ BI Analytics │
│  Notification Hub │ Barcode Scanner │ Security Pack           │
└─────────────────────────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────────────┐
│ CAPACITY ADD-ONS                                                │
│  Multi-Entity │ Extra Branch │ Extra Seat │ Extra Storage       │
└─────────────────────────────────────────────────────────────────┘
```

---

## BAGIAN 5 — ROADMAP PRIORITAS

### Phase 1: Q3 2026 — Revenue Protector (Mengurangi Churn)
| Item | Effort | Impact |
|---|---|---|
| Tax Compliance Engine (M-02) | ████████░░ 8sp | ★★★★★ |
| Treasury & Cash Flow Intelligence (M-01) | ████████░░ 8sp | ★★★★★ |
| Payment Gateway Integration (A-01) | ██████░░░░ 6sp | ★★★★★ |
| Omnichannel Notification Hub (M-03) | ██████░░░░ 6sp | ★★★★☆ |
| Procurement Intelligence (M-12) | ████████░░ 8sp | ★★★★☆ |

### Phase 2: Q4 2026 — Market Expansion (Masuk Vertikal Baru)
| Item | Effort | Impact |
|---|---|---|
| After-Sales & Warranty (M-09) | ████████░░ 8sp | ★★★★☆ |
| Kontraktor & Properti Dev Extension (M-08) | ████████░░ 8sp | ★★★★☆ |
| Mobile Approval App (A-02) | ████░░░░░░ 4sp | ★★★★☆ |
| Open Banking (A-05) | ██████░░░░ 6sp | ★★★★☆ |
| Loyalty & Rewards (A-03) | ██████░░░░ 6sp | ★★★★☆ |
| Barcode Scanner (A-06) | ████░░░░░░ 4sp | ★★★☆☆ |

### Phase 3: Q1 2027 — Stickiness (Meningkatkan Retensi)
| Item | Effort | Impact |
|---|---|---|
| Customer Portal (M-04) | ████████░░ 8sp | ★★★★★ |
| Analytics & BI (M-10) | ██████████ 10sp | ★★★★★ |
| Time Tracking (A-04) | ██████░░░░ 6sp | ★★★★☆ |
| Digital Signature (A-07) | ██████░░░░ 6sp | ★★★★☆ |
| Sales Commission Engine (A-09) | ████░░░░░░ 4sp | ★★★☆☆ |

### Phase 4: Q2–Q3 2027 — Platform Leadership
| Item | Effort | Impact |
|---|---|---|
| AI Operations Assistant (M-11) | ██████████ 10sp | ★★★★★ |
| Marketplace Connector (M-05) | ██████████ 10sp | ★★★★☆ |
| Klinik & Healthcare (M-06) | ████████████ 12sp | ★★★★☆ |
| Hospitality (M-07) | ██████████████ 14sp | ★★★★☆ |
| MRP (A-10) | ██████░░░░ 6sp | ★★★★☆ |
| Multi-Currency Pro (A-08) | ██████░░░░ 6sp | ★★★☆☆ |

---

## BAGIAN 6 — PROYEKSI DAMPAK BISNIS

### 6.1 Estimasi Revenue Uplift per Add-on

| Add-on | Target Adopsi (% pelanggan) | ARPU Tambahan/bulan |
|---|---|---|
| Payment Gateway | 70% | Rp 150.000 |
| Tax Compliance Engine | 80% | Rp 200.000 |
| Notification Hub | 60% | Rp 100.000 |
| Loyalty & Rewards | 40% (ritel/F&B) | Rp 200.000 |
| Open Banking | 50% | Rp 150.000 |
| Customer Portal | 30% | Rp 250.000 |
| Mobile Approval | 45% | Rp 50.000 |
| Time Tracking | 35% (jasa) | Rp 100.000 |
| BI Analytics | 25% | Rp 300.000 |

**Proyeksi ARPU uplift jika semua Phase 1 selesai:** +Rp 500.000–800.000/pelanggan/bulan

### 6.2 Segmen Pelanggan yang Dibuka

| Segmen Baru | Modul Kunci | Market Size (Est.) |
|---|---|---|
| Klinik & Kesehatan | M-06 Klinik | 10.000+ klinik di Indonesia |
| Hotel & Hospitality | M-07 Hospitality | 15.000+ akomodasi |
| Developer Properti | M-08 Property Dev | 5.000+ pengembang |
| E-commerce / Reseller | M-05 Marketplace | 20.000+ seller multi-channel |
| Konsultan & Agency | M-09 + A-04 Time Tracking | 30.000+ bisnis jasa |

---

## BAGIAN 7 — PERTIMBANGAN TEKNIS

### 7.1 Arsitektur yang Perlu Dipersiapkan

1. **Event Bus / Webhook Internal**: Diperlukan untuk Notification Hub (M-03) — setiap modul perlu emit events yang bisa di-subscribe oleh modul lain.

2. **Data Warehouse Layer**: Untuk BI Analytics (M-10) dan AI Assistant (M-11) — perlu skema bintang (star schema) terpisah dari OLTP, atau minimal materialized views yang di-refresh periodik.

3. **File Storage Expansion**: Customer Portal, E-Sign, dan Document Management butuh S3 yang lebih terstruktur dengan per-tenant path isolation.

4. **Background Job Queue**: MRP, demand forecasting, bank statement import, dan notification sending semua butuh job queue yang andal (misalnya pg-boss atau BullMQ di atas Redis).

5. **Multi-Currency Data Model**: Kolom tambahan `currency_code` dan `exchange_rate` di tabel transaksi utama sebelum Multi-Currency Pro diluncurkan.

6. **API Gateway**: Open Banking dan Marketplace Connector butuh API gateway atau rate-limiter agar tidak melebihi limit provider eksternal.

### 7.2 Dependencies Antar Modul

```
Tax Compliance Engine → Accounting (jurnal pajak) + HRIS Payroll (PPh 21)
Treasury Intelligence → Cash/Finance + Accounting + Multi-Currency Pro
Customer Portal → Sales + CRM + Notification Hub + Payment Gateway
Marketplace Connector → Inventory + Sales + Accounting (E-Commerce)
MRP → Factory + Inventory + Purchasing
AI Assistant → semua modul (read-only analytics)
Loyalty & Rewards → POS + Sales + CRM + Notification Hub
```

### 7.3 Estimasi Tim yang Dibutuhkan

| Role | Phase 1 | Phase 2 | Phase 3-4 |
|---|---|---|---|
| Full-stack Dev | 3–4 | 4–5 | 5–6 |
| Backend/DB Specialist | 1–2 | 2 | 2–3 |
| UI/UX Designer | 1 | 1–2 | 2 |
| QA Engineer | 1 | 1–2 | 2 |
| DevOps/Infra | 1 | 1 | 1–2 |
| Product Manager | 1 | 1 | 1–2 |

---

## BAGIAN 8 — REKOMENDASI SEGERA (QUICK WINS)

Beberapa hal yang bisa langsung dimulai tanpa menunggu phase penuh:

1. **WhatsApp Notification untuk Invoice** (2–3 sprint) — integrasi WhatsApp Business API untuk kirim invoice PDF otomatis ke pelanggan saat invoice dibuat/due date mendekat. Impact: langsung reduce AR days outstanding.

2. **QRIS Payment Link di Invoice** (2 sprint) — tambahkan link/QR QRIS di PDF invoice. Tidak perlu full payment gateway module dulu.

3. **Barcode Scan via HP** (2–3 sprint) — gunakan PWA + kamera untuk scan di receiving goods dan stock opname. Impact: kurangi error manual entry.

4. **Approval via WhatsApp** (3 sprint) — kirim notif WhatsApp untuk pending approval + tombol "Approve/Reject" via WhatsApp Web. Impact: bottleneck approval langsung terpecahkan.

5. **Bank Statement Import CSV** (2 sprint) — upload CSV mutasi rekening → auto-match ke transaksi ERP. Tidak perlu Open Banking API dulu.

---

## LAMPIRAN — DAFTAR KODE MODUL & ADD-ON

| Kode | Nama | Tipe | Status |
|---|---|---|---|
| M-01 | Treasury & Cash Flow Intelligence | Core Extension | Planned |
| M-02 | Tax Compliance Engine | Core Extension | Planned |
| M-03 | Omnichannel Notification Hub | Platform Add-on | Planned |
| M-04 | Customer Portal | Vertical Module | Planned |
| M-05 | Marketplace Connector | Vertical Module | Planned |
| M-06 | Klinik & Healthcare | Vertical Module | Planned |
| M-07 | Hospitality | Vertical Module | Planned |
| M-08 | Kontraktor & Properti Developer | Vertical Extension | Planned |
| M-09 | After-Sales & Warranty | Vertical Module | Planned |
| M-10 | Analytics & Business Intelligence | Platform Add-on | Planned |
| M-11 | AI Operations Assistant | Platform Add-on | Planned |
| M-12 | Procurement Intelligence | Core Extension | Planned |
| A-01 | Payment Gateway Integration | Add-on | Planned |
| A-02 | Mobile Approval App | Add-on | Planned |
| A-03 | Loyalty & Rewards Engine | Add-on | Planned |
| A-04 | Time Tracking & Billable Hours | Add-on | Planned |
| A-05 | Open Banking & Statement Import | Add-on | Planned |
| A-06 | Barcode & QR Scanner | Add-on | Planned |
| A-07 | Digital Signature & Document Mgmt | Add-on | Planned |
| A-08 | Multi-Currency Pro | Add-on | Planned |
| A-09 | Sales Performance & Commission | Add-on | Planned |
| A-10 | MRP (Material Requirements Planning) | Add-on | Planned |
| A-11 | Onboarding Accelerator | Add-on | Planned |
| A-12 | Advanced Security & Compliance | Add-on | Planned |

---

*Dokumen ini adalah dokumen hidup — diperbarui setiap sprint planning.*
*Owner: Product Team Nizam | Review: Setiap 3 bulan*
