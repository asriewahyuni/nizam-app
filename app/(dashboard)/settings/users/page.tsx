import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import UsersClient from './UsersClient'
import { createClient } from '@/lib/supabase/server'

export default async function UsersPage() {
  const orgData = await getActiveOrg()
  if (!orgData || orgData.role !== 'owner') return redirect('/dashboard')

  const supabase = await createClient()
  
  // Ambil semua member di organisasi ini, termasuk email dari schema auth.users
  // (Jika RLS allow, tapi karena kita query admin, idealnya RPC, atau fallback)
  const { data: members, error } = await supabase
    .from('org_members')
    .select(`
      *,
      user:user_id (
        email
      )
    `)
    .eq('org_id', orgData.org.id)

  return <UsersClient orgId={orgData.org.id} initialMembers={members || []} />
}
