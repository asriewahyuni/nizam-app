'use client'

import { useState, useEffect } from 'react'
import { PageHeader, SafeButton, SectionCard, FormField, FormSelect, Modal } from '@/components/ui/NizamUI'
import { Plus, Users } from 'lucide-react'

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

export default function ShahibulMaalClient() {
  const [data, setData] = useState<any[]>([])
  const [anggota, setAnggota] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedAnggota, setSelectedAnggota] = useState('')
  const [orgId, setOrgId] = useState<string | null>(null)

  useEffect(() => {
    api('getActiveOrgId', []).then((id) => {
      setOrgId(id)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!orgId) return
    Promise.all([
      api('getShahibulMaal', [orgId]),
      api('getAnggota', [orgId]),
    ]).then(([d, a]) => {
      setData(d)
      setAnggota(a.filter((x: any) => x.status === 'AKTIF' && x.is_tersertifikasi_dps))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [orgId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!orgId) return
    await api('daftarkanShahibulMaal', [orgId, selectedAnggota])
    setShowForm(false)
    setSelectedAnggota('')
    setData(await api('getShahibulMaal', [orgId]))
  }

  if (!orgId && loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Shahibul Maal" subtitle="Investor / penyedia modal terdaftar" />
        <SectionCard><div className="text-slate-500 p-4">Memuat...</div></SectionCard>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Shahibul Maal" subtitle="Investor / penyedia modal terdaftar" actions={
        <SafeButton onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Daftarkan Shahibul Maal</SafeButton>
      } />

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
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Pilih Anggota (tersertifikasi DPS)" required>
            <FormSelect value={selectedAnggota} onChange={e => setSelectedAnggota(e.target.value)} required>
              <option value="">-- Pilih --</option>
              {anggota.map((a: any) => (
                <option key={a.id} value={a.id}>{a.nama} ({a.kode_anggota})</option>
              ))}
            </FormSelect>
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <SafeButton type="button" variant="secondary" onClick={() => setShowForm(false)}>Batal</SafeButton>
            <SafeButton type="submit" disabled={!selectedAnggota}>Daftarkan</SafeButton>
          </div>
        </form>
      </Modal>
    </div>
  )
}
