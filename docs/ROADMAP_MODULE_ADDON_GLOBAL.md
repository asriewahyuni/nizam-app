# NIZAM Platform — Roadmap Modul & Add-on Global
## Dokumen Perencanaan Produk: Menyelesaikan Pain Customer Secara Global

**Versi:** 2.0  
**Tanggal:** 18 Mei 2026  
**Branch Sumber Analisis:** `feat_multi`  
**Penulis:** Claude Code (AI Engineering Assistant)  
**Status:** FINAL — Siap Review Produk

---

## 1. Ringkasan Eksekutif

NIZAM kini beroperasi dengan arsitektur **5 Pilar + Business Type + Add-on** yang matang dan terukur. Setiap tenant mendapatkan 5 pilar wajib, memilih satu Business Type sesuai model operasional, dan mengaktifkan Add-on secara mandiri via Marketplace.

### Arsitektur Saat Ini (feat_multi)

```
╔══════════════════════════════════════════════════════════╗
║             5 PILAR (selalu aktif, wajib)                ║
╠══════════════╦═══════════════╦════════╦═══════╦══════════╣
║   FINANCE    ║  OPERASIONAL  ║MARKETING║  HRIS ║ SYIRKAH  ║
║  (7 modul)   ║  (container)  ║(2 modul)║(1 modul)║(1 modul)║
╚══════════════╩═══════════════╩════════╩═══════╩══════════╝
                       ↓
╔══════════════════════════════════════════════════════════╗
║      BUSINESS TYPE (pilih 1, swapable)                   ║
║  Fleet │ Manufacturing │ Workshop │ Job Order │           ║
║  Project & Construction │ LMS                            ║
╚══════════════════════════════════════════════════════════╝
                       ↓
╔══════════════════════════════════════════════════════════╗
║      ADD-ON (multi-aktif, pilih sesuai kebutuhan)        ║
║  POS │ Sales Page │ (dan roadmap berikut ini)            ║
╚══════════════════════════════════════════════════════════╝
```

### Modul Existing per Pilar

**Finance (7 modul):** Akuntansi & Jurnal, Kas & Keuangan, Pembelian, Inventori & Stok, Gudang (WMS), Laporan & Insight, Audit & Stock Opname  
**Marketing (2 modul):** Penjualan, Pelanggan (CRM)  
**HRIS (1 modul):** HRIS & Payroll  
**Syirkah (1 modul):** Syirkah (Bagi Hasil & Kemitraan) — *fitur Zakat, Syariah CoA, akad Islami*  
**Business Types (6):** Fleet & Rental, Manufacturing (BoM), Workshop, Job Order, Project & Construction, LMS  
**Add-ons (2):** POS (Kasir), Sales Page (Landing Penjualan)

### Gap Strategis yang Ditemukan

Meski fondasi kuat, terdapat **7 zona gap kritis** yang menghalangi pertumbuhan dan retensi customer global:

| # | Zona Gap | Revenue Risk | Customer Segment Tertutup |
|---|---|---|---|
| 1 | Multi-currency & treasury | 🔴 Tinggi | Eksportir, importir, bisnis asing |
| 2 | Tax compliance & e-faktur | 🔴 Tinggi | Semua PKP Indonesia (900rb+) |
| 3 | Customer & vendor self-service | 🔴 Tinggi | Semua B2B distributor |
| 4 | AI-native operations | 🟠 Sedang | SME yang butuh efisiensi |
| 5 | Omnichannel commerce | 🟠 Sedang | 500rb+ penjual marketplace |
| 6 | Vertical baru (health, agri, property) | 🟠 Sedang | Industri yang belum terlayani |
| 7 | ESG & governance enterprise | 🟡 Rendah-Naik | Perusahaan IPO-ready & MNC |

Dokumen ini merinci **16 modul baru**, **22 add-on baru**, dan **6 business type baru** beserta roadmap implementasinya.

---

## 2. Analisis Pain Point Customer Global

### 2.1 Pain Point Tier-1 — Menghilangkan Revenue Aktif

| Pain Point | Segmen Customer | Frekuensi | Dampak Finansial |
|---|---|---|---|
| Tidak bisa catat transaksi multi-mata uang | Eksportir, importir, bisnis asing | Harian | Rugi kurs tersembunyi, laporan salah |
| Invoice manual, tidak ada payment link | Semua B2B | Per transaksi | Keterlambatan bayar rata-rata 15-30 hari |
| Tidak bisa cek status approval PO dari mana saja | Semua perusahaan | Harian | Bottleneck operasional, fraud risk |
| Tidak ada forecast arus kas | UKM dengan piutang | Bulanan | Gagal bayar supplier, denda bank |
| Data marketplace tidak masuk ERP otomatis | Penjual online-offline | Harian | 2–4 jam input manual/hari |
| Laporan pajak manual dan sering salah | Semua PKP | Bulanan | Denda, sanksi DJP, audit |

### 2.2 Pain Point Tier-2 — Growth Blocker

| Pain Point | Segmen Customer | Frekuensi | Dampak Finansial |
|---|---|---|---|
| Tidak ada kontrol budget per departemen | Perusahaan 20+ karyawan | Bulanan | Budget jebol tidak terdeteksi |
| Stok tidak sinkron lintas cabang | Retail chain, distributor | Harian | Overstock di A, stockout di B |
| Komisi sales dihitung manual | Perusahaan dengan tim sales | Bulanan | Error komisi, sales tidak percaya |
| Tidak ada sistem rekrutmen terintegrasi | Semua perusahaan berkembang | Per hiring cycle | Cost-per-hire tidak terukur |
| Aset tetap di spreadsheet, penyusutan manual | Perusahaan dengan mesin/kendaraan | Bulanan | Nilai buku salah, pajak salah |
| Tidak ada portal customer mandiri | Distributor B2B | Harian | CS overload, customer tidak puas |

### 2.3 Pain Point Tier-3 — Compliance & Long-term Risk

| Pain Point | Segmen Customer | Frekuensi | Dampak |
|---|---|---|---|
| Tidak ada laporan ESG/sustainability | Perusahaan IPO-ready, ekspor ke Eropa | Tahunan | Gagal tender, investor mundur |
| Tidak ada audit trail kuat | Perusahaan menengah ke atas | Per audit | Tidak lolos audit eksternal/investor |
| Tidak ada manajemen kontrak | Semua bisnis dengan kontrak | Per kontrak | Kontrak terlewat, kerugian legal |
| Tidak ada tracking karyawan lapangan | Jasa dengan teknisi lapangan | Harian | Produktivitas tidak terukur |

### 2.4 Pain Point Industri Spesifik (Vertical Gap)

| Industri | Pain Utama | Potensi Tenant |
|---|---|---|
| Klinik & Apotek | Tidak ada manajemen rekam medis + apotek terintegrasi | 40.000+ klinik Indonesia |
| Agribisnis | Tidak ada tracking musim, panen, dan biaya per lahan | 500.000+ petani komersial |
| Properti & Real Estate | Tidak ada manajemen unit, cicilan, dan komisi agen | 20.000+ agen properti |
| Hospitality (Hotel, F&B) | Tidak ada table management, room booking, kitchen order | 100.000+ usaha F&B |
| Retail Chain (Multi-toko) | Tidak ada konsolidasi lintas toko dalam satu dashboard | 50.000+ chain store |
| NGO & Lembaga Sosial | Tidak ada manajemen donasi, program, dan pelaporan donor | 10.000+ NGO aktif |

