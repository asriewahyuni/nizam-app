import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  ArrowRight,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  LayoutGrid,
  Layers,
  PlayCircle,
  PlusCircle,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react'
import {
  TRAINING_TRACKS,
  TRAINING_COURSES,
  getTrainingCenterSummary,
  getTrainingLessonsForCourse,
} from '@/modules/edu/lib/training-center-mvp'
import { getActiveOrg, getBranches } from '@/modules/organization/actions/org.actions'
import { getCompetencyManagementDashboard } from '@/modules/edu/lib/competency-management.server'
import { getLearningAccessContext } from '@/modules/edu/lib/learning-access.server'
import {
  createCompetencyTraining,
  deleteCompetencyTraining,
  updateCompetencyTrainingStatus,
} from '@/modules/hris/actions/competency-training.actions'
import {
  listCompetencyTrainings,
  summarizeCompetencyTrainings,
  type CompetencyTrainingRecord,
} from '@/modules/hris/lib/competency-training.server'

function formatOrgKindLabel(kind: 'PARENT' | 'CHILD' | 'STANDALONE') {
  if (kind === 'PARENT') return 'Parent / Holding'
  if (kind === 'CHILD') return 'Child Entity'
  return 'Entitas Mandiri'
}

function formatStatusLabel(status: CompetencyTrainingRecord['status']) {
  if (status === 'PLANNED') return 'Direncanakan'
  if (status === 'ONGOING') return 'Berjalan'
  if (status === 'COMPLETED') return 'Selesai'
  if (status === 'ARCHIVED') return 'Arsip'
  return 'Draft'
}

function StatCard({
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
      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-3 text-3xl font-black tracking-tight text-slate-900">{value}</div>
      <p className="mt-2 text-sm text-slate-600">{hint}</p>
    </div>
  )
}

const LEARNING_FLOW_STEPS = [
  {
    step: '01',
    title: 'Pilih Track Belajar',
    description: 'Mulai dari track Onboarding & SOP untuk pengguna baru, atau pilih track lain sesuai posisi.',
    icon: LayoutGrid,
  },
  {
    step: '02',
    title: 'Buka Course & Lesson',
    description: 'Ikuti urutan lesson per course. Baca materi, pahami checklist, dan ikuti langkah kerja.',
    icon: BookOpen,
  },
  {
    step: '03',
    title: 'Kerjakan Assessment',
    description: 'Setelah selesai materi, kerjakan lembar assessment sebagai peserta untuk dinilai trainer.',
    icon: ClipboardCheck,
  },
  {
    step: '04',
    title: 'Dapatkan Status Kelulusan',
    description: 'Trainer memberi status Kompeten atau Perlu Ulang berdasarkan hasil assessment kamu.',
    icon: CheckCircle2,
  },
]

