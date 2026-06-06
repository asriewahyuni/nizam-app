import { redirect } from 'next/navigation'

// Short URL: /p/[code] → /portal/pool/[code]
export default async function ShortPoolRedirect({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  redirect(`/portal/pool/${code.toLowerCase()}`)
}
