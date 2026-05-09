'use client'

import Link from 'next/link'
import { NIZAM_VERSION } from '@/lib/version'
import { Package } from 'lucide-react'

export function VersionBadge() {
  return (
    <Link
      href="/settings/version-info"
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-medium transition-colors"
      title={`NIZAM Full ${NIZAM_VERSION.full} - ${NIZAM_VERSION.codeName}`}
    >
      <Package className="w-3 h-3" />
      <span>{NIZAM_VERSION.short}</span>
    </Link>
  )
}
