'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getServiceOrders(orgId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('service_orders')
    .select(`
      *,
      contact:customer:contacts(id, name)
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching Service Orders:', error)
    return []
  }

  return data
}

export async function createServiceOrder(orgId: string, formData: FormData) {
  const supabase = await createClient()

  const payload = {
    org_id: orgId,
    contact_id: formData.get('contact_id') as string,
    job_number: formData.get('job_number') as string,
    description: formData.get('description') as string,
    status: 'PENDING',
    start_date: formData.get('start_date') as string,
    notes: formData.get('notes') as string,
    estimated_cost: Number(formData.get('estimated_cost'))
  }

  const { error } = await supabase.from('service_orders').insert(payload)

  if (error) return { error: error.message }

  revalidatePath('/services')
  return { success: true }
}

export async function updateServiceStatus(orgId: string, orderId: string, status: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('service_orders')
    .update({ status })
    .eq('id', orderId)
    .eq('org_id', orgId)

  if (error) return { error: error.message }

  revalidatePath('/services')
  return { success: true }
}
