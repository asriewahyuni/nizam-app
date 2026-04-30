# Klasifikasi Module dan Add-on NIZAM

## Status Dokumen

- Versi: `1.0`
- Tanggal: `30 April 2026`
- Penulis: `analisis produk dan arsitektur`
- Tujuan: `menetapkan klasifikasi capability NIZAM ke dalam Platform Core, Module, dan Add-on berdasarkan logika product architecture, bukan sekadar mengikuti menu atau paket yang sudah ada`

---

## 1. Ringkasan Eksekutif

Kesimpulan utama saya sederhana:

1. NIZAM tidak sehat jika dipaksa hanya punya dua kotak: `module` dan `add-on`.
2. Struktur yang benar secara product architecture adalah:
   - `Platform Core`
   - `Module`
   - `Add-on`
3. Beberapa capability yang saat ini tampak seperti module mandiri sebenarnya lebih tepat dianggap add-on.
4. Sebaliknya, ada capability yang secara strategis justru sudah cukup kuat untuk dinaikkan menjadi module penuh.

Keputusan final saya:

- `POS` lebih tepat menjadi `Add-on` channel di atas `Revenue Core`, bukan module utama.
- `Warehouse / WMS` lebih tepat menjadi `Advanced Add-on` di atas `Inventory Core`, bukan domain mandiri.
- `Sales Page` dan `Open API` adalah `Growth/Integration Add-on`, bukan module inti ERP.
- `Syirkah`, `Project & Construction`, `Fleet & Rental`, `Service Operations`, dan `Academy / EDU` layak diperlakukan sebagai `Module`.
- `CRM`, `Reports`, `Attendance`, dan `Payroll` tidak perlu dijual sebagai module terpisah; lebih tepat sebagai submodule atau pack di dalam family yang lebih besar.

Dengan kata lain: NIZAM bukan kumpulan menu. NIZAM adalah platform operasi bisnis dengan beberapa domain inti, beberapa vertical module, dan beberapa accelerator add-on.

---

## 2. Prinsip Klasifikasi

Saya memakai definisi berikut.

### 2.1 Platform Core

Capability yang wajib ada agar sistem bisa hidup, tetapi bukan SKU bisnis utama.

Ciri-ciri:

1. dipakai hampir semua tenant,
2. menjadi fondasi akses, tenancy, konfigurasi, dan governance,
3. tidak berdiri sebagai sistem kerja bisnis utama,
4. lebih tepat dianggap `substrate`, bukan produk domain.

### 2.2 Module

Capability yang layak dianggap domain bisnis mandiri.

Ciri-ciri:

1. punya objek data utama sendiri,
2. punya alur kerja end-to-end sendiri,
3. punya persona operator atau owner yang jelas,
4. punya dependency yang wajar ke core platform, tetapi tidak hanya menjadi variasi kecil dari modul lain,
5. cukup besar untuk memiliki kurikulum, SOP, onboarding, dan governance sendiri.

### 2.3 Add-on

Capability yang memperluas, memperdalam, atau membuka channel tambahan di atas module yang sudah ada.

Ciri-ciri:

1. tidak menjadi system of record utama,
2. nilainya muncul setelah module induknya aktif,
3. dependency ke module lain kuat,
4. lebih cocok dijual sebagai ekspansi, pack, accelerator, seat, atau capacity extension.

---

## 3. Kritik terhadap Struktur Saat Ini

Repo saat ini sudah punya pengelompokan capability di `lib/saas/module-catalog.ts`, tetapi dari sudut pandang CDO/CTO ada beberapa hal yang menurut saya belum bersih.

### 3.1 Yang Sudah Tepat

1. pemisahan `core`, `vertical module`, dan `add-on` sudah mulai terbentuk,
2. route guard dan sidebar benar-benar memakai gating capability,
3. pricing operator sudah mulai membedakan module vs add-on secara komersial.

### 3.2 Yang Perlu Dikoreksi

