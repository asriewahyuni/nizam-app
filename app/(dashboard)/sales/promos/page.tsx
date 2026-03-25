import { createClient } from '@/lib/supabase/server'
import PromoClient from './PromoClient'

export default async function PromosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null
  
  return <PromoClient />
}
