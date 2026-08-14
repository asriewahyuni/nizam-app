'use client'

// Hook sinkronisasi offline untuk layar operasional canvasser. Membungkus 3
// aksi yang boleh dilakukan tanpa sinyal (Catat Order, Tagih AR, Update
// status kunjungan): terapkan optimistic update ke local state dulu, lalu
// coba panggil Server Action asli — kalau jaringan gagal (bukan ditolak
// server), aksi masuk antrian (outbox) dan di-replay otomatis saat online.
// "Tambah Kunjungan" & "Tutup Sesi" sengaja TIDAK lewat sini — tetap wajib
// online (lihat VanOperationalClient).

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createOrder,
  recordARCollection,
  updateVisitStatus,
} from '@/modules/canvasser/actions/canvasser.actions'
import type {
  CanvasserSession,
  CanvasserVisit,
  CanvasserOrder,
  CanvasserARCollection,
  ARStatus,
} from '@/modules/canvasser/lib/canvasser-types'
import {
  getCache,
  setCache,
  getOutbox,
  enqueueOutboxItem,
  removeOutboxItem,
  markOutboxItemFailed,
  type OfflineProductOption,
  type OutboxItem,
  type CreateOrderOutboxPayload,
  type RecordArOutboxPayload,
  type UpdateVisitStatusOutboxPayload,
} from '@/modules/canvasser/lib/offline-store.client'

function computeArStatusLocal(outstanding: number, creditLimit: number): ARStatus {
  if (creditLimit <= 0) return outstanding > 0 ? 'MENDEKATI_LIMIT' : 'NORMAL'
  if (outstanding >= creditLimit) return 'BLOKIR'
  if (outstanding >= creditLimit * 0.8) return 'MENDEKATI_LIMIT'
  return 'NORMAL'
}

function isNetworkFailure(err: unknown): boolean {
  // Server Action yang gagal terkirim karena benar-benar offline akan
  // reject di level fetch (TypeError), berbeda dari action yang berhasil
  // dipanggil tapi ditolak server (itu resolve normal dgn { error }).
  return err instanceof TypeError || (typeof navigator !== 'undefined' && !navigator.onLine)
}

interface UseCanvasserSyncArgs {
  orgId: string
  vanId: string
  initialSession: CanvasserSession | null
  initialVisits: CanvasserVisit[]
  products: OfflineProductOption[]
}

