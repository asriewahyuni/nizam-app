'use client'

/**
 * CoaRequestClient.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Halaman Pengajuan & Persetujuan Rekening CoA
 *
 * Tampilan berbeda berdasar peran:
 *   • Parent/Holding → Tab "Permintaan Masuk" + review approve/reject
 *   • Child/Branch   → Form pengajuan request + tab "Riwayat Pengajuan"
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useTransition, useCallback } from 'react'
import type { CoaRequestSummary, CoaRequestStatus } from '@/modules/accounting/actions/coa-request.actions'
import {
  submitCoaRequest,
  approveCoaRequest,
  rejectCoaRequest,
  cancelCoaRequest,
} from '@/modules/accounting/actions/coa-request.actions'

// ─── Types ─────────────────────────────────────────────────────────────────

type Props = {
  orgId: string
  orgName: string
  parentOrgId: string | null
  isParentOrg: boolean
  canManageDirect: boolean
  incomingRequests: CoaRequestSummary[]
  myRequests: CoaRequestSummary[]
  parentCoaGuideAccounts: ParentCoaGuideAccount[]
  userRole: string
}

type TabId = 'incoming' | 'my-requests' | 'new-request'

type ParentCoaGuideAccount = {
  id: string
  code: string
  name: string
  type: string
  normal_balance: string
  parent_id: string | null
}

type ParentAccountOption = {
  account: ParentCoaGuideAccount
  depth: number
}

const STATUS_CONFIG: Record<CoaRequestStatus, { label: string; color: string; bg: string; dot: string }> = {
  pending:   { label: 'Menunggu',  color: '#92400e', bg: '#fef3c7', dot: '#f59e0b' },
  approved:  { label: 'Disetujui', color: '#065f46', bg: '#d1fae5', dot: '#10b981' },
  rejected:  { label: 'Ditolak',   color: '#991b1b', bg: '#fee2e2', dot: '#ef4444' },
  cancelled: { label: 'Dibatalkan',color: '#374151', bg: '#f3f4f6', dot: '#9ca3af' },
}

const ACCOUNT_TYPES = [
  { value: 'ASSET',     label: 'Aset' },
  { value: 'LIABILITY', label: 'Liabilitas' },
  { value: 'EQUITY',    label: 'Ekuitas' },
  { value: 'REVENUE',   label: 'Pendapatan' },
  { value: 'EXPENSE',   label: 'Beban' },
]

function buildParentAccountOptions(accounts: ParentCoaGuideAccount[]): ParentAccountOption[] {
  const options: ParentAccountOption[] = []
  if (!Array.isArray(accounts) || accounts.length === 0) return options

  const childrenByParentId = new Map<string, ParentCoaGuideAccount[]>()
  const ROOT_PARENT = '__ROOT__'

  for (const account of accounts) {
    const parentId = account.parent_id || ROOT_PARENT
    const existing = childrenByParentId.get(parentId) || []
    existing.push(account)
    childrenByParentId.set(parentId, existing)
  }

  for (const [, children] of childrenByParentId.entries()) {
    children.sort((left, right) => left.code.localeCompare(right.code))
  }

  const visitedAccountIds = new Set<string>()

  const appendChildren = (parentId: string, depth: number) => {
    const children = childrenByParentId.get(parentId) || []
    for (const child of children) {
      if (visitedAccountIds.has(child.id)) continue
      visitedAccountIds.add(child.id)
      options.push({ account: child, depth })
      appendChildren(child.id, depth + 1)
    }
  }

  appendChildren(ROOT_PARENT, 0)
  return options
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CoaRequestStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── RequestCard (untuk Parent - incoming list) ──────────────────────────────

function RequestCard({
  req,
  onApprove,
  onReject,
}: {
  req: CoaRequestSummary
  onApprove: (id: string, notes: string) => void
  onReject: (id: string, notes: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [reviewNotes, setReviewNotes] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)

  const isPending = req.status === 'pending'

  return (
    <div
      className="bg-white border rounded-xl overflow-hidden transition-all"
      style={{ borderColor: isPending ? '#fbbf24' : '#e5e7eb' }}
    >
      {/* Header */}
      <div
        className="flex items-start gap-4 p-4 cursor-pointer select-none hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        {/* Left */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
              {req.proposed_code}
            </span>
            <span className="text-sm font-semibold text-gray-900 truncate">{req.proposed_name}</span>
            <StatusBadge status={req.status} />
          </div>
          <p className="text-xs text-gray-500">
            dari <strong>{req.requester_org_name ?? '—'}</strong>
            {req.requester_branch_name ? ` · cab. ${req.requester_branch_name}` : ''}
            {' · '}{formatDate(req.created_at)}
          </p>
        </div>
        {/* Chevron */}
        <svg
          className={`w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Body */}
      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3" style={{ borderColor: '#f3f4f6' }}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Tipe', value: ACCOUNT_TYPES.find(t => t.value === req.proposed_type)?.label ?? req.proposed_type },
              { label: 'Saldo Normal', value: req.proposed_normal_balance === 'DEBIT' ? 'Debit' : 'Kredit' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-lg p-2.5">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {req.proposed_description && (
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Deskripsi</p>
              <p className="text-sm text-gray-700">{req.proposed_description}</p>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
            <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide mb-1">
              ⚡ Alasan Bisnis (dari Pengaju)
            </p>
            <p className="text-sm text-amber-900">{req.business_reason}</p>
          </div>

          {/* Review notes (if already reviewed) */}
          {req.review_notes && (
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Catatan Review
              </p>
              <p className="text-sm text-gray-700">{req.review_notes}</p>
            </div>
          )}

          {/* Created account info */}
          {req.created_account_id && (
            <div className="bg-green-50 border border-green-100 rounded-lg p-3 flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <p className="text-sm text-green-800">
                Rekening dibuat: <strong>{req.created_account_code}</strong> — {req.created_account_name}
              </p>
            </div>
          )}

          {/* Actions for pending */}
          {isPending && (
            <div className="pt-1 space-y-3">
              {/* Approve with optional notes */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Catatan Persetujuan (opsional)
                </label>
                <textarea
                  value={showRejectForm ? '' : reviewNotes}
                  onChange={e => { setShowRejectForm(false); setReviewNotes(e.target.value) }}
                  placeholder="Mis: Disetujui. Kode disesuaikan dengan segmen 5.1.x..."
                  rows={2}
                  className="w-full text-sm border border-gray-200 rounded-lg p-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => { setShowRejectForm(false); onApprove(req.id, reviewNotes) }}
                  className="flex-1 min-w-[120px] py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Setujui & Buat Rekening
                </button>
                <button
                  onClick={() => setShowRejectForm(v => !v)}
                  className="flex-1 min-w-[100px] py-2.5 bg-red-50 text-red-700 text-sm font-semibold rounded-lg border border-red-200 hover:bg-red-100 transition-colors"
                >
                  Tolak
                </button>
              </div>

              {showRejectForm && (
                <div className="space-y-2">
                  <textarea
                    value={reviewNotes}
                    onChange={e => setReviewNotes(e.target.value)}
                    placeholder="Wajib: tuliskan alasan penolakan untuk pengaju..."
                    rows={3}
                    className="w-full text-sm border border-red-200 rounded-lg p-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                  <button
                    onClick={() => reviewNotes.trim() && onReject(req.id, reviewNotes)}
                    disabled={!reviewNotes.trim()}
                    className="w-full py-2.5 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Konfirmasi Penolakan
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── MyRequestCard (untuk Child - own requests) ──────────────────────────────

function MyRequestCard({
  req,
  onCancel,
}: {
  req: CoaRequestSummary
  onCancel: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-white border rounded-xl overflow-hidden transition-all" style={{ borderColor: '#e5e7eb' }}>
      <div
        className="flex items-start gap-4 p-4 cursor-pointer select-none hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
              {req.proposed_code}
            </span>
            <span className="text-sm font-semibold text-gray-900">{req.proposed_name}</span>
            <StatusBadge status={req.status} />
          </div>
          <p className="text-xs text-gray-400">{formatDate(req.created_at)}</p>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3" style={{ borderColor: '#f3f4f6' }}>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Tipe', value: ACCOUNT_TYPES.find(t => t.value === req.proposed_type)?.label ?? req.proposed_type },
              { label: 'Saldo Normal', value: req.proposed_normal_balance === 'DEBIT' ? 'Debit' : 'Kredit' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-lg p-2.5">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {req.business_reason && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
              <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide mb-1">Alasan Bisnis</p>
              <p className="text-sm text-amber-900">{req.business_reason}</p>
            </div>
          )}

          {req.review_notes && (
            <div className={`rounded-lg p-3 border ${req.status === 'approved' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
              <p className={`text-[11px] font-semibold uppercase tracking-wide mb-1 ${req.status === 'approved' ? 'text-green-700' : 'text-red-700'}`}>
                {req.status === 'approved' ? '✓ Catatan Persetujuan' : '✗ Alasan Penolakan'}
              </p>
              <p className="text-sm text-gray-800">{req.review_notes}</p>
            </div>
          )}

          {req.status === 'approved' && req.created_account_code && (
            <div className="bg-green-50 border border-green-100 rounded-lg p-3">
              <p className="text-sm text-green-800">
                ✓ Rekening telah dibuat: <strong>{req.created_account_code}</strong> — {req.created_account_name}
              </p>
            </div>
          )}

          {req.status === 'pending' && (
            <button
              onClick={() => onCancel(req.id)}
              className="text-sm text-red-600 hover:text-red-800 font-medium underline underline-offset-2"
            >
              Batalkan pengajuan ini
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── SubmitRequestForm ────────────────────────────────────────────────────────

function SubmitRequestForm({
  orgId,
  parentOrgId,
  coaGuideAccounts,
  onSuccess,
}: {
  orgId: string
  parentOrgId: string
  coaGuideAccounts: ParentCoaGuideAccount[]
  onSuccess: (req: CoaRequestSummary) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    code: '', name: '', type: 'ASSET', normalBalance: 'DEBIT',
    parentId: '', description: '', businessReason: '',
  })

  const update = (key: keyof typeof form, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const handleSubmit = () => {
    if (!form.code || !form.name || !form.businessReason.trim()) {
      setError('Kode, Nama, dan Alasan Bisnis wajib diisi.')
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await submitCoaRequest({
        parentOrgId,
        requesterOrgId: orgId,
        proposedCode: form.code,
        proposedName: form.name,
        proposedType: form.type,
        proposedNormalBalance: form.normalBalance,
        proposedParentId: form.parentId || null,
        proposedDescription: form.description || null,
        businessReason: form.businessReason,
      })

      if (res.error) {
        setError(res.error)
        return
      }

      // Optimistic: tambah ke list (partial data)
      onSuccess({
        id: res.requestId!,
        org_id: parentOrgId,
        requester_org_id: orgId,
        requester_org_name: null,
        requester_branch_id: null,
        requester_branch_name: null,
        requested_by: '',
        proposed_code: form.code,
        proposed_name: form.name,
        proposed_type: form.type,
        proposed_normal_balance: form.normalBalance,
        proposed_description: form.description || null,
        business_reason: form.businessReason,
        status: 'pending',
        reviewed_by: null,
        reviewed_at: null,
        review_notes: null,
        created_account_id: null,
        created_account_code: null,
        created_account_name: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      setForm({ code: '', name: '', type: 'ASSET', normalBalance: 'DEBIT', parentId: '', description: '', businessReason: '' })
    })
  }

  const inputCls = "w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white transition-all"
  const labelCls = "block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5"
  const parentAccountOptions = buildParentAccountOptions(coaGuideAccounts)

  return (
    <div className="bg-white border border-dashed border-blue-200 rounded-xl p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 pb-2 border-b border-gray-100">
        <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">Ajukan Rekening CoA Baru</h3>
          <p className="text-xs text-gray-500">Request ini akan dikirim ke Parent/Holding untuk disetujui</p>
        </div>
      </div>

      {parentAccountOptions.length > 0 && (
        <div className="space-y-2">
          <label className={labelCls}>Akun Induk (Parent Account)</label>
          <select
            value={form.parentId}
            onChange={(e) => {
              const nextParentId = e.target.value
              const selectedParent = parentAccountOptions.find((option) => option.account.id === nextParentId)?.account
              setForm((prev) => ({
                ...prev,
                parentId: nextParentId,
                type: selectedParent?.type || prev.type,
                normalBalance: selectedParent?.normal_balance || prev.normalBalance,
              }))
            }}
            className={inputCls}
          >
            <option value="">-- Tidak Ada (Header Utama) --</option>
            {parentAccountOptions.map(({ account, depth }) => (
              <option key={account.id} value={account.id}>
                [{account.code}] {`${depth > 0 ? `${'— '.repeat(Math.min(depth, 4))}` : ''}${account.name}`} {depth === 0 ? '• Root' : ''}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500">
            Struktur root & turunan dirapikan seperti daftar CoA agar mudah memilih parent yang tepat.
          </p>
        </div>
      )}

      {/* Form */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Kode Akun yang Diusulkan *</label>
          <input
            type="text"
            value={form.code}
            onChange={e => update('code', e.target.value)}
            placeholder="Mis: 6210"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Nama Akun *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => update('name', e.target.value)}
            placeholder="Mis: Beban Operasional Cabang"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Tipe Akun *</label>
          <select value={form.type} onChange={e => update('type', e.target.value)} className={inputCls}>
            {ACCOUNT_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Saldo Normal *</label>
          <select value={form.normalBalance} onChange={e => update('normalBalance', e.target.value)} className={inputCls}>
            <option value="DEBIT">Debit</option>
            <option value="CREDIT">Kredit</option>
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Deskripsi Akun (opsional)</label>
        <input
          type="text"
          value={form.description}
          onChange={e => update('description', e.target.value)}
          placeholder="Penjelasan singkat fungsi akun ini..."
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls}>
          ⚡ Alasan Bisnis / Justifikasi *
        </label>
        <textarea
          value={form.businessReason}
          onChange={e => update('businessReason', e.target.value)}
          placeholder="Jelaskan mengapa rekening ini diperlukan. Mis: Untuk memisahkan beban marketing cabang dari beban pusat karena cabang memiliki program promo mandiri..."
          rows={4}
          className={`${inputCls} resize-none`}
        />
        <p className="text-xs text-gray-400 mt-1">
          Alasan yang jelas akan mempercepat proses persetujuan dari Parent.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
          <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={isPending}
        className="w-full py-3 text-sm font-bold text-white rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ background: isPending ? '#93c5fd' : 'linear-gradient(135deg, #2563eb, #3b82f6)' }}
      >
        {isPending ? 'Mengirim Pengajuan...' : 'Kirim Pengajuan ke Parent →'}
      </button>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CoaRequestClient({
  orgId,
  orgName,
  parentOrgId,
  isParentOrg,
  canManageDirect,
  incomingRequests: initialIncoming,
  myRequests: initialMy,
  parentCoaGuideAccounts,
  userRole,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>(isParentOrg ? 'incoming' : 'new-request')
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [incomingRequests, setIncomingRequests] = useState(initialIncoming)
  const [myRequests, setMyRequests] = useState(initialMy)
  const [statusFilter, setStatusFilter] = useState<CoaRequestStatus | 'all'>('all')

  const showToast = useCallback((msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

  const handleApprove = useCallback((id: string, notes: string) => {
    startTransition(async () => {
      const res = await approveCoaRequest(id, notes)
      if (res.error) { showToast(res.error, 'error'); return }
      setIncomingRequests(prev =>
        prev.map(r => r.id === id ? { ...r, status: 'approved', review_notes: notes } : r)
      )
      showToast('Rekening berhasil dibuat dan request disetujui!', 'success')
    })
  }, [showToast])

  const handleReject = useCallback((id: string, notes: string) => {
    startTransition(async () => {
      const res = await rejectCoaRequest(id, notes)
      if (res.error) { showToast(res.error, 'error'); return }
      setIncomingRequests(prev =>
        prev.map(r => r.id === id ? { ...r, status: 'rejected', review_notes: notes } : r)
      )
      showToast('Request berhasil ditolak.', 'success')
    })
  }, [showToast])

  const handleCancel = useCallback((id: string) => {
    startTransition(async () => {
      const res = await cancelCoaRequest(id)
      if (res.error) { showToast(res.error, 'error'); return }
      setMyRequests(prev =>
        prev.map(r => r.id === id ? { ...r, status: 'cancelled' } : r)
      )
      showToast('Pengajuan berhasil dibatalkan.', 'success')
    })
  }, [showToast])

  const handleNewRequest = useCallback((req: CoaRequestSummary) => {
    setMyRequests(prev => [req, ...prev])
    setActiveTab('my-requests')
    showToast('Pengajuan berhasil dikirim ke Parent!', 'success')
  }, [showToast])

  // Filter requests berdasarkan status
  const filteredIncoming = statusFilter === 'all'
    ? incomingRequests
    : incomingRequests.filter(r => r.status === statusFilter)

  const filteredMy = statusFilter === 'all'
    ? myRequests
    : myRequests.filter(r => r.status === statusFilter)

  const pendingCount = incomingRequests.filter(r => r.status === 'pending').length
  const myPendingCount = myRequests.filter(r => r.status === 'pending').length

  const tabs = isParentOrg
    ? [
        { id: 'incoming' as TabId, label: 'Permintaan Masuk', count: pendingCount },
      ]
    : [
        { id: 'new-request' as TabId, label: '+ Ajukan Request', count: 0 },
        { id: 'my-requests' as TabId, label: 'Riwayat Saya', count: myPendingCount },
      ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold animate-fade-in max-w-sm"
          style={{
            background: toast.type === 'success' ? '#d1fae5' : '#fee2e2',
            borderColor: toast.type === 'success' ? '#a7f3d0' : '#fecaca',
            color: toast.type === 'success' ? '#065f46' : '#991b1b',
          }}
        >
          <span>{toast.type === 'success' ? '✓' : '✗'}</span>
          {toast.msg}
        </div>
      )}

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{
                  background: isParentOrg ? '#dbeafe' : '#ede9fe',
                  color: isParentOrg ? '#1e40af' : '#5b21b6',
                }}
              >
                {isParentOrg ? '🏛 Parent / Holding' : '🏢 Child / Cabang'}
              </div>
              <span className="text-xs text-gray-400">{orgName}</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Pengendalian Rekening CoA</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {isParentOrg
                ? 'Review dan setujui permintaan rekening dari anak perusahaan & cabang'
                : 'Ajukan rekening baru ke Parent untuk disetujui terlebih dahulu'}
            </p>
          </div>

          {/* Info box */}
          <div
            className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl text-xs border"
            style={{ background: '#f0f9ff', borderColor: '#bae6fd', color: '#0369a1' }}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Kebijakan: hanya Parent yang bisa<br />membuat rekening CoA secara langsung</span>
          </div>
        </div>

        {/* Hierarchy Diagram */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Alur Pengendalian Rekening</p>
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              <span className="text-base">🏛</span>
              <div>
                <p className="text-xs font-bold text-blue-800">Parent/Holding</p>
                <p className="text-[10px] text-blue-600">Buat langsung ✓</p>
              </div>
            </div>
            <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <div className="flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
              <span className="text-base">🏢</span>
              <div>
                <p className="text-xs font-bold text-purple-800">Child/Anak Perusahaan</p>
                <p className="text-[10px] text-purple-600">Wajib request ke Parent</p>
              </div>
            </div>
            <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <div className="flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
              <span className="text-base">🏪</span>
              <div>
                <p className="text-xs font-bold text-orange-800">Branch/Cabang</p>
                <p className="text-[10px] text-orange-600">Wajib request ke Parent</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setStatusFilter('all') }}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="w-5 h-5 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Status Filter (for list tabs) */}
        {activeTab !== 'new-request' && (
          <div className="flex items-center gap-2 flex-wrap">
            {(['all', 'pending', 'approved', 'rejected', 'cancelled'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                  statusFilter === s
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                {s === 'all' ? 'Semua' : STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
        )}

        {/* Tab Content */}
        {isPending && (
          <div className="text-center py-6 text-sm text-gray-400">Memproses...</div>
        )}

        {/* Parent: Incoming Requests */}
        {activeTab === 'incoming' && (
          <div className="space-y-3">
            {filteredIncoming.length === 0 ? (
              <div className="bg-white border border-dashed border-gray-200 rounded-xl p-6 text-center">
                <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <p className="text-gray-400 text-sm">Belum ada permintaan rekening yang masuk</p>
              </div>
            ) : (
              filteredIncoming.map(req => (
                <RequestCard
                  key={req.id}
                  req={req}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              ))
            )}
          </div>
        )}

        {/* Child: New Request Form */}
        {activeTab === 'new-request' && parentOrgId && (
          <SubmitRequestForm
            orgId={orgId}
            parentOrgId={parentOrgId}
            coaGuideAccounts={parentCoaGuideAccounts}
            onSuccess={handleNewRequest}
          />
        )}

        {/* Child: My Requests */}
        {activeTab === 'my-requests' && (
          <div className="space-y-3">
            {filteredMy.length === 0 ? (
              <div className="bg-white border border-dashed border-gray-200 rounded-xl p-6 text-center">
                <p className="text-gray-400 text-sm">Belum ada pengajuan rekening yang dibuat</p>
                <button
                  onClick={() => setActiveTab('new-request')}
                  className="mt-4 text-sm text-blue-600 font-semibold hover:underline"
                >
                  Buat Pengajuan Pertama →
                </button>
              </div>
            ) : (
              filteredMy.map(req => (
                <MyRequestCard
                  key={req.id}
                  req={req}
                  onCancel={handleCancel}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
