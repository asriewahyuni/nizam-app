-- =============================================================================
-- 1390_consulting_360.sql
-- Produk jasa Consulting 360, kalender privat, slot hold, engagement, dan badge.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.store_products
  ADD COLUMN IF NOT EXISTS offering_type TEXT NOT NULL DEFAULT 'STANDARD';

ALTER TABLE public.commerce_refunds
  ADD COLUMN IF NOT EXISTS policy_override BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS policy_override_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'store_products_offering_type_check'
      AND conrelid = 'public.store_products'::regclass
  ) THEN
    ALTER TABLE public.store_products
      ADD CONSTRAINT store_products_offering_type_check
      CHECK (offering_type IN ('STANDARD', 'CONSULTING_1_ON_1'));
  END IF;
END $$;

ALTER TABLE public.learning_instructor_profiles
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_learning_instructor_employee
  ON public.learning_instructor_profiles (org_id, employee_id)
  WHERE employee_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.learning_badge_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  icon_name TEXT NOT NULL DEFAULT 'badge-check',
  primary_color TEXT NOT NULL DEFAULT '#0F766E',
  accent_color TEXT NOT NULL DEFAULT '#CA8A04',
  criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, name)
);

CREATE TABLE IF NOT EXISTS public.learning_badge_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.learning_badge_templates(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('CONSULTING_ENGAGEMENT', 'COURSE', 'MANUAL')),
  source_id UUID NOT NULL,
  badge_number TEXT NOT NULL,
  verification_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  awarded_by UUID,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID,
  revoked_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, badge_number),
  UNIQUE (verification_token),
  UNIQUE (org_id, template_id, user_id, source_type, source_id)
);

CREATE TABLE IF NOT EXISTS public.consulting_offerings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_product_id UUID NOT NULL REFERENCES public.store_products(id) ON DELETE CASCADE,
  commercial_name TEXT NOT NULL DEFAULT 'Consulting 360',
  session_count INTEGER NOT NULL DEFAULT 1 CHECK (session_count BETWEEN 1 AND 100),
  duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes BETWEEN 15 AND 480),
  timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  booking_horizon_days INTEGER NOT NULL DEFAULT 90 CHECK (booking_horizon_days BETWEEN 1 AND 365),
  minimum_notice_hours INTEGER NOT NULL DEFAULT 24 CHECK (minimum_notice_hours BETWEEN 0 AND 8760),
  reschedule_limit INTEGER NOT NULL DEFAULT 2 CHECK (reschedule_limit BETWEEN 0 AND 20),
  reschedule_cutoff_hours INTEGER NOT NULL DEFAULT 24 CHECK (reschedule_cutoff_hours BETWEEN 0 AND 720),
  no_show_consumes_session BOOLEAN NOT NULL DEFAULT TRUE,
  delivery_mode TEXT NOT NULL DEFAULT 'ONLINE'
    CHECK (delivery_mode IN ('ONLINE', 'OFFLINE', 'HYBRID')),
  location_name TEXT,
  default_meeting_url TEXT,
  meeting_provider TEXT,
  intake_form_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
  badge_template_id UUID REFERENCES public.learning_badge_templates(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, store_product_id)
);

CREATE TABLE IF NOT EXISTS public.consulting_offering_consultants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  offering_id UUID NOT NULL REFERENCES public.consulting_offerings(id) ON DELETE CASCADE,
  consultant_id UUID NOT NULL REFERENCES public.learning_instructor_profiles(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, offering_id, consultant_id)
);

CREATE TABLE IF NOT EXISTS public.consulting_availability_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  offering_id UUID NOT NULL REFERENCES public.consulting_offerings(id) ON DELETE CASCADE,
  consultant_id UUID NOT NULL REFERENCES public.learning_instructor_profiles(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_local TIME NOT NULL,
  end_local TIME NOT NULL,
  valid_from DATE,
  valid_until DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_local > start_local)
);

