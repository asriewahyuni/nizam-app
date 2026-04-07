# NIZAM ERP — Roadmap 5 Phase

This roadmap outlines the development plan for NIZAM ERP, a multi-tenant accounting and enterprise resource planning system built with Next.js, Prisma, and PostgreSQL.

---

## Phase 1 — Foundation (~2 minggu)
> "Tanpa ini, semua phase berikutnya goyah"

- [x] **Setup database foundation**: schema multi-tenant (org, users, roles) now running via Prisma/PostgreSQL
- [x] **Row Level Security (RLS)**: per organisasi
- [x] **Auth**: login, MFA, RBAC (admin / staff / manager)
- [x] **Chart of Accounts (CoA)**: standar PSAK
- [x] **Struktur double-entry ledger**: di PostgreSQL

---

## Phase 2 — Cash & Bank (~2 minggu)
> "Uang masuk, uang keluar — jantung bisnis"

- [x] **Manajemen multi-rekening bank**: CRUD bank accounts per org
- [x] **Transaksi kas masuk / keluar**: UI & Actions for cash movements
- [x] **Auto-jurnal via PostgreSQL trigger**: Automated GL entries from cash/bank modules
- [/] **Rekonsiliasi bank**: Schema ready, UI/Action in progress
- [ ] **Laporan Cashflow real-time**: Dashboard/table for current liquidity

---

## Phase 3 — Sales & Purchasing (~3 minggu)
> "Dari PO sampai invoice, otomatis"

- [x] **Sales & Purchasing Foundation**: Core tables & multi-tenant logic ready
- [x] Item-level details (Line Items) for SO & PO ready
- [ ] Purchase Order → Penerimaan Barang → Hutang Usaha
- [ ] **Sales Order Flow**: Sales Order → Pengiriman → Piutang Usaha
- [ ] **Auto-COGS**: Weighted average cost calculation
- [ ] **Invoice Management**: Status tracking & due date reminders
- [ ] **Laporan P&L Otomatis**: Real-time Profit & Loss statement

---

## Phase 4 — Inventory (~2 minggu)
> "Stok tidak pernah bohong"

- [ ] **Manajemen Produk & Kategori**: Detailed item Master
- [ ] **Stok Integrasi**: Automatic stock adjustments from Sales & PO
- [ ] **Stok Opname**: Module for adjustments & stocktake
- [ ] **Laporan Stok & Mutasi**: Inventory tracking over time

---

## Phase 5 — Executive Dashboard & Multi-Entity (~2 minggu)
> "CEO baca laporan dalam 60 detik"

- [x] **Dashboard Eksekutif**: Kas, P&L, Piutang, Hutang indicators
- [x] **Export Laporan**: Excel XLSX enterprise-grade (Sprint 1)
- [ ] **Proyeksi Cashflow**: 30-day outlook
- [x] **Multi-cabang**: Infrastructure & Intercompany elimination (Sprint 1)
- [ ] **Notifikasi Cerdas**: Intelligent alerts for due dates and low stock

---

## Phase 6 — Hardening & Institutionalization (Current)
> "Transforming from a developer project to a financial institution"

- [x] **Database Guardrails**: Trigger validation for journal balance (Sprint 1)
- [x] **Zakat Audit Trail**: Gold price source & evidence URL tracking (Sprint 1)
- [x] **PPh Forensic & Mapping Audit**: Diagnostic views for payroll tax (Sprint 2)
- [x] **AI OCR Fallback**: Robust manual entry flow for receipt detection failure (Sprint 2)
- [x] **Test Coverage Foundation**: Vitest setup & core engine unit tests (Sprint 2)
- [ ] **Performance Audit**: Indexing & optimization for large datasets
- [ ] **PWA & Mobile Optimization**: True mobile-first experience without app store
- [ ] **Security Hardening**: Pen-test and RLS audit completion
