-- ==============================================================================
-- Migration: 1248_lms_commercial_schema.sql
-- Description: Extends LMS core with commercial features: Batches, Sessions, 
--              Public Registrations, Payments, and Certificates.
-- ==============================================================================

-- 1. Course Batches (Batch / Angkatan)
CREATE TABLE public.lms_course_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.learning_courses(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g., "Batch 1", "Bootcamp 2024"
    start_date DATE,
    end_date DATE,
    quota INTEGER,
    price NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'OPEN', -- OPEN, CLOSED, ONGOING, COMPLETED
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Sessions (Sesi Live / Offline per Batch)
CREATE TABLE public.lms_batch_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES public.lms_course_batches(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    instructor_name TEXT,
    location_url TEXT,
    is_mandatory BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Public Registrations (Pendaftaran External & Pembayaran)
CREATE TABLE public.lms_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES public.lms_course_batches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Can be linked to an external user account
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    status TEXT DEFAULT 'PENDING_PAYMENT', -- PENDING_PAYMENT, CONFIRMED, CANCELLED
    invoice_id UUID, -- Placeholder for integration with sales_invoices or POS receipts
    payment_method TEXT,
    amount_paid NUMERIC DEFAULT 0,
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Certificates (Sertifikat Kelulusan)
CREATE TABLE public.lms_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    registration_id UUID NOT NULL REFERENCES public.lms_registrations(id) ON DELETE CASCADE,
    certificate_number TEXT NOT NULL,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    file_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, certificate_number)
);

-- RLS Enablement
ALTER TABLE public.lms_course_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_batch_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_certificates ENABLE ROW LEVEL SECURITY;

-- Simple Org-based RLS Policies

-- Batches
CREATE POLICY "Users can view course batches in their org" ON public.lms_course_batches
    FOR SELECT USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));
CREATE POLICY "Admins can insert course batches" ON public.lms_course_batches
    FOR INSERT WITH CHECK (public.nizam_has_permission('learning:write', org_id));
CREATE POLICY "Admins can update course batches" ON public.lms_course_batches
    FOR UPDATE USING (public.nizam_has_permission('learning:write', org_id));
CREATE POLICY "Admins can delete course batches" ON public.lms_course_batches
    FOR DELETE USING (public.nizam_has_permission('learning:write', org_id));

-- Sessions
CREATE POLICY "Users can view batch sessions in their org" ON public.lms_batch_sessions
    FOR SELECT USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));
CREATE POLICY "Admins can insert batch sessions" ON public.lms_batch_sessions
    FOR INSERT WITH CHECK (public.nizam_has_permission('learning:write', org_id));
CREATE POLICY "Admins can update batch sessions" ON public.lms_batch_sessions
    FOR UPDATE USING (public.nizam_has_permission('learning:write', org_id));
CREATE POLICY "Admins can delete batch sessions" ON public.lms_batch_sessions
    FOR DELETE USING (public.nizam_has_permission('learning:write', org_id));

-- Registrations
CREATE POLICY "Users can view registrations in their org" ON public.lms_registrations
    FOR SELECT USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));
CREATE POLICY "Admins can manage registrations" ON public.lms_registrations
    FOR ALL USING (public.nizam_has_permission('learning:write', org_id));

-- Certificates
CREATE POLICY "Users can view certificates in their org" ON public.lms_certificates
    FOR SELECT USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));
CREATE POLICY "Admins can manage certificates" ON public.lms_certificates
    FOR ALL USING (public.nizam_has_permission('learning:write', org_id));

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
