'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { PageHeader, SafeButton, SectionCard, FormField, FormInput, FormSelect, Modal, StatusBadge } from '@/components/ui/NizamUI'
import { ArrowLeft, Plus, BookOpen, BarChart3, TrendingUp, Wallet, FileText, Gift, Loader2 } from 'lucide-react'
import { updateStatusProyek } from '@/modules/koperasi/actions/koperasi.actions'
import {
  generateProjectCoa, getProjectCoa, getProjectJournal,
  createProjectJournalEntry, getProjectBalanceSheet, getProjectProfitLoss,
} from '@/modules/koperasi/actions/proyek-jurnal.actions'
import {
  hitungBagiHasil, getBagiHasil, konfirmasiBagiHasil,
  setujuiDistribusi, syncProyekKeBukuBesar, getProjectFinancialSummary,
} from '@/modules/koperasi/actions/bagi-hasil.actions'

type TabType = 'overview' | 'jurnal' | 'neraca' | 'laba-rugi' | 'bagi-hasil'

async function fetchProyek(id: string) {
  const res = await fetch(`/api/koperasi/proyek/${id}`)
  if (!res.ok) throw new Error('Gagal memuat proyek')
  return res.json()
}

export default function ProyekDetailClient() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  const [proyek, setProyek] = useState<any>(null)
  const [loadingProyek, setLoadingProyek] = useState(true)
  const [tab, setTab] = useState<TabType>('overview')
  const [coa, setCoa] = useState<any[]>([])
  const [journal, setJournal] = useState<any[]>([])
  const [neraca, setNeraca] = useState<any>(null)
  const [pnl, setPnl] = useState<any>(null)
  const [bagiHasil, setBagiHasil] = useState<any[]>([])
  const [finSummary, setFinSummary] = useState<any>(null)
  const [loadingBh, setLoadingBh] = useState(false)
  const [showJurnal, setShowJurnal] = useState(false)
  const [jurnalForm, setJurnalForm] = useState({
    tgl_transaksi: new Date().toISOString().split('T')[0],
    tipe: 'PENDAPATAN',
    keterangan: '',
    lines: [] as { coa_id: string; debit: string; kredit: string; keterangan: string }[],
  })

  // Fetch proyek from API
  useEffect(() => {
    if (!id) return
    fetchProyek(id)
      .then(data => { setProyek(data); setLoadingProyek(false) })
      .catch(() => setLoadingProyek(false))
  }, [id])

  // Auto-generate COA when project becomes AKTIF
  useEffect(() => {
    if (!proyek) return
    if (proyek.status === 'AKTIF' || proyek.status === 'SELESAI' || proyek.status === 'DISTRIBUSI') {
      loadCoa()
    }
  }, [proyek?.status])

  useEffect(() => {
    if (!proyek) return
    if (tab === 'overview') loadJournal()
    if (tab === 'jurnal') loadJournal()
    if (tab === 'neraca') loadNeraca()
    if (tab === 'laba-rugi') loadPnl()
    if (tab === 'bagi-hasil') { loadBagiHasil(); loadFinSummary() }
  }, [tab, proyek?.id])

  async function loadCoa() {
    if (!proyek) return
    try {
      const c = await getProjectCoa(proyek.id)
      if (c.length === 0) {
        await generateProjectCoa(proyek.id)
        setCoa(await getProjectCoa(proyek.id))
      } else {
        setCoa(c)
      }
    } catch (e) {
      console.error('CoA load error:', e)
    }
  }

  async function loadJournal() {
    if (!proyek) return
    const j = await getProjectJournal(proyek.id)
    setJournal(j)
  }

  async function loadNeraca() {
    if (!proyek) return
    const n = await getProjectBalanceSheet(proyek.id)
    setNeraca(n)
  }

  async function loadPnl() {
    if (!proyek) return
    const p = await getProjectProfitLoss(proyek.id)
    setPnl(p)
  }

  async function loadBagiHasil() {
    if (!proyek) return
    const bh = await getBagiHasil(proyek.id)
    setBagiHasil(bh)
  }

  async function loadFinSummary() {
    if (!proyek) return
    try {
      const s = await getProjectFinancialSummary(proyek.id)
      setFinSummary(s)
    } catch (e) { console.error('fin summary error:', e) }
  }

  async function handleHitungBagiHasil() {
    if (!proyek) return
    setLoadingBh(true)
    try {
      const result = await hitungBagiHasil(proyek.id)
      alert(`✅ Bagi hasil berhasil dihitung!\nLaba: Rp ${result.totalLaba.toLocaleString()}\nBagian SM: Rp ${result.bagianSM.toLocaleString()}\nBagian Mudharib: Rp ${result.bagianMudharib.toLocaleString()}`)
      loadBagiHasil()
    } catch (e: any) {
      alert('❌ ' + e.message)
    }
    setLoadingBh(false)
  }

  async function handleKonfirmasiBagiHasil(bhId: string) {
    await konfirmasiBagiHasil(bhId)
    loadBagiHasil()
  }

  async function handleDistribusi(bhId: string) {
    if (!proyek) return
    setLoadingBh(true)
    try {
      await setujuiDistribusi(bhId, proyek.id)
      alert('✅ Distribusi disetujui!')
      loadBagiHasil()
      // Refresh proyek data from API
      const updated = await fetchProyek(id)
      setProyek(updated)
    } catch (e: any) {
      alert('❌ ' + e.message)
    }
    setLoadingBh(false)
  }

  async function handleSyncL2(bhId: string) {
    if (!proyek) return
    setLoadingBh(true)
    try {
      await syncProyekKeBukuBesar(proyek.org_id, proyek.id)
      alert('✅ Proyek berhasil disinkronkan ke buku besar!')
      const updated = await fetchProyek(id)
      setProyek(updated)
    } catch (e: any) {
      alert('❌ ' + e.message)
    }
    setLoadingBh(false)
  }

  async function handleGenerateCoa() {
    if (!proyek) return
    await generateProjectCoa(proyek.id)
    setCoa(await getProjectCoa(proyek.id))
  }

  function addJurnalLine() {
    setJurnalForm(f => ({
      ...f,
      lines: [...f.lines, { coa_id: '', debit: '0', kredit: '0', keterangan: '' }],
    }))
  }

  function updateJurnalLine(idx: number, field: string, value: string) {
    const lines = [...jurnalForm.lines]
    lines[idx] = { ...lines[idx], [field]: value }
    setJurnalForm(f => ({ ...f, lines }))
  }

  function removeJurnalLine(idx: number) {
    setJurnalForm(f => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }))
  }

  async function handleSubmitJurnal(e: React.FormEvent) {
    if (!proyek) return
    e.preventDefault()
    await createProjectJournalEntry(proyek.id, {
      tgl_transaksi: jurnalForm.tgl_transaksi,
      tipe: jurnalForm.tipe,
      keterangan: jurnalForm.keterangan,
      lines: jurnalForm.lines.map(l => ({
        coa_id: l.coa_id,
        debit: Number(l.debit),
        kredit: Number(l.kredit),
        keterangan: l.keterangan,
      })),
    })
    setShowJurnal(false)
    setJurnalForm({
      tgl_transaksi: new Date().toISOString().split('T')[0],
      tipe: 'PENDAPATAN',
      keterangan: '',
      lines: [],
    })
    loadJournal()
    if (tab === 'neraca') loadNeraca()
    if (tab === 'laba-rugi') loadPnl()
  }

  const tabs: { key: TabType; label: string; icon: any }[] = [
    { key: 'overview', label: 'Overview', icon: TrendingUp },
    { key: 'jurnal', label: 'Jurnal', icon: BookOpen },
    { key: 'neraca', label: 'Neraca', icon: BarChart3 },
    { key: 'laba-rugi', label: 'Laba/Rugi', icon: FileText },
    { key: 'bagi-hasil', label: 'Bagi Hasil', icon: Gift },
  ]

  const totalDebit = jurnalForm.lines.reduce((s, l) => s + Number(l.debit || 0), 0)
  const totalKredit = jurnalForm.lines.reduce((s, l) => s + Number(l.kredit || 0), 0)
  const isBalance = Math.abs(totalDebit - totalKredit) < 0.01

  // Loading state
  if (loadingProyek) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
      </div>
    )
  }

  if (!proyek) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>Proyek tidak ditemukan</p>
        <SafeButton onClick={() => router.push('/koperasi/proyek')} className="mt-4">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </SafeButton>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader title={proyek.nama_proyek} subtitle={`Mudharib: ${proyek.mudharib?.nama || '-'}`}>
        <SafeButton variant="ghost" onClick={() => router.push('/koperasi/proyek')}>
          <ArrowLeft className="w-4 h-4" /> Kembali
        </SafeButton>
      </PageHeader>

      {/* Info Bar */}
      <div className="grid grid-cols-4 gap-4">
        <SectionCard>
          <div className="text-xs text-slate-400">Status</div>
          <StatusBadge label={proyek.status} variant={proyek.status === 'AKTIF' ? 'success' : 'warning'} />
        </SectionCard>
        <SectionCard>
          <div className="text-xs text-slate-400">Modal Dibutuhkan</div>
          <div className="text-sm font-semibold text-slate-900">Rp {Number(proyek.modal_dibutuhkan).toLocaleString()}</div>
        </SectionCard>
        <SectionCard>
          <div className="text-xs text-slate-400">Terkumpul</div>
          <div className="text-sm font-semibold text-emerald-600">Rp {Number(proyek.modal_terkumpul).toLocaleString()}</div>
        </SectionCard>
        <SectionCard>
          <div className="text-xs text-slate-400">Nisbah</div>
          <div className="text-sm font-semibold text-slate-900">SM {Number(proyek.nisbah_sm || 0).toFixed(0)}% : M {Number(proyek.nisbah_mudharib || 0).toFixed(0)}%</div>
        </SectionCard>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm transition-all ${
              tab === t.key ? 'text-emerald-600 border-b-2 border-emerald-400' : 'text-slate-400 hover:text-slate-500'
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
        {(proyek.status === 'AKTIF' || proyek.status === 'PENDANAAN') && (
          <div className="ml-auto">
            <SafeButton size="sm" onClick={() => { loadCoa(); setShowJurnal(true) }}>
              <Plus className="w-3 h-3" /> Input Transaksi
            </SafeButton>
          </div>
        )}
        {proyek.status === 'AKTIF' && coa.length === 0 && (
          <SafeButton size="sm" onClick={handleGenerateCoa} variant="warning">
            Generate CoA Proyek
          </SafeButton>
        )}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {journal.length > 0 && (
            <SectionCard>
              <div className="p-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Transaksi Terakhir</h3>
                <div className="space-y-2">
                  {journal.slice(0, 5).map((j: any) => (
                    <div key={j.id} className="flex justify-between p-2 rounded-lg bg-slate-50">
                      <div>
                        <span className="text-xs text-slate-500">{j.tgl_transaksi}</span>
                        <span className="ml-2 text-xs font-medium text-slate-900">{j.keterangan}</span>
                      </div>
                      <span className="text-xs text-slate-400">{j.tipe}</span>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          )}
          {coa.length > 0 && (
            <SectionCard>
              <div className="p-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">CoA Proyek ({coa.length} akun)</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {coa.map((c: any) => (
                    <div key={c.id} className="p-2 rounded-lg bg-slate-50 text-xs">
                      <span className="text-emerald-600">{c.kode}</span>
                      <span className="ml-1 text-slate-500">{c.nama}</span>
                      <span className="ml-1 text-[10px] text-slate-400">({c.tipe})</span>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          )}
          {journal.length === 0 && coa.length === 0 && (
            <SectionCard>
              <div className="p-8 text-center text-slate-500">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>Belum ada transaksi. Aktifkan proyek dan mulai input transaksi di tab Jurnal.</p>
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {/* ── JURNAL ── */}
      {tab === 'jurnal' && (
        <SectionCard>
          <div className="p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Jurnal Transaksi</h3>
            {journal.length === 0 ? (
              <div className="p-4 text-slate-500 text-center">Belum ada jurnal</div>
            ) : (
              <div className="space-y-3">
                {journal.map((j: any) => (
                  <div key={j.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-xs text-slate-400">{j.tgl_transaksi}</span>
                        <span className="ml-2 text-xs font-medium text-slate-900">{j.keterangan}</span>
                      </div>
                      <StatusBadge label={j.tipe} variant="info" />
                    </div>
                    <table className="w-full text-xs">
                      <thead><tr className="text-slate-400 border-b border-slate-200">
                        <th className="p-1 text-left">Akun</th><th className="p-1 text-right">Debit</th><th className="p-1 text-right">Kredit</th>
                      </tr></thead>
                      <tbody>
                        {(j as any).lines?.map((line: any) => (
                          <tr key={line.id} className="border-b border-slate-100">
                            <td className="p-1 text-slate-500">{line.coa?.kode} — {line.coa?.nama}</td>
                            <td className="p-1 text-right text-emerald-600">{Number(line.debit) > 0 ? `Rp ${Number(line.debit).toLocaleString()}` : '-'}</td>
                            <td className="p-1 text-right text-amber-400">{Number(line.kredit) > 0 ? `Rp ${Number(line.kredit).toLocaleString()}` : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* ── NERACA ── */}
      {tab === 'neraca' && (
        <div className="grid grid-cols-2 gap-4">
          <SectionCard>
            <div className="p-4">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Aset</h3>
              {neraca?.aset?.length > 0 ? (
                <div className="space-y-2">
                  {neraca.aset.map((a: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-slate-500">{a.nama}</span>
                      <span className="text-slate-900 font-medium">Rp {a.saldo.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-semibold pt-2 border-t border-slate-200">
                    <span className="text-slate-900">Total Aset</span>
                    <span className="text-emerald-600">Rp {neraca.totalAset.toLocaleString()}</span>
                  </div>
                </div>
              ) : <div className="text-slate-500 text-sm p-2">Belum ada data</div>}
            </div>
          </SectionCard>
          <SectionCard>
            <div className="p-4">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Pasiva</h3>
              <div className="mb-3">
                <h4 className="text-xs text-slate-400 mb-1">Liabilitas</h4>
                {neraca?.liabilitas?.length > 0 ? neraca.liabilitas.map((l: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-slate-500">{l.nama}</span>
                    <span className="text-slate-900 font-medium">Rp {l.saldo.toLocaleString()}</span>
                  </div>
                )) : <div className="text-slate-500 text-xs">Tidak ada</div>}
              </div>
              <div>
                <h4 className="text-xs text-slate-400 mb-1">Ekuitas</h4>
                {neraca?.ekuitas?.length > 0 ? neraca.ekuitas.map((e: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-slate-500">{e.nama}</span>
                    <span className="text-slate-900 font-medium">Rp {e.saldo.toLocaleString()}</span>
                  </div>
                )) : <div className="text-slate-500 text-xs">Tidak ada</div>}
              </div>
              <div className="flex justify-between text-sm font-semibold pt-2 border-t border-slate-200 mt-2">
                <span className="text-slate-900">Total Pasiva</span>
                <span className="text-emerald-600">Rp {neraca?.totalPasiva?.toLocaleString() || '0'}</span>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── LABA/RUGI ── */}
      {tab === 'laba-rugi' && (
        <SectionCard>
          <div className="p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Laporan Laba / Rugi</h3>
            {pnl ? (
              <div className="space-y-3">
                <div>
                  <h4 className="text-xs text-emerald-600 mb-1 font-semibold">PENDAPATAN</h4>
                  {pnl.pendapatan.length > 0 ? pnl.pendapatan.map((p: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-slate-500">{p.nama}</span>
                      <span className="text-emerald-600">Rp {p.jumlah.toLocaleString()}</span>
                    </div>
                  )) : <div className="text-slate-500 text-xs">Belum ada pendapatan</div>}
                  <div className="flex justify-between text-sm font-semibold pt-2 border-t border-slate-200 mt-1">
                    <span className="text-slate-900">Total Pendapatan</span>
                    <span className="text-emerald-600">Rp {pnl.totalPendapatan.toLocaleString()}</span>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs text-amber-400 mb-1 font-semibold">BEBAN</h4>
                  {pnl.beban.length > 0 ? pnl.beban.map((b: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-slate-500">{b.nama}</span>
                      <span className="text-amber-400">Rp {b.jumlah.toLocaleString()}</span>
                    </div>
                  )) : <div className="text-slate-500 text-xs">Belum ada beban</div>}
                  <div className="flex justify-between text-sm font-semibold pt-2 border-t border-slate-200 mt-1">
                    <span className="text-slate-900">Total Beban</span>
                    <span className="text-amber-400">Rp {pnl.totalBeban.toLocaleString()}</span>
                  </div>
                </div>
                <div className={`p-3 rounded-xl ${pnl.labaBersih >= 0 ? 'bg-emerald-50' : 'bg-red-50'} mt-3`}>
                  <div className="flex justify-between text-base font-bold">
                    <span className="text-slate-900">LABA / RUGI BERSIH</span>
                    <span className={pnl.labaBersih >= 0 ? 'text-emerald-600' : 'text-red-400'}>
                      Rp {pnl.labaBersih.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ) : <div className="text-slate-500 p-4 text-center">Memuat...</div>}
          </div>
        </SectionCard>
      )}

      {/* ── BAGI HASIL ── */}
      {tab === 'bagi-hasil' && (
        <div className="space-y-4">
          {finSummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SectionCard>
                <div className="p-3">
                  <div className="text-xs text-slate-400">Total Pendapatan</div>
                  <div className="text-sm font-semibold text-emerald-600">Rp {finSummary.totalPendapatan.toLocaleString()}</div>
                </div>
              </SectionCard>
              <SectionCard>
                <div className="p-3">
                  <div className="text-xs text-slate-400">Total Beban</div>
                  <div className="text-sm font-semibold text-amber-400">Rp {finSummary.totalBeban.toLocaleString()}</div>
                </div>
              </SectionCard>
              <SectionCard>
                <div className="p-3">
                  <div className="text-xs text-slate-400">Laba Bersih</div>
                  <div className={`text-sm font-semibold ${finSummary.labaBersih >= 0 ? 'text-emerald-600' : 'text-red-400'}`}>
                    Rp {finSummary.labaBersih.toLocaleString()}
                  </div>
                </div>
              </SectionCard>
              <SectionCard>
                <div className="p-3">
                  <div className="text-xs text-slate-400">Nisbah</div>
                  <div className="text-sm font-semibold text-slate-900">SM {finSummary.nisbahSM}% : M {finSummary.nisbahMudharib}%</div>
                </div>
              </SectionCard>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            {(proyek.status === 'SELESAI' || proyek.status === 'DISTRIBUSI') && bagiHasil.length === 0 && (
              <SafeButton onClick={handleHitungBagiHasil} disabled={loadingBh}>
                <Gift className="w-4 h-4" /> {loadingBh ? 'Menghitung...' : 'Hitung Bagi Hasil'}
              </SafeButton>
            )}
            {bagiHasil.length > 0 && bagiHasil[0].status === 'ESTIMASI' && (
              <SafeButton onClick={() => handleKonfirmasiBagiHasil(bagiHasil[0].id)}>
                ✅ Konfirmasi Bagi Hasil
              </SafeButton>
            )}
            {bagiHasil.length > 0 && bagiHasil[0].status === 'DIKONFIRMASI' && (
              <SafeButton onClick={() => handleDistribusi(bagiHasil[0].id)} disabled={loadingBh}>
                <Gift className="w-4 h-4" /> Setujui Distribusi
              </SafeButton>
            )}
            {bagiHasil.length > 0 && bagiHasil[0].status === 'DIDISTRIBUSI' && (
              <SafeButton onClick={() => handleSyncL2(bagiHasil[0].id)} disabled={loadingBh} variant="primary">
                <Wallet className="w-4 h-4" /> Sync ke Buku Besar + Tutup
              </SafeButton>
            )}
          </div>

          {bagiHasil.length > 0 && (
            <SectionCard>
              <div className="p-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Bagi Hasil — {bagiHasil[0].status}</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-emerald-50">
                      <div className="text-xs text-emerald-600">Total Laba</div>
                      <div className="text-lg font-bold text-emerald-600">Rp {Number(bagiHasil[0].total_laba).toLocaleString()}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-blue-50">
                      <div className="text-xs text-blue-500">Bagian Shahibul Maal</div>
                      <div className="text-lg font-bold text-blue-500">Rp {Number(bagiHasil[0].total_distribusi_shahibul_maal).toLocaleString()}</div>
                      <div className="text-[10px] text-slate-400">{finSummary ? finSummary.nisbahSM : '?'}% dari laba</div>
                    </div>
                    <div className="p-3 rounded-xl bg-purple-50">
                      <div className="text-xs text-purple-500">Bagian Mudharib</div>
                      <div className="text-lg font-bold text-purple-500">Rp {Number(bagiHasil[0].total_distribusi_mudharib).toLocaleString()}</div>
                      <div className="text-[10px] text-slate-400">{finSummary ? finSummary.nisbahMudharib : '?'}% dari laba</div>
                    </div>
                  </div>
                  
                  {Number(bagiHasil[0].ujrah_koperasi) > 0 && (
                    <div className="p-2 rounded-lg bg-amber-50 text-xs">
                      <span className="text-amber-600">Ujrah Koperasi:</span>
                      <span className="text-slate-900 ml-1">Rp {Number(bagiHasil[0].ujrah_koperasi).toLocaleString()}</span>
                    </div>
                  )}

                  {(bagiHasil[0] as any).distribusi?.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-xs text-slate-400 mb-2">Distribusi per Pihak</h4>
                      <div className="space-y-2">
                        {(bagiHasil[0] as any).distribusi.map((d: any) => (
                          <div key={d.id} className="flex justify-between items-center p-2 rounded-lg bg-slate-50">
                            <div>
                              <span className="text-xs font-medium text-slate-900">
                                {d.shahibul_maal?.anggota?.nama || d.mudharib?.anggota?.nama || d.pihak_id?.slice(0, 8)}
                              </span>
                              <span className="ml-2 text-[10px] text-slate-400">{d.pihak_type}</span>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-slate-600">Rp {Number(d.nominal).toLocaleString()}</div>
                              <div className="text-[10px] text-slate-400">{d.porsi_persen}%</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>
          )}

          {bagiHasil.length === 0 && finSummary && finSummary.labaBersih <= 0 && (
            <SectionCard>
              <div className="p-4 text-center text-slate-500">
                Proyek belum menghasilkan laba. Input transaksi pendapatan dan beban dulu di tab Jurnal.
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {/* ── MODAL INPUT JURNAL ── */}
      <Modal show={showJurnal} onClose={() => setShowJurnal(false)} title="Input Transaksi Proyek" size="lg">
        <form onSubmit={handleSubmitJurnal} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Tanggal"><FormInput type="date" value={jurnalForm.tgl_transaksi} onChange={e => setJurnalForm(f => ({...f, tgl_transaksi: e.target.value}))} required /></FormField>
            <FormField label="Tipe">
              <FormSelect value={jurnalForm.tipe} onChange={e => setJurnalForm(f => ({...f, tipe: e.target.value}))}>
                <option value="PENDAPATAN">Pendapatan</option>
                <option value="BEBAN_OPERASIONAL">Beban Operasional</option>
                <option value="BEBAN_GAJI">Beban Gaji</option>
                <option value="BEBAN_LAIN">Beban Lain</option>
                <option value="PENCAIRAN_MODAL">Pencairan Modal</option>
                <option value="SETOR_HASIL">Setor Hasil</option>
              </FormSelect>
            </FormField>
          </div>
          <FormField label="Keterangan"><FormInput value={jurnalForm.keterangan} onChange={e => setJurnalForm(f => ({...f, keterangan: e.target.value}))} required /></FormField>

          <div className="border border-slate-200 rounded-xl p-3">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-xs font-semibold text-slate-500">Garis Jurnal</h4>
              <SafeButton type="button" size="sm" onClick={addJurnalLine}><Plus className="w-3 h-3" /> Tambah Baris</SafeButton>
            </div>
            {jurnalForm.lines.length === 0 && (
              <p className="text-xs text-slate-400 p-2">Klik "Tambah Baris" untuk mulai</p>
            )}
            {jurnalForm.lines.map((line, idx) => (
              <div key={idx} className="flex gap-2 items-start mb-2 p-2 rounded-lg bg-slate-50">
                <div className="flex-1">
                  <FormSelect value={line.coa_id} onChange={e => updateJurnalLine(idx, 'coa_id', e.target.value)} required>
                    <option value="">Pilih Akun</option>
                    {coa.filter(c => {
                      if (jurnalForm.tipe === 'PENDAPATAN' || jurnalForm.tipe === 'SETOR_HASIL') return c.tipe === 'PENDAPATAN' || c.tipe === 'ASET'
                      if (jurnalForm.tipe.startsWith('BEBAN')) return c.tipe === 'BEBAN' || c.tipe === 'ASET'
                      if (jurnalForm.tipe === 'PENCAIRAN_MODAL') return c.tipe === 'ASET' || c.tipe === 'LIABILITAS'
                      return true
                    }).map((c: any) => (
                      <option key={c.id} value={c.id}>{c.kode} — {c.nama}</option>
                    ))}
                  </FormSelect>
                </div>
                <div className="w-28">
                  <FormInput type="number" placeholder="Debit" value={line.debit} onChange={e => updateJurnalLine(idx, 'debit', e.target.value)} />
                </div>
                <div className="w-28">
                  <FormInput type="number" placeholder="Kredit" value={line.kredit} onChange={e => updateJurnalLine(idx, 'kredit', e.target.value)} />
                </div>
                <button type="button" onClick={() => removeJurnalLine(idx)} className="p-2 text-red-400 hover:text-red-300">✕</button>
              </div>
            ))}
            {jurnalForm.lines.length > 0 && (
              <div className={`flex justify-between text-xs font-medium pt-2 border-t border-slate-200 ${isBalance ? 'text-emerald-600' : 'text-red-400'}`}>
                <span>{isBalance ? '✅ Balance' : '❌ Tidak Balance'}</span>
                <span>Debit: Rp {totalDebit.toLocaleString()} | Kredit: Rp {totalKredit.toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <SafeButton type="button" variant="ghost" onClick={() => setShowJurnal(false)}>Batal</SafeButton>
            <SafeButton type="submit" disabled={!isBalance || jurnalForm.lines.length === 0}>Simpan Jurnal</SafeButton>
          </div>
        </form>
      </Modal>
    </div>
  )
}
