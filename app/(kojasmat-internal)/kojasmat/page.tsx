import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import {
  getAllAnggota, getAllProyek, getAllPelatihan, getKojasmatStats, getSetoranPendingByOrg,
} from '@/modules/kojasmat/actions/kojasmat.actions'
import {
  getAllPendaftaran, getAllLaporan, getAllTindakan,
} from '@/modules/kojasmat/actions/kojasmat-membership.actions'
import { getBankSoal, getModuleSettings, getInfoPembayaran } from '@/modules/kojasmat/actions/kojasmat-test.actions'
import { getBankAccounts } from '@/modules/cash/actions/bank.actions'
import { getKojasmatAccountMappingData } from '@/modules/kojasmat/lib/kojasmat-account-mapping.server'
import { getTenantWhatsappSettings } from '@/modules/notifications/whatsapp-settings.server'
import { getAllPortalBanners } from '@/modules/kojasmat/actions/kojasmat-banner.actions'
import KojasmatClient from './KojasmatClient'

export const revalidate = 0

export default async function KojasmatPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const orgId = orgData.org.id

  const stats          = await getKojasmatStats(orgId)
  const anggota        = await getAllAnggota(orgId)
  const proyek         = await getAllProyek(orgId)
  const pelatihan      = await getAllPelatihan(orgId)
  const pendaftaran    = await getAllPendaftaran(orgId)
  const laporan        = await getAllLaporan(orgId)
  const tindakan       = await getAllTindakan(orgId)
  const bankSoal       = await getBankSoal(orgId)
  const moduleSettings = await getModuleSettings(orgId)
  const bankAccounts   = await getBankAccounts(orgId)
  const infoBayar      = await getInfoPembayaran(orgId)
  const setoranPending = await getSetoranPendingByOrg(orgId)
  const { mapping: accountMapping, accounts: chartOfAccounts } = await getKojasmatAccountMappingData(orgId)
  const whatsappSettings = await getTenantWhatsappSettings(orgId)
  const banner = await getAllPortalBanners(orgId)

  return (
    <KojasmatClient
      orgId={orgId}
      stats={stats}
      anggota={anggota}
      proyek={proyek}
      pelatihan={pelatihan}
      pendaftaran={pendaftaran}
      laporan={laporan}
      tindakan={tindakan}
      bankSoal={bankSoal}
      moduleSettings={moduleSettings}
      bankAccounts={bankAccounts.map(b => ({ id: b.id, bank_name: b.bank_name, account_number: b.account_number ?? '' }))}
      qrisPreviewUrl={infoBayar.data.qris_image_url}
      setoranPending={setoranPending}
      accountMapping={accountMapping}
      chartOfAccounts={chartOfAccounts}
      whatsappSettings={whatsappSettings}
      banner={banner}
    />
  )
}
