'use client'

import React, { useState, useCallback, useEffect } from 'react'
import {
  ChevronRight, ChevronLeft, Check, Building2, Landmark, Users, ListTodo,
  PieChart, Shield, FileText, QrCode, AlertCircle, Link2, Plus, Trash2, Info, Scale
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import {
  upsertSyirkahContract, upsertSyirkahMember, deleteSyirkahMember,
  upsertSyirkahWitness, deleteSyirkahWitness,
} from '@/modules/syirkah/actions/syirkah.actions'
import {
  generateSyirkahClauses, calcWitnessWeight, isWitnessQuorumMet
} from '@/modules/syirkah/lib/syirkah.utils'
import { formatRupiah } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import type { SyirkahClause } from '@/modules/syirkah/lib/syirkah.utils'
import type { SyirkahMemberPayload, SyirkahWitnessPayload } from '@/modules/syirkah/actions/syirkah.actions'

const SYIRKAH_TYPES = [
  { value: 'Abdan', label: 'Abdan', desc: 'Kemitraan berbasis tenaga & keahlian, tanpa kontribusi modal finansial' },
  { value: 'Syirkah Inan', label: 'Syirkah Inan', desc: 'Modal & keahlian bersama, masing-masing pihak berkontribusi' },
  { value: 'Syirkah Mudharabah', label: 'Syirkah Mudharabah', desc: 'Pemodal (Shahibul Maal) + Pengelola (Mudharib)' },
  { value: 'Syirkah Wujuh', label: 'Syirkah Wujuh', desc: 'Berbasis reputasi & kepercayaan sebagai modal utama' },
  { value: 'Syirkah Muwafadhah', label: 'Syirkah Muwafadhah', desc: 'Kemitraan penuh sejajar — modal, tenaga, dan tanggung jawab setara' },
]

const DURATION_OPTIONS = [3, 6, 12, 18, 24, 36, 48, 60]

type Member = SyirkahMemberPayload & { id?: string; sign_token?: string; signed_at?: string }

function createDraftRowId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  const randomSegment = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0')
  return `${randomSegment()}${randomSegment()}-${randomSegment()}-4${randomSegment().slice(1)}-a${randomSegment().slice(1)}-${randomSegment()}${randomSegment()}${randomSegment()}`
}

function formatDateForInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toDateInputValue(value: unknown) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return formatDateForInput(value)
  }

  const raw = String(value || '').trim()
  if (!raw) return null

  const datePrefix = raw.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s]|$)/)
  if (datePrefix) return datePrefix[1]

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null
  return formatDateForInput(parsed)
}

const STEPS = [
  { id: 1, label: 'Informasi Usaha', icon: Building2 },
  { id: 2, label: 'Jenis & Durasi', icon: Landmark },
  { id: 3, label: 'Pelaku Syirkah', icon: Users },
  { id: 4, label: 'Tugas & Tanggung Jawab', icon: ListTodo },
  { id: 5, label: 'Saksi Akad', icon: Scale },
  { id: 6, label: 'Nisbah Bagi Hasil', icon: PieChart },
  { id: 7, label: 'Alokasi Hutang', icon: Shield },
  { id: 8, label: 'Drafting Akad', icon: FileText },
  { id: 9, label: 'Tanda Tangan', icon: QrCode },
]

const emptyMember = (): Member => ({
  id: createDraftRowId(),
  member_name: '', role: 'PENGELOLA', nik: '', address: '', phone: '', email: '',
  responsibility: '', profit_share_percentage: 0, capital_contribution: 0
})

type Witness = SyirkahWitnessPayload & { id?: string; sign_token?: string; signed_at?: string }

const emptyWitness = (): Witness => ({
  id: createDraftRowId(),
  witness_name: '', gender: 'LAKI-LAKI', nik: '', address: '', phone: ''
})

function normalizeLocalContractStatus(value: unknown) {
  const normalized = String(value || '').trim().toUpperCase()
  if (['DRAFT', 'SIGNING', 'ACTIVE', 'COMPLETED'].includes(normalized)) {
    return normalized as 'DRAFT' | 'SIGNING' | 'ACTIVE' | 'COMPLETED'
  }

  return 'DRAFT' as const
}

