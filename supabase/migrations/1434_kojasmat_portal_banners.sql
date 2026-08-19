-- Banner promosi di beranda portal anggota Kojasmat (mis. info proyek yang
-- sedang funding, pengumuman, atau nantinya artikel — link_type=URL dipakai
-- sebagai placeholder umum untuk tujuan link apa pun yang belum punya
-- halaman detail sendiri di sistem, termasuk artikel yang belum ada modulnya).

CREATE TABLE IF NOT EXISTS kojasmat_portal_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  judul text NOT NULL,
  subjudul text,
  gambar_url text,
  warna_mulai text NOT NULL DEFAULT '#0f766e',
  warna_akhir text NOT NULL DEFAULT '#164e63',
  link_type text NOT NULL DEFAULT 'NONE' CHECK (link_type IN ('NONE', 'PROYEK', 'URL')),
  proyek_id uuid REFERENCES kojasmat_proyek(id) ON DELETE SET NULL,
  url text,
  urutan integer NOT NULL DEFAULT 0,
  aktif boolean NOT NULL DEFAULT true,
  tanggal_mulai date,
  tanggal_selesai date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_kojasmat_portal_banners_org_aktif
  ON kojasmat_portal_banners(org_id, aktif, urutan);
