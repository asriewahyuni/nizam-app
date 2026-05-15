import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { queryPostgres } from '@/lib/db/postgres'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const SQL = `
CREATE TABLE IF NOT EXISTS koperasi_anggota (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kode_anggota VARCHAR(50) NOT NULL,
  nama VARCHAR(255) NOT NULL,
  nik VARCHAR(50), alamat TEXT, no_telepon VARCHAR(30), email VARCHAR(255),
  tanggal_daftar DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'AKTIF',
  is_tersertifikasi_dps BOOLEAN NOT NULL DEFAULT FALSE,
  simpanan_pokok DECIMAL(18,2) NOT NULL DEFAULT 0,
  simpanan_wajib_setoran DECIMAL(18,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_koperasi_anggota_org ON koperasi_anggota(org_id);
CREATE INDEX IF NOT EXISTS idx_koperasi_anggota_status ON koperasi_anggota(org_id, status);
CREATE TABLE IF NOT EXISTS koperasi_simpanan_pokok (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, anggota_id UUID NOT NULL REFERENCES koperasi_anggota(id) ON DELETE CASCADE, jumlah DECIMAL(18,2) NOT NULL DEFAULT 0, tgl_bayar DATE NOT NULL DEFAULT CURRENT_DATE, metode VARCHAR(50) DEFAULT 'TUNAI', keterangan TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS koperasi_simpanan_wajib (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, anggota_id UUID NOT NULL REFERENCES koperasi_anggota(id) ON DELETE CASCADE, jumlah DECIMAL(18,2) NOT NULL DEFAULT 0, tgl_bayar DATE NOT NULL DEFAULT CURRENT_DATE, metode VARCHAR(50) DEFAULT 'TUNAI', bulan VARCHAR(7) NOT NULL, keterangan TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS koperasi_simpanan_sukarela (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, anggota_id UUID NOT NULL REFERENCES koperasi_anggota(id) ON DELETE CASCADE, jenis VARCHAR(10) NOT NULL DEFAULT 'SETORAN', jumlah DECIMAL(18,2) NOT NULL DEFAULT 0, tgl_transaksi DATE NOT NULL DEFAULT CURRENT_DATE, metode VARCHAR(50) DEFAULT 'TUNAI', keterangan TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS koperasi_shahibul_maal (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, anggota_id UUID NOT NULL REFERENCES koperasi_anggota(id) ON DELETE CASCADE, total_investasi DECIMAL(18,2) NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(org_id, anggota_id));
CREATE TABLE IF NOT EXISTS koperasi_mudharib (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, anggota_id UUID NOT NULL REFERENCES koperasi_anggota(id) ON DELETE CASCADE, keahlian TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(org_id, anggota_id));
CREATE TABLE IF NOT EXISTS koperasi_sertifikasi_dps (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, entity_type VARCHAR(20) NOT NULL, entity_id UUID NOT NULL, no_sertifikat VARCHAR(100) NOT NULL, tgl_terbit DATE NOT NULL, tgl_expired DATE NOT NULL, level VARCHAR(50) DEFAULT 'DASAR', penerbit VARCHAR(255) DEFAULT 'CORE iSEC', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS koperasi_pengurus (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, anggota_id UUID NOT NULL REFERENCES koperasi_anggota(id) ON DELETE CASCADE, jabatan VARCHAR(100) NOT NULL, tgl_menjabat DATE NOT NULL DEFAULT CURRENT_DATE, tgl_berakhir DATE, status VARCHAR(20) NOT NULL DEFAULT 'AKTIF', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(org_id, anggota_id, jabatan));
CREATE TABLE IF NOT EXISTS koperasi_akad_wakalah (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, nomor_akad VARCHAR(100) NOT NULL, shahibul_maal_id UUID NOT NULL REFERENCES koperasi_shahibul_maal(id) ON DELETE CASCADE, jenis_barang VARCHAR(255) NOT NULL, harga_barang DECIMAL(18,2) NOT NULL, ujrah_flat DECIMAL(5,4) NOT NULL DEFAULT 0.02, total_ujrah DECIMAL(18,2) NOT NULL, total_pembayaran DECIMAL(18,2) NOT NULL, jangka_wakalah INT NOT NULL DEFAULT 1, status VARCHAR(20) NOT NULL DEFAULT 'AKTIF', tgl_akad DATE NOT NULL DEFAULT CURRENT_DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(org_id, nomor_akad));
CREATE TABLE IF NOT EXISTS koperasi_murabahah_transaksi (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, akad_id UUID NOT NULL REFERENCES koperasi_akad_wakalah(id) ON DELETE CASCADE, pembeli_id UUID NOT NULL REFERENCES koperasi_anggota(id) ON DELETE CASCADE, harga_jual DECIMAL(18,2) NOT NULL, uang_muka DECIMAL(18,2) NOT NULL DEFAULT 0, sisa_angsuran DECIMAL(18,2) NOT NULL DEFAULT 0, jumlah_angsuran INT NOT NULL DEFAULT 1, angsuran_ke INT NOT NULL DEFAULT 0, status VARCHAR(20) NOT NULL DEFAULT 'AKTIF', tgl_transaksi DATE NOT NULL DEFAULT CURRENT_DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS koperasi_proyek (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, nama VARCHAR(255) NOT NULL, deskripsi TEXT, modal_dibutuhkan DECIMAL(18,2) NOT NULL DEFAULT 0, modal_terkumpul DECIMAL(18,2) NOT NULL DEFAULT 0, nisbah_mudharib DECIMAL(5,4) NOT NULL DEFAULT 0.50, durasi_bulan INT NOT NULL DEFAULT 1, tgl_mulai DATE, tgl_selesai DATE, status VARCHAR(20) NOT NULL DEFAULT 'DIAJUKAN', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_koperasi_proyek_org ON koperasi_proyek(org_id);
CREATE TABLE IF NOT EXISTS koperasi_investasi_proyek (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), proyek_id UUID NOT NULL REFERENCES koperasi_proyek(id) ON DELETE CASCADE, shahibul_maal_id UUID NOT NULL REFERENCES koperasi_shahibul_maal(id) ON DELETE CASCADE, jumlah DECIMAL(18,2) NOT NULL, tgl_investasi DATE NOT NULL DEFAULT CURRENT_DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(proyek_id, shahibul_maal_id));
CREATE TABLE IF NOT EXISTS koperasi_bagi_hasil (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, proyek_id UUID NOT NULL REFERENCES koperasi_proyek(id) ON DELETE CASCADE, periode VARCHAR(7) NOT NULL, tgl_hitung DATE NOT NULL DEFAULT CURRENT_DATE, total_laba DECIMAL(18,2) NOT NULL DEFAULT 0, bagian_mudharib DECIMAL(18,2) NOT NULL DEFAULT 0, bagian_shahibul_maal DECIMAL(18,2) NOT NULL DEFAULT 0, status_distribusi VARCHAR(20) NOT NULL DEFAULT 'BELUM', distributed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS koperasi_shu (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, tahun INT NOT NULL, total_shu DECIMAL(18,2) NOT NULL DEFAULT 0, cadangan DECIMAL(18,2) NOT NULL DEFAULT 0, anggota DECIMAL(18,2) NOT NULL DEFAULT 0, pengurus DECIMAL(18,2) NOT NULL DEFAULT 0, dana_sosial DECIMAL(18,2) NOT NULL DEFAULT 0, pendidikan DECIMAL(18,2) NOT NULL DEFAULT 0, tgl_hitung DATE NOT NULL DEFAULT CURRENT_DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(org_id, tahun));
CREATE OR REPLACE FUNCTION koperasi_generate_kode_anggota(p_org_id UUID) RETURNS VARCHAR(50) AS $$ DECLARE v_count INT; v_kode VARCHAR(50); BEGIN SELECT COUNT(*) + 1 INTO v_count FROM koperasi_anggota WHERE org_id = p_org_id; v_kode := 'KOP-' || TO_CHAR(NOW(), 'YYMM') || '-' || LPAD(v_count::TEXT, 4, '0'); RETURN v_kode; END; $$ LANGUAGE plpgsql;
`

export async function GET() {
  try {
    // Check auth via session cookie
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('nizam_internal_session')
    if (!sessionCookie?.value) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Check if tables exist
    const check: any = await queryPostgres(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'koperasi_anggota') as "exists"`
    )
    if (check?.[0]?.exists) {
      return NextResponse.json({ message: 'Tables already exist ✓' })
    }

    // Run migration
    const stmts = SQL.split(';').map(s => s.trim()).filter(s => s.length > 0)
    let ok = 0, fail = 0, errors: string[] = []
    for (const stmt of stmts) {
      try {
        await queryPostgres(stmt + ';')
        ok++
      } catch (e: any) {
        fail++
        errors.push(e?.message?.slice(0, 100) || 'unknown')
      }
    }

    return NextResponse.json({
      message: `Migration done: ${ok} ok, ${fail} failed`,
      errors: fail > 0 ? errors.slice(0, 3) : [],
    })
  } catch (err: any) {
    console.error('Migration error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
