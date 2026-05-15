'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageHeader, SafeButton, SectionCard, FormField, FormInput, FormSelect, StatusBadge, Modal } from '@/components/ui/NizamUI'
import { Plus } from 'lucide-react'

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

export default function AnggotaPageClient({ orgId }: { orgId: string }) {
  const [anggota, setAnggota] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nama: '', nik: '', alamat: '', no_telepon: '', email: '', status: 'AKTIF' })
  const [editId, setEditId] = useState<string | null>(null)

  const loadAnggota = useCallback(async () => {
    try {
      const d = await api('getAnggota', [orgId])
      setAnggota(d)
      setLoading(false)
    } catch (e: any) {
      setError(e.message)
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { loadAnggota() }, [loadAnggota])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (editId) {
        await api('updateAnggota', [editId, form])
      } else {
        await api('createAnggota', [orgId, { ...form, kode_anggota: '' }])
      }
      setShowForm(false)
      setEditId(null)
      setForm({ nama: '', nik: '', alamat: '', no_telepon: '', email: '', status: 'AKTIF' })
      setLoading(true)
      await loadAnggota()
    } catch (e: any) { setError(e.message) }
  }

  function edit(item: any) {
    setForm({ nama: item.nama, nik: item.nik || '', alamat: item.alamat || '', no_telepon: item.no_telepon || '', email: item.email || '', status: item.status })
    setEditId(item.id)
    setShowForm(true)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Anggota Koperasi"
        subtitle="Data anggota dan status keanggotaan"
        actions={
          <SafeButton type="button" onClick={() => { setShowForm(true); setEditId(null); setForm({ nama: '', nik: '', alamat: '', no_telepon: '', email: '', status: 'AKTIF' }) }}>
            <Plus className="w-4 h-4" /> Tambah Anggota
          </SafeButton>
        }
      />

      <SectionCard>
        {error && <div className="text-red-600 p-4 bg-red-50 rounded-lg mb-4 border border-red-200">{error}</div>}
        {loading ? <div className="text-slate-500 p-4">Memuat...</div> : anggota.length === 0 ? (
          <div className="text-slate-500 p-8 text-center">Belum ada anggota. Klik "Tambah Anggota" untuk memulai.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-200">
                  <th className="p-2 text-left">Kode</th>
                  <th className="p-2 text-left">Nama</th>
                  <th className="p-2 text-left">NIK</th>
                  <th className="p-2 text-left">Telepon</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">DPS</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {anggota.map((a: any) => (
                  <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-2 font-mono text-xs">{a.kode_anggota}</td>
                    <td className="p-2 font-medium">{a.nama}</td>
                    <td className="p-2 text-slate-500">{a.nik || '-'}</td>
                    <td className="p-2 text-slate-500">{a.no_telepon || '-'}</td>
                    <td className="p-2"><StatusBadge label={a.status} variant={a.status === 'AKTIF' ? 'success' : 'neutral'} /></td>
                    <td className="p-2">{a.is_tersertifikasi_dps ? <span className="text-emerald-600 font-medium">✓</span> : '-'}</td>
                    <td className="p-2">
                      <SafeButton variant="ghost" onClick={() => edit(a)}>Edit</SafeButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Modal show={showForm} onClose={() => setShowForm(false)} title={editId ? 'Edit Anggota' : 'Tambah Anggota'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Nama Lengkap" required>
            <FormInput value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} placeholder="Nama lengkap anggota" required />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="NIK">
              <FormInput value={form.nik} onChange={e => setForm({ ...form, nik: e.target.value })} placeholder="16 digit NIK" />
            </FormField>
            <FormField label="No. Telepon">
              <FormInput value={form.no_telepon} onChange={e => setForm({ ...form, no_telepon: e.target.value })} placeholder="Contoh: 08123456789" />
            </FormField>
          </div>
          <FormField label="Email">
            <FormInput type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
          </FormField>
          <FormField label="Alamat">
            <FormInput value={form.alamat} onChange={e => setForm({ ...form, alamat: e.target.value })} placeholder="Alamat lengkap" />
          </FormField>
          <FormField label="Status">
            <FormSelect value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="AKTIF">Aktif</option>
              <option value="NONAKTIF">Nonaktif</option>
              <option value="KELUAR">Keluar</option>
            </FormSelect>
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <SafeButton variant="ghost" type="button" onClick={() => setShowForm(false)}>Batal</SafeButton>
            <SafeButton type="submit">{editId ? 'Simpan' : 'Tambah Anggota'}</SafeButton>
          </div>
        </form>
      </Modal>
    </div>
  )
}
