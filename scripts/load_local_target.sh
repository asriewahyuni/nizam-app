#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

CONTAINER_NAME="${1:-supabase_db_nizam-app}"
BACKUP_NAME="backups/pre_load_$(date +%Y-%m-%d_%H-%M-%S).dump"

mkdir -p backups migration-data migration-logs

if [[ ! -f migration-data/source_data.sql ]]; then
  echo "Missing migration-data/source_data.sql" >&2
  exit 1
fi

docker exec "$CONTAINER_NAME" sh -lc "pg_dump -U postgres -d postgres -Fc -f /tmp/pre_load.dump"
docker cp "$CONTAINER_NAME":/tmp/pre_load.dump "$BACKUP_NAME"

python3 - <<'PY'
from pathlib import Path
import re, subprocess
text=Path('migration-data/source_data.sql').read_text()
source_tables=[]
seen=set()
for m in re.finditer(r'INSERT INTO "([^"]+)"\."([^"]+)"', text):
    key=(m.group(1), m.group(2))
    if key not in seen:
        seen.add(key)
        source_tables.append(key)
res=subprocess.check_output(['docker','exec','supabase_db_nizam-app','psql','-U','postgres','-d','postgres','-At','-c',"select schemaname||'.'||tablename from pg_tables where schemaname in ('public','auth');"], text=True)
existing=set(line.strip() for line in res.splitlines() if line.strip())

statements=[]
buf=[]
for line in text.splitlines(True):
    buf.append(line)
    if line.rstrip().endswith(';'):
        statements.append(''.join(buf))
        buf=[]
if buf:
    statements.append(''.join(buf))

kept=[]
removed=[]
for st in statements:
    m=re.search(r'INSERT INTO "([^"]+)"\."([^"]+)"', st)
    if m:
      key=f'{m.group(1)}.{m.group(2)}'
      if key in existing:
        kept.append(st)
      else:
        removed.append(key)
    else:
      kept.append(st)

Path('migration-data/source_data_existing.sql').write_text(''.join(kept))

kept_tables=[f'"{s}"."{t}"' for (s,t) in source_tables if f'{s}.{t}' in existing]
Path('migration-data/truncate_existing_tables.sql').write_text('TRUNCATE TABLE\n  '+',\n  '.join(kept_tables)+'\nCASCADE;\n')

schema = Path('migration-data/source_schema.sql').read_text() if Path('migration-data/source_schema.sql').exists() else ''
blocks = {}
for m in re.finditer(r'CREATE TABLE IF NOT EXISTS "([^"]+)"\."([^"]+)" \((.*?)\n\);', schema, re.S):
    sch, table, body = m.group(1), m.group(2), m.group(3)
    cols = {}
    for raw in body.splitlines():
        line = raw.strip().rstrip(',')
        if not line or line.startswith('CONSTRAINT'):
            continue
        colm = re.match(r'"([^"]+)"\s+(.*)', line)
        if not colm:
            continue
        cols[colm.group(1)] = colm.group(2)
    blocks[(sch, table)] = cols

res_cols=subprocess.check_output(['docker','exec','supabase_db_nizam-app','psql','-U','postgres','-d','postgres','-At','-F','|','-c',"select table_schema, table_name, column_name from information_schema.columns where table_schema in ('public','auth') order by table_schema, table_name, ordinal_position;"], text=True)
existing_cols = {}
for line in res_cols.splitlines():
    if not line.strip():
        continue
    sch, table, col = line.split('|')
    existing_cols.setdefault((sch, table), set()).add(col)

stmts=[]
for key, src_cols in blocks.items():
    if key not in existing_cols:
        continue
    sch, table = key
    for col, definition in src_cols.items():
        if col not in existing_cols[key]:
            stmts.append(f'ALTER TABLE "{sch}"."{table}" ADD COLUMN IF NOT EXISTS "{col}" {definition};')
Path('migration-data/add_missing_columns.sql').write_text('\n'.join(stmts)+'\n')

Path('migration-logs/removed_source_tables.txt').write_text('\n'.join(sorted(set(removed))) + ('\n' if removed else ''))
print(f'Prepared filtered dump. Removed {len(set(removed))} legacy tables.')
PY

docker cp migration-data/source_data_existing.sql "$CONTAINER_NAME":/tmp/source_data_existing.sql
docker cp migration-data/truncate_existing_tables.sql "$CONTAINER_NAME":/tmp/truncate_existing_tables.sql
docker cp migration-data/add_missing_columns.sql "$CONTAINER_NAME":/tmp/add_missing_columns.sql

docker exec "$CONTAINER_NAME" sh -lc 'psql -U postgres -d postgres -f /tmp/add_missing_columns.sql >/tmp/add_missing_columns.log && psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f /tmp/truncate_existing_tables.sql >/tmp/final_truncate.log && psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f /tmp/source_data_existing.sql >/tmp/final_load.log'

"$ROOT_DIR/scripts/sync_auth_runtime_users.sh" "$CONTAINER_NAME"

docker exec "$CONTAINER_NAME" psql -U postgres -d postgres -At -F '=' -c "select 'public.organizations', count(*) from public.organizations union all select 'public.org_members', count(*) from public.org_members union all select 'public.branches', count(*) from public.branches union all select 'public.employees', count(*) from public.employees union all select 'public.accounts', count(*) from public.accounts union all select 'public.contacts', count(*) from public.contacts union all select 'public.products', count(*) from public.products union all select 'public.sales', count(*) from public.sales union all select 'public.purchases', count(*) from public.purchases union all select 'public.journal_entries', count(*) from public.journal_entries union all select 'auth.users', count(*) from auth.users union all select 'public.purchase_requests', count(*) from public.purchase_requests union all select 'public.saas_invoices', count(*) from public.saas_invoices union all select 'public.ai_token_wallets', count(*) from public.ai_token_wallets;" > migration-logs/target_counts.txt

echo "Load complete. Backup saved to $BACKUP_NAME"
