# NIZAM ERP — Rencana Global Modul dan Add-on Baru
## Mengatasi Pain Point Customer Secara Global

---

**Metadata Dokumen**

| Field | Value |
|---|---|
| Versi | `2.0` |
| Tanggal | `9 Mei 2026` |
| Status | `Strategic Roadmap` |
| Branch Referensi | `feat_multi` |
| Tujuan | Memetakan modul dan add-on baru yang mengatasi pain point customer global, belum tersedia di NIZAM saat ini |

---

## 1. Ringkasan Eksekutif

NIZAM telah memiliki fondasi ERP yang kuat:

**Platform Core** — Auth, Org, Branch, Settings, RBAC, Billing SaaS  
**Core Family** — Finance, Revenue, Purchasing, Inventory, HRIS  
**Vertical Modules** — Manufacturing, Fleet & Rental, Services, Construction, Syirkah  
**Strategic Module** — Academy / EDU  
**Add-ons** — POS, Advanced WMS, Sales Page, API, Multi-Entity, Quick Bill  

Namun ada **gap besar** antara apa yang sudah ada dengan apa yang dibutuhkan customer global. Dokumen ini mengidentifikasi **14 Modul Baru** dan **16 Add-on Baru** yang akan menyelesaikan pain point customer secara sistematis — dari UMKM lokal hingga enterprise multinasional.

Prinsip seleksi:
1. Pain point harus terukur dan dialami oleh minimal 3 segmen customer yang berbeda.
2. Setiap modul/add-on harus memiliki proposisi nilai yang jelas terhadap kapabilitas yang sudah ada.
3. Prioritas diperhitungkan berdasarkan frekuensi pain, kompleksitas implementasi, dan potensi revenue impact.

---

## 2. Pemetaan Pain Point Customer Global

### 2.1 Pain Point yang Paling Sering Dilaporkan (Universal)

| # | Pain Point | Segmen Terdampak | Frekuensi | Severity |
|---|---|---|---|---|
| 1 | Tidak bisa terima pembayaran digital langsung dari sistem | Semua bisnis | Sangat Tinggi | Kritis |
| 2 | Pengelolaan dokumen kontrak masih manual / email | B2B, Konstruksi, Jasa | Sangat Tinggi | Tinggi |
| 3 | Tidak ada notifikasi otomatis ke customer via WhatsApp/SMS | Retail, Jasa, Distribusi | Sangat Tinggi | Kritis |
| 4 | Pelaporan pajak (e-Faktur, PPN, PPh) masih dilakukan manual di luar sistem | Semua bisnis formal | Sangat Tinggi | Kritis |
| 5 | Tidak ada portal self-service untuk customer (lihat invoice, track order) | B2B, E-commerce, Jasa | Tinggi | Tinggi |
| 6 | Pesanan dari marketplace (Shopee, Tokopedia, Lazada) tidak terintegrasi | Retail online, Distribusi | Tinggi | Tinggi |
| 7 | Program loyalitas / poin customer masih dikelola di spreadsheet | Retail, F&B, Apotek | Tinggi | Sedang |
| 8 | Tidak ada manajemen aset dan pemeliharaan mesin yang sistematis | Manufaktur, Properti | Tinggi | Tinggi |
| 9 | Tidak bisa kelola bisnis langganan (subscription) | SaaS, Media, Gym, Klinik | Tinggi | Tinggi |
| 10 | Supplier tidak bisa konfirmasi PO atau upload invoice secara mandiri | Manufaktur, Distribusi | Sedang | Sedang |
| 11 | Tidak ada kontrol kualitas (QC) di alur produksi atau penerimaan barang | Manufaktur, Distribusi | Sedang | Tinggi |
| 12 | Tidak ada alat analitik HR untuk prediksi turnover dan produktivitas | Perusahaan 50+ karyawan | Sedang | Sedang |
| 13 | Tidak ada tanda tangan digital terintegrasi untuk dokumen | B2B, Syirkah, Konstruksi | Sedang | Tinggi |
| 14 | Pengelolaan properti dan sewa aset masih manual | Properti, Leasing | Sedang | Sedang |
| 15 | Koperasi simpan pinjam tidak punya modul khusus | Koperasi, BMT | Sedang | Tinggi |
| 16 | Tim lapangan (sales rep/teknisi) tidak punya akses mobile real-time | Distribusi, Servis | Sedang | Sedang |

### 2.2 Segmentasi Customer Global NIZAM

```
┌─────────────────────────────────────────────────────┐
│             SEGMEN CUSTOMER GLOBAL NIZAM            │
├─────────────┬──────────────────┬───────────────────┤
│    UMKM     │    MID-MARKET    │    ENTERPRISE     │
│  (1-50 org) │  (50-500 org)    │  (500+ org)       │
├─────────────┼──────────────────┼───────────────────┤
│ - Retail    │ - Distribusi     │ - Grup usaha      │
│ - F&B       │ - Manufaktur     │ - Holding         │
│ - Jasa      │ - Konstruksi     │ - Franchise chain │
│ - Dagang    │ - Properti       │ - Multinasional   │
│ - Koperasi  │ - Klinik/RS      │ - Institusi       │
└─────────────┴──────────────────┴───────────────────┘
```

---

## 3. Modul Baru — Analisis dan Rekomendasi

### 3.1 Modul: Payment Hub (Integrasi Gateway Pembayaran)

**Pain Point yang Diselesaikan:** Customer tidak bisa menerima pembayaran digital langsung dari sistem. Invoice yang dikirimkan tidak bisa langsung dibayar.

**Proposisi Nilai:**
- Invoice NIZAM langsung memiliki link bayar (Midtrans, Xendit, Stripe, GoPay, OVO, QRIS)
- Pembayaran otomatis memperbarui status piutang dan membuat jurnal
- Rekonsiliasi pembayaran otomatis dari settlement gateway

**Scope Kapabilitas:**
1. Koneksi ke minimal 4 payment gateway (Midtrans, Xendit, Stripe, QRIS Nasional)
2. Pembayaran via link invoice (pay-by-link)
3. Webhook payment event → auto jurnal kas masuk
4. Dashboard monitoring status transaksi gateway
5. Rekonsiliasi otomatis dengan mutasi bank
6. Payment method management per organisasi
7. Split payment (cash + transfer + kartu)

**Dependency:** Finance Core, Revenue Core  
**Klasifikasi:** `Module` (bukan sekadar add-on — ini menjadi system of record pembayaran digital)  
**Priority:** **P0 — Kritis**

---

### 3.2 Modul: Tax Compliance Center

**Pain Point yang Diselesaikan:** Pelaporan pajak (PPN, PPh 21, PPh 23, e-Faktur) masih dilakukan manual di luar sistem, menyebabkan human error, keterlambatan, dan risiko sanksi DJP.

