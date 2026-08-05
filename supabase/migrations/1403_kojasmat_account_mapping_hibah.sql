-- Tambah kolom untuk mapping akun baru di Kojasmat
ALTER TABLE public.kojasmat_account_mapping
ADD COLUMN IF NOT EXISTS simpanan_proyek_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS hibah_nametag_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS hibah_membercard_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS hibah_kajian_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS hibah_bop_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;
