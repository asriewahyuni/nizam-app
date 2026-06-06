'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import {
  User, Phone, MapPin, Briefcase, FileText, Upload,
  CheckCircle, ChevronRight, Loader2, X, Eye
} from 'lucide-react'
import {
  buatPendaftaran,
  simpanDokumenPendaftaran,
  type KojasmatDokumen,
} from '@/modules/kojasmat/actions/kojasmat-membership.actions'

// ─── TYPES ────────────────────────────────────────────────────────────────────

type Step = 'data' | 'dokumen' | 'selesai'

type FormData = {
  nama_lengkap: string
  nik: string
  email: string
  phone: string
  alamat: string
  pekerjaan: string
  alasan_bergabung: string
}

type DokumenUploaded = {
  jenis: KojasmatDokumen['jenis_dokumen']
  nama_file: string
  file_key: string
  file_size: number
}

const JENIS_DOK: { value: KojasmatDokumen['jenis_dokumen']; label: string; wajib?: boolean }[] = [
  { value: 'KTP',            label: 'KTP',               wajib: true  },
  { value: 'PASSPORT',       label: 'Paspor',             wajib: false },
  { value: 'SURAT_USAHA',   label: 'Surat Izin Usaha',   wajib: false },
  { value: 'FOTO_USAHA',    label: 'Foto Usaha',         wajib: false },
  { value: 'LAINNYA',        label: 'Dokumen Lain',       wajib: false },
]

// ─── UPLOAD HELPER ────────────────────────────────────────────────────────────

async function uploadFile(
  file: File, orgId: string
): Promise<{ key: string; name: string; size: number } | null> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('org_id', orgId)
  fd.append('ref_type', 'PENDAFTARAN')
  const res = await fetch('/api/kojasmat/upload', { method: 'POST', body: fd })
  if (!res.ok) return null
  const data = await res.json() as { key: string; name: string; size: number }
  return data
}

// ─── KOMPONEN UPLOAD DOKUMEN ──────────────────────────────────────────────────

