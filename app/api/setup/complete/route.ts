import { NextRequest, NextResponse } from 'next/server'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { revalidatePath } from 'next/cache'

export async function POST(req: NextRequest) {
  try {
    const { moduleKey } = await req.json()
    if (!moduleKey) {
      return NextResponse.json({ error: 'moduleKey is required' }, { status: 400 })
    }

    const orgData = await getActiveOrg()
    if (!orgData || !orgData.org) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const supabase = await (await import('@/lib/supabase/server')).createClient()

    const { error } = await supabase
      .from('org_module_instances')
      .update({ status: 'READY', ready_at: new Date().toISOString() })
      .eq('org_id', orgData.org.id)
      .eq('module_key', moduleKey)

    if (error) throw new Error(error.message)

    revalidatePath('/marketplace')
    revalidatePath('/', 'layout')

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
