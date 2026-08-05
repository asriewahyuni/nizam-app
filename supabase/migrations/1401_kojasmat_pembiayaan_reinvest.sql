-- kojasmat_pembiayaan_proyek_id_pemodal_id_key (UNIQUE proyek_id, pemodal_id) blocked
-- an investor from ever financing the same project again after cancelling their
-- first attempt (batalkanPembiayaan sets status='GAGAL', but the row still exists,
-- still collides with the unique constraint). Intent is only to prevent TWO ACTIVE
-- investments in the same project by the same investor, not to permanently ban
-- re-investment — replace with a partial unique index scoped to AKTIF rows.

ALTER TABLE public.kojasmat_pembiayaan
  DROP CONSTRAINT IF EXISTS kojasmat_pembiayaan_proyek_id_pemodal_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS kojasmat_pembiayaan_proyek_pemodal_aktif_key
  ON public.kojasmat_pembiayaan (proyek_id, pemodal_id)
  WHERE status = 'AKTIF';
