export function printSticker(shipment: any) {
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Cetak Resi ${shipment.tracking_number}</title>
      <style>
        /* Menggunakan font sistem monospace untuk kesan struk thermal asli */
        body { 
          font-family: 'Courier New', Courier, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; 
          margin: 0; 
          padding: 0; 
          color: #000;
          text-transform: uppercase;
        }
        .sticker { 
          width: 80mm; /* Standar ukuran kertas thermal POS 80mm */
          min-height: 100mm; 
          padding: 10px; 
          box-sizing: border-box;
          margin: 0 auto;
          line-height: 1.4;
          page-break-after: always;
        }
        .sticker:last-child {
          page-break-after: auto;
        }
        .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 15px; margin-bottom: 15px; }
        .header h1 { margin: 0; font-size: 22px; letter-spacing: 1px; font-weight: 900; }
        .header p { margin: 5px 0 0 0; font-size: 11px; font-weight: bold; }
        
        .row { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .col { width: 48%; }
        .col-full { width: 100%; margin-bottom: 8px; }
        
        .label { font-size: 10px; color: #000; font-weight: bold; border-bottom: 1px solid #000; display: inline-block; margin-bottom: 3px; }
        .value { font-size: 13px; font-weight: bold; }
        
        .large-value { font-size: 16px; font-weight: 900; }
        
        .barcode-box { text-align: center; padding: 15px 0; border-bottom: 2px dashed #000; margin-bottom: 15px; }
        /* Trick untuk membuat teks seperti barcode jika font barcode tidak ada */
        .barcode { font-family: 'Libre Barcode 39', 'Courier New', monospace; font-size: 24px; letter-spacing: 2px; }
        .tracking-number { font-size: 14px; font-weight: bold; margin-top: 5px; }
        
        .divider { border-bottom: 2px dashed #000; margin: 15px 0; }
        
        .footer { text-align: center; margin-top: 20px; font-size: 10px; font-weight: bold; border-top: 2px dashed #000; padding-top: 15px; }
        .status-badge { 
          display: inline-block; 
          padding: 4px 8px; 
          border: 2px solid #000; 
          font-weight: 900;
          font-size: 16px;
        }
        .koli-badge {
          display: inline-block;
          padding: 4px 8px;
          background: #000;
          color: #fff;
          font-weight: 900;
          font-size: 14px;
          margin-bottom: 10px;
        }
        
        @media print {
          body { padding: 0; }
          .sticker { width: 100%; padding: 0; }
          @page { margin: 0; size: 80mm auto; }
        }
      </style>
      <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+39&display=swap" rel="stylesheet">
    </head>
    <body>
      ${Array.from({ length: shipment.koli_count || 1 }).map((_, index) => `
        <div class="sticker">
          <div class="header">
            <h1>NIZAM KARGO</h1>
            <p>LAYANAN PAKET BUS KILAT</p>
          </div>
          
          <div style="text-align: center;">
             <div class="koli-badge">KOLI: ${index + 1} / ${shipment.koli_count || 1}</div>
          </div>

          <div class="barcode-box">
            <div class="barcode">*${shipment.tracking_number}*</div>
            <div class="tracking-number">${shipment.tracking_number}</div>
          </div>
          
          <div class="row">
            <div class="col">
              <div class="label">ASAL</div>
              <div class="value large-value">${shipment.origin?.location_name || shipment.origin?.name || '-'}</div>
            </div>
            <div class="col" style="text-align: right;">
              <div class="label">TUJUAN</div>
              <div class="value large-value">${shipment.destination?.location_name || shipment.destination?.name || '-'}</div>
            </div>
          </div>

          <div class="divider"></div>

          <div class="col-full">
            <div class="label">PENGIRIM</div>
            <div class="value">${shipment.sender_name}</div>
            <div class="value" style="font-size: 11px;">${shipment.sender_phone}</div>
          </div>

          <div class="col-full">
            <div class="label">PENERIMA</div>
            <div class="value">${shipment.receiver_name}</div>
            <div class="value" style="font-size: 11px;">${shipment.receiver_phone}</div>
          </div>

          <div class="divider"></div>

          <div class="col-full">
            <div class="label">DESKRIPSI PAKET</div>
            <div class="value">${shipment.item_description || '-'}</div>
          </div>

          <div class="row">
            <div class="col">
              <div class="label">BERAT</div>
              <div class="value">${shipment.weight_kg} KG</div>
            </div>
            <div class="col" style="text-align: right;">
              <div class="label">VOLUME</div>
              <div class="value">${shipment.volume_m3} M3</div>
            </div>
          </div>

          <div class="divider"></div>

          <div class="row" style="align-items: center;">
            <div class="col">
              <div class="label">TOTAL BIAYA</div>
              <div class="value large-value">RP ${Number(shipment.grand_total).toLocaleString('id-ID')}</div>
            </div>
            <div class="col" style="text-align: right;">
              <div class="status-badge">
                ${shipment.payment_status === 'PAID' ? 'LUNAS' : 'BAYAR TUJUAN'}
              </div>
            </div>
          </div>
          
          <div class="footer">
            TGL: ${new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}<br>
            SIMPAN RESI INI<br>SEBAGAI BUKTI PENGIRIMAN
          </div>
        </div>
      `).join('')}
      
      <script>
        window.onload = function() {
          // Tunggu sebentar agar font barcode termuat
          setTimeout(function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          }, 500);
        }
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

export function printManifest(schedule: any, shipments: any[]) {
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Surat Jalan Manifest - ${schedule.id}</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          margin: 0; 
          padding: 20px; 
          color: #000;
        }
        .container { 
          width: 100%; 
          max-width: 210mm; 
          margin: 0 auto;
        }
        .header { 
          text-align: center; 
          border-bottom: 2px solid #000; 
          padding-bottom: 10px; 
          margin-bottom: 20px; 
        }
        .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; }
        .header p { margin: 5px 0 0 0; font-size: 14px; }
        
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
          font-size: 14px;
        }
        .info-item { margin-bottom: 5px; }
        .info-label { font-weight: bold; width: 120px; display: inline-block; }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
          font-size: 12px;
        }
        th, td {
          border: 1px solid #000;
          padding: 8px;
          text-align: left;
        }
        th {
          background-color: #f0f0f0;
          font-weight: bold;
          text-transform: uppercase;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        
        .signatures {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          margin-top: 50px;
          text-align: center;
        }
        .sig-box { margin-top: 80px; border-top: 1px solid #000; display: inline-block; width: 150px; padding-top: 5px; }
        
        @media print {
          body { padding: 0; }
          @page { margin: 10mm; size: A4 portrait; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>NIZAM KARGO - SURAT JALAN / MANIFEST</h1>
          <p>Daftar Muatan Kargo Armada Bus</p>
        </div>
        
        <div class="info-grid">
          <div>
            <div class="info-item"><span class="info-label">Tanggal/Jam</span>: ${new Date(schedule.departure_time).toLocaleString('id-ID')}</div>
            <div class="info-item"><span class="info-label">Rute</span>: ${schedule.route_id || '-'}</div>
          </div>
          <div>
            <div class="info-item"><span class="info-label">Total Paket</span>: ${shipments.length} Resi</div>
            <div class="info-item"><span class="info-label">Dicetak Pada</span>: ${new Date().toLocaleString('id-ID')}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th width="5%" class="text-center">NO</th>
              <th width="20%">NO. RESI</th>
              <th width="20%">PENGIRIM</th>
              <th width="20%">PENERIMA (TUJUAN)</th>
              <th width="15%">ISI PAKET</th>
              <th width="10%" class="text-center">BERAT</th>
              <th width="10%" class="text-center">KET</th>
            </tr>
          </thead>
          <tbody>
            ${shipments.map((s, index) => `
              <tr>
                <td class="text-center">${index + 1}</td>
                <td style="font-family: monospace; font-weight: bold;">${s.tracking_number}</td>
                <td>${s.sender_name}<br><span style="font-size:10px">${s.sender_phone}</span></td>
                <td>${s.receiver_name}<br><span style="font-size:10px">${s.destination?.location_name || '-'}</span></td>
                <td>${s.item_description || '-'}</td>
                <td class="text-center">${s.weight_kg} Kg</td>
                <td class="text-center">${s.payment_status === 'PAID' ? 'LUNAS' : 'COD'}</td>
              </tr>
            `).join('')}
            ${shipments.length === 0 ? '<tr><td colspan="7" class="text-center">Belum ada paket muatan</td></tr>' : ''}
          </tbody>
        </table>

        <div class="signatures">
          <div>
            <div>Admin Keberangkatan</div>
            <div class="sig-box">(........................)</div>
          </div>
          <div>
            <div>Sopir / Kernet</div>
            <div class="sig-box">(........................)</div>
          </div>
          <div>
            <div>Admin Penerima</div>
            <div class="sig-box">(........................)</div>
          </div>
        </div>
      </div>
      
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          }, 500);
        }
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

export function printShiftClosing(shipments: any[]) {
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (!printWindow) return;
  
  const todayPaid = shipments.filter(s => 
    new Date(s.created_at).toDateString() === new Date().toDateString() && 
    s.payment_status === 'PAID'
  );
  
  const totalCash = todayPaid.reduce((sum, s) => sum + Number(s.grand_total || 0), 0);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Cetak Rekap Kasir</title>
      <style>
        body { 
          font-family: 'Courier New', Courier, monospace; 
          margin: 0; 
          padding: 20px; 
          color: #000;
          text-transform: uppercase;
        }
        .sticker { 
          width: 80mm; 
          padding: 10px; 
          box-sizing: border-box;
          margin: 0 auto;
          line-height: 1.4;
        }
        .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 15px; margin-bottom: 15px; }
        .header h1 { margin: 0; font-size: 20px; font-weight: 900; }
        .header p { margin: 5px 0 0 0; font-size: 11px; font-weight: bold; }
        
        .row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 12px; font-weight: bold; }
        .divider { border-bottom: 2px dashed #000; margin: 15px 0; }
        
        .large-value { font-size: 18px; font-weight: 900; margin-top: 10px; text-align: right; }
        .footer { text-align: center; margin-top: 20px; font-size: 10px; font-weight: bold; border-top: 2px dashed #000; padding-top: 15px; }
        
        @media print {
          body { padding: 0; }
          .sticker { width: 100%; padding: 0; }
          @page { margin: 0; size: 80mm auto; }
        }
      </style>
    </head>
    <body>
      <div class="sticker">
        <div class="header">
          <h1>NIZAM KARGO</h1>
          <p>REKAPITULASI KASIR HARIAN</p>
        </div>
        
        <div class="row">
          <div>TANGGAL</div>
          <div>${new Date().toLocaleDateString('id-ID')}</div>
        </div>
        <div class="row">
          <div>WAKTU CETAK</div>
          <div>${new Date().toLocaleTimeString('id-ID')}</div>
        </div>
        <div class="divider"></div>
        
        <div style="font-size: 11px; margin-bottom: 10px; text-align: center; font-weight: bold;">DAFTAR RESI (LUNAS / CASH)</div>
        
        ${todayPaid.map(s => `
          <div class="row" style="font-size:10px;">
             <div>${s.tracking_number}</div>
             <div>Rp ${Number(s.grand_total).toLocaleString('id-ID')}</div>
          </div>
        `).join('')}
        
        ${todayPaid.length === 0 ? '<div class="row" style="font-size:10px; justify-content:center;">TIDAK ADA TRANSAKSI</div>' : ''}
        
        <div class="divider"></div>
        
        <div class="row">
          <div>TOTAL RESI</div>
          <div>${todayPaid.length} PAKET</div>
        </div>
        <div class="row">
          <div>TOTAL SETORAN TUNAI</div>
        </div>
        <div class="large-value">RP ${totalCash.toLocaleString('id-ID')}</div>
        
        <div class="footer">
          SERAHKAN REKAP INI<br>BERSAMA UANG TUNAI KE FINANCE
        </div>
      </div>
      
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          }, 500);
        }
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}
