import { writeFileSync, readFileSync } from 'fs'
const p = 'modules/edu/actions/lms-commercial.actions.ts'
const c = readFileSync(p, 'utf-8')

const codeToAdd = `

export async function setupLmsCommerceAction() {
  try {
    const orgData = await getActiveOrg()
    if (!orgData) return { error: 'Anda harus masuk terlebih dahulu.' }

    const supabase = await createClient()
    const orgId = orgData.org.id

    // 1. Check or create Branch
    let branchId = ''
    const { data: branches } = await supabase.from('branches').select('id').eq('org_id', orgId).eq('is_active', true).limit(1)
    if (branches && branches.length > 0) {
      branchId = branches[0].id
    } else {
      const { data: newBranch, error: brErr } = await supabase.from('branches').insert({
        org_id: orgId,
        name: 'Cabang Utama LMS',
        code: 'LMS-BR',
        is_active: true
      }).select('id').single()
      if (brErr || !newBranch) return { error: 'Gagal membuat Cabang: ' + (brErr?.message || '') }
      branchId = newBranch.id
    }

    // 2. Check or create Warehouse
    let warehouseId = ''
    const { data: warehouses } = await supabase.from('warehouses').select('id').eq('org_id', orgId).eq('is_active', true).limit(1)
    if (warehouses && warehouses.length > 0) {
      warehouseId = warehouses[0].id
    } else {
      const { data: newWh, error: whErr } = await supabase.from('warehouses').insert({
        org_id: orgId,
        branch_id: branchId,
        name: 'Gudang Digital LMS',
        code: 'LMS-WH',
        is_active: true
      }).select('id').single()
      if (whErr || !newWh) return { error: 'Gagal membuat Gudang: ' + (whErr?.message || '') }
      warehouseId = newWh.id
    }

    // 3. Check or create Bank Account
    let bankId = ''
    const { data: banks } = await supabase.from('bank_accounts').select('id').eq('org_id', orgId).eq('is_active', true).limit(1)
    if (banks && banks.length > 0) {
      bankId = banks[0].id
    } else {
      const { data: newBank, error: bkErr } = await supabase.from('bank_accounts').insert({
        org_id: orgId,
        branch_id: branchId,
        bank_name: 'Kas Default LMS',
        account_name: 'Penerima Pembayaran',
        account_number: '123456789',
        is_active: true
      }).select('id').single()
      if (bkErr || !newBank) return { error: 'Gagal membuat Rekening: ' + (bkErr?.message || '') }
      bankId = newBank.id
    }

    // 4. Create Store
    const storeSlug = 'store-' + Math.random().toString(36).substring(2, 8)
    const { error: storeErr } = await supabase.from('stores').insert({
      org_id: orgId,
      branch_id: branchId,
      warehouse_id: warehouseId,
      bank_account_id: bankId,
      name: 'LMS Digital Store',
      slug: storeSlug,
      brand_name: 'LMS Store',
      line_name: 'Digital'
    })

    if (storeErr) return { error: 'Gagal membuat Store: ' + storeErr.message }

    revalidatePath('/lms/admin/penjualan')
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Unknown error' }
  }
}
`

writeFileSync(p, c + codeToAdd)
