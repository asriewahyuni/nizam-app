'use client'

import { useState, useEffect } from 'react'
import { PageHeader, SafeButton, SectionCard, FormField, FormInput, FormSelect, StatusBadge, Modal } from '@/components/ui/NizamUI'
import { Plus, FileText, Printer } from 'lucide-react'
import { getAkadWakalah, createAkadWakalah, getShahibulMaal } from '@/modules/koperasi/actions/koperasi.actions'

export default function AkadWakalahClient({ orgId }: { orgId: string }) {
  const [data, setData] = useState<any[]>([])
  const [shahibulMaalList, setShahibulMaalList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ shahibul_maal_id: '', jenis_barang: '', ujrah_flat: '', tgl_akad: new Date().toISOString().split('T')[0] })

  useEffect(() => {
    getAkadWakalah(orgId).then(d => setData(d))
    getShahibulMaal(orgId).then(sm => setShahibulMaalList(sm))
    setLoading(false)
  }, [orgId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await createAkadWakalah(orgId, {
      shahibul_maal_id: form.shahibul_maal_id,
      jenis_barang: form.jenis_barang,
      ujrah_flat: Number(form.ujrah_flat),
      tgl_akad: form.tgl_akad,
    })
    setShowForm(false)
    setForm({ shahibul_maal_id: '', jenis_barang: '', ujrah_flat: '', tgl_akad: new Date().toISOString().split('T')[0] })
    setData(await getAkadWakalah(orgId))
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Akad Wakalah" subtitle="Perjanjian perwakilan jual beli barang" actions={
        <SafeButton onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Buat Akad</SafeButton>
      } />

      <SectionCard>
        {loading ? <div className="text-slate-500 p-4">Memuat...</div> : data.length === 0 ? (
          <div className="text-slate-500 p-8 text-center">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
            Belum ada akad wakalah.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.map((a: any) => (
              <div key={a.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs text-slate-400 font-mono">{a.nomor_akad || '-'}</span>
                  <StatusBadge label={a.status || 'AKTIF'} variant="info" />
                </div>
                <div className="text-sm font-semibold text-slate-900">{a.shahibul_maal?.anggota?.nama}</div>
                <div className="text-xs text-slate-500">Barang: {a.jenis_barang}</div>
                <div className="text-xs text-emerald-600">Ujrah: Rp {Number(a.ujrah_flat).toLocaleString()}</div>
                <div className="text-xs text-slate-400">Tanggal: {new Date(a.tgl_akad).toLocaleDateString('id-ID')}</div>
                <button
                  onClick={() => window.open('/api/koperasi/akad-wakalah/' + a.id + '/pdf', '_blank')}
                  className="mt-2 flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300"
                >
                  <Printer className="w-3 h-3" /> Cetak Akad
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <Modal show={showForm} onClose={() => setShowForm(false)} title="Buat Akad Wakalah">
        <form onSubmit={handleSubmit} className="space-y-3">
          <FormField label="Shahibul Maal (Penyedia Barang)">
            <FormSelect value={form.shahibul_maal_id} onChange={e => setForm(f => ({...f, shahibul_maal_id: e.target.value}))} required>
              <option value="">Pilih Shahibul Maal</option>
              {shahibulMaalList.map((sm: any) => <option key={sm.id} value={sm.id}>{sm.anggota?.nama}</option>)}
            </FormSelect>
          </FormField>
          <FormField label="Jenis Barang"><FormInput value={form.jenis_barang} onChange={e => setForm(f => ({...f, jenis_barang: e.target.value}))} required /></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Ujrah (Fee)"><FormInput type="number" value={form.ujrah_flat} onChange={e => setForm(f => ({...f, ujrah_flat: e.target.value}))} required /></FormField>
            <FormField label="Tanggal Akad"><FormInput type="date" value={form.tgl_akad} onChange={e => setForm(f => ({...f, tgl_akad: e.target.value}))} required /></FormField>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <SafeButton type="button" variant="ghost" onClick={() => setShowForm(false)}>Batal</SafeButton>
            <SafeButton type="submit">Simpan Akad</SafeButton>
          </div>
        </form>
      </Modal>
    </div>
  )
}
