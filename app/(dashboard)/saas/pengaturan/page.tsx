import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { isPlatformAdminEmail } from '@/lib/saas/platform-admin'
import { redirect } from 'next/navigation'
import { getSaasModulePrices } from '@/modules/saas/actions/saas-settings.actions'
import { CORE_MODULES, OPERATIONAL_MODULES } from '@/modules/marketplace/lib/module-registry'
import { OPERATOR_GROWTH_ADDON_OPTIONS } from '@/lib/saas/operator-pricing'
import { SaasSettingsForm } from './SaasSettingsForm'

export const dynamic = 'force-dynamic'

export default async function SaasSettingsPage() {
  const orgData = await getActiveOrg()

  if (!orgData || !isPlatformAdminEmail(orgData.user?.email)) {
    redirect('/dashboard')
  }

  const currentPrices = await getSaasModulePrices()

  const defaultPrices = {
    corePrices: CORE_MODULES.reduce((acc, mod) => {
      acc[mod.key] = currentPrices.corePrices[mod.key] ?? 0
      return acc
    }, {} as Record<string, number>),
    operationalPrices: OPERATIONAL_MODULES.reduce((acc, mod) => {
      acc[mod.key] = currentPrices.operationalPrices[mod.key] ?? 0
      return acc
    }, {} as Record<string, number>),
    addonPrices: OPERATOR_GROWTH_ADDON_OPTIONS.reduce((acc, addon) => {
      // Fallback ke base price di code jika belum diset di db
      acc[addon.name] = currentPrices.addonPrices[addon.name] ?? addon.price ?? 0
      return acc
    }, {} as Record<string, number>),
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-black tracking-tight text-slate-900">Pengaturan Harga SaaS (Katalog)</h1>
        <p className="mt-1 text-sm font-medium text-slate-500">
          Kelola harga dasar per bulan untuk setiap Modul Inti, Modul Operasional, dan Add-on.
          Harga ini akan digunakan untuk menyusun penawaran dan tampil di Marketplace pelanggan.
        </p>
      </div>

      <SaasSettingsForm 
        initialPrices={defaultPrices} 
        coreModules={CORE_MODULES} 
        operationalModules={OPERATIONAL_MODULES} 
        addons={OPERATOR_GROWTH_ADDON_OPTIONS} 
      />
    </div>
  )
}
