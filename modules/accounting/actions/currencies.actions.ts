'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ═══════════════════════════════════════════════════════════════════════════
//  CURRENCY — Org Settings
// ═══════════════════════════════════════════════════════════════════════════

export async function getOrgCurrencies(orgId: string) {
  const supabase = await createClient()
  const db = supabase as any

  const { data: settings } = await db
    .from('org_currencies')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle()

  if (!settings) {
    const { data: created } = await db
      .from('org_currencies')
      .insert({ org_id: orgId, base_currency: 'IDR', decimal_places: 0 })
      .select()
      .maybeSingle()
    return created || { org_id: orgId, base_currency: 'IDR', decimal_places: 0 }
  }

  return settings
}

export async function updateOrgCurrency(orgId: string, input: Record<string, any>) {
  const supabase = await createClient()
  const db = supabase as any

  const { error } = await db
    .from('org_currencies')
    .upsert({ org_id: orgId, ...input, updated_at: new Date().toISOString() })

  if (error) return { error: error.message }
  revalidatePath('/accounting/currencies')
  return { success: true }
}

// ═══════════════════════════════════════════════════════════════════════════
//  CURRENCY — Allowed Currencies
// ═══════════════════════════════════════════════════════════════════════════

export async function getAllowedCurrencies(orgId: string) {
  const supabase = await createClient()
  const db = supabase as any

  const { data } = await db
    .from('org_allowed_currencies')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('currency_code')

  return data || []
}

export async function addAllowedCurrency(orgId: string, currencyCode: string) {
  const supabase = await createClient()
  const db = supabase as any

  const { error } = await db
    .from('org_allowed_currencies')
    .upsert({ org_id: orgId, currency_code: currencyCode.toUpperCase(), is_active: true })

  if (error) return { error: error.message }
  revalidatePath('/accounting/currencies')
  return { success: true }
}

export async function removeAllowedCurrency(orgId: string, currencyCode: string) {
  const supabase = await createClient()
  const db = supabase as any

  const { error } = await db
    .from('org_allowed_currencies')
    .update({ is_active: false })
    .eq('org_id', orgId)
    .eq('currency_code', currencyCode.toUpperCase())

  if (error) return { error: error.message }
  revalidatePath('/accounting/currencies')
  return { success: true }
}

// ═══════════════════════════════════════════════════════════════════════════
//  EXCHANGE RATES
// ═══════════════════════════════════════════════════════════════════════════

export async function getExchangeRates(orgId: string) {
  const supabase = await createClient()
  const db = supabase as any

  // Get latest rate for each currency
  const { data: settings } = await db
    .from('org_currencies')
    .select('base_currency')
    .eq('org_id', orgId)
    .maybeSingle()

  const baseCurrency = settings?.base_currency || 'IDR'

  const { data: allRates } = await db
    .from('exchange_rates')
    .select('*')
    .eq('org_id', orgId)
    .eq('to_currency', baseCurrency)
    .order('rate_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100)

  // Group by currency, get latest per currency
  const latestPerCurrency = new Map<string, any>()
  const ratesByCurrency = new Map<string, any[]>()

  for (const rate of allRates || []) {
    if (!latestPerCurrency.has(rate.from_currency)) {
      latestPerCurrency.set(rate.from_currency, rate)
    }
    const arr = ratesByCurrency.get(rate.from_currency) || []
    arr.push(rate)
    ratesByCurrency.set(rate.from_currency, arr)
  }

  return {
    baseCurrency,
    latestRates: Array.from(latestPerCurrency.values()),
    ratesByCurrency: Array.from(ratesByCurrency.entries()).map(([code, rates]) => ({ currency: code, rates })),
  }
}

export async function upsertExchangeRate(
  orgId: string,
  fromCurrency: string,
  rate: number,
  rateDate?: string
) {
  const supabase = await createClient()
  const db = supabase as any

  const { data: settings } = await db
    .from('org_currencies')
    .select('base_currency')
    .eq('org_id', orgId)
    .maybeSingle()

  const toCurrency = settings?.base_currency || 'IDR'
  const date = rateDate || new Date().toISOString().split('T')[0]

  const { error } = await db
    .from('exchange_rates')
    .upsert({
      org_id: orgId,
      from_currency: fromCurrency.toUpperCase(),
      to_currency: toCurrency,
      rate,
      rate_date: date,
      source: 'MANUAL',
    })

  if (error) return { error: error.message }
  revalidatePath('/accounting/currencies')
  return { success: true }
}

export async function deleteExchangeRate(rateId: string) {
  const supabase = await createClient()
  const db = supabase as any

  const { error } = await db
    .from('exchange_rates')
    .delete()
    .eq('id', rateId)

  if (error) return { error: error.message }
  revalidatePath('/accounting/currencies')
  return { success: true }
}

// ═══════════════════════════════════════════════════════════════════════════
//  CURRENCY — Formatters & Converters
// ═══════════════════════════════════════════════════════════════════════════

export async function convertAmount(
  orgId: string,
  amount: number,
  fromCurrency: string,
  rateDate?: string
) {
  const supabase = await createClient()
  const db = supabase as any

  if (!fromCurrency || fromCurrency === 'IDR') return { original: amount, converted: amount, rate: 1 }

  const date = rateDate || new Date().toISOString().split('T')[0]

  const { data: settings } = await db
    .from('org_currencies')
    .select('base_currency')
    .eq('org_id', orgId)
    .maybeSingle()

  const baseCurrency = settings?.base_currency || 'IDR'

  const { data: rateRow } = await db
    .from('exchange_rates')
    .select('rate')
    .eq('org_id', orgId)
    .eq('from_currency', fromCurrency.toUpperCase())
    .eq('to_currency', baseCurrency)
    .eq('rate_date', date)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const rate = rateRow?.rate || 1
  return {
    original: amount,
    converted: Math.round(amount * rate * 100) / 100,
    rate,
    fromCurrency: fromCurrency.toUpperCase(),
    toCurrency: baseCurrency,
  }
}
