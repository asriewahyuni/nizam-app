import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createAdminClient()
  
  const { data: akad } = await db
    .from('koperasi_akad_wakalah')
    .select(`
      *,
      shahibul_maal:koperasi_shahibul_maal(
        id,
        anggota:koperasi_anggota(nama, nik, alamat, no_telepon, email)
      )
    `)
    .eq('id', id)
    .single()
  
  if (!akad) {
    return new Response('Akad tidak ditemukan', { status: 404 })
  }
  
  const sm = (akad as any).shahibul_maal?.anggota || {}
  const today = new Date(akad.tgl_akad).toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })
  
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Akad Wakalah bil Ujrah — ${akad.nomor_akad}</title>
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
  .section td.label { width: 180px; font-weight: bold; }
  .clause { margin: 8px 0; text-align: justify; font-size: 11pt; page-break-inside: avoid; }
  .clause .number { display: inline-block; width: 80px; font-weight: bold; }
  .signatures { margin-top: 60px; display: flex; justify-content: space-between; }
  .signature-box { text-align: center; width: 45%; }
  .signature-box .label { font-weight: bold; margin-bottom: 5px; }
  .signature-box .line { margin-top: 60px; border-top: 1px solid #333; padding-top: 5px; }
  .footer { margin-top: 40px; text-align: center; font-size: 9pt; color: #666; border-top: 1px solid #ccc; padding-top: 10px; }
  .no-print { margin-bottom: 20px; text-align: center; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()" style="padding:10px 30px;font-size:14px;cursor:pointer;background:#059669;color:white;border:none;border-radius:8px;">📄 Cetak / Simpan PDF</button>
    <button onclick="window.close()" style="padding:10px 30px;font-size:14px;cursor:pointer;background:#6b7280;color:white;border:none;border-radius:8px;margin-left:10px;">✕ Tutup</button>
  </div>

  <div class="header">
    <h1>AKAD WAKALAH BIL UJRAH</h1>
    <h2 style="font-size:14pt;margin:0;">Perjanjian Perwakilan Jual Beli</h2>
    <div class="nomor">Nomor: ${akad.nomor_akad}</div>
  </div>

  <div class="bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>

  <div class="preamble">
    Pada hari ini, ${today}, bertempat di Kantor Koperasi Syariah, yang bertanda tangan di bawah ini:
  </div>

  <div class="section">
    <h3>I. IDENTITAS SHAHIBUL MAAL (PEMBERI WAKALAH)</h3>
    <table>
      <tr><td class="label">Nama Lengkap</td><td>: ${sm.nama || '-'}</td></tr>
      <tr><td class="label">NIK</td><td>: ${sm.nik || '-'}</td></tr>
      <tr><td class="label">Alamat</td><td>: ${sm.alamat || '-'}</td></tr>
      <tr><td class="label">No. Telepon</td><td>: ${sm.no_telepon || '-'}</td></tr>
      <tr><td class="label">Email</td><td>: ${sm.email || '-'}</td></tr>
    </table>
  </div>

  <div class="section">
    <h3>II. IDENTITAS KOPERASI (WAKIL)</h3>
    <table>
      <tr><td class="label">Nama Lembaga</td><td>: Koperasi Syariah Nizam</td></tr>
      <tr><td class="label">Kedudukan</td><td>: Berkedudukan hukum di Indonesia</td></tr>
    </table>
  </div>

  <div class="section">
    <h3>III. OBJEK WAKALAH</h3>
    <table>
      <tr><td class="label">Jenis Barang</td><td>: ${akad.jenis_barang}</td></tr>
      <tr><td class="label">Ujrah (Fee Wakalah)</td><td>: Rp ${Number(akad.ujrah_flat).toLocaleString()} (flat)</td></tr>
      <tr><td class="label">Tanggal Akad</td><td>: ${today}</td></tr>
      <tr><td class="label">Status Akad</td><td>: ${akad.status}</td></tr>
    </table>
  </div>

  <div class="section">
    <h3>IV. KETENTUAN &amp; KLAUSULA</h3>
    
    <div class="clause"><span class="number">Pasal 1</span> — Pihak Pertama (Shahibul Maal) dengan ini memberikan kuasa kepada Pihak Kedua (Koperasi) untuk melakukan penjualan barang sebagaimana disebutkan dalam Pasal III, sesuai dengan spesifikasi dan harga yang telah disepakati bersama.</div>
    
    <div class="clause"><span class="number">Pasal 2</span> — Pihak Kedua bertindak sebagai Wakil (Agen) yang mewakili Pihak Pertama dalam transaksi jual beli. Kepemilikan barang tetap berada pada Pihak Pertama sampai dengan terjadinya akad jual beli antara Pihak Pertama dengan pembeli yang diperkenalkan oleh Pihak Kedua.</div>
    
    <div class="clause"><span class="number">Pasal 3</span> — Atas jasa perwakilan yang dilakukan, Pihak Kedua berhak menerima Ujrah (imbalan jasa) sebesar Rp ${Number(akad.ujrah_flat).toLocaleString()} (flat) yang bersifat tetap dan tidak tergantung pada harga jual barang.</div>
    
    <div class="clause"><span class="number">Pasal 4</span> — Pembayaran Ujrah dilakukan oleh Pihak Pertama kepada Pihak Kedua setelah terjadinya akad jual beli dengan pembeli dan dana hasil penjualan diterima oleh Pihak Pertama.</div>
    
    <div class="clause"><span class="number">Pasal 5</span> — Apabila dalam jangka waktu 30 (tiga puluh) hari sejak akad ini ditandatangani barang belum terjual, Pihak Pertama berhak untuk: (a) menarik kembali barang, atau (b) memperpanjang masa perwakilan dengan kesepakatan baru antara kedua belah pihak.</div>
    
    <div class="clause"><span class="number">Pasal 6</span> — Pihak Kedua bertanggung jawab atas keamanan dan pemeliharaan barang selama dalam penguasaannya, dan wajib mengembalikan barang dalam kondisi baik apabila tidak terjual dalam jangka waktu yang disepakati.</div>
    
    <div class="clause"><span class="number">Pasal 7</span> — Apabila terjadi kerusakan atau kehilangan barang selama dalam penguasaan Pihak Kedua yang disebabkan oleh kelalaian, Pihak Kedua wajib mengganti barang tersebut sesuai dengan nilai yang disepakati.</div>
    
    <div class="clause"><span class="number">Pasal 8</span> — Segala perselisihan yang timbul dari akad ini akan diselesaikan secara musyawarah untuk mufakat. Apabila tidak tercapai kesepakatan, penyelesaian dilakukan melalui Badan Arbitrase Syariah sesuai dengan peraturan perundang-undangan yang berlaku.</div>
    
    <div class="clause"><span class="number">Pasal 9</span> — Akad ini dibuat dalam rangkap 2 (dua) yang masing-masing mempunyai kekuatan hukum yang sama dan ditandatangani oleh kedua belah pihak dengan penuh kesadaran tanpa adanya paksaan dari pihak manapun.</div>
  </div>

  <div class="signatures">
    <div class="signature-box">
      <div class="label">Shahibul Maal,</div>
      <div class="line">${sm.nama || '(...................)'}</div>
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
    <p>Nomor Akad: ${akad.nomor_akad} | Tanggal Cetak: ${new Date().toLocaleDateString('id-ID', {year:'numeric',month:'long',day:'numeric'})}</p>
  </div>
</body>
</html>`
  
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
