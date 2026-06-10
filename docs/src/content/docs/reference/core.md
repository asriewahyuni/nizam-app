---
title: "Referensi Modul Inti"
description: "> Dokumen teknis mendalam tentang 7 modul inti Nizam ERP."
sidebar:
  label: "Referensi Modul Inti"
---

> Dokumen ini disinkronkan otomatis dari file sumber `CORE.md` di root project docs.

> Dokumen teknis mendalam tentang 7 modul inti Nizam ERP.
> Mencakup definisi, tanggung jawab, tabel database, siklus transaksi, dan integrasi antar modul.

---

## Apa itu "Core"?

Sebuah modul disebut **Core** jika memenuhi dua kriteria sekaligus:

1. **Modul lain bergantung padanya** — ada foreign key, trigger otomatis, atau join dari modul lain ke tabel-tabelnya.
2. **Sistem tidak bisa beroperasi tanpanya** — bukan fitur opsional, tapi prasyarat fungsional.

> Modul Vertical (Fleet, Factory, Koperasi, dll) *menulis ke* Core. Core tidak bergantung pada Vertical.

---

## Peta Dependensi Core

```
                    ┌─────────────────┐
                    │   ACCOUNTING    │  ← semua modul posting ke sini
                    │  accounts       │
                    │  journal_lines  │
                    └────────┬────────┘
                             │ posting otomatis
          ┌──────────────────┼──────────────────┐
          │                  │                  │
   ┌──────▼──────┐   ┌───────▼──────┐  ┌───────▼──────┐
   │   FINANCE   │   │    SALES     │  │  PURCHASING  │
   │  bank_accs  │   │  sales       │  │  purchases   │
   │  cash_tx    │   │  sales_items │  │  purch_items │
   └──────┬──────┘   └───────┬──────┘  └───────┬──────┘
          │                  │                  │
          └──────────────────▼──────────────────┘
                             │ stok masuk/keluar
                    ┌────────▼────────┐
                    │   INVENTORY     │
                    │  products       │
                    │  inv_movements  │
                    └─────────────────┘

   ┌─────────────────┐         ┌─────────────────┐
   │      HRIS       │         │    SYIRKAH      │
   │  employees      │         │  syirkah_       │
   │  payslips       │         │  contracts      │
   └────────┬────────┘         └────────┬────────┘
            │ posting gaji              │ posting modal & bagi hasil
            └──────────────────────────▶ ACCOUNTING
```

---

## 1. Accounting (Akuntansi)

### Tanggung Jawab
Sumber kebenaran tunggal untuk semua pencatatan keuangan. Setiap pergerakan uang di sistem — dari penjualan, pembelian, gaji, hingga depresiasi aset — berakhir sebagai baris di `journal_lines`.

### Tabel Utama

| Tabel | Fungsi |
|---|---|
| `accounts` | Chart of Accounts — semua akun GL |
| `journal_entries` | Header jurnal (tanggal, deskripsi, status) |
| `journal_lines` | Baris debit/kredit per akun |
| `budgets` | Anggaran per akun per periode |
| `opening_balances` | Saldo awal saat migrasi/periode baru |
| `org_tax_settings` | Konfigurasi pajak (PPN, PPh) per org |
| `tax_invoices` | Faktur pajak (e-Faktur) |
| `tax_invoice_numbers` | Nomor seri faktur pajak |
| `fiscal_periods` | Periode akuntansi (bulanan/tahunan) |

### Hierarki CoA (Standar PSAK)

```
1000  Aset                          ← Root
  1100  Aset Lancar                 ← Group
    1101  Kas & Setara Kas          ← Detail / Posting
    1102  Kas Kecil
    1103  Bank BCA
    ...
  1500  Aset Tetap                  ← Group
    1501  Tanah & Bangunan
    1502  Kendaraan
    ...
2000  Liabilitas
3000  Ekuitas
4000  Pendapatan
5000  Beban Pokok Penjualan
6000  Beban Operasional
```

Tipe akun: `ASSET | LIABILITY | EQUITY | REVENUE | EXPENSE`
Normal balance: `DEBIT | CREDIT`

### Status Jurnal

```
DRAFT → POSTED → (VOIDED)
```

- **DRAFT:** bisa diedit, tidak mempengaruhi saldo GL
- **POSTED:** terkunci, saldo GL sudah berubah
- **VOIDED:** dibatalkan dengan jurnal pembalik otomatis

