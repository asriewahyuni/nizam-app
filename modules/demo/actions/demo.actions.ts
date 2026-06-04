'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { createInternalAuthUser, signInWithInternalAuth } from '@/lib/auth/internal-auth.server'
import { seedInitialCoA } from '@/modules/accounting/actions/coa.actions'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// ═══════════════════════════════════════════════════════════
// DEMO ACCOUNT SYSTEM
// - Uses a dedicated demo@nizam.app Supabase auth account
// - On each demo start: wipes old demo org, creates fresh one
// - On logout: destroys the demo org (cascade delete)
import { cookies } from 'next/headers'

const DEMO_EMAIL = 'demo@nizam.app'
const DEMO_PASSWORD = 'demo-nizam-2026!'
const DEMO_ACCOUNT_WAIT_RETRIES = 5
const DEMO_ACCOUNT_WAIT_MS = 1000
const DEMO_SESSION_MAX_AGE = 60 * 60 * 12
const DEMO_BUSINESS_TYPES: DemoBusinessType[] = ['COMPUTER', 'CATERING', 'RESTAURANT', 'SUPPLIER_MBG', 'BUS_OPERATOR', 'BLANK']
const BLANK_DEMO_BUDGET_TEMPLATES = [
  { code: '4001', budgetAmount: 250000000 },
  { code: '5001', budgetAmount: 95000000 },
  { code: '6001', budgetAmount: 38000000 },
  { code: '6002', budgetAmount: 12000000 },
  { code: '6003', budgetAmount: 4500000 },
  { code: '6005', budgetAmount: 7500000 },
] as const

type DemoSeedAccount = {
  id: string
  code: string
}

type DemoSessionUser = {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown> | null
}

/**
 * Start a demo session:
 * 1. Sign in with demo credentials
 * 2. Delete any existing demo org (reset)
 * 3. Create fresh org with seed data
 * 4. Redirect to dashboard
 */
export type DemoBusinessType = 'COMPUTER' | 'CATERING' | 'RESTAURANT' | 'SUPPLIER_MBG' | 'BUS_OPERATOR' | 'BLANK'

function normalizeDemoBusinessType(value: unknown): DemoBusinessType {
  const normalized = String(value || '').trim().toUpperCase()
  if (DEMO_BUSINESS_TYPES.includes(normalized as DemoBusinessType)) {
    return normalized as DemoBusinessType
  }
  return 'COMPUTER'
}

export async function startDemoSessionFromForm(formData: FormData) {
  const businessName = String(formData.get('businessName') || '').trim() || undefined
  const demoType = normalizeDemoBusinessType(formData.get('demoType'))
  return startDemoSession(businessName, demoType)
}

function isDemoOrganizationRecord(orgRow: { is_demo?: boolean | null; settings?: Record<string, unknown> | null } | null | undefined) {
  if (!orgRow) return false
  const settings = orgRow.settings ?? null
  // Sumber kebenaran utama = organizations.is_demo (kolom DB).
  // settings.is_demo hanya fallback legacy. planName === 'demo' DIHAPUS —
  // nama plan bukan penentu apakah org adalah demo.
  return Boolean(orgRow.is_demo) || settings?.is_demo === true
}

async function getValidatedDemoSession() {
  const cookieStore = await cookies()
  const demoOrgId = String(cookieStore.get('nizam_demo_org_id')?.value || '').trim()
  if (!demoOrgId) return null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) return null

  const db = (await createAdminClient()) as any
  const { data: membership } = await db
    .from('org_members')
    .select('org_id')
    .eq('org_id', demoOrgId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership?.org_id) return null

  const { data: orgRow } = await db
    .from('organizations')
    .select('id, is_demo, settings')
    .eq('id', demoOrgId)
    .maybeSingle()

  if (!isDemoOrganizationRecord(orgRow as { is_demo?: boolean | null; settings?: Record<string, unknown> | null } | null)) {
    return null
  }

  return {
    user: user as DemoSessionUser,
    demoOrgId,
  }
}

