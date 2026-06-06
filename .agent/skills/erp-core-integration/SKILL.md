---
name: ERP Core Integration Anti-Silo
description: Wajib digunakan saat membuat fitur bisnis baru agar otomatis terhubung ke sistem Akuntansi, Kas, dan Inventori Nizam App.
---

# 🏭 ERP Core Integration Skill (Anti-Silo)

Selamat datang di modul **Anti-Silo** Nizam App. Repositori ini adalah sistem ERP yang kompleks, di mana fitur-fitur harus berinteraksi satu sama lain. Sebagai AI, Anda dilarang keras membuat fitur yang berdiri sendiri (Silo).

## 🚀 Kapan Menggunakan Skill Ini?
- Setiap kali Anda membuat fitur yang **menerima pembayaran** (Penjualan Kargo, Pembelian Tiket).
- Setiap kali Anda membuat fitur yang **mengeluarkan biaya** (Servis Bus, Pengeluaran Supir).
- Setiap kali Anda membuat fitur yang **memindahkan barang fisik** (Pengambilan Sparepart, Retur Gudang).
- Setiap kali Anda membuat fitur terkait **karyawan atau presensi**.

## 🛠️ Jembatan Operasional (Operational Bridge)
Alih-alih menyentuh tabel `journal_entries`, `journal_lines`, atau `inventory_movements` secara manual menggunakan raw SQL, gunakan fungsi facade/wrapper yang tersedia di `lib/erp-bridge/`.

### 1. Integrasi Finansial (Wajib untuk semua arus uang)

Untuk mencatat uang masuk (Pendapatan):
```typescript
import { ERPBridge } from '@/lib/erp-bridge/finances'

await ERPBridge.recordRevenue({
  orgId: '...',
  branchId: '...',
  amount: 150000,
  date: new Date().toISOString().split('T')[0],
  description: 'Pendapatan Kargo AWB-123',
  referenceType: 'CARGO_RECEIPT',
  referenceId: 'ID_RESI_KARGO',
  debitAccountId: 'ID_AKUN_KAS_BANK', // Biasanya Kas Kecil
  creditAccountId: 'ID_AKUN_PENDAPATAN' // Biasanya Pendapatan Kargo
})
```

Untuk mencatat uang keluar (Beban/Pengeluaran):
```typescript
import { ERPBridge } from '@/lib/erp-bridge/finances'

await ERPBridge.recordExpense({
  orgId: '...',
  branchId: '...',
  amount: 500000,
  date: new Date().toISOString().split('T')[0],
  description: 'Biaya Ganti Oli Bus B 1234 CD',
  referenceType: 'FLEET_MAINTENANCE',
  referenceId: 'ID_SERVIS_LAB',
  debitAccountId: 'ID_AKUN_BEBAN_SERVIS',
  creditAccountId: 'ID_AKUN_KAS_BANK'
})
```

### 2. Integrasi Inventori
Jika Anda mengurangi/menambah stok barang fisik, wajib panggil modul Inventori.
*(Catatan: Anda dapat membuat/menambahkan facade `ERPBridge.inventory` di `lib/erp-bridge/inventory.ts` mengikuti pola finansial di atas).*

## ✅ Checklist Pre-Delivery
Sebelum menyelesaikan pekerjaan dan melapor kepada User, pastikan:
- [ ] Fitur tidak hanya menggunakan status string seperti `'PAID'`. Uang benar-benar masuk ke Buku Besar (GL) melalui `ERPBridge.recordRevenue` atau `recordExpense`.
- [ ] `referenceType` dan `referenceId` diisi dengan benar agar audit trail jurnal dapat diklik kembali ke dokumen asalnya (misal: Resi Kargo).
- [ ] Anda telah memberitahu User akun mana yang digunakan sebagai Debit/Kredit default, sehingga jika salah, User bisa langsung mengoreksinya.
