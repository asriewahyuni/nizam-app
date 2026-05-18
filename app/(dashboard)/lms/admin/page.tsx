import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  ArrowRight,
  ClipboardCheck,
  FileText,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getLearningAccessContext } from '@/modules/edu/lib/learning-access.server'
import { getLmsBatches, getLmsCourses, getAllLmsSessions } from '@/modules/edu/actions/lms-commercial.actions'
import LmsAdminHierarchy from './LmsAdminHierarchy'

export default async function LearningAdminPage() {
  noStore()

  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const accessContext = await getLearningAccessContext({
    userRole: orgData.role,
    permissions: orgData.permissions,
    email: orgData.user?.email,
  })

  if (!accessContext.canManage && !accessContext.canReviewAssessments) {
    return redirect('/lms')
  }

  const [batches, courses, sessions] = await Promise.all([
    getLmsBatches(orgData.org.id),
    getLmsCourses(orgData.org.id),
    getAllLmsSessions(orgData.org.id),
  ])

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight flex items-center gap-3">
            <Settings size={32} className="text-blue-600" />
            Admin & Trainer LMS
          </h1>
          <p className="text-sm text-slate-500 font-medium">
            Kelola program, angkatan, dan jadwal sesi untuk {orgData.org.name}.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          {accessContext.canReviewAssessments && (
            <Link
              href="/lms/assessment-center"
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white text-sm font-bold rounded-2xl hover:bg-black shadow-xl shadow-slate-200 transition-all"
            >
              Panel Penilai <ArrowRight size={18} />
            </Link>
          )}
          {accessContext.canManage && (
            <Link
              href="/lms/registrasi"
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white text-sm font-bold rounded-2xl hover:bg-black shadow-xl shadow-slate-200 transition-all"
            >
              <Users size={18} /> Registrasi Peserta
            </Link>
          )}
        </div>
      </div>

      {/* ── Hierarchy: Program → Batch → Sesi ── */}
      <LmsAdminHierarchy
        courses={courses}
        batches={batches}
        sessions={sessions}
      />

      {/* ── Navigasi Cepat ── */}
      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm hover:shadow-md transition-all group">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
            <Users size={24} />
          </div>
          <h3 className="mt-5 text-lg font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">Manajemen Peserta</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 font-medium">
            Kelola registrasi peserta, tambah manual, dan pantau status per batch.
          </p>
          <Link
            href="/lms/registrasi"
            className="mt-6 inline-flex items-center gap-2 text-[11px] font-semibold tracking-tight text-slate-400 group-hover:text-blue-600 transition-colors"
          >
            Buka Registrasi
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm hover:shadow-md transition-all group">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
            <FileText size={24} />
          </div>
          <h3 className="mt-5 text-lg font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">Review Assessment</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 font-medium">
            Tinjau jawaban peserta, beri feedback, dan putuskan status kompeten.
          </p>
          {accessContext.canReviewAssessments ? (
            <Link
              href="/lms/assessment-center"
              className="mt-6 inline-flex items-center gap-2 text-[11px] font-semibold tracking-tight text-slate-400 group-hover:text-blue-600 transition-colors"
            >
              Panel Penilai
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className="mt-6 block text-[11px] font-semibold tracking-tight text-slate-300">
              Tidak ada akses
            </span>
          )}
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm hover:shadow-md transition-all group">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
            <ClipboardCheck size={24} />
          </div>
          <h3 className="mt-5 text-lg font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">Template Asesmen</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 font-medium">
            Atur rubrik penilaian per course. Sesuaikan pertanyaan, tugas praktik, dan checklist.
          </p>
          <Link
            href="/lms/admin/assessment-templates"
            className="mt-6 inline-flex items-center gap-2 text-[11px] font-semibold tracking-tight text-slate-400 group-hover:text-blue-600 transition-colors"
          >
            Kelola Template
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm hover:shadow-md transition-all group">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
            <ShieldCheck size={24} />
          </div>
          <h3 className="mt-5 text-lg font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">Lihat Progress</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 font-medium">
            Simulasikan view peserta untuk memastikan alur materi sudah benar.
          </p>
          <Link
            href="/lms/my-progress"
            className="mt-6 inline-flex items-center gap-2 text-[11px] font-semibold tracking-tight text-slate-400 group-hover:text-blue-600 transition-colors"
          >
            My Progress View
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  )
}
