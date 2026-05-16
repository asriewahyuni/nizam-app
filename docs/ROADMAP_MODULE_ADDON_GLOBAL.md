# NIZAM Platform — Roadmap Modul & Add-on Global
## Dokumen Perencanaan Produk: Menyelesaikan Pain Customer Secara Global

**Versi:** 1.0  
**Tanggal:** 16 Mei 2026  
**Branch Sumber Analisis:** `feat_multi`  
**Tujuan:** Memetakan modul dan add-on baru yang relevan secara global untuk menyelesaikan pain point customer nyata di berbagai industri dan geografi.

---

## 1. Ringkasan Eksekutif

NIZAM saat ini telah memiliki fondasi arsitektur 5 pilar yang solid:
- **Finance Core** — kontrol keuangan
- **Revenue Core** — pipeline penjualan
- **Purchasing** — pengadaan
- **Inventory Core** — stok dan produk
- **HRIS Core** — SDM dan penggajian

Ditambah 5 **Vertical Module** (Manufacturing, Fleet & Rental, Service Operations, Project & Construction, Syirkah) dan **Academy/EDU** sebagai modul strategis.

**Gap utama yang ditemukan:** NIZAM belum menjangkau pain point customer di area:
1. Compliance & regulasi lintas negara
2. Supply chain visibility end-to-end
3. Customer experience post-sales
4. AI-native operations
5. ESG & keberlanjutan bisnis
6. Treasury & cash management lanjutan
7. Marketplace & omnichannel commerce

Dokumen ini memetakan **12 modul baru** dan **18 add-on baru** yang secara strategis menyelesaikan pain nyata customer global, disusun berdasarkan urgensi dan potensi revenue.

---

## 2. Konteks Pain Point Customer Global

### 2.1 Pain Point Tier-1 (Urgensi Tinggi — Kehilangan Revenue)

| Pain Point | Segmen Customer | Dampak Bisnis |
|---|---|---|
| Tidak bisa kelola multi-mata uang | Eksportir, importer, bisnis dengan supplier/customer asing | Selisih kurs tidak tercatat, rugi tersembunyi |
| Tidak ada visibilitas stok real-time lintas cabang | Retail chain, distributor, F&B franchise | Overstock di satu lokasi, stockout di tempat lain |
| Proses approval manual dan lambat | Perusahaan dengan hierarki purchase, proyek, atau reimbursement | Bottleneck operasional, human error, fraud |
| Tidak ada portal customer mandiri | B2B, distributor, jasa berlangganan | CS overload, customer tidak puas, churn |
| Tidak bisa track performa sales per wilayah/agen | Bisnis dengan channel distribusi | Komisi tidak akurat, performa opaque |

### 2.2 Pain Point Tier-2 (Growth Blocker)

| Pain Point | Segmen Customer | Dampak Bisnis |
|---|---|---|
| Tidak bisa otomasi tagihan recurring | SaaS, rental, langganan, leasing | Revenue leakage, manual billing overhead |
| Tidak ada analitik prediktif stok | Distributor, manufacturer | Overpurchase atau stockout berkala |
| Tidak bisa kelola aset tetap dengan benar | Perusahaan dengan banyak fixed asset | Nilai aset salah, depreciation manual |
| Tidak ada integrasi e-commerce/marketplace | Retail dengan channel online | Data penjualan manual, duplikasi kerja |
| Tidak ada kontrol budget departemen | Perusahaan dengan banyak cost center | Budget jebol tidak terdeteksi dini |

### 2.3 Pain Point Tier-3 (Compliance & Governance)

| Pain Point | Segmen Customer | Dampak Bisnis |
|---|---|---|
| Tidak siap laporan pajak otomatis | Semua segmen | Risiko denda, audit, dan reputasi |
| Tidak ada audit trail yang kuat | Perusahaan menengah ke atas | Tidak bisa diaudit eksternal |
| Tidak ada kontrol akses berbasis departemen | Multi-divisi, multi-cabang | Data sensitif bocor antar departemen |
| Tidak siap laporan ESG/sustainability | Perusahaan yang IPO-ready atau bermitra dengan asing | Tidak memenuhi syarat tender atau investor |

---

## 3. Modul Baru yang Direkomendasikan

### 3.1 MODUL BARU: Treasury & Multi-Currency

**Klasifikasi:** Core Family Extension (Finance Core)  
**Prioritas:** 🔴 Tier-1 — Urgensi Tinggi

**Pain yang Diselesaikan:**
- Bisnis ekspor/impor tidak bisa mencatat transaksi multi-mata uang dengan benar
- Selisih kurs tidak terhitung dalam laporan keuangan
- Tidak ada cash pooling untuk group usaha

**Apa yang Ada dalam Modul Ini:**
1. Multi-currency ledger (pencatatan transaksi dalam mata uang asing)
2. Automatic exchange rate fetching (dari API Bank Indonesia / ECB / Wise)
3. Realized & unrealized forex gain/loss otomatis
4. Currency revaluation akhir periode
5. Cash pooling antar cabang/entitas
6. Treasury dashboard — posisi kas semua rekening dalam satu tampilan
7. Bank reconciliation multi-bank
8. Hedging record (pencatatan lindung nilai sederhana)

**Target Customer:** Eksportir, importir, bisnis dengan supplier/pelanggan asing, grup usaha multi-entitas

