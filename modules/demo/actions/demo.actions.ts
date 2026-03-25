'use server'

import { createClient } from '@/lib/supabase/server'
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

/**
 * Start a demo session:
 * 1. Sign in with demo credentials
 * 2. Delete any existing demo org (reset)
 * 3. Create fresh org with seed data
 * 4. Redirect to dashboard
 */
export async function startDemoSession(businessName?: string) {
  const supabase = await createClient()

  // 1. Sign up or sign in the demo user
  const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  })

  let userId: string
  let token: string

  if (signInErr) {
    // Demo user doesn't exist yet — create it
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      options: {
        data: { full_name: 'Demo User', is_demo: true }
      }
    })

    if (signUpErr || !signUpData.user) {
      console.error('Demo signup failed:', signUpErr)
      redirect('/login?error=' + encodeURIComponent('Gagal membuat akun demo. Coba lagi.'))
    }
    userId = signUpData.user.id
    token = signUpData.session?.access_token || ''
  } else {
    userId = signInData.user!.id
    token = signInData.session?.access_token || ''
  }

  // ─────────────────────────────────────────────────────────────────
  // CRITICAL FIX: Next.js Server Actions race condition.
  // The token is written to cookies, but it doesn't immediately propagate 
  // to RLS `auth.uid()` on the current server client instance.
  // We explicitly instantiate a client with the new Bearer token:
  const { createClient: createBrowserClient } = await import('@supabase/supabase-js')
  const authedClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  // ─────────────────────────────────────────────────────────────────

  // 2. Find and delete VERY OLD demo orgs for this user (older than 24 hours) as cleanup
  // but DON'T delete everything, just the ones that are stale.
  const { data: existingMemberships } = await authedClient
    .from('org_members')
    .select('org_id, joined_at')
    .eq('user_id', userId)

  if (existingMemberships && existingMemberships.length > 0) {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    for (const m of existingMemberships) {
      if (m.joined_at < twentyFourHoursAgo) {
        await authedClient.from('organizations').delete().eq('id', m.org_id)
      }
    }
  }

  // 3. Create fresh demo organization
  const orgId = crypto.randomUUID()
  const orgName = businessName || 'Demo Bisnis NIZAM'

  const { error: orgErr } = await authedClient
    .from('organizations')
    .insert({
      id: orgId,
      name: orgName,
      slug: 'demo-' + Date.now(),
      settings: {
        currency: 'IDR',
        timezone: 'Asia/Jakarta',
        fiscal_year_start_month: 1,
        is_demo: true,
      },
    })

  if (orgErr) {
    console.error('Demo org creation failed:', orgErr)
    redirect('/login?error=' + encodeURIComponent('Gagal membuat organisasi demo.'))
  }

  // 4. Make demo user the owner (Include is_active explicitly to be safe)
  const { error: memberErr } = await authedClient.from('org_members').insert({
    org_id: orgId,
    user_id: userId,
    role: 'owner',
    is_active: true
  })

  if (memberErr) {
    console.error('Demo member creation failed:', memberErr)
    redirect('/login?error=' + encodeURIComponent('Gagal mendaftarkan anggota demo.'))
  }

  // 5. Seed sample data for demo using authed client (so RLS doesn't block inserts)
  await seedDemoData(authedClient, orgId)

  // 6. Set Demo Org ID in Cookie for session-specific tracking
  const cookieStore = await cookies()
  cookieStore.set('nizam_demo_org_id', orgId, { 
    maxAge: 60 * 60 * 6, // 6 hours
    path: '/',
    httpOnly: true,
    sameSite: 'lax'
  })

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

/**
 * End demo session — delete everything and logout
 */
export async function signOutDemo() {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const demoOrgId = cookieStore.get('nizam_demo_org_id')?.value

  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // Check if this is the demo user
    const isDemoUser = user.email === DEMO_EMAIL || user.user_metadata?.is_demo

    if (isDemoUser) {
      if (demoOrgId) {
        // Delete specifically THE session org
        const { error: delErr } = await supabase.from('organizations').delete().eq('id', demoOrgId)
        if (delErr) console.error('SignOutDemo: Failed to delete org:', delErr)
      } else {
        // Fallback: Delete all orgs owned by demo user if no cookie (legacy)
        const { data: memberships } = await supabase
          .from('org_members')
          .select('org_id')
          .eq('user_id', user.id)

        if (memberships) {
          for (const m of memberships) {
            const { error: delErr } = await supabase.from('organizations').delete().eq('id', m.org_id)
            if (delErr) console.error('SignOutDemo: Fallback delete failed:', delErr)
          }
        }
      }
    }
  }

  // Clear demo org cookie
  cookieStore.delete('nizam_demo_org_id')

  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

