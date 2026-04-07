#!/usr/bin/env python3
from pathlib import Path

source = {}
target = {}

source_path = Path('migration-logs/source_counts.txt')
target_path = Path('migration-logs/target_counts.txt')

if not source_path.exists() or not target_path.exists():
    raise SystemExit('Missing source_counts.txt or target_counts.txt in migration-logs/')

for line in source_path.read_text().splitlines():
    if '=' in line:
        k, v = line.split('=', 1)
        source[k] = int(v)

for line in target_path.read_text().splitlines():
    if '=' in line:
        k, v = line.split('=', 1)
        target[k] = int(v)

keys = [
    'auth.users',
    'public.organizations',
    'public.org_members',
    'public.branches',
    'public.employees',
    'public.accounts',
    'public.contacts',
    'public.products',
    'public.sales',
    'public.purchases',
    'public.journal_entries',
    'public.purchase_requests',
    'public.saas_invoices',
    'public.ai_token_wallets',
]

rows = [
    '# Laporan Validasi Migrasi Data',
    '',
    '## Perbandingan Count Source vs Target',
    '',
    '| Table | Source | Target | Status |',
    '|---|---:|---:|---|',
]

for key in keys:
    s = source.get(key)
    t = target.get(key)
    status = 'MATCH' if s == t else 'DIFF'
    rows.append(f'| `{key}` | {s if s is not None else "-"} | {t if t is not None else "-"} | {status} |')

rows += [
    '',
    '## Catatan',
    '',
    '- Source dump asli bisa memuat tabel legacy yang tidak ada di schema target aktif.',
    '- Jika status `DIFF`, cek apakah tabel tersebut memang sengaja tidak dimigrasikan penuh atau ada transform/filter saat import.',
    '- Backup rollback tersedia di folder `backups/` dari setiap eksekusi load.',
]

Path('migration-logs/MIGRATION_VALIDATION_REPORT.md').write_text('\n'.join(rows) + '\n')
print('Wrote migration-logs/MIGRATION_VALIDATION_REPORT.md')