**Dependencies:** Finance Core, Accounting

**Estimasi Impact:** Membuka segmen eksportir/importir — pasar UKM ekspor Indonesia saja >500.000 entitas

---

### 3.2 MODUL BARU: Budget & Cost Control

**Klasifikasi:** Core Family Extension (Finance Core)  
**Prioritas:** 🔴 Tier-1 — Urgensi Tinggi

**Pain yang Diselesaikan:**
- Tidak ada kontrol budget departemen/divisi/proyek
- Owner tidak tahu mana departemen yang melebihi budget
- Purchase order tidak dicek terhadap budget yang tersedia

**Apa yang Ada dalam Modul Ini:**
1. Budget planning per departemen / cost center / proyek / periode
2. Budget vs actuals dashboard real-time
3. Purchase order budget checking (warning/block jika melebihi budget)
4. Expense budget utilization report
5. Rolling forecast (update proyeksi berdasarkan realisasi berjalan)
6. Budget approval workflow
7. Budget revision dengan audit trail
8. Multi-level budget: korporat → divisi → departemen

**Target Customer:** Perusahaan dengan 20+ karyawan, multi-divisi, multi-cabang, atau proyek skala menengah

**Dependencies:** Finance Core, Purchasing, Accounting

---

### 3.3 MODUL BARU: Fixed Asset Management

**Klasifikasi:** Core Family Extension (Finance Core)  
**Prioritas:** 🟠 Tier-2 — Growth Blocker

**Pain yang Diselesaikan:**
- Aset tetap dicatat manual di spreadsheet
- Penyusutan salah atau tidak konsisten
- Tidak ada tracking lokasi dan kondisi aset

**Apa yang Ada dalam Modul Ini:**
1. Asset register dengan kategori, lokasi, dan penanggung jawab
2. Depreciation engine: straight-line, declining balance, sum-of-years
3. Automatic depreciation journal posting
4. Asset disposal & write-off workflow
5. Asset transfer (pindah lokasi/divisi)
6. Asset maintenance log (integrasi Fleet Maintenance Pack)
7. Revaluation aset
8. Laporan: NBV, depreciation schedule, asset aging

**Target Customer:** Perusahaan dengan banyak kendaraan, mesin, properti, atau peralatan IT

**Dependencies:** Finance Core, Accounting

---

### 3.4 MODUL BARU: Tax Compliance Engine

**Klasifikasi:** Vertical Module (Compliance)  
**Prioritas:** 🔴 Tier-1 — Urgensi Tinggi

**Pain yang Diselesaikan:**
- Pelaporan PPN manual dan error-prone
- Tidak ada rekap faktur pajak otomatis
- Tidak siap e-Faktur atau integrasi DJP

**Apa yang Ada dalam Modul Ini:**
1. PPN input/output tracking otomatis dari setiap transaksi
2. e-Faktur generation (format XML DJP Indonesia)
3. Rekap SPT Masa PPN otomatis
4. PPh 21 calculation (terintegrasi HRIS/Payroll)
5. PPh 23 withholding tracking
6. Tax calendar & deadline reminder
7. Tax audit trail report
8. Multi-tax jurisdiction (untuk ekspansi regional: Malaysia GST, Singapore GST, dsb.)

**Target Customer:** Semua PKP (Pengusaha Kena Pajak), perusahaan dengan karyawan tetap

**Dependencies:** Finance Core, Sales, Purchasing, HRIS Core

---

### 3.5 MODUL BARU: Subscription & Recurring Billing

**Klasifikasi:** Vertical Module (Revenue)  
**Prioritas:** 🟠 Tier-2 — Growth Blocker

**Pain yang Diselesaikan:**
- Bisnis langganan harus buat invoice manual setiap bulan
- Tidak ada tracking trial, renewal, churn
- Revenue recognition tidak akurat untuk bisnis berlangganan

**Apa yang Ada dalam Modul Ini:**
1. Subscription plan management (bulanan, tahunan, custom)
2. Automatic invoice generation berdasarkan siklus billing
3. Trial management & conversion tracking
4. Dunning management (reminder sebelum/sesudah jatuh tempo)
5. Proration billing (charge proporsional saat upgrade/downgrade)
6. Deferred revenue recognition
7. Churn analysis dan cohort report
8. MRR/ARR dashboard

**Target Customer:** SaaS, media digital, rental berlangganan, lembaga pendidikan, layanan membership

**Dependencies:** Revenue Core, Finance Core

---

### 3.6 MODUL BARU: Omnichannel Commerce

**Klasifikasi:** Vertical Module (Commerce)  
**Prioritas:** 🟠 Tier-2 — Growth Blocker

**Pain yang Diselesaikan:**
- Data penjualan online (Tokopedia, Shopee, Lazada) tidak terintegrasi ke ERP
- Stok tidak sinkron antara online dan offline
- Tidak bisa kelola banyak channel dalam satu dasbor

**Apa yang Ada dalam Modul Ini:**
1. Marketplace connector: Tokopedia, Shopee, Lazada, TikTok Shop
2. Centralized order management dari semua channel
3. Real-time inventory sync lintas channel
4. Unified customer database (customer yang sama di berbagai platform)
5. Omnichannel fulfillment: pilih gudang terdekat, cross-docking
6. Return & refund management multi-channel
7. Channel performance analytics (margin per channel, sell-through rate)
8. Price management terpusat (satu harga bisa di-push ke semua channel)

