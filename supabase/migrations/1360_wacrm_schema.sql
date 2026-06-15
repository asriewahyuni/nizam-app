-- supabase/migrations/1360_wacrm_schema.sql
-- Modul WA CRM: kontak WhatsApp, pipeline kanban, inbox percakapan,
-- AI auto-reply, import anggota grup, koneksi WA Web bridge, dan CoA opsional.

-- ── ENUMS ─────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE wacrm_pipeline_stage AS ENUM ('masuk', 'follow_up', 'negosiasi', 'closing');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE wacrm_message_direction AS ENUM ('in', 'out');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE wacrm_ai_mode AS ENUM ('full_auto', 'semi_auto', 'off');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE wacrm_ai_suggestion_status AS ENUM ('pending', 'approved', 'skipped', 'edited');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE wacrm_connection_status AS ENUM ('connected', 'disconnected', 'qr_pending');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 1. KONTAK / PIPELINE ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.wacrm_contacts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL,
  phone             TEXT        NOT NULL,
  stage             wacrm_pipeline_stage NOT NULL DEFAULT 'masuk',
  product_interest  TEXT,
  notes             TEXT,
  last_message_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (org_id, phone)
);
ALTER TABLE public.wacrm_contacts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_wacrm_contacts_org   ON public.wacrm_contacts(org_id);
CREATE INDEX IF NOT EXISTS idx_wacrm_contacts_stage ON public.wacrm_contacts(org_id, stage);
CREATE INDEX IF NOT EXISTS idx_wacrm_contacts_phone ON public.wacrm_contacts(phone);

CREATE TABLE IF NOT EXISTS public.wacrm_pipeline_history (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id  UUID        NOT NULL REFERENCES public.wacrm_contacts(id) ON DELETE CASCADE,
  from_stage  wacrm_pipeline_stage,
  to_stage    wacrm_pipeline_stage NOT NULL,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.wacrm_pipeline_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_wacrm_pipeline_history_org     ON public.wacrm_pipeline_history(org_id);
CREATE INDEX IF NOT EXISTS idx_wacrm_pipeline_history_contact ON public.wacrm_pipeline_history(contact_id);

-- ── 2. PESAN / INBOX ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.wacrm_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id  UUID        NOT NULL REFERENCES public.wacrm_contacts(id) ON DELETE CASCADE,
  direction   wacrm_message_direction NOT NULL,
  body        TEXT        NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered   BOOLEAN     NOT NULL DEFAULT FALSE,
  read_at     TIMESTAMPTZ
);
ALTER TABLE public.wacrm_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_wacrm_messages_org     ON public.wacrm_messages(org_id);
CREATE INDEX IF NOT EXISTS idx_wacrm_messages_contact ON public.wacrm_messages(contact_id, sent_at DESC);

CREATE TABLE IF NOT EXISTS public.wacrm_templates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  body        TEXT        NOT NULL,
  created_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.wacrm_templates ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_wacrm_templates_org ON public.wacrm_templates(org_id);

-- ── 3. AI AUTO-REPLY ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.wacrm_ai_settings (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- NULL contact_id = pengaturan global untuk org
  contact_id          UUID        REFERENCES public.wacrm_contacts(id) ON DELETE CASCADE,
  mode                wacrm_ai_mode NOT NULL DEFAULT 'off',
  custom_instruction  TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, contact_id)
);
ALTER TABLE public.wacrm_ai_settings ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_wacrm_ai_settings_org     ON public.wacrm_ai_settings(org_id);
CREATE INDEX IF NOT EXISTS idx_wacrm_ai_settings_contact ON public.wacrm_ai_settings(contact_id);

CREATE TABLE IF NOT EXISTS public.wacrm_ai_suggestions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id      UUID        NOT NULL REFERENCES public.wacrm_contacts(id) ON DELETE CASCADE,
  suggested_text  TEXT        NOT NULL,
  status          wacrm_ai_suggestion_status NOT NULL DEFAULT 'pending',
  final_text      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.wacrm_ai_suggestions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_wacrm_ai_suggestions_org     ON public.wacrm_ai_suggestions(org_id);
