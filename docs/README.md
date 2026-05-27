# Dokumentasi Developer NIZAM

Folder `docs/` adalah pusat dokumentasi teknis yang lebih ringkas, terstruktur, dan mudah dibaca dibanding dokumen audit panjang. Gunakan folder ini sebagai jalur baca utama saat onboarding developer baru.

## Mulai Dari Sini

1. Baca [`../README.md`](../README.md) untuk gambaran umum project.
2. Lanjut ke [`developer-guide.md`](./developer-guide.md) untuk setup lokal dan workflow harian.
3. Baca [`architecture.md`](./architecture.md) untuk memahami arsitektur request, auth, tenancy, dan akses data.
4. Gunakan [`modules.md`](./modules.md) untuk mencari lokasi fitur dan domain business logic.
5. Jika mengerjakan storefront, checkout, atau order publik, baca dokumen e-commerce lebih dulu.

## Peta Dokumen

| Dokumen | Isi |
|---|---|
| [`developer-guide.md`](./developer-guide.md) | Setup lokal, environment, script penting, alur kerja coding, testing, dan troubleshooting |
| [`database-mode-switching.md`](./database-mode-switching.md) | Cara pindah runtime database antara lokal dan Railway, plus cara cek mode aktif |
| [`architecture.md`](./architecture.md) | Arsitektur aplikasi, route layer, auth, tenancy, RBAC, data access, dan deployment notes |
| [`modules.md`](./modules.md) | Peta modul bisnis, route dashboard, folder terkait, dan tanggung jawab per domain |
| [`ecommerce-implementation.md`](./ecommerce-implementation.md) | Kondisi implementasi e-commerce saat ini, flow bisnis yang sudah hidup, route penting, dan batas yang masih ada |
| [`ecommerce-next-steps.md`](./ecommerce-next-steps.md) | Urutan kerja berikutnya yang disarankan setelah fondasi e-commerce dan theme builder selesai |
| [`syirkah-accounting.md`](./syirkah-accounting.md) | Model akuntansi syirkah (Mudharabah vs Inan), struktur CoA, aturan migrasi aset tetap, dan konvensi cash flow |

## Referensi Tambahan Di Root Repo

| Dokumen | Kapan Dipakai |
|---|---|
| [`../DOCUMENTATION.md`](../DOCUMENTATION.md) | Saat butuh audit codebase yang lebih panjang dan historis |
| [`../PLAYBOOK_MIGRASI_KE_NIZAM.md`](../PLAYBOOK_MIGRASI_KE_NIZAM.md) | Saat menangani onboarding atau migrasi client |
| [`../CHECKLIST_ONBOARDING_MIGRASI_NIZAM.md`](../CHECKLIST_ONBOARDING_MIGRASI_NIZAM.md) | Saat menjalankan checklist operasional onboarding |
| [`../PANDUAN_ADMIN_SAAS_NIZAM.md`](../PANDUAN_ADMIN_SAAS_NIZAM.md) | Saat mengelola kebutuhan admin SaaS dan operasional platform |
| [`../templates/migrasi/README.md`](../templates/migrasi/README.md) | Saat menyiapkan template migrasi data untuk client |

## Prinsip Dokumentasi

- Fokus pada kondisi codebase saat ini, bukan hanya histori.
- Jelaskan area transisi secara eksplisit jika nama file dan perilaku runtime tidak lagi sepenuhnya sama.
- Gunakan dokumen singkat per topik agar mudah di-scan developer yang baru bergabung.