1. `POS` saat ini masuk core family, padahal secara arsitektur lebih tepat menjadi add-on channel penjualan.
2. `CRM` lebih tepat menjadi bagian dari `Revenue Core`, bukan module top-level mandiri.
3. `Reports` lebih tepat dianggap embedded insight layer, bukan module bisnis mandiri.
4. `Accounting` dan `Finance` layak dipisah di codebase, tetapi sebaiknya diposisikan sebagai satu family module secara product.
5. `EDU` terlalu direduksi menjadi bagian HRIS, padahal sudah cukup kuat menjadi module strategis.

---

## 4. Klasifikasi Final Tingkat Atas

| Kelompok | Capability Family | Keputusan |
|---|---|---|
| Platform | Auth, Tenancy, Org, Branch, Role, Settings, Billing, Support, Migration, Dashboard Shell | `Platform Core` |
| Core ERP | Finance Core, Revenue Core, Purchasing, Inventory Core, HRIS Core | `Module` |
| Vertical Ops | Manufacturing, Fleet & Rental, Service Operations, Project & Construction, Syirkah | `Module` |
| Capability Platform | Academy / EDU | `Module` |
| Growth / Channel | POS, Sales Page, Quick Bill, Sales AR Cockpit, Package Tracking | `Add-on` |
| Advanced Ops | Advanced WMS, Fleet Maintenance Pack | `Add-on` |
| Integration | Open API & Webhooks | `Add-on` |
| Capacity | Multi-Entity, seat pack, branch/entity expansion | `Add-on` |
| Embedded Governance | Audit, BSC, Forecast, compliance layer | `Pack / Embedded Capability`, bukan module jualan mandiri |

---

## 5. Platform Core

Area berikut tidak saya anggap module dan tidak saya anggap add-on. Ini fondasi platform.

| Capability | Klasifikasi | Alasan |
|---|---|---|
| Auth | `Platform Core` | fondasi akses, bukan domain bisnis |
| Organization / Tenant | `Platform Core` | inti multi-tenant |
| Branch / Unit | `Platform Core` | fondasi konteks operasional lintas modul |
| Roles / Permissions | `Platform Core` | fondasi kontrol akses |
| Business Settings | `Platform Core` | konfigurasi umum, bukan workflow bisnis utama |
| Dashboard Shell | `Platform Core` | ringkasan dan navigasi platform |
| Billing SaaS | `Platform Core` | penting untuk monetisasi SaaS, tetapi bukan module ERP user |
| Support Ticket | `Platform Core` | service layer platform |
| Data Migration Base | `Platform Core` | enabling capability, bukan domain operasional harian |
| Demo / Onboarding Flow | `Platform Core` | activation layer, bukan module bisnis |

Catatan:

1. `Platform Core` wajib ada di semua paket.
2. `Platform Core` tidak seharusnya dijual sebagai module terpisah ke end customer.
3. Kurikulum untuk area ini masuk jalur `Governance`, `Administration`, atau `Technology`, bukan `Operations`.

---

## 6. Module yang Saya Tetapkan

### 6.1 Finance Core

`Finance Core` adalah family module, bukan sekadar menu accounting.

Isi utamanya:

1. CoA
2. Journal / ledger
3. Cash & bank
4. Aging
5. Tax
6. Zakat
7. Reimbursement
8. Fixed assets
9. Budget
10. Closing

Keputusan:

- klasifikasi: `Module`
- nama family yang saya sarankan: `Finance Core`

Alasan:

1. ini adalah backbone pencatatan dan kontrol keuangan,
2. memiliki objek data, alur kerja, approval, dan output formal sendiri,
3. menjadi referensi lintas domain lain,
4. sangat layak untuk sertifikasi role-based.

Catatan penting:

- di codebase boleh tetap dibedakan `Accounting` dan `Finance`,
- di level product dan kurikulum, saya sarankan diperlakukan sebagai satu family agar tidak membingungkan market.

### 6.2 Revenue Core

