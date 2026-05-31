'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, Minus, Trash2, ShoppingCart, User, CreditCard, Banknote, QrCode, MonitorSmartphone, Receipt, MapPin, CheckCircle2, MessageCircle, UserPlus, X, Tag, Clock3, ShieldAlert, ArrowRightLeft, Wallet, CalendarDays, ChevronDown, ChevronUp } from 'lucide-react'
import { clampDiscountAmount } from '@/lib/commerce/discounts'
import { formatRupiah } from '@/lib/utils'
import { processPosTransaction } from '@/modules/sales/actions/pos.actions'
import { getUsableSalesPromoByCode } from '@/modules/sales/actions/promo.actions'
import { closePosShift, getPosShiftHistory, openPosShift, settlePosShift, type PosShiftHistoryResponse, type PosShiftSnapshot } from '@/modules/sales/actions/pos-shift.actions'
import { buildPosWhatsappReceiptMessage, normalizeWhatsappPhone } from '@/modules/sales/lib/pos-whatsapp'
import { resolveDefaultPosAccountId, type PosShiftConfig, type PosShiftMethod } from '@/modules/sales/lib/pos-shift'
import type { SalesPromoRecord } from '@/modules/sales/lib/sales-promos'

type PosSuccessData = {
   total: number
   change: number
   saleId: string
   waPhone: string
   customerName: string
   items: Array<{ id: string; name: string; price: number; qty: number; unit?: string; type?: string }>
   discount: number
   tax: number
   subtotal: number
   method: 'CASH' | 'TRANSFER' | 'QRIS'
   tendered: number
   customWaMessage: string
}

type PosClientProps = {
   orgId: string
   org: any
   products: any[]
   customers: any[]
   accounts: Array<{ id: string; code?: string | null; name?: string | null; type?: string | null }>
   warehouses?: any[]
   currentUser: any
   currentUserDisplayName?: string | null
   currentOrgRole?: string | null
   activeBranchId?: string | null
   activeBranchName?: string | null
   posShiftConfig?: PosShiftConfig | null
   posShiftSnapshot?: PosShiftSnapshot | null
   initialShiftHistory?: PosShiftHistoryResponse | null
}

function formatMoneyInput(value: number): string {
   const normalized = Math.round(Number(value || 0))
   if (!Number.isFinite(normalized) || normalized <= 0) return ''
   return new Intl.NumberFormat('id-ID').format(normalized)
}

function parseMoneyInput(value: string): number {
   const numeric = Number(String(value || '').replace(/\D/g, ''))
   return Number.isFinite(numeric) ? numeric : 0
}

function formatShiftTimestamp(value?: string | null): string {
   if (!value) return '-'
   const date = new Date(value)
   if (Number.isNaN(date.getTime())) return '-'

   const label = new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jakarta',
   }).format(date)

   return `${label} WIB`
}

function formatShiftDuration(openedAt?: string | null, closedAt?: string | null): string {
   if (!openedAt) return '-'
   const openedDate = new Date(openedAt)
   const closedDate = closedAt ? new Date(closedAt) : new Date()
   if (Number.isNaN(openedDate.getTime()) || Number.isNaN(closedDate.getTime())) return '-'

   const diffMs = Math.max(0, closedDate.getTime() - openedDate.getTime())
   const totalMinutes = Math.floor(diffMs / 60000)
   const hours = Math.floor(totalMinutes / 60)
   const minutes = totalMinutes % 60

   return `${hours}j ${minutes}m`
}

function formatShiftClock(value?: string | null): string {
   if (!value) return '-'
   const date = new Date(value)
   if (Number.isNaN(date.getTime())) return '-'

   return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jakarta',
   }).format(date)
}

function formatShiftDayLabel(dateKey?: string | null): string {
   const normalized = String(dateKey || '').trim()
   if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return 'Hari tidak valid'

   const date = new Date(`${normalized}T00:00:00+07:00`)
   if (Number.isNaN(date.getTime())) return normalized

   return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Jakarta',
   }).format(date)
}

function createEmptyShiftHistory(snapshot: PosShiftSnapshot): PosShiftHistoryResponse {
   return {
      schemaReady: snapshot.schemaReady,
      days: [],
      hasMore: false,
      nextBeforeDateKey: null,
      message: snapshot.message,
   }
}

function isLiquidPosAccountOption(account: { code?: string | null; name?: string | null; type?: string | null }) {
   const type = String(account?.type || '').trim().toUpperCase()
   const code = String(account?.code || '').trim().toUpperCase()
   const name = String(account?.name || '').trim().toLowerCase()

   if (type && type !== 'ASSET') return false

   return (
      code.startsWith('11')
      || code.startsWith('12')
      || name.includes('kas')
      || name.includes('bank')
      || name.includes('qris')
      || name.includes('edc')
   )
}

