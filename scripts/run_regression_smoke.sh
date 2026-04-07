#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "[1/4] Typecheck"
npx tsc --noEmit

echo "[2/4] Tests"
npm test

echo "[3/4] Build"
npm run build

echo "[4/4] Auth runtime consistency"
docker exec supabase_db_nizam-app psql -U postgres -d postgres -At -c "
select 'auth.users='||count(*) from auth.users where deleted_at is null
union all
select 'public.users='||count(*) from public.users
union all
select 'linked.users='||count(*) from public.users pu join auth.users au on au.id = pu.id and au.deleted_at is null;
"

echo "Regression smoke completed successfully."
