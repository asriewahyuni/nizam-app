'use client'

import { useState, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  X, Copy, Check, Printer, ExternalLink, Share2, AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BusCrew } from '@/modules/po-bus/lib/po-bus-types'

const ROLE_LABEL: Record<string, string> = {
  DRIVER:    'Driver',
  CO_DRIVER: 'Co-Driver',
  KERNET:    'Kernet',
  KONDEKTUR: 'Kondektur',
}

interface CrewShortcutModalProps {
  crew: BusCrew
  onClose: () => void
}

export function CrewShortcutModal({ crew, onClose }: CrewShortcutModalProps) {
  const [copied, setCopied] = useState(false)

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const shortUrl = crew.nik ? `${baseUrl}/c/${crew.nik}` : null
  const fullUrl  = crew.nik ? `${baseUrl}/portal/crew/${crew.nik}` : null

  const handleCopy = useCallback(() => {
    if (!shortUrl) return
    navigator.clipboard.writeText(shortUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [shortUrl])

  const handlePrint = useCallback(() => {
    if (!shortUrl || !crew.nik) return
    const win = window.open('', '_blank', 'width=600,height=800')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Shortcut Kru — ${crew.name}</title>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: system-ui, sans-serif; background: #fff; padding: 32px; }
          .card { border: 2px solid #e2e8f0; border-radius: 16px; padding: 24px; max-width: 320px; margin: 0 auto; }
          .header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
          .avatar { width: 48px; height: 48px; background: #eff6ff; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px; color: #2563eb; flex-shrink: 0; }
          .name { font-size: 16px; font-weight: 700; color: #1e293b; }
          .sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 10px; font-weight: 600; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
          .qr-wrap { display: flex; justify-content: center; margin: 20px 0; }
          .url-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; font-family: monospace; font-size: 12px; color: #475569; word-break: break-all; text-align: center; }
          .footer { margin-top: 16px; text-align: center; font-size: 11px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div class="avatar">${crew.name.slice(0, 2).toUpperCase()}</div>
            <div>
              <div class="badge">${ROLE_LABEL[crew.role] ?? crew.role}</div>
              <div class="name">${crew.name}</div>
              <div class="sub">NIK: ${crew.nik}</div>
            </div>
          </div>
          <div class="qr-wrap">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shortUrl)}" width="200" height="200" />
          </div>
          <div class="url-box">${shortUrl}</div>
          <div class="footer">
            Scan QR atau kunjungi URL di atas<br/>untuk melihat jadwal dan info kru.
          </div>
        </div>
      </body>
      </html>
    `)
    win.document.close()
    setTimeout(() => { win.print(); win.close() }, 500)
  }, [crew, shortUrl])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-blue-500" />
            <h3 className="font-semibold text-slate-800 text-sm">Shortcut Akses Kru</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Crew identity */}
          <div className="flex items-center gap-3 bg-slate-50 rounded-2xl p-3">
            <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
              <span className="text-blue-700 font-bold text-sm">{crew.name.slice(0, 2).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800 text-sm truncate">{crew.name}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {ROLE_LABEL[crew.role] ?? crew.role}
                {crew.nik ? ` · NIK: ${crew.nik}` : ' · NIK belum diisi'}
              </p>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 shrink-0">
              {ROLE_LABEL[crew.role] ?? crew.role}
            </span>
          </div>

          {!crew.nik ? (
            /* No NIK — can't generate shortcut */
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl p-4">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">NIK belum diisi</p>
                <p className="text-xs text-amber-600 mt-1">
                  Shortcut kru menggunakan NIK sebagai identifikasi unik.
                  Isi NIK kru ini terlebih dahulu di halaman Edit, lalu buat shortcut-nya.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* QR Code */}
              <div className="flex flex-col items-center gap-3">
                <div className="p-4 bg-white border-2 border-slate-100 rounded-2xl shadow-sm">
                  <QRCodeSVG
                    value={shortUrl!}
                    size={180}
                    level="H"
                    fgColor="#1e293b"
                    includeMargin={false}
                  />
                </div>
                <p className="text-xs text-slate-400 text-center">Scan untuk melihat jadwal & info kru</p>
              </div>

              {/* Short URL */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500">URL Pendek</p>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                  <span className="text-sm font-mono text-slate-600 flex-1 truncate">{shortUrl}</span>
                  <button
                    onClick={handleCopy}
                    className={cn(
                      'flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all duration-150 cursor-pointer shrink-0',
                      copied
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600',
                    )}
                  >
                    {copied ? <><Check className="w-3 h-3" />Tersalin</> : <><Copy className="w-3 h-3" />Salin</>}
                  </button>
                </div>
              </div>

              {/* Full URL */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-500">URL Lengkap</p>
                <p className="text-xs font-mono text-slate-400 break-all bg-slate-50 rounded-lg px-3 py-2">{fullUrl}</p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5">
          {crew.nik && (
            <button
              onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Cetak
            </button>
          )}
          {fullUrl ? (
            <a
              href={fullUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer',
                crew.nik ? 'flex-1' : 'w-full',
              )}
            >
              <ExternalLink className="w-4 h-4" />
              Buka Portal
            </a>
          ) : (
            <button
              onClick={onClose}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Tutup
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
