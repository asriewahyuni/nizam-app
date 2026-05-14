'use client'

import { useState, useEffect } from 'react'
import { PageHeader, SafeButton, SectionCard, FormField, FormInput, FormSelect, StatusBadge, Modal } from '@/components/ui/NizamUI'
import { Plus, Search } from 'lucide-react'
import { getAnggota, createAnggota, updateAnggota } from '@/modules/koperasi/actions/koperasi.actions'

export default function AnggotaPageClient({ orgId }: { orgId: string }) {
  const [anggota, setAnggota] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nama: '', nik: '', alamat: '', no_telepon: '', email: '', status: 'AKTIF' })
  const [editId, setEditId] = useState<string | null>(null)

  useEffect(() => {
    getAnggota(orgId).then(d => { setAnggota(d); setLoading(false) })
  }, [orgId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (editId) {
      await updateAnggota(editId, form)
    } else {
      await createAnggota(orgId, { ...form, kode_anggota: '' })
    }
    setShowForm(false)
    setEditId(null)
    setForm({ nama: '', nik: '', alamat: '', no_telepon: '', email: '', status: 'AKTIF' })
    const d = await getAnggota(orgId)
    setAnggota(d)
  }

  function edit(item: any) {
    setForm({ nama: item.nama, nik: item.nik || '', alamat: item.alamat || '', no_telepon: item.no_telepon || '', email: item.email || '', status: item.status })
    setEditId(item.id)
    setShowForm(true)
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Anggota Koperasi" subtitle="Data anggota dan status keanggotaan">
        <SafeButton onClick={() => { setShowForm(true); setEditId(null); setForm({ nama: '', nik: '', alamat: '', no_telepon: '', email: '', status: 'AKTIF' }) }}>
          <Plus className="w-4 h-4" /> Tambah Anggota
        </SafeButton>
      </PageHeader>

      <SectionCard>
        {loading ? <div className="text-white/50 p-4">Memuat...</div> : anggota.length === 0 ? (
          <div className="text-white/50 p-8 text-center">Belum ada anggota. Klik "Tambah Anggota" untuk memulai.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-white/40 border-b border-white/10">
                <th className="p-2 text-left">Kode</th><th className="p-2 text-left">Nama</th><th className="p-2 text-left">NIK</th>
                <th className="p-2 text-left">Telepon</th><th className="p-2 text-left">Status</th><th className="p-2 text-left">DPS</th><th className="p-2"></th>
              </tr></thead>
              <tbody>
                {anggota.map((a: any) => (
                  <tr key={a.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-2 text-white/60">{a.kode_anggota}</td>
                    <td className="p-2 text-white font-medium">{a.nama}</td>
                    <td className="p-2 text-white/60">{a.nik || '-'}</td>
                    <td className="p-2 text-white/60">{a.no_telepon || '-'}</td>
                    <td className="p-2"><StatusBadge status={a.status} variant={a.status === 'AKTIF' ? 'success' : 'warning'} /></td>
                    <td className="p-2">{a.is_tersertifikasi_dps ? <StatusBadge status="Terdaftar" variant="success" /> : '-'}</td>
                    <td className="p-2"><button onClick={() => edit(a)} className="text-xs text-emerald-400 hover:text-emerald-300">Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Modal show={showForm} onClose={() => setShowForm(false)} title={editId ? 'Edit Anggota' : 'Tambah Anggota'}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <FormField label="Nama"><FormInput value={form.nama} onChange={e => setForm(f => ({...f, nama: e.target.value}))} required /></FormField>
          <FormField label="NIK"><FormInput value={form.nik} onChange={e => setForm(f => ({...f, nik: e.target.value}))} /></FormField>
          <FormField label="No. Telepon"><FormInput value={form.no_telepon} onChange={e => setForm(f => ({...f, no_telepon: e.target.value}))} /></FormField>
          <FormField label="Email"><FormInput type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} /></FormField>
          <FormField label="Alamat"><FormInput value={form.alamat} onChange={e => setForm(f => ({...f, alamat: e.target.value}))} /></FormField>
          {editId && <FormField label="Status">
            <FormSelect value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}>
              <option value="AKTIF">AKTIF</option><option value="NONAKTIF">NONAKTIF</option>
              <option value="KELUAR">KELUAR</option><option value="MENINGGAL">MENINGGAL</option>
            </FormSelect>
          </FormField>}
          <div className="flex gap-2 justify-end pt-2">
            <SafeButton type="button" variant="ghost" onClick={() => setShowForm(false)}>Batal</SafeButton>
            <SafeButton type="submit">{editId ? 'Simpan' : 'Simpan'}</SafeButton>
          </div>
        </form>
      </Modal>
    </div>
  )
}