**Proposisi Nilai:**
- Kalkulasi otomatis PPN, PPh 21 dan PPh 23 dari transaksi NIZAM
- Generate e-Faktur siap upload ke Coretax / efaktur.pajak.go.id
- Manajemen NPWP, PKP status, dan nomor seri faktur
- Arsip laporan pajak per periode

**Scope Kapabilitas:**
1. Konfigurasi profil perpajakan per organisasi (PKP/non-PKP)
2. Mapping kode objek pajak ke COA dan item
3. Generate file CSV/XML e-Faktur standar DJP
4. Rekap PPh 21 per karyawan (connect ke HRIS Payroll)
5. PPh 23 dari pembayaran jasa ke vendor
6. Monitor jatuh tempo pelaporan dan pembayaran pajak
7. Arsip bukti potong digital
8. Dashboard kewajiban pajak bulanan/tahunan

**Dependency:** Finance Core, Revenue Core, Purchasing, HRIS  
**Klasifikasi:** `Module`  
**Priority:** **P0 — Kritis untuk pasar Indonesia**

---

### 3.3 Modul: Document Management System (DMS)

**Pain Point yang Diselesaikan:** Pengelolaan dokumen kontrak, PO, invoice, dan kebijakan masih tersebar di email, Google Drive, atau WhatsApp. Tidak ada versioning, approval trail, atau expiry tracking.

**Proposisi Nilai:**
- Satu tempat untuk semua dokumen bisnis
- Approval workflow digital dengan notifikasi
- Expiry alert untuk kontrak, lisensi, sertifikat
- Linked documents ke transaksi (PO, SO, invoice)

**Scope Kapabilitas:**
1. Upload dan penyimpanan dokumen (S3 backend — sudah ada)
2. Kategorisasi: Kontrak, Legal, Keuangan, HR, Operasional
3. Versioning dokumen (v1, v2, v3)
4. Approval workflow: draft → review → approved → active
5. Expiry date tracking dan notifikasi otomatis
6. Link dokumen ke entitas (vendor, customer, project, karyawan)
7. Full-text search di nama dan metadata dokumen
8. Akses kontrol berbasis role

**Dependency:** Platform Core (Auth, Org), AWS S3 (sudah ada)  
**Klasifikasi:** `Module`  
**Priority:** **P1**

---

### 3.4 Modul: Subscription & Recurring Billing

**Pain Point yang Diselesaikan:** Bisnis dengan model langganan (gym, klinik, media, SaaS, asuransi, credit) tidak dapat mengelola siklus billing berulang, dunning, dan lifecycle member secara otomatis.

**Proposisi Nilai:**
- Auto-invoice berdasarkan jadwal langganan
- Dunning management (reminder + suspension otomatis)
- Trial, grace period, upgrade/downgrade plan
- Laporan MRR, ARR, Churn Rate

**Scope Kapabilitas:**
1. Manajemen plan berlangganan (monthly, quarterly, annual)
2. Subscriber onboarding dan lifecycle management
3. Auto-generate invoice berulang sesuai jadwal
4. Dunning sequence: reminder → overdue → suspend → cancel
5. Trial period dan free tier management
6. Upgrade / downgrade plan dengan proration
7. Metrik: MRR, ARR, Churn, LTV
8. Integrasi ke Payment Hub untuk auto-charge
9. Portal member self-service (lihat status, invoice, ganti plan)

**Dependency:** Revenue Core, Finance Core, Payment Hub  
**Klasifikasi:** `Module`  
**Priority:** **P1**

---

### 3.5 Modul: Quality Management System (QMS)

**Pain Point yang Diselesaikan:** Manufaktur dan distribusi tidak memiliki sistem pemeriksaan kualitas yang terintegrasi. QC dilakukan manual di kertas, hasilnya tidak ter-trace, dan return barang tidak ter-link ke alur pembelian/produksi.

**Proposisi Nilai:**
- Checklist QC digital di setiap titik pemeriksaan
- Non-conformance (NCR) tracking dan tindakan korektif
- QC linked ke penerimaan barang, work order, dan pengiriman
- Laporan acceptance rate dan defect trend

**Scope Kapabilitas:**
1. Konfigurasi inspection template per produk / kategori
2. QC Inspection pada penerimaan barang (incoming)
3. QC Inspection pada proses produksi (in-process)
4. QC Inspection sebelum pengiriman (outgoing)
5. Non-Conformance Report (NCR) dengan root cause dan CAPA
6. Hold / quarantine management untuk item bermasalah
7. Supplier quality scorecard
8. Laporan defect rate, rejection trend, CAPA status

**Dependency:** Inventory Core, Manufacturing, Purchasing  
**Klasifikasi:** `Module`  
**Priority:** **P1 — untuk segmen manufaktur**

---

### 3.6 Modul: Maintenance Management / CMMS

**Pain Point yang Diselesaikan:** Mesin, kendaraan, dan peralatan rusak tanpa jadwal perawatan. Biaya perbaikan darurat jauh lebih mahal dari maintenance preventif. Tidak ada histori kerusakan per aset.

**Proposisi Nilai:**
- Jadwal preventive maintenance otomatis berdasarkan interval atau meter
- Work order perbaikan dengan tracking teknisi dan spare part
- Asset downtime dan MTBF analysis
- Integrasi biaya ke Finance Core

**Scope Kapabilitas:**
1. Asset register dengan detail spesifikasi
2. Jadwal PM (Preventive Maintenance) berbasis waktu atau usage meter
3. Work order perbaikan: corrective dan emergency
4. Spare part consumption tracking (linked ke Inventory)
5. Teknisi assignment dan time tracking
6. Downtime log per aset
7. MTBF (Mean Time Between Failures) dan MTTR reporting
8. Notifikasi PM jatuh tempo
9. Biaya maintenance terintegrasi ke Finance Core

**Dependency:** Inventory Core, Finance Core  
**Note:** Ini berbeda dari `Fleet Maintenance Pack` yang fokus ke kendaraan. CMMS ini lebih luas — mesin, peralatan, fasilitas.  
**Klasifikasi:** `Module`  
**Priority:** **P1 — untuk manufaktur dan properti**

---

### 3.7 Modul: Franchise Management

**Pain Point yang Diselesaikan:** Franchisor tidak bisa memantau performa seluruh gerai/mitra secara terpusat. Penagihan royalti manual, SOP tidak terstandarisasi, dan laporan konsolidasi memakan waktu berminggu-minggu.

**Proposisi Nilai:**
- Dashboard konsolidasi performa semua franchisee real-time
- Royalti calculation dan billing otomatis
- SOP dan standar menu/produk terpusat
- Monitoring kepatuhan franchisee

