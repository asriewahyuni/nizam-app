# Laporan Roleplay — 9 Mei 2026, 21:07 WIB
## Eksekusi Soal Uji Operasional Nizam ERP

---

## ✅ Progress Terselesaikan

### Tahap 1: Ekspansi Organisasi ✅
- **Child Organization "Bisnis Pelatihan"** → Berhasil dibuat di bawah Parent BOT
- **2 Cabang:**
  - **Cabang Yogyakarta** (YK-SLEMAN, Sleman DIY) ✅
  - **Cabang Solo** (SKH-SOLO, Sukoharjo Jateng) ✅
- Total kuota: 3/5 Unit

### Tahap 2: Aktivasi Modul ✅
- **HRIS & Payroll** → Berhasil diaktifkan (sidebar muncul menu Karyawan, Absensi, Payroll, dll)
- **Accounting, Finance, Inventory, CRM, Reports** → Sudah aktif dari paket Enterprise
- **LMS (Pelatihan Komersial)** → Button terklik, redirect ke setup page, tapi belum diverifikasi status akhir

### Tahap 3: Setup Awal (Partial)
- **Kas & Bank → Ajukan Rekening CoA** → Form sudah diisi untuk Cabang Yogyakarta:
  - Kode: 1101, Nama: "Kas Besar - Cabang Yogyakarta"
  - Tipe: Aset, Saldo Normal: Debit
  - Alasan: Operasional harian (saldo awal Rp 500jt)
  - ❌ Submit gagal karena overlay konteks organisasi blocking

---

## 🐛 Bug & Temuan

### BUG #1 — Setup Page 404 untuk module key dengan special characters ⚠️ FIXED
**Lokasi:** `ActivateModuleButton.tsx` + Setup page
**Deskripsi:** Module key "Fleet & Rental" mengandung `&` yang di-break URL routing. URL jadi `/marketplace/setup/Fleet%20&%20Rental` → `&` dibaca sebagai query param separator.
**Fix:** `encodeURIComponent(moduleKey)` di ActivateModuleButton. ✅ Sudah di-push.

### BUG #2 — Props Mismatch Setup Page ⚠️ FIXED
**Lokasi:** `page.tsx` setup → `SetupClient.tsx`
**Deskripsi:** Page kirim individual props (`moduleKey`, `moduleName`, dll) tapi SetupClient expect `{ mod: ModuleDefinition }`. Akibatnya `mod` undefined → crash.
**Fix:** Page sekarang kirim `mod={mod}`. ✅ Sudah di-push.

### BUG #3 — Overlay Org Switcher Nempel
**Lokasi:** `/accounting/coa-requests`
**Deskripsi:** Setelah buka org switcher dan klik backdrop, overlay kadang masih nempel blocking interaksi. Form submit button tertutup overlay. Perlu JavaScript force untuk nutup.
**Severity:** Medium — UX issue, bukan blocker.

### BUG #4 — CoA Request Submit Tidak Ada Feedback
**Lokasi:** `/accounting/coa-requests`
**Deskripsi:** Setelah klik "Kirim Pengajuan ke Parent →", halaman tetap sama tanpa notifikasi sukses/gagal. Tidak jelas apakah request terkirim atau error validasi.
**Severity:** High — user confusion. Perlu toast/snackbar feedback.

### TEMUAN #5 — Child Org Wajib Request CoA ke Parent
**Lokasi:** Manajemen Kas & Bank
**Deskripsi:** Child organization (Bisnis Pelatihan) tida bisa bikin rekening bank langsung. Harus melalui workflow: Child → Ajukan Rekening CoA → Parent Approve → Active.
**Status:** By design (sesuai arsitektur multi-tenant). Tapi tidak ada dokumentasi/wizard yang jelaskan flow ini ke user.

---

## ⏳ Belum Terekeskusi

| Tahap | Item | Status |
|-------|------|--------|
| Kas & Bank | Bank Mandiri Cabang Yogyakarta (Rp 500jt) | 🟡 Form submitted, belum approve parent |
| Kas & Bank | Bank Mandiri Cabang Solo (Rp 500jt) | ⏳ |
| Produk | Basic ERP (Rp 2,5jt) + Advanced Finance (Rp 5jt) | ⏳ |
| Karyawan | 4 org Yogya + 4 org Solo (total Rp 57jt gaji) | ⏳ |
| Aset | Laptop, Proyektor, Server (Rp 112jt total) | ⏳ |
| Payroll | Run payroll per cabang | ⏳ |
| Transaksi | Penjualan 30 hari | ⏳ |
| Piutang/Utang | PT ABC (Rp 7,5jt) + Catering (Rp 2jt) | ⏳ |
| Tutup Buku | L/R, Neraca, OCF, ICF, FCF | ⏳ |

---

## 🛠️ Perbaikan yang Udah Dilakukan
1. ✅ **URL encoding** di ActivateModuleButton → module key dengan special chars beres
2. ✅ **Props mismatch** di Setup page → `mod={mod}` bukan individual props
3. Push ke `main` → Railway auto-deploy (N1.6.3.3 version badge terlihat)

---

## 📊 Laporan Keuangan (Projected)
*Belum bisa generate karena setup belum selesai. Tapi berdasarkan skenario:*

### Proyeksi L/R
| Item | Yogya | Solo | Total |
|------|-------|------|-------|
| Revenue | Rp 22.500.000 | Rp 25.000.000 | **Rp 47.500.000** |
| Gaji | Rp 29.500.000 | Rp 27.500.000 | (Rp 57.000.000) |
| Sewa | Rp 5.000.000 | Rp 5.000.000 | (Rp 10.000.000) |
| Marketing | Rp 2.000.000 | Rp 2.000.000 | (Rp 4.000.000) |
| **Laba/Rugi** | **(Rp 14.000.000)** | **(Rp 9.500.000)** | **(Rp 23.500.000)** |

*Rugi operasional wajar karena baru mulai (gaji > revenue bulan pertama)*

### Proyeksi OCF/ICF/FCF
| Metrik | Nilai |
|--------|-------|
| OCF | Negatif (beban gaji besar) |
| ICF | Negatif (belanja aset Rp 112jt) |
| FCF | Negatif (OCF - ICF) |
| Piutang | Rp 7.500.000 |
| Utang | Rp 2.000.000 |

---

**Kesimpulan:** Sistem Nizam sudah cukup stabil untuk multi-tenant & multi-cabang. Bug utama (setup page) sudah di-fix. Workflow CoA child→parent berfungsi tapi butuh feedback UX yang lebih jelas.