---

## 3. Business Type Baru (Modul Operasional Tambahan)

*Business Type adalah modul operasional yang mengisi pilar Operasional — hanya 1 yang aktif per waktu, swapable.*

### BT-01: Healthcare — Klinik & Apotek

**Target:** Klinik umum, klinik spesialis, apotek, rumah bersalin, klinik gigi  
**Prioritas:** 🔴 Tier-1

**Pain yang Diselesaikan:**
- Rekam medis masih di buku atau software terpisah
- Apotek tidak terintegrasi dengan resep dokter
- Tidak ada laporan utilisasi dokter dan kamar

**Fitur Utama:**
1. Rekam medis elektronik (EMR): anamnesis, diagnosis (ICD-10), tindakan, resep
2. Antrian digital pasien (queue management)
3. Integrasi apotek: resep → deduct stok obat otomatis
4. Manajemen jadwal dokter dan kamar periksa
5. BPJS claim preparation (kode Diagosis, Tindakan)
6. Laporan utilisasi: kunjungan per dokter, per poli, per periode
7. Billing pasien terintegrasi ke Finance Core
8. Pemisahan pasien umum vs BPJS

**CoA Injection:** Pendapatan Jasa Medis, Pendapatan Apotek, Persediaan Obat, Piutang BPJS  
**Dependencies:** Finance Core, Inventory Core (untuk stok obat)

---

### BT-02: Agribusiness — Pertanian & Perkebunan

**Target:** Petani komersial, perkebunan, koperasi tani, distributor hasil panen  
**Prioritas:** 🟠 Tier-2

**Pain yang Diselesaikan:**
- Biaya tanam per musim tidak terhitung dengan benar
- Tidak ada tracking hasil panen per lahan/blok
- Tidak ada analitik harga jual vs biaya produksi

**Fitur Utama:**
1. Manajemen lahan: nama, luas, lokasi, jenis tanaman
2. Siklus tanam: tanam → perawatan → panen
3. Biaya per tahap (pupuk, pestisida, tenaga kerja, irigasi)
4. Hasil panen recording dan grading kualitas
5. Kalkulasi HPP panen otomatis (biaya total ÷ hasil panen)
6. Harga jual vs HPP dashboard
7. Integrasi Purchasing untuk input produksi (benih, pupuk, dll)
8. Laporan per musim, per lahan, per komoditas

**CoA Injection:** Biaya Produksi Tanaman, Persediaan Hasil Panen, Pendapatan Penjualan Panen, Aset Lahan  
**Dependencies:** Finance Core, Inventory Core, Purchasing

---

### BT-03: Property & Real Estate

**Target:** Developer properti, agen properti, pengelola gedung/ruko/kos  
**Prioritas:** 🟠 Tier-2

**Pain yang Diselesaikan:**
- Unit properti tidak terlacak status (tersedia, terjual, sewa)
- Cicilan pembeli tidak termonitor
- Komisi agen tidak terhitung otomatis

**Fitur Utama:**
1. Properti register: proyek, gedung, unit, lantai, spesifikasi
2. Status unit: tersedia, booking, terjual, sewa aktif
3. Kontrak jual-beli dan sewa dengan timeline cicilan
4. AR cicilan otomatis: generate tagihan per termin
5. Komisi agen: otomatis hitung dari nilai transaksi
6. Handover management: checklist serah terima unit
7. Biaya perawatan gedung (maintenance cost per unit)
8. Laporan: occupancy rate, NPL, revenue per proyek

**CoA Injection:** Aset Properti (Persediaan Developer), Piutang KPR/Sewa, Pendapatan Properti, Komisi Agen  
**Dependencies:** Finance Core, CRM, Sales

---

### BT-04: Hospitality — Hotel, F&B & Restoran

**Target:** Hotel budget, restoran, kafe, catering, food court  
**Prioritas:** 🟠 Tier-2

**Pain yang Diselesaikan:**
- Table management restoran tidak ada
- Room booking manual dan sering double-booking
- Pengeluaran dapur tidak terhitung ke HPP

**Fitur Utama:**
1. **F&B:** Table management, menu dengan BoM (recipe costing), kitchen order display
2. **Hotel:** Room type, availability calendar, check-in/check-out, folio guest
3. Reservasi online terintegrasi (webhook dari Booking.com, Traveloka opsional)
4. Recipe costing: harga pokok per menu dari komposisi bahan
5. Waste tracking dapur
6. Shift kas: kasir buka-tutup shift dengan laporan per shift
7. Split bill, discount, dan room charge ke folio
8. Laporan: Revenue Per Available Room (RevPAR), food cost %, table turn

**CoA Injection:** Pendapatan Kamar, Pendapatan F&B, Persediaan Bahan Baku Dapur, Biaya Food & Beverage  
**Dependencies:** Finance Core, Inventory Core, POS Add-on

---

### BT-05: Retail Chain — Multi-Toko & Franchise

**Target:** Chain minimarket, toko pakaian, apotek chain, franchise F&B  
**Prioritas:** 🟠 Tier-2

**Pain yang Diselesaikan:**
- Tidak ada visibilitas stok real-time semua toko dalam satu dashboard
- Harga tidak bisa di-push terpusat ke semua outlet
- Laporan keuangan per toko vs konsolidasi tidak ada

**Fitur Utama:**
1. Multi-outlet dashboard: semua toko dalam satu layar
2. Centralized price management (ubah harga di pusat → semua outlet update)
3. Inter-store transfer: kirim stok dari gudang pusat ke toko
4. Store performance benchmark: revenue, margin, stock turn per toko
5. Royalty fee calculation (untuk model franchise)
6. Consolidated financial report: semua outlet dalam satu laporan keuangan
7. Standardized SOPs push (menu, promo, pricing rules)
8. Outlet compliance checklist

**CoA Injection:** Pendapatan per Outlet, HPP per Outlet, Royalti Waralaba  
**Dependencies:** Finance Core, Inventory Core, POS Add-on, Multi-Entity

---

### BT-06: NGO & Lembaga Sosial

**Target:** Yayasan, NGO, pesantren, lembaga zakat resmi, organisasi sosial  
**Prioritas:** 🟡 Tier-3

**Pain yang Diselesaikan:**
- Pencatatan donasi tidak terstruktur
- Tidak ada laporan pemanfaatan dana per program
- Tidak ada mekanisme pertanggungjawaban ke donor

**Fitur Utama:**
1. Donasi register: donatur, jumlah, jenis (tunai/non-tunai), program
2. Program management: alokasi dana per program, realisasi per periode
3. Restricted fund tracking (dana yang hanya boleh dipakai untuk tujuan tertentu)
4. Donor statement: laporan penggunaan dana ke donatur
5. Laporan keuangan PSAK 45 (Organisasi Nirlaba)
6. Zakat collection terintegrasi (extend modul Syirkah)
7. Wakaf asset management
8. Impact reporting untuk donor: penerima manfaat, capaian program

**CoA Injection:** Penerimaan Donasi, Dana Terikat, Dana Tidak Terikat, Beban Program  
**Dependencies:** Finance Core, Syirkah (untuk Zakat & Wakaf)

---

## 4. Modul Baru (Extension Pilar)

### 4.1 Treasury & Multi-Currency

