-- =============================================================================
-- 1385_coreisec_learning_commerce_parity.sql
-- Fondasi terpadu untuk portal member, LMS, commerce, subscription, afiliasi,
-- notifikasi, dan migrasi Coreisec. Seluruh objek dibuat idempoten agar aman
-- dipakai pada rehearsal berulang sebelum cutover.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Pengguna portal bukan hanya staf ERP. Nilai lama tetap dipertahankan.
ALTER TABLE public.internal_auth_users
  DROP CONSTRAINT IF EXISTS internal_auth_users_user_type_check;

ALTER TABLE public.internal_auth_users
  ADD CONSTRAINT internal_auth_users_user_type_check
  CHECK (user_type IN (
    'owner', 'admin', 'staff', 'member', 'anggota', 'tutor', 'affiliate'
  ));

CREATE TABLE IF NOT EXISTS public.internal_auth_legacy_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_user_id UUID NOT NULL REFERENCES public.internal_auth_users(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL,
  source_user_id TEXT NOT NULL,
  username TEXT,
  password_hash TEXT NOT NULL,
  password_scheme TEXT NOT NULL DEFAULT 'WORDPRESS_PHPASS',
  source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  upgraded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_system, source_user_id),
  UNIQUE (internal_user_id, source_system)
);

CREATE INDEX IF NOT EXISTS idx_internal_auth_legacy_username
  ON public.internal_auth_legacy_credentials (source_system, lower(username))
  WHERE username IS NOT NULL AND upgraded_at IS NULL;

-- Domain organisasi menjadi registri bersama untuk portal, bukan milik toko saja.
CREATE TABLE IF NOT EXISTS public.organization_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  hostname TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'MEMBER_PORTAL'
    CHECK (purpose IN ('MEMBER_PORTAL', 'LMS', 'CHECKOUT', 'MARKETING', 'API')),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'VERIFIED', 'DISABLED')),
  verification_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_organization_domains_hostname
  ON public.organization_domains (lower(hostname));
