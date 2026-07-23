import { notFound, redirect } from 'next/navigation'
import { Building2, Mail, ShieldCheck, UserRound } from 'lucide-react'
import {
  getPortalMemberContext,
  getPortalTenant,
} from '@/modules/member/lib/portal.server'

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const tenant = await getPortalTenant(orgSlug)
  if (!tenant) notFound()
  const member = await getPortalMemberContext(tenant)
  if (!member) redirect(`/login?callbackUrl=${encodeURIComponent(`/member/${orgSlug}/profil`)}`)

  const details = [
    { label: 'Nama', value: member.displayName, icon: UserRound },
    { label: 'Email login', value: member.email || 'Belum diisi', icon: Mail },
    { label: 'Organisasi', value: tenant.name, icon: Building2 },
    { label: 'Peran portal', value: member.role, icon: ShieldCheck },
  ]
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold text-emerald-700">Identitas akun</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Profil</h1>
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <dl className="divide-y divide-slate-100">
          {details.map((detail) => {
            const Icon = detail.icon
            return (
              <div key={detail.label} className="grid gap-2 py-5 first:pt-0 last:pb-0 sm:grid-cols-[12rem_1fr]">
                <dt className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                  <Icon aria-hidden="true" size={17} />
                  {detail.label}
                </dt>
                <dd className="font-semibold text-slate-950">{detail.value}</dd>
              </div>
            )
          })}
        </dl>
      </div>
    </div>
  )
}