**Klasifikasi:** Finance Core Extension  
**Prioritas:** 🔴 Tier-1

**Pain:** Bisnis ekspor/impor tidak bisa mencatat transaksi multi-mata uang; selisih kurs tidak terhitung.

**Fitur:**
1. Multi-currency ledger (USD, EUR, SGD, MYR, SAR, dll)
2. Automatic exchange rate fetching (Bank Indonesia, ECB, atau manual)
3. Realized & unrealized forex gain/loss otomatis
4. Currency revaluation akhir periode
5. Treasury dashboard: posisi kas semua rekening dalam semua mata uang
6. Cash pooling antar cabang/entitas
7. Bank reconciliation multi-bank dan multi-currency
8. Hedging record sederhana (forward contract, swap)

**Target Customer:** Eksportir, importir, bisnis dengan supplier/pelanggan asing  
**Estimasi Impact:** Membuka 500.000+ UKM eksportir Indonesia

---

### 4.2 Tax Compliance Engine

**Klasifikasi:** Compliance Module (Cross-cutting)  
**Prioritas:** 🔴 Tier-1

**Pain:** Pelaporan PPN manual, error-prone, tidak siap e-Faktur DJP.

**Fitur:**
1. PPN input/output tracking otomatis dari setiap transaksi Sales & Purchasing
2. e-Faktur generation (format XML DJP Indonesia — Faktur Pajak Masukan/Keluaran)
3. Rekap SPT Masa PPN otomatis (1111 A1, A2, B1, B2, B3)
4. PPh 21 calculation (terintegrasi HRIS/Payroll, formulir 1721-A1)
5. PPh 23 withholding tracking (jasa, bunga, dividen)
6. PPh 25/29 estimasi dan angsuran tracking
7. Tax calendar & deadline reminder
8. Tax audit trail report
9. Multi-jurisdiction ready: Malaysia GST, Singapore GST, Philippines VAT (future)

**Target Customer:** Semua PKP Indonesia (900.000+ entitas)

---

### 4.3 Budget & Cost Control

**Klasifikasi:** Finance Core Extension  
**Prioritas:** 🔴 Tier-1

**Pain:** Tidak ada kontrol budget departemen; PO tidak dicek terhadap anggaran.

**Fitur:**
1. Budget planning per departemen / cost center / proyek / periode
2. Budget vs actuals dashboard real-time
3. Purchase Order budget checking (warning atau block jika melebihi budget)
4. Rolling forecast (update proyeksi berdasarkan realisasi berjalan)
5. Budget approval workflow
6. Budget revision dengan audit trail
7. Multi-level budget: korporat → divisi → departemen → proyek
8. Variance analysis: explain gap realisasi vs anggaran per akun

**Target Customer:** Perusahaan 20+ karyawan, multi-divisi

---

### 4.4 Fixed Asset Management

**Klasifikasi:** Finance Core Extension  
**Prioritas:** 🟠 Tier-2

**Pain:** Aset tetap di spreadsheet, penyusutan manual dan tidak konsisten.

**Fitur:**
1. Asset register: kategori, lokasi, penanggung jawab, tanggal perolehan, nilai
2. Depreciation engine: garis lurus, saldo menurun, sum-of-years
3. Automatic depreciation journal posting (bulanan/tahunan)
4. Asset disposal & write-off workflow dengan jurnal otomatis
5. Asset transfer antar lokasi/divisi
6. Asset maintenance log
7. Asset revaluation (PSAK 16)
8. Laporan: NBV schedule, depreciation forecast, asset aging

---

### 4.5 Payables & Receivables Intelligence

**Klasifikasi:** Finance Core Extension  
**Prioritas:** 🔴 Tier-1

**Pain:** Tidak ada early warning cash crunch; tidak tahu kapan harus tagih atau bayar.

**Fitur:**
1. Aging AR/AP dengan alert otomatis (7, 14, 30, 60, 90+ hari)
2. Cash flow forecast 30/60/90 hari ke depan (berbasis AR/AP outstanding)
3. Automatic payment reminder ke customer via WhatsApp/Email
4. Supplier payment scheduling (prioritaskan berdasarkan diskon atau penalti)
5. Early payment discount management
6. DSO (Days Sales Outstanding) dan DPO (Days Payable Outstanding) analytics
7. Cashflow scenario planning: optimistic / base / pessimistic
8. Collection performance dashboard per sales rep

---

### 4.6 Subscription & Recurring Billing

**Klasifikasi:** Revenue Core Extension  
**Prioritas:** 🟠 Tier-2

**Pain:** Bisnis langganan buat invoice manual setiap bulan; tidak ada tracking churn.

**Fitur:**
1. Subscription plan management (bulanan, tahunan, custom)
2. Automatic invoice generation berdasarkan siklus billing
3. Trial management & conversion tracking
4. Dunning management: reminder sebelum/sesudah jatuh tempo
5. Proration billing: charge proporsional saat upgrade/downgrade
6. Deferred revenue recognition (PSAK 72)
7. Churn analysis dan cohort report
8. MRR/ARR dashboard

**Target Customer:** SaaS, media digital, rental berlangganan, lembaga pendidikan, membership

---

### 4.7 Commission & Incentive Management

**Klasifikasi:** Revenue Core Extension  
**Prioritas:** 🟠 Tier-2

**Pain:** Komisi sales dihitung manual dan sering salah; tidak ada transparansi.

**Fitur:**
1. Commission scheme builder: persentase dari revenue/profit, tiered, target-based
2. Real-time commission tracker per sales rep
3. Commission approval workflow sebelum dibayar
4. Integrasi Payroll: komisi dibayar via slip gaji
5. Multi-level commission: sales rep → supervisor → regional
6. Sales contest & leaderboard
7. Commission statement bulanan untuk tim sales

---

### 4.8 Supply Chain Planning

**Klasifikasi:** Vertical Module (Operations Intelligence)  
**Prioritas:** 🟠 Tier-2

**Pain:** Buyer tidak tahu kapan reorder; tidak ada demand forecasting berbasis data.

**Fitur:**
1. Reorder point automation berdasarkan lead time dan safety stock
2. Demand forecasting: moving average, trend, seasonal factor
3. Master Production Schedule (MPS) untuk manufacturer
4. Material Requirements Planning (MRP): terintegrasi BoM Manufacturing
5. Supplier lead time tracking historis
6. Purchase suggestion otomatis berdasarkan stok dan forecast
7. Supply chain risk dashboard: stockout risk, supplier dependency
8. What-if scenario planning

---

### 4.9 Customer Success & Portal

**Klasifikasi:** Vertical Module (Customer Experience)  
**Prioritas:** 🟠 Tier-2

**Pain:** Customer harus telepon CS untuk cek status order/invoice; CS overload.

**Fitur:**
1. Customer self-service portal: login sendiri, lihat order, invoice, pembayaran
2. Online payment link dari portal
3. Dispute & claim management
4. Customer support ticket terintegrasi operasional internal
5. Customer statement of account (SOA)
6. B2B order portal: customer input order sendiri
7. Customer satisfaction survey (CSAT/NPS) post-transaksi
8. Delivery tracking integration

---

### 4.10 Omnichannel Commerce

**Klasifikasi:** Vertical Module (Commerce)  
**Prioritas:** 🟠 Tier-2

**Pain:** Data penjualan Tokopedia/Shopee/Lazada tidak terintegrasi ke ERP; stok tidak sinkron.

