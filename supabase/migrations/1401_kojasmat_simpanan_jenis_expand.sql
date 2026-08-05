-- Memperluas jenis simpanan Kojasmat untuk mengakomodasi kebutuhan pencatatan Laporan Keuangan (SimPro dan Hibah/Adm)
ALTER TABLE public.kojasmat_simpanan DROP CONSTRAINT IF EXISTS kojasmat_simpanan_jenis_check;
ALTER TABLE public.kojasmat_simpanan ADD CONSTRAINT kojasmat_simpanan_jenis_check CHECK (jenis IN ('POKOK', 'WAJIB', 'SUKARELA', 'PROYEK', 'HIBAH_NAMETAG', 'HIBAH_MEMBERCARD', 'HIBAH_KAJIAN', 'HIBAH_BOP'));
