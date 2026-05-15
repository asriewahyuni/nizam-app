import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getProyek } from '@/modules/koperasi/actions/koperasi.actions'
import ProyekDetailClient from './ProyekDetailClient'

export const dynamic = 'force-dynamic'

export default async function ProyekDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const orgData = await getActiveOrg()
  const orgId = (orgData?.org as any)?.id
  if (!orgId) return <div className="p-8 text-center text-red-400">Akses ditolak</div>
  
  const proyekList = await getProyek(orgId)
  const proyek = proyekList.find((p: any) => p.id === id)
  if (!proyek) return <div className="p-8 text-center text-slate-500">Proyek tidak ditemukan</div>
  
  return <ProyekDetailClient proyek={proyek} orgId={orgId} />
}