export default async function LearningPage(props: {
  searchParams: Promise<{
    created?: string
    updated?: string
    deleted?: string
    error?: string
  }>
}) {
  noStore()

  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const accessContext = await getLearningAccessContext({
    userRole: orgData.role,
    permissions: orgData.permissions,
    email: orgData.user?.email,
  })

  if (!accessContext.canRead && !accessContext.canManage) {
    return redirect('/dashboard')
  }

  const searchParams = await props.searchParams
  const [dashboard, branches, trainings] = await Promise.all([
    getCompetencyManagementDashboard({
      id: orgData.org.id,
      name: orgData.org.name,
      parent_org_id: orgData.org.parent_org_id,
    }),
    getBranches(orgData.org.id),
    listCompetencyTrainings(orgData.org.id),
  ])

  const summary = summarizeCompetencyTrainings(trainings)
  const tcSummary = getTrainingCenterSummary()

  return (
    <div className="space-y-6">



      {/* ══ MANAJEMEN PELATIHAN INTERNAL (HRIS) ══ */}
      <div className="rounded-[32px] border-2 border-dashed border-slate-200 p-1">
        <div className="rounded-[28px] bg-slate-50 px-5 py-3">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
            Manajemen Pelatihan Internal · HRIS
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Buat dan kelola program pelatihan internal per entitas. Dipakai HR manager untuk
            merencanakan, menjalankan, dan merekap pelatihan karyawan.
          </p>
        </div>

      <section className="overflow-hidden rounded-[32px] border border-emerald-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_42%),linear-gradient(135deg,#f0fdf4_0%,#ffffff_46%,#ecfeff_100%)] p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/85 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">
              <GraduationCap className="h-3.5 w-3.5" />
              HRIS • Pelatihan Internal
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
              Program pelatihan dan peningkatan kompetensi untuk {orgData.org.name}.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
              Di sini setiap entitas bisa membuat pelatihannya sendiri. Gunakan konteks organisasi aktif untuk parent
              atau child, lalu pilih scope unit bila pelatihan hanya berlaku untuk cabang tertentu.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-600">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                {formatOrgKindLabel(dashboard.organizationKind)}
              </span>
              {dashboard.activeUnit ? (
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                  Unit Aktif: {dashboard.activeUnit.name}
                </span>
              ) : null}
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                {branches.length} unit dapat dipilih
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="#buat-pelatihan"
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-200 transition hover:bg-black"
            >
              Buat Pelatihan
              <ArrowRight className="h-4 w-4" />
            </a>
            {accessContext.canReviewAssessments ? (
              <Link
                href="/lms/assessment-center"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
              >
                Panel Penilai
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {searchParams.error ? (
        <section className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-800 shadow-sm">
          {searchParams.error}
        </section>
      ) : null}

      {searchParams.created === '1' ? (
        <section className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-800 shadow-sm">
          Pelatihan baru berhasil dibuat untuk entitas aktif.
        </section>
      ) : null}

      {searchParams.updated === '1' ? (
        <section className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-800 shadow-sm">
          Status pelatihan berhasil diperbarui.
        </section>
      ) : null}

      {searchParams.deleted === '1' ? (
        <section className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900 shadow-sm">
          Pelatihan berhasil dihapus.
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Pelatihan"
          value={String(summary.total)}
          hint="Semua program yang sudah dibuat pada entitas aktif."
        />
        <StatCard
          label="Direncanakan"
          value={String(summary.planned)}
          hint="Program yang sudah siap dijalankan tetapi belum mulai."
        />
        <StatCard
          label="Sedang Berjalan"
          value={String(summary.ongoing)}
          hint="Pelatihan yang sedang berlangsung saat ini."
        />
        <StatCard
          label="Selesai"
          value={String(summary.completed)}
          hint="Program yang sudah selesai dan bisa dijadikan referensi."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div id="buat-pelatihan" className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <PlusCircle className="h-5 w-5 text-slate-700" />
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Create Training</div>
              <h2 className="mt-1 text-xl font-black text-slate-900">Buat pelatihan internal sendiri</h2>
            </div>
          </div>

          {accessContext.canManage ? (
            <form action={createCompetencyTraining} className="mt-5 grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="font-black text-slate-900">Judul Pelatihan</div>
                  <input
                    name="title"
                    required
                    placeholder="Contoh: Leadership Dasar Supervisor Outlet"
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400"
                  />
                </label>

                <label className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="font-black text-slate-900">Skill / Kategori</div>
                  <input
                    name="skillCategory"
                    placeholder="Contoh: Leadership, Sales Skill, Service Excellence"
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400"
                  />
                </label>

                <label className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="font-black text-slate-900">Target Role</div>
                  <input
                    name="targetRole"
                    placeholder="Contoh: Supervisor, Sales Team, PIC Gudang"
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400"
                  />
                </label>

                <label className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="font-black text-slate-900">Fasilitator</div>
                  <input
                    name="facilitatorName"
                    placeholder="Nama trainer / coach / mentor"
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400"
                  />
                </label>

                <label className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="font-black text-slate-900">Jenis Pelatihan</div>
                  <select
                    name="trainingType"
                    defaultValue="INTERNAL"
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400"
                  >
                    <option value="INTERNAL">Internal</option>
                    <option value="EXTERNAL">External</option>
                    <option value="CERTIFICATION">Certification</option>
                    <option value="COACHING">Coaching</option>
                  </select>
                </label>

                <label className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="font-black text-slate-900">Mode Delivery</div>
                  <select
                    name="deliveryMode"
                    defaultValue="CLASSROOM"
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400"
                  >
                    <option value="CLASSROOM">Classroom</option>
                    <option value="ONLINE">Online</option>
                    <option value="HYBRID">Hybrid</option>
                    <option value="ON_THE_JOB">On The Job</option>
                  </select>
                </label>

                <label className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="font-black text-slate-900">Scope Pelatihan</div>
                  <select
                    name="scopeType"
                    defaultValue="ORG"
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400"
                  >
                    <option value="ORG">Seluruh entitas aktif</option>
                    <option value="BRANCH">Unit tertentu</option>
                  </select>
                </label>

                <label className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="font-black text-slate-900">Unit Target</div>
                  <select
                    name="branchId"
                    defaultValue={dashboard.activeUnit?.id || ''}
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400"
                  >
                    <option value="">Gunakan seluruh entitas aktif</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.code ? `${branch.code} • ` : ''}{branch.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Jika scope `Unit tertentu`, sistem akan memakai unit ini.
                  </p>
                </label>

                <label className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="font-black text-slate-900">Tanggal Mulai</div>
                  <input
                    type="date"
                    name="startDate"
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400"
                  />
                </label>

                <label className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="font-black text-slate-900">Tanggal Selesai</div>
                  <input
                    type="date"
                    name="endDate"
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400"
                  />
                </label>

                <label className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="font-black text-slate-900">Durasi (jam)</div>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    name="durationHours"
                    defaultValue="0"
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400"
                  />
                </label>

                <label className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="font-black text-slate-900">Status Awal</div>
                  <select
                    name="status"
                    defaultValue="PLANNED"
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="PLANNED">Planned</option>
                    <option value="ONGOING">Ongoing</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </label>
              </div>

              <label className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm">
                <div className="font-black text-slate-900">Tujuan Pelatihan</div>
                <textarea
                  name="objective"
                  rows={4}
                  placeholder="Tuliskan outcome bisnis atau kompetensi yang ingin dicapai."
                  className="mt-3 w-full rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-emerald-400"
                />
              </label>

              <label className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm">
                <div className="font-black text-slate-900">Catatan Tambahan</div>
                <textarea
                  name="notes"
                  rows={4}
                  placeholder="Misalnya kebutuhan trainer, batch peserta, atau catatan SOP HR."
                  className="mt-3 w-full rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-emerald-400"
                />
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700"
                >
                  Simpan Pelatihan
                  <ArrowRight className="h-4 w-4" />
                </button>
                <p className="text-sm leading-6 text-slate-600">
                  Gunakan switch konteks organisasi di header jika ingin membuat pelatihan untuk child entity lain.
                </p>
              </div>
            </form>
          ) : (
            <div className="mt-5 rounded-[22px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
              Anda sudah bisa melihat katalog pelatihan, tetapi belum punya akses untuk membuat atau mengubah data.
              Minta role dengan permission `learning:write` jika ingin mengelola program.
            </div>
          )}
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Layers className="h-5 w-5 text-slate-700" />
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Konteks Aktif</div>
              <h2 className="mt-1 text-xl font-black text-slate-900">Entitas dan unit tempat pelatihan dibuat</h2>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            <div className="rounded-[22px] border border-emerald-200 bg-emerald-50/70 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">
                    {formatOrgKindLabel(dashboard.currentOrg.kind)}
                  </div>
                  <h3 className="mt-2 text-lg font-black text-slate-900">{dashboard.currentOrg.orgName}</h3>
                </div>
                <Building2 className="h-5 w-5 text-emerald-700" />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[18px] border border-emerald-200 bg-white p-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Unit</div>
                  <div className="mt-2 text-xl font-black text-slate-900">{branches.length}</div>
                </div>
                <div className="rounded-[18px] border border-emerald-200 bg-white p-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Karyawan</div>
                  <div className="mt-2 text-xl font-black text-slate-900">{dashboard.currentOrg.employeeCount}</div>
                </div>
              </div>
            </div>

            {dashboard.activeUnit ? (
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Unit Aktif</div>
                    <h3 className="mt-2 text-base font-black text-slate-900">{dashboard.activeUnit.name}</h3>
                  </div>
                  <CalendarDays className="h-5 w-5 text-slate-500" />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Saat Anda memilih scope `Unit tertentu`, pelatihan akan ditautkan ke unit ini atau unit yang dipilih di form.
                </p>
              </div>
            ) : null}

            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-5">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Catatan Operasional</div>
              <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <p>Parent membuat program untuk parent saat konteks aktif di parent.</p>
                <p>Child membuat programnya sendiri setelah switch ke child terkait.</p>
                <p>Unit bisa punya program khusus lewat scope `Unit tertentu`.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="daftar-pelatihan" className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Training Catalog</div>
            <h2 className="mt-2 text-xl font-black text-slate-900">Daftar pelatihan yang sudah dibuat</h2>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-600">
            {summary.total} program
          </div>
        </div>

        {trainings.length === 0 ? (
          <div className="mt-5 rounded-[22px] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-6 text-slate-600">
            Belum ada pelatihan yang dibuat pada entitas aktif ini. Mulai dari form di atas untuk menyusun program skill
            business sesuai kebutuhan HR Anda sendiri.
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {trainings.map((training) => (
              <div key={training.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                        {formatStatusLabel(training.status)}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
                        {training.scopeType === 'BRANCH'
                          ? `Unit • ${training.branchCode || training.branchName || 'Tanpa nama'}`
                          : 'Entitas aktif'}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
                        {training.trainingType}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
                        {training.deliveryMode}
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg font-black text-slate-900">{training.title}</h3>
                    <p className="mt-2 text-sm text-slate-600">{training.skillCategory}</p>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
                      {training.targetRole ? <span>Target role: {training.targetRole}</span> : null}
                      {training.facilitatorName ? <span>Fasilitator: {training.facilitatorName}</span> : null}
                      {training.durationHours > 0 ? <span>Durasi: {training.durationHours} jam</span> : null}
                    </div>
                    {training.objective ? (
                      <p className="mt-4 text-sm leading-6 text-slate-700">{training.objective}</p>
                    ) : null}
                    {training.notes ? (
                      <div className="mt-4 rounded-[18px] border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
                        {training.notes}
                      </div>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                        Peserta {training.participantCount}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                        Sesi {training.sessionCount}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                        Evaluasi {training.evaluationCount}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-4 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                      {training.startDate ? <span>Mulai: {training.startDate}</span> : null}
                      {training.endDate ? <span>Selesai: {training.endDate}</span> : null}
                    </div>
                  </div>

                  <div className="w-full max-w-sm space-y-3">
                    <Link
                      href={`/lms/trainings/${training.id}`}
                      className="inline-flex w-full items-center justify-between rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100"
                    >
                      <span>{accessContext.canManage ? 'Kelola Peserta, Sesi, dan Evaluasi' : 'Lihat Detail Pelatihan'}</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>

                  {accessContext.canManage ? (
                    <>
                      <form action={updateCompetencyTrainingStatus} className="rounded-[20px] border border-slate-200 bg-white p-4">
                        <input type="hidden" name="trainingId" value={training.id} />
                        <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Update Status</div>
                        <select
                          name="status"
                          defaultValue={training.status}
                          className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400"
                        >
                          <option value="DRAFT">Draft</option>
                          <option value="PLANNED">Planned</option>
                          <option value="ONGOING">Ongoing</option>
                          <option value="COMPLETED">Completed</option>
                          <option value="ARCHIVED">Archived</option>
                        </select>
                        <button
                          type="submit"
                          className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition hover:bg-black"
                        >
                          Simpan Status
                        </button>
                      </form>

                      <form action={deleteCompetencyTraining} className="rounded-[20px] border border-rose-200 bg-rose-50 p-4">
                        <input type="hidden" name="trainingId" value={training.id} />
                        <div className="text-[11px] font-black uppercase tracking-[0.16em] text-rose-700">Hapus Program</div>
                        <p className="mt-2 text-sm leading-6 text-rose-800">
                          Gunakan ini jika pelatihan dibuat salah atau tidak jadi dipakai.
                        </p>
                        <button
                          type="submit"
                          className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-black text-white transition hover:bg-rose-700"
                        >
                          Hapus Pelatihan
                        </button>
                      </form>
                    </>
                  ) : (
                    <div className="rounded-[20px] border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
                      Anda berada di mode baca. Buka detail untuk melihat assignment peserta, sesi, dan evaluasi.
                    </div>
                  )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <ShieldCheck className="h-5 w-5 text-emerald-700" />
          <h3 className="mt-4 text-base font-black text-slate-900">Bukan SaaS-only</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Workspace ini berfokus pada kebutuhan HR internal untuk membuat program kompetensi sendiri.
          </p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <Layers className="h-5 w-5 text-emerald-700" />
          <h3 className="mt-4 text-base font-black text-slate-900">Per Entitas dan Unit</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Parent, child, dan unit bisa punya katalog pelatihan berbeda sesuai konteks aktif yang dipilih.
          </p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <Users className="h-5 w-5 text-emerald-700" />
          <h3 className="mt-4 text-base font-black text-slate-900">Fleksibel untuk Skill Business</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Anda bisa memakainya untuk leadership, sales skill, service, compliance, atau penguatan budaya kerja.
          </p>
        </div>
      </section>
      </div>
    </div>
  )
}
