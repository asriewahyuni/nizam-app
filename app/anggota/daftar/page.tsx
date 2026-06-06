import { queryPostgres } from '@/lib/db/postgres'
import DaftarClient from './DaftarClient'

export const revalidate = 0

export default async function DaftarPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>
}) {
  const { org } = await searchParams

  if (!org) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm max-w-md">
          <p className="text-lg font-semibold text-gray-800">URL tidak valid</p>
          <p className="text-sm text-gray-500 mt-2">
            Hubungi pengurus koperasi untuk mendapatkan link pendaftaran yang benar.
          </p>
        </div>
      </div>
    )
  }

  const { rows: [orgData] } = await queryPostgres(
    `SELECT id, nama FROM organizations WHERE id=$1 LIMIT 1`,
    [org]
  )

  if (!orgData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm max-w-md">
          <p className="text-lg font-semibold text-gray-800">Koperasi tidak ditemukan</p>
          <p className="text-sm text-gray-500 mt-2">
            Link pendaftaran sudah tidak valid. Hubungi pengurus koperasi.
          </p>
        </div>
      </div>
    )
  }

  return <DaftarClient orgId={orgData.id} orgNama={orgData.nama} />
}
