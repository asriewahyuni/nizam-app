'use client'

import { useState, useEffect } from 'react'
import { PageHeader, SafeButton, SectionCard, FormField, FormInput, FormSelect, StatusBadge, Modal } from '@/components/ui/NizamUI'
import { Plus, Shield } from 'lucide-react'
import { getSertifikasiDps, terbitkanSertifikasi, getAnggota } from '@/modules/koperasi/actions/koperasi.actions'

export default function SertifikasiClient({ orgId }: { orgId: string }) {
  const [data, setData] = useState<any[]>([])
  const [anggota, setAnggota] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ entity_id: '', entity_type: 'ANGGOTA', tgl_expired: '' })

  useEffect(() => {
    getSertifikasiDps(orgId).then(d => setData(d))
    getAnggota(orgId).then(a => setAnggota(a.filter((x: any) => x.status === 'AKTIF')))
    setLoading(false)
  }, [orgId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await terbitkanSertifikasi(orgId, {
      entity_type: form.entity_type as 'ANGGOTA' | 'MUDHARIB',
      entity_id: form.entity_id,
      no_sertifikat: `DPS-${orgId.slice(0,4).toUpperCase()}-${Date.now()}`,
      tgl_terbit: new Date().toISOString().split('T')[0],
      tgl_expired: form.tgl_expired,
    })
    setShowForm(false)
    setForm({ entity_id: '', entity_type: 'ANGGOTA', tgl_expired: '' })
    setData(await getSertifikasiDps(orgId))
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Sertifikasi DPS" subtitle="Dewan Pengawas Syariah — CORE iSEC">
        <SafeButton onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Terbitkan Sertifikat</SafeButton>
      </PageHeader>

      <SectionCard>
        {loading ? <div className="text-slate-500 p-4">Memuat...</div> : data.length === 0 ? (
          <div className="text-slate-500 p-8 text-center">
            <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
            Belum ada sertifikasi DPS. Sertifikasi adalah syarat wajib menjadi Shahibul Maal atau Mudharib.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.map((s: any) => {
              const expired = s.masa_berlaku && new Date(s.masa_berlaku) < new Date()
              return (
                <div key={s.id} className={`p-4 rounded-xl border ${expired ? 'bg-red-900/10 border-red-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs text-slate-400 font-mono">{s.no_sertifikat || '-'}</span>
                    <StatusBadge label={s.entity_type} variant={s.entity_type === 'ANGGOTA' ? 'info' : 'success'} />
                  </div>
                  <div className="text-sm font-semibold text-slate-900">{s.entity_id ? 'Entity #' + s.entity_id.slice(0,8) : '-'}</div>
                  <div className="text-xs text-slate-500">Berlaku s/d: {s.tgl_expired ? new Date(s.tgl_expired).toLocaleDateString('id-ID') : '-'}</div>
                  {expired && <div className="text-[10px] text-red-400 mt-1">⚠️ Sertifikat expired</div>}
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>

      <Modal show={showForm} onClose={() => setShowForm(false)} title="Terbitkan Sertifikat DPS">
        <form onSubmit={handleSubmit} className="space-y-3">
          <FormField label="Anggota / Mudharib">
            <FormSelect value={form.entity_id} onChange={e => setForm(f => ({...f, entity_id: e.target.value}))} required>
              <option value="">Pilih</option>
              {anggota.map(a => <option key={a.id} value={a.id}>{a.nama}</option>)}
            </FormSelect>
          </FormField>
          <FormField label="Jenis Sertifikasi">
            <FormSelect value={form.entity_type} onChange={e => setForm(f => ({...f, entity_type: e.target.value}))}>
              <option value="ANGGOTA">Anggota (Shahibul Maal)</option>
              <option value="MUDHARIB">Mudharib</option>
            </FormSelect>
          </FormField>
          <FormField label="Masa Berlaku"><FormInput type="date" value={form.tgl_expired} onChange={e => setForm(f => ({...f, tgl_expired: e.target.value}))} required /></FormField>
          <div className="text-[10px] text-slate-400">Sertifikat akan terbit dengan nomor otomatis dan tanggal hari ini.</div>
          <div className="flex gap-2 justify-end pt-2">
            <SafeButton type="button" variant="ghost" onClick={() => setShowForm(false)}>Batal</SafeButton>
            <SafeButton type="submit">Terbitkan</SafeButton>
          </div>
        </form>
      </Modal>
    </div>
  )
}