**Target Customer:** Retail online-offline, brand D2C, distributor yang jualan di marketplace

**Dependencies:** Inventory Core, Revenue Core, Sales

---

### 3.7 MODUL BARU: Customer Success & Portal

**Klasifikasi:** Vertical Module (Customer Experience)  
**Prioritas:** 🟠 Tier-2 — Growth Blocker

**Pain yang Diselesaikan:**
- Customer harus telepon/WA untuk cek status order atau invoice
- Tim CS overload dengan pertanyaan repetitif
- Tidak ada portal mandiri untuk customer B2B

**Apa yang Ada dalam Modul Ini:**
1. Customer self-service portal (login sendiri, lihat status order, invoice, pembayaran)
2. Online payment link dari portal
3. Dispute & claim management
4. Customer support ticket (terintegrasi operasional internal)
5. Customer statement of account (SOA)
6. Delivery tracking integration
7. Customer satisfaction survey (CSAT/NPS) post-transaksi
8. B2B order portal (customer bisa input order sendiri)

**Target Customer:** Distributor B2B, jasa berlangganan, bisnis dengan volume transaksi tinggi

**Dependencies:** Revenue Core, Finance Core, CRM

---

### 3.8 MODUL BARU: Supply Chain Planning (SCP)

**Klasifikasi:** Vertical Module (Operations)  
**Prioritas:** 🟠 Tier-2

**Pain yang Diselesaikan:**
- Buyer tidak tahu kapan harus reorder
- Tidak ada demand forecasting berbasis data historis
- Lead time supplier tidak diperhitungkan dalam planning

**Apa yang Ada dalam Modul Ini:**
1. Reorder point automation berdasarkan lead time dan safety stock
2. Demand forecasting (berbasis moving average, trend, dan seasonal factor)
3. Master Production Schedule (MPS) untuk manufacturer
4. Material Requirements Planning (MRP) — terintegrasi BoM Manufacturing
5. Supplier lead time tracking
6. Purchase suggestion otomatis berdasarkan stok dan forecast
7. Supply chain risk dashboard (supplier dependency, stockout risk)
8. What-if scenario planning

**Target Customer:** Manufacturer, distributor dengan volume besar, bisnis musiman

**Dependencies:** Inventory Core, Purchasing, Manufacturing (untuk MRP)

---

### 3.9 MODUL BARU: Field Service Management

**Klasifikasi:** Vertical Module (Operations)  
**Prioritas:** 🟡 Tier-3

**Pain yang Diselesaikan:**
- Tidak ada sistem dispatching teknisi/tenaga lapangan
- Laporan pekerjaan lapangan manual
- Tidak bisa track lokasi dan produktivitas tim lapangan

**Apa yang Ada dalam Modul Ini:**
1. Work order dispatching (assign teknisi ke job dari dashboard)
2. Mobile check-in/check-out (teknisi konfirmasi via mobile)
3. GPS route optimization
4. Digital form lapangan (foto, tanda tangan, checklist)
5. Spare part consumption dari lapangan (deduct stok otomatis)
6. SLA tracking (response time, resolution time)
7. Customer sign-off digital
8. Field team performance dashboard

**Target Customer:** Bengkel, servis AC/elektronik, kontraktor, utility company, jasa instalasi

**Dependencies:** Service Operations, Inventory Core, HRIS Core

---

### 3.10 MODUL BARU: Payables & Receivables Intelligence

**Klasifikasi:** Core Family Extension (Finance Core)  
**Prioritas:** 🔴 Tier-1

**Pain yang Diselesaikan:**
- Tidak ada early warning untuk cash crunch
- Tidak tahu kapan harus tagih dan kapan harus bayar
- Tidak ada forecast arus kas

**Apa yang Ada dalam Modul Ini:**
1. Aging AR/AP dengan alert otomatis
2. Cash flow forecast 30/60/90 hari ke depan (berbasis AR/AP outstanding)
3. Automatic payment reminder ke customer via WhatsApp/Email
4. Supplier payment scheduling (prioritaskan berdasarkan diskon atau penalti)
5. Early payment discount management
6. Factoring / invoice financing readiness report
7. DSO (Days Sales Outstanding) dan DPO (Days Payable Outstanding) analytics
8. Cashflow scenario: optimistic, base, pessimistic

**Target Customer:** Semua bisnis B2B dengan piutang signifikan, distributor, kontraktor

**Dependencies:** Finance Core, Revenue Core, Purchasing

---

### 3.11 MODUL BARU: ESG & Sustainability Reporting

**Klasifikasi:** Vertical Module (Governance & Compliance)  
**Prioritas:** 🟡 Tier-3 (Tren Global Naik Cepat)

**Pain yang Diselesaikan:**
- Perusahaan tidak bisa memenuhi persyaratan ESG dari investor atau mitra asing
- Tidak ada tracking emisi karbon atau konsumsi energi
- Tidak ada laporan keberlanjutan standar global

