# Standar Resmi Versioning NIZAM Full

## Status Dokumen

- Versi dokumen: `1.0`
- Tanggal: `30 April 2026`
- Status: `resmi untuk dipakai sebagai acuan internal`
- Ruang lingkup: `NIZAM Full product versioning`

---

## 1. Tujuan

Dokumen ini menetapkan standar resmi versioning untuk `NIZAM Full`.

Standar ini dibuat agar:

1. versi produk mudah dibaca,
2. perubahan bisa dilacak secara disiplin,
3. tim produk, engineering, onboarding, support, training, dan sertifikasi memakai bahasa versi yang sama,
4. perubahan `core`, `module`, dan `add-on` dapat dibedakan dengan jelas,
5. roadmap dan release note NIZAM lebih mudah diaudit.

---

## 2. Prinsip Dasar

Standar versioning NIZAM Full harus memenuhi lima prinsip:

1. `jelas`: orang non-teknis tetap bisa memahami arti versi,
2. `scalable`: tidak cepat mentok walau module dan add-on bertambah,
3. `auditable`: mudah ditelusuri untuk support, implementation, dan sertifikasi,
4. `hierarkis`: perubahan terbesar harus terlihat paling depan,
5. `operasional`: bisa dipakai untuk engineering, pricing, GTM, dan academy sekaligus.

---

## 3. Keputusan Resmi

Ide dasar yang dipakai adalah:

1. segmen pertama mewakili `Core`,
2. segmen kedua mewakili `Module`,
3. segmen ketiga mewakili `Add-on`.

Namun, untuk menjaga skalabilitas dan keterbacaan, standar resmi **tidak** memakai satu digit tempel seperti `123`.

Standar resmi yang ditetapkan adalah:

`NIZAM Full vC.M.A.P`

Keterangan:

1. `C` = `Core`
2. `M` = `Module`
3. `A` = `Add-on`
4. `P` = `Patch`

Contoh:

`NIZAM Full v1.4.2.0`

Artinya:

1. core generation saat ini adalah `1`,
2. baseline module berada di iterasi `4`,
3. baseline add-on berada di iterasi `2`,
4. belum ada patch tambahan pada baseline itu.

---

## 4. Format Resmi

### 4.1 Format Internal Lengkap

Format resmi internal:

`vC.M.A.P`

Contoh:

1. `v1.0.0.0`
2. `v1.3.0.0`
3. `v1.3.2.0`
4. `v1.3.2.5`
5. `v2.0.0.0`

### 4.2 Format Publik Ringkas

Untuk komunikasi eksternal atau tampilan yang lebih ringkas, versi boleh ditulis:

`vC.M.A`

Contoh:

1. `v1.3.2`
2. `v2.0.0`

Catatan:

1. `Patch` boleh disembunyikan di tampilan publik,
2. tetapi sistem internal, release notes, changelog, training pack, dan certification registry tetap harus menyimpan versi lengkap `vC.M.A.P`.

---

## 5. Makna Setiap Segmen

### 5.1 Core

Segmen `Core` naik jika ada perubahan besar pada fondasi platform NIZAM.

Area yang termasuk `Core`:

1. auth,
2. organization / tenant,
3. branch / unit,
4. roles / permissions,
5. business settings,
6. billing foundation,
7. support foundation,
8. migration foundation,
9. dashboard shell,
10. platform governance dasar,
11. arsitektur data utama yang memengaruhi lintas module.

Makna bisnis:

- perubahan `Core` berarti generasi fondasi produk berubah.

### 5.2 Module

Segmen `Module` naik jika ada perubahan signifikan pada keluarga module utama, sementara fondasi core tetap.

Area yang termasuk `Module`:

1. Finance Core,
2. Revenue Core,
3. Purchasing,
4. Inventory Core,
5. HRIS Core,
6. Manufacturing,
7. Fleet & Rental,
8. Service Operations,
9. Project & Construction,
10. Syirkah,
11. Academy / EDU.

Makna bisnis:

- perubahan `Module` berarti kemampuan kerja utama NIZAM berkembang.

### 5.3 Add-on

Segmen `Add-on` naik jika perubahan utama terjadi pada capability tambahan tanpa mengubah fondasi core atau baseline module secara besar.

Area yang termasuk `Add-on`:

1. POS,
2. Advanced WMS,
3. Sales Page,
4. Open API & Webhooks,
5. Multi-Entity,
6. Quick Bill,
7. Fleet Maintenance Pack,
8. Package Tracking,
9. Sales AR Cockpit,
10. Sales AR Seat Pack,
11. add-on resmi lain yang ditetapkan kemudian.

Makna bisnis:

- perubahan `Add-on` berarti ekspansi capability tambahan berkembang.

### 5.4 Patch

