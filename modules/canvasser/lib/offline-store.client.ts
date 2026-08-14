'use client'

// Cache lokal (localStorage) untuk layar canvasser lapangan — snapshot data
// hari ini + antrian aksi yang belum tersinkron ke server saat offline.
// Volume data 1 van/1 hari kecil (puluhan kunjungan/order), jadi localStorage
// (sinkron, tanpa dependency baru) sudah cukup — tidak perlu IndexedDB.

import type {
  CanvasserSession,
  CanvasserVisit,
  PaymentMethod,
} from '@/modules/canvasser/lib/canvasser-types'

export interface OfflineProductOption {
  id: string
  name: string
  unit: string
  sellingPrice: number
}

export interface OfflineCacheSnapshot {
  session: CanvasserSession | null
  visits: CanvasserVisit[]
  products: OfflineProductOption[]
  cachedAt: string
}

export type OutboxActionType = 'CREATE_ORDER' | 'RECORD_AR' | 'UPDATE_VISIT_STATUS'

export interface CreateOrderOutboxPayload {
  session_id: string
  visit_id: string
  contact_id: string
  payment_method: PaymentMethod
  items: { product_id: string; qty: number; unit_price: number }[]
  notes?: string
}

export interface RecordArOutboxPayload {
  session_id: string
  visit_id: string
  contact_id: string
  amount: number
  payment_method: PaymentMethod
  reference_no?: string
  notes?: string
}

export interface UpdateVisitStatusOutboxPayload {
  visitId: string
  status: CanvasserVisit['status']
  gps?: { lat: number; lng: number }
}

export type OutboxPayload =
  | { type: 'CREATE_ORDER'; payload: CreateOrderOutboxPayload }
  | { type: 'RECORD_AR'; payload: RecordArOutboxPayload }
  | { type: 'UPDATE_VISIT_STATUS'; payload: UpdateVisitStatusOutboxPayload }

export interface OutboxItem {
  id: string
  orgId: string
  type: OutboxActionType
  payload: CreateOrderOutboxPayload | RecordArOutboxPayload | UpdateVisitStatusOutboxPayload
  createdAt: string
  status: 'pending' | 'failed'
  error?: string
}

function cacheKey(vanId: string) {
  return `canvasser:cache:${vanId}`
}

function outboxKey(vanId: string) {
  return `canvasser:outbox:${vanId}`
}

function safeGetItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSetItem(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // localStorage penuh/nonaktif (private browsing) — gagal diam-diam,
    // aplikasi tetap jalan hanya tanpa cache offline.
  }
}

export function getCache(vanId: string): OfflineCacheSnapshot | null {
  if (typeof window === 'undefined') return null
  const raw = safeGetItem(cacheKey(vanId))
  if (!raw) return null
  try {
    return JSON.parse(raw) as OfflineCacheSnapshot
  } catch {
    return null
  }
}

export function setCache(vanId: string, snapshot: Omit<OfflineCacheSnapshot, 'cachedAt'>) {
  if (typeof window === 'undefined') return
  safeSetItem(cacheKey(vanId), JSON.stringify({ ...snapshot, cachedAt: new Date().toISOString() }))
}

export function getOutbox(vanId: string): OutboxItem[] {
  if (typeof window === 'undefined') return []
  const raw = safeGetItem(outboxKey(vanId))
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function setOutbox(vanId: string, items: OutboxItem[]) {
  if (typeof window === 'undefined') return
  safeSetItem(outboxKey(vanId), JSON.stringify(items))
}

export function enqueueOutboxItem(vanId: string, orgId: string, action: OutboxPayload, id?: string): OutboxItem {
  const item: OutboxItem = {
    id: id || crypto.randomUUID(),
    orgId,
    type: action.type,
    payload: action.payload,
    createdAt: new Date().toISOString(),
    status: 'pending',
  }
  const items = getOutbox(vanId)
  items.push(item)
  setOutbox(vanId, items)
  return item
}

export function removeOutboxItem(vanId: string, itemId: string) {
  const items = getOutbox(vanId).filter((i) => i.id !== itemId)
  setOutbox(vanId, items)
}

export function markOutboxItemFailed(vanId: string, itemId: string, error: string) {
  const items = getOutbox(vanId).map((i) => (i.id === itemId ? { ...i, status: 'failed' as const, error } : i))
  setOutbox(vanId, items)
}
