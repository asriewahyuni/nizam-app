'use client'

import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'

export interface SearchableSelectOption {
  id: string
  name: string
  code: string
  balance?: number
}

interface SearchableSelectProps {
  label?: string
  options: SearchableSelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder: string
  required?: boolean
  className?: string
  dark?: boolean
  searchPlaceholder?: string
  maxVisibleOptions?: number
}

export function getVisibleSearchableOptions(
  options: SearchableSelectOption[],
  searchTerm: string,
  maxVisibleOptions?: number,
) {
  const normalizedSearch = searchTerm.trim().toLowerCase()
  const filtered = options.filter((option) =>
    option.name.toLowerCase().includes(normalizedSearch)
    || (option.code && option.code.toLowerCase().includes(normalizedSearch))
  )

  return typeof maxVisibleOptions === 'number' && maxVisibleOptions > 0
    ? filtered.slice(0, maxVisibleOptions)
    : filtered
}

export function SearchableSelect({
  label,
  options,
  value,
  onChange,
  placeholder,
  required = false,
  dark = false,
  searchPlaceholder = 'Cari kode atau nama akun...',
  maxVisibleOptions,
}: SearchableSelectProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const formatRupiah = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)

  const calcDropdownStyle = (): React.CSSProperties => {
    if (!containerRef.current) return {}
    const rect = containerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const dropdownMaxH = 264
    const openUpward = spaceBelow < dropdownMaxH && rect.top > dropdownMaxH
    return {
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
      ...(openUpward ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    }
  }

  const handleOpen = () => {
    setDropdownStyle(calcDropdownStyle())
    setIsOpen(true)
  }

  useEffect(() => {
    if (!isOpen) return
    const handleScroll = (e: Event) => {
      if (dropdownRef.current?.contains(e.target as Node)) return
      setIsOpen(false)
      setSearchTerm('')
    }
    const handleResize = () => setDropdownStyle(calcDropdownStyle())
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleResize)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      const insideTrigger = containerRef.current?.contains(e.target as Node)
      const insideDropdown = dropdownRef.current?.contains(e.target as Node)
      if (!insideTrigger && !insideDropdown) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const filtered = getVisibleSearchableOptions(options, searchTerm, maxVisibleOptions)

  const selectedOption = options.find((o) => o.id === (value || ''))

  const triggerClass = dark
    ? `w-full bg-slate-900 text-white border border-slate-800 rounded-xl px-4 py-3 text-xs font-semibold uppercase tracking-wide cursor-pointer hover:border-slate-600 transition-all flex justify-between items-center min-h-[44px] shadow-xl`
    : `w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[11px] font-bold text-slate-900 cursor-pointer hover:border-indigo-300 transition-all flex justify-between items-center min-h-[44px]`

  const dropdown = isOpen ? createPortal(
    <div ref={dropdownRef} style={dropdownStyle} className="bg-white border border-slate-200 rounded-xl shadow-2xl p-2 overflow-hidden">
      <input
        autoFocus
        className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[11px] outline-none focus:border-indigo-500 mb-2 font-medium"
        placeholder={searchPlaceholder}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onClick={(e) => e.stopPropagation()}
      />
      <div className="max-h-[200px] overflow-y-auto space-y-1 custom-scrollbar">
        {filtered.length === 0 ? (
          <p className="p-3 text-[10px] font-bold text-slate-400 text-center italic">Tidak ditemukan</p>
        ) : (
          filtered.map((opt) => (
            <div
              key={opt.id}
              onClick={() => {
                onChange(opt.id)
                setIsOpen(false)
                setSearchTerm('')
              }}
              className={`p-3 rounded-xl cursor-pointer text-[11px] font-bold transition-all flex justify-between items-center ${
                value === opt.id ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-50 text-slate-600'
              }`}
            >
              <div className="flex flex-col">
                <span className="leading-tight">{opt.name}</span>
                <span className={`text-[9px] ${value === opt.id ? 'text-indigo-200' : 'text-slate-400'}`}>{opt.code}</span>
              </div>
              <div className="text-right shrink-0 ml-2">
                {opt.balance !== undefined && (
                  <span className={`text-[10px] font-semibold ${value === opt.id ? 'text-white' : 'text-emerald-600'}`}>
                    {formatRupiah(opt.balance)}
                  </span>
                )}
                {value === opt.id && <Check aria-hidden="true" className="ml-1 h-4 w-4" />}
              </div>
            </div>
          ))
        )}
      </div>
    </div>,
    document.body
  ) : null

  return (
    <div className="space-y-1 relative w-full" ref={containerRef}>
      {label && (
        <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 px-1">
          {label}{required ? ' *' : ''}
        </label>
      )}
      <button
        type="button"
        onClick={handleOpen}
        className={triggerClass}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex flex-col min-w-0 flex-1">
          <span className={`truncate ${selectedOption ? (dark ? 'text-white' : 'text-slate-900') : 'text-slate-400'}`}>
            {selectedOption
              ? (selectedOption.code ? `${selectedOption.code} - ${selectedOption.name}` : selectedOption.name)
              : placeholder}
          </span>
          {selectedOption?.balance !== undefined && (
            <span className={`text-[9px] font-semibold uppercase mt-0.5 ${dark ? 'text-emerald-400' : 'text-emerald-600'}`}>
              Saldo: {formatRupiah(selectedOption.balance)}
            </span>
          )}
        </div>
        <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 ml-2 ${dark ? 'text-slate-500' : 'text-slate-400'}`} />
      </button>
      {dropdown}
    </div>
  )
}
