import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  ArrowLeft,
  CalendarDays,
  ClipboardCheck,
  Clock3,
  GraduationCap,
  MapPin,
  Sparkles,
  Users,
} from 'lucide-react'
import { getActiveOrg, getBranches } from '@/modules/organization/actions/org.actions'
import { getLearningAccessContext } from '@/modules/edu/lib/learning-access.server'
import {
  assignCompetencyTrainingParticipant,
  createCompetencyTrainingSession,
  recordCompetencyTrainingEvaluation,
  updateCompetencyTrainingParticipantStatus,
  updateCompetencyTrainingSessionStatus,
} from '@/modules/hris/actions/competency-training.actions'
import { getCompetencyTrainingDetail } from '@/modules/hris/lib/competency-training.server'

function buildLearningRedirect(params: Record<string, string>, hash = 'daftar-pelatihan') {
  const search = new URLSearchParams(params)
  const query = search.toString()
  return `/lms${query ? `?${query}` : ''}#${hash}`
}

function formatTrainingTypeLabel(value: string) {
  if (value === 'EXTERNAL') return 'External'
  if (value === 'CERTIFICATION') return 'Certification'
  if (value === 'COACHING') return 'Coaching'
  return 'Internal'
}

function formatDeliveryModeLabel(value: string) {
  if (value === 'ONLINE') return 'Online'
  if (value === 'HYBRID') return 'Hybrid'
  if (value === 'ON_THE_JOB') return 'On The Job'
  return 'Classroom'
}

function formatTrainingStatusLabel(value: string) {
  if (value === 'PLANNED') return 'Direncanakan'
  if (value === 'ONGOING') return 'Berjalan'
  if (value === 'COMPLETED') return 'Selesai'
  if (value === 'ARCHIVED') return 'Arsip'
  return 'Draft'
}

function formatParticipantStatusLabel(value: string) {
  if (value === 'CONFIRMED') return 'Terkonfirmasi'
  if (value === 'IN_PROGRESS') return 'Sedang Belajar'
  if (value === 'COMPLETED') return 'Tuntas'
  if (value === 'CANCELLED') return 'Batal'
  return 'Ditugaskan'
}

function formatSessionStatusLabel(value: string) {
  if (value === 'DONE') return 'Selesai'
  if (value === 'CANCELLED') return 'Dibatalkan'
  return 'Terjadwal'
}

function formatEvaluationTypeLabel(value: string) {
  if (value === 'PRETEST') return 'Pretest'
  if (value === 'POSTTEST') return 'Posttest'
  if (value === 'OBSERVATION') return 'Observasi'
  if (value === 'CERTIFICATION') return 'Sertifikasi'
  return 'Assessment'
}

function formatEvaluationResultLabel(value: string) {
  if (value === 'PASS') return 'Lulus'
  if (value === 'REMEDIAL') return 'Remedial'
  if (value === 'FAIL') return 'Belum Lulus'
  return 'Teramati'
}

