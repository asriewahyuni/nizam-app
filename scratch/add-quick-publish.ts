import { writeFileSync, readFileSync } from 'fs'
const p = 'modules/edu/actions/lms-commercial.actions.ts'
const c = readFileSync(p, 'utf-8')

const codeToAdd = `

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

    revalidatePath('/lms/admin/penjualan')
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Unknown error' }
  }
}
`

writeFileSync(p, c + codeToAdd)