**Apa yang Ada dalam Modul Ini:**
1. Carbon emission tracking (Scope 1, 2, 3 — terintegrasi operasional)
2. Energy consumption tracking per lokasi/divisi
3. Waste management log
4. Social impact metrics (karyawan, gender diversity, K3)
5. ESG report builder (format GRI, SASB, TCFD)
6. Supplier ESG scoring
7. ESG target setting & progress tracking
8. ESG dashboard untuk direksi dan investor

**Target Customer:** Perusahaan yang IPO-ready, bermitra dengan MNC, eksportir ke Eropa/Jepang, penerima hibah

**Dependencies:** Finance Core, HRIS Core, Purchasing, Fleet & Rental

---

### 3.12 MODUL BARU: Commission & Incentive Management

**Klasifikasi:** Core Family Extension (Revenue Core)  
**Prioritas:** 🟠 Tier-2

**Pain yang Diselesaikan:**
- Perhitungan komisi sales manual dan sering salah
- Tidak ada transparansi komisi untuk tim sales
- Insentif tidak terhubung dengan data transaksi aktual

**Apa yang Ada dalam Modul Ini:**
1. Commission scheme builder (persentase dari revenue/profit, tiered, target-based)
2. Real-time commission tracker untuk setiap sales rep
3. Commission approval workflow sebelum dibayar
4. Komisi terintegrasi payroll (bayar via slip gaji)
5. Multi-level commission (sales rep → supervisor → regional manager)
6. Bonus & incentive campaign management
7. Commission statement bulanan untuk sales team
8. Sales contest & leaderboard

**Target Customer:** Perusahaan dengan tim sales, multi-level distributor, agency, broker properti

**Dependencies:** Revenue Core, HRIS Core, Finance Core

---

## 4. Add-on Baru yang Direkomendasikan

### 4.1 AI Purchase Assistant

**Klasifikasi:** Growth Add-on  
**Prioritas:** 🔴 Tier-1

**Pain:** Buyer tidak tahu harga wajar, tidak ada rekomendasi supplier terbaik.

**Fitur:**
- AI-powered price benchmarking (bandingkan harga pembelian vs pasar)
- Supplier recommendation berdasarkan harga, lead time, dan histori
- Anomali detection: PO dengan harga di luar range normal (fraud prevention)
- Auto-fill purchase order dari email atau dokumen PDF supplier
- Smart reorder suggestion berbasis pattern historis

**Dependencies:** Purchasing, Inventory Core, AI/LLM backend

---

### 4.2 WhatsApp Business Integration

**Klasifikasi:** Growth Add-on  
**Prioritas:** 🔴 Tier-1 (Southeast Asia-specific)

**Pain:** Customer di Asia Tenggara mengharapkan komunikasi bisnis via WhatsApp, bukan email.

**Fitur:**
- Send invoice, quotation, dan payment reminder via WhatsApp otomatis
- WhatsApp order bot (customer order via WA, masuk ke sistem)
- Real-time delivery status update ke customer via WA
- Collection reminder via WA (dunning)
- Two-way messaging log tersimpan di CRM

**Dependencies:** Revenue Core, CRM, Finance Core

---

### 4.3 Barcode & QR Inventory Scanner

**Klasifikasi:** Advanced Ops Add-on  
**Prioritas:** 🟠 Tier-2

**Pain:** Penerimaan barang dan stock opname masih manual, lambat, dan error-prone.

**Fitur:**
- Mobile barcode scanner (kamera HP jadi scanner)
- QR code generation untuk setiap produk/lokasi
- Receiving goods via scan (otomatis update stok)
- Stock opname via scan (bandingkan scan vs sistem)
- Serial number & batch tracking via barcode
- Label printing integration

**Dependencies:** Inventory Core, Warehouse, Advanced WMS

---

### 4.4 E-Commerce Auto-Sync

**Klasifikasi:** Integration Add-on  
**Prioritas:** 🟠 Tier-2

**Pain:** Data penjualan marketplace tidak masuk ERP secara otomatis.

**Fitur:**
- Real-time sync order dari Tokopedia, Shopee, Lazada, TikTok Shop
- Inventory level push ke semua marketplace
- Auto-create invoice dari marketplace order
- Return & refund sync dari marketplace
- Marketplace fee deduction otomatis dalam laporan profit

**Dependencies:** Omnichannel Commerce Module (atau Revenue Core untuk versi lite)

---

### 4.5 Smart Invoice OCR

**Klasifikasi:** Productivity Add-on  
**Prioritas:** 🟠 Tier-2

**Pain:** Input faktur pembelian dari supplier masih manual, lambat, dan sering salah ketik.

**Fitur:**
- Upload PDF/foto faktur supplier → otomatis extract data
- AI OCR untuk vendor name, tanggal, nomor, item, qty, harga, total
- Preview dan konfirmasi sebelum create purchase invoice
- Batch upload faktur
- Duplikasi detection (faktur sama diinput dua kali)

**Dependencies:** Purchasing, Finance Core, AI/OCR backend

---

### 4.6 Payment Gateway Integration

**Klasifikasi:** Growth Add-on  
**Prioritas:** 🔴 Tier-1

**Pain:** Invoice dikirim tapi customer tidak punya cara bayar mudah.

**Fitur:**
- Payment link terintegrasi di setiap invoice (Midtrans, Xendit, Doku)
- Auto-reconcile payment yang masuk ke sistem
- Virtual account per transaksi atau per customer
- QRIS payment support
- Installment payment tracking
- Payment success webhook → auto-close invoice

