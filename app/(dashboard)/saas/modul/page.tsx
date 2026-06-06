import { getSaasCustomModules } from '@/modules/saas/actions/module-catalog.actions'
import { ModulCatalogClient } from './ModulCatalogClient'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function SaasModulPage() {
  const modules = await getSaasCustomModules()
  return <ModulCatalogClient modules={modules} />
}
