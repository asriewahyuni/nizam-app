-- Kojasmat — kolom pemetaan akun untuk pendapatan ijarah platform.
ALTER TABLE public.kojasmat_account_mapping
ADD COLUMN IF NOT EXISTS pendapatan_ijarah_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;
