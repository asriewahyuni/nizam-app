import { notFound } from 'next/navigation'
import { queryPostgres } from '@/lib/db/postgres'
import { getKlinikPoliByBranch } from '@/modules/klinik/actions/klinik.actions'
import BookingClient from './BookingClient'

export const revalidate = 0

async function getBranchPublicInfo(branchId: string) {
  const { rows } = await queryPostgres<{ id: string; org_id: string; name: string; org_name: string }>(
    `SELECT b.id::text, b.org_id::text, b.name, o.name AS org_name
     FROM public.branches b
     JOIN public.organizations o ON o.id = b.org_id
     WHERE b.id = $1 AND b.is_active = TRUE
     LIMIT 1`,
    [branchId],
  )
  return rows[0] || null
}

export default async function KlinikBookingPage({ params }: { params: Promise<{ branchId: string }> }) {
  const { branchId } = await params
  const branch = await getBranchPublicInfo(branchId)
  if (!branch) notFound()

  const poliList = await getKlinikPoliByBranch(branch.org_id, branch.id)

  return (
    <BookingClient
      orgId={branch.org_id}
      branchId={branch.id}
      branchName={branch.name}
      orgName={branch.org_name}
      poliList={poliList}
    />
  )
}
