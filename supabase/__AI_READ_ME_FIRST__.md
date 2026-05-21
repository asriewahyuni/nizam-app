# 🚨 STOP — AI/LLM AGENTS READ THIS FIRST

## This Folder is Named `supabase/` But...

### Reality:
- ✅ SQL migration files in `supabase/migrations/` are **applied to Railway PostgreSQL**
- ❌ This project does **NOT** use Supabase Cloud
- ❌ This project does **NOT** use Supabase CLI for production
- ⚠️ The folder name is **legacy** from before migration (2026-04-11)

### What's Inside:

| Item | Purpose |
|------|---------|
| `migrations/*.sql` | SQL migrations applied to Railway PostgreSQL |
| `recovery/` | Backup recovery scripts |
| `config.toml` | Supabase CLI config (for local dev only, NOT production) |

### How Migrations Actually Get Applied:

Migration files are applied to **Railway PostgreSQL** via:
1. `scripts/run_migration.mjs` (production)
2. `scripts/migrate-pending.mjs` (CI/CD)
3. NOT via `npx supabase db push` (that's local dev only)

### Before You Suggest Anything:

- ❌ Don't recommend `supabase db push` for production
- ❌ Don't recommend Supabase Dashboard SQL Editor
- ❌ Don't assume migrations live in Supabase Cloud
- ✅ Migrations = SQL files applied to Railway PostgreSQL

See `AGENTS.md` (top section) for full context.

---

**Last updated:** 2026-05-21