### Siklus Journal Entry

```
Transaksi bisnis (Sales/Purchase/Payroll/Manual)
        ↓
createJournalEntry() → status: DRAFT
        ↓
postJournalEntry()   → status: POSTED → update General Ledger
        ↓ (opsional)
voidJournalEntry()   → status: VOIDED → jurnal pembalik otomatis
```

### Laporan yang Dihasilkan

- **Neraca (Balance Sheet)** — `getBalanceSheet()`
- **Laba Rugi (P&L)** — `getProfitLoss()`
- **Arus Kas (Cash Flow)** — `getCashFlow()`
- **General Ledger** — `getGeneralLedger()`
- **Trial Balance** — via reporting
- **Aging Piutang/Hutang** — `getAgingReport()`
- **Rasio Keuangan** — likuiditas, solvabilitas, profitabilitas
- **BSC (Balanced Scorecard)** — metrics engine

### Fitur Khusus

- **Multi-currency** — kurs konversi, forex gain/loss otomatis
- **Fiscal Period Closing** — tutup buku dengan jurnal penutup otomatis
- **Shariah Mode** — akun murabahah, mudharabah, zakat terintegrasi
- **CoA Inheritance** — child org bisa inherit CoA dari parent (holding)
- **CoA Upload** — import massal via Excel (.xlsx)
- **Tax Engine** — PPN 11%, PPh 21, PPh 23 dengan nomor faktur pajak

---

## 2. Finance (Kas & Bank)

### Tanggung Jawab
Mencatat pergerakan kas aktual — uang yang benar-benar masuk dan keluar dari rekening. Berbeda dari Accounting yang mencatat *hak/kewajiban*, Finance mencatat *kas nyata*.

### Tabel Utama

| Tabel | Fungsi |
|---|---|
| `bank_accounts` | Rekening bank & kas kecil |
| `bank_transactions` | Mutasi kas/bank manual |
| `bank_mutations` | Import mutasi dari CSV bank |
| `sales_payments` | Penerimaan pembayaran dari pelanggan |
| `purchase_payments` | Pelunasan hutang ke supplier |
| `purchase_returns` | Retur pembelian + refund |

### Tipe Bank Account

```
BANK        → rekening bank (BCA, Mandiri, dll)
PETTY_CASH  → kas kecil
GIRO        → rekening giro
```

### Siklus Pembayaran Sales

```
Sales Invoice (status: UNPAID)
    ↓
createSalesPayment() → catat di sales_payments
    ↓
otomatis posting journal:
  Dr. Bank/Kas      (account dari bank_accounts)
  Cr. Piutang Usaha (akun 1200-an)
    ↓
Sales Invoice → status: PAID / PARTIAL
```

### Siklus Pembayaran Purchase

```
Purchase Order (status: UNPAID)
    ↓
createPurchasePayment() → catat di purchase_payments
    ↓
otomatis posting journal:
  Dr. Hutang Usaha  (akun 2100-an)
  Cr. Bank/Kas      (account dari bank_accounts)
    ↓
Purchase → status: PAID / PARTIAL
```

### Bank Reconciliation

```
Import CSV mutasi bank (processBankCSV())
    ↓
Match otomatis dengan transaksi di sistem (getUnmatchedMutations())
    ↓
Konfirmasi manual unmatched items
    ↓
Buku bank = Rekening koran ✓
```

### Fitur Khusus

- **Inter-Branch Transfer** — transfer kas antar cabang dengan jurnal simetris
- **Inter-Org Capital Transfer** — transfer modal antar entitas holding
- **Bank Liquidity Dashboard** — total likuiditas real-time semua rekening

---

## 3. Inventory (Persediaan)

### Tanggung Jawab
Menjaga kebenaran stok — jumlah barang fisik dan nilainya. Setiap transaksi barang (beli, jual, retur, transfer, adjustment) secara otomatis menghasilkan `inventory_movements` yang mengupdate stok dan menghitung ulang average cost.

### Tabel Utama