/**
 * Check if current session is a demo account
 */
export async function isDemoSession(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  return user.email === DEMO_EMAIL || !!user.user_metadata?.is_demo
}

// ═══════════════════════════════════════════════════════════
// SEED DEMO DATA — Products, Warehouses, Contacts, etc.
// ═══════════════════════════════════════════════════════════
async function seedDemoData(supabase: any, orgId: string) {
  // --- WAREHOUSES ---
  const wh1Id = crypto.randomUUID()
  const wh2Id = crypto.randomUUID()

  await supabase.from('warehouses').insert([
    { id: wh1Id, org_id: orgId, name: 'Gudang Utama', code: 'GU-01', address: 'Jl. Industri No.1' },
    { id: wh2Id, org_id: orgId, name: 'Gudang Produksi', code: 'GP-01', address: 'Jl. Pabrik No.5' },
  ])

  // --- CONTACTS (Vendors & Customers) ---
  await supabase.from('contacts').insert([
    { org_id: orgId, name: 'PT Supplier Jaya', type: 'SUPPLIER', phone: '021-1234567', email: 'order@supplierjaya.com' },
    { org_id: orgId, name: 'CV Bahan Berkah', type: 'SUPPLIER', phone: '021-7654321', email: 'sales@bahanberkah.id' },
    { org_id: orgId, name: 'Toko Makmur', type: 'CUSTOMER', phone: '0812-9999-8888', email: 'makmur@email.com' },
    { org_id: orgId, name: 'PT Retail Nusantara', type: 'CUSTOMER', phone: '021-5556677', email: 'procurement@retailnusantara.id' },
  ])

  // --- PRODUCTS (Raw Materials + Finished Goods) ---
  const products = [
    { id: crypto.randomUUID(), org_id: orgId, name: 'Motherboard ASUS B660', sku: 'RM-MB-001', type: 'INVENTORY', unit: 'Pcs', purchase_price: 1850000, selling_price: 2200000 },
    { id: crypto.randomUUID(), org_id: orgId, name: 'RAM DDR5 16GB', sku: 'RM-RAM-001', type: 'INVENTORY', unit: 'Pcs', purchase_price: 750000, selling_price: 950000 },
    { id: crypto.randomUUID(), org_id: orgId, name: 'SSD NVMe 512GB', sku: 'RM-SSD-001', type: 'INVENTORY', unit: 'Pcs', purchase_price: 680000, selling_price: 850000 },
    { id: crypto.randomUUID(), org_id: orgId, name: 'Casing ATX Gaming', sku: 'RM-CSG-001', type: 'INVENTORY', unit: 'Pcs', purchase_price: 450000, selling_price: 600000 },
    { id: crypto.randomUUID(), org_id: orgId, name: 'PSU 650W 80+ Gold', sku: 'RM-PSU-001', type: 'INVENTORY', unit: 'Pcs', purchase_price: 920000, selling_price: 1200000 },
    { id: crypto.randomUUID(), org_id: orgId, name: 'PC Rakitan Custom Office', sku: 'FG-PC-001', type: 'INVENTORY', unit: 'Unit', purchase_price: 4650000, selling_price: 6500000 },
    { id: crypto.randomUUID(), org_id: orgId, name: 'Jasa Rakit & Instalasi OS', sku: 'SVC-RAKIT-001', type: 'SERVICE', unit: 'Unit', purchase_price: 0, selling_price: 350000 },
  ]

  await supabase.from('products').insert(products)

  // --- INITIAL STOCK (give some items starting inventory) ---
  const stockItems = [
    { org_id: orgId, product_id: products[0].id, warehouse_id: wh1Id, quantity: 10 },
    { org_id: orgId, product_id: products[1].id, warehouse_id: wh1Id, quantity: 20 },
    { org_id: orgId, product_id: products[2].id, warehouse_id: wh1Id, quantity: 15 },
    { org_id: orgId, product_id: products[3].id, warehouse_id: wh1Id, quantity: 8 },
    { org_id: orgId, product_id: products[4].id, warehouse_id: wh1Id, quantity: 12 },
  ]

  await supabase.from('inventory_stocks').insert(stockItems).then(() => {})

  // Seed stock_movements for accurate sub-ledger
  const movements = stockItems.map(s => ({
    org_id: orgId,
    product_id: s.product_id,
    movement_date: new Date().toISOString().split('T')[0],
    quantity: s.quantity,
    unit_price: products.find(p => p.id === s.product_id)?.purchase_price || 0,
    reference_type: 'INITIAL',
    reference_id: orgId,
    notes: 'Saldo awal demo'
  }))

  await supabase.from('stock_movements').insert(movements).then(() => {})
}
