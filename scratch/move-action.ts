import { writeFileSync, readFileSync } from 'fs'

// 1. Remove from lms-commercial.actions.ts
const p1 = 'modules/edu/actions/lms-commercial.actions.ts'
let c1 = readFileSync(p1, 'utf-8')
const searchStr = 'export async function quickPublishStoreProductAction'
const idx = c1.indexOf(searchStr)
if (idx > -1) {
  c1 = c1.substring(0, idx).trim()
  writeFileSync(p1, c1)
}

// 2. Add to ecommerce.actions.ts
const p2 = 'modules/ecommerce/actions/ecommerce.actions.ts'
let c2 = readFileSync(p2, 'utf-8')

const codeToAdd = `
import { createClient } from '@/lib/supabase/server'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'

export async function quickPublishStoreProductAction(formData: FormData) {
  try {
    const orgData = await getActiveOrg()
    if (!orgData) return { error: 'Anda harus masuk terlebih dahulu.' }

    const storeId = formData.get('store_id')?.toString()
    const productId = formData.get('product_id')?.toString()
    const price = Number(formData.get('price') || 0)

    if (!storeId || !productId) return { error: 'Store dan produk wajib dipilih.' }

    const supabase = await createClient()
    const orgId = orgData.org.id

    const { data: prod } = await supabase.from('products').select('name').eq('id', productId).eq('org_id', orgId).single()
    if (!prod) return { error: 'Produk tidak ditemukan di katalog.' }

    const { error: insertErr } = await supabase.from('store_products').insert({
      org_id: orgId,
      store_id: storeId,
      product_id: productId,
      public_name: prod.name,
      public_slug: 'p-' + Math.random().toString(36).substring(2, 8),
      price_override: price,
      is_published: true
    })

    if (insertErr) return { error: 'Gagal menayangkan produk: ' + insertErr.message }

    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Unknown error' }
  }
}
`
// Make sure not to duplicate imports if they already exist, but here I'm appending to the end
writeFileSync(p2, c2 + "\n" + codeToAdd)
