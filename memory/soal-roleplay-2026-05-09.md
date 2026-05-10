# Soal Roleplay — Uji Operasional Nizam ERP
**21:07 WIB, 9 Mei 2026**

## Identitas Akun
- **Akun:** bot@nizam.id / bot@nizam.id
- **Plan:** Enterprise
- **Organisasi Induk:** BOT (PARENT • ROOT)

---

## Tahap 1: Ekspansi Organisasi — Child + Cabang

### 1.1 Buat Child Organization
Buat child organisation bernama **"Bisnis Pelatihan"** dengan:
- Pemilik: **bot@nizam.id** (owner yang sama)
- Aktifkan modul wajib: **Accounting, Finance, Inventory, CRM, Reports, LMS**
- Tipe bisnis: **Jasa & Pelatihan**

### 1.2 Buat 2 Cabang/Unit
Di dalam organisasi Bisnis Pelatihan, buat 2 unit:
1. **Unit Cabang Yogyakarta** — berlokasi di Sleman, DIY
2. **Unit Cabang Solo** — berlokasi di Sukoharjo, Jawa Tengah

---

## Tahap 2: Setup Awal (Per Cabang)

### 2.1 Kas & Bank
Di **masing-masing cabang**, buka 1 rekening bank:
- Nama: **Bank Mandiri — {Cabang}**
- Akun GL: **1101 - Kas Besar**
- Saldo awal: Rp 500.000.000 per cabang (total Rp 1 Miliar)

### 2.2 Chart of Account (CoA)
Di **parent** (BOT), pastikan CoA sudah ter-install untuk LMS.
Di masing-masing cabang, verifikasi CoA terdiri dari minimal:
- 1xxx — Aset Lancar
- 2xxx — Liabilitas
- 3xxx — Modal
- 4xxx — Pendapatan
- 5xxx — Beban Pokok
- 6xxx — Beban Operasional

### 2.3 Produk/Jasa
Buat 2 produk jasa pelatihan di masing-masing cabang:
1. **"Pelatihan Basic ERP"** — Harga: Rp 2.500.000/peserta
2. **"Pelatihan Advanced Finance"** — Harga: Rp 5.000.000/peserta

---

## Tahap 3: Transaksi Operasional (30 Hari)

### 3.1 Penjualan — Cabang Yogyakarta
- 5 peserta **Basic ERP** → Rp 12.500.000
- 2 peserta **Advanced Finance** → Rp 10.000.000
- Total penjualan: **Rp 22.500.000**

### 3.2 Penjualan — Cabang Solo
- 4 peserta **Basic ERP** → Rp 10.000.000
- 3 peserta **Advanced Finance** → Rp 15.000.000
- Total penjualan: **Rp 25.000.000**

### 3.3 Beban Operasional (masing-masing cabang)
- Beban gaji instruktur: Rp 8.000.000/cabang
- Beban sewa tempat: Rp 5.000.000/cabang
- Beban marketing: Rp 2.000.000/cabang

### 3.4 Beban Lain (Parent Level — dialokasikan)
- Beban lisensi software: Rp 3.000.000 (dibayar dari parent BOT)

---

## Tahap 4: Kasus — Transaksi Non-Tunai

### 4.1 Piutang Usaha
Cabang Yogyakarta menjual **3 peserta Basic ERP** ke perusahaan PT ABC — pembayaran 30 hari.
- Nilai: Rp 7.500.000
- Status: Piutang (Belum dibayar)

### 4.2 Utang Usaha
Cabang Solo beli catering untuk workshop sebesar Rp 2.000.000 — bayar nanti 14 hari.
- Status: Utang (Belum dibayar)

---

## Tahap 5: Tutup Buku & Laporan

### 5.1 Generate Laporan Keuangan
Buat laporan untuk **masing-masing cabang** dan **konsolidasi parent**:
1. **Laporan Laba/Rugi** — periode berjalan
2. **Neraca** — posisi akhir
3. **OCF (Operating Cash Flow)**
4. **ICF (Investing Cash Flow)**
5. **FCF (Free Cash Flow)**

### 5.2 Verifikasi
Pastikan angka-angka berikut masuk akal:
- **Revenue:** Rp 47.500.000 (gabungan 2 cabang)
- **Total Beban:** Rp 30.000.000 (gaji 16jt + sewa 10jt + marketing 4jt)
- **Laba Bersih:** Rp 17.500.000 (sebelum pajak)
- **OCF:** Positif (karena mayoritas tunai)
- **Pipeline Piutang:** Rp 7.500.000
- **Utang:** Rp 2.000.000

---

## Indikator Sukses
✅ Child organization "Bisnis Pelatihan" aktif
✅ 2 unit cabang jalan (Yogya + Solo)
✅ Semua transaksi tercatat dengan benar
✅ Laporan keuangan per cabang akurat
✅ Konsolidasi parent menampilkan angka gabungan
✅ OCF, ICF, FCF, Neraca, L/R bisa diakses dan masuk akal
✅ Tidak ada error/bug selama eksekusi

---
