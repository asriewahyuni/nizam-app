import { writeFileSync, readFileSync } from 'fs'
const p = 'modules/ecommerce/actions/ecommerce.actions.ts'
let c = readFileSync(p, 'utf-8')

const codeToAdd = `

export async function quickCreateLmsProductAction(formData: FormData) {
  try {
    const orgData = await getActiveOrg()
    if (!orgData) return { success: false, error: 'Anda harus masuk terlebih dahulu.' }

    const name = formData.get('name')?.toString().trim()
    if (!name) return { success: false, error: 'Nama produk wajib diisi.' }

    const supabase = await createClient()
    const orgId = orgData.org.id

    const { data: newProd, error: insertErr } = await supabase.from('products').insert({
      org_id: orgId,
      name,
      sku: 'LMS-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      type: 'DIGITAL',
      base_price: 0,
      is_active: true
    }).select('id').single()

    if (insertErr) return { success: false, error: 'Gagal membuat produk: ' + insertErr.message }

    revalidatePath('/lms/admin/penjualan')
    return { success: true, data: { productId: newProd.id } }
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error' }
  }
}
`
writeFileSync(p, c + codeToAdd)
