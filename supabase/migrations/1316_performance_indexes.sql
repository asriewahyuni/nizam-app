-- ============================================================
-- Migration 1316: Performance Indexes
-- Tujuan: Tambah missing indexes di tabel-tabel hot yang sering
--         di-scan penuh (seq_scan tinggi, idx_scan rendah).
-- ============================================================

-- ── 1. approval_requests ──────────────────────────────────────
-- Kolom yang benar: requester_id (bukan requested_by)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_approval_requests_requester
  ON public.approval_requests (org_id, requester_id, requested_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_approval_requests_approver
  ON public.approval_requests (org_id, approver_id, status);

-- ── 2. org_module_instances ───────────────────────────────────
-- Covering: WHERE org_id = $1 AND status = $2
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_org_module_instances_org_status
  ON public.org_module_instances (org_id, status)
  INCLUDE (module_key);

-- ── 3. stock_movements ───────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_movements_org_created
  ON public.stock_movements (org_id, created_at DESC);

-- ── 4. purchase_items ─────────────────────────────────────────
-- Kolom yang benar: purchase_id (bukan purchase_order_id)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_items_purchase_id
  ON public.purchase_items (purchase_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_items_product_id
  ON public.purchase_items (product_id);

-- ── 5. inventory_stocks ───────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_stocks_org_id
  ON public.inventory_stocks (org_id);

-- ── 6. branches — covering index ─────────────────────────────
-- Drop lama, buat baru dengan INCLUDE
DROP INDEX CONCURRENTLY IF EXISTS idx_branches_org_active;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_branches_org_active
  ON public.branches (org_id, is_active)
  INCLUDE (id, name, code);

-- ── 7. organizations — covering untuk getActiveOrg ───────────
-- plan_name tidak ada, pakai kolom yang benar: subscription_end, is_active
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organizations_id_covering
  ON public.organizations (id)
  INCLUDE (name, slug, subscription_end, is_active, parent_org_id);

-- ── 8. employees — composite user_id + org_id ────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employees_user_id_org_id
  ON public.employees (user_id, org_id)
  WHERE user_id IS NOT NULL;

-- ── 9. org_members — covering untuk getActiveOrg ─────────────
-- custom_role_name tidak ada, pakai kolom yang ada: role, is_active, role_id
DROP INDEX CONCURRENTLY IF EXISTS idx_org_members_user_id;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_org_members_user_org_covering
  ON public.org_members (user_id, org_id)
  INCLUDE (role, is_active, role_id);

-- ── 10. coa_account_requests ─────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_coa_requests_org_status
  ON public.coa_account_requests (org_id, status, created_at DESC);

-- ── 11. internal_auth_users — covering ───────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_internal_auth_users_id_active
  ON public.internal_auth_users (id, is_active)
  INCLUDE (legacy_user_id, login_nik, display_name);

-- ── 12. internal_auth_sessions — tanpa predicate dinamis ─────
-- Ganti partial index (pakai now() tidak immutable) dengan index biasa
-- + index expires_at untuk filter expired sessions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auth_sessions_token_covering
  ON public.internal_auth_sessions (token_hash)
  INCLUDE (user_id, expires_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auth_sessions_expires
  ON public.internal_auth_sessions (expires_at);

-- ── ANALYZE untuk update statistik query planner ─────────────
ANALYZE public.approval_requests;
ANALYZE public.org_module_instances;
ANALYZE public.stock_movements;
ANALYZE public.purchase_items;
ANALYZE public.inventory_stocks;
ANALYZE public.branches;
ANALYZE public.organizations;
ANALYZE public.employees;
ANALYZE public.org_members;
ANALYZE public.internal_auth_users;
ANALYZE public.internal_auth_sessions;
