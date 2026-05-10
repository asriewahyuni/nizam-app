# Roleplay Progress — 10 Mei 2026

## ✅ Selesai
### Cabang Solo (SKH-SOLO)
- [x] 4 Karyawan: Budi (Manager, 10jt ❌), Siti (Staff, 7jt), Ahmad (Staff, 6,5jt), Dewi (Staff, 5jt)
- [x] Payroll Component: Gaji Pokok (GL 6001)
- [x] Payroll Run Mei 2026: **ABORTED** (bug salary Budi Rp 1.112.223.331)
- [x] **BUG #1 fixed + pushed** (CurrencyInput name prop + formData.set)

### Kas & Bank
- [x] Cabang Solo: Bank Mandiri — Rp 500.000.000 (1101 - Kas Besar)
- [x] Cabang Yogyakarta: Bank Mandiri — Rp 500.000.000 (1101 - Kas Besar)
- [x] Total Likuiditas: Rp 1.000.000.000

### CoA
- [x] Parent BOT: PSAK CoA (66 accounts) installed
- [x] Child "Bisnis Pelatihan": Auto-inherit PSAK CoA dari holding

## 🔄 In Progress
- [ ] **Cabang Yogyakarta** — 4 Karyawan (total Rp 29.500.000)
- [ ] **Payroll Yogyakarta** — komponen + run
- [ ] **Fix payroll Solo** — re-run after Budi's salary fix (post-deploy)
- [ ] **Produk/Jasa** — 2 produk per cabang
- [ ] **Transaksi Penjualan** — 30 hari revenue
- [ ] **Beban Operasional** — gaji, sewa, marketing
- [ ] **AR (Piutang)** — PT ABC Rp 7.500.000
- [ ] **AP (Utang)** — Catering Rp 2.000.000

## 🐛 Found Bugs
1. **BUG #1 (FIXED)** Base Salary + Bank Acc concatenation — CurrencyInput tanpa name
2. **BUG #2** No edit salary option for existing employees
3. **BUG #3** Payroll disbursement blocked if > available cash
4. **BUG #4 (OPEN)** Sidebar overlay intercepts pointer events on desktop

## 📊 Final Reports (Pending)
- [ ] Laporan Laba/Rugi per cabang
- [ ] Neraca per cabang
- [ ] OCF / ICF / FCF
- [ ] Laporan Konsolidasi Parent
