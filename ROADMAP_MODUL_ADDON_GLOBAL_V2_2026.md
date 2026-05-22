# ROADMAP MODUL & ADD-ON NIZAM — GLOBAL PERSPECTIVE v2.0
## Dokumen Perencanaan Produk Komprehensif

---

**Status Dokumen**
- Versi: `2.0`
- Tanggal: `22 Mei 2026`
- Basis analisis: `branch feat_multi (arsitektur 4+1 pilar) + pain point customer global SMB/Enterprise ERP 2024–2026`
- Tujuan: `menetapkan roadmap modul dan add-on baru yang menyelesaikan pain point customer secara global, dibangun di atas arsitektur NIZAM yang telah divalidasi di feat_multi`

---

## BAGIAN 1 — STATE OF THE PLATFORM (FEAT_MULTI)

### 1.1 Arsitektur Saat Ini (Hasil feat_multi)

Setelah implementasi di branch `feat_multi`, NIZAM telah memiliki arsitektur produk yang matang:

#### 🏛️ 4 Core Pillars + 1 Strategic Pillar

| Pillar | Status | Coverage |
|--------|--------|----------|
| **Finance Core** | ✅ Production | CoA, GL, AP, AR, Cash Management, Bank Reconciliation, Period Closing |
| **Revenue Core** | ✅ Production | Sales Order, Invoice, Quotation, Customer, Sales Rep |
| **Inventory Core + Purchasing** | ✅ Production | Stock, Warehouse, PO, Receiving, FIFO/LIFO/Average |
| **HRIS Core** | ✅ Production | Employee, Payroll, Attendance, Leave, NIK tracking |
| **Syirkah (Pillar 5)** | ✅ Production | Islamic finance: mudharabah, musyarakah, bagi hasil |

#### 🏭 Vertical Modules (5 Domain)

| Module | Status | Segment Target |
|--------|--------|----------------|
| **Manufacturing** | ✅ Production | Pabrik, produsen |
| **Fleet & Rental** | ✅ Production | Transportasi, rental kendaraan |
| **Service Operations** | ✅ Production | Workshop, servis, maintenance |
| **Project & Construction** | ✅ Production | Kontraktor, developer |
| **Bengkel Motor** | ✅ Production | Workshop spesifik otomotif |

#### 🎓 Strategic Module

| Module | Status | Fungsi |
|--------|--------|--------|
| **Academy / EDU (LMS)** | ✅ Production | Training, sertifikasi, simulasi bisnis ERP |

#### 🔌 Add-on Existing

| Add-on | Kategori | Status |
|--------|----------|--------|
| POS | Growth | ✅ Production |
| Sales Page | Growth | ✅ Production |
| Quick Bill | Growth | ✅ Production |
| Advanced WMS | Operations | ✅ Production |
| Open API | Integration | ✅ Production |
| Multi-Entity | Capacity | ✅ Production |
| Seat Pack | Capacity | ✅ Production |
| Sales AR Cockpit | Growth | ✅ Production |
| Package Tracking | Operations | ✅ Production |
| Fleet Maintenance Pack | Operations | ✅ Production |
| Marketplace Sync (beta) | Integration | 🔄 feat_multi |

### 1.2 Pencapaian Teknis feat_multi

Fitur-fitur kunci yang telah dibangun di `feat_multi`:
1. **Arsitektur entitlement dinamis** — modul bisa diaktifkan/nonaktifkan per tenant
2. **Version integrity system** — versioning otomatis dengan patch counter
3. **Marketplace sync engine** — fondasi integrasi marketplace
4. **LMS Dashboard** — course creation flow dengan modal-based UI
5. **Analytics service** — query database paralel untuk performa
6. **Modular setup flow** — onboarding wizard per modul
7. **Operational bridge** — orchestration antar modul

---

## BAGIAN 2 — ANALISIS PAIN POINT GLOBAL

### 2.1 Pain Point Universal (Berlaku di Semua Market)

Berdasarkan riset Gartner ERP Market Guide 2025, Panorama ERP Report 2024–2025, dan Software Advice SMB Survey:

| Rank | Pain Point | Prevalensi Global | Prevalensi Indonesia |
|------|-----------|-------------------|---------------------|
| 1 | Visibilitas cashflow real-time & forecast | 78% | 82% |
| 2 | Tax compliance otomatis | 76% | 91% (e-Faktur DJP/Coretax) |
| 3 | Integrasi payment & collection otomatis | 74% | 87% (QRIS/VA) |
| 4 | Multi-currency & revaluasi forex | 71% | 58% |
| 5 | Sinkronisasi marketplace/e-commerce | 68% | 89% (Shopee/Tokopedia) |
| 6 | Document management terintegrasi | 65% | 61% |
| 7 | Customer portal self-service | 63% | 54% |
| 8 | Subscription & recurring billing | 61% | 55% |
| 9 | Contract lifecycle management | 59% | 47% |
| 10 | AI analytics & prediksi | 57% | 49% |
| 11 | ESG & sustainability reporting | 52% | 38% |
| 12 | Quality control terintegrasi | 55% | 52% |
| 13 | Fixed assets advanced | 51% | 49% |
| 14 | Budget vs aktual real-time | 71% | 73% |
| 15 | Integrasi komunikasi (WA/email) | 49% | 83% (WA dominan) |
| 16 | Field operations & mobile | 47% | 51% |
| 17 | Vendor/supplier performance | 45% | 43% |
| 18 | After-sales & warranty | 49% | 46% |
| 19 | Reseller/distributor management | 43% | 61% |
| 20 | Data privacy & compliance (GDPR/PDPA) | 41% | 38% |

### 2.2 Pain Point Spesifik per Segmen Bisnis

#### 🏪 Retail & F&B
- Stok multi-channel tidak sinkron (online + offline)
- Tidak ada loyalty program terintegrasi
- Laporan penjualan per outlet/channel tidak real-time
- Manajemen resep dan COGS produksi F&B sulit

#### 🏭 Manufaktur
- Bill of Materials kompleks tidak bisa dikelola dengan baik
- Tidak ada production planning & scheduling
- Waste dan scrap tidak tercatat di biaya produksi
- QC di tengah proses produksi tidak ada

#### 🏗️ Konstruksi & Properti
- Budget proyek vs realisasi tidak real-time
- Progress billing multi-termin rumit
- Manajemen subkontraktor tidak tertata
- Dokumen kontrak tidak terpusat

#### 💊 Kesehatan & Farmasi
- Batch tracking dan expiry date wajib
- BPJS billing tidak terintegrasi (Indonesia)
- Regulatory compliance (BPOM, izin edar)
- Narcotics/psikotropika tracking wajib