function formatDateLabel(value: string | null) {
  if (!value) return '-'
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatDateTimeLabel(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatScoreLabel(value: number | null) {
  if (value === null || value === undefined) return '-'
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
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
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{value}</div>
      <p className="mt-2 text-sm text-slate-600">{hint}</p>
    </div>
  )
}

export default async function CompetencyTrainingDetailPage(props: {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    participantSaved?: string
    participantUpdated?: string
    sessionSaved?: string
    sessionUpdated?: string
    evaluationSaved?: string
    error?: string
  }>
}) {
  noStore()

  const [{ id }, searchParams] = await Promise.all([props.params, props.searchParams])
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

  const [trainingDetail, branches] = await Promise.all([
    getCompetencyTrainingDetail(orgData.org.id, id),
    getBranches(orgData.org.id),
  ])

  if (!trainingDetail) {
    return redirect(
      buildLearningRedirect(
        { error: 'Pelatihan yang Anda buka tidak ditemukan pada entitas aktif ini.' },
        'daftar-pelatihan',
      ),
    )
  }

  const training = trainingDetail.training
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-6">
      <section
        id="overview"
        className="overflow-hidden rounded-xl border border-amber-200 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_42%),linear-gradient(135deg,#fffbeb_0%,#ffffff_46%,#f0fdfa_100%)] p-6 shadow-sm"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <Link
              href="/lms#daftar-pelatihan"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Kembali ke katalog
            </Link>

            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/90 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">
              <GraduationCap className="h-3.5 w-3.5" />
              Detail Pelatihan Internal
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">{training.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
              Workspace ini dipakai HR untuk mengelola peserta, jadwal sesi, dan hasil evaluasi per pelatihan pada
              entitas aktif.
            </p>

            <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-600">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                {formatTrainingStatusLabel(training.status)}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                {formatTrainingTypeLabel(training.trainingType)}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                {formatDeliveryModeLabel(training.deliveryMode)}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                {training.scopeType === 'BRANCH'
                  ? `Unit • ${training.branchCode || training.branchName || 'Tanpa nama'}`
                  : 'Scope Entitas Aktif'}
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-amber-200 bg-white/90 p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Skill</div>
              <div className="mt-2 text-base font-black text-slate-900">{training.skillCategory}</div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-white/90 p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Target Role</div>
              <div className="mt-2 text-base font-black text-slate-900">{training.targetRole || 'Semua role terkait'}</div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white/90 p-5">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Fasilitator</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">{training.facilitatorName || 'Belum diisi'}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white/90 p-5">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Periode</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">
              {training.startDate ? formatDateLabel(training.startDate) : 'Fleksibel'}
            </div>
            <div className="mt-1 text-sm text-slate-600">
              {training.endDate ? `sampai ${formatDateLabel(training.endDate)}` : 'tanpa tanggal selesai'}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white/90 p-5">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Durasi</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">
              {training.durationHours > 0 ? `${training.durationHours} jam` : 'Belum ditentukan'}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white/90 p-5">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Unit Target</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">
              {training.scopeType === 'BRANCH'
                ? (training.branchName || training.branchCode || 'Unit aktif')
                : 'Seluruh entitas aktif'}
            </div>
          </div>
        </div>

        {training.objective ? (
          <div className="mt-5 rounded-xl border border-slate-200 bg-white/90 p-5">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Tujuan Pelatihan</div>
            <p className="mt-3 text-sm leading-6 text-slate-700">{training.objective}</p>
          </div>
        ) : null}

        {training.notes ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white/90 p-5">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Catatan HR</div>
            <p className="mt-3 text-sm leading-6 text-slate-700">{training.notes}</p>
          </div>
        ) : null}
      </section>

      {searchParams.error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-800 shadow-sm">
          {searchParams.error}
        </section>
      ) : null}

      {searchParams.participantSaved === '1' ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-800 shadow-sm">
          Peserta berhasil ditambahkan atau diperbarui pada pelatihan ini.
        </section>
      ) : null}

      {searchParams.participantUpdated === '1' ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-800 shadow-sm">
          Status peserta berhasil diperbarui.
        </section>
      ) : null}

      {searchParams.sessionSaved === '1' ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-800 shadow-sm">
          Sesi pelatihan baru berhasil dibuat.
        </section>
      ) : null}

      {searchParams.sessionUpdated === '1' ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-800 shadow-sm">
          Status sesi berhasil diperbarui.
        </section>
      ) : null}

      {searchParams.evaluationSaved === '1' ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-800 shadow-sm">
          Evaluasi peserta berhasil disimpan.
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Peserta"
          value={String(trainingDetail.summary.participantCount)}
          hint="Karyawan yang sudah ditautkan ke pelatihan ini."
        />
        <StatCard
          label="Peserta Tuntas"
          value={String(trainingDetail.summary.completedParticipantCount)}
          hint="Peserta dengan status pelatihan selesai."
        />
        <StatCard
          label="Total Sesi"
          value={String(trainingDetail.summary.sessionCount)}
          hint={`${trainingDetail.summary.scheduledSessionCount} sesi masih berstatus terjadwal.`}
        />
        <StatCard
          label="Evaluasi"
          value={String(trainingDetail.summary.evaluationCount)}
          hint={`${trainingDetail.summary.passedCount} lulus, ${trainingDetail.summary.remedialCount} remedial.`}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div id="peserta" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-slate-700" />
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Peserta</div>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">Assignment peserta pelatihan</h2>
            </div>
          </div>

          {accessContext.canManage ? (
            <form action={assignCompetencyTrainingParticipant} className="mt-5 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
              <input type="hidden" name="trainingId" value={training.id} />
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm">
                  <div className="font-black text-slate-900">Pilih Karyawan</div>
                  <select
                    name="employeeId"
                    required
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400"
                  >
                    <option value="">Pilih peserta</option>
                    {trainingDetail.assignableEmployees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.fullName}
                        {employee.nik ? ` • ${employee.nik}` : ''}
                        {employee.branchCode
                          ? ` • ${employee.branchCode}`
                          : employee.branchName
                            ? ` • ${employee.branchName}`
                            : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  <div className="font-black text-slate-900">Status Awal</div>
                  <select
                    name="participantStatus"
                    defaultValue="ASSIGNED"
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400"
                  >
                    <option value="ASSIGNED">Assigned</option>
                    <option value="CONFIRMED">Confirmed</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </label>
              </div>

              <label className="text-sm">
                <div className="font-black text-slate-900">Catatan Assignment</div>
                <textarea
                  name="note"
                  rows={3}
                  placeholder="Misalnya batch peserta, alasan penugasan, atau jalur kompetensi."
                  className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-emerald-400"
                />
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700"
                >
                  Simpan Peserta
                </button>
                <p className="text-sm leading-6 text-slate-600">
                  Jika peserta yang sama dipilih lagi, data assignment akan diperbarui.
                </p>
              </div>
            </form>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
              Anda sedang di mode baca. Detail peserta tetap terlihat, tetapi perubahan assignment membutuhkan permission
              `learning:write`.
            </div>
          )}

          {trainingDetail.participants.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
              Belum ada peserta yang ditautkan ke pelatihan ini.
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {trainingDetail.participants.map((participant) => (
                <div key={participant.id} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="max-w-3xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                          {formatParticipantStatusLabel(participant.status)}
                        </span>
                        {participant.branchCode || participant.branchName ? (
                          <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
                            {participant.branchCode || participant.branchName}
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-3 text-lg font-semibold text-slate-900">{participant.employeeName}</h3>
                      <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-600">
                        {participant.employeeNik ? <span>NIK: {participant.employeeNik}</span> : null}
                        {participant.employeeJobTitle ? <span>Posisi: {participant.employeeJobTitle}</span> : null}
                        {participant.employeeStatus ? <span>Status HR: {participant.employeeStatus}</span> : null}
                      </div>
                      <div className="mt-3 text-sm text-slate-600">Assigned: {formatDateTimeLabel(participant.assignedAt)}</div>
                      {participant.completedAt ? (
                        <div className="mt-1 text-sm text-slate-600">Completed: {formatDateTimeLabel(participant.completedAt)}</div>
                      ) : null}
                      {participant.note ? (
                        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
                          {participant.note}
                        </div>
                      ) : null}
                      {participant.latestEvaluation ? (
                        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                          Evaluasi terbaru: {formatEvaluationResultLabel(participant.latestEvaluation.resultStatus)} •{' '}
                          {formatEvaluationTypeLabel(participant.latestEvaluation.evaluationType)} • Skor{' '}
                          {formatScoreLabel(participant.latestEvaluation.score)} •{' '}
                          {formatDateTimeLabel(participant.latestEvaluation.evaluatedAt)} oleh{' '}
                          {participant.latestEvaluation.evaluatorName}
                        </div>
                      ) : null}
                    </div>

                    {accessContext.canManage ? (
                      <form action={updateCompetencyTrainingParticipantStatus} className="w-full max-w-xs rounded-xl border border-slate-200 bg-white p-4">
                        <input type="hidden" name="trainingId" value={training.id} />
                        <input type="hidden" name="participantId" value={participant.id} />
                        <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Update Status</div>
                        <select
                          name="status"
                          defaultValue={participant.status}
                          className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400"
                        >
                          <option value="ASSIGNED">Assigned</option>
                          <option value="CONFIRMED">Confirmed</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="COMPLETED">Completed</option>
                          <option value="CANCELLED">Cancelled</option>
                        </select>
                        <button
                          type="submit"
                          className="mt-3 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition hover:bg-black"
                        >
                          Simpan Status Peserta
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <section id="sesi" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-slate-700" />
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Sesi</div>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">Jadwal pelatihan per batch</h2>
              </div>
            </div>

            {accessContext.canManage ? (
              <form action={createCompetencyTrainingSession} className="mt-5 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <input type="hidden" name="trainingId" value={training.id} />
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm">
                    <div className="font-black text-slate-900">Judul Sesi</div>
                    <input
                      name="title"
                      required
                      placeholder="Contoh: Batch 1 - Coaching Supervisor"
                      className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400"
                    />
                  </label>

                  <label className="text-sm">
                    <div className="font-black text-slate-900">Tanggal Sesi</div>
                    <input
                      type="date"
                      name="sessionDate"
                      className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400"
                    />
                  </label>

                  <label className="text-sm">
                    <div className="font-black text-slate-900">Jam Mulai</div>
                    <input
                      type="time"
                      name="startTime"
                      className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400"
                    />
                  </label>

                  <label className="text-sm">
                    <div className="font-black text-slate-900">Jam Selesai</div>
                    <input
                      type="time"
                      name="endTime"
                      className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400"
                    />
                  </label>

                  {training.scopeType === 'ORG' ? (
                    <label className="text-sm">
                      <div className="font-black text-slate-900">Unit Pelaksana</div>
                      <select
                        name="branchId"
                        defaultValue=""
                        className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400"
                      >
                        <option value="">Tanpa unit khusus / lintas unit</option>
                        {branches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.code ? `${branch.code} • ` : ''}{branch.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <div className="text-sm">
                      <div className="font-black text-slate-900">Unit Pelaksana</div>
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                        {training.branchCode ? `${training.branchCode} • ` : ''}{training.branchName || 'Unit aktif'}
                      </div>
                    </div>
                  )}

                  <label className="text-sm">
                    <div className="font-black text-slate-900">Fasilitator Sesi</div>
                    <input
                      name="facilitatorName"
                      defaultValue={training.facilitatorName || ''}
                      placeholder="Nama trainer atau coach"
                      className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400"
                    />
                  </label>

                  <label className="text-sm">
                    <div className="font-black text-slate-900">Lokasi</div>
                    <input
                      name="location"
                      placeholder="Ruang training, outlet, atau link meeting"
                      className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400"
                    />
                  </label>

                  <label className="text-sm">
                    <div className="font-black text-slate-900">Status</div>
                    <select
                      name="status"
                      defaultValue="SCHEDULED"
                      className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400"
                    >
                      <option value="SCHEDULED">Scheduled</option>
                      <option value="DONE">Done</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </label>
                </div>

                <label className="text-sm">
                  <div className="font-black text-slate-900">Catatan Sesi</div>
                  <textarea
                    name="note"
                    rows={3}
                    placeholder="Misalnya objective sesi, materi, atau catatan operasional."
                    className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-emerald-400"
                  />
                </label>

                <button
                  type="submit"
                  className="inline-flex w-fit items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white transition hover:bg-black"
                >
                  Simpan Sesi
                </button>
              </form>
            ) : null}

            {trainingDetail.sessions.length === 0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
                Belum ada sesi yang dijadwalkan untuk pelatihan ini.
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {trainingDetail.sessions.map((session) => (
                  <div key={session.id} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="max-w-3xl">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-sky-700">
                            {formatSessionStatusLabel(session.status)}
                          </span>
                          {session.branchCode || session.branchName ? (
                            <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
                              {session.branchCode || session.branchName}
                            </span>
                          ) : null}
                        </div>
                        <h3 className="mt-3 text-lg font-semibold text-slate-900">{session.title}</h3>
                        <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
                          {session.sessionDate ? (
                            <span className="inline-flex items-center gap-2">
                              <CalendarDays className="h-4 w-4" />
                              {formatDateLabel(session.sessionDate)}
                            </span>
                          ) : null}
                          {session.startTime || session.endTime ? (
                            <span className="inline-flex items-center gap-2">
                              <Clock3 className="h-4 w-4" />
                              {[session.startTime, session.endTime].filter(Boolean).join(' - ')}
                            </span>
                          ) : null}
                          {session.location ? (
                            <span className="inline-flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              {session.location}
                            </span>
                          ) : null}
                        </div>
                        {session.facilitatorName ? (
                          <div className="mt-3 text-sm text-slate-600">Fasilitator: {session.facilitatorName}</div>
                        ) : null}
                        {session.note ? (
                          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
                            {session.note}
                          </div>
                        ) : null}
                      </div>

                      {accessContext.canManage ? (
                        <form action={updateCompetencyTrainingSessionStatus} className="w-full max-w-xs rounded-xl border border-slate-200 bg-white p-4">
                          <input type="hidden" name="trainingId" value={training.id} />
                          <input type="hidden" name="sessionId" value={session.id} />
                          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Update Status</div>
                          <select
                            name="status"
                            defaultValue={session.status}
                            className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400"
                          >
                            <option value="SCHEDULED">Scheduled</option>
                            <option value="DONE">Done</option>
                            <option value="CANCELLED">Cancelled</option>
                          </select>
                          <button
                            type="submit"
                            className="mt-3 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition hover:bg-black"
                          >
                            Simpan Status Sesi
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section id="evaluasi" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <ClipboardCheck className="h-5 w-5 text-slate-700" />
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Evaluasi</div>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">Hasil observasi dan asesmen peserta</h2>
              </div>
            </div>

            {accessContext.canManage ? (
              trainingDetail.participants.length > 0 ? (
                <form action={recordCompetencyTrainingEvaluation} className="mt-5 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <input type="hidden" name="trainingId" value={training.id} />
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-sm">
                      <div className="font-black text-slate-900">Peserta</div>
                      <select
                        name="participantId"
                        required
                        className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400"
                      >
                        <option value="">Pilih peserta</option>
                        {trainingDetail.participants.map((participant) => (
                          <option key={participant.id} value={participant.id}>
                            {participant.employeeName}
                            {participant.employeeNik ? ` • ${participant.employeeNik}` : ''}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-sm">
                      <div className="font-black text-slate-900">Sesi Terkait</div>
                      <select
                        name="sessionId"
                        defaultValue=""
                        className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400"
                      >
                        <option value="">Tanpa sesi spesifik</option>
                        {trainingDetail.sessions.map((session) => (
                          <option key={session.id} value={session.id}>
                            {session.title}
                            {session.sessionDate ? ` • ${session.sessionDate}` : ''}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-sm">
                      <div className="font-black text-slate-900">Jenis Evaluasi</div>
                      <select
                        name="evaluationType"
                        defaultValue="ASSESSMENT"
                        className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400"
                      >
                        <option value="ASSESSMENT">Assessment</option>
                        <option value="PRETEST">Pretest</option>
                        <option value="POSTTEST">Posttest</option>
                        <option value="OBSERVATION">Observation</option>
                        <option value="CERTIFICATION">Certification</option>
                      </select>
                    </label>

                    <label className="text-sm">
                      <div className="font-black text-slate-900">Hasil</div>
                      <select
                        name="resultStatus"
                        defaultValue="OBSERVED"
                        className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400"
                      >
                        <option value="OBSERVED">Observed</option>
                        <option value="PASS">Pass</option>
                        <option value="REMEDIAL">Remedial</option>
                        <option value="FAIL">Fail</option>
                      </select>
                    </label>

                    <label className="text-sm">
                      <div className="font-black text-slate-900">Skor</div>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        name="score"
                        placeholder="0 - 100"
                        className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400"
                      />
                    </label>

                    <label className="text-sm">
                      <div className="font-black text-slate-900">Tanggal Evaluasi</div>
                      <input
                        type="date"
                        name="evaluatedAt"
                        defaultValue={today}
                        className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400"
                      />
                    </label>
                  </div>

                  <label className="text-sm">
                    <div className="font-black text-slate-900">Catatan Evaluasi</div>
                    <textarea
                      name="note"
                      rows={3}
                      placeholder="Tuliskan observasi, poin remedial, atau hasil assessment peserta."
                      className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-emerald-400"
                    />
                  </label>

                  <button
                    type="submit"
                    className="inline-flex w-fit items-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-400"
                  >
                    Simpan Evaluasi
                  </button>
                </form>
              ) : (
                <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
                  Tambahkan peserta terlebih dulu sebelum merekam evaluasi.
                </div>
              )
            ) : null}

            {trainingDetail.evaluations.length === 0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
                Belum ada evaluasi yang terekam untuk pelatihan ini.
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {trainingDetail.evaluations.map((evaluation) => (
                  <div key={evaluation.id} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-700">
                        {formatEvaluationResultLabel(evaluation.resultStatus)}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
                        {formatEvaluationTypeLabel(evaluation.evaluationType)}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
                        Skor {formatScoreLabel(evaluation.score)}
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-slate-900">{evaluation.participantName}</h3>
                    <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-600">
                      {evaluation.participantNik ? <span>NIK: {evaluation.participantNik}</span> : null}
                      {evaluation.sessionTitle ? <span>Sesi: {evaluation.sessionTitle}</span> : null}
                      <span>Penilai: {evaluation.evaluatorName}</span>
                    </div>
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-600">
                      <Sparkles className="h-3.5 w-3.5" />
                      {formatDateTimeLabel(evaluation.evaluatedAt)}
                    </div>
                    {evaluation.note ? (
                      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
                        {evaluation.note}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  )
}
