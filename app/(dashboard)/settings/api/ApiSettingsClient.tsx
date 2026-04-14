'use client'

/**
 * app/(dashboard)/settings/api/ApiSettingsClient.tsx
 *
 * UI Pengaturan Open API Nizam — 3 tab:
 * 1. API Keys   — generate, tampilkan (sekali), revoke
 * 2. Cash In    — mapping akun penerima + parameter
 * 3. Cash Out   — mapping akun sumber + parameter
 * + Webhook section di bawah konfigurasi
 */

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Key, Plus, Trash2, Copy, Check, X, Eye, EyeOff, Zap,
  Settings, ChevronRight, Globe, Shield, Clock, Activity,
  ArrowDownCircle, ArrowUpCircle, Webhook, RefreshCw, AlertCircle,
  Code, Lock,
} from 'lucide-react'
import {
  generateApiKey,
  revokeApiKey,
  saveApiConfiguration,
  type ApiKeyRecord,
  type ApiConfigurationRecord,
  type GenerateApiKeyInput,
} from '@/modules/organization/actions/api-key.actions'
import type { ApiScope } from '@/lib/api/validate-key'

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────
type Account = { id: string; code: string; name: string; type: string }
type Branch = { id: string; name: string; code?: string }
type WebhookDelivery = {
  id: string; event_type: string; status: string; http_status: number | null
  target_url: string; attempt_count: number; delivered_at: string | null; created_at: string
}

interface Props {
  orgId: string
  currentRole: string
  initialApiKeys: ApiKeyRecord[]
  initialConfig: ApiConfigurationRecord | null
  initialAccounts: Account[]
  branches: Branch[]
  webhookDeliveries: WebhookDelivery[]
  baseUrl: string
}

const SCOPES: { value: ApiScope; label: string; desc: string; color: string }[] = [
  { value: 'cash:read',      label: 'Cash Read',      desc: 'Baca saldo & rekening',        color: 'blue' },
  { value: 'cash:write',     label: 'Cash Write',     desc: 'Catat kas masuk & keluar',     color: 'emerald' },
  { value: 'sales:read',     label: 'Sales Read',     desc: 'Baca data penjualan',           color: 'violet' },
  { value: 'inventory:read', label: 'Inventory Read', desc: 'Baca stok inventori',           color: 'orange' },
  { value: 'contacts:read',  label: 'Contacts Read',  desc: 'Baca data kontak/customer',    color: 'pink' },
]

const WEBHOOK_EVENTS = ['cash_in', 'cash_out', 'sale', 'purchase']

