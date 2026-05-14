'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader, SafeButton, SectionCard, FormField, FormInput, FormSelect, Modal, StatusBadge } from '@/components/ui/NizamUI'
import { ArrowLeft, Plus, BookOpen, BarChart3, TrendingUp, Wallet, FileText } from 'lucide-react'
import { updateStatusProyek } from '@/modules/koperasi/actions/koperasi.actions'
import {
  generateProjectCoa, getProjectCoa, getProjectJournal,
  createProjectJournalEntry, getProjectBalanceSheet, getProjectProfitLoss,
} from '@/modules/koperasi/actions/proyek-jurnal.actions'

type TabType = 'overview' | 'jurnal' | 'neraca' | 'laba-rugi'

export default function ProyekDetailClient({ proyek, orgId }: { proyek: any; orgId: string }) {
  const router = useRouter()
  const [tab, setTab] = useState<TabType>('overview')
  const [coa, setCoa] = useState<any[]>([])
  const [journal, setJournal] = useState<any[]>([])
  const [neraca, setNeraca] = useState<any>(null)
  const [pnl, setPnl] = useState<any>(null)
  const [showJurnal, setShowJurnal] = useState(false)
  const [jurnalForm, setJurnalForm] = useState({
    tgl_transaksi: new Date().toISOString().split('T')[0],
    tipe: 'PENDAPATAN',
    keterangan: '',
    lines: [] as { coa_id: string; debit: string; kredit: string; keterangan: string }[],
  })

  // Auto-generate COA when project becomes AKTIF
  useEffect(() => {
    if (proyek.status === 'AKTIF' || proyek.status === 'SELESAI' || proyek.status === 'DISTRIBUSI') {
      loadCoa()
    }
  }, [proyek.status])

  useEffect(() => {
    if (tab === 'overview') loadJournal()
    if (tab === 'jurnal') loadJournal()
    if (tab === 'neraca') loadNeraca()
    if (tab === 'laba-rugi') loadPnl()
  }, [tab])

  async function loadCoa() {
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
    const j = await getProjectJournal(proyek.id)
    setJournal(j)
  }

  async function loadNeraca() {
    const n = await getProjectBalanceSheet(proyek.id)
    setNeraca(n)
  }

  async function loadPnl() {
    const p = await getProjectProfitLoss(proyek.id)
    setPnl(p)
  }

  async function handleGenerateCoa() {
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
  ]

  const totalDebit = jurnalForm.lines.reduce((s, l) => s + Number(l.debit || 0), 0)
  const totalKredit = jurnalForm.lines.reduce((s, l) => s + Number(l.kredit || 0), 0)
  const isBalance = Math.abs(totalDebit - totalKredit) < 0.01

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
          <div className="text-xs text-white/40">Status</div>
          <StatusBadge label={proyek.status} variant={proyek.status === 'AKTIF' ? 'success' : 'warning'} />
        </SectionCard>
        <SectionCard>
          <div className="text-xs text-white/40">Modal Dibutuhkan</div>
          <div className="text-sm font-semibold text-white">Rp {Number(proyek.modal_dibutuhkan).toLocaleString()}</div>
        </SectionCard>
        <SectionCard>
          <div className="text-xs text-white/40">Terkumpul</div>
          <div className="text-sm font-semibold text-emerald-400">Rp {Number(proyek.modal_terkumpul).toLocaleString()}</div>
        </SectionCard>
        <SectionCard>
          <div className="text-xs text-white/40">Nisbah</div>
          <div className="text-sm font-semibold text-white">SM {Number(proyek.nisbah_sm || 0).toFixed(0)}% : M {Number(proyek.nisbah_mudharib || 0).toFixed(0)}%</div>
        </SectionCard>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm transition-all ${
              tab === t.key ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-white/40 hover:text-white/60'
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
        {/* CoA Install Button if needed */}
        {proyek.status === 'AKTIF' && coa.length === 0 && (
          <SafeButton size="sm" onClick={handleGenerateCoa} variant="warning">
            Generate CoA Proyek
          </SafeButton>
        )}
      </div>

      {/* Tab Content */}
      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {journal.length > 0 && (
            <SectionCard title="Transaksi Terakhir">
              <div className="space-y-2 mt-2">
                {journal.slice(0, 5).map((j: any) => (
                  <div key={j.id} className="flex justify-between p-2 rounded-lg bg-white/5">
                    <div>
                      <span className="text-xs text-white/60">{j.tgl_transaksi}</span>
                      <span className="ml-2 text-xs font-medium text-white">{j.keterangan}</span>
                    </div>
                    <span className="text-xs text-white/40">{j.tipe}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
          {coa.length > 0 && (
            <SectionCard title="CoA Proyek ({coa.length} akun)">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                {coa.map((c: any) => (
                  <div key={c.id} className="p-2 rounded-lg bg-white/5 text-xs">
                    <span className="text-emerald-400">{c.kode}</span>
                    <span className="ml-1 text-white/60">{c.nama}</span>
                    <span className="ml-1 text-[10px] text-white/30">({c.tipe})</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
          {journal.length === 0 && coa.length === 0 && (
            <div className="p-8 text-center text-white/50">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Belum ada transaksi. Aktifkan proyek dan mulai input transaksi di tab Jurnal.</p>
            </div>
          )}
        </div>
      )}

      {/* ── JURNAL ── */}
      {tab === 'jurnal' && (
        <SectionCard title="Jurnal Transaksi">
          {journal.length === 0 ? (
            <div className="p-4 text-white/50 text-center">Belum ada jurnal</div>
          ) : (
            <div className="space-y-3 mt-2">
              {journal.map((j: any) => (
                <div key={j.id} className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-xs text-white/40">{j.tgl_transaksi}</span>
                      <span className="ml-2 text-xs font-medium text-white">{j.keterangan}</span>
                    </div>
                    <StatusBadge label={j.tipe} variant="info" />
                  </div>
                  <table className="w-full text-xs">
                    <thead><tr className="text-white/30 border-b border-white/10">
                      <th className="p-1 text-left">Akun</th><th className="p-1 text-right">Debit</th><th className="p-1 text-right">Kredit</th>
                    </tr></thead>
                    <tbody>
                      {(j as any).lines?.map((line: any) => (
                        <tr key={line.id} className="border-b border-white/5">
                          <td className="p-1 text-white/60">{line.coa?.kode} — {line.coa?.nama}</td>
                          <td className="p-1 text-right text-emerald-400">{Number(line.debit) > 0 ? `Rp ${Number(line.debit).toLocaleString()}` : '-'}</td>
                          <td className="p-1 text-right text-amber-400">{Number(line.kredit) > 0 ? `Rp ${Number(line.kredit).toLocaleString()}` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* ── NERACA ── */}
      {tab === 'neraca' && (
        <div className="grid grid-cols-2 gap-4">
          <SectionCard title="Aset">
            {neraca?.aset?.length > 0 ? (
              <div className="space-y-2 mt-2">
                {neraca.aset.map((a: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-white/60">{a.nama}</span>
                    <span className="text-white font-medium">Rp {a.saldo.toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-semibold pt-2 border-t border-white/10">
                  <span className="text-white">Total Aset</span>
                  <span className="text-emerald-400">Rp {neraca.totalAset.toLocaleString()}</span>
                </div>
              </div>
            ) : <div className="text-white/50 text-sm p-2">Belum ada data</div>}
          </SectionCard>
          <SectionCard title="Pasiva">
            <div className="mb-3">
              <h4 className="text-xs text-white/40 mb-1">Liabilitas</h4>
              {neraca?.liabilitas?.length > 0 ? neraca.liabilitas.map((l: any, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-white/60">{l.nama}</span>
                  <span className="text-white font-medium">Rp {l.saldo.toLocaleString()}</span>
                </div>
              )) : <div className="text-white/50 text-xs">Tidak ada</div>}
            </div>
            <div>
              <h4 className="text-xs text-white/40 mb-1">Ekuitas</h4>
              {neraca?.ekuitas?.length > 0 ? neraca.ekuitas.map((e: any, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-white/60">{e.nama}</span>
                  <span className="text-white font-medium">Rp {e.saldo.toLocaleString()}</span>
                </div>
              )) : <div className="text-white/50 text-xs">Tidak ada</div>}
            </div>
            <div className="flex justify-between text-sm font-semibold pt-2 border-t border-white/10 mt-2">
              <span className="text-white">Total Pasiva</span>
              <span className="text-emerald-400">Rp {neraca?.totalPasiva?.toLocaleString() || '0'}</span>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── LABA/RUGI ── */}
      {tab === 'laba-rugi' && (
        <SectionCard title="Laporan Laba / Rugi">
          {pnl ? (
            <div className="space-y-3 mt-2">
              <div>
                <h4 className="text-xs text-emerald-400 mb-1 font-semibold">PENDAPATAN</h4>
                {pnl.pendapatan.length > 0 ? pnl.pendapatan.map((p: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-white/60">{p.nama}</span>
                    <span className="text-emerald-400">Rp {p.jumlah.toLocaleString()}</span>
                  </div>
                )) : <div className="text-white/50 text-xs">Belum ada pendapatan</div>}
                <div className="flex justify-between text-sm font-semibold pt-2 border-t border-white/10 mt-1">
                  <span className="text-white">Total Pendapatan</span>
                  <span className="text-emerald-400">Rp {pnl.totalPendapatan.toLocaleString()}</span>
                </div>
              </div>
              <div>
                <h4 className="text-xs text-amber-400 mb-1 font-semibold">BEBAN</h4>
                {pnl.beban.length > 0 ? pnl.beban.map((b: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-white/60">{b.nama}</span>
                    <span className="text-amber-400">Rp {b.jumlah.toLocaleString()}</span>
                  </div>
                )) : <div className="text-white/50 text-xs">Belum ada beban</div>}
                <div className="flex justify-between text-sm font-semibold pt-2 border-t border-white/10 mt-1">
                  <span className="text-white">Total Beban</span>
                  <span className="text-amber-400">Rp {pnl.totalBeban.toLocaleString()}</span>
                </div>
              </div>
              <div className={`p-3 rounded-xl ${pnl.labaBersih >= 0 ? 'bg-emerald-900/20' : 'bg-red-900/20'} mt-3`}>
                <div className="flex justify-between text-base font-bold">
                  <span className="text-white">LABA / RUGI BERSIH</span>
                  <span className={pnl.labaBersih >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    Rp {pnl.labaBersih.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ) : <div className="text-white/50 p-4 text-center">Memuat...</div>}
        </SectionCard>
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

          <div className="border border-white/10 rounded-xl p-3">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-xs font-semibold text-white/60">Garis Jurnal</h4>
              <SafeButton type="button" size="sm" onClick={addJurnalLine}><Plus className="w-3 h-3" /> Tambah Baris</SafeButton>
            </div>
            {jurnalForm.lines.length === 0 && (
              <p className="text-xs text-white/40 p-2">Klik "Tambah Baris" untuk mulai</p>
            )}
            {jurnalForm.lines.map((line, idx) => (
              <div key={idx} className="flex gap-2 items-start mb-2 p-2 rounded-lg bg-white/5">
                <div className="flex-1">
                  <FormSelect value={line.coa_id} onChange={e => updateJurnalLine(idx, 'coa_id', e.target.value)} required>
                    <option value="">Pilih Akun</option>
                    {coa.filter(c => {
                      // Filter COA based on tipe
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
              <div className={`flex justify-between text-xs font-medium pt-2 border-t border-white/10 ${isBalance ? 'text-emerald-400' : 'text-red-400'}`}>
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
