import { redirect } from 'next/navigation'
import { getProducts } from '@/modules/inventory/actions/inventory.actions'
import { getWarehouses } from '@/modules/inventory/actions/warehouse.actions'
import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getSalesPromos } from '@/modules/sales/actions/promo.actions'
import { buildEcommerceStorefrontView } from '@/modules/ecommerce/lib/ecommerce'
import EcommerceClient from './EcommerceClient'

export default async function EcommercePage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const activeBranch = await getActiveBranch(orgData.org.id)
  const [products, promos, warehouses] = await Promise.all([
    getProducts(orgData.org.id, activeBranch?.id),
    getSalesPromos(orgData.org.id),
    getWarehouses(orgData.org.id, activeBranch?.id),
  ])

  const storefront = buildEcommerceStorefrontView({
    org: {
      id: orgData.org.id,
      name: orgData.org.name,
      slug: orgData.org.slug || orgData.org.id,
      logo_url: orgData.org.logo_url,
    },
    products,
    promos,
  })

  return (
    <div className="p-10">
      <EcommerceClient
        activeBranchName={activeBranch?.name || null}
        storefront={storefront}
        warehouseCount={warehouses.length}
      />
    </div>
  )
}
