'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Globe, ChevronDown, RefreshCw, Loader2 } from 'lucide-react'

interface CurrencyPickerProps {
  orgId: string
  value: string // currency code like 'USD', 'IDR'
  onChange: (currency: string, rate?: number) => void
  disabled?: boolean
  showRate?: boolean
  className?: string
}

const CURRENCY_META: Record<string, { symbol: string; name: string }> = {
  IDR: { symbol: 'Rp', name: 'Rupiah' },
  USD: { symbol: '$', name: 'US Dollar' },
  SGD: { symbol: 'S$', name: 'Singapore Dollar' },
  MYR: { symbol: 'RM', name: 'Malaysian Ringgit' },
  EUR: { symbol: '€', name: 'Euro' },
  GBP: { symbol: '£', name: 'British Pound' },
  JPY: { symbol: '¥', name: 'Japanese Yen' },
  CNY: { symbol: '¥', name: 'Chinese Yuan' },
  AUD: { symbol: 'A$', name: 'Australian Dollar' },
  SAR: { symbol: '﷼', name: 'Saudi Riyal' },
  THB: { symbol: '฿', name: 'Thai Baht' },
}

export function CurrencyBadge({ currency, showSymbol = true, size = 'sm' }: { 
  currency?: string | null 
  showSymbol?: boolean
  size?: 'sm' | 'md' | 'lg'
}) {
  if (!currency || currency === 'IDR' || currency === 'Rp') return null
  
  const meta = CURRENCY_META[currency] || { symbol: currency, name: currency }
  const sizeClasses = size === 'sm' ? 'text-[10px] px-2 py-0.5' : size === 'md' ? 'text-xs px-2.5 py-1' : 'text-sm px-3 py-1.5'
  
  return (
    <span className={`inline-flex items-center gap-1 font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-100 ${sizeClasses}`}>
      <Globe size={size === 'sm' ? 10 : 12} />
      {showSymbol ? meta.symbol : ''}{currency}
    </span>
  )
}

export function ExchangeRateDisplay({ 
  rate, 
  fromCurrency, 
  toCurrency = 'IDR',
  className = ''
}: {
  rate?: number | null
  fromCurrency?: string | null
  toCurrency?: string
  className?: string
}) {
  if (!rate || !fromCurrency || fromCurrency === 'IDR') return null
  
  return (
    <span className={`text-[10px] font-bold text-slate-400 ${className}`}>
      1 {fromCurrency} = Rp {rate.toLocaleString('id-ID', { maximumFractionDigits: 2 })}
    </span>
  )
}

export function ConvertedAmount({
  amount,
  fromCurrency,
  rate,
  toCurrency = 'IDR',
}: {
  amount: number
  fromCurrency?: string | null
  rate?: number | null
  toCurrency?: string
}) {
  if (!fromCurrency || fromCurrency === 'IDR' || !rate) return null
  
  const converted = amount * rate
  
  return (
    <span className="text-[11px] text-slate-400 font-mono">
      ≈ Rp {converted.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
    </span>
  )
}

export default function CurrencyPicker({
  orgId,
  value,
  onChange,
  disabled = false,
  showRate = true,
  className = '',
}: CurrencyPickerProps) {
  const [open, setOpen] = useState(false)
  const [currencies, setCurrencies] = useState<string[]>(['IDR'])
  const [rates, setRates] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)

  const fetchCurrencies = useCallback(async () => {
    setLoading(true)
    try {
      const { getAllowedCurrencies, getExchangeRates } = await import('@/modules/accounting/actions/currencies.actions')
      const [allowed, rateData] = await Promise.all([
        getAllowedCurrencies(orgId),
        getExchangeRates(orgId),
      ])

      const codes = [value || 'IDR', ...allowed.map((c: any) => c.currency_code)]
      setCurrencies(Array.from(new Set(codes)))

      const rateMap: Record<string, number> = { IDR: 1 }
      for (const r of rateData.latestRates) {
        rateMap[r.from_currency] = r.rate
      }
      setRates(rateMap)
    } catch (e) {
      console.error('Failed to fetch currencies:', e)
    }
    setLoading(false)
  }, [orgId])

  useEffect(() => {
    fetchCurrencies()
  }, [fetchCurrencies])

  const selected = value || 'IDR'
  const meta = CURRENCY_META[selected] || { symbol: selected, name: selected }
  const rate = rates[selected]

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-300 transition-all disabled:opacity-40"
      >
        <Globe size={14} className="text-slate-400" />
        <span className="font-bold text-sm text-slate-700">{meta.symbol}</span>
        <span className="font-bold text-sm text-slate-900">{selected}</span>
        {loading ? (
          <Loader2 size={12} className="animate-spin text-slate-300" />
        ) : (
          <ChevronDown size={12} className="text-slate-300" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-white rounded-2xl border border-slate-100 shadow-xl p-2 min-w-[180px]">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 py-2">Mata Uang</p>
            <div className="space-y-0.5 max-h-48 overflow-y-auto">
              {currencies.map(code => {
                const m = CURRENCY_META[code] || { symbol: code, name: code }
                const r = rates[code]
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      onChange(code, r)
                      setOpen(false)
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                      code === selected ? 'bg-blue-50 text-blue-700 font-black' : 'hover:bg-slate-50 font-medium text-slate-600'
                    }`}
                  >
                    <span className="text-base w-6">{m.symbol}</span>
                    <div className="text-left">
                      <p className="font-bold">{code}</p>
                      <p className="text-[10px] text-slate-400">{m.name}</p>
                    </div>
                    {code !== 'IDR' && r && (
                      <span className="ml-auto text-[10px] font-mono text-slate-400">
                        Rp {r.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={() => {
                fetchCurrencies()
                setOpen(false)
              }}
              className="flex items-center gap-2 px-3 py-2 text-[10px] font-bold text-slate-400 hover:text-slate-600 w-full"
            >
              <RefreshCw size={10} />
              Refresh kurs
            </button>
          </div>
        </>
      )}

      {showRate && selected !== 'IDR' && rate && (
        <div className="mt-1">
          <ExchangeRateDisplay rate={rate} fromCurrency={selected} />
        </div>
      )}
    </div>
  )
}
