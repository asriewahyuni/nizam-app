-- ============================================================
-- MIGRATION 1305: Koperasi Syariah — Database Foundation
-- ============================================================
-- Meliputi: anggota, simpanan, sertifikasi DPS, wakalah,
-- murabahah, proyek mudharabah, akuntansi proyek, bagi hasil
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1. MASTER DATA
-- ══════════════════════════════════════════════════════════════

-- 1.1 Anggota Koperasi
CREATE TABLE IF NOT EXISTS koperasi_anggota (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id       UUID REFERENCES branches(id) ON DELETE SET NULL,
  employee_id     UUID REFERENCES employees(id) ON DELETE SET NULL,
  kode_anggota    VARCHAR(50) NOT NULL,
  nama            VARCHAR(255) NOT NULL,
  nik             VARCHAR(50),
  alamat          TEXT,
  no_telepon      VARCHAR(30),
  email           VARCHAR(255),
  tanggal_daftar  DATE NOT NULL DEFAULT CURRENT_DATE,
  status          VARCHAR(20) NOT NULL DEFAULT 'AKTIF'
                    CHECK (status IN ('AKTIF','NONAKTIF','KELUAR','MENINGGAL')),
  is_tersertifikasi_dps BOOLEAN NOT NULL DEFAULT FALSE,
  simpanan_pokok  DECIMAL(18,2) NOT NULL DEFAULT 0,
  simpanan_wajib_setoran DECIMAL(18,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_koperasi_anggota_org_kode UNIQUE (org_id, kode_anggota),
  CONSTRAINT uq_koperasi_anggota_org_employee UNIQUE (org_id, employee_id)
);

CREATE INDEX idx_koperasi_anggota_org ON koperasi_anggota(org_id);
CREATE INDEX idx_koperasi_anggota_status ON koperasi_anggota(org_id, status);

-- 1.2 Sertifikasi DPS
CREATE TABLE IF NOT EXISTS koperasi_sertifikasi_dps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type     VARCHAR(20) NOT NULL CHECK (entity_type IN ('ANGGOTA','MUDHARIB')),
  entity_id       UUID NOT NULL,
  no_sertifikat   VARCHAR(100) NOT NULL,
  tgl_terbit      DATE NOT NULL,
  tgl_expired     DATE NOT NULL,
  level           VARCHAR(50) DEFAULT 'DASAR',
  penerbit        VARCHAR(255) DEFAULT 'CORE iSEC',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_koperasi_sertifikasi_no UNIQUE (org_id, no_sertifikat)
);

CREATE INDEX idx_koperasi_sertifikasi_entity ON koperasi_sertifikasi_dps(org_id, entity_type, entity_id);

