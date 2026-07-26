/**
 * Pengaturan toko terpilih dari area LMS.
 */
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getLmsStoreSettingsData } from '@/modules/ecommerce/lib/lms-sales.server'
import LmsStoreSettingsEditor from './LmsStoreSettingsEditor'

type PageProps = {
  params: Promise<{ storeId: string }>
}

export const metadata: Metadata = {
  title: 'Toko & Tampilan LMS',
  description: 'Kelola identitas, halaman, pembayaran, dan custom domain LMS.',
}

export default async function LmsStoreSettingsPage({ params }: PageProps) {
  const { storeId } = await params
  const data = await getLmsStoreSettingsData(storeId)
  if (!data.selectedStore || data.selectedStore.id !== storeId) notFound()

  return (
    <LmsStoreSettingsEditor
      orgSlug={data.org.slug}
      dashboardData={data.dashboard}
      selectedStore={data.selectedStore}
      domains={data.domains}
      automation={data.automation}
    />
  )
}