**Fitur:**
1. Marketplace connector: Tokopedia, Shopee, Lazada, TikTok Shop, Blibli
2. Centralized order management dari semua channel
3. Real-time inventory sync lintas channel
4. Unified customer database lintas platform
5. Omnichannel fulfillment: pilih gudang terdekat, cross-docking
6. Return & refund management multi-channel
7. Channel performance analytics: margin per channel, sell-through rate
8. Centralized price management: push ke semua channel sekaligus

---

### 4.11 Talent Management

**Klasifikasi:** HRIS Core Extension  
**Prioritas:** 🟠 Tier-2

**Pain:** HRIS yang ada hanya cover payroll; rekrutmen, KPI, dan pengembangan SDM tidak ada.

**Fitur:**
1. Rekrutmen: job posting, pipeline kandidat, interview scheduling, offer letter
2. Onboarding checklist karyawan baru (dokumen, pelatihan, akses)
3. Performance review: KPI setting, mid-year review, annual appraisal
4. Competency mapping: kompetensi required vs aktual per posisi
5. Succession planning: identifikasi kandidat pengganti posisi kunci
6. Training need analysis (TNA) berdasarkan gap kompetensi
7. 360-degree feedback
8. Employee engagement survey

---

### 4.12 Field Service Management

**Klasifikasi:** Vertical Module (Operations)  
**Prioritas:** 🟠 Tier-2

**Pain:** Tidak ada sistem dispatching teknisi; laporan kerja lapangan manual.

**Fitur:**
1. Work order dispatching dari dashboard ke teknisi
2. Mobile check-in/check-out (teknisi konfirmasi via mobile)
3. GPS route optimization untuk perjalanan teknisi
4. Digital form lapangan: foto, tanda tangan, checklist kondisi
5. Spare part consumption dari lapangan (deduct stok otomatis)
6. SLA tracking: response time, resolution time
7. Customer sign-off digital setelah pekerjaan selesai
8. Field team performance dashboard

---

### 4.13 ESG & Sustainability Reporting

**Klasifikasi:** Compliance Module (Governance)  
**Prioritas:** 🟡 Tier-3 (tren naik cepat)

**Pain:** Tidak memenuhi persyaratan ESG dari investor asing; tidak ada tracking emisi karbon.

**Fitur:**
1. Carbon emission tracking (Scope 1, 2, 3) terintegrasi operasional
2. Energy consumption tracking per lokasi/divisi
3. Waste management log dan daur ulang
4. Social impact metrics: karyawan, gender diversity, K3 (keselamatan kerja)
5. ESG report builder: format GRI, SASB, TCFD, OJK POJK 51
6. Supplier ESG scoring
7. ESG target setting & progress tracking
8. ESG dashboard untuk direksi dan investor

---

### 4.14 Procurement Intelligence

**Klasifikasi:** Purchasing Extension  
**Prioritas:** 🟠 Tier-2

**Pain:** Proses RFQ manual; tidak ada perbandingan vendor otomatis; tidak ada kontrol harga.

**Fitur:**
1. RFQ (Request for Quotation) digital: kirim ke multiple supplier sekaligus
2. Vendor quote comparison otomatis (harga, lead time, syarat)
3. Approved vendor list (AVL) management
4. Vendor scorecard: rating pengiriman, kualitas, harga
5. Price benchmark: alert jika harga PO di luar range wajar
6. Procurement calendar: jadwal PO berulang otomatis
7. Spend analysis: breakdown pengeluaran per vendor, per kategori, per periode

---

### 4.15 Islamic Finance Extension (Syirkah+)

**Klasifikasi:** Syirkah Core Extension  
**Prioritas:** 🟠 Tier-2

**Pain:** Syirkah sudah ada, tapi produk keuangan syariah yang lebih luas belum tersedia.

**Fitur:**
1. **Murabahah:** pembiayaan jual-beli cicilan (fixed margin, bukan bunga)
2. **Ijarah:** akad sewa aset dengan opsi kepemilikan (IMBT)
3. **Salam:** akad pesanan barang di muka (agribusiness-friendly)
4. **Istishna:** akad pemesanan produk custom/manufaktur
5. **Qardh & Pinjaman Kebajikan:** pinjaman tanpa bunga
6. Sharia compliance checker: validasi transaksi vs prinsip syariah
7. Laporan Keuangan Syariah (PSAK 101-111)
8. Zakat korporasi calculator + integrasi ke jurnal otomatis

---

### 4.16 Multi-Entity Consolidation

**Klasifikasi:** Finance Core Extension (Enterprise)  
**Prioritas:** 🟠 Tier-2

**Pain:** Group usaha dengan beberapa PT tidak bisa konsolidasi laporan keuangan otomatis.

**Fitur:**
1. Entity hierarchy setup: induk → anak perusahaan
2. Intercompany transaction elimination otomatis
3. Konsolidasi laporan keuangan (PSAK 65)
4. Transfer pricing tracking antar entitas
5. Minority interest calculation
6. Laporan: Consolidated P&L, Consolidated Balance Sheet, Consolidated Cash Flow
7. Currency translation adjustment (untuk anak perusahaan beda negara)
8. Group-level budget dan forecast

---

## 5. Add-on Baru

### Kelompok A: Growth & Revenue Add-ons

#### A1. Payment Gateway Integration
**Prioritas:** 🔴 Tier-1

**Pain:** Invoice dikirim tapi customer tidak punya cara bayar mudah dan otomatis.

**Fitur:**
- Payment link terintegrasi di setiap invoice (Midtrans, Xendit, Doku)
- Auto-reconcile payment yang masuk ke sistem
- Virtual account per transaksi atau per customer
- QRIS payment support
- Payment success webhook → auto-close invoice
- Installment payment tracking

---

#### A2. WhatsApp Business Integration
**Prioritas:** 🔴 Tier-1 (Asia Tenggara-specific)

**Pain:** Customer Asia Tenggara mengharapkan komunikasi bisnis via WhatsApp.

**Fitur:**
- Send invoice, quotation, payment reminder via WA otomatis
- WhatsApp order bot: customer order via WA → masuk ke sistem
- Real-time delivery status update via WA
- Collection dunning via WA
- Two-way messaging log tersimpan di CRM
- Broadcast promo & notifikasi ke segmen customer

---

#### A3. Loyalty & Rewards Program
**Prioritas:** 🟡 Tier-3

**Fitur:**
- Points earning rules: per Rp X transaksi = Y points
- Points redemption di POS atau sales order
- Tier membership (Silver, Gold, Platinum) dengan benefit berbeda
- Birthday reward automation
- Referral program tracking
- Loyalty program analytics: churn rate, points liability, redemption rate
- Notifikasi points via WhatsApp

---

#### A4. E-Commerce Auto-Sync
**Prioritas:** 🟠 Tier-2

**Fitur:**
- Real-time sync order dari Tokopedia, Shopee, Lazada, TikTok Shop, Blibli
- Inventory level push ke semua marketplace
- Auto-create invoice dari marketplace order
- Return & refund sync
- Marketplace fee deduction otomatis dalam laporan profit
- Price sync terpusat ke semua platform

---

#### A5. Subscription Self-Management Portal
**Prioritas:** 🟠 Tier-2

**Fitur:**
- Customer kelola subscription sendiri (upgrade, downgrade, pause, cancel)
- Payment history dan invoice download
- Auto-billing notification 7 hari sebelum jatuh tempo
- Grace period & reactivation flow

