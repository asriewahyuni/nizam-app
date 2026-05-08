/**
 * lib/api/webhook-events.ts
 *
 * Katalog event webhook Open API yang dibagikan lintas server action,
 * utilitas delivery webhook, dan panel pengaturan developer.
 */

export const VALID_WEBHOOK_EVENTS = [
  'cash_in',
  'cash_out',
  'sale',
  'purchase',
  'inventory_movement',
] as const

export type WebhookEventType = (typeof VALID_WEBHOOK_EVENTS)[number]
export const INVENTORY_WEBHOOK_DIRECTIONS = ['in', 'out'] as const

export type InventoryWebhookDirection = (typeof INVENTORY_WEBHOOK_DIRECTIONS)[number]

export const WEBHOOK_EVENT_OPTIONS = [
  {
    value: 'cash_in',
    label: 'Cash In',
    description: 'Transaksi kas/bank masuk berhasil dicatat.',
  },
  {
    value: 'cash_out',
    label: 'Cash Out',
    description: 'Transaksi kas/bank keluar berhasil dicatat.',
  },
  {
    value: 'sale',
    label: 'Sale',
    description: 'Dokumen penjualan yang relevan dengan integrasi berubah.',
  },
  {
    value: 'purchase',
    label: 'Purchase',
    description: 'Dokumen pembelian yang relevan dengan integrasi berubah.',
  },
  {
    value: 'inventory_movement',
    label: 'Inventory Movement',
    description: 'Pergerakan stok baru tercatat pada kartu stok.',
  },
] as const satisfies ReadonlyArray<{
  value: WebhookEventType
  label: string
  description: string
}>

export const INVENTORY_WEBHOOK_DIRECTION_OPTIONS = [
  {
    value: 'in',
    label: 'Stock In',
    description: 'Kirim hanya saat quantity mutasi inventory bernilai positif.',
  },
  {
    value: 'out',
    label: 'Stock Out',
    description: 'Kirim hanya saat quantity mutasi inventory bernilai negatif.',
  },
] as const satisfies ReadonlyArray<{
  value: InventoryWebhookDirection
  label: string
  description: string
}>

export const INVENTORY_WEBHOOK_REFERENCE_TYPE_OPTIONS = [
  {
    value: 'PURCHASE',
    label: 'Purchase',
    description: 'Barang masuk dari penerimaan pembelian.',
  },
  {
    value: 'SALE_VOID',
    label: 'Sale Void',
    description: 'Barang masuk kembali karena penjualan yang sudah mengurangi stok dibatalkan.',
  },
  {
    value: 'PURCHASE_RETURN',
    label: 'Purchase Return',
    description: 'Barang keluar karena retur ke supplier.',
  },
  {
    value: 'SALE',
    label: 'Sale',
    description: 'Barang keluar karena penjualan atau delivery order.',
  },
  {
    value: 'PURCHASE_VOID',
    label: 'Purchase Void',
    description: 'Barang keluar kembali karena penerimaan pembelian dibatalkan.',
  },
  {
    value: 'SALES_RETURN',
    label: 'Sales Return',
    description: 'Barang masuk karena retur dari customer.',
  },
  {
    value: 'ADJUSTMENT',
    label: 'Adjustment',
    description: 'Koreksi stok hasil stock opname atau write-off.',
  },
  {
    value: 'TRANSFER',
    label: 'Transfer',
    description: 'Perpindahan stok antar cabang atau gudang.',
  },
  {
    value: 'PRODUCTION_OUTPUT',
    label: 'Production Output',
    description: 'Barang jadi masuk dari proses produksi.',
  },
  {
    value: 'PRODUCTION_CONSUMPTION',
    label: 'Production Consumption',
    description: 'Bahan baku keluar untuk proses produksi.',
  },
] as const satisfies ReadonlyArray<{
  value: string
  label: string
  description: string
}>