`Revenue Core` mencakup:

1. CRM / contacts
2. quotation
3. sales order / sales execution
4. pipeline
5. promo
6. commission

Keputusan:

- klasifikasi: `Module`
- nama family yang saya sarankan: `Revenue Core`

Alasan:

1. ini domain komersial utama,
2. CRM di NIZAM lebih tepat dianggap front-end dari penjualan, bukan aplikasi berdiri sendiri,
3. quotation, pipeline, promo, dan commission secara alami hidup dalam family yang sama.

### 6.3 Purchasing

Keputusan:

- klasifikasi: `Module`

Alasan:

1. punya siklus kerja, dokumen, approval, dan kontrol sendiri,
2. dependency ke inventory dan finance wajar tetapi tidak menghilangkan kemandiriannya,
3. cocok untuk jalur operator, supervisor, dan implementation.

### 6.4 Inventory Core

`Inventory Core` mencakup:

1. master produk,
2. stok,
3. pergerakan inventory dasar,
4. warehouse dasar sebagai lokasi operasional.

Keputusan:

- klasifikasi: `Module`
- nama family yang saya sarankan: `Inventory Core`

Alasan:

1. inventory adalah domain inti ERP,
2. menjadi dependency untuk purchasing, sales, manufacturing, dan sebagian POS,
3. layak menjadi track sertifikasi inti.

Catatan:

- `warehouse dasar` tetap bagian dari inventory core,
- `WMS advanced` saya pisahkan sebagai add-on.

### 6.5 HRIS Core

`HRIS Core` mencakup:

1. employee,
2. attendance,
3. leave,
4. payroll,
5. expense,
6. self-service,
7. role linkage operasional.

Keputusan:

- klasifikasi: `Module`
- nama family yang saya sarankan: `HRIS Core`

Alasan:

1. punya lifecycle data dan operator sendiri,
2. payroll memiliki kedalaman transaksi dan governance yang nyata,
3. attendance dan payroll lebih tepat menjadi submodule HRIS daripada module terpisah.

### 6.6 Manufacturing

Keputusan:

- klasifikasi: `Module`

Alasan:

1. punya BOM, routing, work order, costing, dan stock sync,
2. sudah cukup dalam secara schema dan workflow,
3. layak diposisikan sebagai vertical operations module.

### 6.7 Service Operations

Keputusan:

- klasifikasi: `Module`
- nama family yang saya sarankan: `Service Operations`

Alasan:

1. job order jasa adalah domain kerja nyata,
2. punya objek transaksi dan lifecycle sendiri,
3. berbeda secara operasional dari sales barang dan manufacturing.

### 6.8 Project & Construction

Keputusan:

- klasifikasi: `Module`

Alasan:

1. punya model proyek, stage, budget, progress log, dan termin billing,
2. bukan sekadar variasi kecil dari service order,
3. vertical ini cukup besar untuk punya positioning pasar sendiri.

### 6.9 Fleet & Rental

Keputusan:

- klasifikasi: `Module`

Alasan:

1. punya aset, booking, route, schedule, ticket, dan operasi kendaraan,
2. persona user jelas,
3. kompleksitas domain cukup tinggi untuk berdiri sendiri.

### 6.10 Syirkah

Keputusan:

- klasifikasi: `Module`

Alasan:

1. ini bukan toggle kecil syariah,
2. punya kontrak, member, workflow dokumen, dan integrasi jurnal sendiri,
3. market proposition-nya spesifik dan cukup kuat.

### 6.11 Academy / EDU

Keputusan:

- klasifikasi: `Module`
- nama family yang saya sarankan: `Academy / EDU`

Alasan:

1. sudah punya training event, assessment, submission, review, dan realtime session,
2. ini bukan sekadar fitur HR training biasa,
3. secara strategi perusahaan, area ini bisa menjadi moat NIZAM untuk enablement dan sertifikasi.

Catatan:

- secara permission saat ini learning masih menempel ke HRIS,
- tetapi dari sudut pandang product strategy saya akan menaikkannya menjadi module strategis lintas produk.

---

## 7. Add-on yang Saya Tetapkan

### 7.1 POS

Keputusan:

- klasifikasi: `Add-on`
- tipe: `channel add-on`

Alasan:

1. POS adalah channel transaksi dari `Revenue Core`, bukan domain system of record yang sepenuhnya mandiri,
2. alurnya sangat tergantung pada sales, pricing, promo, inventory, branch, dan kas,
3. ia memperluas cara menjual, bukan membentuk domain bisnis baru.

### 7.2 Advanced Warehouse / WMS

Keputusan:

- klasifikasi: `Add-on`
- tipe: `advanced operations add-on`

Alasan:

1. bin, batch, expiry, FEFO adalah pendalaman dari inventory,
2. WMS advanced tidak masuk akal tanpa inventory core,
3. value-nya muncul saat tenant sudah naik kompleksitas operasionalnya.

### 7.3 Sales Page

Keputusan:

- klasifikasi: `Add-on`
- tipe: `growth add-on`

Alasan:

1. ini adalah akuisisi lead dan landing page builder,
2. ia memperkuat `Revenue Core`, bukan menggantikannya,
3. cocok dijual sebagai booster untuk tim sales dan marketing.

### 7.4 Open API & Webhooks

Keputusan:

- klasifikasi: `Add-on`
- tipe: `integration add-on`

Alasan:

1. API membuka interoperabilitas, bukan domain operasional utama,
2. tenant tidak wajib punya API untuk menjalankan ERP,
3. add-on ini cocok untuk implementor, partner, dan enterprise integration.

### 7.5 Multi-Entity (PT/CV)

Keputusan:

- klasifikasi: `Add-on`
- tipe: `capacity add-on`

Alasan:

1. ini ekspansi kapasitas organisasi, bukan workflow bisnis baru,
2. dependency-nya ke platform core sangat kuat,
3. secara pricing lebih tepat menjadi expansion entitlement.

### 7.6 Quick Bill

Keputusan:

- klasifikasi: `Add-on`

Alasan:

1. ini shortcut workflow,
2. ia mempercepat billing tertentu tetapi tidak membentuk domain baru,
3. cocok diposisikan sebagai booster produktivitas.

### 7.7 Fleet Maintenance Pack

Keputusan:

- klasifikasi: `Add-on`

Alasan:

1. ia memperdalam `Fleet & Rental`,
2. dependency ke fleet module sangat jelas,
3. cocok menjadi premium maintenance extension.

### 7.8 Package Tracking

Keputusan:

- klasifikasi: `Add-on`

Alasan:

1. ini lapisan pelacakan purna transaksi,
2. bergantung ke operasi penjualan atau distribusi,
3. lebih tepat dijual sebagai extender daripada module baru.

### 7.9 Sales AR Cockpit

Keputusan:

- klasifikasi: `Add-on`

Alasan:

1. ini dashboard role-specific,
2. bergantung ke `Sales` dan `Finance`,
3. cocok jadi add-on collection dan monitoring tim.

### 7.10 Sales AR Seat Pack

Keputusan:

- klasifikasi: `Add-on`
- tipe: `seat capacity add-on`

Alasan:

1. ini murni ekspansi pemakaian untuk capability yang sudah ada,
2. bukan domain baru,
3. secara pricing memang paling tepat sebagai seat extension.

### 7.11 AI / Vision

Keputusan:

- klasifikasi: `Add-on`
- tipe: `productivity add-on`

Alasan:

1. AI di repo saat ini bersifat enhancer,
2. belum menjadi domain operasional mandiri,
3. sangat cocok diposisikan sebagai tokenized capability.

---

## 8. Capability yang Tidak Saya Jadikan Module Mandiri

Beberapa capability penting tetap saya anggap penting, tetapi bukan module top-level.