export default function POSClient({
   orgId,
   org,
   products,
   customers,
   accounts,
   warehouses = [],
   currentUser,
   currentUserDisplayName,
   currentOrgRole,
   activeBranchId,
   activeBranchName,
   posShiftConfig,
   posShiftSnapshot,
   initialShiftHistory,
}: PosClientProps) {
   const orgSettings = org?.settings || {}
   const logoUrl = org?.logo_url || ''
   const defaultPosWaCustomMessage = typeof orgSettings.pos_wa_custom_message === 'string'
      ? orgSettings.pos_wa_custom_message
      : ''
   const initialShiftSnapshot = useMemo<PosShiftSnapshot>(() => (
      posShiftSnapshot || {
         enabled: Boolean(posShiftConfig?.requireOpenShift || posShiftConfig?.enableSettlement),
         schemaReady: true,
         requireOpenShift: Boolean(posShiftConfig?.requireOpenShift),
         enableSettlement: Boolean(posShiftConfig?.enableSettlement),
         config: posShiftConfig || {
            requireOpenShift: false,
            enableSettlement: false,
            defaultRegisterCode: 'REG-1',
            varianceApprovalThreshold: 0,
         },
         openSession: null,
         latestClosedSession: null,
         message: null,
      }
   ), [posShiftConfig, posShiftSnapshot])
   const branchGuardMessage = 'Pilih satu unit aktif terlebih dahulu untuk memakai POS.'
   const isStockTrackedProduct = (item: any) => (item?.type || 'INVENTORY') === 'INVENTORY'
   const formatStockQty = (value: number) => {
      const parsed = Number(value || 0)
      if (!Number.isFinite(parsed)) return '0'
      const rounded = Math.round(parsed * 1_000_000) / 1_000_000
      return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(6).replace(/\.?0+$/, '')
   }
   const [isMobileCartOpen, setIsMobileCartOpen] = useState(false)
  const { confirm, ConfirmUI } = useConfirm()
   const [loading, setLoading] = useState(false)
   const [shiftBusy, setShiftBusy] = useState(false)
   const [successData, setSuccessData] = useState<PosSuccessData | null>(null)
   const [customWaMessage, setCustomWaMessage] = useState(defaultPosWaCustomMessage)
   const [shiftState, setShiftState] = useState<PosShiftSnapshot>(initialShiftSnapshot)
   const [shiftNotice, setShiftNotice] = useState<string | null>(initialShiftSnapshot.message)
   const [showShiftHistory, setShowShiftHistory] = useState(true)
   const [historyBusy, setHistoryBusy] = useState(false)
   const [shiftHistory, setShiftHistory] = useState<PosShiftHistoryResponse>(
      initialShiftHistory || createEmptyShiftHistory(initialShiftSnapshot)
   )
   const [showOpenShiftModal, setShowOpenShiftModal] = useState(false)
   const [showCloseShiftModal, setShowCloseShiftModal] = useState(false)
   const [showSettlementModal, setShowSettlementModal] = useState(false)
   const [openingCashInput, setOpeningCashInput] = useState('')
   const [closingCashInput, setClosingCashInput] = useState('')
   const [openShiftCashierNik, setOpenShiftCashierNik] = useState('')
   const [openShiftCashierPassword, setOpenShiftCashierPassword] = useState('')
   const [closeShiftCashierNik, setCloseShiftCashierNik] = useState('')
   const [closeShiftCashierPassword, setCloseShiftCashierPassword] = useState('')
   const [shiftRegisterCode, setShiftRegisterCode] = useState(initialShiftSnapshot.config.defaultRegisterCode || 'REG-1')
   const [openShiftNotes, setOpenShiftNotes] = useState('')
   const [closeShiftNotes, setCloseShiftNotes] = useState('')
   const [shiftCashAccountId, setShiftCashAccountId] = useState('')
   const [shiftTransferAccountId, setShiftTransferAccountId] = useState('')
   const [shiftQrisAccountId, setShiftQrisAccountId] = useState('')
   const [shiftOpeningSourceAccountId, setShiftOpeningSourceAccountId] = useState('')
   const [settlementMethod, setSettlementMethod] = useState<PosShiftMethod>('CASH')
   const [settlementTargetAccountId, setSettlementTargetAccountId] = useState('')
   const [settlementAmountInput, setSettlementAmountInput] = useState('')
   const [settlementNotes, setSettlementNotes] = useState('')
   const [settlementAuthorizerNik, setSettlementAuthorizerNik] = useState('')
   const [settlementAuthorizerPassword, setSettlementAuthorizerPassword] = useState('')
   
   // Promo States
   const [promoCode, setPromoCode] = useState('')
   const [appliedPromo, setAppliedPromo] = useState<SalesPromoRecord | null>(null)

   const handleApplyPromo = async (scannedCode?: string) => {
      const code = (typeof scannedCode === 'string' ? scannedCode : promoCode).toUpperCase().trim()
      if (!code) return
      
      // VALIDASI PELANGGAN (Wajib)
      if (!selectedCustomer && (!showAddCustomer || !newCustomerName || !newCustomerPhone || newCustomerPhone.length < 8)) {
         return alert("Peringatan: Kupon Gagal Ditebus! Anda wajib mendaftarkan identitas Pelanggan (serta Nomor WA) yang valid terlebih dahulu.")
      }

      const promoResult = await getUsableSalesPromoByCode(orgId, code)
      if ('error' in promoResult) return alert(promoResult.error)
      
      setAppliedPromo(promoResult.promo)
      if (typeof scannedCode !== 'string') setPromoCode('')
   }
   const [cart, setCart] = useState<any[]>([])
   const requiresWarehouseSelection = cart.some((item: any) => isStockTrackedProduct(item))
   const [searchTerm, setSearchTerm] = useState('')
   const [selectedCustomer, setSelectedCustomer] = useState<string>('')
   const [showAddCustomer, setShowAddCustomer] = useState(false)
   const [newCustomerName, setNewCustomerName] = useState('')
   const [newCustomerPhone, setNewCustomerPhone] = useState('')
   const [showPayment, setShowPayment] = useState(false)
   const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER' | 'QRIS'>('CASH')
   const [selectedAccount, setSelectedAccount] = useState<string>('')
   const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('')
   const [amountTendered, setAmountTendered] = useState<string>('')
   const [discountAmount, setDiscountAmount] = useState<string>('')
   const [taxPercent, setTaxPercent] = useState<number>(0)
   const activeShiftSession = shiftState.openSession
   const latestClosedShift = shiftState.latestClosedSession
   const shouldEnforceShift = Boolean(shiftState.enabled && shiftState.schemaReady && shiftState.requireOpenShift)
   const activeShiftCashierLabel = [
      String(activeShiftSession?.cashierDisplayName || '').trim(),
      activeShiftSession?.cashierNik ? `#${activeShiftSession.cashierNik}` : '',
   ].filter(Boolean).join(' • ')
   const normalizedCurrentOrgRole = String(currentOrgRole || '').trim().toLowerCase()
   const canUsePrivilegedCloseShiftOverride = Boolean(
      activeShiftSession?.cashierUserId &&
      currentUser?.id &&
      String(activeShiftSession.cashierUserId).trim() === String(currentUser.id || '').trim() &&
      ['owner', 'admin', 'manager'].includes(normalizedCurrentOrgRole)
   )
   const availableSettlement = latestClosedShift?.totals.remainingByMethod || { CASH: 0, TRANSFER: 0, QRIS: 0 }
   const hasAnySettlementBalance = Object.values(availableSettlement).some((amount) => amount > 0)
   const liquidAccounts = useMemo(
      () => accounts.filter((account) => isLiquidPosAccountOption(account)),
      [accounts]
   )
   const posAccountOptions = useMemo(
      () => liquidAccounts.length > 0 ? liquidAccounts : accounts,
      [liquidAccounts, accounts]
   )
   const fallbackCashAccountId = useMemo(() => resolveDefaultPosAccountId(posAccountOptions, 'CASH'), [posAccountOptions])
   const fallbackTransferAccountId = useMemo(() => resolveDefaultPosAccountId(posAccountOptions, 'TRANSFER'), [posAccountOptions])
   const fallbackQrisAccountId = useMemo(() => resolveDefaultPosAccountId(posAccountOptions, 'QRIS'), [posAccountOptions])
   const fallbackOpeningSourceAccountId = useMemo(() => {
      const drawerAccountId = String(shiftCashAccountId || fallbackCashAccountId || '').trim()

      return (
         posAccountOptions.find((account) => (
            account.id !== drawerAccountId &&
            (
               String(account.name || '').toLowerCase().includes('bank')
               || String(account.code || '').startsWith('1103')
               || String(account.code || '').startsWith('1104')
               || String(account.code || '').startsWith('1105')
            )
         ))?.id
         || posAccountOptions.find((account) => account.id !== drawerAccountId)?.id
         || ''
      )
   }, [posAccountOptions, shiftCashAccountId, fallbackCashAccountId])
   const sourceAccountByMethod = useMemo(() => ({
      CASH: activeShiftSession?.cashAccountId || fallbackCashAccountId || '',
      TRANSFER: activeShiftSession?.transferAccountId || fallbackTransferAccountId || '',
      QRIS: activeShiftSession?.qrisAccountId || fallbackQrisAccountId || fallbackTransferAccountId || '',
   }), [
      activeShiftSession?.cashAccountId,
      activeShiftSession?.transferAccountId,
      activeShiftSession?.qrisAccountId,
      fallbackCashAccountId,
      fallbackTransferAccountId,
      fallbackQrisAccountId,
   ])
   const settlementRemaining = latestClosedShift?.totals.remainingByMethod?.[settlementMethod] || 0
   const historyShiftCount = useMemo(
      () => shiftHistory.days.reduce((total, day) => total + day.totals.shiftCount, 0),
      [shiftHistory.days]
   )

   useEffect(() => {
      setCustomWaMessage(defaultPosWaCustomMessage)
   }, [defaultPosWaCustomMessage])

   useEffect(() => {
      setShiftState(initialShiftSnapshot)
      setShiftNotice(initialShiftSnapshot.message)
      setShiftRegisterCode(initialShiftSnapshot.config.defaultRegisterCode || 'REG-1')
   }, [initialShiftSnapshot])

   useEffect(() => {
      setShiftHistory(initialShiftHistory || createEmptyShiftHistory(initialShiftSnapshot))
   }, [initialShiftHistory, initialShiftSnapshot])

   useEffect(() => {
      if (!activeBranchId) {
         setSelectedWarehouseId('')
         return
      }

      if (warehouses.some((warehouse: any) => warehouse.id === selectedWarehouseId)) {
         return
      }

      if (warehouses.length === 1) {
         setSelectedWarehouseId(warehouses[0].id)
         return
      }

      setSelectedWarehouseId('')
   }, [activeBranchId, warehouses, selectedWarehouseId])

   // ─────────────────────────────────────────────────────────────
   // AUTO-ROUTER: REKENING KASIR DI-SET OTOMATIS BERDASARKAN METODE BAYAR
   // (Nantinya Admin bisa mengubah pemetaan ini di Menu Pengaturan -> Organisasi)
   // ─────────────────────────────────────────────────────────────
   useEffect(() => {
      const targetAccountId = sourceAccountByMethod[paymentMethod] || resolveDefaultPosAccountId(posAccountOptions, paymentMethod)
      if (targetAccountId) setSelectedAccount(targetAccountId)
      else if (posAccountOptions.length > 0) setSelectedAccount(posAccountOptions[0].id)
   }, [paymentMethod, posAccountOptions, sourceAccountByMethod])

   useEffect(() => {
      if (activeShiftSession) return

      setShiftCashAccountId((current) => current && posAccountOptions.some((account) => account.id === current) ? current : fallbackCashAccountId)
      setShiftTransferAccountId((current) => current && posAccountOptions.some((account) => account.id === current) ? current : fallbackTransferAccountId)
      setShiftQrisAccountId((current) => current && posAccountOptions.some((account) => account.id === current) ? current : fallbackQrisAccountId)
   }, [posAccountOptions, activeShiftSession, fallbackCashAccountId, fallbackTransferAccountId, fallbackQrisAccountId])

   useEffect(() => {
      if (activeShiftSession) return

      setShiftOpeningSourceAccountId((current) => {
         if (
            current &&
            current !== shiftCashAccountId &&
            posAccountOptions.some((account) => account.id === current)
         ) {
            return current
         }

         return fallbackOpeningSourceAccountId
      })
   }, [posAccountOptions, activeShiftSession, shiftCashAccountId, fallbackOpeningSourceAccountId])

   useEffect(() => {
      if (!showSettlementModal) return

      const sourceAccountId = latestClosedShift
         ? (settlementMethod === 'CASH'
            ? latestClosedShift.cashAccountId
            : settlementMethod === 'TRANSFER'
              ? latestClosedShift.transferAccountId
              : latestClosedShift.qrisAccountId)
         : null

      const preferredTarget = accounts.find((account) => account.id !== sourceAccountId && (
         String(account.name || '').toLowerCase().includes('bank')
         || String(account.code || '').startsWith('1102')
         || String(account.name || '').toLowerCase().includes('kas')
      )) || accounts.find((account) => account.id !== sourceAccountId)

      setSettlementTargetAccountId(preferredTarget?.id || '')
      setSettlementAmountInput(formatMoneyInput(settlementRemaining))
      setSettlementAuthorizerNik(latestClosedShift?.cashierNik || '')
      setSettlementAuthorizerPassword('')
   }, [showSettlementModal, settlementMethod, settlementRemaining, latestClosedShift, accounts])

   function resetPOS() {
      setSuccessData(null)
      setShowPayment(false)
      setAppliedPromo(null)
   }

   async function refreshShiftHistory(mode: 'replace' | 'append' = 'replace') {
      if (!shiftState.enabled || !shiftState.schemaReady) {
         setShiftHistory(createEmptyShiftHistory(shiftState))
         return
      }

      const beforeDateKey = mode === 'append' ? shiftHistory.nextBeforeDateKey : null
      if (mode === 'append' && !beforeDateKey) return

      setHistoryBusy(true)
      const result = await getPosShiftHistory(orgId, {
         beforeDateKey,
         dayLimit: 7,
      })
      setHistoryBusy(false)

      setShiftHistory((current) => {
         if (mode === 'replace') return result

         const mergedDays = [...current.days, ...result.days]
         const dayMap = new Map(mergedDays.map((day) => [day.dateKey, day]))

         return {
            ...result,
            days: Array.from(dayMap.values()).sort((left, right) => right.dateKey.localeCompare(left.dateKey)),
         }
      })
   }


   // ─────────────────────────────────────────────────────────────
   // SHORTCUT KEYBOARD KASIR PINTAR (Spacebar = Lanjutkan Transaksi)
   // ─────────────────────────────────────────────────────────────
   useEffect(() => {
      const handleGlobalShortcut = (e: KeyboardEvent) => {
         // Jika layar Sukses sedang terbuka, abaikan input lain, cukup tekan Spasi untuk mereset keranjang
         if (successData && e.code === 'Space') {
            e.preventDefault() // Cegah halaman web menggulung (scroll down)
            resetPOS()
         }
      }
      window.addEventListener('keydown', handleGlobalShortcut)
      return () => window.removeEventListener('keydown', handleGlobalShortcut)
   }, [successData])

   // ─────────────────────────────────────────────────────────────
   // INTEGRASI ALAT SCANNER BARCODE (OTOMATIS TANPA KLIK INPUT CARI)
   // ─────────────────────────────────────────────────────────────
   const barcodeBuffer = useRef('')
   const barcodeTimer = useRef<NodeJS.Timeout | null>(null)

   useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
         const tag = (e.target as HTMLElement).tagName.toLowerCase()
         // Jika layar Sukses sedang muncul atau kursor kasir ada di dalam kotak ketik, abaikan scanner ghaib
         if (tag === 'input' || tag === 'textarea' || tag === 'select' || successData) return

         if (e.key === 'Enter') {
            if (barcodeBuffer.current.length >= 2) {
               const scannedCode = barcodeBuffer.current.trim()
               
               if (showPayment) {
                  // Mode Pembayaran -> Tangkap tembakan Barcode Scanner sebagai Kupon/Voucher Diskon
                  void handleApplyPromo(scannedCode)
               } else {
                  // Mode Katalog -> Tangkap tembakan Scanner sebagai SKU Produk (Tambah ke keranjang)
                  const product = products.find((p: any) =>
                     p.sku && p.sku.toLowerCase() === scannedCode.toLowerCase()
                  )
                  if (product) {
                     if (!activeBranchId) {
                        alert(branchGuardMessage)
                        return
                     }

                     setCart((prev: any[]) => {
                        const stockTracked = isStockTrackedProduct(product)
                        const existing = prev.find((item: any) => item.id === product.id)
                        if (existing) {
                           if (stockTracked && existing.qty + 1 > (product.stock || 0)) {
                              alert(`Peringatan: Stok '${product.name}' tidak mencukupi (Tersedia: ${formatStockQty(product.stock || 0)}).`)
                              return prev
                           }
                           return prev.map((item: any) => item.id === product.id ? { ...item, qty: item.qty + 1 } : item)
                        }
                        if (stockTracked && (product.stock || 0) <= 0) {
                           alert(`Gagal: Stok '${product.name}' sedang kosong. Transaksi tidak dapat dilanjutkan untuk produk ini.`)
                           return prev
                        }
                        return [...prev, {
                           id: product.id,
                           name: product.name,
                           price: product.selling_price,
                           qty: 1,
                           sku: product.sku,
                           unit: product.unit || 'Pcs',
                           stock: product.stock,
                           type: product.type || 'INVENTORY',
                        }]
                     })
                  } else {
                     console.warn('Barcode Produk tidak dikenali:', scannedCode)
                  }
               }
            }
            // Reset buffer setelah enter
            barcodeBuffer.current = ''
            if (barcodeTimer.current) clearTimeout(barcodeTimer.current)
            return
         }

         // Hanya tangkap input karakter (bukan Shift/Ctrl dll)
         if (e.key.length === 1) {
            barcodeBuffer.current += e.key
            
            // Scanner fisik mengirim huruf dengan sangat cepat (< 30ms per huruf).
            // Manusia mengetik lebih lambat. Jadi jika jeda lebih dari 80ms, anggap itu manusia, reset buffer!
            if (barcodeTimer.current) clearTimeout(barcodeTimer.current)
            barcodeTimer.current = setTimeout(() => {
               barcodeBuffer.current = ''
            }, 80)
         }
      }

      window.addEventListener('keydown', handleKeyDown)
      return () => {
         window.removeEventListener('keydown', handleKeyDown)
         if (barcodeTimer.current) clearTimeout(barcodeTimer.current)
      }
   }, [products, showPayment, successData, selectedCustomer, showAddCustomer, newCustomerName, newCustomerPhone, promoCode, activeBranchId, branchGuardMessage])

   const filteredProducts = useMemo(() => {
      if (!searchTerm) return products
      return products.filter((p: any) =>
         p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
         (p.sku || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
   }, [products, searchTerm])

   const cartSubtotal = Math.round(cart.reduce((sum: number, item: any) => sum + (item.price * item.qty), 0))
   
   // Promo Logic Computation
   const manualDiscount = Math.round(Number(discountAmount.replace(/\D/g, '')) || 0)
   const promoDiscount = appliedPromo 
      ? Math.round(appliedPromo.type === 'PERCENT' ? cartSubtotal * (appliedPromo.value / 100) : appliedPromo.value)
      : 0
   const parsedDiscount = clampDiscountAmount(manualDiscount + promoDiscount, cartSubtotal)

   const taxableSubtotal = Math.max(0, cartSubtotal - parsedDiscount)
   const taxNominal = Math.round(taxableSubtotal * (taxPercent / 100))
   const grandTotal = Math.round(taxableSubtotal + taxNominal)
   const changeDue = Math.round(Number(amountTendered.replace(/\D/g, ''))) - grandTotal

   const addToCart = (product: any) => {
      if (!activeBranchId) {
         alert(branchGuardMessage)
         return
      }

      const stockTracked = isStockTrackedProduct(product)
      if (stockTracked && (product.stock || 0) <= 0) {
         alert(`Gagal: Stok '${product.name}' sedang kosong. Transaksi tidak dapat dilanjutkan untuk produk ini.`)
         return
      }

      setCart((prev: any[]) => {
         const existing = prev.find((item: any) => item.id === product.id)
         if (existing) {
            if (stockTracked && existing.qty + 1 > (product.stock || 0)) {
               alert(`Peringatan: Stok '${product.name}' tidak mencukupi (Tersedia: ${product.stock}).`)
               return prev
            }
            return prev.map((item: any) => item.id === product.id ? { ...item, qty: item.qty + 1 } : item)
         }
         return [...prev, {
            id: product.id,
            name: product.name,
            price: product.selling_price,
            qty: 1,
            sku: product.sku,
            stock: product.stock,
            unit: product.unit || 'Pcs',
            type: product.type || 'INVENTORY',
         }]
      })
   }

   const updateQty = (id: string, delta: number) => {
      setCart((prev: any[]) => prev.map((item: any) => {
         if (item.id === id) {
            const newQty = Math.max(1, item.qty + delta)
            if (delta > 0 && isStockTrackedProduct(item) && newQty > (item.stock || 0)) {
               alert(`Stok '${item.name}' tidak mencukupi (Tersedia: ${formatStockQty(item.stock || 0)}).`)
               return item
            }
            return { ...item, qty: newQty }
         }
         return item
      }))
   }

   const removeLine = (id: string) => setCart((prev: any[]) => prev.filter((item: any) => item.id !== id))

   const buildReceiptMessage = (data: Pick<PosSuccessData, 'customerName' | 'saleId' | 'items' | 'subtotal' | 'discount' | 'tax' | 'total' | 'customWaMessage'>) => {
      return buildPosWhatsappReceiptMessage({
         customerName: data.customerName,
         saleId: data.saleId,
         items: (data.items ?? []).map((item) => ({
            name: item.name,
            qty: item.qty,
            price: item.price,
            unit: item.unit || null,
         })),
         subtotal: data.subtotal,
         discount: data.discount,
         tax: data.tax,
         total: data.total,
         customMessage: data.customWaMessage,
      })
   }

   const openWhatsappReceipt = (phone: string, message: string) => {
      const normalizedPhone = normalizeWhatsappPhone(phone)
      if (!normalizedPhone) return false
      window.open(`https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`, '_blank')
      return true
   }

   const handleOpenShift = async () => {
      if (!activeBranchId) {
         alert(branchGuardMessage)
         return
      }
      if (!openShiftCashierNik.trim() || !openShiftCashierPassword) {
         alert('Isi login NIK kasir beserta sandinya untuk membuka shift.')
         return
      }
      const openingCashAmount = parseMoneyInput(openingCashInput)
      if (openingCashAmount > 0 && !shiftCashAccountId) {
         alert('Pilih akun kas laci terlebih dahulu untuk menjurnal modal awal shift.')
         return
      }
      if (openingCashAmount > 0 && !shiftOpeningSourceAccountId) {
         alert('Pilih akun sumber modal awal terlebih dahulu.')
         return
      }
      if (
         openingCashAmount > 0 &&
         shiftCashAccountId &&
         shiftOpeningSourceAccountId &&
         shiftCashAccountId === shiftOpeningSourceAccountId
      ) {
         alert('Akun sumber modal awal tidak boleh sama dengan akun kas laci.')
         return
      }

      setShiftBusy(true)
      const result = await openPosShift(orgId, {
         openingCash: openingCashAmount,
         registerCode: shiftRegisterCode,
         openingNotes: openShiftNotes,
         cashAccountId: shiftCashAccountId || null,
         transferAccountId: shiftTransferAccountId || null,
         qrisAccountId: shiftQrisAccountId || null,
         openingSourceAccountId: shiftOpeningSourceAccountId || null,
         cashierNik: openShiftCashierNik,
         cashierPassword: openShiftCashierPassword,
      })
      setShiftBusy(false)

      if (result?.error) {
         alert(result.error)
         return
      }
      if (!result?.session) {
         alert('Shift POS berhasil dibuka, tetapi snapshot sesi belum tersedia.')
         return
      }

      setShiftState((current) => ({
         ...current,
         schemaReady: true,
         openSession: result.session || null,
         latestClosedSession: current.latestClosedSession,
         message: null,
      }))
      setShiftNotice(
         result.warning || (openingCashAmount > 0
            ? 'Shift POS berhasil dibuka. Modal awal kas sudah dijurnal otomatis.'
            : null)
      )
      setShowOpenShiftModal(false)
      setOpeningCashInput('')
      setOpenShiftNotes('')
      setOpenShiftCashierNik('')
      setOpenShiftCashierPassword('')
      if (result?.session?.registerCode) {
         setShiftRegisterCode(result.session.registerCode)
      }
   }

   const handleCloseShift = async () => {
      if (!activeShiftSession?.id) {
         alert('Tidak ada shift aktif yang bisa ditutup.')
         return
      }
      if (cart.length > 0) {
         alert('Selesaikan atau kosongkan keranjang terlebih dahulu sebelum menutup shift.')
         return
      }
      const hasCloseShiftNik = closeShiftCashierNik.trim().length > 0
      const hasCloseShiftPassword = closeShiftCashierPassword.length > 0
      if (hasCloseShiftNik !== hasCloseShiftPassword) {
         alert(canUsePrivilegedCloseShiftOverride
            ? 'Isi login NIK dan sandi kasir secara lengkap, atau kosongkan keduanya untuk memakai sesi owner/admin yang membuka shift ini.'
            : 'Isi login NIK kasir beserta sandinya untuk menutup shift.')
         return
      }

      setShiftBusy(true)
      const result = await closePosShift(orgId, {
         sessionId: activeShiftSession.id,
         closingCash: parseMoneyInput(closingCashInput),
         closingNotes: closeShiftNotes,
         cashierNik: closeShiftCashierNik,
         cashierPassword: closeShiftCashierPassword,
      })

      if (result?.error) {
         setShiftBusy(false)
         alert(result.error)
         return
      }
      if (!result?.session) {
         setShiftBusy(false)
         alert('Shift POS berhasil ditutup, tetapi ringkasan sesi belum tersedia.')
         return
      }

      setShiftState((current) => ({
         ...current,
         schemaReady: true,
         openSession: null,
         latestClosedSession: result.session || null,
         message: result.warning || null,
      }))
      setShiftNotice(result.warning || 'Shift POS berhasil ditutup. Review laporan shift harian, lalu klik Logout POS untuk keluar.')
      setShowShiftHistory(true)
      setShowCloseShiftModal(false)
      setClosingCashInput('')
      setCloseShiftNotes('')
      setCloseShiftCashierNik('')
      setCloseShiftCashierPassword('')
      await refreshShiftHistory('replace')
      setShiftBusy(false)
   }

   const handleSettlement = async () => {
      if (!latestClosedShift?.id) {
         alert('Belum ada shift tertutup yang siap disettlement.')
         return
      }

      const amount = parseMoneyInput(settlementAmountInput) || settlementRemaining
      if (!settlementTargetAccountId) {
         alert('Pilih akun tujuan settlement terlebih dahulu.')
         return
      }
      if (!settlementAuthorizerNik.trim() || !settlementAuthorizerPassword) {
         alert('Isi login NIK dan sandi kasir/otorisator untuk settlement.')
         return
      }

      setShiftBusy(true)
      const result = await settlePosShift(orgId, {
         sessionId: latestClosedShift.id,
         settlementMethod,
         targetAccountId: settlementTargetAccountId,
         amount,
         notes: settlementNotes,
         authorizerNik: settlementAuthorizerNik,
         authorizerPassword: settlementAuthorizerPassword,
      })

      if (result?.error) {
         setShiftBusy(false)
         alert(result.error)
         return
      }
      if (!result?.session) {
         setShiftBusy(false)
         alert('Settlement berhasil diposting, tetapi snapshot sesi belum tersedia.')
         return
      }

      setShiftState((current) => ({
         ...current,
         latestClosedSession: result.session || null,
         message: null,
      }))
      setShiftNotice('Settlement shift POS berhasil diposting ke jurnal.')
      setSettlementAmountInput('')
      setSettlementNotes('')
      setSettlementAuthorizerNik('')
      setSettlementAuthorizerPassword('')
      setShowSettlementModal(false)
      await refreshShiftHistory('replace')
      setShiftBusy(false)
   }

   const handlePay = async () => {
      if (!activeBranchId) {
         alert(branchGuardMessage)
         return
      }
      if (shouldEnforceShift && !activeShiftSession?.id) {
         alert('Buka shift POS terlebih dahulu sebelum checkout.')
         return
      }
      if (requiresWarehouseSelection && !selectedWarehouseId) {
         alert('Pilih gudang pengeluaran terlebih dahulu.')
         return
      }
      if (!selectedAccount) { alert('Pilih laci kas/rekening penerima lebih dulu.'); return }
      if (paymentMethod === 'CASH' && Number(amountTendered.replace(/\D/g, '')) < grandTotal) {
         alert('Nominal uang tunai kurang dari total tagihan.')
         return
      }

      setLoading(true)
      const payload = {
         customer_id: selectedCustomer || null,
         new_customer_name: showAddCustomer ? newCustomerName : null,
         new_customer_phone: showAddCustomer ? newCustomerPhone : null,
         account_id: selectedAccount,
         pos_shift_session_id: activeShiftSession?.id || null,
         payment_method: paymentMethod,
         amount_tendered: paymentMethod === 'CASH'
            ? (amountTendered ? Number(amountTendered.replace(/\D/g, '')) : grandTotal)
            : grandTotal,
         change_amount: paymentMethod === 'CASH' && changeDue > 0 ? changeDue : 0,
         warehouse_id: requiresWarehouseSelection ? selectedWarehouseId : null,
         lines: cart.map((c: any) => ({ product_id: c.id, product_name: c.name, quantity: c.qty, unit_price: c.price })),
         discount_amount: parsedDiscount,
         tax_amount: taxNominal,
         promo_code: appliedPromo?.code || null,
         notes: `POS - ${paymentMethod}${showAddCustomer ? ` | Pelanggan Baru: ${newCustomerName} (${newCustomerPhone})` : ''}${appliedPromo ? ` | [VOUCHER REDEEMED: ${appliedPromo.code}]` : ''}`
      }

      const res = await processPosTransaction(orgId, payload)
      if (res?.error) alert(res.error)
      else if (!res?.saleId) {
         alert('Transaksi POS selesai, tetapi nomor sale tidak ditemukan.')
      }
      else {
         let waPhone = ''
         let waName = 'Pelanggan'
         if (showAddCustomer && newCustomerPhone) {
            waPhone = newCustomerPhone
            waName = newCustomerName
         } else if (selectedCustomer) {
            const cust = customers.find((c: any) => c.id === selectedCustomer)
            if (cust) { waPhone = cust.phone; waName = cust.name }
         }

         const nextSuccessData: PosSuccessData = {
            total: grandTotal,
            change: changeDue > 0 ? changeDue : 0,
            saleId: res.saleId,
            waPhone: waPhone,
            customerName: waName,
            items: [...cart],
            discount: parsedDiscount,
            tax: taxNominal,
            subtotal: cartSubtotal,
            method: paymentMethod,
            tendered: amountTendered ? Number(amountTendered.replace(/\D/g, '')) : grandTotal,
            customWaMessage: customWaMessage.trim(),
         }

         setSuccessData(nextSuccessData)
         if (activeShiftSession?.id) {
            setShiftState((current) => {
               if (!current.openSession || current.openSession.id !== activeShiftSession.id) return current

               const nextByMethod = {
                  ...current.openSession.totals.byMethod,
                  [paymentMethod]: current.openSession.totals.byMethod[paymentMethod] + grandTotal,
               }
               const nextTotalChange = current.openSession.totals.totalChange + (paymentMethod === 'CASH' && changeDue > 0 ? changeDue : 0)
               const nextExpectedCash = current.openSession.openingCash + nextByMethod.CASH - nextTotalChange

               return {
                  ...current,
                  openSession: {
                     ...current.openSession,
                     expectedCash: nextExpectedCash,
                     totals: {
                        ...current.openSession.totals,
                        transactionCount: current.openSession.totals.transactionCount + 1,
                        grossSales: current.openSession.totals.grossSales + grandTotal,
                        subtotalSales: current.openSession.totals.subtotalSales + cartSubtotal,
                        discountAmount: current.openSession.totals.discountAmount + parsedDiscount,
                        taxAmount: current.openSession.totals.taxAmount + taxNominal,
                        totalChange: nextTotalChange,
                        byMethod: nextByMethod,
                        remainingByMethod: {
                           ...current.openSession.totals.remainingByMethod,
                           CASH: nextExpectedCash - current.openSession.totals.settledByMethod.CASH,
                           TRANSFER: nextByMethod.TRANSFER - current.openSession.totals.settledByMethod.TRANSFER,
                           QRIS: nextByMethod.QRIS - current.openSession.totals.settledByMethod.QRIS,
                        },
                     },
                  },
               }
            })
         }
         
         // 1. Auto-Open WhatsApp IF Phone is Provided (Must be synchronous/close to click to avoid pop-up blockers)
         if (waPhone) {
            openWhatsappReceipt(waPhone, buildReceiptMessage(nextSuccessData))
         }

         // 2. Auto Pop-up Print Struk (Delayed slightly so WA opens smoothly first)
         setTimeout(() => window.print(), 800)

         setCart([])
         setAmountTendered('')
         setSelectedCustomer('')
         setDiscountAmount('')
         setShowAddCustomer(false)
         setCustomWaMessage(defaultPosWaCustomMessage)
         setNewCustomerName('')
         setNewCustomerPhone('')
         setIsMobileCartOpen(false)
      }
      setLoading(false)
   }

   const sendWaReceipt = () => {
      if (!successData) return
      const phone = successData.waPhone || ''
      if (!phone) { alert('Nomor WA Pelanggan tidak ada.'); return }
      openWhatsappReceipt(phone, buildReceiptMessage(successData))
   }

   const getAccountName = (accountId?: string | null) => {
      if (!accountId) return 'Belum diatur'
      return accounts.find((account) => account.id === accountId)?.name || 'Akun tidak ditemukan'
   }

   const openCloseShiftFlow = () => {
      if (!activeShiftSession) return

      setClosingCashInput(formatMoneyInput(activeShiftSession.expectedCash))
      setCloseShiftCashierNik(activeShiftSession.cashierNik || '')
      setCloseShiftCashierPassword('')
      setShiftNotice('Tutup shift terlebih dahulu sebelum keluar dan logout dari POS.')
      setShowCloseShiftModal(true)
   }

   async const handleExitPos = () => {
      if (cart.length > 0) {
         alert('Selesaikan atau kosongkan keranjang terlebih dahulu sebelum keluar dari POS.')
         return
      }

      if (activeShiftSession?.id) {
         openCloseShiftFlow()
         return
      }

      const pendingSettlementTotal = availableSettlement.CASH + availableSettlement.TRANSFER + availableSettlement.QRIS
      const confirmMessage = latestClosedShift?.id
         ? pendingSettlementTotal > 0
            ? `Shift ${latestClosedShift.registerCode} sudah ditutup. Laporan shift sudah tersedia di halaman ini, tetapi masih ada pending settlement sebesar ${formatRupiah(pendingSettlementTotal)}. Logout POS sekarang?`
            : `Shift ${latestClosedShift.registerCode} sudah ditutup. Pastikan laporan shift harian sudah dicek. Logout POS sekarang?`
         : 'Logout dari POS sekarang?'

      if (!await confirm(confirmMessage)) return
      window.location.assign('/auth/signout')
   }

   return (
      <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col h-screen overflow-hidden">
         {/* Top Bar Navigation (POS Specific) */}
         <div className="h-16 bg-[#003366] text-white flex items-center justify-between px-4 md:px-6 shadow-md shrink-0 z-50 w-full relative">
            <div className="flex items-center gap-3 md:gap-4">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/20 overflow-hidden">
                   {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                   ) : (
                      <MonitorSmartphone size={20} className="text-white" />
                   )}
                </div>
                <div>
                   <h1 className="text-sm md:text-lg font-semibold tracking-tight leading-none">{orgSettings.brand_name || 'Nizam POS'}</h1>
                  <div className="text-[8px] md:text-[10px] font-bold text-white/70 uppercase tracking-wide flex items-center gap-1 mt-0.5">
                     <MapPin size={8} className="md:w-[10px]" /> {activeBranchName || 'Pilih Unit Aktif'}
                  </div>
               </div>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
               <div className="px-3 py-1.5 bg-white/10 rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold border border-white/10 flex items-center gap-2">
                  <User size={12} className="md:w-[14px]" /> <span className="hidden sm:inline">{currentUserDisplayName || currentUser?.email?.split('@')[0]}</span>
               </div>
               <button
                  type="button"
                  onClick={handleExitPos}
                  disabled={loading || shiftBusy}
                  className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg md:rounded-xl text-[10px] md:text-xs font-semibold uppercase tracking-wide transition-colors shadow-sm cursor-pointer block disabled:opacity-50 disabled:cursor-not-allowed"
               >
                  <span className="md:hidden">{activeShiftSession ? 'SHIFT' : 'LOGOUT'}</span>
                  <span className="hidden md:inline">{activeShiftSession ? 'Tutup Shift' : 'Logout POS'}</span>
               </button>
            </div>
         </div>

         {!shiftState.enabled && (
            <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 md:px-6 py-3 text-[11px] font-medium text-amber-800 flex items-start gap-2">
               <ShieldAlert size={14} className="mt-0.5 shrink-0" />
               <span>
                  Mode shift POS sedang nonaktif. Jika POS wajib dibuka dengan login NIK kasir, aktifkan
                  {' '}<strong>Wajib Buka Shift Sebelum Checkout POS</strong> di Pengaturan Bisnis.
               </span>
            </div>
         )}

         {shiftState.enabled && (
            <div className="shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
               <div className="px-4 md:px-6 py-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                     <div className={`px-3 py-2 rounded-xl border text-[10px] md:text-xs font-semibold uppercase tracking-wide flex items-center gap-2 ${
                        activeShiftSession
                           ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                           : 'border-amber-200 bg-amber-50 text-amber-700'
                     }`}>
                        <Clock3 size={14} />
                        {activeShiftSession ? `Shift Aktif ${activeShiftSession.registerCode}` : 'Shift Belum Dibuka'}
                     </div>
                     {activeShiftSession && (
                        <div className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-[10px] md:text-xs font-bold text-slate-600 flex items-center gap-2">
                           <Wallet size={14} className="text-blue-600" />
                           Expected Cash {formatRupiah(activeShiftSession.expectedCash)}
                        </div>
                     )}
                     {activeShiftSession?.openedAt && (
                        <div className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-[10px] md:text-xs font-bold text-slate-600 flex items-center gap-2">
                           <Clock3 size={14} className="text-slate-500" />
                           Buka {formatShiftTimestamp(activeShiftSession.openedAt)}
                        </div>
                     )}
                     {activeShiftCashierLabel && (
                        <div className="px-3 py-2 rounded-xl border border-sky-200 bg-sky-50 text-[10px] md:text-xs font-bold text-sky-700 flex items-center gap-2">
                           <User size={14} className="text-sky-600" />
                           Kasir {activeShiftCashierLabel}
                        </div>
                     )}
                     {!activeShiftSession && latestClosedShift && shiftState.enableSettlement && hasAnySettlementBalance && (
                        <div className="px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 text-[10px] md:text-xs font-bold text-blue-700 flex items-center gap-2">
                           <ArrowRightLeft size={14} />
                           Pending Settlement {formatRupiah(
                              availableSettlement.CASH + availableSettlement.TRANSFER + availableSettlement.QRIS
                           )}
                        </div>
                     )}
                     {!activeShiftSession && latestClosedShift?.closedAt && (
                        <div className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-[10px] md:text-xs font-bold text-slate-600 flex items-center gap-2">
                           <Clock3 size={14} className="text-slate-500" />
                           Tutup {formatShiftTimestamp(latestClosedShift.closedAt)}
                        </div>
                     )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                     {shiftState.schemaReady && (
                        <button
                           type="button"
                           onClick={() => setShowShiftHistory((current) => !current)}
                           className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-[10px] md:text-xs font-semibold uppercase tracking-wide text-slate-600 hover:border-slate-300 hover:text-slate-900 transition-all shadow-sm flex items-center gap-2"
                        >
                           <CalendarDays size={14} />
                           Histori {historyShiftCount > 0 ? `${historyShiftCount} Shift` : 'Harian'}
                           {showShiftHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                     )}
                     {!activeShiftSession && shiftState.schemaReady && (
                        <button
                           type="button"
                           onClick={() => {
                              setShiftNotice(null)
                              setOpenShiftCashierNik('')
                              setOpenShiftCashierPassword('')
                              setShowOpenShiftModal(true)
                           }}
                           className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-[10px] md:text-xs font-semibold uppercase tracking-wide hover:bg-black transition-all shadow-sm"
                        >
                           Buka Shift
                        </button>
                     )}
                     {activeShiftSession && (
                        <button
                           type="button"
                           onClick={() => {
                              setClosingCashInput(formatMoneyInput(activeShiftSession.expectedCash))
                              setCloseShiftCashierNik(activeShiftSession.cashierNik || '')
                              setCloseShiftCashierPassword('')
                              setShiftNotice(null)
                              setShowCloseShiftModal(true)
                           }}
                           className="px-4 py-2.5 rounded-xl bg-rose-600 text-white text-[10px] md:text-xs font-semibold uppercase tracking-wide hover:bg-rose-700 transition-all shadow-sm"
                        >
                           Tutup Shift
                        </button>
                     )}
                     {!activeShiftSession && shiftState.enableSettlement && shiftState.schemaReady && latestClosedShift && hasAnySettlementBalance && (
                        <button
                           type="button"
                           onClick={() => {
                              setShiftNotice(null)
                              setSettlementMethod('CASH')
                              setSettlementNotes('')
                              setShowSettlementModal(true)
                           }}
                           className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-[10px] md:text-xs font-semibold uppercase tracking-wide hover:bg-blue-700 transition-all shadow-sm"
                        >
                           Settlement
                        </button>
                     )}
                  </div>
               </div>

               {(shiftNotice || !shiftState.schemaReady) && (
                  <div className={`px-4 md:px-6 pb-3 text-[11px] font-medium leading-relaxed flex items-start gap-2 ${
                     shiftState.schemaReady ? 'text-amber-700' : 'text-rose-700'
                  }`}>
                     <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                     <span>{shiftNotice || 'Schema shift POS belum tersedia. Jalankan migration lebih dahulu agar shift/settlement aktif penuh.'}</span>
                  </div>
               )}

               {shiftState.schemaReady && showShiftHistory && (
                  <div className="px-4 md:px-6 pb-4">
                     <div className="rounded-xl border border-slate-200 bg-slate-50/80 overflow-hidden">
                        <div className="px-4 md:px-5 py-4 border-b border-slate-200 bg-white/80 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                           <div>
                              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">Rekam Shift Per Hari</div>
                              <div className="text-sm md:text-base font-semibold text-slate-900 mt-1">
                                 {historyShiftCount > 0
                                    ? `${historyShiftCount} shift terekam di unit ${activeBranchName || 'aktif'}`
                                    : 'Belum ada histori shift tersimpan'}
                              </div>
                              <div className="text-[11px] text-slate-500 font-medium mt-1">
                                 Riwayat harian menampilkan kasir, jam shift, penjualan, selisih kas, dan log settlement per sesi.
                              </div>
                           </div>
                           <div className="flex flex-wrap items-center gap-2">
                              {historyBusy && (
                                 <div className="px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 text-[10px] md:text-xs font-bold text-blue-700">
                                    Memuat histori...
                                 </div>
                              )}
                              {!historyBusy && (
                                 <button
                                    type="button"
                                    onClick={() => refreshShiftHistory('replace')}
                                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-[10px] md:text-xs font-semibold uppercase tracking-wide text-slate-600 hover:text-slate-900 hover:border-slate-300"
                                 >
                                    Refresh
                                 </button>
                              )}
                           </div>
                        </div>

                        <div className="max-h-[360px] overflow-y-auto px-4 md:px-5 py-4 space-y-4">
                           {shiftHistory.message && (
                              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] font-medium text-amber-800">
                                 {shiftHistory.message}
                              </div>
                           )}

                           {shiftHistory.days.length === 0 && !shiftHistory.message && (
                              <div className="rounded-xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center">
                                 <div className="text-sm font-semibold text-slate-700">Belum ada shift tertutup</div>
                                 <div className="text-[11px] font-medium text-slate-500 mt-2">
                                    Setelah shift ditutup, histori hariannya akan muncul di sini lengkap dengan status settlement.
                                 </div>
                              </div>
                           )}

                           {shiftHistory.days.map((day) => (
                              <div key={day.dateKey} className="rounded-[24px] border border-slate-200 bg-white overflow-hidden shadow-sm">
                                 <div className="px-4 md:px-5 py-4 border-b border-slate-100 bg-slate-50/70 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div>
                                       <div className="text-sm md:text-base font-semibold text-slate-900">{formatShiftDayLabel(day.dateKey)}</div>
                                       <div className="text-[11px] font-medium text-slate-500 mt-1">
                                          {day.totals.shiftCount} shift • {day.totals.transactionCount} transaksi • sales bruto {formatRupiah(day.totals.grossSales)}
                                       </div>
                                    </div>
                                    <div className={`px-3 py-2 rounded-xl border text-[10px] md:text-xs font-semibold uppercase tracking-wide ${
                                       day.totals.pendingSettlement > 0
                                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                                          : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    }`}>
                                       {day.totals.pendingSettlement > 0
                                          ? `Pending ${formatRupiah(day.totals.pendingSettlement)}`
                                          : 'Settlement Tuntas'}
                                    </div>
                                 </div>

                                 <div className="p-4 md:p-5 space-y-3">
                                    {day.sessions.map((session) => {
                                       const sessionPendingSettlement = (
                                          session.totals.remainingByMethod.CASH +
                                          session.totals.remainingByMethod.TRANSFER +
                                          session.totals.remainingByMethod.QRIS
                                       )
                                       const sessionCashierLabel = [
                                          String(session.cashierDisplayName || '').trim(),
                                          session.cashierNik ? `#${session.cashierNik}` : '',
                                       ].filter(Boolean).join(' • ')

                                       return (
                                          <div key={session.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
                                             <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                <div>
                                                   <div className="flex flex-wrap items-center gap-2">
                                                      <div className="text-sm font-semibold text-slate-900">{session.registerCode}</div>
                                                      <div className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide ${
                                                         sessionPendingSettlement > 0
                                                            ? 'bg-blue-100 text-blue-700'
                                                            : 'bg-emerald-100 text-emerald-700'
                                                      }`}>
                                                         {sessionPendingSettlement > 0 ? 'Belum Tuntas' : 'Tuntas'}
                                                      </div>
                                                   </div>
                                                   <div className="text-[11px] font-medium text-slate-500 mt-1">
                                                      {formatShiftClock(session.openedAt)} - {formatShiftClock(session.closedAt)} WIB • durasi {formatShiftDuration(session.openedAt, session.closedAt)}
                                                   </div>
                                                   {sessionCashierLabel && (
                                                      <div className="text-[11px] font-semibold text-sky-700 mt-1">
                                                         Kasir: {sessionCashierLabel}
                                                      </div>
                                                   )}
                                                   <div className="text-[11px] font-medium text-slate-500 mt-1">
                                                      Kas tutup {formatRupiah(session.closingCash ?? session.expectedCash)}
                                                   </div>
                                                </div>
                                                <div className="text-left md:text-right">
                                                   <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Sales Bruto</div>
                                                   <div className="text-sm md:text-base font-semibold text-slate-900">{formatRupiah(session.totals.grossSales)}</div>
                                                </div>
                                             </div>

                                             <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                                                <div className="rounded-xl border border-slate-200 bg-white p-3">
                                                   <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Transaksi</div>
                                                   <div className="mt-1 text-sm font-semibold text-slate-800">{session.totals.transactionCount}</div>
                                                </div>
                                                <div className="rounded-xl border border-slate-200 bg-white p-3">
                                                   <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Tunai</div>
                                                   <div className="mt-1 text-sm font-semibold text-slate-800">{formatRupiah(session.totals.byMethod.CASH)}</div>
                                                </div>
                                                <div className="rounded-xl border border-slate-200 bg-white p-3">
                                                   <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Transfer</div>
                                                   <div className="mt-1 text-sm font-semibold text-slate-800">{formatRupiah(session.totals.byMethod.TRANSFER)}</div>
                                                </div>
                                                <div className="rounded-xl border border-slate-200 bg-white p-3">
                                                   <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">QRIS</div>
                                                   <div className="mt-1 text-sm font-semibold text-slate-800">{formatRupiah(session.totals.byMethod.QRIS)}</div>
                                                </div>
                                                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                                                   <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Expected</div>
                                                   <div className="mt-1 text-sm font-semibold text-emerald-700">{formatRupiah(session.expectedCash)}</div>
                                                </div>
                                                <div className={`rounded-xl border p-3 ${
                                                   (session.varianceAmount || 0) === 0
                                                      ? 'border-slate-200 bg-white'
                                                      : (session.varianceAmount || 0) > 0
                                                         ? 'border-emerald-200 bg-emerald-50'
                                                         : 'border-rose-200 bg-rose-50'
                                                }`}>
                                                   <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Selisih</div>
                                                   <div className={`mt-1 text-sm font-semibold ${
                                                      (session.varianceAmount || 0) === 0
                                                         ? 'text-slate-800'
                                                         : (session.varianceAmount || 0) > 0
                                                            ? 'text-emerald-700'
                                                            : 'text-rose-700'
                                                   }`}>
                                                      {formatRupiah(session.varianceAmount || 0)}
                                                   </div>
                                                </div>
                                             </div>

                                             {(session.openingNotes || session.closingNotes) && (
                                                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                                                   <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Catatan Shift</div>
                                                   {session.openingNotes && (
                                                      <div className="text-[11px] font-medium text-slate-600">
                                                         Buka: {session.openingNotes}
                                                      </div>
                                                   )}
                                                   {session.closingNotes && (
                                                      <div className="text-[11px] font-medium text-slate-600">
                                                         Tutup: {session.closingNotes}
                                                      </div>
                                                   )}
                                                </div>
                                             )}

                                             <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                                                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                                                   <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Log Settlement</div>
                                                   <div className={`text-[10px] font-semibold uppercase tracking-wide ${
                                                      sessionPendingSettlement > 0 ? 'text-blue-600' : 'text-emerald-600'
                                                   }`}>
                                                      {sessionPendingSettlement > 0
                                                         ? `Sisa ${formatRupiah(sessionPendingSettlement)}`
                                                         : 'Sudah Tuntas'}
                                                   </div>
                                                </div>

                                                {session.settlements.length === 0 ? (
                                                   <div className="text-[11px] font-medium text-slate-500">
                                                      Belum ada settlement tercatat untuk shift ini.
                                                   </div>
                                                ) : (
                                                   <div className="space-y-2">
                                                      {session.settlements.map((settlement, index) => {
                                                         const settlementActorLabel = [
                                                            String(settlement.settledByDisplayName || '').trim(),
                                                            settlement.settledByNik ? `#${settlement.settledByNik}` : '',
                                                         ].filter(Boolean).join(' • ')

                                                         return (
                                                            <div key={`${session.id}-${settlement.method}-${settlement.createdAt || index}`} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                                                               <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                                                  <div>
                                                                     <div className="text-xs font-semibold text-slate-900">
                                                                        {settlement.method} {formatRupiah(settlement.grossAmount)}
                                                                     </div>
                                                                     <div className="text-[11px] font-medium text-slate-500 mt-1">
                                                                        {getAccountName(settlement.sourceAccountId)} → {getAccountName(settlement.targetAccountId)}
                                                                     </div>
                                                                     {settlement.notes && (
                                                                        <div className="text-[11px] font-medium text-slate-500 mt-1">
                                                                           Catatan: {settlement.notes}
                                                                        </div>
                                                                     )}
                                                                  </div>
                                                                  <div className="text-left md:text-right text-[11px] font-medium text-slate-500">
                                                                     <div>{formatShiftTimestamp(settlement.createdAt)}</div>
                                                                     {settlementActorLabel && <div className="mt-1">Oleh {settlementActorLabel}</div>}
                                                                     {settlement.feeAmount > 0 && <div className="mt-1">Fee {formatRupiah(settlement.feeAmount)}</div>}
                                                                     {settlement.journalEntryId && <div className="mt-1">Jurnal {settlement.journalEntryId.slice(0, 8)}</div>}
                                                                  </div>
                                                               </div>
                                                            </div>
                                                         )
                                                      })}
                                                   </div>
                                                )}
                                             </div>
                                          </div>
                                       )
                                    })}
                                 </div>
                              </div>
                           ))}
                        </div>

                        {shiftHistory.hasMore && shiftHistory.nextBeforeDateKey && (
                           <div className="px-4 md:px-5 py-4 border-t border-slate-200 bg-white/90 flex justify-center">
                              <button
                                 type="button"
                                 onClick={() => refreshShiftHistory('append')}
                                 disabled={historyBusy}
                                 className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-[10px] md:text-xs font-semibold uppercase tracking-wide text-slate-600 hover:text-slate-900 hover:border-slate-300 disabled:opacity-50"
                              >
                                 {historyBusy ? 'Memuat...' : 'Muat Hari Sebelumnya'}
                              </button>
                           </div>
                        )}
                     </div>
                  </div>
               )}
            </div>
         )}

         {/* Main Grid: Left (Products) | Right (Cart) */}
         <div className="flex-1 flex overflow-hidden relative">
            {/* Left: Products catalog */}
            <div className="flex-1 flex flex-col bg-white">
               {/* Search Area */}
               <div className="p-4 md:p-6 border-b border-slate-100 flex gap-4 shrink-0">
                  <div className="relative flex-1">
                     <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                     <input
                        type="text"
                        placeholder="Cari Produk..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full h-12 md:h-14 pl-12 pr-6 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 placeholder-slate-400 focus:border-blue-500 outline-none transition-all text-sm md:text-lg"
                        autoFocus
                     />
                  </div>
               </div>

               {/* Product Grid Layout */}
               <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/50 pb-32 md:pb-6">
                  {!activeBranchId ? (
                     <div className="h-full min-h-[320px] flex items-center justify-center">
                        <div className="max-w-md w-full bg-white border border-slate-200 rounded-[32px] shadow-sm p-8 text-center">
                           <div className="w-14 h-14 mx-auto rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                              <MapPin size={26} />
                           </div>
                           <h3 className="text-lg font-semibold text-slate-800 mb-2">Pilih Unit Aktif</h3>
                           <p className="text-sm font-medium text-slate-500 leading-relaxed">
                              POS hanya bisa dipakai di satu unit aktif. Pilih unit dari header terlebih dahulu agar stok dan jurnal tidak tercampur.
                           </p>
                        </div>
                     </div>
                  ) : (
                     <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 auto-rows-max overflow-visible">
                        {filteredProducts.map((p: any) => (
                           <button type="button"
                              key={p.id}
                              onClick={() => addToCart(p)}
                              className="bg-white p-3 md:p-4 rounded-xl border border-slate-200 shadow-sm hover:border-blue-500 hover:shadow-xl hover:-translate-y-1 transition-all text-left group flex flex-col min-h-[140px] md:h-44 relative z-0"
                           >
                              <div className="text-[8px] md:text-[10px] font-semibold text-blue-500 bg-blue-50 w-fit px-2 py-1 rounded-md mb-2">{p.sku || 'NO-SKU'}</div>
                              <h3 className="font-bold text-xs md:text-sm text-slate-800 leading-tight flex-1 line-clamp-3">{p.name}</h3>
                              <div className="text-sm md:text-lg font-semibold text-[#003366] mt-2 group-hover:scale-105 origin-left transition-transform">
                                 {formatRupiah(p.selling_price)}
                              </div>
                              {isStockTrackedProduct(p) ? (
                                 <div className={`mt-2 text-[9px] font-bold px-2 py-0.5 rounded-md w-fit ${p.stock <= 5 ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'}`}>
                                    Stok: {formatStockQty(p.stock || 0)} {p.unit || 'Pcs'}
                                 </div>
                              ) : (
                                 <div className="mt-2 text-[9px] font-bold px-2 py-0.5 rounded-md w-fit bg-emerald-50 text-emerald-600">
                                    {p.type === 'SERVICE' ? 'Jasa' : 'Non Stok'}
                                 </div>
                              )}
                           </button>
                        ))}
                     </div>
                  )}
               </div>
            </div>

            {/* Right: Shopping Cart (Overlay on Mobile, Sidebar on Desktop) */}
            <div className={`
            fixed inset-0 z-[60] md:relative md:inset-auto md:z-20 md:flex
            ${isMobileCartOpen ? 'flex' : 'hidden'}
          `}>
               <div className="md:hidden absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsMobileCartOpen(false)} />

               <div className="ml-auto w-[85%] sm:w-[450px] md:w-[400px] lg:w-[450px] bg-white border-l border-slate-200 shadow-md flex flex-col relative animate-in slide-in-from-right duration-300">
                  {/* Mobile Cart Header */}
                  <div className="md:hidden p-5 flex items-center justify-between bg-[#003366] text-white">
                     <h2 className="font-semibold uppercase tracking-wide text-sm">Pesanan Saya</h2>
                     <button type="button" onClick={() => setIsMobileCartOpen(false)} className="p-2 bg-white/10 rounded-lg"><X size={18} /></button>
                  </div>

                  {/* Customer Selection */}
                  <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50">
                     <div className="flex justify-between items-center mb-3">
                        <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 block">Database Pelanggan</label>
                        <button type="button" 
                           onClick={() => setShowAddCustomer(!showAddCustomer)} 
                           className={`px-3 py-1.5 rounded-full border-2 text-[11px] font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
                              showAddCustomer 
                              ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100' 
                              : 'border-[#003366] bg-white text-[#003366] hover:bg-blue-50'
                           }`}
                        >
                           {showAddCustomer ? <><X size={12} strokeWidth={3} /> Batal</> : <><UserPlus size={12} strokeWidth={3} /> Baru</>}
                        </button>
                     </div>

                     <AnimatePresence mode="popLayout">
                        {showAddCustomer ? (
                           <motion.div key="new-customer-fields" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden">
                              <input placeholder="Nama Pelanggan" value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} className="w-full h-10 px-3 border rounded-xl text-sm font-bold outline-none" />
                              <input placeholder="WhatsApp (08...)" value={newCustomerPhone} onChange={e => setNewCustomerPhone(e.target.value)} className="w-full h-10 px-3 border rounded-xl text-sm font-bold outline-none" />
                           </motion.div>
                        ) : (
                           <motion.div key="existing-customer-select" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="relative">
                              <User size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" />
                              <select
                                 value={selectedCustomer}
                                 onChange={e => setSelectedCustomer(e.target.value)}
                                 className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none appearance-none"
                              >
                                 <option value="">Pelanggan Walk-id</option>
                                 {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                           </motion.div>
                        )}
                     </AnimatePresence>
                  </div>

                  {/* Cart Items List */}
                  <div className="flex-1 overflow-y-auto w-full p-3 space-y-2 bg-white">
                     <AnimatePresence>
                        {cart.map(item => (
                           <motion.div
                              key={item.id}
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              className="p-3 bg-white border border-slate-100 rounded-xl flex items-center gap-3 shadow-sm"
                           >
                              <div className="flex-1 min-w-0">
                                 <div className="font-bold text-slate-800 text-xs truncate leading-tight">{item.name}</div>
                                 <div className="text-[10px] font-semibold text-blue-600 mt-1">{formatRupiah(item.price)} / {item.unit}</div>
                              </div>

                              <div className="flex items-center gap-1.5 bg-slate-50 rounded-xl p-1 border border-slate-100">
                                 <button type="button" onClick={() => updateQty(item.id, -1)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm"><Minus size={12} /></button>
                                 <span className="w-5 text-center font-semibold text-xs">{item.qty}</span>
                                 <button type="button" onClick={() => updateQty(item.id, +1)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-100 text-blue-600 shadow-sm"><Plus size={12} /></button>
                              </div>

                              <button type="button" onClick={() => removeLine(item.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-rose-300 hover:bg-rose-50 hover:text-rose-500">
                                 <Trash2 size={14} />
                              </button>
                           </motion.div>
                        ))}
                     </AnimatePresence>

                     {cart.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60 py-12">
                           <ShoppingCart size={40} className="mb-4 text-slate-200" />
                           <span className="text-[10px] font-semibold uppercase tracking-wide">Kosong</span>
                        </div>
                     )}
                  </div>

                  {/* Cart Totals & Checkout Button */}
                  <div className="bg-slate-900 text-white shadow-[0_-10px_40px_rgba(0,0,0,0.1)] md:rounded-t-[32px] overflow-hidden">
                     <div className="p-4 md:p-6 pb-2 border-b border-white/10 flex flex-col gap-2">
                        <div className="flex justify-between items-center text-[10px]">
                           <span className="font-semibold uppercase tracking-wide text-slate-400">Subtotal</span>
                           <span className="font-bold">{formatRupiah(cartSubtotal)}</span>
                        </div>
                        {appliedPromo && (
                           <div className="flex justify-between items-center text-[10px] text-blue-400">
                              <span className="font-semibold uppercase tracking-wide flex items-center gap-1">
                                 Kupon <Tag size={10}/> {appliedPromo.code}
                                 <button type="button" onClick={() => setAppliedPromo(null)} className="ml-1 text-rose-400 hover:text-rose-300"><X size={12}/></button>
                              </span>
                              <span className="font-bold">-{formatRupiah(promoDiscount)}</span>
                           </div>
                        )}
                        <div className="flex justify-between items-center text-[10px] text-emerald-400">
                           <span className="font-semibold uppercase tracking-wide">Diskon Manual</span>
                           <input
                              className="w-24 h-7 bg-white/10 border border-white/10 rounded-lg text-right px-2 font-bold outline-none focus:bg-white/20"
                              value={discountAmount}
                              onChange={e => {
                                 const val = e.target.value.replace(/\D/g, '')
                                 setDiscountAmount(val ? new Intl.NumberFormat('id-ID').format(Number(val)) : '')
                              }}
                           />
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-rose-400">
                           <span className="font-semibold uppercase tracking-wide text-rose-400">Pajak</span>
                           <select
                              className="w-24 h-7 bg-white/10 border border-white/10 rounded-lg text-right px-1 font-bold outline-none appearance-none"
                              value={taxPercent}
                              onChange={e => setTaxPercent(Number(e.target.value))}
                           >
                              <option value={0} className="text-black">0%</option>
                              <option value={11} className="text-black">11%</option>
                              <option value={12} className="text-black">12%</option>
                           </select>
                        </div>
                        
                        {/* INPUT PROMO BARU (DENGAN QR ICON) */}
                        {!appliedPromo && (
                           <div className="flex gap-2 mt-1">
                              <div className="relative flex-1">
                                 <QrCode size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
                                 <input 
                                    placeholder="Scan QR / Ketik Kode..." 
                                    value={promoCode}
                                    onChange={e => setPromoCode(e.target.value)}
                                    style={{ textTransform: 'uppercase' }}
                                    onKeyDown={e => {
                                       if (e.key === 'Enter') {
                                          e.preventDefault()
                                          void handleApplyPromo()
                                       }
                                    }}
                                    className="w-full h-8 pl-7 pr-3 bg-black/20 border border-white/10 rounded-lg text-[10px] font-bold text-white placeholder-slate-500 outline-none focus:border-blue-500 shadow-inner" 
                                 />
                              </div>
                              <button type="button" onClick={() => void handleApplyPromo()} className="h-8 px-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-semibold text-[10px] tracking-wide uppercase transition-colors">CEK</button>
                           </div>
                        )}
                     </div>

                     <div className="p-4 md:p-6 pt-3">
                        <div className="flex justify-between items-center mb-4">
                           <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Grand Total</div>
                           <div className="text-xl md:text-2xl font-semibold text-emerald-400">{formatRupiah(grandTotal)}</div>
                        </div>

                        {shouldEnforceShift && !activeShiftSession?.id && (
                           <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                              Buka shift POS dulu agar checkout aktif.
                           </div>
                        )}

                        <button type="button"
                           disabled={!activeBranchId || cart.length === 0 || (shouldEnforceShift && !activeShiftSession?.id)}
                           onClick={() => setShowPayment(true)}
                           className="w-full h-14 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl md:rounded-xl font-semibold text-xs md:text-base tracking-wide uppercase transition-colors flex items-center justify-center gap-3 shadow-lg"
                        >
                           <CreditCard size={20} /> CHECKOUT
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         </div>

         {/* Mobile Bottom Bar (Always Visible on Catalog) */}
         <div className={`md:hidden fixed bottom-6 left-4 right-4 z-40 ${isMobileCartOpen || showPayment ? 'hidden' : 'block'}`}>
            <button type="button"
               onClick={() => setIsMobileCartOpen(true)}
               className="w-full h-16 bg-[#003366] text-white rounded-xl shadow-md flex items-center justify-between px-6 border border-white/10 relative overflow-hidden group"
            >
               <div className="absolute inset-0 bg-blue-500/20 translate-y-full group-active:translate-y-0 transition-transform" />
               <div className="flex items-center gap-3 relative z-10">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                     <div className="relative">
                        <ShoppingCart size={20} />
                        {cart.length > 0 && (
                           <span className="absolute -top-2 -right-2 w-5 h-5 bg-rose-500 text-white text-[10px] font-semibold rounded-full flex items-center justify-center scale-90 md:scale-100">
                              {cart.reduce((a, c) => a + c.qty, 0)}
                           </span>
                        )}
                     </div>
                  </div>
                  <div className="text-left">
                     <div className="text-[10px] font-semibold text-white/50 uppercase tracking-wide leading-none mb-1">Items in Cart</div>
                     <div className="text-xs font-semibold uppercase tracking-tighter">Lihat Detail Pesanan</div>
                  </div>
               </div>
               <div className="text-right relative z-10">
                  <div className="text-[9px] font-semibold text-emerald-400 uppercase tracking-wide mb-0.5 opacity-70 italic">Total Tagihan</div>
                  <div className="text-lg font-semibold text-emerald-400 leading-none">{formatRupiah(grandTotal)}</div>
               </div>
            </button>
         </div>

         <AnimatePresence>
            {showOpenShiftModal && (
               <div className="fixed inset-0 z-[180] flex items-start md:items-center justify-center overflow-y-auto p-4 md:p-6 bg-slate-900/75 backdrop-blur-sm">
                  <motion.div
                     initial={{ opacity: 0, y: 20, scale: 0.98 }}
                     animate={{ opacity: 1, y: 0, scale: 1 }}
                     exit={{ opacity: 0, y: 20, scale: 0.98 }}
                     className="my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-md md:max-h-[90vh] md:rounded-[32px]"
                  >
                     <div className="px-5 md:px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                        <div>
                           <h3 className="text-lg md:text-xl font-semibold text-slate-900">Buka Shift POS</h3>
                           <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mt-1">Unit {activeBranchName || 'Aktif'}</p>
                        </div>
                        <button type="button" onClick={() => setShowOpenShiftModal(false)} className="p-2 rounded-full hover:bg-white text-slate-400 hover:text-slate-700">
                           <X size={20} />
                        </button>
                     </div>

                     <div className="flex-1 overflow-y-auto p-5 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-[11px] md:text-xs font-semibold text-blue-800">
                           Buka shift wajib otorisasi kasir dengan login NIK. Shift akan tercatat atas nama NIK yang lolos verifikasi.
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 ml-1">Login NIK Kasir</label>
                           <input
                              value={openShiftCashierNik}
                              onChange={(e) => setOpenShiftCashierNik(e.target.value.toUpperCase())}
                              className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none"
                              placeholder="Contoh: K-0001"
                           />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 ml-1">Sandi Kasir</label>
                           <input
                              type="password"
                              value={openShiftCashierPassword}
                              onChange={(e) => setOpenShiftCashierPassword(e.target.value)}
                              className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none"
                              placeholder="••••••••"
                           />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 ml-1">Kode Register</label>
                           <input
                              value={shiftRegisterCode}
                              onChange={(e) => setShiftRegisterCode(e.target.value.toUpperCase())}
                              className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none"
                              placeholder="REG-1"
                           />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 ml-1">Modal Awal Kas</label>
                           <input
                              value={openingCashInput}
                              onChange={(e) => setOpeningCashInput(formatMoneyInput(parseMoneyInput(e.target.value)))}
                              className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none"
                              placeholder="0"
                           />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 ml-1">Akun Kas Laci</label>
                           <select
                              value={shiftCashAccountId}
                              onChange={(e) => setShiftCashAccountId(e.target.value)}
                              className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none"
                           >
                              <option value="">Pilih akun kas...</option>
                              {posAccountOptions.map((account) => (
                                 <option key={account.id} value={account.id}>{account.code} - {account.name}</option>
                              ))}
                           </select>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 ml-1">Akun Sumber Modal Awal</label>
                           <select
                              value={shiftOpeningSourceAccountId}
                              onChange={(e) => setShiftOpeningSourceAccountId(e.target.value)}
                              className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none"
                           >
                              <option value="">Pilih akun sumber modal...</option>
                              {posAccountOptions
                                 .filter((account) => account.id !== shiftCashAccountId)
                                 .map((account) => (
                                    <option key={account.id} value={account.id}>{account.code} - {account.name}</option>
                                 ))}
                           </select>
                           <p className="text-[11px] text-slate-500 leading-relaxed">
                              Jika modal awal diisi, jurnal otomatis: debit kas laci, kredit akun sumber.
                           </p>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 ml-1">Akun Transfer</label>
                           <select
                              value={shiftTransferAccountId}
                              onChange={(e) => setShiftTransferAccountId(e.target.value)}
                              className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none"
                           >
                              <option value="">Pilih akun transfer...</option>
                              {posAccountOptions.map((account) => (
                                 <option key={account.id} value={account.id}>{account.code} - {account.name}</option>
                              ))}
                           </select>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                           <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 ml-1">Akun QRIS / EDC</label>
                           <select
                              value={shiftQrisAccountId}
                              onChange={(e) => setShiftQrisAccountId(e.target.value)}
                              className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none"
                           >
                              <option value="">Pilih akun QRIS...</option>
                              {posAccountOptions.map((account) => (
                                 <option key={account.id} value={account.id}>{account.code} - {account.name}</option>
                              ))}
                           </select>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                           <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 ml-1">Catatan Pembuka</label>
                           <textarea
                              value={openShiftNotes}
                              onChange={(e) => setOpenShiftNotes(e.target.value)}
                              className="w-full min-h-[88px] px-4 py-3 bg-white border border-slate-200 rounded-xl font-medium text-sm outline-none"
                              placeholder="Contoh: Buka shift pagi, float awal lengkap."
                           />
                        </div>
                     </div>

                     <div className="px-5 md:px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
                        <button type="button"
                           onClick={() => {
                              setShowOpenShiftModal(false)
                              setOpenShiftCashierPassword('')
                           }}
                           className="px-5 py-3 text-sm font-bold text-slate-500"
                        >
                           Batal
                        </button>
                        <button type="button"
                           onClick={handleOpenShift}
                           disabled={shiftBusy}
                           className="px-6 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-black disabled:opacity-50"
                        >
                           {shiftBusy ? 'Membuka Shift...' : 'Buka Shift'}
                        </button>
                     </div>
                  </motion.div>
               </div>
            )}
         </AnimatePresence>

         <AnimatePresence>
            {showCloseShiftModal && activeShiftSession && (
               <div className="fixed inset-0 z-[181] flex items-center justify-center p-4 md:p-6 bg-slate-900/75 backdrop-blur-sm">
                  <motion.div
                     initial={{ opacity: 0, y: 20, scale: 0.98 }}
                     animate={{ opacity: 1, y: 0, scale: 1 }}
                     exit={{ opacity: 0, y: 20, scale: 0.98 }}
                     className="w-full max-w-2xl rounded-[32px] bg-white shadow-md overflow-hidden"
                  >
                     <div className="px-6 md:px-8 py-5 border-b border-slate-100 bg-rose-50/70 flex items-center justify-between">
                        <div>
                           <h3 className="text-lg md:text-xl font-semibold text-slate-900">Tutup Shift POS</h3>
                           <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mt-1">{activeShiftSession.registerCode}</p>
                           <p className="text-xs font-semibold text-slate-500 mt-1">Buka Shift: {formatShiftTimestamp(activeShiftSession.openedAt)}</p>
                           {activeShiftCashierLabel && (
                              <p className="text-xs font-semibold text-slate-500 mt-0.5">Kasir Aktif: {activeShiftCashierLabel}</p>
                           )}
                        </div>
                        <button type="button" onClick={() => setShowCloseShiftModal(false)} className="p-2 rounded-full hover:bg-white text-slate-400 hover:text-slate-700">
                           <X size={20} />
                        </button>
                     </div>

                     <div className="p-6 md:p-8 space-y-5">
                        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">
                           {canUsePrivilegedCloseShiftOverride
                              ? 'Shift ini dibuka oleh akun Anda. Sebagai owner/admin/manager, Anda boleh langsung menutup shift tanpa mengisi login NIK.'
                              : 'Tutup shift harus memakai login NIK kasir yang membuka shift ini.'}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                           <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Modal Awal</div>
                              <div className="text-sm font-semibold text-slate-800">{formatRupiah(activeShiftSession.openingCash)}</div>
                           </div>
                           <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Sales Tunai</div>
                              <div className="text-sm font-semibold text-slate-800">{formatRupiah(activeShiftSession.totals.byMethod.CASH)}</div>
                           </div>
                           <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Kembalian</div>
                              <div className="text-sm font-semibold text-slate-800">{formatRupiah(activeShiftSession.totals.totalChange)}</div>
                           </div>
                           <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 mb-1">Expected</div>
                              <div className="text-sm font-semibold text-emerald-700">{formatRupiah(activeShiftSession.expectedCash)}</div>
                           </div>
                           <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Durasi</div>
                              <div className="text-sm font-semibold text-slate-800">{formatShiftDuration(activeShiftSession.openedAt, null)}</div>
                           </div>
                        </div>

                        <div className="space-y-2">
                           <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 ml-1">Login NIK Kasir</label>
                           <input
                              value={closeShiftCashierNik}
                              onChange={(e) => setCloseShiftCashierNik(e.target.value.toUpperCase())}
                              className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none"
                              placeholder={canUsePrivilegedCloseShiftOverride ? 'Kosongkan jika pakai sesi owner/admin ini' : 'Contoh: K-0001'}
                           />
                        </div>

                        <div className="space-y-2">
                           <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 ml-1">Sandi Kasir</label>
                           <input
                              type="password"
                              value={closeShiftCashierPassword}
                              onChange={(e) => setCloseShiftCashierPassword(e.target.value)}
                              className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none"
                              placeholder={canUsePrivilegedCloseShiftOverride ? 'Kosongkan jika pakai sesi owner/admin ini' : '••••••••'}
                           />
                        </div>

                        <div className="space-y-2">
                           <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 ml-1">Kas Fisik Saat Tutup Shift</label>
                           <input
                              value={closingCashInput}
                              onChange={(e) => setClosingCashInput(formatMoneyInput(parseMoneyInput(e.target.value)))}
                              className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none"
                              placeholder="0"
                           />
                        </div>

                        <div className="space-y-2">
                           <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 ml-1">Catatan Penutup</label>
                           <textarea
                              value={closeShiftNotes}
                              onChange={(e) => setCloseShiftNotes(e.target.value)}
                              className="w-full min-h-[110px] px-4 py-3 bg-white border border-slate-200 rounded-xl font-medium text-sm outline-none"
                              placeholder="Contoh: Selisih karena pembulatan kembalian / setor manual."
                           />
                        </div>
                     </div>

                     <div className="px-6 md:px-8 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
                        <button type="button"
                           onClick={() => {
                              setShowCloseShiftModal(false)
                              setCloseShiftCashierPassword('')
                           }}
                           className="px-5 py-3 text-sm font-bold text-slate-500"
                        >
                           Batal
                        </button>
                        <button type="button"
                           onClick={handleCloseShift}
                           disabled={shiftBusy}
                           className="px-6 py-3 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-50"
                        >
                           {shiftBusy ? 'Menutup Shift...' : 'Tutup Shift'}
                        </button>
                     </div>
                  </motion.div>
               </div>
            )}
         </AnimatePresence>

         <AnimatePresence>
            {showSettlementModal && latestClosedShift && (
               <div className="fixed inset-0 z-[182] flex items-center justify-center p-4 md:p-6 bg-slate-900/75 backdrop-blur-sm">
                  <motion.div
                     initial={{ opacity: 0, y: 20, scale: 0.98 }}
                     animate={{ opacity: 1, y: 0, scale: 1 }}
                     exit={{ opacity: 0, y: 20, scale: 0.98 }}
                     className="w-full max-w-2xl rounded-[32px] bg-white shadow-md overflow-hidden"
                  >
                     <div className="px-6 md:px-8 py-5 border-b border-slate-100 bg-blue-50/70 flex items-center justify-between">
                        <div>
                           <h3 className="text-lg md:text-xl font-semibold text-slate-900">Settlement Shift POS</h3>
                           <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mt-1">{latestClosedShift.registerCode}</p>
                           <p className="text-xs font-semibold text-slate-500 mt-1">Buka Shift: {formatShiftTimestamp(latestClosedShift.openedAt)}</p>
                           <p className="text-xs font-semibold text-slate-500 mt-0.5">Tutup Shift: {formatShiftTimestamp(latestClosedShift.closedAt)}</p>
                        </div>
                        <button type="button" onClick={() => setShowSettlementModal(false)} className="p-2 rounded-full hover:bg-white text-slate-400 hover:text-slate-700">
                           <X size={20} />
                        </button>
                     </div>

                     <div className="p-6 md:p-8 space-y-5">
                        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-800">
                           Settlement wajib memakai login NIK kasir shift ini atau otorisator owner/admin/manager agar jejak audit harian tetap lengkap.
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                           {(['CASH', 'QRIS', 'TRANSFER'] as PosShiftMethod[]).map((method) => (
                              <button
                                 key={method}
                                 type="button"
                                 onClick={() => setSettlementMethod(method)}
                                 className={`p-3 rounded-xl border-2 font-semibold text-[11px] uppercase tracking-wide transition-all ${
                                    settlementMethod === method
                                       ? 'border-blue-600 bg-blue-50 text-blue-700'
                                       : 'border-slate-200 bg-white text-slate-400'
                                 }`}
                              >
                                 {method}
                              </button>
                           ))}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Akun Sumber</div>
                              <div className="text-sm font-semibold text-slate-800">{getAccountName(settlementMethod === 'CASH' ? latestClosedShift.cashAccountId : settlementMethod === 'TRANSFER' ? latestClosedShift.transferAccountId : latestClosedShift.qrisAccountId)}</div>
                           </div>
                           <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 mb-1">Sisa Settlement</div>
                              <div className="text-sm font-semibold text-emerald-700">{formatRupiah(settlementRemaining)}</div>
                           </div>
                        </div>

                        <div className="space-y-2">
                           <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 ml-1">Akun Tujuan</label>
                           <select
                              value={settlementTargetAccountId}
                              onChange={(e) => setSettlementTargetAccountId(e.target.value)}
                              className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none"
                           >
                              <option value="">Pilih akun tujuan...</option>
                              {accounts
                                 .filter((account) => account.id !== (settlementMethod === 'CASH' ? latestClosedShift.cashAccountId : settlementMethod === 'TRANSFER' ? latestClosedShift.transferAccountId : latestClosedShift.qrisAccountId))
                                 .map((account) => (
                                    <option key={account.id} value={account.id}>{account.code} - {account.name}</option>
                                 ))}
                           </select>
                        </div>

                        <div className="space-y-2">
                           <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 ml-1">Nominal Settlement</label>
                           <input
                              value={settlementAmountInput}
                              onChange={(e) => setSettlementAmountInput(formatMoneyInput(parseMoneyInput(e.target.value)))}
                              className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none"
                              placeholder="0"
                           />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="space-y-2">
                              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 ml-1">Login NIK Otorisasi</label>
                              <input
                                 value={settlementAuthorizerNik}
                                 onChange={(e) => setSettlementAuthorizerNik(e.target.value.toUpperCase())}
                                 className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none"
                                 placeholder="Contoh: K-0001"
                              />
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 ml-1">Sandi Otorisasi</label>
                              <input
                                 type="password"
                                 value={settlementAuthorizerPassword}
                                 onChange={(e) => setSettlementAuthorizerPassword(e.target.value)}
                                 className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none"
                                 placeholder="••••••••"
                              />
                           </div>
                        </div>

                        <div className="space-y-2">
                           <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 ml-1">Catatan Settlement</label>
                           <textarea
                              value={settlementNotes}
                              onChange={(e) => setSettlementNotes(e.target.value)}
                              className="w-full min-h-[110px] px-4 py-3 bg-white border border-slate-200 rounded-xl font-medium text-sm outline-none"
                              placeholder="Contoh: Setor kas akhir shift ke bank operasional."
                           />
                        </div>
                     </div>

                     <div className="px-6 md:px-8 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
                        <button type="button"
                           onClick={() => {
                              setShowSettlementModal(false)
                              setSettlementAuthorizerPassword('')
                           }}
                           className="px-5 py-3 text-sm font-bold text-slate-500"
                        >
                           Batal
                        </button>
                        <button type="button"
                           onClick={handleSettlement}
                           disabled={shiftBusy || settlementRemaining <= 0}
                           className="px-6 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                        >
                           {shiftBusy ? 'Posting Settlement...' : 'Posting Settlement'}
                        </button>
                     </div>
                  </motion.div>
               </div>
            )}
         </AnimatePresence>

         {/* Payment Modal Overlay (Mobile: Full Screen, Desktop: Center Modal) */}
         <AnimatePresence mode="wait">
            {showPayment && (
               <div className="fixed inset-0 z-[200] flex items-center justify-center md:p-6 bg-slate-900/80 backdrop-blur-md">
                  <motion.div
                     initial={{ opacity: 0, y: 100 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: 100 }}
                     className="relative w-full h-full md:h-auto md:max-w-4xl bg-white md:rounded-xl shadow-md flex flex-col md:flex-row overflow-hidden"
                  >
                     {/* Summary Side */}
                     <div className="w-full md:w-[45%] bg-[#003366] text-white p-6 md:p-5 flex flex-col justify-between relative">
                        <div className="relative z-10">
                           <div className="flex justify-between items-center md:block mb-8 md:mb-0">
                              <div className="w-12 h-12 md:w-16 md:h-16 bg-white/10 rounded-[18px] md:rounded-xl flex items-center justify-center border border-white/20 backdrop-blur-sm">
                                 <Receipt size={24} className="text-white md:hidden" />
                                 <Receipt size={32} className="text-white hidden md:block" />
                              </div>
                              <button type="button" onClick={() => setShowPayment(false)} className="md:hidden p-2 bg-white/10 rounded-lg"><X size={18} /></button>
                           </div>
                           <h2 className="text-2xl md:text-3xl font-semibold mb-1 md:mb-2 tracking-tight">Pembayaran</h2>
                           <p className="text-white/60 font-bold text-xs md:text-sm mb-6 md:mb-12">Total {cart.reduce((a, c) => a + c.qty, 0)} Items Terpilih.</p>

                           <div className="space-y-3 md:space-y-4">
                              <div className="flex justify-between items-center py-1.5 md:py-2 border-b border-white/10 text-[10px] md:text-base">
                                 <span className="font-bold text-white/50 uppercase md:normal-case tracking-wide md:tracking-normal">Subtotal</span>
                                 <span className="font-semibold md:text-lg">{formatRupiah(cartSubtotal)}</span>
                              </div>
                              {(parsedDiscount > 0 || taxPercent > 0) && (
                                 <div className="flex justify-between items-center py-1.5 md:py-2 border-b border-white/10 text-[10px] md:text-base text-white/70 italic">
                                    <span>Adjustments (Disc/Tax)</span>
                                    <span className="font-semibold">{formatRupiah(taxNominal - parsedDiscount)}</span>
                                 </div>
                              )}
                              <div className="flex justify-between items-center pt-4 md:pt-6">
                                 <span className="font-semibold text-white uppercase tracking-wide text-[10px] md:text-xs">TOTAL AKHIR</span>
                                 <span className="font-semibold text-2xl md:text-4xl text-emerald-400">{formatRupiah(grandTotal)}</span>
                              </div>
                           </div>
                        </div>
                     </div>

                     {/* Form Side */}
                     <div className="flex-1 bg-slate-50 p-6 md:p-5 overflow-y-auto">
                        {successData ? (
                           <div className="h-full flex flex-col items-center justify-center text-center py-10 md:py-0">
                              <motion.div initial={{ scale: 0 }} animate={{ scale: 1, rotate: 360 }} transition={{ type: 'spring' }} className="w-20 h-20 md:w-24 md:h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
                                 <CheckCircle2 size={40} className="md:w-[48px]" />
                              </motion.div>
                              <h2 className="text-xl md:text-2xl font-semibold text-slate-800 mb-2 italic">TRANSAKSI SUKSES</h2>
                              <p className="text-slate-500 font-bold text-xs md:text-sm mb-8 max-w-xs mx-auto">Saldo inventory otomatis terpotong & jurnal tercatat.</p>

                              <div className="bg-white border border-slate-200 rounded-xl p-6 w-full mb-8 shadow-sm max-w-sm">
                                 <div className="flex justify-between items-center mb-4 text-[10px] md:text-xs">
                                    <span className="uppercase font-semibold text-slate-400 tracking-wide">Total Bayar</span>
                                    <span className="font-semibold text-slate-800">{formatRupiah(successData.total)}</span>
                                 </div>
                                 <div className="flex justify-between items-center pt-4 border-t border-dashed border-slate-200">
                                    <span className="text-[10px] md:text-xs uppercase font-semibold text-blue-500 tracking-wide italic">KEMBALIAN</span>
                                    <span className="font-semibold text-xl md:text-2xl text-blue-600">{formatRupiah(successData.change)}</span>
                                 </div>
                              </div>

                              <div className="bg-white border border-slate-200 rounded-xl p-5 w-full mb-5 shadow-sm max-w-sm text-left">
                                 <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
                                    Custom Pesan WhatsApp
                                 </label>
                                 <textarea
                                    value={successData.customWaMessage || ''}
                                    onChange={(e) => setSuccessData((prev) => prev ? { ...prev, customWaMessage: e.target.value } : prev)}
                                    placeholder="Contoh: Sampai jumpa lagi, Kak. Promo pekan depan siap menunggu."
                                    className="w-full min-h-[110px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-emerald-400 focus:bg-white resize-y"
                                 />
                                 <p className="mt-2 text-[10px] text-slate-500 font-medium leading-relaxed">
                                    Pesan ini akan ikut di tombol WhatsApp. Placeholder didukung: {`{customer_name}`}, {`{sale_id}`}, {`{item_count}`}, {`{subtotal}`}, {`{discount}`}, {`{tax}`}, {`{total}`}.
                                 </p>
                              </div>

                              <div className="grid grid-cols-2 gap-3 w-full max-w-sm mb-3">
                                 <button type="button" onClick={() => window.print()} className="py-4 bg-white border border-slate-200 text-slate-600 font-semibold tracking-wide uppercase text-[10px] rounded-xl hover:bg-slate-100 shadow-sm w-full">Struk Fisik</button>
                                 <button type="button" onClick={sendWaReceipt} className="py-4 bg-emerald-50 border border-emerald-200 text-emerald-600 font-semibold tracking-wide uppercase text-[10px] rounded-xl hover:bg-emerald-100 shadow-sm w-full flex items-center justify-center gap-1.5"><MessageCircle size={14} /> WhatsApp</button>
                              </div>
                              <button type="button" onClick={resetPOS} className="w-full max-w-sm py-5 bg-blue-600 text-white font-semibold tracking-wide uppercase text-xs rounded-xl hover:bg-blue-500 shadow-lg shadow-blue-500/20 mt-2">PESANAN BERIKUTNYA</button>
                           </div>
                        ) : (
                           <div className="flex flex-col h-full">
                              <div className="hidden md:flex justify-between items-center mb-4">
                                 <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Penyelesaian Transaksi</h3>
                                 <button type="button" onClick={() => setShowPayment(false)} className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg"><X size={18} /></button>
                              </div>

                              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Metode Pembayaran</label>
                              <div className="grid grid-cols-3 gap-2 md:gap-3 mb-8">
                                 <button type="button" onClick={() => setPaymentMethod('CASH')} className={`p-3 md:p-4 rounded-xl md:rounded-xl border-2 flex flex-col items-center gap-2 md:gap-3 transition-all ${paymentMethod === 'CASH' ? 'border-[#003366] bg-blue-50 text-[#003366]' : 'border-slate-100 bg-white text-slate-300'}`}>
                                    <Banknote size={20} className="md:w-[24px]" />
                                    <span className="text-[8px] md:text-[10px] font-semibold uppercase tracking-wide">Tunai</span>
                                 </button>
                                 <button type="button" onClick={() => setPaymentMethod('QRIS')} className={`p-3 md:p-4 rounded-xl md:rounded-xl border-2 flex flex-col items-center gap-2 md:gap-3 transition-all ${paymentMethod === 'QRIS' ? 'border-[#003366] bg-blue-50 text-[#003366]' : 'border-slate-100 bg-white text-slate-300'}`}>
                                    <QrCode size={20} className="md:w-[24px]" />
                                    <span className="text-[8px] md:text-[10px] font-semibold uppercase tracking-wide">QRIS / EDC</span>
                                 </button>
                                 <button type="button" onClick={() => setPaymentMethod('TRANSFER')} className={`p-3 md:p-4 rounded-xl md:rounded-xl border-2 flex flex-col items-center gap-2 md:gap-3 transition-all ${paymentMethod === 'TRANSFER' ? 'border-[#003366] bg-blue-50 text-[#003366]' : 'border-slate-100 bg-white text-slate-300'}`}>
                                    <CreditCard size={20} className="md:w-[24px]" />
                                    <span className="text-[8px] md:text-[10px] font-semibold uppercase tracking-wide">Transfer</span>
                                 </button>
                              </div>

                              <div className="space-y-6 flex-1">
                                 {requiresWarehouseSelection && (
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 ml-1">Gudang Pengeluaran</label>
                                    <select
                                       value={selectedWarehouseId}
                                       onChange={e => setSelectedWarehouseId(e.target.value)}
                                       className="w-full h-12 md:h-14 px-4 bg-white border border-slate-200 rounded-xl font-bold text-xs md:text-sm text-slate-700 outline-none shadow-sm"
                                    >
                                       <option value="">Pilih gudang pengeluaran...</option>
                                       {warehouses.map((warehouse: any) => (
                                          <option key={warehouse.id} value={warehouse.id}>
                                             {warehouse.name} ({warehouse.code})
                                          </option>
                                       ))}
                                    </select>
                                    <p className="text-[10px] text-slate-500 font-medium px-1">
                                       Stok fisik akan dikurangi dari gudang ini saat transaksi POS selesai.
                                    </p>
                                 </div>
                                 )}

                                 <div className="space-y-1.5 opacity-80 pointer-events-none mb-6">
                                    <label className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 ml-1 flex items-center gap-1.5">
                                       <CheckCircle2 size={12} /> Auto-Routed ke Rekening POS
                                    </label>
                                    <div className="w-full h-12 md:h-14 px-4 bg-slate-100/80 border border-slate-200/60 rounded-xl font-bold text-xs md:text-sm text-slate-500 flex items-center shadow-inner italic">
                                       {accounts.find((a: any) => a.id === selectedAccount)?.name || 'Sinkronisasi konfigurasi pusat...'}
                                    </div>
                                 </div>

                                 {paymentMethod === 'CASH' && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                       <div className="space-y-2">
                                          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 ml-1">Nominal Tunai Diterima</label>
                                          <div className="relative">
                                             <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-semibold text-xs md:text-sm">Rp</span>
                                             <input
                                                type="text"
                                                value={amountTendered}
                                                onChange={e => {
                                                   const val = e.target.value.replace(/\D/g, '')
                                                   setAmountTendered(val ? new Intl.NumberFormat('id-ID').format(Number(val)) : '')
                                                }}
                                                className="w-full h-14 md:h-16 pl-10 md:pl-12 pr-6 bg-white border border-slate-200 rounded-xl font-semibold text-lg md:text-2xl text-slate-800 outline-none focus:border-[#003366] transition-all shadow-sm"
                                                placeholder="0"
                                             />
                                          </div>
                                       </div>

                                       <div className="flex flex-wrap gap-2">
                                          {[grandTotal, 20000, 50000, 100000, 200000, 500000]
                                             .filter((n, i) => i === 0 || n > grandTotal)
                                             .slice(0, 4)
                                             .map((nom, idx) => (
                                             <button 
                                                key={idx}
                                                type="button"
                                                onClick={() => setAmountTendered(new Intl.NumberFormat('id-ID').format(nom))}
                                                className={`px-3 py-2 md:py-2.5 border font-bold text-[10px] md:text-xs rounded-lg transition-all active:scale-95 ${
                                                   idx === 0 
                                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300'
                                                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800'
                                                }`}
                                             >
                                                {idx === 0 ? 'Uang Pas' : formatRupiah(nom)}
                                             </button>
                                          ))}
                                       </div>

                                       {changeDue > 0 && amountTendered && (
                                          <div className="p-3 md:p-4 mt-2 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-between animate-in fade-in">
                                             <span className="text-[10px] md:text-xs font-bold uppercase tracking-wide text-orange-600/70">Kembalian</span>
                                             <span className="text-sm md:text-lg font-semibold text-orange-600">{formatRupiah(changeDue)}</span>
                                          </div>
                                       )}
                                    </div>
                                 )}

                                 <div className="space-y-2">
                                    <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 ml-1">
                                       Custom Pesan WhatsApp
                                    </label>
                                    <textarea
                                       value={customWaMessage}
                                       onChange={(e) => setCustomWaMessage(e.target.value)}
                                       placeholder="Pesan tambahan untuk pelanggan. Bisa dipakai untuk ucapan, promo, atau info penjemputan."
                                       className="w-full min-h-[110px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-[#003366] shadow-sm resize-y"
                                    />
                                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed px-1">
                                       Otomatis ikut ke pesan WA struk POS. Placeholder yang didukung: {`{customer_name}`}, {`{sale_id}`}, {`{item_count}`}, {`{subtotal}`}, {`{discount}`}, {`{tax}`}, {`{total}`}.
                                    </p>
                                 </div>
                              </div>

                              <div className="pt-6 mt-auto">
                                 <button type="button" disabled={loading || !activeBranchId || (requiresWarehouseSelection && !selectedWarehouseId)} onClick={handlePay} className="w-full h-16 md:h-[72px] bg-[#003366] hover:bg-[#002244] text-white flex flex-col items-center justify-center gap-1 rounded-xl md:rounded-[20px] shadow-xl transition-all font-semibold text-[11px] md:text-xs tracking-wide disabled:opacity-50">
                                    {loading ? (
                                       <span className="animate-spin border-2 border-white/20 border-t-white rounded-full w-5 h-5 mb-0.5" />
                                    ) : (
                                       <CheckCircle2 size={24} className="opacity-90" />
                                    )}
                                    {loading ? 'MEMPROSES TRANSAKSI...' : 'PROSES SEKARANG'}
                                 </button>
                              </div>
                           </div>
                        )}
                     </div>
                  </motion.div>
               </div>
            )}
         </AnimatePresence>

         {/* DEDICATED THERMAL PRINT TEMPLATE (Hidden from UI, active only on Print) */}
         {successData && (
               <div id="thermal-print-area" className="hidden print:block w-[58mm] bg-white text-black font-mono text-[10px] leading-snug mx-auto p-0">
                  <style>{`
                     @media print {
                        body * { visibility: hidden !important; }
                        #thermal-print-area, #thermal-print-area * { visibility: visible !important; color: black !important; }
                        #thermal-print-area { position: absolute; left: 0; top: 0; width: 58mm; padding: 2mm; margin: 0; border: none; }
                        @page { margin: 0; size: 58mm auto; }
                     }
                  `}</style>
                  <div className="text-center mb-3 flex flex-col items-center">
                     {logoUrl && (
                        <img src={logoUrl} alt="Logo" className="w-12 h-12 object-contain mb-1" />
                     )}
                     <h2 className="font-bold text-sm uppercase">{orgSettings.brand_name || 'NIZAM POS'}</h2>
                     <p className="text-[8px] uppercase font-bold">{activeBranchName || 'Unit Belum Dipilih'}</p>
                     <p className="text-[8px]">{orgSettings.company_address || 'Pusat Penjualan Retil'}</p>
                  </div>
                  <div className="border-b border-dashed border-black mb-2" />
                  <div className="flex justify-between mb-1">
                     <span>No: {successData.saleId.split('-')[0].toUpperCase()}</span>
                     <span>{formatDate(new Date())}</span>
                  </div>
                  <div className="mb-2">
                     <span>Pelanggan: {successData.customerName || 'Umum (Walk-In)'}</span>
                  </div>
                  <div className="border-b border-dashed border-black mb-2" />
                  <table className="w-full mb-2">
                     <tbody>
                        {successData.items?.map((item: any, idx: number) => (
                           <tr key={idx} className="align-top">
                              <td className="w-full pb-1 pr-2">
                                 {item.name} <br/>
                                 {item.qty} {item.unit} x {formatRupiah(item.price)}
                              </td>
                              <td className="text-right pb-1">{formatRupiah(item.price * item.qty)}</td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
                  <div className="border-b border-dashed border-black mb-2" />
                  
                  {successData.subtotal !== successData.total && (
                     <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span>{formatRupiah(successData.subtotal)}</span>
                     </div>
                  )}
                  {successData.discount > 0 && (
                     <div className="flex justify-between">
                        <span>Diskon</span>
                        <span>-{formatRupiah(successData.discount)}</span>
                     </div>
                  )}
                  {successData.tax > 0 && (
                     <div className="flex justify-between">
                        <span>Pajak Tambahan</span>
                        <span>+{formatRupiah(successData.tax)}</span>
                     </div>
                  )}
                  
                  <div className="flex justify-between text-[11px] mt-1">
                     <span>Total ({successData.items?.reduce((a: number, c: any) => a + c.qty, 0) || 0} Item)</span>
                     <span className="font-bold">{formatRupiah(successData.total)}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                     <span>Dibayar ({successData.method})</span>
                     <span>{formatRupiah(successData.tendered)}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                     <span>Kembali</span>
                     <span>{formatRupiah(successData.change)}</span>
                  </div>
                  <div className="border-b border-dashed border-black mb-2" />
                  <div className="text-center mt-3 text-[9px]">
                     <p>Terima Kasih atas kunjungan Anda!</p>
                     <p className="mt-1 font-bold">Powered by NIZAM ERP</p>
                  </div>
               </div>
            )}
      {ConfirmUI}
      </div>
  )
}
