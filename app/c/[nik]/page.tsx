import { redirect } from 'next/navigation'

// Short URL: /c/[nik] → /portal/crew/[nik]
export default async function ShortCrewRedirect({ params }: { params: Promise<{ nik: string }> }) {
  const { nik } = await params
  redirect(`/portal/crew/${nik}`)
}
