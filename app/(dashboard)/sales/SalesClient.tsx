'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, Users, CheckCircle2, AlertCircle, Trash2, CheckSquare, XCircle, DollarSign, RotateCcw, ShoppingCart, TrendingUp, Wallet, Clock, Printer, FileText, Factory, Pencil } from 'lucide-react'
import { PageHeader, StatCard, SectionCard, SectionHeader, StatusBadge, SafeButton } from '@/components/ui/NizamUI'
import { createSaleEntry, deliverSale, voidSale, processSalesReturn, processSalesPayment } from '@/modules/sales/actions/sales.actions'
import { getApprovalForSource } from '@/modules/organization/actions/approval.actions'
import { createContact } from '@/modules/contacts/actions/contact.actions'
import type { ProductWithStock } from '@/modules/inventory/actions/inventory.actions'
import { QRCodeSVG } from 'qrcode.react'

import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { formatRupiah } from '@/lib/utils'
import { getCommissionSchemeLabel, getResellerDisplayName, getResellerSubtitle } from '@/modules/sales/lib/commission'

function pickRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export default function SalesClient({
  orgId,
  orgName,
  sales,
  customers,
  products,
  warehouses = [],
  resellers = [],
  coa,
  orgSettings = {},
  activeBranchName,
}: any) {
  const [showModal, setShowModal] = useState(false)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
   const [loading, setLoading] = useState(false)
   const searchParams = useSearchParams()
   const router = useRouter()

  // QR Approval state
  const [approvalQr, setApprovalQr] = useState<string | null>(null)
   const payId = searchParams.get('pay')

   useEffect(() => {
     if (payId && sales.length > 0) {
       const sale = sales.find((s: any) => s.id === payId)
       if (sale) {
         handleOpenPayment(sale)
       }
     }
   }, [payId, sales])



  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // State for Down Payment
  const [hasDp, setHasDp] = useState(false)
  const [dpMode, setDpMode] = useState<'NOMINAL'|'PERCENT'>('NOMINAL')
  const [dpPercent, setDpPercent] = useState('0')
  const [dpAmount, setDpAmount] = useState('0')
  const [dpAccountId, setDpAccountId] = useState('')

  // Return Modal State
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [selectedSaleForReturn, setSelectedSaleForReturn] = useState<any>(null)
  const [refundMode, setRefundMode] = useState<'AR' | 'CASH'>('AR')
  const [refundAccountId, setRefundAccountId] = useState('')

  // View Invoice State
  const [viewSale, setViewSale] = useState<any>(null)

  // Fetch approval QR when a document is opened for viewing/printing
  useEffect(() => {
    if (viewSale) {
      getApprovalForSource(orgId, viewSale.id, 'SALES_ORDER').then((approval: any) => {
        if (approval && approval.status === 'APPROVED') {
          setApprovalQr(`APPROVED|REQ-SO:${viewSale.id}|DATE:${approval.decided_at}|ORG:${orgId}`)
        } else {
          setApprovalQr(null)
        }
      })
    }
  }, [viewSale])
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({})
  const [notaRetur, setNotaRetur] = useState('')

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedSaleForPayment, setSelectedSaleForPayment] = useState<any>(null)
  const [paymentAmount, setPaymentAmount] = useState<number>(0)
  const [discountAmount, setDiscountAmount] = useState<number>(0)
  const [collectionAccountId, setCollectionAccountId] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [showDeliveryModal, setShowDeliveryModal] = useState(false)
  const [selectedSaleForDelivery, setSelectedSaleForDelivery] = useState<any>(null)
  const [deliveryWarehouseId, setDeliveryWarehouseId] = useState('')

  // Sales Form State
  const [customerId, setCustomerId] = useState('')
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [resellerId, setResellerId] = useState('')
  const [paymentTerm, setPaymentTerm] = useState<'TEMPO' | 'LUNAS'>('TEMPO')
  const [paymentAccountId, setPaymentAccountId] = useState('')
  const [customGlobalDiscount, setCustomGlobalDiscount] = useState<number | null>(null)
  const [headerTaxPercent, setHeaderTaxPercent] = useState(0)
  const [shariahMode, setShariahMode] = useState<'CASH' | 'SALAM' | 'ISTISHNA'>('CASH')

  useEffect(() => {
    if (shariahMode !== 'SALAM') return
    if (paymentTerm !== 'LUNAS') {
      setPaymentTerm('LUNAS')
    }
    if (hasDp) {
      setHasDp(false)
    }
  }, [hasDp, paymentTerm, shariahMode])

  // Print Mode State
  const [printMode, setPrintMode] = useState<'INVOICE' | 'DELIVERY_ORDER'>('INVOICE')

  const companyProfile = {
    name: orgSettings.brand_name || orgName || 'Perusahaan',
    logo: orgSettings.logo_url || '/logo.png',
    address: orgSettings.company_address || 'Alamat perusahaan belum diatur (Silakan update di Pengaturan -> Bisnis).',
    hotline: orgSettings.hotline || '',
    email: orgSettings.email || '',
    website: orgSettings.website || '',
  }
  
  const createEmptySaleLine = () => ({
    id: Date.now(),
    product_name: '',
    product_id: '',
    quantity: 1,
    unit_price: 0,
    discount_amount: 0,
    stock_available: 0,
    type: 'INVENTORY' as 'INVENTORY' | 'NON_INVENTORY' | 'SERVICE',
    unit: 'Pcs'
  })
  const [lines, setLines] = useState([createEmptySaleLine()])
  const [editingDraftSaleId, setEditingDraftSaleId] = useState<string | null>(null)
  const selectedReseller = (resellers || []).find((item: any) => item.id === resellerId) || null

  // Filter COA for payment accounts (Kas/Bank) if Lunas
  const paymentAccounts = coa?.filter((a: any) => a.type === 'ASSET' && (a.code.startsWith('11') || a.code.startsWith('12'))) || []

  const grossSubTotal = lines.reduce((sum: number, line: typeof lines[0]) => sum + (line.quantity * line.unit_price), 0)
  const autoLineDiscounts = lines.reduce((sum: number, line: typeof lines[0]) => sum + ((line.discount_amount || 0) * line.quantity), 0)
  
  const appliedDiscount = customGlobalDiscount !== null ? customGlobalDiscount : autoLineDiscounts
  const taxableAmount = Math.max(0, grossSubTotal - appliedDiscount)
  const calculatedTax = (grossSubTotal * headerTaxPercent) / 100
  const grandTotal = taxableAmount + calculatedTax
  const STOCK_EPSILON = 0.000001

  const resetSaleForm = () => {
    setEditingDraftSaleId(null)
    setLines([createEmptySaleLine()])
    setCustomerId('')
    setSaleDate(new Date().toISOString().split('T')[0])
    setDueDate('')
    setNotes('')
    setResellerId('')
    setPaymentTerm('TEMPO')
    setPaymentAccountId('')
    setCustomGlobalDiscount(null)
    setHeaderTaxPercent(0)
    setShariahMode('CASH')
    setHasDp(false)
    setDpMode('NOMINAL')
    setDpPercent('0')
    setDpAmount('0')
    setDpAccountId('')
    setError(null)
  }

  const openDraftSaleEditor = (sale: any) => {
    const parsedShariah = String(sale?.shariah_mode || 'CASH').toUpperCase()
    const nextShariahMode: 'CASH' | 'SALAM' | 'ISTISHNA' =
      parsedShariah === 'SALAM' || parsedShariah === 'ISTISHNA' ? parsedShariah : 'CASH'
    const nextPaymentTerm: 'TEMPO' | 'LUNAS' =
      String(sale?.payment_term || 'TEMPO').toUpperCase() === 'LUNAS' ? 'LUNAS' : 'TEMPO'

    const mappedLines = (sale?.sales_items || []).map((item: any) => {
      const linkedProduct = products.find((p: ProductWithStock) => p.id === item?.product_id)
      const productType = (linkedProduct?.type || item?.products?.type || 'INVENTORY') as 'INVENTORY' | 'NON_INVENTORY' | 'SERVICE'
      return {
        id: Date.now() + Math.floor(Math.random() * 10000),
        product_name: String(item?.description || linkedProduct?.name || ''),
        product_id: String(item?.product_id || ''),
        quantity: Number(item?.quantity || 1),
        unit_price: Number(item?.unit_price || 0),
        discount_amount: Number(item?.discount_amount || 0),
        stock_available: Number(linkedProduct?.stock_available || 0),
        type: productType,
        unit: String(linkedProduct?.unit || item?.products?.unit || 'Pcs'),
      }
    })

    const total = Number(sale?.total_amount || 0)
    const discount = Number(sale?.discount_amount || 0)
    const taxableBase = Math.max(0, total - discount)
    const taxPercent = taxableBase > 0
      ? (Number(sale?.tax_amount || 0) / taxableBase) * 100
      : 0

    setEditingDraftSaleId(String(sale.id))
    setCustomerId(String(sale.customer_id || ''))
    setResellerId(String(sale.reseller_id || ''))
    setSaleDate(String(sale.sale_date || new Date().toISOString().split('T')[0]))
    setDueDate(sale?.due_date ? String(sale.due_date) : '')
    setNotes(String(sale?.notes || ''))
    setPaymentTerm(nextPaymentTerm)
    setPaymentAccountId(String(sale?.payment_account_id || ''))
    setCustomGlobalDiscount(discount)
    setHeaderTaxPercent(Number.isFinite(taxPercent) ? Number(taxPercent.toFixed(2)) : 0)
    setShariahMode(nextShariahMode)
    setHasDp(false)
    setDpMode('NOMINAL')
    setDpPercent('0')
    setDpAmount('0')
    setDpAccountId('')
    setLines(mappedLines.length > 0 ? mappedLines : [createEmptySaleLine()])
    setError(null)
    setSuccess(null)
    setShowModal(true)
  }

  const handleAddLine = () => {
    setLines([...lines, createEmptySaleLine()])
  }

  const handleRemoveLine = (id: number) => {
    if (lines.length === 1) return
    setLines(lines.filter(l => l.id !== id))
  }

  const handleLineChange = (id: number, field: string, value: any) => {
    setLines(lines.map(line => {
      if (line.id !== id) return line
      const updatedLine = { ...line, [field]: value }

      if (field === 'product_name') {
        const foundProduct = products.find((p: ProductWithStock) => p.name.toLowerCase() === String(value).toLowerCase())
        if (foundProduct) {
          updatedLine.product_id = foundProduct.id
          updatedLine.unit_price = foundProduct.selling_price || 0
          updatedLine.stock_available = foundProduct.stock_available || 0
          updatedLine.type = foundProduct.type
          updatedLine.unit = foundProduct.unit || 'Pcs'
        } else {
          updatedLine.product_id = '' 
          updatedLine.stock_available = 0
          updatedLine.type = 'SERVICE' 
          updatedLine.unit = 'Pasang' // Fallback for service? Or 'Unit'
        }
      }
      return updatedLine
    }))
  }

  const getFirstNonSalamStockShortage = () => {
    const requirementByProduct = new Map<string, { productName: string; requiredQty: number; availableQty: number; unit: string }>()

    for (const line of lines) {
      if (line.type !== 'INVENTORY' || !line.product_id) continue
      const qty = Number(line.quantity || 0)
      if (!Number.isFinite(qty) || qty <= 0) continue

      const current = requirementByProduct.get(line.product_id)
      if (current) {
        current.requiredQty += qty
        continue
      }

      requirementByProduct.set(line.product_id, {
        productName: line.product_name || line.product_id,
        requiredQty: qty,
        availableQty: Number(line.stock_available || 0),
        unit: line.unit || 'Pcs',
      })
    }

    for (const requirement of requirementByProduct.values()) {
      if ((requirement.requiredQty - requirement.availableQty) > STOCK_EPSILON) {
        return requirement
      }
    }

    return null
  }

  const handleCreateSale = async (e: React.FormEvent) => {
    e.preventDefault()
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const requestedMode = String(submitter?.value || 'PUBLISH').toUpperCase()
    const isDraftSave = requestedMode === 'DRAFT'

    const usableLines = lines.filter((line) => String(line.product_name || '').trim().length > 0)

    if (!customerId) return setError('Customer harus dipilih!')
    if (usableLines.length === 0) return setError('Tambahkan minimal 1 item sebelum menyimpan dokumen.')
    if (!isDraftSave && paymentTerm === 'LUNAS' && !paymentAccountId) return setError('Pilih akun penerimaan untuk transaksi Lunas!')
    if (!isDraftSave && shariahMode === 'SALAM' && paymentTerm !== 'LUNAS') return setError('Akad SALAM wajib dibayar lunas (tunai) di awal.')
    if (!isDraftSave && (paymentTerm === 'TEMPO' || shariahMode === 'SALAM') && !dueDate) return setError('Tanggal jatuh tempo pengiriman wajib diisi.')

    if (!isDraftSave && usableLines.some(l => !l.product_name || l.quantity <= 0 || l.unit_price < 0)) {
      return setError('Lengkapi detail barang, kuantitas, dan Harga Jual pada setiap baris.')
    }

    const dpFinalAmount = dpMode === 'PERCENT' ? ((parseFloat(dpPercent) || 0) / 100) * grandTotal : (parseFloat(dpAmount) || 0)

    let resolvedShariahMode: 'CASH' | 'SALAM' | 'ISTISHNA' = shariahMode
    let resolvedPaymentTerm: 'TEMPO' | 'LUNAS' = shariahMode === 'SALAM' ? 'LUNAS' : paymentTerm

    if (!isDraftSave && resolvedPaymentTerm === 'TEMPO' && hasDp && dpFinalAmount > grandTotal) {
      return setError('Nilai Uang Muka (DP) tidak boleh melebihi Total Penjualan.')
    }

    if (!isDraftSave && resolvedShariahMode !== 'SALAM' && resolvedShariahMode !== 'ISTISHNA') {
      const stockShortage = getFirstNonSalamStockShortage()
      if (stockShortage) {
        const stockMessage = `Stok produk "${stockShortage.productName}" tidak mencukupi. Dibutuhkan ${formatStockQuantity(
          stockShortage.requiredQty
        )}, tersedia ${formatStockQuantity(Math.max(0, stockShortage.availableQty))} ${stockShortage.unit}.`

        const wantsSalam = confirm(
          `${stockMessage}\n\nOtomatis ubah ke akad SALAM agar bisa diproses tanpa stok?\n\n(Pilih Cancel jika Anda ingin membatalkan dan mengubah manual menjadi akad ISTISHNA untuk dimanufaktur)`
        )
        if (wantsSalam) {
          resolvedShariahMode = 'SALAM'
          resolvedPaymentTerm = 'LUNAS'
          setShariahMode('SALAM')
          setPaymentTerm('LUNAS')
          setHasDp(false)
          setError(null)
        } else {
          return setError(`${stockMessage} Invoice biasa dibatalkan. Silakan ubah Dropdown mode akad ke ISTISHNA (jika diproduksi) atau SALAM.`)
        }
      }
    }

    setLoading(true)
    
    const payload = {
      customer_id: customerId,
      reseller_id: resellerId || null,
      sale_date: saleDate,
      due_date: (resolvedPaymentTerm === 'TEMPO' || resolvedShariahMode === 'SALAM') ? dueDate : null,
      notes,
      payment_term: resolvedShariahMode === 'SALAM' ? 'LUNAS' : resolvedPaymentTerm,
      payment_account_id: paymentAccountId,
      discount_amount: appliedDiscount,
      tax_amount: calculatedTax,
      shariah_mode: resolvedShariahMode,
      mode: isDraftSave ? 'DRAFT' : 'PUBLISH',
      draft_id: editingDraftSaleId || undefined,
      lines: usableLines.map(l => ({
        product_id: l.product_id || undefined,
        product_name: l.product_name,
        quantity: l.quantity,
        unit_price: l.unit_price,
        discount_amount: l.discount_amount
      }))
    }

    const res = await createSaleEntry(orgId, payload)

    if (res?.error) setError(res.error)
    else {
      // DIRECTLY PROCESS DOWN PAYMENT IF SUPPLIED
      if (!isDraftSave && resolvedPaymentTerm === 'TEMPO' && hasDp && dpFinalAmount > 0 && dpAccountId && res.saleId) {
         try {
           const dpRes = await processSalesPayment(orgId, {
             sale_id: res.saleId,
             account_id: dpAccountId,
             amount: dpFinalAmount,
             payment_date: saleDate,
             notes: 'Down Payment (Uang Muka) PO',
             discount_amount: 0
           })
           
           if (dpRes?.error) {
             console.error("Gagal menyimpan data uang muka", dpRes.error)
             setError(`Faktur berhasil dibuat, namun Uang Muka (DP) gagal diproses: ${dpRes.error}. Silakan input ulang uang muka lewat menu 'Terima Bayar'.`)
             setLoading(false)
             return
           }
         } catch (dpErr) {
           console.error("Gagal menyimpan data uang muka", dpErr)
           setError("Faktur berhasil dibuat, namun Uang Muka (DP) gagal diproses. Silakan input ulang uang muka lewat menu 'Terima Bayar'.")
           setLoading(false)
           return
         }
      }

      if (isDraftSave) {
        setSuccess(editingDraftSaleId ? 'Draft SO berhasil diperbarui.' : 'Draft SO berhasil disimpan.')
      } else {
        setSuccess(editingDraftSaleId ? 'SO draft berhasil diterbitkan ke approval.' : 'SO baru berhasil dikirim ke approval.')
      }
      setShowModal(false)
      resetSaleForm()
      setTimeout(() => setSuccess(null), 3500)
    }
    setLoading(false)
  }

  const handleCreateCustomer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    formData.set('type', 'CUSTOMER')
    const res = await createContact(orgId, formData)
    if (res?.error) setError(res.error)
    else {
      setSuccess('Customer baru berhasil ditambahkan.')
      setShowCustomerModal(false)
      setTimeout(() => setSuccess(null), 3500)
    }
    setLoading(false)
  }

  const executeDelivery = async (saleId: string, warehouseId?: string | null) => {
    setLoading(true)
    const res = await deliverSale(orgId, saleId, warehouseId || null)
    if (res?.error) setError(res.error)
    else {
      setSuccess('Penjualan berhasil diselesaikan (FINISHED)! Jurnal COGS telah dibukukan otomatis.')
      setShowDeliveryModal(false)
      setSelectedSaleForDelivery(null)
      setDeliveryWarehouseId('')
      setTimeout(() => setSuccess(null), 4000)
    }
    setLoading(false)
  }

  const handleDeliverPO = async (sale: any) => {
    const requiresInventorySync = (sale.sales_items || []).some((item: any) => (item?.products?.type || 'INVENTORY') === 'INVENTORY')

    if (!requiresInventorySync) {
      if (!confirm('Tandai pesanan jasa/non-stok ini sebagai selesai?')) return
      await executeDelivery(sale.id, null)
      return
    }

    const selectedWarehouse = warehouses.find((warehouse: any) => warehouse.id === sale.warehouse_id)

    if (selectedWarehouse) {
      if (!confirm(`Tandai barang sudah dikirim dari gudang "${selectedWarehouse.name}"?`)) return
      await executeDelivery(sale.id, selectedWarehouse.id)
      return
    }

    if (warehouses.length === 0) {
      setError(`Belum ada gudang aktif di unit ${activeBranchName || 'terpilih'}. Tambahkan gudang terlebih dahulu.`)
      return
    }

    if (warehouses.length === 1) {
      if (!confirm(`Tandai barang sudah dikirim dari gudang "${warehouses[0].name}"?`)) return
      await executeDelivery(sale.id, warehouses[0].id)
      return
    }

    setSelectedSaleForDelivery(sale)
    setDeliveryWarehouseId('')
    setShowDeliveryModal(true)
  }

  const handleVoidPO = async (id: string) => {
    if (!confirm('Anda yakin ingin membatalkan Penjualan ini?')) return
    setLoading(true)
    const res: any = await voidSale(orgId, id)
    if (res?.error) setError(res.error)
    else {
      setSuccess('Penjualan dibatalkan (VOIDED).')
      setTimeout(() => setSuccess(null), 3500)
    }
    setLoading(false)
  }

  const isSaleSalam = (sale: any) => String(sale?.shariah_mode || '').trim().toUpperCase() === 'SALAM'

  const getOutstandingAmount = (sale: any) => {
    const totalReturned = sale?.sales_returns?.reduce((acc: number, r: any) => acc + Number(r.grand_total || 0), 0) || 0
    const totalPaid = sale?.sales_payments?.reduce((acc: number, p: any) => acc + Number(p.amount || 0) + Number(p.discount_amount || 0), 0) || 0
    return Math.max(0, Number(sale?.grand_total || 0) - totalReturned - totalPaid)
  }

  const formatStockQuantity = (value: number) => {
    const parsed = Number(value || 0)
    if (!Number.isFinite(parsed)) return '0'
    const rounded = Math.round(parsed * 1_000_000) / 1_000_000
    return Number.isInteger(rounded)
      ? String(rounded)
      : rounded.toFixed(6).replace(/\.?0+$/, '')
  }

  const handleOpenPayment = (sale: any) => {
    const rem = getOutstandingAmount(sale)
    setSelectedSaleForPayment(sale);
    setPaymentAmount(rem)
    setDiscountAmount(0)
    setShowPaymentModal(true);
  }

  const handleProcessPayment = async () => {
    if (!collectionAccountId) return setError('Pilih akun penerimaan kas/bank!');
    if (paymentAmount <= 0 && discountAmount <= 0) return setError('Jumlah bayar atau diskon tidak valid!');
    const salamSale = isSaleSalam(selectedSaleForPayment)
    const outstanding = getOutstandingAmount(selectedSaleForPayment)

    if (salamSale) {
      if (discountAmount > 0) return setError('Akad SALAM tidak mendukung diskon pelunasan bertahap.')
      if (Math.abs((paymentAmount + discountAmount) - outstanding) > 0.01) {
        return setError(`Akad SALAM wajib dibayar lunas. Nominal yang harus dibayar: ${formatCurrency(outstanding)}.`)
      }
    }

    setLoading(true);
    const res = await processSalesPayment(orgId, {
      sale_id: selectedSaleForPayment.id,
      account_id: collectionAccountId,
      amount: paymentAmount,
      discount_amount: discountAmount,
      payment_date: paymentDate
    });

    if (res?.error) setError(res.error);
    else {
      setSuccess('Pembayaran cicilan berhasil dicatat! Jurnal akuntansi telah diposting.');
      setShowPaymentModal(false);
      setCollectionAccountId('');
      setDiscountAmount(0);
      setTimeout(() => setSuccess(null), 4000);
    }
    setLoading(false);
  }

  const handleOpenReturn = (sale: any) => {
    setSelectedSaleForReturn(sale)
    const initialQs: Record<string, number> = {}
    sale.sales_items.forEach((it: any) => {
      initialQs[it.id] = 0 // Default skip
    })
    setReturnQuantities(initialQs)
    setNotaRetur('NR-' + sale.sale_number)
    setRefundMode('AR')
    setRefundAccountId('')
    setShowReturnModal(true)
  }

  const handleProcessReturn = async () => {
    const itemsToReturn = selectedSaleForReturn.sales_items
      .filter((it: any) => returnQuantities[it.id] > 0)
      .map((it: any) => ({
        product_id: it.product_id,
        quantity: returnQuantities[it.id],
        unit_price: it.unit_price,
        sale_item_id: it.id
      }))

    if (itemsToReturn.length === 0) return setError('Pilih minimal 1 barang untuk diretur.')

    setLoading(true)
    const res = await processSalesReturn(orgId, {
      sale_id: selectedSaleForReturn.id,
      return_number: 'RET-' + selectedSaleForReturn.sale_number + '-' + Date.now().toString().slice(-4),
      nota_retur: notaRetur,
      items: itemsToReturn,
      refund_account_id: refundMode === 'CASH' ? refundAccountId : undefined
    })

    if (res?.error) setError(res.error)
    else {
      setSuccess('Retur Penjualan berhasil diproses! Stok, Piutang, HPP, dan Pajak telah dikoreksi.')
      setShowReturnModal(false)
      setTimeout(() => setSuccess(null), 5000)
    }
    setLoading(false)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount)
  }

  const stats = {
    omzetMonth: sales.filter((s: any) => s.status !== 'VOIDED' && s.sale_date.startsWith(new Date().toISOString().slice(0, 7))).reduce((sum: number, s: any) => sum + s.grand_total, 0),
    receivables: sales.filter((s: any) => s.status === 'FINISHED' && s.payment_status !== 'PAID').reduce((sum: number, s: any) => {
      const activeReturns = s.sales_returns?.filter((r: any) => r.status !== 'VOIDED') || []
      const ret = activeReturns.reduce((acc: number, r: any) => acc + Number(r.grand_total), 0) || 0
      const pay = (s.sales_payments || [])?.reduce((acc: number, p: any) => acc + Number(p.amount) + Number(p.discount_amount || 0), 0) || 0
      return sum + Math.max(0, s.grand_total - ret - pay)
    }, 0),
    newInvoices: sales.filter((s: any) => s.status === 'DRAFT' || s.status === 'ORDERED').length,
    customerCount: customers.length
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto pb-24">
      <div className={`space-y-12 ${viewSale ? 'print:hidden' : ''}`}>
        <PageHeader
        icon={<ShoppingCart />}
        title="Sales & Invoicing"
        subtitle="Manage customer orders, invoices, and trade receivables (Piutang)."
        tag="Revenue Module"
        actions={
          <>
            <SafeButton 
              variant="white"
              icon={<Users size={16} />}
              onClick={() => setShowCustomerModal(true)}
            >
              Customer Baru
            </SafeButton>
            <SafeButton 
              variant="primary"
              icon={<Plus size={18} />}
              onClick={() => {
                resetSaleForm()
                setShowModal(true)
              }}
            >
              Buat Invoice Jual
            </SafeButton>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="Omzet Jual (Bln Ini)" 
          value={formatRupiah(stats.omzetMonth)} 
          icon={TrendingUp}
          color="emerald"
          sub="Total tagihan terbit bulan ini"
        />
        <StatCard 
          label="Sisa Piutang (AR)" 
          value={formatRupiah(stats.receivables)} 
          icon={Wallet}
          color="blue"
          alert={stats.receivables > 0}
          sub="Tagihan client belum dibayar"
        />
        <StatCard 
          label="Invoice Menunggu" 
          value={`${stats.newInvoices} Faktur`} 
          icon={Clock}
          color="amber"
          sub="Faktur belum dikirim/selesai"
        />
        <StatCard 
          label="Client Aktif" 
          value={`${stats.customerCount} Customer`} 
          icon={Users}
          color="indigo"
          sub="Database customer terdaftar"
        />
      </div>

      <SectionCard>
        <SectionHeader 
          title="Histori Penjualan"
          subtitle="Daftar seluruh transaksi invoice dan pesanan pelanggan."
          actions={
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input placeholder="Cari nomor invoice atau customer..." className="pl-9 pr-4 py-2 text-[10px] font-bold border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-100 transition-all outline-none w-64" />
            </div>
          }
        />
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">No Invoice</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Pelanggan & Item</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Nilai Tagihan</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Status</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Aksi Cepat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sales.length === 0 ? (
                <tr><td colSpan={5} className="py-24 text-center text-slate-400 font-bold text-xs uppercase italic">Belum ada data penjualan.</td></tr>
              ) : (
                sales.map((s: any) => (
                  <tr key={s.id} className="group hover:bg-slate-50 transition-colors">
                    <td className="px-8 py-6">
                       <button onClick={() => setViewSale(s)} className="text-xs font-black text-blue-600 tracking-tighter hover:underline">
                         {s.sale_number}
                       </button>
                       <div className="text-[10px] font-bold text-slate-400 mt-1">{s.sale_date}</div>
                    </td>
                    <td className="px-8 py-6">
                       <div className="text-sm font-bold text-slate-900">{s.contacts?.name || 'Unknown Client'}</div>
                       <div className="flex gap-2 mt-1.5 overflow-hidden max-w-[300px]">
                          <span className="shrink-0 text-[10px] font-black px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-md border border-slate-200 uppercase tracking-tighter">
                            {s.sales_items?.length || 0} Item
                          </span>
                          <span className="text-[10px] text-slate-400 truncate font-medium italic">
                            {s.sales_items?.[0]?.description}{s.sales_items?.length > 1 ? ` & ${s.sales_items.length - 1} lainnya` : ''}
                          </span>
                       </div>
                       {pickRelation(s.sales_resellers) && (
                         <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[10px] font-black text-indigo-700">
                           <span className="uppercase tracking-widest">Reseller</span>
                           <span className="truncate">{getResellerDisplayName(pickRelation(s.sales_resellers))}</span>
                         </div>
                       )}
                    </td>
                    <td className="px-8 py-6 text-right">
                       {(() => {
                          const activeReturns = s.sales_returns?.filter((r: any) => r.status !== 'VOIDED') || [];
                          const totalReturned = activeReturns.reduce((acc: number, r: any) => acc + Number(r.grand_total), 0) || 0;
                          const paid = (s.sales_payments || [])?.reduce((acc: number, p: any) => acc + Number(p.amount) + Number(p.discount_amount || 0), 0) || 0;
                          const outstanding = s.grand_total - totalReturned - paid;

                          return (
                             <div className="flex flex-col items-end gap-1">
                                <div className="text-sm font-black text-slate-900 font-mono tracking-tighter">
                                  {outstanding > 0 && outstanding < (s.grand_total - totalReturned) ? formatRupiah(outstanding) : formatRupiah(s.grand_total - totalReturned)}
                                </div>
                                {outstanding > 0 && outstanding < (s.grand_total - totalReturned) && (
                                   <div className="text-[10px] text-slate-400 line-through opacity-50 font-bold">
                                     Faktur: {formatRupiah(s.grand_total - totalReturned)}
                                   </div>
                                )}
                                <div className={`text-[9px] font-black uppercase tracking-widest ${s.payment_status === 'PAID' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                  {s.payment_status === 'PAID' ? 'Lunas' : s.payment_status === 'PARTIAL' ? 'Angsuran / Sisa' : 'Unpaid'}
                                </div>
                                {totalReturned > 0 && (
                                   <div className="text-[9px] font-bold text-rose-500 uppercase tracking-tighter bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-100">
                                     Ada Retur: -{formatRupiah(totalReturned)}
                                   </div>
                                )}
                             </div>
                          );
                       })()}
                    </td>
                    <td className="px-8 py-6 text-center">
                       <StatusBadge 
                         label={s.status === 'FINISHED' ? 'Delivered' : s.status} 
                         variant={s.status === 'FINISHED' ? 'success' : s.status === 'VOIDED' ? 'error' : 'warning'} 
                       />
                    </td>
                    <td className="px-8 py-6">
                       <div className="flex flex-wrap items-center justify-end gap-2">
                         {s.status === 'DRAFT' && (
                           <button onClick={() => openDraftSaleEditor(s)} className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-500 hover:text-white transition-all border border-indigo-100" title="Edit Draft SO">
                             <Pencil size={16}/>
                           </button>
                         )}

                         {s.status === 'ORDERED' && (
                           <button onClick={() => handleDeliverPO(s)} className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm border border-emerald-100 group/btn" title="Kirim Barang">
                             <CheckSquare size={16}/>
                           </button>
                         )}
                         
                         {(s.status === 'DRAFT' || s.status === 'ORDERED' || (s.status === 'FINISHED' && s.payment_status === 'UNPAID')) && (
                           <button onClick={() => handleVoidPO(s.id)} className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-rose-500 hover:text-white transition-all border border-slate-100" title="Batalkan Transaksi">
                             <XCircle size={16}/>
                           </button>
                         )}

                         {s.status !== 'VOIDED' && (
                            <>
                              <button onClick={() => { setViewSale(s); setPrintMode('DELIVERY_ORDER'); }} className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-500 hover:text-white transition-all border border-blue-100" title="Preview & Cetak Surat Jalan">
                                <Printer size={16}/>
                              </button>
                              <button onClick={() => { setViewSale(s); setPrintMode('INVOICE'); }} className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-500 hover:text-white transition-all border border-blue-100" title="Preview & Cetak Invoice">
                                <FileText size={16}/>
                              </button>
                            </>
                         )}

                         {String(s?.shariah_mode || '').trim().toUpperCase() === 'ISTISHNA' && s.status === 'ORDERED' && (
                           <button 
                             onClick={async () => {
                               const proceed = confirm('Sistem akan otomatis membuat BoM baru dan mem-publish SPK (Work Order) untuk pesanan ini dengan tenggat waktu mengikuti Jatuh Tempo pengiriman. Lanjutkan?');
                               if (!proceed) return;
                               setLoading(true);
                               const { generateProductionFromSO } = await import('@/modules/factory/actions/soToBom.actions');
                               const res = await generateProductionFromSO(orgId, s.id);
                               if (res?.error) setError(res.error);
                               else {
                                 setSuccess('BoM dan SPK diproses! Mengarahkan ke Pabrik...');
                                 setTimeout(() => router.push('/factory'), 2000);
                               }
                               setLoading(false);
                             }}
                             disabled={loading}
                             className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-purple-700 transition-all shadow-lg shadow-purple-100 disabled:opacity-50" title="Auto-Generate BoM & SPK dari SO">
                             <Factory size={14}/> {loading ? 'Memproses...' : 'Proses Produksi'}
                           </button>
                         )}

                         {s.payment_status !== 'PAID' && (s.status === 'FINISHED' || ((isSaleSalam(s) || String(s?.shariah_mode || '').trim().toUpperCase() === 'ISTISHNA') && s.status === 'ORDERED')) && (
                           <button onClick={() => handleOpenPayment(s)} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100">
                             <DollarSign size={14}/> Terima Bayar
                           </button>
                         )}

                         {s.status === 'FINISHED' && (
                           <button onClick={() => handleOpenReturn(s)} className="p-2.5 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-500 hover:text-white transition-all border border-amber-100" title="Proses Retur">
                             <RotateCcw size={16}/>
                           </button>
                         )}
                       </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
      </div>

      <AnimatePresence>
        {/* MODAL BUAT INVOICE (DENGAN LINE ITEMS) */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setShowModal(false); resetSaleForm() }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
             <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl p-8 overflow-hidden max-h-[90vh] overflow-y-auto">
                <div className="absolute top-0 left-0 w-2 h-full bg-blue-600" />
                <h3 className="text-xl font-bold mb-6">
                  {editingDraftSaleId ? 'Edit Draft Sales Order (SO)' : 'Buat Pesanan Penjualan (SO / Invoice)'}
                </h3>
                
                <form onSubmit={handleCreateSale} className="space-y-6">
                  {/* HEADER SALES */}
                  {/* HEADER SALES & PAYMENT GUARDRAIL */}
                  <div className="flex flex-col md:flex-row gap-4 p-5 bg-slate-50 rounded-[28px] border border-slate-100 shadow-inner">
                    <div className="flex-1 space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">Mode Transaksi</label>
                      <select value={shariahMode} onChange={(e) => setShariahMode(e.target.value as any)} className="w-full h-[52px] px-4 py-2.5 border border-slate-200 rounded-2xl outline-none text-sm bg-white font-black text-blue-600 shadow-sm focus:border-blue-500 transition-all">
                         <option value="CASH">PENJUALAN LANGSUNG (CASH)</option>
                         <option value="SALAM">PENJUALAN SALAM (BAYAR DEPAN)</option>
                         <option value="ISTISHNA">PENJUALAN ISTISHNA (PESANAN/DP)</option>
                      </select>
                      {shariahMode === 'SALAM' && <p className="text-[9px] font-bold text-indigo-500 italic mt-1 leading-tight px-1">* Uang diterima lunas di awal, barang baru dikirim pada waktu yang ditentukan.</p>}
                      {shariahMode === 'ISTISHNA' && <p className="text-[9px] font-bold text-indigo-500 italic mt-1 leading-tight px-1">* Pesanan manufaktur/konstruksi, pembayaran boleh dicicil di awal.</p>}
                    </div>

                    <div className="flex-1 space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">Customer / Klien</label>
                      <select required value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full h-[52px] px-4 py-2.5 border border-slate-200 rounded-2xl outline-none text-sm bg-white font-black text-slate-900 shadow-sm focus:border-blue-500 transition-all">
                         <option value="">Pilih Customer...</option>
                         {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>

                    <div className="w-full md:w-48 space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">Metode Bayar</label>
                       <div className="flex p-1 bg-white border border-slate-200 rounded-2xl h-[52px]">
                          <button 
                             type="button" 
                             onClick={() => {
                               if (shariahMode === 'SALAM') return
                               setPaymentTerm('TEMPO')
                             }}
                             disabled={shariahMode === 'SALAM'}
                             className={`flex-1 rounded-xl text-[10px] font-black transition-all ${paymentTerm === 'TEMPO' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-400'} ${shariahMode === 'SALAM' ? 'opacity-40 cursor-not-allowed' : ''}`}
                          >
                             TEMPO
                          </button>
                          <button 
                             type="button" 
                             onClick={() => setPaymentTerm('LUNAS')}
                             className={`flex-1 rounded-xl text-[10px] font-black transition-all ${paymentTerm === 'LUNAS' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400'}`}
                          >
                             LUNAS
                          </button>
                       </div>
                       {shariahMode === 'SALAM' && (
                         <p className="text-[9px] font-bold text-emerald-600 italic mt-1 leading-tight px-1">* Akad SALAM wajib lunas di awal. Opsi TEMPO dinonaktifkan.</p>
                       )}
                    </div>

                    <div className="w-full md:w-40 space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">Tgl Faktur</label>
                      <input type="date" required value={saleDate} onChange={(e) => setSaleDate(e.target.value)} className="w-full h-[52px] px-4 py-2.5 border border-slate-200 rounded-2xl outline-none text-sm bg-white font-bold text-slate-900 shadow-sm focus:border-blue-500 transition-all" />
                    </div>

                    {(paymentTerm === 'TEMPO' || shariahMode === 'SALAM') && (
                       <div className="w-full md:w-40 space-y-2 animate-in fade-in slide-in-from-left-2 duration-300">
                         <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest block px-1">{shariahMode === 'SALAM' ? 'Jatuh Tempo Kirim' : 'Jatuh Tempo'}</label>
                         <input type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full h-[52px] px-4 py-2.5 border border-amber-200 rounded-2xl outline-none text-sm bg-amber-50/50 font-bold text-slate-900 shadow-sm focus:border-amber-500 transition-all" />
                       </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 p-5 bg-indigo-50/60 rounded-[28px] border border-indigo-100">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest block px-1">Reseller / Perusahaan Mitra</label>
                      <select value={resellerId} onChange={(e) => setResellerId(e.target.value)} className="w-full h-[52px] px-4 py-2.5 border border-indigo-200 rounded-2xl outline-none text-sm bg-white font-black text-slate-900 shadow-sm focus:border-indigo-500 transition-all">
                        <option value="">Tanpa reseller (direct customer)</option>
                        {resellers.map((reseller: any) => (
                          <option key={reseller.id} value={reseller.id}>
                            {getResellerDisplayName(reseller)}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] font-bold text-indigo-700/80 px-1">
                        Komisi reseller dihitung off-invoice. Nilai invoice customer tetap satu, tidak berubah, dan tidak dibuatkan invoice ganda.
                      </p>
                    </div>

                    <div className="rounded-[24px] border border-white/70 bg-white/80 px-5 py-4">
                      {selectedReseller ? (
                        <div className="space-y-2">
                          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Snapshot Komisi Saat SO Dibuat</div>
                          <div className="text-sm font-black text-slate-900">{getResellerDisplayName(selectedReseller)}</div>
                          <div className="text-[11px] font-bold text-slate-500">{getResellerSubtitle(selectedReseller)}</div>
                          <div className="inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">
                            {getCommissionSchemeLabel(selectedReseller.commission_type, selectedReseller.commission_value)}
                          </div>
                          <div className="text-[10px] font-bold text-slate-500">
                            Target bulanan: {formatRupiah(Number(selectedReseller.target_amount || 0))}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mode Direct Sales</div>
                          <div className="text-sm font-black text-slate-900">Invoice tidak terhubung reseller</div>
                          <div className="text-[11px] font-bold text-slate-500">
                            Pilih reseller jika transaksi ini berasal dari personal reseller atau perusahaan mitra.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                     {paymentTerm === 'LUNAS' && (
                       <div className="md:col-span-4 mt-2 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 animate-in slide-in-from-top-2 duration-300">
                          <SearchableSelect 
                             label="Rekening Penerimaan (Kas/Bank)"
                             options={paymentAccounts}
                             value={paymentAccountId}
                             onChange={(val) => setPaymentAccountId(val)}
                             placeholder="Pilih rekening untuk pelunasan langsung..."
                          />
                          <p className="text-[9px] font-bold text-emerald-600 mt-2 italic px-1">
                                 💡 Jurnal: (D) {paymentAccountId ? coa.find((a:any) => a.id === paymentAccountId)?.name : 'Kas/Bank'} vs (C) Pendapatan. Point of Sale (POS) Mode.
                          </p>
                       </div>
                     )}

                     {paymentTerm === 'TEMPO' && shariahMode !== 'SALAM' && (
                      <div className="md:col-span-4 mt-2 p-4 bg-amber-50 rounded-2xl border border-amber-200 animate-in slide-in-from-top-2 duration-300 space-y-3">
                         <div className="flex items-center gap-2">
                           <input type="checkbox" id="has_dp" checked={hasDp} onChange={e => setHasDp(e.target.checked)} className="w-4 h-4 text-amber-600 rounded border-amber-300" />
                           <label htmlFor="has_dp" className="text-xs font-bold text-amber-900 cursor-pointer">Terima Uang Muka (DP) Sebagian Tunai Hari Ini?</label>
                         </div>
                         
                         {hasDp && (
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 pt-2 border-t border-amber-100">
                             
                             <div className="space-y-2">
                               <div className="flex bg-amber-100/50 p-1 rounded-xl w-fit">
                                 <button type="button" onClick={() => setDpMode('NOMINAL')} className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${dpMode === 'NOMINAL' ? 'bg-amber-500 text-white shadow-sm' : 'text-amber-700/60 hover:text-amber-800'}`}>Nominal (Rp)</button>
                                 <button type="button" onClick={() => setDpMode('PERCENT')} className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${dpMode === 'PERCENT' ? 'bg-amber-500 text-white shadow-sm' : 'text-amber-700/60 hover:text-amber-800'}`}>Persentase (%)</button>
                               </div>

                               {dpMode === 'NOMINAL' ? (
                                  <CurrencyInput
                                    label="Nominal Uang Muka (Rp)"
                                    value={parseFloat(dpAmount) || 0}
                                    onChange={(val) => setDpAmount(val.toString())}
                                  />
                               ) : (
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">Persentase DP (%)</label>
                                    <div className="relative">
                                      <input type="number" min="0" max="100" step="any" value={dpPercent} onChange={e => setDpPercent(e.target.value)} className="w-full h-[52px] px-4 pr-10 py-2.5 border border-amber-200 rounded-2xl outline-none text-sm bg-white font-bold text-slate-900 shadow-sm focus:border-amber-500 transition-all" />
                                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                                    </div>
                                    {parseFloat(dpPercent) > 0 && <p className="text-[10px] font-bold text-amber-600 px-1 mt-1">Estimasi Setara: Rp {Intl.NumberFormat('id-ID').format((parseFloat(dpPercent)/100)*grandTotal)}</p>}
                                  </div>
                               )}
                             </div>

                             <div className="pt-8">
                               <SearchableSelect 
                                  label="Disimpan ke Kas/Bank"
                                  options={paymentAccounts}
                                  value={dpAccountId}
                                  onChange={setDpAccountId}
                                  placeholder="Pilih rekening Kas/Bank..."
                               />
                             </div>
                             <p className="md:col-span-2 text-[10px] font-bold text-amber-600 italic px-1">
                                    💡 Nilai DP akan otomatis masuk ke Kas/Bank pilihan Anda dan mengurangi Tagihan Piutang (AR) setelah barang dikirim / invoice selesai.
                             </p>
                           </div>
                         )}
                      </div>
                     )}

                  {/* LINE ITEMS */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Detail Penjualan (Items)</label>
                      <button type="button" onClick={handleAddLine} className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                        <Plus size={14}/> Tambah Baris
                      </button>
                    </div>

                    {/* Datalist Data Produk */}
                    <datalist id="product_sales_suggestions">
                      {products.map((p: ProductWithStock) => (
                        <option key={p.id} value={p.name} />
                      ))}
                    </datalist>

                    <div className="hidden sm:grid grid-cols-12 gap-2 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                       <div className="col-span-4">Barang / Jasa</div>
                       <div className="col-span-2">Qty Kuintitas</div>
                       <div className="col-span-3">Harga Jual / Satuan</div>
                       <div className="col-span-2">Diskon / Satuan (Rp)</div>
                       <div className="col-span-1 text-center">Aksi</div>
                    </div>

                    {lines.map((line) => {
                      const isStockShortage = line.type === 'INVENTORY' && line.quantity > line.stock_available
                      const isValidStock = !isStockShortage || shariahMode === 'SALAM'
                      
                      return (
                      <div key={line.id} className={`grid grid-cols-1 sm:grid-cols-12 gap-2 items-start bg-white p-3 sm:p-0 border sm:border-0 ${isStockShortage ? 'border-amber-400 bg-amber-50 rounded-xl' : 'border-slate-100 rounded-xl sm:rounded-none'}`}>
                        
                        <div className="sm:col-span-4">
                          <label className="sm:hidden text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Barang / Jasa</label>
                          <input 
                            required 
                            list="product_sales_suggestions" 
                            placeholder="Ketik/Pilih produk..." 
                            value={line.product_name} 
                            onChange={(e) => handleLineChange(line.id, 'product_name', e.target.value)} 
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none text-sm" 
                          />
                          {line.product_id ? (
                             <span className="text-[9px] font-bold text-blue-600 block mt-1">✓ Master ({line.type}) | Sisa Stok: {formatStockQuantity(line.stock_available)} {line.unit}</span>
                          ) : line.product_name ? (
                            <span className="text-[9px] font-bold text-purple-600 block mt-1">+ Jasa Kustom Non-Inventori</span>
                          ) : null}
                          {isStockShortage && shariahMode !== 'SALAM' && (
                            <span className="text-[10px] font-bold text-amber-600 block mt-1 flex items-center gap-1"><AlertCircle size={10}/> Peringatan: Melebihi Stok. Ubah ke akad SALAM untuk lanjut.</span>
                          )}
                          {isStockShortage && shariahMode === 'SALAM' && (
                            <span className="text-[10px] font-bold text-emerald-700 block mt-1 flex items-center gap-1"><CheckCircle2 size={10}/> Akad SALAM aktif: pesanan boleh dicatat, stok fisik dikurangi saat pengiriman.</span>
                          )}
                        </div>

                        <div className="col-span-2 flex gap-2">
                          <div className="w-full">
                            <label className="sm:hidden text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Qty</label>
                            <input 
                              type="number" required min="1" step="any"
                              value={line.quantity || ''} 
                              onChange={(e) => handleLineChange(line.id, 'quantity', parseFloat(e.target.value) || 0)} 
                              className={`w-full px-3 py-2 border rounded-lg outline-none text-sm ${!isValidStock ? 'border-amber-400 text-amber-700 bg-white' : 'border-slate-200'}`} 
                              placeholder="Qty"
                            />
                          </div>
                        </div>

                        <div className="sm:col-span-3">
                          <label className="sm:hidden text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Harga Jual / Satuan</label>
                          <CurrencyInput
                            label=""
                            value={line.unit_price}
                            onChange={(val) => handleLineChange(line.id, 'unit_price', val)}
                            className="!py-2 !rounded-lg !text-sm !font-medium !text-slate-700 focus:!border-blue-500"
                            placeholder="Rp 0"
                          />
                        </div>

                        <div className="sm:col-span-2">
                           <label className="sm:hidden text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Potongan Harga / {line.unit} (Rp)</label>
                          <CurrencyInput
                            label=""
                            value={line.discount_amount}
                            onChange={(val) => handleLineChange(line.id, 'discount_amount', val)}
                            className="!py-2 !rounded-lg !text-sm !font-medium !text-rose-500 focus:!border-blue-500"
                            placeholder="Diskon Item"
                          />
                        </div>

                        <div className="col-span-1 text-center pt-2 sm:pt-0">
                          <button type="button" onClick={() => handleRemoveLine(line.id)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                            <Trash2 size={16}/>
                          </button>
                        </div>
                      </div>
                    )})}
                  </div>

                  {/* Kalkulasi Footer */}
                  <div className="flex flex-col gap-3 bg-blue-50/50 px-6 py-4 rounded-2xl border border-blue-100">
                     <div className="flex justify-between items-center text-sm font-semibold text-blue-900">
                       <span>Total Harga Barang (Gross):</span>
                       <span>{formatCurrency(grossSubTotal)}</span>
                     </div>
                     <div className="flex justify-between items-center text-sm font-semibold text-blue-900">
                       <div className="flex flex-col">
                         <span>Diskon Global Faktur (Rp)</span>
                         <span className="text-[10px] font-normal opacity-70">Otomatis dari diskon per barang, bisa ditimpa.</span>
                       </div>
                       <CurrencyInput
                         label=""
                         value={customGlobalDiscount !== null ? customGlobalDiscount : autoLineDiscounts}
                         onChange={(val) => setCustomGlobalDiscount(val)}
                         className="!w-48 !py-2 !rounded-lg !text-right !font-bold !text-slate-900 bg-white"
                         placeholder="0"
                       />
                     </div>
                     <div className="flex justify-between items-center text-sm font-semibold text-blue-900">
                       <div className="flex flex-col">
                         <span>Pajak (PPN % Keluaran)</span>
                         <span className="text-[10px] font-normal opacity-70">Ditagihkan ke Customer (Berpengaruh ke Piutang)</span>
                       </div>
                       <div className="flex items-center gap-2">
                         {calculatedTax > 0 && <span className="text-xs text-blue-600 font-bold bg-white px-2 py-1 rounded-md">+{formatCurrency(calculatedTax)}</span>}
                         <input type="number" min="0" max="100" value={headerTaxPercent || ''} onChange={(e) => setHeaderTaxPercent(parseFloat(e.target.value) || 0)} className="w-20 px-3 py-1.5 border border-slate-200 rounded-lg outline-none text-right font-medium text-slate-700 bg-white" placeholder="0" />
                       </div>
                     </div>
                     <div className="border-t border-blue-200 my-2"></div>
                     <div className="flex justify-between items-center">
                       <span className="font-bold text-blue-900 text-lg">Total Ditagihkan (AR):</span>
                       <span className="text-xl font-bold text-blue-600 bg-white px-3 py-1 rounded-xl shadow-sm">{formatCurrency(grandTotal)}</span>
                     </div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-slate-100">
                    <button type="button" onClick={() => { setShowModal(false); resetSaleForm() }} className="flex-1 py-4 text-xs font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-2xl transition">Batal</button>
                    <button type="submit" value="DRAFT" disabled={loading} className="flex-1 py-4 px-6 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-2xl border border-indigo-200 transition">
                      {loading ? 'Menyimpan...' : 'Save Draft'}
                    </button>
                    <button type="submit" value="PUBLISH" disabled={loading} className="flex-2 py-4 px-8 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-2xl shadow-lg transition">
                      {loading ? 'Memproses...' : 'Terbitkan SO'}
                    </button>
                  </div>
                </form>
             </motion.div>
          </div>
        )}

        {/* Modal Customer Tambahan */}
        {showCustomerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCustomerModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
             <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-8">
                <h3 className="text-xl font-bold mb-8">Daftarkan Customer Baru</h3>
                <form onSubmit={handleCreateCustomer} className="space-y-6">
                   <input name="name" required placeholder="Nama Klien / Perusahaan" className="w-full px-5 py-3.5 border border-slate-200 rounded-xl outline-none text-sm font-bold text-slate-900 focus:border-blue-500 transition-all" />
                   <div className="grid grid-cols-2 gap-4">
                     <input name="email" type="email" placeholder="Email (Opsional)" className="w-full px-5 py-3.5 border border-slate-200 rounded-xl outline-none text-sm font-medium" />
                     <input name="phone" placeholder="No. Telepon" className="w-full px-5 py-3.5 border border-slate-200 rounded-xl outline-none text-sm font-medium" />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                     <input name="phone_wa" placeholder="WhatsApp (62xxx)" className="w-full px-5 py-3.5 border border-slate-200 rounded-xl outline-none text-sm font-medium" />
                     <input name="instagram" placeholder="Username Instagram" className="w-full px-5 py-3.5 border border-slate-200 rounded-xl outline-none text-sm font-medium" />
                   </div>
                   <textarea name="address" placeholder="Alamat Pengiriman/Penagihan" className="w-full px-5 py-3.5 border border-slate-200 rounded-xl outline-none text-sm min-h-[80px]" />
                   <div className="flex gap-3 pt-4">
                    <button type="button" onClick={() => setShowCustomerModal(false)} className="flex-1 py-4 text-xs font-bold text-slate-500 bg-slate-50 rounded-2xl">Batal</button>
                    <button type="submit" disabled={loading} className="flex-2 py-4 px-8 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-2xl shadow-lg shadow-blue-100">{loading ? 'Menyimpan...' : 'Simpan Customer'}</button>
                  </div>
                </form>
             </motion.div>
          </div>
        )}

        {showDeliveryModal && selectedSaleForDelivery && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !loading && setShowDeliveryModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
             <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl p-8">
                <h3 className="text-xl font-bold mb-2">Pilih Gudang Pengiriman</h3>
                <p className="text-sm text-slate-500 font-medium mb-6">
                  Stok fisik untuk <span className="font-bold text-slate-800">{selectedSaleForDelivery.sale_number}</span> akan dikurangi dari gudang ini.
                </p>

                <div className="space-y-2 mb-8">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">Gudang Aktif di {activeBranchName || 'Unit Terpilih'}</label>
                  <select
                    value={deliveryWarehouseId}
                    onChange={(e) => setDeliveryWarehouseId(e.target.value)}
                    className="w-full h-[52px] px-4 py-2.5 border border-slate-200 rounded-2xl outline-none text-sm bg-white font-black text-slate-900 shadow-sm focus:border-emerald-500 transition-all"
                  >
                    <option value="">Pilih gudang pengiriman...</option>
                    {warehouses.map((warehouse: any) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name} ({warehouse.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => setShowDeliveryModal(false)} className="flex-1 py-4 text-xs font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-2xl transition">Batal</button>
                  <button
                    type="button"
                    disabled={loading || !deliveryWarehouseId}
                    onClick={() => executeDelivery(selectedSaleForDelivery.id, deliveryWarehouseId)}
                    className="flex-1 py-4 px-8 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 rounded-2xl shadow-lg transition"
                  >
                    {loading ? 'Memproses...' : 'Kirim Barang'}
                  </button>
                </div>
             </motion.div>
          </div>
        )}

        {showReturnModal && selectedSaleForReturn && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !loading && setShowReturnModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
             <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-amber-50/50">
                   <div>
                     <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                       <RotateCcw className="text-amber-600" size={20} />
                       Retur Penjualan: {selectedSaleForReturn.sale_number}
                     </h2>
                     <p className="text-xs text-slate-500 font-medium">Pengembalian barang dan pemotongan piutang otomatis.</p>
                   </div>
                   <button onClick={() => setShowReturnModal(false)} className="p-2 hover:bg-white rounded-xl transition-colors"><XCircle className="text-slate-400" size={24} /></button>
                </div>
                <div className="p-6 overflow-y-auto space-y-6">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Nota Retur (Tax Sync)</label>
                        <input value={notaRetur} onChange={(e) => setNotaRetur(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-sm font-bold text-slate-700 focus:bg-white focus:border-amber-200 transition-all" />
                      </div>
                      <div className="space-y-1.5 opacity-50">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Customer</label>
                        <div className="px-4 py-3 bg-slate-100 rounded-2xl text-sm font-bold text-slate-600">{selectedSaleForReturn.contacts?.name}</div>
                      </div>
                   </div>

                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Pilih Barang yang Dikembalikan</label>
                      <div className="divide-y divide-slate-50 border border-slate-50 rounded-2xl overflow-hidden">
                        {selectedSaleForReturn.sales_items.map((it: any) => (
                           <div key={it.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                              <div>
                                <div className="text-sm font-bold text-slate-900">{it.description}</div>
                                 <div className="text-[10px] text-slate-400 font-bold">Terjual: {it.quantity} {it.products?.unit || 'Unit'} @ {formatCurrency(it.unit_price)}</div>
                              </div>
                              <div className="flex items-center gap-3">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Qty Retur:</label>
                                <input 
                                  type="number" min="0" max={it.quantity} step="any"
                                  value={returnQuantities[it.id] || 0}
                                  onChange={(e) => setReturnQuantities({...returnQuantities, [it.id]: Math.min(it.quantity, Math.max(0, parseFloat(e.target.value) || 0))})}
                                  className="w-20 px-3 py-2 border border-slate-200 rounded-xl outline-none text-sm font-bold text-blue-600 text-center"
                                />
                              </div>
                           </div>
                        ))}
                      </div>
                   </div>

                   <div className="space-y-4 px-6">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Mode Pengembalian Dana</label>
                      
                      {selectedSaleForReturn?.payment_status !== 'PAID' ? (
                         <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex flex-col gap-1">
                            <span className="text-xs font-black text-blue-800">Sistem Mengunci Potong Piutang (AR)</span>
                            <span className="text-[10px] font-bold text-blue-600">Karena tagihan invoice ini belum berstatus Lunas Penuh (PAID), sistem ERP akan secara paksa mengalihkan pengembalian ini untuk memotong sisa hutang/piutang pelanggan agar neraca tidak selisih.</span>
                         </div>
                      ) : (
                        <>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => setRefundMode('AR')}
                              className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold border transition-all ${refundMode === 'AR' ? 'bg-amber-600 text-white border-amber-600 shadow-lg shadow-amber-100' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                            >
                              Deposit / Potong Piutang (AR)
                            </button>
                            <button 
                              onClick={() => setRefundMode('CASH')}
                              className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold border transition-all ${refundMode === 'CASH' ? 'bg-amber-600 text-white border-amber-600 shadow-lg shadow-amber-100' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                            >
                              Refund Tunai / Bank
                            </button>
                          </div>

                          {refundMode === 'CASH' && (
                            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-1.5 pt-2">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Keluar dari Akun Kas/Bank</label>
                              <select 
                                value={refundAccountId}
                                onChange={(e) => setRefundAccountId(e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none text-sm font-bold text-slate-700 focus:border-amber-400 transition-all appearance-none"
                              >
                                <option value="">-- Pilih Akun Kas/Bank --</option>
                                {coa.filter((a: any) => a.code.startsWith('11')).map((a: any) => (
                                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                ))}
                              </select>
                            </motion.div>
                          )}
                        </>
                      )}
                    </div>

                    <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex flex-col gap-2 mx-6 mb-6">
                       <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                         <span>Estimasi Nilai Barang (Net):</span>
                         <span>{formatCurrency(selectedSaleForReturn.sales_items.reduce((acc: number, it: any) => acc + ((returnQuantities[it.id] || 0) * it.unit_price), 0))}</span>
                       </div>
                       <div className="flex justify-between items-center text-xs font-bold text-amber-600">
                         <span>Koreksi PPN (11%):</span>
                         <span>{formatCurrency(selectedSaleForReturn.sales_items.reduce((acc: number, it: any) => acc + ((returnQuantities[it.id] || 0) * it.unit_price), 0) * 0.11)}</span>
                       </div>
                       <div className="border-t border-amber-200 my-1"></div>
                       <div className="flex justify-between items-center text-sm font-black text-slate-900 uppercase">
                         <span>{refundMode === 'AR' ? 'Total Pengurangan Piutang:' : 'Total Refund Tunai/Bank:'}</span>
                         <span>{formatCurrency(selectedSaleForReturn.sales_items.reduce((acc: number, it: any) => acc + ((returnQuantities[it.id] || 0) * it.unit_price), 0) * 1.11)}</span>
                       </div>
                    </div>
                </div>
                <div className="p-6 bg-slate-50 flex items-center justify-between">
                   <div className="text-[10px] text-slate-400 font-bold max-w-[200px]">💡 Sistem akan otomatis membalik jurnal Pendapatan, PPN, dan HPP sesuai proporsi unit.</div>
                   <div className="flex gap-3">
                      <button onClick={() => setShowReturnModal(false)} className="px-6 py-3 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors">Batal</button>
                      <button 
                        onClick={handleProcessReturn}
                        disabled={loading}
                        className="px-8 py-3 bg-amber-600 text-white text-sm font-bold rounded-2xl hover:bg-amber-700 shadow-xl shadow-amber-100 disabled:opacity-50 transition-all flex items-center gap-2"
                      >
                        {loading ? 'Memproses...' : 'Konfirmasi Retur Barang'}
                        {!loading && <CheckSquare size={18}/>}
                      </button>
                   </div>
                 </div>
              </motion.div>
          </div>
        )}

        {viewSale && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 print:static print:block print:p-0">
             <style>{`
               @media print {
                 @page { size: A4; margin: 12mm; }
                 body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                 body * { visibility: hidden !important; }
                 #so-print-area, #so-print-area * { visibility: visible !important; }
                 #so-print-area {
                   position: absolute;
                   left: 0;
                   top: 0;
                   width: 100%;
                   max-width: none;
                   margin: 0;
                   padding: 0;
                   border: none;
                   box-shadow: none;
                   overflow: visible;
                   background: #fff;
                 }
                 .so-no-print { display: none !important; }
               }
             `}</style>
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewSale(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm print:hidden so-no-print" />
             <motion.div id="so-print-area" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col print:shadow-none print:max-h-none print:h-auto print:max-w-none print:w-full print:mx-auto print:rounded-none print:text-[11px] print:leading-relaxed">
                {/* Print Business Profile Header */}
                <div className="hidden print:flex justify-between items-start pb-6 border-b-2 border-slate-900 mb-6 w-full">
                    <div className="flex flex-col text-left">
                       <div className="flex items-center gap-4">
                          <img src={companyProfile.logo} alt="Logo Perusahaan" className="w-14 h-14 object-contain" />
                          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{companyProfile.name}</h2>
                       </div>
                       <p className="text-xs font-medium text-slate-700 max-w-[350px] mt-1">{companyProfile.address}</p>
                       <div className="flex items-center gap-4 mt-2 text-[10px] font-bold text-slate-500">
                          {companyProfile.hotline && <span>Telp/WA: {companyProfile.hotline}</span>}
                          {companyProfile.email && <span>Email: {companyProfile.email}</span>}
                          {companyProfile.website && <span>Web: {companyProfile.website}</span>}
                       </div>
                    </div>
                </div>

                <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center print:bg-transparent print:border-none print:px-0 print:pt-0 print:mb-0">
                   <div className="print:text-center print:w-full">
                      <h3 className="text-xl font-bold text-slate-900 print:text-2xl print:tracking-widest">{printMode === 'DELIVERY_ORDER' ? 'SURAT JALAN / MANIFEST PENGIRIMAN' : 'SALES ORDER / INVOICE'}</h3>
                      <p className="text-sm font-semibold text-blue-600 print:text-slate-900 print:mt-1">{viewSale.sale_number}</p>
                   </div>
                   <button onClick={() => setViewSale(null)} className="p-2 text-slate-400 hover:text-slate-600 bg-white rounded-full hover:bg-slate-200 transition-colors print:hidden so-no-print">
                     <XCircle size={24}/>
                   </button>
                </div>
                
                <div className="p-6 overflow-y-auto w-full print:overflow-visible print:px-0 print:py-0">
                   <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                      <div>
                         <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 print:text-slate-600">Customer / Klien</p>
                         <p className="font-bold text-slate-900">{viewSale.contacts?.name || 'Unknown'}</p>
                         {pickRelation(viewSale.sales_resellers) && (
                           <p className="mt-2 text-[11px] font-bold text-indigo-600">
                             Reseller: {getResellerDisplayName(pickRelation(viewSale.sales_resellers))}
                           </p>
                         )}
                      </div>
                      <div className="text-right">
                         <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 print:text-slate-600">Tanggal & Status</p>
                         <p className="font-bold text-slate-900 mb-1">{viewSale.sale_date} {viewSale.due_date ? `| Tempo: ${viewSale.due_date}` : ''}</p>
                         <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border border-blue-200 bg-blue-50 text-blue-600`}>{viewSale.status === 'FINISHED' ? 'DELIVERED' : viewSale.status}</span>
                         <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border border-emerald-200 bg-emerald-50 text-emerald-600 ml-1 ${printMode === 'DELIVERY_ORDER' ? 'print:hidden' : ''}`}>{viewSale.payment_status}</span>
                      </div>
                   </div>

                   <table className="w-full mb-6 relative border-collapse print:border print:border-slate-200">
                     <thead className="border-y border-slate-100 bg-slate-50/50 print:bg-slate-100 print:text-slate-900">
                        <tr>
                           <th className="py-3 px-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest print:text-slate-900 print:border print:border-slate-200">Deskripsi Barang/Jasa</th>
                           <th className="py-3 px-2 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest print:text-slate-900 print:border print:border-slate-200 w-24">Qty</th>
                           <th className={`py-3 px-2 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest print:text-slate-900 print:border print:border-slate-200 ${printMode === 'DELIVERY_ORDER' ? 'print:hidden' : ''}`}>Harga</th>
                           <th className={`py-3 px-2 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest print:text-slate-900 print:border print:border-slate-200 ${printMode === 'DELIVERY_ORDER' ? 'print:hidden' : ''}`}>Diskon</th>
                           <th className={`py-3 px-2 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest print:text-slate-900 print:border print:border-slate-200 ${printMode === 'DELIVERY_ORDER' ? 'print:hidden' : ''}`}>Total</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50 text-xs">
                        {viewSale.sales_items?.map((item: any) => (
                          <tr key={item.id}>
                             <td className="py-3 px-2 font-medium text-slate-900 print:border print:border-slate-200">{item.description}</td>
                              <td className="py-3 px-2 text-right text-slate-600 font-bold print:border print:border-slate-200">{item.quantity} {item.products?.unit || ''}</td>
                             <td className={`py-3 px-2 text-right text-slate-600 print:border print:border-slate-200 ${printMode === 'DELIVERY_ORDER' ? 'print:hidden' : ''}`}>{formatCurrency(item.unit_price)}</td>
                             <td className={`py-3 px-2 text-right text-rose-500 print:border print:border-slate-200 ${printMode === 'DELIVERY_ORDER' ? 'print:hidden' : ''}`}>{item.discount_amount > 0 ? formatCurrency(item.discount_amount) : '-'}</td>
                             <td className={`py-3 px-2 text-right font-bold text-slate-900 print:border print:border-slate-200 ${printMode === 'DELIVERY_ORDER' ? 'print:hidden' : ''}`}>{formatCurrency((item.quantity * item.unit_price) - item.discount_amount)}</td>
                          </tr>
                        ))}
                     </tbody>
                   </table>

                   <div className={`w-full bg-slate-50 rounded-2xl p-4 flex flex-col gap-2 shadow-inner print:shadow-none print:border print:border-slate-200 ${printMode === 'DELIVERY_ORDER' ? 'print:hidden' : ''}`}>
                      <div className="flex justify-between text-xs font-semibold text-slate-500">
                         <span>Subtotal Barang:</span>
                         <span>{formatCurrency(viewSale.total_amount)}</span>
                      </div>
                      {viewSale.discount_amount > 0 && (
                        <div className="flex justify-between text-xs font-semibold text-rose-500">
                           <span>Diskon Global (Potongan Akhir):</span>
                           <span>-{formatCurrency(viewSale.discount_amount)}</span>
                        </div>
                      )}
                      {viewSale.tax_amount > 0 && (
                        <div className="flex justify-between text-xs font-semibold text-slate-500">
                           <span>PPN / Pajak:</span>
                           <span>+{formatCurrency(viewSale.tax_amount)}</span>
                        </div>
                      )}
                      <div className="border-t border-slate-200 mt-2 pt-2 flex justify-between items-center">
                         <span className="font-bold text-slate-900 text-sm">TOTAL TAGIHAN (AR):</span>
                         <span className="font-black text-blue-600 text-lg">{formatCurrency(viewSale.grand_total)}</span>
                      </div>
                   </div>

                   {/* Riwayat Pembayaran */}
                   <div className={`${printMode === 'DELIVERY_ORDER' ? 'print:hidden' : ''}`}>
                      {viewSale.sales_payments && viewSale.sales_payments.length > 0 && (
                         <div className="mt-6 border border-emerald-100 bg-emerald-50/50 rounded-2xl p-4 print:border-slate-200 print:bg-white">
                            <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-widest mb-3 flex items-center gap-1 print:text-slate-800"><DollarSign size={14}/> Histori Pembayaran / Pelunasan</h4>
                            <div className="space-y-2">
                               {viewSale.sales_payments.map((p: any, i: number) => (
                                  <div key={i} className="flex justify-between text-xs text-emerald-700 bg-white p-2 rounded-xl border border-emerald-100 shadow-sm print:text-slate-800 print:border-slate-200">
                                     <span>{p.amount > 0 ? formatCurrency(p.amount) : 'Diskon Payment: ' + formatCurrency(p.discount_amount)}</span>
                                     <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase tracking-wider print:bg-slate-100 print:text-slate-800">Sukses</span>
                                  </div>
                               ))}
                            </div>
                         </div>
                      )}
                   </div>

                   {/* Footer Tanda Tangan — tampil di semua mode print */}
                   <div className="hidden print:block mt-10 w-full">
                     {/* QR Approval + Signature Row */}
                     <div className="flex justify-between items-end px-4">
                       {/* Pengirim */}
                       <div className="text-center">
                          <p className="text-xs font-bold mb-14 text-slate-600">Pengirim,</p>
                          <p className="text-sm font-bold border-b-2 border-slate-900 px-6 mb-1">({companyProfile.name})</p>
                       </div>

                       {/* QR Code Area */}
                       {approvalQr ? (
                         <div className="flex flex-col items-center gap-1">
                           <QRCodeSVG value={approvalQr} size={72} level="H" fgColor="#1e293b" />
                           <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Disetujui &amp; Ditandatangani Digital</p>
                           <p className="text-[7px] text-slate-300 font-mono">{viewSale.id}</p>
                         </div>
                       ) : (
                         <div className="flex flex-col items-center gap-1 opacity-30">
                           <div className="w-16 h-16 border-2 border-dashed border-slate-300 rounded flex items-center justify-center">
                             <span className="text-[8px] text-slate-400 text-center leading-tight">Belum<br/>Disetujui</span>
                           </div>
                         </div>
                       )}

                       {/* Penerima */}
                       <div className="text-center">
                          <p className="text-xs font-bold mb-14 text-slate-600">Penerima,</p>
                          <p className="text-sm border-b border-slate-400 px-6 w-36 mb-1"></p>
                       </div>
                     </div>
                   </div>
                </div>
                
                <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-2 print:hidden so-no-print">
                   <button onClick={() => { setPrintMode('INVOICE'); setTimeout(() => window.print(), 100); }} className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all border border-slate-200">
                      Cetak SO / Invoice
                   </button>
                   <button onClick={() => { setPrintMode('DELIVERY_ORDER'); setTimeout(() => window.print(), 100); }} className="px-4 py-2 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all border border-blue-200">
                      Cetak Surat Jalan
                   </button>
                   <button onClick={() => setViewSale(null)} className="px-6 py-2.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-xl shadow-md transition-all border border-slate-700 ml-2">
                      Tutup
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showPaymentModal && selectedSaleForPayment && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPaymentModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
              
              <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
                <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-emerald-50/50">
                    <div>
                       <h3 className="text-xl font-black text-slate-900">Terima Pembayaran</h3>
                       <p className="text-xs text-slate-400 font-bold mt-1 uppercase">Faktur: {selectedSaleForPayment.sale_number}</p>
                    </div>
                    <button onClick={() => setShowPaymentModal(false)} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 hover:text-rose-500">
                      <XCircle size={24}/>
                    </button>
                </div>
                
                <div className="p-8 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                   {/* INFO SISA TAGIHAN */}
                   <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                      <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200">
                        <div className="text-xs font-bold text-slate-400 uppercase">Sisa Tagihan</div>
                        <div className="text-xl font-black text-emerald-600">
                          {formatCurrency(getOutstandingAmount(selectedSaleForPayment))}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rincian Faktur</label>
                        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden divide-y divide-slate-50">
                           {selectedSaleForPayment.sales_items?.map((item: any) => (
                             <div key={item.id} className="p-3 flex justify-between items-center text-xs">
                                <div>
                                   <div className="font-bold text-slate-900">{item.description}</div>
                                   <div className="text-[10px] text-slate-400">{item.quantity} x {formatCurrency(item.unit_price)}</div>
                                </div>
                                <div className="font-bold text-slate-700">{formatCurrency(item.quantity * item.unit_price)}</div>
                             </div>
                           ))}
                           <div className="p-3 bg-slate-50/50 flex justify-between items-center text-[11px] font-bold">
                              <span className="text-slate-500 uppercase">Total Invoice (+Tax/Disc):</span>
                              <span className="text-blue-600 font-black">{formatCurrency(selectedSaleForPayment.grand_total)}</span>
                           </div>
                        </div>
                      </div>
                   </div>

                   {/* INPUT NOMINAL */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <CurrencyInput 
                         label="Jumlah Bayar (IDR)"
                         value={paymentAmount}
                         onChange={setPaymentAmount}
                         name="amount"
                         highlight
                      />
                      <CurrencyInput 
                         label="Diskon Pelunasan (Rp)"
                         value={discountAmount}
                         onChange={(newDiscount) => {
                            if (isSaleSalam(selectedSaleForPayment)) {
                              setDiscountAmount(0)
                              setPaymentAmount(getOutstandingAmount(selectedSaleForPayment))
                              return
                            }
                            const currentRem = getOutstandingAmount(selectedSaleForPayment)
                            setDiscountAmount(newDiscount)
                            setPaymentAmount(Math.max(0, currentRem - newDiscount))
                         }}
                         labelClassName="text-rose-400"
                         className="!text-rose-600 !border-rose-100/50"
                         disabled={isSaleSalam(selectedSaleForPayment)}
                      />
                   </div>

                   {isSaleSalam(selectedSaleForPayment) && (
                     <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-[11px] font-bold text-emerald-700">
                       Akad SALAM: pembayaran wajib lunas di awal dan akan dicatat sebagai Hutang Salam sampai barang dikirim.
                     </div>
                   )}

                   <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Terima ke Akun</label>
                        <select 
                          value={collectionAccountId}
                          onChange={(e) => setCollectionAccountId(e.target.value)}
                          className="w-full mt-1.5 px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 ring-emerald-100 text-sm font-bold text-slate-700 appearance-none"
                        >
                          <option value="">-- Pilih Kas/Bank --</option>
                          {coa.filter((a: any) => a.code.startsWith('11')).map((a: any) => (
                            <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tanggal Bayar</label>
                        <input 
                          type="date" 
                          value={paymentDate}
                          onChange={(e) => setPaymentDate(e.target.value)}
                          className="w-full mt-1.5 px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 ring-emerald-100 text-sm font-bold text-slate-700"
                        />
                      </div>
                   </div>
                </div>
   

                <div className="px-8 py-6 bg-slate-50 border-t border-slate-100">
                   <div className="bg-slate-900/5 p-4 rounded-2xl flex justify-between items-center mb-6">
                       <span className="text-[10px] font-black text-slate-400 uppercase">Total Pengurangan Piutang:</span>
                       <span className="text-sm font-black text-slate-700">{formatCurrency(paymentAmount + discountAmount)}</span>
                    </div>
                    <div className="flex items-center justify-end gap-3">
                       <button onClick={() => setShowPaymentModal(false)} className="px-6 py-3 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors">Batal</button>
                       <button 
                         onClick={handleProcessPayment}
                         disabled={loading || !collectionAccountId || (paymentAmount + discountAmount) <= 0}
                         className="px-8 py-3 bg-emerald-600 text-white text-sm font-bold rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-100 disabled:opacity-50 transition-all flex items-center gap-2"
                       >
                         {loading ? 'Memproses...' : 'Simpan Pembayaran'}
                         {!loading && <CheckSquare size={18}/>}
                       </button>
                    </div>
                </div>
              </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-8 right-8 z-[100] flex flex-col gap-2">
        <AnimatePresence>
          {error && (
            <motion.div initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }} className="bg-red-50 border border-red-100 px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 text-red-600 text-sm font-bold">
              <AlertCircle size={18} /> {error}
            </motion.div>
          )}
          {success && (
            <motion.div initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }} className="bg-emerald-50 border border-emerald-100 px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 text-emerald-600 text-sm font-bold">
              <CheckCircle2 size={18} /> {success}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