#### 🚗 Otomotif & Workshop
- Riwayat servis per kendaraan tidak mudah diakses
- Estimasi waktu pekerjaan vs aktual tidak ada
- Spare part sourcing dan harga tidak terintegrasi
- Customer reminder servis berkala tidak otomatis

#### 🎓 Pendidikan & Pelatihan
- Manajemen peserta, jadwal, dan sertifikat terpisah
- Penagihan SPP/biaya training manual
- Tracking progress siswa/peserta tidak ada
- Integrasi absensi dengan sistem HR

---

## BAGIAN 3 — MODUL BARU (NEW DOMAIN MODULES)

> **Definisi Module**: domain bisnis mandiri dengan objek data utama sendiri, alur kerja end-to-end sendiri, dan persona operator yang jelas.

---

### MODULE 1 — Smart Tax & Compliance

**Klasifikasi**: `Core Module` (Strategic, wajib untuk pasar Indonesia)
**Target Pengguna**: Finance Manager, Tax Officer, Akuntan

#### Pain Point yang Diselesaikan:
- e-Faktur DJP dan sistem Coretax baru yang mulai berlaku 2025
- SPT Masa PPN dihitung manual setiap bulan → 15–30 jam/bulan terbuang
- PPh 21/23/4(2) datanya tersebar di berbagai modul
- Risiko sanksi DJP akibat keterlambatan dan kesalahan pelaporan
- Tax Calendar yang sering terlewat

#### Fitur Utama:

| Fitur | Deskripsi | Prioritas |
|-------|-----------|-----------|
| **e-Faktur Generator** | Generate faktur pajak elektronik format DJP/Coretax otomatis dari invoice penjualan | P0 |
| **Coretax Integration** | Koneksi langsung ke portal Coretax DJP untuk submit e-Faktur | P0 |
| **SPT Masa PPN** | Kalkulasi PPN keluaran/masukan otomatis, generate CSV upload DJP Online | P0 |
| **PPh Wizard** | PPh 21 (dari Payroll), PPh 23 (dari Purchasing), PPh 4(2) kalkulasi otomatis | P1 |
| **Tax Calendar** | Dashboard jatuh tempo pelaporan dan pembayaran dengan notifikasi | P0 |
| **Faktur Pajak Inbox** | Manajemen faktur pajak masuk dari vendor | P1 |
| **Tax Audit Trail** | Log perubahan data yang mempengaruhi kewajiban pajak | P1 |
| **NPWP & PKP Registry** | Manajemen NPWP customer dan vendor | P0 |
| **Bupot (Bukti Potong)** | Generate bukti potong PPh yang bisa dikirim ke vendor | P1 |
| **eSPT Summary** | Ringkasan semua kewajiban pajak per periode dalam satu dashboard | P2 |

**Dependency**: Finance Core, Revenue Core, Purchasing, HRIS Core
**Estimasi Harga**: Rp 250.000–500.000/bulan/tenant
**ARPU Uplift (30% adoption)**: +Rp 112.500/tenant/bulan

---

### MODULE 2 — Reseller & Distributor Management

**Klasifikasi**: `Vertical Module` (untuk bisnis dengan jaringan distribusi)
**Target Pengguna**: Sales Director, Channel Manager, Distributor Admin

#### Pain Point yang Diselesaikan:
- Produsen/principal tidak bisa pantau stok di level distributor
- Target dan achievement reseller dikelola di Excel
- Order dari ratusan reseller diproses manual
- Tidak ada portal khusus untuk reseller order

#### Fitur Utama:

| Fitur | Deskripsi | Prioritas |
|-------|-----------|-----------|
| **Reseller Registry** | Database reseller dengan level, territory, dan kontrak | P0 |
| **Reseller Portal** | Portal order mandiri untuk reseller | P0 |
| **Territory Management** | Pembagian wilayah distribusi per tier | P1 |
| **Sales Target & Achievement** | Set target dan tracking per reseller per periode | P0 |
| **Commission Engine** | Kalkulasi komisi berdasarkan rules yang dikonfigurasi | P1 |
| **Tiered Pricing** | Harga berbeda per level reseller | P0 |
| **Sell-in vs Sell-out** | Tracking penjualan principal → distributor → end-user | P1 |
| **Stock Visibility** | Visibilitas stok di level distributor | P2 |
| **Reseller Performance** | Dashboard ranking dan kinerja reseller | P1 |
| **Return & Claim** | Manajemen retur dari reseller | P2 |

**Dependency**: Revenue Core, Inventory Core, Finance Core
**Estimasi Harga**: Rp 400.000–800.000/bulan/tenant
**ARPU Uplift (20% adoption)**: +Rp 120.000/tenant/bulan

---

### MODULE 3 — Contract Lifecycle Management (CLM)

**Klasifikasi**: `Vertical Module` (Strategic untuk enterprise dan B2B)
**Target Pengguna**: Legal, Procurement, Sales, Management

#### Pain Point yang Diselesaikan:
- Kontrak tersebar di email, Google Drive, dan folder fisik
- Tidak ada peringatan otomatis untuk kontrak yang hampir expire
- Tidak ada tracking milestone pembayaran per kontrak
- Perubahan kontrak (amendment) tidak terdokumentasi dengan baik

#### Fitur Utama:

| Fitur | Deskripsi | Prioritas |
|-------|-----------|-----------|
| **Contract Repository** | Penyimpanan terpusat semua kontrak dengan metadata lengkap | P0 |
| **Contract Templates** | Template kontrak yang bisa dikustomisasi per jenis | P0 |
| **Expiry Alert** | Notifikasi otomatis H-90, H-30, H-7 untuk kontrak yang akan berakhir | P0 |
| **Amendment Tracking** | Versi kontrak dengan track changes | P1 |
| **Milestone Billing** | Tagihan otomatis terhubung ke milestone kontrak | P0 |
| **E-Signature** | Tanda tangan digital terintegrasi | P1 |
| **Contract Performance** | Tracking deliverable dan SLA per kontrak | P1 |
| **Vendor Contract** | Manajemen kontrak dengan supplier/vendor | P2 |
| **Auto-Renewal** | Workflow persetujuan untuk kontrak yang perlu diperbarui | P2 |

**Dependency**: Revenue Core, Purchasing, Finance Core
**Estimasi Harga**: Rp 300.000–600.000/bulan/tenant
**ARPU Uplift (15% adoption)**: +Rp 67.500/tenant/bulan

---

### MODULE 4 — Healthcare & Clinic Management

**Klasifikasi**: `Vertical Module` (untuk klinik, puskesmas, faskes)
**Target Pengguna**: Dokter, Perawat, Admin Klinik, Apoteker

