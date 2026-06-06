'use client'

import { useState, useRef, useCallback } from 'react'
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react'
import {
  X, Copy, Check, Printer, ExternalLink, Share2,
  Store, MapPin, Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BusPool } from '@/modules/po-bus/lib/po-bus-types'

function formatRupiah(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID')
}

const POOL_TYPE_LABEL: Record<string, string> = {
  POOL_UTAMA: 'Pool Utama',
  AGEN_RESMI: 'Agen Resmi',
  SUB_AGEN: 'Sub-Agen',
}

interface PoolShortcutModalProps {
  pool: BusPool
  onClose: () => void
}

export function PoolShortcutModal({ pool, onClose }: PoolShortcutModalProps) {
  const [copied, setCopied] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const shortUrl = `${baseUrl}/p/${pool.code.toLowerCase()}`
  const fullUrl  = `${baseUrl}/portal/pool/${pool.code.toLowerCase()}`

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(shortUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [shortUrl])

  const handlePrint = useCallback(() => {
    const printContent = printRef.current?.innerHTML
    if (!printContent) return
    const win = window.open('', '_blank', 'width=600,height=800')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Shortcut Pool — ${pool.name}</title>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: system-ui, sans-serif; background: #fff; padding: 32px; }
          .card { border: 2px solid #e2e8f0; border-radius: 16px; padding: 24px; max-width: 360px; margin: 0 auto; }
          .header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
          .avatar { width: 48px; height: 48px; background: #eff6ff; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px; color: #2563eb; flex-shrink: 0; }
          .name { font-size: 16px; font-weight: 700; color: #1e293b; }
          .code { font-size: 11px; color: #94a3b8; font-family: monospace; margin-top: 2px; }
          .qr-wrap { display: flex; justify-content: center; margin: 20px 0; }
          .url-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; font-family: monospace; font-size: 12px; color: #475569; word-break: break-all; text-align: center; }
          .footer { margin-top: 16px; text-align: center; font-size: 11px; color: #94a3b8; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 10px; font-weight: 600; background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; margin-bottom: 8px; }
          .meta { font-size: 11px; color: #64748b; margin-top: 4px; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div class="avatar">${pool.name.slice(0, 2).toUpperCase()}</div>
            <div>
              <div class="badge">${POOL_TYPE_LABEL[pool.pool_type] ?? pool.pool_type}</div>
              <div class="name">${pool.name}</div>
              <div class="code">${pool.code}${pool.city ? ' · ' + pool.city : ''}</div>
            </div>
          </div>
          <div class="qr-wrap">
            <!-- QR will be inlined by the browser -->
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shortUrl)}" width="200" height="200" />
          </div>
          <div class="url-box">${shortUrl}</div>
          <div class="footer">
            Scan QR atau kunjungi URL di atas untuk melihat<br/>dashboard pool Anda secara real-time.
          </div>
        </div>
      </body>
      </html>
    `)
    win.document.close()
    setTimeout(() => { win.print(); win.close() }, 500)
  }, [pool, shortUrl])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-blue-500" />
            <h3 className="font-semibold text-slate-800 text-sm">Shortcut Akses Pool</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5" ref={printRef}>
          {/* Pool identity */}
          <div className="flex items-center gap-3 bg-slate-50 rounded-2xl p-3">
            <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
              <span className="text-blue-700 font-bold text-sm">{pool.name.slice(0, 2).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800 text-sm truncate">{pool.name}</p>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">{pool.code}{pool.city ? ` · ${pool.city}` : ''}</p>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0">
              {POOL_TYPE_LABEL[pool.pool_type] ?? pool.pool_type}
            </span>
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center gap-3">
            <div className="p-4 bg-white border-2 border-slate-100 rounded-2xl shadow-sm">
              <QRCodeSVG
                value={shortUrl}
                size={180}
                level="H"
                fgColor="#1e293b"
                includeMargin={false}
                imageSettings={{
                  src: '',
                  width: 0,
                  height: 0,
                  excavate: false,
                }}
              />
            </div>
            <p className="text-xs text-slate-400 text-center">Scan QR code untuk akses portal pool</p>
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
        </div>

        {/* Footer actions */}
        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Cetak
          </button>
          <a
            href={fullUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <ExternalLink className="w-4 h-4" />
            Buka Portal
          </a>
        </div>
      </div>
    </div>
  )
}
