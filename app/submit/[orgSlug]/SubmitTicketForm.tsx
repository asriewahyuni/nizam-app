'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { createCrmTicketPublic } from '@/modules/crm/actions/tickets.actions'
import { TICKET_TYPE_LABEL } from '@/modules/crm/lib/ticket-constants'
import type { CrmTicketType } from '@/modules/crm/lib/ticket-constants'
import { CheckCircle, AlertCircle, Send, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type OrgInfo = { id: string; name: string; logo_url: string | null }

const TICKET_TYPES: { value: CrmTicketType; label: string; description: string; color: string }[] = [
  { value: 'COMPLAINT',  label: 'Komplain',     description: 'Ada yang tidak sesuai harapan',    color: 'text-rose-600 bg-rose-50 border-rose-200' },
  { value: 'REQUEST',    label: 'Permintaan',   description: 'Minta layanan atau produk tertentu', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { value: 'INQUIRY',    label: 'Pertanyaan',   description: 'Ingin tahu informasi lebih lanjut', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { value: 'SUGGESTION', label: 'Saran',        description: 'Ada ide untuk perbaikan',           color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function SubmitTicketForm({ org }: { org: OrgInfo }) {
  const [isPending, startTransition] = useTransition()
  const [submitted, setSubmitted] = useState<string | null>(null) // ticket number
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [type, setType] = useState<CrmTicketType>('INQUIRY')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!name.trim()) { setErrorMsg('Nama wajib diisi.'); return }
    if (!subject.trim()) { setErrorMsg('Subjek wajib diisi.'); return }
    if (!email.trim() && !phone.trim()) { setErrorMsg('Isi minimal email atau nomor WA/telepon.'); return }

    startTransition(async () => {
      const result = await createCrmTicketPublic({
        org_id:             org.id,
        type,
        subject:            subject.trim(),
        description:        description.trim() || null,
        submitter_name:     name.trim(),
        submitter_email:    email.trim() || null,
        submitter_phone:    phone.trim() || null,
        notification_email: email.trim() || null,
        notification_phone: phone.trim() || null,
      })

      if ('error' in result) {
        setErrorMsg(result.error ?? 'Terjadi kesalahan.')
      } else {
        setSubmitted(result.ticketNumber)
      }
    })
  }

  // ─── Success state ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center mx-auto">
            <CheckCircle size={32} className="text-emerald-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Terima kasih, {name.split(' ')[0]}!</h1>
            <p className="text-slate-500 mt-1 text-sm">Tiket kamu sudah kami terima dan akan segera ditangani.</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">Nomor Tiket</p>
            <p className="text-2xl font-bold text-slate-900 font-mono tracking-wide">{submitted}</p>
            <p className="text-xs text-slate-400 mt-2">Catat nomor ini untuk menanyakan perkembangan ke tim {org.name}.</p>
          </div>
          {(email || phone) && (
            <p className="text-sm text-slate-500">
              Kami akan menghubungi kamu melalui {email ? `email (${email})` : ''}{email && phone ? ' atau ' : ''}{phone ? `WA/telepon (${phone})` : ''} setelah ada update.
            </p>
          )}
          <button type="button"
            onClick={() => {
              setSubmitted(null)
              setName(''); setEmail(''); setPhone(''); setSubject(''); setDescription('')
              setType('INQUIRY')
            }}
            className="text-sm text-slate-400 hover:text-slate-600 underline underline-offset-2 cursor-pointer transition-colors"
          >
            Kirim tiket lain
          </button>
        </div>
      </div>
    )
  }

  // ─── Form ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          {org.logo_url ? (
            <div className="w-9 h-9 rounded-lg overflow-hidden border border-slate-200 shrink-0">
              <Image src={org.logo_url} alt={org.name} width={36} height={36} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-lg bg-[#003366] flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm">{org.name.slice(0, 1).toUpperCase()}</span>
            </div>
          )}
          <div>
            <p className="font-semibold text-slate-900 text-sm leading-tight">{org.name}</p>
            <p className="text-xs text-slate-400">Keluhan & Permintaan</p>
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="max-w-lg mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-900">Sampaikan ke kami</h1>
          <p className="text-slate-500 text-sm mt-1">
            Keluhan, permintaan, atau pertanyaan kamu akan langsung diterima oleh tim {org.name}.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Jenis */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Jenis Pesan <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TICKET_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={cn(
                    'text-left px-3 py-2.5 rounded-lg border text-sm font-medium transition-all cursor-pointer',
                    type === t.value
                      ? t.color + ' shadow-sm'
                      : 'border-slate-200 text-slate-600 bg-white hover:border-slate-300 hover:bg-slate-50'
                  )}
                >
                  <p className="font-semibold leading-tight">{t.label}</p>
                  <p className={cn('text-[11px] mt-0.5 leading-tight', type === t.value ? 'opacity-70' : 'text-slate-400')}>
                    {t.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Nama */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Nama kamu <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Budi Santoso"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003366]/20 focus:border-[#003366] transition-colors"
            />
          </div>

          {/* Kontak */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@kamu.com"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003366]/20 focus:border-[#003366] transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">WA / Telepon</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08xx xxxx xxxx"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003366]/20 focus:border-[#003366] transition-colors"
              />
            </div>
          </div>
          <p className="text-xs text-slate-400 -mt-2">Isi minimal salah satu agar kami bisa merespons.</p>

          {/* Subjek */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Subjek <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ringkasan singkat masalah atau permintaan kamu"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003366]/20 focus:border-[#003366] transition-colors"
            />
          </div>

          {/* Detail */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Detail (opsional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Ceritakan lebih detail — kapan terjadi, nomor pesanan terkait, dll."
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003366]/20 focus:border-[#003366] transition-colors resize-none"
            />
          </div>

          {/* Error */}
          {errorMsg && (
            <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2.5 text-sm text-rose-700">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 bg-[#003366] hover:bg-[#002a55] text-white font-semibold py-3 rounded-lg text-sm transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
          >
            {isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Mengirim...
              </>
            ) : (
              <>
                <Send size={15} />
                Kirim Pesan
              </>
            )}
          </button>

          <p className="text-center text-xs text-slate-400">
            Dengan mengirim, kamu menyetujui bahwa data ini akan diproses oleh tim {org.name}.
          </p>
        </form>
      </main>
    </div>
  )
}