#### Pain Point yang Diselesaikan:
- Rekam medis elektronik yang tidak terintegrasi dengan billing
- BPJS Kesehatan klaim yang diinput manual dan sering salah
- Stok obat dan farmasi tidak terhubung ke resep dokter
- Jadwal dokter dan antrian pasien tidak terkelola dengan baik

#### Fitur Utama:

| Fitur | Deskripsi | Prioritas |
|-------|-----------|-----------|
| **Patient Registry** | Database pasien dengan nomor rekam medis | P0 |
| **EMR (Electronic Medical Record)** | Catatan medis elektronik per kunjungan | P0 |
| **Queue Management** | Sistem antrian dengan estimasi waktu tunggu | P0 |
| **Doctor Scheduling** | Jadwal dokter dan booking appointment | P0 |
| **Pharmacy Integration** | Resep otomatis terhubung ke stok farmasi | P0 |
| **BPJS Billing** | Generate klaim BPJS dengan format yang benar | P1 |
| **Lab Results** | Input dan tracking hasil pemeriksaan laboratorium | P1 |
| **Prescription History** | Riwayat resep dan obat per pasien | P1 |
| **ICD-10 Coding** | Kode diagnosa ICD-10 terintegrasi | P2 |
| **Patient Portal** | Akses pasien ke riwayat kunjungan dan hasil lab | P2 |

**Dependency**: Inventory Core (farmasi), Finance Core, HRIS Core
**Estimasi Harga**: Rp 500.000–1.200.000/bulan/tenant
**ARPU Uplift (10% adoption)**: +Rp 85.000/tenant/bulan

---

## BAGIAN 4 — ADD-ON BARU (CAPABILITY EXTENSIONS)

> **Definisi Add-on**: capability yang memperluas core atau vertical module, bisa diaktifkan mandiri tanpa harus mengganti modul inti.

---

### CLUSTER A — COMPLIANCE & FINANCIAL INTELLIGENCE

---

#### ADD-ON A1 — Multi-Currency & Forex Management

**Pain Point**: Transaksi USD/EUR/SGD dikonversi manual, revaluasi valas error, laporan tidak akurat

| Fitur | Deskripsi |
|-------|-----------|
| Exchange Rate Management | Update kurs harian manual atau via API Bank Indonesia/Reuters |
| Multi-Currency Transactions | Transaksi penjualan, pembelian, pembayaran dalam berbagai mata uang |
| FX Gain/Loss Automation | Jurnal otomatis selisih kurs terealisasi dan belum terealisasi |
| Forex Revaluation | Revaluasi posisi utang/piutang valas per periode |
| Dual-Currency Reports | Laporan keuangan dalam IDR dan mata uang fungsional lain |
| Multi-Currency Bank Accounts | Rekening bank per mata uang dengan rekonsiliasi terpisah |

**Dependency**: Finance Core
**Estimasi Harga**: Rp 150.000–300.000/bulan/tenant

---

#### ADD-ON A2 — Fixed Assets Pro

**Pain Point**: Depresiasi dihitung manual, asset register tidak sinkron ledger, disposisi tidak otomatis

| Fitur | Deskripsi |
|-------|-----------|
| Asset Register | Database lengkap aset: kode, kategori, lokasi, kondisi |
| Depreciation Engine | Garis lurus, saldo menurun, unit produksi — otomatis |
| Auto-Depreciation Journal | Jurnal depresiasi otomatis tiap period closing |
| Asset Acquisition | Pembelian aset otomatis masuk asset register |
| Asset Disposal | Penjualan/penghapusan dengan kalkulasi gain/loss |
| Revaluation | Revaluasi aset sesuai PSAK 16 |
| Asset Maintenance Log | Riwayat perawatan dan biaya per aset |
| Asset QR Tagging | Label QR code untuk audit fisik |

**Dependency**: Finance Core
**Estimasi Harga**: Rp 150.000–350.000/bulan/tenant

---

#### ADD-ON A3 — Budget Intelligence

**Pain Point**: Budget di Excel tidak tersambung realisasi, tidak ada alert overbudget, proyeksi cashflow tidak ada

| Fitur | Deskripsi |
|-------|-----------|
| Budget Builder | Buat anggaran per departemen/cost center/proyek/periode |
| Budget vs Actual Real-time | Perbandingan anggaran vs realisasi update real-time |
| Variance Analysis | Drill-down ke transaksi dari selisih anggaran |
| Budget Alert | Notifikasi otomatis di 80%, 90%, dan 100% anggaran |
| Rolling Forecast | Proyeksi sisa tahun berdasarkan tren aktual |
| Cashflow Forecast | Proyeksi arus kas 30/60/90 hari ke depan |
| Scenario Planning | Simulasi best-case, base-case, worst-case |
| Budget Approval Flow | Workflow persetujuan anggaran dari departemen ke manajemen |

**Dependency**: Finance Core (wajib), HRIS Core (opsional)
**Estimasi Harga**: Rp 200.000–450.000/bulan/tenant

---

#### ADD-ON A4 — Data Privacy & Compliance (PDPA/GDPR)

**Pain Point**: Bisnis ekspansi regional harus comply PDPA (ASEAN) dan GDPR (Eropa), tapi tidak ada tools

| Fitur | Deskripsi |
|-------|-----------|
| Data Classification | Tandai data personal dan sensitif di sistem |
| Consent Management | Tracking persetujuan penggunaan data per customer |
| Right to Be Forgotten | Workflow penghapusan data atas permintaan customer |
| Data Access Log | Audit log siapa mengakses data personal kapan |
| Privacy Policy Builder | Template kebijakan privasi yang bisa dikustomisasi |
| Data Retention Rules | Aturan penyimpanan dan penghapusan data otomatis |
| DPA (Data Processing Agreement) | Repository perjanjian pengolahan data |
| Breach Notification | Workflow notifikasi jika terjadi kebocoran data |

**Dependency**: Platform Core
**Estimasi Harga**: Rp 200.000–400.000/bulan/tenant

---

### CLUSTER B — COMMERCE & REVENUE EXPANSION

---

#### ADD-ON B1 — Payment Gateway & QRIS Integration

**Pain Point**: Konfirmasi pembayaran manual via WA, tim finance cek mutasi satu per satu, invoice tidak auto-update

| Fitur | Deskripsi |
|-------|-----------|
| QRIS Integration | QR Code per transaksi terhubung ke rekening bisnis |
| Virtual Account | VA per invoice untuk bank transfer otomatis |
| Payment Link | Link bayar yang bisa dikirim via WA/email |
| Auto-Settlement | Status invoice otomatis update dan jurnal kas otomatis |
| Payment Dashboard | Real-time status semua invoice: pending/partial/paid |
| Provider Connector | Midtrans, Xendit, Doku, Dana, GoPay, OVO |
| Recurring Payment | Untuk pembayaran berulang/langganan |
| Partial Payment | Pembayaran cicilan dengan tracking sisa tagihan |