---

### Kelompok B: AI & Productivity Add-ons

#### B1. AI Cashflow Advisor
**Prioritas:** 🟠 Tier-2

**Pain:** Owner tidak tahu apakah bisnis akan cukup kas 30–90 hari ke depan.

**Fitur:**
- AI cashflow forecast berbasis data historis + AR/AP outstanding
- What-if scenario modeling (tagih lebih cepat, pengeluaran besar)
- Rekomendasi tindakan: kapan tarik pinjaman, kapan invest idle cash
- Alert dini potensi cash crunch
- Natural language summary laporan arus kas ("bulan ini negatif karena...")
- Anomali detection: pengeluaran tidak biasa

---

#### B2. Smart Invoice OCR
**Prioritas:** 🟠 Tier-2

**Pain:** Input faktur pembelian dari supplier masih manual.

**Fitur:**
- Upload PDF/foto faktur → AI extract: vendor, tanggal, nomor, item, qty, harga, total
- Preview dan konfirmasi sebelum create purchase invoice
- Batch upload faktur
- Duplikasi detection
- Akurasi >95% dengan feedback loop (koreksi user melatih model)

---

#### B3. AI Purchase Assistant
**Prioritas:** 🟠 Tier-2

**Fitur:**
- Price benchmarking AI: bandingkan harga PO vs pasar
- Supplier recommendation berbasis histori harga, lead time, kualitas
- Anomali detection: PO harga di luar range normal (fraud prevention)
- Auto-fill PO dari email atau PDF supplier
- Reorder suggestion berbasis pola historis

---

#### B4. Advanced Analytics & BI
**Prioritas:** 🟠 Tier-2

**Fitur:**
- Custom dashboard builder (drag & drop widget)
- Cross-module analytics: gabung data sales + inventory + finance
- Cohort analysis customer
- Trend & seasonality analysis per produk/kategori
- Benchmark antar cabang / salesperson / produk
- Scheduled report: kirim PDF laporan otomatis via email/WA
- Data export ke Google Sheets / Power BI / Looker Studio

---

#### B5. AI Document Processor
**Prioritas:** 🟡 Tier-3

**Fitur:**
- Auto-classify dokumen yang diupload (faktur, kontrak, PO)
- Extract key fields dari dokumen legal (tanggal, pihak, nilai, jangka waktu)
- Contract expiry alert otomatis
- Duplicate detection di document repository

---

### Kelompok C: Governance & Compliance Add-ons

#### C1. Approval Workflow Engine
**Prioritas:** 🔴 Tier-1

**Pain:** Approval PO, reimbursement, cuti masih via WA Group — tidak terlacak.

**Fitur:**
- Visual workflow builder: define langkah, approver, kondisi
- Approval via email, WhatsApp, atau notifikasi in-app
- Delegation of authority ketika approver cuti
- Approval history dan audit trail lengkap
- Eskalasi otomatis jika melampaui SLA
- Multi-level: sequential atau parallel
- Conditional routing: nilai > Rp X → butuh approval direktur

---

#### C2. Contract Management
**Prioritas:** 🟡 Tier-3

**Fitur:**
- Contract repository dengan folder structure
- Key date tracking: start, end, renewal, review date
- Auto-reminder sebelum kontrak jatuh tempo (30, 14, 7 hari)
- Contract value tracking dan link ke PO/SO
- E-signature integration (built-in atau via Privy/PrivyID)
- Contract template library
- Vendor/customer contract scorecard

---

#### C3. Document Management System (DMS)
**Prioritas:** 🟡 Tier-3

**Fitur:**
- Centralized document repository
- Auto-attach dokumen ke transaksi (PO, invoice, proyek)
- Version control dokumen
- Full-text search di semua dokumen
- Document approval workflow
- Expiry tracking: sertifikat, izin, asuransi
- Secure sharing dengan link ber-expiry

---

#### C4. Internal Audit & Risk Management
**Prioritas:** 🟡 Tier-3

**Fitur:**
- Audit program management (perencanaan, pelaksanaan, temuan)
- Risk register: identifikasi, penilaian, mitigasi risiko bisnis
- Control testing workflow
- Audit finding tracking dan tindak lanjut
- Risk heat map visual
- Laporan audit untuk direksi dan komite audit
- Integration dengan Audit Trail yang sudah ada

---

### Kelompok D: Operational Advanced Add-ons

#### D1. Barcode & QR Inventory Scanner
**Prioritas:** 🟠 Tier-2

**Fitur:**
- Mobile barcode scanner (kamera HP jadi scanner, no hardware tambahan)
- QR code generation per produk/lokasi gudang
- Receiving goods via scan: update stok otomatis
- Stock opname via scan: bandingkan scan vs sistem
- Serial number & batch tracking via barcode/QR
- Label printing integration (thermal printer)
- Cycle count scheduling

---

#### D2. Route & Delivery Optimization
**Prioritas:** 🟡 Tier-3

**Fitur:**
- Daily delivery route planning otomatis berdasarkan alamat
- Vehicle load optimization
- Real-time driver tracking (GPS via mobile)
- Proof of delivery: foto + tanda tangan digital
- Delivery performance analytics: on-time rate, cost per km
- Customer ETA notification via WhatsApp
- Return pickup scheduling

---

#### D3. Predictive Maintenance
**Prioritas:** 🟡 Tier-3 (Future-Ready)

**Fitur:**
- Maintenance schedule otomatis berdasarkan jam operasional / kilometer
- IoT sensor integration (future: temperature, vibration, mileage)
- Predictive alert berdasarkan pattern breakdown historis
- Maintenance cost per aset per periode
- Spare part inventory integration: deduct stok saat maintenance
- Vendor maintenance scheduling
- MTTR (Mean Time To Repair) & MTBF analytics

---

### Kelompok E: Ecosystem & Integration Add-ons

#### E1. Vendor Portal
**Prioritas:** 🟡 Tier-3

**Fitur:**
- Supplier self-service: lihat dan konfirmasi PO online
- Supplier invoice submission digital
- Delivery schedule coordination
- Supplier rating & scorecard
- RFQ response online
- Supplier onboarding form digital
- Communication log terintegrasi CRM

---

#### E2. Open API & Webhook Hub
**Prioritas:** 🟠 Tier-2

**Fitur:**
- RESTful API documentation (OpenAPI 3.0)
- Webhook untuk semua event penting (order created, invoice paid, dll)
- API rate limiting & key management per tenant
- Webhook retry & delivery guarantee
- API usage analytics dashboard
- Sandbox environment untuk developer
- Integration templates: Zapier, n8n, Make.com

---

#### E3. HR Self-Service Mobile App
**Prioritas:** 🟠 Tier-2

**Fitur:**
- Mobile app (PWA atau native iOS/Android)
- Request cuti & approval via mobile
- Submit reimbursement dengan foto struk
- Lihat slip gaji dan histori payroll
- Absensi via GPS + foto selfie (anti-fraud)
- Pengumuman broadcast dari HRD
- Employee directory
- Learning module access (LMS lite)

---

#### E4. Digital Signature (e-Sign)
**Prioritas:** 🟠 Tier-2