export async function startDemoSession(businessName?: string, demoType: DemoBusinessType = 'COMPUTER') {
  const adminClient = await createAdminClient()

  // 1. Sign up or sign in the demo user
  const signInResult = await signInWithInternalAuth({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  })

  let userId: string

  if (signInResult.error) {
    // Demo user doesn't exist yet — create it
    const signUpResult = await createInternalAuthUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      fullName: 'Demo User',
    })

    if (signUpResult.error || !signUpResult.userId) {
      (console as any).error('Demo signup failed:', signUpResult.error)
      redirect('/login?error=' + encodeURIComponent('Gagal membuat akun demo. Coba lagi.'))
    }
    userId = signUpResult.userId
  } else {
    userId = signInResult.userId!
  }

  // ─────────────────────────────────────────────────────────────────
  // Karena kita sekarang menggunakan Railway PostgreSQL (PostgresNativeClient),
  // kita tidak lagi dibatasi oleh RLS untuk operasi sistemis seperti ini.
  // Gunakan adminClient yang mengakses DB langsung.
  // ─────────────────────────────────────────────────────────────────
  const authedClient = adminClient as any

  // 2. Delete ALL previous demo orgs for this user — always start fresh
  const { data: existingMemberships } = await authedClient
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)

  if (existingMemberships && existingMemberships.length > 0) {
    for (const m of existingMemberships) {
      await authedClient.from('organizations').delete().eq('id', m.org_id)
    }
  }

  // 3. Create fresh demo organization
  const orgId = crypto.randomUUID()
  const defaultNames: Record<DemoBusinessType, string> = {
    'COMPUTER': 'NIZAM Computer Assembly',
    'CATERING': 'NIZAM Catering Sehat',
    'RESTAURANT': 'NIZAM Rumah Makan Mantap',
    'SUPPLIER_MBG': 'NIZAM MBG Supplier Hub',
    'BUS_OPERATOR': 'PO Bintang Marwah',
    'BLANK': 'NIZAM Baru (Kosongan)'
  }
  const orgName = businessName || defaultNames[demoType]

  const { error: orgErr } = await authedClient
    .from('organizations')
    .insert({
      id: orgId,
      name: orgName,
      slug: 'demo-' + demoType.toLowerCase() + '-' + Date.now(),
      settings: {
        currency: 'IDR',
        timezone: 'Asia/Jakarta',
        fiscal_year_start_month: 1,
        plan: 'Demo', // Paket Demo: Full Access + Auto-Destroy saat logout
        is_demo: true,
        business_type: demoType,
        // Demo blank tetap butuh CoA agar contoh budgeting bisa langsung dipakai.
        skip_coa_seed: false,
      },
    })

  if (orgErr) {
    (console as any).error('Demo org creation failed:', orgErr)
    redirect('/login?error=' + encodeURIComponent('Gagal membuat organisasi demo.'))
  }

  // 4. Make demo user the owner (Include is_active explicitly to be safe)
  const { error: memberErr } = await (adminClient as any).from('org_members').insert({
    org_id: orgId,
    user_id: userId,
    role: 'owner',
    is_active: true
  })

  if (memberErr) {
    (console as any).error('Demo member creation failed:', memberErr)
    redirect('/login?error=' + encodeURIComponent('Gagal mendaftarkan anggota demo.'))
  }

  // 5. Seed sample data for demo using authed client (so RLS doesn't block inserts)
  const demoBranchId = await seedDemoData(authedClient, orgId, demoType)

  // 6. Set Demo Org ID in Cookie for session-specific tracking
  const cookieStore = await cookies()
  // Set nizam_active_org_id ke demo org baru agar getActiveOrg() tidak null
  // dan DashboardLayout tidak redirect ke /onboarding.
  cookieStore.set('nizam_active_org_id', orgId, {
    maxAge: DEMO_SESSION_MAX_AGE,
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
  })
  cookieStore.delete('nizam_active_branch_id')
  cookieStore.set('nizam_demo_org_id', orgId, { 
    maxAge: DEMO_SESSION_MAX_AGE, // 12 hours — demo session lifetime
    path: '/',
    httpOnly: true,
    sameSite: 'lax'
  })
  if (demoBranchId) {
    cookieStore.set('nizam_active_branch_id', demoBranchId, {
      maxAge: DEMO_SESSION_MAX_AGE,
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
  const supabase = await createClient()
  const demoSession = await getValidatedDemoSession()

  if (demoSession?.demoOrgId) {
    // Karena Railway dipakai, kita bisa langsung nge-delete lewat adminClient
    const authedClient = (await createAdminClient()) as any

    // Delete specifically THE session org (cascade delete removes all related data)
    const { error: delErr } = await authedClient.from('organizations').delete().eq('id', demoSession.demoOrgId)
    if (delErr) (console as any).error('SignOutDemo: Failed to delete org:', delErr)

    const isCanonicalDemoUser =
      demoSession.user.email === DEMO_EMAIL || Boolean(demoSession.user.user_metadata?.is_demo)

    // For the shared demo account, also clean up any leftover demo orgs.
    if (isCanonicalDemoUser) {
      const { data: remainingMemberships } = await authedClient
        .from('org_members')
        .select('org_id')
        .eq('user_id', demoSession.user.id)

      if (remainingMemberships) {
        for (const m of remainingMemberships as any[]) {
          if (!m?.org_id || m.org_id === demoSession.demoOrgId) continue
          const { data: orgRow } = await authedClient
            .from('organizations')
            .select('id, is_demo, settings')
            .eq('id', m.org_id)
            .maybeSingle()

          if (!isDemoOrganizationRecord(orgRow as { is_demo?: boolean | null; settings?: Record<string, unknown> | null } | null)) {
            continue
          }

          const { error: cleanupErr } = await authedClient.from('organizations').delete().eq('id', m.org_id)
          if (cleanupErr) (console as any).error('SignOutDemo: Cleanup delete failed for org', m.org_id, cleanupErr)
        }
      }
    }
  }

  // Clear ALL demo + active org cookies
  cookieStore.delete('nizam_demo_org_id')
  cookieStore.delete('nizam_active_org_id')
  cookieStore.delete('nizam_active_branch_id')

  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}

/**
 * Check if current session is an active demo account.
 * A demo session is considered active only if:
 * 1. The authenticated user is the demo account, AND
 * 2. The demo org cookie is still present (i.e. not expired yet).
 * When the 12-hour cookie expires, this returns false and the
 * DashboardLayout will redirect the user out of the dashboard.
 */
export async function isDemoSession(): Promise<boolean> {
  // If the demo cookie has expired or no longer points to a live demo org
  // owned by the current user, the session is over.
  return Boolean(await getValidatedDemoSession())
}

// ═══════════════════════════════════════════════════════════
// SEED DEMO DATA — Products, Warehouses, Contacts, etc.
// ═══════════════════════════════════════════════════════════
async function ensureDemoBranch(supabase: any, orgId: string) {
  const { data: existingBranch } = await supabase
    .from('branches')
    .select('id')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (existingBranch?.id) return existingBranch.id as string

  const { data: branch } = await supabase
    .from('branches')
    .insert({
      id: crypto.randomUUID(),
      org_id: orgId,
      name: 'Unit Utama',
      code: 'MAIN',
      is_active: true,
    })
    .select('id')
    .single()

  return branch?.id ? String(branch.id) : null
}

function getCurrentBudgetPeriod() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')

  return `${year}-${month}-01`
}

async function waitForDemoAccounts(supabase: any, orgId: string): Promise<DemoSeedAccount[]> {
  let accounts: DemoSeedAccount[] = []

  for (let attempt = 0; attempt < DEMO_ACCOUNT_WAIT_RETRIES; attempt += 1) {
    const { data } = await supabase
      .from('accounts')
      .select('id, code')
      .eq('org_id', orgId)

    if (data && data.length > 20) {
      accounts = data as DemoSeedAccount[]
      break
    }

    await new Promise((resolve) => setTimeout(resolve, DEMO_ACCOUNT_WAIT_MS))
  }

  return accounts
}

async function seedBlankDemoBudgeting(supabase: any, orgId: string, branchId: string) {
  const accounts = await waitForDemoAccounts(supabase, orgId)

  if (accounts.length === 0) {
    ;(console as any).warn('Blank demo budgeting seed skipped: CoA accounts are not ready yet.', { orgId })
    return
  }

  const period = getCurrentBudgetPeriod()
  const { data: existingBudgets } = await supabase
    .from('budgets')
    .select('account_id')
    .eq('org_id', orgId)
    .eq('branch_id', branchId)
    .eq('period', period)

  const existingAccountIds = new Set(
    ((existingBudgets ?? []) as Array<{ account_id?: string | null }>)
      .map((row) => String(row.account_id || '').trim())
      .filter(Boolean)
  )

  const budgetRows = BLANK_DEMO_BUDGET_TEMPLATES
    .map(({ code, budgetAmount }) => {
      const accountId = accounts.find((account) => account.code === code)?.id
      if (!accountId || existingAccountIds.has(accountId)) return null

      return {
        org_id: orgId,
        branch_id: branchId,
        account_id: accountId,
        period,
        budget_amount: Number(budgetAmount),
        updated_at: new Date().toISOString(),
      }
    })
    .filter((row): row is {
      org_id: string
      branch_id: string
      account_id: string
      period: string
      budget_amount: number
      updated_at: string
    } => row !== null)

  if (budgetRows.length === 0) {
    ;(console as any).warn('Blank demo budgeting seed skipped: no budgetable demo accounts matched.', { orgId })
    return
  }

  const { error } = await supabase.from('budgets').insert(budgetRows)
  if (error) {
    ;(console as any).warn('Blank demo budgeting seed failed.', error)
  }
}

export async function ensureBlankDemoBudgetingSetup(orgId: string, preferredBranchId?: string | null) {
  const trimmedOrgId = String(orgId || '').trim()
  if (!trimmedOrgId) return { branchId: null, didSeed: false }

  const supabase = await createClient()
  const { data: orgRow } = await (supabase as any)
    .from('organizations')
    .select('is_demo, settings')
    .eq('id', trimmedOrgId)
    .maybeSingle()

  const settings = (orgRow?.settings ?? {}) as Record<string, unknown>
  const businessType = String(settings.business_type || '').trim().toUpperCase()
  // Sumber kebenaran utama = organizations.is_demo (kolom DB).
  // planName === 'demo' DIHAPUS — nama plan bukan penentu apakah org adalah demo.
  const isDemoOrg =
    Boolean(orgRow?.is_demo) ||
    settings.is_demo === true

  if (!isDemoOrg || businessType !== 'BLANK') {
    return { branchId: null, didSeed: false }
  }

  const normalizedBranchId = String(preferredBranchId || '').trim()
  const branchId = normalizedBranchId || await ensureDemoBranch(supabase, trimmedOrgId)
  if (!branchId) return { branchId: null, didSeed: false }

  const coaResult = await seedInitialCoA(trimmedOrgId, { revalidate: false })
  if (coaResult && typeof coaResult === 'object' && 'error' in coaResult) {
    const message = String(coaResult.error || '')
    if (message && !/sudah aktif/i.test(message)) {
      ;(console as any).warn('Blank demo CoA self-heal warning:', message)
    }
  }

  await seedBlankDemoBudgeting(supabase, trimmedOrgId, branchId)
  return { branchId, didSeed: true }
}

export async function seedDemoData(supabase: any, orgId: string, demoType: DemoBusinessType) {
  const branchId = await ensureDemoBranch(supabase, orgId)
  if (!branchId) return null

  // Blank demo tetap minim data operasional, tetapi punya CoA + budget contoh.
  if (demoType === 'BLANK') {
    await seedBlankDemoBudgeting(supabase, orgId, branchId)
    return branchId
  }

  // PO Bus: seed armada, crew, rute, pool, tiket, dan integrasi aset tetap.
  if (demoType === 'BUS_OPERATOR') {
    await seedDemoBusData(supabase, orgId, branchId)
    return branchId
  }

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

  const accounts = await waitForDemoAccounts(supabase, orgId)

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
    average_cost: p.purchase_price // Ensure average_cost is set for audit consistency
  }))

  await supabase.from('warehouses').insert(warehousesData)
  await supabase.from('contacts').insert(contactsData)
  await supabase.from('products').insert(finalProducts)

  const wh1Id = warehousesData[0].id
  
  // --- INITIAL STOCK & JOURNAL ENTRY (Double Entry Accounting) ---
  const stockItems = finalProducts.filter((p: any) => p.type === 'INVENTORY').map((p: any) => ({
    org_id: orgId,
    product_id: p.id,
    warehouse_id: wh1Id,
    quantity: 50 
  }))

  if (stockItems.length > 0 && invAccId && capitalAccId) {
    // 1. Physical Stocks
    await supabase.from('inventory_stocks').insert(stockItems)

    // 2. Journal Entry (Ledger) for Financial Visibility
    const totalValue = stockItems.reduce((sum: any, s: any) => {
      const p = finalProducts.find((prod: any) => prod.id === s.product_id)
      return sum + (s.quantity * (p?.purchase_price || 0))
    }, 0)

    const { data: entry, error: entErr } = await supabase.from('journal_entries').insert({
      org_id: orgId,
      branch_id: branchId,
      entry_date: new Date().toISOString().split('T')[0],
      description: 'Saldo Awal Persediaan (Demo Seed)',
      status: 'DRAFT', // MUST START AS DRAFT TO ALLOW LINE INSERTION
      is_auto: true
    }).select().single()

    if (entry && !entErr) {
      // Create Journal Lines
      await supabase.from('journal_lines').insert([
        { entry_id: entry.id, account_id: invAccId, debit: totalValue, credit: 0, memo: 'Persediaan Awal' },
        { entry_id: entry.id, account_id: capitalAccId, debit: 0, credit: totalValue, memo: 'Modal Awal (Inventory)' }
      ])

      // NOW POST THE ENTRY
      await supabase.from('journal_entries').update({ status: 'POSTED' }).eq('id', entry.id)

      // 3. Stock Movements (Sub-Ledger) - Link to Journal Entry
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

      await supabase.from('stock_movements').insert(movements)
    }
  }

  // --- INITIAL CASH & BANK INJECTION (For Balanced Balance Sheet) ---
  if (cashAccId && bankAccId && capitalAccId) {
    const cashInject = 500000000 // 500jt Kas
    const bankInject = 1500000000 // 1.5M Bank
    const totalCapital = cashInject + bankInject

    const { data: cashEntry, error: cashEntErr } = await supabase.from('journal_entries').insert({
      org_id: orgId,
      branch_id: branchId,
      entry_date: new Date().toISOString().split('T')[0],
      description: 'Setoran Modal Awal (Cash & Bank Injection)',
      status: 'DRAFT', // MUST START AS DRAFT
      is_auto: true
    }).select().single()

    if (cashEntry && !cashEntErr) {
      await supabase.from('journal_lines').insert([
        { entry_id: cashEntry.id, account_id: cashAccId, debit: cashInject, credit: 0, memo: 'Setoran Modal (Kas Utama)' },
        { entry_id: cashEntry.id, account_id: bankAccId, debit: bankInject, credit: 0, memo: 'Setoran Modal (Bank)' },
        { entry_id: cashEntry.id, account_id: capitalAccId, debit: 0, credit: totalCapital, memo: 'Modal Disetor' }
      ])

      // NOW POST THE ENTRY
      await supabase.from('journal_entries').update({ status: 'POSTED' }).eq('id', cashEntry.id)
    }
  }

  return branchId
}

