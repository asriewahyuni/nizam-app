'use client'

import { useState, useEffect } from 'react'
import { PageHeader, SafeButton, SectionCard, FormField, FormSelect, Modal } from '@/components/ui/NizamUI'
import { Plus, Users } from 'lucide-react'
import { getShahibulMaal, daftarkanShahibulMaal, getAnggota } from '@/lib/koperasi/client'

export default function SimpleListPage({ orgId, type = 'shahibul-maal' }: { orgId: string; type?: string }) {
  const [data, setData] = useState<any[]>([])
  const [anggota, setAnggota] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedAnggota, setSelectedAnggota] = useState('')

  useEffect(() => {
    getShahibulMaal(orgId).then(d => setData(d))
    getAnggota(orgId).then(a => setAnggota(a.filter((x: any) => x.status === 'AKTIF' && x.is_tersertifikasi_dps)))
    setLoading(false)
  }, [orgId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await daftarkanShahibulMaal(orgId, selectedAnggota)
    setShowForm(false)
    setSelectedAnggota('')
    const d = await getShahibulMaal(orgId)
    setData(d)
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Shahibul Maal" subtitle="Investor / penyedia modal terdaftar">
        <SafeButton onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Daftarkan Shahibul Maal</SafeButton>
      </PageHeader>

      <SectionCard>
        {loading ? <div className="text-slate-500 p-4">Memuat...</div> : data.length === 0 ? (
          <div className="text-slate-500 p-8 text-center">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
            Belum ada Shahibul Maal. Daftarkan anggota yang sudah tersertifikasi DPS.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.map((sm: any) => (
              <div key={sm.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-sm font-semibold text-slate-900">{sm.anggota?.nama}</div>
                <div className="text-xs text-slate-400">Kode: {sm.anggota?.kode_anggota}</div>
                <div className="text-xs text-slate-400 mt-1">Total Investasi: <span className="text-emerald-600">Rp {Number(sm.total_investasi || 0).toLocaleString()}</span></div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <Modal show={showForm} onClose={() => setShowForm(false)} title="Daftarkan Shahibul Maal">
        <form onSubmit={handleSubmit} className="space-y-3">
          <FormField label="Anggota (wajib sudah sertifikasi DPS)">
            <FormSelect value={selectedAnggota} onChange={e => setSelectedAnggota(e.target.value)} required>
              <option value="">Pilih Anggota</option>
              {anggota.map((a: any) => (
                <option key={a.id} value={a.id}>{a.kode_anggota} — {a.nama}</option>
              ))}
            </FormSelect>
          </FormField>
          <div className="flex gap-2 justify-end pt-2">
            <SafeButton type="button" variant="ghost" onClick={() => setShowForm(false)}>Batal</SafeButton>
            <SafeButton type="submit">Daftarkan</SafeButton>
          </div>
        </form>
      </Modal>
    </div>
  )
}
