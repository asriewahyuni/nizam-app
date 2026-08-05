-- Kojasmat — test kedua untuk upgrade anggota TEMAN ke SAHABAT. Mirip
-- kojasmat_test_masuk tapi terikat ke anggota (bukan pendaftaran) karena ini
-- dijalankan SETELAH anggota aktif, bukan sebelum. Lulus test TIDAK langsung
-- menaikkan tingkat — status_approval terpisah dari status ujian sendiri,
-- staf wajib klik setuju dulu (persis pola review_oleh di kojasmat_pendaftaran).
CREATE TABLE public.kojasmat_test_sahabat (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  anggota_id        UUID NOT NULL REFERENCES public.kojasmat_anggota(id) ON DELETE CASCADE,
  soal_ids          UUID[] NOT NULL,
  jawaban           JSONB,
  jumlah_benar      INT,
  skor              NUMERIC(5,2),
  passing_threshold INT NOT NULL DEFAULT 70,
  status            TEXT NOT NULL DEFAULT 'BERLANGSUNG' CHECK (status IN ('BERLANGSUNG', 'LULUS', 'GAGAL')),
  attempt_number    INT NOT NULL DEFAULT 1,
  submitted_at      TIMESTAMPTZ,
  status_approval   TEXT NOT NULL DEFAULT 'BELUM' CHECK (status_approval IN ('BELUM', 'DISETUJUI', 'DITOLAK')),
  disetujui_oleh    UUID REFERENCES public.internal_auth_users(id) ON DELETE SET NULL,
  disetujui_at      TIMESTAMPTZ,
  catatan_admin     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kjm_test_sahabat_anggota ON public.kojasmat_test_sahabat (anggota_id);
CREATE INDEX idx_kjm_test_sahabat_pending ON public.kojasmat_test_sahabat (org_id, status_approval)
  WHERE status = 'LULUS' AND status_approval = 'BELUM';
