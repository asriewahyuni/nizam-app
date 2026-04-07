import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import BusinessClient from './BusinessClient'

export default async function BusinessSettingsPage() {
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const requestHeaders = await headers()
  const configuredBaseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const forwardedProto = requestHeaders.get('x-forwarded-proto')
  const forwardedHost = requestHeaders.get('x-forwarded-host')
  const host = forwardedHost || requestHeaders.get('host')
  const protocol = forwardedProto || (host?.includes('localhost') ? 'http' : 'https')
  const baseUrl = host ? `${protocol}://${host}` : configuredBaseUrl

  return <BusinessClient 
    orgId={orgData.org.id} 
    currentRole={orgData.role}
    initialSettings={orgData.org} 
    baseUrl={baseUrl}
  />
}
