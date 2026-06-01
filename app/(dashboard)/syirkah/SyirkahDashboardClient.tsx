'use client'

import React, { useEffect, useState } from 'react'
import { Plus, Briefcase, TrendingUp, AlertCircle, Eye, Handshake, Trash2, PieChart, Edit2, Save, X } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import Link from 'next/link'
import { deleteSyirkahContract, upsertSyirkahContract } from '@/modules/syirkah/actions/syirkah.actions'
import { useRouter } from 'next/navigation'
import { useConfirm } from '@/components/ui/NizamUI'

export default function SyirkahDashboardClient({ orgId, initialData }: { orgId: string; initialData: any }) {
  const { netProfit, totalDebtAllocation, totalCurrentDebt, contracts, allMembers, distributionContext } = initialData
  const debtPercentage = totalDebtAllocation > 0 ? Math.min((totalCurrentDebt / totalDebtAllocation) * 100, 100) : 0
  const profitSharingReferenceGroup =
    allMembers.find((group: any) => group?.distributionSource === 'MANUAL_ALLOCATION')
    || allMembers.find((group: any) => group?.distributionStatus === 'ESTIMATED')
    || null
  const profitSharingReferenceContract = profitSharingReferenceGroup
    ? contracts.find((contract: any) => contract?.id === profitSharingReferenceGroup.contractId) || null
    : null
  const profitSharingReferenceMembers = profitSharingReferenceGroup
    ? [...(profitSharingReferenceGroup.members || [])]
        .filter((member: any) => member?.member_name)
        .sort((left: any, right: any) => Number(right?.estimatedProfitAmount || 0) - Number(left?.estimatedProfitAmount || 0))
    : []
  const totalProfitSharingReference = profitSharingReferenceMembers.reduce(
    (sum: number, member: any) => sum + Number(member?.estimatedProfitAmount || 0),
    0
  )
  const totalReferenceNisbah = profitSharingReferenceMembers.reduce(
    (sum: number, member: any) => sum + Number(member?.profit_share_percentage || 0),
    0
  )
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { confirm, ConfirmUI } = useConfirm()
  const [isEditingProfitSharing, setIsEditingProfitSharing] = useState(false)
  const [isSavingProfitSharing, setIsSavingProfitSharing] = useState(false)
  const [profitSharingDraft, setProfitSharingDraft] = useState(0)

  useEffect(() => {
    if (!profitSharingReferenceGroup) {
      setProfitSharingDraft(0)
      return
    }

    const manualAllocation = Number(profitSharingReferenceContract?.profit_sharing_allocation || 0)
    if (manualAllocation > 0) {
      setProfitSharingDraft(manualAllocation)
      return
    }

    setProfitSharingDraft(Number(profitSharingReferenceGroup.estimatedNetProfit || 0))
  }, [profitSharingReferenceContract, profitSharingReferenceGroup])

  const handleDelete = async (contractId: string, title: string) => {
    if (!await confirm(`Hapus akad "${title}"? Tindakan ini tidak dapat dibatalkan.`)) return
    setDeletingId(contractId)
    try {
      const result = await deleteSyirkahContract(contractId, orgId)
      if ((result as any).error) {
        alert((result as any).error)
      } else {
        router.refresh()
      }
    } finally {
      setDeletingId(null)
    }
  }

  const handleSaveProfitSharingAllocation = async () => {
    if (!profitSharingReferenceContract?.id) return

    setIsSavingProfitSharing(true)
    try {
      await upsertSyirkahContract(orgId, {
        ...profitSharingReferenceContract,
        profit_sharing_allocation: Math.max(0, Number(profitSharingDraft || 0)),
      })
      setIsEditingProfitSharing(false)
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menyimpan alokasi bagi hasil.'
      alert(message)
    } finally {
      setIsSavingProfitSharing(false)
    }
  }

  const handleCancelProfitSharingEdit = () => {
    const manualAllocation = Number(profitSharingReferenceContract?.profit_sharing_allocation || 0)
    setProfitSharingDraft(
      manualAllocation > 0
        ? manualAllocation
        : Number(profitSharingReferenceGroup?.estimatedNetProfit || 0)
    )
    setIsEditingProfitSharing(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 border-b-4 border-blue-600 inline-block pb-1">
            Dashboard Syirkah
          </h1>
          <p className="text-sm text-slate-500 mt-2 font-medium">
            Kelola kerja sama kemitraan, bagi hasil, dan eksposur hutang.
          </p>
        </div>
        <Link
          href="/syirkah/new"
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow hover:bg-blue-700 active:scale-95 transition-all"
        >
          <Plus size={16} /> Buat Akad Baru
        </Link>
      </div>

      {/* HERO SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Profit Hero */}
        <div className="col-span-1 md:col-span-2 relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-900 via-blue-800 to-emerald-900 p-6 flex flex-col justify-between shadow-xl shadow-blue-900/20">
          <div className="absolute top-0 right-0 p-4 opacity-20">
            <TrendingUp size={100} />
          </div>
          <div className="relative z-10">
            <h2 className="text-blue-200 text-sm font-semibold tracking-wide uppercase mb-1">Total Net Profit</h2>
            <div className="text-4xl lg:text-5xl font-semibold text-white tracking-tighter">
              {formatRupiah(netProfit)}
            </div>
            <p className="text-blue-100 text-sm mt-2 opacity-80 max-w-sm leading-tight">
              {distributionContext?.message || 'Laba bersih organisasi sebagai basis estimasi bagi hasil syirkah.'}
            </p>
          </div>
        </div>

        {/* Debt Exposure Hero */}
        <div className="col-span-1 md:col-span-2 rounded-xl bg-white border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-slate-500 text-sm font-semibold tracking-wide uppercase">Alokasi Hutang Keseluruhan</h2>
              <div className="p-2 bg-rose-50 text-rose-500 rounded-full">
                <AlertCircle size={18} />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-slate-900 tracking-tighter">{formatRupiah(totalCurrentDebt)}</span>
              <span className="text-sm font-bold text-slate-400">/ {formatRupiah(totalDebtAllocation)}</span>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs font-bold mb-1">
              <span className="text-slate-500">Kapasitas Digunakan</span>
              <span className={debtPercentage > 80 ? 'text-rose-500' : 'text-slate-700'}>{debtPercentage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${debtPercentage > 80 ? 'bg-rose-500' : 'bg-amber-500'}`}
                style={{ width: `${debtPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
              <span className="rounded-xl bg-blue-50 p-2 text-blue-600">
                <PieChart size={18} />
              </span>
              Alokasi Bagi Hasil Syarik
            </h2>
            <p className="mt-2 text-sm font-medium text-slate-500">
              Card ini menjadi rujukan estimasi nominal yang diterima masing-masing syarik berdasarkan nisbah bagi hasil.
            </p>
          </div>
          {profitSharingReferenceGroup && (
            <div className="flex items-center gap-3">
              <div className="inline-flex rounded-xl bg-blue-50 px-4 py-3 text-right">
                <div>
                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-blue-500">Akad Acuan</span>
                  <span className="block text-sm font-bold text-blue-800">{profitSharingReferenceGroup.contractTitle}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingProfitSharing(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                <Edit2 size={15} />
                Edit di Sini
              </button>
              <Link
                href={`/syirkah/${profitSharingReferenceGroup.contractId}`}
                className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
              >
                Atur Alokasi
              </Link>
            </div>
          )}
        </div>

        {profitSharingReferenceGroup ? (
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-xl bg-slate-900 p-5 text-white shadow-lg">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Total Alokasi Bagi Hasil</p>
                  <div className="mt-2 text-3xl font-semibold tracking-tight">{formatRupiah(totalProfitSharingReference)}</div>
                </div>
                {!isEditingProfitSharing && (
                  <button
                    type="button"
                    onClick={() => setIsEditingProfitSharing(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/15"
                  >
                    <Edit2 size={14} />
                    Edit
                  </button>
                )}
              </div>

              {isEditingProfitSharing && (
                <div className="mt-4 rounded-xl bg-white/10 p-4">
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                    Nominal Alokasi Baru
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={profitSharingDraft}
                    onChange={(event) => setProfitSharingDraft(Number(event.target.value))}
                    className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950/40 px-4 py-3 text-lg font-bold text-white outline-none transition focus:border-blue-300"
                  />
                  <p className="mt-2 text-xs font-medium text-slate-300">
                    Isi 0 jika ingin kembali memakai basis default yang tersedia.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleSaveProfitSharingAllocation}
                      disabled={isSavingProfitSharing}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Save size={14} />
                      {isSavingProfitSharing ? 'Menyimpan...' : 'Simpan'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelProfitSharingEdit}
                      disabled={isSavingProfitSharing}
                      className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <X size={14} />
                      Batal
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-white/10 px-3 py-3">
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-300">
                    {profitSharingReferenceGroup.distributionSource === 'MANUAL_ALLOCATION' ? 'Alokasi Manual' : 'Basis Laba'}
                  </span>
                  <span className="mt-1 block font-bold text-white">
                    {formatRupiah(Number(profitSharingReferenceGroup.estimatedNetProfit || 0))}
                  </span>
                </div>
                <div className="rounded-xl bg-white/10 px-3 py-3">
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-300">Total Nisbah</span>
                  <span className="mt-1 block font-bold text-white">{totalReferenceNisbah}%</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="space-y-3">
                {profitSharingReferenceMembers.map((member: any) => (
                  <div
                    key={member.id || member.member_name}
                    className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="font-bold text-slate-800">{member.member_name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold">
                        <span className="rounded-full bg-white px-2.5 py-1 text-slate-500">{member.role}</span>
                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-700">{member.profit_share_percentage}% nisbah</span>
                      </div>
                    </div>
                    <div className="text-left md:text-right">
                      <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Estimasi Diterima</span>
                      <span className="block text-xl font-semibold tracking-tight text-blue-700">
                        {formatRupiah(Number(member.estimatedProfitAmount || 0))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6">
            <p className="text-sm font-semibold text-slate-700">
              {distributionContext?.mode === 'MULTIPLE_ACTIVE_CONTRACTS'
                ? 'Belum ada satu angka rujukan per syarik karena ada lebih dari satu akad ACTIVE atau COMPLETED. Sistem perlu laba bersih per akad agar alokasi tiap syarik akurat.'
                : 'Belum ada rujukan nominal per syarik. Aktifkan dulu akad syirkah agar dashboard bisa menghitung estimasi penerimaan masing-masing pihak.'}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {distributionContext?.message || 'Rujukan pembagian akan muncul otomatis setelah basis perhitungan siap.'}
            </p>
          </div>
        )}
      </div>

      {/* SYIRKAH CONTRACTS */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <Briefcase size={20} className="text-blue-600" />
            Daftar Akad Syirkah
          </h3>
        </div>

        {contracts.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
            <Handshake size={48} className="mx-auto text-slate-300 mb-4" />
            <h4 className="text-slate-700 font-bold mb-1">Belum Ada Kemitraan</h4>
            <p className="text-sm text-slate-500">Tambahkan judul akad baru di atas untuk memulai syirkah.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
                  <th className="pb-3 font-semibold pl-2">Judul Akad</th>
                  <th className="pb-3 font-semibold">Jenis</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold text-right">Estimasi Pembagian</th>
                  <th className="pb-3 font-semibold text-right">Hutang Berjalan</th>
                  <th className="pb-3 font-semibold text-center pr-2">Aksi</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {contracts.map((c: any, i: number) => {
                  const memberGroup = allMembers[i] || {}
                  const myMembers = memberGroup.members || []
                  const totalEst = myMembers.reduce((sum: number, m: any) => sum + (Number(m.estimatedProfitAmount) || 0), 0)

	                  return (
	                    <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                      <td className="py-4 pl-2 font-bold text-slate-800">{c.title}</td>
                      <td className="py-4">
                        <span className="px-2 py-1 text-xs font-bold rounded-lg bg-indigo-50 text-indigo-700 whitespace-nowrap">
                          {c.contract_type || '-'}
                        </span>
                      </td>
	                      <td className="py-4">
	                        <span className={`px-2 py-1 text-xs font-bold rounded-lg ${
	                          c.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
	                          c.status === 'SIGNING' ? 'bg-sky-100 text-sky-700' :
	                          c.status === 'COMPLETED' ? 'bg-slate-100 text-slate-700' :
	                          'bg-amber-100 text-amber-700'
	                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        {memberGroup.distributionStatus === 'ESTIMATED' ? (
                          <span className="font-bold text-blue-600">{formatRupiah(totalEst)}</span>
                        ) : memberGroup.distributionStatus === 'MULTIPLE_ACTIVE_UNALLOCATED' ? (
                          <span className="inline-flex rounded-lg bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">
                            Butuh laba per akad
                          </span>
                        ) : (
                          <span className="inline-flex rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                            Menunggu akad aktif
                          </span>
                        )}
                      </td>
                      <td className="py-4 text-right font-medium text-slate-600">
                        {formatRupiah(c.current_debt || 0)} <br/>
                        <span className="text-xs text-slate-400">Limit: {formatRupiah(c.debt_allocation || 0)}</span>
                      </td>
	                      <td className="py-4 pr-2 text-center">
	                        <div className="inline-flex items-center gap-1">
	                          <Link
	                            href={c.status === 'ACTIVE' || c.status === 'COMPLETED' ? `/syirkah/${c.id}` : `/syirkah/${c.id}?wizard=1`}
	                            className="inline-flex items-center justify-center p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition"
	                          >
                            <Eye size={18} />
                          </Link>
                          <button type="button"
                            onClick={() => handleDelete(c.id, c.title)}
                            disabled={deletingId === c.id}
                            className="inline-flex items-center justify-center p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Hapus akad"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {ConfirmUI}
    </div>
  )
}
