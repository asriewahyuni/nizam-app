---
title: "Penawaran: BINTANG MARWAH ENTERPRISE"
description: "**Nomor**  : NZM/PNW/2026/06/001"
sidebar:
  label: "Penawaran: BINTANG MARWAH ENTERPRISE"
---

> Dokumen ini disinkronkan otomatis dari file sumber `PENAWARAN_BINTANG_MARWAH_ENTERPRISE.md` di root project docs.

## Solusi ERP Enterprise — PO Bus & Ekspedisi
---

**Nomor**  : NZM/PNW/2026/06/001
**Tanggal** : 04 Juni 2026
**Kepada**  : Pimpinan / Manajemen **PO Bintang Marwah**
**Perihal** : Penawaran Sistem ERP Terintegrasi — Paket Enterprise Transportasi & Ekspedisi

---

## Pendahuluan

Dengan hormat,

Kami dari **Nizam ERP** mengucapkan terima kasih atas kepercayaan PO Bintang Marwah dalam mempertimbangkan solusi digitalisasi operasional. Berdasarkan diskusi dan kebutuhan yang telah disampaikan, kami menyampaikan penawaran resmi yang mencakup seluruh kebutuhan operasional armada bus dan jasa ekspedisi Bintang Marwah.

Penawaran ini dirancang untuk menjawab kebutuhan spesifik yang telah disampaikan: manajemen armada lintas kota, penjualan tiket multi-channel (langsung, Traveloka, tiket.com, WhatsApp), pengelolaan pool & agen, perawatan berbasis trip, serta operasional bengkel internal.

---

## Struktur Solusi

### A. Platform ERP Enterprise

Fondasi sistem yang mencakup seluruh modul inti untuk operasional bisnis:

| Modul Inti | Fungsi |
|---|---|
| **Akuntansi** | Jurnal double-entry, Neraca, Laba Rugi, Arus Kas |
| **Keuangan** | Kas & Bank, Rekonsiliasi, Aging AR/AP, Aset Tetap (armada bus) |
| **Pembelian** | Purchase Order spare part, BBM, bahan servis |
| **Inventori & Gudang** | Stok spare part, ban, oli — gudang bengkel |
| **Sales & CRM** | Pipeline penjualan, kontrak korporat, manajemen data agen |
| **HRIS & Payroll** | Data karyawan, penggajian driver/kernet/mekanik, absensi |
| **Laporan & Analitik** | Dashboard operasional, laporan keuangan, profitabilitas rute |
| **Konfigurasi** | Pengaturan bisnis, cabang, peran & izin pengguna |

**Kapasitas Platform Enterprise:**

| | |
|---|---|
| Pengguna (user) | **30 akun** |
| Cabang | **10 cabang** |
| Anak Perusahaan | **5 entitas** |

---

### B. Modul PO Bus

Modul vertikal khusus Perusahaan Otobus — terintegrasi penuh dengan Platform Enterprise:

#### 1. Manajemen Armada
- Registrasi unit bus: plat nomor, merek, model, tahun, kapasitas, body type, nomor rangka & mesin
- Status real-time per unit: Tersedia / Beroperasi / Servis / Tidak Aktif
- Integrasi Aset Tetap: nilai buku, akumulasi penyusutan otomatis per bulan
- Odometer tracking per unit

#### 2. Kru & SDM Bus
- Manajemen driver, co-driver, kernet, kondektur
- Data SIM: nomor, masa berlaku, alert expired
- Penugasan kru per jadwal keberangkatan

#### 3. Rute & Jadwal
- Master rute: asal–tujuan, jarak, durasi, harga dasar
- Penjadwalan keberangkatan per unit bus per rute
- Status perjalanan: Terjadwal → Berangkat → Tiba → Batal
- **Penghitungan trip otomatis** per unit — dasar trigger perawatan

#### 4. Manajemen Pool & Agen
- Registrasi Pool (Pool Utama, Agen Resmi, Sub-Agen) beserta data PIC, lokasi, rekening bank
- Sistem deposit saldo pool & riwayat top-up
- **Penetapan harga terpusat dari HQ** — agen tidak dapat mengubah tarif rute
- Settlement komisi agen per periode dengan riwayat pembayaran
- Laporan penjualan & komisi per pool/agen

