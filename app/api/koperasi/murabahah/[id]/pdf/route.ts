import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createAdminClient()
  
  const { data: trx } = await db
    .from('koperasi_murabahah_transaksi')
    .select(`
      *,
      pembeli:koperasi_anggota(nama, nik, alamat, no_telepon, email),
      akad_wakalah:koperasi_akad_wakalah(
        nomor_akad, jenis_barang, ujrah_flat,
        shahibul_maal:koperasi_shahibul_maal(anggota:koperasi_anggota(nama, nik, alamat))
      )
    `)
    .eq('id', id)
    .single()
  
  if (!trx) return new Response('Transaksi tidak ditemukan', { status: 404 })
  
  const p = (trx as any).pembeli || {}
  const akad = (trx as any).akad_wakalah || {}
  const sm = akad.shahibul_maal?.anggota || {}
  const today = new Date(trx.created_at).toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })
  const angsuranBln = Math.ceil(Number(trx.harga_jual) / Number(trx.tenor_bulan))
  
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Akad Murabahah — ${trx.nomor_transaksi}</title>
<style>
  @page { margin: 2cm 2.5cm; size: A4; }
  * { box-sizing: border-box; }
  body { font-family: 'Times New Roman', Times, serif; color: #1a1a1a; line-height: 1.8; padding: 20px; }
  .header { text-align: center; margin-bottom: 30px; }
  .header h1 { font-size: 18pt; margin: 0 0 5px; text-transform: uppercase; text-decoration: underline; }
  .header .nomor { font-size: 12pt; margin-top: 10px; font-weight: bold; }
  .bismillah { text-align: center; font-size: 20pt; margin: 30px 0; }
  .preamble { text-align: justify; margin-bottom: 20px; font-size: 11pt; }
  .section { margin-bottom: 15px; }
  .section h3 { font-size: 12pt; margin: 15px 0 8px; border-bottom: 1px solid #333; padding-bottom: 3px; }
  .section table { width: 100%; border-collapse: collapse; margin: 5px 0; }
  .section td { padding: 4px 8px; font-size: 11pt; vertical-align: top; }
  .section td.label { width: 200px; font-weight: bold; }
  .clause { margin: 8px 0; text-align: justify; font-size: 11pt; page-break-inside: avoid; }
  .clause .number { display: inline-block; width: 80px; font-weight: bold; }
  .signatures { margin-top: 60px; display: flex; justify-content: space-between; }
  .signature-box { text-align: center; width: 45%; }
  .signature-box .label { font-weight: bold; margin-bottom: 5px; }
  .signature-box .line { margin-top: 60px; border-top: 1px solid #333; padding-top: 5px; }
  .footer { margin-top: 40px; text-align: center; font-size: 9pt; color: #666; border-top: 1px solid #ccc; padding-top: 10px; }
  .no-print { margin-bottom: 20px; text-align: center; }
  @media print { .no-print { display: none; } }
  table.angsuran { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10pt; }
  table.angsuran th { background: #eee; padding: 6px 8px; text-align: center; border: 1px solid #999; }
  table.angsuran td { padding: 4px 8px; text-align: center; border: 1px solid #ccc; }
</style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()" style="padding:10px 30px;font-size:14px;cursor:pointer;background:#059669;color:white;border:none;border-radius:8px;">📄 Cetak / Simpan PDF</button>
    <button onclick="window.close()" style="padding:10px 30px;font-size:14px;cursor:pointer;background:#6b7280;color:white;border:none;border-radius:8px;margin-left:10px;">✕ Tutup</button>
  </div>

  <div class="header">
    <h1>AKAD MURABAHAH</h1>
    <h2 style="font-size:14pt;margin:0;">Perjanjian Jual Beli dengan Margin</h2>
    <div class="nomor">Nomor: ${trx.nomor_transaksi}</div>
  </div>

  <div class="bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>

  <div class="preamble">
    Pada hari ini, ${today}, bertempat di Kantor Koperasi Syariah, telah terjadi akad jual beli (Murabahah) antara:
  </div>

  <div class="section">
    <h3>I. IDENTITAS SHAHIBUL MAAL (PEMILIK BARANG)</h3>
    <table>
      <tr><td class="label">Nama Lengkap</td><td>: ${sm.nama || '-'}</td></tr>
      <tr><td class="label">NIK</td><td>: ${sm.nik || '-'}</td></tr>
      <tr><td class="label">Alamat</td><td>: ${sm.alamat || '-'}</td></tr>
    </table>
  </div>

  <div class="section">
    <h3>II. IDENTITAS PEMBELI</h3>
    <table>
      <tr><td class="label">Nama Lengkap</td><td>: ${p.nama || '-'}</td></tr>
      <tr><td class="label">NIK</td><td>: ${p.nik || '-'}</td></tr>
      <tr><td class="label">Alamat</td><td>: ${p.alamat || '-'}</td></tr>
    </table>
  </div>

  <div class="section">
    <h3>III. IDENTITAS KOPERASI (WAKIL)</h3>
    <table>
      <tr><td class="label">Nama Lembaga</td><td>: Koperasi Syariah Nizam</td></tr>
    </table>
  </div>

  <div class="section">
    <h3>IV. OBJEK AKAD</h3>
    <table>
      <tr><td class="label">Nama Barang</td><td>: ${trx.nama_barang}</td></tr>
      <tr><td class="label">Harga Pokok</td><td>: Rp ${Number(trx.harga_pokok).toLocaleString()}</td></tr>
      <tr><td class="label">Margin (Keuntungan)</td><td>: Rp ${Number(trx.margin).toLocaleString()}</td></tr>
      <tr><td class="label">Harga Jual</td><td>: Rp ${Number(trx.harga_jual).toLocaleString()}</td></tr>
      <tr><td class="label">Tenor</td><td>: ${trx.tenor_bulan} bulan</td></tr>
      <tr><td class="label">Angsuran per Bulan</td><td>: Rp ${angsuranBln.toLocaleString()}</td></tr>
      <tr><td class="label">Akad Wakalah Terkait</td><td>: ${akad.nomor_akad || '-'}</td></tr>
    </table>
  </div>

  <div class="section">
    <h3>V. KEYAKINAN &amp; KLAUSULA</h3>

    <div class="clause"><span class="number">Pasal 1</span> — Koperasi bertindak sebagai Wakil dari Shahibul Maal dan Koperasi telah membeli barang dari Shahibul Maal untuk kemudian dijual kepada Pembeli dengan harga dan margin yang telah disepakati bersama.</div>

    <div class="clause"><span class="number">Pasal 2</span> — Harga jual sebagaimana disebutkan dalam Pasal IV adalah harga tetap (fixed) yang tidak dapat berubah selama masa angsuran, kecuali terjadi perubahan yang disepakati kedua belah pihak.</div>

    <div class="clause"><span class="number">Pasal 3</span> — Pembeli setuju untuk membayar angsuran setiap bulan sebesar Rp ${angsuranBln.toLocaleString()} selama ${trx.tenor_bulan} bulan, dengan total pembayaran sebesar Rp ${Number(trx.harga_jual).toLocaleString()}.</div>

    <div class="clause"><span class="number">Pasal 4</span> — Apabila Pembeli terlambat melakukan pembayaran angsuran, Pembeli dikenakan denda (Ta'zir) sesuai dengan ketentuan yang berlaku di Koperasi Syariah.</div>

    <div class="clause"><span class="number">Pasal 5</span> — Barang yang menjadi objek akad ini sepenuhnya menjadi milik Pembeli setelah seluruh angsuran dilunasi.</div>

    <div class="clause"><span class="number">Pasal 6</span> — Apabila terjadi wanprestasi, penyelesaian dilakukan secara musyawarah, dan apabila tidak tercapai kesepakatan, diselesaikan melalui Badan Arbitrase Syariah.</div>
  </div>

  <div class="signatures">
    <div class="signature-box">
      <div class="label">Pembeli,</div>
      <div class="line">${p.nama || '(...................)'}</div>
    </div>
    <div class="signature-box">
      <div class="label">Koperasi (Wakil),</div>
      <div class="line">(...................)</div>
    </div>
  </div>

  <div class="signatures" style="margin-top:20px;">
    <div class="signature-box">
      <div class="label">Saksi 1,</div>
      <div class="line">(...................)</div>
    </div>
    <div class="signature-box">
      <div class="label">Saksi 2,</div>
      <div class="line">(...................)</div>
    </div>
  </div>

  <div class="footer">
    <p>Dokumen ini diterbitkan secara digital oleh Sistem Koperasi Syariah Nizam</p>
    <p>Nomor Transaksi: ${trx.nomor_transaksi} | Tanggal Cetak: ${new Date().toLocaleDateString('id-ID', {year:'numeric',month:'long',day:'numeric'})}</p>
  </div>
</body>
</html>`
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