function ScopeBadge({ scope }: { scope: string }) {
  const def = SCOPES.find(s => s.value === scope)
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    violet: 'bg-violet-100 text-violet-700',
    orange: 'bg-orange-100 text-orange-700',
    pink: 'bg-pink-100 text-pink-700',
  }
  const color = colorMap[def?.color ?? 'blue'] ?? 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${color}`}>
      {def?.label ?? scope}
    </span>
  )
}

// ─────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────
export function ApiSettingsClient({
  orgId, currentRole, initialApiKeys, initialConfig, initialAccounts, branches, webhookDeliveries, baseUrl,
}: Props) {
  const [activeTab, setActiveTab] = useState<'keys' | 'cashin' | 'cashout' | 'webhook'>('keys')
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>(initialApiKeys)
  const [loading, setLoading] = useState(false)

  // ── Generate modal state ──
  const [showGenModal, setShowGenModal] = useState(false)
  const [genName, setGenName] = useState('')
  const [genScopes, setGenScopes] = useState<ApiScope[]>([])
  const [genBranchId, setGenBranchId] = useState('')
  const [genRpm, setGenRpm] = useState(60)
  const [genExpiry, setGenExpiry] = useState('')
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [keyCopied, setKeyCopied] = useState(false)

  // ── Config state ──
  const [config, setConfig] = useState<ApiConfigurationRecord>(
    initialConfig ?? {
      id: null, org_id: orgId, branch_id: null,
      cash_in_account_id: null, cash_out_account_id: null,
      cash_in_params: {}, cash_out_params: {},
      webhook_url: null, webhook_secret: null, webhook_events: [], webhook_is_active: false,
    }
  )
  const [showWebhookSecret, setShowWebhookSecret] = useState(false)

  const isOwner = currentRole === 'owner'
  const isAdmin = currentRole === 'owner' || currentRole === 'admin'

  // ─────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!genName.trim()) return alert('Nama API key wajib diisi.')
    if (genScopes.length === 0) return alert('Minimal pilih satu scope.')

    setLoading(true)
    const input: GenerateApiKeyInput = {
      name: genName.trim(),
      scopes: genScopes,
      rateLimitRpm: genRpm,
      branchId: genBranchId || null,
      expiresAt: genExpiry || null,
    }
    const res = await generateApiKey(orgId, input)
    setLoading(false)

    if ('error' in res) return alert(res.error)

    setGeneratedKey(res.fullKey)
    setApiKeys(prev => [{
      id: res.keyId, name: genName.trim(), key_prefix: 'nzm_live_',
      scopes: genScopes, branch_id: genBranchId || null,
      is_active: true, rate_limit_rpm: genRpm, request_count: 0,
      last_used_at: null, expires_at: genExpiry || null,
      created_at: new Date().toISOString(),
    }, ...prev])

    setGenName(''); setGenScopes([]); setGenBranchId(''); setGenRpm(60); setGenExpiry('')
  }

  const handleRevoke = async (keyId: string, keyName: string) => {
    if (!confirm(`Nonaktifkan API key "${keyName}"? Integrasi yang menggunakan key ini akan langsung berhenti berfungsi.`)) return
    setLoading(true)
    const res = await revokeApiKey(orgId, keyId)
    setLoading(false)
    if ('error' in res) return alert(res.error)
    setApiKeys(prev => prev.map(k => k.id === keyId ? { ...k, is_active: false } : k))
  }

  const handleCopyKey = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setKeyCopied(true)
    setTimeout(() => setKeyCopied(false), 2000)
  }

  const handleSaveConfig = async () => {
    setLoading(true)
    const res = await saveApiConfiguration(orgId, {
      branchId: config.branch_id,
      cashInAccountId: config.cash_in_account_id,
      cashOutAccountId: config.cash_out_account_id,
      cashInParams: config.cash_in_params,
      cashOutParams: config.cash_out_params,
      webhookUrl: config.webhook_url,
      webhookSecret: config.webhook_secret,
      webhookEvents: config.webhook_events,
      webhookIsActive: config.webhook_is_active,
    })
    setLoading(false)
    if ('error' in res) return alert(res.error)
    alert('Konfigurasi API berhasil disimpan!')
  }

  // ─────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto pb-20">

      {/* ── Header ── */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <Code className="text-violet-600" size={32} />
          OPEN API & INTEGRASI
        </h1>
        <p className="text-sm text-slate-500 font-medium">
          Buka akses data Nizam untuk sistem eksternal menggunakan REST API yang aman dan ter-scope.
        </p>
      </div>

      {/* ── Base URL info card ── */}
      <div className="rounded-[28px] border border-violet-100 bg-gradient-to-r from-violet-50 via-white to-slate-50 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-600 mb-1">Base URL API</p>
            <code className="text-sm font-black text-slate-800">{baseUrl}/api/v1/</code>
          </div>
          <div className="flex gap-2 flex-wrap">
            {['/cash', '/sales', '/inventory', '/contacts'].map(ep => (
              <span key={ep} className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-[11px] font-black text-slate-600 shadow-sm">
                {ep}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl w-fit">
        {[
          { id: 'keys', label: 'API Keys', icon: Key },
          { id: 'cashin', label: 'Cash In', icon: ArrowDownCircle },
          { id: 'cashout', label: 'Cash Out', icon: ArrowUpCircle },
          { id: 'webhook', label: 'Webhook', icon: Webhook },
        ].map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-slate-900 shadow-md'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* ══════════════════════════════════════════════ */}
      {/* TAB: API KEYS                                 */}
      {/* ══════════════════════════════════════════════ */}
      {activeTab === 'keys' && (
        <div className="space-y-5">
          {/* Action bar */}
          {isAdmin && (
            <div className="flex justify-between items-center">
              <p className="text-sm text-slate-500 font-medium">{apiKeys.length} API key terdaftar</p>
              <button
                onClick={() => setShowGenModal(true)}
                className="flex items-center gap-2 px-5 py-3 bg-violet-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-violet-700 transition-all shadow-lg shadow-violet-200 active:scale-95"
              >
                <Plus size={14} /> Buat API Key Baru
              </button>
            </div>
          )}

          {/* Keys list */}
          <div className="space-y-3">
            {apiKeys.length === 0 && (
              <div className="rounded-[28px] border border-dashed border-slate-200 py-16 flex flex-col items-center gap-3 text-slate-400">
                <Key size={32} strokeWidth={1} />
                <p className="text-sm font-bold">Belum ada API key</p>
                <p className="text-xs">Buat key baru untuk mulai integrasi</p>
              </div>
            )}
            {apiKeys.map(key => (
              <motion.div
                key={key.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-[24px] border p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between ${
                  key.is_active ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-60'
                }`}
              >
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                    key.is_active ? 'bg-violet-100 text-violet-600' : 'bg-slate-200 text-slate-400'
                  }`}>
                    <Key size={18} />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-black text-slate-900">{key.name}</p>
                      {!key.is_active && (
                        <span className="px-2 py-0.5 rounded-lg bg-red-100 text-red-600 text-[9px] font-black uppercase tracking-widest">Dinonaktifkan</span>
                      )}
                    </div>
                    <code className="text-[11px] text-slate-400 font-mono">{key.key_prefix}{'•'.repeat(16)}</code>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {key.scopes.map(s => <ScopeBadge key={s} scope={s} />)}
                    </div>
                    <div className="flex gap-4 flex-wrap mt-1">
                      <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                        <Activity size={10} /> {key.request_count.toLocaleString('id-ID')} req
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                        <Clock size={10} /> {key.rate_limit_rpm} req/menit
                      </span>
                      {key.last_used_at && (
                        <span className="text-[10px] text-slate-400 font-bold">
                          Terakhir: {new Date(key.last_used_at).toLocaleDateString('id-ID')}
                        </span>
                      )}
                      {key.expires_at && (
                        <span className="text-[10px] text-amber-500 font-bold flex items-center gap-1">
                          <AlertCircle size={10} /> Expires: {new Date(key.expires_at).toLocaleDateString('id-ID')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {isAdmin && key.is_active && (
                  <button
                    onClick={() => handleRevoke(key.id, key.name)}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all disabled:opacity-50 shrink-0"
                  >
                    <Trash2 size={13} /> Revoke
                  </button>
                )}
              </motion.div>
            ))}
          </div>

          {/* Docs hint */}
          <div className="rounded-[20px] border border-slate-100 bg-slate-50 p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Cara Menggunakan</p>
            <pre className="text-[11px] text-slate-600 font-mono leading-relaxed overflow-x-auto">
{`curl ${baseUrl}/api/v1/cash \\
  -H "x-api-key: nzm_live_<your-key>" \\
  -H "Content-Type: application/json"`}
            </pre>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* TAB: CASH IN CONFIG                           */}
      {/* ══════════════════════════════════════════════ */}
      {activeTab === 'cashin' && (
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/50 p-10 space-y-8">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center">
              <ArrowDownCircle size={20} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Konfigurasi Cash In</h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Akun tujuan & parameter saat POST /api/v1/cash {"{ type: 'in' }"}</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">Akun Kas / Bank Penerima (Cash In Account)</label>
              <p className="text-xs text-slate-400 ml-1 mb-2">Debet default saat transaksi kas masuk via API diterima.</p>
              <select
                value={config.cash_in_account_id ?? ''}
                onChange={e => setConfig(c => ({ ...c, cash_in_account_id: e.target.value || null }))}
                className="w-full px-5 py-3 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 font-bold bg-white"
              >
                <option value="">— Pilih Akun CoA —</option>
                {initialAccounts.map(a => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">Deskripsi Default</label>
                <input
                  value={String(config.cash_in_params?.default_description ?? '')}
                  onChange={e => setConfig(c => ({ ...c, cash_in_params: { ...c.cash_in_params, default_description: e.target.value } }))}
                  placeholder="Penerimaan via API"
                  className="w-full px-5 py-3 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">Akun Pendapatan Counter (Kredit)</label>
                <select
                  value={String(config.cash_in_params?.revenue_account_id ?? '')}
                  onChange={e => setConfig(c => ({ ...c, cash_in_params: { ...c.cash_in_params, revenue_account_id: e.target.value || undefined } }))}
                  className="w-full px-5 py-3 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 font-bold bg-white"
                >
                  <option value="">— Pilih Akun Pendapatan —</option>
                  {initialAccounts.filter(a => a.type === 'REVENUE').map(a => (
                    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setConfig(c => ({ ...c, cash_in_params: { ...c.cash_in_params, auto_post: !c.cash_in_params?.auto_post } }))}
                  className={`w-10 h-6 rounded-full transition-all relative cursor-pointer ${config.cash_in_params?.auto_post ? 'bg-emerald-500' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${config.cash_in_params?.auto_post ? 'left-5' : 'left-1'}`} />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-800">Auto-Post Jurnal</p>
                  <p className="text-xs text-slate-400">Jika aktif, transaksi langsung POSTED tanpa perlu review manual.</p>
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              onClick={handleSaveConfig}
              disabled={loading}
              className="flex items-center gap-2 px-8 py-4 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 active:scale-95"
            >
              <Check size={15} /> {loading ? 'Menyimpan...' : 'Simpan Konfigurasi Cash In'}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* TAB: CASH OUT CONFIG                          */}
      {/* ══════════════════════════════════════════════ */}
      {activeTab === 'cashout' && (
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/50 p-10 space-y-8">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center">
              <ArrowUpCircle size={20} className="text-rose-500" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Konfigurasi Cash Out</h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Akun sumber & parameter saat POST /api/v1/cash {"{ type: 'out' }"}</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">Akun Kas / Bank Sumber (Cash Out Account)</label>
              <p className="text-xs text-slate-400 ml-1 mb-2">Kredit default saat transaksi kas keluar via API dilakukan.</p>
              <select
                value={config.cash_out_account_id ?? ''}
                onChange={e => setConfig(c => ({ ...c, cash_out_account_id: e.target.value || null }))}
                className="w-full px-5 py-3 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-rose-50 focus:border-rose-400 font-bold bg-white"
              >
                <option value="">— Pilih Akun CoA —</option>
                {initialAccounts.map(a => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">Deskripsi Default</label>
                <input
                  value={String(config.cash_out_params?.default_description ?? '')}
                  onChange={e => setConfig(c => ({ ...c, cash_out_params: { ...c.cash_out_params, default_description: e.target.value } }))}
                  placeholder="Pembayaran via API"
                  className="w-full px-5 py-3 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-rose-50 focus:border-rose-400 font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">Akun Beban Counter (Debit)</label>
                <select
                  value={String(config.cash_out_params?.expense_account_id ?? '')}
                  onChange={e => setConfig(c => ({ ...c, cash_out_params: { ...c.cash_out_params, expense_account_id: e.target.value || undefined } }))}
                  className="w-full px-5 py-3 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-rose-50 focus:border-rose-400 font-bold bg-white"
                >
                  <option value="">— Pilih Akun Beban —</option>
                  {initialAccounts.filter(a => a.type === 'EXPENSE').map(a => (
                    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setConfig(c => ({ ...c, cash_out_params: { ...c.cash_out_params, auto_post: !c.cash_out_params?.auto_post } }))}
                  className={`w-10 h-6 rounded-full transition-all relative cursor-pointer ${config.cash_out_params?.auto_post ? 'bg-rose-500' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${config.cash_out_params?.auto_post ? 'left-5' : 'left-1'}`} />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-800">Auto-Post Jurnal</p>
                  <p className="text-xs text-slate-400">Jika aktif, transaksi langsung POSTED tanpa perlu review manual.</p>
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              onClick={handleSaveConfig}
              disabled={loading}
              className="flex items-center gap-2 px-8 py-4 bg-rose-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 disabled:opacity-50 active:scale-95"
            >
              <Check size={15} /> {loading ? 'Menyimpan...' : 'Simpan Konfigurasi Cash Out'}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* TAB: WEBHOOK                                  */}
      {/* ══════════════════════════════════════════════ */}
      {activeTab === 'webhook' && (
        <div className="space-y-5">
          <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/50 p-10 space-y-8">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
              <div className="w-10 h-10 rounded-2xl bg-violet-100 flex items-center justify-center">
                <Webhook size={20} className="text-violet-600" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Konfigurasi Webhook</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Nizam push notifikasi ke URL Anda saat ada event transaksi.</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Toggle */}
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div
                  onClick={() => setConfig(c => ({ ...c, webhook_is_active: !c.webhook_is_active }))}
                  className={`w-12 h-7 rounded-full transition-all relative cursor-pointer shrink-0 ${config.webhook_is_active ? 'bg-violet-500' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${config.webhook_is_active ? 'left-6' : 'left-1'}`} />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-800">Aktifkan Webhook</p>
                  <p className="text-xs text-slate-400">Nizam akan mengirim HTTP POST ke URL berikut saat event dipicu.</p>
                </div>
              </div>

              {/* URL + Secret */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">Webhook Endpoint URL</label>
                  <input
                    value={config.webhook_url ?? ''}
                    onChange={e => setConfig(c => ({ ...c, webhook_url: e.target.value || null }))}
                    placeholder="https://yourapp.com/webhook/nizam"
                    className="w-full px-5 py-3 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-violet-50 focus:border-violet-500 font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">Webhook Secret (HMAC-SHA256)</label>
                  <div className="relative">
                    <input
                      type={showWebhookSecret ? 'text' : 'password'}
                      value={config.webhook_secret ?? ''}
                      onChange={e => setConfig(c => ({ ...c, webhook_secret: e.target.value || null }))}
                      placeholder="secret_key untuk verifikasi signature"
                      className="w-full px-5 py-3 pr-12 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-violet-50 focus:border-violet-500 font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => setShowWebhookSecret(s => !s)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showWebhookSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Events */}
              <div className="space-y-3">
                <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">Events yang Di-trigger</label>
                <div className="flex flex-wrap gap-2">
                  {WEBHOOK_EVENTS.map(ev => {
                    const active = config.webhook_events.includes(ev)
                    return (
                      <button
                        key={ev}
                        type="button"
                        onClick={() => setConfig(c => ({
                          ...c,
                          webhook_events: active
                            ? c.webhook_events.filter(e => e !== ev)
                            : [...c.webhook_events, ev],
                        }))}
                        className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all border ${
                          active
                            ? 'bg-violet-600 text-white border-violet-600 shadow-md'
                            : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300'
                        }`}
                      >
                        {ev.replace('_', ' ')}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Signature hint */}
              <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
                <p className="text-[10px] font-black text-violet-700 uppercase tracking-widest mb-2">Verifikasi Signature di Server Anda</p>
                <pre className="text-[11px] text-violet-800 font-mono leading-relaxed overflow-x-auto">
{`// Node.js / TypeScript
const crypto = require('crypto')

const signature = req.headers['x-nizam-webhook-signature']
const body = JSON.stringify(req.body)
const expected = 'sha256=' + 
  crypto.createHmac('sha256', WEBHOOK_SECRET)
    .update(body).digest('hex')

if (signature !== expected) {
  return res.status(401).json({ error: 'Invalid signature' })
}`}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                onClick={handleSaveConfig}
                disabled={loading}
                className="flex items-center gap-2 px-8 py-4 bg-violet-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-violet-700 transition-all shadow-lg shadow-violet-200 disabled:opacity-50 active:scale-95"
              >
                <Check size={15} /> {loading ? 'Menyimpan...' : 'Simpan Webhook Config'}
              </button>
            </div>
          </div>

          {/* Delivery log */}
          {webhookDeliveries.length > 0 && (
            <div className="bg-white rounded-[32px] border border-slate-100 p-6 space-y-4">
              <h4 className="text-sm font-black text-slate-700 uppercase tracking-wide flex items-center gap-2">
                <Activity size={16} className="text-slate-400" /> Log Pengiriman Terakhir
              </h4>
              <div className="space-y-2">
                {webhookDeliveries.map(d => (
                  <div key={d.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      d.status === 'delivered' ? 'bg-emerald-500' :
                      d.status === 'failed' ? 'bg-red-500' : 'bg-amber-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-slate-800 uppercase">{d.event_type}</span>
                        {d.http_status && (
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
                            d.http_status < 300 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                          }`}>
                            HTTP {d.http_status}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">{d.target_url}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {new Date(d.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* MODAL: GENERATE API KEY                       */}
      {/* ══════════════════════════════════════════════ */}
      <AnimatePresence>
        {showGenModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { if (!generatedKey) setShowGenModal(false) }}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="relative w-full max-w-lg rounded-[40px] bg-white shadow-2xl overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-black text-slate-900">
                      {generatedKey ? '🔑 Simpan API Key Ini!' : 'Buat API Key Baru'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      {generatedKey ? 'Key HANYA ditampilkan sekali. Salin sekarang!' : 'Konfigurasi scope dan batas akses key Anda.'}
                    </p>
                  </div>
                  {!generatedKey && (
                    <button onClick={() => setShowGenModal(false)} className="p-2 rounded-xl bg-slate-100 text-slate-400 hover:bg-slate-200 transition-all">
                      <X size={16} />
                    </button>
                  )}
                </div>

                {generatedKey ? (
                  /* ── Show generated key ── */
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-slate-950 p-4 relative">
                      <code className="text-emerald-400 text-xs font-mono break-all leading-relaxed">{generatedKey}</code>
                      <button
                        onClick={() => handleCopyKey(generatedKey)}
                        className="absolute top-3 right-3 p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all"
                      >
                        {keyCopied ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
                      <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-800 font-bold leading-relaxed">
                        Key ini tidak akan bisa dilihat lagi setelah panel ini ditutup. Pastikan Anda sudah menyimpannya di tempat yang aman.
                      </p>
                    </div>
                    <button
                      onClick={() => { setGeneratedKey(null); setShowGenModal(false) }}
                      className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-black transition-all"
                    >
                      Sudah Disimpan, Tutup
                    </button>
                  </div>
                ) : (
                  /* ── Form generate ── */
                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em]">Nama Key</label>
                      <input
                        value={genName}
                        onChange={e => setGenName(e.target.value)}
                        placeholder="Contoh: Integrasi Tokopedia, Webhook POS"
                        className="w-full px-4 py-3 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-violet-50 focus:border-violet-500 font-bold"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em]">Scope Akses</label>
                      <div className="grid grid-cols-1 gap-2">
                        {SCOPES.map(s => (
                          <label key={s.value} className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                            genScopes.includes(s.value)
                              ? 'border-violet-400 bg-violet-50'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}>
                            <input
                              type="checkbox"
                              checked={genScopes.includes(s.value)}
                              onChange={e => setGenScopes(prev =>
                                e.target.checked ? [...prev, s.value] : prev.filter(x => x !== s.value)
                              )}
                              className="rounded"
                            />
                            <div className="flex-1">
                              <p className="text-xs font-black text-slate-800">{s.label}</p>
                              <p className="text-[10px] text-slate-400">{s.desc}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em]">Rate Limit (req/menit)</label>
                        <input
                          type="number" min={1} max={1000}
                          value={genRpm}
                          onChange={e => setGenRpm(Number(e.target.value))}
                          className="w-full px-4 py-3 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-violet-50 focus:border-violet-500 font-bold"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em]">Berlaku Sampai (opsional)</label>
                        <input
                          type="date"
                          value={genExpiry}
                          onChange={e => setGenExpiry(e.target.value)}
                          className="w-full px-4 py-3 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-violet-50 focus:border-violet-500 font-bold"
                        />
                      </div>
                    </div>

                    {branches.length > 0 && (
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em]">Scope Cabang (opsional)</label>
                        <select
                          value={genBranchId}
                          onChange={e => setGenBranchId(e.target.value)}
                          className="w-full px-4 py-3 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-violet-50 focus:border-violet-500 font-bold bg-white"
                        >
                          <option value="">— Semua Cabang —</option>
                          {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.name}{b.code ? ` (${b.code})` : ''}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <button
                      onClick={handleGenerate}
                      disabled={loading || !genName.trim() || genScopes.length === 0}
                      className="w-full py-4 bg-violet-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-violet-700 transition-all shadow-lg shadow-violet-200 disabled:opacity-50 active:scale-95"
                    >
                      {loading ? 'Membuat Key...' : 'Generate API Key'}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
