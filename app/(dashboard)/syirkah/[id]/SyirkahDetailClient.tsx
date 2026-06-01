'use client'

import React, { useState, useEffect } from 'react'
import { ArrowLeft, Save, Plus, QrCode, Trash2, Edit2, Handshake, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { formatDate, formatRupiah } from '@/lib/utils'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { SYIRKAH_PROFIT_SHARING_EQUITY_CODE } from '@/modules/accounting/lib/shariah-coa'
import {
import { useConfirm } from '@/components/ui/NizamUI'
  upsertSyirkahContract,
  upsertSyirkahMember,
  deleteSyirkahMember,
  syncSyirkahCapitalToCore,
  syncSyirkahProfitSharingToCore,
} from '@/modules/syirkah/actions/syirkah.actions'

const SYIRKAH_DEFAULT_CASH_CODES = ['1103', '1101', '1102', '1105']

function pickPreferredAccountByCodes(options: any[], preferredCodes: string[]) {
  for (const code of preferredCodes) {
    const matched = options.find((option) => String(option?.code || '') === code)
    if (matched) return matched
  }

  return null
}

function getPreferredEquityCodes(contractType: unknown) {
  return String(contractType || '').trim().toLowerCase() === 'syirkah mudharabah'
    ? ['3110', '3001', '3120']
    : ['3120', '3001', '3110']
}

function normalizeLocalContractStatus(value: unknown) {
  const normalized = String(value || '').trim().toUpperCase()
  if (['DRAFT', 'SIGNING', 'ACTIVE', 'COMPLETED'].includes(normalized)) {
    return normalized as 'DRAFT' | 'SIGNING' | 'ACTIVE' | 'COMPLETED'
  }

  return 'DRAFT' as const
}

function createDraftMemberId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  const randomSegment = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0')
  return `${randomSegment()}${randomSegment()}-${randomSegment()}-4${randomSegment().slice(1)}-a${randomSegment().slice(1)}-${randomSegment()}${randomSegment()}${randomSegment()}`
}

