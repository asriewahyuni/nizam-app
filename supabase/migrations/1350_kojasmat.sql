-- Migrasi 1350: Modul Kojasmat (Koperasi Jasa & Tabungan Anggota)

DO $$ BEGIN
  CREATE TYPE kojasmat_status AS ENUM ('MENUNGGU', 'PROSES', 'SELESAI', 'DIBAYAR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Daftar proyek
CREATE TABLE IF NOT EXISTS public.kojasmat_proyek (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id   UUID REFERENCES public.branches(id),
  contact_id  UUID REFERENCES public.contacts(id),
  employee_id UUID REFERENCES public.employees(id),
  nama_proyek TEXT NOT NULL DEFAULT '',
  status      kojasmat_status NOT NULL DEFAULT 'MENUNGGU',
  amount      NUMERIC(15, 2),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ
);
ALTER TABLE public.kojasmat_proyek ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kojasmat_proyek_org ON public.kojasmat_proyek(org_id);
CREATE INDEX IF NOT EXISTS idx_kojasmat_proyek_date ON public.kojasmat_proyek(created_at DESC);

-- Buku tabungan anggota
CREATE TABLE IF NOT EXISTS public.kojasmat_tabungan (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id   UUID REFERENCES public.branches(id),
  contact_id  UUID REFERENCES public.contacts(id),
  employee_id UUID REFERENCES public.employees(id),
  nama_anggota TEXT NOT NULL DEFAULT '',
  saldo       NUMERIC(15, 2) NOT NULL DEFAULT 0,
  status      kojasmat_status NOT NULL DEFAULT 'MENUNGGU',
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ
);
ALTER TABLE public.kojasmat_tabungan ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kojasmat_tabungan_org ON public.kojasmat_tabungan(org_id);
CREATE INDEX IF NOT EXISTS idx_kojasmat_tabungan_date ON public.kojasmat_tabungan(created_at DESC);

-- Proyek dibiayai
CREATE TABLE IF NOT EXISTS public.kojasmat_proyek_dibiayai (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  proyek_id   UUID REFERENCES public.kojasmat_proyek(id) ON DELETE CASCADE,
  branch_id   UUID REFERENCES public.branches(id),
  contact_id  UUID REFERENCES public.contacts(id),
  amount      NUMERIC(15, 2) NOT NULL DEFAULT 0,
  status      kojasmat_status NOT NULL DEFAULT 'MENUNGGU',
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ
);
ALTER TABLE public.kojasmat_proyek_dibiayai ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kojasmat_proyek_dibiayai_org ON public.kojasmat_proyek_dibiayai(org_id);

-- Anggota terverifikasi
CREATE TABLE IF NOT EXISTS public.kojasmat_anggota (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id    UUID REFERENCES public.branches(id),
  contact_id   UUID REFERENCES public.contacts(id),
  nama_anggota TEXT NOT NULL DEFAULT '',
  no_anggota   TEXT,
  is_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  status       kojasmat_status NOT NULL DEFAULT 'MENUNGGU',
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ,
  UNIQUE (org_id, no_anggota)
);
ALTER TABLE public.kojasmat_anggota ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kojasmat_anggota_org ON public.kojasmat_anggota(org_id);
