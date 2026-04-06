'use server'

import bcrypt from 'bcrypt'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { auth, signIn as nextAuthSignIn, signOut as nextAuthSignOut } from '@/auth'
import { prisma } from '@/lib/prisma'

// ═══════════════════════════════════════════════════════════
// DEMO ACCOUNT SYSTEM
// - Uses a dedicated demo@nizam.app Supabase auth account
// - On each demo start: wipes old demo org, creates fresh one
// - On logout: destroys the demo org (cascade delete)
import { cookies } from 'next/headers'

const DEMO_EMAIL = 'demo@nizam.app'
const DEMO_PASSWORD = 'demo-nizam-2026!'

/**
 * Start a demo session:
 * 1. Sign in with demo credentials
 * 2. Delete any existing demo org (reset)
 * 3. Create fresh org with seed data
 * 4. Redirect to dashboard
 */
export type DemoBusinessType = 'COMPUTER' | 'CATERING' | 'RESTAURANT' | 'SUPPLIER_MBG' | 'BLANK'

export async function startDemoSession(businessName?: string, demoType: DemoBusinessType = 'COMPUTER') {
  let demoUser = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
    select: { id: true },
  })

  if (!demoUser?.id) {
    try {
      demoUser = await prisma.user.create({
        data: {
          email: DEMO_EMAIL,
          password: bcrypt.hashSync(DEMO_PASSWORD, 10),
          name: 'Demo User',
        },
        select: { id: true },
      })
    } catch (error) {
      console.error('Demo signup failed:', error)
      redirect('/login?error=' + encodeURIComponent('Gagal membuat akun demo. Coba lagi.'))
    }
  }

  const userId = demoUser.id

  try {
    await nextAuthSignIn('credentials', {
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      redirect: false,
    })
  } catch (error) {
    console.error('Demo sign-in failed:', error)
    redirect('/login?error=' + encodeURIComponent('Gagal masuk ke akun demo.'))
  }

  const existingMemberships = await prisma.org_members.findMany({
    where: { user_id: userId },
    select: { org_id: true },
  })

  if (existingMemberships.length > 0) {
    await prisma.organizations.deleteMany({
      where: { id: { in: existingMemberships.map((membership) => membership.org_id) } },
    })
  }

  const orgId = crypto.randomUUID()
  const defaultNames = {
    'COMPUTER': 'NIZAM Computer Assembly',
    'CATERING': 'NIZAM Catering Sehat',
    'RESTAURANT': 'NIZAM Rumah Makan Mantap',
    'SUPPLIER_MBG': 'NIZAM MBG Supplier Hub',
    'BLANK': 'NIZAM Baru (Kosongan)'
  }
  const orgName = businessName || defaultNames[demoType]

  try {
    await prisma.organizations.create({
      data: {
        id: orgId,
        name: orgName,
        slug: 'demo-' + demoType.toLowerCase() + '-' + Date.now(),
        is_demo: true,
        settings: {
          currency: 'IDR',
          timezone: 'Asia/Jakarta',
          fiscal_year_start_month: 1,
          plan: 'Demo',
          is_demo: true,
          business_type: demoType,
          skip_coa_seed: demoType === 'BLANK'
        },
      },
    })
  } catch (error) {
    console.error('Demo org creation failed:', error)
    redirect('/login?error=' + encodeURIComponent('Gagal membuat organisasi demo.'))
  }

  try {
    await prisma.org_members.create({
      data: {
        org_id: orgId,
        user_id: userId,
        role: 'owner',
        is_active: true,
      },
    })
  } catch (error) {
    console.error('Demo member creation failed:', error)
    redirect('/login?error=' + encodeURIComponent('Gagal mendaftarkan anggota demo.'))
  }

  const demoBranchId = await seedDemoData(orgId, demoType)

  // 6. Set Demo Org ID in Cookie for session-specific tracking
  const cookieStore = await cookies()
  cookieStore.delete('nizam_active_org_id') // Reset shared org cache for fresh demo
  cookieStore.delete('nizam_active_branch_id')
  cookieStore.set('nizam_demo_org_id', orgId, { 
    maxAge: 60 * 60 * 6, // 6 hours
    path: '/',
    httpOnly: true,
    sameSite: 'lax'
  })
  if (demoBranchId) {
    cookieStore.set('nizam_active_branch_id', demoBranchId, {
      maxAge: 60 * 60 * 6,
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    })
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

/**
 * End demo session — delete everything and logout
 */
export async function signOutDemo() {
  const cookieStore = await cookies()
  const demoOrgId = cookieStore.get('nizam_demo_org_id')?.value

  const session = await auth()
  const user = session?.user

  if (user?.id && user.email === DEMO_EMAIL) {
    if (demoOrgId) {
      try {
        await prisma.organizations.delete({ where: { id: demoOrgId } })
      } catch (error) {
        console.error('SignOutDemo: Failed to delete org:', error)
      }
    }

    const remainingMemberships = await prisma.org_members.findMany({
      where: { user_id: user.id },
      select: { org_id: true },
    })

    if (remainingMemberships.length > 0) {
      try {
        await prisma.organizations.deleteMany({
          where: { id: { in: remainingMemberships.map((membership) => membership.org_id) } },
        })
      } catch (error) {
        console.error('SignOutDemo: Cleanup delete failed:', error)
      }
    }
  }

  // Clear ALL demo + active org cookies
  cookieStore.delete('nizam_demo_org_id')
  cookieStore.delete('nizam_active_org_id')
  cookieStore.delete('nizam_active_branch_id')

  await nextAuthSignOut({ redirect: false })
  revalidatePath('/', 'layout')
  redirect('/login')
}

/**
 * Check if current session is a demo account
 */
export async function isDemoSession(): Promise<boolean> {
  const session = await auth()
  const user = session?.user
  if (!user) return false
  return user.email === DEMO_EMAIL
}

// ═══════════════════════════════════════════════════════════
// SEED DEMO DATA — Products, Warehouses, Contacts, etc.
// ═══════════════════════════════════════════════════════════
async function ensureDemoBranch(orgId: string) {
  const existingBranch = await prisma.branches.findFirst({
    where: { org_id: orgId, is_active: true },
    orderBy: { created_at: 'asc' },
    select: { id: true },
  })

  if (existingBranch?.id) return existingBranch.id

  const branch = await prisma.branches.create({
    data: {
      id: crypto.randomUUID(),
      org_id: orgId,
      name: 'Unit Utama',
      code: 'MAIN',
      is_active: true,
    },
    select: { id: true },
  })

  return branch.id
}

export async function seedDemoData(orgId: string, demoType: DemoBusinessType) {
  const branchId = await ensureDemoBranch(orgId)
  if (!branchId) return null

  // 🔴 AUTHENTIC BLANK DEMO: No products, no warehouses, no contacts.
  if (demoType === 'BLANK') return branchId

  // --- WAREHOUSES & CONTACTS & PRODUCTS BY TYPE ---
  let warehousesData: any[] = []
  let contactsData: any[] = []
  let productsData: any[] = []

  if (demoType === 'COMPUTER') {
    warehousesData = [
      { id: crypto.randomUUID(), org_id: orgId, branch_id: branchId, name: 'Gudang Utama', code: 'GU-01', address: 'Jl. Industri No.1' },
      { id: crypto.randomUUID(), org_id: orgId, branch_id: branchId, name: 'Gudang Produksi', code: 'GP-01', address: 'Jl. Pabrik No.5' },
    ]
    contactsData = [
      { org_id: orgId, name: 'PT Supplier Jaya', type: 'SUPPLIER', phone: '021-1234567', email: 'order@supplierjaya.com' },
      { org_id: orgId, name: 'CV Bahan Berkah', type: 'SUPPLIER', phone: '021-7654321', email: 'sales@bahanberkah.id' },
      { org_id: orgId, name: 'Toko Makmur', type: 'CUSTOMER', phone: '0812-9999-8888', email: 'makmur@email.com' },
      { org_id: orgId, name: 'PT Retail Nusantara', type: 'CUSTOMER', phone: '021-5556677', email: 'procurement@retailnusantara.id' },
    ]
    productsData = [
      { id: crypto.randomUUID(), org_id: orgId, name: 'Motherboard ASUS B660', sku: 'RM-MB-001', type: 'INVENTORY', unit: 'Pcs', purchase_price: 1850000, selling_price: 2200000 },
      { id: crypto.randomUUID(), org_id: orgId, name: 'RAM DDR5 16GB', sku: 'RM-RAM-001', type: 'INVENTORY', unit: 'Pcs', purchase_price: 750000, selling_price: 950000 },
      { id: crypto.randomUUID(), org_id: orgId, name: 'SSD NVMe 512GB', sku: 'RM-SSD-001', type: 'INVENTORY', unit: 'Pcs', purchase_price: 680000, selling_price: 850000 },
      { id: crypto.randomUUID(), org_id: orgId, name: 'Casing ATX Gaming', sku: 'RM-CSG-001', type: 'INVENTORY', unit: 'Pcs', purchase_price: 450000, selling_price: 600000 },
      { id: crypto.randomUUID(), org_id: orgId, name: 'PSU 650W 80+ Gold', sku: 'RM-PSU-001', type: 'INVENTORY', unit: 'Pcs', purchase_price: 920000, selling_price: 1200000 },
      { id: crypto.randomUUID(), org_id: orgId, name: 'PC Rakitan Custom Office', sku: 'FG-PC-001', type: 'INVENTORY', unit: 'Unit', purchase_price: 4650000, selling_price: 6500000 },
      { id: crypto.randomUUID(), org_id: orgId, name: 'Jasa Rakit & Instalasi OS', sku: 'SVC-RAKIT-001', type: 'SERVICE', unit: 'Unit', purchase_price: 0, selling_price: 350000 },
    ]
  } else if (demoType === 'CATERING') {
    warehousesData = [
      { id: crypto.randomUUID(), org_id: orgId, branch_id: branchId, name: 'Dapur Utama', code: 'WH-K-01', address: 'Pusat Produksi' },
      { id: crypto.randomUUID(), org_id: orgId, branch_id: branchId, name: 'Gudang Bahan Baku', code: 'WH-K-02', address: 'Area Pendingin' },
    ]
    contactsData = [
      { org_id: orgId, name: 'Supplier Beras Makmur', type: 'SUPPLIER', phone: '0811223344', email: 'v-beras@example.com' },
      { org_id: orgId, name: 'CV Ayam Segar', type: 'SUPPLIER', phone: '0811223355', email: 'v-ayam@example.com' },
      { org_id: orgId, name: 'Event Organizer Serasi', type: 'CUSTOMER', phone: '021-998877', email: 'c-eo@example.com' },
    ]
    productsData = [
      { id: crypto.randomUUID(), org_id: orgId, name: 'Beras Rojo Lele 5kg', sku: 'RM-K-01', type: 'INVENTORY', unit: 'Karung', purchase_price: 75000, selling_price: 85000 },
      { id: crypto.randomUUID(), org_id: orgId, name: 'Ayam Potong (Ekor)', sku: 'RM-K-02', type: 'INVENTORY', unit: 'Ek', purchase_price: 35000, selling_price: 42000 },
      { id: crypto.randomUUID(), org_id: orgId, name: 'Box Catering Eco', sku: 'RM-K-03', type: 'INVENTORY', unit: 'Pcs', purchase_price: 2500, selling_price: 3500 },
      { id: crypto.randomUUID(), org_id: orgId, name: 'Paket Nasi Box Ayam Bakar', sku: 'FG-K-01', type: 'INVENTORY', unit: 'Box', purchase_price: 22000, selling_price: 35000 },
      { id: crypto.randomUUID(), org_id: orgId, name: 'Layanan Prasmanan VIP', sku: 'SVC-K-01', type: 'SERVICE', unit: 'Pax', purchase_price: 0, selling_price: 150000 },
    ]
  } else if (demoType === 'RESTAURANT') {
    warehousesData = [
      { id: crypto.randomUUID(), org_id: orgId, branch_id: branchId, name: 'Area Bar', code: 'WH-R-01', address: 'Front Counter' },
      { id: crypto.randomUUID(), org_id: orgId, branch_id: branchId, name: 'Kitchen Supply', code: 'WH-R-02', address: 'Back Area' },
    ]
    contactsData = [
      { org_id: orgId, name: 'Pasar Induk Kramat Jati', type: 'SUPPLIER' },
      { org_id: orgId, name: 'CV Minyak Berkah', type: 'SUPPLIER' },
      { org_id: orgId, name: 'Pelanggan Walk-In', type: 'CUSTOMER' },
    ]
    productsData = [
      { id: crypto.randomUUID(), org_id: orgId, name: 'Daging Sapi (Kg)', sku: 'RM-R-01', type: 'INVENTORY', unit: 'Kg', purchase_price: 120000, selling_price: 140000 },
      { id: crypto.randomUUID(), org_id: orgId, name: 'Minyak Goreng 2L', sku: 'RM-R-02', type: 'INVENTORY', unit: 'Botol', purchase_price: 28000, selling_price: 35000 },
      { id: crypto.randomUUID(), org_id: orgId, name: 'Rempah Rendang Mix', sku: 'RM-R-03', type: 'INVENTORY', unit: 'Pack', purchase_price: 15000, selling_price: 20000 },
      { id: crypto.randomUUID(), org_id: orgId, name: 'Nasi Rendang Padang', sku: 'FG-R-01', type: 'INVENTORY', unit: 'Porsi', purchase_price: 18000, selling_price: 28000 },
      { id: crypto.randomUUID(), org_id: orgId, name: 'Es Teh Manis', sku: 'FG-R-02', type: 'INVENTORY', unit: 'Gelas', purchase_price: 1500, selling_price: 8000 },
    ]
  } else if (demoType === 'SUPPLIER_MBG') {
    warehousesData = [
      { id: crypto.randomUUID(), org_id: orgId, branch_id: branchId, name: 'Distribution Center 1', code: 'WH-M-01', address: 'Hub Utama MBG' },
      { id: crypto.randomUUID(), org_id: orgId, branch_id: branchId, name: 'Cold Storage A', code: 'WH-M-02', address: 'Area Susu & Buah' },
    ]
    contactsData = [
      { org_id: orgId, name: 'Gabungan Kelompok Tani', type: 'SUPPLIER' },
      { org_id: orgId, name: 'Peternakan Ayam Berkarya', type: 'SUPPLIER' },
      { org_id: orgId, name: 'Dinas Pendidikan - Wil 1', type: 'CUSTOMER' },
      { org_id: orgId, name: 'UPT Sekolah Dasar', type: 'CUSTOMER' },
    ]
    productsData = [
      { id: crypto.randomUUID(), org_id: orgId, name: 'Susu UHT 200ml', sku: 'RM-M-01', type: 'INVENTORY', unit: 'Box', purchase_price: 4000, selling_price: 5000 },
      { id: crypto.randomUUID(), org_id: orgId, name: 'Apel Malang Merah', sku: 'RM-M-02', type: 'INVENTORY', unit: 'Kg', purchase_price: 25000, selling_price: 30000 },
      { id: crypto.randomUUID(), org_id: orgId, name: 'Telur Ayam (Butir)', sku: 'RM-M-03', type: 'INVENTORY', unit: 'Butir', purchase_price: 1500, selling_price: 2000 },
      { id: crypto.randomUUID(), org_id: orgId, name: 'Paket MBG SD - Menu A', sku: 'FG-M-01', type: 'INVENTORY', unit: 'Paket', purchase_price: 11000, selling_price: 15000 },
      { id: crypto.randomUUID(), org_id: orgId, name: 'Biaya Logistik MBG', sku: 'SVC-M-01', type: 'SERVICE', unit: 'Trip', purchase_price: 0, selling_price: 250000 },
    ]
  }

  // wait for accounts to be generated by trigger (retry up to 5 times)
  let accounts: any[] = []
  for (let i = 0; i < 5; i++) {
    const data = await prisma.accounts.findMany({
      where: { org_id: orgId },
      select: { id: true, code: true },
    })
    if (data.length > 20) {
      accounts = data
      break
    }
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  const invAccId = accounts?.find((a: any) => a.code === '1301')?.id
  const incomeAccId = accounts?.find((a: any) => a.code === '4001')?.id
  const expenseAccId = accounts?.find((a: any) => a.code === '5001')?.id
  const capitalAccId = accounts?.find((a: any) => a.code === '3001')?.id
  const cashAccId = accounts?.find((a: any) => a.code === '1101')?.id
  const bankAccId = accounts?.find((a: any) => a.code === '1201')?.id

  // --- MAP PRODUCTS WITH ACCOUNTS & INSERT ---
  const finalProducts = productsData.map((p: any) => ({
    ...p,
    asset_account_id: p.type === 'INVENTORY' ? invAccId : null,
    income_account_id: incomeAccId,
    expense_account_id: expenseAccId,
    average_cost: p.purchase_price
  }))

  await prisma.warehouses.createMany({ data: warehousesData })
  await prisma.contacts.createMany({ data: contactsData })
  await prisma.products.createMany({ data: finalProducts })

  const wh1Id = warehousesData[0].id
  
  // --- INITIAL STOCK & JOURNAL ENTRY (Double Entry Accounting) ---
  const stockItems = finalProducts.filter((p: any) => p.type === 'INVENTORY').map((p: any) => ({
    org_id: orgId,
    product_id: p.id,
    warehouse_id: wh1Id,
    quantity: 50 
  }))

  if (stockItems.length > 0 && invAccId && capitalAccId) {
    await prisma.inventory_stocks.createMany({ data: stockItems })

    const totalValue = stockItems.reduce((sum: any, s: any) => {
      const p = finalProducts.find((prod: any) => prod.id === s.product_id)
      return sum + (s.quantity * (p?.purchase_price || 0))
    }, 0)

    const entry = await prisma.journal_entries.create({
      data: {
        org_id: orgId,
        branch_id: branchId,
        entry_number: '',
        entry_date: new Date(`${new Date().toISOString().split('T')[0]}T00:00:00.000Z`),
        description: 'Saldo Awal Persediaan (Demo Seed)',
        status: 'DRAFT',
        is_auto: true,
      },
      select: { id: true },
    })

    if (entry?.id) {
      await prisma.journal_lines.createMany({
        data: [
          { entry_id: entry.id, account_id: invAccId, debit: totalValue, credit: 0, memo: 'Persediaan Awal' },
          { entry_id: entry.id, account_id: capitalAccId, debit: 0, credit: totalValue, memo: 'Modal Awal (Inventory)' }
        ]
      })

      await prisma.journal_entries.update({ where: { id: entry.id }, data: { status: 'POSTED' } })

      const movements = stockItems.map((s: any) => ({
        org_id: orgId,
        product_id: s.product_id,
        movement_date: new Date().toISOString().split('T')[0],
        quantity: s.quantity,
        unit_price: finalProducts.find((p: any) => p.id === s.product_id)?.purchase_price || 0,
        reference_type: 'INITIAL',
        reference_id: entry.id,
        notes: 'Saldo awal demo (' + demoType + ')',
        branch_id: branchId,
      }))

      await prisma.stock_movements.createMany({ data: movements })
    }
  }

  if (cashAccId && bankAccId && capitalAccId) {
    const cashInject = 500000000
    const bankInject = 1500000000
    const totalCapital = cashInject + bankInject

    const cashEntry = await prisma.journal_entries.create({
      data: {
        org_id: orgId,
        branch_id: branchId,
        entry_number: '',
        entry_date: new Date(`${new Date().toISOString().split('T')[0]}T00:00:00.000Z`),
        description: 'Setoran Modal Awal (Cash & Bank Injection)',
        status: 'DRAFT',
        is_auto: true,
      },
      select: { id: true },
    })

    if (cashEntry?.id) {
      await prisma.journal_lines.createMany({
        data: [
          { entry_id: cashEntry.id, account_id: cashAccId, debit: cashInject, credit: 0, memo: 'Setoran Modal (Kas Utama)' },
          { entry_id: cashEntry.id, account_id: bankAccId, debit: bankInject, credit: 0, memo: 'Setoran Modal (Bank)' },
          { entry_id: cashEntry.id, account_id: capitalAccId, debit: 0, credit: totalCapital, memo: 'Modal Disetor' }
        ]
      })

      await prisma.journal_entries.update({ where: { id: cashEntry.id }, data: { status: 'POSTED' } })
    }
  }

  return branchId
}

export async function seedDemoOrganization(
  orgId: string,
  demoType: DemoBusinessType
) {
  return seedDemoData(orgId, demoType)
}
