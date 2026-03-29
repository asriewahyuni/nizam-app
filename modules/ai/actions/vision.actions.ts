'use server'

/**
 * Deteksi detail nota/kuitansi menggunakan Google Gemini Vision.
 * Mendukung format Rupiah Indonesia (pemisah ribuan dengan titik).
 */
export async function detectReceiptDetails(base64Image: string) {
  try {
    const aiStudioKey = process.env.GOOGLE_AI_STUDIO_KEY;
    if (!aiStudioKey) throw new Error('GOOGLE_AI_STUDIO_KEY tidak dikonfigurasi.');

    // Import dalam fungsi agar tidak membebani kompilasi Turbopack
    const { GoogleGenerativeAI } = await import('@google/generative-ai');

    const prompt = `You are an expert OCR system for Indonesian receipts and invoices.
Analyze this receipt image carefully.

CRITICAL RULES for Indonesian currency format:
- Thousand separator is DOT (e.g., "128.500" means one hundred twenty-eight thousand five hundred = 128500)
- Decimal separator is COMMA (e.g., "1.500,50" = 1500)
- Extract EACH line item (name and price). 
- Find the TOTAL amount.

Return ONLY valid JSON (no markdown, no explanation):
{
  "vendor_name": "<store or restaurant name>",
  "transaction_date": "<date in YYYY-MM-DD format, or empty string if not found>",
  "items": [
    { "name": "<item name>", "amount": <integer price, e.g. 15000> }
  ],
  "total_amount": <integer total sum, e.g. 128500>
}`;

    const genAI = new GoogleGenerativeAI(aiStudioKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Deteksi mimeType dari header base64
    const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
    const mimeTypeHeader = base64Image.includes(',') ? base64Image.split(',')[0] : '';
    const mimeType = mimeTypeHeader.includes('png') ? 'image/png'
      : mimeTypeHeader.includes('webp') ? 'image/webp'
      : mimeTypeHeader.includes('gif') ? 'image/gif'
      : 'image/jpeg';

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType } }
    ]);

    const responseText = result.response.text().trim();
    console.log('[AI Vision] Raw response:', responseText.substring(0, 300));

    // Ekstrak JSON secara greedy (hingga tanda kurung kurawal penutup terakhir)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`Tidak ada JSON dalam response: ${responseText.substring(0, 200)}`);

    const parsed = JSON.parse(jsonMatch[0]);
    
    // Normalize function
    const normalizeAmount = (raw: any) => {
      if (raw === undefined || raw === null) return 0;
      if (typeof raw === 'number') return Math.round(raw);
      if (typeof raw === 'string') {
        const normalized = raw.replace(/\./g, '').replace(/,\d*$/, '').replace(/[^\d]/g, '');
        return parseInt(normalized, 10) || 0;
      }
      return 0;
    }

    const totalAmount = normalizeAmount(parsed.total_amount);
    
    // Normalize items
    const items = Array.isArray(parsed.items) ? parsed.items.map((it: any) => ({
      name: it.name || 'Item',
      amount: normalizeAmount(it.amount)
    })) : [];

    return {
      success: true,
      data: {
        total_amount: totalAmount,
        vendor_name: typeof parsed.vendor_name === 'string' ? parsed.vendor_name.trim() : '',
        transaction_date: typeof parsed.transaction_date === 'string'
          && parsed.transaction_date.match(/^\d{4}-\d{2}-\d{2}$/)
          ? parsed.transaction_date : '',
        items
      }
    };

  } catch (error: any) {
    (console as any).error('[AI Vision] Error:', error.message);
    return { success: false, error: 'AI gagal membaca nota. Silakan isi nominal secara manual.' };
  }
}
