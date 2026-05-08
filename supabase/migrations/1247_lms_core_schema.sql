-- ==============================================================================
-- Migration: 1247_lms_core_schema.sql
-- Description: Creates the core tables for the simple Learning Management System
-- ==============================================================================

CREATE TABLE public.learning_tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, slug)
);

CREATE TABLE public.learning_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    track_id UUID REFERENCES public.learning_tracks(id) ON DELETE SET NULL,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    level_code TEXT,
    passing_score NUMERIC DEFAULT 100,
    practical_event_slug TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, slug)
);

CREATE TABLE public.learning_lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.learning_courses(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    content_md TEXT,
    media_items JSONB DEFAULT '[]'::jsonb,
    lesson_type TEXT DEFAULT 'TEXT',
    sort_order INTEGER DEFAULT 0,
    is_required BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, course_id, slug)
);

CREATE TABLE public.learning_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.learning_courses(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'IN_PROGRESS', -- IN_PROGRESS, COMPLETED, FAILED
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    final_score NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, user_id, course_id)
);

CREATE TABLE public.learning_lesson_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    enrollment_id UUID NOT NULL REFERENCES public.learning_enrollments(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES public.learning_lessons(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'VIEWED', -- VIEWED, COMPLETED
    viewed_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, enrollment_id, lesson_id)
);

-- RLS Enablement
ALTER TABLE public.learning_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_lesson_progress ENABLE ROW LEVEL SECURITY;

-- Simple Org-based RLS Policies

-- Tracks
CREATE POLICY "Users can view learning_tracks in their org" ON public.learning_tracks
    FOR SELECT USING (
        org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid())
    );
CREATE POLICY "Admins can insert learning_tracks" ON public.learning_tracks
    FOR INSERT WITH CHECK (public.nizam_has_permission('learning:write', org_id));
CREATE POLICY "Admins can update learning_tracks" ON public.learning_tracks
    FOR UPDATE USING (public.nizam_has_permission('learning:write', org_id));
CREATE POLICY "Admins can delete learning_tracks" ON public.learning_tracks
    FOR DELETE USING (public.nizam_has_permission('learning:write', org_id));

-- Courses
CREATE POLICY "Users can view learning_courses in their org" ON public.learning_courses
    FOR SELECT USING (
        org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid())
    );
CREATE POLICY "Admins can insert learning_courses" ON public.learning_courses
    FOR INSERT WITH CHECK (public.nizam_has_permission('learning:write', org_id));
CREATE POLICY "Admins can update learning_courses" ON public.learning_courses
    FOR UPDATE USING (public.nizam_has_permission('learning:write', org_id));
CREATE POLICY "Admins can delete learning_courses" ON public.learning_courses
    FOR DELETE USING (public.nizam_has_permission('learning:write', org_id));

-- Lessons
CREATE POLICY "Users can view learning_lessons in their org" ON public.learning_lessons
    FOR SELECT USING (
        org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid())
    );
CREATE POLICY "Admins can insert learning_lessons" ON public.learning_lessons
    FOR INSERT WITH CHECK (public.nizam_has_permission('learning:write', org_id));
CREATE POLICY "Admins can update learning_lessons" ON public.learning_lessons
    FOR UPDATE USING (public.nizam_has_permission('learning:write', org_id));
CREATE POLICY "Admins can delete learning_lessons" ON public.learning_lessons
    FOR DELETE USING (public.nizam_has_permission('learning:write', org_id));

-- Enrollments
CREATE POLICY "Users can view their own enrollments" ON public.learning_enrollments
    FOR SELECT USING (
        user_id = auth.uid() OR
        public.nizam_has_permission('learning:write', org_id)
    );
CREATE POLICY "Users can create their own enrollments" ON public.learning_enrollments
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
    );
CREATE POLICY "Users can update their own enrollments" ON public.learning_enrollments
    FOR UPDATE USING (
        user_id = auth.uid() OR
        public.nizam_has_permission('learning:write', org_id)
    );

-- Lesson Progress
CREATE POLICY "Users can view their own progress" ON public.learning_lesson_progress
    FOR SELECT USING (
        enrollment_id IN (SELECT id FROM public.learning_enrollments WHERE user_id = auth.uid()) OR
        public.nizam_has_permission('learning:write', org_id)
    );
CREATE POLICY "Users can update their own progress" ON public.learning_lesson_progress
    FOR INSERT WITH CHECK (
        enrollment_id IN (SELECT id FROM public.learning_enrollments WHERE user_id = auth.uid())
    );
CREATE POLICY "Users can update their own progress (update)" ON public.learning_lesson_progress
    FOR UPDATE USING (
        enrollment_id IN (SELECT id FROM public.learning_enrollments WHERE user_id = auth.uid())
    );

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