CREATE INDEX IF NOT EXISTS idx_wacrm_ai_suggestions_contact ON public.wacrm_ai_suggestions(contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wacrm_ai_suggestions_status  ON public.wacrm_ai_suggestions(org_id, status);

-- ── 4. GRUP WA / IMPORT KONTAK ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.wacrm_groups (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  group_id_wa     TEXT        NOT NULL,
  name            TEXT        NOT NULL,
  member_count    INTEGER     NOT NULL DEFAULT 0,
  last_synced_at  TIMESTAMPTZ,
  UNIQUE (org_id, group_id_wa)
);
ALTER TABLE public.wacrm_groups ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_wacrm_groups_org ON public.wacrm_groups(org_id);

CREATE TABLE IF NOT EXISTS public.wacrm_group_members (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  group_id     UUID        NOT NULL REFERENCES public.wacrm_groups(id) ON DELETE CASCADE,
  name         TEXT,
  phone        TEXT        NOT NULL,
  imported     BOOLEAN     NOT NULL DEFAULT FALSE,
  imported_at  TIMESTAMPTZ
);
ALTER TABLE public.wacrm_group_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_wacrm_group_members_org   ON public.wacrm_group_members(org_id);
CREATE INDEX IF NOT EXISTS idx_wacrm_group_members_group ON public.wacrm_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_wacrm_group_members_phone ON public.wacrm_group_members(org_id, phone);

-- ── 5. KONEKSI WA WEB BRIDGE ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.wacrm_connections (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status          wacrm_connection_status NOT NULL DEFAULT 'disconnected',
  -- Digunakan untuk verifikasi signature HMAC dari bridge → Nizam
  webhook_secret  TEXT,
  connected_phone TEXT,
  connected_at    TIMESTAMPTZ,
  last_ping_at    TIMESTAMPTZ,
  UNIQUE (org_id)
);
ALTER TABLE public.wacrm_connections ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_wacrm_connections_org ON public.wacrm_connections(org_id);

CREATE TABLE IF NOT EXISTS public.wacrm_webhook_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type   TEXT        NOT NULL,
  payload      JSONB,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed    BOOLEAN     NOT NULL DEFAULT FALSE
);
ALTER TABLE public.wacrm_webhook_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_wacrm_webhook_logs_org       ON public.wacrm_webhook_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_wacrm_webhook_logs_received  ON public.wacrm_webhook_logs(org_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_wacrm_webhook_logs_processed ON public.wacrm_webhook_logs(org_id, processed);

-- ── RLS POLICIES ──────────────────────────────────────────────────────────
-- Pola: anggota org aktif bisa baca & tulis, platform admin bypass semua.

-- wacrm_contacts
DROP POLICY IF EXISTS "wacrm_contacts_select" ON public.wacrm_contacts;
CREATE POLICY "wacrm_contacts_select" ON public.wacrm_contacts FOR SELECT
  USING (public.is_platform_admin() OR org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND is_active = TRUE
  ));
DROP POLICY IF EXISTS "wacrm_contacts_insert" ON public.wacrm_contacts;
CREATE POLICY "wacrm_contacts_insert" ON public.wacrm_contacts FOR INSERT
  WITH CHECK (public.is_platform_admin() OR org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND is_active = TRUE
  ));
DROP POLICY IF EXISTS "wacrm_contacts_update" ON public.wacrm_contacts;
CREATE POLICY "wacrm_contacts_update" ON public.wacrm_contacts FOR UPDATE
  USING (public.is_platform_admin() OR org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND is_active = TRUE
  ));
DROP POLICY IF EXISTS "wacrm_contacts_delete" ON public.wacrm_contacts;
CREATE POLICY "wacrm_contacts_delete" ON public.wacrm_contacts FOR DELETE
  USING (public.is_platform_admin() OR org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND is_active = TRUE
  ));

-- wacrm_pipeline_history
DROP POLICY IF EXISTS "wacrm_pipeline_history_select" ON public.wacrm_pipeline_history;
CREATE POLICY "wacrm_pipeline_history_select" ON public.wacrm_pipeline_history FOR SELECT
  USING (public.is_platform_admin() OR org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND is_active = TRUE
  ));
DROP POLICY IF EXISTS "wacrm_pipeline_history_insert" ON public.wacrm_pipeline_history;
CREATE POLICY "wacrm_pipeline_history_insert" ON public.wacrm_pipeline_history FOR INSERT
  WITH CHECK (public.is_platform_admin() OR org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND is_active = TRUE
  ));