| Tabel | Fungsi |
|---|---|
| `products` | Master produk/barang |
| `inventory_movements` | Setiap gerakan stok (masuk/keluar/transfer) |
| `inventory_adjustments` | Penyesuaian stok (opname fisik) |
| `inventory_adjustment_items` | Detail item penyesuaian |
| `inventory_transfers` | Transfer stok antar branch/gudang |
| `inventory_transfer_items` | Detail item transfer |
| `sales_items` | Item baris dari penjualan |
| `purchase_items` | Item baris dari pembelian |

### Metode Valuasi: Average Cost (AVCO)

```
Stok awal: 100 unit @ Rp 10.000 = Rp 1.000.000
Beli baru:  50 unit @ Rp 12.000 = Rp   600.000
                                  ──────────────
Total:     150 unit               Rp 1.600.000

Average Cost = 1.600.000 / 150 = Rp 10.667/unit
```

Setiap pembelian baru menghitung ulang average cost secara otomatis.

### Tipe Movement

```
IN              → pembelian, retur dari pelanggan, adjustment +
OUT             → penjualan, retur ke supplier, adjustment -
TRANSFER_OUT    → keluar dari branch asal
TRANSFER_IN     → masuk ke branch tujuan
OPENING         → stok awal
ADJUSTMENT      → koreksi fisik (stock opname)
```

### Siklus Stok dari Sales

```
createSale() + items
    ↓ otomatis
inventory_movements (type: OUT, qty: -N)
    ↓
stock_quantity -= N
    ↓
journal_entry:
  Dr. HPP / COGS  (akun 5000-an)
  Cr. Persediaan  (akun 1300-an)  @ average_cost
```

### Siklus Stok dari Purchase

```
receivePurchase() / goods receipt
    ↓ otomatis
inventory_movements (type: IN, qty: +N)
    ↓
stock_quantity += N
average_cost = recalculate()
    ↓
journal_entry:
  Dr. Persediaan  (akun 1300-an)  @ purchase_price + landed_cost
  Cr. Hutang Usaha (akun 2100-an)
```

### Landed Cost

Biaya pengiriman/asuransi/bea cukai bisa dialokasikan ke nilai persediaan:

```
Purchase value:   Rp 1.000.000
Freight cost:     Rp   50.000
Insurance:        Rp   10.000
                  ──────────────
Total landed:     Rp 1.060.000  → menjadi dasar average cost
```

### Fitur Khusus

- **Multi-warehouse** — stok per gudang (add-on Warehouse)
- **Product Categories** — dengan akun mapping per kategori
- **Low-stock alert** — via reporting
- **Account Mapping per Product** — `asset_account_id`, `income_account_id`, `expense_account_id`

---

## 4. Purchasing (Pembelian)

### Tanggung Jawab
Entry point supply chain. Mengelola seluruh siklus pengadaan barang/jasa dari pembuatan PO hingga pembayaran ke supplier, dengan integrasi otomatis ke Inventory dan Accounting.

### Tabel Utama

| Tabel | Fungsi |
|---|---|
| `purchases` | Header Purchase Order |
| `purchase_items` | Line item PO |
| `purchase_returns` | Retur ke supplier |
| `purchase_return_items` | Detail retur |
| `purchase_payments` | Pembayaran ke supplier |
| `contacts` | Master supplier & pelanggan |

### Status PO

```
DRAFT → ORDERED → RECEIVED → INVOICED → PAID
                      ↓
                 PARTIALLY_RECEIVED
```

### Siklus Pembelian Lengkap

```
1. createPurchase()          → PO dibuat (DRAFT)
        ↓
2. submitPurchase()          → dikirim ke supplier (ORDERED)
        ↓
3. receivePurchase()         → barang diterima (RECEIVED)
   → inventory_movements +
   → average_cost recalc
        ↓
4. Otomatis journal:
   Dr. Persediaan / Aset
   Cr. Hutang Usaha
        ↓
5. createPurchasePayment()   → bayar hutang (PAID)
   → journal:
   Dr. Hutang Usaha
   Cr. Bank / Kas
```

### Purchase Return

```
createPurchaseReturn()
    ↓
inventory_movements (type: OUT)  → stok berkurang kembali
    ↓
journal pembalik:
  Dr. Hutang Usaha / Bank
  Cr. Persediaan
```

### Approval Flow (opsional)

PO di atas nilai threshold bisa memerlukan approval sebelum dikirim ke supplier. Dikonfigurasi via `approval_requests` di Governance Layer.

---

## 5. Sales (Penjualan)

