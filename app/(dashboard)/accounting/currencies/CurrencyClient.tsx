'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RefreshCw,
  Plus,
  Trash2,
  X,
  CheckCircle,
  AlertCircle,
  Globe,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { formatRupiah, formatDate } from '@/lib/utils'

type OrgCurrency = {
  org_id: string
  base_currency: string
  decimal_places: number
  auto_update_rates: boolean
  rate_provider: string
}

type AllowedCurrency = {
  id: string
  currency_code: string
  is_active: boolean
}

type ExchangeRate = {
  id: string
  from_currency: string
  to_currency: string
  rate: number
  rate_date: string
  source: string
  created_at: string
}

type CurrencyInfo = {
  code: string
  name: string
  symbol: string
}

interface Props {
  orgId: string
  settings: OrgCurrency
  allowedCurrencies: AllowedCurrency[]
  exchangeRates: {
    baseCurrency: string
    latestRates: ExchangeRate[]
    ratesByCurrency: { currency: string; rates: ExchangeRate[] }[]
  }
  popularCurrencies: CurrencyInfo[]
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
}
const item = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0 },
}

export default function CurrencyClient({ orgId, settings: initialSettings, allowedCurrencies: initialAllowed, exchangeRates, popularCurrencies }: Props) {
  const [settings, setSettings] = useState<OrgCurrency>(initialSettings)
  const [allowedCurrencies, setAllowedCurrencies] = useState<AllowedCurrency[]>(initialAllowed)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showAddCurrency, setShowAddCurrency] = useState(false)
  const [showAddRate, setShowAddRate] = useState(false)
  const [expandedCurrency, setExpandedCurrency] = useState<string | null>(null)

  // Rate form
  const [rateCurrency, setRateCurrency] = useState('USD')
  const [rateValue, setRateValue] = useState('')
  const [rateDate, setRateDate] = useState(new Date().toISOString().split('T')[0])

  const allowedCodes = allowedCurrencies.map(c => c.currency_code)
  const unselectedCurrencies = popularCurrencies.filter(c => !allowedCodes.includes(c.code) && c.code !== settings.base_currency)

  async function handleSaveSettings() {
    setLoading(true)
    const { updateOrgCurrency } = await import('@/modules/accounting/actions/currencies.actions')
    const result = await updateOrgCurrency(orgId, settings)
    if (result.success) {
      setMessage({ type: 'success', text: 'Setting mata uang disimpan.' })
    } else {
      setMessage({ type: 'error', text: result.error || 'Gagal menyimpan.' })
    }
    setLoading(false)
  }

  async function handleAddCurrency(code: string) {
    setLoading(true)
    const { addAllowedCurrency } = await import('@/modules/accounting/actions/currencies.actions')
    const result = await addAllowedCurrency(orgId, code)
    if (result.success) {
      setAllowedCurrencies([...allowedCurrencies, { id: '', currency_code: code, is_active: true }])
      setShowAddCurrency(false)
      setMessage({ type: 'success', text: `${code} ditambahkan.` })
    } else {
      setMessage({ type: 'error', text: result.error || 'Gagal.' })
    }
    setLoading(false)
  }

  async function handleRemoveCurrency(code: string) {
    setLoading(true)
    const { removeAllowedCurrency } = await import('@/modules/accounting/actions/currencies.actions')
    const result = await removeAllowedCurrency(orgId, code)
    if (result.success) {
      setAllowedCurrencies(allowedCurrencies.filter(c => c.currency_code !== code))
      setMessage({ type: 'success', text: `${code} dihapus.` })
    } else {
      setMessage({ type: 'error', text: result.error || 'Gagal.' })
    }
    setLoading(false)
  }

  async function handleAddRate() {
    if (!rateValue || !rateCurrency) return
    setLoading(true)
    const { upsertExchangeRate } = await import('@/modules/accounting/actions/currencies.actions')
    const result = await upsertExchangeRate(orgId, rateCurrency, parseFloat(rateValue), rateDate)
    if (result.success) {
      setShowAddRate(false)
      setRateValue('')
      setMessage({ type: 'success', text: `Kurs ${rateCurrency} = Rp${rateValue} disimpan.` })
    } else {
      setMessage({ type: 'error', text: result.error || 'Gagal.' })
    }
    setLoading(false)
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="max-w-7xl mx-auto space-y-10 pb-20">
      {/* Header */}
      <motion.div variants={item} className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight flex items-center gap-4">
            <Globe size={40} className="text-blue-500" />
            Multi Mata Uang
          </h1>
          <p className="text-slate-500 font-medium text-lg">Kelola kurs valuta asing & setting multi-currency untuk transaksi lintas negara.</p>
        </div>
      </motion.div>

      {/* Base Currency Settings */}
      <motion.div variants={item} className="bg-white rounded-xl border border-slate-100 shadow-sm p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DollarSign size={20} className="text-blue-500" />
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-tight">Mata Uang Dasar</h3>
          </div>
          <button type="button"
            onClick={handleSaveSettings}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all text-sm disabled:opacity-40"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Simpan
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">Base Currency</label>
            <div className="bg-slate-50 rounded-xl px-5 py-4 font-semibold text-slate-900 text-lg">
              {settings.base_currency}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">Decimal Places</label>
            <select
              value={settings.decimal_places}
              onChange={e => setSettings({ ...settings, decimal_places: parseInt(e.target.value) })}
              className="w-full bg-slate-50 rounded-xl px-5 py-4 font-bold text-slate-900 border border-slate-100 outline-none"
            >
              <option value={0}>0 (IDR)</option>
              <option value={2}>2 (USD, EUR, GBP)</option>
              <option value={3}>3 (KWD, OMR)</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">Auto Update Rates</label>
            <div className="flex items-center gap-4 pt-2">
              <div
                className={`w-14 h-8 rounded-full relative transition-all cursor-pointer ${settings.auto_update_rates ? 'bg-emerald-500' : 'bg-slate-300'}`}
                onClick={() => setSettings({ ...settings, auto_update_rates: !settings.auto_update_rates })}
              >
                <div className={`absolute w-6 h-6 bg-white rounded-full top-1 shadow transition-all ${settings.auto_update_rates ? 'left-7' : 'left-1'}`} />
              </div>
              <span className="text-sm font-bold text-slate-500">{settings.auto_update_rates ? 'Otomatis (BI API)' : 'Manual'}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Allowed Currencies */}
      <motion.div variants={item} className="bg-white rounded-xl border border-slate-100 shadow-sm p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe size={20} className="text-blue-500" />
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-tight">Mata Uang Asing Aktif</h3>
          </div>
          <button type="button"
            onClick={() => setShowAddCurrency(!showAddCurrency)}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all text-sm"
          >
            <Plus size={14} />
            Tambah Mata Uang
          </button>
        </div>

        {showAddCurrency && (
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2 p-4 bg-slate-50 rounded-xl">
            {unselectedCurrencies.map(c => (
              <button type="button"
                key={c.code}
                onClick={() => handleAddCurrency(c.code)}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 text-sm font-bold text-slate-700 disabled:opacity-40 transition-all"
              >
                <span className="text-base">{c.symbol}</span>
                {c.code}
              </button>
            ))}
            {unselectedCurrencies.length === 0 && (
              <p className="col-span-full text-sm text-slate-400 font-medium text-center py-4">Semua mata uang sudah ditambahkan.</p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {allowedCurrencies.map(c => {
            const info = popularCurrencies.find(p => p.code === c.currency_code)
            return (
              <div key={c.currency_code} className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-lg">{info?.symbol || '💱'}</span>
                <div>
                  <p className="font-semibold text-sm text-slate-900">{c.currency_code}</p>
                  <p className="text-[10px] font-medium text-slate-400">{info?.name || ''}</p>
                </div>
                <button type="button"
                  onClick={() => handleRemoveCurrency(c.currency_code)}
                  className="ml-2 p-1.5 hover:bg-red-50 rounded-xl text-slate-300 hover:text-red-500 transition-all"
                >
                  <X size={14} />
                </button>
              </div>
            )
          })}
          {allowedCurrencies.length === 0 && (
            <p className="text-sm text-slate-400 font-medium py-2">Belum ada mata uang asing aktif. Klik Tambah untuk mulai.</p>
          )}
        </div>
      </motion.div>

      {/* Exchange Rates */}
      <motion.div variants={item} className="bg-white rounded-xl border border-slate-100 shadow-sm p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp size={20} className="text-blue-500" />
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-tight">Kurs Valuta Asing</h3>
          </div>
          <button type="button"
            onClick={() => setShowAddRate(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-sm"
          >
            <Plus size={14} />
            Tambah Kurs
          </button>
        </div>

        {/* Add Rate Modal */}
        <AnimatePresence>
          {showAddRate && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-6 bg-slate-50 rounded-xl border border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm text-slate-700">Input Kurs Baru</p>
                  <button type="button" onClick={() => setShowAddRate(false)} className="text-slate-400 hover:text-slate-600">
                    <X size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight mb-1 block">Dari Mata Uang</label>
                    <select
                      value={rateCurrency}
                      onChange={e => setRateCurrency(e.target.value)}
                      className="w-full bg-white rounded-xl px-4 py-3 font-bold text-slate-900 border border-slate-200 outline-none"
                    >
                      {allowedCurrencies.map(c => (
                        <option key={c.currency_code} value={c.currency_code}>{c.currency_code}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight mb-1 block">Nilai Kurs (1 {rateCurrency} = Rp...)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={rateValue}
                      onChange={e => setRateValue(e.target.value)}
                      placeholder="16000"
                      className="w-full bg-white rounded-xl px-4 py-3 font-bold text-slate-900 border border-slate-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight mb-1 block">Tanggal</label>
                    <input
                      type="date"
                      value={rateDate}
                      onChange={e => setRateDate(e.target.value)}
                      className="w-full bg-white rounded-xl px-4 py-3 font-bold text-slate-900 border border-slate-200 outline-none"
                    />
                  </div>
                </div>
                <button type="button"
                  onClick={handleAddRate}
                  disabled={loading || !rateValue}
                  className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-sm disabled:opacity-40"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  Simpan Kurs
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Rate Cards */}
        <div className="space-y-4">
          {exchangeRates.ratesByCurrency.map(({ currency, rates }) => {
            const latest = rates[0]
            const prevDay = rates.length > 1 ? rates[1] : null
            const trend = prevDay
              ? latest.rate > prevDay.rate ? 'up' : latest.rate < prevDay.rate ? 'down' : 'flat'
              : 'flat'
            const info = popularCurrencies.find(p => p.code === currency)
            const isExpanded = expandedCurrency === currency

            return (
              <div key={currency} className="border border-slate-100 rounded-xl overflow-hidden">
                <button type="button"
                  onClick={() => setExpandedCurrency(isExpanded ? null : currency)}
                  className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{info?.symbol || '💱'}</span>
                    <div className="text-left">
                      <p className="font-semibold text-slate-900">{currency}</p>
                      <p className="text-xs text-slate-400 font-medium">{info?.name || ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-semibold text-lg text-slate-900 font-mono">{formatRupiah(latest.rate)}</p>
                      <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1 justify-end">
                        <Calendar size={10} />
                        {latest.rate_date}
                      </p>
                    </div>
                    {trend === 'up' && <TrendingUp size={18} className="text-emerald-500" />}
                    {trend === 'down' && <TrendingDown size={18} className="text-red-500" />}
                    {trend === 'flat' && <span className="w-[18px]" />}
                    {isExpanded ? <ChevronUp size={16} className="text-slate-300" /> : <ChevronDown size={16} className="text-slate-300" />}
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 border-t border-slate-50 pt-4">
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {rates.map((rate, idx) => (
                            <div key={rate.id || idx} className="flex items-center justify-between text-sm py-2 px-3 rounded-xl hover:bg-slate-50">
                              <div className="flex items-center gap-3">
                                <Calendar size={12} className="text-slate-300" />
                                <span className="font-medium text-slate-500">{rate.rate_date}</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                  rate.source === 'API' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'
                                }`}>
                                  {rate.source}
                                </span>
                              </div>
                              <span className="font-semibold text-slate-900 font-mono">{formatRupiah(rate.rate)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
          {exchangeRates.ratesByCurrency.length === 0 && (
            <div className="text-center py-12">
              <Clock size={40} className="mx-auto text-slate-200 mb-4" />
              <p className="text-sm font-bold text-slate-400">Belum ada kurs. Tambahkan mata uang asing dulu, lalu input kurs.</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Toast */}
      {message && (
        <div className="fixed bottom-8 right-8 z-[9999] animate-in slide-in-from-bottom-2 fade-in">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-xl shadow-md border ${
            message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {message.type === 'success' ? <CheckCircle size={20} className="text-emerald-500" /> : <AlertCircle size={20} className="text-red-500" />}
            <span className="font-bold text-sm">{message.text}</span>
            <button type="button" onClick={() => setMessage(null)} className="ml-2 opacity-50 hover:opacity-100">
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  )
}