**Dependency**: Revenue Core, Finance Core
**Estimasi Harga**: Rp 100.000–250.000/bulan + transaction fee

---

#### ADD-ON B2 — Marketplace Connector

**Pain Point**: Stok Shopee/Tokopedia dan ERP tidak sinkron, order harus diinput ulang, margin per channel tidak kelihatan

| Fitur | Deskripsi |
|-------|-----------|
| Shopee Integration | Sinkronisasi produk, stok, dan order dari Shopee Seller |
| Tokopedia Integration | Sinkronisasi produk, stok, dan order dari Tokopedia |
| TikTok Shop Integration | Sinkronisasi produk dan order dari TikTok Shop |
| Lazada Integration | Sinkronisasi produk dan order dari Lazada |
| Inventory Auto-Sync | Setiap penjualan marketplace kurangi stok di NIZAM otomatis |
| Order Auto-Import | Order marketplace masuk sebagai Sales Order di NIZAM |
| Channel P&L | Laporan margin dan profitabilitas per channel |
| Settlement Reconciliation | Rekonsiliasi pembayaran settlement marketplace |
| Return Management | Proses retur dari marketplace ke sistem NIZAM |
| Cross-channel Stock Control | Alert jika stok total mendekati habis |

**Dependency**: Revenue Core, Inventory Core
**Estimasi Harga**: Rp 200.000–400.000/bulan/tenant

---

#### ADD-ON B3 — Customer Loyalty & Membership

**Pain Point**: Tidak ada sistem reward pelanggan setia, program diskon tidak terintegrasi, membership di Excel

| Fitur | Deskripsi |
|-------|-----------|
| Points Engine | Kalkulasi poin per transaksi dengan rules yang bisa dikustomisasi |
| Membership Tiers | Bronze/Silver/Gold/Platinum dengan benefit berbeda |
| Redemption Management | Tukar poin saat transaksi (POS atau Sales Order) |
| Voucher & Coupon | Generate dan validasi voucher diskon |
| Loyalty Dashboard | Customer aktif, poin beredar, redemption rate |
| Birthday/Anniversary Reward | Auto-reward pada tanggal spesial |
| Referral Program | Tracking referral dan bonus |
| Digital Member Card | QR code member card di smartphone |
| Customer Lifetime Value | Analytics CLV per member |

**Dependency**: Revenue Core, POS (opsional)
**Estimasi Harga**: Rp 150.000–350.000/bulan/tenant

---

#### ADD-ON B4 — Subscription & Recurring Billing

**Pain Point**: Bisnis SaaS/gym/klinik/sekolah buat invoice langganan manual tiap periode, tidak ada dunning, tidak ada MRR dashboard

| Fitur | Deskripsi |
|-------|-----------|
| Subscription Plan Management | Paket berlangganan dengan siklus billing |
| Auto-Invoice Generator | Invoice otomatis sesuai siklus billing |
| Dunning Management | Pengingat bertingkat: H-3, H0, H+3, H+7 |
| Trial & Proration | Masa trial dan billing proporsional saat upgrade/downgrade |
| MRR & ARR Dashboard | Monthly dan Annual Recurring Revenue dashboard |
| Churn Analytics | Tracking customer yang tidak renew |
| Upgrade/Downgrade Flow | Perubahan paket dengan kalkulasi selisih billing |
| Cohort Analytics | Retensi per kelompok pelanggan |

**Dependency**: Revenue Core, Finance Core
**Estimasi Harga**: Rp 150.000–300.000/bulan/tenant

---

#### ADD-ON B5 — B2B E-Commerce Storefront

**Pain Point**: Customer B2B memesan via WA/telepon, tidak ada katalog online, tidak ada self-service order untuk pelanggan reguler

| Fitur | Deskripsi |
|-------|-----------|
| Customer-Facing Catalog | Katalog produk online dengan harga per customer/tier |
| B2B Order Portal | Customer B2B bisa order mandiri dengan credit limit |
| Real-time Stock Display | Tampilan stok real-time di storefront |
| Custom Pricing per Customer | Harga berbeda per customer/kontrak |
| Minimum Order Quantity | Aturan MOQ per produk |
| Order History | Customer lihat semua riwayat order |
| Quotation Request | Customer request penawaran dari portal |
| Order Approval Workflow | Internal approval sebelum order diproses |

**Dependency**: Revenue Core, Inventory Core
**Estimasi Harga**: Rp 200.000–450.000/bulan/tenant

---

### CLUSTER C — OPERATIONS INTELLIGENCE

---

#### ADD-ON C1 — Quality Control & Inspection

**Pain Point**: Produk reject ditemukan setelah dikirim, tidak ada inspeksi formal barang masuk, defect rate tidak terpantau

| Fitur | Deskripsi |
|-------|-----------|
| Incoming QC | Inspeksi barang masuk dari supplier |
| In-Process QC | Pemeriksaan kualitas di tengah produksi |
| Final Inspection | Pemeriksaan produk jadi sebelum pengiriman |
| QC Checklist Builder | Template checklist per kategori produk |
| Defect Categorization | Klasifikasi cacat dengan foto bukti |
| Reject & Hold Management | Status lot ditahan atau di-reject |
| Supplier Quality Scorecard | Penilaian kualitas per supplier |
| QC Analytics | Defect rate, trend kualitas |
| Certificate of Analysis | Generate CoA untuk produk lulus inspeksi |

**Dependency**: Inventory Core (wajib), Manufacturing (opsional)
**Estimasi Harga**: Rp 200.000–400.000/bulan/tenant

---

#### ADD-ON C2 — After-Sales & Warranty Management

**Pain Point**: Klaim garansi via WA tidak tercatat, spare parts garansi tidak terhubung inventory, tidak ada SLA tracking

| Fitur | Deskripsi |
|-------|-----------|
| Warranty Registration | Registrasi garansi dengan serial number |
| RMA (Return Merchandise Authorization) | Proses retur terstruktur dengan nomor RMA |
| Claim Management | Tracking klaim dari pengajuan hingga penyelesaian |
| Repair Workflow | Alur: terima → diagnosa → perbaiki → QC → kirim balik |
| Spare Parts Tracking | Parts untuk garansi terhubung ke inventory |
| Customer Notification | Notifikasi otomatis update status klaim |
| Warranty Analytics | Produk paling sering diklaim, biaya garansi |
| Extended Warranty | Jual extended warranty sebagai produk |
| SLA Monitoring | Tracking waktu penyelesaian vs target SLA |

**Dependency**: Service Operations (opsional), Revenue Core, Inventory Core
**Estimasi Harga**: Rp 150.000–300.000/bulan/tenant

