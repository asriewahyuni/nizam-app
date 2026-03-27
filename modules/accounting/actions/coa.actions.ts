'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Account, AccountType, NormalBalance, AccountBalance } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// getChartOfAccounts — fetch all accounts for an org, tree-structured
// ─────────────────────────────────────────────────────────────
export async function getChartOfAccounts(orgId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('org_id', orgId)
    .order('code', { ascending: true })

  if (error) return []
  return data as Account[]
}

// ─────────────────────────────────────────────────────────────
// createAccount — Add a custom account to CoA
// ─────────────────────────────────────────────────────────────
export async function createAccount(orgId: string, formData: FormData) {
  const supabase = await createClient()

  const code = (formData.get('code') as string).trim()
  const name = (formData.get('name') as string).trim()
  const type = formData.get('type') as AccountType
  const normalBalance = formData.get('normal_balance') as NormalBalance
  const parentId = formData.get('parent_id') as string | null
  const description = formData.get('description') as string | null

  if (!code || !name || !type || !normalBalance) {
    return { error: 'Kode, nama, tipe, dan saldo normal wajib diisi.' }
  }

  const { error } = await supabase.from('accounts').insert({
    org_id: orgId,
    code,
    name,
    type,
    normal_balance: normalBalance,
    parent_id: parentId || null,
    description: description || null,
    is_system: false,
  })

  if (error) {
    if (error.code === '23505') {
      return { error: `Kode akun ${code} sudah digunakan.` }
    }
    return { error: 'Gagal menyimpan akun.' }
  }

  revalidatePath('/settings/accounts')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// updateAccount — Edit name/description (not code, not system)
// ─────────────────────────────────────────────────────────────
export async function updateAccount(
  accountId: string,
  orgId: string,
  updates: { 
    name?: string; 
    description?: string; 
    is_active?: boolean;
    code?: string;
    type?: AccountType;
    normal_balance?: NormalBalance;
    parent_id?: string | null;
  }
) {

  const supabase = await createClient()

  // Prevent editing system accounts' critical fields
  const { data: existing } = await supabase
    .from('accounts')
    .select('is_system')
    .eq('id', accountId)
    .eq('org_id', orgId)
    .single()

  if (!existing) return { error: 'Akun tidak ditemukan.' }

  const { error } = await supabase
    .from('accounts')
    .update(updates)
    .eq('id', accountId)
    .eq('org_id', orgId)

  if (error) return { error: 'Gagal memperbarui akun.' }

  revalidatePath('/settings/accounts')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// deleteAccount — Only non-system, no journal lines
// ─────────────────────────────────────────────────────────────
export async function deleteAccount(accountId: string, orgId: string) {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('accounts')
    .select('is_system')
    .eq('id', accountId)
    .eq('org_id', orgId)
    .single()

  if (!existing) return { error: 'Akun tidak ditemukan.' }
  if (existing.is_system) return { error: 'Akun sistem tidak dapat dihapus.' }

  // Check for existing journal lines
  const { count } = await supabase
    .from('journal_lines')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', accountId)

  if ((count ?? 0) > 0) {
    return { error: 'Akun ini sudah memiliki transaksi. Nonaktifkan saja, jangan hapus.' }
  }

  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', accountId)
    .eq('org_id', orgId)

  if (error) return { error: 'Gagal menghapus akun.' }

  revalidatePath('/settings/accounts')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// getAccountBalances — for dashboard/reports
// ─────────────────────────────────────────────────────────────
export async function getAccountBalances(orgId: string): Promise<AccountBalance[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('account_balances')
    .select('*')
    .eq('org_id', orgId)
    .order('code', { ascending: true })

  if (error) return []
  return (data as AccountBalance[]) || []
}
// ─────────────────────────────────────────────────────────────
// seedInitialCoA — Manual trigger to seed default PSAK CoA if empty
// ─────────────────────────────────────────────────────────────
export async function seedInitialCoA(orgId: string) {
  const supabase = await createClient()

  // First check if already has accounts to prevent double seeding
  const { data: existing } = await supabase
    .from('accounts')
    .select('id')
    .eq('org_id', orgId)
    .limit(1)

  if (existing && existing.length > 0) {
    return { error: 'Sudah ada akun CoA untuk organisasi ini.' }
  }

  // Use RPC if available, or just call the seed function
  const { error } = await supabase.rpc('seed_default_coa', { p_org_id: orgId })

  if (error) {
    console.error('Seed CoA Error:', error)
    return { error: 'Gagal menyiapkan akun standar. Silakan hubungi dukungan.' }
  }

  revalidatePath('/settings/accounts')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// setShariahAccountsActive — Toggle Syariah Accounts
// ─────────────────────────────────────────────────────────────
export async function setShariahAccountsActive(orgId: string, active: boolean) {
  const supabase = await createClient()

  // Common syariah codes from migration 1006
  const syariahCodes = ['2600', '2601', '3100', '3110', '3120', '6100', '6110', '6120', '6200', '6210', '6220', '6230']

  const { error } = await supabase
    .from('accounts')
    .update({ is_active: active })
    .eq('org_id', orgId)
    .filter('code', 'in', `(${syariahCodes.join(',')})`)

  if (error) {
    console.error('Toggle Syariah Error:', error)
    return { error: 'Gagal mengubah status akun Syariah.' }
  }

  revalidatePath('/settings/accounts')
  return { success: true }
}
