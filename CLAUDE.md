# CLAUDE.md — Claude Code Instructions for Nizam App

## 🚨 CRITICAL — READ BEFORE ANY CODE ANALYSIS 🚨

**This project DOES NOT use Supabase Cloud.**

Despite the presence of:
- Folder `lib/supabase/`
- Folder `supabase/migrations/`
- Imports `from '@/lib/supabase/server'` in 249+ files
- Package `@supabase/supabase-js` in `package.json`

→ **All database queries go to Railway PostgreSQL.** The "supabase" folder is a compatibility wrapper that keeps the Supabase SDK interface (`.from()`, `.rpc()`, `.auth.*`) but redirects all operations to Railway via `pg` native client.

### Verify Yourself:
1. `cat lib/supabase/server.ts | head -15` — see disclaimer comment
2. `cat lib/supabase/README.md` — full explanation
3. `grep AUTH_PROVIDER .env` — confirms `AUTH_PROVIDER=internal`

### Common Mistakes to Avoid:
- ❌ "Let me check the Supabase configuration..."
- ❌ "You'll need to add your Supabase URL to..."
- ❌ "Supabase RLS policies will handle this..."
- ❌ "Let me update the Supabase client..."

### Correct Mental Model:
- ✅ "Let me check the Railway PostgreSQL configuration..."
- ✅ "The `lib/supabase/server.ts` wrapper redirects to Railway..."
- ✅ "PostgreSQL native RLS at Railway handles this..."
- ✅ "Let me update the Railway DB connection wrapper..."

---

## Project Reference

@AGENTS.md

For full project context, see [AGENTS.md](./AGENTS.md).