---

#### ADD-ON C3 — Production Planning & Scheduling

**Pain Point**: Jadwal produksi dibuat manual di whiteboard/Excel, kapasitas mesin tidak termonitor, bottleneck tidak kelihatan

| Fitur | Deskripsi |
|-------|-----------|
| Production Schedule Board | Visual scheduling board (Gantt-style) per mesin/lini |
| Capacity Planning | Kalkulasi kapasitas tersedia vs kebutuhan produksi |
| Material Requirement Planning | MRP: hitung kebutuhan bahan berdasarkan jadwal produksi |
| Work Order Priority | Prioritas work order berdasarkan deadline dan kapasitas |
| Machine Downtime Tracking | Tracking waktu mesin berhenti dan penyebabnya |
| Production Progress | Real-time progress per work order |
| Bottleneck Alert | Identifikasi otomatis titik kemacetan produksi |
| OEE Calculation | Overall Equipment Effectiveness per mesin |

**Dependency**: Manufacturing Module (wajib)
**Estimasi Harga**: Rp 250.000–500.000/bulan/tenant

---

#### ADD-ON C4 — Batch & Expiry Tracking

**Pain Point**: Produk dengan expiry date tidak dipantau, barang kadaluarsa terkirim ke customer, FIFO tidak berjalan di item batch

| Fitur | Deskripsi |
|-------|-----------|
| Batch Number Tracking | Assign nomor batch saat receiving dan produksi |
| Expiry Date Management | Tracking expired date per batch |
| FEFO (First Expired First Out) | Algoritma pengambilan stok berdasarkan expired earliest |
| Expiry Alert | Notifikasi otomatis untuk stok yang akan kadaluarsa |
| Batch Traceability | Trace batch dari supplier ke customer end-to-end |
| Recall Management | Workflow penarikan produk berdasarkan nomor batch |
| Quarantine Stock | Area stok karantina untuk batch yang perlu diperiksa |
| Batch Cost Tracking | Biaya produksi per batch |

**Dependency**: Inventory Core (wajib), Manufacturing (opsional)
**Estimasi Harga**: Rp 150.000–300.000/bulan/tenant

---

### CLUSTER D — CUSTOMER & PARTNER ECOSYSTEM

---

#### ADD-ON D1 — Customer Self-Service Portal

**Pain Point**: Customer WA terus untuk cek invoice/order, tim CS kelebihan beban, tidak ada akses mandiri 24/7

| Fitur | Deskripsi |
|-------|-----------|
| Customer Portal Login | Akun portal khusus customer |
| Invoice & Statement | Customer lihat dan download invoice, statement |
| Online Payment | Bayar invoice dari portal (terintegrasi Payment Gateway) |
| Order Tracking | Tracking status pesanan real-time |
| Order History | Riwayat transaksi lengkap |
| Document Download | Download PO, DO, invoice, faktur pajak |
| Complaint & Ticket | Submit keluhan dari portal, terhubung ke internal |
| Quotation Approval | Customer review dan approve quotation |
| Custom Branding | Logo dan warna bisnis sendiri |

**Dependency**: Revenue Core (wajib), Payment Gateway (opsional)
**Estimasi Harga**: Rp 200.000–400.000/bulan/tenant

---

#### ADD-ON D2 — WhatsApp Business Integration

**Pain Point**: Notifikasi invoice manual via WA personal, update status tidak konsisten, tidak ada tracking percakapan

| Fitur | Deskripsi |
|-------|-----------|
| WA Invoice Notification | Kirim invoice otomatis via WA Business API |
| Payment Reminder | Reminder otomatis H-3, H0, H+3 untuk invoice jatuh tempo |
| Order Status Update | Notifikasi perubahan status pesanan via WA |
| Service Status Update | Update status job order ke customer via WA |
| Template Manager | Kelola template WA yang sudah disetujui |
| Bulk WA Blast | Kirim pesan promo ke segmen customer tertentu |
| WA Inbox Terpusat | Semua percakapan WA bisnis di satu tempat |
| Chatbot Builder | Chatbot FAQ dan cek status pesanan |
| Conversation Analytics | Delivery rate, open rate, respons rate |

**Dependency**: Revenue Core (wajib), Service Operations (opsional)
**Estimasi Harga**: Rp 200.000–500.000/bulan/tenant + per-message cost

---

#### ADD-ON D3 — Field Operations & Mobile Workforce

**Pain Point**: Teknisi tidak bisa update data real-time, absensi lapangan tidak bisa diverifikasi, job order dicatat di kertas

| Fitur | Deskripsi |
|-------|-----------|
| Mobile Check-in/out | Absensi dengan GPS verification dan foto |
| GPS Tracking | Real-time lokasi tim lapangan |
| Digital Job Sheet | Teknisi terima dan update job order dari HP |
| Customer Signature | Tanda tangan digital di HP |
| Photo Documentation | Foto kondisi sebelum/sesudah pekerjaan |
| Route Optimization | Urutan kunjungan optimal berdasarkan lokasi |
| Offline Mode | Input data tetap bisa tanpa sinyal, sync otomatis |
| Mobile Invoice | Buat dan kirim invoice dari lapangan |
| Parts Request | Request kebutuhan parts dari lapangan |
| Daily Report | Laporan harian otomatis dari aktivitas lapangan |

**Dependency**: Service Operations (opsional), HRIS Core
**Estimasi Harga**: Rp 15.000–25.000/user/bulan (seat-based)

---

#### ADD-ON D4 — Document Management System (DMS)

**Pain Point**: Dokumen tersebar di email, Google Drive, folder lokal; tidak ada versi kontrol; sulit audit

| Fitur | Deskripsi |
|-------|-----------|
| Centralized Repository | Penyimpanan terpusat semua dokumen bisnis |
| Version Control | Versi dokumen dengan history perubahan |
| Document Tagging | Tag berdasarkan jenis, proyek, departemen |
| Full-text Search | Cari konten di dalam dokumen |
| Access Control | Izin akses per folder dan dokumen |
| Document Linking | Tautkan dokumen ke transaksi (invoice, PO, kontrak) |
| Expiry Reminder | Notifikasi untuk dokumen yang hampir expire |
| Digital Signature | Tanda tangan elektronik terintegrasi |
| Audit Trail | Log siapa membuka, mengubah, menghapus dokumen |
| Compliance Archive | Arsip wajib sesuai regulasi (pajak, hukum) |

**Dependency**: Platform Core
**Estimasi Harga**: Rp 150.000–350.000/bulan/tenant

---

### CLUSTER E — AI & INTELLIGENCE LAYER

---

#### ADD-ON E1 — AI Business Analytics