| Capability | Keputusan | Posisi yang saya sarankan |
|---|---|---|
| CRM | bukan module mandiri | submodule di `Revenue Core` |
| Reports | bukan module mandiri | embedded insight layer lintas module |
| Attendance | bukan module mandiri | submodule di `HRIS Core` |
| Payroll | bukan module mandiri | submodule di `HRIS Core` |
| Audit | bukan module jualan mandiri | governance pack / embedded control |
| BSC | bukan module mandiri | strategic insight pack |
| Forecast | bukan module mandiri | finance insight capability |
| Approval | bukan module mandiri | governance capability lintas domain |

Alasan utamanya:

1. capability-capability ini kuat, tetapi tidak paling ideal dijual sebagai domain produk berdiri sendiri,
2. lebih baik ditempatkan sebagai bagian dari family yang lebih besar,
3. ini akan membuat packaging, onboarding, dan sertifikasi jauh lebih jelas.

---

## 9. Matriks Klasifikasi Capability Saat Ini

| Capability Saat Ini | Klasifikasi Saya | Posisi Produk yang Disarankan |
|---|---|---|
| Dashboard | `Platform Core` | shell platform |
| Auth | `Platform Core` | foundation |
| Organization / Tenant | `Platform Core` | foundation |
| Branch / Divisi | `Platform Core` | foundation |
| Roles / Permissions | `Platform Core` | foundation |
| Pengaturan Bisnis | `Platform Core` | foundation |
| Billing SaaS | `Platform Core` | platform ops |
| Support Ticket | `Platform Core` | platform ops |
| Migrasi Data Dasar | `Platform Core` | implementation foundation |
| Accounting | `Module` | bagian dari `Finance Core` |
| Finance | `Module` | bagian dari `Finance Core` |
| Sales | `Module` | bagian dari `Revenue Core` |
| CRM / Contacts | `Module` | submodule `Revenue Core` |
| Purchasing | `Module` | standalone core module |
| Inventory | `Module` | `Inventory Core` |
| Warehouse dasar | `Module` | bagian dari `Inventory Core` |
| HRIS | `Module` | `HRIS Core` |
| Attendance | `Module` | submodule `HRIS Core` |
| Payroll | `Module` | submodule `HRIS Core` |
| Manufacturing | `Module` | vertical module |
| Fleet & Rental | `Module` | vertical module |
| Job Order (Jasa) | `Module` | `Service Operations` |
| Project & Construction | `Module` | vertical module |
| Syirkah | `Module` | vertical module |
| Learning / EDU | `Module` | `Academy / EDU` |
| POS | `Add-on` | revenue channel add-on |
| Warehouse / WMS advanced | `Add-on` | advanced inventory add-on |
| Sales Page | `Add-on` | growth add-on |
| Integrasi API | `Add-on` | integration add-on |
| Multi-Entity (PT/CV) | `Add-on` | capacity add-on |
| Quick Bill | `Add-on` | workflow accelerator |
| Fleet Maintenance Pack | `Add-on` | fleet extension |
| Package Tracking | `Add-on` | post-sales/logistics extension |
| Sales AR Cockpit | `Add-on` | collection/monitoring extension |
| Sales AR Seat Pack | `Add-on` | seat extension |
| Audit | `Embedded Pack` | governance capability |
| BSC | `Embedded Pack` | strategy capability |
| Forecast | `Embedded Pack` | finance insight capability |

---

## 10. Bukti Teknis Utama

Bagian ini penting karena klasifikasi di atas tidak saya bangun dari opini kosong.

### 10.1 Bukti bahwa POS lebih tepat dianggap Add-on

POS sangat bergantung pada sales, promo, gudang, branch, dan stok.

Bukti:

1. `modules/sales/actions/pos.actions.ts` memakai promo, warehouse selection, dan validasi stok inventory.
2. route POS tetap hidup di family penjualan, bukan domain data mandiri sepenuhnya.
3. migrasi `1179_pos_shift_foundation.sql` menambahkan kolom `pos_session_id`, `pos_payment_method`, `pos_amount_tendered`, dan `pos_change_amount` langsung ke tabel `sales`.

