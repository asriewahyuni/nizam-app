-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 1354: Kojasmat — sistem keanggotaan lengkap
--   • Pendaftaran anggota (registration queue)
--   • Dokumen (upload KTP, Passport, Surat Usaha, Proyeksi Keuangan, dll.)
--   • Laporan proyek mingguan
--   • Tindakan/sanksi (peringatan → pencabutan keanggotaan)
--   • Akad penandatanganan proyek
--   • Nisbah syirkah pengaju ↔ pemodal (diatur oleh pengaju)
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. PENDAFTARAN ──────────────────────────────────────────────────────────

CREATE TABLE public.kojasmat_pendaftaran (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id           UUID        REFERENCES public.internal_auth_users(id) ON DELETE SET NULL,
  nama_lengkap      TEXT        NOT NULL,
  nik               TEXT,
  email             TEXT,
  phone             TEXT,
  alamat            TEXT,
  pekerjaan         TEXT,
  alasan_bergabung  TEXT,
  status            TEXT        NOT NULL DEFAULT 'MENUNGGU'
    CHECK (status IN ('MENUNGGU','DISETUJUI','DITOLAK','DIREVISI')),
  catatan_pengurus  TEXT,
  ditinjau_oleh     UUID        REFERENCES public.internal_auth_users(id) ON DELETE SET NULL,
  ditinjau_at       TIMESTAMPTZ,
  anggota_id        UUID        REFERENCES public.kojasmat_anggota(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_kjm_pendaftaran_org    ON public.kojasmat_pendaftaran(org_id, status);
CREATE INDEX idx_kjm_pendaftaran_user   ON public.kojasmat_pendaftaran(user_id);

-- ─── 2. DOKUMEN ──────────────────────────────────────────────────────────────

CREATE TABLE public.kojasmat_dokumen (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID    NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Polymorphic: bisa milik pendaftaran, anggota, proyek, atau laporan
  referensi_type    TEXT    NOT NULL
    CHECK (referensi_type IN ('PENDAFTARAN','ANGGOTA','PROYEK','LAPORAN')),
  referensi_id      UUID    NOT NULL,
  jenis_dokumen     TEXT    NOT NULL
    CHECK (jenis_dokumen IN (
      'KTP','PASSPORT','SURAT_USAHA','FOTO_USAHA',
      'PROYEKSI_KEUANGAN','ANALISA_BISNIS','PENAWARAN_SYIRKAH',
      'LAPORAN_MINGGUAN','AKAD','LAINNYA'
    )),
  nama_file         TEXT    NOT NULL,
  file_key          TEXT    NOT NULL,     -- S3 object key
  file_size         INTEGER,
  mime_type         TEXT,
  status            TEXT    NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','DITERIMA','DITOLAK')),
  catatan           TEXT,
  uploaded_by       UUID    REFERENCES public.internal_auth_users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_kjm_dokumen_ref ON public.kojasmat_dokumen(referensi_type, referensi_id);

-- ─── 3. LAPORAN PROYEK MINGGUAN ──────────────────────────────────────────────

CREATE TABLE public.kojasmat_laporan_proyek (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  proyek_id         UUID        NOT NULL REFERENCES public.kojasmat_proyek(id) ON DELETE CASCADE,
  pengaju_id        UUID        NOT NULL REFERENCES public.kojasmat_anggota(id) ON DELETE CASCADE,
  periode_mulai     DATE        NOT NULL,
  periode_akhir     DATE        NOT NULL,
  ringkasan         TEXT        NOT NULL,
  omzet_periode     NUMERIC(18,2) NOT NULL DEFAULT 0,
  kendala           TEXT,
  rencana_kedepan   TEXT,
  status            TEXT        NOT NULL DEFAULT 'DIKIRIM'
    CHECK (status IN ('DIKIRIM','DITINJAU','DIVERIFIKASI')),
  catatan_pengurus  TEXT,
  is_terlambat      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_kjm_laporan_proyek ON public.kojasmat_laporan_proyek(proyek_id, periode_mulai DESC);

-- ─── 4. TINDAKAN / SANKSI ────────────────────────────────────────────────────

CREATE TABLE public.kojasmat_tindakan (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID    NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  anggota_id    UUID    NOT NULL REFERENCES public.kojasmat_anggota(id) ON DELETE CASCADE,
  proyek_id     UUID    REFERENCES public.kojasmat_proyek(id) ON DELETE SET NULL,
  jenis         TEXT    NOT NULL
    CHECK (jenis IN ('PERINGATAN','TINJAUAN_ULANG','PENCABUTAN_KEANGGOTAAN')),
  alasan        TEXT    NOT NULL,
  status        TEXT    NOT NULL DEFAULT 'AKTIF'
    CHECK (status IN ('AKTIF','SELESAI','DIBATALKAN')),
  issued_by     UUID    REFERENCES public.internal_auth_users(id) ON DELETE SET NULL,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_kjm_tindakan_anggota ON public.kojasmat_tindakan(anggota_id, status);

-- ─── 5. AKAD PENANDATANGANAN ─────────────────────────────────────────────────

CREATE TABLE public.kojasmat_akad (
  id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID    NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  proyek_id             UUID    NOT NULL UNIQUE REFERENCES public.kojasmat_proyek(id) ON DELETE CASCADE,
  tanggal_akad          DATE,
  saksi_koperasi_id     UUID    REFERENCES public.internal_auth_users(id) ON DELETE SET NULL,
  catatan               TEXT,
  status                TEXT    NOT NULL DEFAULT 'MENUNGGU_TTD'
    CHECK (status IN ('MENUNGGU_TTD','DITANDATANGANI','BATAL')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 6. NISBAH SYIRKAH (pengaju ↔ pemodal) ───────────────────────────────────
-- Koperasi tetap hanya dapat ujrah_nominal (sudah ada).
-- Nisbah ini adalah bagi hasil antara pengaju proyek dan pemodal.

ALTER TABLE public.kojasmat_proyek
  ADD COLUMN IF NOT EXISTS nisbah_pengaju NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nisbah_pemodal NUMERIC(5,2) NOT NULL DEFAULT 100;

COMMENT ON COLUMN public.kojasmat_proyek.nisbah_pengaju IS
  'Porsi bagi hasil pengaju (% dari keuntungan) — diatur oleh pengaju, berlaku untuk Mudharabah & Inan';
COMMENT ON COLUMN public.kojasmat_proyek.nisbah_pemodal IS
  'Porsi bagi hasil pemodal kolektif (% dari keuntungan) — sisa dari nisbah_pengaju';