export default function SyirkahWizard({ orgId, contract, members: initialMembers, witnesses: initialWitnesses }: {
  orgId: string
  contract: any
  members: any[]
  witnesses: any[]
}) {
  const router = useRouter()

  // ─── Jenis Syirkah: helpers ─────────────────────────────────────────────────
  const isAbdan        = (t: string) => t === 'Abdan'
  // Inan & Muwafadhah: semua pihak = Pemodal sekaligus Pengelola
  const isAllManagers  = (t: string) => ['Syirkah Inan', 'Syirkah Muwafadhah', 'Syirkah Wujuh'].includes(t)
  // Mudharabah: ada pembeda Pemodal murni vs Pengelola murni
  const isMudharabah   = (t: string) => t === 'Syirkah Mudharabah'

  /** Tentukan role otomatis berdasarkan jenis syirkah */
  const autoRole = (t: string): 'PEMODAL' | 'PENGELOLA' | 'PEMODAL_PENGELOLA' => {
    if (isAbdan(t))       return 'PENGELOLA'
    if (isAllManagers(t)) return 'PEMODAL_PENGELOLA'
    return 'PENGELOLA' // Mudharabah: default PENGELOLA, user bisa ubah manual
  }

  const [step, setStep] = useState<number>(contract.wizard_step || 1)
  const [contractStatus, setContractStatus] = useState(normalizeLocalContractStatus(contract.status))
  const [saving, setSaving] = useState(false)
  const [contractId] = useState<string>(contract.id)

  // Step 1: Business Info
  const [businessName, setBusinessName] = useState(contract.business_name || '')
  const [businessDesc, setBusinessDesc] = useState(contract.business_description || '')
  const [businessDocUrl, setBusinessDocUrl] = useState(contract.business_document_url || '')

  // Step 2: Type & Duration
  const [contractType, setContractType] = useState(contract.contract_type || 'Syirkah Mudharabah')
  const [durationMonths, setDurationMonths] = useState(contract.duration_months || 12)
  const [startDate, setStartDate] = useState(
    toDateInputValue(contract.start_date) || formatDateForInput(new Date())
  )
  const [currency] = useState<string>(contract.currency || 'IDR')


  // Step 3 & 4: Members
  const [members, setMembers] = useState<Member[]>(
    initialMembers.length > 0
      ? initialMembers
      : [{ ...emptyMember(), role: autoRole(contract.contract_type || 'Syirkah Mudharabah') },
         { ...emptyMember(), role: autoRole(contract.contract_type || 'Syirkah Mudharabah') }]
  )

  // Step 5: Witnesses
  const [witnesses, setWitnesses] = useState<Witness[]>(
    initialWitnesses.length > 0 ? initialWitnesses : [emptyWitness(), emptyWitness()]
  )
  const witnessWeight = calcWitnessWeight(witnesses.filter(w => w.witness_name))
  const witnessQuorumMet = isWitnessQuorumMet(witnesses.filter(w => w.witness_name))

  // Step 6: Nisbah
  const totalNisbah = members.reduce((sum, m) => sum + Number(m.profit_share_percentage || 0), 0)
  const [profitSharingAllocation, setProfitSharingAllocation] = useState(contract.profit_sharing_allocation || 0)

  // Step 7: Debt
  const [debtAllocation, setDebtAllocation] = useState(contract.debt_allocation || 0)
  const [currentDebt, setCurrentDebt] = useState(contract.current_debt || 0)

  // Step 8: Clauses
  const [clauses, setClauses] = useState<SyirkahClause[]>(
    contract.clauses?.length > 0 ? contract.clauses : []
  )

  // Step 9: Signing
  const [origin, setOrigin] = useState('')
  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const updateMember = useCallback((index: number, field: keyof Member, value: any) => {
    setMembers(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m))
  }, [])

  const addMember = () => setMembers(prev => [...prev, emptyMember()])

  const removeMember = async (index: number) => {
    const m = members[index]
    if (m.id) { await deleteSyirkahMember(m.id, contractId) }
    setMembers(prev => prev.filter((_, i) => i !== index))
  }

  const updateWitness = (index: number, field: keyof Witness, value: any) => {
    setWitnesses(prev => prev.map((w, i) => i === index ? { ...w, [field]: value } : w))
  }

  const addWitness = () => setWitnesses(prev => [...prev, emptyWitness()])

  const removeWitness = async (index: number) => {
    const w = witnesses[index]
    if (w.id) { await deleteSyirkahWitness(w.id, contractId) }
    setWitnesses(prev => prev.filter((_, i) => i !== index))
  }

  // ─── Save & Navigate ───────────────────────────────────────────────────────

  const resolveDraftStatus = (targetStep: number) => {
    if (contractStatus === 'ACTIVE' || contractStatus === 'COMPLETED') {
      return contractStatus
    }

    if (targetStep >= 9 || contractStatus === 'SIGNING') {
      return 'SIGNING'
    }

    return 'DRAFT'
  }

  const saveProgress = async (targetStep: number) => {
    setSaving(true)
    try {
      const nextStatus = resolveDraftStatus(targetStep)
      const savedContract = await upsertSyirkahContract(orgId, {
        id: contractId,
        title: businessName || contract.title,
        business_name: businessName,
        business_description: businessDesc,
        business_document_url: businessDocUrl,
        contract_type: contractType,
        duration_months: durationMonths,
        start_date: startDate,
        debt_allocation: debtAllocation,
        profit_sharing_allocation: profitSharingAllocation,
        currency,

        current_debt: currentDebt,
        clauses: clauses.length > 0 ? clauses : undefined,
        wizard_step: targetStep,
        status: nextStatus,
      })

      // Save all members and keep returned ids/tokens in local state so
      // repeated saves update the same rows instead of inserting duplicates.
      const nextMembers: Member[] = []
      for (const member of members) {
        const normalizedRole = isMudharabah(contractType) ? member.role : autoRole(contractType)
        if (member.member_name) {
          const savedMember = await upsertSyirkahMember(contractId, {
            ...member,
            role: normalizedRole,
          })
          nextMembers.push({ ...member, ...savedMember, role: normalizedRole })
          continue
        }

        nextMembers.push({ ...member, role: normalizedRole })
      }
      setMembers(nextMembers)

      // Witnesses follow the same flow as members: once a row is saved, keep
      // the database id so the next wizard step performs an update.
      const nextWitnesses: Witness[] = []
      for (const witness of witnesses) {
        if (witness.witness_name) {
          const savedWitness = await upsertSyirkahWitness(contractId, witness)
          nextWitnesses.push({ ...witness, ...savedWitness })
          continue
        }

        nextWitnesses.push(witness)
      }
      setWitnesses(nextWitnesses)

      setContractStatus(normalizeLocalContractStatus(savedContract?.status || nextStatus))
      setStep(targetStep)
    } catch (e: any) {
      alert('Gagal menyimpan: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleNext = async () => {
    if (step === 8) {
      // Generate clauses before going to step 9
      const freshMembers = members.filter(m => m.member_name)
      const generated = generateSyirkahClauses({
        contract_type: contractType,
        business_name: businessName,
        business_description: businessDesc,
        duration_months: durationMonths,
        start_date: startDate,
      }, freshMembers)
      const finalClauses = clauses.length > 0 ? clauses : generated
      setClauses(finalClauses)
      await saveProgress(9)
    } else if (step < 9) {
      await saveProgress(step + 1)
    }
  }

  const handleBack = () => setStep(s => Math.max(1, s - 1))

  const handleGenerateClauses = () => {
    const freshMembers = members.filter(m => m.member_name)
    const freshWitnesses = witnesses.filter(w => w.witness_name)
    const generated = generateSyirkahClauses({
      contract_type: contractType,
      business_name: businessName,
      business_description: businessDesc,
      duration_months: durationMonths,
      start_date: startDate,
    }, freshMembers, freshWitnesses)
    setClauses(generated)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-0 min-h-screen bg-slate-50">
      {/* Progress Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide">
            {STEPS.map((s) => {
              const Icon = s.icon
              const done = step > s.id
              const active = step === s.id
              return (
                <React.Fragment key={s.id}>
                  <button
                    onClick={() => s.id < step && setStep(s.id)}
                    disabled={s.id > step}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                      done ? 'bg-emerald-100 text-emerald-700 cursor-pointer hover:bg-emerald-200' :
                      active ? 'bg-blue-600 text-white shadow-md' :
                      'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {done ? <Check size={12} /> : <Icon size={12} />}
                    {s.label}
                  </button>
                  {s.id < STEPS.length && <ChevronRight size={12} className="text-slate-300 shrink-0" />}
                </React.Fragment>
              )
            })}
          </div>
          <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-700"
              style={{ width: `${(step / STEPS.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto w-full px-4 py-8 flex-1">

        {/* ── STEP 1: Informasi Usaha ── */}
        {step === 1 && (
          <StepCard title="Informasi Usaha" desc="Deskripsikan usaha yang akan dijalankan bersama dalam akad ini." icon={Building2}>
            <Field label="Nama Usaha" required>
              <input
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                placeholder="Contoh: Usaha Kuliner Bersama Nusantara"
                className={inputCls}
              />
            </Field>
            <Field label="Deskripsi Usaha" required>
              <textarea
                value={businessDesc}
                onChange={e => setBusinessDesc(e.target.value)}
                rows={4}
                placeholder="Jelaskan bidang usaha, produk/jasa yang ditawarkan, dan target pasar..."
                className={inputCls}
              />
            </Field>
            <Field label="Link Dokumen Pendukung" hint="Google Drive, Dropbox, atau URL lainnya (opsional)">
              <div className="relative">
                <Link2 size={16} className="absolute left-3 top-3 text-slate-400" />
                <input
                  value={businessDocUrl}
                  onChange={e => setBusinessDocUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className={inputCls + ' pl-9'}
                />
              </div>
              {businessDocUrl && (
                <a href={businessDocUrl} target="_blank" rel="noopener noreferrer" className="mt-1 text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
                  <Link2 size={10} /> Buka Dokumen
                </a>
              )}
            </Field>
          </StepCard>
        )}

        {/* ── STEP 2: Jenis & Durasi ── */}
        {step === 2 && (
          <StepCard title="Jenis Syirkah & Durasi" desc="Pilih jenis akad syirkah dan tentukan durasi kerja sama." icon={Landmark}>
            <Field label="Pilih Jenis Syirkah" required>
              <div className="grid grid-cols-1 gap-3">
                {SYIRKAH_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setContractType(type.value)}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${
                      contractType === type.value
                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-semibold text-sm ${contractType === type.value ? 'text-blue-700' : 'text-slate-800'}`}>
                        {type.label}
                      </span>
                      {contractType === type.value && <Check size={16} className="text-blue-600 shrink-0" />}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{type.desc}</p>
                    {type.value === 'Abdan' && contractType === type.value && (
                      <div className="mt-2 px-2 py-1 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 font-bold flex items-center gap-1">
                        <Info size={11} /> Semua pihak berperan sebagai Pengelola — tidak ada modal finansial
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tanggal Mulai" required>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Durasi Akad" required>
                <select value={durationMonths} onChange={e => setDurationMonths(Number(e.target.value))} className={inputCls}>
                  {DURATION_OPTIONS.map(d => (
                    <option key={d} value={d}>{d} bulan</option>
                  ))}
                </select>
              </Field>
            </div>
            {startDate && durationMonths && (
              <div className="px-4 py-3 bg-blue-50 rounded-xl text-sm text-blue-700 font-medium">
                Akad berakhir pada: <span className="font-semibold">
                  {new Date(new Date(startDate).setMonth(new Date(startDate).getMonth() + durationMonths)).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
            )}
          </StepCard>
        )}

        {/* ── STEP 3: Pelaku Syirkah ── */}
        {step === 3 && (() => {
          const lockedRole = autoRole(contractType)
          const roleLabel = {
            'PENGELOLA': 'Pengelola',
            'PEMODAL': 'Pemodal',
            'PEMODAL_PENGELOLA': 'Pemodal & Pengelola',
          }[lockedRole] ?? lockedRole

          const infoMsg = isAbdan(contractType)
            ? 'Syirkah Abdan: Tidak ada kontribusi modal. Semua pihak adalah Pengelola.'
            : isMudharabah(contractType)
            ? 'Syirkah Mudharabah: Tentukan siapa Pemodal (Shahibul Maal) dan siapa Pengelola (Mudharib).'
            : `${contractType}: Seluruh pihak berperan sebagai Pemodal sekaligus Pengelola — masing-masing wajib menyetor modal.`

          return (
            <StepCard title="Data Pelaku Syirkah" desc="Lengkapi data identitas dan kontak setiap pihak yang bersyirkah." icon={Users}>
              <div className={`px-4 py-3 rounded-xl border flex items-start gap-2 text-sm font-medium ${
                isAbdan(contractType) ? 'bg-amber-50 border-amber-200 text-amber-800' :
                isMudharabah(contractType) ? 'bg-blue-50 border-blue-200 text-blue-800' :
                'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}>
                <Info size={16} className="shrink-0 mt-0.5" />
                <span>{infoMsg}</span>
              </div>

              <div className="space-y-6">
                {members.map((member, index) => (
                  <div key={index} className="bg-white border border-slate-200 rounded-xl p-5 relative">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-slate-800">Pihak {index + 1}</h4>
                      <div className="flex items-center gap-2">
                        {/* Role badge — locked jika bukan Mudharabah */}
                        {!isMudharabah(contractType) ? (
                          <span className={`px-2 py-1 text-xs font-semibold rounded-lg ${
                            lockedRole === 'PEMODAL_PENGELOLA' ? 'bg-emerald-100 text-emerald-700' :
                            lockedRole === 'PEMODAL' ? 'bg-blue-100 text-blue-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            🔒 {roleLabel}
                          </span>
                        ) : (
                          <select
                            value={member.role}
                            onChange={e => updateMember(index, 'role', e.target.value as any)}
                            className="px-2 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                          >
                            <option value="PEMODAL">PEMODAL (Shahibul Maal)</option>
                            <option value="PENGELOLA">PENGELOLA (Mudharib)</option>
                          </select>
                        )}
                        {members.length > 2 && (
                          <button onClick={() => removeMember(index)} className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field label="Nama Lengkap" required>
                        <input value={member.member_name} onChange={e => updateMember(index, 'member_name', e.target.value)} className={inputCls} placeholder="Nama sesuai KTP" />
                      </Field>
                      <Field label="NIK">
                        <input value={member.nik || ''} onChange={e => updateMember(index, 'nik', e.target.value)} className={inputCls} placeholder="16 digit NIK KTP" maxLength={16} />
                      </Field>
                      <Field label="No. Telepon / WhatsApp">
                        <input value={member.phone || ''} onChange={e => updateMember(index, 'phone', e.target.value)} className={inputCls} placeholder="08xxxxxxxxxx" />
                      </Field>
                      <Field label="Email">
                        <input type="email" value={member.email || ''} onChange={e => updateMember(index, 'email', e.target.value)} className={inputCls} placeholder="email@domain.com" />
                      </Field>
                      <div className="md:col-span-2">
                        <Field label="Alamat Lengkap">
                          <textarea value={member.address || ''} onChange={e => updateMember(index, 'address', e.target.value)} className={inputCls} rows={2} placeholder="Jl. Contoh No. 123, Kecamatan, Kota, Provinsi" />
                        </Field>
                      </div>
                      {/* Kontribusi modal: tampil untuk semua kecuali Abdan & Pengelola Mudharabah */}
                      {!isAbdan(contractType) && (lockedRole === 'PEMODAL_PENGELOLA' || member.role === 'PEMODAL') && (
                        <Field label="Kontribusi Modal (Rp)">
                          <MoneyInput
                            value={member.capital_contribution || 0}
                            onChange={val => updateMember(index, 'capital_contribution', val)}
                          />
                        </Field>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={addMember} className="flex items-center gap-2 w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-blue-400 hover:text-blue-600 transition text-sm font-bold justify-center">
                <Plus size={16} /> Tambah Pihak Lain
              </button>
            </StepCard>
          )
        })()}

        {/* ── STEP 4: Tugas & Tanggung Jawab ── */}
        {step === 4 && (
          <StepCard title="Tugas & Tanggung Jawab" desc="Uraikan tugas, wewenang, dan tanggung jawab masing-masing pihak." icon={ListTodo}>
            <div className="space-y-5">
              {members.filter(m => m.member_name).map((member, index) => (
                <div key={index} className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                      {member.member_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-800">{member.member_name}</h4>
                      <span className={`text-xs font-bold ${isAbdan(contractType) ? 'text-amber-600' : member.role === 'PEMODAL' ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {isAbdan(contractType) ? 'PENGELOLA (Abdan)' : member.role}
                      </span>
                    </div>
                  </div>
                  <Field label="Uraian Tugas, Wewenang & Tanggung Jawab">
                    <textarea
                      value={member.responsibility || ''}
                      onChange={e => updateMember(index, 'responsibility', e.target.value)}
                      rows={4}
                      className={inputCls}
                      placeholder="Contoh: Bertanggung jawab atas seluruh kegiatan operasional harian, termasuk pembelian bahan baku, produksi, dan pengiriman..."
                    />
                  </Field>
                </div>
              ))}
            </div>
          </StepCard>
        )}

        {/* ── STEP 5: Saksi Akad ── */}
        {step === 5 && (
          <StepCard title="Saksi Akad" desc="Tambahkan saksi akad syirkah. Ketentuan: Laki-laki = 1, Perempuan = ½. Minimal bobot total 2." icon={Scale}>
            <div className={`px-4 py-3 rounded-xl border flex items-start gap-2 text-sm font-medium ${
              witnessQuorumMet ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <Scale size={16} className="shrink-0 mt-0.5" />
              <div>
                <p>Bobot saksi saat ini: <strong>{witnessWeight}</strong> dari minimal <strong>2</strong></p>
                <p className="text-xs mt-0.5 opacity-80">Komposisi: {witnesses.filter(w => w.witness_name && w.gender === 'LAKI-LAKI').length} laki-laki (×1) + {witnesses.filter(w => w.witness_name && w.gender === 'PEREMPUAN').length} perempuan (×½)</p>
              </div>
              {witnessQuorumMet && <Check size={16} className="shrink-0 mt-0.5 text-emerald-600" />}
            </div>

            <div className="space-y-4">
              {witnesses.map((witness, index) => (
                <div key={index} className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-slate-800">Saksi {index + 1}</h4>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-lg ${
                        witness.gender === 'LAKI-LAKI' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'
                      }`}>
                        {witness.gender === 'LAKI-LAKI' ? '♂ L (×1)' : '♀ P (×½)'}
                      </span>
                      {witnesses.length > 2 && (
                        <button onClick={() => removeWitness(index)} className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Nama Lengkap Saksi" required>
                      <input value={witness.witness_name} onChange={e => updateWitness(index, 'witness_name', e.target.value)} className={inputCls} placeholder="Nama sesuai KTP" />
                    </Field>
                    <Field label="Jenis Kelamin">
                      <select value={witness.gender} onChange={e => updateWitness(index, 'gender', e.target.value)} className={inputCls}>
                        <option value="LAKI-LAKI">Laki-laki (bobot 1)</option>
                        <option value="PEREMPUAN">Perempuan (bobot ½)</option>
                      </select>
                    </Field>
                    <Field label="NIK">
                      <input value={witness.nik || ''} onChange={e => updateWitness(index, 'nik', e.target.value)} className={inputCls} placeholder="16 digit NIK KTP" maxLength={16} />
                    </Field>
                    <Field label="No. Telepon">
                      <input value={witness.phone || ''} onChange={e => updateWitness(index, 'phone', e.target.value)} className={inputCls} placeholder="08xxxxxxxxxx" />
                    </Field>
                    <div className="md:col-span-2">
                      <Field label="Alamat">
                        <textarea value={witness.address || ''} onChange={e => updateWitness(index, 'address', e.target.value)} className={inputCls} rows={2} placeholder="Alamat lengkap saksi" />
                      </Field>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={addWitness} className="flex items-center gap-2 w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-blue-400 hover:text-blue-600 transition text-sm font-bold justify-center">
              <Plus size={16} /> Tambah Saksi
            </button>

            <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 leading-relaxed">
              <strong className="text-slate-700">Ketentuan Saksi (Fiqh Muamalah):</strong><br />
              • Minimal 2 saksi (bobot total ≥ 2)<br />
              • 1 laki-laki = bobot 1 | 1 perempuan = bobot ½<br />
              • Contoh valid: 2 laki-laki, atau 1 laki-laki + 2 perempuan, atau 4 perempuan
            </div>
          </StepCard>
        )}

        {/* ── STEP 6: Nisbah Bagi Hasil (was 5) ── */}
        {step === 6 && (
          <StepCard title="Nisbah Bagi Hasil" desc="Tentukan persentase bagi hasil untuk setiap pihak. Total harus sama dengan 100%." icon={PieChart}>
            <Field
              label="Nominal Alokasi Bagi Hasil (Rp)"
              hint="Isi nominal laba yang benar-benar akan dibagikan. Jika kosong atau 0, sistem memakai basis default saat tersedia."
            >
              <MoneyInput
                value={profitSharingAllocation}
                onChange={setProfitSharingAllocation}
              />
            </Field>

            <div className="space-y-4">
              {members.filter(m => m.member_name).map((member, index) => (
                <div key={index} className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-xs">
                        {member.member_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{member.member_name}</p>
                        <p className="text-xs text-slate-500">{isAbdan(contractType) ? 'Pengelola' : member.role}</p>
                      </div>
                    </div>
                    <span className="text-2xl font-semibold text-blue-600">{member.profit_share_percentage}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={member.profit_share_percentage || 0}
                    onChange={e => updateMember(index, 'profit_share_percentage', Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>0%</span><span>50%</span><span>100%</span>
                  </div>
                </div>
              ))}
            </div>

            <div className={`px-5 py-4 rounded-xl flex items-center justify-between font-semibold text-lg ${
              totalNisbah === 100 ? 'bg-emerald-50 text-emerald-700' :
              totalNisbah > 100 ? 'bg-rose-50 text-rose-700' :
              'bg-amber-50 text-amber-700'
            }`}>
              <span>Total Nisbah</span>
              <div className="flex items-center gap-2">
                {totalNisbah !== 100 && <AlertCircle size={20} />}
                {totalNisbah === 100 && <Check size={20} />}
                <span>{totalNisbah}%</span>
              </div>
            </div>
            {totalNisbah !== 100 && (
              <p className="text-xs text-center text-rose-600 font-medium -mt-2">
                {totalNisbah > 100 ? `Kelebihan ${totalNisbah - 100}% — kurangi nisbah salah satu pihak` : `Kekurangan ${100 - totalNisbah}% — tambahkan ke salah satu pihak`}
              </p>
            )}

            {profitSharingAllocation > 0 && members.filter(m => m.member_name).length > 0 && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-blue-900">Preview Alokasi Nominal</h4>
                    <p className="text-sm text-blue-700">
                      Dengan alokasi {formatRupiah(profitSharingAllocation)}, estimasi nominal per syarik menjadi:
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700">
                    Basis {formatRupiah(profitSharingAllocation)}
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  {members.filter(m => m.member_name).map((member, index) => (
                    <div key={`${member.id || member.member_name}-${index}`} className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm">
                      <div>
                        <p className="font-bold text-slate-800">{member.member_name}</p>
                        <p className="text-xs font-medium text-slate-500">{member.profit_share_percentage}% nisbah</p>
                      </div>
                      <span className="font-semibold text-blue-700">
                        {formatRupiah((profitSharingAllocation * Number(member.profit_share_percentage || 0)) / 100)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </StepCard>
        )}

        {/* ── STEP 7: Alokasi Hutang (was 6) ── */}
        {step === 7 && (
          <StepCard title="Alokasi & Eksposur Hutang" desc="Tetapkan batas maksimum hutang yang diizinkan dalam kemitraan ini." icon={Shield}>
            <Field label="Limit Alokasi Hutang Keseluruhan (Rp)" hint="Batas maksimum hutang yang boleh ditanggung oleh usaha bersama ini">
              <input
                type="number"
                value={debtAllocation}
                onChange={e => setDebtAllocation(Number(e.target.value))}
                className={inputCls}
                placeholder="0"
              />
              <p className="text-xs text-slate-500 mt-1">{formatRupiah(debtAllocation)}</p>
            </Field>
            <Field label="Hutang Terserap Saat Ini (Rp)" hint="Jumlah hutang yang sudah berjalan sekarang">
              <input
                type="number"
                value={currentDebt}
                onChange={e => setCurrentDebt(Number(e.target.value))}
                className={inputCls}
                placeholder="0"
              />
              <p className="text-xs text-slate-500 mt-1">{formatRupiah(currentDebt)}</p>
            </Field>
            {debtAllocation > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex justify-between text-sm font-bold mb-2">
                  <span className="text-slate-600">Kapasitas Digunakan</span>
                  <span className={Number(currentDebt) / Number(debtAllocation) > 0.8 ? 'text-rose-600' : 'text-slate-700'}>
                    {((Number(currentDebt) / Number(debtAllocation)) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${Number(currentDebt) / Number(debtAllocation) > 0.8 ? 'bg-rose-500' : 'bg-amber-500'}`}
                    style={{ width: `${Math.min((Number(currentDebt) / Number(debtAllocation)) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </StepCard>
        )}

        {/* ── STEP 8: Drafting Akad (was 7) ── */}
        {step === 8 && (
          <StepCard title="Drafting Akad" desc="Review dan edit pasal-pasal akad yang telah digenerate secara otomatis." icon={FileText}>
            {clauses.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
                <FileText size={48} className="mx-auto text-slate-300 mb-4" />
                <h4 className="font-bold text-slate-700 mb-2">Pasal belum digenerate</h4>
                <p className="text-sm text-slate-500 mb-6">Klik tombol di bawah untuk generate pasal-pasal akad berdasarkan data yang telah Anda masukkan.</p>
                <button
                  onClick={handleGenerateClauses}
                  className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition"
                >
                  Generate Pasal Otomatis
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-slate-500">{clauses.length} pasal digenerate berdasarkan jenis <strong className="text-slate-700">{contractType}</strong></p>
                  <button onClick={handleGenerateClauses} className="text-xs text-blue-600 hover:underline font-bold">Regenerate</button>
                </div>
                {clauses.map((clause, idx) => (
                  <div key={idx} className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center shrink-0">{clause.number}</span>
                      <input
                        value={clause.title}
                        onChange={e => {
                          const next = [...clauses]
                          next[idx] = { ...clause, title: e.target.value }
                          setClauses(next)
                        }}
                        className="font-semibold text-slate-800 text-sm border-b border-transparent hover:border-slate-300 focus:border-blue-400 outline-none flex-1 bg-transparent"
                      />
                    </div>
                    <textarea
                      value={clause.content}
                      onChange={e => {
                        const next = [...clauses]
                        next[idx] = { ...clause, content: e.target.value }
                        setClauses(next)
                      }}
                      rows={5}
                      className="w-full text-sm text-slate-600 leading-relaxed border border-slate-100 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-100 hover:border-slate-200 resize-none font-mono"
                    />
                  </div>
                ))}
              </div>
            )}
          </StepCard>
        )}

        {/* ── STEP 9: Tanda Tangan (was 8) ── */}
        {step === 9 && (
          <StepCard title="Tanda Tangan Digital" desc="Masing-masing pihak dan saksi melakukan tanda tangan digital dengan scan QR Code." icon={QrCode}>
            <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wider">Para Pihak Bersyirkah</h3>
            <div className="space-y-4">
              {members.filter(m => m.member_name && m.sign_token).map((member, index) => {
                const signUrl = `${origin}/syirkah-sign/${member.sign_token}`
                return (
                  <div key={index} className={`bg-white border-2 rounded-xl p-6 text-center ${member.signed_at ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200'}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-left">
                        <h4 className="font-semibold text-slate-800">{member.member_name}</h4>
                        <p className="text-xs text-slate-500">{isAbdan(contractType) ? 'Pengelola' : member.role}</p>
                      </div>
                      {member.signed_at ? (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
                          <Check size={12} /> Sudah Tandatangan
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                          Menunggu TTD
                        </span>
                      )}
                    </div>

                    {!member.signed_at && (
                      <>
                        <div className="flex justify-center p-4 bg-slate-50 rounded-xl border border-slate-100 mb-3">
                          <QRCodeSVG value={signUrl} size={160} level="H" includeMargin />
                        </div>
                        <p className="text-xs text-slate-500 mb-2">Scan QR atau buka link:</p>
                        <a href={signUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs font-mono text-blue-600 hover:underline break-all">
                          {signUrl}
                        </a>
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="px-5 py-4 bg-blue-50 rounded-xl text-sm text-blue-700">
              <p className="font-bold mb-1">Instruksi:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Bagikan QR Code kepada masing-masing pihak</li>
                <li>Setiap pihak scan QR Code-nya masing-masing</li>
                <li>Buka link → baca akad → klik &quot;Saya Setuju & Tandatangani&quot;</li>
                <li>Setelah semua pihak TTD, status akad berubah menjadi ACTIVE dan modal baru siap dicatat ke Core</li>
              </ol>
            </div>

            <div className="flex justify-between pt-4">
              <button onClick={handleBack} className="px-5 py-2.5 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition flex items-center gap-2">
                <ChevronLeft size={16} /> Kembali
              </button>
              <button
                onClick={() => router.push(`/syirkah/${contractId}`)}
                className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition flex items-center gap-2"
              >
                <Check size={16} /> Selesai — Lihat Akad
              </button>
            </div>
          </StepCard>
        )}

      </div>

      {/* Navigation Footer */}
      {step < 9 && (
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 shadow-lg">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <button
              onClick={handleBack}
              disabled={step === 1 || saving}
              className="px-5 py-2.5 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition flex items-center gap-2 disabled:opacity-40"
            >
              <ChevronLeft size={16} /> Kembali
            </button>
            <span className="text-xs text-slate-400 font-medium">Langkah {step} dari {STEPS.length}</span>
            <button
              onClick={handleNext}
              disabled={saving || (step === 6 && totalNisbah !== 100) || (step === 5 && !witnessQuorumMet)}
              className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              {saving ? 'Menyimpan...' : step === 8 ? 'Finalisasi & Tanda Tangan' : 'Lanjut'}
              {!saving && <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Helper Components ──────────────────────────────────────────────────────

function StepCard({ title, desc, icon: Icon, children }: {
  title: string; desc: string; icon: any; children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-md">
            <Icon size={20} className="text-white" />
          </div>
          <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
        </div>
        <p className="text-sm text-slate-500 ml-[52px]">{desc}</p>
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </div>
  )
}

function Field({ label, children, required, hint }: {
  label: string; children: React.ReactNode; required?: boolean; hint?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {hint && <p className="text-xs text-slate-400 -mt-0.5 mb-1">{hint}</p>}
      {children}
    </div>
  )
}

const inputCls = 'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent hover:border-slate-300 transition bg-white'

/**
 * MoneyInput — input teks dengan format ribuan (titik) standar Indonesia.
 * Menyimpan nilai sebagai number murni, menampilkan dengan pemisah titik.
 * Contoh: 1000000 ditampilkan sebagai "1.000.000"
 */
function MoneyInput({ value, onChange }: { value: number; onChange: (val: number) => void }) {
  const [display, setDisplay] = React.useState(
    value > 0 ? value.toLocaleString('id-ID') : ''
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Hanya izinkan digit dan titik
    const raw = e.target.value.replace(/[^0-9]/g, '')
    const num = raw === '' ? 0 : parseInt(raw, 10)
    setDisplay(num > 0 ? num.toLocaleString('id-ID') : '')
    onChange(num)
  }

  const handleBlur = () => {
    setDisplay(value > 0 ? value.toLocaleString('id-ID') : '')
  }

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 pointer-events-none">Rp</span>
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="0"
        className={inputCls + ' pl-9 font-mono tracking-wide'}
      />
      {value > 0 && (
        <p className="text-xs text-slate-400 mt-1">
          {value.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })}
        </p>
      )}
    </div>
  )
}