### Tanggung Jawab
Revenue entry point utama. Mengelola seluruh siklus penjualan dari quotation hingga pembayaran, termasuk POS untuk transaksi retail, dengan integrasi ke Inventory dan Accounting.

### Tabel Utama

| Tabel | Fungsi |
|---|---|
| `sales` | Header Sales Order / Invoice |
| `sales_items` | Line item penjualan |
| `sales_payments` | Penerimaan pembayaran |
| `contacts` | Master pelanggan & supplier |

### Status Sales

```
DRAFT → CONFIRMED → DELIVERED → INVOICED → PAID
                                    ↓
                               PARTIALLY_PAID
```

### Siklus Penjualan Lengkap

```
1. createSale()              → order dibuat (DRAFT)
        ↓
2. confirmSale()             → dikonfirmasi (CONFIRMED)
        ↓
3. deliverSale()             → barang dikirim (DELIVERED)
   → inventory_movements -
   → journal:
      Dr. Piutang Usaha
      Cr. Pendapatan
      Dr. HPP (COGS)
      Cr. Persediaan
        ↓
4. createSalesPayment()      → terima bayar (PAID)
   → journal:
      Dr. Bank / Kas
      Cr. Piutang Usaha
```

### POS (Point of Sale)

Jalur cepat untuk transaksi retail — inventory berkurang dan kas masuk dalam satu langkah tanpa perlu melalui siklus order-delivery-invoice:

```
POS Transaction
    ↓
inventory_movements (OUT) + journal sekaligus
    ↓
Shift closing → rekap per kasir per shift
```

### Sales Return

```
createSalesReturn()
    ↓
inventory_movements (IN)   → stok kembali
    ↓
journal pembalik:
  Dr. Pendapatan
  Cr. Piutang / Bank
  Dr. Persediaan
  Cr. HPP
```

### CRM (Kontak & Pipeline)

- Master `contacts` dipakai oleh Sales dan Purchasing bersama (customer/supplier sama tabelnya).
- **Pipeline** — tracking prospek penjualan.
- **Quotation** — penawaran harga sebelum jadi order.
- **Commission** — komisi salesperson per transaksi.
- **Promo** — diskon otomatis berdasarkan aturan.

### Shariah Sales Mode

Setiap penjualan bisa ditandai dengan akad syariah:
- **Murabahah** — jual beli dengan margin transparan
- **Salam** — bayar di muka, barang menyusul
- **Istishna** — pesan produk custom

---

## 6. HRIS (Human Resource & Payroll)

### Tanggung Jawab
Mengelola sumber daya manusia dan memproses penggajian. Berbeda dari modul HR konvensional, HRIS di Nizam secara otomatis men-generate jurnal akuntansi dari setiap proses payroll — menjadikannya bagian integral dari siklus keuangan, bukan modul standalone.

### Tabel Utama

| Tabel | Fungsi |
|---|---|
| `employees` | Master karyawan |
| `payroll_components` | Komponen gaji (tunjangan, potongan) |
| `employee_components` | Mapping komponen ke karyawan |
| `payroll_runs` | Header proses penggajian per periode |
| `payslips` | Slip gaji per karyawan per run |
| `payslip_lines` | Detail baris gaji (per komponen) |
| `attendance` | Kehadiran karyawan |
| `leave_requests` | Pengajuan cuti |
| `expense_claims` | Klaim pengeluaran/reimbursement |

### Komponen Gaji

```
Tipe komponen:
EARNING    → menambah gaji (gaji pokok, tunjangan transport, dll)
DEDUCTION  → mengurangi gaji (potongan BPJS, kasbon, PPh 21, dll)
```

### Siklus Payroll

```
1. Setup komponen gaji per karyawan
        ↓
2. generatePayrollRun(period)
   → hitung gaji kotor per karyawan
   → hitung PPh 21
   → hitung BPJS TK / Kesehatan
   → buat payslips
        ↓
3. Review & approve payslips
        ↓
4. payPayrollRun(accountId)
   → transfer gaji via bank_account
   → generate journal_entry:
        Dr. Beban Gaji          (akun 6000-an)
        Dr. Beban BPJS Employer
        Cr. Hutang Gaji
        Cr. Hutang PPh 21
        Cr. Hutang BPJS TK
        Cr. Bank (disbursement)
```

### Leave Management