CREATE TABLE IF NOT EXISTS public.consulting_availability_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  offering_id UUID REFERENCES public.consulting_offerings(id) ON DELETE CASCADE,
  consultant_id UUID NOT NULL REFERENCES public.learning_instructor_profiles(id) ON DELETE CASCADE,
  exception_type TEXT NOT NULL CHECK (exception_type IN ('AVAILABLE', 'BLOCKED')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS public.consulting_slot_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  offering_id UUID NOT NULL REFERENCES public.consulting_offerings(id) ON DELETE CASCADE,
  consultant_id UUID NOT NULL REFERENCES public.learning_instructor_profiles(id) ON DELETE RESTRICT,
  hold_group_id UUID NOT NULL DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'HELD'
    CHECK (status IN ('HELD', 'PENDING_PAYMENT', 'CONFIRMED', 'RELEASED', 'EXPIRED', 'CANCELLED')),
  held_until TIMESTAMPTZ NOT NULL,
  intake_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  goals TEXT,
  order_id UUID REFERENCES public.ecommerce_orders(id) ON DELETE SET NULL,
  order_item_id UUID REFERENCES public.ecommerce_order_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at),
  UNIQUE (org_id, hold_group_id, starts_at)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'consulting_slot_holds_no_overlap'
      AND conrelid = 'public.consulting_slot_holds'::regclass
  ) THEN
    ALTER TABLE public.consulting_slot_holds
      ADD CONSTRAINT consulting_slot_holds_no_overlap
      EXCLUDE USING gist (
        org_id WITH =,
        consultant_id WITH =,
        tstzrange(starts_at, ends_at, '[)') WITH &&
      )
      WHERE (status IN ('HELD', 'PENDING_PAYMENT', 'CONFIRMED'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.consulting_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  offering_id UUID NOT NULL REFERENCES public.consulting_offerings(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES public.ecommerce_orders(id) ON DELETE RESTRICT,
  order_item_id UUID NOT NULL REFERENCES public.ecommerce_order_items(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL,
  consultant_id UUID NOT NULL REFERENCES public.learning_instructor_profiles(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'IN_PROGRESS', 'COMPLETION_PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED')),
  session_count INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL,
  intake_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  goals TEXT,
  action_plan TEXT,
  progress_summary TEXT,
  final_summary TEXT,
  completion_approved_at TIMESTAMPTZ,
  completion_approved_by UUID,
  badge_award_id UUID REFERENCES public.learning_badge_awards(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, order_item_id)
);

CREATE TABLE IF NOT EXISTS public.consulting_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  engagement_id UUID NOT NULL REFERENCES public.consulting_engagements(id) ON DELETE CASCADE,
  slot_hold_id UUID NOT NULL REFERENCES public.consulting_slot_holds(id) ON DELETE RESTRICT,
  sequence_number INTEGER NOT NULL,
  user_id UUID NOT NULL,
  consultant_id UUID NOT NULL REFERENCES public.learning_instructor_profiles(id) ON DELETE RESTRICT,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'SCHEDULED'
    CHECK (status IN ('SCHEDULED', 'COMPLETED', 'NO_SHOW', 'CANCELLED')),
  attendance_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (attendance_status IN ('PENDING', 'PRESENT', 'LATE', 'ABSENT', 'EXCUSED')),
  delivery_mode TEXT NOT NULL CHECK (delivery_mode IN ('ONLINE', 'OFFLINE', 'HYBRID')),
  location_name TEXT,
  meeting_url TEXT,
  meeting_provider TEXT,
  reminder_offsets_minutes INTEGER[] NOT NULL DEFAULT '{1440,60}'::integer[],
  reschedule_count INTEGER NOT NULL DEFAULT 0,
  internal_notes TEXT,
  member_summary TEXT,
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at),
  UNIQUE (org_id, engagement_id, sequence_number),
  UNIQUE (org_id, slot_hold_id)
);

CREATE TABLE IF NOT EXISTS public.consulting_session_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.consulting_sessions(id) ON DELETE CASCADE,
  action TEXT NOT NULL
    CHECK (action IN ('CREATED', 'RESCHEDULED', 'COMPLETED', 'NO_SHOW', 'CANCELLED', 'NOTE_UPDATED')),
  actor_user_id UUID,
  reason TEXT,
  previous_starts_at TIMESTAMPTZ,
  previous_ends_at TIMESTAMPTZ,
  new_starts_at TIMESTAMPTZ,
  new_ends_at TIMESTAMPTZ,
  idempotency_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consulting_rules_lookup
  ON public.consulting_availability_rules (org_id, offering_id, consultant_id, weekday)
  WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_consulting_exceptions_lookup
  ON public.consulting_availability_exceptions (org_id, consultant_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_consulting_holds_token
  ON public.consulting_slot_holds (org_id, token_hash, status);
CREATE INDEX IF NOT EXISTS idx_consulting_holds_expiry
  ON public.consulting_slot_holds (status, held_until);
CREATE UNIQUE INDEX IF NOT EXISTS consulting_session_history_idempotency_unique
  ON public.consulting_session_history (org_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_consulting_engagement_member
  ON public.consulting_engagements (org_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consulting_engagement_consultant
  ON public.consulting_engagements (org_id, consultant_id, status);
CREATE INDEX IF NOT EXISTS idx_consulting_sessions_upcoming
  ON public.consulting_sessions (org_id, starts_at)
  WHERE status = 'SCHEDULED';
CREATE INDEX IF NOT EXISTS idx_learning_badge_member
  ON public.learning_badge_awards (org_id, user_id, awarded_at DESC);

ALTER TABLE public.learning_badge_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_badge_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consulting_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consulting_offering_consultants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consulting_availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consulting_availability_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consulting_slot_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consulting_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consulting_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consulting_session_history ENABLE ROW LEVEL SECURITY;