Segmen `Patch` naik jika perubahan bersifat:

1. bug fix,
2. hardening,
3. minor adjustment,
4. compatibility fix,
5. hotfix,
6. tuning non-struktural.

Makna bisnis:

- patch tidak mengubah generation core, baseline module, atau baseline add-on.

---

## 6. Aturan Resmi Kenaikan Versi

### 6.1 Kenaikan Core

Naikkan `Core` jika:

1. ada perubahan mendasar pada auth,
2. ada perubahan besar pada tenancy atau organization model,
3. ada perubahan lintas-module yang memengaruhi struktur fondasi,
4. ada pergeseran generasi arsitektur platform,
5. ada perubahan compatibility besar yang wajib diketahui semua pihak.

Saat `Core` naik:

- `Module`, `Add-on`, dan `Patch` harus di-reset ke `0`.

Contoh:

- dari `v1.8.6.4` menjadi `v2.0.0.0`

### 6.2 Kenaikan Module

Naikkan `Module` jika:

1. ada gelombang perubahan besar pada satu atau lebih family module,
2. ada capability baru pada module utama,
3. ada penyesuaian operasional yang berdampak ke kurikulum atau SOP module,
4. ada vertical module baru yang resmi masuk baseline NIZAM Full.

Saat `Module` naik:

- `Add-on` dan `Patch` harus di-reset ke `0`.

Contoh:

- dari `v1.3.7.2` menjadi `v1.4.0.0`

### 6.3 Kenaikan Add-on

Naikkan `Add-on` jika:

1. ada add-on baru resmi,
2. ada perubahan besar pada capability add-on,
3. ada ekspansi penting pada ecosystem add-on,
4. ada perubahan signifikan pada integration surface atau channel extension.

Saat `Add-on` naik:

- `Patch` harus di-reset ke `0`.

Contoh:

- dari `v1.4.2.6` menjadi `v1.4.3.0`

### 6.4 Kenaikan Patch

Naikkan `Patch` jika:

1. hanya ada perbaikan bug,
2. tidak ada perubahan generation core,
3. tidak ada perubahan baseline module,
4. tidak ada perubahan baseline add-on,
5. perubahan hanya bersifat penyempurnaan minor atau hotfix.

Contoh:

- dari `v1.4.3.0` menjadi `v1.4.3.1`

---

## 7. Aturan Reset

Aturan reset resmi adalah:

1. jika `Core` naik, maka `Module`, `Add-on`, dan `Patch` menjadi `0`,
2. jika `Module` naik, maka `Add-on` dan `Patch` menjadi `0`,
3. jika `Add-on` naik, maka `Patch` menjadi `0`,
4. jika hanya `Patch` naik, segmen lain tetap.

Contoh resmi:

1. `v1.0.0.0` -> `v1.1.0.0`
2. `v1.1.0.0` -> `v1.1.1.0`
3. `v1.1.1.0` -> `v1.1.1.1`
4. `v1.1.1.9` -> `v1.2.0.0`
5. `v1.9.9.9` -> `v2.0.0.0`

---

## 8. Contoh Interpretasi Versi

### 8.1 `v1.0.0.0`

Makna:

1. baseline generasi pertama NIZAM Full,
2. belum ada major expansion pada module,
3. belum ada major expansion pada add-on,
4. belum ada patch.

### 8.2 `v1.2.0.0`

Makna:

1. core tetap generasi pertama,
2. sudah ada dua gelombang perubahan besar di family module,
3. baseline add-on kembali nol setelah module bump,
4. belum ada patch.

### 8.3 `v1.2.3.0`

Makna:

1. core tetap generasi pertama,
2. module baseline tetap pada iterasi kedua,
3. add-on sudah berkembang tiga gelombang,
4. belum ada patch setelah baseline add-on itu.

### 8.4 `v1.2.3.4`

Makna:

1. struktur besar tetap sama,
2. ada empat patch atau hotfix setelah baseline `v1.2.3.0`.

### 8.5 `v2.0.0.0`

Makna:

1. generasi core baru,
2. seluruh baseline di-reset,
3. ini harus diperlakukan sebagai release strategis besar.

---

## 9. Aturan Penamaan Release

### 9.1 Penulisan Resmi

Format penulisan resmi:

`NIZAM Full vC.M.A.P`

Contoh:

1. `NIZAM Full v1.0.0.0`
2. `NIZAM Full v1.4.2.1`

### 9.2 Penulisan Ringkas

Untuk slide, katalog, atau komunikasi publik, boleh dipakai:

`NIZAM Full vC.M.A`

Contoh:

1. `NIZAM Full v1.4.2`
2. `NIZAM Full v2.0.0`

### 9.3 Larangan

Tidak disarankan memakai:

