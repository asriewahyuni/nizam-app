# GTM NIZAM: Module, Add-on, dan Packaging

## Status Dokumen

- Versi: `1.0`
- Tanggal: `30 April 2026`
- Tujuan: `menerjemahkan klasifikasi produk NIZAM ke bahasa Go-To-Market agar bisa dipakai untuk packaging, pricing, positioning, dan enablement penjualan`

---

## 1. Ringkasan Eksekutif

Kalau dibawa ke bahasa pasar, NIZAM sebaiknya tidak dijual sebagai "ERP besar dengan banyak menu".

NIZAM lebih tepat diposisikan sebagai:

1. `Core ERP Platform` untuk operasional bisnis,
2. `Operations Verticals` untuk industri atau pola operasi khusus,
3. `Growth Add-ons` untuk memperluas channel dan produktivitas,
4. `Integration & Capacity Add-ons` untuk kebutuhan enterprise,
5. `Academy / EDU` sebagai pembeda besar untuk onboarding, enablement, dan sertifikasi.

Kesimpulan GTM utamanya:

1. jual `core family` dulu,
2. upsell `vertical module` setelah core cocok,
3. cross-sell `add-on` berdasarkan kebutuhan nyata,
4. pakai `Academy / EDU` sebagai pembeda kompetitif,
5. jangan menjual semua capability sebagai module setara.

---

## 2. Bahasa Produk yang Disarankan

Supaya tim sales, produk, dan training memakai bahasa yang sama, saya sarankan struktur istilah berikut.

| Istilah | Makna GTM |
|---|---|
| `Platform Core` | fondasi yang selalu ada dan tidak dijual sebagai produk domain utama |
| `Core Family` | keluarga module inti yang dipakai mayoritas tenant |
| `Vertical Module` | module khusus operasi atau industri tertentu |
| `Add-on` | capability tambahan yang menempel ke core atau vertical |
| `Capacity Add-on` | tambahan entitas, seat, cabang, atau kapasitas |
| `Growth Add-on` | capability untuk akuisisi, penjualan, collection, atau ekspansi channel |
| `Integration Add-on` | API, webhook, integrasi partner, dan interoperability |
| `Academy` | capability learning, assessment, simulation, dan sertifikasi |

---

## 3. Arsitektur Produk untuk GTM

### 3.1 Platform Core

Ini tidak dijual sebagai module terpisah, tetapi selalu melekat.

Isi:

1. auth,
2. organization / tenant,
3. branch / unit,
4. role / permission,
5. business settings,
6. dashboard shell,
7. billing,
8. support,
9. migrasi dasar.

Posisi GTM:

- `always included`
- dipakai untuk menjelaskan bahwa NIZAM sudah enterprise-ready dari sisi governance.

### 3.2 Core Families

Ini fondasi penjualan utama.

1. `Finance Core`
2. `Revenue Core`
3. `Purchasing`
4. `Inventory Core`
5. `HRIS Core`

Posisi GTM:

- ini yang menjadi basis paket,
- ini yang paling cocok dipakai untuk packaging bertingkat,
- ini yang paling mudah dijelaskan ke customer umum.

### 3.3 Vertical Modules

Ini dipakai untuk diferensiasi dan upsell yang lebih spesifik.

1. `Manufacturing`
2. `Fleet & Rental`
3. `Service Operations`
4. `Project & Construction`
5. `Syirkah`

Posisi GTM:

- dijual ketika core sudah relevan,
- dipakai untuk memperdalam nilai di segmen tertentu,
- menjadi alasan kuat kenapa NIZAM lebih cocok daripada ERP generik.

### 3.4 Growth Add-ons

1. `POS`
2. `Sales Page`
3. `Quick Bill`
4. `Sales AR Cockpit`
5. `Package Tracking`

Posisi GTM:

- dipakai untuk mempercepat ROI,
- mudah dijual sebagai perluasan use case,
- cocok untuk upsell setelah tenant aktif.

### 3.5 Advanced Operations Add-ons

1. `Advanced WMS`
2. `Fleet Maintenance Pack`

Posisi GTM:

- untuk customer yang operasinya makin kompleks,
- bukan entry package,
- dijual saat pain point operasional sudah jelas.

### 3.6 Integration & Capacity Add-ons

1. `Open API & Webhooks`
2. `Multi-Entity`
3. `seat pack`
4. `branch/entity expansion`

Posisi GTM:

- untuk enterprise, partner, dan implementasi lanjut,
- memperbesar ACV tanpa membingungkan paket inti.

### 3.7 Academy / EDU

Isi:

1. learning,
2. assessment,
3. EDU simulation,
4. transcript,
5. sertifikasi.

Posisi GTM:

- bukan sekadar fitur tambahan,
- dipakai sebagai `moat` dan `trust amplifier`,
- sangat kuat untuk onboarding, partner enablement, dan retensi.

---

## 4. Klasifikasi Capability ke Bahasa Pasar

