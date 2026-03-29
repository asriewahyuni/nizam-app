'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * processBankCSV
 * Takes raw CSV string and parses it into bank_mutations.
 * Simple parser for now: [date, description, amount, type, balance]
 */
export async function processBankCSV(orgId: string, bankAccountId: string, csvContent: string) {
  const supabase = await createClient()

  // Simple CSV parser (assuming comma-separated, skip header)
  const lines = csvContent.split('\n').filter((line: any) => line.trim() !== '')
  const mutations = []

  // Skip header if it exists (check if first line has 'date' or non-numeric first col)
  const startIndex = isNaN(Date.parse(lines[0].split(',')[0])) ? 1 : 0

  for (let i = startIndex; i < lines.length; i++) {
    const cols = lines[i].split(',')
    if (cols.length < 3) continue

    const dateStr = cols[0].trim()
    const description = cols[1].trim()
    const amount = parseFloat(cols[2].trim())
    const type = cols[3]?.trim().toUpperCase() === 'IN' || amount > 0 ? 'IN' : 'OUT'
    const balance = cols[4] ? parseFloat(cols[4].trim()) : null

    mutations.push({
      org_id: orgId,
      bank_account_id: bankAccountId,
      mutation_date: new Date(dateStr).toISOString().split('T')[0],
      description,
      amount: Math.abs(amount),
      type,
      balance,
      is_matched: false
    })
  }

  if (mutations.length === 0) return { error: 'Format CSV tidak valid atau kosong.' }

  const { error } = await (supabase as any).from('bank_mutations').insert(mutations)
  if (error) return { error: 'Gagal mengunggah mutasi: ' + error.message }

  revalidatePath('/cash')
  return { success: true, count: mutations.length }
}

/**
 * getUnmatchedMutations
 */
export async function getUnmatchedMutations(orgId: string, bankAccountId?: string) {
  const supabase = await createClient()

  let query = (supabase as any).from('bank_mutations').select('*').eq('org_id', orgId).eq('is_matched', false)
  if (bankAccountId) query = query.eq('bank_account_id', bankAccountId)

  const { data, error } = await query.order('mutation_date', { ascending: false })
  if (error) return []
  return data
}
