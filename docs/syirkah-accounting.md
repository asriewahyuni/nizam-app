# Syirkah Accounting — Konvensi & Model CoA

Dokumen ini menjelaskan konvensi akuntansi yang diterapkan Nizam ERP untuk entitas syirkah (kemitraan syariah), khususnya perbedaan antara Mudharabah dan Inan, struktur CoA yang dihasilkan, serta aturan migrasi aset tetap.

---

## 1. Tipe Syirkah yang Didukung

| Tipe | Deskripsi | Kode Modal |
|---|---|---|
| **Syirkah Mudharabah** | Shahibul Maal (pemodal) + Mudharib (pengelola). Modal 100% dari satu pihak, keuntungan dibagi per nisbah, kerugian ditanggung pemodal. | 3110 |
| **Syirkah Inan** | Semua pihak berkontribusi modal **dan** tenaga. Kerugian proporsional dengan modal. | 3120 |
| **Syirkah Abdan** | Kemitraan berbasis keahlian/tenaga, tanpa kontribusi modal finansial. | — |
| **Syirkah Wujuh** | Kemitraan berbasis reputasi/kredit, tanpa modal tunai. | — |

---

## 2. Struktur Ekuitas Syirkah

```
3000  Modal & Ekuitas
├── 3001  Laba Belum Dibagi          ← bukan "Laba Ditahan"; syirkah tidak mengenal retained earnings
├── 3110  Modal Syirkah Mudharabah   ← hanya dibuat untuk org Mudharabah/MIXED
├── 3120  Modal Syirkah Inan         ← hanya dibuat untuk org Inan/MIXED
└── 3130  Bagi Hasil Syirkah         ← debit normal; menampung distribusi ke anggota
```

### Mengapa tidak ada "Laba Ditahan"?

Dalam akad syirkah, setiap laba **harus didistribusikan** kepada anggota sesuai nisbah yang disepakati di akhir periode. Laba tidak ditahan sebagai retained earnings perusahaan. Akun 3001 dinamai **Laba Belum Dibagi** untuk merefleksikan bahwa laba tersebut masih dalam antrian distribusi, bukan laba yang dipertahankan untuk reinvestasi mandiri.

---

## 3. Auto-Suppress Akun Berdasarkan Tipe Org

`injectShariahPack` membaca `syirkah_contracts` dan menentukan *dominance*:

| Kondisi kontrak | Dominance | 3110 dibuat? | 3120 dibuat? |
|---|---|---|---|
| Semua kontrak = Mudharabah | `MUDHARABAH` | ✓ | ✗ |
| Semua kontrak = Inan | `INAN` | ✗ | ✓ |
| Campuran / belum ada kontrak | `MIXED` | ✓ | ✓ |

Jika di kemudian hari org menambah tipe baru (misal Inan setelah Mudharabah), klik **Perbaiki Setup Akun** di `Settings → Mode Syariah` untuk men-inject akun yang hilang.

**File terkait:**
- [`modules/accounting/lib/shariah-coa.ts`](../modules/accounting/lib/shariah-coa.ts) — definisi seeds & filter helpers
- [`modules/accounting/actions/shariah.actions.ts`](../modules/accounting/actions/shariah.actions.ts) — `detectOrgSyirkahDominance`, `injectShariahPack`

---

## 4. Referensi Jurnal Syirkah

| Transaksi | Debit | Kredit |
|---|---|---|
| Setoran modal Shahibul Maal | 1101 Kas/Bank | 3110 Modal Syirkah Mudharabah |
| Setoran modal Inan | 1101 Kas/Bank | 3120 Modal Syirkah Inan |
| Laba bersih periode | 3001 Laba Belum Dibagi | — |
| Distribusi bagi hasil | 3130 Bagi Hasil Syirkah | 1101 Kas/Bank |

---

## 5. Migrasi Aset Tetap — Per-Category Account Mapping

Saat impor aset dari spreadsheet (`importFixedAssetsMigration`), sistem memetakan setiap aset ke akun yang tepat berdasarkan kolom `asset_category`.

### Pemetaan Akun per Kategori

| Kategori | Kode Aset | Kode Akum. Penyusutan | Kode Beban Penyusutan |
|---|---|---|---|
| TANAH | 1501 | — (tidak disusutkan) | 6053 |
| KENDARAAN | 1502 | 1507 | 6051 |
| BANGUNAN | 1503 | 1508 | 6054 |
| INTERIOR | 1504 | 1509 | — |
| ELEKTRONIK | 1505 | 1510 | 6052 |
| MESIN | 1506 | 1511 | 6050 |

### Alias yang Diterima di Kolom `asset_category`

| Nilai di spreadsheet | Dipetakan ke |
|---|---|
| TANAH, LAND | TANAH |
| KENDARAAN, VEHICLE, MOBIL, MOTOR | KENDARAAN |
| BANGUNAN, GEDUNG, BUILDING | BANGUNAN |
| ELEKTRONIK, ELECTRONIC, PERALATAN | ELEKTRONIK |
| MESIN, MACHINE | MESIN |
| INTERIOR | INTERIOR |

### Aturan `last_depreciation_date`

- Jika `accumulated_depreciation > 0` → `last_depreciation_date = acquisition_date` (penyusutan sudah berjalan)
- Jika `accumulated_depreciation = 0` → `last_depreciation_date = null` (penyusutan mulai bulan berikutnya)

Aset baru (diperoleh < 2 bulan yang lalu) dengan `accumulated_depreciation > 0` akan menghasilkan **warning** di hasil impor — perlu dikonfirmasi sebelum di-approve.

**File terkait:**
- [`modules/settings/actions/migration.actions.ts`](../modules/settings/actions/migration.actions.ts) — fungsi `importFixedAssetsMigration` (sekitar baris 2658)

---

## 6. Cash Flow Category — Auto-Inference

Jika kolom `arus_kas` di sheet CoA kosong, sistem menginfer kategori dari prefix kode akun:

| Prefix | Kategori |
|---|---|
| `15`, `16` | INVESTING |
| `3`, `25`, `26` | FINANCING |
| `4`, `5`, `6`, `9` | OPERATING |
| `12`, `13`, `14`, `21`–`24` | OPERATING |
| Lainnya | NULL (tidak dikategorikan) |

Akun kas/bank (prefix `11`) dan akun header tidak mendapat kategori secara sengaja — mereka bukan arus kas itu sendiri.

**File terkait:**
- [`modules/settings/actions/migration.actions.ts`](../modules/settings/actions/migration.actions.ts) — fungsi `resolveCoaCashFlowCategory` (sekitar baris 611)
- [`modules/accounting/actions/reports.actions.ts`](../modules/accounting/actions/reports.actions.ts) — fungsi `resolveCashFlowCategory` (runtime fallback)

---

## 7. Referensi Transaksi Khusus yang Dikecualikan dari Laporan

Beberapa journal entry memiliki `reference_type` atau deskripsi khusus yang sengaja **dikecualikan** dari laporan arus kas dan laba rugi:

| Tag / Reference Type | Dikecualikan dari | Alasan |
|---|---|---|
| `SYIRKAH_CAPITAL` | Arus Kas | Modal syirkah bukan arus operasi/investasi/financing biasa |
| `ADJUSTMENT` | Arus Kas | Jurnal penyesuaian tidak mencerminkan arus tunai nyata |
| `[AUTO_MIGRATION_OPENING_CASH_BANK]` | Arus Kas | Saldo awal tidak sama dengan transaksi periode berjalan |

---

*Terakhir diperbarui: 2026-05-28*
