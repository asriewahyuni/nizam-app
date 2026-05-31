'use client'

import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Plus, Package, X, Edit, Trash2, AlertTriangle, Info, History as HistoryIcon, Search, TrendingUp, Wallet, Box } from 'lucide-react'
import { PageHeader, StatCard, SectionCard, SectionHeader, SafeButton, useConfirm} from '@/components/ui/NizamUI'
import { createProduct, updateProduct, deleteProduct, createInventoryAdjustment, createInventoryTransfer, getWarehouseStocks, getProductByBarcode } from '@/modules/inventory/actions/inventory.actions'
import { BarcodeScanner } from '@/components/shared/BarcodeScanner'
import type { InventoryMutationRow, InventoryWarehouseStockRow, ProductWithStock } from '@/modules/inventory/actions/inventory.actions'
import { formatDate, formatRupiah } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeftRight, ArrowRight, CheckCircle2, ChevronDown, ListChecks, Printer } from 'lucide-react'
import { BarcodeLabel } from '@/components/shared/BarcodeLabel'

interface InventoryClientProps {
  orgId: string
  activeBranchId: string | null
  activeBranchName?: string | null
  initialProducts: ProductWithStock[]
  warehouseSnapshot: InventoryWarehouseStockRow[]
  recentMutations: InventoryMutationRow[]
  warehouses: any[]
}

type InventoryCategoryFilter = 'ALL' | 'RAW' | 'WIP' | 'FG' | 'OTHER'
type InventorySortOption =
  | 'updated-desc'
  | 'name-asc'
  | 'name-desc'
  | 'stock-desc'
  | 'stock-asc'
  | 'value-desc'
  | 'value-asc'
  | 'purchase-desc'
  | 'selling-desc'

const inventorySortOptions: Array<{ value: InventorySortOption; label: string }> = [
  { value: 'updated-desc', label: 'Update Terakhir' },
  { value: 'name-asc', label: 'Nama A-Z' },
  { value: 'name-desc', label: 'Nama Z-A' },
  { value: 'stock-desc', label: 'Stok Terbanyak' },
  { value: 'stock-asc', label: 'Stok Tersedikit' },
  { value: 'value-desc', label: 'Nilai Aset Tertinggi' },
  { value: 'value-asc', label: 'Nilai Aset Terendah' },
  { value: 'purchase-desc', label: 'Modal Tertinggi' },
  { value: 'selling-desc', label: 'Harga Jual Tertinggi' },
]

function compareInventoryText(left: string | null | undefined, right: string | null | undefined) {
  return String(left || '').localeCompare(String(right || ''), 'id-ID', { sensitivity: 'base' })
}

function compareInventoryNumber(left: number | null | undefined, right: number | null | undefined, direction: 'asc' | 'desc') {
  const leftValue = Number(left || 0)
  const rightValue = Number(right || 0)

  if (leftValue === rightValue) return 0
  return direction === 'asc' ? leftValue - rightValue : rightValue - leftValue
}

function compareInventoryDate(left: string | null | undefined, right: string | null | undefined, direction: 'asc' | 'desc') {
  const leftValue = left ? new Date(left).getTime() : 0
  const rightValue = right ? new Date(right).getTime() : 0

  if (leftValue === rightValue) return 0
  return direction === 'asc' ? leftValue - rightValue : rightValue - leftValue
}

// Menjaga daftar inventori tetap rapi walau ada data baru dari form tambah atau edit.
function sortInventoryProducts(items: ProductWithStock[], sort: InventorySortOption) {
  return [...items].sort((left, right) => {
    switch (sort) {
      case 'updated-desc': {
        const byUpdated = compareInventoryDate(left.updated_at, right.updated_at, 'desc')
        if (byUpdated !== 0) return byUpdated
        const byCreated = compareInventoryDate(left.created_at, right.created_at, 'desc')
        if (byCreated !== 0) return byCreated
        break
      }
      case 'name-desc': {
        const byName = compareInventoryText(right.name, left.name)
        if (byName !== 0) return byName
        break
      }
      case 'stock-desc': {
        const byStock = compareInventoryNumber(left.stock_available, right.stock_available, 'desc')
        if (byStock !== 0) return byStock
        const byValue = compareInventoryNumber(left.stock_value, right.stock_value, 'desc')
        if (byValue !== 0) return byValue
        break
      }
      case 'stock-asc': {
        const byStock = compareInventoryNumber(left.stock_available, right.stock_available, 'asc')
        if (byStock !== 0) return byStock
        const byValue = compareInventoryNumber(left.stock_value, right.stock_value, 'asc')
        if (byValue !== 0) return byValue
        break
      }
      case 'value-desc': {
        const byValue = compareInventoryNumber(left.stock_value, right.stock_value, 'desc')
        if (byValue !== 0) return byValue
        const byStock = compareInventoryNumber(left.stock_available, right.stock_available, 'desc')
        if (byStock !== 0) return byStock
        break
      }
      case 'value-asc': {
        const byValue = compareInventoryNumber(left.stock_value, right.stock_value, 'asc')
        if (byValue !== 0) return byValue
        const byStock = compareInventoryNumber(left.stock_available, right.stock_available, 'asc')
        if (byStock !== 0) return byStock
        break
      }
      case 'purchase-desc': {
        const byPurchase = compareInventoryNumber(left.purchase_price, right.purchase_price, 'desc')
        if (byPurchase !== 0) return byPurchase
        break
      }
      case 'selling-desc': {
        const bySelling = compareInventoryNumber(left.selling_price, right.selling_price, 'desc')
        if (bySelling !== 0) return bySelling
        break
      }
      default: {
        const byName = compareInventoryText(left.name, right.name)
        if (byName !== 0) return byName
      }
    }

    const byName = compareInventoryText(left.name, right.name)
    if (byName !== 0) return byName
    return compareInventoryText(left.sku, right.sku)
  })
}

function getInventoryCategoryMeta(category?: string | null) {
  if (category === 'Bahan') {
    return {
      filter: 'RAW' as InventoryCategoryFilter,
      label: 'Bahan Baku',
      description: 'Komponen utama produksi',
      badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
    }
  }

  if (category === 'Setengah Jadi') {
    return {
      filter: 'WIP' as InventoryCategoryFilter,
      label: 'Setengah Jadi',
      description: 'Produk antar-proses',
      badgeClass: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    }
  }

  if (category === 'Siap Jual') {
    return {
      filter: 'FG' as InventoryCategoryFilter,
      label: 'Barang Jadi',
      description: 'Siap dijual atau dikirim',
      badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    }
  }

  if (category === 'Pelengkap') {
    return {
      filter: 'OTHER' as InventoryCategoryFilter,
      label: 'Pelengkap',
      description: 'Bahan pendukung dan kemasan',
      badgeClass: 'border-cyan-200 bg-cyan-50 text-cyan-700',
    }
  }

  if (category === 'Layanan') {
    return {
      filter: 'OTHER' as InventoryCategoryFilter,
      label: 'Layanan',
      description: 'Jasa dan tenaga kerja',
      badgeClass: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
    }
  }

  return {
    filter: 'OTHER' as InventoryCategoryFilter,
    label: category || 'Lainnya',
    description: 'Kategori pendukung',
    badgeClass: 'border-slate-200 bg-slate-100 text-slate-700',
  }
}

function matchesInventoryCategoryFilter(product: ProductWithStock, filter: InventoryCategoryFilter) {
  return matchesInventoryCategoryValue(product.category, filter)
}

function matchesInventoryCategoryValue(category: string | null | undefined, filter: InventoryCategoryFilter) {
  if (filter === 'ALL') return true
  return getInventoryCategoryMeta(category).filter === filter
}

