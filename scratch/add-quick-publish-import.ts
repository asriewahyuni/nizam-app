import { writeFileSync, readFileSync } from 'fs'
const p = 'modules/ecommerce/components/CourseCommerceManager.tsx'
let c = readFileSync(p, 'utf-8')

const importStatement = `
  saveAccessPackageAction,
  saveProductEntitlementsAction,
  quickPublishStoreProductAction
`
c = c.replace('  saveAccessPackageAction,\n  saveProductEntitlementsAction,', importStatement)
writeFileSync(p, c)
