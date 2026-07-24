import { writeFileSync, readFileSync } from 'fs'
const p = 'modules/ecommerce/actions/ecommerce.actions.ts'
let c = readFileSync(p, 'utf-8')

c = c.replace(/return \{ error: 'Anda harus masuk terlebih dahulu.' \}/g, "return { success: false, error: 'Anda harus masuk terlebih dahulu.' }")
c = c.replace(/return \{ error: 'Store dan produk wajib dipilih.' \}/g, "return { success: false, error: 'Store dan produk wajib dipilih.' }")
c = c.replace(/return \{ error: 'Produk tidak ditemukan di katalog.' \}/g, "return { success: false, error: 'Produk tidak ditemukan di katalog.' }")
c = c.replace(/return \{ error: 'Gagal menayangkan produk: ' \+ insertErr.message \}/g, "return { success: false, error: 'Gagal menayangkan produk: ' + insertErr.message }")
c = c.replace(/return \{ error: err.message \|\| 'Unknown error' \}/g, "return { success: false, error: err.message || 'Unknown error' }")

writeFileSync(p, c)