function matchesInventorySearch(values: Array<string | null | undefined>, normalizedSearchTerm: string) {
  if (!normalizedSearchTerm) return true
  return values.some((value) => String(value || '').toLowerCase().includes(normalizedSearchTerm))
}

function formatInventoryQuantity(quantity: number) {
  const absolute = Math.abs(quantity)
  const hasFraction = Math.abs(absolute - Math.trunc(absolute)) > 0.0001
  const formatter = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  })

  return `${quantity > 0 ? '+' : quantity < 0 ? '-' : ''}${formatter.format(absolute)}`
}

function getInventoryMutationTypeMeta(referenceType: string) {
  switch (referenceType) {
    case 'PURCHASE':
      return {
        label: 'Pembelian',
        badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      }
    case 'PURCHASE_RETURN':
      return {
        label: 'Retur Pembelian',
        badgeClass: 'border-orange-200 bg-orange-50 text-orange-700',
      }
    case 'SALE':
      return {
        label: 'Penjualan',
        badgeClass: 'border-rose-200 bg-rose-50 text-rose-700',
      }
    case 'SALES_RETURN':
      return {
        label: 'Retur Penjualan',
        badgeClass: 'border-cyan-200 bg-cyan-50 text-cyan-700',
      }
    case 'ADJUSTMENT':
      return {
        label: 'Adjustment',
        badgeClass: 'border-violet-200 bg-violet-50 text-violet-700',
      }
    default:
      return {
        label: referenceType || 'Mutasi',
        badgeClass: 'border-slate-200 bg-slate-100 text-slate-700',
      }
  }
}

function getInventoryMovementDirectionMeta(quantity: number) {
  if (quantity > 0) {
    return {
      label: 'Masuk',
      badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    }
  }

  if (quantity < 0) {
    return {
      label: 'Keluar',
      badgeClass: 'border-rose-200 bg-rose-50 text-rose-700',
    }
  }

  return {
    label: 'Netral',
    badgeClass: 'border-slate-200 bg-slate-100 text-slate-600',
  }
}

