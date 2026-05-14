'use client'

import { useState } from 'react'
import { PageHeader, SafeButton, SectionCard, StatusBadge } from '@/components/ui/NizamUI'
import { Calculator, Download, Users, PiggyBank, GraduationCap, Heart, Building, Shield, UserCog } from 'lucide-react'
import { hitungSHU } from '@/modules/koperasi/actions/shu.actions'

const ALOKASI_LABEL: Record<string, { label: string; icon: any; color: string; desc: string }> = {
  anggota: { label: 'Bagi Hasil Anggota', icon: Users, color: 'text-emerald-400', desc: '40% — Dibagikan ke anggota proporsional simpanan' },
  cadangan: { label: 'Cadangan Koperasi', icon: PiggyBank, color: 'text-blue-400', desc: '20% — Dana cadangan koperasi' },
  pengurus: { label: 'Pengurus', icon: UserCog, color: 'text-purple-400', desc: '10% — Honorarium pengurus' },
  dps: { label: 'DPS', icon: Shield, color: 'text-cyan-400', desc: '10% — Dewan Pengawas Syariah' },
  sosial: { label: 'Dana Sosial', icon: Heart, color: 'text-red-400', desc: '10% — Kegiatan sosial dan CSR' },
  pendidikan: { label: 'Pendidikan', icon: GraduationCap, color: 'text-amber-400', desc: '5% — Pendidikan dan pelatihan' },
  pembangunan: { label: 'Dana Pembangunan', icon: Building, color: 'text-orange-400', desc: '5% — Pembangunan koperasi' },
}

export default function ShuClient({ orgId }: { orgId: string }) {
  const [tahun, setTahun] = useState(new Date().getFullYear())
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  async function handleHitung() {
    setLoading(true)
    try {
      const r = await hitungSHU(orgId, tahun)
      setResult(r)
    } catch (e: any) {
      alert('❌ ' + e.message)
    }
    setLoading(false)
  }

  function formatRp(n: number) {
    return `Rp ${n.toLocaleString('id-ID')}`
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Sisa Hasil Usaha (SHU)" subtitle="Laporan laba bersih & alokasi tahunan koperasi">
        <div className="flex items-center gap-2">
          <select
            value={tahun}
            onChange={e => setTahun(Number(e.target.value))}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <SafeButton onClick={handleHitung} disabled={loading}>
            <Calculator className="w-4 h-4" /> {loading ? 'Menghitung...' : 'Hitung SHU'}
          </SafeButton>
        </div>
      </PageHeader>

      {result && (
        <>
          {/* Revenue vs Expense Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SectionCard>
              <div className="text-xs text-white/40">Total Pendapatan</div>
              <div className="text-lg font-bold text-emerald-400">{formatRp(result.totalRevenue)}</div>
              <div className="text-[10px] text-white/30">
                Operasional: {formatRp(result.revenueDetail.pendapatanOperasional)} | 
                Ujrah: {formatRp(result.revenueDetail.ujrahProyek)}
              </div>
            </SectionCard>
            <SectionCard>
              <div className="text-xs text-white/40">Total Beban</div>
              <div className="text-lg font-bold text-amber-400">{formatRp(result.totalExpenses)}</div>
              <div className="text-[10px] text-white/30">
                Operasional: {formatRp(result.expenseDetail.bebanOperasional)}
              </div>
            </SectionCard>
            <SectionCard className="col-span-2">
              <div className="text-xs text-white/40">Laba Kotor Tahun {result.periode}</div>
              <div className={`text-2xl font-bold ${result.labaKotor >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatRp(result.labaKotor)}
              </div>
            </SectionCard>
          </div>

          {/* SHU Allocation */}
          <SectionCard title="Alokasi SHU">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
              {Object.entries(ALOKASI_LABEL).map(([key, meta]) => {
                const amount = (result.alokasi as any)[key] || 0
                if (amount <= 0) return null
                return (
                  <div key={key} className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center gap-2 mb-2">
                      <meta.icon className={`w-4 h-4 ${meta.color}`} />
                      <span className="text-xs font-medium text-white">{meta.label}</span>
                    </div>
                    <div className={`text-lg font-bold ${meta.color}`}>{formatRp(amount)}</div>
                    <div className="text-[10px] text-white/40 mt-1">{meta.desc}</div>
                  </div>
                )
              })}
            </div>
          </SectionCard>

          {/* SHU Per Anggota */}
          {result.shuPerAnggota?.length > 0 && (
            <SectionCard title={`Distribusi SHU ke Anggota (${result.shuPerAnggota.length} penerima)`}>
              <div className="max-h-64 overflow-y-auto mt-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-white/40 border-b border-white/10">
                      <th className="p-2 text-left">Nama</th>
                      <th className="p-2 text-right">Total Simpanan</th>
                      <th className="p-2 text-right">Porsi</th>
                      <th className="p-2 text-right">SHU Diterima</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.shuPerAnggota.map((a: any) => (
                      <tr key={a.anggotaId} className="border-b border-white/5">
                        <td className="p-2 text-white">{a.nama}</td>
                        <td className="p-2 text-right text-white/70">{formatRp(a.simpananTotal)}</td>
                        <td className="p-2 text-right text-white/50">{a.porsiPersen}%</td>
                        <td className="p-2 text-right text-emerald-400 font-medium">{formatRp(a.shuDiterima)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {/* Summary */}
          <SectionCard title="Ringkasan">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-white/5">
                <div className="text-xs text-white/40">Total Anggota Aktif</div>
                <div className="text-lg font-bold text-white">{result.totalAnggotaPenerima}</div>
              </div>
              <div className="p-3 rounded-xl bg-white/5">
                <div className="text-xs text-white/40">Total Simpanan</div>
                <div className="text-lg font-bold text-white">{formatRp(result.totalSimpananAnggota)}</div>
              </div>
              <div className="p-3 rounded-xl bg-white/5">
                <div className="text-xs text-white/40">Rata-rata SHU/Anggota</div>
                <div className="text-lg font-bold text-emerald-400">
                  {formatRp(result.totalAnggotaPenerima > 0 ? Math.round(result.alokasi.anggota / result.totalAnggotaPenerima) : 0)}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white/5">
                <div className="text-xs text-white/40">Rasio SHU ke Simpanan</div>
                <div className="text-lg font-bold text-blue-400">
                  {result.totalSimpananAnggota > 0 
                    ? `${(result.alokasi.anggota / result.totalSimpananAnggota * 100).toFixed(1)}%`
                    : '0%'}
                </div>
              </div>
            </div>
          </SectionCard>
        </>
      )}

      {!result && (
        <SectionCard>
          <div className="p-8 text-center text-white/50">
            <Calculator className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Pilih tahun dan klik "Hitung SHU" untuk melihat laporan Sisa Hasil Usaha.</p>
            <p className="text-xs text-white/30 mt-2">SHU dihitung dari pendapatan operasional, ujrah proyek, dan alokasi 40% anggota, 20% cadangan, 10% pengurus, 10% DPS, 10% sosial, 5% pendidikan, 5% pembangunan.</p>
          </div>
        </SectionCard>
      )}
    </div>
  )
}
