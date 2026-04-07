#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

CONTAINER_NAME="supabase_db_nizam-app"
SKIP_EXPORT="false"
SKIP_SMOKE="false"

for arg in "$@"; do
  case "$arg" in
    --skip-export)
      SKIP_EXPORT="true"
      ;;
    --skip-smoke)
      SKIP_SMOKE="true"
      ;;
    --container=*)
      CONTAINER_NAME="${arg#*=}"
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: $0 [--container=name] [--skip-export] [--skip-smoke]" >&2
      exit 1
      ;;
  esac
done

echo "== Full migration workflow =="
echo "Container     : $CONTAINER_NAME"
echo "Skip export   : $SKIP_EXPORT"
echo "Skip smoke    : $SKIP_SMOKE"

if [[ "$SKIP_EXPORT" != "true" ]]; then
  echo
  echo "[1/5] Export source Supabase data"
  "$ROOT_DIR/scripts/export_supabase_data.sh"
else
  echo
  echo "[1/5] Export source Supabase data (skipped)"
fi

echo
echo "[2/5] Load filtered source data into target"
"$ROOT_DIR/scripts/load_local_target.sh" "$CONTAINER_NAME"

echo
echo "[3/5] Validate migration counts/report"
python3 "$ROOT_DIR/scripts/validate_migration_counts.py"

echo
echo "[4/5] Auth runtime sync"
"$ROOT_DIR/scripts/sync_auth_runtime_users.sh" "$CONTAINER_NAME"

if [[ "$SKIP_SMOKE" != "true" ]]; then
  echo
  echo "[5/5] Regression smoke"
  "$ROOT_DIR/scripts/run_regression_smoke.sh"
else
  echo
  echo "[5/5] Regression smoke (skipped)"
fi

echo
echo "Full migration workflow completed successfully."