**Pain Point**: Laporan statis tidak cukup untuk pengambilan keputusan cepat, anomali tidak terdeteksi, tidak ada insight prediktif

| Fitur | Deskripsi |
|-------|-----------|
| Natural Language Query | Tanya data bisnis dengan bahasa natural ("Berapa pendapatan bulan ini?") |
| Anomaly Detection | Deteksi otomatis transaksi atau tren yang tidak normal |
| Sales Forecasting | Prediksi penjualan 30/60/90 hari ke depan dengan ML |
| Cash Flow Prediction | Proyeksi arus kas berdasarkan pola historis |
| Customer Churn Prediction | Identifikasi customer yang berpotensi berhenti beli |
| Inventory Demand Forecasting | Prediksi kebutuhan stok berdasarkan pola penjualan |
| Automated Insights | Ringkasan otomatis perubahan signifikan dalam data bisnis |
| Smart Dashboard | Dashboard yang adaptif berdasarkan peran dan prioritas user |

**Teknologi**: Google Vertex AI + BigQuery ML (sesuai stack existing)
**Dependency**: Semua Core Module (Finance, Revenue, Inventory, HRIS)
**Estimasi Harga**: Rp 300.000–700.000/bulan/tenant

---

#### ADD-ON E2 — AI Document Processing (OCR + Extraction)

**Pain Point**: Invoice dari supplier harus diinput manual, faktur pajak masuk harus dibaca satu per satu

| Fitur | Deskripsi |
|-------|-----------|
| Invoice OCR | Baca invoice PDF/foto dan ekstrak data otomatis |
| PO Auto-Matching | Cocokkan faktur masuk dengan PO secara otomatis |
| Receipt Digitization | Foto struk fisik → data digital untuk expense claim |
| Tax Document Extraction | Baca e-Faktur dan ekstrak data untuk rekonsiliasi |
| Bank Statement Import | Import mutasi bank (PDF/CSV) dan klasifikasi otomatis |
| Document Validation | Validasi dokumen masuk sesuai format yang diharapkan |

**Teknologi**: Google Document AI / Vertex AI Vision
**Dependency**: Finance Core, Purchasing
**Estimasi Harga**: Rp 200.000–500.000/bulan/tenant

---

## BAGIAN 5 — ARSITEKTUR PRODUK LENGKAP (POST-ROADMAP)

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                        🏛️  PLATFORM CORE                                ║
║     Auth · Tenancy · Branch · Roles · Settings · Billing · Support       ║
╚═══════════════════════════════════════════════════════════════════════════╝
                                    │
            ┌───────────────────────┼───────────────────────┐
            │                       │                       │
   ┌────────▼─────────┐   ┌─────────▼────────┐   ┌────────▼─────────┐
   │   🔵 CORE ERP    │   │  🟣 VERTICALS    │   │  🟡 STRATEGIC   │
   │                  │   │                  │   │                  │
   │ Finance Core     │   │ Manufacturing    │   │ Academy/EDU      │
   │ Revenue Core     │   │ Fleet & Rental   │   │ [EXISTING]       │
   │ Purchasing       │   │ Service Ops      │   └──────────────────┘
   │ Inventory Core   │   │ Construction     │
   │ HRIS Core        │   │ Bengkel Motor    │
   │ [EXISTING]       │   │ [EXISTING]       │
   │                  │   │                  │
   │ +Smart Tax ★NEW  │   │ +Reseller Mgmt ★ │
   │ +CLM ★NEW        │   │ +Healthcare ★    │
   └──────────────────┘   └──────────────────┘
                                    │
   ┌────────────────────────────────┼────────────────────────────────┐
   │                                │                                │
┌──▼──────────────┐  ┌──────────────▼────────────┐  ┌──────────────▼────────┐
│ 💰 COMMERCE     │  │ ⚙️ OPERATIONS             │  │ 🌐 ECOSYSTEM          │
│ ADD-ONS         │  │ ADD-ONS                    │  │ ADD-ONS               │
│                 │  │                            │  │                       │
│ POS ✅          │  │ Advanced WMS ✅            │  │ Open API ✅           │
│ Sales Page ✅   │  │ Fleet Maintenance ✅       │  │ Multi-Entity ✅       │
│ Quick Bill ✅   │  │ Package Tracking ✅        │  │ Seat Pack ✅          │
│ AR Cockpit ✅   │  │                            │  │                       │
│                 │  │ +QC & Inspection ★         │  │ +Multi-Currency ★     │
│ +Payment GW ★   │  │ +After-Sales/Warranty ★    │  │ +Marketplace Conn. ★  │
│ +Loyalty ★      │  │ +Fixed Assets Pro ★        │  │ +WA Integration ★     │
│ +Subscription ★ │  │ +Budget Intelligence ★     │  │ +Customer Portal ★    │
│ +B2B Store ★    │  │ +Batch/Expiry Track ★      │  │ +DMS ★                │
│                 │  │ +Prod. Planning ★           │  │ +Data Privacy ★       │
└─────────────────┘  └────────────────────────────┘  └───────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
            ┌───────▼──────┐ ┌─────▼──────┐ ┌─────▼──────────┐
            │ 📱 MOBILE    │ │ 🤖 AI LAYER│ │ 👥 PARTNER     │
            │              │ │            │ │ ECOSYSTEM       │
            │ Field Ops ★  │ │ AI Biz     │ │                 │
            │              │ │ Analytics★ │ │ Reseller Portal │
            │              │ │ AI Doc     │ │ Customer Portal │
            │              │ │ Process ★  │ │ Supplier Portal │
            └──────────────┘ └────────────┘ └─────────────────┘

