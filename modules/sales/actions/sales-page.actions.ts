'use server'

import { revalidatePath } from 'next/cache'
import {
  createGeneratedSalesPage,
  duplicateSalesPage,
  removeSalesPage,
  updateSalesPageContent,
} from '@/modules/sales/lib/sales-page.server'
import type { SalesPageGeneratorInput, SalesPagePayload } from '@/modules/sales/lib/sales-page'

function publicPath(orgSlug: string, pageSlug: string) {
  return `/sp/${orgSlug}/${pageSlug}`
}

export async function createSalesPage(orgId: string, input: SalesPageGeneratorInput, orgSlug: string) {
  const page = await createGeneratedSalesPage(orgId, input)
  revalidatePath('/sales/pages')
  revalidatePath(publicPath(orgSlug, page.slug))
  return page
}

export async function updateSalesPage(orgId: string, salesPageId: string, payload: SalesPagePayload, orgSlug: string, previousSlug?: string) {
  const page = await updateSalesPageContent(orgId, salesPageId, payload)
  revalidatePath('/sales/pages')
  revalidatePath(publicPath(orgSlug, page.slug))
  if (previousSlug && previousSlug !== page.slug) {
    revalidatePath(publicPath(orgSlug, previousSlug))
  }
  return page
}

export async function duplicateSalesPageAction(orgId: string, salesPageId: string, orgSlug: string) {
  const page = await duplicateSalesPage(orgId, salesPageId)
  revalidatePath('/sales/pages')
  revalidatePath(publicPath(orgSlug, page.slug))
  return page
}

export async function deleteSalesPage(orgId: string, salesPageId: string, orgSlug: string, pageSlug: string) {
  await removeSalesPage(orgId, salesPageId)
  revalidatePath('/sales/pages')
  revalidatePath(publicPath(orgSlug, pageSlug))
  return { success: true }
}