export function useCanvasserSync({ orgId, vanId, initialSession, initialVisits, products }: UseCanvasserSyncArgs) {
  const [isOnline, setIsOnline] = useState(true)
  const [hydrated, setHydrated] = useState(false)
  const [session, setSession] = useState<CanvasserSession | null>(initialSession)
  const [visits, setVisits] = useState<CanvasserVisit[]>(initialVisits)
  const [outbox, setOutboxState] = useState<OutboxItem[]>([])
  const draining = useRef(false)

  // Hydrasi awal: kalau online, percaya props (data terbaru dari server) dan
  // simpan ke cache. Kalau offline saat pertama render, pakai cache lokal.
  useEffect(() => {
    setIsOnline(navigator.onLine)
    setOutboxState(getOutbox(vanId))

    if (navigator.onLine) {
      setCache(vanId, { session: initialSession, visits: initialVisits, products })
    } else {
      const cached = getCache(vanId)
      if (cached) {
        setSession(cached.session)
        setVisits(cached.visits)
      }
    }
    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vanId])

  useEffect(() => {
    function handleOnline() { setIsOnline(true) }
    function handleOffline() { setIsOnline(false) }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Persist tiap perubahan session/visits ke cache lokal.
  useEffect(() => {
    if (!hydrated) return
    setCache(vanId, { session, visits, products })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, visits, hydrated])

  const refreshOutbox = useCallback(() => setOutboxState(getOutbox(vanId)), [vanId])

  function patchVisit(visitId: string, patch: (v: CanvasserVisit) => CanvasserVisit) {
    setVisits((prev) => prev.map((v) => (v.id === visitId ? patch(v) : v)))
  }

  // ── Catat Order ────────────────────────────────────────────────────────────

  const dispatchCreateOrder = useCallback(async (payload: CreateOrderOutboxPayload): Promise<{ error?: string }> => {
    const localId = crypto.randomUUID()
    const subtotal = payload.items.reduce((s, i) => s + i.qty * i.unit_price, 0)
    const optimisticOrder: CanvasserOrder = {
      id: localId,
      orgId,
      sessionId: payload.session_id,
      visitId: payload.visit_id,
      contactId: payload.contact_id,
      orderNumber: 'Menunggu sinkron...',
      paymentMethod: payload.payment_method,
      subtotal,
      discount: 0,
      total: subtotal,
      status: 'SELESAI',
      notes: payload.notes || null,
      createdAt: new Date().toISOString(),
      items: payload.items.map((i) => {
        const product = products.find((p) => p.id === i.product_id)
        return {
          id: crypto.randomUUID(),
          orderId: localId,
          productId: i.product_id,
          productName: product?.name || '',
          qty: i.qty,
          unit: product?.unit || 'pcs',
          unitPrice: i.unit_price,
          subtotal: i.qty * i.unit_price,
        }
      }),
    }

    patchVisit(payload.visit_id, (v) => ({ ...v, orders: [...(v.orders || []), optimisticOrder] }))

    if (isOnline) {
      try {
        const res = await createOrder(orgId, payload)
        if (res.error) {
          patchVisit(payload.visit_id, (v) => ({ ...v, orders: (v.orders || []).filter((o) => o.id !== localId) }))
          return { error: res.error }
        }
        if (res.data) {
          const realOrder = res.data
          patchVisit(payload.visit_id, (v) => ({
            ...v,
            orders: (v.orders || []).map((o) => (o.id === localId ? realOrder : o)),
          }))
        }
        return {}
      } catch (err) {
        if (!isNetworkFailure(err)) {
          patchVisit(payload.visit_id, (v) => ({ ...v, orders: (v.orders || []).filter((o) => o.id !== localId) }))
          return { error: 'Gagal mencatat order.' }
        }
        // jatuh ke antrian di bawah
      }
    }

    // localId dipakai juga sebagai id item outbox, supaya drainOutbox bisa
    // mencocokkan & mengganti order optimistic ini dengan data asli server.
    enqueueOutboxItem(vanId, orgId, { type: 'CREATE_ORDER', payload }, localId)
    refreshOutbox()
    return {}
  }, [isOnline, orgId, vanId, products, refreshOutbox])

  // ── Tagih AR ───────────────────────────────────────────────────────────────

  const dispatchRecordAr = useCallback(async (payload: RecordArOutboxPayload): Promise<{ error?: string }> => {
    const localId = crypto.randomUUID()
    const visit = visits.find((v) => v.id === payload.visit_id) || null
    const nextOutstanding = Math.max(0, (visit?.arOutstanding || 0) - payload.amount)
    const optimisticCollection: CanvasserARCollection = {
      id: localId,
      orgId,
      sessionId: payload.session_id,
      visitId: payload.visit_id,
      contactId: payload.contact_id,
      amount: payload.amount,
      paymentMethod: payload.payment_method,
      referenceNo: payload.reference_no || null,
      notes: payload.notes || null,
      createdAt: new Date().toISOString(),
    }

    patchVisit(payload.visit_id, (v) => ({
      ...v,
      arCollections: [...(v.arCollections || []), optimisticCollection],
      arOutstanding: nextOutstanding,
      arStatus: computeArStatusLocal(nextOutstanding, v.creditLimit),
    }))

    if (isOnline) {
      try {
        const res = await recordARCollection(orgId, payload)
        if (res.error) {
          patchVisit(payload.visit_id, (v) => ({
            ...v,
            arCollections: (v.arCollections || []).filter((c) => c.id !== localId),
            arOutstanding: visit?.arOutstanding ?? v.arOutstanding,
            arStatus: visit?.arStatus ?? v.arStatus,
          }))
          return { error: res.error }
        }
        if (res.data) {
          const real = res.data
          patchVisit(payload.visit_id, (v) => ({
            ...v,
            arCollections: (v.arCollections || []).map((c) => (c.id === localId ? real : c)),
          }))
        }
        return {}
      } catch (err) {
        if (!isNetworkFailure(err)) {
          patchVisit(payload.visit_id, (v) => ({
            ...v,
            arCollections: (v.arCollections || []).filter((c) => c.id !== localId),
            arOutstanding: visit?.arOutstanding ?? v.arOutstanding,
            arStatus: visit?.arStatus ?? v.arStatus,
          }))
          return { error: 'Gagal mencatat pembayaran.' }
        }
      }
    }

    enqueueOutboxItem(vanId, orgId, { type: 'RECORD_AR', payload }, localId)
    refreshOutbox()
    return {}
  }, [isOnline, orgId, vanId, visits, refreshOutbox])

  // ── Update Status Kunjungan ──────────────────────────────────────────────────

  const dispatchUpdateVisitStatus = useCallback(async (payload: UpdateVisitStatusOutboxPayload): Promise<{ error?: string }> => {
    const now = new Date().toISOString()
    patchVisit(payload.visitId, (v) => ({
      ...v,
      status: payload.status,
      arrivedAt: payload.status === 'DALAM_PERJALANAN' ? now : v.arrivedAt,
      departedAt: payload.status === 'SELESAI' || payload.status === 'SKIP' ? now : v.departedAt,
      gpsLat: payload.gps?.lat ?? v.gpsLat,
      gpsLng: payload.gps?.lng ?? v.gpsLng,
    }))

    if (isOnline) {
      try {
        const res = await updateVisitStatus(orgId, payload.visitId, payload.status, payload.gps)
        if (res.error) return { error: res.error }
        return {}
      } catch (err) {
        if (!isNetworkFailure(err)) return { error: 'Gagal memperbarui status kunjungan.' }
      }
    }

    enqueueOutboxItem(vanId, orgId, { type: 'UPDATE_VISIT_STATUS', payload })
    refreshOutbox()
    return {}
  }, [isOnline, orgId, vanId, refreshOutbox])

  // ── Background drain loop ────────────────────────────────────────────────────

  const drainOutbox = useCallback(async () => {
    if (draining.current || !navigator.onLine) return
    draining.current = true
    try {
      let items = getOutbox(vanId)
      for (const item of items) {
        if (item.status === 'failed') break // preserve order, jangan lompati item gagal
        try {
          if (item.type === 'CREATE_ORDER') {
            const p = item.payload as CreateOrderOutboxPayload
            const res = await createOrder(item.orgId, p)
            if (res.error) { markOutboxItemFailed(vanId, item.id, res.error); break }
            if (res.data) {
              const realOrder = res.data
              patchVisit(p.visit_id, (v) => ({
                ...v,
                orders: (v.orders || []).map((o) => (o.id === item.id ? realOrder : o)),
              }))
            }
          } else if (item.type === 'RECORD_AR') {
            const p = item.payload as RecordArOutboxPayload
            const res = await recordARCollection(item.orgId, p)
            if (res.error) { markOutboxItemFailed(vanId, item.id, res.error); break }
            if (res.data) {
              const realCollection = res.data
              patchVisit(p.visit_id, (v) => ({
                ...v,
                arCollections: (v.arCollections || []).map((c) => (c.id === item.id ? realCollection : c)),
              }))
            }
          } else {
            const p = item.payload as UpdateVisitStatusOutboxPayload
            const res = await updateVisitStatus(item.orgId, p.visitId, p.status, p.gps)
            if (res.error) { markOutboxItemFailed(vanId, item.id, res.error); break }
          }
          removeOutboxItem(vanId, item.id)
        } catch (err) {
          if (!isNetworkFailure(err)) {
            markOutboxItemFailed(vanId, item.id, 'Gagal sinkron.')
          }
          break
        }
        items = getOutbox(vanId)
      }
    } finally {
      draining.current = false
      refreshOutbox()
    }
  }, [vanId, refreshOutbox])

  useEffect(() => {
    if (!hydrated) return
    if (isOnline) drainOutbox()
    const interval = setInterval(() => { if (navigator.onLine) drainOutbox() }, 20_000)
    return () => clearInterval(interval)
  }, [isOnline, hydrated, drainOutbox])

  return {
    isOnline,
    session,
    visits,
    outbox,
    pendingCount: outbox.filter((i) => i.status === 'pending').length,
    failedCount: outbox.filter((i) => i.status === 'failed').length,
    dispatchCreateOrder,
    dispatchRecordAr,
    dispatchUpdateVisitStatus,
    retrySync: drainOutbox,
  }
}