```
Employee → createLeaveRequest()
    ↓
Manager → approveLeaveRequest() / rejectLeaveRequest()
    ↓
Saldo cuti otomatis berkurang
```

### Expense Claims

```
Employee → createExpenseClaim() + upload bukti
    ↓
Approval workflow
    ↓
Reimburse → journal:
  Dr. Beban [kategori]
  Cr. Bank / Kas
```

### Fitur Khusus

- **Multi-branch Payroll** — proses gaji per cabang secara terpisah
- **PPh 21 Integration** — kalkulasi otomatis dengan akun hutang pajak
- **BPJS Integration** — employer & employee share otomatis
- **Employee Transfer** — pindah karyawan antar org/branch
- **Competency & Training** — tracking kompetensi dan pelatihan karyawan

---

## 7. Syirkah (Kemitraan Bisnis Syariah)

### Tanggung Jawab
Mengelola kemitraan bisnis berbasis syariah — mulai dari penyusunan akad, penandatanganan digital oleh mitra dan saksi, hingga posting modal dan bagi hasil ke General Ledger. Syirkah adalah satu-satunya modul yang menangani aspek legal-syariah dan membawa implikasi langsung ke Ekuitas di Accounting.

### Tabel Utama

| Tabel | Fungsi |
|---|---|
| `syirkah_contracts` | Header akad — nama kontrak, org, status, tanggal |
| `syirkah_members` | Mitra dalam akad + persentase bagi hasil + token tanda tangan |
| `syirkah_witnesses` | Saksi akad + token tanda tangan |

### Status Akad

```
DRAFT → ACTIVE → CLOSED
           ↑
    (semua pihak sudah tanda tangan — Ijab-Qobul digital selesai)
```

### Siklus Akad Syirkah

```
1. upsertSyirkahContract()       → buat akad (DRAFT)
        ↓
2. upsertSyirkahMember()         → tambah mitra + % bagi hasil
   upsertSyirkahWitness()        → tambah saksi
        ↓
3. Kirim link penandatanganan ke masing-masing pihak
        ↓
4. signSyirkahMember()           → mitra tanda tangan via token
   signSyirkahWitness()          → saksi tanda tangan via token
        ↓
5. Akad → status: ACTIVE (Ijab-Qobul digital selesai)
```

### Posting Modal ke Core Accounting

```
syncSyirkahCapitalToCore()
    ↓
Untuk setiap mitra yang setor modal:
  Dr. Kas / Bank           (akun 1100-an)
  Cr. Modal Syirkah [nama] (akun Ekuitas — khusus per mitra)
    ↓
journal_entry dibuat otomatis dengan reference_type: 'SYIRKAH'
```

### Posting Bagi Hasil ke Core Accounting

```
syncSyirkahProfitSharingToCore()
    ↓
Hitung laba bersih × % bagi hasil per mitra
    ↓
  Dr. Laba Ditahan / Distribusi
  Cr. Hutang Bagi Hasil [mitra]    (atau langsung Kas jika tunai)
    ↓
journal_entry dengan reference_type: 'SYIRKAH_PROFIT'
```

### Mengapa Syirkah Termasuk Core

Tidak seperti modul Vertical lain (Fleet, Konstruksi, dll) yang hanya *menggunakan* infrastruktur bisnis, Syirkah menyentuh **struktur kepemilikan** perusahaan itu sendiri:

- Posting ke **akun Ekuitas** — bukan sekadar pendapatan/beban
- **Ijab-Qobul digital** adalah legalitas kemitraan — fondasi bisnis syariah
- Akad Syirkah menentukan **siapa pemilik** dan **berapa bagiannya** — ini adalah data konstitutif, bukan operasional
- Di banyak bisnis syariah Indonesia, akad Syirkah *mendahului* semua transaksi operasional lainnya

### Fitur Khusus

- **Tanda Tangan Digital** — mitra & saksi sign via link unik (token-based), tanpa perlu akun Nizam
- **Ijab-Qobul Digital** — akad sah secara syariah saat semua pihak telah menandatangani
- **Duplikasi Guard** — tidak bisa ada dua mitra dengan identitas yang sama dalam satu akad
- **Posting Otomatis** — modal dan bagi hasil langsung generate jurnal GL tanpa input manual
- **Dashboard Syirkah** — ringkasan kontrak aktif, total modal, dan distribusi bagi hasil

