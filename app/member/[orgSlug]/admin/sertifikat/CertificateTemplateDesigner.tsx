'use client'

/**
 * Desainer template sertifikat berbasis form dengan pratinjau langsung.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Award, CheckCircle2, FilePlus2, LoaderCircle, Save } from 'lucide-react'
import {
  saveCertificateTemplate,
  type CertificateTemplateAdminItem,
} from '@/modules/lms/actions/certificate.actions'

type DesignerState = Omit<CertificateTemplateAdminItem, 'issuedCount'> & {
  issuedCount?: number
}

function emptyTemplate(): DesignerState {
  return {
    id: '',
    name: 'Sertifikat Kelulusan',
    heading: 'SERTIFIKAT KELULUSAN',
    statement: 'Diberikan dengan hormat kepada',
    primaryColor: '#047857',
    accentColor: '#F97316',
    numberingPattern: 'CERT/{YYYY}/{SEQ}',
    validityDays: null,
    isDefault: false,
    signers: [
      { name: '', title: 'Direktur Program' },
      { name: '', title: 'Tutor Utama' },
    ],
  }
}

export default function CertificateTemplateDesigner({
  orgSlug,
  templates,
}: {
  orgSlug: string
  templates: CertificateTemplateAdminItem[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState<DesignerState>(templates[0] || emptyTemplate())
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function chooseTemplate(id: string) {
    const template = templates.find((item) => item.id === id)
    setForm(template || emptyTemplate())
    setMessage('')
    setError('')
  }

  function updateSigner(index: number, field: 'name' | 'title', value: string) {
    setForm((current) => {
      const signers = [...current.signers]
      signers[index] = {
        name: signers[index]?.name || '',
        title: signers[index]?.title || '',
        [field]: value,
      }
      return { ...current, signers }
    })
  }

  function save() {
    setMessage('')
    setError('')
    startTransition(async () => {
      const response = await saveCertificateTemplate({
        orgSlug,
        id: form.id || undefined,
        name: form.name,
        heading: form.heading,
        statement: form.statement,
        primaryColor: form.primaryColor,
        accentColor: form.accentColor,
        numberingPattern: form.numberingPattern,
        validityDays: form.validityDays,
        isDefault: form.isDefault,
        signers: form.signers,
      })
      if ('error' in response && response.error) {
        setError(response.error)
        return
      }
      setForm((current) => ({ ...current, id: response.id || current.id }))
      setMessage('Template tersimpan dan siap dipakai untuk penerbitan berikutnya.')
      router.refresh()
    })
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
      <section aria-labelledby="designer-heading" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              Pengaturan
            </p>
            <h2 id="designer-heading" className="mt-1 text-xl font-bold text-slate-950">
              Desain template
            </h2>
          </div>
          <button
            type="button"
            onClick={() => chooseTemplate('')}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-3 text-sm font-bold text-slate-700 transition-colors duration-200 hover:border-emerald-400 hover:bg-emerald-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
          >
            <FilePlus2 aria-hidden="true" size={18} />
            Baru
          </button>
        </div>

        {templates.length > 0 && (
          <label className="mt-5 block">
            <span className="text-sm font-bold text-slate-800">Template tersimpan</span>
            <select
              value={form.id}
              onChange={(event) => chooseTemplate(event.target.value)}
              className="mt-2 min-h-11 w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
            >
              <option value="">Template baru</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}{template.isDefault ? ' — default' : ''}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-sm font-bold text-slate-800">Nama template</span>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-slate-800">Judul sertifikat</span>
            <input
              value={form.heading}
              onChange={(event) => setForm((current) => ({ ...current, heading: event.target.value }))}
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-slate-800">Kalimat pengantar</span>
            <input
              value={form.statement}
              onChange={(event) => setForm((current) => ({ ...current, statement: event.target.value }))}
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-bold text-slate-800">Warna utama</span>
              <span className="mt-2 flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-2">
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    primaryColor: event.target.value.toUpperCase(),
                  }))}
                  className="size-11 cursor-pointer rounded border-0 bg-transparent"
                  aria-label="Pilih warna utama"
                />
                <span className="text-xs font-mono text-slate-600">{form.primaryColor}</span>
              </span>
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-800">Warna aksen</span>
              <span className="mt-2 flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-2">
                <input
                  type="color"
                  value={form.accentColor}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    accentColor: event.target.value.toUpperCase(),
                  }))}
                  className="size-11 cursor-pointer rounded border-0 bg-transparent"
                  aria-label="Pilih warna aksen"
                />
                <span className="text-xs font-mono text-slate-600">{form.accentColor}</span>
              </span>
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-bold text-slate-800">Pola nomor</span>
            <input
              value={form.numberingPattern}
              onChange={(event) => setForm((current) => ({
                ...current,
                numberingPattern: event.target.value,
              }))}
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 font-mono text-sm outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
            />
            <span className="mt-1 block text-xs text-slate-500">
              Wajib memuat {'{SEQ}'}. Variabel tersedia: {'{YYYY}'}, {'{MM}'}, dan {'{SEQ}'}.
            </span>
          </label>
          <label className="block">
            <span className="text-sm font-bold text-slate-800">Masa berlaku (hari)</span>
            <input
              type="number"
              min={1}
              value={form.validityDays ?? ''}
              onChange={(event) => setForm((current) => ({
                ...current,
                validityDays: event.target.value ? Number(event.target.value) : null,
              }))}
              placeholder="Kosong berarti tidak kedaluwarsa"
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
            />
          </label>

          {[0, 1].map((index) => (
            <fieldset key={index} className="rounded-xl border border-slate-200 p-3">
              <legend className="px-1 text-sm font-bold text-slate-800">
                Penanda tangan {index + 1}
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="text-xs font-semibold text-slate-600">Nama</span>
                  <input
                    value={form.signers[index]?.name || ''}
                    onChange={(event) => updateSigner(index, 'name', event.target.value)}
                    className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>
                <label>
                  <span className="text-xs font-semibold text-slate-600">Jabatan</span>
                  <input
                    value={form.signers[index]?.title || ''}
                    onChange={(event) => updateSigner(index, 'title', event.target.value)}
                    className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>
              </div>
            </fieldset>
          ))}

          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-slate-50 px-3">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(event) => setForm((current) => ({
                ...current,
                isDefault: event.target.checked,
              }))}
              className="size-4 accent-emerald-700"
            />
            <span className="text-sm font-bold text-slate-800">
              Jadikan template default organisasi
            </span>
          </label>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="mt-5 inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white transition-colors duration-200 hover:bg-emerald-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isPending
            ? <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" size={18} />
            : <Save aria-hidden="true" size={18} />}
          Simpan template
        </button>
        {message && (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900" role="status">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
            {message}
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800" role="alert">
            {error}
          </p>
        )}
      </section>

      <section aria-labelledby="preview-heading" className="min-w-0">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="preview-heading" className="text-xl font-bold text-emerald-950">
            Pratinjau langsung
          </h2>
          {form.issuedCount != null && (
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 shadow-sm">
              {form.issuedCount} pernah diterbitkan
            </span>
          )}
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100 p-4 shadow-inner">
          <div
            className="relative mx-auto aspect-[1.414/1] min-w-[680px] overflow-hidden rounded-sm bg-white p-10 shadow-lg"
            style={{ border: `10px solid ${form.primaryColor}` }}
          >
            <div
              className="absolute inset-x-0 top-0 h-3"
              style={{ backgroundColor: form.accentColor }}
            />
            <div
              className="absolute -right-20 -top-20 size-64 rounded-full opacity-10"
              style={{ backgroundColor: form.primaryColor }}
            />
            <div className="relative flex h-full flex-col items-center text-center">
              <span
                className="flex size-14 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: form.primaryColor }}
              >
                <Award aria-hidden="true" size={30} />
              </span>
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.34em] text-slate-500">
                CORe Islamic Economics
              </p>
              <h3
                className="mt-3 text-3xl font-black tracking-wide"
                style={{ color: form.primaryColor }}
              >
                {form.heading || 'SERTIFIKAT KELULUSAN'}
              </h3>
              <p className="mt-7 text-sm text-slate-500">
                {form.statement || 'Diberikan dengan hormat kepada'}
              </p>
              <p className="mt-3 border-b-2 px-12 pb-2 text-3xl font-bold text-slate-950" style={{ borderColor: form.accentColor }}>
                Nama Peserta
              </p>
              <p className="mt-5 max-w-xl text-sm leading-6 text-slate-600">
                atas kelulusan dalam <strong>Nama Program Pembelajaran</strong>
              </p>
              <div className="mt-auto grid w-full grid-cols-2 gap-16 px-14">
                {[0, 1].map((index) => (
                  <div key={index} className="border-t border-slate-400 pt-2 text-xs">
                    <p className="font-bold text-slate-900">
                      {form.signers[index]?.name || 'Nama Penanda Tangan'}
                    </p>
                    <p className="mt-1 text-slate-500">
                      {form.signers[index]?.title || 'Jabatan'}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-5 font-mono text-[10px] text-slate-500">
                {form.numberingPattern
                  .replace('{YYYY}', String(new Date().getFullYear()))
                  .replace('{MM}', String(new Date().getMonth() + 1).padStart(2, '0'))
                  .replace('{SEQ}', '000001')}
              </p>
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          PDF final juga memuat QR verifikasi publik dan token unik. Pratinjau ini
          menampilkan tata letak utama, bukan ukuran cetak sebenarnya.
        </p>
      </section>
    </div>
  )
}