**Fitur:**
- Tanda tangan digital untuk dokumen: kontrak, PO, invoice, perjanjian
- Multi-party signing dengan reminder otomatis
- Legal binding (integrasi Privy, PrivyID, atau BSrE)
- Audit trail: siapa tanda tangan, kapan, dari IP mana
- Template dokumen dengan placeholder otomatis
- Bulk send untuk banyak dokumen

---

#### E5. Training & Certification Marketplace
**Prioritas:** 🟠 Tier-2 (Strategic)

**Fitur:**
- Open marketplace: instruktur eksternal publish konten di NIZAM
- Revenue sharing model untuk instruktur
- Sertifikasi resmi NIZAM untuk implementor dan user
- Cohort-based learning
- Live session integration (Zoom/Google Meet in-app)
- Partner program: reseller dan implementor bersertifikat
- Leaderboard & gamification untuk learner

---

## 6. Matriks Prioritas Lengkap

### 6.1 Prioritas Berdasarkan Impact × Ease

| Item | Tipe | Impact | Ease | Score | Phase |
|---|---|---|---|---|---|
| Payment Gateway | Add-on | 10 | 8 | 80 | Phase 1 |
| Approval Workflow | Add-on | 9 | 7 | 63 | Phase 1 |
| Tax Compliance Engine | Module | 10 | 5 | 50 | Phase 1 |
| WhatsApp Integration | Add-on | 9 | 6 | 54 | Phase 1 |
| AR/AP Intelligence | Module | 9 | 6 | 54 | Phase 1 |
| Smart Invoice OCR | Add-on | 8 | 7 | 56 | Phase 2 |
| Multi-Currency | Module | 9 | 5 | 45 | Phase 2 |
| Budget & Cost Control | Module | 8 | 6 | 48 | Phase 2 |
| E-Commerce Auto-Sync | Add-on | 8 | 6 | 48 | Phase 2 |
| AI Purchase Assistant | Add-on | 7 | 6 | 42 | Phase 2 |
| Healthcare BT | Business Type | 9 | 4 | 36 | Phase 2 |
| Barcode Scanner | Add-on | 7 | 7 | 49 | Phase 2 |
| Commission Mgmt | Module | 7 | 6 | 42 | Phase 3 |
| Customer Portal | Module | 8 | 5 | 40 | Phase 3 |
| Omnichannel Commerce | Module | 8 | 4 | 32 | Phase 3 |
| Supply Chain Planning | Module | 7 | 4 | 28 | Phase 3 |
| Fixed Asset | Module | 7 | 5 | 35 | Phase 3 |
| Talent Management | Module | 7 | 5 | 35 | Phase 3 |
| HR Mobile App | Add-on | 7 | 5 | 35 | Phase 3 |
| Advanced BI | Add-on | 7 | 5 | 35 | Phase 3 |
| Property BT | Business Type | 8 | 4 | 32 | Phase 3 |
| Subscription Billing | Module | 7 | 5 | 35 | Phase 3 |
| Islamic Finance Ext | Module | 8 | 4 | 32 | Phase 3 |
| AI Cashflow Advisor | Add-on | 8 | 4 | 32 | Phase 3 |
| Hospitality BT | Business Type | 7 | 4 | 28 | Phase 4 |
| Agriculture BT | Business Type | 7 | 4 | 28 | Phase 4 |
| Retail Chain BT | Business Type | 7 | 4 | 28 | Phase 4 |
| ESG Reporting | Module | 6 | 4 | 24 | Phase 4 |
| Field Service Mgmt | Module | 6 | 4 | 24 | Phase 4 |
| Vendor Portal | Add-on | 6 | 5 | 30 | Phase 4 |
| Contract Management | Add-on | 6 | 5 | 30 | Phase 4 |
| DMS | Add-on | 5 | 5 | 25 | Phase 4 |
| Predictive Maintenance | Add-on | 5 | 3 | 15 | Phase 5 |
| Training Marketplace | Add-on | 7 | 4 | 28 | Phase 4 |
| Multi-Entity Consol. | Module | 7 | 3 | 21 | Phase 4 |
| NGO BT | Business Type | 5 | 4 | 20 | Phase 4 |

---

## 7. Roadmap Implementasi

### Phase 1 — Q3 2026: Quick Wins & Tier-1 Pain (3 bulan)

**Tema:** *Unblock Revenue & Compliance*

| Item | Estimasi Dev | Revenue Impact |
|---|---|---|
| Payment Gateway Integration | 3 minggu | Direct: semua tenant unblock tagihan digital |
| Approval Workflow Engine | 4 minggu | Upsell: +Rp 200K–500K/tenant/bulan |
| WhatsApp Business Integration | 3 minggu | Retention: -15% churn, +20% collection rate |
| Tax Compliance Engine (PPN) | 6 minggu | New segment: semua PKP yang belum pakai |
| AR/AP Intelligence (Cashflow Radar) | 3 minggu | Retention: pain universal UKM |

**Total estimasi:** 12 minggu paralel 2 tim (6 item prioritas)  
**Target outcome:** 3 modul/add-on baru live; membuka segmen PKP & bisnis dengan tim sales

---

### Phase 2 — Q4 2026: Growth & Vertical (3 bulan)

**Tema:** *Expand Revenue & New Verticals*

| Item | Estimasi Dev | Revenue Impact |
|---|---|---|
| Treasury & Multi-Currency | 5 minggu | Membuka segmen ekspor/impor |
| Budget & Cost Control | 4 minggu | Upsell ke perusahaan 20+ karyawan |
| Smart Invoice OCR (AI) | 3 minggu | Differentiator vs kompetitor |
| E-Commerce Auto-Sync | 4 minggu | Membuka 500rb+ penjual marketplace |
| AI Purchase Assistant | 3 minggu | Productivity win untuk buying team |
| Barcode & QR Scanner | 2 minggu | Quick win untuk warehouse-heavy bisnis |
| Healthcare Business Type | 6 minggu | Membuka 40.000+ klinik Indonesia |

---

### Phase 3 — Q1 2027: Scale & Ecosystem (3 bulan)

**Tema:** *Customer Retention & Ecosystem Depth*

| Item | Estimasi Dev |
|---|---|
| Commission & Incentive Management | 3 minggu |
| Customer Success & Portal | 5 minggu |
| Omnichannel Commerce | 6 minggu |
| Fixed Asset Management | 4 minggu |
| Talent Management (HRIS+) | 5 minggu |
| HR Self-Service Mobile App | 4 minggu |
| Advanced Analytics & BI | 5 minggu |
| Property Business Type | 5 minggu |
| Subscription & Recurring Billing | 4 minggu |
| Islamic Finance Extension | 4 minggu |
| AI Cashflow Advisor | 3 minggu |
| Digital Signature | 3 minggu |

---

### Phase 4 — Q2–Q3 2027: Enterprise & Global (6 bulan)

**Tema:** *Enterprise-Ready & Global Compliance*

| Item | Estimasi Dev |
|---|---|
| ESG & Sustainability Reporting | 6 minggu |
| Field Service Management | 5 minggu |
| Hospitality Business Type | 6 minggu |
| Agriculture Business Type | 5 minggu |
| Retail Chain Business Type | 5 minggu |
| Vendor Portal | 4 minggu |
| Contract Management | 3 minggu |
| Document Management System | 4 minggu |
| Internal Audit & Risk Mgmt | 5 minggu |
| Training & Certification Marketplace | 6 minggu |
| Multi-Entity Consolidation | 6 minggu |
| Supply Chain Planning (MRP) | 6 minggu |
| NGO & Lembaga Sosial BT | 4 minggu |
| Procurement Intelligence | 4 minggu |

