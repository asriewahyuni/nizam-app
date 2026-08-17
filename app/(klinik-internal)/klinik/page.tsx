import { getActiveOrg, getActiveBranch } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import { getKlinikAccountMappingData } from '@/modules/klinik/lib/klinik-account-mapping.server'
import { getKlinikPoliByBranch, getKlinikStafMedis, getKlinikTarifLayananByBranch } from '@/modules/klinik/actions/klinik.actions'
import { getAntrianHariIni } from '@/modules/klinik/actions/klinik-kunjungan.actions'
import { getKlinikWarehousesByBranch } from '@/modules/klinik/actions/klinik-resep.actions'
import { getUnpostedKlinikTransactions } from '@/modules/klinik/actions/klinik-tagihan.actions'
import { getEmployees } from '@/modules/hris/actions/employee.actions'
import KlinikClient from './KlinikClient'

export const revalidate = 0

export default async function KlinikPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const orgId = orgData.org.id
  const activeBranch = await getActiveBranch(orgId)
  const { mapping: accountMapping, accounts: chartOfAccounts } = await getKlinikAccountMappingData(orgId, activeBranch?.id)
  const poliList = activeBranch ? await getKlinikPoliByBranch(orgId, activeBranch.id) : []
  const initialAntrian = activeBranch && poliList[0] ? await getAntrianHariIni(activeBranch.id, poliList[0].id) : []
  const warehouses = activeBranch ? await getKlinikWarehousesByBranch(orgId, activeBranch.id) : []
  const stafMedisList = await getKlinikStafMedis(orgId)
  const tarifLayananList = activeBranch ? await getKlinikTarifLayananByBranch(orgId, activeBranch.id) : []
  const employees = activeBranch ? await getEmployees(orgId, activeBranch.id).catch(() => []) : []
  const unpostedTransactions = await getUnpostedKlinikTransactions(orgId)

  return (
    <KlinikClient
      orgId={orgId}
      branch={activeBranch}
      poliList={poliList}
      initialPoliId={poliList[0]?.id ?? null}
      initialAntrian={initialAntrian}
      warehouses={warehouses}
      stafMedisList={stafMedisList}
      tarifLayananList={tarifLayananList}
      employees={employees.map((e: Record<string, unknown>) => ({
        id: String(e.id),
        name: `${String(e.first_name || '')} ${String(e.last_name || '')}`.trim(),
      }))}
      accountMapping={accountMapping}
      chartOfAccounts={chartOfAccounts}
      unpostedCount={unpostedTransactions.tagihanPending.length + unpostedTransactions.resepPending.length}
    />
  )
}
