/**
 * Operational Bridge — URL helpers (tidak perlu 'use server').
 * Fungsi-fungsi ini murni sinkron dan aman dipanggil dari client/server.
 */

// ─── Types (duplikat di sini agar tidak import dari 'use server') ─────────────

export type OperationalContextType = 'WORKSHOP' | 'LMS_BATCH' | 'FLEET' | 'JOB_ORDER'

export type OperationalContext =
  | { type: 'WORKSHOP';  referenceId: string; spkNumber: string }
  | { type: 'LMS_BATCH'; referenceId: string; batchName: string }
  | { type: 'FLEET';     referenceId: string; orderNumber: string }
  | { type: 'JOB_ORDER'; referenceId: string; orderNumber: string }

export interface BridgePurchaseItem {
  product_name: string
  quantity: number
  unit_price: number
  product_id?: string
  unit?: string
  category?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function buildContextNote(context: OperationalContext): string {
  switch (context.type) {
    case 'WORKSHOP':  return `Ref: SPK ${context.spkNumber}`
    case 'LMS_BATCH': return `Ref: Batch ${context.batchName}`
    case 'FLEET':     return `Ref: Order ${context.orderNumber}`
    case 'JOB_ORDER': return `Ref: Job ${context.orderNumber}`
    default:          return ''
  }
}

/**
 * Buat URL redirect ke form Purchase Order dengan data pre-filled
 * dari konteks modul operasional (Workshop, LMS, Fleet, dll).
 */
export function buildPurchasePreFillUrl(params: {
  context: OperationalContext
  vendorId?: string
  items: BridgePurchaseItem[]
}): string {
  const contextNote = buildContextNote(params.context)
  const queryItems = encodeURIComponent(JSON.stringify(params.items))

  const search = new URLSearchParams({
    action: 'new',
    ref_type: params.context.type,
    ref_id: params.context.referenceId,
    notes: contextNote,
    prefill_items: queryItems,
    ...(params.vendorId ? { vendor_id: params.vendorId } : {}),
  })

  return `/purchasing?${search.toString()}`
}