---

### Phase 5 — Q4 2027+: Future & IoT

| Item | Keterangan |
|---|---|
| Predictive Maintenance (IoT) | Membutuhkan IoT sensor integration |
| Open Banking Integration | Setelah regulasi OJK matang |
| AI Financial Statement Auditor | LLM-powered review laporan keuangan |
| Multi-Country Tax (GST, VAT) | Untuk ekspansi regional Malaysia/PH |
| Blockchain-Based Audit Trail | Enterprise compliance differentiator |

---

## 8. Arsitektur Produk Final (Post-Roadmap)

```
NIZAM Platform
│
├── 🔧 Platform Core (always included)
│   ├── Auth & Tenancy (session cookie-based)
│   ├── Organization & Multi-Branch
│   ├── Roles & Permissions (RBAC)
│   ├── Marketplace & Setup Wizard
│   ├── API Hub & Webhooks
│   └── Billing & Support
│
├── 💰 PILAR FINANCE (selalu aktif)
│   ├── Akuntansi & Jurnal (PSAK)
│   ├── Kas & Keuangan
│   ├── Pembelian
│   ├── Inventori & Stok
│   ├── Gudang (WMS)
│   ├── Laporan & Insight
│   ├── Audit & Stock Opname
│   ├── [NEW] Treasury & Multi-Currency
│   ├── [NEW] Budget & Cost Control
│   ├── [NEW] Fixed Asset Management
│   ├── [NEW] Payables & Receivables Intelligence
│   └── [NEW] Multi-Entity Consolidation
│
├── 📈 PILAR MARKETING (selalu aktif)
│   ├── Penjualan
│   ├── Pelanggan (CRM)
│   ├── [NEW] Subscription & Recurring Billing
│   └── [NEW] Commission & Incentive Management
│
├── 🧑‍💼 PILAR HRIS (selalu aktif)
│   ├── HRIS & Payroll
│   └── [NEW] Talent Management
│
├── 🤝 PILAR SYIRKAH (selalu aktif)
│   ├── Syirkah (Bagi Hasil & Kemitraan)
│   └── [NEW] Islamic Finance Extension (Murabahah, Ijarah, dll)
│
├── ⚙️ PILAR OPERASIONAL — Business Type (pilih 1)
│   ├── Fleet & Rental [EXISTING]
│   ├── Manufacturing (BoM) [EXISTING]
│   ├── Workshop & Service [EXISTING]
│   ├── Job Order [EXISTING]
│   ├── Project & Construction [EXISTING]
│   ├── LMS (Lembaga Pelatihan) [EXISTING]
│   ├── [NEW BT] Healthcare — Klinik & Apotek
│   ├── [NEW BT] Agribusiness — Pertanian & Perkebunan
│   ├── [NEW BT] Property & Real Estate
│   ├── [NEW BT] Hospitality — Hotel, F&B & Restoran
│   ├── [NEW BT] Retail Chain — Multi-Toko & Franchise
│   └── [NEW BT] NGO & Lembaga Sosial
│
├── 🔧 Compliance Modules
│   ├── [NEW] Tax Compliance Engine (PPN, PPh, e-Faktur)
│   └── [NEW] ESG & Sustainability Reporting
│
├── 🌐 Vertical Modules
│   ├── [NEW] Omnichannel Commerce
│   ├── [NEW] Customer Success & Portal
│   ├── [NEW] Supply Chain Planning (MRP)
│   ├── [NEW] Field Service Management
│   └── [NEW] Procurement Intelligence
│
├── 💡 Growth Add-ons
│   ├── POS (Kasir) [EXISTING]
│   ├── Sales Page [EXISTING]
│   ├── [NEW] Payment Gateway Integration
│   ├── [NEW] WhatsApp Business Integration
│   ├── [NEW] E-Commerce Auto-Sync
│   ├── [NEW] Loyalty & Rewards Program
│   └── [NEW] Subscription Self-Management Portal
│
├── 🤖 AI & Productivity Add-ons
│   ├── [NEW] AI Cashflow Advisor
│   ├── [NEW] Smart Invoice OCR
│   ├── [NEW] AI Purchase Assistant
│   ├── [NEW] Advanced Analytics & BI
│   └── [NEW] AI Document Processor
│
├── 🏛️ Governance Add-ons
│   ├── [NEW] Approval Workflow Engine
│   ├── [NEW] Contract Management
│   ├── [NEW] Document Management System
│   ├── [NEW] Internal Audit & Risk Management
│   └── [NEW] Digital Signature (e-Sign)
│
├── 🚀 Advanced Ops Add-ons
│   ├── [NEW] Barcode & QR Inventory Scanner
│   ├── [NEW] Route & Delivery Optimization
│   └── [NEW] Predictive Maintenance (IoT-Ready)
│
└── 🌍 Ecosystem & Integration Add-ons
    ├── [NEW] Open API & Webhook Hub
    ├── [NEW] Vendor Portal
    ├── [NEW] HR Self-Service Mobile App
    └── [NEW] Training & Certification Marketplace
```

---

## 9. Segmentasi Customer & Paket Rekomendasi

### Paket 1: NIZAM Starter — Usaha Kecil & Retail (< Rp 5M/bulan)

**Core:** Finance Core + Revenue Core + Inventory Core  
**Add-on Recommended:** POS, Payment Gateway, WhatsApp Integration  
**Pain Solved:** Tidak ada catatan penjualan rapi; invoice manual; tidak bisa terima bayar digital  
**Price Range:** Rp 500K–1,5M/bulan

---

### Paket 2: NIZAM Business — UKM Berkembang (Rp 5M–500M/bulan)

**Core:** Semua 5 Pilar + 1 Business Type  
**Compliance:** Tax Compliance Engine  
**Add-on Recommended:** Approval Workflow, Smart Invoice OCR, Advanced BI, Barcode Scanner  
**Pain Solved:** Kontrol pengeluaran tidak ada; laporan untuk keputusan tidak ada; audit manual  
**Price Range:** Rp 2M–10M/bulan

---

### Paket 3: NIZAM Enterprise — Perusahaan Menengah (> Rp 500M/bulan)

**Core:** Semua 5 Pilar + Business Type + Treasury & Multi-Currency + Budget Control + Fixed Asset  
**Compliance:** Tax Compliance + ESG Reporting  
**Add-on:** Multi-Entity, Contract Management, DMS, Approval Workflow, Vendor Portal, Open API  
**Pain Solved:** Tidak siap audit eksternal; budget jebol; tidak ada cashflow forecast  
**Price Range:** Rp 15M–100M/bulan

---

### Paket 4: NIZAM Commerce — E-Commerce & Omnichannel

**Core:** Finance + Revenue + Inventory + Omnichannel Commerce  
**Add-on:** E-Commerce Auto-Sync, POS, Payment Gateway, Loyalty Program, WhatsApp Integration  
**Pain Solved:** Data marketplace tidak terintegrasi; stok online-offline tidak sinkron  
**Price Range:** Rp 3M–15M/bulan

---

### Paket 5: NIZAM Syariah — Bisnis & Keuangan Islam

