'use client'

import { useState } from 'react'
import { PlusCircle, Trash2, ArrowDownCircle } from 'lucide-react'

type CostItem = {
  name: string
  amount: number
  taxRate: number // PPN per item, e.g. 11 for 11%
}

type FeeItem = {
  name: string
  amount: number
}

const COMMON_TAX_RATES = [0, 1.1, 2.5, 5, 10, 11, 12]

function formatRp(n: number) {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID')
}

export default function BatchStructureBuilder() {
  const [costStructure, setCostStructure] = useState<CostItem[]>([])
  const [targetMarginPct, setTargetMarginPct] = useState(20)
  const [feeStructure, setFeeStructure] = useState<FeeItem[]>([])

  // --- Cost per-item helpers ---
  const addCost = () => setCostStructure([...costStructure, { name: '', amount: 0, taxRate: 0 }])
  const removeCost = (i: number) => setCostStructure(costStructure.filter((_, idx) => idx !== i))
  const updateCost = (i: number, field: keyof CostItem, value: any) => {
    const next = [...costStructure]
    next[i] = { ...next[i], [field]: field === 'name' ? value : Number(value) }
    setCostStructure(next)
  }

  // Calculated cost totals (per-item tax)
  const costRows = costStructure.map(item => {
    const taxAmt = (item.amount * item.taxRate) / 100
    return { ...item, taxAmt, total: item.amount + taxAmt }
  })
  const subtotalCost = costRows.reduce((s, r) => s + r.amount, 0)
  const totalTax = costRows.reduce((s, r) => s + r.taxAmt, 0)
  const totalCostWithTax = subtotalCost + totalTax

  // --- Suggestion ---
  const suggestedMargin = (totalCostWithTax * targetMarginPct) / 100
  const suggestedPrice = totalCostWithTax + suggestedMargin

  const useSuggested = () => {
    setFeeStructure([{ name: 'Biaya Program', amount: Math.round(suggestedPrice) }])
  }

  // --- Fee per-item helpers ---
  const addFee = () => setFeeStructure([...feeStructure, { name: '', amount: 0 }])
  const removeFee = (i: number) => setFeeStructure(feeStructure.filter((_, idx) => idx !== i))
  const updateFee = (i: number, field: keyof FeeItem, value: any) => {
    const next = [...feeStructure]
    next[i] = { ...next[i], [field]: field === 'name' ? value : Number(value) }
    setFeeStructure(next)
  }

  const totalFee = feeStructure.reduce((s, item) => s + item.amount, 0)

  return (
    <div className="space-y-5">
      <input type="hidden" name="feeStructure" value={JSON.stringify(feeStructure)} />
      <input type="hidden" name="costStructure" value={JSON.stringify(costStructure)} />
      <input type="hidden" name="price" value={totalFee} />

      {/* ── ANGGARAN (Cost Structure) ── */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
          <div>
            <div className="text-sm font-bold text-slate-900">Anggaran Batch</div>
            <div className="text-xs text-slate-500">Rincian estimasi biaya operasional. Pajak diatur per komponen.</div>
          </div>
          <button
            type="button"
            onClick={addCost}
            className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100"
          >
            <PlusCircle className="h-3.5 w-3.5" /> Tambah
          </button>
        </div>

        {/* Column headers */}
        {costStructure.length > 0 && (
          <div className="grid grid-cols-[1fr_100px_80px_90px_32px] gap-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-100">
            <span>Komponen</span>
            <span>Jumlah (Rp)</span>
            <span>Pajak</span>
            <span className="text-right">Total</span>
            <span />
          </div>
        )}

        <div className="divide-y divide-slate-100">
          {costStructure.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-slate-400 italic">
              Belum ada rincian anggaran. Klik &quot;+ Tambah&quot; untuk memulai.
            </div>
          ) : (
            costRows.map((item, i) => (
              <div key={i} className="grid grid-cols-[1fr_100px_80px_90px_32px] gap-2 items-center px-4 py-2.5">
                <input
                  type="text"
                  placeholder="Nama komponen..."
                  value={item.name}
                  onChange={(e) => updateCost(i, 'name', e.target.value)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-blue-400"
                />
                <input
                  type="number"
                  placeholder="0"
                  value={item.amount || ''}
                  onChange={(e) => updateCost(i, 'amount', e.target.value)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-blue-400"
                />
                {/* Per-item tax rate dropdown */}
                <select
                  value={item.taxRate}
                  onChange={(e) => updateCost(i, 'taxRate', e.target.value)}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-blue-400 bg-white"
                >
                  {COMMON_TAX_RATES.map(rate => (
                    <option key={rate} value={rate}>
                      {rate === 0 ? 'Non-PKP' : `${rate}%`}
                    </option>
                  ))}
                </select>
                <div className="text-right text-xs font-bold text-slate-700">
                  {formatRp(item.total)}
                  {item.taxRate > 0 && (
                    <div className="text-[10px] font-medium text-amber-600 mt-0.5">
                      +{formatRp(item.taxAmt)} PPN
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeCost(i)}
                  className="flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer summary */}
        {costStructure.length > 0 && (
          <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 space-y-1.5">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Subtotal Biaya</span>
              <span>{formatRp(subtotalCost)}</span>
            </div>
            <div className="flex justify-between text-xs text-amber-600 font-medium">
              <span>Total Pajak Masukan (PPN)</span>
              <span>+ {formatRp(totalTax)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold text-slate-900 pt-1.5 border-t border-slate-200">
              <span>Total Anggaran (incl. Tax)</span>
              <span>{formatRp(totalCostWithTax)}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── SIMULASI & SUGGEST HARGA ── */}
      <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
        <div className="text-sm font-bold text-blue-900 mb-3">Simulasi &amp; Suggestion Harga Jual</div>
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="space-y-2 flex-1">
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <span className="whitespace-nowrap">Target Margin (%):</span>
              <input
                type="number"
                value={targetMarginPct}
                onChange={(e) => setTargetMarginPct(Number(e.target.value))}
                className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-blue-400 bg-white"
              />
            </label>
            <div className="bg-white/70 rounded-xl border border-blue-100 p-3 space-y-1 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Total Anggaran:</span>
                <span>{formatRp(totalCostWithTax)}</span>
              </div>
              <div className="flex justify-between text-emerald-600 font-bold">
                <span>+ Margin ({targetMarginPct}%):</span>
                <span>+ {formatRp(suggestedMargin)}</span>
              </div>
              <div className="flex justify-between text-slate-900 font-semibold border-t border-blue-100 pt-1">
                <span>Suggested Price:</span>
                <span>{formatRp(suggestedPrice)}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={useSuggested}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            <ArrowDownCircle className="w-4 h-4" /> Pakai Harga Ini
          </button>
        </div>
      </div>

      {/* ── FEE PESERTA ── */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
          <div>
            <div className="text-sm font-bold text-slate-900">Biaya Peserta (Fee Structure)</div>
            <div className="text-xs text-slate-500">Harga yang akan ditampilkan dan ditagihkan ke peserta.</div>
          </div>
          <button
            type="button"
            onClick={addFee}
            className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100"
          >
            <PlusCircle className="h-3.5 w-3.5" /> Tambah
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {feeStructure.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-slate-400 italic">
              Gunakan tombol &quot;Pakai Harga Ini&quot; atau tambah komponen manual.
            </div>
          ) : (
            feeStructure.map((item, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-2.5">
                <input
                  type="text"
                  placeholder="Nama biaya..."
                  value={item.name}
                  onChange={(e) => updateFee(i, 'name', e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-blue-400"
                />
                <input
                  type="number"
                  placeholder="Rp"
                  value={item.amount || ''}
                  onChange={(e) => updateFee(i, 'amount', e.target.value)}
                  className="w-32 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-blue-400"
                />
                <button
                  type="button"
                  onClick={() => removeFee(i)}
                  className="text-slate-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {feeStructure.length > 0 && (
          <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 flex justify-between items-center">
            <div className="text-xs font-bold text-slate-500">Total Tagihan Peserta</div>
            <div className="text-base font-semibold text-slate-900">{formatRp(totalFee)}</div>
          </div>
        )}
      </div>

      {/* ── PAJAK PENJUALAN ── */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-bold text-slate-900 mb-3">Pajak Penjualan (Tax Keluar ke Peserta)</div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <span>Tarif PPN (%):</span>
            <select
              name="taxRate"
              defaultValue={0}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-blue-400 bg-white"
            >
              {COMMON_TAX_RATES.map(rate => (
                <option key={rate} value={rate}>
                  {rate === 0 ? '0% (Non-PKP)' : `${rate}%`}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              name="isTaxIncluded"
              className="w-4 h-4 rounded text-blue-600 border-slate-300"
            />
            <span className="font-medium">Harga sudah termasuk pajak (Tax Included)</span>
          </label>
        </div>
      </div>
    </div>
  )
}