1. `123`
2. `1-4-2`
3. `ver 142`
4. format lokal yang tidak punya pemisah segmen

Alasan:

1. sulit dibaca,
2. sulit diaudit,
3. cepat menimbulkan tafsir ganda,
4. tidak scalable untuk jangka panjang.

---

## 10. Aturan untuk Release Notes

Setiap release resmi NIZAM Full wajib mencantumkan:

1. versi penuh `vC.M.A.P`,
2. tanggal rilis,
3. ringkasan perubahan,
4. apakah perubahan masuk kategori `Core`, `Module`, `Add-on`, atau `Patch`,
5. dampak ke onboarding,
6. dampak ke training / sertifikasi bila ada,
7. catatan migration atau compatibility bila ada.

Format ringkas yang disarankan:

```text
NIZAM Full v1.4.2.0
Tanggal: 30 April 2026
Kategori: Add-on Release
Ringkasan: ekspansi add-on POS dan Sales Page
Dampak training: update track Revenue dan POS
```

---

## 11. Aturan untuk Kurikulum dan Sertifikasi

Standar versioning ini harus dipakai juga untuk:

1. penandaan versi kurikulum,
2. penandaan versi assessment,
3. penandaan versi lab guide,
4. penandaan versi sandbox scenario,
5. penandaan transcript compatibility.

Aturan operasional:

1. jika `Core` berubah, seluruh jalur sertifikasi wajib direview,
2. jika `Module` berubah, jalur sertifikasi yang terkait module tersebut wajib di-update,
3. jika `Add-on` berubah, hanya spesialisasi add-on yang wajib diperbarui,
4. jika hanya `Patch` berubah, update kurikulum boleh bersifat minor atau tidak wajib jika tidak berdampak ke pembelajaran.

---

## 12. Aturan untuk GTM dan Packaging

Tim GTM harus memakai versi ini untuk membedakan:

1. perubahan besar fondasi platform,
2. ekspansi capability utama,
3. ekspansi add-on komersial,
4. patch release yang tidak perlu dibesar-besarkan ke pasar.

Prinsip komunikasinya:

1. `Core bump` = komunikasi strategis besar,
2. `Module bump` = komunikasi penguatan produk utama,
3. `Add-on bump` = komunikasi ekspansi capability atau upsell,
4. `Patch bump` = komunikasi teknis terbatas jika relevan.

---

## 13. Governance Versioning

### 13.1 Otoritas Penetapan

Versi resmi NIZAM Full harus ditetapkan bersama minimal oleh:

1. Product Lead,
2. Engineering Lead,
3. jika berdampak ke enablement: Academy / Training Lead,
4. jika berdampak ke packaging: GTM / Commercial Lead.

### 13.2 Tanggung Jawab

| Peran | Tanggung jawab |
|---|---|
| Product Lead | menentukan apakah perubahan masuk kategori core, module, atau add-on |
| Engineering Lead | memverifikasi dampak teknis dan reset segment |
| Training / Academy Lead | memeriksa dampak ke materi, assessment, dan sertifikasi |
| GTM Lead | menyiapkan komunikasi eksternal dan internal yang sesuai |

---

## 14. Standar Resmi Singkat

Kalau harus diringkas dalam satu halaman, standar resminya adalah:

1. format resmi NIZAM Full adalah `vC.M.A.P`,
2. `C` mewakili perubahan `Core`,
3. `M` mewakili perubahan `Module`,
4. `A` mewakili perubahan `Add-on`,
5. `P` mewakili `Patch`,
6. setiap kenaikan segmen yang lebih besar me-reset segmen di kanannya,
7. versi publik boleh memakai format ringkas `vC.M.A`,
8. semua release notes internal wajib menyimpan versi penuh.

---

## 15. Keputusan Final

Standar resmi yang ditetapkan untuk `NIZAM Full` adalah:

`NIZAM Full vC.M.A.P`

Dengan arti:

1. `Core`
2. `Module`
3. `Add-on`
4. `Patch`

Standar ini berlaku sebagai acuan resmi untuk:

1. engineering release,
2. product communication,
3. packaging alignment,
4. training material versioning,
5. certification compatibility,
6. release governance internal.

---

## 16. Penutup

Versioning bukan hanya urusan engineering.

Di NIZAM, versioning harus menjadi bahasa bersama antara:

1. produk,
2. engineering,
3. support,
4. onboarding,
5. academy,
6. sertifikasi,
7. GTM.

Karena itu, standar `vC.M.A.P` dipilih bukan hanya karena rapi, tetapi karena paling cocok menggambarkan struktur nyata NIZAM:

1. ada fondasi `Core`,
2. ada keluarga `Module`,
3. ada ekspansi `Add-on`,
4. dan selalu ada kebutuhan `Patch`.
