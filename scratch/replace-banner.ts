import { writeFileSync, readFileSync } from 'fs'
const p = 'modules/ecommerce/components/CourseCommerceManager.tsx'
let c = readFileSync(p, 'utf-8')

const target = `            {!selectedStoreProduct && (
              <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                Produk ini belum dipublikasikan ke store. Buka E-Commerce Lengkap untuk mengatur harga dan publikasi.
              </div>
            )}`

const replacement = `            {!selectedStoreProduct && selectedProductId && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
                <h3 className="text-base font-bold text-indigo-950">Terbitkan Produk ke Store</h3>
                <p className="mt-1 text-sm text-indigo-800">
                  Produk ini masih ada di katalog dan belum dijual di Store ini. Tentukan harganya untuk mulai menjual.
                </p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="flex-1 text-sm font-semibold text-indigo-900">
                    Harga Jual (Rp)
                    <input
                      type="number"
                      min="0"
                      name="price"
                      defaultValue="0"
                      className="mt-2 min-h-11 w-full rounded-xl border border-indigo-300 bg-white px-4 outline-none transition-colors duration-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={(e) => {
                      const form = e.currentTarget.closest('form')
                      if (form) {
                        const fd = new FormData(form)
                        fd.set('store_id', selectedStoreId)
                        fd.set('product_id', selectedProductId)
                        runAction(
                          quickPublishStoreProductAction,
                          fd,
                          'Produk berhasil diterbitkan ke Store.',
                        )
                      }
                    }}
                    className="min-h-11 rounded-xl bg-indigo-600 px-6 font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
                  >
                    Terbitkan Sekarang
                  </button>
                </div>
              </div>
            )}`

c = c.replace(target, replacement)
writeFileSync(p, c)
