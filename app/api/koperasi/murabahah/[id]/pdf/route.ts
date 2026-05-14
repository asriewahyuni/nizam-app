import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createAdminClient()

  const { data: t } = await db
    .from('koperasi_murabahah_transaksi')
    .select(`
      *,
      pembeli:koperasi_anggota!inner(nama, nik, alamat, no_telepon, email),
      akad:koperasi_akad_wakalah(nomor_akad, jenis_barang, ujrah_flat, shahibul_maal:koperasi_shahibul_maal(anggota:koperasi_anggota(nama, nik)))
    `)
    .eq('id', id)
    .single()

  if (!t) return new Response('Transaksi tidak ditemukan', { status: 404 })

  const pembeli = (t as any).pembeli || {}
  const akad = (t as any).akad || {}
  const sm = (akad as any).shahibul_maal?.anggota || {}
  const today = new Date(t.tgl_transaksi || t.created_at).toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  const pokok = Number(t.harga_pokok || 0).toLocaleString()
  const margin = Number(t.margin || 0).toLocaleString()
  const jual = Number(t.harga_jual || 0).toLocaleString()
  const angsuran = Number(t.total_angsuran || 0).toLocaleString()
  const sisa = Number(t.sisa_angsuran || 0).toLocaleString()
  const tenor = t.tenor_bulan || '-'

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Akad Murabahah — ${t.nomor_transaksi || 'Tanpa Nomor'}</title>
<style>
  @page { size: A4; margin: 2cm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', Times, serif; color: #1a1a2e; font-size: 12pt; line-height: 1.6; padding: 20px; }
  .no-print { display: block; text-align: center; padding: 12px; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 8px; margin-bottom: 20px; font-size: 11pt; color: #4338ca; }
  @media print { .no-print { display: none; } body { padding: 0; } }
  .header { text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #1a1a2e; }
  .header h1 { font-size: 16pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
  .header h2 { font-size: 13pt; margin-top: 4px; color: #4338ca; }
  .header p { font-size: 10pt; color: #666; margin-top: 4px; }
  .ref { text-align: right; font-size: 10pt; color: #666; margin-bottom: 20px; }
  .section { margin-bottom: 16px; }
  .section h3 { font-size: 12pt; font-weight: bold; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #ccc; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  td, th { padding: 6px 8px; border: 1px solid #ccc; font-size: 11pt; }
  th { background: #f3f4f6; font-weight: 600; text-align: left; }
  .signature { margin-top: 40px; display: flex; justify-content: space-between; }
  .signature div { text-align: center; width: 30%; }
  .signature .line { margin-top: 60px; border-top: 1px solid #1a1a2e; padding-top: 8px; font-size: 10pt; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #ccc; font-size: 9pt; color: #888; text-align: center; }
  .stamp { display: inline-block; border: 2px dashed #4338ca; color: #4338ca; padding: 8px 16px; border-radius: 8px; font-size: 10pt; font-weight: bold; transform: rotate(-5deg); margin-top: 20px; }
</style>
</head>
<body>
<div class="no-print">📄 Dokumen ini siap dicetak. Tekan <strong>Ctrl+P</strong> (Windows) / <strong>Cmd+P</strong> (Mac) untuk mencetak atau simpan sebagai PDF.</div>

<div class="header">
  <h1>AKAD JUAL BELI MURABAHAH</h1>
  <h2>No. ${t.nomor_transaksi || '-'}</h2>
  <p>Koperasi sebagai Wakil Penjual (Wakalah bil Ujrah) & Pembiayaan Murabahah</p>
</div>

<div class="ref">Tanggal: ${today}</div>

<div class="section">
  <h3>PIHAK-PIHAK</h3>
  <table>
    <tr><th style="width:30%">Koperasi (Wakil)</th><td>${process.env.NEXT_PUBLIC_APP_NAME || 'Koperasi Nizam'}</td></tr>
    <tr><th>Shahibul Maal (Pemilik Barang)</th><td>${sm.nama || '-'}<br/>NIK: ${sm.nik || '-'}</td></tr>
    <tr><th>Pembeli</th><td>${pembeli.nama || '-'}<br/>NIK: ${pembeli.nik || '-'}<br/>Alamat: ${pembeli.alamat || '-'}<br/>Telp: ${pembeli.no_telepon || '-'}</td></tr>
  </table>
</div>

<div class="section">
  <h3>OBJEK AKAD</h3>
  <table>
    <tr><th style="width:30%">Nama Barang</th><td>${t.nama_barang || '-'}</td></tr>
    <tr><th>Akad Wakalah Terkait</th><td>${akad.nomor_akad || '-'} (${akad.jenis_barang || '-'})</td></tr>
  </table>
</div>

<div class="section">
  <h3>HARGA & PEMBAYARAN</h3>
  <table>
    <tr><th style="width:30%">Harga Pokok (Modal)</th><td>Rp ${pokok}</td></tr>
    <tr><th>Margin Murabahah</th><td>Rp ${margin}</td></tr>
    <tr><th><strong>Harga Jual</strong></th><td><strong>Rp ${jual}</strong></td></tr>
    <tr><th>Tenor</th><td>${tenor} bulan</td></tr>
    <tr><th>Total Angsuran Dibayar</th><td>Rp ${angsuran}</td></tr>
    <tr><th>Sisa Angsuran</th><td>Rp ${sisa}</td></tr>
    <tr><th>Status</th><td>${t.status || '-'}</td></tr>
  </table>
</div>

<div class="section">
  <h3>KETENTUAN</h3>
  <ol style="margin-left:20px; font-size:11pt;">
    <li>Pembeli menyatakan telah mengetahui spesifikasi dan kondisi barang yang dibeli.</li>
    <li>Pembeli setuju membayar harga jual secara angsuran sesuai tenor yang disepakati.</li>
    <li>Keterlambatan pembayaran angsuran dikenakan denda sesuai ketentuan koperasi.</li>
    <li>Barang menjadi jaminan hingga seluruh angsuran lunas.</li>
    <li>Akad ini tunduk kepada prinsip syariah dan peraturan perundang-undangan yang berlaku.</li>
  </ol>
</div>

<div class="signature">
  <div>Pembeli,<div class="line">(${pembeli.nama || '_______________'})</div></div>
  <div>Shahibul Maal,<div class="line">(${sm.nama || '_______________'})</div></div>
  <div>Ketua Koperasi,<div class="line">(_______________)</div></div>
</div>

<div style="text-align:center; margin-top:20px;">
  <div class="stamp">DOKUMEN RESMI KOPERASI</div>
</div>

<div class="footer">
  Dokumen ini dicetak dari sistem Nizam App pada ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}.<br/>
  Dokumen sah tanpa tanda tangan basah dan materai sebagaimana ketentuan UU ITE.
</div>
</body>
</html>`

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
}