-- wacrm_messages
DROP POLICY IF EXISTS "wacrm_messages_select" ON public.wacrm_messages;
CREATE POLICY "wacrm_messages_select" ON public.wacrm_messages FOR SELECT
  USING (public.is_platform_admin() OR org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND is_active = TRUE
  ));
DROP POLICY IF EXISTS "wacrm_messages_insert" ON public.wacrm_messages;
CREATE POLICY "wacrm_messages_insert" ON public.wacrm_messages FOR INSERT
  WITH CHECK (public.is_platform_admin() OR org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND is_active = TRUE
  ));

-- wacrm_templates
DROP POLICY IF EXISTS "wacrm_templates_select" ON public.wacrm_templates;
CREATE POLICY "wacrm_templates_select" ON public.wacrm_templates FOR SELECT
  USING (public.is_platform_admin() OR org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND is_active = TRUE
  ));
DROP POLICY IF EXISTS "wacrm_templates_insert" ON public.wacrm_templates;
CREATE POLICY "wacrm_templates_insert" ON public.wacrm_templates FOR INSERT
  WITH CHECK (public.is_platform_admin() OR org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND is_active = TRUE
  ));
DROP POLICY IF EXISTS "wacrm_templates_update" ON public.wacrm_templates;
CREATE POLICY "wacrm_templates_update" ON public.wacrm_templates FOR UPDATE
  USING (public.is_platform_admin() OR org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND is_active = TRUE
  ));
DROP POLICY IF EXISTS "wacrm_templates_delete" ON public.wacrm_templates;
CREATE POLICY "wacrm_templates_delete" ON public.wacrm_templates FOR DELETE
  USING (public.is_platform_admin() OR org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND is_active = TRUE
  ));

-- wacrm_ai_settings
DROP POLICY IF EXISTS "wacrm_ai_settings_select" ON public.wacrm_ai_settings;
CREATE POLICY "wacrm_ai_settings_select" ON public.wacrm_ai_settings FOR SELECT
  USING (public.is_platform_admin() OR org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND is_active = TRUE
  ));
DROP POLICY IF EXISTS "wacrm_ai_settings_insert" ON public.wacrm_ai_settings;
CREATE POLICY "wacrm_ai_settings_insert" ON public.wacrm_ai_settings FOR INSERT
  WITH CHECK (public.is_platform_admin() OR org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND is_active = TRUE
  ));
DROP POLICY IF EXISTS "wacrm_ai_settings_update" ON public.wacrm_ai_settings;
CREATE POLICY "wacrm_ai_settings_update" ON public.wacrm_ai_settings FOR UPDATE
  USING (public.is_platform_admin() OR org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND is_active = TRUE
  ));

-- wacrm_ai_suggestions
DROP POLICY IF EXISTS "wacrm_ai_suggestions_select" ON public.wacrm_ai_suggestions;
CREATE POLICY "wacrm_ai_suggestions_select" ON public.wacrm_ai_suggestions FOR SELECT
  USING (public.is_platform_admin() OR org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND is_active = TRUE
  ));
DROP POLICY IF EXISTS "wacrm_ai_suggestions_insert" ON public.wacrm_ai_suggestions;
CREATE POLICY "wacrm_ai_suggestions_insert" ON public.wacrm_ai_suggestions FOR INSERT
  WITH CHECK (public.is_platform_admin() OR org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND is_active = TRUE
  ));
DROP POLICY IF EXISTS "wacrm_ai_suggestions_update" ON public.wacrm_ai_suggestions;
CREATE POLICY "wacrm_ai_suggestions_update" ON public.wacrm_ai_suggestions FOR UPDATE
  USING (public.is_platform_admin() OR org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND is_active = TRUE
  ));

-- wacrm_groups
DROP POLICY IF EXISTS "wacrm_groups_select" ON public.wacrm_groups;
CREATE POLICY "wacrm_groups_select" ON public.wacrm_groups FOR SELECT
  USING (public.is_platform_admin() OR org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND is_active = TRUE
  ));
DROP POLICY IF EXISTS "wacrm_groups_insert" ON public.wacrm_groups;
CREATE POLICY "wacrm_groups_insert" ON public.wacrm_groups FOR INSERT
  WITH CHECK (public.is_platform_admin() OR org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND is_active = TRUE
  ));
