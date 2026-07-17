-- 1377: Attempt test masuk anggota Kojasmat (20 soal acak, auto-graded)

CREATE TABLE kojasmat_test_masuk (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  pendaftaran_id UUID NOT NULL REFERENCES kojasmat_pendaftaran(id) ON DELETE CASCADE,
  soal_ids UUID[] NOT NULL,
  jawaban JSONB NOT NULL DEFAULT '{}',
  jumlah_benar INT,
  skor NUMERIC(5,2),
  passing_threshold INT NOT NULL DEFAULT 70,
  status TEXT NOT NULL DEFAULT 'BERLANGSUNG' CHECK (status IN ('BERLANGSUNG','LULUS','GAGAL')),
  attempt_number INT NOT NULL DEFAULT 1,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kojasmat_test_masuk_pendaftaran ON kojasmat_test_masuk(pendaftaran_id, created_at DESC);
