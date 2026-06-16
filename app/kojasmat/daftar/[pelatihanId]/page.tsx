import { getPelatihanPublik } from '@/modules/kojasmat/actions/kojasmat.actions'
import DaftarPelatihanClient from './DaftarPelatihanClient'
import { notFound } from 'next/navigation'

export async function generateMetadata({ params }: { params: Promise<{ pelatihanId: string }> }) {
  const { pelatihanId } = await params
  const p = await getPelatihanPublik(pelatihanId)
  return {
    title: p ? `Daftar: ${p.judul}` : 'Pelatihan',
  }
}

export default async function DaftarPelatihanPage({ params }: { params: Promise<{ pelatihanId: string }> }) {
  const { pelatihanId } = await params
  const pelatihan = await getPelatihanPublik(pelatihanId)
  if (!pelatihan) notFound()

  return <DaftarPelatihanClient pelatihan={pelatihan} />
}
