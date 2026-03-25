import type { Metadata } from 'next'
import DemoClient from './DemoClient'

export const metadata: Metadata = {
  title: 'Demo NIZAM ERP — Coba Gratis Sekarang',
  description: 'Jelajahi seluruh fitur NIZAM ERP secara real — dari akuntansi, inventory, manufaktur, hingga POS. Data auto-reset saat selesai.',
}

export default function DemoPage() {
  return <DemoClient />
}
