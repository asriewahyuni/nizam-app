'use client'

import { useState, useTransition } from 'react'
import { Plus, Edit2, Trash2, X, Check, Search, BookOpen } from 'lucide-react'
import type { EcommerceDashboardData } from '@/modules/ecommerce/lib/ecommerce'
import { SafeButton, SectionCard, SectionHeader, StatusBadge } from '@/components/ui/NizamUI'
import { formatRupiah } from '@/lib/utils'
import { saveLmsSimpleProductAction, deleteLmsSimpleProductAction } from '@/modules/edu/actions/lms-sales.actions'

export default function LmsSimpleSalesManager({
  dashboardData,
}: {
  dashboardData: EcommerceDashboardData
}) {
  const [isPending, startTransition] = useTransition()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Default to the first store, or empty if none.
  const defaultStoreId = dashboardData.stores[0]?.id || ''

  // Form State
  const [formName, setFormName] = useState('')
  const [formPrice, setFormPrice] = useState(0)
  const [formIsPublished, setFormIsPublished] = useState(true)
  const [formCourseIds, setFormCourseIds] = useState<string[]>([])
  const [formProductId, setFormProductId] = useState<string | null>(null)
  
  // Flash state
  const [flash, setFlash] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  function openCreateModal() {
    setEditingId(null)
    setFormProductId(null)
    setFormName('')
    setFormPrice(0)
    setFormIsPublished(true)
    setFormCourseIds([])
    setIsModalOpen(true)
    setFlash(null)
  }

  function openEditModal(sp: any) {
    setEditingId(sp.id)
    setFormProductId(sp.productId)
    setFormName(sp.publicName)
    setFormPrice(sp.priceOverride || 0)
    setFormIsPublished(sp.isPublished)
    
    const entitlements = dashboardData.productEntitlements.find(e => e.storeProductId === sp.id)
    setFormCourseIds(entitlements?.resolvedCourseIds || [])
    
    setIsModalOpen(true)
    setFlash(null)
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    
    const fd = new FormData()
    fd.set('store_id', defaultStoreId)
    fd.set('name', formName)
    fd.set('price', formPrice.toString())
    fd.set('is_published', formIsPublished ? 'true' : 'false')
    fd.set('course_ids', JSON.stringify(formCourseIds))
    
    if (formProductId) {
      fd.set('product_id', formProductId)
    }

    startTransition(async () => {
      const res = await saveLmsSimpleProductAction(fd)
      if (res?.error) {
        setFlash({ tone: 'error', text: res.error })
      } else {
        setIsModalOpen(false)
      }
    })
  }

  function handleDelete(storeProductId: string) {
    if (!window.confirm('Yakin ingin menurunkan tayangan produk ini?')) return

    const fd = new FormData()
    fd.set('store_product_id', storeProductId)

    startTransition(async () => {
      const res = await deleteLmsSimpleProductAction(fd)
      if (res?.error) {
        alert(res.error)
      }
    })
  }

  return (
    <SectionCard>
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Katalog Penjualan LMS</h2>
          <p className="mt-1 text-sm text-slate-600">Daftar produk kelas yang dijual di Store Anda.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100"
        >
          <Plus size={16} />
          Tambah Produk
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-4 font-semibold sm:px-8">Nama Produk</th>
              <th className="px-5 py-4 font-semibold">Harga</th>
              <th className="px-5 py-4 font-semibold">Manfaat Kelas</th>
              <th className="px-5 py-4 font-semibold">Status</th>
              <th className="px-5 py-4 font-semibold text-right sm:px-8">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {dashboardData.storeProducts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-slate-500 sm:px-8">
                  Belum ada produk yang dijual. Klik Tambah Produk untuk mulai.
                </td>
              </tr>
            ) : (
              dashboardData.storeProducts.map((sp) => {
                const entitlements = dashboardData.productEntitlements.find(e => e.storeProductId === sp.id)
                const courseCount = entitlements?.resolvedCourseIds.length || 0
                return (
                  <tr key={sp.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-5 py-4 font-semibold text-slate-900 sm:px-8">
                      {sp.publicName}
                    </td>
                    <td className="px-5 py-4 text-slate-700">
                      {formatRupiah(sp.priceOverride || 0)}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {courseCount} Kelas
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge
                        label={sp.isPublished ? 'Tayang' : 'Draft'}
                        variant={sp.isPublished ? 'success' : 'warning'}
                      />
                    </td>
                    <td className="px-5 py-4 text-right sm:px-8">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditModal(sp)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(sp.id)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-100"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-bold text-slate-900">
                {editingId ? 'Edit Produk' : 'Tambah Produk Baru'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="flex max-h-[80vh] flex-col">
              <div className="overflow-y-auto px-6 py-6">
                {flash && (
                  <div className={`mb-6 rounded-xl p-4 text-sm font-semibold ${flash.tone === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                    {flash.text}
                  </div>
                )}
                
                <div className="grid gap-6 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">
                    Nama Produk <span className="text-red-500">*</span>
                    <input
                      required
                      type="text"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                      placeholder="Contoh: Paket Belajar Ekis Batch 1"
                    />
                  </label>
                  
                  <label className="block text-sm font-semibold text-slate-700">
                    Harga Jual (Rp)
                    <input
                      required
                      type="number"
                      min="0"
                      value={formPrice}
                      onChange={e => setFormPrice(Number(e.target.value))}
                      className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                    />
                  </label>
                  
                  <label className="block text-sm font-semibold text-slate-700">
                    Status Tayang
                    <select
                      value={formIsPublished ? 'true' : 'false'}
                      onChange={e => setFormIsPublished(e.target.value === 'true')}
                      className="mt-2 min-h-11 w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-4 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                    >
                      <option value="true">Tayang di Store</option>
                      <option value="false">Sembunyikan (Draft)</option>
                    </select>
                  </label>
                </div>

                <div className="mt-8 border-t border-slate-200 pt-6">
                  <div className="mb-4">
                    <h4 className="font-bold text-slate-900">Manfaat Akses Kelas</h4>
                    <p className="mt-1 text-sm text-slate-600">Pilih kelas apa saja yang akan didapatkan pembeli.</p>
                  </div>
                  
                  <div className="max-h-[300px] space-y-3 overflow-y-auto pr-2">
                    {dashboardData.learningCourses.length === 0 && (
                      <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
                        Belum ada course/kelas yang tersedia di LMS ini.
                      </p>
                    )}
                    {dashboardData.learningCourses.map((course) => {
                      const checked = formCourseIds.includes(course.id)
                      return (
                        <label
                          key={course.id}
                          className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                            checked ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormCourseIds([...formCourseIds, course.id])
                              } else {
                                setFormCourseIds(formCourseIds.filter(id => id !== course.id))
                              }
                            }}
                            className="size-4 accent-indigo-700"
                          />
                          <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 shrink-0">
                            <BookOpen size={16} />
                          </div>
                          <span className="min-w-0 flex-1 truncate font-semibold text-slate-900">
                            {course.title}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              </div>
              
              <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="min-h-11 rounded-xl px-4 font-semibold text-slate-700 hover:bg-slate-200"
                >
                  Batal
                </button>
                <SafeButton
                  type="submit"
                  isLoading={isPending}
                  className="min-h-11"
                >
                  Simpan Produk
                </SafeButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </SectionCard>
  )
}
