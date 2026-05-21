# GitHub Copilot Instructions — Nizam App

## 🚨 CRITICAL: NO SUPABASE CLOUD

**This project does NOT use Supabase Cloud.**

The folder `lib/supabase/` and imports `from '@/lib/supabase/server'` in 249+ files are **legacy naming for a Railway PostgreSQL compatibility wrapper** — NOT actual Supabase Cloud connections.

### Quick Facts
- ✅ Database = **Railway PostgreSQL** (`pg` native client)
- ✅ Auth = **Internal Auth** (cookie `nizam_internal_session`)
- ✅ Storage = **Railway S3-compatible**
- ❌ Supabase Cloud is **NOT** used
- ❌ Supabase Auth is **NOT** used
- ❌ Supabase Storage is **NOT** used

### When suggesting code:
- DO NOT recommend Supabase setup, env vars, or RLS policies
- DO NOT assume `@/lib/supabase/server` connects to Supabase Cloud
- DO understand `lib/supabase/*` is a compatibility wrapper to Railway

### Read these first:
1. `AGENTS.md` — full context
2. `lib/supabase/README.md` — compatibility layer details
3. `lib/supabase/server.ts` — top comment explains wrapper

## Tech Stack
- Next.js 16 (App Router) + TypeScript
- Railway PostgreSQL + Internal Auth
- Tailwind CSS + Framer Motion + Vitest

## Coding Conventions
- Server Actions use `'use server'` directive
- Indonesian comments OK for business logic
- English for technical/structural comments
- PascalCase for components, kebab-case for utility files
