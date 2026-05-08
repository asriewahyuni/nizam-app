import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import { redirect } from 'next/navigation'
import { ArrowLeft, ArrowRight, ClipboardCheck, FileText, ShieldCheck, Users } from 'lucide-react'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getCompetencyManagementDashboard } from '@/modules/edu/lib/competency-management.server'
import { getLearningAccessContext } from '@/modules/edu/lib/learning-access.server'

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-3 text-3xl font-black tracking-tight text-slate-900">{value}</div>
      <p className="mt-2 text-sm text-slate-600">{hint}</p>
    </div>
  )
}

export default async function LearningAssessmentCenterPage() {
  noStore()

  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const accessContext = await getLearningAccessContext({
    userRole: orgData.role,
    permissions: orgData.permissions,
    email: orgData.user?.email,
  })

  if (!accessContext.canReviewAssessments) {
    return redirect('/lms')
  }

  const dashboard = await getCompetencyManagementDashboard({
    id: orgData.org.id,
    name: orgData.org.name,
    parent_org_id: orgData.org.parent_org_id,
  })

  const totals = dashboard.courseSummaries.reduce((acc, course) => {
    acc.pending += course.pendingAnswerCount
    acc.reviewed += course.reviewedAnswerCount
    acc.final += course.finalAssessmentCount
    acc.competent += course.competentCount
    return acc
  }, {
    pending: 0,
    reviewed: 0,
    final: 0,
    competent: 0,
  })

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <Link
          href="/lms"
          className="inline-flex items-center gap-2 text-sm font-black text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke workspace kompetensi
        </Link>

        <div className="mt-5 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600">
              <ShieldCheck className="h-3.5 w-3.5" />
              Panel Penilai
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
              Review kompetensi untuk {orgData.org.name}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
              Halaman ini dipakai pengelola kompetensi internal atau assessor SaaS untuk meninjau submission,
              memutuskan hasil asesmen, dan memantau progres course pada entitas aktif.
            </p>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Konteks Aktif</div>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="rounded-[20px] border border-slate-200 bg-white p-4">
                <div className="font-black text-slate-900">Entitas</div>
                <div className="mt-1">{orgData.org.name}</div>
              </div>
              <div className="rounded-[20px] border border-slate-200 bg-white p-4">
                <div className="font-black text-slate-900">Mode Penilai</div>
                <div className="mt-1">
                  {accessContext.source === 'internal+saas'
                    ? 'Internal + SaaS assessor'
                    : accessContext.source === 'saas'
                      ? 'SaaS assessor'
                      : 'Internal tenant'}
                </div>
              </div>
              {dashboard.activeUnit ? (
                <div className="rounded-[20px] border border-slate-200 bg-white p-4">
                  <div className="font-black text-slate-900">Unit Aktif</div>
                  <div className="mt-1">{dashboard.activeUnit.name}</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Pending Review"
          value={String(totals.pending)}
          hint="Submission peserta yang masih menunggu dibuka oleh penilai."
        />
        <SummaryCard
          label="Sudah Direview"
          value={String(totals.reviewed)}
          hint="Jawaban peserta yang sudah diberi tindak lanjut."
        />
        <SummaryCard
          label="Asesmen Final"
          value={String(totals.final)}
          hint="Keputusan akhir kompetensi yang sudah tersimpan."
        />
        <SummaryCard
          label="Kompeten"
          value={String(totals.competent)}
          hint="Peserta yang sudah lulus pada hasil asesmen terakhir."
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {dashboard.courseSummaries.map((course) => (
          <div key={course.courseSlug} className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">{course.levelCode}</div>
                <h2 className="mt-2 text-xl font-black text-slate-900">{course.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{course.audience}</p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
                {course.status}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
                <Users className="h-4 w-4 text-slate-500" />
                <div className="mt-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Pending</div>
                <div className="mt-2 text-2xl font-black text-slate-900">{course.pendingAnswerCount}</div>
              </div>
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
                <ClipboardCheck className="h-4 w-4 text-slate-500" />
                <div className="mt-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Direview</div>
                <div className="mt-2 text-2xl font-black text-slate-900">{course.reviewedAnswerCount}</div>
              </div>
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
                <FileText className="h-4 w-4 text-slate-500" />
                <div className="mt-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Final</div>
                <div className="mt-2 text-2xl font-black text-slate-900">{course.finalAssessmentCount}</div>
              </div>
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
                <ShieldCheck className="h-4 w-4 text-slate-500" />
                <div className="mt-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Kompeten</div>
                <div className="mt-2 text-2xl font-black text-slate-900">{course.competentCount}</div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={course.reviewerHref}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition hover:bg-black"
              >
                Buka Review Penilai
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={course.participantHref}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
              >
                Lihat Halaman Peserta
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={course.syllabusHref}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-700"
              >
                Buka Materi
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