**Core:** Semua 5 Pilar (dengan Syirkah full-feature) + Islamic Finance Extension  
**Business Type:** Sesuai industri  
**Compliance:** Tax Compliance  
**Pain Solved:** Tidak ada ERP syariah komprehensif di pasar; Syirkah, zakat, murabahah  
**Price Range:** Rp 2M–20M/bulan

---

### Paket 6: NIZAM Health — Klinik & Apotek

**Core:** Finance + Revenue + Healthcare Business Type  
**Add-on:** Payment Gateway, WhatsApp Integration, Barcode Scanner (untuk stok obat)  
**Pain Solved:** EMR dan apotek tidak terintegrasi; billing BPJS manual  
**Price Range:** Rp 1,5M–8M/bulan

---

## 10. Analisis Kompetitif

### NIZAM vs SAP / Oracle (Enterprise ERP)

| Dimensi | SAP/Oracle | NIZAM |
|---|---|---|
| Time-to-value | 6–24 bulan | 2–8 minggu |
| Total cost (TCO) | Rp 500M–5M/tahun | Rp 6M–120M/tahun |
| Kemudahan implementasi | Butuh konsultan mahal | Self-service + Academy |
| Syariah native | Tidak ada | ✅ Native Syirkah + Islamic Finance |
| Lokal compliance (DJP, BI) | Custom mahal | ✅ Built-in |
| Vertical healthcare/agri | Sangat mahal di-custom | ✅ Modular, terjangkau |

---

### NIZAM vs Accurate / Jurnal (Akuntansi SaaS Lokal)

| Dimensi | Accurate/Jurnal | NIZAM |
|---|---|---|
| Scope | Akuntansi + Sales dasar | Full ERP platform end-to-end |
| Vertical operations | Tidak ada | ✅ 12 Business Type |
| AI capabilities | Minimal | ✅ OCR, Advisor, Purchase AI |
| Syariah | Tidak ada | ✅ Native |
| Multi-entity | Tidak | ✅ Add-on |
| Academy/LMS built-in | Tidak | ✅ Modul strategis |

---

### NIZAM vs Odoo (Open-Source ERP)

| Dimensi | Odoo | NIZAM |
|---|---|---|
| Customization | Tinggi tapi butuh developer | Modular add-on, no-code setup |
| TCO | Tinggi karena implementasi | Lebih predictable |
| Syariah & lokal | Komunitas, bukan native | ✅ Native |
| Academy built-in | Tidak ada | ✅ Modul strategis + marketplace |
| Support Indonesia | Tidak native | ✅ Native, termasuk DJP & BI |
| Setup wizard / marketplace | Tidak | ✅ Marketplace dengan onboarding steps |

---

## 11. Estimasi Potensi Revenue per Kategori

*(Estimasi ilustratif berbasis market sizing Indonesia 2026)*

| Kategori | TAM Indonesia | NIZAM Realistic Share (3 tahun) | Revenue Potential |
|---|---|---|---|
| Core ERP UKM | 2 juta UKM besar layak | 50.000 tenant × Rp 3M/bulan | Rp 150M/bulan |
| Tax Compliance Add-on | 900.000 PKP | 50.000 × Rp 500K/bulan | Rp 25M/bulan |
| Healthcare Vertical | 40.000 klinik | 5.000 × Rp 3M/bulan | Rp 15M/bulan |
| Omnichannel Commerce | 500.000 penjual online | 20.000 × Rp 2M/bulan | Rp 40M/bulan |
| HRIS + Payroll per karyawan | 5 juta karyawan di UKM | 200K × Rp 200K/bulan | Rp 40M/bulan |
| Manufacturing Vertical | 30.000 pabrik menengah | 3.000 × Rp 10M/bulan | Rp 30M/bulan |
| ESG Reporting | 5.000 perusahaan enterprise | 500 × Rp 10M/bulan | Rp 5M/bulan |
| Training & Certification | Semua tenant + partner | 10.000 seat × Rp 500K | Rp 5M/bulan |
| **Total Potential (3 tahun)** | | | **~Rp 310M+/bulan** |

---

## 12. Prinsip Desain Produk

Setiap modul dan add-on baru harus mengikuti prinsip berikut:

1. **Zero-friction setup** — setiap modul baru punya Onboarding Steps terstruktur di Marketplace; customer bisa aktifkan dan setup sendiri dalam <30 menit
2. **Modular & non-breaking** — modul baru tidak boleh merusak fungsi modul lain; gunakan feature flag dan entitlement system yang sudah ada
3. **Accounting-first** — setiap transaksi operasional harus menghasilkan jurnal otomatis yang benar; tidak boleh ada data yang "orphan" dari akuntansi
4. **CoA injection pattern** — modul dengan akun baru wajib punya `coaInjectionFn` yang meng-inject akun default ke Chart of Accounts tenant
5. **Mobile-responsive** — semua UI harus usable di layar HP; terutama modul operasional yang dipakai di lapangan
6. **Role-aware** — setiap halaman dan action harus mengecek entitlement dan role; gunakan RBAC yang sudah ada
7. **AI-ready** — data structure harus memungkinkan AI/ML layer di masa depan (structured data, clean schema, proper timestamps)
8. **Sharia-compatible** — modul keuangan baru harus bisa di-configure agar compliant dengan prinsip syariah (non-interest, halal transaction)

---

## 13. Tiga Rekomendasi Prioritas Tertinggi

### #1 — Tax Compliance Engine (e-Faktur & PPN)
**Alasan:** Compliance obligation yang wajib. Setiap PKP butuh ini. Immediate upsell opportunity ke 100% customer existing. Risiko kehilangan customer ke kompetitor yang sudah punya fitur ini sangat tinggi.

### #2 — Payment Gateway Integration
**Alasan:** Langsung unblock revenue collection. Setiap invoice yang terkirim sekarang butuh ini. ROI paling cepat terasa — customer bayar lebih cepat = cashflow NIZAM customer membaik = kepuasan meningkat.

### #3 — Approval Workflow Engine
**Alasan:** Pain paling universal lintas semua segmen. Setiap perusahaan dengan lebih dari 3 orang punya masalah approval. Cross-module impact: PO, reimbursement, cuti, sales order — semuanya butuh approval workflow.

---

## 14. Tiga Differensiator Strategis yang Harus Dijaga

1. **Syirkah Native** — Tidak ada ERP lain yang punya ini secara native dan komprehensif. Perluas dengan Islamic Finance Extension untuk menjadi satu-satunya platform ERP syariah full-stack di Indonesia.

2. **Academy/LMS Built-in** — Jadikan moat utama. Bangun Training & Certification Marketplace agar NIZAM bukan hanya platform, tapi ekosistem belajar bisnis digital. Network effect antara user, instruktur, dan implementor.

3. **Local Compliance Native** — DJP (e-Faktur, SPT), Bank Indonesia regulation, PSAK accounting standards — keunggulan yang tidak mudah ditiru ERP global. Harus terus diinvestasikan sebelum kompetitor asing masuk.

---

*Dokumen ini adalah versi 2.0, diperbarui pada 18 Mei 2026, berdasarkan analisis mendalam terhadap branch `feat_multi` (commit terbaru: `721fc78`) dan arsitektur produk NIZAM yang sudah berjalan. Versi sebelumnya: v1.0 (16 Mei 2026).*

*Untuk setiap modul yang akan diimplementasikan: Product Discovery → Architecture Review → Database Schema Design → API Design → UI/UX Prototype → Development → QA → Staged Rollout → Release.*