✅ = Existing  ★ = New (Roadmap)
```

---

## BAGIAN 6 — MATRIKS PRIORITAS IMPLEMENTASI

### 6.1 Kriteria Prioritasi

| Dimensi | Bobot | Keterangan |
|---------|-------|------------|
| Pain Point Severity | 30% | Seberapa kritis masalah ini bagi customer |
| Revenue Impact (ARPU) | 25% | Potensi kenaikan ARPU dari add-on ini |
| Technical Complexity | 20% | Seberapa besar effort engineering |
| Market Timing | 15% | Seberapa mendesak dari sisi pasar/regulasi |
| Competitive Differentiation | 10% | Seberapa unik vs kompetitor |

### 6.2 Fase Implementasi

#### 🚀 FASE 1 — Quick Win (0–3 bulan)
*Target: Dampak tinggi, complexity rendah-sedang, pain point sangat nyata*

| Prioritas | Modul/Add-on | Skor | Alasan |
|-----------|-------------|------|--------|
| 🥇 1 | Payment Gateway & QRIS | 92/100 | Pain point #1, friction payment langsung terasa |
| 🥈 2 | Smart Tax & Compliance | 89/100 | Regulasi Coretax 2025 menjadi urgent catalyst |
| 🥉 3 | WhatsApp Business | 87/100 | Indonesia: WA = komunikasi bisnis utama |
| 4 | Fixed Assets Pro | 81/100 | Finance Core sudah kuat, tinggal extend |
| 5 | Budget Intelligence | 79/100 | Finance Core solid, add forecast layer |

#### ⚡ FASE 2 — Core Expansion (3–6 bulan)
*Target: Perluasan ARPU dari customer existing*

| Prioritas | Modul/Add-on | Skor | Alasan |
|-----------|-------------|------|--------|
| 6 | Marketplace Connector | 85/100 | 89% bisnis retail butuh ini (Indonesia) |
| 7 | Multi-Currency & Forex | 78/100 | Importir/eksporter sangat butuh |
| 8 | Customer Self-Service Portal | 76/100 | Kurangi beban CS 40-60% |
| 9 | Document Management | 73/100 | Cross-industry, mudah dijual |
| 10 | Subscription & Recurring | 71/100 | SaaS & bisnis langganan tumbuh pesat |

#### 🏗️ FASE 3 — Vertical Deepening (6–12 bulan)
*Target: Diferensiasi dan penetrasi vertical market*

| Prioritas | Modul/Add-on | Skor | Alasan |
|-----------|-------------|------|--------|
| 11 | QC & Inspection | 74/100 | Manufacturing module sudah ada |
| 12 | After-Sales & Warranty | 71/100 | Service Ops sudah ada |
| 13 | Batch & Expiry Tracking | 69/100 | F&B, Farmasi, wajib |
| 14 | Customer Loyalty | 68/100 | Retail, F&B, butuh differensiasi |
| 15 | B2B Storefront | 65/100 | Distribusi B2B butuh portal order |

#### 🌐 FASE 4 — Intelligence & Ecosystem (12–18 bulan)
*Target: Ekosistem, network effect, dan AI advantage*

| Prioritas | Modul/Add-on | Skor | Alasan |
|-----------|-------------|------|--------|
| 16 | AI Business Analytics | 78/100 | Game changer kompetitif jangka panjang |
| 17 | Reseller Management | 71/100 | Strategic untuk principal + distributor |
| 18 | Production Planning | 68/100 | Manufacturing deepening |
| 19 | Contract Lifecycle | 65/100 | Enterprise/B2B segment |
| 20 | AI Document Processing | 63/100 | Finance automation, high value |

#### 🏥 FASE 5 — New Verticals (18–24 bulan)
*Target: Ekspansi ke vertical market baru*

| Prioritas | Modul/Add-on | Skor | Alasan |
|-----------|-------------|------|--------|
| 21 | Healthcare & Clinic | 72/100 | Vertical baru, ARPU tertinggi |
| 22 | Field Operations Mobile | 68/100 | Butuh mobile app development |
| 23 | Data Privacy (PDPA/GDPR) | 61/100 | Compliance driven, enterprise segment |

---

## BAGIAN 7 — ANALISIS DAMPAK BISNIS

### 7.1 ARPU Impact Analysis

**Baseline ARPU (estimasi saat ini)**:
| Tier | ARPU/Bulan |
|------|-----------|
| Lite | ~Rp 300.000 |
| Starter | ~Rp 600.000 |
| Full | ~Rp 1.200.000 |

**Proyeksi ARPU Uplift (Fase 1-3, asumsi 30% adoption)**:

| Add-on | Harga Rata-rata | Uplift (30% adoption) |
|--------|-----------------|----------------------|
| Payment Gateway | Rp 175.000 | +Rp 52.500 |
| Smart Tax | Rp 375.000 | +Rp 112.500 |
| WhatsApp Integration | Rp 350.000 | +Rp 105.000 |
| Marketplace Connector | Rp 300.000 | +Rp 90.000 |
| Fixed Assets Pro | Rp 250.000 | +Rp 75.000 |
| Budget Intelligence | Rp 325.000 | +Rp 97.500 |
| Multi-Currency | Rp 225.000 | +Rp 67.500 |
| Customer Portal | Rp 300.000 | +Rp 90.000 |
| **TOTAL FASE 1–2** | | **+Rp 690.000/bulan** |

> **Target**: ARPU Starter naik dari Rp 600K → Rp 1,29 juta (+115%) setelah Fase 1–2

### 7.2 TAM Expansion per Vertical Baru

| Vertical | Estimasi Pasar Indonesia | NIZAM Coverage Saat Ini |
|----------|--------------------------|------------------------|
| Retail + F&B | ~450.000 bisnis | 40% (via POS + Revenue) |
| Manufaktur | ~65.000 bisnis | 60% (via Manufacturing) |
| Konstruksi | ~35.000 bisnis | 55% (via Construction) |
| Kesehatan | ~85.000 faskes | 0% → **TAM baru** |
| Distribusi | ~125.000 distributor | 20% → **Reseller Module** |
| SaaS/Langganan | ~12.000 bisnis | 5% → **Subscription Add-on** |

### 7.3 Competitive Positioning After Roadmap

| Dimensi | Sebelum Roadmap | Sesudah Roadmap |
|---------|----------------|-----------------|
| vs Jurnal/Accurate | Lebih lengkap operasional | + Tax native + Payment GW + WA |
| vs Odoo | Lebih ringan | + Indonesia-specific compliance |
| vs SAP B1 | Harga lebih murah | + Mobile + Marketplace local |
| vs ERP global | Lebih lokal | + AI + QRIS + Coretax native |
| vs HashMicro | Sebanding | + Syirkah + EDU Academy |

---

## BAGIAN 8 — DEPENDENCY MAP LENGKAP

```
Finance Core
 ├── Smart Tax & Compliance (Module) ★
 ├── Multi-Currency & Forex (Add-on) ★
 ├── Fixed Assets Pro (Add-on) ★
 ├── Budget Intelligence (Add-on) ★
 └── AI Document Processing (Add-on) ★

Revenue Core
 ├── Payment Gateway & QRIS (Add-on) ★
 ├── Marketplace Connector (Add-on) ★
 ├── Customer Loyalty & Membership (Add-on) ★
 ├── Subscription & Recurring Billing (Add-on) ★
 ├── Customer Self-Service Portal (Add-on) ★
 ├── WhatsApp Business Integration (Add-on) ★
 ├── B2B E-Commerce Storefront (Add-on) ★
 └── Contract Lifecycle Management (Module) ★

Inventory Core
 ├── QC & Inspection (Add-on) ★
 ├── Batch & Expiry Tracking (Add-on) ★
 └── Marketplace Connector (Add-on) ★

