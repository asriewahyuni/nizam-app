# 🚨 STOP — AI/LLM AGENTS READ THIS FIRST

## You Are About to Modify Code in `lib/supabase/`

### Quick Reality Check:

| Question | Answer |
|----------|--------|
| Is this Supabase Cloud? | **NO** |
| Does this connect to *.supabase.co? | **NO** (except dead code in middleware.ts) |
| Where does data actually go? | **Railway PostgreSQL** |
| What's the auth system? | **Internal Auth** (cookie-based) |
| Why is folder named "supabase" then? | **Legacy compat layer** for 249+ import statements |

## Before You Suggest ANY Changes:

1. ✅ Read `lib/supabase/server.ts` header comment
2. ✅ Read `lib/supabase/README.md`
3. ✅ Read `AGENTS.md` top section
4. ✅ Verify `AUTH_PROVIDER=internal` in `.env`

## Things You SHOULD NOT Do:

- ❌ Suggest creating Supabase project at supabase.com
- ❌ Add env vars like `NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co`
- ❌ Recommend `npx supabase init` for production setup
- ❌ Refactor wrapper to "use real Supabase"
- ❌ Add Supabase RLS policies (use PostgreSQL native RLS at Railway)

## What This Folder Actually Contains:

| File | Real Purpose |
|------|--------------|
| `server.ts` | Railway PostgreSQL wrapper (mimics Supabase SDK interface) |
| `client.ts` | Browser → `/api/db` API route → Railway PostgreSQL |
| `auth.server.ts` | Internal Auth wrapper (TYPE imports from `@supabase/supabase-js` only) |
| `config.ts` | Deprecated stub, returns dummy values |
| `middleware.ts` | Internal Auth middleware (Supabase code path is DEAD) |
| `loose.ts` | TypeScript helper for RPC calls |

## If You Are Confused:

- **STOP coding.**
- Re-read this file.
- Re-read `AGENTS.md`.
- Ask the user for clarification.
- Do NOT make assumptions about Supabase.

---

**Last updated:** 2026-05-21
**Status:** Project 100% migrated to Railway PostgreSQL since 2026-04-11
