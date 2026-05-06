# Soal Pelatihan Simulasi Bisnis ERP Nizam App

Dokumen ini dirancang untuk dua tujuan sekaligus:
1. Menjadi bahan latihan peserta.
2. Menjadi skenario uji sistem ERP secara end-to-end.

## Skenario Umum

Peserta berperan sebagai tim operasional dan keuangan dari grup usaha **Nizam Food Group** dengan struktur berikut:

- **Holding/Parent**: `PT Nizam Pangan Nusantara`
- **Anak Perusahaan 1**: `PT Nizam Distribusi Jabar`
- **Anak Perusahaan 2**: `CV Nizam Retail Bandung`

Fokus bisnis grup:

- Holding mengelola modal, kontrol laporan, dan konsolidasi.
- PT Nizam Distribusi Jabar bergerak di distribusi barang grosir.
- CV Nizam Retail Bandung bergerak di penjualan retail/POS.

## Master Data yang Dipakai

Gunakan minimal data berikut selama simulasi:

- Produk `BRS-5KG` = Beras Premium 5 Kg
- Produk `GLA-1KG` = Gula Pasir 1 Kg
- Produk `MNY-2L` = Minyak Goreng 2 Liter
- Supplier `PT Sumber Pangan`
- Customer grosir `Toko Barokah`
- Customer retail umum `Walk In Customer`
- Gudang `Gudang Utama`
- Gudang `Gudang Cabang`
- Rekening bank `BCA Holding`
- Rekening bank `BCA Distribusi`
- Rekening bank `BCA Retail`

## Target Akhir Simulasi

Setelah 10 soal selesai, peserta seharusnya berhasil membuktikan bahwa sistem mampu menangani:

- master data lintas entitas,
- pembelian, stok, penjualan, POS, kas/bank,
- transaksi antar anak perusahaan/holding,
- aset, aging, dan laporan konsolidasi.

## 10 Soal Latihan

### 1. Membuat Struktur Grup Usaha

Buat 1 holding dan 2 anak perusahaan sesuai skenario di atas. Pastikan masing-masing entitas punya minimal 1 cabang/unit aktif.

Verifikasi:

- Holding dapat melihat daftar anak perusahaan.
- Anak perusahaan tercatat di bawah holding yang sama.
- User owner/admin holding dapat berpindah konteks ke parent dan child.

### 2. Menyiapkan Master Data Dasar

Masukkan 3 produk, 1 supplier, 2 customer, 2 gudang, dan rekening bank untuk masing-masing entitas yang relevan.

Verifikasi:

- Produk muncul di modul Inventory/Sales/POS sesuai entitas.
- Supplier muncul di Purchasing.
- Customer muncul di Sales atau POS.
- Rekening bank bisa dipilih di modul Kas/Bank.

### 3. Input Modal Awal per Entitas

Catat modal awal berikut:

- Holding: setor modal tunai ke `BCA Holding` sebesar `Rp500.000.000`
- PT Nizam Distribusi Jabar: saldo awal `BCA Distribusi` sebesar `Rp100.000.000`
- CV Nizam Retail Bandung: saldo awal `BCA Retail` sebesar `Rp50.000.000`

Verifikasi:

- Saldo kas/bank per entitas bertambah sesuai nominal.
- Jurnal otomatis terbentuk dan seimbang.
- Laporan Neraca menampilkan kas/bank dan ekuitas awal.

### 4. Transfer Modal dari Holding ke Anak Perusahaan

Dari entitas holding, lakukan transfer modal ke `PT Nizam Distribusi Jabar` sebesar `Rp150.000.000`.

Verifikasi:

- Saldo `BCA Holding` berkurang.
- Saldo kas/bank entitas anak bertambah.
- Sistem menandai transaksi sebagai transfer antar entitas/inter-org, bukan transfer internal biasa.
- Dampak laporan parent dan child konsisten.

