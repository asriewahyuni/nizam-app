import nextEnv from '@next/env'
const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

async function run() {
  const { getSaasSalesForCommission } = await import('./modules/saas/actions/operator-sales.actions.ts')
  
  const orgId = 'f4455b6f-c7fc-4164-9732-a906bcce5e65'
  console.log(`Org ID: ${orgId}`)
  const sales = await getSaasSalesForCommission(orgId)
  console.log('Result length:', sales.length)
  console.log(JSON.stringify(sales, null, 2))
}

run().catch(console.error)
