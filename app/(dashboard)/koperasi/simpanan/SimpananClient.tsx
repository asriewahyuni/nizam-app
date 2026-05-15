'use client'

import { useState, useEffect } from 'react'
import { PageHeader, SafeButton, SectionCard, FormField, FormSelect, FormInput, Modal, StatusBadge } from '@/components/ui/NizamUI'
import { Plus, Wallet, Banknote, Save } from 'lucide-react'
import { getSimpananPokok, getSimpananWajib, getSimpananSukarela, bayarSimpananPokok, bayarSimpananWajib, transaksiSimpananSukarela, getAnggota } from '@/modules/koperasi/actions/koperasi.actions'

type TabType = 'pokok' | 'wajib' | 'sukarela'

export default function SimpananClient({ orgId }: { orgId: string }) {
  const [tab, setTab] = useState<TabType>('pokok')
  const [data, setData] = useState<any[]>([])
  const [anggota, setAnggota] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ anggota_id: '', jumlah: '', tgl_bayar: new Date().toISOString().split('T')[0], keterangan: '', periode_bulan: '', jenis: 'SETOR' as 'SETOR'|'TARIK' })

  const tabs: { key: TabType; label: string; icon: any }[] = [
    { key: 'pokok', label: 'Simpanan Pokok', icon: Save },
    { key: 'wajib', label: 'Simpanan Wajib', icon: Banknote },
    { key: 'sukarela', label: 'Simpanan Sukarela', icon: Wallet },
  ]

  useEffect(() => {
    loadData()
    getAnggota(orgId).then(setAnggota)
  }, [tab])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      let d: any[]
      if (tab === 'pokok') d = await getSimpananPokok(orgId)
      else if (tab === 'wajib') d = await getSimpananWajib(orgId)
      else d = await getSimpananSukarela(orgId)
      setData(d)
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = { anggota_id: form.anggota_id, jumlah: Number(form.jumlah), tgl_bayar: form.tgl_bayar, keterangan: form.keterangan }
    if (tab === 'pokok') await bayarSimpananPokok(orgId, payload)
    else if (tab === 'wajib') await bayarSimpananWajib(orgId, { ...payload, periode_bulan: form.periode_bulan })
    else await transaksiSimpananSukarela(orgId, { ...payload, jenis: form.jenis })
    setShowForm(false)
    setForm({ anggota_id: '', jumlah: '', tgl_bayar: new Date().toISOString().split('T')[0], keterangan: '', periode_bulan: '', jenis: 'SETOR' })
    loadData()
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Simpanan" subtitle="Pokok, Wajib, Sukarela (Wadiah)">
        <SafeButton onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Tambah Transaksi</SafeButton>
      </PageHeader>

      <div className="flex gap-2">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${tab === t.key ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      <SectionCard>
        {error && <div className="text-red-600 p-4 bg-red-50 rounded-lg mb-4 border border-red-200">{error}</div>}
        {loading ? <div className="text-slate-500 p-4">Memuat...</div> : data.length === 0 ? (
          <div className="text-slate-500 p-8 text-center">Belum ada data simpanan {tab}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-slate-400 border-b border-slate-200">
                <th className="p-2 text-left">Anggota</th><th className="p-2 text-left">Jumlah</th>
                <th className="p-2 text-left">Tanggal</th>
                {tab === 'wajib' && <th className="p-2 text-left">Periode</th>}
                {tab === 'sukarela' && <th className="p-2 text-left">Jenis</th>}
                <th className="p-2 text-left">Keterangan</th>
              </tr></thead>
              <tbody>
                {data.map((d: any) => (
                  <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-2 text-slate-700">{d.anggota?.nama || '-'}</td>
                    <td className="p-2 text-slate-900 font-medium">Rp {Number(d.jumlah).toLocaleString()}</td>
                    <td className="p-2 text-slate-500">{d.tgl_bayar || d.tgl_transaksi}</td>
                    {tab === 'wajib' && <td className="p-2 text-slate-500">{d.periode_bulan}</td>}
                    {tab === 'sukarela' && <td className="p-2"><StatusBadge label={d.jenis} variant={d.jenis === 'SETOR' ? 'success' : 'warning'} /></td>}
                    <td className="p-2 text-slate-400">{d.keterangan || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Modal show={showForm} onClose={() => setShowForm(false)} title="Tambah Transaksi Simpanan">
        <form onSubmit={handleSubmit} className="space-y-3">
          <FormField label="Anggota">
            <FormSelect value={form.anggota_id} onChange={e => setForm(f => ({...f, anggota_id: e.target.value}))} required>
              <option value="">Pilih Anggota</option>
              {anggota.filter((a: any) => a.status === 'AKTIF').map((a: any) => (
                <option key={a.id} value={a.id}>{a.kode_anggota} — {a.nama}</option>
              ))}
            </FormSelect>
          </FormField>
          <FormField label="Jumlah"><FormInput type="number" value={form.jumlah} onChange={e => setForm(f => ({...f, jumlah: e.target.value}))} required /></FormField>
          <FormField label="Tanggal"><FormInput type="date" value={form.tgl_bayar} onChange={e => setForm(f => ({...f, tgl_bayar: e.target.value}))} /></FormField>
          {tab === 'wajib' && <FormField label="Periode (Bulan)"><FormInput type="month" value={form.periode_bulan} onChange={e => setForm(f => ({...f, periode_bulan: e.target.value}))} required /></FormField>}
          {tab === 'sukarela' && <FormField label="Jenis">
            <FormSelect value={form.jenis} onChange={e => setForm(f => ({...f, jenis: e.target.value as any}))}>
              <option value="SETOR">Setor</option><option value="TARIK">Tarik</option>
            </FormSelect>
          </FormField>}
          <FormField label="Keterangan"><FormInput value={form.keterangan} onChange={e => setForm(f => ({...f, keterangan: e.target.value}))} /></FormField>
          <div className="flex gap-2 justify-end pt-2">
            <SafeButton type="button" variant="ghost" onClick={() => setShowForm(false)}>Batal</SafeButton>
            <SafeButton type="submit">Simpan</SafeButton>
          </div>
        </form>
      </Modal>
    </div>
  )
}
