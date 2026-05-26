'use client'

import React, { useState, useRef, useEffect } from 'react'

interface Option {
  id: string
  name: string
  code: string
  balance?: number
}

interface SearchableSelectProps {
  label: string
  options: Option[]
  value: string
  onChange: (value: string) => void
  placeholder: string
  required?: boolean
  className?: string
}

export function SearchableSelect({ 
  label, 
  options, 
  value, 
  onChange, 
  placeholder, 
  required = false 
}: SearchableSelectProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const filtered = options.filter((o: any) => 
    o.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (o.code && o.code.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const selectedOption = options.find((o: any) => o.id === (value || ''))

  return (
    <div className="space-y-1 relative w-full" ref={containerRef}>
      <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 px-1">{label}</label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-900 text-[11px] cursor-pointer hover:border-indigo-300 transition-all flex justify-between items-center min-h-[44px]"
      >
        <div className="flex flex-col">
           <span className={selectedOption ? 'text-slate-900' : 'text-slate-400'}>
            {selectedOption ? (selectedOption.code ? `${selectedOption.code} - ${selectedOption.name}` : selectedOption.name) : placeholder}
          </span>
          {selectedOption?.balance !== undefined && (
            <span className="text-[9px] text-emerald-600 font-semibold uppercase mt-0.5">Saldo: {formatRupiah(selectedOption.balance)}</span>
          )}
        </div>
        <div className="text-slate-400 text-[8px]">▼</div>
      </div>

      {isOpen && (
        <div className="absolute z-[1000] top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-md p-2 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
          <input 
            autoFocus
            className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[11px] outline-none focus:border-indigo-500 mb-2 font-medium"
            placeholder="Cari..."
            value={searchTerm}
            onChange={(e: any) => setSearchTerm(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
          <div className="max-h-[200px] overflow-y-auto space-y-1 custom-scrollbar">
            {filtered.length === 0 ? (
              <p className="p-3 text-[10px] font-bold text-slate-400 text-center italic">Tidak ditemukan</p>
            ) : (
              filtered.map((opt: any) => (
                <div 
                  key={opt.id}
                  onClick={() => {
                    onChange(opt.id)
                    setIsOpen(false)
                    setSearchTerm('')
                  }}
                  className={`p-3 rounded-xl cursor-pointer text-[11px] font-bold transition-all flex justify-between items-center group ${
                    value === opt.id ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="leading-tight">{opt.name}</span>
                    <span className={`text-[9px] ${value === opt.id ? 'text-indigo-200' : 'text-slate-400'}`}>{opt.code}</span>
                  </div>
                  <div className="text-right">
                    {opt.balance !== undefined && (
                       <span className={`text-[10px] font-semibold ${value === opt.id ? 'text-white' : 'text-emerald-600'}`}>
                         {formatRupiah(opt.balance)}
                       </span>
                    )}
                    {value === opt.id && <span className="text-xs ml-2">✓</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