DROP POLICY IF EXISTS "wacrm_groups_update" ON public.wacrm_groups;
CREATE POLICY "wacrm_groups_update" ON public.wacrm_groups FOR UPDATE
  USING (public.is_platform_admin() OR org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND is_active = TRUE
  ));
DROP POLICY IF EXISTS "wacrm_groups_delete" ON public.wacrm_groups;
CREATE POLICY "wacrm_groups_delete" ON public.wacrm_groups FOR DELETE
  USING (public.is_platform_admin() OR org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND is_active = TRUE
  ));

-- wacrm_group_members
DROP POLICY IF EXISTS "wacrm_group_members_select" ON public.wacrm_group_members;
CREATE POLICY "wacrm_group_members_select" ON public.wacrm_group_members FOR SELECT
  USING (public.is_platform_admin() OR org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND is_active = TRUE
  ));
DROP POLICY IF EXISTS "wacrm_group_members_insert" ON public.wacrm_group_members;
CREATE POLICY "wacrm_group_members_insert" ON public.wacrm_group_members FOR INSERT
  WITH CHECK (public.is_platform_admin() OR org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND is_active = TRUE
  ));
DROP POLICY IF EXISTS "wacrm_group_members_update" ON public.wacrm_group_members;
CREATE POLICY "wacrm_group_members_update" ON public.wacrm_group_members FOR UPDATE
  USING (public.is_platform_admin() OR org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND is_active = TRUE
  ));

-- wacrm_connections (hanya admin yang bisa lihat karena menyimpan webhook_secret)
DROP POLICY IF EXISTS "wacrm_connections_select" ON public.wacrm_connections;
CREATE POLICY "wacrm_connections_select" ON public.wacrm_connections FOR SELECT
  USING (public.is_platform_admin() OR org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND is_active = TRUE
  ));
DROP POLICY IF EXISTS "wacrm_connections_insert" ON public.wacrm_connections;
CREATE POLICY "wacrm_connections_insert" ON public.wacrm_connections FOR INSERT
  WITH CHECK (public.is_platform_admin() OR org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND is_active = TRUE
  ));
DROP POLICY IF EXISTS "wacrm_connections_update" ON public.wacrm_connections;
CREATE POLICY "wacrm_connections_update" ON public.wacrm_connections FOR UPDATE
  USING (public.is_platform_admin() OR org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND is_active = TRUE
  ));

-- wacrm_webhook_logs (insert dari webhook public endpoint, select dari org members)
DROP POLICY IF EXISTS "wacrm_webhook_logs_select" ON public.wacrm_webhook_logs;
CREATE POLICY "wacrm_webhook_logs_select" ON public.wacrm_webhook_logs FOR SELECT
  USING (public.is_platform_admin() OR org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND is_active = TRUE
  ));
DROP POLICY IF EXISTS "wacrm_webhook_logs_insert" ON public.wacrm_webhook_logs;
-- Webhook endpoint menggunakan service role / bypass RLS saat insert dari API route
CREATE POLICY "wacrm_webhook_logs_insert" ON public.wacrm_webhook_logs FOR INSERT
  WITH CHECK (TRUE);

-- ── STORED PROCEDURE: inject_wacrm_coa ───────────────────────────────────
-- Dipanggil saat modul WA CRM diaktifkan + modul Accounting aktif.
-- Idempotent: skip jika akun '4700' sudah ada untuk org ini.

CREATE OR REPLACE FUNCTION public.inject_wacrm_coa(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.accounts WHERE org_id = p_org_id AND code = '4700'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.accounts (org_id, code, name, type, normal_balance, is_system)
  VALUES
    (p_org_id, '4700', 'Pendapatan Penjualan WA CRM', 'REVENUE',  'CREDIT', TRUE),
    (p_org_id, '6700', 'Biaya Komisi Sales',           'EXPENSE',  'DEBIT',  TRUE),
    (p_org_id, '6701', 'Biaya Komunikasi',             'EXPENSE',  'DEBIT',  TRUE)
  ON CONFLICT (org_id, code) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.inject_wacrm_coa(UUID) IS
  'Inject akun CoA WA CRM (Pendapatan 4700, Komisi 6700, Komunikasi 6701) untuk org. Idempotent.';
