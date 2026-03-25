'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Zap, Settings2, Coins, ChevronRight, AlertCircle, Info, Wallet,
  Building2, TrendingUp, History, Scale, ShieldCheck, Timer, RefreshCw,
  CheckCircle2, XCircle, Play, RotateCcw, Sunset, Globe, MapPin
} from 'lucide-react'
import { formatRupiah, formatDate } from '@/lib/utils'
import { useRouter, useSearchParams } from 'next/navigation'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, AreaChart, Area, ReferenceLine } from 'recharts'
import { injectShariahPack } from '@/modules/accounting/actions/shariah.actions'
import { getLivePreciousMetalsPrices } from '@/modules/accounting/actions/price.actions'
import { startZakatHaul, checkAndCancelHaul, payZakat, syncActiveHaulPrices } from '@/modules/accounting/actions/zakat.actions'

interface ZakatClientProps {
  summary: any
  orgId: string
}

export default function ZakatClient({ summary, orgId }: ZakatClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Prices for CURRENT market rates (for display & new haul start)
  const [goldPrice, setGoldPrice] = useState(summary.currentPrices.goldPerGram)
  const [silverPrice, setSilverPrice] = useState(summary.currentPrices.silverPerGram)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err', text: string } | null>(null)
  
  const [showPayDialog, setShowPayDialog] = useState(false)
  const [selectedBank, setSelectedBank] = useState('')
  const [paying, setPaying] = useState(false)
  const [maghribCountdown, setMaghribCountdown] = useState<string>('')
  const [maghribTimeStr, setMaghribTimeStr] = useState('18:00')
  const [geoLocName, setGeoLocName] = useState('WIB')

  useEffect(() => {
    // 1. Ambil Lokasi GPS & Maghrib API (Sekali jalan)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
          const lat = pos.coords.latitude; const lng = pos.coords.longitude;
          const res = await fetch(`https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lng}&method=2`)
          const json = await res.json()
          if (json.data?.timings?.Maghrib) {
            setMaghribTimeStr(json.data.timings.Maghrib)
            // Reverse Geocoding via Nominatim untuk nama kota
            const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
            const geoJson = await geoRes.json()
            if (geoJson?.address?.city || geoJson?.address?.county) {
              setGeoLocName(geoJson.address.city || geoJson.address.county)
            } else { setGeoLocName(`GPS ${lat.toFixed(2)},${lng.toFixed(2)}`) }
          }
        } catch(e) {}
      }, () => {})
    }
  }, [])

  useEffect(() => {
    // 2. Ticker hitung mundur ke jam Maghrib (dari maghribTimeStr)
    const updateCountdown = () => {
      const now = new Date()
      const [th, tm] = maghribTimeStr.split(':')
      const targetH = parseInt(th || '18'); const targetM = parseInt(tm || '0');
      
      const target = new Date(now)
      if (now.getHours() > targetH || (now.getHours() === targetH && now.getMinutes() >= targetM)) {
        target.setDate(target.getDate() + 1)
      }
      target.setHours(targetH, targetM, 0, 0)
      
      const diffStr = (target.getTime() - now.getTime()) / 1000
      const h = Math.floor(diffStr / 3600); const m = Math.floor((diffStr % 3600) / 60);
      setMaghribCountdown(`${h}j ${m}m`)
    }
    updateCountdown()
    const int = setInterval(updateCountdown, 60000)
    return () => clearInterval(int)
  }, [maghribTimeStr])

  const handleAutoPrice = async () => {
    setLoading(true)
    const res = await getLivePreciousMetalsPrices()
    if (res.success && res.data) {
      setGoldPrice(res.data.gold)
      setSilverPrice(res.data.silver)

      // Mematuhi instruksi Anda: Langsung paksa ubah data internal secara silent 
      // agar selaras dengan angka global. Fitur 'Sync' ini akan menyelaraskan database di belakang layar.
      await syncActiveHaulPrices(orgId, res.data.gold, res.data.silver)

      setMsg({ type: 'ok', text: `Riwayat Haul & Harga Global sukses disinkronisasi: Emas (Rp ${res.data.gold.toLocaleString('id-ID')}) & Perak (Rp ${res.data.silver.toLocaleString('id-ID')}).` })
    } else {
      setMsg({ type: 'err', text: res.error || 'Gagal sinkronisasi harga global.' })
    }
    setLoading(false)
  }

  const handlePayZakat = async () => {
    if (!selectedBank) return alert('Pilih rekening Kas & Bank untuk membayar zakat')
    setPaying(true)
    const res = await payZakat(orgId, selectedBank, summary.zakatAmount)
    if ('error' in res && res.error) setMsg({ type: 'err', text: res.error })
    else {
      setMsg({ type: 'ok', text: 'Alhamdulillah, Zakat berhasil dibayar dan otomatis dijurnal!' })
      setShowPayDialog(false)
      router.refresh()
    }
    setPaying(false)
  }

  const applyPrices = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('goldPrice', goldPrice.toString())
    params.set('silverPrice', silverPrice.toString())
    router.push(`/accounting/zakat?${params.toString()}`)
  }

  const handleStartHaul = async () => {
    if (!confirm(`Mulai Haul baru dengan harga Emas Rp ${goldPrice.toLocaleString('id-ID')}/gr dan Perak Rp ${silverPrice.toLocaleString('id-ID')}/gr? Harga ini akan DIKUNCI sebagai acuan nishab sepanjang tahun haul.`)) return
    setLoading(true)
    const res = await startZakatHaul(orgId, goldPrice, silverPrice)
    if ('error' in res && res.error) setMsg({ type: 'err', text: res.error as string })
    else { setMsg({ type: 'ok', text: 'Haul berhasil dimulai! Harga nishab telah dikunci.' }); router.refresh() }
    setLoading(false)
  }

  const handleCheckHaul = async () => {
    setLoading(true)
    const res: any = await checkAndCancelHaul(orgId)
    if (res.batal) setMsg({ type: 'err', text: `⚠️ HAUL BATAL. Aset (${formatRupiah(res.totalAssets)}) turun di bawah nishab. Haul baru dimulai saat aset kembali di atas nishab.` })
    else if (res.active) setMsg({ type: 'ok', text: `Haul masih valid. Aset (${formatRupiah(res.totalAssets)}) tetap di atas nishab.` })
    else setMsg({ type: 'ok', text: 'Tidak ada haul aktif.' })
    router.refresh()
    setLoading(false)
  }

  // Nishab used = from haul start (locked), otherwise current
  const hauledPrices = summary.hauledPrices
  const nishabGold   = summary.nishabGold
  const nishabSilver = summary.nishabSilver

  const chartData = [
    { name: 'Total Aset Zakat', value: summary.totalAssets, color: '#6366f1' },
    { name: `Nishab Perak\n(200 Dirham × ${summary.fiqh.gramsPerDirham}gr × Rp ${hauledPrices.silverPerGram.toLocaleString('id-ID')})`, value: nishabSilver, color: '#94a3b8' },
    { name: `Nishab Emas\n(20 Dinar × ${summary.fiqh.gramsPerDinar}gr × Rp ${hauledPrices.goldPerGram.toLocaleString('id-ID')})`, value: nishabGold, color: '#eab308' },
  ]

  const haulStatusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    'NO_HAUL':   { label: 'Belum Ada Haul',         color: 'bg-slate-100 text-slate-500',     icon: <Timer size={14}/> },
    'ACTIVE':    { label: 'Haul Berjalan',           color: 'bg-emerald-100 text-emerald-700', icon: <Play size={14}/> },
    'COMPLETED': { label: 'Haul Selesai (Wajib!)',   color: 'bg-amber-100 text-amber-700',     icon: <CheckCircle2 size={14}/> },
    'BATAL':     { label: 'Haul BATAL (Under Nishab)', color: 'bg-rose-100 text-rose-700',    icon: <XCircle size={14}/> },
  }
  const haulCfg = haulStatusConfig[summary.haulStatus] || haulStatusConfig['NO_HAUL']

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 text-slate-900">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
            <Zap size={40} className="text-amber-500 fill-amber-500" />
            Manajemen Zakat Tijarah
          </h1>
          <p className="text-slate-500 font-medium text-sm leading-relaxed max-w-2xl">
            Kalkulator Zakat Maal Perusahaan — Nishab: <strong>20 Dinar (85gr Emas)</strong> atau <strong>200 Dirham (595gr Perak)</strong>.
            Harga dikunci pada awal haul.
          </p>
        </div>

        {/* Price Control */}
        <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1"><Settings2 size={10}/> Emas/Gr (Referensi)</p>
            <input type="number" value={goldPrice} onChange={(e) => setGoldPrice(parseInt(e.target.value))}
              className="w-28 bg-amber-50 border border-amber-200 rounded-xl p-2 font-black text-xs text-amber-700 outline-none focus:ring-2 ring-amber-300 transition-all" />
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Settings2 size={10}/> Perak/Gr (Referensi)</p>
            <input type="number" value={silverPrice} onChange={(e) => setSilverPrice(parseInt(e.target.value))}
              className="w-28 bg-slate-50 border border-slate-200 rounded-xl p-2 font-black text-xs text-slate-600 outline-none focus:ring-2 ring-slate-200 transition-all" />
          </div>
          <button onClick={applyPrices} className="bg-slate-900 text-white px-4 py-2.5 rounded-2xl text-[10px] font-black hover:bg-slate-800 transition-all shadow-lg active:scale-95">
            PREVIEW
          </button>
          
          <button onClick={handleAutoPrice} disabled={loading} className="bg-amber-100 text-amber-700 font-black px-4 py-2.5 rounded-2xl text-[10px] hover:bg-amber-200 transition-all flex items-center justify-center gap-2 border border-amber-300 disabled:opacity-50">
            <Globe size={14} /> AUTO GLOBAL RATE
          </button>
        </div>
      </div>

      {/* Feedback toast */}
      <AnimatePresence>
        {msg && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-2xl text-sm font-bold flex items-center gap-3 ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
            {msg.type === 'ok' ? <CheckCircle2 size={18}/> : <AlertCircle size={18}/>}
            {msg.text}
            <button onClick={() => setMsg(null)} className="ml-auto opacity-50 hover:opacity-100"><XCircle size={16}/></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Haul Banner */}
      <div className={`p-6 rounded-[28px] border-2 flex flex-wrap items-center justify-between gap-4 ${
        summary.haulStatus === 'ACTIVE' ? 'bg-emerald-50 border-emerald-200' :
        summary.haulStatus === 'BATAL'  ? 'bg-rose-50 border-rose-200' :
        summary.haulStatus === 'COMPLETED' ? 'bg-amber-50 border-amber-200' :
        'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-xs ${haulCfg.color}`}>
            {haulCfg.icon} {haulCfg.label}
          </div>
          {summary.haulStatus === 'ACTIVE' && (
            <div className="space-y-0.5">
              <p className="text-xs font-black text-slate-700">Mulai: {summary.haulStartDate} &nbsp;|&nbsp; Hari ke-{summary.haulDaysElapsed} / 354</p>
              <div className="w-48 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min(100, (summary.haulDaysElapsed / 354) * 100)}%` }}/>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-[10px] text-slate-400 font-bold">Sisa {summary.haulDaysRemaining} hari</p>
                {maghribCountdown && (
                  <p className="text-[9px] text-amber-600 font-black flex items-center gap-1 bg-amber-100/60 px-2 py-0.5 rounded-full border border-amber-200" title={`Puncak pergantian hari: waktu maghrib (${maghribTimeStr}) di lokasi ${geoLocName}`}>
                    <Sunset size={10}/> {maghribCountdown} (Maghrib {maghribTimeStr} - {geoLocName})
                  </p>
                )}
              </div>
            </div>
          )}
          {summary.haulStatus === 'ACTIVE' && (
            <div className="space-y-0.5 pl-4 border-l border-emerald-200">
              <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Harga Dikunci (Awal Haul)</p>
              <p className="text-xs font-bold text-slate-700">Emas: Rp {summary.hauledPrices.goldPerGram.toLocaleString('id-ID')}/gr</p>
              <p className="text-xs font-bold text-slate-700">Perak: Rp {summary.hauledPrices.silverPerGram.toLocaleString('id-ID')}/gr</p>
            </div>
          )}
          {(summary.haulStatus === 'BATAL') && (
            <p className="text-xs font-bold text-rose-600 max-w-md">{summary.haulBatalReason}</p>
          )}
        </div>

        <div className="flex gap-3">
          {summary.haulStatus === 'ACTIVE' && (
            <button onClick={handleCheckHaul} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-[10px] font-black text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all">
              <RefreshCw size={12}/> CEK STATUS HAUL
            </button>
          )}
          {(summary.haulStatus === 'NO_HAUL' || summary.haulStatus === 'BATAL') && summary.isZakatObligated && (
            <button onClick={handleStartHaul} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-[10px] font-black text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all">
              <Play size={12}/> MULAI HAUL BARU
            </button>
          )}
          {(summary.haulStatus === 'NO_HAUL' || summary.haulStatus === 'BATAL') && !summary.isZakatObligated && (
            <div className="px-4 py-2 text-[10px] font-black text-slate-400 bg-slate-100 rounded-xl">
              Aset belum mencapai nishab — haul belum dapat dimulai
            </div>
          )}
        </div>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Zakat Card */}
        <div className="lg:col-span-2 bg-gradient-to-br from-amber-500 to-amber-700 p-10 rounded-[48px] shadow-2xl shadow-amber-200 relative overflow-hidden group">
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/20 to-transparent" />
          <div className="relative z-10 h-full flex flex-col space-y-8">
            <div className="flex justify-between items-start">
              <div className="p-4 bg-white/20 backdrop-blur-md rounded-[20px] text-white">
                <Coins size={32} />
              </div>
              <div className="flex flex-col items-end gap-2">
                {summary.isZakatObligated ? (
                  <span className="bg-white/20 backdrop-blur-md text-white px-5 py-2 rounded-full text-[10px] font-black border border-white/20">WAJIB ZAKAT</span>
                ) : (
                  <span className="bg-white/10 text-white/50 px-5 py-2 rounded-full text-[10px] font-black border border-white/10">DI BAWAH NISHAB</span>
                )}
                
                {summary.haulStatus === 'ACTIVE' && (
                  <div className="bg-black/20 backdrop-blur-md text-white px-4 py-2 rounded-full text-[9px] font-black border border-white/10 shadow-inner flex items-center gap-2">
                    <Timer size={12}/> HAUL: SISA {summary.haulDaysRemaining} HARI 
                  </div>
                )}
                
                {summary.haulStatus === 'COMPLETED' && (
                  <button onClick={() => setShowPayDialog(true)} className="bg-emerald-500 hover:bg-emerald-400 text-white px-5 py-2 rounded-full text-[10px] font-black shadow-xl shadow-emerald-500/20 flex items-center gap-2 transition-all active:scale-95">
                    <Wallet size={12}/> BAYAR ZAKAT (TUNAIKAN)
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-white/60 text-[10px] font-bold uppercase tracking-[0.2em]">Estimasi Zakat Harus Dibayar (2.5%)</p>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-white font-mono tracking-tighter leading-none italic break-all">
                {formatRupiah(summary.zakatAmount)}
              </h2>
            </div>

            <AnimatePresence mode="wait">
              {showPayDialog ? (
                <motion.div key="pay-form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 text-white shadow-inner">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-black text-sm uppercase tracking-widest flex items-center gap-2"><Wallet size={16}/> Bayar Zakat</h3>
                    <button onClick={() => setShowPayDialog(false)} className="text-white/50 hover:text-white"><XCircle size={16}/></button>
                  </div>
                  
                  <div className="space-y-3 mb-4">
                    <label className="text-[10px] font-black text-white/70 uppercase tracking-widest">Sumber Dana (Kas & Bank)</label>
                    <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                      {summary.zakatAssets.filter((a: any) => a.type === 'CASH').map((acc: any) => (
                        <button key={acc.code} onClick={() => setSelectedBank(acc.code)} 
                          className={`text-left p-3 rounded-xl border-2 transition-all flex justify-between items-center ${selectedBank === acc.code ? 'border-white bg-white/20' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
                          <div>
                            <p className="text-xs font-black">{acc.name}</p>
                            <p className="text-[10px] font-bold text-white/70">Saldo: {formatRupiah(acc.balance)}</p>
                          </div>
                          {selectedBank === acc.code && <CheckCircle2 size={16} className="text-white"/>}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={handlePayZakat} disabled={paying || !selectedBank}
                    className="w-full py-3 bg-white text-amber-700 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-xs font-black shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">
                    {paying ? <RotateCcw size={16} className="animate-spin" /> : <ShieldCheck size={16} />} 
                    KONFIRMASI BAYAR & JURNAL
                  </button>
                </motion.div>
              ) : (
                <motion.div key="stats" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="space-y-6 flex-1 flex flex-col justify-end">
                  {/* Grafik Perjalanan Harta - selalu tampil dengan garis nishab */}
                  {(() => {
                    // Gunakan data timeline, atau fallback ke titik tunggal harta saat ini
                    const chartData = (summary.dailyAssetsChart && summary.dailyAssetsChart.length > 0)
                      ? summary.dailyAssetsChart
                      : [
                          { name: 'Awal Pencatatan', value: summary.totalAssets, aboveNishab: summary.isZakatObligated },
                          { name: 'Sekarang', value: summary.totalAssets, aboveNishab: summary.isZakatObligated }
                        ]
                    const yMax = Math.max(
                      ...chartData.map((d: any) => d.value),
                      nishabGold,
                      nishabSilver
                    ) * 1.2

                    return (
                      <div className="h-[130px] w-full pt-4 border-t border-white/10 mt-auto">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData} margin={{ top: 10, right: 4, left: 4, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorAbove" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ffffff" stopOpacity={0.35}/>
                                <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="name" hide />
                            <YAxis hide domain={[0, yMax]} />
                            <Tooltip
                              formatter={(value: any, _name: any, props: any) => {
                                const above = props?.payload?.aboveNishab
                                return [
                                  formatRupiah(Number(value || 0)),
                                  above === false ? '🔴 Di Bawah Nishab' : '✅ Di Atas Nishab'
                                ]
                              }}
                              labelStyle={{ color: '#64748b', fontWeight: 'bold', fontSize: '10px' }}
                              itemStyle={{ color: '#0f172a', fontWeight: '900', fontSize: '13px' }}
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', backgroundColor: '#ffffff' }}
                            />
                            {/* Garis Nishab Perak — kuning */}
                            <ReferenceLine y={nishabSilver} stroke="#fde68a" strokeOpacity={0.85} strokeDasharray="4 3"
                              label={{ position: 'insideBottomLeft', value: 'Nishab Perak', fill: '#fde68a', fontSize: 8, fontWeight: 'bold', opacity: 0.9 }} />
                            {/* Garis Nishab Emas — putih/kebiruan */}
                            <ReferenceLine y={nishabGold} stroke="#bfdbfe" strokeOpacity={0.65} strokeDasharray="6 4"
                              label={{ position: 'insideTopLeft', value: 'Nishab Emas', fill: '#bfdbfe', fontSize: 8, fontWeight: 'bold', opacity: 0.8 }} />
                            <Area
                              type="monotone"
                              dataKey="value"
                              name="Harta Kena Zakat"
                              stroke="#ffffff"
                              strokeWidth={2.5}
                              fillOpacity={1}
                              fill="url(#colorAbove)"
                              dot={(props: any) => {
                                const { cx, cy, payload } = props
                                if (!payload || cx === undefined) return <g key={`dot-${cx}-${cy}`}/>
                                const color = payload.aboveNishab === false ? '#fb7185' : '#ffffff'
                                return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={4} fill={color} stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} />
                              }}
                              activeDot={{ r: 7, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )
                  })()}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/10 rounded-2xl p-4 flex flex-col justify-center border border-white/5 relative overflow-hidden">
                      <div className="absolute right-0 bottom-0 opacity-10 translate-x-1/4 translate-y-1/4"><Coins size={64}/></div>
                      <p className="text-white/50 text-[9px] font-black uppercase tracking-widest mb-1">Nishab Emas</p>
                      <p className="text-white font-black text-[10px] mb-1 opacity-80">{summary.fiqh.dinarCount} Dinar × {summary.fiqh.gramsPerDinar}gr</p>
                      <p className="text-white font-black text-sm font-mono break-all">{formatRupiah(nishabGold)}</p>
                    </div>
                    <div className="bg-white/10 rounded-2xl p-4 flex flex-col justify-center border border-white/5 relative overflow-hidden">
                      <div className="absolute right-0 bottom-0 opacity-10 translate-x-1/4 translate-y-1/4"><Coins size={64}/></div>
                      <p className="text-white/50 text-[9px] font-black uppercase tracking-widest mb-1">Nishab Perak</p>
                      <p className="text-white font-black text-[10px] mb-1 opacity-80">{summary.fiqh.dirhamCount} Dirham × {summary.fiqh.gramsPerDirham}gr</p>
                      <p className="text-white font-black text-sm font-mono break-all">{formatRupiah(nishabSilver)}</p>
                    </div>
                  </div>
                  <p className="text-white/40 text-[8px] font-bold italic">
                    * Harga acuan: Emas Rp {hauledPrices.goldPerGram.toLocaleString('id-ID')}/gr, Perak Rp {hauledPrices.silverPerGram.toLocaleString('id-ID')}/gr
                    {summary.haulStatus === 'ACTIVE' ? ' (Dikunci sejak awal haul)' : ' (Harga hari ini)'}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>

        {/* Asset Card */}
        <div className="bg-white p-8 rounded-[48px] border border-slate-100 shadow-sm flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center text-indigo-500">
              <span className="text-[10px] font-black uppercase tracking-widest italic">Total Aset Zakat</span>
              <Wallet size={20} />
            </div>
            <h3 className="text-3xl font-black text-slate-900 font-mono tracking-tighter leading-none">{formatRupiah(summary.totalAssets)}</h3>
          </div>
          <div className="p-4 bg-indigo-50 rounded-3xl space-y-3">
            <div className="flex justify-between items-center text-[10px] font-black text-indigo-900 uppercase">
              vs Nishab Perak (Terendah) <TrendingUp size={14}/>
            </div>
            <div className="w-full bg-indigo-200 h-2.5 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, (summary.totalAssets / nishabSilver) * 100)}%` }}/>
            </div>
            <p className="text-[10px] font-bold text-indigo-400 italic">
              {Math.round((summary.totalAssets / nishabSilver) * 100).toLocaleString()}% dari nishab perak ({formatRupiah(nishabSilver)})
            </p>
          </div>
          {/* Breakdown */}
          <div className="space-y-2 pt-4 border-t border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Komponen Harta Zakat</p>
            
            <div className="grid grid-cols-1 gap-2">
              <div className="flex justify-between items-center text-xs py-2 px-3 bg-blue-50/50 rounded-xl border border-blue-100/50">
                <span className="text-blue-700 font-bold flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500"/>
                  Kas & Bank
                </span>
                <span className="font-black text-blue-900">{formatRupiah(summary.breakdown.totalCash)}</span>
              </div>

              <div className="flex justify-between items-center text-xs py-2 px-3 bg-purple-50/50 rounded-xl border border-purple-100/50">
                <span className="text-purple-700 font-bold flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500"/>
                  Piutang (AR)
                </span>
                <span className="font-black text-purple-900">{formatRupiah(summary.breakdown.totalAR)}</span>
              </div>

              <div className="flex justify-between items-center text-xs py-2 px-3 bg-amber-50/50 rounded-xl border border-amber-100/50">
                <span className="text-amber-700 font-bold flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500"/>
                  Persediaan
                </span>
                <span className="font-black text-amber-900">{formatRupiah(summary.breakdown.totalInventory)}</span>
              </div>

              <div className="flex justify-between items-center text-xs py-2 px-3 bg-rose-50/50 rounded-xl border border-rose-100/50">
                <span className="text-rose-700 font-bold flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500"/>
                  Hutang Lancar (Pengurang)
                </span>
                <span className="font-black text-rose-900">- {formatRupiah(summary.breakdown.totalAP || 0)}</span>
              </div>
            </div>

            <p className="text-[9px] text-slate-400 italic px-1 pt-2">
              Laba Bersih ({formatRupiah(summary.breakdown.netProfit)}) tidak ditambahkan ulang karena wujudnya otomatis terakrual di Saldo Kas/Piutang.
            </p>

            <div className="flex flex-col sm:flex-row justify-between items-center py-4 px-5 bg-indigo-600 rounded-[24px] shadow-xl shadow-indigo-100 mt-4 gap-2">
              <span className="text-white text-[10px] font-black uppercase tracking-[0.15em] opacity-80">Total Harta Zakat</span>
              <span className="font-black text-white text-lg font-mono tracking-tighter">{formatRupiah(summary.totalAssets)}</span>
            </div>
            
            <p className="text-[8px] text-slate-400 italic px-1 leading-relaxed mt-2 opacity-75">
              *Aset tetap tidak dihitung (bukan harta tijarah).
            </p>
          </div>
        </div>
      </div>

      {/* Chart + History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 bg-white rounded-[48px] border border-slate-100 shadow-sm p-10 space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-black text-slate-900 text-sm uppercase tracking-widest">Komparasi Aset vs Nishab</h4>
              <p className="text-[10px] text-slate-400 font-bold italic mt-1">
                Nishab dihitung dari harga {summary.haulStatus === 'ACTIVE' ? 'awal haul (DIKUNCI)' : 'referensi saat ini'}
              </p>
            </div>
            <Scale size={20} className="text-slate-300" />
          </div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={9} fontWeight="bold" axisLine={false} tickLine={false} width={140} />
                <Tooltip
                  formatter={(value: any) => formatRupiah(Number(value || 0))}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="value" radius={[0, 20, 20, 0]} barSize={36}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Fiqh Notes */}
          <div className="bg-indigo-50 rounded-3xl p-5 space-y-2">
            <p className="text-[10px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-2"><Info size={12}/> Kaidah Fiqh Zakat Tijarah</p>
            <ul className="text-[10px] text-indigo-600 font-medium space-y-1 leading-relaxed">
              <li>• <strong>Harta Zakat:</strong> Kas &amp; Bank + Piutang Dagang + Persediaan + Laba Bersih</li>
              <li>• <strong>Tidak Kena:</strong> Aset Tetap (kendaraan, gedung, perabot, komputer, dst)</li>
              <li>• <strong>Nishab Emas:</strong> 20 Dinar × {summary.fiqh.gramsPerDinar}gr = <strong>{summary.nishabGoldGrams}gr emas</strong></li>
              <li>• <strong>Nishab Perak:</strong> 200 Dirham × {summary.fiqh.gramsPerDirham}gr = <strong>{summary.nishabSilverGrams}gr perak</strong></li>
              <li>• <strong>Harga acuan:</strong> Harga emas/perak pada <strong>awal haul</strong> (dikunci, bukan harga berjalan)</li>
              <li>• <strong>Haul:</strong> 354 hari. Jika sempat di bawah nishab → haul <strong>batal</strong>, mulai ulang</li>
              <li>• <strong>Kadar:</strong> 2.5% dari total harta zakat</li>
            </ul>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Haul History */}
          <div className="bg-white p-8 rounded-[48px] border border-slate-100 shadow-sm space-y-6">
            <h5 className="font-black text-xs uppercase tracking-widest text-slate-400 flex items-center gap-3">
              <History size={16}/> Riwayat Haul
            </h5>
            <div className="space-y-3">
              {summary.haulHistory.length === 0 ? (
                <div className="flex items-center gap-3 opacity-40">
                  <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center"><AlertCircle size={16}/></div>
                  <p className="text-[11px] font-bold text-slate-400 italic">Belum ada haul tercatat.</p>
                </div>
              ) : (
                summary.haulHistory.map((h: any, i: number) => (
                  <div key={h.id} className={`p-4 rounded-2xl border text-xs ${h.status === 'ACTIVE' ? 'bg-emerald-50 border-emerald-100' : h.status === 'BATAL' ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-black text-slate-700">{h.haul_start_date}</span>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${h.status === 'ACTIVE' ? 'bg-emerald-200 text-emerald-800' : h.status === 'BATAL' ? 'bg-rose-200 text-rose-800' : 'bg-slate-200 text-slate-600'}`}>{h.status}</span>
                    </div>
                    <p className="text-slate-500 font-medium">Emas: Rp {Number(h.gold_price_per_gram).toLocaleString('id-ID')}/gr</p>
                    <p className="text-slate-500 font-medium">Perak: Rp {Number(h.silver_price_per_gram).toLocaleString('id-ID')}/gr</p>
                    {h.batal_reason && <p className="text-rose-500 text-[9px] mt-1 italic">{h.batal_reason}</p>}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Syariah Add-on */}
          <div className="bg-white p-8 rounded-[48px] border border-slate-100 shadow-sm space-y-4">
            <p className="text-[10px] font-black text-slate-900 uppercase italic tracking-widest">Syariah Add-on (CoAS)</p>
            <p className="text-[11px] font-medium text-slate-500 leading-relaxed italic">
              Suntikkan akun Permodalan Syirkah, Ijarah, dan Zakat otomatis ke CoA Anda.
            </p>
            <button
              onClick={async () => {
                if (confirm('Aktifkan struktur akun Syariah (CoAS)?')) {
                  const res = await injectShariahPack(orgId)
                  if (res.success) alert('Struktur Akun Syariah Berhasil Disuntikkan!')
                  else alert(res.error)
                }
              }}
              className="w-full py-3 bg-white border border-indigo-200 text-indigo-600 rounded-2xl text-[10px] font-black hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
            >
              <ShieldCheck size={14}/> AKTIFKAN AKUN SYARIAH
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
