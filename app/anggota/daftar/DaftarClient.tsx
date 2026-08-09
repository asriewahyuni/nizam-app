'use client'

import { useState, useTransition, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  User, Phone, MapPin, Briefcase, FileText, Upload,
  CheckCircle, ChevronRight, Loader2, X, Eye, EyeOff, ClipboardList, Wallet, XCircle,
  PiggyBank, Info, Star, AlertTriangle, Landmark, Coins
} from 'lucide-react'
import {
  buatPendaftaran,
  simpanDokumenPendaftaran,
  submitLayananKomitmen,
  type KojasmatDokumen,
} from '@/modules/kojasmat/actions/kojasmat-membership.actions'
import {
  mulaiTestMasuk, submitTestMasuk, forceLulusTestMasuk, getInfoPembayaran, submitPembayaranPendaftaran,
  getKomitmenSections, type KomitmenSection,
} from '@/modules/kojasmat/actions/kojasmat-test.actions'

// ─── TYPES ────────────────────────────────────────────────────────────────────

type Step = 'data' | 'kontak_darurat' | 'dokumen' | 'tes' | 'layanan' | 'komitmen' | 'bayar' | 'selesai'
const STEPS: Step[] = ['data', 'kontak_darurat', 'dokumen', 'tes', 'layanan', 'komitmen', 'bayar', 'selesai']

const LAYANAN_OPTIONS = [
  'Tabungan Qardh (Sukarela, Tanpa Manfaat)',
  'Keanggotaan Umum',
  'Ingin Ikut Syirkah Proyek (penawaran akan diberikan terpisah)',
  'Ingin Mendapatkan Edukasi Mu’amalah',
  'Program Baitul Maal & Ta’awun',
  'Program Logistik / Distribusi Ummat',
  'Pembiayaan Barang (Murabahah Syariah)',
]

type FormData = {
  nama_lengkap: string
  nik: string
  email: string
  password: string
  confirm_password: string
  phone: string
  alamat: string
  pekerjaan: string
  alasan_bergabung: string
  kontak_darurat_nama: string
  kontak_darurat_hubungan: string
  kontak_darurat_phone: string
  kontak_darurat_alamat: string
}

const HUBUNGAN_DARURAT_OPTIONS = ['Suami/Istri', 'Orang Tua', 'Anak', 'Saudara Kandung', 'Lainnya']

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

// ─── PROGRESS INDICATOR ───────────────────────────────────────────────────────

function StepProgress({ step }: { step: Step }) {
  const idx = STEPS.indexOf(step)
  return (
    <div className="flex items-center gap-2 mb-6">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center flex-1">
          <div className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shrink-0',
            step === s ? 'bg-emerald-600 text-white'
              : i < idx ? 'bg-emerald-100 text-emerald-700'
              : 'bg-gray-100 text-gray-400'
          )}>
            {i + 1}
          </div>
          {i < STEPS.length - 1 && <div className={cn('h-0.5 flex-1 mx-1', i < idx ? 'bg-emerald-300' : 'bg-gray-200')} />}
        </div>
      ))}
    </div>
  )
}

// ─── UPLOAD HELPER ────────────────────────────────────────────────────────────

