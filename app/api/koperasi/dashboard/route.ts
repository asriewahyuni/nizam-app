import { NextResponse } from 'next/server'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getDashboardStats } from '@/modules/koperasi/actions/koperasi.actions'

export async function GET() {
  try {
    const orgData = await getActiveOrg()
    if (!orgData || !orgData.org) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const orgId = (orgData.org as any).id
    const stats = await getDashboardStats(orgId)
    return NextResponse.json(stats)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
