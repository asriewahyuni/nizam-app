'use client'

import React from 'react'
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  ShoppingCart,
  Truck,
  FileText,
  CreditCard,
  BookOpen,
  ArrowRight,
  Package,
  Layers,
  Users,
} from 'lucide-react'
import { resolveSourceDocumentLink, extractDocumentNumber } from '@/lib/utils/document-links'

interface DocumentFlowStepperProps {
  referenceType?: string | null
  referenceId?: string | null
  description?: string | null
  memo?: string | null
  entryNumber?: string | null
  status?: string | null
}

type FlowStep = {
  id: string
  label: string
  docCode?: string
  url?: string
  status: 'completed' | 'current' | 'upcoming'
  icon: React.ElementType
}

export function DocumentFlowStepper({
  referenceType,
  referenceId,
  description,
  memo,
  entryNumber,
  status = 'POSTED',
}: DocumentFlowStepperProps) {
  const type = String(referenceType || '').toUpperCase().trim()
  const docLink = resolveSourceDocumentLink(referenceType, referenceId, description, memo)
  const detectedCode = docLink?.documentCode || extractDocumentNumber(description)

  // Build steps based on reference type
  let steps: FlowStep[] = []

  if (type.includes('SALE') || type.includes('POS') || (description && description.includes('Penjualan'))) {
    steps = [
      {
        id: 'order',
        label: 'Order Penjualan',
        docCode: detectedCode?.startsWith('SO') ? detectedCode : undefined,
        url: docLink?.url,
        status: 'completed',
        icon: ShoppingCart,
      },
      {
        id: 'delivery',
        label: 'Pengiriman / Stok',
        status: 'completed',
        icon: Truck,
      },
      {
        id: 'invoice',
        label: 'Faktur & Piutang',
        status: 'completed',
        icon: FileText,
      },
      {
        id: 'payment',
        label: 'Penerimaan Kas',
        status: 'completed',
        icon: CreditCard,
      },
      {
        id: 'journal',
        label: `Jurnal (${entryNumber || 'JV'})`,
        status: status === 'POSTED' ? 'completed' : 'current',
        icon: BookOpen,
      },
    ]
  } else if (type.includes('PURCHASE') || (description && description.includes('Pembelian'))) {
    steps = [
      {
        id: 'po',
        label: 'Pesanan Beli (PO)',
        docCode: detectedCode?.startsWith('PO') ? detectedCode : undefined,
        url: docLink?.url,
        status: 'completed',
        icon: ShoppingCart,
      },
      {
        id: 'receiving',
        label: 'Penerimaan Barang',
        status: 'completed',
        icon: Package,
      },
      {
        id: 'bill',
        label: 'Tagihan Supplier',
        status: 'completed',
        icon: FileText,
      },
      {
        id: 'payment',
        label: 'Pengeluaran Kas',
        status: 'completed',
        icon: CreditCard,
      },
      {
        id: 'journal',
        label: `Jurnal (${entryNumber || 'JV'})`,
        status: status === 'POSTED' ? 'completed' : 'current',
        icon: BookOpen,
      },
    ]
  } else if (type.includes('EXPENSE') || type.includes('CASH') || (description && description.includes('Beban'))) {
    steps = [
      {
        id: 'request',
        label: 'Pencatatan Beban',
        status: 'completed',
        icon: FileText,
      },
      {
        id: 'disbursement',
        label: 'Kas & Bank Keluar',
        url: '/cash',
        status: 'completed',
        icon: CreditCard,
      },
      {
        id: 'journal',
        label: `Jurnal (${entryNumber || 'JV'})`,
        status: status === 'POSTED' ? 'completed' : 'current',
        icon: BookOpen,
      },
    ]
  } else if (type.includes('INVENTORY') || type.includes('STOCK')) {
    steps = [
      {
        id: 'movement',
        label: 'Mutasi Stok Fisik',
        url: '/inventory',
        status: 'completed',
        icon: Package,
      },
      {
        id: 'valuation',
        label: 'Penilaian Persediaan',
        status: 'completed',
        icon: Layers,
      },
      {
        id: 'journal',
        label: `Jurnal (${entryNumber || 'JV'})`,
        status: status === 'POSTED' ? 'completed' : 'current',
        icon: BookOpen,
      },
    ]
  } else if (type.includes('PAYROLL') || (description && description.includes('Gaji'))) {
    steps = [
      {
        id: 'timesheet',
        label: 'Presensi & Lembur',
        url: '/hris',
        status: 'completed',
        icon: Users,
      },
      {
        id: 'payroll_calc',
        label: 'Slip Gaji & Payroll',
        url: '/hris',
        status: 'completed',
        icon: FileText,
      },
      {
        id: 'payment',
        label: 'Disbursement Gaji',
        status: 'completed',
        icon: CreditCard,
      },
      {
        id: 'journal',
        label: `Jurnal (${entryNumber || 'JV'})`,
        status: status === 'POSTED' ? 'completed' : 'current',
        icon: BookOpen,
      },
    ]
  } else {
    steps = [
      {
        id: 'source',
        label: 'Dokumen Sumber',
        docCode: detectedCode || undefined,
        url: docLink?.url,
        status: 'completed',
        icon: FileText,
      },
      {
        id: 'journal',
        label: `Jurnal Umum (${entryNumber || 'JV'})`,
        status: status === 'POSTED' ? 'completed' : 'current',
        icon: BookOpen,
      },
    ]
  }

  return (
    <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Layers size={13} className="text-blue-600" />
          Rantai Dokumen Terkait (Document Flow)
        </span>
        {docLink && (
          <a
            href={docLink.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
          >
            <span>Buka Modul {docLink.module}</span>
            <ExternalLink size={11} />
          </a>
        )}
      </div>

      <div className="flex items-center justify-between gap-1 sm:gap-2 overflow-x-auto pb-1">
        {steps.map((step, idx) => {
          const Icon = step.icon
          const isLast = idx === steps.length - 1

          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center text-center shrink-0 min-w-[75px] max-w-[120px]">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    step.status === 'completed'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : step.status === 'current'
                        ? 'bg-blue-100 text-blue-700 border-2 border-blue-600'
                        : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  <Icon size={14} />
                </div>
                <span className="text-[10px] font-bold text-slate-800 mt-1.5 leading-tight truncate max-w-full">
                  {step.label}
                </span>
                {step.docCode && (
                  <span className="text-[9px] font-mono font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 mt-0.5">
                    {step.docCode}
                  </span>
                )}
              </div>

              {!isLast && (
                <div className="flex-1 min-w-[16px] h-0.5 bg-slate-200 self-center -mt-4 shrink" />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