#### 5. Ticketing Multi-Channel
- Penjualan tiket langsung: walk-in / counter / operator
- Tracking sumber penjualan: Langsung / Traveloka / tiket.com / WhatsApp
- Status tiket: Dipesan → Dibayar → Digunakan → Batal
- Nomor kursi, data penumpang, riwayat per jadwal

#### 6. Perawatan & Bengkel Internal
- **Service trigger berbasis trip:** alert otomatis setiap **12 perjalanan** selesai
- Rekam servis: jenis perawatan, biaya, odometer, teknisi, jadwal servis berikutnya
- Manajemen ban per posisi (FL, FR, RL, RR, spare) dengan tracking mileage
- Work order bengkel internal: penerimaan → diagnosis → pengerjaan → selesai
- Stok spare part bengkel terintegrasi modul Inventori
- Laporan biaya perawatan per unit & per periode

#### 7. Emergency Call
- Log laporan darurat: mogok, kecelakaan, ban bocor, overheat
- Penugasan mekanik respons + tracking status penanganan
- Resolusi & catatan tindak lanjut

#### 8. Checkpoint & Monitoring Perjalanan
- Titik checkpoint GPS sepanjang rute
- Pencatatan waktu lewat per checkpoint per perjalanan

#### 9. Portal Agen Tiket
- Akun login terpisah khusus untuk masing-masing agen
- Agen dapat memantau tiket yang dijual, rekap komisi, dan riwayat pembayaran komisi
- Tidak memiliki akses ke data operasional HQ

---

### C. GPS Live Tracking

- Posisi bus real-time di peta untuk setiap unit armada
- Log perjalanan per trip: riwayat rute, kecepatan, waktu tempuh
- Notifikasi deviasi rute & keterlambatan estimasi tiba
- Dashboard monitoring terpusat untuk dispatcher & manajemen pool

---

### D. Modul Ekspedisi

Untuk divisi jasa pengiriman barang Bintang Marwah:

| Fitur | Detail |
|---|---|
| **Manifest Pengiriman** | Input kiriman: pengirim, penerima, jumlah koli, berat, dimensi |
| **Tarif Pengiriman** | Rate card per rute/kota — tarif per kg, koli, atau volume |
| **Tracking Status** | Diterima → Dalam Perjalanan → Terkirim / Retur |
| **Proof of Delivery** | Upload foto & tanda tangan digital penerima |
| **Agen Ekspedisi** | Manajemen agen penerimaan & pengiriman di kota tujuan |
| **Rekonsiliasi Kas** | Kas tagihan vs kas diterima per agen/driver |
| **Laporan Ekspedisi** | Volume kiriman, pendapatan, on-time delivery rate |

---

## Investasi

### Fase 1 — Berlangganan Bulanan

| Komponen | Harga/Bulan |
|---|---|
| **Platform Enterprise** | Rp 1.490.000 |
| **Modul PO Bus** (armada, kru, rute, jadwal, tiket, agen, pool, servis, bengkel, emergency) | Rp 800.000 |
| **GPS Live Tracking** | Rp 299.000 |
| **Modul Ekspedisi** | Rp 249.000 |
| **Portal Agen Tiket** | Rp 99.000 |
| | |
| **Total Fase 1** | **Rp 2.937.000/bulan** |
| Harga kontrak 12 bulan (diskon 10%) | **Rp 2.643.300/bulan** |
| Harga kontrak 24 bulan (diskon 15%) | **Rp 2.496.450/bulan** |

---

### Fase 2 — Add-On Integrasi *(Opsional, aktivasi kapan saja)*

| Add-On | Harga/Bulan | Keterangan |
|---|---|---|
| **WhatsApp Official API** | Rp 499.000 | Pembelian tiket via WhatsApp Business resmi (Meta Cloud API) |
| **OTA Integration** | Rp 799.000 | Sinkronisasi inventori kursi & rekonsiliasi booking Traveloka + tiket.com |
| | | |
| **Total Fase 1 + Fase 2** | **Rp 4.235.000/bulan** | |
| Dengan diskon kontrak 24 bulan | **Rp 3.799.500/bulan** | |