export default function SyirkahDetailClient({ orgId, contract, members, netProfit, profitDistribution, accounts, coreJournal, profitSharingJournal }: any) {
  const router = useRouter()
  const normalizedContractStatus = normalizeLocalContractStatus(contract.status)
  const canEstimateProfit = typeof netProfit === 'number' && Number.isFinite(netProfit)
  const hasManualProfitSharingAllocation = Number(contract.profit_sharing_allocation || 0) > 0
  const [isEditingContract, setIsEditingContract] = useState(false)
  const { confirm, ConfirmUI } = useConfirm()
  const [contractData, setContractData] = useState({
    title: contract.title || '',
    description: contract.description || '',
    contract_type: contract.contract_type || 'Syirkah Mudharabah',
    debt_allocation: contract.debt_allocation || 0,
    current_debt: contract.current_debt || 0,
    profit_sharing_allocation: contract.profit_sharing_allocation || 0,
    status: contract.status || 'DRAFT',
    core_cash_account_id: contract.core_cash_account_id || '',
    core_equity_account_id: contract.core_equity_account_id || '',
    profit_sharing_cash_account_id: contract.profit_sharing_cash_account_id || '',
  })

  const SYIRKAH_TYPES = ['Abdan', 'Syirkah Inan', 'Syirkah Mudharabah', 'Syirkah Wujuh', 'Syirkah Muwafadhah']

  const [isSavingContract, setIsSavingContract] = useState(false)
  const [isSyncingCore, setIsSyncingCore] = useState(false)
  const [isSyncingProfitSharing, setIsSyncingProfitSharing] = useState(false)
  const [showQR, setShowQR] = useState(false)

  // Member form state
  const [isMemberFormOpen, setIsMemberFormOpen] = useState(false)
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [memberForm, setMemberForm] = useState<{
    id?: string
    member_name: string
    role: 'PEMODAL' | 'PENGELOLA' | 'PEMODAL_PENGELOLA'
    responsibility: string
    profit_share_percentage: number
    capital_contribution: number
  }>({
    id: createDraftMemberId(),
    member_name: '',
    role: 'PENGELOLA',
    responsibility: '',
    profit_share_percentage: 0,
    capital_contribution: 0
  })

  const activeAccounts = Array.isArray(accounts) ? accounts.filter((account: any) => account?.is_active) : []
  const cashAccounts = activeAccounts.filter((account: any) => account?.type === 'ASSET' && String(account?.code || '').startsWith('11'))
  const equityAccounts = activeAccounts.filter(
    (account: any) =>
      account?.type === 'EQUITY' &&
      String(account?.code || '').startsWith('3') &&
      String(account?.code || '').trim() !== SYIRKAH_PROFIT_SHARING_EQUITY_CODE
  )
  const selectedCashAccount = activeAccounts.find((account: any) => account.id === contractData.core_cash_account_id) || null
  const selectedEquityAccount = activeAccounts.find((account: any) => account.id === contractData.core_equity_account_id) || null
  const selectedProfitSharingCashAccount = activeAccounts.find((account: any) => account.id === contractData.profit_sharing_cash_account_id) || null
  const suggestedCashAccount = selectedCashAccount || pickPreferredAccountByCodes(cashAccounts, SYIRKAH_DEFAULT_CASH_CODES) || cashAccounts[0] || null
  const suggestedEquityAccount =
    selectedEquityAccount
    || pickPreferredAccountByCodes(equityAccounts, getPreferredEquityCodes(contractData.contract_type))
    || equityAccounts[0]
    || null
  const suggestedProfitSharingCashAccount =
    selectedProfitSharingCashAccount
    || suggestedCashAccount
    || pickPreferredAccountByCodes(cashAccounts, SYIRKAH_DEFAULT_CASH_CODES)
    || cashAccounts[0]
    || null
  const totalCapital = members.reduce((sum: number, member: any) => sum + Number(member.capital_contribution || 0), 0)
  const canPostCoreCapital = ['ACTIVE', 'COMPLETED'].includes(normalizedContractStatus)
  const profitSharingBaseAmount = canEstimateProfit ? Number(netProfit || 0) : 0
  const canPostProfitSharing =
    ['ACTIVE', 'COMPLETED'].includes(normalizedContractStatus)
    && profitDistribution?.status === 'ESTIMATED'
    && profitSharingBaseAmount > 0

  const runCoreSync = async (showSuccessAlert = false) => {
    setIsSyncingCore(true)
    try {
      const result = await syncSyirkahCapitalToCore(contract.id)
      if ((result as any).error) {
        alert(`Pencatatan Core belum berhasil disinkronkan: ${(result as any).error}`)
        return false
      }

      if (showSuccessAlert) {
        if ((result as any).skipped && (result as any).message) {
          alert((result as any).message)
        } else {
          const entryNumber = String((result as any).entryNumber || '').trim()
          if (entryNumber) {
            alert(`Modal syirkah tersinkron ke jurnal Core ${entryNumber}.`)
          } else {
            alert((result as any).message || 'Pencatatan modal syirkah di Core sudah diperbarui.')
          }
        }
      }

      return true
    } finally {
      setIsSyncingCore(false)
    }
  }

  const runProfitSharingSync = async (showSuccessAlert = false) => {
    setIsSyncingProfitSharing(true)
    try {
      const result = await syncSyirkahProfitSharingToCore(contract.id)
      if ((result as any).error) {
        alert(`Posting bagi hasil belum berhasil disinkronkan: ${(result as any).error}`)
        return false
      }

      if (showSuccessAlert) {
        if ((result as any).skipped && (result as any).message) {
          alert((result as any).message)
        } else {
          const entryNumber = String((result as any).entryNumber || '').trim()
          if (entryNumber) {
            alert(`Bagi hasil syirkah tersinkron ke jurnal Core ${entryNumber}.`)
          } else {
            alert((result as any).message || 'Posting bagi hasil syirkah di Core sudah diperbarui.')
          }
        }
      }

      return true
    } finally {
      setIsSyncingProfitSharing(false)
    }
  }

  const handleSaveContract = async () => {
    setIsSavingContract(true)
    try {
      await upsertSyirkahContract(orgId, {
        id: contract.id,
        ...contractData
      })
      await runCoreSync(false)
      await runProfitSharingSync(false)
      setIsEditingContract(false)
      router.refresh()
    } catch {
      alert('Gagal update kontrak')
    } finally {
      setIsSavingContract(false)
    }
  }

  const openNewMemberForm = () => {
    setMemberForm({
      id: createDraftMemberId(),
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
      id: m.id,
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
        id: editingMemberId || memberForm.id || undefined,
        ...memberForm
      })
      setIsMemberFormOpen(false)
      await runCoreSync(false)
      router.refresh()
    } catch {
      alert('Gagal save member')
    }
  }

  const handleDeleteMember = async (id: string) => {
    if (!await confirm('Yakin hapus?')) return
    try {
      await deleteSyirkahMember(id, contract.id)
      await runCoreSync(false)
      router.refresh()
    } catch {
      alert('Gagal hapus')
    }
  }

  const pemodalList = members.filter((m: any) => m.role === 'PEMODAL')
  const pengelolaList = members.filter((m: any) => m.role === 'PENGELOLA')
  const dualRoleList = members.filter((m: any) => m.role === 'PEMODAL_PENGELOLA')
  const coreJournalStatus = String(coreJournal?.status || '').trim().toUpperCase()
  const profitSharingJournalStatus = String(profitSharingJournal?.status || '').trim().toUpperCase()
  const statusBadgeClass =
    normalizedContractStatus === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' :
    normalizedContractStatus === 'COMPLETED' ? 'bg-slate-100 text-slate-700' :
    normalizedContractStatus === 'SIGNING' ? 'bg-sky-100 text-sky-700' :
    'bg-amber-100 text-amber-700'
  
  const [qrUrl, setQrUrl] = useState('')
  useEffect(() => {
    setQrUrl(`${window.location.origin}/syirkah-doc/${contract.qr_token}`)
  }, [contract.qr_token])

  const renderEstimatedProfit = (member: any) => {
    if (!canEstimateProfit) {
      return <span className="font-bold text-slate-500 text-xs">Belum bisa dihitung</span>
    }

    return (
      <span className="font-semibold text-blue-700">
        {formatRupiah((netProfit * Number(member.profit_share_percentage || 0)) / 100)}
      </span>
    )
  }

  return (
    <div className="flex flex-col gap-6 relative">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/syirkah" className="p-2 bg-white rounded-xl shadow-sm hover:text-blue-600 transition">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 border-b-4 border-blue-600 inline-block pb-1">
              {contract.title}
            </h1>
          </div>
        </div>
	        <div className="flex gap-2">
	          {(normalizedContractStatus === 'DRAFT' || normalizedContractStatus === 'SIGNING') && (
	            <Link
	              href={`/syirkah/${contract.id}?wizard=1`}
	              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-sm font-bold shadow-sm hover:bg-blue-100 transition"
	            >
	              <Handshake size={18} /> Lanjutkan Wizard
	            </Link>
	          )}
	          <button type="button"
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
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800">Detail Akad</h3>
              {!isEditingContract ? (
                <button type="button" onClick={() => setIsEditingContract(true)} className="text-blue-600 p-1 hover:bg-blue-50 rounded text-sm font-bold aspect-square">
                  <Edit2 size={16} />
                </button>
              ) : (
                <button type="button" onClick={handleSaveContract} disabled={isSavingContract} className="text-emerald-600 p-1 hover:bg-emerald-50 rounded text-sm font-bold flex gap-1 items-center">
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
                    <option value="SIGNING">SIGNING</option>
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
                  <label className="block text-xs font-bold text-slate-500 mb-1">Nominal Alokasi Bagi Hasil</label>
                  <input type="number" className="w-full border rounded-xl p-2" value={contractData.profit_sharing_allocation} onChange={e => setContractData({...contractData, profit_sharing_allocation: Number(e.target.value)})} />
                  <p className="mt-1 text-xs text-slate-400">
                    Isi nominal laba yang benar-benar ingin dibagikan ke para syarik. Jika 0, sistem memakai basis default saat tersedia.
                  </p>
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
                  <span className="mt-1 px-3 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 inline-block tracking-wide">{contractData.contract_type || '-'}</span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-400">Status</span>
                  <span className={`mt-1 px-2 py-1 text-xs font-bold rounded-lg inline-block ${statusBadgeClass}`}>{contractData.status}</span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-400">Dimodifikasi Tanggal</span>
                  <p className="font-medium text-slate-700">{formatDate(contract.updated_at)}</p>
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-400">Limit Alokasi Hutang</span>
                  <p className="font-bold text-slate-800 text-lg">{formatRupiah(contractData.debt_allocation)}</p>
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-400">Hutang Terserap</span>
                  <p className="font-bold text-rose-600 text-lg">{formatRupiah(contractData.current_debt)}</p>
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-400">Nominal Alokasi Bagi Hasil</span>
                  <p className="font-bold text-blue-700 text-lg">
                    {contractData.profit_sharing_allocation > 0 ? formatRupiah(contractData.profit_sharing_allocation) : 'Belum ditentukan'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {contractData.profit_sharing_allocation > 0
                      ? 'Nominal ini menjadi dasar pembagian rupiah ke masing-masing syarik.'
                      : 'Jika belum diisi, sistem memakai basis default yang tersedia.'}
                  </p>
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

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">Pencatatan Core</h3>
              {!isEditingContract && (
                <button
                  type="button"
                  onClick={async () => {
                    await runCoreSync(true)
                    router.refresh()
                  }}
                  disabled={isSyncingCore}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw size={14} className={isSyncingCore ? 'animate-spin' : ''} />
                  {isSyncingCore ? 'Sinkron...' : 'Sinkronkan'}
                </button>
              )}
            </div>

            {isEditingContract ? (
              <div className="space-y-4">
                {cashAccounts.length > 0 ? (
                  <SearchableSelect
                    label="Rekening Penerima Modal"
                    options={cashAccounts}
                    value={contractData.core_cash_account_id}
                    onChange={(value) => setContractData((prev) => ({ ...prev, core_cash_account_id: value }))}
                    placeholder="Pilih rekening kas/bank Core..."
                  />
                ) : (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
                    Belum ada akun kas/bank aktif (11xx) yang bisa dipakai sebagai penerima modal.
                  </p>
                )}

                {equityAccounts.length > 0 ? (
                  <SearchableSelect
                    label="Akun Modal Syirkah"
                    options={equityAccounts}
                    value={contractData.core_equity_account_id}
                    onChange={(value) => setContractData((prev) => ({ ...prev, core_equity_account_id: value }))}
                    placeholder="Pilih akun modal syirkah..."
                  />
                ) : (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
                    Belum ada akun ekuitas aktif (3xxx) yang bisa dipakai untuk modal syirkah.
                  </p>
                )}

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
                  Jurnal Core akan dibuat otomatis dari total modal syirkah:
                  <span className="mt-1 block font-semibold text-slate-800">
                    Debit {suggestedCashAccount ? `${suggestedCashAccount.code} - ${suggestedCashAccount.name}` : 'rekening penerima modal'}
                    {' / '}
                    Kredit {suggestedEquityAccount ? `${suggestedEquityAccount.code} - ${suggestedEquityAccount.name}` : 'akun modal syirkah'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-sm">
                <div>
                  <span className="block text-xs font-bold text-slate-400">Total Modal Syirkah</span>
                  <p className="font-bold text-slate-900 text-lg">{formatRupiah(totalCapital)}</p>
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-400">Rekening Penerima Modal</span>
                  <p className="font-medium text-slate-700">
                    {suggestedCashAccount ? `${suggestedCashAccount.code} - ${suggestedCashAccount.name}` : 'Belum dipilih'}
                  </p>
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-400">Akun Modal Syirkah</span>
                  <p className="font-medium text-slate-700">
                    {suggestedEquityAccount ? `${suggestedEquityAccount.code} - ${suggestedEquityAccount.name}` : 'Belum dipilih'}
                  </p>
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-400">Status Jurnal Core</span>
                  {totalCapital <= 0 ? (
                    <span className="mt-1 inline-flex rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                      Belum ada modal yang dicatat
                    </span>
                  ) : !canPostCoreCapital ? (
                    <div className="mt-1 space-y-1">
                      <span className="inline-flex rounded-lg bg-sky-100 px-2 py-1 text-xs font-bold text-sky-700">
                        Menunggu akad aktif
                      </span>
                      <p className="text-xs font-medium text-slate-600">
                        Modal akan dicatat ke Core setelah akad berstatus ACTIVE.
                      </p>
                    </div>
                  ) : coreJournalStatus === 'POSTED' ? (
                    <div className="mt-1 space-y-1">
                      <span className="inline-flex rounded-lg bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">
                        Tersinkron ke Core
                      </span>
                      <p className="text-xs font-medium text-slate-600">
                        {coreJournal?.entry_number || 'Jurnal Core'} • {coreJournal?.entry_date ? formatDate(coreJournal.entry_date) : 'Tanggal belum tersedia'}
                      </p>
                    </div>
                  ) : contract.core_journal_entry_id ? (
                    <span className="mt-1 inline-flex rounded-lg bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">
                      Perlu sinkron ulang
                    </span>
                  ) : (
                    <span className="mt-1 inline-flex rounded-lg bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">
                      Belum tersinkron
                    </span>
                  )}
                </div>
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
                  {canPostCoreCapital
                    ? 'Total setoran modal dari akad syirkah ini akan masuk ke jurnal Core agar terbaca di buku besar utama.'
                    : 'Pencatatan modal ke Core baru dilakukan setelah akad efektif dan berstatus ACTIVE.'}
                </p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">Posting Bagi Hasil</h3>
              {!isEditingContract && (
                <button
                  type="button"
                  onClick={async () => {
                    await runProfitSharingSync(true)
                    router.refresh()
                  }}
                  disabled={isSyncingProfitSharing}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw size={14} className={isSyncingProfitSharing ? 'animate-spin' : ''} />
                  {isSyncingProfitSharing ? 'Proses...' : 'Posting / Sinkronkan'}
                </button>
              )}
            </div>

            {isEditingContract ? (
              <div className="space-y-4">
                {cashAccounts.length > 0 ? (
                  <SearchableSelect
                    label="Rekening Pembayaran Bagi Hasil"
                    options={cashAccounts}
                    value={contractData.profit_sharing_cash_account_id}
                    onChange={(value) => setContractData((prev) => ({ ...prev, profit_sharing_cash_account_id: value }))}
                    placeholder="Pilih rekening kas/bank untuk payout..."
                  />
                ) : (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
                    Belum ada akun kas/bank aktif (11xx) yang bisa dipakai untuk pembayaran bagi hasil.
                  </p>
                )}

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
                  Posting otomatis akan menggunakan jurnal:
                  <span className="mt-1 block font-semibold text-slate-800">
                    Debit 3130 - Bagi Hasil Syirkah
                    {' / '}
                    Kredit {suggestedProfitSharingCashAccount ? `${suggestedProfitSharingCashAccount.code} - ${suggestedProfitSharingCashAccount.name}` : 'rekening kas/bank payout'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-sm">
                <div>
                  <span className="block text-xs font-bold text-slate-400">Basis Pembagian</span>
                  <p className="font-bold text-slate-900">
                    {profitDistribution?.source === 'MANUAL_ALLOCATION'
                      ? 'Alokasi Manual Akad'
                      : profitDistribution?.source === 'ORG_NET_PROFIT'
                        ? 'Laba Bersih Organisasi'
                        : 'Belum Ada Basis Valid'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {profitDistribution?.message || 'Sistem akan mengevaluasi basis bagi hasil dari akad aktif yang berjalan.'}
                  </p>
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-400">Nominal Akan Diposting</span>
                  <p className={`font-bold text-lg ${profitSharingBaseAmount > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {canEstimateProfit ? formatRupiah(profitSharingBaseAmount) : 'Belum tersedia'}
                  </p>
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-400">Rekening Pembayaran</span>
                  <p className="font-medium text-slate-700">
                    {suggestedProfitSharingCashAccount
                      ? `${suggestedProfitSharingCashAccount.code} - ${suggestedProfitSharingCashAccount.name}`
                      : 'Belum dipilih'}
                  </p>
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-400">Status Jurnal Bagi Hasil</span>
                  {profitSharingJournalStatus === 'POSTED' ? (
                    <div className="mt-1 space-y-1">
                      <span className="inline-flex rounded-lg bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">
                        Sudah Diposting
                      </span>
                      <p className="text-xs font-medium text-slate-600">
                        {profitSharingJournal?.entry_number || 'Jurnal Bagi Hasil'} • {profitSharingJournal?.entry_date ? formatDate(profitSharingJournal.entry_date) : 'Tanggal belum tersedia'}
                      </p>
                    </div>
                  ) : contract.profit_sharing_journal_entry_id ? (
                    <span className="mt-1 inline-flex rounded-lg bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">
                      Perlu sinkron ulang
                    </span>
                  ) : !canPostProfitSharing ? (
                    <div className="mt-1 space-y-1">
                      <span className="inline-flex rounded-lg bg-sky-100 px-2 py-1 text-xs font-bold text-sky-700">
                        Menunggu basis valid
                      </span>
                      <p className="text-xs font-medium text-slate-600">
                        {profitDistribution?.message || 'Isi alokasi manual atau pastikan akad aktif agar nominal bagi hasil bisa diposting.'}
                      </p>
                    </div>
                  ) : (
                    <span className="mt-1 inline-flex rounded-lg bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">
                      Belum diposting
                    </span>
                  )}
                </div>
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
                  {canPostProfitSharing
                    ? 'Saat tombol dijalankan, sistem akan membuat jurnal otomatis untuk pembagian laba syirkah dan menghindari jurnal dobel bila nominalnya belum berubah.'
                    : 'Sistem hanya akan memposting bagi hasil jika akad sudah ACTIVE/COMPLETED dan nominal dasar pembagian bernilai positif.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* MEMBERS LIST */}
        <div className="col-span-1 lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm mb-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">Pihak Bersyirkah</h3>
              <button type="button" onClick={openNewMemberForm} className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 font-bold text-xs rounded-lg hover:bg-blue-100 transition">
                <Plus size={14} /> Tambah Anggota
              </button>
            </div>

            {profitDistribution?.message && (
              <div className={`mb-6 rounded-xl border px-4 py-3 text-sm font-medium ${
                canEstimateProfit
                  ? 'border-blue-200 bg-blue-50 text-blue-800'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}>
                {profitDistribution.message}
                {canEstimateProfit && (
                  <span className="mt-1 block text-xs font-semibold">
                    Basis pembagian saat ini: {hasManualProfitSharingAllocation ? 'alokasi manual akad' : 'default laba bersih organisasi'}
                    {' • '}
                    {formatRupiah(Number(netProfit || 0))}
                  </span>
                )}
              </div>
            )}

            <div className="space-y-6">
	              {/* PEMODAL SECTION */}
	              <div>
                <h4 className="text-xs font-semibold uppercase text-slate-400 mb-3 tracking-wide">Lingkaran Pemodal (Shahibul Maal)</h4>
                {pemodalList.length === 0 ? (
                  <p className="text-sm text-slate-400 italic mb-4">Belum ada Pemodal terdaftar.</p>
                ) : (
                  <div className="space-y-3">
                    {pemodalList.map((m: any) => (
                      <div key={m.id} className="flex flex-col md:flex-row justify-between p-4 border border-slate-100 rounded-xl bg-white hover:border-blue-200 group">
                        <div className="flex-1">
                          <h5 className="font-bold text-slate-800">{m.member_name}</h5>
                          <p className="text-xs text-slate-500 mt-1">{m.responsibility || '-'}</p>
                        </div>
                        <div className="flex flex-row md:flex-col items-center md:items-end justify-between mt-3 md:mt-0 gap-2 md:gap-0">
                          <div className="text-right">
                            <span className="block text-[10px] uppercase font-semibold tracking-wider text-emerald-600 mb-1">Setoran Modal / Porsi</span>
                            <span className="font-bold text-slate-800">{formatRupiah(m.capital_contribution)}</span>
                            <span className="ml-2 font-semibold text-rose-500">[{m.profit_share_percentage}%]</span>
                          </div>
                          <div className="mt-2 text-right">
                             <span className="block text-[10px] uppercase font-semibold tracking-wider text-blue-600 mb-1">Estimasi Bagi Hasil</span>
                             {renderEstimatedProfit(m)}
                          </div>
                          <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button type="button" onClick={() => editMember(m)} className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg"><Edit2 size={14} /></button>
                            <button type="button" onClick={() => handleDeleteMember(m.id)} className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg"><Trash2 size={14} /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
	              </div>

	              {/* DUAL ROLE SECTION */}
	              <div>
	                <h4 className="text-xs font-semibold uppercase text-slate-400 mb-3 tracking-wide mt-6">Pemodal & Pengelola Sekaligus</h4>
	                {dualRoleList.length === 0 ? (
	                  <p className="text-sm text-slate-400 italic mb-4">Belum ada anggota dengan peran gabungan.</p>
	                ) : (
	                  <div className="space-y-3">
	                    {dualRoleList.map((m: any) => (
	                      <div key={m.id} className="flex flex-col md:flex-row justify-between p-4 border border-slate-100 rounded-xl bg-white hover:border-emerald-200 group">
	                        <div className="flex-1">
	                          <h5 className="font-bold text-slate-800">{m.member_name}</h5>
	                          <p className="mt-1 inline-flex rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-semibold tracking-wide text-emerald-700">
	                            PEMODAL_PENGELOLA
	                          </p>
	                          <p className="text-xs text-slate-500 mt-2">{m.responsibility || '-'}</p>
	                        </div>
	                        <div className="flex flex-row md:flex-col items-center md:items-end justify-between mt-3 md:mt-0 gap-2 md:gap-0">
	                          <div className="text-right">
	                            <span className="block text-[10px] uppercase font-semibold tracking-wider text-emerald-600 mb-1">Setoran Modal / Porsi</span>
	                            <span className="font-bold text-slate-800">{formatRupiah(m.capital_contribution)}</span>
	                            <span className="ml-2 font-semibold text-rose-500">[{m.profit_share_percentage}%]</span>
	                          </div>
	                          <div className="mt-2 text-right">
	                             <span className="block text-[10px] uppercase font-semibold tracking-wider text-blue-600 mb-1">Estimasi Bagi Hasil</span>
	                             {renderEstimatedProfit(m)}
	                          </div>
	                          <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
	                            <button type="button" onClick={() => editMember(m)} className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg"><Edit2 size={14} /></button>
	                            <button type="button" onClick={() => handleDeleteMember(m.id)} className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg"><Trash2 size={14} /></button>
	                          </div>
	                        </div>
	                      </div>
	                    ))}
	                  </div>
	                )}
	              </div>

	              {/* PENGELOLA SECTION */}
	              <div>
                <h4 className="text-xs font-semibold uppercase text-slate-400 mb-3 tracking-wide mt-6">Lingkaran Pengelola (Mudharib)</h4>
                {pengelolaList.length === 0 ? (
                  <p className="text-sm text-slate-400 italic mb-4">Belum ada Pengelola terdaftar.</p>
                ) : (
                  <div className="space-y-3">
                    {pengelolaList.map((m: any) => (
                      <div key={m.id} className="flex flex-col md:flex-row justify-between p-4 border border-slate-100 rounded-xl bg-white hover:border-amber-200 group">
                        <div className="flex-1">
                          <h5 className="font-bold text-slate-800">{m.member_name}</h5>
                          <p className="text-xs text-slate-500 mt-1">{m.responsibility || '-'}</p>
                        </div>
                        <div className="flex flex-row md:flex-col items-center md:items-end justify-between mt-3 md:mt-0 gap-2 md:gap-0">
                          <div className="text-right">
                            <span className="block text-[10px] uppercase font-semibold tracking-wider text-amber-600 mb-1">Porsi Bagi Hasil</span>
                            <span className="font-semibold text-rose-500 text-lg">{m.profit_share_percentage}%</span>
                          </div>
                          <div className="mt-2 text-right">
                             <span className="block text-[10px] uppercase font-semibold tracking-wider text-blue-600 mb-1">Estimasi Bagi Hasil</span>
                             {renderEstimatedProfit(m)}
                          </div>
                          <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button type="button" onClick={() => editMember(m)} className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg"><Edit2 size={14} /></button>
                            <button type="button" onClick={() => handleDeleteMember(m.id)} className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg"><Trash2 size={14} /></button>
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
          <div className="bg-white w-full max-w-lg rounded-xl p-6 shadow-md my-auto">
            <h3 className="font-bold text-xl mb-4">{editingMemberId ? 'Edit Anggota' : 'Tambah Anggota'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Nama / Entitas</label>
                <input type="text" className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={memberForm.member_name} onChange={e => setMemberForm({...memberForm, member_name: e.target.value})} placeholder="Nama Pihak" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Peran Khusus</label>
                  <select className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-800 bg-blue-50" value={memberForm.role} onChange={e => setMemberForm({...memberForm, role: e.target.value as 'PEMODAL' | 'PENGELOLA' | 'PEMODAL_PENGELOLA'})}>
                    <option value="PEMODAL">PEMODAL</option>
                    <option value="PENGELOLA">PENGELOLA</option>
                    <option value="PEMODAL_PENGELOLA">PEMODAL_PENGELOLA</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Porsi Bagi Hasil %</label>
                  <input type="number" min="0" max="100" className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={memberForm.profit_share_percentage} onChange={e => setMemberForm({...memberForm, profit_share_percentage: Number(e.target.value)})} />
                </div>
              </div>
              {memberForm.role !== 'PENGELOLA' && (
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
              <button type="button" onClick={() => setIsMemberFormOpen(false)} className="px-5 py-2.5 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition">Batal</button>
              <button type="button" onClick={handleSaveMember} className="px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition">Simpan Anggota</button>
            </div>
          </div>
        </div>
      )}

      {/* QR MODAL */}
      {showQR && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2rem] p-8 shadow-md relative">
            <button type="button" onClick={() => setShowQR(false)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 hover:bg-slate-200">X</button>
            <div className="text-center mb-6">
              <Handshake size={48} className="mx-auto text-blue-600 mb-3" />
              <h3 className="font-semibold text-2xl tracking-tight text-slate-900">Validasi Digital</h3>
              <p className="text-sm text-slate-500 font-medium">Scan QR di bawah ini untuk melihat dokumen syirkah resmi.</p>
            </div>
            <div className="flex justify-center p-6 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
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
      {ConfirmUI}
    </div>
  )
}