**Dependencies:** Revenue Core, Finance Core

---

### 4.7 HR Self-Service Mobile App

**Klasifikasi:** Growth Add-on  
**Prioritas:** 🟠 Tier-2

**Pain:** Karyawan harus ke HRD untuk cuti, reimburse, atau lihat slip gaji.

**Fitur:**
- Mobile app karyawan (iOS/Android) atau PWA
- Request cuti & approval via mobile
- Submit reimbursement dengan foto struk
- Lihat slip gaji dan histori payroll
- Absensi via GPS + foto selfie
- Pengumuman dan broadcast dari HRD
- Employee directory

**Dependencies:** HRIS Core

---

### 4.8 Advanced Analytics & BI

**Klasifikasi:** Growth Add-on  
**Prioritas:** 🟠 Tier-2

**Pain:** Laporan standar tidak cukup untuk keputusan strategis; owner butuh drill-down.

**Fitur:**
- Custom dashboard builder (drag & drop widget)
- Cross-module analytics (gabung data sales + inventory + finance dalam satu chart)
- Cohort analysis untuk customer
- Trend & seasonality analysis
- Benchmark antar cabang / salesperson / produk
- Scheduled report (kirim PDF laporan otomatis via email/WA)
- Data export ke Google Sheets / Power BI

**Dependencies:** Reports Module, semua modul aktif

---

### 4.9 Approval Workflow Engine

**Klasifikasi:** Governance Add-on  
**Prioritas:** 🔴 Tier-1

**Pain:** Proses approval PO, reimbursement, cuti, dan lain-lain masih via WhatsApp Group atau manual — tidak terlacak.

**Fitur:**
- Visual workflow builder (define langkah approval, approver, kondisi)
- Approval via email, WhatsApp, atau notifikasi in-app
- Delegation of authority (ketika approver cuti, delegasi otomatis)
- Approval history dan audit trail
- Eskalasi otomatis jika melampaui SLA
- Multi-level approval: sequential atau parallel
- Conditional routing (nilai > X → butuh approval direktur)

**Dependencies:** Semua modul yang punya transaksi (Purchasing, Sales, HRIS, Finance)

---

### 4.10 Franchise & Multi-Outlet Management

**Klasifikasi:** Capacity Add-on  
**Prioritas:** 🟠 Tier-2

**Pain:** Bisnis franchise atau chain tidak bisa monitor outlet dari satu tempat; standar operasi berbeda-beda.

**Fitur:**
- Franchisor dashboard (monitor semua outlet dalam satu layar)
- Royalty fee calculation dan invoicing otomatis ke franchisee
- Standardized menu/price push ke semua outlet
- Outlet performance comparison (sales, margin, waste)
- Compliance checklist per outlet
- Inter-outlet inventory transfer
- Consolidated financial report (semua outlet dalam satu laporan)

**Dependencies:** Multi-Entity Add-on, Revenue Core, Inventory Core, Finance Core

---

### 4.11 Contract Management

**Klasifikasi:** Governance Add-on  
**Prioritas:** 🟡 Tier-3

**Pain:** Kontrak dengan pelanggan dan supplier disimpan di folder, tidak ada reminder tanggal jatuh tempo atau renewal.

**Fitur:**
- Contract repository (upload & kelola semua kontrak)
- Key date tracking (start, end, renewal, review date)
- Auto-reminder sebelum kontrak jatuh tempo
- Contract value tracking dan linking ke PO/SO
- E-signature integration
- Vendor/customer contract scorecard
- Contract template library

**Dependencies:** Revenue Core, Purchasing, CRM

---

### 4.12 Loyalty & Rewards Program

**Klasifikasi:** Growth Add-on  
**Prioritas:** 🟡 Tier-3

**Pain:** Tidak ada program loyalitas pelanggan yang terintegrasi dengan transaksi.

**Fitur:**
- Points earning rules (per Rp X transaksi = Y points)
- Points redemption di POS atau sales order
- Tier membership (Silver, Gold, Platinum) dengan benefit berbeda
- Birthday reward automation
- Referral program tracking
- Loyalty program analytics (churn rate, points liability, redemption rate)
- Integration dengan WhatsApp untuk notifikasi points

**Dependencies:** POS Add-on, Revenue Core, CRM

---

### 4.13 Document Management System (DMS)

**Klasifikasi:** Governance Add-on  
**Prioritas:** 🟡 Tier-3

**Pain:** Dokumen bisnis (PO, invoice, kontrak, laporan) tersebar di email, Google Drive, dan WhatsApp.

**Fitur:**
- Centralized document repository dengan folder structure
- Auto-attach dokumen ke transaksi terkait (PO, invoice, proyek)
- Version control dokumen
- Full-text search di semua dokumen
- Document approval workflow
- Expiry tracking (sertifikat, izin, asuransi)
- Secure sharing dengan link ber-expiry

**Dependencies:** Semua modul (cross-cutting)

---

### 4.14 Route & Delivery Optimization

**Klasifikasi:** Advanced Ops Add-on  
**Prioritas:** 🟡 Tier-3

**Pain:** Pengiriman barang tidak dioptimasi, biaya logistik membengkak.

