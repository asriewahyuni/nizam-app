# Laporan Validasi Migrasi Data

## Perbandingan Count Source vs Target

| Table | Source | Target | Status |
|---|---:|---:|---|
| `auth.users` | 47 | 47 | MATCH |
| `public.organizations` | 20 | 20 | MATCH |
| `public.org_members` | 28 | 28 | MATCH |
| `public.branches` | 20 | 20 | MATCH |
| `public.employees` | 23 | 23 | MATCH |
| `public.accounts` | 618 | 618 | MATCH |
| `public.contacts` | 33 | 33 | MATCH |
| `public.products` | 100 | 100 | MATCH |
| `public.sales` | 2 | 2 | MATCH |
| `public.purchases` | 6 | 6 | MATCH |
| `public.journal_entries` | 7 | 7 | MATCH |
| `public.purchase_requests` | - | 0 | DIFF |
| `public.saas_invoices` | 2 | 2 | MATCH |
| `public.ai_token_wallets` | 20 | 20 | MATCH |

## Catatan

- Source dump asli bisa memuat tabel legacy yang tidak ada di schema target aktif.
- Jika status `DIFF`, cek apakah tabel tersebut memang sengaja tidak dimigrasikan penuh atau ada transform/filter saat import.
- Backup rollback tersedia di folder `backups/` dari setiap eksekusi load.
