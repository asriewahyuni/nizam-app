'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Plus, Trash2, Loader2 } from 'lucide-react'
import { saveAssessmentTemplate } from '@/modules/edu/actions/training-assessment-template.actions'
import type { TrainingAssessmentTemplate, TrainingAssessmentTask } from '@/modules/edu/lib/training-assessment-mvp'

// ── Mini Components ──

function SectionHeader({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <span className="text-xl">{icon}</span>
      <div>
        <h3 className="text-base font-semibold text-slate-800">{title}</h3>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </div>
  )
}

function ArrayFieldGroup({
  label,
  values,
  onChange,
  placeholder,
  multiline = true,
}: {
  label: string
  values: string[]
  onChange: (values: string[]) => void
  placeholder: string
  multiline?: boolean
}) {
  function updateItem(index: number, value: string) {
    const next = [...values]
    next[index] = value
    onChange(next)
  }

  function removeItem(index: number) {
    const next = values.filter((_, i) => i !== index)
    onChange(next.length === 0 ? [''] : next)
  }

  function addItem() {
    onChange([...values, ''])
  }

  const inputClasses = 'w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none transition-all'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</label>
        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700"
        >
          <Plus size={12} /> Tambah
        </button>
      </div>
      <div className="space-y-2">
        {values.map((val, i) => (
          <div key={i} className="flex items-start gap-2 group">
            <span className="mt-2.5 text-[10px] font-mono text-slate-400 w-5 text-right shrink-0">
              {i + 1}.
            </span>
            {multiline ? (
              <textarea
                value={val}
                onChange={(e) => updateItem(i, e.target.value)}
                placeholder={placeholder}
                rows={2}
                className={inputClasses}
              />
            ) : (
              <input
                type="text"
                value={val}
                onChange={(e) => updateItem(i, e.target.value)}
                placeholder={placeholder}
                className={inputClasses}
              />
            )}
            <button
              type="button"
              onClick={() => removeItem(i)}
              className="mt-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shrink-0"
              title="Hapus item"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function PracticalTaskFields({
  tasks,
  onChange,
}: {
  tasks: TrainingAssessmentTask[]
  onChange: (tasks: TrainingAssessmentTask[]) => void
}) {
  function updateTask(index: number, field: keyof TrainingAssessmentTask, value: string) {
    const next = [...tasks]
    next[index] = { ...next[index], [field]: value }
    onChange(next)
  }

  function removeTask(index: number) {
    const next = tasks.filter((_, i) => i !== index)
    onChange(next.length === 0 ? [{ title: '', instruction: '', expectedEvidence: '' }] : next)
  }

  function addTask() {
    onChange([...tasks, { title: '', instruction: '', expectedEvidence: '' }])
  }

  const inputClasses = 'w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none transition-all'

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Tugas Praktik / Unjuk Kerja</label>
        <button
          type="button"
          onClick={addTask}
          className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700"
        >
          <Plus size={12} /> Tambah Tugas
        </button>
      </div>
      <div className="space-y-4">
        {tasks.map((task, i) => (
          <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-3 group relative">
            {/* Remove button */}
            <button
              type="button"
              onClick={() => removeTask(i)}
              className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
              title="Hapus tugas"
            >
              <Trash2 size={14} />
            </button>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Tugas #{i + 1}</span>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Judul Tugas</label>
              <input
                type="text"
                value={task.title}
                onChange={(e) => updateTask(i, 'title', e.target.value)}
                placeholder="Contoh: Menentukan Jalur Akses"
                className={`${inputClasses} mt-1`}
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Instruksi</label>
              <textarea
                value={task.instruction}
                onChange={(e) => updateTask(i, 'instruction', e.target.value)}
                placeholder="Apa yang harus dilakukan peserta..."
                rows={2}
                className={`${inputClasses} mt-1`}
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bukti yang Diharapkan</label>
              <textarea
                value={task.expectedEvidence}
                onChange={(e) => updateTask(i, 'expectedEvidence', e.target.value)}
                placeholder="Apa yang menjadi bukti keberhasilan..."
                rows={2}
                className={`${inputClasses} mt-1`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Editor Component ──

export function AssessmentTemplateEditor({
  courseSlug,
  template,
}: {
  courseSlug: string
  template: TrainingAssessmentTemplate
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  // Editable state
  const [documentTitle, setDocumentTitle] = useState(template.documentTitle)
  const [version, setVersion] = useState(template.version)
  const [effectiveDate, setEffectiveDate] = useState(template.effectiveDate)
  const [purpose, setPurpose] = useState(template.purpose)
  const [methods, setMethods] = useState<string[]>(template.methods.length ? template.methods : [''])
  const [competentWhen, setCompetentWhen] = useState<string[]>(template.competentWhen.length ? template.competentWhen : [''])
  const [notYetCompetentWhen, setNotYetCompetentWhen] = useState<string[]>(template.notYetCompetentWhen.length ? template.notYetCompetentWhen : [''])
  const [theoryQuestions, setTheoryQuestions] = useState<string[]>(template.theoryQuestions.length ? template.theoryQuestions : [''])
  const [answerGuide, setAnswerGuide] = useState<string[]>(template.answerGuide.length ? template.answerGuide : [''])
  const [practicalTasks, setPracticalTasks] = useState<TrainingAssessmentTask[]>(
    template.practicalTasks.length ? template.practicalTasks : [{ title: '', instruction: '', expectedEvidence: '' }],
  )
  const [performanceChecklist, setPerformanceChecklist] = useState<string[]>(template.performanceChecklist.length ? template.performanceChecklist : [''])
  const [evidenceChecklist, setEvidenceChecklist] = useState<string[]>(template.evidenceChecklist.length ? template.evidenceChecklist : [''])
  const [followUpGuidance, setFollowUpGuidance] = useState<string[]>(template.followUpGuidance.length ? template.followUpGuidance : [''])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const formData = new FormData()
    formData.append('documentTitle', documentTitle)
    formData.append('version', version)
    formData.append('effectiveDate', effectiveDate)
    formData.append('purpose', purpose)
    methods.forEach((v, i) => formData.append(`methods_${i}`, v))
    competentWhen.forEach((v, i) => formData.append(`competentWhen_${i}`, v))
    notYetCompetentWhen.forEach((v, i) => formData.append(`notYetCompetentWhen_${i}`, v))
    theoryQuestions.forEach((v, i) => formData.append(`theoryQuestions_${i}`, v))
    answerGuide.forEach((v, i) => formData.append(`answerGuide_${i}`, v))
    practicalTasks.forEach((t, i) => {
      formData.append(`practicalTasks_${i}_title`, t.title)
      formData.append(`practicalTasks_${i}_instruction`, t.instruction)
      formData.append(`practicalTasks_${i}_expectedEvidence`, t.expectedEvidence)
    })
    performanceChecklist.forEach((v, i) => formData.append(`performanceChecklist_${i}`, v))
    evidenceChecklist.forEach((v, i) => formData.append(`evidenceChecklist_${i}`, v))
    followUpGuidance.forEach((v, i) => formData.append(`followUpGuidance_${i}`, v))

    try {
      const result = await saveAssessmentTemplate(courseSlug, formData)
      if (result.success) {
        router.push(`/lms/admin/assessment-templates/${courseSlug}?saved=1`)
        router.refresh()
      } else {
        router.push(`/lms/admin/assessment-templates/${courseSlug}?error=${encodeURIComponent(result.error || 'Unknown error')}`)
      }
    } catch {
      router.push(`/lms/admin/assessment-templates/${courseSlug}?error=Terjadi kesalahan`)
    } finally {
      setSaving(false)
    }
  }

  const sectionClass = 'rounded-xl border border-slate-100 bg-white p-6 shadow-sm space-y-4'
  const labelClass = 'text-[10px] font-bold uppercase tracking-wide text-slate-400'
  const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none transition-all'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── Document Info ── */}
      <div className={sectionClass}>
        <SectionHeader icon="📄" title="Informasi Dokumen" description="Judul, versi, dan tanggal berlaku lembar asesmen." />
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Judul Dokumen</label>
            <input
              type="text"
              value={documentTitle}
              onChange={(e) => setDocumentTitle(e.target.value)}
              placeholder="Lembar Asesmen Level 1 · Course Name"
              className={`${inputClass} mt-1`}
            />
          </div>
          <div>
            <label className={labelClass}>Versi</label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.0"
              className={`${inputClass} mt-1`}
            />
          </div>
          <div>
            <label className={labelClass}>Tanggal Berlaku</label>
            <input
              type="text"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              placeholder="24 April 2026"
              className={`${inputClass} mt-1`}
            />
          </div>
        </div>
        <div>
          <label className={labelClass}>Tujuan Asesmen</label>
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="Menilai kemampuan peserta..."
            rows={3}
            className={`${inputClass} mt-1`}
          />
        </div>
      </div>

      {/* ── Metode Asesmen ── */}
      <div className={sectionClass}>
        <SectionHeader icon="🔍" title="Metode Asesmen" description="Bagaimana penilaian akan dilakukan." />
        <ArrayFieldGroup
          label="Metode"
          values={methods}
          onChange={setMethods}
          placeholder="Contoh: Tes teori singkat tentang..."
          multiline
        />
      </div>

      {/* ── Kriteria Kompetensi ── */}
      <div className={sectionClass}>
        <SectionHeader icon="✅" title="Kriteria Kompetensi" description="Kapan peserta dinyatakan kompeten atau belum." />
        <div className="grid gap-6 md:grid-cols-2">
          <ArrayFieldGroup
            label="Kompeten Jika"
            values={competentWhen}
            onChange={setCompetentWhen}
            placeholder="Peserta mampu..."
            multiline
          />
          <ArrayFieldGroup
            label="Belum Kompeten Jika"
            values={notYetCompetentWhen}
            onChange={setNotYetCompetentWhen}
            placeholder="Peserta masih bingung..."
            multiline
          />
        </div>
      </div>

      {/* ── Pertanyaan Teori ── */}
      <div className={sectionClass}>
        <SectionHeader icon="💬" title="Pertanyaan Teori & Kunci Jawaban" description="Pertanyaan acuan untuk assessor beserta panduan jawaban." />
        <div className="grid gap-6 md:grid-cols-2">
          <ArrayFieldGroup
            label="Pertanyaan Teori"
            values={theoryQuestions}
            onChange={setTheoryQuestions}
            placeholder="Apa perbedaan..."
            multiline
          />
          <ArrayFieldGroup
            label="Panduan Jawaban"
            values={answerGuide}
            onChange={setAnswerGuide}
            placeholder="Jawaban yang diharapkan..."
            multiline
          />
        </div>
      </div>

      {/* ── Tugas Praktik ── */}
      <div className={sectionClass}>
        <SectionHeader icon="🛠️" title="Tugas Praktik / Unjuk Kerja" description="Tugas yang harus didemonstrasikan peserta." />
        <PracticalTaskFields tasks={practicalTasks} onChange={setPracticalTasks} />
      </div>

      {/* ── Checklist ── */}
      <div className={sectionClass}>
        <SectionHeader icon="📋" title="Checklist & Bukti" description="Daftar cek unjuk kerja dan bukti yang dikumpulkan." />
        <div className="grid gap-6 md:grid-cols-2">
          <ArrayFieldGroup
            label="Checklist Unjuk Kerja"
            values={performanceChecklist}
            onChange={setPerformanceChecklist}
            placeholder="Mampu membedakan..."
            multiline
          />
          <ArrayFieldGroup
            label="Daftar Bukti"
            values={evidenceChecklist}
            onChange={setEvidenceChecklist}
            placeholder="Screenshot halaman..."
            multiline
          />
        </div>
      </div>

      {/* ── Tindak Lanjut ── */}
      <div className={sectionClass}>
        <SectionHeader icon="🔄" title="Panduan Tindak Lanjut" description="Apa yang harus dilakukan setelah asesmen untuk tiap hasil." />
        <ArrayFieldGroup
          label="Tindak Lanjut"
          values={followUpGuidance}
          onChange={setFollowUpGuidance}
          placeholder="Jika belum kompeten, ulangi..."
          multiline
        />
      </div>

      {/* ── Submit ── */}
      <div className="sticky bottom-0 bg-white/90 backdrop-blur border-t border-slate-200 -mx-6 px-6 py-4 rounded-b-2xl flex items-center justify-between">
        <p className="text-xs text-slate-400">
          Template disimpan per organisasi. Hanya admin LMS yang bisa mengubah.
        </p>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-black disabled:opacity-50 transition-all shadow-lg shadow-slate-200"
        >
          {saving ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Menyimpan...
            </>
          ) : (
            <>
              <Save size={18} /> Simpan Template
            </>
          )}
        </button>
      </div>
    </form>
  )
}