| Capability | Klasifikasi Produk | Bahasa Jual |
|---|---|---|
| Accounting + Finance | `Core Family` | kontrol keuangan dan disiplin operasional |
| Sales + CRM | `Core Family` | pipeline sampai transaksi penjualan |
| Purchasing | `Core Family` | pengadaan dan kontrol pembelian |
| Inventory | `Core Family` | stok dan produk inti |
| HRIS + Payroll | `Core Family` | data karyawan, absensi, dan penggajian |
| Manufacturing | `Vertical Module` | produksi dan costing |
| Fleet & Rental | `Vertical Module` | armada, booking, dan operasi kendaraan |
| Service Operations | `Vertical Module` | job order dan layanan |
| Project & Construction | `Vertical Module` | proyek, RAB, progres, termin |
| Syirkah | `Vertical Module` | kerja sama syariah dan akad |
| POS | `Growth Add-on` | channel kasir untuk bisnis yang sudah menjual |
| Advanced WMS | `Advanced Ops Add-on` | kontrol gudang tingkat lanjut |
| Sales Page | `Growth Add-on` | landing page dan lead capture |
| API | `Integration Add-on` | koneksi sistem luar dan partner |
| Multi-Entity | `Capacity Add-on` | kelola banyak entitas |
| EDU / Academy | `Strategic Module` | onboarding, simulasi, assessment, sertifikasi |

---

## 5. Packaging yang Saya Sarankan

### 5.1 Paket 1: Core Commerce

Cocok untuk:

1. bisnis dagang,
2. retail,
3. distributor kecil,
4. usaha yang fokus jualan dan kontrol dasar.

Isi:

1. Revenue Core
2. Inventory Core
3. Purchasing
4. laporan dasar
5. Platform Core

Add-on yang paling relevan:

1. POS
2. Sales Page
3. Quick Bill
4. Package Tracking

### 5.2 Paket 2: Core Finance & Operations

Cocok untuk:

1. bisnis yang mulai butuh kontrol keuangan formal,
2. perusahaan dengan owner yang ingin disiplin data,
3. bisnis multi tim yang butuh approval dan closing.

Isi:

1. Finance Core
2. Revenue Core
3. Purchasing
4. Inventory Core
5. Platform Core

Add-on yang paling relevan:

1. Sales AR Cockpit
2. API
3. Multi-Entity

### 5.3 Paket 3: People & Operations

Cocok untuk:

1. perusahaan dengan tim karyawan aktif,
2. bisnis yang payroll dan absensinya mulai rumit,
3. organisasi yang ingin integrasi operasional dan SDM.

Isi:

1. Paket Core Finance & Operations
2. HRIS Core

Add-on yang paling relevan:

1. Academy / EDU
2. Multi-Entity

### 5.4 Paket 4: Vertical Specialized

Cocok untuk:

1. pabrik,
2. armada,
3. jasa/workshop,
4. kontraktor/arsitek,
5. bisnis syariah tertentu.

Isi:

1. core family yang relevan,
2. satu atau lebih vertical module.

Contoh:

1. `Core + Manufacturing`
2. `Core + Fleet & Rental`
3. `Core + Service Operations`
4. `Core + Project & Construction`
5. `Core + Syirkah`

### 5.5 Paket 5: Enterprise / Platform Extension

Cocok untuk:

1. grup usaha,
2. partner implementasi,
3. organisasi yang butuh integrasi,
4. perusahaan yang ingin enablement formal.

Isi:

1. core families,
2. selected verticals,
3. API,
4. Multi-Entity,
5. Academy / EDU,
6. partner / training capability.

---

## 6. Persona dan Jalur Jual

### 6.1 Owner / Founder

Yang dijual:

1. kontrol bisnis,
2. visibilitas,
3. disiplin keuangan,
4. pengurangan kebocoran,
5. onboarding tim lebih cepat.

Produk paling relevan:

1. Finance Core
2. Revenue Core
3. Inventory Core
4. HRIS Core
5. Academy / EDU

### 6.2 Admin Operasional

Yang dijual:

1. alur kerja lebih rapi,
2. transaksi harian lebih cepat,
3. approval dan laporan lebih jelas,
4. lebih sedikit pekerjaan manual.

Produk paling relevan:

1. Core families
2. POS
3. Quick Bill
4. Sales AR Cockpit

### 6.3 Operasional Khusus

Yang dijual:

1. workflow yang sesuai domain kerja,
2. pengurangan spreadsheet,
3. kontrol proses lapangan.

Produk paling relevan:

1. Manufacturing
2. Fleet & Rental
3. Service Operations
4. Project & Construction
5. Syirkah

### 6.4 Tim IT / Integrator

Yang dijual:

1. API,
2. multi-entity,
3. kontrol akses,
4. partner enablement,
5. simulation dan sandbox.

Produk paling relevan:

1. Integration Add-ons
2. Capacity Add-ons
3. Academy / EDU

---

## 7. Posisi Academy / EDU dalam GTM

Ini bagian paling strategis.

Mayoritas ERP hanya menjual software.
NIZAM bisa menjual:

1. software,
2. pembelajaran,
3. simulasi,
4. assessment,
5. sertifikasi.

Bahasa jual yang bisa dipakai:

1. `lebih cepat go-live`,
2. `lebih cepat user baru produktif`,
3. `lebih sedikit kesalahan operasional`,
4. `lebih mudah standarisasi cabang dan partner`,
5. `lebih kredibel untuk ekosistem implementasi`.

Posisi GTM Academy:

1. bisa dibundel di paket tertentu,
2. bisa dijual sebagai premium enablement,
3. bisa jadi pilar partner program,
4. bisa jadi fondasi sertifikasi resmi NIZAM.

---

## 8. Narasi Penjualan yang Disarankan

### 8.1 Narasi Level Umum

`NIZAM adalah platform operasional bisnis yang tidak berhenti di software. Core ERP-nya mengelola transaksi, vertical module-nya menyesuaikan operasi nyata, dan Academy-nya membuat tim lebih cepat siap kerja.`

### 8.2 Narasi untuk Bisnis Dagang / Retail

`Mulai dari Revenue Core, Inventory, Purchasing, dan Finance. Setelah operasi dasar rapi, tinggal tambahkan POS, Sales Page, atau AR Cockpit sesuai kebutuhan pertumbuhan.`

### 8.3 Narasi untuk Bisnis Operasi Khusus

`Mulai dari core control dulu, lalu aktifkan module vertical yang sesuai: manufacturing, fleet, jasa, konstruksi, atau syirkah.`

### 8.4 Narasi untuk Enterprise / Partner

`NIZAM tidak hanya memberi sistem, tetapi juga governance tenant, integration surface, dan Academy untuk standardisasi implementasi dan kompetensi user.`

---

## 9. Apa yang Sebaiknya Tidak Dilakukan dalam GTM

1. Jangan menjual semua capability sebagai modul yang setara satu sama lain.
2. Jangan membuat calon customer membaca menu terlalu dini.
3. Jangan menjelaskan produk berdasarkan struktur route internal.
4. Jangan memecah `CRM`, `Reports`, `Attendance`, dan `Payroll` sebagai produk terpisah jika itu justru membuat bingung.
5. Jangan menjual vertical terlalu awal sebelum core pain point customer jelas.

---

## 10. Implikasi ke Pricing

Secara prinsip, pricing sebaiknya mengikuti bentuk berikut:

1. `base package` berdasarkan core family,
2. `vertical uplift` untuk module khusus,
3. `add-on uplift` untuk channel, integration, atau advanced ops,
4. `capacity uplift` untuk entitas, seat, atau ekspansi,
5. `enablement uplift` untuk academy, training, atau certification.

Artinya:

- core menentukan titik masuk,
- vertical menentukan diferensiasi,
- add-on menentukan perluasan ARPU,
- academy menentukan retensi dan trust.

---

## 11. Implikasi ke Sertifikasi

Bahasa GTM dan bahasa sertifikasi harus selaras.

Yang paling kuat dijadikan keluarga sertifikasi:

1. Finance Core
2. Revenue Core
3. Purchasing
4. Inventory Core
5. HRIS Core
6. Manufacturing
7. Fleet & Rental
8. Service Operations
9. Project & Construction
10. Syirkah
11. Academy / EDU

Yang lebih tepat dijadikan spesialisasi atau add-on certification:

1. POS
2. Advanced WMS
3. Sales Page
4. API Integration
5. Multi-Entity Governance
6. Sales AR Cockpit

---

## 12. Keputusan GTM Final

Kalau harus dibuat sangat singkat:

### Core Families

1. Finance Core
2. Revenue Core
3. Purchasing
4. Inventory Core
5. HRIS Core

### Vertical Modules

1. Manufacturing
2. Fleet & Rental
3. Service Operations
4. Project & Construction
5. Syirkah

### Strategic Module

1. Academy / EDU

### Growth Add-ons

1. POS
2. Sales Page
3. Quick Bill
4. Sales AR Cockpit
5. Package Tracking

### Advanced Ops Add-ons

1. Advanced WMS
2. Fleet Maintenance Pack

### Integration & Capacity Add-ons

1. Open API
2. Multi-Entity
3. Seat Pack
4. Branch / entity expansion

---

## 13. Penutup

Dalam bahasa GTM, inti persoalannya bukan "fitur apa saja yang ada".

Intinya adalah:

1. apa yang jadi pintu masuk penjualan,
2. apa yang jadi pembeda pasar,
3. apa yang jadi jalur upsell,
4. apa yang membuat customer lebih cepat berhasil.

Kalau NIZAM memakai struktur ini dengan konsisten, maka penawarannya akan jauh lebih tajam:

1. `Core ERP` untuk kebutuhan umum,
2. `Vertical Modules` untuk kebutuhan khusus,
3. `Add-ons` untuk pertumbuhan,
4. `Academy` untuk adopsi, kompetensi, dan sertifikasi.

Itu akan membuat NIZAM terlihat bukan hanya sebagai software ERP, tetapi sebagai platform operasional dan capability ecosystem.
