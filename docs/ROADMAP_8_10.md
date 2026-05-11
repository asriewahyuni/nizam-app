# 🎯 ROADMAP: Nizam 4.5 → 8.0

## Strategy: "Fix First, Polish Later, Expand Last"

Prioritas: **Stabilitas → UI/UX → Fitur Critical → Mobile**

---

## 🔥 PHASE 0: WAR ROOM (Sekarang — 1 hari)
### Goal: Stop the bleeding. Fix semua bug known.

| # | Task | Area | Impact |
|---|------|------|--------|
| 0.1 | Fix activation redirect → user sampai ke setup page | Onboarding | ⭐⭐⭐ |
| 0.2 | Fix inventory save regression | Inventory | ⭐⭐⭐ |
| 0.3 | Fix build error di tax page (pg module in client) | Build | ⭐⭐⭐ |
| 0.4 | Fix marketplace page Server Component error | Marketplace | ⭐⭐⭐ |
| 0.5 | Add Sentry / error boundary ke semua halaman | Stability | ⭐⭐⭐ |

---

## 🎨 PHASE 1: UI/UX CONSISTENCY (Hari 2-4)
### Goal: Dari "Excel di browser" jadi "produk serius"

| # | Task | Area | Impact |
|---|------|------|--------|
| 1.1 | Design System: satu file CSS variabel (font, color, spacing, radius) | Global | ⭐⭐⭐ |
| 1.2 | Unified button styles (size, hover, active, disabled) | Components | ⭐⭐⭐ |
| 1.3 | Unified form styles (input, select, textarea, validation) | Components | ⭐⭐⭐ |
| 1.4 | Unified table styles (header, row, striped, pagination) | Components | ⭐⭐ |
| 1.5 | Unified modal/dialog styles | Components | ⭐⭐ |
| 1.6 | Empty states untuk semua halaman (ilustrasi + CTA) | UX | ⭐⭐ |
| 1.7 | Loading skeleton untuk semua halaman | UX | ⭐⭐ |
| 1.8 | Responsive sidebar (collapse on mobile) | Mobile | ⭐⭐⭐ |

---

## 🏗️ PHASE 2: ACCOUNTING MATURITY (Hari 5-7)
### Goal: Accounting benar-benar enterprise-grade

| # | Task | Area | Impact |
|---|------|------|--------|
| 2.1 | Dashboard keuangan (grafik revenue, expense, cash flow, P&L trend) | Accounting | ⭐⭐⭐ |
| 2.2 | Budget vs Actual (monthly comparison) | Accounting | ⭐⭐⭐ |
| 2.3 | Fix multi-currency → purchases integration | Multi-Currency | ⭐⭐ |
| 2.4 | Auto FX gain/loss journal entries | Multi-Currency | ⭐⭐ |
| 2.5 | Export financial reports ke Excel/PDF | Accounting | ⭐⭐ |

---

## 📱 PHASE 3: MOBILE & RESPONSIVE (Hari 8-10)
### Goal: Bisa dipake dari HP

| # | Task | Area | Impact |
|---|------|------|--------|
| 3.1 | All main pages responsive (max-width breakpoints) | Global | ⭐⭐⭐ |
| 3.2 | Bottom navigation yang proper | Mobile | ⭐⭐⭐ |
| 3.3 | PWA manifest + service worker | Mobile | ⭐⭐ |
| 3.4 | Touch-friendly controls (bigger buttons, swipe) | Mobile | ⭐⭐ |

---

## 🧪 PHASE 4: QUALITY & TESTING (Hari 11-13)
### Goal: Gak takut regresi tiap kali push

| # | Task | Area | Impact |
|---|------|------|--------|
| 4.1 | Unit test untuk accounting engine (balance, P&L, cash flow) | Testing | ⭐⭐⭐ |
| 4.2 | Integration test untuk critical flows (create sale, payroll) | Testing | ⭐⭐⭐ |
| 4.3 | Error boundaries di setiap route segment | Stability | ⭐⭐⭐ |
| 4.4 | API rate limiting + logging | Infrastructure | ⭐⭐ |

---

## 🚀 PHASE 5: GROWTH FEATURES (Hari 14-21)
### Goal: Fitur yang bikin user bayar

| # | Task | Area | Impact |
|---|------|------|--------|
| 5.1 | Payment gateway (Midtrans/Xendit) | Sales | ⭐⭐⭐ |
| 5.2 | Recurring invoice / auto-billing | Sales | ⭐⭐⭐ |
| 5.3 | Public API (read-only dulu) | Integration | ⭐⭐ |
| 5.4 | Bank statement import (CSV/PDF) | Accounting | ⭐⭐ |
| 5.5 | 1 business type mature (Fleet — paling banyak potensi) | Operations | ⭐⭐ |

---

## 📊 Target Score Per Phase

| Area | Sekarang | Phase 0 | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 |
|------|----------|---------|---------|---------|---------|---------|---------|
| Accounting Core | 7 | 7 | 7 | **8.5** | 8.5 | 9 | 9 |
| Multi-Currency | 6 | 6 | 6 | **8** | 8 | 8 | 8 |
| PPN Tax Engine | 6 | 6 | 6 | 7 | 7 | **8** | 8 |
| HRIS & Payroll | 5 | 5 | 6 | 6 | 6 | **7** | 7 |
| Sales | 6 | 6 | 6 | 6 | 7 | 7 | **8.5** |
| Inventory | 4 | **6** | 6 | 6 | 6 | 7 | 7 |
| Operations Module | 3 | 3 | 3 | 3 | 3 | 3 | **5** |
| UI/UX | 4 | 4 | **8** | 8 | 8.5 | 8.5 | 8.5 |
| Stability | 4 | **7** | 7 | 7 | 7 | **9** | 9 |
| Mobile | 1 | 1 | 3 | 3 | **7** | 7 | 7 |
| Integrations | 2 | 2 | 2 | 2 | 2 | 3 | **6** |
| Documentation | 3 | 3 | 4 | 5 | 5 | 6 | **7** |

**Target: Overall 8.0 setelah Phase 5 (21 hari kerja).**

---

## ⚡ PERTANYAAN BUAT AGAN

Sebelum gas, gue perlu tau:

1. **Prioritas vertical mana yang mau digenjot?**
   - a) Accounting & Finance (B2B proper)
   - b) Operations (Fleet/Manufaktur — niche)
   - c) Mobile-first (biar banyak user)

2. **Boleh gue refactor CSS global?** — Ini crucial buat UI consistency.
   - Better: bikin design system variabel
   - Risiko: banyak halaman yg pake style inline/random

3. **Buat testing, siap tambah Playwright?** — Biar kita bisa auto-test.

**Jawab dulu, gue gas langsung phase 0.** Yang paling urgent itu **fix bug known** biar gak malu-maluin pas demo.
