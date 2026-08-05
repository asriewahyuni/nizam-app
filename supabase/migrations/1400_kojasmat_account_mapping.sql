-- Pemetaan akun COA per "peran" jurnal Kojasmat, bisa diatur sendiri oleh admin
-- koperasi lewat UI — menggantikan kode akun yang sebelumnya di-hardcode di
-- lib/erp-bridge/kojasmat-journals.ts (rawan tidak cocok dengan skema CoA
-- masing-masing koperasi, menyebabkan jurnal silently gagal diposting).

CREATE TABLE IF NOT EXISTS public.kojasmat_account_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  kas_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  simpanan_pokok_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  simpanan_wajib_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  simpanan_sukarela_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  dst_murabahah_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  dst_mudharabah_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  piutang_pembiayaan_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  ujrah_murabahah_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  ujrah_mudharabah_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  pendapatan_admin_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  pendapatan_proyek_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  beban_proyek_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  bagi_hasil_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id)
);
