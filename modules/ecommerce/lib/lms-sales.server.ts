/**
 * Loader bertipe ketat untuk area Penjualan LMS.
 * Semua bagian memakai sumber data commerce yang sama tanpa membuat salinan data.
 */
import { cache } from 'react'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getConsultingAdminOverview } from '@/modules/consulting/lib/consulting.server'
import { getEcommerceDashboardData } from '@/modules/ecommerce/lib/ecommerce.server'
import { getLmsDomainAdminData } from '@/modules/ecommerce/domains/lms-domain.server'
import { getLmsBatches } from '@/modules/edu/actions/lms-commercial.actions'

const getLmsSalesWorkspace = cache(async () => {
  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) {
    throw new Error('Organisasi aktif tidak ditemukan.')
  }
  if (!['owner', 'admin', 'manager'].includes(String(orgData.role || '').toLowerCase())) {
    throw new Error('Anda tidak memiliki akses untuk mengelola penjualan LMS.')
  }

  const dashboard = await getEcommerceDashboardData()
  return {
    org: {
      id: orgData.org.id,
      slug: orgData.org.slug,
      name: orgData.org.name,
    },
    dashboard,
  }
})

export async function getLmsSalesHeaderData() {
  const { org, dashboard } = await getLmsSalesWorkspace()
  return {
    org,
    stores: dashboard.stores,
  }
}

export async function getLmsProductSalesData() {
  const { org, dashboard } = await getLmsSalesWorkspace()
  const domainData = await getLmsDomainAdminData()
  const batchRows = await getLmsBatches(org.id)
  const batches = batchRows.map((row) => ({
    id: String(row.id),
    courseId: String(row.course_id),
    name: String(row.name || ''),
    status: String(row.status || ''),
    quota: row.quota == null ? null : Number(row.quota),
  }))
  return {
    org,
    stores: dashboard.stores,
    products: dashboard.products,
    storeProducts: dashboard.storeProducts.filter(
      (product) => product.offeringType !== 'CONSULTING_1_ON_1',
    ),
    learningCourses: dashboard.learningCourses,
    accessPackages: dashboard.accessPackages,
    productEntitlements: dashboard.productEntitlements,
    batches,
    primaryLmsHostname: domainData.domains.find((domain) => (
      domain.isPrimary && domain.status === 'VERIFIED'
    ))?.hostname || null,
  }
}

export async function getLmsAccessPackageSalesData() {
  const { dashboard } = await getLmsSalesWorkspace()
  return {
    accessPackages: dashboard.accessPackages,
    learningCourses: dashboard.learningCourses,
  }
}

export async function getLmsCouponSalesData() {
  const { dashboard } = await getLmsSalesWorkspace()
  return {
    coupons: dashboard.coupons,
    storeProducts: dashboard.storeProducts,
  }
}

export async function getLmsConsultingSalesData() {
  const { org, dashboard } = await getLmsSalesWorkspace()
  const overview = await getConsultingAdminOverview(org.id)
  return {
    org,
    dashboard,
    overview,
  }
}

export async function getLmsSalesSummaryData() {
  const { org, dashboard } = await getLmsSalesWorkspace()
  const consulting = await getConsultingAdminOverview(org.id)
  return {
    org,
    dashboard,
    consulting,
  }
}

export async function getLmsStoreSettingsData(storeId?: string | null) {
  const { org, dashboard } = await getLmsSalesWorkspace()
  const selectedStore = (
    dashboard.stores.find((store) => store.id === storeId)
    || dashboard.stores[0]
    || null
  )
  const domainData = await getLmsDomainAdminData()

  return {
    org,
    dashboard,
    selectedStore,
    domains: domainData.domains,
    domainEvents: domainData.events,
    automation: domainData.automation,
  }
}
