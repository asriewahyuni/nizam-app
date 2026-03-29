/**
 * NIZAM ERP — Shared UI Primitives
 * Standard design system untuk seluruh modul.
 * Setiap komponen baru wajib menggunakan token dari sini.
 */
'use client'

import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, CheckCircle2, AlertTriangle, X } from 'lucide-react'

// ============================================================
// 1. SAFE ACTION BUTTON
// Anti double-submit: disabled otomatis saat loading.
// Tracks submission state internally.
// ============================================================
interface SafeButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'white' | 'indigo' | 'emerald' | 'amber' | 'blue'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  isLoading?: boolean
  loadingText?: string
  icon?: React.ReactNode
  done?: boolean
  onClick?: () => Promise<void> | void
  children?: React.ReactNode
  className?: string
  type?: 'button' | 'submit' | 'reset'
  form?: string
}

export function SafeButton({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  icon,
  className = '',
  type = 'button',
  isLoading: externalLoading,
  loadingText,
  done: externalDone,
  onClick,
  ...props
}: SafeButtonProps) {
  const [internalLoading, setInternalLoading] = useState(false)
  const [internalDone, setInternalDone] = useState(false)

  const loading = externalLoading ?? internalLoading
  const done = externalDone ?? internalDone

  const handleClick = useCallback(async (e?: any) => {
    if (!onClick) return // Allow form submit behavior
    if (loading || done || disabled) return
    if (e && e.preventDefault && type === 'button') e.preventDefault()

    setInternalLoading(true)
    try {
      await onClick()
      setInternalDone(true)
      setTimeout(() => setInternalDone(false), 2000)
    } catch (err: any) {
      console.error("SafeButton Action Failed:", err)
    } finally {
      setInternalLoading(false)
    }
  }, [onClick, loading, done, disabled, type])

  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-100 border border-blue-500/20',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-100 border border-rose-500/20',
    ghost: 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200',
    white: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm',
    indigo: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-100 border border-indigo-500/20',
    emerald: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-100 border border-emerald-500/20',
    amber: 'bg-amber-600 hover:bg-amber-700 text-white shadow-xl shadow-amber-100 border border-amber-500/20',
    blue: 'bg-sky-600 hover:bg-sky-700 text-white shadow-xl shadow-sky-100 border border-sky-500/20',
    secondary: 'bg-slate-800 hover:bg-slate-900 text-white shadow-xl shadow-slate-200 border border-slate-700'
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-[10px] gap-1.5 rounded-xl',
    md: 'px-5 py-2.5 text-xs gap-2 rounded-2xl',
    lg: 'px-7 py-3.5 text-sm gap-2.5 rounded-[22px]',
    xl: 'px-10 py-5 text-base gap-3 rounded-[28px]'
  }

  return (
    <button
      type={type}
      onClick={handleClick}
      disabled={loading || done || disabled}
      className={`
        inline-flex items-center justify-center gap-2 font-black transition-all active:scale-95
        disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      {...props}
    >
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex items-center gap-2">
            <Loader2 size={16} className="animate-spin shrink-0" />
            <span className="text-[10px]">{loadingText || 'Working...'}</span>
          </motion.div>
        ) : done ? (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="flex items-center gap-2 text-emerald-300">
            <CheckCircle2 size={16} className="shrink-0" />
            <span className="text-[10px]">SUCCESS</span>
          </motion.div>
        ) : (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
            {icon && <span className="shrink-0">{icon}</span>}
            <span className="truncate">{children}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  )
}

// ============================================================
// 2. MODULE PAGE HEADER
// Uniform header untuk setiap halaman modul
// ============================================================
interface PageHeaderProps {
  tag?: string
  title: string
  subtitle?: string
  actions?: React.ReactNode
  icon?: React.ReactNode
  iconColor?: string
}

export function PageHeader({ tag, title, subtitle, actions, icon, iconColor = 'text-blue-600' }: PageHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12 pb-4 border-b border-slate-100/80">
      <div className="space-y-2">
        <div className="flex items-center gap-4">
          {icon && (
            <div className={`p-3.5 rounded-2xl bg-white shadow-xl shadow-slate-100 border border-slate-100 ${iconColor}`}>
              {typeof icon === 'function' ? 
                React.createElement(icon as React.ComponentType<any>, { size: 28, strokeWidth: 2.5 }) :
                React.isValidElement(icon) ? 
                React.cloneElement(icon as React.ReactElement<any>, { size: 28, strokeWidth: 2.5 }) :
                null
              }
            </div>
          )}
          <div className="space-y-0.5">
            {tag && (
              <div className="flex items-center gap-2 text-indigo-500 font-black tracking-[0.2em] text-[8px] uppercase bg-indigo-50 w-fit px-3 py-1 rounded-full border border-indigo-100 mb-1 italic">
                {tag}
              </div>
            )}
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-none">{title}</h1>
          </div>
        </div>
        {subtitle && <p className="text-sm text-slate-400 font-medium tracking-tight pl-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3 flex-wrap">{actions}</div>}
    </div>
  )
}

// ============================================================
// 3. STAT CARD (PREMIUM ZAKAT STYLE)
// ============================================================
interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  color?: 'emerald' | 'rose' | 'blue' | 'amber' | 'slate' | 'indigo' | 'orange'
  icon?: any
  alert?: boolean
  trend?: { value: string; positive: boolean }
  onClick?: () => void
}

export function StatCard({ label, value, sub, color = 'slate', icon: Icon, alert, trend, onClick }: StatCardProps) {
  const styles = {
    emerald: 'bg-emerald-50/50 border-emerald-100 hover:border-emerald-300 text-emerald-900 shadow-emerald-100/10',
    rose: 'bg-rose-50/50 border-rose-100 hover:border-rose-300 text-rose-900 shadow-rose-100/10',
    blue: 'bg-blue-50/50 border-blue-100 hover:border-blue-300 text-blue-900 shadow-blue-100/10',
    amber: 'bg-amber-50/50 border-amber-100 hover:border-amber-300 text-amber-900 shadow-amber-100/10',
    indigo: 'bg-indigo-50/50 border-indigo-100 hover:border-indigo-300 text-indigo-900 shadow-indigo-100/10',
    orange: 'bg-orange-600 border-orange-500 text-white shadow-orange-200 shadow-xl',
    slate: 'bg-white border-slate-100 hover:border-slate-200 text-slate-900 shadow-slate-100/30',
  }

  const iconColors = {
    emerald: 'text-emerald-500 bg-emerald-100',
    rose: 'text-rose-500 bg-rose-100',
    blue: 'text-blue-500 bg-blue-100',
    amber: 'text-amber-500 bg-amber-100',
    indigo: 'text-indigo-500 bg-indigo-100',
    orange: 'text-white bg-white/20',
    slate: 'text-slate-400 bg-slate-50',
  }

  const isOrange = color === 'orange'

  return (
    <div 
      onClick={onClick}
      className={`p-8 rounded-[40px] border shadow-[0_15px_30px_-5px_rgba(0,0,0,0.02)] transition-all duration-500 relative overflow-hidden flex flex-col justify-between h-full min-h-[180px] ${styles[color]} ${onClick ? 'cursor-pointer hover:-translate-y-1 hover:shadow-xl group/card' : 'group'}`}
    >
      <div className="flex items-start justify-between mb-4 relative z-10">
        <div className="space-y-1">
          <p className={`text-[10px] font-black uppercase tracking-[0.2em] opacity-60 ${isOrange ? 'text-white' : 'text-slate-400'}`}>
            {label}
          </p>
          <div className={`text-2xl font-black font-mono tracking-tighter truncate ${isOrange ? 'text-white' : 'text-slate-900'}`}>{value}</div>
        </div>
        {Icon && (
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 ${iconColors[color]}`}>
            <Icon size={24} strokeWidth={2.5} />
          </div>
        )}
      </div>

      <div className="relative z-10 space-y-3">
        {sub && <p className={`text-[10px] font-bold italic opacity-60 ${isOrange ? 'text-white' : 'text-slate-400'}`}>{sub}</p>}
        {trend && (
           <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black font-mono border
             ${trend.positive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}
           `}>
             {trend.value}
           </div>
        )}
      </div>
      
      {alert && <div className="absolute top-4 right-4"><AlertTriangle size={16} className="text-amber-500 animate-pulse" /></div>}
    </div>
  )
}

// ============================================================
// 4. EMPTY STATE
// ============================================================
interface EmptyStateProps {
  icon?: any
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6 text-center bg-white rounded-[48px] border-2 border-dashed border-slate-100 shadow-inner">
      {Icon && (
        <div className="w-20 h-20 rounded-[32px] bg-slate-50 flex items-center justify-center text-slate-300 shadow-inner">
          <Icon size={40} strokeWidth={1.5} />
        </div>
      )}
      <div className="space-y-1">
        <p className="font-black text-slate-900 text-xl tracking-tight">{title}</p>
        {description && <p className="text-sm text-slate-400 font-medium mt-1 max-w-sm mx-auto leading-relaxed">{description}</p>}
      </div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ============================================================
// 5. SECTION CARD & HEADER
// ============================================================
export function SectionCard({ children, className = '', glass = false }: { children: React.ReactNode; className?: string; glass?: boolean }) {
  return (
    <div className={`
      rounded-[40px] border shadow-[0_20px_40px_-10px_rgba(0,0,0,0.03)] overflow-hidden transition-all
      ${glass ? 'bg-white/70 backdrop-blur-xl border-white/50' : 'bg-white border-slate-100'}
      ${className}
    `}>
      {children}
    </div>
  )
}

export function SectionHeader({ title, subtitle, actions, icon }: { title: React.ReactNode; subtitle?: string; actions?: React.ReactNode; icon?: any }) {
  return (
    <div className="px-10 py-7 border-b border-slate-100/80 bg-slate-50/40 flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        {icon && (
          <div className="w-10 h-10 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-400">
            {typeof icon === 'function' ? 
              React.createElement(icon as React.ComponentType<any>, { size: 20 }) :
              React.isValidElement(icon) ? 
              React.cloneElement(icon as React.ReactElement<any>, { size: 20 }) :
              null
            }
          </div>
        )}
        <div>
          <div className="font-black text-slate-900 text-sm uppercase tracking-widest">{title}</div>
          {subtitle && <div className="text-[10px] text-slate-400 font-bold italic mt-0.5 tracking-tight">{subtitle}</div>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  )
}

// ============================================================
// 6. STATUS BADGE
// ============================================================
type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'indigo'

export function StatusBadge({ label, variant = 'neutral' }: { label: string; variant?: BadgeVariant }) {
  const styles: Record<BadgeVariant, string> = {
    success: 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-emerald-100/20',
    warning: 'bg-amber-50 text-amber-600 border-amber-100 shadow-amber-100/20',
    error: 'bg-rose-50 text-rose-600 border-rose-100 shadow-rose-100/20',
    info: 'bg-blue-50 text-blue-600 border-blue-100 shadow-blue-100/20',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100 shadow-indigo-100/20',
    neutral: 'bg-slate-50 text-slate-500 border-slate-100 shadow-slate-100/20',
  }

  return (
    <span className={`inline-block px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] border shadow-sm ${styles[variant]}`}>
      {label}
    </span>
  )
}

// ============================================================
// 7. CONFIRMATION DIALOG
// ============================================================
interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  title: string
  message: string
  confirmLabel?: string
  variant?: 'danger' | 'primary'
}

export function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Konfirmasi', variant = 'danger' }: ConfirmDialogProps) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="relative bg-white rounded-[48px] shadow-2xl p-10 w-full max-w-sm space-y-8 text-center overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-rose-500 to-amber-500" />
        <div className="space-y-4">
          <div className="w-20 h-20 rounded-[32px] bg-rose-50 flex items-center justify-center mx-auto shadow-inner">
            <AlertTriangle size={40} className="text-rose-600" />
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-2xl tracking-tighter">{title}</h3>
            <p className="text-sm text-slate-400 font-medium mt-2 leading-relaxed px-2">{message}</p>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <SafeButton onClick={onConfirm} variant={variant === 'danger' ? 'danger' : 'primary'} size="lg" className="w-full">
            {confirmLabel}
          </SafeButton>
          <button onClick={onClose} className="py-4 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">
            Batalkan Aksi
          </button>
        </div>
      </motion.div>
    </div>
  )
}
