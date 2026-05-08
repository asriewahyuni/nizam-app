# Langkah Selanjutnya Untuk E-Commerce

Dokumen ini menjawab satu pertanyaan praktis: **setelah fondasi yang sekarang jadi, tim harus mengerjakan apa dulu?**

Urutan di bawah ini sengaja disusun untuk model **pilot jual 1 sampai 3 store**, jadi fokusnya adalah hal yang paling cepat menaikkan kesiapan operasional, conversion, dan kestabilan.

## 1. Prioritas Utama

Kalau harus memilih secara tegas, urutannya adalah:

1. rapikan pengalaman operasional harian
2. rapikan conversion flow pembeli
3. tambah automasi pembayaran dan pengiriman
4. baru naik ke customer portal dan scale-out

## 2. Yang Paling Disarankan Dikerjakan Berikutnya

### Prioritas 1: Halaman operasi untuk tim internal

Ini paling penting kalau store sudah mulai dipakai jualan.

Yang perlu dibuat:

- halaman operasi order yang lebih fokus, bukan hanya tabel review
- filter order berdasarkan:
  - menunggu bukti
  - under review
  - payment exception
  - ERP failed
  - ready to fulfill
- detail order yang lebih dalam:
  - alamat lengkap
  - snapshot item
  - reservation status
  - nomor sales ERP
  - payment ERP id
- aksi manual yang lebih aman untuk tim operasional

Kenapa ini penting:

- tim admin akan lebih banyak hidup di layar operasi daripada layar setup
- saat volume order naik, bottleneck pertama biasanya ada di review dan penanganan exception

### Prioritas 2: Perjelas alur pemenuhan order

Saat ini order sudah bisa masuk ke `READY_TO_FULFILL`, tetapi alur setelah itu masih perlu dibuat lebih rapi.

Yang perlu dibuat:

- status fulfilment yang lebih jelas di dashboard
- tampilan hubungan order e-commerce ke delivery ERP
- penanda reservation `ACTIVE`, `CONSUMED`, `RELEASED`
- alur release reservation jika order batal atau ditolak
- riwayat fulfilment dasar

Kenapa ini penting:

- tim gudang dan admin perlu tahu order sudah berhenti di mana
- tanpa ini, pilot jual akan cepat menumpuk pertanyaan manual

### Prioritas 3: Asset picker yang lebih enak di editor theme

Saat ini asset library sudah bisa dipakai ke blok aktif, tetapi pengalaman marketing masih bisa dibuat lebih halus.

Yang perlu dibuat:

- picker gambar per field, bukan hanya tombol umum `Pakai di Blok Aktif`
- preview gambar langsung di field editor
- support item image picker untuk blok repeater
- validasi jika blok tidak mendukung gambar

Kenapa ini penting:

- tim konten akan lebih cepat kerja
- mengurangi kebingungan saat mengedit blok yang punya banyak image field

### Prioritas 4: Validasi checkout yang lebih ramah orang awam

Yang perlu dirapikan:

- validasi field wajib dengan pesan yang lebih jelas
- petunjuk alamat jika ongkir tidak ketemu
- validasi email dan nomor HP lebih rapi
- pesan error jika produk habis di tengah jalan
- empty state checkout yang lebih membantu

Kenapa ini penting:

- conversion leak paling besar biasanya ada di form checkout
- ini relatif murah dikerjakan tetapi dampaknya besar

## 3. Prioritas Menengah

### Payment gateway

Ini sebaiknya dikerjakan setelah operasi manual stabil.

Yang perlu diputuskan:

- gateway mana yang dipakai
- apakah langsung `capture otomatis` atau `review tertentu`
- bagaimana mapping payment webhook ke ERP
- apakah tetap mempertahankan transfer manual sebagai fallback

Saran:

- jangan jadikan ini prioritas pertama kalau proses manual saja belum stabil

### Ongkir real-time

Yang perlu disiapkan:

- integrasi kurir
- normalisasi alamat
- fallback bila API kurir gagal
- snapshot ongkir real-time saat checkout

Saran:

- kerjakan setelah zona ongkir manual terbukti cukup untuk pilot

### Customer portal ringan

Yang bisa dibuat dulu:

- cari order lewat email atau nomor order
- lihat status order
- lihat status pembayaran
- lihat status pengiriman

Saran:

- tidak perlu langsung bikin akun customer penuh

## 4. Prioritas Setelah Pilot Stabil

Hal-hal ini penting, tetapi bukan langkah pertama setelah fondasi saat ini:

- payment gateway penuh
- customer login dan histori order
- return dan refund mandiri
- multi-warehouse allocation yang lebih pintar
- marketplace connector
- POS dan omnichannel sync
- courier tracking penuh
- analytics conversion yang lebih detail

## 5. Checklist Operasional Yang Harus Dilakukan Tim

Selain coding, ada pekerjaan operasional yang harus dilakukan agar fitur yang sudah ada benar-benar bisa dipakai:

### Sebelum buka store

- pastikan store punya rekening penerima
- pastikan instruksi transfer sudah jelas
- pastikan zona dan tarif ongkir aktif
- pastikan minimal ada beberapa produk tayang
- pastikan theme published sudah rapi
- pastikan admin tahu cara approve, reject, dan retry ERP

### Saat pilot mulai jalan

- tentukan siapa yang review pembayaran
- tentukan SLA review bukti bayar
- tentukan siapa yang tangani order exception
- tentukan siapa yang cek sinkron ERP gagal
- tentukan siapa yang follow up order siap fulfilment

### Setelah pilot berjalan beberapa hari

- cek order mana yang paling sering gagal
- cek alamat mana yang paling sering tidak cocok ongkir
- cek apakah pelanggan bingung di halaman order publik
- cek apakah admin sering pakai retry ERP

## 6. Rencana Kerja Yang Disarankan

Kalau dikerjakan bertahap, urutan paling aman adalah:

### Sprint 1

- halaman operasi order internal
- detail fulfilment dan reservation status
- filter review queue yang lebih rapi

### Sprint 2

- penyempurnaan checkout dan validasi alamat
- asset picker yang lebih enak di theme editor
- perbaikan pesan error publik

### Sprint 3

- payment gateway atau customer portal ringan, pilih salah satu dulu

## 7. Definisi Siap Jual Yang Lebih Masuk Akal

Store bisa disebut **siap jual pilot** bila:

- store published
- theme published
- katalog publik tersedia
- ongkir aktif
- instruksi transfer aktif
- checkout berhasil
- halaman order publik bisa dibuka lagi
- upload bukti bayar berhasil
- admin bisa approve
- ERP sync berhasil
- order muncul siap dipenuhi

Kalau salah satu mata rantai ini belum stabil, lebih baik fokus memperkuatnya dulu daripada menambah fitur baru yang lebar.

## 8. Rekomendasi Penutup

Langkah paling masuk akal berikutnya adalah:

1. buat layar operasi order yang lebih dalam
2. rapikan status fulfilment sampai reservation terbaca jelas
3. haluskan checkout dan halaman order publik

Setelah tiga hal itu stabil, baru masuk ke payment gateway atau courier real-time.