// ─── SEED DATA: PO BUS OPERATOR ───────────────────────────────────────────────

async function seedDemoBusData(supabase: any, orgId: string, branchId: string) {
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

  // ── 1. Bus Units ──────────────────────────────────────────────────────────
  const busIds = { b1: crypto.randomUUID(), b2: crypto.randomUUID(), b3: crypto.randomUUID() }
  const busUnits = [
    {
      id: busIds.b1, org_id: orgId, branch_id: branchId,
      plate_number: 'B 7821 KAA', brand: 'Hino', model: 'RG 100', year: 2022,
      capacity: 50, body_type: 'Patas', color: 'Biru Putih',
      engine_number: 'J08E-TM123456', chassis_number: 'MJEPK8JK5NFF00001',
      status: 'TERSEDIA', odometer: 42500,
      purchase_price: 650000000, purchase_date: '2022-03-15',
      notes: 'Armada unggulan trayek Jakarta–Bandung',
    },
    {
      id: busIds.b2, org_id: orgId, branch_id: branchId,
      plate_number: 'B 9143 KAB', brand: 'Mercedes-Benz', model: 'OH 1626', year: 2021,
      capacity: 44, body_type: 'Executive', color: 'Putih Merah',
      engine_number: 'OM926LA-987654', chassis_number: 'WDB9341761L654321',
      status: 'BEROPERASI', odometer: 78200,
      purchase_price: 850000000, purchase_date: '2021-07-20',
      notes: 'Armada kelas eksekutif trayek Jakarta–Surabaya',
    },
    {
      id: busIds.b3, org_id: orgId, branch_id: branchId,
      plate_number: 'Z 1567 KAC', brand: 'Hino', model: 'RN 285', year: 2020,
      capacity: 48, body_type: 'Patas AC', color: 'Merah Putih',
      engine_number: 'E13C-VK000111', chassis_number: 'MJEPK8JK4LFF09999',
      status: 'SERVIS', odometer: 113000,
      purchase_price: 580000000, purchase_date: '2020-01-10',
      notes: 'Sedang perawatan rutin — ganti oli mesin',
    },
  ]
  await supabase.from('bus_units').insert(busUnits)

  // ── 2. Auto-register Fixed Assets (integrasi Accounting) ─────────────────
  const fixedAssetIds: Record<string, string> = {}
  const fixedAssetsData = busUnits.map(b => ({
    id: crypto.randomUUID(),
    org_id: orgId, branch_id: branchId,
    code: `BUS-${b.plate_number.replace(/\s+/g, '').toUpperCase()}`,
    name: `Bus ${b.brand} ${b.model} — ${b.plate_number.toUpperCase()}`,
    category: 'Kendaraan',
    purchase_date: b.purchase_date,
    purchase_price: b.purchase_price,
    salvage_value: Math.round(b.purchase_price * 0.1),
    useful_life_months: 120, // 10 tahun
    depreciation_method: 'STRAIGHT_LINE',
    accumulated_depreciation: 0,
    current_book_value: b.purchase_price,
    status: b.status === 'TIDAK_AKTIF' ? 'DISPOSED' : 'ACTIVE',
  }))

  const { data: insertedAssets } = await supabase
    .from('fixed_assets').insert(fixedAssetsData).select('id, code')

  if (insertedAssets) {
    for (let i = 0; i < busUnits.length; i++) {
      fixedAssetIds[busUnits[i].id] = fixedAssetsData[i].id
      await supabase.from('bus_units')
        .update({ fixed_asset_id: fixedAssetsData[i].id })
        .eq('id', busUnits[i].id)
    }
  }

  // ── 3. Bus Crew ───────────────────────────────────────────────────────────
  const crewIds = {
    d1: crypto.randomUUID(), d2: crypto.randomUUID(), cd1: crypto.randomUUID(),
    k1: crypto.randomUUID(), k2: crypto.randomUUID(),
  }
  await supabase.from('bus_crew').insert([
    { id: crewIds.d1, org_id: orgId, branch_id: branchId, name: 'Agus Salim', role: 'DRIVER', phone: '08123-4567-890', nik: '3201010101800001', license_number: 'SIM-B2-AGS-2020', license_expiry: '2026-12-31', blood_type: 'O', join_date: '2018-04-01', is_active: true },
    { id: crewIds.d2, org_id: orgId, branch_id: branchId, name: 'Dedi Mulyadi', role: 'DRIVER', phone: '08212-3456-789', nik: '3201010202750002', license_number: 'SIM-B2-DDM-2021', license_expiry: '2027-06-30', blood_type: 'A', join_date: '2020-01-15', is_active: true },
    { id: crewIds.cd1, org_id: orgId, branch_id: branchId, name: 'Rian Pratama', role: 'CO_DRIVER', phone: '08567-8901-234', nik: '3201010303850003', join_date: '2021-09-01', is_active: true },
    { id: crewIds.k1, org_id: orgId, branch_id: branchId, name: 'Slamet Riyadi', role: 'KERNET', phone: '08345-6789-012', nik: '3201010404900004', join_date: '2022-02-01', is_active: true },
    { id: crewIds.k2, org_id: orgId, branch_id: branchId, name: 'Wahyu Nugroho', role: 'KERNET', phone: '08456-7890-123', nik: '3201010505950005', join_date: '2023-06-01', is_active: true },
  ])

  // ── 4. Mechanics ──────────────────────────────────────────────────────────
  const mechId = crypto.randomUUID()
  await supabase.from('bus_mechanics').insert([
    { id: mechId, org_id: orgId, branch_id: branchId, name: 'Bambang Supriadi', phone: '08111-2233-445', specialization: 'Mesin Diesel & Transmisi', is_active: true },
    { org_id: orgId, branch_id: branchId, name: 'Cv. Karya Teknik Motor (Mitra)', phone: '0251-889900', specialization: 'Elektrikal & AC', is_active: true },
  ])

  // ── 5. Routes ─────────────────────────────────────────────────────────────
  const routeIds = { r1: crypto.randomUUID(), r2: crypto.randomUUID(), r3: crypto.randomUUID() }
  await supabase.from('bus_routes').insert([
    { id: routeIds.r1, org_id: orgId, branch_id: branchId, name: 'Jakarta — Bandung', origin: 'Jakarta (Kampung Rambutan)', destination: 'Bandung (Leuwipanjang)', distance_km: 148, duration_hours: 3, base_price: 125000, is_active: true },
    { id: routeIds.r2, org_id: orgId, branch_id: branchId, name: 'Jakarta — Surabaya', origin: 'Jakarta (Pulogadung)', destination: 'Surabaya (Bungurasih)', distance_km: 724, duration_hours: 12, base_price: 350000, is_active: true },
    { id: routeIds.r3, org_id: orgId, branch_id: branchId, name: 'Bandung — Yogyakarta', origin: 'Bandung (Leuwipanjang)', destination: 'Yogyakarta (Giwangan)', distance_km: 440, duration_hours: 9, base_price: 250000, is_active: true },
  ])

  // ── 6. Pools ──────────────────────────────────────────────────────────────
  const poolIds = { p1: crypto.randomUUID(), p2: crypto.randomUUID() }
  await supabase.from('bus_pools').insert([
    {
      id: poolIds.p1, org_id: orgId, branch_id: branchId,
      code: 'BM-JKT-01', name: 'Pool Utama Jakarta', pool_type: 'POOL_UTAMA',
      owner_name: 'PT Bintang Marwah Transport', pic_name: 'Hendra Kusuma',
      phone: '021-8765432', whatsapp: '08119876543', email: 'pool.jakarta@bintangmarwah.id',
      address: 'Jl. Raya Bogor KM 22, Ciracas', city: 'Jakarta Timur', province: 'DKI Jakarta',
      commission_pct: 0, deposit_balance: 0, credit_limit: 0,
      bank_name: 'Bank Mandiri', bank_account: '123-456-7890', bank_account_name: 'PT Bintang Marwah Transport',
      is_active: true,
    },
    {
      id: poolIds.p2, org_id: orgId, branch_id: branchId,
      code: 'BM-BDG-01', name: 'Agen Resmi Bandung Jaya', pool_type: 'AGEN_RESMI',
      owner_name: 'Sunardi', pic_name: 'Lina Kartika',
      phone: '022-4512345', whatsapp: '08561234567', email: 'bandungjaya.tiket@gmail.com',
      address: 'Jl. Sudirman No. 88, Pasir Kaliki', city: 'Bandung', province: 'Jawa Barat',
      commission_pct: 5, deposit_balance: 15000000, credit_limit: 5000000,
      bank_name: 'BCA', bank_account: '456-7890-123', bank_account_name: 'Sunardi',
      is_active: true,
    },
  ])

  // Seed pool top-up untuk Bandung Jaya
  await supabase.from('bus_pool_top_ups').insert([
    { org_id: orgId, pool_id: poolIds.p2, amount: 15000000, payment_method: 'TRANSFER', reference_no: 'TRF-2024-0601', notes: 'Deposit awal kerjasama' },
  ])

  // ── 7. Agents ─────────────────────────────────────────────────────────────
  const agentIds = { a1: crypto.randomUUID(), a2: crypto.randomUUID() }
  await supabase.from('bus_agents').insert([
    { id: agentIds.a1, org_id: orgId, branch_id: branchId, pool_id: poolIds.p2, name: 'Toko Tiket Maju Jaya', phone: '022-7654321', email: 'majujaya.tiket@gmail.com', city: 'Bandung', commission_pct: 3, is_active: true },
    { id: agentIds.a2, org_id: orgId, branch_id: branchId, pool_id: null, name: 'CV Tiket Online Nusantara', phone: '08777-1234-567', email: 'tiket@nusantara.id', city: 'Jakarta', commission_pct: 4, is_active: true },
  ])

  // ── 8. Checkpoints ────────────────────────────────────────────────────────
  await supabase.from('bus_checkpoints').insert([
    { org_id: orgId, branch_id: branchId, name: 'Terminal Kampung Rambutan', location_name: 'Jl. TB Simatupang, Jakarta Timur', gps_coords: '-6.3270,106.8836', is_active: true },
    { org_id: orgId, branch_id: branchId, name: 'Rest Area KM 57 Cipularang', location_name: 'Tol Cipularang KM 57', gps_coords: '-6.7502,107.3619', is_active: true },
    { org_id: orgId, branch_id: branchId, name: 'Terminal Leuwipanjang', location_name: 'Jl. Leuwipanjang, Bandung', gps_coords: '-6.9669,107.5897', is_active: true },
    { org_id: orgId, branch_id: branchId, name: 'Terminal Tirtonadi Solo', location_name: 'Jl. Ahmad Yani No. 262, Surakarta', gps_coords: '-7.5559,110.8243', is_active: true },
  ])

  // ── 9. Schedules ──────────────────────────────────────────────────────────
  const schedIds = { s1: crypto.randomUUID(), s2: crypto.randomUUID(), s3: crypto.randomUUID() }
  const dep1 = new Date(today + 'T08:00:00').toISOString()
  const dep2 = new Date(today + 'T20:00:00').toISOString()
  const dep3 = new Date(nextWeek + 'T07:00:00').toISOString()
  await supabase.from('bus_schedules').insert([
    { id: schedIds.s1, org_id: orgId, branch_id: branchId, route_id: routeIds.r1, bus_id: busIds.b1, driver_id: crewIds.d1, helper_id: crewIds.k1, departure_time: dep1, arrival_time: new Date(new Date(dep1).getTime() + 3 * 3600000).toISOString(), status: 'TERJADWAL', notes: 'Pemberangkatan pagi reguler' },
    { id: schedIds.s2, org_id: orgId, branch_id: branchId, route_id: routeIds.r2, bus_id: busIds.b2, driver_id: crewIds.d2, helper_id: crewIds.k2, departure_time: dep2, arrival_time: new Date(new Date(dep2).getTime() + 12 * 3600000).toISOString(), status: 'BERANGKAT', notes: 'Bus sudah berangkat pukul 20.00' },
    { id: schedIds.s3, org_id: orgId, branch_id: branchId, route_id: routeIds.r1, bus_id: busIds.b1, driver_id: crewIds.d1, helper_id: crewIds.k1, departure_time: dep3, arrival_time: new Date(new Date(dep3).getTime() + 3 * 3600000).toISOString(), status: 'TERJADWAL' },
  ])

  // ── 10. Tickets ───────────────────────────────────────────────────────────
  const passengerNames = ['Budi Santoso', 'Dewi Rahayu', 'Eko Prasetyo', 'Fitria Wulandari', 'Guntur Setiawan', 'Hana Pertiwi', 'Irfan Maulana', 'Joko Widodo']
  const ticketData = passengerNames.slice(0, 5).map((name, i) => ({
    org_id: orgId, branch_id: branchId,
    schedule_id: schedIds.s1,
    agent_id: i < 2 ? agentIds.a1 : i < 4 ? agentIds.a2 : null,
    pool_id: i < 2 ? poolIds.p2 : null,
    passenger_name: name,
    passenger_phone: `0812-${String(i + 1).padStart(4, '0')}-${String(i * 1234).padStart(4, '0')}`,
    seat_number: String(i + 1),
    price: 125000,
    status: i < 3 ? 'DIBAYAR' : 'DIPESAN',
  }))
  // Tiket untuk jadwal yang sudah berangkat
  const ticketData2 = passengerNames.slice(0, 6).map((name, i) => ({
    org_id: orgId, branch_id: branchId,
    schedule_id: schedIds.s2,
    agent_id: i % 2 === 0 ? agentIds.a2 : null,
    pool_id: null,
    passenger_name: name,
    passenger_phone: `0813-${String(i + 10).padStart(4, '0')}-0000`,
    seat_number: String(i + 1),
    price: 350000,
    status: 'DIGUNAKAN',
  }))
  await supabase.from('bus_tickets').insert([...ticketData, ...ticketData2])

  // ── 11. Service Records ───────────────────────────────────────────────────
  await supabase.from('bus_service_records').insert([
    { org_id: orgId, branch_id: branchId, bus_id: busIds.b3, service_date: yesterday, description: 'Ganti oli mesin 10W-40, filter oli, filter udara', maintenance_type: 'ROUTINE', cost: 1250000, odometer_at: 113000, technician_name: 'Bambang Supriadi', next_service_km: 123000, next_service_date: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0] },
    { org_id: orgId, branch_id: branchId, bus_id: busIds.b1, service_date: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0], description: 'Pemeriksaan rem depan & belakang, kalibrasi', maintenance_type: 'PREVENTIVE', cost: 850000, odometer_at: 41200, technician_name: 'Bambang Supriadi', next_service_km: 52000 },
  ])

  // ── 12. Tire Records ──────────────────────────────────────────────────────
  await supabase.from('bus_tire_records').insert([
    { org_id: orgId, branch_id: branchId, bus_id: busIds.b1, position: 'FL', brand: 'Bridgestone', size: '295/80R22.5', installed_at: '2024-01-15', odometer_at: 35000, mileage_limit_km: 80000 },
    { org_id: orgId, branch_id: branchId, bus_id: busIds.b1, position: 'FR', brand: 'Bridgestone', size: '295/80R22.5', installed_at: '2024-01-15', odometer_at: 35000, mileage_limit_km: 80000 },
    { org_id: orgId, branch_id: branchId, bus_id: busIds.b2, position: 'FL', brand: 'Michelin', size: '295/80R22.5', installed_at: '2023-08-10', odometer_at: 61000, mileage_limit_km: 90000 },
  ])

  // ── 13. Emergency Call (satu log aktif) ───────────────────────────────────
  await supabase.from('bus_emergency_calls').insert([
    { org_id: orgId, branch_id: branchId, bus_id: busIds.b3, reporter_name: 'Slamet Riyadi (Kernet)', call_time: new Date(Date.now() - 3 * 3600000).toISOString(), location_description: 'Tol Cipularang KM 67+200 arah Bandung', location_gps: '-6.8201,107.4102', issue_type: 'MOGOK', description: 'Mesin overheat, tidak bisa dihidupkan kembali. Membutuhkan derek.', assigned_mechanic_id: mechId, status: 'DALAM_PROSES' },
  ])

  // ── 14. Pool Settlement (1 settlement terbayar) ───────────────────────────
  await supabase.from('bus_pool_settlements').insert([
    { org_id: orgId, pool_id: poolIds.p2, period_start: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0], period_end: yesterday, total_tickets: 18, total_revenue: 2250000, commission_pct: 5, commission_amount: 112500, payment_method: 'TRANSFER', reference_no: 'SET-2024-0531', status: 'DIBAYAR', paid_at: yesterday + 'T09:30:00+07:00', notes: 'Settlement komisi Mei 2024' },
  ])

  // ── 15. Accounting Integration: Journal Entry untuk Investasi Armada ──────
  const accounts = await waitForDemoAccounts(supabase, orgId)
  if (accounts && accounts.length > 0) {
    const capitalAccId = accounts?.find((a: any) => a.code === '3001')?.id
    const cashAccId = accounts?.find((a: any) => a.code === '1101')?.id
    const bankAccId = accounts?.find((a: any) => a.code === '1201')?.id
    // Cari akun Aset Tetap (kode 1601 atau 1501 tergantung COA seed)
    const fixedAssetAccId = accounts?.find((a: any) =>
      ['1601', '1501', '1600', '1500', '1701'].includes(a.code)
    )?.id

    // Modal operasional awal (kas + bank)
    if (cashAccId && bankAccId && capitalAccId) {
      const cashInject = 300000000   // 300jt kas operasional
      const bankInject = 2500000000  // 2.5M bank (modal armada)

      const { data: cashEntry } = await supabase.from('journal_entries').insert({
        org_id: orgId, branch_id: branchId,
        entry_date: today,
        description: 'Setoran Modal Awal Usaha — PO Bintang Marwah',
        status: 'DRAFT', is_auto: true,
      }).select().single()

      if (cashEntry) {
        await supabase.from('journal_lines').insert([
          { entry_id: cashEntry.id, account_id: cashAccId, debit: cashInject, credit: 0, memo: 'Kas Operasional Awal' },
          { entry_id: cashEntry.id, account_id: bankAccId, debit: bankInject, credit: 0, memo: 'Rekening Giro — Modal Armada' },
          { entry_id: cashEntry.id, account_id: capitalAccId, debit: 0, credit: cashInject + bankInject, memo: 'Modal Disetor Pemilik' },
        ])
        await supabase.from('journal_entries').update({ status: 'POSTED' }).eq('id', cashEntry.id)
      }
    }

    // Journal entry untuk perolehan aset tetap (armada bus)
    if (fixedAssetAccId && capitalAccId) {
      const totalFleetValue = busUnits.reduce((s, b) => s + b.purchase_price, 0)

      const { data: assetEntry } = await supabase.from('journal_entries').insert({
        org_id: orgId, branch_id: branchId,
        entry_date: today,
        description: 'Perolehan Armada Bus — Aset Tetap Kendaraan',
        status: 'DRAFT', is_auto: true,
      }).select().single()

      if (assetEntry) {
        const assetLines = busUnits.map(b => ({
          entry_id: assetEntry.id, account_id: fixedAssetAccId,
          debit: b.purchase_price, credit: 0,
          memo: `${b.brand} ${b.model} — ${b.plate_number}`,
        }))
        await supabase.from('journal_lines').insert([
          ...assetLines,
          { entry_id: assetEntry.id, account_id: capitalAccId, debit: 0, credit: totalFleetValue, memo: 'Modal Disetor — Armada Kendaraan' },
        ])
        await supabase.from('journal_entries').update({ status: 'POSTED' }).eq('id', assetEntry.id)
      }
    }
  }
}
