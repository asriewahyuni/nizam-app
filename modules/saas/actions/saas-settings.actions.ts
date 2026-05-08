'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { isPlatformAdminEmail } from '@/lib/saas/platform-admin'

export async function getSaasModulePrices() {
  const supabase = await createClient()
  
  const { data } = await supabase
    .from('saas_packages')
    .select('operational_prices, core_prices, addon_prices')
    .order('price', { ascending: false })
    .limit(1)
    .single()

  return {
    operationalPrices: (data?.operational_prices as Record<string, number>) ?? {},
    corePrices: (data?.core_prices as Record<string, number>) ?? {},
    addonPrices: (data?.addon_prices as Record<string, number>) ?? {}
  }
}

export async function saveSaasModulePrices(prices: {
  operationalPrices: Record<string, number>
  corePrices: Record<string, number>
  addonPrices: Record<string, number>
}) {
  const orgData = await getActiveOrg()
  if (!orgData || !isPlatformAdminEmail(orgData.user?.email)) {
    throw new Error('Hanya Platform Admin yang dapat mengubah harga modul SaaS.')
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('saas_packages')
    .update({ 
      operational_prices: prices.operationalPrices,
      core_prices: prices.corePrices,
      addon_prices: prices.addonPrices
    })
    .neq('name', 'dummy_non_existent')

  if (error) {
    const { data: pkgs } = await supabase.from('saas_packages').select('id')
    if (pkgs) {
      for (const p of pkgs) {
        await supabase.from('saas_packages').update({ 
          operational_prices: prices.operationalPrices,
          core_prices: prices.corePrices,
          addon_prices: prices.addonPrices
        }).eq('id', p.id)
      }
    }
  }

  revalidatePath('/saas/pengaturan')
  revalidatePath('/marketplace')
  return { success: true }
}