CREATE INDEX IF NOT EXISTS idx_organization_domains_resolve
  ON public.organization_domains (lower(hostname), purpose, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_organization_domains_primary
  ON public.organization_domains (org_id, purpose)
  WHERE is_primary = TRUE AND status <> 'DISABLED';

-- ---------------------------------------------------------------------------
-- Satu model konten LMS
-- ---------------------------------------------------------------------------

ALTER TABLE public.learning_tracks
  ADD COLUMN IF NOT EXISTS external_source TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS seo_title TEXT,
  ADD COLUMN IF NOT EXISTS seo_description TEXT;

ALTER TABLE public.learning_courses
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS preview_video_url TEXT,
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS outcomes JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS access_duration_value INTEGER,
  ADD COLUMN IF NOT EXISTS access_duration_unit TEXT,
  ADD COLUMN IF NOT EXISTS closed_access_message TEXT,
  ADD COLUMN IF NOT EXISTS seo_title TEXT,
  ADD COLUMN IF NOT EXISTS seo_description TEXT,
  ADD COLUMN IF NOT EXISTS seo_keywords TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS external_source TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.learning_lessons
  ADD COLUMN IF NOT EXISTS section_id UUID,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS content_html TEXT,
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS is_preview BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS drip_value INTEGER,
  ADD COLUMN IF NOT EXISTS drip_unit TEXT,
  ADD COLUMN IF NOT EXISTS embed_provider TEXT,
  ADD COLUMN IF NOT EXISTS embed_url TEXT,
  ADD COLUMN IF NOT EXISTS external_source TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'learning_lessons_section_id_fkey'
  ) THEN
    -- FK ditambahkan setelah tabel section dibuat di bawah.
    NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_learning_tracks_external
  ON public.learning_tracks (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_learning_courses_external
  ON public.learning_courses (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_learning_lessons_external
  ON public.learning_lessons (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.learning_course_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.learning_courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PUBLISHED'
    CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  external_source TEXT,
  external_id TEXT,
  source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, course_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_learning_sections_external
  ON public.learning_course_sections (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_learning_sections_order
  ON public.learning_course_sections (org_id, course_id, sort_order);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'learning_lessons_section_id_fkey'
      AND conrelid = 'public.learning_lessons'::regclass
  ) THEN
    ALTER TABLE public.learning_lessons
      ADD CONSTRAINT learning_lessons_section_id_fkey
      FOREIGN KEY (section_id)
      REFERENCES public.learning_course_sections(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.learning_course_prerequisites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.learning_courses(id) ON DELETE CASCADE,
  prerequisite_course_id UUID NOT NULL REFERENCES public.learning_courses(id) ON DELETE CASCADE,
  requirement_type TEXT NOT NULL DEFAULT 'COMPLETED'
    CHECK (requirement_type IN ('ENROLLED', 'COMPLETED', 'PASSED')),
  minimum_score NUMERIC(8,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (course_id <> prerequisite_course_id),
  UNIQUE (org_id, course_id, prerequisite_course_id)
);

CREATE TABLE IF NOT EXISTS public.learning_instructor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  display_name TEXT NOT NULL,
  headline TEXT,
  biography TEXT,
  avatar_url TEXT,
  expertise TEXT[] NOT NULL DEFAULT '{}'::text[],
  social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  external_source TEXT,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_learning_instructors_external
  ON public.learning_instructor_profiles (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.learning_course_instructors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.learning_courses(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES public.learning_instructor_profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'TUTOR'
    CHECK (role IN ('LEAD', 'TUTOR', 'REVIEWER', 'ASSISTANT')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, course_id, instructor_id)
);

CREATE TABLE IF NOT EXISTS public.learning_lesson_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.learning_lessons(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL
    CHECK (asset_type IN ('VIDEO', 'DOCUMENT', 'IMAGE', 'AUDIO', 'LINK', 'EMBED', 'OTHER')),
  title TEXT NOT NULL,
  storage_key TEXT,
  source_url TEXT,
  mime_type TEXT,
  file_size_bytes BIGINT,
  checksum_sha256 TEXT,
  is_downloadable BOOLEAN NOT NULL DEFAULT TRUE,
  availability_status TEXT NOT NULL DEFAULT 'AVAILABLE'
    CHECK (availability_status IN ('AVAILABLE', 'MISSING_SOURCE', 'FAILED', 'ARCHIVED')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  external_source TEXT,
  external_id TEXT,
  source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    storage_key IS NOT NULL
    OR source_url IS NOT NULL
    OR availability_status = 'MISSING_SOURCE'
  )
);

ALTER TABLE public.learning_lesson_assets
  ADD COLUMN IF NOT EXISTS availability_status TEXT NOT NULL DEFAULT 'AVAILABLE';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.learning_lesson_assets'::regclass
      AND conname = 'learning_lesson_assets_availability_status_check'
  ) THEN
    ALTER TABLE public.learning_lesson_assets
      ADD CONSTRAINT learning_lesson_assets_availability_status_check
      CHECK (availability_status IN ('AVAILABLE', 'MISSING_SOURCE', 'FAILED', 'ARCHIVED'));
  END IF;
END $$;
ALTER TABLE public.learning_lesson_assets
  DROP CONSTRAINT IF EXISTS learning_lesson_assets_check;
ALTER TABLE public.learning_lesson_assets
  ADD CONSTRAINT learning_lesson_assets_check
  CHECK (
    storage_key IS NOT NULL
    OR source_url IS NOT NULL
    OR availability_status = 'MISSING_SOURCE'
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_learning_lesson_assets_external
  ON public.learning_lesson_assets (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_learning_lesson_assets_lesson
  ON public.learning_lesson_assets (org_id, lesson_id, sort_order);

-- Sumber kebenaran hak akses. Enrollment hanya mencatat perjalanan belajar.
CREATE TABLE IF NOT EXISTS public.learning_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  course_id UUID NOT NULL REFERENCES public.learning_courses(id) ON DELETE CASCADE,
  batch_id UUID,
  source_type TEXT NOT NULL
    CHECK (source_type IN (
      'ORDER', 'SUBSCRIPTION', 'MEMBERSHIP', 'ADMIN', 'MIGRATION',
      'COUPON', 'AFFILIATE', 'TRIAL'
    )),
  source_id UUID,
  source_reference TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('PENDING', 'ACTIVE', 'FROZEN', 'EXPIRED', 'REVOKED')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT NOT NULL,
  external_source TEXT,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (expires_at IS NULL OR expires_at > starts_at),
  UNIQUE (org_id, idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_learning_access_grants_external
  ON public.learning_access_grants (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_learning_access_grants_check
  ON public.learning_access_grants (org_id, user_id, course_id, status, starts_at, expires_at);

ALTER TABLE public.learning_enrollments
  ADD COLUMN IF NOT EXISTS batch_id UUID,
  ADD COLUMN IF NOT EXISTS access_grant_id UUID REFERENCES public.learning_access_grants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_lesson_id UUID REFERENCES public.learning_lessons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS progress_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attempt_number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS external_source TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS uq_learning_enrollments_external
  ON public.learning_enrollments (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

ALTER TABLE public.learning_lesson_progress
  ADD COLUMN IF NOT EXISTS progress_seconds INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_position_seconds INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS external_source TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS uq_learning_progress_external
  ON public.learning_lesson_progress (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

-- Batch, sesi, daftar tunggu, dan kehadiran.
ALTER TABLE public.lms_course_batches
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'ONLINE',
  ADD COLUMN IF NOT EXISTS delivery_mode TEXT NOT NULL DEFAULT 'ONLINE',
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  ADD COLUMN IF NOT EXISTS enrollment_opens_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enrollment_closes_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS waitlist_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS location_name TEXT,
  ADD COLUMN IF NOT EXISTS location_address TEXT,
  ADD COLUMN IF NOT EXISTS store_product_id UUID REFERENCES public.store_products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_source TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

UPDATE public.lms_course_batches
SET delivery_mode = COALESCE(NULLIF(mode, ''), delivery_mode, 'ONLINE')
WHERE delivery_mode IS DISTINCT FROM COALESCE(NULLIF(mode, ''), delivery_mode, 'ONLINE');

CREATE UNIQUE INDEX IF NOT EXISTS uq_lms_batches_external
  ON public.lms_course_batches (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

ALTER TABLE public.lms_batch_sessions
  ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES public.learning_instructor_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location_name TEXT,
  ADD COLUMN IF NOT EXISTS meeting_provider TEXT,
  ADD COLUMN IF NOT EXISTS reminder_offsets_minutes INTEGER[] NOT NULL DEFAULT '{1440,60}'::integer[],
  ADD COLUMN IF NOT EXISTS attendance_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS attendance_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS external_source TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS uq_lms_sessions_external
  ON public.lms_batch_sessions (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

ALTER TABLE public.lms_registrations
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS waitlist_entry_id UUID,
  ADD COLUMN IF NOT EXISTS external_source TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS uq_lms_registrations_idempotency
  ON public.lms_registrations (org_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_lms_registrations_external
  ON public.lms_registrations (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.lms_waitlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.lms_course_batches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  position INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'WAITING'
    CHECK (status IN ('WAITING', 'INVITED', 'CONVERTED', 'EXPIRED', 'CANCELLED')),
  invited_at TIMESTAMPTZ,
  invite_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, batch_id, user_id),
  UNIQUE (batch_id, position)
);

CREATE TABLE IF NOT EXISTS public.lms_session_attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.lms_batch_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  registration_id UUID REFERENCES public.lms_registrations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PRESENT'
    CHECK (status IN ('PRESENT', 'LATE', 'EXCUSED', 'ABSENT')),
  check_in_at TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ,
  verification_method TEXT NOT NULL DEFAULT 'QR'
    CHECK (verification_method IN ('QR', 'MANUAL', 'IMPORT')),
  verified_by UUID,
  notes TEXT,
  external_source TEXT,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, session_id, user_id)
);

-- Kompatibilitas bila migration attendance lama sudah pernah diterapkan.
ALTER TABLE public.lms_session_attendances
  ALTER COLUMN registration_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'PRESENT',
  ADD COLUMN IF NOT EXISTS check_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS check_out_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_method TEXT NOT NULL DEFAULT 'QR',
  ADD COLUMN IF NOT EXISTS verified_by UUID,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS external_source TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lms_session_attendances'
      AND column_name = 'scanned_at'
  ) THEN
    EXECUTE $sql$
      UPDATE public.lms_session_attendances a
      SET
        user_id = r.user_id,
        check_in_at = COALESCE(a.check_in_at, a.scanned_at)
      FROM public.lms_registrations r
      WHERE a.registration_id = r.id
        AND a.user_id IS NULL
    $sql$;
  ELSE
    UPDATE public.lms_session_attendances a
    SET user_id = r.user_id
    FROM public.lms_registrations r
    WHERE a.registration_id = r.id
      AND a.user_id IS NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_lms_attendance_user
  ON public.lms_session_attendances (org_id, session_id, user_id)
  WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_lms_attendance_external
  ON public.lms_session_attendances (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Kuis, tugas, gradebook, dan forum
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.learning_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.learning_courses(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.learning_lessons(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  time_limit_minutes INTEGER,
  max_attempts INTEGER,
  passing_score NUMERIC(5,2) NOT NULL DEFAULT 70,
  randomize_questions BOOLEAN NOT NULL DEFAULT FALSE,
  randomize_options BOOLEAN NOT NULL DEFAULT FALSE,
  show_explanations BOOLEAN NOT NULL DEFAULT TRUE,
  available_from TIMESTAMPTZ,
  available_until TIMESTAMPTZ,
  external_source TEXT,
  external_id TEXT,
  source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_learning_quizzes_external
  ON public.learning_quizzes (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.learning_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  quiz_id UUID REFERENCES public.learning_quizzes(id) ON DELETE CASCADE,
  question_bank_key TEXT,
  question_type TEXT NOT NULL
    CHECK (question_type IN (
      'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE',
      'SHORT_TEXT', 'ORDERING', 'ESSAY'
    )),
  prompt_html TEXT NOT NULL,
  explanation_html TEXT,
  points NUMERIC(8,2) NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  external_source TEXT,
  external_id TEXT,
  source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_learning_questions_external
  ON public.learning_questions (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.learning_question_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.learning_questions(id) ON DELETE CASCADE,
  option_html TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  match_key TEXT,
  external_source TEXT,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_learning_question_options_external
  ON public.learning_question_options (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.learning_quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.learning_quizzes(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES public.learning_enrollments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  attempt_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS'
    CHECK (status IN ('IN_PROGRESS', 'SUBMITTED', 'GRADED', 'EXPIRED')),
  question_order UUID[] NOT NULL DEFAULT '{}'::uuid[],
  score NUMERIC(8,2),
  passed BOOLEAN,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  graded_at TIMESTAMPTZ,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, idempotency_key),
  UNIQUE (quiz_id, enrollment_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS public.learning_quiz_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  attempt_id UUID NOT NULL REFERENCES public.learning_quiz_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.learning_questions(id) ON DELETE CASCADE,
  selected_option_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  answer_text TEXT,
  answer_order JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_correct BOOLEAN,
  awarded_points NUMERIC(8,2),
  grader_feedback TEXT,
  graded_by UUID,
  graded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (attempt_id, question_id)
);

CREATE TABLE IF NOT EXISTS public.learning_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.learning_courses(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.learning_lessons(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  instructions_html TEXT,
  due_at TIMESTAMPTZ,
  max_score NUMERIC(8,2) NOT NULL DEFAULT 100,
  passing_score NUMERIC(8,2),
  max_attempts INTEGER NOT NULL DEFAULT 1,
  allowed_mime_types TEXT[] NOT NULL DEFAULT '{}'::text[],
  rubric JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  external_source TEXT,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_learning_assignments_external
  ON public.learning_assignments (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.learning_assignment_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES public.learning_assignments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  storage_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  checksum_sha256 TEXT NOT NULL,
  consumed_submission_id UUID,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, storage_key)
);

CREATE TABLE IF NOT EXISTS public.learning_assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES public.learning_assignments(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES public.learning_enrollments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  submission_text TEXT,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'GRADED', 'RETURNED')),
  score NUMERIC(8,2),
  rubric_scores JSONB NOT NULL DEFAULT '[]'::jsonb,
  tutor_feedback TEXT,
  submitted_at TIMESTAMPTZ,
  graded_at TIMESTAMPTZ,
  graded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assignment_id, enrollment_id, attempt_number)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'learning_assignment_uploads_submission_fkey'
  ) THEN
    ALTER TABLE public.learning_assignment_uploads
      ADD CONSTRAINT learning_assignment_uploads_submission_fkey
      FOREIGN KEY (consumed_submission_id)
      REFERENCES public.learning_assignment_submissions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_learning_assignment_uploads_pending
  ON public.learning_assignment_uploads (org_id, assignment_id, user_id, expires_at)
  WHERE consumed_submission_id IS NULL;

CREATE TABLE IF NOT EXISTS public.learning_gradebook_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.learning_courses(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES public.learning_enrollments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('QUIZ', 'ASSIGNMENT', 'PRACTICAL', 'MANUAL')),
  source_id UUID NOT NULL,
  score NUMERIC(8,2) NOT NULL,
  max_score NUMERIC(8,2) NOT NULL,
  weight_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  feedback TEXT,
  graded_by UUID,
  graded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, enrollment_id, source_type, source_id)
);

CREATE TABLE IF NOT EXISTS public.learning_discussion_spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.learning_courses(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.lms_course_batches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'INTERNAL',
  external_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.learning_discussion_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  space_id UUID NOT NULL REFERENCES public.learning_discussion_spaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  body_html TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'CLOSED', 'HIDDEN')),
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.learning_discussion_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES public.learning_discussion_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  body_html TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'VISIBLE'
    CHECK (status IN ('VISIBLE', 'HIDDEN', 'DELETED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sertifikat dapat didesain, diverifikasi publik, dicabut, dan diterbitkan ulang.
CREATE TABLE IF NOT EXISTS public.lms_certificate_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  page_size TEXT NOT NULL DEFAULT 'A4_LANDSCAPE',
  design JSONB NOT NULL DEFAULT '{}'::jsonb,
  numbering_pattern TEXT NOT NULL DEFAULT 'CERT/{YYYY}/{SEQ}',
  validity_days INTEGER,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  external_source TEXT,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_lms_certificate_templates_external
  ON public.lms_certificate_templates (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_lms_certificate_templates_default
  ON public.lms_certificate_templates (org_id)
  WHERE is_default = TRUE AND is_active = TRUE;

CREATE TABLE IF NOT EXISTS public.lms_certificate_number_counters (
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  issue_year INTEGER NOT NULL,
  last_number BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, issue_year)
);

ALTER TABLE public.lms_certificates
  ALTER COLUMN registration_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS enrollment_id UUID REFERENCES public.learning_enrollments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.learning_courses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.lms_certificate_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verification_token TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_reason TEXT,
  ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS storage_key TEXT,
  ADD COLUMN IF NOT EXISTS external_source TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lms_certificates_status_check'
  ) THEN
    ALTER TABLE public.lms_certificates
      ADD CONSTRAINT lms_certificates_status_check
      CHECK (status IN ('ACTIVE', 'EXPIRED', 'REVOKED'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_lms_certificates_verification
  ON public.lms_certificates (verification_token)
  WHERE verification_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_lms_certificates_external
  ON public.lms_certificates (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.lms_certificate_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  certificate_id UUID NOT NULL REFERENCES public.lms_certificates(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('ISSUED', 'DOWNLOADED', 'VERIFIED', 'REVOKED', 'REISSUED')),
  actor_user_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Commerce, membership, pembayaran, dan afiliasi
-- ---------------------------------------------------------------------------

ALTER TABLE public.store_products
  ADD COLUMN IF NOT EXISTS product_type TEXT NOT NULL DEFAULT 'PHYSICAL',
  ADD COLUMN IF NOT EXISTS sale_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sale_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS purchase_limit_per_user INTEGER,
  ADD COLUMN IF NOT EXISTS quantity_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS dimesale_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS follow_up_content JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS analytics_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS external_source TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS external_source TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS uq_products_external
  ON public.products (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS external_source TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS uq_product_variants_external
  ON public.product_variants (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_store_products_external
  ON public.store_products (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

ALTER TABLE public.ecommerce_orders
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS attribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS coupon_id UUID,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(20,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gateway_fee_amount NUMERIC(20,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS external_source TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_historical_archive BOOLEAN NOT NULL DEFAULT FALSE;

-- Nomor order lama memakai COUNT(*) sehingga dapat bentrok saat checkout
-- bersamaan. Counter per organisasi/tahun membuat nomor unik secara atomik.
CREATE TABLE IF NOT EXISTS public.commerce_order_number_counters (
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_year INTEGER NOT NULL,
  last_number BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, order_year)
);

CREATE OR REPLACE FUNCTION public.set_ecommerce_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM COALESCE(NEW.created_at, NOW()))::integer;
  v_number BIGINT;
BEGIN
  IF NEW.order_number IS NULL OR BTRIM(NEW.order_number) = '' THEN
    INSERT INTO public.commerce_order_number_counters (
      org_id, order_year, last_number, updated_at
    )
    VALUES (NEW.org_id, v_year, 1, NOW())
    ON CONFLICT (org_id, order_year) DO UPDATE
    SET last_number = public.commerce_order_number_counters.last_number + 1,
        updated_at = NOW()
    RETURNING last_number INTO v_number;

    NEW.order_number := 'ECO-' || v_year::text || '-' || LPAD(v_number::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ecommerce_orders_idempotency
  ON public.ecommerce_orders (org_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ecommerce_orders_external
  ON public.ecommerce_orders (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ecommerce_orders_member
  ON public.ecommerce_orders (org_id, user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ecommerce_inventory_reservation_order_item
  ON public.ecommerce_inventory_reservations (org_id, order_item_id);

ALTER TABLE public.ecommerce_order_payments
  ADD COLUMN IF NOT EXISTS payment_intent_id UUID,
  ADD COLUMN IF NOT EXISTS provider_code TEXT,
  ADD COLUMN IF NOT EXISTS provider_reference TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS external_source TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS response_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ecommerce_order_payments_idempotency
  ON public.ecommerce_order_payments (org_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ecommerce_order_payments_external
  ON public.ecommerce_order_payments (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

ALTER TABLE public.sales_items
  ADD COLUMN IF NOT EXISTS ecommerce_order_item_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_items_ecommerce_order_item
  ON public.sales_items (org_id, ecommerce_order_item_id)
  WHERE ecommerce_order_item_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_ecommerce_order
  ON public.sales (org_id, reference_type, reference_id)
  WHERE reference_type = 'ECOMMERCE_ORDER' AND reference_id IS NOT NULL;

ALTER TABLE public.sales_payments
  ADD COLUMN IF NOT EXISTS ecommerce_order_id UUID,
  ADD COLUMN IF NOT EXISTS payment_intent_id UUID,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_payments_commerce_idempotency
  ON public.sales_payments (org_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS reference_type TEXT,
  ADD COLUMN IF NOT EXISTS reference_id UUID,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_transactions_idempotency
  ON public.bank_transactions (org_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_journal_entries_commerce_payment
  ON public.journal_entries (org_id, reference_type, reference_id)
  WHERE reference_type IN (
    'COMMERCE_PAYMENT',
    'COMMERCE_REFUND',
    'AFFILIATE_COMMISSION',
    'COMMERCE_FULFILLMENT'
  ) AND reference_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.commerce_product_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_product_id UUID NOT NULL REFERENCES public.store_products(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.learning_courses(id) ON DELETE CASCADE,
  access_duration_value INTEGER,
  access_duration_unit TEXT,
  external_source TEXT,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, store_product_id, course_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_product_courses_external
  ON public.commerce_product_courses (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.commerce_order_bumps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  trigger_product_id UUID NOT NULL REFERENCES public.store_products(id) ON DELETE CASCADE,
  offered_product_id UUID NOT NULL REFERENCES public.store_products(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price_override NUMERIC(20,2),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  external_source TEXT,
  external_id TEXT,
  source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (trigger_product_id <> offered_product_id),
  UNIQUE (org_id, trigger_product_id, offered_product_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_order_bumps_external
  ON public.commerce_order_bumps (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.commerce_access_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  external_source TEXT,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, slug)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_access_packages_external
  ON public.commerce_access_packages (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.commerce_access_package_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.commerce_access_packages(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.learning_courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (package_id, course_id)
);

CREATE TABLE IF NOT EXISTS public.commerce_product_access_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_product_id UUID NOT NULL REFERENCES public.store_products(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.commerce_access_packages(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_product_id, package_id)
);

CREATE TABLE IF NOT EXISTS public.commerce_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  package_id UUID NOT NULL REFERENCES public.commerce_access_packages(id) ON DELETE RESTRICT,
  source_type TEXT NOT NULL DEFAULT 'ORDER',
  source_id UUID,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('PENDING', 'ACTIVE', 'FROZEN', 'EXPIRED', 'CANCELLED')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  frozen_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  idempotency_key TEXT NOT NULL,
  external_source TEXT,
  external_id TEXT,
  source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_memberships_external
  ON public.commerce_memberships (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.commerce_subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_product_id UUID NOT NULL REFERENCES public.store_products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  billing_interval TEXT NOT NULL
    CHECK (billing_interval IN ('DAY', 'WEEK', 'MONTH', 'YEAR')),
  billing_interval_count INTEGER NOT NULL DEFAULT 1 CHECK (billing_interval_count > 0),
  price NUMERIC(20,2) NOT NULL CHECK (price >= 0),
  trial_days INTEGER NOT NULL DEFAULT 0 CHECK (trial_days >= 0),
  signup_fee NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (signup_fee >= 0),
  grace_period_days INTEGER NOT NULL DEFAULT 0 CHECK (grace_period_days >= 0),
  max_cycles INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  external_source TEXT,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_subscription_plans_external
  ON public.commerce_subscription_plans (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.commerce_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  plan_id UUID NOT NULL REFERENCES public.commerce_subscription_plans(id) ON DELETE RESTRICT,
  initial_order_id UUID REFERENCES public.ecommerce_orders(id) ON DELETE SET NULL,
  latest_order_id UUID REFERENCES public.ecommerce_orders(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'TRIAL', 'ACTIVE', 'PAST_DUE', 'GRACE', 'PAUSED', 'CANCELLED', 'EXPIRED')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  grace_ends_at TIMESTAMPTZ,
  next_renewal_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  provider_reference TEXT,
  cycles_completed INTEGER NOT NULL DEFAULT 0,
  last_payment_at TIMESTAMPTZ,
  idempotency_key TEXT NOT NULL,
  external_source TEXT,
  external_id TEXT,
  source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_subscriptions_external
  ON public.commerce_subscriptions (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commerce_subscriptions_renewal
  ON public.commerce_subscriptions (status, next_renewal_at);

CREATE TABLE IF NOT EXISTS public.commerce_subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.commerce_subscriptions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  order_id UUID REFERENCES public.ecommerce_orders(id) ON DELETE SET NULL,
  idempotency_key TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.commerce_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('FIXED', 'PERCENT')),
  discount_value NUMERIC(20,2) NOT NULL CHECK (discount_value >= 0),
  minimum_amount NUMERIC(20,2) NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  usage_limit INTEGER,
  per_user_limit INTEGER NOT NULL DEFAULT 1,
  allowed_store_product_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  affiliate_profile_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  external_source TEXT,
  external_id TEXT,
  source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_coupons_code
  ON public.commerce_coupons (org_id, upper(code));
CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_coupons_external
  ON public.commerce_coupons (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.commerce_coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  coupon_id UUID NOT NULL REFERENCES public.commerce_coupons(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES public.ecommerce_orders(id) ON DELETE CASCADE,
  user_id UUID,
  email_normalized TEXT,
  discount_amount NUMERIC(20,2) NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, idempotency_key),
  UNIQUE (coupon_id, order_id)
);

CREATE TABLE IF NOT EXISTS public.commerce_affiliate_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED')),
  payout_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  default_commission_type TEXT NOT NULL DEFAULT 'PERCENT'
    CHECK (default_commission_type IN ('FIXED', 'PERCENT')),
  default_commission_value NUMERIC(20,2) NOT NULL DEFAULT 0,
  cookie_days INTEGER NOT NULL DEFAULT 30,
  external_source TEXT,
  external_id TEXT,
  source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_affiliate_referral
  ON public.commerce_affiliate_profiles (org_id, lower(referral_code));
CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_affiliate_external
  ON public.commerce_affiliate_profiles (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.commerce_affiliate_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  affiliate_profile_id UUID REFERENCES public.commerce_affiliate_profiles(id) ON DELETE CASCADE,
  store_product_id UUID REFERENCES public.store_products(id) ON DELETE CASCADE,
  commission_type TEXT NOT NULL CHECK (commission_type IN ('FIXED', 'PERCENT')),
  initial_value NUMERIC(20,2) NOT NULL DEFAULT 0,
  renewal_value NUMERIC(20,2),
  tier INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  external_source TEXT,
  external_id TEXT,
  source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_affiliate_rules_external
  ON public.commerce_affiliate_rules (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.commerce_affiliate_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  affiliate_profile_id UUID NOT NULL REFERENCES public.commerce_affiliate_profiles(id) ON DELETE CASCADE,
  visitor_token_hash TEXT NOT NULL,
  landing_url TEXT,
  referrer_url TEXT,
  utm JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  converted_order_id UUID REFERENCES public.ecommerce_orders(id) ON DELETE SET NULL,
  UNIQUE (org_id, visitor_token_hash)
);

CREATE TABLE IF NOT EXISTS public.commerce_affiliate_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  affiliate_profile_id UUID NOT NULL REFERENCES public.commerce_affiliate_profiles(id) ON DELETE RESTRICT,
  order_id UUID REFERENCES public.ecommerce_orders(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES public.commerce_subscriptions(id) ON DELETE SET NULL,
  commission_type TEXT NOT NULL DEFAULT 'INITIAL'
    CHECK (commission_type IN ('INITIAL', 'RENEWAL', 'MANUAL', 'OPENING_BALANCE')),
  base_amount NUMERIC(20,2) NOT NULL,
  commission_amount NUMERIC(20,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'PAYABLE', 'PAID', 'CANCELLED')),
  payable_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  payout_id UUID,
  idempotency_key TEXT NOT NULL,
  external_source TEXT,
  external_id TEXT,
  source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_commissions_external
  ON public.commerce_affiliate_commissions (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.commerce_affiliate_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  affiliate_profile_id UUID NOT NULL REFERENCES public.commerce_affiliate_profiles(id) ON DELETE RESTRICT,
  payout_number TEXT NOT NULL,
  amount NUMERIC(20,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'APPROVED', 'PAID', 'CANCELLED')),
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  bank_transaction_id UUID REFERENCES public.bank_transactions(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, payout_number),
  UNIQUE (org_id, idempotency_key)
);

ALTER TABLE public.commerce_affiliate_commissions
  DROP CONSTRAINT IF EXISTS commerce_affiliate_commissions_payout_id_fkey;
ALTER TABLE public.commerce_affiliate_commissions
  ADD CONSTRAINT commerce_affiliate_commissions_payout_id_fkey
  FOREIGN KEY (payout_id) REFERENCES public.commerce_affiliate_payouts(id) ON DELETE SET NULL;

-- Provider tidak memiliki model order; provider hanya mencatat komunikasi pembayaran.
CREATE TABLE IF NOT EXISTS public.commerce_payment_provider_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider_code TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_sandbox BOOLEAN NOT NULL DEFAULT TRUE,
  credentials_encrypted TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, provider_code)
);

CREATE TABLE IF NOT EXISTS public.commerce_payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.ecommerce_orders(id) ON DELETE CASCADE,
  provider_code TEXT NOT NULL,
  provider_reference TEXT,
  amount NUMERIC(20,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'IDR',
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'AWAITING_REVIEW', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED')),
  checkout_url TEXT,
  expires_at TIMESTAMPTZ,
  idempotency_key TEXT NOT NULL,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_payment_provider_reference
  ON public.commerce_payment_intents (org_id, provider_code, provider_reference)
  WHERE provider_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.commerce_payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider_code TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  signature_valid BOOLEAN NOT NULL DEFAULT FALSE,
  payload_sha256 TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'RECEIVED'
    CHECK (status IN ('RECEIVED', 'PROCESSING', 'PROCESSED', 'IGNORED', 'FAILED')),
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  UNIQUE (provider_code, provider_event_id)
);

CREATE TABLE IF NOT EXISTS public.commerce_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.ecommerce_orders(id) ON DELETE RESTRICT,
  payment_intent_id UUID REFERENCES public.commerce_payment_intents(id) ON DELETE SET NULL,
  amount NUMERIC(20,2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED')),
  provider_reference TEXT,
  reversal_journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  reversal_bank_transaction_id UUID REFERENCES public.bank_transactions(id) ON DELETE SET NULL,
  idempotency_key TEXT NOT NULL,
  requested_by UUID,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.commerce_branch_account_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  cash_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  revenue_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  tax_payable_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  discount_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  gateway_fee_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  affiliate_commission_expense_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  affiliate_commission_payable_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  refund_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, branch_id)
);

CREATE TABLE IF NOT EXISTS public.commerce_transaction_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED')),
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, idempotency_key)
);

-- ---------------------------------------------------------------------------
-- Notifikasi multi-kanal dan CMS bayangan
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('EMAIL', 'WHATSAPP', 'SMS', 'IN_APP')),
  subject_template TEXT,
  body_template TEXT NOT NULL,
  provider_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, template_key, channel)
);

CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID,
  template_id UUID REFERENCES public.notification_templates(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('EMAIL', 'WHATSAPP', 'SMS', 'IN_APP')),
  provider_code TEXT,
  recipient TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'DELIVERED', 'FAILED', 'DEAD')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  last_error TEXT,
  idempotency_key TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_dispatch
  ON public.notification_outbox (status, available_at)
  WHERE status IN ('PENDING', 'FAILED');

CREATE TABLE IF NOT EXISTS public.notification_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  outbox_id UUID NOT NULL REFERENCES public.notification_outbox(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  provider_code TEXT NOT NULL,
  provider_message_id TEXT,
  status TEXT NOT NULL,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (outbox_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS public.cms_content_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('PAGE', 'ARTICLE', 'REDIRECT')),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  content_html TEXT,
  featured_image_storage_key TEXT,
  seo_title TEXT,
  seo_description TEXT,
  seo_canonical_url TEXT,
  analytics_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  published_at TIMESTAMPTZ,
  external_source TEXT,
  external_id TEXT,
  source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, content_type, slug)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cms_content_external
  ON public.cms_content_entries (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.cms_redirects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_path TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 301 CHECK (status_code IN (301, 302, 307, 308)),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  external_source TEXT,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, source_path)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cms_redirects_external
  ON public.cms_redirects (org_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Mesin migrasi: run, mapping, konflik, checksum, payload, dan arsip order.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.migration_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL,
  source_snapshot_id TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'DRY_RUN' CHECK (mode IN ('DRY_RUN', 'APPLY', 'DELTA')),
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED')),
  baseline_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_checkpoint JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, source_system, source_snapshot_id, mode)
);

CREATE TABLE IF NOT EXISTS public.migration_entity_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  run_id UUID REFERENCES public.migration_runs(id) ON DELETE SET NULL,
  source_system TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  external_id TEXT NOT NULL,
  target_table TEXT NOT NULL,
  target_id UUID NOT NULL,
  source_checksum TEXT,
  source_updated_at TIMESTAMPTZ,
  migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (org_id, source_system, entity_type, external_id)
);

CREATE INDEX IF NOT EXISTS idx_migration_entity_map_target
  ON public.migration_entity_map (org_id, target_table, target_id);

CREATE TABLE IF NOT EXISTS public.migration_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES public.migration_runs(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  external_id TEXT NOT NULL,
  conflict_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'ERROR'
    CHECK (severity IN ('INFO', 'WARNING', 'ERROR', 'BLOCKER')),
  source_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  target_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolution TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (run_id, entity_type, external_id, conflict_type)
);

CREATE TABLE IF NOT EXISTS public.migration_checksums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES public.migration_runs(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('SOURCE', 'TARGET')),
  record_count BIGINT NOT NULL,
  aggregate_checksum TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (run_id, entity_type, side)
);

CREATE TABLE IF NOT EXISTS public.migration_source_payloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES public.migration_runs(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  external_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  payload_sha256 TEXT NOT NULL,
  source_updated_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (run_id, entity_type, external_id)
);

CREATE TABLE IF NOT EXISTS public.migration_bridge_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL DEFAULT 'WORDPRESS_COREISEC',
  source_event_id BIGINT NOT NULL,
  entity_type TEXT NOT NULL,
  external_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('UPSERT', 'DELETE')),
  payload JSONB NOT NULL,
  payload_sha256 TEXT NOT NULL,
  event_signature TEXT NOT NULL,
  source_updated_at TIMESTAMPTZ,
  occurred_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PROCESSING', 'PROCESSED', 'CONFLICT', 'IGNORED')),
  migration_run_id UUID REFERENCES public.migration_runs(id) ON DELETE SET NULL,
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  UNIQUE (org_id, source_system, source_event_id)
);

CREATE INDEX IF NOT EXISTS idx_migration_bridge_events_process
  ON public.migration_bridge_events (org_id, status, source_event_id)
  WHERE status IN ('PENDING', 'CONFLICT');

-- Inventaris media sumber sebelum/sesudah file disalin ke object storage.
CREATE TABLE IF NOT EXISTS public.migration_media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  external_source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  file_size_bytes BIGINT,
  expected_checksum_sha256 TEXT,
  actual_checksum_sha256 TEXT,
  storage_key TEXT,
  copy_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (copy_status IN ('PENDING', 'COPYING', 'COPIED', 'CONFLICT', 'SKIPPED')),
  parent_external_id TEXT,
  alt_text TEXT,
  source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error TEXT,
  copied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, external_source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_migration_media_assets_copy
  ON public.migration_media_assets (org_id, copy_status, external_id);

CREATE TABLE IF NOT EXISTS public.commerce_historical_order_archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID,
  external_source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  order_number TEXT,
  customer_email_normalized TEXT,
  status TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'IDR',
  total_amount NUMERIC(20,2) NOT NULL DEFAULT 0,
  ordered_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  payload JSONB NOT NULL,
  payload_sha256 TEXT NOT NULL,
  reconciliation_status TEXT NOT NULL DEFAULT 'RECONCILED'
    CHECK (reconciliation_status IN ('RECONCILED', 'NEEDS_REVIEW', 'IGNORED')),
  grants_access BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, external_source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_historical_orders_member
  ON public.commerce_historical_order_archives (org_id, user_id, ordered_at DESC);
CREATE INDEX IF NOT EXISTS idx_historical_orders_email
  ON public.commerce_historical_order_archives (org_id, customer_email_normalized);

-- Riwayat perubahan hak akses membantu audit refund, freeze, dan migrasi.
CREATE TABLE IF NOT EXISTS public.learning_access_grant_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  grant_id UUID NOT NULL REFERENCES public.learning_access_grants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  previous_status TEXT,
  next_status TEXT,
  reason TEXT,
  actor_user_id UUID,
  idempotency_key TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, idempotency_key)
);

-- Resolver read-only untuk host portal. Tidak mengandalkan auth Supabase.
CREATE OR REPLACE FUNCTION public.resolve_organization_member_domain(p_hostname TEXT)
RETURNS TABLE (
  org_id UUID,
  org_slug TEXT,
  org_name TEXT,
  purpose TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.slug,
    o.name,
    d.purpose
  FROM public.organization_domains d
  JOIN public.organizations o ON o.id = d.org_id
  WHERE lower(d.hostname) = lower(trim(trailing '.' FROM p_hostname))
    AND d.status = 'VERIFIED'
    AND o.is_active = TRUE
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_organization_member_domain(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_organization_member_domain(TEXT) TO anon, authenticated, service_role;

-- Indeks tenant untuk tabel-tabel baru yang sering dibaca portal/admin.
CREATE INDEX IF NOT EXISTS idx_learning_quizzes_course
  ON public.learning_quizzes (org_id, course_id, status);
CREATE INDEX IF NOT EXISTS idx_learning_assignments_course
  ON public.learning_assignments (org_id, course_id, status);
CREATE INDEX IF NOT EXISTS idx_learning_gradebook_enrollment
  ON public.learning_gradebook_entries (org_id, enrollment_id);
CREATE INDEX IF NOT EXISTS idx_commerce_memberships_user
  ON public.commerce_memberships (org_id, user_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_commerce_commissions_payable
  ON public.commerce_affiliate_commissions (org_id, status, payable_at);
CREATE INDEX IF NOT EXISTS idx_migration_conflicts_open
  ON public.migration_conflicts (org_id, run_id, severity)
  WHERE resolved_at IS NULL;

-- Menjaga seluruh enrollment yang sudah ada agar tidak kehilangan akses ketika
-- source of truth berpindah ke learning_access_grants.
INSERT INTO public.learning_access_grants (
  org_id,
  user_id,
  course_id,
  batch_id,
  source_type,
  source_id,
  source_reference,
  status,
  starts_at,
  expires_at,
  idempotency_key,
  metadata
)
SELECT
  enrollment.org_id,
  enrollment.user_id,
  enrollment.course_id,
  enrollment.batch_id,
  'MIGRATION',
  enrollment.id,
  'pre-1384-enrollment',
  CASE
    WHEN enrollment.status IN ('IN_PROGRESS', 'COMPLETED') THEN 'ACTIVE'
    ELSE 'REVOKED'
  END,
  COALESCE(enrollment.started_at, enrollment.created_at, NOW()),
  NULL,
  'pre-1384-enrollment:' || enrollment.id::text,
  jsonb_build_object('preserved_status', enrollment.status)
FROM public.learning_enrollments enrollment
ON CONFLICT (org_id, idempotency_key) DO NOTHING;

UPDATE public.learning_enrollments enrollment
SET access_grant_id = access_grant.id
FROM public.learning_access_grants access_grant
WHERE access_grant.org_id = enrollment.org_id
  AND access_grant.idempotency_key = 'pre-1384-enrollment:' || enrollment.id::text
  AND enrollment.access_grant_id IS NULL;

NOTIFY pgrst, 'reload schema';