---

### Biaya Implementasi *(One-Time)*

| Item | Biaya |
|---|---|
| Setup sistem, konfigurasi org & COA | Rp 3.500.000 |
| Migrasi data existing (armada, rute, agen, pool) | Rp 2.000.000 |
| Training tim — 2 sesi online/on-site | **Gratis** |
| Pendampingan go-live bulan pertama | **Gratis** |
| **Total Implementasi** | **Rp 5.500.000** |

> Biaya implementasi **gratis** untuk kontrak berlangganan **24 bulan**.

---

### Ringkasan Skema Investasi

| Skema | Bulanan | Implementasi | Keterangan |
|---|---|---|---|
| Fase 1 · Bulanan | Rp 2.937.000 | Rp 5.500.000 | Fleksibel, bisa batal kapan saja |
| Fase 1 · 12 Bulan | Rp 2.643.300 | Rp 5.500.000 | Hemat Rp 3.524.400/tahun |
| Fase 1 · 24 Bulan | Rp 2.496.450 | **Gratis** | Hemat Rp 10.572.120 + implementasi gratis |
| Fase 1+2 · 24 Bulan | Rp 3.799.500 | **Gratis** | Solusi lengkap termasuk WA & OTA |

> Semua harga belum termasuk PPN 11%.

---

## Timeline Implementasi

| Fase | Durasi | Aktivitas |
|---|---|---|
| **Setup & Migrasi** | Minggu 1–2 | Konfigurasi organisasi, COA, import data armada & rute |
| **Training & UAT** | Minggu 3 | Training admin & operator, uji coba jadwal & ticketing |
| **Go-Live** | Minggu 4 | Operasional penuh, pendampingan langsung |
| **GPS & Bengkel** | Bulan 2 | Aktivasi GPS tracking, work order bengkel internal |
| **Ekspedisi & Portal Agen** | Bulan 2–3 | Aktivasi modul ekspedisi & akun portal per agen |
| **WA API & OTA** *(Fase 2)* | Bulan 3–4 | Setup WhatsApp Business API & integrasi Traveloka/tiket.com |

---

## Dukungan & Jaminan Layanan

| | |
|---|---|
| **Uptime** | 99.5% — berjalan di Railway Cloud dengan auto-restart & monitoring 24/7 |
| **Response Support** | < 4 jam (hari kerja) · < 8 jam (akhir pekan) via chat & email |
| **Backup Data** | Otomatis setiap hari |
| **Update Fitur** | Gratis selama berlangganan aktif |
| **Account Manager** | Dedicated selama kontrak berjalan |
| **Ekspor Data** | Data sepenuhnya milik Bintang Marwah, dapat diekspor kapan saja |

---

## Syarat & Ketentuan

1. Penawaran berlaku **30 hari** sejak tanggal surat
2. Harga belum termasuk PPN 11%
3. Pembayaran berlangganan dilakukan di muka (bulanan / kuartalan / tahunan)
4. Kontrak dapat diperpanjang otomatis atau dibatalkan dengan pemberitahuan 30 hari sebelumnya
5. Data klien tidak digunakan untuk keperluan pihak ketiga

---

## Penutup

Nizam ERP dirancang untuk bisnis transportasi yang ingin beroperasi lebih efisien — dari manajemen armada, kru, dan ticketing multi-channel, hingga pengelolaan agen, pool, dan ekspedisi dalam satu platform terintegrasi dengan akuntansi yang akurat.

Kami siap melakukan presentasi demo langsung atau diskusi lebih lanjut sesuai jadwal yang nyaman bagi Bapak/Ibu.

Hormat kami,

**Tim Nizam ERP**
📧 hello@kliknizam.app
🌐 kliknizam.app

---

*Dokumen ini bersifat konfidensial dan ditujukan khusus untuk PO Bintang Marwah.*
