'use client'

import { useState, useEffect } from 'react'
import { PageHeader, SafeButton, SectionCard, FormField, FormInput, FormSelect, StatusBadge, Modal } from '@/components/ui/NizamUI'
import { Plus, ShoppingCart, Printer } from 'lucide-react'

const BASE = '/api/koperasi/action'

async function api(action: string, params: any[] = []) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, params }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Request failed')
  }
  const { data } = await res.json()
  return data
}

export default function MurabahahClient({ orgId }: { orgId: string }) {
  const [data, setData] = useState<any[]>([])
  const [akad, setAkad] = useState<any[]>([])
  const [anggota, setAnggota] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    akad_wakalah_id: '', pembeli_id: '', nama_barang: '',
    harga_pokok: '', margin: '', tenor_bulan: '12',
  })

  useEffect(() => {
    Promise.all([
      api('getMurabahahTransaksi', [orgId]),
      api('getAkadWakalah', [orgId]),
      api('getAnggota', [orgId]),
    ]).then(([d, a, ag]) => {
      setData(d)
      setAkad(a.filter((x: any) => x.status === 'AKTIF'))
      setAnggota(ag.filter((x: any) => x.status === 'AKTIF'))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [orgId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await api('createMurabahahTransaksi', [orgId, {
      akad_wakalah_id: form.akad_wakalah_id,
      pembeli_id: form.pembeli_id,
      nama_barang: form.nama_barang,
      harga_pokok: Number(form.harga_pokok),
      margin: Number(form.margin),
      tenor_bulan: Number(form.tenor_bulan),
    }])
    setShowForm(false)
    setForm({ akad_wakalah_id: '', pembeli_id: '', nama_barang: '', harga_pokok: '', margin: '', tenor_bulan: '12' })
    setData(await api('getMurabahahTransaksi', [orgId]))
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Transaksi Murabahah" subtitle="Jual beli dengan margin + angsuran" actions={
        <SafeButton onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Transaksi Baru</SafeButton>
      } />

      <SectionCard>
        {loading ? <div className="text-slate-500 p-4">Memuat...</div> : data.length === 0 ? (
          <div className="text-slate-500 p-8 text-center">
            <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
            Belum ada transaksi murabahah.
          </div>
        ) : (
          <div className="space-y-2">
            {data.map((t: any) => {
              const totalBayar = Number(t.total_angsuran || 0)
              const totalTagihan = Number(t.harga_jual)
              const progress = totalTagihan > 0 ? Math.min(100, (totalBayar / totalTagihan) * 100) : 0
              return (
                <div key={t.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-sm font-medium text-slate-900">{t.pembeli?.nama || '-'}</span>
                      <span className="ml-2 text-xs text-slate-400">{t.nomor_transaksi}</span>
                    </div>
                    <StatusBadge label={t.status || 'AKTIF'} variant="success" />
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div><span className="text-slate-400">Barang:</span> <span className="text-slate-900">{t.nama_barang}</span></div>
                    <div><span className="text-slate-400">Harga Pokok:</span> <span className="text-slate-900">Rp {Number(t.harga_pokok).toLocaleString()}</span></div>
                    <div><span className="text-slate-400">Margin:</span> <span className="text-amber-400">Rp {Number(t.margin).toLocaleString()}</span></div>
                    <div><span className="text-slate-400">Tenor:</span> <span className="text-slate-900">{t.tenor_bulan} bln</span></div>
                  </div>
                  <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>Progress: {progress.toFixed(0)}%</span>
                    <span>Rp {totalBayar.toLocaleString()} / Rp {totalTagihan.toLocaleString()}</span>
                  </div>
                  <button
                    onClick={() => window.open('/api/koperasi/murabahah/' + t.id + '/pdf', '_blank')}
                    className="mt-2 flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300"
                  >
                    <Printer className="w-3 h-3" /> Cetak Akad
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>

      <Modal show={showForm} onClose={() => setShowForm(false)} title="Transaksi Murabahah Baru" size="lg">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Akad Wakalah">
              <FormSelect value={form.akad_wakalah_id} onChange={e => setForm(f => ({...f, akad_wakalah_id: e.target.value}))} required>
                <option value="">Pilih akad</option>
                {akad.map((a: any) => <option key={a.id} value={a.id}>{a.nomor_akad} - {a.jenis_barang} - {a.shahibul_maal?.anggota?.nama}</option>)}
              </FormSelect>
            </FormField>
            <FormField label="Pembeli">
              <FormSelect value={form.pembeli_id} onChange={e => setForm(f => ({...f, pembeli_id: e.target.value}))} required>
                <option value="">Pilih anggota</option>
                {anggota.map(a => <option key={a.id} value={a.id}>{a.nama}</option>)}
              </FormSelect>
            </FormField>
          </div>
          <FormField label="Nama Barang"><FormInput value={form.nama_barang} onChange={e => setForm(f => ({...f, nama_barang: e.target.value}))} required /></FormField>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Harga Pokok (Rp)"><FormInput type="number" value={form.harga_pokok} onChange={e => setForm(f => ({...f, harga_pokok: e.target.value}))} required /></FormField>
            <FormField label="Margin (Rp)"><FormInput type="number" value={form.margin} onChange={e => setForm(f => ({...f, margin: e.target.value}))} required /></FormField>
            <FormField label="Tenor (bulan)">
              <FormSelect value={form.tenor_bulan} onChange={e => setForm(f => ({...f, tenor_bulan: e.target.value}))}>
                {[3,6,12,18,24,36,48,60].map(t => <option key={t} value={t}>{t} bulan</option>)}
              </FormSelect>
            </FormField>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 text-xs">
            <span className="text-slate-500">Harga Jual = </span>
            <span className="text-slate-900 font-medium">Rp {(Number(form.harga_pokok || 0) + Number(form.margin || 0)).toLocaleString()}</span>
            <span className="text-slate-500 ml-2">| Angsuran/bln ≈ </span>
            <span className="text-emerald-600 font-medium">Rp {Math.ceil((Number(form.harga_pokok || 0) + Number(form.margin || 0)) / Math.max(1, Number(form.tenor_bulan || 1))).toLocaleString()}</span>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <SafeButton type="button" variant="ghost" onClick={() => setShowForm(false)}>Batal</SafeButton>
            <SafeButton type="submit">Buat Transaksi</SafeButton>
          </div>
        </form>
      </Modal>
    </div>
  )
}
