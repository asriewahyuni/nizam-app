'use client'

import React, { useState } from 'react'
import { ArrowLeft, Save, Plus, QrCode, Trash2, Edit2, Handshake } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { formatRupiah } from '@/lib/utils'
import { upsertSyirkahContract, upsertSyirkahMember, deleteSyirkahMember } from '@/modules/syirkah/actions/syirkah.actions'

export default function SyirkahDetailClient({ orgId, contract, members, netProfit }: any) {
  const router = useRouter()
  const [isEditingContract, setIsEditingContract] = useState(false)
  const [contractData, setContractData] = useState({
    title: contract.title || '',
    description: contract.description || '',
    contract_type: contract.contract_type || 'Syirkah Mudharabah',
    debt_allocation: contract.debt_allocation || 0,
    current_debt: contract.current_debt || 0,
    status: contract.status || 'DRAFT'
  })

  const SYIRKAH_TYPES = ['Abdan', 'Syirkah Inan', 'Syirkah Mudharabah', 'Syirkah Wujuh', 'Syirkah Muwafadhah']

  const [isSavingContract, setIsSavingContract] = useState(false)
  const [showQR, setShowQR] = useState(false)

  // Member form state
  const [isMemberFormOpen, setIsMemberFormOpen] = useState(false)
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [memberForm, setMemberForm] = useState<{
    member_name: string
    role: 'PEMODAL' | 'PENGELOLA'
    responsibility: string
    profit_share_percentage: number
    capital_contribution: number
  }>({
    member_name: '',
    role: 'PENGELOLA',
    responsibility: '',
    profit_share_percentage: 0,
    capital_contribution: 0
  })

  const handleSaveContract = async () => {
    setIsSavingContract(true)
    try {
      await upsertSyirkahContract(orgId, {
        id: contract.id,
        ...contractData
      })
      setIsEditingContract(false)
    } catch (e) {
      alert('Gagal update kontrak')
    } finally {
      setIsSavingContract(false)
    }
  }

  const openNewMemberForm = () => {
    setMemberForm({
      member_name: '',
      role: 'PENGELOLA',
      responsibility: '',
      profit_share_percentage: 0,
      capital_contribution: 0
    })
    setEditingMemberId(null)
    setIsMemberFormOpen(true)
  }

  const editMember = (m: any) => {
    setMemberForm({
      member_name: m.member_name,
      role: m.role,
      responsibility: m.responsibility || '',
      profit_share_percentage: m.profit_share_percentage || 0,
      capital_contribution: m.capital_contribution || 0
    })
    setEditingMemberId(m.id)
    setIsMemberFormOpen(true)
  }

  const handleSaveMember = async () => {
    if (!memberForm.member_name) return alert('Nama wajib diisi')
    try {
      await upsertSyirkahMember(contract.id, {
        id: editingMemberId || undefined,
        ...memberForm
      })
      setIsMemberFormOpen(false)
      window.location.reload()
    } catch (e) {
      alert('Gagal save member')
    }
  }

  const handleDeleteMember = async (id: string) => {
    if (!confirm('Yakin hapus?')) return
    try {
      await deleteSyirkahMember(id, contract.id)
      window.location.reload()
    } catch (e) {
      alert('Gagal hapus')
    }
  }

  const pemodalList = members.filter((m: any) => m.role === 'PEMODAL')
  const pengelolaList = members.filter((m: any) => m.role === 'PENGELOLA')
  
  const qrUrl = typeof window !== 'undefined' ? `${window.location.origin}/syirkah-doc/${contract.qr_token}` : ''

  return (
    <div className="flex flex-col gap-6 relative">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/syirkah" className="p-2 bg-white rounded-xl shadow-sm hover:text-blue-600 transition">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-slate-900 border-b-4 border-blue-600 inline-block pb-1">
              {contract.title}
            </h1>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowQR(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold shadow hover:bg-slate-800 transition"
          >
            <QrCode size={18} /> Dokumen & QR Sign
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CONTRACT DETAIL CARD */}
        <div className="col-span-1 flex flex-col gap-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800">Detail Akad</h3>
              {!isEditingContract ? (
                <button onClick={() => setIsEditingContract(true)} className="text-blue-600 p-1 hover:bg-blue-50 rounded text-sm font-bold aspect-square">
                  <Edit2 size={16} />
                </button>
              ) : (
                <button onClick={handleSaveContract} disabled={isSavingContract} className="text-emerald-600 p-1 hover:bg-emerald-50 rounded text-sm font-bold flex gap-1 items-center">
                  <Save size={16} /> {isSavingContract ? '...' : 'Simpan'}
                </button>
              )}
            </div>

            {isEditingContract ? (
              <div className="space-y-4 text-sm">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Judul Akad</label>
                  <input type="text" className="w-full border rounded-xl p-2" value={contractData.title} onChange={e => setContractData({...contractData, title: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Jenis Syirkah</label>
                  <select className="w-full border rounded-xl p-2 font-semibold text-indigo-800 bg-indigo-50" value={contractData.contract_type} onChange={e => setContractData({...contractData, contract_type: e.target.value})}>
                    {SYIRKAH_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Status</label>
                  <select className="w-full border rounded-xl p-2" value={contractData.status} onChange={e => setContractData({...contractData, status: e.target.value})}>
                    <option value="DRAFT">DRAFT</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="COMPLETED">COMPLETED</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Limit Alokasi Hutang Keseluruhan</label>
                  <input type="number" className="w-full border rounded-xl p-2" value={contractData.debt_allocation} onChange={e => setContractData({...contractData, debt_allocation: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Jumlah Hutang Terserap (Manual input/Lock)</label>
                  <input type="number" className="w-full border rounded-xl p-2" value={contractData.current_debt} onChange={e => setContractData({...contractData, current_debt: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Deskripsi Tambahan</label>
                  <textarea className="w-full border rounded-xl p-2" rows={3} value={contractData.description} onChange={e => setContractData({...contractData, description: e.target.value})}></textarea>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-sm">
                <div>
                  <span className="block text-xs font-bold text-slate-400">Jenis Syirkah</span>
                  <span className="mt-1 px-3 py-1 text-xs font-black rounded-lg bg-indigo-50 text-indigo-700 inline-block tracking-wide">{contractData.contract_type || '-'}</span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-400">Status</span>
                  <span className="mt-1 px-2 py-1 text-xs font-bold rounded-lg bg-blue-50 text-blue-700 inline-block">{contractData.status}</span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-400">Dimodifikasi Tanggal</span>
                  <p className="font-medium text-slate-700">{new Date(contract.updated_at).toLocaleDateString('id-ID')}</p>
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-400">Limit Alokasi Hutang</span>
                  <p className="font-bold text-slate-800 text-lg">{formatRupiah(contractData.debt_allocation)}</p>
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-400">Hutang Terserap</span>
                  <p className="font-bold text-rose-600 text-lg">{formatRupiah(contractData.current_debt)}</p>
                </div>
                {contractData.description && (
                  <div>
                    <span className="block text-xs font-bold text-slate-400">Catatan</span>
                    <p className="text-slate-600 whitespace-pre-line bg-slate-50 border border-slate-100 rounded-xl p-3">{contractData.description}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* MEMBERS LIST */}
        <div className="col-span-1 lg:col-span-2">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm mb-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">Pihak Bersyirkah</h3>
              <button onClick={openNewMemberForm} className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 font-bold text-xs rounded-lg hover:bg-blue-100 transition">
                <Plus size={14} /> Tambah Anggota
              </button>
            </div>

            <div className="space-y-6">
              {/* PEMODAL SECTION */}
              <div>
                <h4 className="text-xs font-black uppercase text-slate-400 mb-3 tracking-widest">Lingkaran Pemodal (Shahibul Maal)</h4>
                {pemodalList.length === 0 ? (
                  <p className="text-sm text-slate-400 italic mb-4">Belum ada Pemodal terdaftar.</p>
                ) : (
                  <div className="space-y-3">
                    {pemodalList.map((m: any) => (
                      <div key={m.id} className="flex flex-col md:flex-row justify-between p-4 border border-slate-100 rounded-2xl bg-white hover:border-blue-200 group">
                        <div className="flex-1">
                          <h5 className="font-bold text-slate-800">{m.member_name}</h5>
                          <p className="text-xs text-slate-500 mt-1">{m.responsibility || '-'}</p>
                        </div>
                        <div className="flex flex-row md:flex-col items-center md:items-end justify-between mt-3 md:mt-0 gap-2 md:gap-0">
                          <div className="text-right">
                            <span className="block text-[10px] uppercase font-black tracking-wider text-emerald-600 mb-1">Setoran Modal / Porsi</span>
                            <span className="font-bold text-slate-800">{formatRupiah(m.capital_contribution)}</span>
                            <span className="ml-2 font-black text-rose-500">[{m.profit_share_percentage}%]</span>
                          </div>
                          <div className="mt-2 text-right">
                             <span className="block text-[10px] uppercase font-black tracking-wider text-blue-600 mb-1">Estimasi Bagi Hasil</span>
                             <span className="font-black text-blue-700">{formatRupiah((netProfit * m.profit_share_percentage) / 100)}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => editMember(m)} className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg"><Edit2 size={14} /></button>
                            <button onClick={() => handleDeleteMember(m.id)} className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg"><Trash2 size={14} /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* PENGELOLA SECTION */}
              <div>
                <h4 className="text-xs font-black uppercase text-slate-400 mb-3 tracking-widest mt-6">Lingkaran Pengelola (Mudharib)</h4>
                {pengelolaList.length === 0 ? (
                  <p className="text-sm text-slate-400 italic mb-4">Belum ada Pengelola terdaftar.</p>
                ) : (
                  <div className="space-y-3">
                    {pengelolaList.map((m: any) => (
                      <div key={m.id} className="flex flex-col md:flex-row justify-between p-4 border border-slate-100 rounded-2xl bg-white hover:border-amber-200 group">
                        <div className="flex-1">
                          <h5 className="font-bold text-slate-800">{m.member_name}</h5>
                          <p className="text-xs text-slate-500 mt-1">{m.responsibility || '-'}</p>
                        </div>
                        <div className="flex flex-row md:flex-col items-center md:items-end justify-between mt-3 md:mt-0 gap-2 md:gap-0">
                          <div className="text-right">
                            <span className="block text-[10px] uppercase font-black tracking-wider text-amber-600 mb-1">Porsi Bagi Hasil</span>
                            <span className="font-black text-rose-500 text-lg">{m.profit_share_percentage}%</span>
                          </div>
                          <div className="mt-2 text-right">
                             <span className="block text-[10px] uppercase font-black tracking-wider text-blue-600 mb-1">Estimasi Bagi Hasil</span>
                             <span className="font-black text-blue-700">{formatRupiah((netProfit * m.profit_share_percentage) / 100)}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => editMember(m)} className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg"><Edit2 size={14} /></button>
                            <button onClick={() => handleDeleteMember(m.id)} className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg"><Trash2 size={14} /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MEMBER FORM MODAL */}
      {isMemberFormOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[99] flex justify-center items-center p-4 py-16 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl my-auto">
            <h3 className="font-bold text-xl mb-4">{editingMemberId ? 'Edit Anggota' : 'Tambah Anggota'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Nama / Entitas</label>
                <input type="text" className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={memberForm.member_name} onChange={e => setMemberForm({...memberForm, member_name: e.target.value})} placeholder="Nama Pihak" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Peran Khusus</label>
                  <select className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-800 bg-blue-50" value={memberForm.role} onChange={e => setMemberForm({...memberForm, role: e.target.value as 'PEMODAL' | 'PENGELOLA'})}>
                    <option value="PEMODAL">PEMODAL</option>
                    <option value="PENGELOLA">PENGELOLA</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Porsi Bagi Hasil %</label>
                  <input type="number" min="0" max="100" className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={memberForm.profit_share_percentage} onChange={e => setMemberForm({...memberForm, profit_share_percentage: Number(e.target.value)})} />
                </div>
              </div>
              {memberForm.role === 'PEMODAL' && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Setoran Modal (Rp)</label>
                  <input type="number" className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={memberForm.capital_contribution} onChange={e => setMemberForm({...memberForm, capital_contribution: Number(e.target.value)})} />
                </div>
              )}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Tanggung Jawab Peran</label>
                <textarea rows={3} className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={memberForm.responsibility} onChange={e => setMemberForm({...memberForm, responsibility: e.target.value})} placeholder="Contoh: Mengurus operasional produksi harian..." />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-8">
              <button onClick={() => setIsMemberFormOpen(false)} className="px-5 py-2.5 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition">Batal</button>
              <button onClick={handleSaveMember} className="px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition">Simpan Anggota</button>
            </div>
          </div>
        </div>
      )}

      {/* QR MODAL */}
      {showQR && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2rem] p-8 shadow-2xl relative">
            <button onClick={() => setShowQR(false)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 hover:bg-slate-200">X</button>
            <div className="text-center mb-6">
              <Handshake size={48} className="mx-auto text-blue-600 mb-3" />
              <h3 className="font-black text-2xl tracking-tight text-slate-900">Validasi Digital</h3>
              <p className="text-sm text-slate-500 font-medium">Scan QR di bawah ini untuk melihat dokumen syirkah resmi.</p>
            </div>
            <div className="flex justify-center p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
              <QRCodeSVG value={qrUrl} size={200} level="H" includeMargin={true} />
            </div>
            <div className="mt-6 text-center">
              <p className="text-xs bg-slate-100 p-2 rounded-lg font-mono text-slate-600 break-all">{qrUrl}</p>
              <a href={qrUrl} target="_blank" rel="noopener noreferrer" className="block w-full mt-3 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition">
                Buka Link Validasi
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