function DocUploadRow({
  jenis, label, wajib, orgId, pendaftaranId,
  uploaded, onUploaded,
}: {
  jenis: KojasmatDokumen['jenis_dokumen']
  label: string
  wajib?: boolean
  orgId: string
  pendaftaranId: string
  uploaded?: DokumenUploaded
  onUploaded: (dok: DokumenUploaded) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const result = await uploadFile(file, orgId)
      if (!result) { setError('Upload gagal. Coba lagi.'); return }
      const saved = await simpanDokumenPendaftaran({
        org_id: orgId,
        referensi_id: pendaftaranId,
        jenis_dokumen: jenis,
        nama_file: file.name,
        file_key: result.key,
        file_size: file.size,
        mime_type: file.type,
      })
      if (saved.error) { setError(saved.error); return }
      onUploaded({ jenis, nama_file: file.name, file_key: result.key, file_size: file.size })
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className={cn(
      'flex items-center justify-between rounded-xl border p-4 transition-colors',
      uploaded ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'
    )}>
      <div className="flex items-center gap-3 min-w-0">
        {uploaded
          ? <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
          : <FileText className="h-5 w-5 text-gray-400 shrink-0" />
        }
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800">
            {label}
            {wajib && <span className="ml-1 text-red-500 text-xs">*wajib</span>}
          </p>
          {uploaded && (
            <p className="text-xs text-emerald-600 truncate">{uploaded.nama_file}</p>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      </div>
      <label className={cn(
        'ml-3 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer shrink-0',
        uploading
          ? 'bg-gray-100 text-gray-400 pointer-events-none'
          : uploaded
            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      )}>
        {uploading
          ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Mengupload...</>
          : uploaded
            ? <><Upload className="h-3.5 w-3.5" /> Ganti</>
            : <><Upload className="h-3.5 w-3.5" /> Upload</>
        }
        <input
          type="file"
          className="sr-only"
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          onChange={handleFile}
          disabled={uploading}
        />
      </label>
    </div>
  )
}

// ─── MAIN CLIENT ──────────────────────────────────────────────────────────────

export default function DaftarClient({ orgId, orgNama }: { orgId: string; orgNama: string }) {
  const [pending, startTransition] = useTransition()
  const [step, setStep] = useState<Step>('data')
  const [pendaftaranId, setPendaftaranId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dokumenMap, setDokumenMap] = useState<Record<string, DokumenUploaded>>({})

  const [form, setForm] = useState<FormData>({
    nama_lengkap: '', nik: '', email: '', phone: '',
    alamat: '', pekerjaan: '', alasan_bergabung: ''
  })

  function setField(k: keyof FormData, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function handleSubmitData() {
    if (!form.nama_lengkap.trim()) { setError('Nama lengkap wajib diisi'); return }
    setError(null)
    startTransition(async () => {
      const res = await buatPendaftaran({
        org_id: orgId,
        nama_lengkap: form.nama_lengkap,
        nik: form.nik || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        alamat: form.alamat || undefined,
        pekerjaan: form.pekerjaan || undefined,
        alasan_bergabung: form.alasan_bergabung || undefined,
      })
      if (res.error) { setError(res.error); return }
      setPendaftaranId(res.data!.id)
      setStep('dokumen')
    })
  }

  const ktpUploaded = !!dokumenMap['KTP']

  // ── Step: Data Pribadi ──
  if (step === 'data') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="mb-6 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 mb-3">
              <User className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Daftar Anggota</h1>
            <p className="text-sm text-gray-500 mt-1">
              {orgNama} — isi data diri untuk memulai proses pendaftaran
            </p>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2 mb-6">
            {(['data', 'dokumen', 'selesai'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center flex-1">
                <div className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shrink-0',
                  step === s ? 'bg-emerald-600 text-white'
                    : i < ['data', 'dokumen', 'selesai'].indexOf(step) ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-gray-100 text-gray-400'
                )}>
                  {i + 1}
                </div>
                {i < 2 && <div className={cn('h-0.5 flex-1 mx-1', i < ['data','dokumen','selesai'].indexOf(step) ? 'bg-emerald-300' : 'bg-gray-200')} />}
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Nama Lengkap *</label>
              <input
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="Sesuai KTP"
                value={form.nama_lengkap} onChange={e => setField('nama_lengkap', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">NIK</label>
                <input
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="16 digit"
                  maxLength={16}
                  value={form.nik} onChange={e => setField('nik', e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">No. HP</label>
                <input
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="08xxxxxxxxxx"
                  value={form.phone} onChange={e => setField('phone', e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input type="email"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="email@contoh.com"
                value={form.email} onChange={e => setField('email', e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Pekerjaan / Jenis Usaha</label>
              <input
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="Contoh: Pedagang sayur, Konveksi"
                value={form.pekerjaan} onChange={e => setField('pekerjaan', e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Alamat</label>
              <textarea rows={2}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 resize-none"
                placeholder="Alamat lengkap"
                value={form.alamat} onChange={e => setField('alamat', e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Alasan Bergabung</label>
              <textarea rows={3}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 resize-none"
                placeholder="Ceritakan singkat mengapa Anda ingin menjadi anggota koperasi ini..."
                value={form.alasan_bergabung} onChange={e => setField('alasan_bergabung', e.target.value)}
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              onClick={handleSubmitData}
              disabled={!form.nama_lengkap.trim() || pending}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...</> : <>Lanjut Upload Dokumen <ChevronRight className="h-4 w-4" /></>}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step: Upload Dokumen ──
  if (step === 'dokumen' && pendaftaranId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="mb-6 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 mb-3">
              <Upload className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Upload Dokumen</h1>
            <p className="text-sm text-gray-500 mt-1">
              KTP wajib dilampirkan. Dokumen lain memperkuat permohonan Anda.
            </p>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2 mb-6">
            {(['data', 'dokumen', 'selesai'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center flex-1">
                <div className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shrink-0',
                  step === s ? 'bg-emerald-600 text-white'
                    : i < ['data', 'dokumen', 'selesai'].indexOf(step) ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-gray-100 text-gray-400'
                )}>
                  {i + 1}
                </div>
                {i < 2 && <div className={cn('h-0.5 flex-1 mx-1', i < ['data','dokumen','selesai'].indexOf(step) ? 'bg-emerald-300' : 'bg-gray-200')} />}
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-xs text-gray-500 mb-4">
              Format: JPG, PNG, atau PDF. Maks 10 MB per file.
            </p>
            <div className="space-y-3">
              {JENIS_DOK.map(({ value, label, wajib }) => (
                <DocUploadRow
                  key={value}
                  jenis={value}
                  label={label}
                  wajib={wajib}
                  orgId={orgId}
                  pendaftaranId={pendaftaranId}
                  uploaded={dokumenMap[value]}
                  onUploaded={dok => setDokumenMap(m => ({ ...m, [dok.jenis]: dok }))}
                />
              ))}
            </div>

            <div className="mt-6 space-y-3">
              {!ktpUploaded && (
                <p className="text-center text-xs text-amber-600 font-medium">
                  Upload KTP terlebih dahulu untuk melanjutkan
                </p>
              )}
              <button
                onClick={() => setStep('selesai')}
                disabled={!ktpUploaded}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                Selesaikan Pendaftaran <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => setStep('selesai')}
                className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                Lewati dulu, lengkapi nanti
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Step: Selesai ──
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 mb-4">
            <CheckCircle className="h-8 w-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Pendaftaran Diterima!</h2>
          <p className="text-sm text-gray-600 mb-6">
            Permohonan keanggotaan Anda di <strong>{orgNama}</strong> telah kami terima.
            Pengurus akan meninjau dokumen dan menghubungi Anda.
          </p>
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-left space-y-2 text-sm">
            <p className="font-semibold text-emerald-800">Proses selanjutnya:</p>
            <p className="text-emerald-700">1. Pengurus meninjau dokumen Anda</p>
            <p className="text-emerald-700">2. Persetujuan dan pemberian akun anggota</p>
            <p className="text-emerald-700">3. Ikuti pelatihan untuk status Terverifikasi</p>
            <p className="text-emerald-700">4. Mulai ajukan proyek atau biayai proyek anggota lain</p>
          </div>
          <p className="mt-6 text-xs text-gray-400">
            Kode pendaftaran: <span className="font-mono">{pendaftaranId?.slice(0, 8).toUpperCase()}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