**Scope Kapabilitas:**
1. Franchisee onboarding dan profile management
2. Contract franchise: durasi, territory, fee structure
3. Royalti calculation otomatis (% of revenue atau flat fee)
4. Auto-invoice royalti ke franchisee
5. Brand standard library (SOP, menu, harga, promosi)
6. Franchisee performance dashboard (per outlet, region, nasional)
7. Secret shopper / audit visit tracking
8. Termination dan renewal workflow
9. Consolidated reporting lintas franchisee

**Dependency:** Revenue Core, Finance Core, Multi-Entity Add-on  
**Klasifikasi:** `Module`  
**Priority:** **P2**

---

### 3.8 Modul: Property & Real Estate Management

**Pain Point yang Diselesaikan:** Developer, pengelola gedung, dan landlord tidak bisa mengelola unit, tenant, sewa, deposit, dan tagihan utilitas dalam satu sistem. Invoice sewa manual, telat kirim, dan tidak terhubung ke akuntansi.

**Proposisi Nilai:**
- Portofolio properti: gedung, lantai, unit dalam satu sistem
- Auto-invoice sewa bulanan dengan proration
- Deposit management dan reconciliation
- Maintenance request dari tenant terintegrasi

**Scope Kapabilitas:**
1. Master properti: gedung → lantai → unit
2. Tenant lifecycle: prospect → contract → occupying → move-out
3. Lease agreement management dengan schedule pembayaran
4. Auto-generate invoice sewa berdasarkan kontrak
5. Deposit handling: collect → hold → refund
6. Utilitas billing (listrik, air, service charge) per unit
7. Maintenance request dari tenant (portal)
8. Occupancy report dan vacancy tracking
9. Laporan rental income per properti

**Dependency:** Finance Core, DMS  
**Klasifikasi:** `Module`  
**Priority:** **P2**

---

### 3.9 Modul: Koperasi & BMT Management

**Pain Point yang Diselesaikan:** Koperasi simpan pinjam dan BMT menggunakan spreadsheet atau sistem legacy yang tidak terintegrasi dengan akuntansi. Tidak ada tracking simpanan anggota, angsuran, dan bagi hasil secara real-time.

**Proposisi Nilai:**
- Manajemen anggota, simpanan, pinjaman, dan bagi hasil dalam satu sistem
- Akuntansi koperasi otomatis mengikuti PSAK 27
- Laporan RAT (Rapat Anggota Tahunan) otomatis
- Cocok untuk BMT, KSP, Credit Union

**Scope Kapabilitas:**
1. Registrasi anggota dan simpanan (pokok, wajib, sukarela)
2. Pengajuan dan persetujuan pinjaman
3. Jadwal angsuran dan tracking pembayaran
4. Bagi hasil / SHU (Sisa Hasil Usaha) otomatis
5. Jurnal akuntansi koperasi (PSAK 27)
6. Laporan posisi keuangan koperasi
7. Laporan SHU per anggota
8. Akad syariah: mudharabah, musyarakah, murabahah (extend dari Syirkah)
9. Laporan RAT yang siap cetak

**Dependency:** Finance Core, Syirkah (opsional untuk BMT syariah)  
**Klasifikasi:** `Module`  
**Priority:** **P2 — high potential pasar Indonesia**

---

### 3.10 Modul: Food & Beverage / Restaurant Management

**Pain Point yang Diselesaikan:** Bisnis F&B (restoran, café, catering, ghost kitchen) membutuhkan manajemen menu, table, kitchen display, food cost, dan shift kasir yang berbeda dari retail biasa.

**Proposisi Nilai:**
- Table management terintegrasi dengan POS
- Recipe costing otomatis dari Inventory
- Kitchen Display System (KDS) digital
- Food cost percentage monitoring real-time

**Scope Kapabilitas:**
1. Floor plan dan table management
2. Menu builder dengan modifier / variant
3. Recipe management dengan BOM bahan baku
4. Food cost calculation otomatis dari harga beli
5. Kitchen Display System (KDS) — order masuk langsung ke dapur
6. Split bill, merge table, transfer table
7. Void dan refund management
8. Shift report dan cash count kasir
9. Laporan penjualan per menu item, kategori, shift
10. Expiry tracking bahan baku (integrasi WMS)

**Dependency:** POS Add-on, Inventory Core, Revenue Core  
**Klasifikasi:** `Module`  
**Priority:** **P2**

---

### 3.11 Modul: Healthcare / Clinic Management

**Pain Point yang Diselesaikan:** Klinik, praktik dokter, dan apotek menggunakan buku catatan atau aplikasi terpisah yang tidak terhubung ke billing, stok obat, dan keuangan.

**Proposisi Nilai:**
- Rekam medis terintegrasi dengan billing
- Stok obat dan alat kesehatan terhubung ke Inventory
- Appointment scheduling dengan notifikasi pasien
- BPJS claim management

**Scope Kapabilitas:**
1. Registrasi pasien dan medical record
2. Appointment scheduling dengan reminder otomatis
3. SOAP notes (Subjective, Objective, Assessment, Plan)
4. Resep digital dan dispensing obat (inventory deduction)
5. Billing pasien: umum, BPJS, asuransi swasta
6. BPJS claim management dan rekonsiliasi
7. Laporan kunjungan dan diagnosa (ICD-10)
8. Stok farmasi dengan expiry dan FEFO
9. Multi-dokter dan multi-poli

**Dependency:** Inventory Core, Finance Core, Payment Hub  
**Klasifikasi:** `Module`  
**Priority:** **P2**

---

### 3.12 Modul: Omnichannel Commerce Hub

**Pain Point yang Diselesaikan:** Penjual di Shopee, Tokopedia, Lazada, TikTok Shop, dan website sendiri mengelola stok di beberapa tempat secara manual. Overselling, kesalahan harga, dan laporan terpisah menjadi masalah harian.

**Proposisi Nilai:**
- Satu stok master yang sinkron ke semua channel penjualan
- Order dari semua marketplace masuk satu inbox
- Harga dan promosi bisa diatur terpusat
- Laporan omnichannel revenue dalam satu dashboard

**Scope Kapabilitas:**
1. Koneksi ke Shopee, Tokopedia, Lazada, TikTok Shop via API resmi
2. Real-time inventory sync ke semua channel
3. Order aggregation: semua pesanan masuk ke satu tampilan
4. Fulfillment management: pick → pack → ship
5. Retur management dari marketplace
6. Sinkronisasi harga dan promosi terpusat
7. Laporan penjualan per channel dan per produk
8. Fee marketplace calculator (deducted dari revenue)
9. Webhook untuk status pesanan real-time

**Dependency:** Inventory Core, Revenue Core, ecommerce module (yang sudah ada)  
**Klasifikasi:** `Module`  
**Priority:** **P1 — sangat besar potensinya**

---

### 3.13 Modul: Donation & Wakaf Management