Makna arsitektural:

- POS adalah specialization channel dari revenue flow, bukan module yang sepenuhnya berdiri sendiri.

### 10.2 Bukti bahwa WMS lebih tepat dianggap Add-on

WMS advanced di repo berisi:

1. `warehouse_bins`,
2. `bin_id`,
3. `batch_number`,
4. `expiry_date`,
5. FEFO lookup,
6. integration ke manufacturing.

Bukti:

1. `supabase/migrations/1027_wms_manufacturing_advanced.sql` secara eksplisit menyebut `WMS enhancements`.
2. perubahan dilakukan dengan memperluas `inventory_stocks`, bukan menciptakan domain inventory baru yang terpisah.
3. `modules/inventory/actions/warehouse.actions.ts` menunjukkan WMS hidup sebagai pendalaman manajemen gudang.

Makna arsitektural:

- WMS advanced adalah deepening layer di atas `Inventory Core`.

### 10.3 Bukti bahwa Sales Page lebih tepat dianggap Add-on

Bukti:

1. `modules/sales/actions/sales-page.actions.ts` berada di domain sales.
2. `supabase/migrations/1081_sales_page_module.sql` menambahkan `sales_pages` dan `sales_page_leads`, yaitu channel lead generation dan landing page.
3. secara komersial ia lebih cocok dijual ke tenant yang sudah punya `Sales`.

Makna arsitektural:

- Sales Page memperluas akuisisi demand, bukan core ERP execution.

### 10.4 Bukti bahwa Open API lebih tepat dianggap Add-on

Bukti:

1. `supabase/migrations/1200_open_api.sql` fokus pada `api_keys`, `api_rate_limit_log`, `api_configurations`, dan `api_webhook_deliveries`.
2. domain utamanya adalah exposure dan integration governance, bukan operasi bisnis harian internal.
3. pricing operator juga memperlakukan ini sebagai capability tambahan.

Makna arsitektural:

- API adalah integration surface, bukan module end-user inti.

### 10.5 Bukti bahwa Syirkah layak dianggap Module

Bukti:

1. `modules/syirkah/actions/syirkah.actions.ts` menunjukkan workflow dan type sendiri.
2. `supabase/migrations/1199_syirkah_tables.sql` membangun tabel kontrak dan member.
3. ada integrasi jurnal inti dan logika domain khusus pada action layer.

Makna arsitektural:

- Syirkah memiliki bounded context yang cukup jelas untuk berdiri sebagai module.

### 10.6 Bukti bahwa Project & Construction layak dianggap Module

Bukti:

1. `supabase/migrations/1227_construction_foundation.sql` membuat `construction_projects`, `construction_project_stages`, `construction_budget_items`, `construction_progress_logs`, dan `construction_billing_terms`.
2. `modules/construction/actions/construction.actions.ts` menunjukkan lifecycle domain yang kaya.

Makna arsitektural:

- ini bukan “services plus sedikit proyek”; ini vertical module yang nyata.

### 10.7 Bukti bahwa EDU layak dinaikkan menjadi Module

Bukti:

1. `modules/edu/lib/training.server.ts` mengelola training event, team, score, ranking.
2. `supabase/migrations/1206_edu_training_scoreboard.sql` membuat event, team, dan score.
3. `supabase/migrations/1226_edu_mode_sessions.sql` menambah realtime session, step, event log.
4. `supabase/migrations/1235_training_course_assessments.sql` dan `1236_training_course_answer_submissions.sql` menunjukkan assessment trail formal.

Makna arsitektural:

- EDU di NIZAM sudah melampaui fitur LMS pelengkap; ini sudah menjadi capability platform strategis.

---

## 11. Implikasi ke Packaging dan GTM

Kalau saya merapikan paket komersial NIZAM, saya akan memakai struktur ini.

### 11.1 Family Produk

