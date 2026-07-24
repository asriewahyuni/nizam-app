import { writeFileSync, readFileSync } from 'fs'
const p = 'app/(lms-internal)/lms/admin/penjualan/page.tsx'
let c = readFileSync(p, 'utf-8')

c = c.replace(
  "import CourseCommerceManager from '@/modules/ecommerce/components/CourseCommerceManager'",
  "import LmsSimpleSalesManager from './LmsSimpleSalesManager'"
)

c = c.replace(
  `        <CourseCommerceManager
          orgSlug={String(orgData.org.slug || orgData.org.id)}
          dashboardData={dashboardData}
          showContextSelector
        />`,
  `        <LmsSimpleSalesManager dashboardData={dashboardData} />`
)

writeFileSync(p, c)
