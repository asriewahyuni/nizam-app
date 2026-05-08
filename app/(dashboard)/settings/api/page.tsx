/**
 * app/(dashboard)/settings/api/page.tsx
 *
 * Legacy route compatibility.
 * Redirects the old settings path to the developer portal route.
 */

import { redirect } from 'next/navigation'

export const revalidate = 0

export default async function ApiSettingsPage() {
  redirect('/developers/api')
}