-- 1.3 Shahibul Maal (anggota yang bertindak sebagai investor)
CREATE TABLE IF NOT EXISTS koperasi_shahibul_maal (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  anggota_id      UUID NOT NULL REFERENCES koperasi_anggota(id) ON DELETE CASCADE,
  total_investasi DECIMAL(18,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_koperasi_shahibul_maal UNIQUE (org_id, anggota_id)
);

CREATE INDEX idx_koperasi_shahibul_maal_org ON koperasi_shahibul_maal(org_id);

-- 1.4 Mudharib (pengelola proyek — bisa anggota atau non-anggota)
CREATE TABLE IF NOT EXISTS koperasi_mudharib (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  anggota_id      UUID REFERENCES koperasi_anggota(id) ON DELETE SET NULL,
  nama            VARCHAR(255) NOT NULL,
  nik             VARCHAR(50),
  alamat          TEXT,
  no_telepon      VARCHAR(30),
  email           VARCHAR(255),
  is_tersertifikasi_dps BOOLEAN NOT NULL DEFAULT FALSE,
  is_blacklisted  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_koperasi_mudharib_org_anggota UNIQUE (org_id, anggota_id)
);

CREATE INDEX idx_koperasi_mudharib_org ON koperasi_mudharib(org_id);

-- ══════════════════════════════════════════════════════════════
-- 2. SIMPANAN
-- ══════════════════════════════════════════════════════════════

-- 2.1 Simpanan Pokok (1x per anggota)
CREATE TABLE IF NOT EXISTS koperasi_simpanan_pokok (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  anggota_id      UUID NOT NULL REFERENCES koperasi_anggota(id) ON DELETE CASCADE,
  jumlah          DECIMAL(18,2) NOT NULL,
  tgl_bayar       DATE NOT NULL DEFAULT CURRENT_DATE,
  keterangan      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_koperasi_simpanan_pokok ON koperasi_simpanan_pokok(org_id, anggota_id);

-- 2.2 Simpanan Wajib (periodik)
CREATE TABLE IF NOT EXISTS koperasi_simpanan_wajib (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  anggota_id      UUID NOT NULL REFERENCES koperasi_anggota(id) ON DELETE CASCADE,
  jumlah          DECIMAL(18,2) NOT NULL,
  periode_bulan   DATE NOT NULL,
  tgl_bayar       DATE NOT NULL DEFAULT CURRENT_DATE,
  keterangan      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_koperasi_simpanan_wajib_periode UNIQUE (anggota_id, periode_bulan)
);

CREATE INDEX idx_koperasi_simpanan_wajib_anggota ON koperasi_simpanan_wajib(org_id, anggota_id);

-- 2.3 Simpanan Sukarela (Wadiah)
CREATE TABLE IF NOT EXISTS koperasi_simpanan_sukarela (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  anggota_id      UUID NOT NULL REFERENCES koperasi_anggota(id) ON DELETE CASCADE,
  jenis           VARCHAR(10) NOT NULL CHECK (jenis IN ('SETOR','TARIK')),
  jumlah          DECIMAL(18,2) NOT NULL,
  saldo_setelah   DECIMAL(18,2) NOT NULL,
  tgl_transaksi   DATE NOT NULL DEFAULT CURRENT_DATE,
  keterangan      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_koperasi_simpanan_sukarela ON koperasi_simpanan_sukarela(org_id, anggota_id);

-- ══════════════════════════════════════════════════════════════
-- 3. MURABAHAH BIL WAKALAH
-- ══════════════════════════════════════════════════════════════

-- 3.1 Akad Wakalah bil Ujrah (Shahibul Maal → Koperasi)
CREATE TABLE IF NOT EXISTS koperasi_akad_wakalah (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nomor_akad      VARCHAR(100) NOT NULL,
  shahibul_maal_id UUID NOT NULL REFERENCES koperasi_shahibul_maal(id) ON DELETE CASCADE,
  tgl_akad        DATE NOT NULL DEFAULT CURRENT_DATE,
  jenis_barang    VARCHAR(255),
  ujrah_flat      DECIMAL(18,2) NOT NULL DEFAULT 0,
  status          VARCHAR(20) NOT NULL DEFAULT 'AKTIF'
                    CHECK (status IN ('DRAFT','AKTIF','SELESAI','BATAL')),
  berkas_pdf      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_koperasi_akad_wakalah_no UNIQUE (org_id, nomor_akad)
);

CREATE INDEX idx_koperasi_akad_wakalah_org ON koperasi_akad_wakalah(org_id);

-- 3.2 Transaksi Murabahah
CREATE TABLE IF NOT EXISTS koperasi_murabahah_transaksi (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  akad_wakalah_id UUID NOT NULL REFERENCES koperasi_akad_wakalah(id) ON DELETE CASCADE,
  nomor_transaksi VARCHAR(100) NOT NULL,
  pembeli_id      UUID NOT NULL REFERENCES koperasi_anggota(id) ON DELETE CASCADE,
  nama_barang     VARCHAR(255) NOT NULL,
  harga_pokok     DECIMAL(18,2) NOT NULL,
  margin          DECIMAL(18,2) NOT NULL,
  harga_jual      DECIMAL(18,2) NOT NULL, -- pokok + margin
  tenor_bulan     INT NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'AKTIF'
                    CHECK (status IN ('AKTIF','LUNAS','MACET','HAPUS_BUKU')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_koperasi_murabahah_no UNIQUE (org_id, nomor_transaksi)
);

CREATE INDEX idx_koperasi_murabahah_pembeli ON koperasi_murabahah_transaksi(org_id, pembeli_id);

-- 3.3 Angsuran Murabahah
CREATE TABLE IF NOT EXISTS koperasi_murabahah_angsuran (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaksi_id    UUID NOT NULL REFERENCES koperasi_murabahah_transaksi(id) ON DELETE CASCADE,
  angsuran_ke     INT NOT NULL,
  jatuh_tempo     DATE NOT NULL,
  jumlah          DECIMAL(18,2) NOT NULL,
  tgl_bayar       DATE,
  status          VARCHAR(20) NOT NULL DEFAULT 'BELUM_BAYAR'
                    CHECK (status IN ('BELUM_BAYAR','LUNAS','TERLAMBAT','DENDA')),
  denda_ta_zir    DECIMAL(18,2) DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_koperasi_murabahah_angsuran ON koperasi_murabahah_angsuran(transaksi_id);

-- 3.4 Tracking Barang Murabahah (3 status)
CREATE TABLE IF NOT EXISTS koperasi_murabahah_barang (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaksi_id    UUID NOT NULL REFERENCES koperasi_murabahah_transaksi(id) ON DELETE CASCADE,
  status_barang   VARCHAR(20) NOT NULL DEFAULT 'DI_SHAHIBUL'
                    CHECK (status_barang IN ('DI_SHAHIBUL','DI_KOPERASI','DI_PEMBELI','RUSAK','DIKEMBALIKAN')),
  tgl_masuk_koperasi DATE,
  tgl_ke_pembeli     DATE,
  catatan         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 4. MUDHARABAH MULTI SHAHIBUL MAAL — PROYEK
-- ══════════════════════════════════════════════════════════════

-- 4.1 Proyek
CREATE TABLE IF NOT EXISTS koperasi_proyek (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  mudharib_id       UUID NOT NULL REFERENCES koperasi_mudharib(id) ON DELETE CASCADE,
  nama_proyek       VARCHAR(255) NOT NULL,
  deskripsi         TEXT,
  modal_dibutuhkan  DECIMAL(18,2) NOT NULL,
  modal_terkumpul   DECIMAL(18,2) NOT NULL DEFAULT 0,
  nisbah_sm         DECIMAL(5,2) NOT NULL DEFAULT 70.00,  -- % untuk Shahibul Maal (kolektif)
  nisbah_mudharib   DECIMAL(5,2) NOT NULL DEFAULT 30.00,  -- % untuk Mudharib
  ujrah_koperasi    DECIMAL(18,2) DEFAULT 0,              -- flat fee
  status            VARCHAR(20) NOT NULL DEFAULT 'DIAJUKAN'
                      CHECK (status IN (
                        'DIAJUKAN','DIVERIFIKASI','DIPUBLIKASI','PENDANAAN',
                        'AKTIF','SELESAI','DISTRIBUSI','DITUTUP',
                        'DITOLAK','GAGAL','DIKEMBALIKAN'
                      )),
  -- Timestamps per status
  tgl_diajukan      DATE NOT NULL DEFAULT CURRENT_DATE,
  tgl_diverifikasi  DATE,
  tgl_dipublikasi   DATE,
  tgl_tutup_invest  DATE,
  tgl_aktif         DATE,
  tgl_selesai       DATE,
  tgl_distribusi    DATE,
  tgl_ditutup       DATE,
  alasan_ditolak    TEXT,
  alasan_gagal      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_koperasi_proyek_org_nama UNIQUE (org_id, nama_proyek)
);

CREATE INDEX idx_koperasi_proyek_org ON koperasi_proyek(org_id);
CREATE INDEX idx_koperasi_proyek_status ON koperasi_proyek(org_id, status);
CREATE INDEX idx_koperasi_proyek_mudharib ON koperasi_proyek(mudharib_id);

-- 4.2 Investasi (per Shahibul Maal per proyek)
CREATE TABLE IF NOT EXISTS koperasi_proyek_investasi (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyek_id       UUID NOT NULL REFERENCES koperasi_proyek(id) ON DELETE CASCADE,
  shahibul_maal_id UUID NOT NULL REFERENCES koperasi_shahibul_maal(id) ON DELETE CASCADE,
  jumlah_setor    DECIMAL(18,2) NOT NULL,
  porsi_persen    DECIMAL(5,2) NOT NULL,  -- dihitung otomatis: jumlah_setor / total_modal_proyek * 100
  tgl_invest      DATE NOT NULL DEFAULT CURRENT_DATE,
  status          VARCHAR(20) NOT NULL DEFAULT 'AKTIF'
                    CHECK (status IN ('AKTIF','DIKEMBALIKAN')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_koperasi_proyek_investasi UNIQUE (proyek_id, shahibul_maal_id)
);

CREATE INDEX idx_koperasi_proyek_investasi_proyek ON koperasi_proyek_investasi(proyek_id);
CREATE INDEX idx_koperasi_proyek_investasi_sm ON koperasi_proyek_investasi(shahibul_maal_id);

-- 4.3 Pencairan Modal ke Mudharib
CREATE TABLE IF NOT EXISTS koperasi_proyek_pencairan (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyek_id       UUID NOT NULL REFERENCES koperasi_proyek(id) ON DELETE CASCADE,
  jumlah          DECIMAL(18,2) NOT NULL,
  tgl_cair        DATE NOT NULL DEFAULT CURRENT_DATE,
  metode          VARCHAR(50),
  keterangan      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_koperasi_proyek_pencairan ON koperasi_proyek_pencairan(proyek_id);

-- ══════════════════════════════════════════════════════════════
-- 5. AKUNTANSI PROYEK (LAYER 1)
-- ══════════════════════════════════════════════════════════════

-- 5.1 CoA Proyek (per proyek — sederhana ±20-30 akun)
CREATE TABLE IF NOT EXISTS koperasi_proyek_coa (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyek_id       UUID NOT NULL REFERENCES koperasi_proyek(id) ON DELETE CASCADE,
  kode            VARCHAR(20) NOT NULL,
  nama            VARCHAR(255) NOT NULL,
  tipe            VARCHAR(20) NOT NULL CHECK (tipe IN ('ASET','LIABILITAS','EKUITAS','PENDAPATAN','BEBAN')),
  normal_balance  VARCHAR(10) NOT NULL CHECK (normal_balance IN ('DEBIT','KREDIT')),
  is_system       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_koperasi_proyek_coa UNIQUE (proyek_id, kode)
);

CREATE INDEX idx_koperasi_proyek_coa ON koperasi_proyek_coa(proyek_id);

-- 5.2 Jurnal Proyek
CREATE TABLE IF NOT EXISTS koperasi_proyek_jurnal (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyek_id       UUID NOT NULL REFERENCES koperasi_proyek(id) ON DELETE CASCADE,
  tgl_transaksi   DATE NOT NULL DEFAULT CURRENT_DATE,
  tipe            VARCHAR(30) NOT NULL CHECK (tipe IN ('PENDAPATAN','BEBAN_OPERASIONAL','BEBAN_GAJI','BEBAN_LAIN','PENCAIRAN_MODAL','SETOR_HASIL')),
  keterangan      TEXT NOT NULL,
  total_debit     DECIMAL(18,2) NOT NULL DEFAULT 0,
  total_kredit    DECIMAL(18,2) NOT NULL DEFAULT 0,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_proyek_jurnal_balance CHECK (total_debit = total_kredit)
);

CREATE INDEX idx_koperasi_proyek_jurnal ON koperasi_proyek_jurnal(proyek_id, tgl_transaksi);

-- 5.3 Garis Jurnal Proyek
CREATE TABLE IF NOT EXISTS koperasi_proyek_jurnal_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurnal_id       UUID NOT NULL REFERENCES koperasi_proyek_jurnal(id) ON DELETE CASCADE,
  coa_id          UUID NOT NULL REFERENCES koperasi_proyek_coa(id) ON DELETE CASCADE,
  debit           DECIMAL(18,2) NOT NULL DEFAULT 0,
  kredit          DECIMAL(18,2) NOT NULL DEFAULT 0,
  keterangan      TEXT,
  CONSTRAINT ck_proyek_line_side CHECK (
    (debit > 0 AND kredit = 0) OR (kredit > 0 AND debit = 0)
  )
);

CREATE INDEX idx_koperasi_proyek_jurnal_lines ON koperasi_proyek_jurnal_lines(jurnal_id);

-- 5.4 Saldo Akun per Periode (materialized untuk laporan cepat)
CREATE TABLE IF NOT EXISTS koperasi_proyek_saldo (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyek_id       UUID NOT NULL REFERENCES koperasi_proyek(id) ON DELETE CASCADE,
  coa_id          UUID NOT NULL REFERENCES koperasi_proyek_coa(id) ON DELETE CASCADE,
  periode         DATE NOT NULL,
  saldo_debit     DECIMAL(18,2) NOT NULL DEFAULT 0,
  saldo_kredit    DECIMAL(18,2) NOT NULL DEFAULT 0,
  saldo_akhir     DECIMAL(18,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_koperasi_proyek_saldo UNIQUE (proyek_id, coa_id, periode)
);

CREATE INDEX idx_koperasi_proyek_saldo ON koperasi_proyek_saldo(proyek_id, coa_id);

-- ══════════════════════════════════════════════════════════════
-- 6. BAGI HASIL
-- ══════════════════════════════════════════════════════════════

-- 6.1 Periode Bagi Hasil
CREATE TABLE IF NOT EXISTS koperasi_proyek_bagi_hasil (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyek_id       UUID NOT NULL REFERENCES koperasi_proyek(id) ON DELETE CASCADE,
  periode_awal    DATE NOT NULL,
  periode_akhir   DATE NOT NULL,
  total_laba      DECIMAL(18,2) NOT NULL,
  total_distribusi_shahibul_maal DECIMAL(18,2) NOT NULL DEFAULT 0,
  total_distribusi_mudharib      DECIMAL(18,2) NOT NULL DEFAULT 0,
  ujrah_koperasi  DECIMAL(18,2) NOT NULL DEFAULT 0,
  status          VARCHAR(20) NOT NULL DEFAULT 'ESTIMASI'
                    CHECK (status IN ('ESTIMASI','DIKONFIRMASI','DIDISTRIBUSI')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_koperasi_proyek_bagi_hasil ON koperasi_proyek_bagi_hasil(proyek_id);

-- 6.2 Distribusi per Pihak
CREATE TABLE IF NOT EXISTS koperasi_proyek_distribusi (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bagi_hasil_id   UUID NOT NULL REFERENCES koperasi_proyek_bagi_hasil(id) ON DELETE CASCADE,
  pihak_type      VARCHAR(20) NOT NULL CHECK (pihak_type IN ('SHAHIBUL_MAAL','MUDHARIB')),
  pihak_id        UUID NOT NULL,  -- FK ke koperasi_shahibul_maal atau koperasi_mudharib
  porsi_persen    DECIMAL(5,2) NOT NULL,
  nominal         DECIMAL(18,2) NOT NULL,
  status_bayar    VARCHAR(20) NOT NULL DEFAULT 'BELUM_BAYAR'
                    CHECK (status_bayar IN ('BELUM_BAYAR','LUNAS')),
  tgl_bayar       DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_koperasi_proyek_distribusi_bh ON koperasi_proyek_distribusi(bagi_hasil_id);
CREATE INDEX idx_koperasi_proyek_distribusi_pihak ON koperasi_proyek_distribusi(pihak_type, pihak_id);

-- ══════════════════════════════════════════════════════════════
-- 7. OPERASIONAL KOPERASI
-- ══════════════════════════════════════════════════════════════

-- 7.1 Pengurus Koperasi
CREATE TABLE IF NOT EXISTS koperasi_pengurus (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  anggota_id      UUID NOT NULL REFERENCES koperasi_anggota(id) ON DELETE CASCADE,
  jabatan         VARCHAR(50) NOT NULL CHECK (jabatan IN ('KETUA','SEKRETARIS','BENDAHARA','DPS','ADMIN')),
  masa_bakti_awal DATE NOT NULL,
  masa_bakti_akhir DATE,
  is_aktif        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_koperasi_pengurus_jabatan UNIQUE (org_id, jabatan, is_aktif)
);

CREATE INDEX idx_koperasi_pengurus_org ON koperasi_pengurus(org_id);

-- ══════════════════════════════════════════════════════════════
-- 8. FUNGSI-FUNGSI
-- ══════════════════════════════════════════════════════════════

-- 8.1 Generate nomor anggota otomatis
CREATE OR REPLACE FUNCTION koperasi_generate_kode_anggota(p_org_id UUID)
RETURNS VARCHAR(50) LANGUAGE plpgsql AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count FROM koperasi_anggota WHERE org_id = p_org_id;
  RETURN 'KOP-' || LPAD(v_count::TEXT, 4, '0');
END;
$$;

-- 8.2 Generate nomor akad otomatis
CREATE OR REPLACE FUNCTION koperasi_generate_nomor_akad(p_org_id UUID)
RETURNS VARCHAR(100) LANGUAGE plpgsql AS $$
DECLARE
  v_count INT;
  v_tahun VARCHAR(4) := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count FROM koperasi_akad_wakalah WHERE org_id = p_org_id;
  RETURN 'KOP/WKL/' || v_tahun || '/' || LPAD(v_count::TEXT, 4, '0');
END;
$$;

-- 8.3 Update saldo sukarela (Wadiah) — trigger
CREATE OR REPLACE FUNCTION koperasi_update_saldo_sukarela()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_saldo_terakhir DECIMAL(18,2);
BEGIN
  SELECT COALESCE(saldo_setelah, 0) INTO v_saldo_terakhir
  FROM koperasi_simpanan_sukarela
  WHERE anggota_id = NEW.anggota_id AND id != NEW.id
  ORDER BY created_at DESC LIMIT 1;

  IF NEW.jenis = 'SETOR' THEN
    NEW.saldo_setelah := v_saldo_terakhir + NEW.jumlah;
  ELSIF NEW.jenis = 'TARIK' THEN
    NEW.saldo_setelah := v_saldo_terakhir - NEW.jumlah;
  END IF;
  RETURN NEW;
END;
$$;

-- 8.4 Fungsi inject CoA Koperasi
CREATE OR REPLACE FUNCTION inject_koperasi_coa(p_org_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_parent_id UUID;
BEGIN
  -- ASET
  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
  (p_org_id, '11-3000', 'Piutang Murabahah', 'ASSET', 'DEBIT', TRUE)
  RETURNING id INTO v_parent_id;
  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) VALUES
  (p_org_id, '11-3001', 'Piutang Murabahah — Dalam Tagih', 'ASSET', 'DEBIT', v_parent_id, TRUE);

  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
  (p_org_id, '11-4000', 'Piutang Mudharabah', 'ASSET', 'DEBIT', TRUE)
  RETURNING id INTO v_parent_id;
  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) VALUES
  (p_org_id, '11-4001', 'Piutang Mudharabah — Pembiayaan Aktif', 'ASSET', 'DEBIT', v_parent_id, TRUE);

  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
  (p_org_id, '11-5000', 'Barang Dalam Wakalah', 'ASSET', 'DEBIT', TRUE);

  -- LIABILITAS
  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
  (p_org_id, '21-5000', 'Dana Syirkah Temporer', 'LIABILITY', 'CREDIT', TRUE)
  RETURNING id INTO v_parent_id;
  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) VALUES
  (p_org_id, '21-5001', 'DST — Murabahah', 'LIABILITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '21-5002', 'DST — Mudharabah', 'LIABILITY', 'CREDIT', v_parent_id, TRUE);

  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
  (p_org_id, '22-1000', 'Utang Bagi Hasil Belum Dibagikan', 'LIABILITY', 'CREDIT', TRUE),
  (p_org_id, '22-2000', 'Dana Sosial (Ta\'zir & Zakat)', 'LIABILITY', 'CREDIT', TRUE);

  -- EKUITAS
  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
  (p_org_id, '31-1000', 'Simpanan Pokok', 'EQUITY', 'CREDIT', TRUE),
  (p_org_id, '31-2000', 'Simpanan Wajib', 'EQUITY', 'CREDIT', TRUE),
  (p_org_id, '32-1000', 'Cadangan Koperasi', 'EQUITY', 'CREDIT', TRUE),
  (p_org_id, '33-1000', 'SHU Ditahan', 'EQUITY', 'CREDIT', TRUE),
  (p_org_id, '34-1000', 'SHU Tahun Berjalan', 'EQUITY', 'CREDIT', TRUE);

  -- PENDAPATAN
  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
  (p_org_id, '41-6000', 'Pendapatan Ujrah', 'REVENUE', 'CREDIT', TRUE)
  RETURNING id INTO v_parent_id;
  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) VALUES
  (p_org_id, '41-6001', 'Ujrah Wakalah Murabahah', 'REVENUE', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '41-6002', 'Ujrah Wakalah Mudharabah', 'REVENUE', 'CREDIT', v_parent_id, TRUE);

  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
  (p_org_id, '41-7000', 'Pendapatan Administrasi', 'REVENUE', 'CREDIT', TRUE);

  -- BEBAN
  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
  (p_org_id, '61-5000', 'Beban Operasional Koperasi', 'EXPENSE', 'DEBIT', TRUE),
  (p_org_id, '61-6000', 'Beban Sertifikasi DPS', 'EXPENSE', 'DEBIT', TRUE);

  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
  (p_org_id, '81-1000', 'Zakat Usaha', 'EXPENSE', 'DEBIT', TRUE);
END;
$$;
