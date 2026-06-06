-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 1351: Kojasmat Rebuild — Platform Koperasi Syariah
-- Drop scaffold lama, buat skema lengkap.
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop scaffold lama (1350)
DROP TABLE IF EXISTS public.kojasmat_proyek_dibiayai    CASCADE;
DROP TABLE IF EXISTS public.kojasmat_tabungan           CASCADE;
DROP TABLE IF EXISTS public.kojasmat_anggota            CASCADE;
DROP TABLE IF EXISTS public.kojasmat_proyek             CASCADE;
DROP TYPE  IF EXISTS public.kojasmat_status             CASCADE;

-- ─── 1. ANGGOTA ──────────────────────────────────────────────────────────────
CREATE TABLE public.kojasmat_anggota (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kode_anggota   TEXT NOT NULL,
  nama           TEXT NOT NULL,
  nik            TEXT,
  email          TEXT,
  phone          TEXT,
  alamat         TEXT,
  pekerjaan      TEXT,
  status         TEXT NOT NULL DEFAULT 'CALON'
                 CHECK (status IN ('CALON','AKTIF','TIDAK_AKTIF','DIBEKUKAN')),
  is_verified    BOOLEAN NOT NULL DEFAULT FALSE,
  user_id        UUID REFERENCES public.internal_auth_users(id) ON DELETE SET NULL,
  joined_at      DATE,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ,
  UNIQUE(org_id, kode_anggota)
);
CREATE INDEX idx_kjm_anggota_org   ON public.kojasmat_anggota(org_id);
CREATE INDEX idx_kjm_anggota_uid   ON public.kojasmat_anggota(user_id) WHERE user_id IS NOT NULL;

-- ─── 2. SIMPANAN (POKOK | WAJIB | SUKARELA) ──────────────────────────────────
CREATE TABLE public.kojasmat_simpanan (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  anggota_id  UUID NOT NULL REFERENCES public.kojasmat_anggota(id) ON DELETE CASCADE,
  jenis       TEXT NOT NULL CHECK (jenis IN ('POKOK','WAJIB','SUKARELA')),
  saldo       NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ,
  UNIQUE(anggota_id, jenis)
);
CREATE INDEX idx_kjm_simpanan_anggota ON public.kojasmat_simpanan(anggota_id);