**Pain Point yang Diselesaikan:** Lembaga amil zakat, yayasan, dan institusi wakaf menggunakan spreadsheet atau sistem terpisah untuk mencatat donasi, penghimpunan, dan penyaluran. Tidak ada laporan transparansi yang bisa dibagikan ke donatur.

**Proposisi Nilai:**
- Portal donasi terintegrasi dengan pencatatan real-time
- Laporan penggunaan dana yang transparan per program
- Akad wakaf digital dengan tracking aset wakaf
- Laporan ke BAZNAS / BWI compliant

**Scope Kapabilitas:**
1. Manajemen campaign donasi / program
2. Multi-channel donasi: transfer, QRIS, gateway online
3. Identitas donatur dan riwayat donasi
4. Alokasi dana per program / mustahik
5. Akad wakaf digital dengan objek wakaf
6. Laporan penghimpunan dan penyaluran
7. Certificate donasi / wakaf otomatis
8. Laporan BAZNAS compliant
9. Dashboard transparansi publik (optional)

**Dependency:** Finance Core, Payment Hub, Syirkah (sebagian)  
**Klasifikasi:** `Module`  
**Priority:** **P2 — sangat relevan pasar Indonesia**

---

### 3.14 Modul: Field Force Management

**Pain Point yang Diselesaikan:** Sales representative, kurir, dan teknisi lapangan tidak memiliki alat mobile yang terhubung ke sistem back-office. Check-in manual, rute tidak teroptimasi, dan pelaporan kunjungan terlambat masuk.

**Proposisi Nilai:**
- Mobile app (PWA) untuk tim lapangan
- GPS check-in dengan validasi lokasi
- Target harian dan monitoring capaian real-time
- Order entry langsung dari lapangan

**Scope Kapabilitas:**
1. Route planning harian per sales rep / teknisi
2. GPS check-in & check-out di lokasi customer
3. Kunjungan log: foto, catatan, outcome
4. Order entry dari lapangan (linked ke Sales Order)
5. Koleksi pembayaran lapangan (kasbon, transfer)
6. Target kunjungan vs realisasi
7. Laporan aktivitas lapangan per hari / minggu
8. Monitoring posisi tim real-time (supervisor view)
9. Expense claim lapangan (linked ke HRIS)

**Dependency:** Revenue Core, HRIS Core  
**Klasifikasi:** `Module`  
**Priority:** **P2**

---

## 4. Add-on Baru — Analisis dan Rekomendasi

### 4.1 Add-on: WhatsApp Business Integration

**Pain Point:** Customer tidak dapat dihubungi via WhatsApp secara otomatis dari NIZAM. Notifikasi invoice, jatuh tempo, dan konfirmasi order masih manual.

**Proposisi Nilai:**
- Invoice langsung bisa dikirim via WhatsApp dengan link bayar
- Reminder piutang jatuh tempo otomatis via WhatsApp
- Notifikasi order status ke customer secara real-time
- Chatbot sederhana untuk cek status pesanan

**Scope:**
1. Integrasi WhatsApp Business API (resmi Meta)
2. Template message untuk invoice, reminder, konfirmasi
3. Trigger otomatis: invoice terbit → kirim WA
4. Reminder sequence piutang (H-3, H-1, H+1, H+7)
5. Order status notification
6. Broadcast message ke segmen customer

**Dependency:** Revenue Core, Finance Core  
**Tipe Add-on:** `Communication Add-on`  
**Priority:** **P0 — Sangat Tinggi Demand**

---

### 4.2 Add-on: E-Sign / Digital Signature

**Pain Point:** Penandatanganan kontrak, PO, akad, dan invoice masih memerlukan cetak-tanda tangan fisik. Lambat, tidak traceable, dan mahal untuk bisnis yang tersebar.

**Proposisi Nilai:**
- Tanda tangan digital yang sah secara hukum
- Audit trail penandatanganan dengan timestamp dan IP
- Integrasi langsung ke dokumen NIZAM (PO, kontrak, akad)

**Scope:**
1. Tanda tangan dalam dokumen via klik/draw
2. Multi-party signing sequence
3. OTP verification per penandatangan
4. Audit trail lengkap (IP, timestamp, device)
5. Export PDF final yang tamper-proof
6. Integrasi ke DMS Module dan Syirkah

**Dependency:** DMS Module, Platform Core  
**Tipe Add-on:** `Legal Tech Add-on`  
**Priority:** **P1**

---

### 4.3 Add-on: Loyalty & Rewards Program

**Pain Point:** Bisnis retail, F&B, dan apotek tidak bisa mengelola program poin, tier member, dan reward redemption dari sistem ERP mereka.

**Proposisi Nilai:**
- Poin otomatis terhitung dari setiap transaksi penjualan
- Tier member dengan benefit berbeda
- Redemption poin di POS atau transaksi berikutnya

**Scope:**
1. Konfigurasi earning rules (poin per rupiah transaksi)
2. Tier membership: Silver, Gold, Platinum
3. Tier benefit: diskon, poin multiplier, akses early
4. Redemption di POS atau invoice
5. Expiry poin otomatis
6. Member birthday reward
7. Laporan member activity dan redemption rate

**Dependency:** Revenue Core, POS Add-on  
**Tipe Add-on:** `Growth Add-on`  
**Priority:** **P1**

---

### 4.4 Add-on: Customer Self-Service Portal

**Pain Point:** Customer B2B tidak bisa lihat status pesanan, download invoice, atau bayar tagihan tanpa menghubungi admin NIZAM.

**Proposisi Nilai:**
- Portal web khusus per customer untuk akses mandiri
- Download invoice, track pesanan, bayar tagihan online
- Submit keluhan atau request dukungan

**Scope:**
1. Portal login khusus per customer (bukan login NIZAM utama)
2. Riwayat pesanan dan status real-time
3. Download invoice PDF dan kwitansi
4. Bayar invoice via Payment Hub
5. Statement of account per customer
6. Ajukan retur atau komplain
7. Custom branding per organisasi

**Dependency:** Revenue Core, Finance Core, Payment Hub  
**Tipe Add-on:** `Self-Service Add-on`  
**Priority:** **P1**

---

### 4.5 Add-on: Supplier / Vendor Portal

**Pain Point:** Supplier harus mengirim invoice via email atau fisik, tidak tahu status PO mereka, dan tidak bisa konfirmasi penerimaan order secara real-time.

**Proposisi Nilai:**
- Supplier bisa melihat PO yang ditujukan ke mereka
- Upload invoice dan delivery note secara mandiri
- Status pembayaran vendor real-time

**Scope:**
1. Portal login khusus per vendor
2. Lihat PO yang diterima dan konfirmasi kesanggupan
3. Upload delivery note dan invoice
4. Status approval invoice dan jadwal pembayaran
5. History transaksi dengan pembeli
6. Alert jadwal delivery

**Dependency:** Purchasing, Finance Core  
**Tipe Add-on:** `Self-Service Add-on`  
**Priority:** **P1**

