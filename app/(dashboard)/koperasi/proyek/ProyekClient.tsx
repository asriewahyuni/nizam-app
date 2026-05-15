'use client'

import { useState, useEffect } from 'react'
import { PageHeader, SafeButton, SectionCard, FormField, FormInput, FormSelect, Modal, StatusBadge, StatCard } from '@/components/ui/NizamUI'
import { Plus, TrendingUp, Users, Wallet, ArrowRightCircle, CheckCircle, XCircle, Eye, Send, AlertTriangle, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { getProyek, createProyek, updateStatusProyek, tambahInvestasi, getInvestasiProyek, getMudharib } from '@/modules/koperasi/actions/koperasi.actions'

const STATUS_FLOW: Record<string, { next: string[]; color: string; label: string }> = {
  DIAJUKAN:    { next: ['DIVERIFIKASI', 'DITOLAK'], color: 'bg-slate-600', label: 'Diajukan' },
  DIVERIFIKASI:{ next: ['DIPUBLIKASI', 'DITOLAK'], color: 'bg-blue-600', label: 'Diverifikasi' },
  DIPUBLIKASI: { next: ['PENDANAAN', 'GAGAL'], color: 'bg-cyan-600', label: 'Dipublikasi' },
  PENDANAAN:   { next: ['AKTIF', 'GAGAL'], color: 'bg-violet-600', label: 'Pendanaan' },
  AKTIF:       { next: ['SELESAI', 'GAGAL'], color: 'bg-emerald-600', label: 'Aktif' },
  SELESAI:     { next: ['DISTRIBUSI'], color: 'bg-teal-600', label: 'Selesai' },
  DISTRIBUSI:  { next: ['DITUTUP'], color: 'bg-amber-600', label: 'Distribusi' },
  DITUTUP:     { next: [], color: 'bg-green-800', label: 'Ditutup' },
  DITOLAK:     { next: [], color: 'bg-red-800', label: 'Ditolak' },
  GAGAL:       { next: [], color: 'bg-red-600', label: 'Gagal' },
  DIKEMBALIKAN:{ next: ['DIAJUKAN'], color: 'bg-orange-600', label: 'Dikembalikan' },
}

export default function ProyekClient({ orgId }: { orgId: string }) {
  const [data, setData] = useState<any[]>([])
  const [mudharib, setMudharib] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showInvestasi, setShowInvestasi] = useState<string | null>(null)
  const [investasi, setInvestasi] = useState<any[]>([])
  const [form, setForm] = useState({
    mudharib_id: '', nama_proyek: '', deskripsi: '',
    modal_dibutuhkan: '', nisbah_sm: '70', nisbah_mudharib: '30', ujrah_koperasi: '0',
  })
  const [investForm, setInvestForm] = useState({ shahibul_maal_id: '', jumlah: '' })

  useEffect(() => {
    Promise.all([getProyek(orgId), getMudharib(orgId)]).then(([d, m]) => {
      setData(d); setMudharib(m); setLoading(false)
    })
  }, [orgId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await createProyek(orgId, {
      mudharib_id: form.mudharib_id, nama_proyek: form.nama_proyek,
      deskripsi: form.deskripsi, modal_dibutuhkan: Number(form.modal_dibutuhkan),
      nisbah_sm: Number(form.nisbah_sm), nisbah_mudharib: Number(form.nisbah_mudharib),
      ujrah_koperasi: Number(form.ujrah_koperasi),
    })
    setShowForm(false)
    setForm({ mudharib_id: '', nama_proyek: '', deskripsi: '', modal_dibutuhkan: '', nisbah_sm: '70', nisbah_mudharib: '30', ujrah_koperasi: '0' })
    setData(await getProyek(orgId))
  }

  async function handleStatus(id: string, status: string, alasan?: string) {
    await updateStatusProyek(id, status, alasan)
    setData(await getProyek(orgId))
  }

  async function openInvestasi(proyekId: string) {
    setShowInvestasi(proyekId)
    setInvestasi(await getInvestasiProyek(proyekId))
  }

  async function handleInvestSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!showInvestasi) return
    // Dynamic import to get shahibul maal
    const { getShahibulMaal } = await import('@/modules/koperasi/actions/koperasi.actions')
    const smList = await getShahibulMaal(orgId)
    const sm = smList.find((s: any) => s.id === investForm.shahibul_maal_id)
    if (!sm) return
    await tambahInvestasi(showInvestasi, investForm.shahibul_maal_id, Number(investForm.jumlah))
    setInvestForm({ shahibul_maal_id: '', jumlah: '' })
  }

  // Stats
  const proyekAktif = data.filter(p => p.status === 'AKTIF' || p.status === 'PENDANAAN').length
  const totalModal = data.reduce((s, p) => s + Number(p.modal_terkumpul || 0), 0)
  const totalDibutuhkan = data.reduce((s, p) => s + Number(p.modal_dibutuhkan || 0), 0)

  return (
    <div className="space-y-4">
      <PageHeader title="Proyek Mudharabah" subtitle="Multi Shahibul Maal — kelola proyek investasi syariah" actions={
        <SafeButton onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Proyek Baru</SafeButton>
      } />

      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Proyek Aktif" value={proyekAktif.toString()} subtitle="Sedang berjalan" icon={TrendingUp} />
        <StatCard title="Total Modal Terkumpul" value={`Rp ${(totalModal / 1e6).toFixed(1)}jt`} subtitle={`Dari Rp ${(totalDibutuhkan / 1e6).toFixed(1)}jt`} icon={Wallet} />
        <StatCard title="Total Proyek" value={data.length.toString()} subtitle="Semua status" icon={Users} />
      </div>

      {/* Proyek List */}
      <SectionCard>
        {loading ? <div className="text-slate-500 p-4">Memuat...</div> : data.length === 0 ? (
          <div className="text-slate-500 p-8 text-center">Belum ada proyek. Buat proyek baru untuk memulai Mudharabah.</div>
        ) : (
          <div className="space-y-3">
            {data.map((p: any) => {
              const flow = STATUS_FLOW[p.status] || { color: 'bg-gray-600', label: p.status }
              const progress = p.modal_dibutuhkan > 0 ? Math.round((Number(p.modal_terkumpul) / Number(p.modal_dibutuhkan)) * 100) : 0
              return (
                <div key={p.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900">{p.nama_proyek}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium text-white ${flow.color}`}>
                          {flow.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{p.deskripsi || 'Tidak ada deskripsi'}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        <span>Mudharib: {p.mudharib?.nama || '-'}</span>
                        <span>Nisbah SM:{Number(p.nisbah_sm || 0).toFixed(0)}% : M:{Number(p.nisbah_mudharib || 0).toFixed(0)}%</span>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-2">
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                          <span>Progress Pendanaan</span>
                          <span>Rp {Number(p.modal_terkumpul).toLocaleString()} / Rp {Number(p.modal_dibutuhkan).toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
                        </div>
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex flex-col gap-1.5">
                      <Link href={`/koperasi/proyek/${p.id}`} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-white/20 text-xs font-medium transition-all">
                        <ExternalLink className="w-3 h-3" /> Buka Detail
                      </Link>
                      {flow.next.includes('DIVERIFIKASI') && <SafeButton size="sm" onClick={() => handleStatus(p.id, 'DIVERIFIKASI')}><CheckCircle className="w-3 h-3" /> Verifikasi</SafeButton>}
                      {flow.next.includes('DIPUBLIKASI') && <SafeButton size="sm" onClick={() => handleStatus(p.id, 'DIPUBLIKASI')}><Send className="w-3 h-3" /> Publikasi</SafeButton>}
                      {flow.next.includes('PENDANAAN') && <SafeButton size="sm" onClick={() => handleStatus(p.id, 'PENDANAAN')}><Users className="w-3 h-3" /> Buka Pendanaan</SafeButton>}
                      {p.status === 'PENDANAAN' && <SafeButton size="sm" onClick={() => openInvestasi(p.id)}><Wallet className="w-3 h-3" /> Tambah Investasi</SafeButton>}
                      {flow.next.includes('AKTIF') && <SafeButton size="sm" variant="primary" onClick={() => handleStatus(p.id, 'AKTIF')}><CheckCircle className="w-3 h-3" /> Aktifkan</SafeButton>}
                      {flow.next.includes('SELESAI') && <SafeButton size="sm" variant="primary" onClick={() => handleStatus(p.id, 'SELESAI')}><CheckCircle className="w-3 h-3" /> Selesai</SafeButton>}
                      {flow.next.includes('DISTRIBUSI') && <SafeButton size="sm" variant="primary" onClick={() => handleStatus(p.id, 'DISTRIBUSI')}><ArrowRightCircle className="w-3 h-3" /> Distribusi</SafeButton>}
                      {flow.next.includes('DITUTUP') && <SafeButton size="sm" variant="primary" onClick={() => handleStatus(p.id, 'DITUTUP')}><CheckCircle className="w-3 h-3" /> Tutup</SafeButton>}
                      {flow.next.includes('DITOLAK') && <SafeButton size="sm" variant="danger" onClick={() => handleStatus(p.id, 'DITOLAK')}><XCircle className="w-3 h-3" /> Tolak</SafeButton>}
                      {flow.next.includes('GAGAL') && <SafeButton size="sm" variant="danger" onClick={() => handleStatus(p.id, 'GAGAL', 'Gagal')}><AlertTriangle className="w-3 h-3" /> Gagal</SafeButton>}
                      {flow.next.includes('DIAJUKAN') && <SafeButton size="sm" variant="warning" onClick={() => handleStatus(p.id, 'DIAJUKAN')}><Eye className="w-3 h-3" /> Kembalikan</SafeButton>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>

      {/* Create Proyek Modal */}
      <Modal show={showForm} onClose={() => setShowForm(false)} title="Proyek Mudharabah Baru" size="lg">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Nama Proyek"><FormInput value={form.nama_proyek} onChange={e => setForm(f => ({...f, nama_proyek: e.target.value}))} required /></FormField>
            <FormField label="Mudharib">
              <FormSelect value={form.mudharib_id} onChange={e => setForm(f => ({...f, mudharib_id: e.target.value}))} required>
                <option value="">Pilih</option>
                {mudharib.filter((m: any) => m.is_tersertifikasi_dps).map((m: any) => (
                  <option key={m.id} value={m.id}>{m.nama}</option>
                ))}
              </FormSelect>
            </FormField>
          </div>
          <FormField label="Deskripsi"><FormInput value={form.deskripsi} onChange={e => setForm(f => ({...f, deskripsi: e.target.value}))} /></FormField>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Modal Dibutuhkan (Rp)"><FormInput type="number" value={form.modal_dibutuhkan} onChange={e => setForm(f => ({...f, modal_dibutuhkan: e.target.value}))} required /></FormField>
            <FormField label="Nisbah SM (%)"><FormInput type="number" value={form.nisbah_sm} onChange={e => setForm(f => ({...f, nisbah_sm: e.target.value}))} /></FormField>
            <FormField label="Nisbah Mudharib (%)"><FormInput type="number" value={form.nisbah_mudharib} onChange={e => setForm(f => ({...f, nisbah_mudharib: e.target.value}))} /></FormField>
          </div>
          <FormField label="Ujrah Koperasi (Flat)"><FormInput type="number" value={form.ujrah_koperasi} onChange={e => setForm(f => ({...f, ujrah_koperasi: e.target.value}))} /></FormField>
          <div className="p-3 bg-emerald-900/20 rounded-xl text-xs text-emerald-600">
            Nisbah bagi hasil: Shahibul Maal kolektif {form.nisbah_sm}% : Mudharib {form.nisbah_mudharib}%. 
            Ujrah koperasi Rp {Number(form.ujrah_koperasi || 0).toLocaleString()} (flat).
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <SafeButton type="button" variant="ghost" onClick={() => setShowForm(false)}>Batal</SafeButton>
            <SafeButton type="submit">Buat Proyek</SafeButton>
          </div>
        </form>
      </Modal>

      {/* Investasi Modal */}
      {showInvestasi && (
        <Modal show={true} onClose={() => setShowInvestasi(null)} title="Tambah Investasi" size="lg">
          <div className="space-y-4">
            {investasi.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Investasi Saat Ini</h4>
                {investasi.map((inv: any) => (
                  <div key={inv.id} className="flex justify-between p-3 rounded-lg bg-slate-50">
                    <span className="text-sm text-slate-700">{inv.shahibul_maal?.anggota?.nama || '-'}</span>
                    <span className="text-sm text-emerald-600 font-medium">Rp {Number(inv.jumlah_setor).toLocaleString()} ({inv.porsi_persen}%)</span>
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={handleInvestSubmit} className="space-y-3">
              <FormField label="Shahibul Maal">
                <FormSelect value={investForm.shahibul_maal_id} onChange={e => setInvestForm(f => ({...f, shahibul_maal_id: e.target.value}))} required>
                  <option value="">Pilih</option>
                  {data[0] && investasi.length > 0 && investasi.map((inv: any) => (
                    <option key={inv.shahibul_maal_id} value={inv.shahibul_maal_id}>{inv.shahibul_maal?.anggota?.nama}</option>
                  ))}
                </FormSelect>
              </FormField>
              <FormField label="Jumlah Setor (Rp)"><FormInput type="number" value={investForm.jumlah} onChange={e => setInvestForm(f => ({...f, jumlah: e.target.value}))} required /></FormField>
              <div className="flex gap-2 justify-end pt-2">
                <SafeButton type="button" variant="ghost" onClick={() => setShowInvestasi(null)}>Tutup</SafeButton>
                <SafeButton type="submit">Tambah Investasi</SafeButton>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  )
}
