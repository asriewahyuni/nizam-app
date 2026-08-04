'use client'

import { useMemo, useState, useTransition } from 'react'
import { CheckCircle2, CircleAlert, Landmark, TriangleAlert } from 'lucide-react'
import type {
  CommerceAccountOption,
  CommerceAccountSettingsBranch,
  CommerceBankAccountOption,
  SaveCommerceBranchAccountSettingsInput,
} from '@/modules/ecommerce/lib/commerce-account-settings.server'
import { cn } from '@/lib/utils'

type FieldKey =
  | 'bankAccountId'
  | 'cashAccountId'
  | 'revenueAccountId'
  | 'taxPayableAccountId'
  | 'discountAccountId'
  | 'gatewayFeeAccountId'
  | 'affiliateCommissionExpenseAccountId'
  | 'affiliateCommissionPayableAccountId'
  | 'refundAccountId'

const ACCOUNT_TYPE_LABEL: Record<CommerceAccountOption['type'], string> = {
  ASSET: 'Aset',
  LIABILITY: 'Liabilitas',
  EQUITY: 'Ekuitas',
  REVENUE: 'Pendapatan',
  EXPENSE: 'Beban',
}

function AccountSelect({
  id,
  label,
  required,
  helperText,
  value,
  accounts,
  onChange,
}: {
  id: string
  label: string
  required?: boolean
  helperText?: string
  value: string
  accounts: CommerceAccountOption[]
  onChange: (value: string) => void
}) {
  const grouped = useMemo(() => {
    const groups = new Map<CommerceAccountOption['type'], CommerceAccountOption[]>()
    for (const account of accounts) {
      const list = groups.get(account.type) || []
      list.push(account)
      groups.set(account.type, list)
    }
    return groups
  }, [accounts])

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-bold text-slate-700">
        {label}
        {required && <span className="ml-1 text-rose-600">*</span>}
      </label>
      <select
        id={id}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-3.5 text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
      >
        <option value="">— Tidak dipetakan —</option>
        {Array.from(grouped.entries()).map(([type, list]) => (
          <optgroup key={type} label={ACCOUNT_TYPE_LABEL[type]}>
            {list.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} · {account.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {helperText && <p className="text-xs text-slate-400">{helperText}</p>}
    </div>
  )
}

export default function LmsAccountMappingForm({
  orgId,
  branches,
  accounts,
  bankAccounts,
  onSaveAction,
}: {
  orgId: string
  branches: CommerceAccountSettingsBranch[]
  accounts: CommerceAccountOption[]
  bankAccounts: CommerceBankAccountOption[]
  onSaveAction: (input: SaveCommerceBranchAccountSettingsInput) => Promise<{ success: boolean; error?: string }>
}) {
  const [activeBranchId, setActiveBranchId] = useState(branches[0]?.id || '')
  const [draftByBranch, setDraftByBranch] = useState<Record<string, Record<FieldKey, string>>>(() => (
    Object.fromEntries(branches.map((branch) => [branch.id, {
      bankAccountId: branch.settings.bankAccountId || '',
      cashAccountId: branch.settings.cashAccountId || '',
      revenueAccountId: branch.settings.revenueAccountId || '',
      taxPayableAccountId: branch.settings.taxPayableAccountId || '',
      discountAccountId: branch.settings.discountAccountId || '',
      gatewayFeeAccountId: branch.settings.gatewayFeeAccountId || '',
      affiliateCommissionExpenseAccountId: branch.settings.affiliateCommissionExpenseAccountId || '',
      affiliateCommissionPayableAccountId: branch.settings.affiliateCommissionPayableAccountId || '',
      refundAccountId: branch.settings.refundAccountId || '',
    }]))
  ))
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const activeBranch = branches.find((branch) => branch.id === activeBranchId) || null
  const draft = draftByBranch[activeBranchId]
  const branchBankAccounts = useMemo(
    () => bankAccounts.filter((account) => account.branchId === activeBranchId),
    [bankAccounts, activeBranchId],
  )

  function updateField(key: FieldKey, value: string) {
    setDraftByBranch((prev) => ({
      ...prev,
      [activeBranchId]: { ...prev[activeBranchId], [key]: value },
    }))
  }

  function handleSave(event: React.FormEvent) {
    event.preventDefault()
    if (!draft || !activeBranchId) return
    setMessage(null)
    startTransition(async () => {
      const result = await onSaveAction({
        branchId: activeBranchId,
        bankAccountId: draft.bankAccountId,
        revenueAccountId: draft.revenueAccountId,
        cashAccountId: draft.cashAccountId || null,
        taxPayableAccountId: draft.taxPayableAccountId || null,
        discountAccountId: draft.discountAccountId || null,
        gatewayFeeAccountId: draft.gatewayFeeAccountId || null,
        affiliateCommissionExpenseAccountId: draft.affiliateCommissionExpenseAccountId || null,
        affiliateCommissionPayableAccountId: draft.affiliateCommissionPayableAccountId || null,
        refundAccountId: draft.refundAccountId || null,
      })
      if (!result.success) {
        setMessage({ type: 'error', text: result.error || 'Pemetaan akun gagal disimpan.' })
        return
      }
      setMessage({ type: 'success', text: `Pemetaan akun Cabang "${activeBranch?.name}" berhasil disimpan.` })
    })
  }

  if (branches.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
        Belum ada Cabang aktif pada organisasi ini.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <input type="hidden" value={orgId} readOnly />

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        {branches.map((branch) => (
          <button
            key={branch.id}
            type="button"
            onClick={() => { setActiveBranchId(branch.id); setMessage(null) }}
            className={cn(
              'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100',
              branch.id === activeBranchId
                ? 'border-indigo-200 bg-indigo-50 text-indigo-800'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50',
            )}
          >
            <Landmark aria-hidden="true" size={16} />
            {branch.name}
            {branch.isComplete ? (
              <CheckCircle2 aria-hidden="true" className="text-emerald-600" size={15} />
            ) : (
              <TriangleAlert aria-hidden="true" className="text-amber-600" size={15} />
            )}
          </button>
        ))}
      </div>

      {message && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            'rounded-xl border px-4 py-3 text-sm font-semibold',
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800',
          )}
        >
          {message.text}
        </div>
      )}

      {activeBranch && draft && (
        <form onSubmit={handleSave} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-950">{activeBranch.name}</h2>
              <p className="mt-1 text-sm text-slate-600">
                Kode Cabang: <span className="font-mono">{activeBranch.code}</span>
              </p>
            </div>
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold',
                activeBranch.isComplete
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-amber-200 bg-amber-50 text-amber-800',
              )}
            >
              {activeBranch.isComplete ? <CheckCircle2 aria-hidden="true" size={14} /> : <TriangleAlert aria-hidden="true" size={14} />}
              {activeBranch.isComplete ? 'Lengkap' : 'Belum lengkap'}
            </span>
          </div>

          {branchBankAccounts.length === 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <CircleAlert aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
              <p>Cabang ini belum punya rekening bank aktif. Tambahkan rekening di modul Kas &amp; Bank terlebih dahulu.</p>
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="bank-account" className="text-xs font-bold text-slate-700">
                Rekening Penerimaan<span className="ml-1 text-rose-600">*</span>
              </label>
              <select
                id="bank-account"
                required
                value={draft.bankAccountId}
                onChange={(event) => updateField('bankAccountId', event.target.value)}
                className="min-h-11 w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-3.5 text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
              >
                <option value="">— Pilih rekening —</option>
                {branchBankAccounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.label}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400">Rekening yang menerima pembayaran manual/gateway untuk Cabang ini.</p>
            </div>

            <AccountSelect
              id="cash-account"
              label="Akun Kas/Bank (override)"
              helperText="Kosongkan untuk otomatis memakai akun COA milik rekening di atas."
              value={draft.cashAccountId}
              accounts={accounts}
              onChange={(value) => updateField('cashAccountId', value)}
            />

            <AccountSelect
              id="revenue-account"
              label="Akun Pendapatan"
              required
              helperText="Dikreditkan saat order dinyatakan lunas."
              value={draft.revenueAccountId}
              accounts={accounts}
              onChange={(value) => updateField('revenueAccountId', value)}
            />

            <AccountSelect
              id="tax-account"
              label="Akun Hutang Pajak (PPN Keluaran)"
              value={draft.taxPayableAccountId}
              accounts={accounts}
              onChange={(value) => updateField('taxPayableAccountId', value)}
            />

            <AccountSelect
              id="discount-account"
              label="Akun Diskon Penjualan"
              value={draft.discountAccountId}
              accounts={accounts}
              onChange={(value) => updateField('discountAccountId', value)}
            />

            <AccountSelect
              id="gateway-fee-account"
              label="Akun Biaya Payment Gateway"
              value={draft.gatewayFeeAccountId}
              accounts={accounts}
              onChange={(value) => updateField('gatewayFeeAccountId', value)}
            />

            <AccountSelect
              id="affiliate-expense-account"
              label="Akun Beban Komisi Afiliasi"
              value={draft.affiliateCommissionExpenseAccountId}
              accounts={accounts}
              onChange={(value) => updateField('affiliateCommissionExpenseAccountId', value)}
            />

            <AccountSelect
              id="affiliate-payable-account"
              label="Akun Hutang Komisi Afiliasi"
              value={draft.affiliateCommissionPayableAccountId}
              accounts={accounts}
              onChange={(value) => updateField('affiliateCommissionPayableAccountId', value)}
            />

            <AccountSelect
              id="refund-account"
              label="Akun Retur / Refund"
              value={draft.refundAccountId}
              accounts={accounts}
              onChange={(value) => updateField('refundAccountId', value)}
            />
          </div>

          <div className="flex justify-end border-t border-slate-100 pt-5">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 disabled:cursor-wait disabled:opacity-60"
            >
              {isPending ? 'Menyimpan...' : `Simpan pemetaan ${activeBranch.name}`}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
