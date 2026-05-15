'use client'

import { useState, useEffect } from 'react'
import { PageHeader, SafeButton, SectionCard, FormField, FormSelect, StatusBadge, Modal } from '@/components/ui/NizamUI'
import { Plus, UserCog } from 'lucide-react'
import { getPengurus, tetapkanPengurus, getAnggota } from '@/lib/koperasi/client'

const JABATAN = [
  { value: 'KETUA', label: 'Ketua' },
  { value: 'SEKRETARIS', label: 'Sekretaris' },
  { value: 'BENDAHARA', label: 'Bendahara' },
  { value: 'DPS', label: 'DPS (Dewan Pengawas Syariah)' },
  { value: 'ADMIN', label: 'Admin' },
]

export default function PengurusClient({ orgId }: { orgId: string }) {
  const [data, setData] = useState<any[]>([])
  const [anggota, setAnggota] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ anggota_id: '', jabatan: 'ADMIN' })

  useEffect(() => {
    getPengurus(orgId).then(d => setData(d))
    getAnggota(orgId).then(a => setAnggota(a.filter((x: any) => x.status === 'AKTIF')))
    setLoading(false)
  }, [orgId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await tetapkanPengurus(orgId, { anggota_id: form.anggota_id, jabatan: form.jabatan, masa_bakti_awal: new Date().toISOString().split('T')[0] })
    setShowForm(false)
    setForm({ anggota_id: '', jabatan: 'ADMIN' })
    setData(await getPengurus(orgId))
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Pengurus Koperasi" subtitle="Struktur organisasi koperasi">
        <SafeButton onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Tambah Pengurus</SafeButton>
      </PageHeader>

      <SectionCard>
        {loading ? <div className="text-slate-500 p-4">Memuat...</div> : data.length === 0 ? (
          <div className="text-slate-500 p-8 text-center">
            <UserCog className="w-8 h-8 mx-auto mb-2 opacity-30" />
            Belum ada pengurus. Tetapkan Ketua, Sekretaris, Bendahara, DPS, atau Admin.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.map((p: any) => (
              <div key={p.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <StatusBadge label={JABATAN.find(j => j.value === p.jabatan)?.label || p.jabatan} variant={p.jabatan === 'KETUA' ? 'success' : 'info'} />
                <div className="text-sm font-semibold text-slate-900 mt-2">{p.anggota?.nama}</div>
                <div className="text-xs text-slate-400">Kode: {p.anggota?.kode_anggota}</div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <Modal show={showForm} onClose={() => setShowForm(false)} title="Tambah Pengurus">
        <form onSubmit={handleSubmit} className="space-y-3">
          <FormField label="Anggota">
            <FormSelect value={form.anggota_id} onChange={e => setForm(f => ({...f, anggota_id: e.target.value}))} required>
              <option value="">Pilih anggota</option>
              {anggota.map(a => <option key={a.id} value={a.id}>{a.nama}</option>)}
            </FormSelect>
          </FormField>
          <FormField label="Jabatan">
            <FormSelect value={form.jabatan} onChange={e => setForm(f => ({...f, jabatan: e.target.value}))} required>
              {JABATAN.map(j => <option key={j.value} value={j.value}>{j.label}</option>)}
            </FormSelect>
          </FormField>
          <div className="flex gap-2 justify-end pt-2">
            <SafeButton type="button" variant="ghost" onClick={() => setShowForm(false)}>Batal</SafeButton>
            <SafeButton type="submit">Simpan</SafeButton>
          </div>
        </form>
      </Modal>
    </div>
  )
}