---

## Integrasi Antar Core Module

### Matriks Integrasi

| Module | Accounting | Finance | Inventory | Purchasing | Sales | HRIS | Syirkah |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Accounting** | — | ✅ baca saldo | ✅ terima posting | ✅ terima posting | ✅ terima posting | ✅ terima posting | ✅ terima posting |
| **Finance** | ✅ posting payment | — | — | ✅ bayar PO | ✅ terima bayar | ✅ disbursement | — |
| **Inventory** | ✅ posting COGS | — | — | ✅ terima barang | ✅ kurangi stok | — | — |
| **Purchasing** | ✅ buat jurnal hutang | ✅ bayar hutang | ✅ tambah stok | — | ✅ retur ke supplier | — | — |
| **Sales** | ✅ buat jurnal piutang | ✅ terima bayar | ✅ kurangi stok | — | — | — | — |
| **HRIS** | ✅ posting gaji | ✅ disbursement | — | — | — | — | — |
| **Syirkah** | ✅ posting modal & bagi hasil ke Ekuitas | — | — | — | — | — | — |

### Contoh: Satu Siklus Bisnis Lengkap

```
Beli barang dari supplier (Purchasing)
  → stok +100 unit (Inventory)
  → hutang usaha Rp 1.000.000 (Accounting)

Jual barang ke pelanggan (Sales)
  → stok -80 unit (Inventory)
  → piutang usaha Rp 1.600.000 (Accounting)
  → HPP Rp 800.000 (Accounting)

Terima bayar dari pelanggan (Finance)
  → bank +Rp 1.600.000
  → piutang lunas (Accounting)

Bayar supplier (Finance)
  → bank -Rp 1.000.000
  → hutang lunas (Accounting)

Proses gaji bulan ini (HRIS)
  → beban gaji Rp 500.000 (Accounting)
  → bank -Rp 500.000 (Finance)

Hasil akhir di Accounting:
  Laba Kotor  = 1.600.000 - 800.000 = 800.000
  Beban Gaji  = 500.000
  Laba Bersih = 300.000
```

---

## Aturan Bisnis Kritis (Business Rules)

### Immutability Rules
- Jurnal berstatus `POSTED` **tidak bisa diedit** — hanya bisa di-void
- Akun dengan `is_system = TRUE` **tidak bisa dihapus** secara manual
- Stok tidak boleh negatif (dikontrol di level aplikasi)

### Constraint Database
- `journal_lines`: `debit > 0 OR credit > 0` (salah satu harus terisi)
- `journal_lines`: `NOT (debit > 0 AND credit > 0)` (tidak boleh keduanya)
- `journal_entries`: total debit = total kredit saat POST (balanced entry)
- `bank_accounts.account_id`: NOT NULL — selalu terhubung ke akun GL

### Governance Rules
- Setiap write operation cek **RBAC role** (`owner/admin/manager/staff`)
- CoA child org mode `INHERITED` → tidak bisa edit akun langsung, wajib request ke parent
- Transaksi di atas threshold tertentu → masuk **Approval Queue**
- Semua DELETE / void → dicatat di **Audit Log**

---

## Ringkasan

| Module | Tabel Kunci | Sumber Data | Output ke |
|---|---|---|---|
| **Accounting** | `accounts`, `journal_lines` | Semua modul | Laporan keuangan |
| **Finance** | `bank_accounts`, `bank_transactions` | Sales, Purchasing, HRIS | Bank statement, cash flow |
| **Inventory** | `products`, `inventory_movements` | Sales, Purchasing | Stock report, COGS |
| **Purchasing** | `purchases`, `purchase_items` | Supplier, Inventory | AP, stock in |
| **Sales** | `sales`, `sales_items` | Pelanggan, Inventory | AR, revenue, stock out |
| **HRIS** | `employees`, `payslips` | Attendance, Components | Payroll journal, disbursement |
| **Syirkah** | `syirkah_contracts`, `syirkah_members` | Mitra, Akad | Jurnal Ekuitas (modal & bagi hasil) |

---

*Dokumen ini merupakan bagian dari [BLUEPRINT.md](./BLUEPRINT.md) — arsitektur lengkap Nizam ERP.*
*Di-generate berdasarkan analisis codebase per Mei 2026.*