async function uploadFile(
  file: File, orgId: string
): Promise<{ key: string; name: string; size: number } | { error: string }> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('org_id', orgId)
  fd.append('ref_type', 'PENDAFTARAN')
  try {
    const res = await fetch('/api/kojasmat/upload', { method: 'POST', body: fd })
    const json = await res.json() as { key?: string; name?: string; size?: number; error?: string }
    if (!res.ok || json.error) return { error: json.error ?? 'Upload gagal. Coba lagi.' }
    return { key: json.key!, name: json.name!, size: json.size! }
  } catch {
    return { error: 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.' }
  }
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
      if ('error' in result) { setError(result.error); return }
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan. Coba lagi.')
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
  const [showPassword, setShowPassword] = useState(false)

  const [form, setForm] = useState<FormData>({
    nama_lengkap: '', nik: '', email: '', password: '', confirm_password: '',
    phone: '', alamat: '', pekerjaan: '', alasan_bergabung: '',
    kontak_darurat_nama: '', kontak_darurat_hubungan: '', kontak_darurat_phone: '', kontak_darurat_alamat: '',
  })

  function setField(k: keyof FormData, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  // ── Test masuk ──
  const [testMasukId, setTestMasukId] = useState<string | null>(null)
  const [soal, setSoal] = useState<{ id: string; pertanyaan: string; pilihan_a: string; pilihan_b: string; pilihan_c: string; pilihan_d: string }[]>([])
  const [jawaban, setJawaban] = useState<Record<string, string>>({})
  const [testResult, setTestResult] = useState<{ skor: number; jumlah_benar: number; total_soal: number; status: 'LULUS' | 'GAGAL'; passing_threshold: number; apresiasi: string | null } | null>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [qIndex, setQIndex] = useState(0)

  function mulaiTest() {
    if (!pendaftaranId) return
    setError(null)
    setTestResult(null)
    setJawaban({})
    setQIndex(0)
    setTestLoading(true)
    startTransition(async () => {
      const res = await mulaiTestMasuk(orgId, pendaftaranId)
      setTestLoading(false)
      if (res.error) { setError(res.error); return }
      setTestMasukId(res.data!.test_masuk_id)
      setSoal(res.data!.soal)
    })
  }

  function submitTest() {
    if (!testMasukId) return
    setError(null)
    startTransition(async () => {
      const res = await submitTestMasuk(testMasukId, jawaban)
      if (res.error) { setError(res.error); return }
      setTestResult(res.data!)
    })
  }

  // Bypass admin untuk testing — ?forcequizz di URL langsung meluluskan test 100%
  // tanpa menjawab soal apapun.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!new URLSearchParams(window.location.search).has('forcequizz')) return
    if (!testMasukId || testResult) return
    startTransition(async () => {
      const res = await forceLulusTestMasuk(testMasukId)
      if (res.error) { setError(res.error); return }
      setTestResult(res.data!)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testMasukId, testResult])

  // ── Layanan & Komitmen ──
  const [layananSelected, setLayananSelected] = useState<string[]>([])
  const [komitmenSections, setKomitmenSections] = useState<KomitmenSection[] | null>(null)
  const [komitmenChecked, setKomitmenChecked] = useState<boolean[]>([])

  function toggleLayanan(value: string) {
    setLayananSelected(list => list.includes(value) ? list.filter(v => v !== value) : [...list, value])
  }

  function muatKomitmenSections() {
    startTransition(async () => {
      const res = await getKomitmenSections(orgId)
      setKomitmenSections(res.data)
      setKomitmenChecked(res.data.map(() => false))
    })
  }

  function handleSubmitKomitmen() {
    if (!pendaftaranId || komitmenChecked.some(c => !c)) return
    setError(null)
    startTransition(async () => {
      const res = await submitLayananKomitmen(pendaftaranId, orgId, layananSelected)
      if (res.error) { setError(res.error); return }
      setStep('bayar')
    })
  }

  // ── Pembayaran ──
  const [infoBayar, setInfoBayar] = useState<{
    biaya_admin_pendaftaran: number; nominal_simpanan_pokok: number; nominal_simpanan_wajib: number
    ijarah_platform_fee: number; ijarah_platform_periode_hari: number; ijarah_sukarela_opsional_minimal: number
    bank_account: { bank_name: string; account_number: string; account_holder: string } | null; qris_image_url: string | null
  } | null>(null)
  const [metodeBayar, setMetodeBayar] = useState<'TRANSFER' | 'QRIS'>('TRANSFER')
  const [buktiFile, setBuktiFile] = useState<{ key: string; name: string; size: number } | null>(null)
  const [buktiUploading, setBuktiUploading] = useState(false)
  const [setujuIjarah, setSetujuIjarah] = useState(false)
  const [pokokChecked, setPokokChecked] = useState(true)
  const [wajibChecked, setWajibChecked] = useState(true)
  const [topupSukarelaChecked, setTopupSukarelaChecked] = useState(false)
  const [topupSukarelaAmount, setTopupSukarelaAmount] = useState('')
  const [aktivasiResult, setAktivasiResult] = useState<{ activated: boolean; kode_anggota?: string; login_identifier?: string | null } | null>(null)

  function muatInfoBayar() {
    setError(null)
    startTransition(async () => {
      const res = await getInfoPembayaran(orgId)
      setInfoBayar(res.data!)
      if (!res.data!.bank_account && res.data!.qris_image_url) setMetodeBayar('QRIS')
    })
  }

  async function handleBuktiUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setBuktiUploading(true)
    try {
      const result = await uploadFile(file, orgId)
      if ('error' in result) { setError(result.error); return }
      setBuktiFile(result)
    } finally {
      setBuktiUploading(false)
      e.target.value = ''
    }
  }

  function submitBayar() {
    if (!pendaftaranId || !buktiFile || !infoBayar || !setujuIjarah) return
    if (topupSukarelaChecked && Number(topupSukarelaAmount) < infoBayar.ijarah_sukarela_opsional_minimal) return
    setError(null)
    startTransition(async () => {
      const res = await submitPembayaranPendaftaran(pendaftaranId, {
        org_id: orgId,
        biaya_admin: 0,
        simpanan_pokok: pokokChecked ? infoBayar.nominal_simpanan_pokok : 0,
        simpanan_wajib: wajibChecked ? infoBayar.nominal_simpanan_wajib : 0,
        ijarah_fee: infoBayar.ijarah_platform_fee,
        sukarela_topup: topupSukarelaChecked ? Number(topupSukarelaAmount) || 0 : 0,
        file_key: buktiFile.key,
        nama_file: buktiFile.name,
        file_size: buktiFile.size,
      })
      if (res.error) { setError(res.error); return }
      setAktivasiResult(res.data as typeof aktivasiResult)
      setStep('selesai')
    })
  }

  useEffect(() => {
    if (step === 'tes' && !testMasukId && !testLoading) mulaiTest()
    if (step === 'komitmen' && !komitmenSections) muatKomitmenSections()
    if (step === 'bayar' && !infoBayar) muatInfoBayar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  function handleLanjutData() {
    if (!form.nama_lengkap.trim()) { setError('Nama lengkap wajib diisi'); return }
    if (form.email && !form.password) { setError('Masukkan kata sandi untuk akun Anda'); return }
    if (form.password && form.password.length < 8) { setError('Kata sandi minimal 8 karakter'); return }
    if (form.password && form.password !== form.confirm_password) { setError('Konfirmasi kata sandi tidak cocok'); return }
    setError(null)
    setStep('kontak_darurat')
  }

  function handleSubmitKontakDarurat() {
    if (!form.kontak_darurat_nama.trim() || !form.kontak_darurat_hubungan.trim()
      || !form.kontak_darurat_phone.trim() || !form.kontak_darurat_alamat.trim()) {
      setError('Semua field kontak darurat wajib diisi'); return
    }
    setError(null)
    startTransition(async () => {
      const res = await buatPendaftaran({
        org_id: orgId,
        nama_lengkap: form.nama_lengkap,
        nik: form.nik || undefined,
        email: form.email || undefined,
        password: form.password || undefined,
        phone: form.phone || undefined,
        alamat: form.alamat || undefined,
        pekerjaan: form.pekerjaan || undefined,
        alasan_bergabung: form.alasan_bergabung || undefined,
        kontak_darurat_nama: form.kontak_darurat_nama,
        kontak_darurat_hubungan: form.kontak_darurat_hubungan,
        kontak_darurat_phone: form.kontak_darurat_phone,
        kontak_darurat_alamat: form.kontak_darurat_alamat,
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
          <StepProgress step={step} />

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
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Email <span className="text-gray-400 font-normal">(untuk login portal)</span>
              </label>
              <input type="email"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="email@contoh.com"
                value={form.email} onChange={e => setField('email', e.target.value)}
              />
            </div>
            {form.email && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Kata Sandi <span className="text-red-500 text-xs">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 pr-10 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      placeholder="Min. 8 karakter"
                      value={form.password} onChange={e => setField('password', e.target.value)}
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Konfirmasi Sandi <span className="text-red-500 text-xs">*</span>
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={cn(
                      'w-full rounded-xl border px-4 py-2.5 text-sm outline-none focus:ring-2 transition-colors',
                      form.confirm_password && form.confirm_password !== form.password
                        ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                        : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-100'
                    )}
                    placeholder="Ulangi sandi"
                    value={form.confirm_password} onChange={e => setField('confirm_password', e.target.value)}
                  />
                </div>
              </div>
            )}
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
              onClick={handleLanjutData}
              disabled={!form.nama_lengkap.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              Lanjut <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step: Kontak Darurat ──
  if (step === 'kontak_darurat') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="mb-6 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 mb-3">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Kontak Darurat</h1>
            <p className="text-sm text-gray-500 mt-1">
              Orang yang bisa dihubungi pengurus koperasi jika terjadi keadaan darurat pada Anda.
            </p>
          </div>

          {/* Progress */}
          <StepProgress step={step} />

          <div className="rounded-2xl bg-white p-6 shadow-sm space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Nama Kontak Darurat *</label>
              <input
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="Nama orang yang bisa dihubungi"
                value={form.kontak_darurat_nama} onChange={e => setField('kontak_darurat_nama', e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Hubungan Kontak Darurat *</label>
              <select
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                value={form.kontak_darurat_hubungan} onChange={e => setField('kontak_darurat_hubungan', e.target.value)}
              >
                <option value="">— pilih —</option>
                {HUBUNGAN_DARURAT_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Nomor Telepon / WA Kontak Darurat *</label>
              <input
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="08xxxxxxxxxx"
                value={form.kontak_darurat_phone} onChange={e => setField('kontak_darurat_phone', e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Alamat Kontak Darurat *</label>
              <textarea rows={3}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 resize-none"
                placeholder="Alamat lengkap kontak darurat"
                value={form.kontak_darurat_alamat} onChange={e => setField('kontak_darurat_alamat', e.target.value)}
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setError(null); setStep('data') }}
                disabled={pending}
                className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Kembali
              </button>
              <button
                onClick={handleSubmitKontakDarurat}
                disabled={
                  !form.kontak_darurat_nama.trim() || !form.kontak_darurat_hubungan.trim()
                  || !form.kontak_darurat_phone.trim() || !form.kontak_darurat_alamat.trim() || pending
                }
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...</> : <>Lanjut <ChevronRight className="h-4 w-4" /></>}
              </button>
            </div>
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
          <StepProgress step={step} />

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
                onClick={() => setStep('tes')}
                disabled={!ktpUploaded}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                Lanjut ke Test Masuk <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => setStep('tes')}
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

  // ── Step: Test Masuk ──
  if (step === 'tes' && pendaftaranId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="mb-6 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 mb-3">
              <ClipboardList className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Test Masuk Anggota</h1>
            <p className="text-sm text-gray-500 mt-1">
              Jawab {soal.length || 20} pertanyaan berikut untuk melanjutkan pendaftaran
            </p>
          </div>

          <StepProgress step={step} />

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            {testLoading && (
              <div className="py-12 text-center text-gray-400">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Memuat soal...
              </div>
            )}

            {!testLoading && testResult && testResult.status === 'GAGAL' && (
              <div className="text-center py-6 space-y-4">
                <XCircle className="h-10 w-10 text-red-500 mx-auto" />
                <p className="text-gray-800 font-semibold">Belum Lulus</p>
                <p className="text-sm text-gray-500">
                  Skor Anda {testResult.skor.toFixed(0)}% ({testResult.jumlah_benar}/{testResult.total_soal} benar).
                  Minimal {testResult.passing_threshold}% untuk lulus.
                </p>
                <button onClick={mulaiTest}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer">
                  Coba Lagi
                </button>
              </div>
            )}

            {!testLoading && testResult && testResult.status === 'LULUS' && (
              <div className="text-center py-6 space-y-4">
                <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto" />
                <div>
                  <p className="text-gray-800 font-semibold">Selamat, Anda Lulus!</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Skor Anda {testResult.skor.toFixed(0)}% ({testResult.jumlah_benar}/{testResult.total_soal} benar)
                  </p>
                </div>
                {testResult.apresiasi && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-4 py-1.5 text-sm font-bold text-amber-700">
                    <Star className="h-4 w-4" /> {testResult.apresiasi}
                  </span>
                )}
                <button onClick={() => setStep('layanan')}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer">
                  Lanjut <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {!testLoading && soal.length > 0 && !testResult && (() => {
              const s = soal[qIndex]
              const isLast = qIndex === soal.length - 1
              const answered = !!jawaban[s.id]
              return (
                <div className="space-y-5">
                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                      <span>Pertanyaan {qIndex + 1} dari {soal.length}</span>
                      <span>{Math.round(((qIndex + 1) / soal.length) * 100)}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-100">
                      <div className="h-1.5 rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${((qIndex + 1) / soal.length) * 100}%` }} />
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-800 mb-3">{qIndex + 1}. {s.pertanyaan}</p>
                    <div className="space-y-1.5">
                      {(['a', 'b', 'c', 'd'] as const).map(opt => (
                        <label key={opt} className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 transition-colors">
                          <input type="radio" name={`soal-${s.id}`} className="h-4 w-4 cursor-pointer accent-emerald-600"
                            checked={jawaban[s.id] === opt.toUpperCase()}
                            onChange={() => setJawaban(j => ({ ...j, [s.id]: opt.toUpperCase() }))} />
                          {s[`pilihan_${opt}` as 'pilihan_a']}
                        </label>
                      ))}
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setQIndex(i => Math.max(0, i - 1))}
                      disabled={qIndex === 0}
                      className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      Sebelumnya
                    </button>
                    {isLast ? (
                      <button
                        onClick={submitTest}
                        disabled={!answered || pending}
                        className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Memeriksa...</> : 'Submit Jawaban'}
                      </button>
                    ) : (
                      <button
                        onClick={() => setQIndex(i => Math.min(soal.length - 1, i + 1))}
                        disabled={!answered}
                        className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        Selanjutnya <ChevronRight className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      </div>
    )
  }

  // ── Step: Layanan Yang Diinginkan ──
  if (step === 'layanan' && pendaftaranId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="mb-6 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 mb-3">
              <ClipboardList className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Layanan Yang Diinginkan</h1>
            <p className="text-sm text-gray-500 mt-1">Boleh pilih satu atau lebih (opsional).</p>
          </div>

          <StepProgress step={step} />

          <div className="rounded-2xl bg-white p-6 shadow-sm space-y-4">
            <div className="space-y-2">
              {LAYANAN_OPTIONS.map(opt => (
                <label key={opt} className={cn(
                  'flex items-start gap-2.5 rounded-xl border p-3 text-sm cursor-pointer transition-colors',
                  layananSelected.includes(opt) ? 'border-emerald-300 bg-emerald-50/60' : 'border-gray-200 hover:bg-gray-50'
                )}>
                  <input type="checkbox" className="mt-0.5 h-4 w-4 cursor-pointer accent-emerald-600"
                    checked={layananSelected.includes(opt)} onChange={() => toggleLayanan(opt)} />
                  <span className="text-gray-700">{opt}</span>
                </label>
              ))}
            </div>

            <button
              onClick={() => setStep('komitmen')}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer"
            >
              Lanjut <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step: Komitmen ──
  if (step === 'komitmen' && pendaftaranId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="mb-6 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 mb-3">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Komitmen</h1>
            <p className="text-sm text-gray-500 mt-1">Mohon baca dan centang setiap bagian sebelum melanjutkan.</p>
          </div>

          <StepProgress step={step} />

          <div className="rounded-2xl bg-white p-6 shadow-sm space-y-4">
            {!komitmenSections && (
              <div className="py-12 text-center text-gray-400">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Memuat...
              </div>
            )}

            {komitmenSections && komitmenSections.map((s, i) => (
              <div key={i} className="rounded-xl border border-gray-200 p-4">
                <p className="text-sm font-semibold text-gray-900 mb-2">{i + 1}. {s.title}</p>
                <p className="text-sm text-gray-600 whitespace-pre-line mb-3">{s.body}</p>
                <label className="flex items-start gap-2.5 text-sm cursor-pointer">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 cursor-pointer accent-emerald-600"
                    checked={komitmenChecked[i] ?? false}
                    onChange={e => setKomitmenChecked(list => list.map((c, idx) => idx === i ? e.target.checked : c))} />
                  <span className="text-gray-700">{s.checkbox_label}</span>
                </label>
              </div>
            ))}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {komitmenSections && (
              <button
                onClick={handleSubmitKomitmen}
                disabled={komitmenChecked.some(c => !c) || pending}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...</> : <>Lanjut ke Pembayaran <ChevronRight className="h-4 w-4" /></>}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Step: Pembayaran ──
  if (step === 'bayar' && pendaftaranId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="mb-6 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 mb-3">
              <Wallet className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Pembayaran Pendaftaran</h1>
            <p className="text-sm text-gray-500 mt-1">Selamat, Anda lulus test masuk! Selesaikan pembayaran berikut.</p>
          </div>

          <StepProgress step={step} />

          <div className="rounded-2xl bg-white p-6 shadow-sm space-y-4">
            {!infoBayar && (
              <div className="py-12 text-center text-gray-400">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Memuat info pembayaran...
              </div>
            )}
            {infoBayar && (() => {
              const fmtIdr = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
              const pokokAmount = pokokChecked ? infoBayar.nominal_simpanan_pokok : 0
              const wajibAmount = wajibChecked ? infoBayar.nominal_simpanan_wajib : 0
              const topupAmount = topupSukarelaChecked ? (Number(topupSukarelaAmount) || 0) : 0
              const totalDibayar = pokokAmount + wajibAmount + infoBayar.ijarah_platform_fee + topupAmount
              return (
              <>
                {(infoBayar.nominal_simpanan_pokok > 0 || infoBayar.nominal_simpanan_wajib > 0) && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
                      <Landmark className="h-4 w-4 text-emerald-600" /> {STEPS.indexOf('bayar') + 1}. Simpanan Keanggotaan
                    </h3>
                    <p className="text-sm text-gray-500 mb-3">
                      Simpanan Pokok &amp; Simpanan Wajib adalah syarat keanggotaan koperasi dan menjadi hak Anda sebagai anggota
                      (bisa ditarik saat berhenti sesuai AD/ART). Anda bisa membayarnya sekarang atau menyusul lewat portal anggota.
                    </p>
                    {infoBayar.nominal_simpanan_pokok > 0 && (
                      <label className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-sm cursor-pointer hover:bg-emerald-50 transition-colors mb-2">
                        <input type="checkbox" className="mt-0.5 h-4 w-4 cursor-pointer accent-emerald-600"
                          checked={pokokChecked} onChange={e => setPokokChecked(e.target.checked)} />
                        <span className="flex-1 text-gray-700">
                          Simpanan Pokok
                        </span>
                        <span className="font-semibold text-gray-900 shrink-0">{fmtIdr(infoBayar.nominal_simpanan_pokok)}</span>
                      </label>
                    )}
                    {infoBayar.nominal_simpanan_wajib > 0 && (
                      <label className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-sm cursor-pointer hover:bg-emerald-50 transition-colors">
                        <input type="checkbox" className="mt-0.5 h-4 w-4 cursor-pointer accent-emerald-600"
                          checked={wajibChecked} onChange={e => setWajibChecked(e.target.checked)} />
                        <span className="flex-1 text-gray-700">
                          Simpanan Wajib
                        </span>
                        <span className="font-semibold text-gray-900 shrink-0">{fmtIdr(infoBayar.nominal_simpanan_wajib)}</span>
                      </label>
                    )}
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-purple-500" /> Biaya Pendaftaran — Akad Ijarah Platform
                  </h3>
                  <p className="text-sm text-gray-500 mb-3">
                    Akad sewa manfaat (ijarah) atas layanan platform koperasi, sebesar{' '}
                    <strong className="text-gray-800">{fmtIdr(infoBayar.ijarah_platform_fee)}</strong> setiap{' '}
                    {infoBayar.ijarah_platform_periode_hari} hari. Siklus pertama dibayar sekarang;
                    siklus berikutnya dipotong otomatis dari Simpanan Sukarela Anda.
                  </p>

                  <label className="flex items-start gap-2 rounded-xl border border-purple-200 bg-purple-50/50 p-3 text-sm cursor-pointer hover:bg-purple-50 transition-colors">
                    <input type="checkbox" className="mt-0.5 h-4 w-4 cursor-pointer accent-purple-600"
                      checked={topupSukarelaChecked} onChange={e => {
                        setTopupSukarelaChecked(e.target.checked)
                        setTopupSukarelaAmount(e.target.checked ? String(infoBayar.ijarah_sukarela_opsional_minimal) : '')
                      }} />
                    <span className="text-gray-700">
                      Saya juga ingin menabung Simpanan Sukarela tambahan (opsional, minimal {fmtIdr(infoBayar.ijarah_sukarela_opsional_minimal)}).
                    </span>
                  </label>

                  {topupSukarelaChecked && (
                    <div className="mt-2">
                      <input type="text" inputMode="numeric"
                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-purple-500 tabular-nums"
                        placeholder={fmtIdr(infoBayar.ijarah_sukarela_opsional_minimal)}
                        value={topupSukarelaAmount ? new Intl.NumberFormat('id-ID').format(Number(topupSukarelaAmount)) : ''}
                        onChange={e => setTopupSukarelaAmount(e.target.value.replace(/\D/g, ''))} />
                      {topupSukarelaAmount && Number(topupSukarelaAmount) < infoBayar.ijarah_sukarela_opsional_minimal && (
                        <p className="text-xs text-rose-600 mt-1">Minimal {fmtIdr(infoBayar.ijarah_sukarela_opsional_minimal)}.</p>
                      )}
                    </div>
                  )}

                  <div className="mt-4">
                    <p className="text-sm font-semibold text-gray-900 mb-2">Ringkasan Pembayaran</p>
                    <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
                      {pokokAmount > 0 && (
                        <div className="flex items-center justify-between px-4 py-3">
                          <span className="flex items-center gap-2 text-sm text-gray-700">
                            <Landmark className="h-4 w-4 text-emerald-600" /> Simpanan Pokok
                          </span>
                          <span className="text-sm font-semibold text-gray-900">{fmtIdr(pokokAmount)}</span>
                        </div>
                      )}
                      {wajibAmount > 0 && (
                        <div className="flex items-center justify-between px-4 py-3">
                          <span className="flex items-center gap-2 text-sm text-gray-700">
                            <Coins className="h-4 w-4 text-emerald-600" /> Simpanan Wajib
                          </span>
                          <span className="text-sm font-semibold text-gray-900">{fmtIdr(wajibAmount)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between px-4 py-3">
                        <span className="flex items-center gap-2 text-sm text-gray-700">
                          <Wallet className="h-4 w-4 text-purple-500" /> Ijarah Platform (siklus pertama, {infoBayar.ijarah_platform_periode_hari} hari)
                        </span>
                        <span className="text-sm font-semibold text-gray-900">{fmtIdr(infoBayar.ijarah_platform_fee)}</span>
                      </div>
                      {topupAmount > 0 && (
                        <div className="flex items-center justify-between px-4 py-3">
                          <span className="flex items-center gap-2 text-sm text-gray-700">
                            <PiggyBank className="h-4 w-4 text-blue-500" /> Simpanan Sukarela (opsional)
                          </span>
                          <span className="text-sm font-semibold text-gray-900">{fmtIdr(topupAmount)}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between px-4 py-3 mt-2 rounded-xl bg-purple-50 border border-purple-100">
                      <span className="text-sm font-bold text-purple-800">Total Dibayar</span>
                      <span className="text-sm font-bold text-purple-900">{fmtIdr(totalDibayar)}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-start gap-2 text-xs text-gray-500">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <p>Tidak ada biaya lain selain yang tercantum di ringkasan di atas.</p>
                  </div>

                  <label className="mt-3 flex items-start gap-2 rounded-xl border border-gray-200 p-3 text-sm cursor-pointer hover:bg-gray-50 transition-colors">
                    <input type="checkbox" className="mt-0.5 h-4 w-4 cursor-pointer accent-purple-600"
                      checked={setujuIjarah} onChange={e => setSetujuIjarah(e.target.checked)} />
                    <span className="text-gray-700">
                      Saya setuju membayar sesuai ringkasan di atas.
                    </span>
                  </label>
                </div>

                {infoBayar.bank_account && infoBayar.qris_image_url ? (
                  <div className="flex gap-2 rounded-xl bg-gray-100 p-1">
                    <button onClick={() => setMetodeBayar('TRANSFER')}
                      className={cn(
                        'flex-1 rounded-lg py-2 text-sm font-medium transition-colors cursor-pointer',
                        metodeBayar === 'TRANSFER' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                      )}>
                      Transfer Bank
                    </button>
                    <button onClick={() => setMetodeBayar('QRIS')}
                      className={cn(
                        'flex-1 rounded-lg py-2 text-sm font-medium transition-colors cursor-pointer',
                        metodeBayar === 'QRIS' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                      )}>
                      QRIS
                    </button>
                  </div>
                ) : null}

                {metodeBayar === 'TRANSFER' && (
                  infoBayar.bank_account ? (
                    <div className="rounded-xl border border-gray-200 p-4 text-sm space-y-1">
                      <p className="text-gray-500">Transfer ke rekening:</p>
                      <p className="font-semibold text-gray-900">{infoBayar.bank_account.bank_name} — {infoBayar.bank_account.account_number}</p>
                      <p className="text-gray-600">a.n. {infoBayar.bank_account.account_holder}</p>
                    </div>
                  ) : infoBayar.qris_image_url ? null : (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                      Rekening tujuan belum diatur oleh pengurus. Hubungi pengurus koperasi untuk info rekening.
                    </div>
                  )
                )}

                {metodeBayar === 'QRIS' && infoBayar.qris_image_url && (
                  <div className="rounded-xl border border-gray-200 p-4 text-center">
                    <p className="text-sm text-gray-500 mb-3">Scan QRIS berikut untuk membayar:</p>
                    <img src={infoBayar.qris_image_url} alt="QRIS" className="mx-auto h-56 w-56 object-contain" />
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Upload Bukti Transfer *</label>
                  <label className={cn(
                    'flex items-center justify-between rounded-xl border p-4 transition-colors cursor-pointer',
                    buktiFile ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                  )}>
                    <span className="flex items-center gap-2 text-sm">
                      {buktiFile ? <CheckCircle className="h-5 w-5 text-emerald-500" /> : <FileText className="h-5 w-5 text-gray-400" />}
                      {buktiFile ? buktiFile.name : 'Pilih file bukti transfer (JPG/PNG/PDF)'}
                    </span>
                    <span className="shrink-0 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600">
                      {buktiUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Pilih File'}
                    </span>
                    <input type="file" className="sr-only" accept=".jpg,.jpeg,.png,.webp,.pdf"
                      onChange={handleBuktiUpload} disabled={buktiUploading} />
                  </label>
                </div>

                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <button
                  onClick={submitBayar}
                  disabled={!buktiFile || !setujuIjarah || pending || (topupSukarelaChecked && Number(topupSukarelaAmount) < infoBayar.ijarah_sukarela_opsional_minimal)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Memproses...</> : <>Konfirmasi Pembayaran <ChevronRight className="h-4 w-4" /></>}
                </button>
              </>
              )
            })()}
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
          {aktivasiResult?.activated ? (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Selamat Datang, Anggota Baru!</h2>
              <p className="text-sm text-gray-600 mb-6">
                Keanggotaan Anda di <strong>{orgNama}</strong> sudah <strong>aktif</strong>. Anda bisa langsung login ke portal anggota.
              </p>
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-left space-y-2 text-sm">
                <p className="font-semibold text-emerald-800">Kode Anggota Anda:</p>
                <p className="font-mono text-lg text-emerald-900">{aktivasiResult.kode_anggota}</p>
                <p className="text-emerald-700 pt-2">
                  Login menggunakan email/NIK dan kata sandi yang Anda buat di langkah pertama.
                </p>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Pembayaran Diterima — Menunggu Verifikasi</h2>
              <p className="text-sm text-gray-600 mb-6">
                Bukti transfer Anda sudah kami terima. Pengurus <strong>{orgNama}</strong> akan
                memverifikasi pembayaran sebelum akun keanggotaan Anda diaktifkan.
              </p>
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-left space-y-2 text-sm">
                <p className="font-semibold text-emerald-800">Proses selanjutnya:</p>
                <p className="text-emerald-700">1. Pengurus memverifikasi bukti transfer Anda</p>
                <p className="text-emerald-700">2. Akun anggota diaktifkan dan kode anggota dikirim</p>
                <p className="text-emerald-700">3. Login ke portal anggota untuk mulai bertransaksi</p>
              </div>
            </>
          )}
          <p className="mt-6 text-xs text-gray-400">
            Kode pendaftaran: <span className="font-mono">{pendaftaranId?.slice(0, 8).toUpperCase()}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