### 5. Pembelian Persediaan Secara Kredit

Pada `PT Nizam Distribusi Jabar`, buat transaksi pembelian dari `PT Sumber Pangan` dengan rincian:

- 200 unit Beras Premium 5 Kg @ `Rp68.000`
- 150 unit Gula Pasir 1 Kg @ `Rp14.000`
- Termin pembayaran `30 hari`

Verifikasi:

- Dokumen pembelian tersimpan.
- Stok masuk ke gudang tujuan.
- Hutang usaha bertambah.
- Nilai persediaan bertambah sesuai total pembelian.

### 6. Mutasi Stok Antar Gudang

Pindahkan stok pada `PT Nizam Distribusi Jabar`:

- 50 unit Beras Premium 5 Kg
- Dari `Gudang Utama`
- Ke `Gudang Cabang`

Verifikasi:

- Stok gudang asal berkurang.
- Stok gudang tujuan bertambah.
- Tidak ada perubahan total stok perusahaan.
- Riwayat mutasi muncul di Inventory dan kartu stok/ledger.

### 7. Penjualan Kredit ke Customer Grosir

Pada `PT Nizam Distribusi Jabar`, buat penjualan kredit ke `Toko Barokah`:

- 80 unit Beras Premium 5 Kg @ `Rp75.000`
- 60 unit Gula Pasir 1 Kg @ `Rp16.500`
- Termin `14 hari`

Verifikasi:

- Faktur penjualan terbentuk.
- Stok barang berkurang dari gudang yang dipilih.
- Piutang usaha bertambah.
- Pendapatan penjualan tercatat di jurnal.

### 8. Penjualan Retail Melalui POS

Pada `CV Nizam Retail Bandung`, lakukan transaksi POS tunai:

- 10 unit Minyak Goreng 2 Liter @ `Rp18.000`
- 15 unit Gula Pasir 1 Kg @ `Rp17.000`
- Customer: `Walk In Customer`

Verifikasi:

- Transaksi kasir tersimpan.
- Stok retail berkurang.
- Kas/bank bertambah sesuai metode bayar.
- Penjualan muncul di laporan penjualan harian.

### 9. Pembelian dan Pencatatan Aset Tetap

Pada `PT Nizam Distribusi Jabar`, beli 1 unit hand pallet/forklift kecil senilai `Rp22.000.000` dan catat sebagai aset tetap.

Verifikasi:

- Transaksi masuk ke modul aset tetap.
- Bukan tercatat sebagai beban operasional biasa.
- Nilai aset muncul di daftar aset dan Neraca.

### 10. Review Laporan Konsolidasi dan Closing Ringan

Dari holding, buka laporan:

- Neraca
- Laba Rugi
- Arus Kas

Bandingkan tampilan `parent only` vs `consolidated` setelah semua transaksi di atas selesai.

Verifikasi:

- Laporan konsolidasi memuat parent + anak perusahaan.
- Angka kas, piutang, hutang, persediaan, pendapatan, dan beban berubah sesuai transaksi latihan.
- Peserta dapat menjelaskan minimal 3 perubahan angka yang muncul akibat simulasi.

## Catatan untuk Fasilitator

Jika ingin menjadikannya sebagai penilaian, gunakan skor sederhana berikut:

- `1 poin` jika transaksi berhasil diinput.
- `1 poin` jika peserta memilih entitas/unit yang benar.
- `1 poin` jika peserta mampu menunjukkan dampaknya pada laporan atau saldo.

Skor maksimal: `30 poin` untuk 10 soal.

## Opsi Bonus

Jika waktu masih ada, tambahkan uji lanjutan berikut:

- approval workflow untuk jurnal atau transaksi antar entitas,
- permintaan akun CoA dari anak perusahaan ke holding,
- audit trail atas transaksi yang sudah dibuat,
- penutupan periode/closing setelah seluruh transaksi selesai.
