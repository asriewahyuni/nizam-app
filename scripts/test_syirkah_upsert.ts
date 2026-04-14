import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { upsertSyirkahContract } from '@/modules/syirkah/actions/syirkah.actions'

async function run() {
  const org = await getActiveOrg()
  if (!org) {
     console.log('No active org')
     return;
  }
  try {
    const res = await upsertSyirkahContract(org.org.id, {
      title: 'Test Draft',
      status: 'DRAFT'
    })
    console.log('Success:', res)
  } catch (err: any) {
    console.log('Error:', err.message)
  }
}

run()
