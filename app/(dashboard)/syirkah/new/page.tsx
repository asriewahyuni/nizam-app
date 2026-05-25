import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { hasRolePermission } from '@/modules/organization/lib/navigation-access'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Buat Akad Syirkah Baru | Nizam ERP',
}

/**
 * /syirkah/new — Membuat draft kontrak baru lalu redirect ke wizard.
 * Menggunakan direct DB insert (tanpa revalidatePath) karena page ini
 * langsung redirect — revalidasi tidak diperlukan di sini.
 */
export default async function NewSyirkahPage() {
  const activeOrgData = await getActiveOrg()
  if (!activeOrgData) redirect('/onboarding')

  if (!hasRolePermission(activeOrgData.role, activeOrgData.permissions, 'syirkah')) {
    redirect('/dashboard?error=akses-ditolak')
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('syirkah_contracts')
    .insert({
      org_id: activeOrgData.org.id,
      title: 'Akad Syirkah Baru',
      status: 'DRAFT',
      wizard_step: 1,
    })
    .select()
    .single()

  if (error || !data?.id) redirect('/syirkah')

  redirect(`/syirkah/${data.id}?wizard=1`)
}
