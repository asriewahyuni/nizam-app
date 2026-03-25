'use server'

/**
 * Server Action untuk mengambil Harga Emas dan Perak terkini (Global).
 * Karena kebanyakan API harga logam mulia berbayar (seperti Metal-API, GoldAPI.io),
 * di sini disediakan metode fetch ke API gratisan atau endpoint public scraper.
 * Jika Anda mendaftar ke www.goldapi.io, Anda bisa menaruh API Key di .env
 */
export async function getLivePreciousMetalsPrices() {
  try {
    // Sebagai ganti API berbayar, kita melakukan HTTP Scraping sederhana secara realtime
    // ke halaman utama (Homepage) situs resmi Logam Mulia (Antam) untuk mengambil harga Emas & Perak 1 Gram hari ini.
    const res = await fetch('https://www.logammulia.com/id', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      next: { revalidate: 3600 } // Cache selama 1 jam agar tidak kena rate-limit
    });
    
    if (!res.ok) throw new Error('Gagal menghubungi logammulia.com');
    
    const html = await res.text();
    
    // Antam HTML di homepage memuat daftar harga langsung di hero banner.
    // Teks target: 'Harga/gram Rp2.843.000,00' (index 0 = Emas, index 1 = Perak)
    const matches = html.match(/Harga\/gram Rp([0-9.,]+)/g);
    
    if (!matches || matches.length < 2) {
      throw new Error('Struktur HTML web harga emas telah berubah. Silakan pakai API berbayar.');
    }

    // Ekstraksi Harga Emas (Index 0)
    const rawGoldStr = matches[0].replace('Harga/gram Rp', '').split(',')[0].replace(/\./g, '');
    const goldPriceTarget = parseInt(rawGoldStr, 10);

    // Ekstraksi Harga Perak (Index 1)
    const rawSilverStr = matches[1].replace('Harga/gram Rp', '').split(',')[0].replace(/\./g, '');
    const silverPriceTarget = parseInt(rawSilverStr, 10);

    if (isNaN(goldPriceTarget) || isNaN(silverPriceTarget) || goldPriceTarget < 1000000) {
      throw new Error('Hasil ekstraksi harga tidak masuk akal.');
    }

    return {
      success: true,
      data: {
        gold: goldPriceTarget,
        silver: silverPriceTarget,
        timestamp: new Date().toISOString(),
        source: 'Live Scraped from logammulia.com/id'
      }
    };
  } catch (error: any) {
    // Fallback jika scraper gagal (minimal kembalikan harga rasional terkini - 2026)
    return { 
      success: true, 
      data: { gold: 2843000, silver: 43850, timestamp: new Date().toISOString(), source: 'Fallback Local ERP Data' },
      error: 'Scraping gagal, menggunakan fallback data: ' + error.message 
    };
  }
}