---

### 4.6 Add-on: Business Intelligence (BI) Dashboard

**Pain Point:** Laporan standar NIZAM tidak cukup untuk kebutuhan analitik eksekutif. Owner dan CFO butuh drill-down, custom metric, dan visualisasi yang bisa dikonfigurasi sendiri.

**Proposisi Nilai:**
- Custom dashboard builder tanpa coding
- Drill-down dari summary ke transaksi detail
- KPI goal tracking vs realisasi
- Export dan scheduled email report

**Scope:**
1. Drag-and-drop dashboard builder
2. Widget library: bar chart, pie, trend line, KPI card, table
3. Data source: semua modul NIZAM
4. Filter interaktif: periode, branch, produk, customer
5. Drill-down ke data transaksi
6. KPI target setting dan gap analysis
7. Scheduled report: kirim otomatis via email
8. Share dashboard link dengan role-based access

**Dependency:** Semua Core Modules  
**Tipe Add-on:** `Analytics Add-on`  
**Priority:** **P1**

---

### 4.7 Add-on: HR Analytics & People Intelligence

**Pain Point:** Perusahaan dengan 50+ karyawan tidak bisa memprediksi turnover, mengidentifikasi karyawan berpotensi resign, atau menganalisis tren produktivitas.

**Proposisi Nilai:**
- Turnover prediction berbasis data historis
- Produktivitas per departemen / role
- Compensation benchmarking
- Early warning system karyawan berisiko resign

**Scope:**
1. Turnover rate dan tren historis
2. Prediksi risiko resign per karyawan (AI-powered)
3. Headcount planning dan projection
4. Compensation analysis (gaji vs market benchmark)
5. Absensi pattern analysis
6. Time-to-hire dan recruitment funnel
7. Training ROI analysis (linked ke Academy/EDU)
8. Diversity dan inclusion metrics

**Dependency:** HRIS Core, Academy/EDU  
**Tipe Add-on:** `People Analytics Add-on`  
**Priority:** **P2**

---

### 4.8 Add-on: Multi-Currency Advanced

**Pain Point:** Bisnis dengan transaksi mata uang asing (ekspor, impor, atau operasi internasional) kesulitan dengan kurs yang berubah, revaluasi aset/liabilitas, dan laporan konsolidasi multi-mata uang.

**Proposisi Nilai:**
- Kurs otomatis dari feed bank / BI
- Revaluasi otomatis per periode
- Laporan konsolidasi dalam mata uang pelaporan
- Forex gain/loss otomatis terjurnal

**Scope:**
1. Konfigurasi mata uang fungsional per entitas
2. Kurs manual atau otomatis (BI, XE.com)
3. Revaluasi saldo AR/AP/bank per bulan tutup buku
4. Forex gain/loss journal otomatis
5. Laporan dalam mata uang pelaporan (IDR, USD, dll)
6. Hedging position tracking
7. Konsolidasi lintas entitas multi-currency

**Dependency:** Finance Core, Multi-Entity Add-on  
**Tipe Add-on:** `Finance Advanced Add-on`  
**Priority:** **P2**

---

### 4.9 Add-on: Returns & Refund Management

**Pain Point:** Proses retur barang dari customer atau ke supplier tidak sistematis. Tidak ada link antara retur, kredit note, penyesuaian stok, dan jurnal akuntansi.

**Proposisi Nilai:**
- Retur terintegrasi dari ujung ke ujung: fisik → stok → kredit note → jurnal
- Approve/reject workflow untuk retur
- Refund ke customer via Payment Hub

**Scope:**
1. Return Request dari customer (atau inisiasi internal)
2. Approval workflow: request → approved → received
3. Kondisi barang: bagus/rusak → ke stok atau disposal
4. Auto-generate credit note ke customer
5. Refund via transfer atau kredit ke transaksi berikutnya
6. Retur ke supplier dengan debit note
7. Laporan retur rate per produk, customer, supplier

**Dependency:** Revenue Core, Purchasing, Inventory Core, Finance Core, Payment Hub  
**Tipe Add-on:** `Operations Add-on`  
**Priority:** **P1**

---

### 4.10 Add-on: Contract Lifecycle Management (CLM)

**Pain Point:** Kontrak dengan customer, vendor, dan karyawan dikelola di email dan folder Google Drive. Tidak ada reminder perpanjangan, approval trail, atau link ke transaksi keuangan.

**Proposisi Nilai:**
- Satu database kontrak yang terpusat
- Reminder otomatis sebelum kontrak kadaluarsa
- Approval workflow digital
- Link kontrak ke SO, PO, atau invoice

**Scope:**
1. Template kontrak per jenis (penjualan, pembelian, kerja, sewa)
2. Draft → Review → Approval → Active → Expired workflow
3. Pihak kontrak: customer, vendor, karyawan, mitra
4. Kewajiban dan milestone tracking
5. Automatic alert 30/60/90 hari sebelum expiry
6. Renewal workflow
7. Link ke DMS untuk file contract
8. Laporan kontrak aktif, expiring, dan expired per periode

**Dependency:** DMS Module, Revenue Core, Purchasing  
**Tipe Add-on:** `Legal Operations Add-on`  
**Priority:** **P2**

---

### 4.11 Add-on: Demand Forecasting & Inventory Optimization

**Pain Point:** Stok sering habis (stockout) atau terlalu banyak (overstock). Tidak ada sistem yang memprediksi kebutuhan stok berdasarkan tren penjualan historis.

**Proposisi Nilai:**
- Prediksi kebutuhan pembelian berbasis AI
- Reorder point otomatis yang adaptif
- Safety stock calculation yang dinamis
- Laporan slow-moving dan fast-moving item

**Scope:**
1. Analisis tren penjualan historis per SKU
2. Seasonal adjustment untuk produk musiman
3. Prediksi demand 30/60/90 hari ke depan
4. Reorder point recommendation otomatis
5. Safety stock calculation berbasis variasi demand
6. Slow-moving dan dead stock alert
7. Purchase recommendation report
8. Scenario planning (best/worst case demand)

**Dependency:** Inventory Core, Revenue Core, Purchasing  
**Tipe Add-on:** `Advanced Inventory Add-on`  
**Priority:** **P1**

---

### 4.12 Add-on: Marketplace Seller Analytics

**Pain Point:** Seller di marketplace tidak bisa membandingkan performa per channel, menghitung profitabilitas sebenarnya (setelah fee marketplace), dan mengidentifikasi produk mana yang paling menguntungkan.

**Proposisi Nilai:**
- P&L per marketplace channel
- Fee marketplace otomatis di-deduct dari revenue
- Best-seller dan worst-seller per channel
- Review dan rating monitoring

