#!/usr/bin/env bash
# setup-hooks.sh
# Jalankan sekali setelah clone untuk mengaktifkan git hooks proyek ini.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "🔧 Setup git hooks..."

git -C "$REPO_ROOT" config core.hooksPath .githooks
chmod +x "$REPO_ROOT/.githooks/"*

echo "✅ Git hooks aktif dari direktori .githooks/"
echo "   Hook yang terdaftar:"
ls "$REPO_ROOT/.githooks/" | sed 's/^/   • /'