**Fitur:**
- Daily delivery route planning otomatis
- Vehicle load optimization
- Real-time driver tracking (GPS)
- Proof of delivery (foto + tanda tangan digital)
- Delivery performance analytics (on-time rate, cost per km)
- Customer ETA notification
- Return pickup scheduling

**Dependencies:** Sales, Fleet & Rental (opsional), Inventory Core

---

### 4.15 Vendor Portal

**Klasifikasi:** Integration Add-on  
**Prioritas:** 🟡 Tier-3

**Pain:** Komunikasi dengan supplier masih manual via email; status PO tidak transparan.

**Fitur:**
- Supplier self-service portal: lihat dan konfirmasi PO
- Supplier invoice submission (upload faktur digital)
- Delivery schedule coordination
- Supplier rating & scorecard
- RFQ (Request for Quotation) online
- Supplier onboarding form digital
- Communication log terintegrasi

**Dependencies:** Purchasing, Finance Core

---

### 4.16 Predictive Maintenance (IoT-Ready)

**Klasifikasi:** Advanced Ops Add-on  
**Prioritas:** 🟡 Tier-3 (Future-Ready)

**Pain:** Perusahaan dengan mesin atau armada tidak tahu kapan mesin akan rusak — reaktif, bukan preventif.

**Fitur:**
- Maintenance schedule otomatis berdasarkan jam operasional atau kilometer
- IoT sensor integration (temperature, vibration, mileage) — future
- Predictive alert berdasarkan pattern breakdown historis
- Maintenance cost per aset / per periode
- Spare part inventory integration (deduct saat maintenance)
- Vendor maintenance scheduling

**Dependencies:** Fixed Asset Management, Fleet Maintenance Pack, Manufacturing

---

### 4.17 AI Cashflow Advisor

**Klasifikasi:** AI Productivity Add-on  
**Prioritas:** 🟠 Tier-2

**Pain:** Owner tidak tahu apakah bisnis akan cukup kas 30-90 hari ke depan.

**Fitur:**
- AI-generated cashflow forecast berbasis data historis + AR/AP outstanding
- "What-if" scenario modeling (bagaimana jika tagih lebih cepat? jika ada pengeluaran besar?)
- Rekomendasi tindakan (kapan harus tarik pinjaman, kapan bisa invest)
- Alert dini potensi cash crunch
- Natural language summary laporan arus kas ("bulan ini arus kas negatif karena...")
- Integration dengan perbankan (opsional, open banking)

**Dependencies:** Finance Core, Payables & Receivables Intelligence, AI backend

---

### 4.18 Training & Certification Marketplace

**Klasifikasi:** Academy Strategic Add-on  
**Prioritas:** 🟠 Tier-2

**Pain:** NIZAM sudah punya Academy/EDU, tetapi konten pelatihan terbatas pada konten internal.

**Fitur:**
- Open marketplace untuk trainer/instruktur eksternal publish konten di NIZAM
- Revenue sharing model untuk instruktur
- Customer bisa beli kursus dari marketplace → belajar langsung di platform
- Sertifikasi resmi NIZAM untuk implementor dan user
- Partner program: reseller, implementor, dan trainer bisa mendapatkan sertifikasi
- Cohort-based learning (belajar bersama seangkatan)
- Live session integration (Zoom/Google Meet in-app)

**Dependencies:** Academy/EDU Module

---

## 5. Matriks Prioritas & Roadmap

### 5.1 Phase 1 — Q3 2026 (Quick Wins & Tier-1 Pain)

| Item | Tipe | Alasan Prioritas |
|---|---|---|
| Payment Gateway Integration | Add-on | Unblock revenue collection, demand tinggi |
| Approval Workflow Engine | Add-on | Cross-module impact, pain universal |
| WhatsApp Business Integration | Add-on | Asia-specific, conversion booster |
| Tax Compliance Engine | Module | Compliance obligation, semua PKP butuh |
| Payables & Receivables Intelligence | Module | Cash flow = lifeline UKM |

### 5.2 Phase 2 — Q4 2026 (Growth & Vertical)

| Item | Tipe | Alasan Prioritas |
|---|---|---|
| Treasury & Multi-Currency | Module | Buka segmen ekspor/impor |
| Budget & Cost Control | Module | Upsell ke perusahaan 20+ karyawan |
| AI Purchase Assistant | Add-on | AI differentiator, cost savings |
| Smart Invoice OCR | Add-on | Productivity win, reduceable manual error |
| Commission & Incentive Management | Module | Sales-driven segment |
| Subscription & Recurring Billing | Module | SaaS & membership vertical |

### 5.3 Phase 3 — Q1 2027 (Scale & Ecosystem)

| Item | Tipe | Alasan Prioritas |
|---|---|---|
| Omnichannel Commerce | Module | E-commerce integration demand |
| Supply Chain Planning (SCP) | Module | Manufacturer & distributor vertical |
| Customer Success & Portal | Module | B2B retention & self-service |
| Fixed Asset Management | Module | Compliance & accounting completeness |
| Advanced Analytics & BI | Add-on | Executive & owner persona |
| HR Self-Service Mobile App | Add-on | HRIS adoption & engagement |

### 5.4 Phase 4 — Q2-Q3 2027 (Enterprise & Global)