**Scope:**
1. Revenue per channel setelah fee marketplace
2. COGS per order dengan landed cost
3. Gross margin per SKU per channel
4. Return rate per channel
5. Ad spend ROI (jika data iklan diinput)
6. Review rating monitoring (integrasi API marketplace)
7. Price competitiveness analysis

**Dependency:** Omnichannel Commerce Hub  
**Tipe Add-on:** `Analytics Add-on`  
**Priority:** **P2**

---

### 4.13 Add-on: Expense Management Mobile

**Pain Point:** Karyawan mengumpulkan struk fisik, mengisi form Excel, dan menunggu berhari-hari untuk reimburse. Finance kesulitan memvalidasi ribuan struk dan tidak ada kategorisasi otomatis.

**Proposisi Nilai:**
- Foto struk via smartphone, data terekstrak otomatis (AI OCR — sudah ada di NIZAM)
- Approval workflow via mobile
- Auto-reimburse via payroll atau transfer

**Scope:**
1. Mobile expense submission (PWA)
2. AI OCR untuk scan struk (extend modul AI yang sudah ada)
3. Kategorisasi pengeluaran otomatis
4. Approval workflow: karyawan → manager → finance
5. Policy enforcement: limit per kategori, requireattachment
6. Reimbursement via payroll atau transfer manual
7. Laporan pengeluaran per karyawan, departemen, proyek

**Dependency:** HRIS Core, Finance Core, AI Module (sudah ada)  
**Tipe Add-on:** `HR Operations Add-on`  
**Priority:** **P1**

---

### 4.14 Add-on: Chatbot & AI Assistant

**Pain Point:** User NIZAM sering membutuhkan bantuan operasional: "berapa total hutang vendor X?", "buatkan laporan penjualan bulan ini", "produk mana yang stocknya kritis?". Saat ini semua harus dinavigasi manual.

**Proposisi Nilai:**
- Query data NIZAM via natural language
- Generate laporan singkat via chat
- Alert proaktif berbasis anomali data

**Scope:**
1. Chatbot embedded di dashboard NIZAM
2. Natural language query ke data modul
3. Laporan ringkas on-demand ("rangkum penjualan minggu ini")
4. Alert proaktif: stok kritis, invoice jatuh tempo, anomali cash flow
5. Saran tindakan berdasarkan kondisi data
6. Integrasi ke Google AI Studio / Vertex AI (sudah ada)

**Dependency:** Semua Core Modules, Google AI Studio (sudah ada)  
**Tipe Add-on:** `AI Add-on`  
**Priority:** **P1**

---

### 4.15 Add-on: Audit Trail & Compliance Pack

**Pain Point:** Tidak ada log perubahan data yang lengkap. Ketika terjadi kesalahan atau fraud, tidak bisa dilacak siapa yang mengubah apa dan kapan.

**Proposisi Nilai:**
- Immutable audit log untuk setiap perubahan data kritis
- Compliance report untuk auditor eksternal
- Anomaly detection untuk transaksi mencurigakan

**Scope:**
1. Audit log untuk semua mutation di entitas kritis (invoice, jurnal, pembayaran)
2. Who changed what and when — dengan before/after value
3. Immutable log (tidak bisa diedit, bahkan oleh admin)
4. Filter dan search log untuk investigasi
5. Export audit report untuk auditor
6. Anomaly alert: jurnal di luar jam kerja, nilai tidak wajar

**Dependency:** Platform Core, Finance Core  
**Tipe Add-on:** `Governance Add-on`  
**Priority:** **P1**

---

### 4.16 Add-on: Intercompany Transactions

**Pain Point:** Grup usaha yang memiliki beberapa entitas sering melakukan transaksi antar perusahaan (pinjaman, penjualan internal, cost allocation). Pencatatan manual dan eliminasi konsolidasi menjadi pekerjaan yang menyita waktu.

**Proposisi Nilai:**
- Transaksi antar entitas dalam grup otomatis mencatat di kedua sisi
- Eliminasi konsolidasi otomatis
- Laporan konsolidasi grup siap di-generate

**Scope:**
1. Definisi relasi antar entitas dalam grup
2. Intercompany transfer: pinjaman, penjualan internal
3. Auto-generate jurnal di kedua entitas secara bersamaan
4. Eliminasi jurnal otomatis saat konsolidasi
5. Laporan konsolidasi grup (neraca dan P&L)
6. Intercompany receivable/payable reconciliation

**Dependency:** Finance Core, Multi-Entity Add-on  
**Tipe Add-on:** `Enterprise Finance Add-on`  
**Priority:** **P2**

---

## 5. Matriks Prioritas

### 5.1 Modul Baru

| Modul | Business Impact | Effort | Priority | Target Quarter |
|---|---|---|---|---|
| Payment Hub | Sangat Tinggi | Sedang | **P0** | Q3 2026 |
| Tax Compliance Center | Sangat Tinggi | Tinggi | **P0** | Q3 2026 |
| Omnichannel Commerce Hub | Sangat Tinggi | Tinggi | **P1** | Q4 2026 |
| Document Management System | Tinggi | Sedang | **P1** | Q3 2026 |
| Subscription & Recurring Billing | Tinggi | Sedang | **P1** | Q4 2026 |
| Quality Management System | Tinggi | Sedang | **P1** | Q4 2026 |
| Maintenance Management (CMMS) | Tinggi | Sedang | **P1** | Q1 2027 |
| Franchise Management | Sedang | Tinggi | **P2** | Q1 2027 |
| Property & Real Estate | Sedang | Tinggi | **P2** | Q2 2027 |
| Koperasi & BMT | Sedang | Sedang | **P2** | Q1 2027 |
| Food & Beverage | Sedang | Tinggi | **P2** | Q2 2027 |
| Healthcare / Clinic | Sedang | Tinggi | **P2** | Q2 2027 |
| Donation & Wakaf | Sedang | Sedang | **P2** | Q1 2027 |
| Field Force Management | Sedang | Sedang | **P2** | Q2 2027 |

### 5.2 Add-on Baru

| Add-on | Business Impact | Effort | Priority | Target Quarter |
|---|---|---|---|---|
| WhatsApp Business Integration | Sangat Tinggi | Sedang | **P0** | Q3 2026 |
| Demand Forecasting & Inventory Opt. | Tinggi | Sedang | **P1** | Q3 2026 |
| Returns & Refund Management | Tinggi | Sedang | **P1** | Q3 2026 |
| Customer Self-Service Portal | Tinggi | Sedang | **P1** | Q4 2026 |
| Supplier / Vendor Portal | Tinggi | Sedang | **P1** | Q4 2026 |
| Business Intelligence Dashboard | Tinggi | Tinggi | **P1** | Q4 2026 |
| E-Sign / Digital Signature | Tinggi | Sedang | **P1** | Q3 2026 |
| Loyalty & Rewards Program | Tinggi | Rendah | **P1** | Q3 2026 |
| Expense Management Mobile | Tinggi | Sedang | **P1** | Q4 2026 |
| Chatbot & AI Assistant | Tinggi | Tinggi | **P1** | Q4 2026 |
| Audit Trail & Compliance Pack | Sedang | Rendah | **P1** | Q3 2026 |
| HR Analytics & People Intelligence | Sedang | Tinggi | **P2** | Q1 2027 |
| Multi-Currency Advanced | Sedang | Tinggi | **P2** | Q1 2027 |
| Contract Lifecycle Management | Sedang | Sedang | **P2** | Q1 2027 |
| Marketplace Seller Analytics | Sedang | Sedang | **P2** | Q2 2027 |
| Intercompany Transactions | Sedang | Tinggi | **P2** | Q2 2027 |