Manufacturing [Vertical]
 ├── QC & Inspection (extends in-process QC) ★
 └── Production Planning & Scheduling (Add-on) ★

Service Operations [Vertical]
 ├── After-Sales & Warranty (Add-on) ★
 ├── WhatsApp Business Integration (Add-on) ★
 └── Field Operations & Mobile (Add-on) ★

HRIS Core
 ├── Budget Intelligence (opsional, per-departemen) ★
 └── Field Operations & Mobile (Add-on) ★

Revenue + Inventory + Finance Core
 └── Reseller & Distributor Management (Module) ★

Platform Core
 ├── Document Management System (Add-on) ★
 └── Data Privacy & Compliance (Add-on) ★

All Core Modules
 └── AI Business Analytics (Add-on) ★
```

---

## BAGIAN 9 — TECHNICAL REQUIREMENTS

### 9.1 Infrastruktur yang Dibutuhkan

| Kebutuhan | Untuk Add-on | Estimasi Effort |
|-----------|-------------|-----------------|
| **Webhook Engine** | Marketplace, Payment GW, WA | High |
| **Event Bus (multi-tenant)** | Notifikasi WA, Email, In-app | High |
| **AI/ML Service** | AI Analytics, AI Doc Processing | High |
| **Mobile App/PWA** | Field Operations | Very High |
| **Third-party API Manager** | Rate limiting, retry, monitoring | Medium |
| **OCR Service** | AI Document Processing | Medium |
| **Real-time WebSocket** | Payment Dashboard, Budget Alert | Medium |
| **Cron/Scheduler** | Subscription billing, Tax Calendar | Low |
| **Object Storage expansion** | DMS, Photo docs | Medium |

### 9.2 Prinsip Teknis

1. **API-first** — setiap add-on baru harus memiliki REST endpoint yang terdokumentasi di Open API Add-on
2. **Event-driven** — perubahan data di satu modul trigger event yang bisa dikonsumsi modul lain
3. **Tenant-isolated** — semua data dan konfigurasi terisolasi per tenant
4. **Mobile-ready** — add-on yang bersentuhan dengan lapangan harus fully responsive
5. **Permission-granular** — setiap add-on mendaftarkan permission keys baru di entitlement system
6. **Billing-integrated** — setiap add-on langsung terkoneksi ke sistem billing tenant

### 9.3 Database Schema Additions

Setiap modul/add-on baru perlu tabel baru di Railway PostgreSQL:

| Module/Add-on | Tabel Utama |
|---------------|-------------|
| Smart Tax | `tax_invoices`, `tax_returns`, `tax_calendar` |
| Multi-Currency | `exchange_rates`, `forex_positions` |
| Fixed Assets | `assets`, `depreciation_schedules`, `asset_transactions` |
| Budget Intelligence | `budgets`, `budget_lines`, `budget_alerts` |
| Payment Gateway | `payment_transactions`, `payment_providers` |
| Marketplace | `marketplace_orders`, `marketplace_products`, `marketplace_sync_logs` |
| Loyalty | `loyalty_programs`, `loyalty_points`, `loyalty_redemptions` |
| Subscription | `subscription_plans`, `subscriptions`, `billing_cycles` |
| QC | `quality_inspections`, `qc_checklists`, `defect_records` |
| Warranty | `warranties`, `warranty_claims`, `repair_orders` |
| Contract | `contracts`, `contract_milestones`, `contract_amendments` |
| Healthcare | `patients`, `medical_records`, `appointments`, `prescriptions` |

---

## BAGIAN 10 — KESIMPULAN STRATEGIS

### 10.1 Posisi NIZAM dalam 24 Bulan

Jika roadmap ini dieksekusi dengan disiplin:

> **"NIZAM akan menjadi platform operasional bisnis paling lengkap dan paling sesuai untuk pasar Indonesia, dengan ARPU potensial 3x lipat dari posisi saat ini."**

### 10.2 Lima Kekuatan Kompetitif

1. **Lokal terdalam** — e-Faktur/Coretax, QRIS, BPJS, Syirkah: tidak ada ERP global yang bisa masuk sedalam ini ke pasar Indonesia
2. **Vertikal terluas** — dari manufaktur, fleet, konstruksi, bengkel, hingga healthcare
3. **Ecosystem terkuat** — Marketplace + WA + Customer Portal + Reseller = jaringan yang sulit ditinggalkan
4. **AI-augmented** — analytics prediktif dan document automation yang terintegrasi native
5. **Training-embedded** — Academy/EDU sebagai competitive moat yang tidak dimiliki kompetitor manapun

### 10.3 OKR Roadmap 2026–2027

**Objective**: Menjadi ERP #1 pilihan UMKM dan enterprise menengah Indonesia

| Key Result | Target | Fase |
|------------|--------|------|
| ARPU Starter naik 100%+ | Rp 1,2 juta/bulan | Fase 1–2 |
| 5 add-on baru live production | Payment, Tax, WA, Fixed Assets, Budget | Fase 1 (Q3 2026) |
| Adoption add-on ≥ 25% dari tenant aktif | 25% tenant pakai min. 1 add-on baru | Q4 2026 |
| 10 add-on baru live production | +Marketplace, FX, Portal, DMS, Subscription | Fase 2 (Q1 2027) |
| Vertical baru: Healthcare beta | 50 klinik/faskes pilot | Q2 2027 |
| NPS naik ≥ 15 poin | Net Promoter Score dari customer | Q2 2027 |

---

## PENUTUP

Dokumen ini merupakan hasil analisis menyeluruh terhadap:
1. Arsitektur produk terkini di branch `feat_multi` (5 pilar + 5 vertikal + 11 add-on)
2. Pain point global ERP buyer berdasarkan riset 2024–2026
3. Kekhususan pasar Indonesia (Coretax, QRIS, WA, marketplace lokal)
4. Competitive landscape lokal dan global
5. Kapasitas teknis yang sudah dibangun (Railway PostgreSQL, Google Vertex AI, AWS S3)

**Total roadmap**: 4 modul baru + 18 add-on baru = **22 capability baru** dalam 24 bulan.

Setiap item diprioritasi berdasarkan dampak revenue, tingkat urgensi pain point, dan kesiapan teknis — bukan sekadar fitur yang "bagus untuk dimiliki".

---

*Dokumen dibuat: 22 Mei 2026 | Basis: branch feat_multi + KLASIFIKASI_MODULE_DAN_ADDON_NIZAM.md + GTM_NIZAM_MODULE_DAN_ADDON.md + MASTERPLAN_MODUL_ADDON_GLOBAL_NIZAM.md*

*Next step: Review dokumen ini bersama tim produk, tetapkan scope Fase 1, buat sprint plan untuk Payment Gateway + Smart Tax sebagai quick win pertama.*
