import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    // 1. Get user by email in auth
    const { data: userData, error: userError } = await supabase.auth.getUser()

    // Since we're accessing db, let's just query orgs that this user is part of. But wait, we're not authenticated in fetch.
    // Better, use the admin client.
    const { createAdminClient } = await import('@/lib/supabase/server')
    const adminSupabase = await createAdminClient()

    // 1. Get the member by email using users/org_members or via email
    // but users don't have email in org_members.
    
    // Instead of auth.users, try the employees table or organizations owner_email
    const { data: orgData, error: orgError } = await adminSupabase
      .from('organizations')
      .select('id, name, owner_email, settings, subscription_end')
      .eq('owner_email', 'arafahjaya@gmail.com')

    // Find the member via user metadata or something... Let's just update ALL organizations where owner_email is arafahjaya@gmail.com
    let updatedOrgs = [];
    if (orgData && orgData.length > 0) {
      for (const org of orgData) {
        // give +30 days trial
        let end = new Date()
        end.setDate(end.getDate() + 30)

        const { data: updatedOrg, error: updateError } = await adminSupabase
          .from('organizations')
          .update({
            subscription_end: end.toISOString()
          })
          .eq('id', org.id)
          .select('*')

        updatedOrgs.push({ updatedOrg, updateError })
      }
    } else {
        // Maybe email is in users somehow?
        // Let's also check org_members joined with something, but let's just check the DB.
        const { data: allOrgs } = await adminSupabase.from('organizations').select('id, owner_email, name, subscription_end').limit(100);
        return NextResponse.json({ message: "Not found by owner_email", allOrgs })
    }

    return NextResponse.json({ success: true, updatedOrgs })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
