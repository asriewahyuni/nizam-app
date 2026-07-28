'use client'

/**
 * Tabel produk LMS dengan tindakan salin tautan dan hapus.
 */
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Copy, ExternalLink, PencilLine, Trash2 } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import type {
  AdminProductEntitlementView,
  AdminStoreProductView,
} from '@/modules/ecommerce/lib/ecommerce'
import { deleteLmsSimpleProductAction } from '@/modules/edu/actions/lms-sales.actions'

type ProductListClientProps = {
  products: AdminStoreProductView[]
  entitlements: AdminProductEntitlementView[]
  orgSlug: string
  storeSlug: string
  returnTo: string
  primaryLmsHostname?: string | null
}

export default function ProductListClient({
  products,
  entitlements,
  orgSlug,
  storeSlug,
  returnTo,
  primaryLmsHostname,
}: ProductListClientProps) {
  const router = useRouter()
  const [copiedId, setCopiedId] = useState('')
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState('')
  const entitlementByProduct = new Map(
    entitlements.map((item) => [item.storeProductId, item]),
  )

  async function copyCheckout(product: AdminStoreProductView) {
    const fullUrl = primaryLmsHostname
      ? `https://${primaryLmsHostname}/product/${product.publicSlug}`
      : `${window.location.origin}/store/${orgSlug}/${storeSlug}/product/${product.publicSlug}`
    await navigator.clipboard.writeText(fullUrl)
    setCopiedId(product.id)
    window.setTimeout(() => {
      setCopiedId((current) => current === product.id ? '' : current)
    }, 2000)
  }

  function removeProduct(product: AdminStoreProductView) {
    if (!window.confirm(`Hapus "${product.publicName}" dari toko? Data yang sudah dipakai order akan dinonaktifkan bila tidak dapat dihapus.`)) {
      return
    }
    const formData = new FormData()
    formData.set('store_product_id', product.id)
    startTransition(async () => {
      const result = await deleteLmsSimpleProductAction(formData)
      if (!result.success) {
        setMessage(result.error || 'Produk gagal dihapus.')
        return
      }
      setMessage('Produk berhasil dihapus dari toko.')
      router.refresh()
    })
  }

  return (
    <>
      {message && (
        <div role="status" className="border-b border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-800">
          {message}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-[860px] w-full text-left">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr className="text-xs font-bold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Produk</th>
              <th className="px-4 py-3">Jenis</th>
              <th className="px-4 py-3">Manfaat LMS</th>
              <th className="px-4 py-3">Harga</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Tindakan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map((product) => {
              const benefit = entitlementByProduct.get(product.id)
              const publicPath = primaryLmsHostname
                ? `https://${primaryLmsHostname}/product/${product.publicSlug}`
                : `/store/${orgSlug}/${storeSlug}/product/${product.publicSlug}`
              return (
                <tr key={product.id} className="transition-colors hover:bg-slate-50/80">
                  <td className="px-4 py-4">
                    <p className="max-w-xs truncate text-sm font-bold text-slate-950">
                      {product.publicName}
                    </p>
                    <p className="mt-1 max-w-xs truncate text-xs font-medium text-slate-500">
                      {product.shortDescription || 'Belum ada deskripsi singkat'}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-sm font-semibold text-slate-700">
                    {product.subscriptionPlan ? 'Langganan' : 'Sekali bayar'}
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-sm font-bold text-slate-900">
                      {benefit?.resolvedCourseIds.length || 0} course
                    </p>
                    <p className="text-xs font-medium text-slate-500">
                      {benefit?.packageIds.length || 0} Paket Akses
                    </p>
                  </td>
                  <td className="px-4 py-4 text-sm font-bold text-slate-950">
                    {formatRupiah(product.priceOverride || 0)}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                      product.isPublished
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {product.isPublished ? 'Tayang' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-1">
                      {product.isPublished && (
                        <>
                          <Link
                            href={publicPath}
                            target="_blank"
                            aria-label={`Buka ${product.publicName} di toko`}
                            className="inline-flex size-11 cursor-pointer items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
                          >
                            <ExternalLink aria-hidden="true" size={17} />
                          </Link>
                          <button
                            type="button"
                            onClick={() => copyCheckout(product)}
                            aria-label={`Salin tautan ${product.publicName}`}
                            className="inline-flex size-11 cursor-pointer items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
                          >
                            {copiedId === product.id
                              ? <Check aria-hidden="true" size={17} />
                              : <Copy aria-hidden="true" size={17} />}
                          </button>
                        </>
                      )}
                      <Link
                        href={`/lms/admin/penjualan/produk/${product.id}?returnTo=${encodeURIComponent(returnTo)}`}
                        aria-label={`Ubah ${product.publicName}`}
                        className="inline-flex size-11 cursor-pointer items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
                      >
                        <PencilLine aria-hidden="true" size={17} />
                      </Link>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => removeProduct(product)}
                        aria-label={`Hapus ${product.publicName}`}
                        className="inline-flex size-11 cursor-pointer items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-100 disabled:cursor-wait disabled:opacity-50"
                      >
                        <Trash2 aria-hidden="true" size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
