#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p migration-data migration-logs backups

if [[ ! -f .env ]]; then
  echo "Missing .env" >&2
  exit 1
fi

SUPABASE_ACCESS_TOKEN_VALUE="$(python3 - <<'PY'
from pathlib import Path
for line in Path('.env').read_text().splitlines():
    if line.startswith('SUPABASE_ACCESS_TOKEN='):
        print(line.split('=',1)[1].strip().strip('"'))
        break
PY
)"

SUPABASE_PASSWORD_VALUE="$(python3 - <<'PY'
from pathlib import Path
for line in Path('.env').read_text().splitlines():
    if line.startswith('SUPABASE_PASSWORD='):
        print(line.split('=',1)[1].strip().strip('"'))
        break
PY
)"

SUPABASE_PROJECT_REF="$(python3 - <<'PY'
from pathlib import Path
import re
text=Path('.env').read_text()
m=re.search(r'^NEXT_PUBLIC_SUPABASE_URL="?([^"]+)"?$', text, re.M)
if not m:
    raise SystemExit('Missing NEXT_PUBLIC_SUPABASE_URL')
print(m.group(1).split('//',1)[1].split('.',1)[0])
PY
)"

export SUPABASE_ACCESS_TOKEN="$SUPABASE_ACCESS_TOKEN_VALUE"
export SUPABASE_DB_PASSWORD="$SUPABASE_PASSWORD_VALUE"

supabase link --project-ref "$SUPABASE_PROJECT_REF"
supabase db dump --linked --data-only -f migration-data/source_data.sql
supabase db dump --linked --schema public --schema auth -f migration-data/source_schema.sql

python3 - <<'PY'
from pathlib import Path
import re
text=Path('migration-data/source_data.sql').read_text()
counts={}
for m in re.finditer(r'INSERT INTO "([^"]+)"\."([^"]+)" .*? VALUES\n(.*?);', text, re.S):
    schema, table, values = m.group(1), m.group(2), m.group(3)
    key=f'{schema}.{table}'
    rows=0
    in_str=False
    depth=0
    prev=''
    for ch in values:
        if ch=="'" and prev!='\\':
            in_str=not in_str
        if not in_str:
            if ch=='(':
                if depth==0:
                    rows += 1
                depth += 1
            elif ch==')' and depth>0:
                depth -= 1
        prev=ch
    counts[key]=rows
Path('migration-logs/source_counts.txt').write_text('\n'.join(f'{k}={counts[k]}' for k in sorted(counts)) + '\n')
print(f'Export complete. Counted {len(counts)} source tables.')
PY