---

## 6. Peta Dependency Antar Kapabilitas

```
PLATFORM CORE
└── Finance Core ──────────────────── Tax Compliance Center (P0)
│                                    Multi-Currency Advanced
│                                    Intercompany Transactions
│                                    Audit Trail Pack
│
├── Revenue Core ──────────────────── Payment Hub (P0)
│   │                                 Subscription & Recurring Billing
│   │                                 Loyalty & Rewards
│   │                                 Customer Portal
│   │                                 Field Force Management
│   │
│   └── POS Add-on ───────────────── Food & Beverage Module
│
├── Inventory Core ─────────────────── Omnichannel Commerce Hub (P1)
│   │                                  QMS Module
│   │                                  CMMS Module
│   │                                  Demand Forecasting Add-on
│   │                                  Returns & Refund Management
│   │
│   └── Advanced WMS Add-on
│
├── Purchasing ─────────────────────── Supplier / Vendor Portal
│                                      Tax Compliance Center
│                                      Returns & Refund Management
│
├── HRIS Core ──────────────────────── HR Analytics Add-on
│   │                                  Expense Management Mobile
│   │                                  Field Force Management
│   │
│   └── Academy / EDU
│
├── Syirkah ─────────────────────────── Koperasi & BMT Module
│                                       Donation & Wakaf Module
│
├── Multi-Entity Add-on ─────────────── Franchise Management Module
│                                       Intercompany Transactions
│                                       Multi-Currency Advanced
│
└── AI Module ──────────────────────── Chatbot & AI Assistant
                                       HR Analytics (predict)
                                       Demand Forecasting
                                       Expense OCR

NEW MODULES (standalone foundations)
├── Payment Hub ─────────────────────── Customer Portal
│                                       Subscription Billing
│                                       Donation & Wakaf
│                                       Koperasi
│
├── Document Management System ──────── E-Sign Add-on
│                                       CLM Add-on
│                                       Franchise (SOP library)
│
└── Omnichannel Commerce Hub ─────────── Marketplace Seller Analytics
```

---

