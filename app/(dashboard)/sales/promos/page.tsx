import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import PromoClient from './PromoClient'

export default async function PromosPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  return <PromoClient />
}
