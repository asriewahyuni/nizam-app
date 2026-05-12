'use client'

import React, { useState, useEffect } from 'react'

interface CurrencyInputProps {
  label?: string
  value: number
  onChange: (value: number) => void
  name?: string
  className?: string
  labelClassName?: string
  placeholder?: string
  highlight?: boolean
  disabled?: boolean
}

export function CurrencyInput({ 
  label, 
  value, 
  onChange, 
  name,
  className = "", 
  labelClassName = "",
  placeholder = "0",
  highlight = false,
  disabled = false,
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState('')

  useEffect(() => {
    if (value === 0 && displayValue !== '') {
      setDisplayValue('')
    } else if (value !== 0) {
      const formatted = new Intl.NumberFormat('id-ID').format(value)
      if (formatted !== displayValue) {
         setDisplayValue(formatted)
      }
    }
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return
    const rawValue = e.target.value.replace(/\D/g, '')
    const numValue = parseInt(rawValue, 10) || 0
    
    // Update local display immediately for smoothness
    const formatted = rawValue === '' ? '' : new Intl.NumberFormat('id-ID').format(numValue)
    setDisplayValue(formatted)
    
    // Inform parent
    onChange(numValue)
  }

  return (
    <div className="space-y-1.5 flex-1">
      <label className={`text-[10px] font-semibold tracking-tight px-1 ${labelClassName || 'text-slate-400'}`}>
        {label}
      </label>
      <div className="relative">
        {name && <input type="hidden" name={name} value={value} />}
        <input
          type="text"
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          autoComplete="off"
          disabled={disabled}
          className={`w-full px-5 py-3 border rounded-2xl outline-none text-sm font-semibold transition-all ${
            highlight 
              ? 'border-emerald-200 bg-white text-emerald-600 focus:border-emerald-500 shadow-sm shadow-emerald-50' 
              : 'border-slate-200 bg-white text-slate-900 focus:border-indigo-500 shadow-sm shadow-slate-50'
          } ${disabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''} ${className}`}
        />
        {value > 0 && (
          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[8px] font-semibold text-slate-300 opacity-50 px-1">RP</span>
        )}
      </div>
    </div>
  )
}
