'use client'

import Link from 'next/link'
import React, { startTransition, useState, useTransition } from 'react'
import {
  BarChart3,
  Building2,
  Calendar,
  ClipboardList,
  Hammer,
  MapPin,
  Plus,
  Wallet,
  X,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { formatDate, formatRupiah } from '@/lib/utils'
import { createConstructionProject } from '@/modules/construction/actions/construction.actions'
import type {
  ConstructionDashboardSummary,
  ConstructionProjectRecord,
} from '@/modules/construction/lib/construction'

type ContactOption = {
  id: string
  name: string
  type: string
}

type ConstructionClientProps = {
  orgId: string
  projects: ConstructionProjectRecord[]
  dashboard: ConstructionDashboardSummary
  contacts: ContactOption[]
}

const statusStyles: Record<string, string> = {
  PLANNING: 'bg-amber-50 text-amber-700 border-amber-200',
  TENDER: 'bg-stone-100 text-stone-700 border-stone-200',
  DESIGN: 'bg-sky-50 text-sky-700 border-sky-200',
  EXECUTION: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  HANDOVER: 'bg-orange-50 text-orange-700 border-orange-200',
  COMPLETED: 'bg-slate-100 text-slate-700 border-slate-200',
  ON_HOLD: 'bg-rose-50 text-rose-700 border-rose-200',
  CANCELLED: 'bg-slate-100 text-slate-500 border-slate-200',
}

const projectTypeLabels: Record<string, string> = {
  ARCHITECT: 'Arsitek',
  CONTRACTOR: 'Kontraktor',
  DESIGN_BUILD: 'Design & Build',
  INTERIOR: 'Interior',
  CONSULTING: 'Konsultan',
}

export function ConstructionClient({
  orgId,
  projects,
  dashboard,
  contacts,
}: ConstructionClientProps) {
  const router = useRouter()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formError, setFormError] = useState('')
  const [isPending, startCreateTransition] = useTransition()

  const handleCreateProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    setFormError('')

    startCreateTransition(async () => {
      const result = await createConstructionProject(orgId, formData)
      if (result.error) {
        setFormError(result.error)
        return
      }

      form.reset()
      setShowCreateModal(false)
      startTransition(() => {
        router.refresh()
      })
    })
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <section className="relative overflow-hidden rounded-2xl border border-[#d7d2c9] bg-[radial-gradient(circle_at_top_left,_rgba(224,122,95,0.24),_transparent_35%),linear-gradient(135deg,_#17324d_0%,_#254b63_48%,_#e8dcc8_140%)] px-6 py-7 text-white shadow-xl shadow-slate-900/10 md:px-8 md:py-9">
        <div className="absolute right-0 top-0 h-48 w-48 translate-x-10 -translate-y-10 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-white/80">
              <Building2 size={14} />
              Vertical Baru
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
              Project & Construction
            </h1>
            <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-white/80">
              Pondasi awal untuk arsitek dan kontraktor sudah aktif: project master, stage default,
              schema RAB/BoQ, progress log lapangan, dan termin billing.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#e07a5f] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#e07a5f]/30 transition hover:bg-[#cf694c]"
          >
            <Plus size={18} />
            Buat Project Baru
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Total Project</div>
            <Building2 className="text-[#254b63]" size={18} />
          </div>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{dashboard.totalProjects}</div>
          <p className="mt-2 text-sm font-medium text-slate-500">
            {dashboard.activeProjects} masih berjalan, {dashboard.completedProjects} sudah selesai.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Nilai Kontrak</div>
            <Wallet className="text-[#e07a5f]" size={18} />
          </div>
          <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
            {formatRupiah(dashboard.totalContractValue)}
          </div>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Akumulasi contract value dari seluruh project pada unit aktif.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Estimasi Cost</div>
            <ClipboardList className="text-[#3b6b5a]" size={18} />
          </div>
          <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
            {formatRupiah(dashboard.totalEstimatedCost)}
          </div>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Baseline biaya awal yang nantinya dibandingkan dengan actual.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Progress Rata-rata</div>
            <BarChart3 className="text-[#6a8d73]" size={18} />
          </div>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {dashboard.averageProgress.toFixed(1)}%
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#254b63] via-[#3b6b5a] to-[#e07a5f]"
              style={{ width: `${Math.min(Math.max(dashboard.averageProgress, 0), 100)}%` }}
            />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.45fr_0.95fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Portofolio</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Daftar Project Aktif</h2>
              <p className="mt-2 text-sm font-medium text-slate-500">
                Dashboard ini sengaja dimulai dari project register dulu, lalu siap ditautkan ke RAB,
                progress lapangan, purchasing, inventory, dan termin billing.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {projects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
                <Hammer className="mx-auto text-slate-300" size={44} />
                <div className="mt-4 text-lg font-semibold text-slate-900">Belum ada project konstruksi</div>
                <p className="mt-2 text-sm font-medium text-slate-500">
                  Buat project pertama untuk mulai menyusun alur arsitek atau kontraktor di unit aktif.
                </p>
              </div>
            ) : (
              projects.map((project) => (
                <article
                  key={project.id}
                  className="rounded-xl border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#fbfaf8_100%)] p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${statusStyles[project.projectStatus] || statusStyles.PLANNING}`}>
                          {project.projectStatus}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                          {projectTypeLabels[project.projectType] || project.projectType}
                        </span>
                        <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                          {project.projectCode}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-xl font-semibold tracking-tight text-slate-900">
                          {project.projectName}
                        </h3>
                        <p className="mt-1 text-sm font-medium text-slate-500">
                          {project.clientName || 'Belum ditautkan ke kontak klien'}
                        </p>
                      </div>
                    </div>

                    <div className="min-w-[168px] rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                        Progress
                      </div>
                      <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                        {project.progressPercent.toFixed(0)}%
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-[#254b63]"
                          style={{ width: `${Math.min(Math.max(project.progressPercent, 0), 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-3 text-sm text-slate-600 md:grid-cols-3">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="flex items-center gap-2 text-slate-400">
                        <MapPin size={14} />
                        Lokasi
                      </div>
                      <div className="mt-2 font-bold text-slate-800">
                        {project.siteAddress || 'Alamat proyek belum diisi'}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Calendar size={14} />
                        Timeline
                      </div>
                      <div className="mt-2 font-bold text-slate-800">
                        {project.startDate ? formatDate(project.startDate) : 'Mulai TBD'}
                      </div>
                      <div className="text-xs font-medium text-slate-500">
                        Target: {project.targetEndDate ? formatDate(project.targetEndDate) : 'Belum ada'}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Building2 size={14} />
                        Unit
                      </div>
                      <div className="mt-2 font-bold text-slate-800">
                        {project.branchName || 'Unit tidak diketahui'}
                      </div>
                      <div className="text-xs font-medium text-slate-500">
                        {project.branchCode || 'Tanpa kode unit'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-[#e7ddd0] bg-[#fff8f2] px-4 py-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#b06a48]">
                        Contract Value
                      </div>
                      <div className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
                        {formatRupiah(project.contractValue)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[#d4e5df] bg-[#f5fbf8] px-4 py-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#3b6b5a]">
                        Estimated Cost
                      </div>
                      <div className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
                        {formatRupiah(project.estimatedCost)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex justify-end">
                    <Link
                      href={`/construction/${project.id}`}
                      className="inline-flex items-center gap-2 rounded-2xl bg-[#254b63] px-4 py-3 text-sm font-black text-white transition hover:bg-[#1e3d52]"
                    >
                      Lihat Detail Project
                    </Link>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Fondasi Siap Pakai</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Schema Konstruksi Sudah Disiapkan</h2>
            <div className="mt-5 space-y-3 text-sm font-medium text-slate-600">
              <div className="rounded-2xl bg-slate-50 px-4 py-3"><code className="font-mono text-[12px] font-black text-slate-700">construction_projects</code> untuk master proyek dan register kontrak.</div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3"><code className="font-mono text-[12px] font-black text-slate-700">construction_project_stages</code> untuk breakdown tahap dan bobot pekerjaan.</div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3"><code className="font-mono text-[12px] font-black text-slate-700">construction_budget_items</code> untuk baseline RAB/BoQ dan actual cost.</div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3"><code className="font-mono text-[12px] font-black text-slate-700">construction_progress_logs</code> untuk update lapangan, isu, dan bukti progres.</div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3"><code className="font-mono text-[12px] font-black text-slate-700">construction_billing_terms</code> untuk DP, termin progress, final, dan retensi.</div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-[linear-gradient(180deg,_#fff7ed_0%,_#ffffff_100%)] p-6 shadow-sm">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#b06a48]">Next Step</div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Tahap Berikutnya Tinggal Disambung</h2>
            <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
              Setelah fondasi ini, kita bisa lanjut ke detail proyek, editor RAB/BoQ, log progres harian,
              approval change order, lalu termin billing yang terhubung ke sales dan accounting.
            </p>
          </div>
        </aside>
      </section>

      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
            onClick={() => setShowCreateModal(false)}
            aria-label="Tutup modal"
          />

          <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Project Baru</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Buat Project Konstruksi</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-2xl bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200"
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-5 px-6 py-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Nama Project</span>
                  <input
                    name="project_name"
                    required
                    placeholder="Contoh: Rumah Tinggal Bukit Asri"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Kode Project</span>
                  <input
                    name="project_code"
                    placeholder="Kosongkan agar otomatis"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Tipe</span>
                  <select
                    name="project_type"
                    defaultValue="CONTRACTOR"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  >
                    <option value="ARCHITECT">Arsitek</option>
                    <option value="CONTRACTOR">Kontraktor</option>
                    <option value="DESIGN_BUILD">Design &amp; Build</option>
                    <option value="INTERIOR">Interior</option>
                    <option value="CONSULTING">Konsultan</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Status Awal</span>
                  <select
                    name="project_status"
                    defaultValue="PLANNING"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  >
                    <option value="PLANNING">Planning</option>
                    <option value="TENDER">Tender</option>
                    <option value="DESIGN">Design</option>
                    <option value="EXECUTION">Execution</option>
                    <option value="HANDOVER">Handover</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Klien</span>
                  <select
                    name="client_contact_id"
                    defaultValue=""
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  >
                    <option value="">Belum ditautkan</option>
                    {contacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name}{contact.type ? ` (${contact.type})` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Alamat Site</span>
                <textarea
                  name="site_address"
                  placeholder="Alamat proyek / lokasi lapangan"
                  className="h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                />
              </label>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Tanggal Mulai</span>
                  <input
                    name="start_date"
                    type="date"
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Target Selesai</span>
                  <input
                    name="target_end_date"
                    type="date"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Nilai Kontrak</span>
                  <input
                    name="contract_value"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Estimasi Cost</span>
                  <input
                    name="estimated_cost"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  />
                </label>
              </div>

              <label className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Catatan</span>
                <textarea
                  name="notes"
                  placeholder="Catatan awal, scope singkat, atau arahan kickoff"
                  className="h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                />
              </label>

              {formError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                  {formError}
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 md:flex-row md:justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-2xl bg-[#254b63] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#254b63]/20 transition hover:bg-[#1e3d52] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? 'Menyimpan...' : 'Simpan Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