-- ─── 3. SIMPANAN MUTASI ───────────────────────────────────────────────────────
CREATE TABLE public.kojasmat_simpanan_mutasi (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  simpanan_id    UUID NOT NULL REFERENCES public.kojasmat_simpanan(id) ON DELETE CASCADE,
  anggota_id     UUID NOT NULL REFERENCES public.kojasmat_anggota(id) ON DELETE CASCADE,
  jenis_mutasi   TEXT NOT NULL CHECK (jenis_mutasi IN ('SETOR','TARIK','BAGI_HASIL','KOREKSI')),
  jumlah         NUMERIC(18,2) NOT NULL,
  saldo_sebelum  NUMERIC(18,2) NOT NULL DEFAULT 0,
  saldo_sesudah  NUMERIC(18,2) NOT NULL DEFAULT 0,
  keterangan     TEXT,
  tanggal        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by     UUID REFERENCES public.internal_auth_users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_kjm_mutasi_simpanan  ON public.kojasmat_simpanan_mutasi(simpanan_id);
CREATE INDEX idx_kjm_mutasi_anggota   ON public.kojasmat_simpanan_mutasi(anggota_id, tanggal DESC);

-- ─── 4. PROYEK ────────────────────────────────────────────────────────────────
CREATE TABLE public.kojasmat_proyek (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pengaju_id       UUID NOT NULL REFERENCES public.kojasmat_anggota(id) ON DELETE CASCADE,
  kode_proyek      TEXT NOT NULL,
  nama_proyek      TEXT NOT NULL,
  deskripsi        TEXT,
  jenis_akad       TEXT NOT NULL CHECK (jenis_akad IN ('MURABAHAH','MUDHARABAH','INAN')),
  kebutuhan_modal  NUMERIC(18,2) NOT NULL DEFAULT 0,
  modal_terkumpul  NUMERIC(18,2) NOT NULL DEFAULT 0,
  nisbah_koperasi  NUMERIC(5,2)  NOT NULL DEFAULT 30,
  nisbah_pemodal   NUMERIC(5,2)  NOT NULL DEFAULT 70,
  durasi_bulan     INTEGER        NOT NULL DEFAULT 6,
  tanggal_mulai    DATE,
  tanggal_selesai  DATE,
  status           TEXT NOT NULL DEFAULT 'DRAFT'
                   CHECK (status IN ('DRAFT','REVIEW_DPS','DISETUJUI','DITOLAK','OPEN',
                                     'TERPENUHI','BERJALAN','SELESAI','BAGI_HASIL','DITUTUP')),
  agunan           TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ,
  UNIQUE(org_id, kode_proyek)
);
CREATE INDEX idx_kjm_proyek_org    ON public.kojasmat_proyek(org_id, status);
CREATE INDEX idx_kjm_proyek_pengaju ON public.kojasmat_proyek(pengaju_id);

-- ─── 5. DPS REVIEW ───────────────────────────────────────────────────────────
CREATE TABLE public.kojasmat_dps_review (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  proyek_id    UUID NOT NULL REFERENCES public.kojasmat_proyek(id) ON DELETE CASCADE,
  reviewer_id  UUID REFERENCES public.internal_auth_users(id) ON DELETE SET NULL,
  keputusan    TEXT NOT NULL CHECK (keputusan IN ('DISETUJUI','DITOLAK','REVISI')),
  catatan      TEXT,
  reviewed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_kjm_dps_proyek ON public.kojasmat_dps_review(proyek_id);

-- ─── 6. PEMBIAYAAN (porsi per pemodal) ───────────────────────────────────────
CREATE TABLE public.kojasmat_pembiayaan (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  proyek_id   UUID NOT NULL REFERENCES public.kojasmat_proyek(id) ON DELETE CASCADE,
  pemodal_id  UUID NOT NULL REFERENCES public.kojasmat_anggota(id) ON DELETE CASCADE,
  jumlah      NUMERIC(18,2) NOT NULL,
  porsi_pct   NUMERIC(7,4)  NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'AKTIF' CHECK (status IN ('AKTIF','SELESAI','GAGAL')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(proyek_id, pemodal_id)
);
CREATE INDEX idx_kjm_pembiayaan_proyek  ON public.kojasmat_pembiayaan(proyek_id);
CREATE INDEX idx_kjm_pembiayaan_pemodal ON public.kojasmat_pembiayaan(pemodal_id);

-- ─── 7. CICILAN (Murabahah) ───────────────────────────────────────────────────
CREATE TABLE public.kojasmat_cicilan (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  proyek_id        UUID NOT NULL REFERENCES public.kojasmat_proyek(id) ON DELETE CASCADE,
  pembiayaan_id    UUID NOT NULL REFERENCES public.kojasmat_pembiayaan(id) ON DELETE CASCADE,
  no_cicilan       INTEGER NOT NULL,
  tanggal_jatuh    DATE NOT NULL,
  jumlah_cicilan   NUMERIC(18,2) NOT NULL,
  jumlah_bayar     NUMERIC(18,2) NOT NULL DEFAULT 0,
  tanggal_bayar    DATE,
  status           TEXT NOT NULL DEFAULT 'BELUM'
                   CHECK (status IN ('BELUM','SEBAGIAN','LUNAS','LEWAT_JATUH'))
);
CREATE INDEX idx_kjm_cicilan_proyek     ON public.kojasmat_cicilan(proyek_id);
CREATE INDEX idx_kjm_cicilan_pembiayaan ON public.kojasmat_cicilan(pembiayaan_id);

-- ─── 8. BAGI HASIL ───────────────────────────────────────────────────────────
CREATE TABLE public.kojasmat_bagi_hasil (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  proyek_id     UUID NOT NULL REFERENCES public.kojasmat_proyek(id) ON DELETE CASCADE,
  pemodal_id    UUID NOT NULL REFERENCES public.kojasmat_anggota(id) ON DELETE CASCADE,
  periode       TEXT NOT NULL,
  laba_proyek   NUMERIC(18,2) NOT NULL,
  porsi_pct     NUMERIC(7,4)  NOT NULL,
  hak_pemodal   NUMERIC(18,2) NOT NULL,
  hak_koperasi  NUMERIC(18,2) NOT NULL,
  status        TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','DIBAYAR')),
  dibayar_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_kjm_bh_proyek   ON public.kojasmat_bagi_hasil(proyek_id);
CREATE INDEX idx_kjm_bh_pemodal  ON public.kojasmat_bagi_hasil(pemodal_id);

-- ─── 9. PELATIHAN ─────────────────────────────────────────────────────────────
CREATE TABLE public.kojasmat_pelatihan (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  judul       TEXT NOT NULL,
  deskripsi   TEXT,
  instruktur  TEXT,
  tanggal     DATE NOT NULL,
  lokasi      TEXT,
  kuota       INTEGER NOT NULL DEFAULT 30,
  status      TEXT NOT NULL DEFAULT 'TERJADWAL'
              CHECK (status IN ('TERJADWAL','SELESAI','DIBATALKAN')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_kjm_pelatihan_org ON public.kojasmat_pelatihan(org_id, tanggal DESC);

-- ─── 10. PELATIHAN PESERTA ────────────────────────────────────────────────────
CREATE TABLE public.kojasmat_pelatihan_peserta (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pelatihan_id  UUID NOT NULL REFERENCES public.kojasmat_pelatihan(id) ON DELETE CASCADE,
  anggota_id    UUID NOT NULL REFERENCES public.kojasmat_anggota(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'TERDAFTAR'
                CHECK (status IN ('TERDAFTAR','HADIR','LULUS','TIDAK_HADIR')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(pelatihan_id, anggota_id)
);

-- ─── 11. PENAWARAN PROYEK ─────────────────────────────────────────────────────
CREATE TABLE public.kojasmat_penawaran (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  proyek_id   UUID NOT NULL REFERENCES public.kojasmat_proyek(id) ON DELETE CASCADE,
  anggota_id  UUID NOT NULL REFERENCES public.kojasmat_anggota(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'TERKIRIM'
              CHECK (status IN ('TERKIRIM','DIBACA','BERMINAT','DIABAIKAN')),
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(proyek_id, anggota_id)
);
CREATE INDEX idx_kjm_penawaran_anggota ON public.kojasmat_penawaran(anggota_id, status);
