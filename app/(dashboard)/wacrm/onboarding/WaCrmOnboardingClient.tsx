'use client'
// app/(dashboard)/wacrm/onboarding/WaCrmOnboardingClient.tsx
// Wizard onboarding 3 langkah: Hubungkan WA → Pipeline → Konfigurasi AI

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  Wifi,
  Kanban,
  Bot,
  Copy,
  ChevronRight,
  Loader2,
  MessageCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { saveModuleSettings, completeModuleOnboarding } from '@/modules/marketplace/actions/marketplace.actions'

const MODULE_KEY = 'WA_CRM'

// ── Types ─────────────────────────────────────────────────────────────────

type Props = {
  orgId: string
  webhookUrl: string
  savedSettings: Record<string, string>
}

type Step = 'connection' | 'pipeline' | 'ai_config'

const STEPS: { id: Step; label: string; icon: React.ElementType }[] = [
  { id: 'connection', label: 'Hubungkan WhatsApp', icon: Wifi },
  { id: 'pipeline',   label: 'Setup Pipeline',     icon: Kanban },
  { id: 'ai_config',  label: 'Konfigurasi AI',     icon: Bot },
]

// ── StepIndicator ─────────────────────────────────────────────────────────

function StepIndicator({ current, completed }: { current: number; completed: Set<Step> }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, idx) => {
        const done = completed.has(step.id)
        const active = idx === current
        const Icon = step.icon
        return (
          <div key={step.id} className="flex items-center">
            <div className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
              done  && 'bg-emerald-100 text-emerald-700',
              active && !done && 'bg-green-600 text-white',
              !done && !active && 'bg-slate-100 text-slate-400',
            )}>
              {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{step.label}</span>
              <span className="sm:hidden">{idx + 1}</span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={cn('h-px w-6 mx-1 transition-colors', done ? 'bg-emerald-300' : 'bg-slate-200')} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Step 1: Hubungkan WhatsApp via Fonnte ────────────────────────────────

function StepConnection({
  webhookUrl,
  initialToken,
  initialPhone,
  onNext,
}: {
  webhookUrl: string
  initialToken: string
  initialPhone: string
  onNext: (token: string, phone: string) => void
}) {
  const [token, setToken]   = useState(initialToken)
  const [phone, setPhone]   = useState(initialPhone)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError]   = useState('')

  function handleCopy() {
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleNext() {
    if (!token.trim()) { setError('Token Fonnte wajib diisi.'); return }
    if (!phone.trim()) { setError('Nomor WA wajib diisi.'); return }
    setError('')
    startTransition(async () => {
      // Simpan ke wacrm_connections
      const res = await fetch('/api/wacrm/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bridge_token: token.trim(), connected_phone: phone.trim() }),
      })
      if (!res.ok) {
        const json = await res.json()
        setError(json.error ?? 'Gagal menyimpan koneksi')
        return
      }
      // Simpan flag ke module settings agar wizard ingat progress
      await saveModuleSettings(MODULE_KEY, {
        bridge_type: 'fonnte',
        connected_phone: phone.trim(),
      })
      onNext(token.trim(), phone.trim())
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Hubungkan WhatsApp via Fonnte</h2>
        <p className="text-sm text-slate-500 mt-1 leading-relaxed">
          Masukkan token Fonnte dan nomor WA yang terhubung, lalu paste Webhook URL ke dashboard Fonnte.
        </p>
      </div>

      {/* Panduan singkat */}
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-1.5">
        <div className="text-xs font-semibold text-green-800">Cara setup di Fonnte:</div>
        <ol className="text-xs text-green-700 space-y-1 list-decimal list-inside leading-relaxed">
          <li>Login di <span className="font-medium">fonnte.com</span> → klik perangkat Anda</li>
          <li>Salin <span className="font-medium">Token</span> dari halaman detail perangkat</li>
          <li>Buka menu <span className="font-medium">Webhook</span>, paste URL Nizam di bawah</li>
          <li>Simpan pengaturan Fonnte, lalu klik <span className="font-medium">Simpan & Lanjut</span></li>
        </ol>
      </div>

      {/* Token Fonnte */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
          Token Fonnte <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={token}
          onChange={e => setToken(e.target.value)}
          placeholder="cth: mxNc3eKmZpLeQo2Kf9Pr"
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
        <p className="text-xs text-slate-400">Didapat dari halaman detail perangkat di dashboard Fonnte.</p>
      </div>

      {/* Nomor WA */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
          Nomor WA yang Terhubung <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="cth: 6281227145000"
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
        <p className="text-xs text-slate-400">Nomor WA yang terdaftar di perangkat Fonnte (format 628xxx).</p>
      </div>

      {/* Webhook URL */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
          Webhook URL (paste ke Fonnte)
        </label>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 font-mono truncate">
            {webhookUrl}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? 'Disalin!' : 'Salin'}
          </button>
        </div>
        <p className="text-xs text-slate-400">
          Paste URL ini di menu <span className="font-medium">Webhook → URL</span> di dashboard Fonnte.
        </p>
      </div>

      {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <button
        type="button"
        onClick={handleNext}
        disabled={isPending}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60 transition-colors cursor-pointer"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
        Simpan & Lanjut
      </button>
    </div>
  )
}

// ── Step 2: Setup Pipeline ─────────────────────────────────────────────────

const DEFAULT_STAGES = 'Masuk, Follow Up, Negosiasi, Closing'

function StepPipeline({
  initialStages,
  initialProducts,
  onNext,
  onBack,
}: {
  initialStages: string
  initialProducts: string
  onNext: (stages: string, products: string) => void
  onBack: () => void
}) {
  const [stages, setStages]     = useState(initialStages || DEFAULT_STAGES)
  const [products, setProducts] = useState(initialProducts)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function handleNext() {
    if (!stages.trim()) { setError('Isi nama stage pipeline terlebih dahulu.'); return }
    setError('')
    startTransition(async () => {
      await saveModuleSettings(MODULE_KEY, {
        pipeline_stages: stages.trim(),
        products: products.trim(),
      })
      onNext(stages.trim(), products.trim())
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Setup Pipeline</h2>
        <p className="text-sm text-slate-500 mt-1">
          Atur nama tahapan pipeline dan produk/layanan yang Anda jual — konteks ini digunakan AI saat membalas pesan.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
          Nama Stage Pipeline <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={stages}
          onChange={e => setStages(e.target.value)}
          placeholder={DEFAULT_STAGES}
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
        <p className="text-xs text-slate-400">Pisahkan dengan koma. Urutan dari kiri = paling awal.</p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
          Produk / Layanan yang Dijual
        </label>
        <textarea
          value={products}
          onChange={e => setProducts(e.target.value)}
          rows={3}
          placeholder="cth: Paket Website Rp 3 jt, Desain Logo Rp 750 rb, Foto Produk Rp 500 rb"
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
        />
        <p className="text-xs text-slate-400">Dipakai AI sebagai referensi saat menjawab pertanyaan harga dari prospek.</p>
      </div>

      {/* Preview stage chips */}
      {stages && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-500">Preview Pipeline:</div>
          <div className="flex flex-wrap gap-2">
            {stages.split(',').map(s => s.trim()).filter(Boolean).map((stage, i) => (
              <span key={i} className="px-3 py-1 rounded-full bg-green-50 border border-green-200 text-xs font-semibold text-green-700">
                {stage}
              </span>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          Kembali
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={isPending}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60 transition-colors cursor-pointer"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
          Simpan & Lanjut
        </button>
      </div>
    </div>
  )
}

// ── Step 3: Konfigurasi AI ─────────────────────────────────────────────────

const AI_MODELS = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (Recommended)' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (Lebih cepat)' },
]

function StepAiConfig({
  initialEnabled,
  initialInstruction,
  initialModel,
  onFinish,
  onBack,
  isLoading,
}: {
  initialEnabled: boolean
  initialInstruction: string
  initialModel: string
  onFinish: (enabled: boolean, instruction: string, model: string) => void
  onBack: () => void
  isLoading: boolean
}) {
  const [enabled, setEnabled]         = useState(initialEnabled)
  const [instruction, setInstruction] = useState(initialInstruction)
  const [model, setModel]             = useState(initialModel || 'claude-sonnet-4-6')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Konfigurasi AI Auto-Reply</h2>
        <p className="text-sm text-slate-500 mt-1">
          AI akan membaca riwayat chat dan info produk untuk merespons pesan masuk secara otomatis.
          Bisa di-override per kontak kapan saja.
        </p>
      </div>

      {/* Toggle aktif */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
        <div>
          <div className="text-sm font-semibold text-slate-800">Aktifkan AI Auto-Reply</div>
          <div className="text-xs text-slate-500 mt-0.5">Mode default untuk kontak baru</div>
        </div>
        <button
          type="button"
          onClick={() => setEnabled(v => !v)}
          className={cn(
            'relative h-6 w-11 rounded-full transition-colors cursor-pointer',
            enabled ? 'bg-green-500' : 'bg-slate-200',
          )}
          aria-pressed={enabled}
        >
          <span className={cn(
            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            enabled ? 'translate-x-5' : 'translate-x-0',
          )} />
        </button>
      </div>

      {/* Instruksi default */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
          Instruksi Default AI
        </label>
        <textarea
          value={instruction}
          onChange={e => setInstruction(e.target.value)}
          rows={4}
          placeholder={'cth: Kamu adalah asisten sales ramah. Jangan kasih diskon lebih dari 10%. Selalu tawari paket bundling jika pelanggan tanya satu produk.'}
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
        />
        <p className="text-xs text-slate-400">
          Instruksi ini dikirim ke AI setiap membalas. Semakin spesifik = respons lebih relevan.
        </p>
      </div>

      {/* Pilih model */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
          Model AI
        </label>
        <div className="grid gap-2">
          {AI_MODELS.map(m => (
            <label
              key={m.value}
              className={cn(
                'flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                model === m.value
                  ? 'border-green-400 bg-green-50'
                  : 'border-slate-200 hover:border-slate-300',
              )}
            >
              <input
                type="radio"
                name="ai_model"
                value={m.value}
                checked={model === m.value}
                onChange={() => setModel(m.value)}
                className="accent-green-600"
              />
              <span className="text-sm font-medium text-slate-800">{m.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          Kembali
        </button>
        <button
          type="button"
          onClick={() => onFinish(enabled, instruction.trim(), model)}
          disabled={isLoading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60 transition-colors cursor-pointer"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Mulai Whatslab CRM
        </button>
      </div>
    </div>
  )
}

// ── Main Wizard ────────────────────────────────────────────────────────────

export function WaCrmOnboardingClient({ orgId, webhookUrl, savedSettings }: Props) {
  const router = useRouter()

  const [stepIndex, setStepIndex] = useState(() => {
    if (savedSettings.ai_model)        return 2
    if (savedSettings.pipeline_stages) return 2
    if (savedSettings.bridge_type)     return 1
    return 0
  })
  const [completed, setCompleted] = useState<Set<Step>>(() => {
    const set = new Set<Step>()
    if (savedSettings.bridge_type)     set.add('connection')
    if (savedSettings.pipeline_stages) set.add('pipeline')
    if (savedSettings.ai_model)        set.add('ai_config')
    return set
  })
  const [isFinishing, setIsFinishing] = useState(false)

  function markDone(step: Step) {
    setCompleted(prev => new Set(prev).add(step))
  }

  async function handleFinish(enabled: boolean, instruction: string, model: string) {
    setIsFinishing(true)
    try {
      await saveModuleSettings(MODULE_KEY, {
        ai_enabled: String(enabled),
        ai_instruction: instruction,
        ai_model: model,
      })
      markDone('ai_config')
      await completeModuleOnboarding(MODULE_KEY)
      router.push('/wacrm')
    } finally {
      setIsFinishing(false)
    }
  }

  return (
    <>
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-green-600 to-emerald-700 p-8 text-white shadow-md">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl opacity-10 -mr-20 -mt-20" />
        <div className="relative">
          <div className="w-16 h-16 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center mb-5">
            <MessageCircle className="h-8 w-8 text-white" />
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-200 mb-2">Add-On Baru</div>
          <h1 className="text-2xl font-semibold tracking-tight">Selamat datang di Whatslab CRM</h1>
          <p className="mt-2 text-sm text-emerald-100 leading-relaxed">
            Pipeline prospek, inbox percakapan, dan AI auto-reply — semua dari WhatsApp bisnis Anda.
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex justify-center">
        <StepIndicator current={stepIndex} completed={completed} />
      </div>

      {/* Step content */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {stepIndex === 0 && (
          <StepConnection
            webhookUrl={webhookUrl}
            initialToken={savedSettings.fonnte_token ?? ''}
            initialPhone={savedSettings.connected_phone ?? ''}
            onNext={(token, phone) => { markDone('connection'); setStepIndex(1) }}
          />
        )}
        {stepIndex === 1 && (
          <StepPipeline
            initialStages={savedSettings.pipeline_stages ?? ''}
            initialProducts={savedSettings.products ?? ''}
            onNext={(stages, products) => { markDone('pipeline'); setStepIndex(2) }}
            onBack={() => setStepIndex(0)}
          />
        )}
        {stepIndex === 2 && (
          <StepAiConfig
            initialEnabled={savedSettings.ai_enabled === 'true'}
            initialInstruction={savedSettings.ai_instruction ?? ''}
            initialModel={savedSettings.ai_model ?? 'claude-sonnet-4-6'}
            onFinish={handleFinish}
            onBack={() => setStepIndex(1)}
            isLoading={isFinishing}
          />
        )}
      </div>
    </>
  )
}