1. `Core ERP`
   - Finance Core
   - Revenue Core
   - Purchasing
   - Inventory Core

2. `People Core`
   - HRIS Core

3. `Operations Verticals`
   - Manufacturing
   - Fleet & Rental
   - Service Operations
   - Project & Construction
   - Syirkah

4. `Academy`
   - Learning
   - Assessment
   - EDU Simulation

5. `Growth Add-ons`
   - POS
   - Sales Page
   - Quick Bill
   - Sales AR Cockpit
   - Package Tracking

6. `Advanced Ops Add-ons`
   - Advanced WMS
   - Fleet Maintenance Pack

7. `Integration & Capacity Add-ons`
   - Open API
   - Multi-Entity
   - Seat packs

### 11.2 Manfaat Struktur Ini

1. pricing jadi lebih mudah dipahami,
2. onboarding user menjadi lebih jelas,
3. sertifikasi bisa mengikuti bounded context produk,
4. tim sales tidak perlu menjelaskan terlalu banyak menu sebagai “modul”,
5. roadmap produk akan lebih mudah diprioritaskan.

---

## 12. Implikasi ke Sertifikasi NIZAM

Karena kamu sedang menulis masterplan sertifikasi, implikasinya sangat besar.

### 12.1 Yang Layak Menjadi Jalur Sertifikasi Module

1. Finance Core
2. Revenue Core
3. Purchasing
4. Inventory Core
5. HRIS Core
6. Manufacturing
7. Service Operations
8. Project & Construction
9. Fleet & Rental
10. Syirkah
11. Academy / EDU

### 12.2 Yang Layak Menjadi Sertifikasi Add-on / Specialist

1. POS
2. Advanced WMS
3. Sales Page
4. Open API Integration
5. Fleet Maintenance Pack
6. Multi-Entity Governance
7. Sales AR Cockpit

### 12.3 Yang Sebaiknya Tidak Dijadikan Keluarga Sertifikasi Terpisah

1. CRM mandiri
2. Reports mandiri
3. Attendance mandiri
4. Payroll mandiri
5. Audit sebagai sertifikasi operasi terpisah tanpa konteks governance

Lebih baik capability-capability ini masuk sebagai:

1. subtrack,
2. specialization,
3. suffix competence,
4. governance layer.

---

## 13. Keputusan Final Singkat

Kalau harus dipaksa menjawab dengan sangat tegas:

### Module

1. Finance Core
2. Revenue Core
3. Purchasing
4. Inventory Core
5. HRIS Core
6. Manufacturing
7. Service Operations
8. Project & Construction
9. Fleet & Rental
10. Syirkah
11. Academy / EDU

### Add-on

1. POS
2. Advanced WMS
3. Sales Page
4. Open API & Webhooks
5. Multi-Entity
6. Quick Bill
7. Fleet Maintenance Pack
8. Package Tracking
9. Sales AR Cockpit
10. Sales AR Seat Pack
11. AI / Vision capability

### Bukan Keduanya, tetapi Platform Core

1. Auth
2. Organization / tenant
3. Branch / divisi
4. Roles / permissions
5. Business settings
6. Billing SaaS
7. Support
8. Migration base
9. Dashboard shell

---

## 14. Penutup

Pendapat saya sebagai keputusan arsitektur produk:

1. NIZAM sebaiknya berhenti memikirkan semua capability sebagai “modul”.
2. NIZAM sebaiknya mulai berbicara dalam bahasa `core family`, `vertical module`, dan `add-on`.
3. Pemisahan ini akan membuat produk lebih mudah dijual, lebih mudah diajarkan, dan lebih mudah disertifikasi.
4. Kekuatan terbesar NIZAM justru muncul ketika core ERP, vertical operations, dan academy diposisikan secara sadar dalam satu arsitektur produk yang konsisten.

Kalau struktur ini dipegang konsisten, maka NIZAM tidak hanya terlihat seperti ERP yang besar, tetapi seperti platform capability yang matang.