| Item | Tipe | Alasan Prioritas |
|---|---|---|
| ESG & Sustainability Reporting | Module | Enterprise & global compliance |
| Field Service Management | Module | Service vertical depth |
| Franchise & Multi-Outlet | Add-on | F&B, retail chain segment |
| Training & Certification Marketplace | Add-on | Academy ecosystem moat |
| Vendor Portal | Add-on | Procurement digital ecosystem |
| AI Cashflow Advisor | Add-on | AI-native finance differentiator |
| Predictive Maintenance | Add-on | IoT-ready future capability |

---

## 6. Arsitektur Produk Final (Post-Roadmap)

```
NIZAM Platform
├── Platform Core (always included)
│   ├── Auth & Tenancy
│   ├── Organization & Branch
│   ├── Roles & Permissions
│   ├── Dashboard Shell
│   └── Billing & Support
│
├── Core Families (Module Wajib)
│   ├── Finance Core
│   │   ├── [NEW] Treasury & Multi-Currency
│   │   ├── [NEW] Budget & Cost Control
│   │   ├── [NEW] Fixed Asset Management
│   │   └── [NEW] Payables & Receivables Intelligence
│   ├── Revenue Core
│   │   ├── [NEW] Commission & Incentive Management
│   │   └── [NEW] Subscription & Recurring Billing
│   ├── Purchasing
│   ├── Inventory Core
│   └── HRIS Core
│
├── Vertical Modules (Pilih 1 atau Lebih)
│   ├── Manufacturing (existing)
│   ├── Fleet & Rental (existing)
│   ├── Service Operations (existing)
│   ├── Project & Construction (existing)
│   ├── Syirkah (existing)
│   ├── [NEW] Omnichannel Commerce
│   ├── [NEW] Supply Chain Planning
│   ├── [NEW] Customer Success & Portal
│   ├── [NEW] Field Service Management
│   └── [NEW] ESG & Sustainability Reporting
│
├── Compliance Module
│   └── [NEW] Tax Compliance Engine
│
├── Strategic Module
│   └── Academy / EDU (existing)
│
├── Growth Add-ons
│   ├── POS (existing)
│   ├── Sales Page (existing)
│   ├── Quick Bill (existing)
│   ├── Sales AR Cockpit (existing)
│   ├── Package Tracking (existing)
│   ├── [NEW] Payment Gateway Integration
│   ├── [NEW] WhatsApp Business Integration
│   ├── [NEW] Loyalty & Rewards Program
│   └── [NEW] AI Cashflow Advisor
│
├── Productivity Add-ons
│   ├── [NEW] Smart Invoice OCR
│   ├── [NEW] AI Purchase Assistant
│   └── [NEW] Advanced Analytics & BI
│
├── Governance Add-ons
│   ├── [NEW] Approval Workflow Engine
│   ├── [NEW] Contract Management
│   └── [NEW] Document Management System
│
├── Advanced Ops Add-ons
│   ├── Advanced WMS (existing)
│   ├── Fleet Maintenance Pack (existing)
│   ├── [NEW] Barcode & QR Inventory Scanner
│   ├── [NEW] Route & Delivery Optimization
│   └── [NEW] Predictive Maintenance
│
├── Integration & Capacity Add-ons
│   ├── Open API & Webhooks (existing)
│   ├── Multi-Entity (existing)
│   ├── [NEW] E-Commerce Auto-Sync
│   └── [NEW] Vendor Portal
│
└── Capacity Add-ons
    ├── HR Self-Service Mobile App [NEW]
    ├── Franchise & Multi-Outlet [NEW]
    └── Training & Certification Marketplace [NEW]
```

---

## 7. Segmentasi Customer dan Rekomendasi Paket

### 7.1 Usaha Kecil & Retail (Revenue < Rp 5M/bulan)

**Paket Rekomendasi: NIZAM Starter**
- Revenue Core + Inventory Core + Finance Core
- Add-on: POS, Quick Bill, Payment Gateway, WhatsApp Integration

**Pain yang Diselesaikan:**
- Tidak ada catatan penjualan yang rapi
- Invoice manual
- Tidak bisa terima bayar digital

---

### 7.2 UKM Berkembang (Revenue Rp 5M–500M/bulan)

**Paket Rekomendasi: NIZAM Business**
- Semua Core Families
- Add-on: Approval Workflow, Smart Invoice OCR, Advanced Analytics
- Vertical: sesuai industri (Manufacturing / Workshop / Fleet)

**Pain yang Diselesaikan:**
- Kontrol pengeluaran tidak ada
- Approval pembelian tidak terlacak
- Laporan untuk pengambilan keputusan tidak ada

---

### 7.3 Perusahaan Menengah (Revenue > Rp 500M/bulan)

**Paket Rekomendasi: NIZAM Enterprise**
- Semua Core Families + selected Verticals
- Tax Compliance Engine + Budget & Cost Control + Fixed Asset
- Treasury & Multi-Currency + Payables & Receivables Intelligence
- Add-ons: API, Multi-Entity, Franchise Management (jika relevan)

**Pain yang Diselesaikan:**
- Tidak siap audit eksternal
- Budget tidak terkontrol
- Tidak ada visibilitas cashflow ke depan

---

### 7.4 Bisnis E-Commerce & Omnichannel

**Paket Rekomendasi: NIZAM Commerce**
- Revenue Core + Inventory Core + Finance Core
- Vertical: Omnichannel Commerce
- Add-ons: E-Commerce Auto-Sync, POS, Payment Gateway, Loyalty Program, WhatsApp Integration