## 7. Arsitektur Produk yang Diusulkan (Full Landscape)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          NIZAM PLATFORM v2.0                                 │
├────────────────────────────────────────────────────────────────────────────  ┤
│                           PLATFORM CORE (Always Included)                    │
│  Auth │ Org/Tenant │ Branch │ RBAC │ Settings │ Dashboard │ Billing │ Support│
├─────────────────────────┬────────────────────┬──────────────────────────────┤
│      CORE FAMILIES      │  VERTICAL MODULES  │      STRATEGIC MODULES       │
│  (existing + enhanced)  │  (existing + new)  │      (existing + new)        │
├─────────────────────────┼────────────────────┼──────────────────────────────┤
│ Finance Core ✅          │ Manufacturing ✅    │ Academy / EDU ✅             │
│ Revenue Core ✅          │ Fleet & Rental ✅   │ Omnichannel Commerce Hub 🆕  │
│ Purchasing ✅            │ Service Ops ✅      │ Payment Hub 🆕               │
│ Inventory Core ✅        │ Construction ✅     │ Tax Compliance Center 🆕     │
│ HRIS Core ✅             │ Syirkah ✅          │ Document Management 🆕       │
│                         │ QMS 🆕              │ Subscription Billing 🆕      │
│                         │ CMMS 🆕             │                              │
│                         │ F&B 🆕              │                              │
│                         │ Healthcare 🆕       │                              │
│                         │ Franchise Mgmt 🆕   │                              │
│                         │ Property 🆕         │                              │
│                         │ Koperasi & BMT 🆕   │                              │
│                         │ Donation & Wakaf 🆕 │                              │
│                         │ Field Force 🆕      │                              │
├─────────────────────────┴────────────────────┴──────────────────────────────┤
│                              ADD-ONS (Optional, Stackable)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ GROWTH         │ COMMUNICATION   │ ANALYTICS        │ OPERATIONS             │
│ POS ✅         │ WhatsApp 🆕     │ BI Dashboard 🆕  │ Advanced WMS ✅         │
│ Sales Page ✅  │ E-Sign 🆕       │ HR Analytics 🆕  │ Fleet Maint. Pack ✅   │
│ Quick Bill ✅  │ Customer Portal │ Mkt Analytics 🆕 │ Returns & Refund 🆕    │
│ Loyalty 🆕     │ 🆕              │ AI Chatbot 🆕    │ Demand Forecast 🆕     │
│ AR Cockpit ✅  │ Vendor Portal 🆕│                  │ Expense Mobile 🆕      │
│ Pkg Tracking ✅│                 │                  │ QC Pack (from QMS)     │
├────────────────┼─────────────────┼──────────────────┼────────────────────────┤
│ ENTERPRISE / CAPACITY                                                        │
│ Open API ✅ │ Multi-Entity ✅ │ Seat Pack ✅ │ Multi-Currency Adv 🆕         │
│ Intercompany 🆕 │ Audit Trail 🆕 │ CLM 🆕 │ Tax Compliance 🆕              │
└─────────────────────────────────────────────────────────────────────────────┘
✅ = Sudah Ada    🆕 = Diusulkan Baru
```

---

## 8. Roadmap Implementasi Bertahap

### Phase 7 — Q3 2026: Revenue Enablement & Compliance
> "Setiap transaksi bisa dibayar digital. Setiap pajak bisa dilaporkan dari sistem."

**Modul baru:**
- Payment Hub (link bayar, QRIS, gateway integration)
- Document Management System (DMS)
- Tax Compliance Center (e-Faktur, PPN, PPh)

**Add-on baru:**
- WhatsApp Business Integration
- Loyalty & Rewards Program
- E-Sign / Digital Signature
- Returns & Refund Management
- Audit Trail & Compliance Pack
- Demand Forecasting & Inventory Optimization

**Target customer:** Semua segmen

---

### Phase 8 — Q4 2026: Omnichannel & Self-Service
> "Jual di mana saja. Biarkan customer dan supplier kelola sendiri."

**Modul baru:**
- Omnichannel Commerce Hub (Shopee, Tokopedia, Lazada, TikTok)
- Subscription & Recurring Billing
- Quality Management System (QMS)

**Add-on baru:**
- Customer Self-Service Portal
- Supplier / Vendor Portal
- Business Intelligence Dashboard
- Expense Management Mobile
- Chatbot & AI Assistant

**Target customer:** Retail online, distribusi, jasa langganan

---

### Phase 9 — Q1 2027: Vertical Expansion
> "Masuk ke industri yang lebih dalam."

**Modul baru:**
- Maintenance Management (CMMS)
- Franchise Management
- Koperasi & BMT Management
- Donation & Wakaf Management

**Add-on baru:**
- Multi-Currency Advanced
- HR Analytics & People Intelligence
- Contract Lifecycle Management (CLM)

**Target customer:** Manufaktur, franchise, koperasi, yayasan

---

### Phase 10 — Q2 2027: Industry Specialization
> "Satu platform untuk semua industri."

**Modul baru:**
- Property & Real Estate Management
- Food & Beverage / Restaurant Management
- Healthcare / Clinic Management
- Field Force Management

**Add-on baru:**
- Marketplace Seller Analytics
- Intercompany Transactions

**Target customer:** Properti, F&B, klinik, distribusi dengan tim lapangan

---

## 9. Dampak Bisnis yang Diproyeksikan

### 9.1 Ekspansi Total Addressable Market (TAM)

| Tambahan Kapabilitas | Segmen Baru Terjangkau | Est. TAM Indonesia |
|---|---|---|
| Payment Hub | Semua bisnis online & offline | 8 Juta+ UMKM |
| Tax Compliance Center | Semua PKP & WP badan | 3 Juta+ WP badan |
| Omnichannel | Seller marketplace | 21 Juta+ seller aktif |
| Koperasi & BMT | 130.000 koperasi Indonesia | 130K entitas |
| Healthcare | 9.000+ klinik, 3.000+ RS | 12K+ entitas |
| F&B / Restaurant | 3 Juta+ restoran dan café | 3M+ entitas |
| Franchise | 68.000+ gerai franchise di Indonesia | 68K+ entitas |
| Donation & Wakaf | 800+ LAZ resmi + yayasan | 10K+ entitas |

### 9.2 Revenue Impact per Tier

| Layer | Upsell Potential per Tenant | Frekuensi |
|---|---|---|
| P0 Add-ons (WA, Payment) | Rp 200K-500K/bulan | Hampir semua tenant |
| P1 Modules (Omnichannel, Subscription) | Rp 300K-1.5M/bulan | 30-50% tenant |
| Vertical Modules (F&B, Healthcare, dll) | Rp 500K-2M/bulan | 15-25% tenant |
| Enterprise Add-ons (BI, Multi-Currency) | Rp 1M-5M/bulan | 10-20% tenant |

### 9.3 Retensi Customer

Kapabilitas yang paling meningkatkan retensi:
1. **Payment Hub** — transaksi keuangan jadi satu ekosistem, sulit pindah
2. **Tax Compliance Center** — data pajak sudah tersimpan, migrasi sangat mahal
3. **Omnichannel Hub** — integrasi marketplace membuat switching cost sangat tinggi
4. **Academy / EDU** — kompetensi tim sudah dibangun di atas NIZAM
5. **Subscription Billing** — data siklus pelanggan tidak bisa mudah dipindah

---

## 10. Kesimpulan Strategis

### 10.1 Positioning NIZAM v2.0

NIZAM tidak hanya ERP. NIZAM adalah **Business Operating Platform** yang mencakup:

1. **Operate** — Core ERP: transaksi, keuangan, stok, SDM
2. **Grow** — Revenue tools: omnichannel, POS, loyalty, subscription
3. **Comply** — Tax, audit, e-faktur, governance
4. **Connect** — WhatsApp, portal customer, portal vendor, API
5. **Specialize** — Vertical modules: F&B, klinik, koperasi, properti, franchise
6. **Learn** — Academy & EDU: simulasi, assessment, sertifikasi

### 10.2 Diferensiasi Kompetitif

| Kompetitor | Kelemahan vs NIZAM v2.0 |
|---|---|
| Accurate, Zahir | Tidak punya Omnichannel, Academy, AI, vertical industry |
| Odoo | Mahal dan kompleks untuk UMKM; tidak lokal |
| Mekari (Jurnal) | Tidak punya vertical ops module yang dalam |
| SAP B1 | Terlalu mahal; tidak ada Academy/EDU; tidak lokal |

### 10.3 Pesan Utama

> **"NIZAM adalah satu-satunya platform di Indonesia yang bisa mengelola operasional bisnis dari ujung ke ujung — dari transaksi, pajak, karyawan, industri spesifik, hingga memastikan tim Anda kompeten melalui Academy — semuanya dalam satu ekosistem."**

---

## 11. Lampiran: Klasifikasi Final Lengkap

### Modul (Total: 25)
**Core Family (5):** Finance Core, Revenue Core, Purchasing, Inventory Core, HRIS Core  
**Vertical Module — Existing (5):** Manufacturing, Fleet & Rental, Service Operations, Construction, Syirkah  
**Vertical Module — Baru (9):** QMS, CMMS, F&B, Healthcare, Franchise, Property, Koperasi & BMT, Donation & Wakaf, Field Force Management  
**Platform Module — Baru (3):** Payment Hub, Tax Compliance Center, Document Management System  
**Strategic Module (3):** Academy/EDU, Omnichannel Commerce Hub, Subscription & Recurring Billing  

### Add-on (Total: 27)
**Existing (11):** POS, Advanced WMS, Sales Page, Open API, Multi-Entity, Quick Bill, Fleet Maintenance, Package Tracking, AR Cockpit, AR Seat Pack, AI/Vision  
**Baru — Communication (2):** WhatsApp Integration, E-Sign  
**Baru — Self-Service (2):** Customer Portal, Vendor Portal  
**Baru — Growth (2):** Loyalty & Rewards, Returns & Refund  
**Baru — Analytics (3):** BI Dashboard, HR Analytics, Marketplace Seller Analytics  
**Baru — Operations (2):** Expense Mobile, Demand Forecasting  
**Baru — AI (1):** Chatbot & AI Assistant  
**Baru — Enterprise (3):** Multi-Currency Advanced, Intercompany Transactions, CLM  
**Baru — Governance (1):** Audit Trail & Compliance Pack  

---

*Dokumen ini merupakan rencana strategis yang dihasilkan dari analisis mendalam terhadap codebase `feat_multi`, dokumen arsitektur yang ada (KLASIFIKASI_MODULE_DAN_ADDON_NIZAM.md, GTM_NIZAM_MODULE_DAN_ADDON.md), dan pemetaan global pain point customer ERP.*

*Versi berikutnya akan mencakup detail teknis implementasi, skema database, dan estimasi resource per modul.*
