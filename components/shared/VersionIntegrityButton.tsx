'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck, X, Zap, BookOpen, Sparkles, Wrench,
  ChevronRight, GitCommit, Clock, User,
} from 'lucide-react'
import { NIZAM_VERSION, NIZAM_VERSION_FULL, NIZAM_VERSION_LABEL } from '@/lib/version'
import { VERSION_LOG, type VersionLogEntry } from '@/lib/version-log'
import { ADDON_REGISTRY } from '@/lib/addon-registry'
import { BUSINESS_TYPE_MODULES, PILLAR_MODULES } from '@/modules/marketplace/lib/module-registry'

export function VersionIntegrityButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(true)}
        title="Version Integrity — lihat changelog"
        className="relative group flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[10px] font-black tracking-tight
          bg-gradient-to-r from-slate-900 to-blue-900 text-white
          shadow-lg shadow-slate-200 hover:shadow-xl hover:from-blue-800 hover:to-blue-950
          transition-all duration-200 border border-white/10"
      >
        <ShieldCheck className="h-3 w-3 text-emerald-300" />
        <span className="tracking-wide">{NIZAM_VERSION_LABEL}</span>
        <Wrench className="h-2.5 w-2.5 text-blue-300 ml-0.5" />
      </button>

      {/* Modal Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] flex items-start justify-center pt-[10vh] bg-black/60"
            onClick={() => setOpen(false)}
          >
            {/* Modal */}
            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="relative w-full max-w-2xl max-h-[75vh] overflow-y-auto rounded-[28px] bg-white shadow-2xl border border-slate-200"
            >
              {/* X Button — absolute di pojok modal, selalu keliatan */}
              <button
                onClick={() => setOpen(false)}
                className="sticky top-4 z-50 float-right mr-4 w-9 h-9 rounded-xl bg-white/90 border border-slate-200 shadow-lg flex items-center justify-center hover:bg-white transition-all text-slate-500 hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Header */}
              <div className="relative -mt-2 mx-4 rounded-[24px] bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-6 text-white shadow-xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5 text-emerald-300" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-200">
                      Version Integrity
                    </div>
                    <h2 className="text-lg font-black tracking-tight">
                      {NIZAM_VERSION_LABEL}
                    </h2>
                  </div>
                </div>

                {/* Version Summary Chips */}
                <div className="flex flex-wrap gap-2 mt-4">
                  <Chip label={`Core v${NIZAM_VERSION.core}`} color="blue" />
                  <Chip label={`${NIZAM_VERSION.module} Modul Operasional`} color="emerald" />
                  <Chip label={`${NIZAM_VERSION.addon} Add-on`} color="amber" />
                  <Chip label={`${NIZAM_VERSION.patch} Patch`} color="slate" />
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6">

                {/* 4 Pilar */}
                <Section title="🏛️ 4 Pilar Inti" icon={<ShieldCheck className="h-4 w-4" />}>
                  <div className="grid grid-cols-2 gap-2">
                    {PILLAR_MODULES.map(m => (
                      <div key={m.key} className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-xs font-medium text-slate-700">
                        <span>{m.icon}</span>
                        <span className="truncate">{m.name}</span>
                      </div>
                    ))}
                  </div>
                </Section>

                {/* Business Type */}
                <Section title="🔄 Business Type (swapable)" icon={<Zap className="h-4 w-4" />}>
                  <div className="grid grid-cols-2 gap-2">
                    {BUSINESS_TYPE_MODULES.map(m => (
                      <div key={m.key} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
                        <span>{m.icon}</span>
                        <span className="truncate">{m.name}</span>
                      </div>
                    ))}
                  </div>
                </Section>

                {/* Ringkasan Add-on */}
                <Section title="🧩 Add-on" icon={<Sparkles className="h-4 w-4" />}>
                  {ADDON_REGISTRY.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Belum ada add-on dirilis.</p>
                  ) : (
                    <div className="space-y-2">
                      {ADDON_REGISTRY.map(a => (
                        <div key={a.key} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                          <div className="flex items-center gap-2 text-xs text-slate-700">
                            <span>{a.icon}</span>
                            <span className="font-medium">{a.name}</span>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            a.released
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-200 text-slate-500'
                          }`}>
                            {a.released ? 'Rilis' : 'Planned'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

                {/* Changelog */}
                <Section title="📜 Changelog" icon={<GitCommit className="h-4 w-4" />}>
                  <div className="space-y-3 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200">
                    {VERSION_LOG.map((entry, i) => (
                      <LogEntry key={i} entry={entry} isFirst={i === 0} />
                    ))}
                  </div>
                </Section>

                {/* Footer */}
                <div className="text-center pt-2">
                  <p className="text-[10px] text-slate-400 font-mono">
                    {NIZAM_VERSION_FULL} — Built with integrity, not talk.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Chip({ label, color }: { label: string; color: 'blue' | 'emerald' | 'amber' | 'slate' }) {
  const colors = {
    blue: 'bg-blue-500/20 text-blue-200 border-blue-400/20',
    emerald: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/20',
    amber: 'bg-amber-500/20 text-amber-200 border-amber-400/20',
    slate: 'bg-slate-500/20 text-slate-200 border-slate-400/20',
  }
  return (
    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${colors[color]}`}>
      {label}
    </span>
  )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-3">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  )
}

function LogEntry({ entry, isFirst }: { entry: VersionLogEntry; isFirst: boolean }) {
  const typeColors: Record<string, string> = {
    core: 'bg-blue-100 text-blue-700 border-blue-200',
    module: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    addon: 'bg-amber-100 text-amber-700 border-amber-200',
    patch: 'bg-slate-100 text-slate-600 border-slate-200',
  }
  const typeIcons: Record<string, React.ReactNode> = {
    core: <ShieldCheck className="h-4 w-4" />,
    module: <Zap className="h-4 w-4" />,
    addon: <Sparkles className="h-4 w-4" />,
    patch: <Wrench className="h-4 w-4" />,
  }

  return (
    <div className="relative flex gap-4 pl-7">
      {/* Timeline dot */}
      <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-2 flex items-center justify-center
        ${typeColors[entry.type] || 'bg-slate-100 border-slate-200'}`}>
        <span className="[&>svg]:h-3 [&>svg]:w-3">
          {typeIcons[entry.type] || <Wrench className="h-3 w-3" />}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded border ${typeColors[entry.type]}`}>
              {entry.type}
            </span>
            {isFirst && (
              <span className="text-[9px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">
                LATEST
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-400 shrink-0">
            <Clock className="h-3 w-3" />
            {entry.date}
            {entry.by && (
              <>
                <User className="h-3 w-3 ml-1" />
                {entry.by}
              </>
            )}
          </div>
        </div>
        <p className="text-sm font-bold text-slate-900 mt-1">{entry.label}</p>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{entry.description}</p>
      </div>
    </div>
  )
}
