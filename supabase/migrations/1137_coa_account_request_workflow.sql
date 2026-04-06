-- ============================================================
-- MIGRATION 1137: CoA Account Request Workflow
-- ============================================================
-- Tujuan:
--   Branch dan Child tidak bisa buat rekening CoA sendiri.
--   Mereka harus mengajukan REQUEST ke Parent untuk disetujui.
--   Parent (owner/admin di main org + main branch) bisa Approve/Reject.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. ENUM: Status request rekening CoA
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'coa_request_status') THEN
    CREATE TYPE public.coa_request_status AS ENUM (
      'pending',    -- Baru diajukan, menunggu review
      'approved',   -- Disetujui oleh Parent, akun sudah dibuat
      'rejected',   -- Ditolak, beserta alasan
      'cancelled'   -- Dibatalkan oleh pengaju sendiri
    );
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 2. TABEL: coa_account_requests
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coa_account_requests (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Organisasi pemilik CoA (selalu org_id Parent / Holding)
  org_id            UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Siapa yang mengajukan (Child org atau branch dari child)
  requester_org_id  UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requester_branch_id UUID      REFERENCES public.branches(id) ON DELETE SET NULL,
  requested_by      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Data akun yang diminta
  proposed_code     TEXT        NOT NULL,
  proposed_name     TEXT        NOT NULL,
  proposed_type     TEXT        NOT NULL, -- asset, liability, equity, revenue, expense
  proposed_normal_balance TEXT  NOT NULL, -- debit, credit
  proposed_parent_id UUID       REFERENCES public.accounts(id) ON DELETE SET NULL,
  proposed_description TEXT,

  -- Alasan / justifikasi bisnis dari pengaju
  business_reason   TEXT        NOT NULL,

  -- Status workflow
  status            public.coa_request_status NOT NULL DEFAULT 'pending',

  -- Review oleh Parent
  reviewed_by       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  review_notes      TEXT,

  -- Akun yang akhirnya dibuat (jika approved)
  created_account_id UUID       REFERENCES public.accounts(id) ON DELETE SET NULL,

  -- Timestamps
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 3. INDEX
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_coa_requests_org_id
  ON public.coa_account_requests(org_id);

CREATE INDEX IF NOT EXISTS idx_coa_requests_requester_org
  ON public.coa_account_requests(requester_org_id);

CREATE INDEX IF NOT EXISTS idx_coa_requests_status
  ON public.coa_account_requests(status, org_id);

CREATE INDEX IF NOT EXISTS idx_coa_requests_requested_by
  ON public.coa_account_requests(requested_by);

-- ────────────────────────────────────────────────────────────
-- 4. AUTO-UPDATE updated_at
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_coa_request_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_coa_request_updated_at ON public.coa_account_requests;
CREATE TRIGGER trg_coa_request_updated_at
  BEFORE UPDATE ON public.coa_account_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_coa_request_updated_at();

-- ────────────────────────────────────────────────────────────
-- 5. BUSINESS RULE: Validasi saat INSERT request
--    - Requester org harus bagian dari tree org_id (parent)
--    - Requester tidak boleh IS main organization (branch/child saja)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_coa_request_governance()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_requester_in_tree  BOOLEAN;
  v_is_requester_parent   BOOLEAN;
BEGIN
  -- Pastikan requester_org adalah bagian dari hierarki org_id (parent)
  v_is_requester_in_tree := public.is_org_in_consolidation_tree(NEW.requester_org_id, NEW.org_id);
  IF NOT v_is_requester_in_tree THEN
    RAISE EXCEPTION
      'Organisasi pengaju bukan bagian dari struktur konsolidasi parent yang dituju.';
  END IF;

  -- Parent/Holding tidak perlu mengajukan request ke dirinya sendiri
  v_is_requester_parent := (NEW.requester_org_id = NEW.org_id);
  IF v_is_requester_parent THEN
    RAISE EXCEPTION
      'Organisasi Parent/Holding tidak perlu mengajukan request. Buat langsung akun CoA.';
  END IF;

  -- Status awal harus selalu pending
  NEW.status := 'pending';
  NEW.reviewed_by := NULL;
  NEW.reviewed_at := NULL;
  NEW.review_notes := NULL;
  NEW.created_account_id := NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_coa_request_governance ON public.coa_account_requests;
CREATE TRIGGER trg_coa_request_governance
  BEFORE INSERT ON public.coa_account_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_coa_request_governance();

-- ────────────────────────────────────────────────────────────
-- 6. RPC: submit_coa_request
--    Dipanggil oleh Child/Branch untuk mengajukan rekening baru
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_coa_request(
  p_parent_org_id       UUID,
  p_requester_org_id    UUID,
  p_requester_branch_id UUID,
  p_proposed_code       TEXT,
  p_proposed_name       TEXT,
  p_proposed_type       TEXT,
  p_proposed_normal_balance TEXT,
  p_proposed_parent_id  UUID,
  p_proposed_description TEXT,
  p_business_reason     TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autentikasi diperlukan.';
  END IF;

  IF p_business_reason IS NULL OR trim(p_business_reason) = '' THEN
    RAISE EXCEPTION 'Alasan bisnis wajib diisi saat mengajukan request rekening CoA.';
  END IF;

  INSERT INTO public.coa_account_requests (
    org_id,
    requester_org_id,
    requester_branch_id,
    requested_by,
    proposed_code,
    proposed_name,
    proposed_type,
    proposed_normal_balance,
    proposed_parent_id,
    proposed_description,
    business_reason
  ) VALUES (
    p_parent_org_id,
    p_requester_org_id,
    p_requester_branch_id,
    auth.uid(),
    trim(p_proposed_code),
    trim(p_proposed_name),
    p_proposed_type,
    p_proposed_normal_balance,
    p_proposed_parent_id,
    p_proposed_description,
    trim(p_business_reason)
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 7. RPC: approve_coa_request
--    Hanya Parent (can_manage_finance_master) yang bisa approve.
--    Sekaligus membuat akun di tabel accounts.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_coa_request(
  p_request_id  UUID,
  p_review_notes TEXT DEFAULT NULL
)
RETURNS UUID -- returns newly created account_id
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req               public.coa_account_requests%ROWTYPE;
  v_new_account_id    UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autentikasi diperlukan.';
  END IF;

  -- Ambil request
  SELECT * INTO v_req
  FROM public.coa_account_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request CoA tidak ditemukan.';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Hanya request berstatus pending yang dapat disetujui. Status saat ini: %', v_req.status;
  END IF;

  -- Pemeriksa harus punya otoritas finance master di org Parent
  IF NOT public.can_manage_finance_master(v_req.org_id) THEN
    RAISE EXCEPTION 'Hanya Organisasi Utama (Parent) pada konteks Unit Utama yang dapat menyetujui request CoA.';
  END IF;

  -- Buat akun baru di CoA Parent
  INSERT INTO public.accounts (
    org_id,
    code,
    name,
    type,
    normal_balance,
    parent_id,
    description,
    is_system
  ) VALUES (
    v_req.org_id,
    v_req.proposed_code,
    v_req.proposed_name,
    v_req.proposed_type,
    v_req.proposed_normal_balance,
    v_req.proposed_parent_id,
    v_req.proposed_description,
    FALSE
  )
  RETURNING id INTO v_new_account_id;

  -- Update status request
  UPDATE public.coa_account_requests
  SET
    status             = 'approved',
    reviewed_by        = auth.uid(),
    reviewed_at        = now(),
    review_notes       = p_review_notes,
    created_account_id = v_new_account_id
  WHERE id = p_request_id;

  RETURN v_new_account_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 8. RPC: reject_coa_request
--    Parent menolak request dengan menuliskan catatan alasan.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reject_coa_request(
  p_request_id   UUID,
  p_review_notes TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.coa_account_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autentikasi diperlukan.';
  END IF;

  SELECT * INTO v_req
  FROM public.coa_account_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request CoA tidak ditemukan.';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Hanya request berstatus pending yang dapat ditolak. Status saat ini: %', v_req.status;
  END IF;

  IF NOT public.can_manage_finance_master(v_req.org_id) THEN
    RAISE EXCEPTION 'Hanya Organisasi Utama (Parent) yang dapat menolak request CoA.';
  END IF;

  IF p_review_notes IS NULL OR trim(p_review_notes) = '' THEN
    RAISE EXCEPTION 'Catatan alasan penolakan wajib diisi.';
  END IF;

  UPDATE public.coa_account_requests
  SET
    status       = 'rejected',
    reviewed_by  = auth.uid(),
    reviewed_at  = now(),
    review_notes = p_review_notes
  WHERE id = p_request_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 9. RPC: cancel_coa_request
--    Pengaju membatalkan requestnya sendiri (hanya jika masih pending)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_coa_request(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.coa_account_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autentikasi diperlukan.';
  END IF;

  SELECT * INTO v_req
  FROM public.coa_account_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request CoA tidak ditemukan.';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Hanya request berstatus pending yang dapat dibatalkan.';
  END IF;

  -- Hanya pengaju sendiri yang bisa membatalkan
  IF v_req.requested_by <> auth.uid() THEN
    RAISE EXCEPTION 'Anda tidak memiliki izin membatalkan request ini.';
  END IF;

  UPDATE public.coa_account_requests
  SET status = 'cancelled'
  WHERE id = p_request_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 10. VIEW: coa_request_summary (untuk dashboard Parent)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.coa_request_summary AS
SELECT
  r.id,
  r.org_id,
  r.requester_org_id,
  o_req.name             AS requester_org_name,
  r.requester_branch_id,
  b.name                 AS requester_branch_name,
  r.requested_by,
  r.proposed_code,
  r.proposed_name,
  r.proposed_type,
  r.proposed_normal_balance,
  r.proposed_description,
  r.business_reason,
  r.status,
  r.reviewed_by,
  r.reviewed_at,
  r.review_notes,
  r.created_account_id,
  a.code                 AS created_account_code,
  a.name                 AS created_account_name,
  r.created_at,
  r.updated_at
FROM public.coa_account_requests r
LEFT JOIN public.organizations  o_req ON o_req.id = r.requester_org_id
LEFT JOIN public.branches       b     ON b.id     = r.requester_branch_id
LEFT JOIN public.accounts       a     ON a.id     = r.created_account_id;

-- ────────────────────────────────────────────────────────────
-- 11. RLS: Row Level Security
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.coa_account_requests ENABLE ROW LEVEL SECURITY;

-- Parent (owner/admin) bisa melihat semua request untuk org mereka
CREATE POLICY "parent_can_see_all_requests"
  ON public.coa_account_requests
  FOR SELECT
  USING (
    public.is_org_admin(org_id)
    OR public.can_manage_finance_master(org_id)
  );

-- Child/Branch bisa melihat request yang mereka ajukan
CREATE POLICY "requester_can_see_own_requests"
  ON public.coa_account_requests
  FOR SELECT
  USING (requested_by = auth.uid());

-- Siapapun yang authenticated bisa INSERT (validasi lewat trigger)
CREATE POLICY "authenticated_can_submit_requests"
  ON public.coa_account_requests
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Update hanya boleh via RPC (SECURITY DEFINER), tidak langsung
CREATE POLICY "no_direct_update"
  ON public.coa_account_requests
  FOR UPDATE
  USING (FALSE);

-- Tidak ada yang boleh delete langsung
CREATE POLICY "no_direct_delete"
  ON public.coa_account_requests
  FOR DELETE
  USING (FALSE);

NOTIFY pgrst, 'reload schema';