export default function InventoryClient({
  orgId,
  activeBranchId,
  activeBranchName,
  initialProducts,
  warehouseSnapshot,
  recentMutations,
  warehouses = [],
}: InventoryClientProps) {
  const [products, setProducts] = useState<ProductWithStock[]>(initialProducts)
  const { confirm, ConfirmUI } = useConfirm()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isWriteOffModalOpen, setIsWriteOffModalOpen] = useState(false)
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false)
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)
  const [selectedPrintProduct, setSelectedPrintProduct] = useState<ProductWithStock | null>(null)
  const [printQty, setPrintQty] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<InventoryCategoryFilter>('ALL')
  const [productSort, setProductSort] = useState<InventorySortOption>('updated-desc')
  
  // Real-time stocks per warehouse
  const [whStocks, setWhStocks] = useState<{warehouse_id: string, quantity: number, warehouse_name?: string}[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const hasActiveBranch = Boolean(activeBranchId)
  const hasWarehouses = warehouses.length > 0
  const physicalStockGuardMessage = !hasActiveBranch
    ? 'Pilih unit aktif terlebih dahulu untuk melakukan mutasi stok dan kelola gudang fisik.'
    : !hasWarehouses
      ? `Belum ada gudang aktif di unit ${activeBranchName || 'terpilih'}. Tambahkan gudang terlebih dahulu.`
      : null
  const searchParams = useSearchParams()
  const adjustId = searchParams.get('adjust')

  useEffect(() => {
    if (adjustId && products.length > 0) {
      const product = products.find(p => p.id === adjustId)
      if (product) {
        handleOpenWriteOff(product)
      }
    }
  }, [adjustId, products])

  useEffect(() => {
    setProducts(initialProducts)
  }, [initialProducts])

  useEffect(() => {
    if (!physicalStockGuardMessage) return
    setIsAdjustmentModalOpen(false)
    setIsTransferModalOpen(false)
    setIsWriteOffModalOpen(false)
  }, [physicalStockGuardMessage])

  useEffect(() => {
    const firstWarehouseId = warehouses[0]?.id || ''
    const secondWarehouseId = warehouses[1]?.id || firstWarehouseId

    setExpandedId(null)
    setWhStocks([])
    setAdjForm((current) => ({
      ...current,
      warehouse_id: warehouses.some((warehouse) => warehouse.id === current.warehouse_id)
        ? current.warehouse_id
        : firstWarehouseId,
    }))
    setWriteOffForm((current) => ({
      ...current,
      warehouse_id: warehouses.some((warehouse) => warehouse.id === current.warehouse_id)
        ? current.warehouse_id
        : firstWarehouseId,
    }))
    setTrfForm((current) => ({
      ...current,
      source_wh_id: warehouses.some((warehouse) => warehouse.id === current.source_wh_id)
        ? current.source_wh_id
        : firstWarehouseId,
      target_wh_id: warehouses.some((warehouse) => warehouse.id === current.target_wh_id)
        ? current.target_wh_id
        : secondWarehouseId,
    }))
  }, [warehouses])
  
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false)
  
  const UNIT_OPTIONS = ['Pcs', 'Unit', 'Kg', 'Gram', 'Liter', 'Ml', 'Box', 'Pack', 'Roll', 'Lembar', 'Set', 'Lusin', 'Meter', 'Cm', 'Pasang', 'Rim', 'Karton', 'Botol', 'Galon', 'Ekor', 'Lainnya']
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    type: 'INVENTORY' as 'INVENTORY' | 'NON_INVENTORY' | 'SERVICE',
    unit: 'Pcs',
    custom_unit: '',
    purchase_price: '0',
    selling_price: '0',
    category: 'Bahan' as any
  })

  // Opname / Adjustment Form
  const [adjForm, setAdjForm] = useState({
    adj_date: new Date().toISOString().split('T')[0],
    notes: 'Penyesuaian stok reguler / hasil opname',
    product_id: '',
    warehouse_id: warehouses[0]?.id || '',
    actual_qty: 0,
    current_qty: 0,
    unit_cost: 0
  })

  // Transfer Form
  const [trfForm, setTrfForm] = useState({
    transfer_date: new Date().toISOString().split('T')[0],
    source_wh_id: warehouses[0]?.id || '',
    target_wh_id: warehouses[1]?.id || '',
    notes: 'Pindah barang antar gudang',
    product_id: '',
    quantity: 1
  })

  // Write-off Form State
  const [writeOffForm, setWriteOffForm] = useState({
    adj_date: new Date().toISOString().split('T')[0],
    notes: '',
    product_id: '',
    warehouse_id: warehouses[0]?.id || '',
    quantity: 1,
    unit_cost: 0,
    line_notes: 'Barang rusak/cacat setelah pengecekan return'
  })

  const handleOpenEdit = (product: ProductWithStock) => {
    setEditId(product.id)
    setFormData({
      name: product.name,
      sku: product.sku || '',
      barcode: (product as any).barcode || '',
      type: product.type as any,
      unit: product.unit || 'Pcs',
      custom_unit: UNIT_OPTIONS.includes(product.unit || 'Pcs') ? '' : (product.unit || ''),
      purchase_price: product.purchase_price?.toString() || '0',
      selling_price: product.selling_price?.toString() || '0',
      category: product.category || 'Bahan'
    })
    setIsModalOpen(true)
  }

  const handleOpenNew = () => {
    setEditId(null)
    setFormData({ name: '', sku: '', barcode: '', type: 'INVENTORY', unit: 'Pcs', custom_unit: '', purchase_price: '0', selling_price: '0', category: 'Bahan' })
    setIsModalOpen(true)
  }

  const handleOpenWriteOff = (product?: ProductWithStock) => {
    setWriteOffForm({
      ...writeOffForm,
      product_id: product?.id || '',
      unit_cost: Number((product as any)?.average_cost ?? product?.purchase_price ?? 0),
      quantity: 1
    })
    setIsWriteOffModalOpen(true)
  }

  const handleFetchWhStocks = async (productId: string) => {
    if (!productId) return
    const stocks = await getWarehouseStocks(orgId, productId, activeBranchId)
    setWhStocks(stocks)
    return stocks
  }

  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    const diff = Number(adjForm.actual_qty) - Number(adjForm.current_qty)
    const res = await createInventoryAdjustment(orgId, {
      adj_date: adjForm.adj_date,
      type: 'STOCK_COUNT',
      notes: adjForm.notes || `Stock Opname: ${products.find(p => p.id === adjForm.product_id)?.name}`,
      items: [{
        product_id: adjForm.product_id,
        warehouse_id: adjForm.warehouse_id,
        actual_quantity: adjForm.actual_qty,
        diff_quantity: diff,
        unit_cost: adjForm.unit_cost,
        notes: 'Hasil penghitungan fisik (Stock Opname)'
      }]
    })
    if ('error' in res && res.error) alert(res.error); else { alert('Berhasil melakukan Stok Opname!'); window.location.reload(); }
    setIsSubmitting(false)
  }

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (trfForm.source_wh_id === trfForm.target_wh_id) return alert('Gudang asal dan tujuan tidak boleh sama!')
    setIsSubmitting(true)
    const res = await createInventoryTransfer(orgId, {
      transfer_date: trfForm.transfer_date,
      source_wh_id: trfForm.source_wh_id,
      target_wh_id: trfForm.target_wh_id,
      notes: trfForm.notes,
      items: [{
        product_id: trfForm.product_id,
        quantity: trfForm.quantity,
        notes: 'Mutasi stok antar gudang'
      }]
    })
    if ('error' in res && res.error) alert(res.error); else { alert('Berhasil memindahkan stok!'); window.location.reload(); }
    setIsSubmitting(false)
  }

  const handleWriteOffSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    const res = await createInventoryAdjustment(orgId, {
      adj_date: writeOffForm.adj_date,
      type: 'WRITE_OFF',
      notes: writeOffForm.notes || `Write-off: ${products.find(p => p.id === writeOffForm.product_id)?.name}`,
      items: [{
        product_id: writeOffForm.product_id,
        warehouse_id: writeOffForm.warehouse_id,
        actual_quantity: 0,
        diff_quantity: -Math.abs(writeOffForm.quantity),
        unit_cost: writeOffForm.unit_cost,
        notes: writeOffForm.line_notes
      }]
    })
    if ('error' in res && res.error) alert(res.error); else { alert('Berhasil melakukan Write-off!'); window.location.reload(); }
    setIsSubmitting(false)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!await confirm(`Hapus produk "${name}"?`)) return
    try {
      await deleteProduct(id, orgId)
      setProducts((current) => current.filter((p) => p.id !== id))
    } catch (e: any) {
      alert("Gagal menghapus produk: " + e.message)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Auto-map manufacturing categories to system types
      let mappedType: 'INVENTORY' | 'NON_INVENTORY' | 'SERVICE' = 'INVENTORY'
      if (formData.category === 'Layanan') mappedType = 'SERVICE'
      else if (formData.category === 'Lainnya') mappedType = 'NON_INVENTORY'

      if (editId) {
        const result = (await updateProduct(editId, orgId, {
          name: formData.name,
          sku: formData.sku,
          barcode: formData.barcode,
          type: mappedType,
          unit: formData.unit === 'Lainnya' ? formData.custom_unit : formData.unit,
          purchase_price: parseFloat(formData.purchase_price) || 0,
          selling_price: parseFloat(formData.selling_price) || 0,
          category: formData.category
        })) as any
        
        if (result?.error) {
          alert("Gagal mengupdate produk: " + result.error)
          return
        }
        
        if (result?.data) {
          setProducts((current) => current.map((p) => p.id === editId ? { ...p, ...result.data } : p))
        }
      } else {
        const result = (await createProduct({
          org_id: orgId,
          name: formData.name,
          sku: formData.sku,
          barcode: formData.barcode,
          type: mappedType,
          unit: formData.unit === 'Lainnya' ? formData.custom_unit : formData.unit,
          purchase_price: parseFloat(formData.purchase_price) || 0,
          selling_price: parseFloat(formData.selling_price) || 0,
          category: formData.category
        })) as any

        if (result?.error) {
          alert("Gagal menyimpan produk: " + result.error)
          return
        }

        if (result?.data) {
          setProducts((current) => [{ ...result.data, stock_in: 0, stock_out: 0, stock_available: 0, stock_value: 0 }, ...current])
        }
      }
      setIsModalOpen(false)
    } catch (error: any) {
      alert("Gagal menyimpan produk: " + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const stats = {
    totalSku: products.length,
    totalValue: products.reduce((acc, p) => acc + (p.stock_value || 0), 0),
    lowStock: products.filter(p => p.type === 'INVENTORY' && p.stock_available <= 5).length,
    activeWarehouses: warehouses.length
  }

  const categoryFilterOptions: Array<{
    value: InventoryCategoryFilter
    label: string
    hint: string
    count: number
    assetValue: number
  }> = [
    {
      value: 'ALL',
      label: 'Semua',
      hint: 'Seluruh katalog',
      count: products.length,
      assetValue: products.reduce((sum, product) => sum + (product.stock_value || 0), 0),
    },
    {
      value: 'RAW',
      label: 'Bahan Baku',
      hint: 'Material utama',
      count: products.filter((product) => matchesInventoryCategoryFilter(product, 'RAW')).length,
      assetValue: products
        .filter((product) => matchesInventoryCategoryFilter(product, 'RAW'))
        .reduce((sum, product) => sum + (product.stock_value || 0), 0),
    },
    {
      value: 'WIP',
      label: 'Setengah Jadi',
      hint: 'Produk antar-proses',
      count: products.filter((product) => matchesInventoryCategoryFilter(product, 'WIP')).length,
      assetValue: products
        .filter((product) => matchesInventoryCategoryFilter(product, 'WIP'))
        .reduce((sum, product) => sum + (product.stock_value || 0), 0),
    },
    {
      value: 'FG',
      label: 'Barang Jadi',
      hint: 'Siap jual',
      count: products.filter((product) => matchesInventoryCategoryFilter(product, 'FG')).length,
      assetValue: products
        .filter((product) => matchesInventoryCategoryFilter(product, 'FG'))
        .reduce((sum, product) => sum + (product.stock_value || 0), 0),
    },
    {
      value: 'OTHER',
      label: 'Lainnya',
      hint: 'Pelengkap & jasa',
      count: products.filter((product) => matchesInventoryCategoryFilter(product, 'OTHER')).length,
      assetValue: products
        .filter((product) => matchesInventoryCategoryFilter(product, 'OTHER'))
        .reduce((sum, product) => sum + (product.stock_value || 0), 0),
    },
  ]

  const normalizedSearchTerm = searchTerm.trim().toLowerCase()
  const filteredProducts = sortInventoryProducts(
    products.filter((product) => {
      const categoryMeta = getInventoryCategoryMeta(product.category)
      const matchesCategory = matchesInventoryCategoryFilter(product, activeCategoryFilter)
      if (!matchesCategory) return false

      return matchesInventorySearch([
        product.name,
        product.sku,
        product.category,
        product.unit,
        categoryMeta.label,
      ], normalizedSearchTerm)
    }),
    productSort
  )
  const sortedProductsByName = sortInventoryProducts(products, 'name-asc')

  const filteredWarehouseSnapshot = warehouseSnapshot.filter((row) => {
    const categoryMeta = getInventoryCategoryMeta(row.product_category)
    const matchesCategory = matchesInventoryCategoryValue(row.product_category, activeCategoryFilter)
    if (!matchesCategory) return false

    return matchesInventorySearch([
      row.product_name,
      row.product_sku,
      row.product_category,
      row.product_unit,
      categoryMeta.label,
      row.warehouse_name,
      row.warehouse_code,
    ], normalizedSearchTerm)
  })

  const filteredMutations = recentMutations.filter((row) => {
    const categoryMeta = getInventoryCategoryMeta(row.product_category)
    const referenceTypeMeta = getInventoryMutationTypeMeta(row.reference_type)
    const matchesCategory = matchesInventoryCategoryValue(row.product_category, activeCategoryFilter)
    if (!matchesCategory) return false

    return matchesInventorySearch([
      row.product_name,
      row.product_sku,
      row.product_category,
      row.product_unit,
      categoryMeta.label,
      row.warehouse_name,
      row.warehouse_code,
      row.notes,
      row.reference_type,
      referenceTypeMeta.label,
    ], normalizedSearchTerm)
  })

  const filteredStats = {
    totalSku: filteredProducts.length,
    totalValue: filteredProducts.reduce((acc, product) => acc + (product.stock_value || 0), 0),
    lowStock: filteredProducts.filter((product) => product.type === 'INVENTORY' && product.stock_available <= 5).length,
  }

  const warehouseSnapshotStats = {
    totalRows: filteredWarehouseSnapshot.length,
    totalValue: filteredWarehouseSnapshot.reduce((sum, row) => sum + (row.stock_value || 0), 0),
    uniqueWarehouses: new Set(filteredWarehouseSnapshot.map((row) => row.warehouse_id)).size,
  }

  const mutationStats = {
    totalRows: filteredMutations.length,
    totalIn: filteredMutations
      .filter((row) => row.quantity > 0)
      .reduce((sum, row) => sum + row.quantity, 0),
    totalOut: filteredMutations
      .filter((row) => row.quantity < 0)
      .reduce((sum, row) => sum + Math.abs(row.quantity), 0),
  }

  const activeFilterLabel = categoryFilterOptions.find((option) => option.value === activeCategoryFilter)?.label || 'Semua'
  const activeSortLabel = inventorySortOptions.find((option) => option.value === productSort)?.label || 'Update Terakhir'

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto space-y-12 pb-24">
      <PageHeader
        icon={<Package />}
        title="Inventory & Stock"
        subtitle="Manage product assets, COG (HPP) values, and stock adjustments."
        tag="Assets Module"
        actions={
          <div className="flex flex-wrap gap-3">
            <SafeButton 
              variant="white"
              icon={<ArrowLeftRight size={16} />}
              disabled={Boolean(physicalStockGuardMessage)}
              title={physicalStockGuardMessage || undefined}
              onClick={() => setIsTransferModalOpen(true)}
            >
              Transfer Stok
            </SafeButton>
            <SafeButton 
              variant="white"
              icon={<CheckCircle2 size={16} />}
              disabled={Boolean(physicalStockGuardMessage)}
              title={physicalStockGuardMessage || undefined}
              onClick={() => setIsAdjustmentModalOpen(true)}
            >
              Stok Opname
            </SafeButton>
            <SafeButton 
              variant="primary"
              icon={<Plus size={18} />}
              onClick={handleOpenNew}
            >
              Produk Baru
            </SafeButton>
          </div>
        }
      />

      {physicalStockGuardMessage && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-800 shadow-sm">
          {physicalStockGuardMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="Total Database SKU" 
          value={`${stats.totalSku} Item`} 
          icon={Box}
          color="indigo"
          sub="Produk terdaftar di sistem"
        />
        <StatCard 
          label="Nilai Aset Stok" 
          value={formatRupiah(stats.totalValue)} 
          icon={Wallet}
          color="emerald"
          sub="Total modal barang (HPP)"
        />
        <StatCard 
          label="Stok Menipis" 
          value={`${stats.lowStock} SKU`} 
          icon={AlertTriangle}
          color="rose"
          alert={stats.lowStock > 0}
          sub="Barang dengan stok mulai habis"
        />
        <StatCard 
          label="Lokasi Gudang" 
          value={`${stats.activeWarehouses} Gudang`} 
          icon={HistoryIcon}
          color="blue"
          sub="Warehouse aktif terdaftar, klik untuk kelola"
          href="/inventory/warehouses"
        />
      </div>

      <SectionCard>
        <SectionHeader 
          title="Daftar Inventori"
          subtitle={`Manajemen persediaan barang dan nilai aset real-time. Scope aktif: ${activeFilterLabel.toLowerCase()}${normalizedSearchTerm ? `, pencarian "${searchTerm.trim()}"` : ''}. Urutan saat ini: ${activeSortLabel.toLowerCase()}.`}
          actions={
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cari nama produk, SKU, kategori..."
                  className="w-64 rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-[10px] font-bold outline-none transition-all focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <ListChecks size={14} className="text-slate-400" />
                <select
                  value={productSort}
                  onChange={(e) => setProductSort(e.target.value as InventorySortOption)}
                  className="bg-transparent text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600 outline-none"
                  aria-label="Urutkan data inventori"
                >
                  {inventorySortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          }
        />

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {categoryFilterOptions.map((option) => {
            const isActive = activeCategoryFilter === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setActiveCategoryFilter(option.value)}
                className={`h-full rounded-xl border px-5 py-4 text-left transition-all ${
                  isActive
                    ? 'border-blue-200 bg-blue-50 shadow-md shadow-blue-100 ring-1 ring-blue-100'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex h-full flex-col justify-between gap-4">
                  <div>
                    <div className={`text-[10px] font-semibold uppercase tracking-wide ${isActive ? 'text-blue-700' : 'text-slate-400'}`}>
                      {option.label}
                    </div>
                    <div className={`mt-3 text-[15px] font-semibold leading-none ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>
                      {option.count} item
                    </div>
                    <div className="mt-2 text-[10px] font-bold text-slate-400">
                      {option.hint}
                    </div>
                  </div>
                  <div className={`rounded-xl border px-3.5 py-3 ${isActive ? 'border-blue-200 bg-white/80' : 'border-slate-100 bg-slate-50'}`}>
                    <div className={`text-[9px] font-semibold uppercase tracking-wide ${isActive ? 'text-blue-500' : 'text-slate-400'}`}>
                      Nilai Aset
                    </div>
                    <div className={`mt-1 text-[13px] font-semibold leading-tight ${isActive ? 'text-blue-900' : 'text-slate-700'}`}>
                      {formatRupiah(option.assetValue)}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-5 py-4">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Produk Tampil</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{filteredStats.totalSku}</div>
            <div className="text-[11px] font-bold text-slate-500">Daftar yang sedang Anda telusuri</div>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-5 py-4">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Nilai Stok Tampil</div>
            <div className="mt-2 text-2xl font-semibold text-emerald-700">{formatRupiah(filteredStats.totalValue)}</div>
            <div className="text-[11px] font-bold text-emerald-700/70">Nilai aset pada hasil filter saat ini</div>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-5 py-4">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">Stok Tipis Tampil</div>
            <div className="mt-2 text-2xl font-semibold text-amber-700">{filteredStats.lowStock}</div>
            <div className="text-[11px] font-bold text-amber-700/70">Memudahkan penelusuran per kategori</div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Produk & SKU</th>
                <th className="px-6 py-5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide text-right">Modal / Jual</th>
                <th className="px-6 py-5 text-[10px] font-semibold text-blue-600 uppercase tracking-wide text-center bg-blue-50/20">Stok Akhir</th>
                <th className="px-6 py-5 text-[10px] font-semibold text-blue-600 uppercase tracking-wide text-right bg-blue-50/20">Aset (Rp)</th>
                <th className="px-8 py-5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredProducts.length === 0 ? (
                <tr><td colSpan={5} className="py-24 text-center text-slate-400 font-bold text-xs uppercase italic">{products.length === 0 ? 'Belum ada data inventori.' : 'Tidak ada produk yang cocok dengan filter saat ini.'}</td></tr>
              ) : (
                filteredProducts.map((product) => {
                  const categoryMeta = getInventoryCategoryMeta(product.category)
                  return (
                  <tr key={product.id} className="group hover:bg-slate-50 transition-colors">
                    <td className="px-8 py-6">
                       <div className="text-sm font-semibold text-slate-900 tracking-tight">{product.name}</div>
                       <div className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-2">
                         <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{product.sku || 'TANPA SKU'}</span>
                         <span>•</span>
                         <span className="uppercase tracking-wide">{product.type}</span>
                       </div>
                       <div className="mt-2 flex items-center gap-2">
                         <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${categoryMeta.badgeClass}`}>
                           {categoryMeta.label}
                         </span>
                         <span className="text-[10px] font-bold text-slate-400">{categoryMeta.description}</span>
                       </div>
                    </td>
                    <td className="px-6 py-6 text-right">
                       <div className="text-xs font-bold text-slate-500 font-mono italic">{formatRupiah(product.purchase_price || 0)}</div>
                       <div className="text-sm font-semibold text-slate-900 font-mono mt-0.5">{formatRupiah(product.selling_price || 0)}</div>
                    </td>
                     <td 
                       className="px-6 py-6 text-center bg-blue-50/5 cursor-pointer hover:bg-blue-100/50 transition-all border-x border-slate-50 relative group/stock"
                       onClick={async () => {
                         if (expandedId === product.id) {
                           setExpandedId(null)
                         } else {
                           setExpandedId(product.id)
                           handleFetchWhStocks(product.id)
                         }
                       }}
                       title="Klik untuk lihat rincian gudang"
                     >
                       <div className={`text-sm font-semibold ${product.stock_available <= 5 ? 'text-rose-600 animate-pulse' : 'text-blue-600'}`}>
                         {product.stock_available}
                       </div>
                       <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-tighter mt-0.5 flex items-center justify-center gap-1">
                          {product.unit} <ChevronDown size={10} className={`transition-transform ${expandedId === product.id ? 'rotate-180 text-blue-600' : ''}`} />
                       </div>

                       <AnimatePresence>
                         {expandedId === product.id && (
                            <motion.div 
                              initial={{ opacity: 0, y: 5 }} 
                              animate={{ opacity: 1, y: 0 }} 
                              exit={{ opacity: 0, y: 5 }}
                              className="absolute top-full left-1/2 -translate-x-1/2 z-30 w-48 mt-2 bg-white rounded-xl shadow-md border border-slate-100 p-4 text-left shadow-blue-900/10 pointer-events-none"
                            >
                               <div className="text-[8px] font-semibold text-slate-400 uppercase tracking-wide mb-3 pb-2 border-b border-slate-50">Lokasi Barang</div>
                               <div className="space-y-3">
                                  {whStocks.length === 0 ? (
                                    <div className="text-[10px] text-slate-400 italic font-bold">Memuat data...</div>
                                  ) : whStocks.filter(s => s.quantity !== 0).length === 0 ? (
                                    <div className="text-[10px] text-rose-500 font-bold italic">Barang Kosong</div>
                                  ) : (
                                    whStocks.filter(s => s.quantity !== 0).map(s => (
                                      <div key={s.warehouse_id} className="flex justify-between items-center gap-2">
                                         <div className="text-[10px] font-semibold text-slate-600 uppercase truncate">
                                           {s.warehouse_name || 'Gudang'}
                                         </div>
                                         <div className={`text-[11px] font-semibold font-mono ${s.quantity < 0 ? 'text-rose-600' : 'text-blue-600'}`}>
                                           {s.quantity}
                                         </div>
                                      </div>
                                    ))
                                  )}
                               </div>
                               <div className="mt-3 pt-2 border-t border-slate-50 flex items-center justify-between text-[8px] font-semibold text-slate-300">
                                  <span>ID: {product.sku || 'SKU'}</span>
                                  <span>•</span>
                                  <span>REAL-TIME</span>
                               </div>
                            </motion.div>
                         )}
                       </AnimatePresence>
                     </td>
                    <td className="px-6 py-6 text-right font-semibold text-slate-800 font-mono bg-blue-50/5">
                       {formatRupiah(product.stock_value)}
                    </td>
                    <td className="px-8 py-6">
                       <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => {
                              setSelectedPrintProduct(product)
                              setIsPrintModalOpen(true)
                            }} 
                            className="p-2.5 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-900 hover:text-white transition-all border border-slate-100" 
                            title="Cetak Label"
                          >
                             <Printer size={16} />
                          </button>
                          <Link 
                            href={`/inventory/ledger/${product.id}`}
                            className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-500 hover:text-white transition-all shadow-sm border border-blue-100"
                            title="Kartu Stok (Ledger)"
                          >
                             <HistoryIcon size={16} />
                          </Link>
                         <button 
                           onClick={() => handleOpenWriteOff(product)} 
                           disabled={Boolean(physicalStockGuardMessage)}
                           className="p-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-500 hover:text-white transition-all border border-rose-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-rose-50 disabled:hover:text-rose-600" 
                           title={physicalStockGuardMessage || 'Write-off (Barang Rusak/Ilang)'}
                         >
                            <Trash2 size={16} />
                         </button>
                         <button onClick={() => handleOpenEdit(product)} className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-500 hover:text-white transition-all border border-blue-100" title="Edit Produk">
                            <Edit size={16} />
                         </button>
                         <button onClick={() => handleDelete(product.id, product.name)} className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-rose-500 hover:text-white transition-all border border-slate-100" title="Hapus">
                            <X size={16} />
                         </button>
                       </div>
                    </td>
                  </tr>
                )})
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeader
          title="Peta Stok per Gudang"
          subtitle={`Posisi stok saat ini per gudang untuk scope ${activeFilterLabel.toLowerCase()}${normalizedSearchTerm ? `, pencarian "${searchTerm.trim()}"` : ''}.`}
          actions={
            <div className="flex items-center gap-3 text-right">
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Baris Aktif</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{warehouseSnapshotStats.totalRows}</div>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                <div className="text-[9px] font-semibold uppercase tracking-wide text-emerald-600">Nilai Aset</div>
                <div className="mt-1 text-sm font-semibold text-emerald-700">{formatRupiah(warehouseSnapshotStats.totalValue)}</div>
              </div>
            </div>
          }
        />

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-5 py-4">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Gudang Aktif</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{warehouseSnapshotStats.uniqueWarehouses}</div>
            <div className="text-[11px] font-bold text-slate-500">Lokasi dengan stok tersedia</div>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">Baris Snapshot</div>
            <div className="mt-2 text-2xl font-semibold text-blue-700">{warehouseSnapshotStats.totalRows}</div>
            <div className="text-[11px] font-bold text-blue-700/70">Kombinasi produk dan gudang</div>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-5 py-4">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Total Nilai Tampil</div>
            <div className="mt-2 text-2xl font-semibold text-emerald-700">{formatRupiah(warehouseSnapshotStats.totalValue)}</div>
            <div className="text-[11px] font-bold text-emerald-700/70">Berdasarkan HPP rata-rata produk</div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/60 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Gudang</th>
                <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Produk</th>
                <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wide text-right text-blue-600">Qty</th>
                <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wide text-right text-slate-400">HPP</th>
                <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wide text-right text-emerald-600">Nilai Aset</th>
                <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wide text-right text-slate-400">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredWarehouseSnapshot.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-slate-400 font-bold text-xs uppercase italic">
                    Belum ada stok per gudang yang cocok dengan filter saat ini.
                  </td>
                </tr>
              ) : (
                filteredWarehouseSnapshot.map((row) => {
                  const categoryMeta = getInventoryCategoryMeta(row.product_category)
                  return (
                    <tr key={`${row.product_id}:${row.warehouse_id}`} className="group hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-5">
                        <div className="text-sm font-semibold text-slate-900">{row.warehouse_name}</div>
                        <div className="mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                          {row.warehouse_code || 'Tanpa Kode'}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-sm font-semibold text-slate-900">{row.product_name}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-400">
                          <span className="font-mono rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5">
                            {row.product_sku || 'TANPA SKU'}
                          </span>
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${categoryMeta.badgeClass}`}>
                            {categoryMeta.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className={`text-sm font-semibold font-mono ${row.quantity < 0 ? 'text-rose-600' : 'text-blue-600'}`}>
                          {formatInventoryQuantity(row.quantity)}
                        </div>
                        <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          {row.product_unit || 'Unit'}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right text-sm font-semibold text-slate-700 font-mono">
                        {formatRupiah(row.unit_cost)}
                      </td>
                      <td className="px-6 py-5 text-right text-sm font-semibold text-emerald-700 font-mono">
                        {formatRupiah(row.stock_value)}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center justify-end">
                          <Link
                            href={`/inventory/ledger/${row.product_id}`}
                            className="inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-blue-700 transition-all hover:bg-blue-500 hover:text-white"
                          >
                            <HistoryIcon size={14} />
                            Ledger
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeader
          title="Mutasi Inventori Terkini"
          subtitle={`Ringkasan arus stok terbaru agar kita bisa telusuri barang masuk dan keluar per referensi transaksi${normalizedSearchTerm ? `, pencarian "${searchTerm.trim()}"` : ''}.`}
          actions={
            <div className="flex items-center gap-3 text-right">
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Baris Mutasi</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{mutationStats.totalRows}</div>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                <div className="text-[9px] font-semibold uppercase tracking-wide text-emerald-600">Masuk</div>
                <div className="mt-1 text-sm font-semibold text-emerald-700">{formatInventoryQuantity(mutationStats.totalIn)}</div>
              </div>
              <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3">
                <div className="text-[9px] font-semibold uppercase tracking-wide text-rose-600">Keluar</div>
                <div className="mt-1 text-sm font-semibold text-rose-700">{formatInventoryQuantity(-mutationStats.totalOut)}</div>
              </div>
            </div>
          }
        />

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/60 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Tanggal</th>
                <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Produk</th>
                <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Gudang</th>
                <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wide text-center text-slate-400">Jenis</th>
                <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wide text-right text-blue-600">Qty</th>
                <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wide text-right text-slate-400">HPP</th>
                <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wide text-right text-slate-400">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredMutations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center text-slate-400 font-bold text-xs uppercase italic">
                    Belum ada mutasi inventori yang cocok dengan filter saat ini.
                  </td>
                </tr>
              ) : (
                filteredMutations.map((row) => {
                  const categoryMeta = getInventoryCategoryMeta(row.product_category)
                  const directionMeta = getInventoryMovementDirectionMeta(row.quantity)
                  const referenceTypeMeta = getInventoryMutationTypeMeta(row.reference_type)

                  return (
                    <tr key={row.id} className="group hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-5">
                        <div className="text-sm font-semibold text-slate-900">{formatDate(row.movement_date, 'short')}</div>
                        <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Ref {row.reference_id.slice(0, 8) || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-sm font-semibold text-slate-900">{row.product_name}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-400">
                          <span className="font-mono rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5">
                            {row.product_sku || 'TANPA SKU'}
                          </span>
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${categoryMeta.badgeClass}`}>
                            {categoryMeta.label}
                          </span>
                        </div>
                        {row.notes && (
                          <div className="mt-2 line-clamp-2 text-[11px] font-bold text-slate-500">
                            {row.notes}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-sm font-semibold text-slate-900">
                          {row.warehouse_name || 'Belum dipetakan'}
                        </div>
                        <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          {row.warehouse_code || (row.warehouse_id ? 'Gudang aktif' : 'Perlu telusur referensi')}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col items-center gap-2">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${referenceTypeMeta.badgeClass}`}>
                            {referenceTypeMeta.label}
                          </span>
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${directionMeta.badgeClass}`}>
                            {directionMeta.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className={`text-sm font-semibold font-mono ${row.quantity < 0 ? 'text-rose-600' : row.quantity > 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                          {formatInventoryQuantity(row.quantity)}
                        </div>
                        <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          {row.product_unit || 'Unit'}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right text-sm font-semibold text-slate-700 font-mono">
                        {formatRupiah(row.unit_price)}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center justify-end">
                          <Link
                            href={`/inventory/ledger/${row.product_id}`}
                            className="inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-blue-700 transition-all hover:bg-blue-500 hover:text-white"
                          >
                            <HistoryIcon size={14} />
                            Ledger
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <AnimatePresence>
        {/* Modal Stok Opname */}
        {isAdjustmentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAdjustmentModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
             <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-white rounded-xl shadow-md overflow-hidden border-t-8 border-emerald-600">
                <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center">
                    <div>
                      <h3 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                        <CheckCircle2 className="text-emerald-600" size={24} /> Stok Opname
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 font-medium">Betulkan saldo stok dengan pencatatan fisik.</p>
                    </div>
                </div>

                <form onSubmit={handleAdjustmentSubmit} className="p-5 space-y-6">
                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Tanggal</label>
                          <input type="date" required value={adjForm.adj_date} onChange={e => setAdjForm({...adjForm, adj_date: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 rounded-xl border border-slate-100 font-bold" />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Gudang</label>
                          <select required value={adjForm.warehouse_id} onChange={e => setAdjForm({...adjForm, warehouse_id: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 rounded-xl border border-slate-100 font-bold focus:ring-2 focus:ring-emerald-100 transition-all outline-none">
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                          </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-end">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Cari Produk</label>
                        <button 
                          type="button" 
                          onClick={() => setIsBarcodeScannerOpen(true)}
                          className="flex items-center gap-1.5 text-[10px] font-semibold text-blue-600 uppercase bg-blue-50 px-3 py-1 rounded-full mb-1"
                        >
                          <Box size={10} /> Scan Barcode
                        </button>
                      </div>
                      <select required value={adjForm.product_id} 
                        onChange={async (e) => {
                          const id = e.target.value
                          const p = products.find((x) => x.id === id)
                          const stocks = await handleFetchWhStocks(id)
                          const curQty = stocks?.find((s) => s.warehouse_id === adjForm.warehouse_id)?.quantity || 0
                          setAdjForm({
                            ...adjForm,
                            product_id: id,
                            current_qty: curQty,
                            unit_cost: Number(p?.average_cost ?? p?.purchase_price ?? 0),
                          })
                        }} 
                        className="w-full px-5 py-4 bg-slate-50 rounded-xl border border-slate-100 font-bold outline-none focus:ring-2 focus:ring-emerald-100 appearance-none"
                      >
                          <option value="">-- Manual Select --</option>
                          {sortedProductsByName.map((p) => <option key={p.id} value={p.id}>{p.name} (Stok: {p.stock_available})</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-5 p-6 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide italic flex items-center gap-1">
                            <Info size={10} /> Stok di Gudang Terpilih
                          </label>
                          <div className={`text-xl font-semibold ${adjForm.current_qty < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                            {adjForm.current_qty}
                          </div>
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">Stok Fisik (Opname)</label>
                          <input type="number" required value={adjForm.actual_qty} onChange={e => setAdjForm({...adjForm, actual_qty: Number(e.target.value)})} className="w-full px-4 py-2 bg-white rounded-xl border border-emerald-200 font-semibold text-emerald-600 shadow-sm outline-none focus:ring-2 focus:ring-emerald-100 transition-all" />
                      </div>
                    </div>

                    <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center gap-3">
                       <TrendingUp className="text-emerald-500" size={16} />
                       <div className="text-[10px] font-bold text-emerald-700">
                         Selisih: <span className="font-semibold underline">{Number(adjForm.actual_qty) - Number(adjForm.current_qty)} Unit</span>. Sistem akan menyesuaikan secara otomatis.
                       </div>
                    </div>

                    <SafeButton type="submit" isLoading={isSubmitting} variant="primary" className="w-full py-4 text-white font-semibold rounded-xl !bg-emerald-600 hover:!bg-emerald-700 shadow-xl shadow-emerald-100">
                      Konfirmasi Update Stok
                    </SafeButton>
                </form>
             </motion.div>
          </div>
        )}

        {/* Modal Transfer Stok */}
        {isTransferModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsTransferModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
             <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-white rounded-xl shadow-md overflow-hidden border-t-8 border-indigo-600">
                <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center">
                    <div>
                      <h3 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                        <ArrowLeftRight className="text-indigo-600" size={24} /> Transfer Stok
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 font-medium">Mutasi barang antar lokasi gudang.</p>
                    </div>
                </div>

                <form onSubmit={handleTransferSubmit} className="p-5 space-y-6">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Pilih Produk</label>
                      <select required value={trfForm.product_id} onChange={async (e) => {
                        const id = e.target.value
                        handleFetchWhStocks(id)
                        setTrfForm({...trfForm, product_id: id})
                      }} className="w-full px-5 py-4 bg-slate-50 rounded-xl border border-slate-100 font-bold outline-none">
                          <option value="">-- Pilih Barang --</option>
                          {sortedProductsByName.map(p => <option key={p.id} value={p.id}>{p.name} (Total Stok: {p.stock_available})</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-5 p-6 rounded-xl bg-indigo-50 border border-indigo-100 items-center">
                      <div className="space-y-1 text-center">
                          <label className="text-[9px] font-semibold text-indigo-400 uppercase tracking-wide">Gudang Asal</label>
                          <select required value={trfForm.source_wh_id} onChange={e => setTrfForm({...trfForm, source_wh_id: e.target.value})} className="w-full mt-2 bg-transparent text-[11px] font-semibold focus:outline-none">
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                          </select>
                          <div className="text-[9px] font-semibold text-indigo-600 mt-2">
                             Stok Saat Ini: {whStocks.find(s => s.warehouse_id === trfForm.source_wh_id)?.quantity || 0}
                          </div>
                      </div>
                      <div className="flex justify-center text-indigo-300">
                         <ArrowRight size={24} />
                      </div>
                      <div className="space-y-1 text-center">
                          <label className="text-[9px] font-semibold text-indigo-400 uppercase tracking-wide">Gudang Tujuan</label>
                          <select required value={trfForm.target_wh_id} onChange={e => setTrfForm({...trfForm, target_wh_id: e.target.value})} className="w-full mt-2 bg-transparent text-[11px] font-semibold focus:outline-none">
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                          </select>
                          <div className="text-[9px] font-semibold text-slate-400 mt-2 italic">
                             Akan menjadi: {(whStocks.find(s => s.warehouse_id === trfForm.target_wh_id)?.quantity || 0) + trfForm.quantity}
                          </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Jumlah yang Dipindahkan (Qty)</label>
                        {trfForm.quantity > (whStocks.find(s => s.warehouse_id === trfForm.source_wh_id)?.quantity || 0) && (
                          <span className="text-[10px] font-semibold text-rose-600 flex items-center gap-1 animate-pulse">
                            <AlertTriangle size={12} /> Stok Tidak Cukup!
                          </span>
                        )}
                      </div>
                      <input type="number" required min="1" value={trfForm.quantity} onChange={e => setTrfForm({...trfForm, quantity: Number(e.target.value)})} className={`w-full px-5 py-3.5 bg-slate-50 rounded-xl border transition-all font-semibold ${trfForm.quantity > (whStocks.find(s => s.warehouse_id === trfForm.source_wh_id)?.quantity || 0) ? 'border-rose-300 focus:border-rose-500' : 'border-slate-100 focus:border-indigo-500'}`} />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Catatan</label>
                      <textarea value={trfForm.notes} onChange={e => setTrfForm({...trfForm, notes: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 rounded-xl border border-slate-100 text-sm outline-none h-20 resize-none transition-all" />
                    </div>

                    <SafeButton type="submit" isLoading={isSubmitting} variant="primary" className="w-full py-4 text-white font-semibold rounded-xl !bg-indigo-600 hover:!bg-indigo-700 shadow-xl shadow-indigo-100">
                      Eksekusi Perpindahan Stok
                    </SafeButton>
                </form>
             </motion.div>
          </div>
        )}

        {/* Modal Write-off */}
        {isWriteOffModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsWriteOffModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
             <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-white rounded-xl shadow-md overflow-hidden shadow-rose-900/20">
                <div className="px-10 py-8 bg-rose-600 text-white flex justify-between items-start">
                    <div>
                      <h3 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                        <Trash2 size={24} /> Stock Write-off
                      </h3>
                      <p className="text-xs text-rose-100 mt-1 font-medium italic">Hapus stok yang rusak dan akui sebagai Beban Kerugian.</p>
                    </div>
                    <button onClick={() => setIsWriteOffModalOpen(false)} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition">
                      <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleWriteOffSubmit} className="p-5 space-y-6">
                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Tanggal</label>
                          <input type="date" required value={writeOffForm.adj_date} onChange={e => setWriteOffForm({...writeOffForm, adj_date: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 rounded-xl border border-slate-100 font-bold outline-none focus:border-rose-500 transition-all shadow-inner" />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Pilih Gudang</label>
                          <select required value={writeOffForm.warehouse_id} onChange={e => setWriteOffForm({...writeOffForm, warehouse_id: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 rounded-xl border border-slate-100 font-bold outline-none focus:border-rose-500 appearance-none transition-all shadow-inner">
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                          </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Produk yang Di-writeoff</label>
                      <select required value={writeOffForm.product_id} onChange={e => handleOpenWriteOff(products.find(p => p.id === e.target.value))} className="w-full px-5 py-4 bg-slate-50 rounded-xl border border-slate-100 font-bold outline-none focus:border-rose-500 transition-all shadow-inner">
                          <option value="">-- Pilih Barang --</option>
                          {products.filter(p => p.type === 'INVENTORY').map(p => <option key={p.id} value={p.id}>{p.name} (Stok: {p.stock_available})</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Jumlah (Qty)</label>
                          <input type="number" required min="1" value={writeOffForm.quantity} onChange={e => setWriteOffForm({...writeOffForm, quantity: Number(e.target.value)})} className="w-full px-5 py-3.5 bg-slate-50 rounded-xl border border-slate-100 font-semibold outline-none focus:border-rose-500 transition-all shadow-inner" />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">HPP per Unit (Rp)</label>
                          <input type="number" required value={writeOffForm.unit_cost} onChange={e => setWriteOffForm({...writeOffForm, unit_cost: Number(e.target.value)})} className="w-full px-5 py-3.5 bg-slate-50 rounded-xl border border-slate-100 font-semibold outline-none focus:border-rose-500 transition-all shadow-inner font-mono" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Alasan Kerugian</label>
                      <textarea required value={writeOffForm.line_notes} onChange={e => setWriteOffForm({...writeOffForm, line_notes: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 rounded-xl border border-slate-100 text-sm outline-none focus:border-rose-500 h-24 resize-none transition-all shadow-inner" />
                    </div>

                    <div className="p-6 rounded-xl bg-rose-50 border border-rose-100 flex items-start gap-4">
                      <AlertTriangle className="text-rose-500 shrink-0" size={20} />
                      <p className="text-[10px] text-rose-700 font-bold leading-relaxed">
                        Sistem akan mengurangi stok sejumlah <span className="underline">{writeOffForm.quantity} unit</span> dan mendebit akun <span className="underline">6011 - Kerugian Persediaan</span> senilai <span className="font-semibold">{formatRupiah(writeOffForm.quantity * writeOffForm.unit_cost)}</span> secara otomatis.
                      </p>
                    </div>

                    <SafeButton type="submit" isLoading={isSubmitting} variant="danger" className="w-full py-4 text-white font-semibold rounded-xl shadow-xl shadow-rose-200 hover:bg-rose-700 transition">
                      Konfirmasi Write-off
                    </SafeButton>
                </form>
             </motion.div>
          </div>
        )}

        {/* Modal Produk (Tambah/Edit) */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-white rounded-xl shadow-md overflow-hidden p-5 border-t-8 border-blue-600">
                <h3 className="text-2xl font-semibold mb-8 tracking-tight text-slate-900">{editId ? 'Update Detail Produk' : 'Registrasi Produk Baru'}</h3>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Nama Produk</label>
                      <input required placeholder="Contoh: Laptop Asus ExpertBook" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-xl border border-slate-100 font-bold text-slate-900 outline-none focus:border-blue-500 shadow-inner" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">SKU / Kode</label>
                        <input placeholder="SKU-XXX" value={formData.sku} onChange={(e) => setFormData({...formData, sku: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-xl border border-slate-100 font-mono font-bold text-slate-900 outline-none focus:border-blue-500 shadow-inner" />
                      </div>
                      <div className="space-y-1 text-left relative">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Barcode</label>
                        <input placeholder="Scan or Type" value={formData.barcode} onChange={(e) => setFormData({...formData, barcode: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-xl border border-slate-100 font-mono font-bold text-blue-600 outline-none focus:border-blue-500 shadow-inner" />
                        <button type="button" onClick={() => setIsBarcodeScannerOpen(true)} className="absolute right-4 bottom-4 text-slate-400 hover:text-blue-600">
                          <Box size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Satuan Produk</label>
                        <select required value={formData.unit} onChange={(e) => setFormData({...formData, unit: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-xl border border-slate-100 font-bold text-slate-900 outline-none focus:border-blue-500 shadow-inner">
                           {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                        {formData.unit === 'Lainnya' && (
                          <input placeholder="Ketik satuan..." required value={formData.custom_unit} onChange={(e) => setFormData({...formData, custom_unit: e.target.value})} className="w-full mt-2 px-6 py-4 bg-amber-50 rounded-xl border border-amber-200 font-bold text-amber-700 outline-none focus:border-amber-500 shadow-inner" />
                        )}
                      </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Kategori Produk</label>
                      <select required value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value as any})} className="w-full px-6 py-4 bg-slate-50 rounded-xl border border-slate-100 font-bold text-blue-600 outline-none focus:border-blue-500 shadow-inner">
                           <option value="Bahan">Bahan Baku</option>
                           <option value="Setengah Jadi">Barang Setengah Jadi</option>
                           <option value="Pelengkap">Pelengkap / Kemasan</option>
                           <option value="Siap Jual">Barang Jadi (Siap Jual)</option>
                           <option value="Layanan">Jasa / Layanan (Labor)</option>
                           <option value="Lainnya">Lain-lain / Pendukung</option>
                      </select>
                      <div className="px-3 py-1 bg-blue-50/50 rounded-lg text-[8px] font-semibold text-blue-400 uppercase tracking-tighter w-fit mt-1">
                        Sistem Mapping: {
                          formData.category === 'Layanan' ? 'SERVICE' : 
                          formData.category === 'Lainnya' ? 'NON-INVENTORY' : 
                          'INVENTORY (STOCKABLE)'
                        }
                      </div>
                    </div>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">HPP (Modal)</label>
                        <input type="number" placeholder="0" value={formData.purchase_price} onChange={(e) => setFormData({...formData, purchase_price: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-xl border border-slate-100 font-mono font-bold text-slate-900 outline-none focus:border-blue-500 shadow-inner" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Harga Jual</label>
                        <input type="number" placeholder="0" value={formData.selling_price} onChange={(e) => setFormData({...formData, selling_price: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-xl border border-slate-100 font-mono font-bold text-slate-900 outline-none focus:border-blue-500 shadow-inner" />
                      </div>
                    </div>

                    <div className="flex gap-4 pt-6">
                      <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 font-bold text-slate-400 hover:text-slate-600 transition-colors">Batal</button>
                      <SafeButton type="submit" isLoading={isSubmitting} variant="primary" className="flex-1 py-4 text-white font-semibold rounded-xl shadow-xl shadow-blue-100">
                        {editId ? 'Update Produk' : 'Simpan Produk'}
                      </SafeButton>
                    </div>
                </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {isBarcodeScannerOpen && (
        <BarcodeScanner 
          onScan={async (code) => {
            if (isModalOpen) {
              setFormData({ ...formData, barcode: code })
            } else if (isAdjustmentModalOpen) {
              const product = (await getProductByBarcode(orgId, code)) as any
              if (product) {
                 const stocks = await handleFetchWhStocks(product.id)
                 const curQty = stocks?.find((s: any) => s.warehouse_id === adjForm.warehouse_id)?.quantity || 0
                 setAdjForm({
                   ...adjForm,
                   product_id: product.id,
                   current_qty: curQty,
                   unit_cost: Number((product as any).average_cost ?? product.purchase_price ?? 0),
                 })
              } else {
                 alert("Produk tidak ditemukan!")
              }
            }
          }}
          onClose={() => setIsBarcodeScannerOpen(false)}
        />
      )}

      {/* Modal Cetak Label */}
      {isPrintModalOpen && selectedPrintProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsPrintModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
           <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm bg-white rounded-[32px] shadow-md overflow-hidden p-8 flex flex-col">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-lg font-semibold text-slate-900 uppercase tracking-tight">Cetak Label</h3>
                 <button onClick={() => setIsPrintModalOpen(false)} className="text-slate-400 hover:text-slate-900"><X size={20} /></button>
              </div>

              <div className="space-y-4 mb-8">
                 <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Produk</p>
                    <p className="text-sm font-bold text-slate-900">{selectedPrintProduct.name}</p>
                 </div>
                 
                 <div className="space-y-2">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase ml-1">Jumlah Label</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="100"
                      value={printQty} 
                      onChange={e => setPrintQty(Number(e.target.value))} 
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-xl font-semibold text-blue-600 outline-none focus:border-blue-500"
                    />
                 </div>
              </div>

              <button 
                onClick={() => window.print()} 
                className="w-full py-4 bg-blue-600 text-white font-semibold rounded-xl shadow-xl shadow-blue-100 flex items-center justify-center gap-2 hover:bg-blue-700 transition-all"
              >
                <Printer size={20} /> Mulai Cetak
              </button>
              
              <div className="mt-4 overflow-hidden h-0 opacity-0 bg-white">
                 <BarcodeLabel 
                    name={selectedPrintProduct.name}
                    sku={selectedPrintProduct.sku || ''}
                    barcode={(selectedPrintProduct as any).barcode || selectedPrintProduct.sku || ''}
                    price={selectedPrintProduct.selling_price}
                    quantity={printQty}
                 />
              </div>
           </motion.div>
        </div>
      )}
    </motion.div>
  {ConfirmUI}
  )
}
