-- ============================================================
-- MIGRATION 1015: Zakat Asset Timeline (org-level, lintas haul)
-- Menyimpan semua snapshot perubahan harta zakat,
-- tidak terikat pada 1 haul saja, sehingga grafik bisa
-- menampilkan perjalanan harta MELEWATI batas nishab.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.zakat_asset_timeline (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  total_assets DECIMAL(19,4) NOT NULL,
  nishab_silver DECIMAL(19,4),
  is_above_nishab BOOLEAN,
  haul_id     UUID, -- referensi ke haul yang aktif saat itu (opsional)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_zakat_timeline_org ON public.zakat_asset_timeline(org_id, created_at);

-- RLS
ALTER TABLE public.zakat_asset_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_can_manage_zakat_timeline"
  ON public.zakat_asset_timeline FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

NOTIFY pgrst, 'reload schema';
