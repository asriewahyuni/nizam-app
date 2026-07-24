import { writeFileSync, readFileSync } from 'fs'
const p = 'modules/ecommerce/components/CourseCommerceManager.tsx'
let c = readFileSync(p, 'utf-8')

const target = `            <label className="text-sm font-semibold text-slate-700">
              Produk
              <select
                value={selectedProductId}
                onChange={(event) => applySalesContext(selectedStoreId, event.target.value)}
                className="mt-2 min-h-11 w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-4 outline-none transition-colors duration-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
              >
                {dashboardData.products.length === 0 && <option value="">Belum ada produk</option>}
                {dashboardData.products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>`

const replacement = `            <div className="text-sm font-semibold text-slate-700">
              <div className="flex items-center justify-between">
                <label htmlFor="select-product">Produk</label>
                <button
                  type="button"
                  onClick={() => {
                    const name = window.prompt('Masukkan nama produk baru:')
                    if (name) {
                      const fd = new FormData()
                      fd.set('name', name)
                      runAction(quickCreateLmsProductAction, fd, 'Produk berhasil dibuat.', (res) => {
                        if (res.data && typeof res.data === 'object' && 'productId' in res.data) {
                           applySalesContext(selectedStoreId, res.data.productId as string)
                        }
                      })
                    }
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline focus:outline-none"
                >
                  + Buat Baru
                </button>
              </div>
              <select
                id="select-product"
                value={selectedProductId}
                onChange={(event) => applySalesContext(selectedStoreId, event.target.value)}
                className="mt-2 min-h-11 w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-4 outline-none transition-colors duration-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
              >
                {dashboardData.products.length === 0 && <option value="">Belum ada produk</option>}
                {dashboardData.products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>`

c = c.replace(target, replacement)
writeFileSync(p, c)
