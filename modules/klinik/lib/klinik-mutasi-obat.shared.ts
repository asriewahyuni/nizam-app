// Klinik Pratama — konstanta jenis mutasi obat, dipakai server (query filter)
// maupun client (opsi dropdown filter). Sengaja dipisah dari
// klinik-mutasi-obat.actions.ts: file 'use server' cuma boleh mengekspor
// async function — array const di sini akan crash production build kalau
// ikut diekspor dari file 'use server' ("A 'use server' file can only
// export async functions, found object").

export const KLINIK_STOCK_REFERENCE_TYPES = ['KLINIK_RECEIPT', 'KLINIK_RESEP', 'KLINIK_VOID_RETURN'] as const
export type KlinikStockReferenceType = (typeof KLINIK_STOCK_REFERENCE_TYPES)[number]
