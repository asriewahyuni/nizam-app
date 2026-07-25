-- Add published_at to kojasmat_proyek for scheduled release
ALTER TABLE public.kojasmat_proyek ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;
-- Set existing projects to be already published
UPDATE public.kojasmat_proyek SET published_at = created_at WHERE published_at IS NULL;

-- Create kojasmat_proyek_diskusi table
CREATE TABLE IF NOT EXISTS public.kojasmat_proyek_diskusi (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    proyek_id UUID NOT NULL REFERENCES public.kojasmat_proyek(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES public.internal_auth_users(id) ON DELETE CASCADE,
    pesan TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kojasmat_proyek_diskusi_proyek_id ON public.kojasmat_proyek_diskusi(proyek_id);
CREATE INDEX IF NOT EXISTS idx_kojasmat_proyek_diskusi_org_id ON public.kojasmat_proyek_diskusi(org_id);
