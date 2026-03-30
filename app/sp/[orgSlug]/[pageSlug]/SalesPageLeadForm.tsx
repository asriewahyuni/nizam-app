'use client'

import { useState } from 'react'
import { SafeButton } from '@/components/ui/NizamUI'
import type { SalesPageFormSettings, SalesPageTheme } from '@/modules/sales/lib/sales-page'

type SalesPageLeadFormProps = {
  orgSlug: string
  pageSlug: string
  metaPixelId: string
  formSettings: SalesPageFormSettings
  theme: SalesPageTheme
}

type MetaPixelWindow = Window & {
  fbq?: (...args: unknown[]) => void
}

export default function SalesPageLeadForm({
  orgSlug,
  pageSlug,
  metaPixelId,
  formSettings,
  theme,
}: SalesPageLeadFormProps) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    const searchParams = new URLSearchParams(window.location.search)
    const utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid'].reduce<Record<string, string>>(
      (acc, key) => {
        const value = searchParams.get(key)
        if (value) acc[key] = value
        return acc
      },
      {},
    )

    try {
      const response = await fetch('/api/sales-pages/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgSlug,
          pageSlug,
          fullName,
          email,
          phone,
          company,
          message,
          website,
          sourceUrl: window.location.href,
          referrer: document.referrer,
          utmParams,
        }),
      })

      const payload = (await response.json()) as { error?: string; success?: boolean; successMessage?: string }

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Gagal mengirim data lead.')
      }

      setSuccess(payload.successMessage || formSettings.successMessage)
      setFullName('')
      setEmail('')
      setPhone('')
      setCompany('')
      setMessage('')
      setWebsite('')

      const metaWindow = window as MetaPixelWindow
      if (metaPixelId && typeof metaWindow.fbq === 'function') {
        metaWindow.fbq('track', 'Lead', {
          content_name: pageSlug,
          status: 'submitted',
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim data lead.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      id="lead-form"
      className="rounded-[36px] border bg-white p-7 shadow-[0_20px_60px_-25px_rgba(15,23,42,0.25)]"
      style={{ borderColor: theme.border }}
    >
      <div className="space-y-3">
        <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: theme.muted }}>
          Lead Capture
        </div>
        <h3 className="text-2xl font-black tracking-tight text-slate-900">{formSettings.title}</h3>
        <p className="text-sm font-medium leading-relaxed text-slate-500">{formSettings.subtitle}</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <input
          type="text"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
          tabIndex={-1}
          autoComplete="off"
          className="hidden"
          aria-hidden="true"
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Nama lengkap"
            required
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:border-slate-900"
          />
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="No. WhatsApp"
            required
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:border-slate-900"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email bisnis"
            type="email"
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:border-slate-900"
          />
          <input
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            placeholder="Nama perusahaan"
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:border-slate-900"
          />
        </div>

        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Ceritakan kebutuhan utama Anda"
          rows={4}
          className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-slate-900"
        />

        {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}
        {success && (
          <div className="rounded-2xl border px-4 py-3 text-sm font-bold" style={{ borderColor: theme.border, backgroundColor: theme.surface, color: theme.text }}>
            {success}
          </div>
        )}

        <SafeButton
          type="submit"
          variant="primary"
          size="lg"
          isLoading={submitting}
          className="w-full"
          style={{ backgroundColor: theme.accent, borderColor: theme.accent }}
        >
          {formSettings.ctaLabel}
        </SafeButton>
      </form>
    </div>
  )
}
