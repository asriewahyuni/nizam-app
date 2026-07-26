import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { BadgeCheck, Building2, ExternalLink, Mail, ShieldCheck, UserRound } from 'lucide-react'
import {
  getPortalMemberContext,
  getPortalTenant,
} from '@/modules/member/lib/portal.server'
import { getMemberConsultingEngagements } from '@/modules/consulting/lib/consulting.server'

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
  const consultingEngagements = await getMemberConsultingEngagements(tenant.id, member.userId)
  const badges = consultingEngagements
    .filter((engagement) => Boolean(engagement.badge))
    .map((engagement) => ({
      programName: engagement.productName,
      consultantName: engagement.consultantName,
      ...engagement.badge!,
    }))

  const details = [
    { label: 'Nama', value: member.displayName, icon: UserRound },
    { label: 'Email login', value: member.email || 'Belum diisi', icon: Mail },
    { label: 'Organisasi', value: tenant.name, icon: Building2 },
    { label: 'Peran portal', value: member.role, icon: ShieldCheck },
  ]
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
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

      <section className="mt-8" aria-labelledby="profile-badges-title">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
            <BadgeCheck aria-hidden="true" size={22} />
          </span>
          <div>
            <h2 id="profile-badges-title" className="text-xl font-black text-slate-950">
              Lencana Consulting 360
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-600">
              Bukti penyelesaian pendampingan yang dapat diverifikasi publik.
            </p>
          </div>
        </div>

        {badges.length > 0 ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {badges.map((badge) => (
              <article
                key={badge.badgeNumber}
                className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <BadgeCheck aria-hidden="true" size={24} className="shrink-0 text-amber-700" />
                  <div>
                    <h3 className="font-black text-slate-950">{badge.title}</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-600">{badge.programName}</p>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      Konsultan {badge.consultantName} · {badge.badgeNumber}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-black ${
                    badge.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {badge.status === 'ACTIVE' ? 'Aktif' : 'Dicabut'}
                  </span>
                  <Link
                    href={`/verifikasi/lencana/${badge.verificationToken}`}
                    className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-4 text-sm font-black text-amber-900 transition-colors duration-200 hover:bg-amber-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-200"
                  >
                    Verifikasi
                    <ExternalLink aria-hidden="true" size={16} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm font-semibold text-slate-600">
            Belum ada lencana. Lencana akan tampil setelah seluruh sesi selesai dan konsultan memberi persetujuan akhir.
          </div>
        )}
      </section>
    </div>
  )
}
