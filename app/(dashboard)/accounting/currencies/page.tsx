import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import { getOrgCurrencies, getAllowedCurrencies, getExchangeRates } from '@/modules/accounting/actions/currencies.actions'
import { POPULAR_CURRENCIES } from '@/lib/currency'
import CurrencyClient from '@/app/(dashboard)/accounting/currencies/CurrencyClient'

export const dynamic = 'force-dynamic'

export default async function CurrenciesPage() {
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const [settings, allowedCurrencies, exchangeRates] = await Promise.all([
    getOrgCurrencies(orgData.org.id),
    getAllowedCurrencies(orgData.org.id),
    getExchangeRates(orgData.org.id),
  ])

  return (
    <div className="p-10 min-h-screen bg-slate-50/20">
      <CurrencyClient
        orgId={orgData.org.id}
        settings={settings}
        allowedCurrencies={allowedCurrencies}
        exchangeRates={exchangeRates}
        popularCurrencies={POPULAR_CURRENCIES}
      />
    </div>
  )
}
