'use client'

import { useState, useEffect } from 'react'
import { PageHeader, SafeButton, SectionCard, FormField, FormInput, FormSelect, StatusBadge, Modal } from '@/components/ui/NizamUI'
import { Plus, Users } from 'lucide-react'
import { getMudharib, createMudharib, getAnggota } from '@/modules/koperasi/actions/koperasi.actions'

export default function MudharibClient({ orgId }: { orgId: string }) {
  const [data, setData] = useState<any[]>([])
  const [anggota, setAnggota] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ anggota_id: '', keahlian: '', pengalaman: '' })

  useEffect(() => {
    getMudharib(orgId).then(d => setData(d))
    getAnggota(orgId).then(a => setAnggota(a.filter((x: any) => x.status === 'AKTIF')))
    setLoading(false)
  }, [orgId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await createMudharib(orgId, { anggota_id: form.anggota_id, keahlian: form.keahlian, pengalaman: form.pengalaman })
    setShowForm(false)
    setForm({ anggota_id: '', keahlian: '', pengalaman: '' })
    setData(await getMudharib(orgId))
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Mudharib" subtitle="Pengelola proyek / entrepreneur">
        <SafeButton onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Daftarkan Mudharib</SafeButton>
      </PageHeader>

      <SectionCard>
        {loading ? <div className="text-slate-500 p-4">Memuat...</div> : data.length === 0 ? (
          <div className="text-slate-500 p-8 text-center">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
            Belum ada Mudharib. Daftarkan anggota sebagai pengelola proyek.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.map((m: any) => (
              <div key={m.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-sm font-semibold text-slate-900">{m.anggota?.nama}</div>
                <div className="text-xs text-slate-400">Kode: {m.anggota?.kode_anggota}</div>
                <div className="text-xs text-slate-500 mt-1">Keahlian: {m.keahlian || '-'}</div>
                {m.sertifikat?.nomor_sertifikat && (
                  <div className="text-[10px] text-emerald-600 mt-1">✅ Tersertifikasi DPS</div>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <Modal show={showForm} onClose={() => setShowForm(false)} title="Daftarkan Mudharib">
        <form onSubmit={handleSubmit} className="space-y-3">
          <FormField label="Anggota">
            <FormSelect value={form.anggota_id} onChange={e => setForm(f => ({...f, anggota_id: e.target.value}))} required>
              <option value="">Pilih anggota</option>
              {anggota.map(a => <option key={a.id} value={a.id}>{a.nama}</option>)}
            </FormSelect>
          </FormField>
          <FormField label="Keahlian"><FormInput value={form.keahlian} onChange={e => setForm(f => ({...f, keahlian: e.target.value}))} placeholder="Misal: Kontraktor, IT, Kuliner" required /></FormField>
          <FormField label="Pengalaman"><FormInput value={form.pengalaman} onChange={e => setForm(f => ({...f, pengalaman: e.target.value}))} placeholder="Proyek yang pernah dikelola" /></FormField>
          <div className="flex gap-2 justify-end pt-2">
            <SafeButton type="button" variant="ghost" onClick={() => setShowForm(false)}>Batal</SafeButton>
            <SafeButton type="submit">Simpan</SafeButton>
          </div>
        </form>
      </Modal>
    </div>
  )
}