**Pain yang Diselesaikan:**
- Data dari marketplace tidak terintegrasi
- Stok di online dan offline tidak sinkron

---

### 7.5 Industri dengan Regulasi Tinggi (Ekspor, TBk, GCG)

**Paket Rekomendasi: NIZAM Compliance**
- Semua Core Families + ESG Reporting + Tax Compliance
- Add-ons: Contract Management, DMS, Approval Workflow, Vendor Portal

**Pain yang Diselesaikan:**
- Tidak memenuhi requirement ESG investor
- Tidak siap laporan untuk due diligence

---

## 8. Differensiator Kompetitif Global

### 8.1 Versus SAP / Oracle (Enterprise ERP)

| Dimensi | SAP/Oracle | NIZAM |
|---|---|---|
| Time-to-value | 6–24 bulan | 2–8 minggu |
| Total cost | Ratusan juta–miliar | Puluhan juta/tahun |
| Kemudahan implementasi | Butuh konsultan mahal | Self-service + Academy |
| Syariah/Syirkah | Tidak ada native | Native module |
| Lokal compliance (DJP, BI) | Custom mahal | Built-in |

### 8.2 Versus Accurate / Jurnal (Akuntansi SaaS Lokal)

| Dimensi | Accurate/Jurnal | NIZAM |
|---|---|---|
| Scope | Akuntansi + Sales dasar | Full ERP platform |
| Vertical operations | Tidak ada | Manufacturing, Fleet, Construction, dsb. |
| AI capabilities | Minimal | AI OCR, AI Advisor, AI Purchasing |
| Ecosystem (Academy, Partner) | Minimal | Strategis |
| Multi-entity | Terbatas | Native add-on |

### 8.3 Versus Odoo (Open-Source ERP)

| Dimensi | Odoo | NIZAM |
|---|---|---|
| Kemudahan kustomisasi | Sangat tinggi (tapi kompleks) | Modular add-on |
| Biaya total (TCO) | Tinggi karena implementasi | Lebih terprediksi |
| Syariah & lokal | Komunitas, bukan native | Native |
| Academy built-in | Tidak ada | Modul strategis |
| Support bahasa Indonesia | Tidak native | Native |

---

## 9. Estimasi Potensi Revenue Per Kategori Modul

*(Estimasi ilustratif berbasis market sizing Indonesia)*

| Kategori | Total Addressable Market (TAM) Indonesia | NIZAM Share Potential |
|---|---|---|
| Core ERP UKM | ~2 juta UKM besar yang layak | 50.000 tenant × Rp 2M/bulan = Rp 100B/bulan |
| Tax Compliance | Semua PKP (~900.000 entitas) | Add-on uplift Rp 300K–1M/bulan |
| Omnichannel Commerce | ~500.000 penjual online aktif | Rp 500K–2M/bulan per tenant |
| HRIS + Payroll | ~3 juta perusahaan punya karyawan | Rp 200K–500K/karyawan/bulan |
| Manufacturing Vertical | ~30.000 pabrik skala menengah | Rp 5M–50M/bulan per pabrik |
| ESG Reporting | ~5.000 perusahaan enterprise | Premium tier Rp 5M+/bulan |
| Academy/Certification | Semua tenant + ekosistem partner | Per-seat Rp 500K–2M |

---

## 10. Kesimpulan dan Rekomendasi Tindakan

### 10.1 Tiga Modul Paling Kritis untuk Dikerjakan Pertama

1. **Tax Compliance Engine** — compliance obligation yang wajib, semua PKP butuh, immediate upsell opportunity
2. **Payment Gateway Integration** — langsung unblock revenue collection; dampak paling cepat terasa customer
3. **Approval Workflow Engine** — pain yang paling universal lintas semua segmen dan ukuran bisnis

### 10.2 Tiga Modul Paling Strategis untuk Jangka Panjang

1. **Treasury & Multi-Currency** — membuka pasar bisnis ekspor/impor yang selama ini tidak bisa dilayani
2. **Omnichannel Commerce** — memasuki era commerce post-marketplace yang berkembang cepat
3. **ESG & Sustainability Reporting** — positioning NIZAM sebagai platform enterprise-ready untuk IPO-ready company dan perusahaan multinasional

### 10.3 Differensiator yang Harus Dijaga

1. **Syirkah** — tidak ada ERP lain yang punya ini secara native; pertahankan dan perdalam
2. **Academy/EDU** — jadikan moat utama; bangun Training & Certification Marketplace
3. **Local compliance** (DJP, BI regulation) — keunggulan yang tidak mudah ditiru ERP global
4. **AI-native** (OCR, Advisor, Purchase Assistant) — adopsi AI sejak dini sebelum kompetitor

---

*Dokumen ini dibuat berdasarkan analisis mendalam terhadap branch `feat_multi`, arsitektur produk NIZAM (KLASIFIKASI_MODULE_DAN_ADDON_NIZAM.md, GTM_NIZAM_MODULE_DAN_ADDON.md), dan pemetaan pain point customer global.*

*Untuk implementasi, setiap modul/add-on harus melalui: Product Discovery → Architecture Review → Database Schema → API Design → UI/UX → QA → Release.*
