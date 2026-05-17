-- Tambah kolom ijab_qobul ke syirkah_contracts.
-- Menyimpan data ijab-qobul tiap pihak sebagai JSONB:
-- [{ member_name, type: IJAB|QOBUL, mode: personal|perwakilan, wakil_name, wakil_jabatan }]

ALTER TABLE public.syirkah_contracts
  ADD COLUMN IF NOT EXISTS ijab_qobul JSONB DEFAULT NULL;
