'use client'

/**
 * app/(dashboard)/settings/api/ApiSettingsClient.tsx
 *
 * UI Pengaturan Open API Nizam:
 * API keys, cash mapping, webhook, API reference, tryout console,
 * history log, dan onboarding checklist integrasi.
 */

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Key, Plus, Trash2, Copy, Check, X, Eye, EyeOff,
  Globe, Shield, Clock, Activity,
  ArrowDownCircle, ArrowUpCircle, Webhook, AlertCircle,
  Code, Lock, History, CheckCircle2, XCircle,
} from 'lucide-react'
import {
  generateApiKey,
  revokeApiKey,
  saveApiConfiguration,
  type ApiKeyRecord,
  type ApiConfigurationRecord,
  type GenerateApiKeyInput,
  type ApiCallLogRecord,
} from '@/modules/organization/actions/api-key.actions'
import type { ApiScope } from '@/lib/api/validate-key'

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────
type Account = {
  id: string
  code: string | null
  name: string | null
  type: string | null
}
type BankAccountOption = {
  id: string
  branch_id: string | null
  account_id: string | null
  bank_name: string | null
  account_number: string | null
  currency: string | null
}
type InventoryProductOption = {
  id: string
  sku: string | null
  name: string | null
  type: string | null
  unit: string | null
  purchase_price: number | string | null
  selling_price: number | string | null
  average_cost: number | string | null
  category: string | null
  asset_account_id: string | null
}
type AccountBalanceOption = {
  account_id: string | null
  balance: number | string | null
}
type Branch = { id: string; name: string; code?: string }
type WebhookDelivery = {
  id: string; event_type: string; status: string; http_status: number | null
  target_url: string; attempt_count: number; delivered_at: string | null; created_at: string
}
type EndpointParameter = {
  name: string
  in: 'header' | 'query' | 'body'
  required: boolean
  schema: string
  description: string
}
type EndpointResponse = {
  status: string
  description: string
}
type EndpointRequestBody = {
  required: boolean
  contentType: string
  fields: string[]
}
type EndpointExample = {
  id: string
  label: string
  description: string
  query?: string
  body?: string
  curl: string
  response: string
}
type EndpointDoc = {
  id: 'cash-read' | 'inventory-read' | 'sales-read' | 'contacts-read' | 'cash-create'
  label: string
  method: 'GET' | 'POST'
  path: '/cash' | '/inventory' | '/sales' | '/contacts'
  summary: string
  operationId: string
  scope: ApiScope
  description: string
  auth: string[]
  parameters: EndpointParameter[]
  requestBody: EndpointRequestBody | null
  responses: EndpointResponse[]
  notes: string[]
  examples: EndpointExample[]
}
type TryAuthMode = 'x-api-key' | 'bearer'

interface Props {
  orgId: string
  currentRole: string
  initialApiKeys: ApiKeyRecord[]
  initialConfig: ApiConfigurationRecord | null
  initialAccounts: Account[]
  initialBankAccounts: BankAccountOption[]
  initialAccountBalances: AccountBalanceOption[]
  initialInventoryProducts: InventoryProductOption[]
  branches: Branch[]
  webhookDeliveries: WebhookDelivery[]
  callLogs: ApiCallLogRecord[]
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
const TRYOUT_INVISIBLE_CHARACTERS = /[\u200B-\u200D\u2060\uFEFF]/g

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

function normalizeTryApiKeyValue(value: string) {
  return value
    .normalize('NFKC')
    .replace(TRYOUT_INVISIBLE_CHARACTERS, '')
    .replace(/[\r\n\t]/g, '')
    .trim()
}

function isBrowserSafeHeaderValue(value: string) {
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0
    if (codePoint === 0 || codePoint === 10 || codePoint === 13 || codePoint > 0xFF) {
      return false
    }
  }
  return true
}

function isValidTryApiKeyFormat(value: string) {
  return /^nzm_live_[A-Za-z0-9]{16,}$/.test(value)
}

function isLiquidCashAccount(account: Account) {
  const accountType = String(account.type ?? '').toUpperCase()
  const accountCode = String(account.code ?? '').trim()
  return accountType === 'ASSET' && accountCode.startsWith('11') && !accountCode.endsWith('00')
}

function formatAccountOption(account: Account) {
  const code = String(account.code ?? '').trim()
  const name = String(account.name ?? '').trim()

  if (code && name) return `${code} — ${name}`
  if (name) return name
  if (code) return code
  return account.id
}

function toSafeAmount(value: number | string | null | undefined, fallback: number) {
  const numeric = Number(value ?? fallback)
  return Number.isFinite(numeric) ? numeric : fallback
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function hasConfigAccountMapping(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
}

function buildCurlExample(args: {
  baseUrl: string
  method: 'GET' | 'POST'
  path: string
  query?: string
  body?: unknown
}) {
  const normalizedQuery = args.query?.trim().replace(/^\?/, '')
  const url = `${args.baseUrl}${args.path}${normalizedQuery ? `?${normalizedQuery}` : ''}`

  if (args.method === 'GET') {
    return `curl "${url}" \\
  -H "x-api-key: nzm_live_<your-key>" \\
  -H "Accept: application/json"`
  }

  return `curl ${args.baseUrl}${args.path} \\
  -X ${args.method} \\
  -H "x-api-key: nzm_live_<your-key>" \\
  -H "Content-Type: application/json" \\
  -d '${formatJson(args.body ?? {})}'`
}

// ─────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────
export function ApiSettingsClient({
  orgId,
  currentRole,
  initialApiKeys,
  initialConfig,
  initialAccounts,
  initialBankAccounts,
  initialAccountBalances,
  initialInventoryProducts,
  branches,
  webhookDeliveries,
  callLogs,
  baseUrl,
}: Props) {
  const [activeTab, setActiveTab] = useState<'keys' | 'cashin' | 'cashout' | 'webhook' | 'tryout' | 'history'>('keys')
  const [activeDoc, setActiveDoc] = useState<'cash-read' | 'inventory-read' | 'sales-read' | 'contacts-read' | 'cash-create'>('cash-read')
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>(initialApiKeys)
  const [loading, setLoading] = useState(false)
  const [resolvedBaseUrl, setResolvedBaseUrl] = useState(baseUrl)

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
  const [tryApiKey, setTryApiKey] = useState('')
  const [tryAuthMode, setTryAuthMode] = useState<TryAuthMode>('x-api-key')
  const [tryPath, setTryPath] = useState('/api/v1/cash')
  const [tryQuery, setTryQuery] = useState('')
  const [tryBody, setTryBody] = useState('')
  const [tryStatus, setTryStatus] = useState<number | null>(null)
  const [tryResponse, setTryResponse] = useState('')
  const [tryLoading, setTryLoading] = useState(false)
  const [tryError, setTryError] = useState<string | null>(null)

  const isAdmin = currentRole === 'owner' || currentRole === 'admin'
  const cashAccounts = initialAccounts.filter(isLiquidCashAccount)
  const counterAccounts = initialAccounts
  const [activeExampleId, setActiveExampleId] = useState('')

  const accountById = new Map(initialAccounts.map((account) => [account.id, account]))
  const accountBalanceById = new Map(
    initialAccountBalances
      .map((row) => {
        const accountId = String(row.account_id ?? '').trim()
        if (!accountId) return null
        return [accountId, toSafeAmount(row.balance, 0)] as const
      })
      .filter((entry): entry is readonly [string, number] => Boolean(entry))
  )
  const bankBackedCashAccountIds = new Set(
    initialBankAccounts
      .map((bankAccount) => bankAccount.account_id)
      .filter((accountId): accountId is string => Boolean(accountId))
  )
  const defaultBranch = branches[0] ?? null
  const defaultBankAccount = initialBankAccounts[0] ?? null
  const defaultCashAccount =
    cashAccounts.find((account) => bankBackedCashAccountIds.has(account.id))
    ?? cashAccounts[0]
    ?? null
  const tryoutCashAccount =
    [...cashAccounts]
      .sort((left, right) => (accountBalanceById.get(right.id) ?? 0) - (accountBalanceById.get(left.id) ?? 0))
      .find((account) => (accountBalanceById.get(account.id) ?? 0) > 0)
    ?? defaultCashAccount
    ?? null
  const preferredInventoryProduct =
    initialInventoryProducts.find((product) => String(product.name ?? '').toLowerCase().includes('buku'))
    ?? initialInventoryProducts[0]
    ?? null
  const preferredInventoryAccount =
    (preferredInventoryProduct?.asset_account_id ? accountById.get(preferredInventoryProduct.asset_account_id) : null)
    ?? initialAccounts.find((account) => account.code === '1304')
    ?? initialAccounts.find((account) => account.code === '1301')
    ?? null
  const payableAccount =
    initialAccounts.find((account) => account.code === '2101')
    ?? null
  const taxInputAccount =
    initialAccounts.find((account) => account.code === '1401')
    ?? null
  const freightInAccount =
    initialAccounts.find((account) => account.code === '5002')
    ?? initialAccounts.find((account) => account.code === '6099')
    ?? null
  const purchaseDiscountAccount =
    initialAccounts.find((account) => account.code === '5003')
    ?? initialAccounts.find((account) => account.code === '4002')
    ?? null
  const cashInParams = (config.cash_in_params && typeof config.cash_in_params === 'object'
    ? config.cash_in_params
    : {}) as Record<string, unknown>
  const cashOutParams = (config.cash_out_params && typeof config.cash_out_params === 'object'
    ? config.cash_out_params
    : {}) as Record<string, unknown>
  const hasActiveApiKey = apiKeys.some((key) => key.is_active)
  const hasCashInDefault = Boolean(config.cash_in_account_id) && [
    cashInParams.counter_account_id,
    cashInParams.revenue_account_id,
    cashInParams.receivable_account_id,
    cashInParams.tax_account_id,
    cashInParams.discount_account_id,
    cashInParams.other_charge_account_id,
  ].some(hasConfigAccountMapping)
  const hasCashOutDefault = Boolean(config.cash_out_account_id) && [
    cashOutParams.counter_account_id,
    cashOutParams.expense_account_id,
    cashOutParams.payable_account_id,
    cashOutParams.tax_account_id,
    cashOutParams.discount_account_id,
    cashOutParams.other_charge_account_id,
  ].some(hasConfigAccountMapping)
  const hasWebhookSetup =
    Boolean(config.webhook_url) &&
    Boolean(config.webhook_is_active) &&
    Array.isArray(config.webhook_events) &&
    config.webhook_events.length > 0
  const onboardingItems = [
    {
      id: 'api-key',
      label: 'API key aktif',
      detail: hasActiveApiKey ? 'Minimal satu key siap dipakai untuk autentikasi.' : 'Buat API key sebelum partner mulai integrasi.',
      ready: hasActiveApiKey,
    },
    {
      id: 'cash-account',
      label: 'Akun kas/bank 11xx',
      detail: cashAccounts.length > 0 ? `${cashAccounts.length} akun kas/bank likuid siap dipakai.` : 'Belum ada akun kas/bank liquid dari CoA 11xx.',
      ready: cashAccounts.length > 0,
    },
    {
      id: 'bank-bridge',
      label: 'Bridge bank_accounts',
      detail: initialBankAccounts.length > 0 ? `${initialBankAccounts.length} rekening bridge aktif tersedia.` : 'Belum ada row bank_accounts aktif untuk rekening tujuan/sumber.',
      ready: initialBankAccounts.length > 0,
    },
    {
      id: 'cash-in-default',
      label: 'Default cash-in',
      detail: hasCashInDefault ? 'Mapping kas masuk default sudah lengkap.' : 'Isi akun kas masuk dan akun lawan default agar POST cash-in siap dipakai.',
      ready: hasCashInDefault,
    },
    {
      id: 'cash-out-default',
      label: 'Default cash-out',
      detail: hasCashOutDefault ? 'Mapping kas keluar default sudah lengkap.' : 'Isi akun kas keluar dan akun lawan default agar POST cash-out siap dipakai.',
      ready: hasCashOutDefault,
    },
    {
      id: 'webhook',
      label: 'Webhook aktif',
      detail: hasWebhookSetup ? 'Webhook URL, event, dan status aktif sudah terpasang.' : 'Aktifkan webhook bila integrasi butuh notifikasi push.',
      ready: hasWebhookSetup,
    },
  ]
  const onboardingReadyCount = onboardingItems.filter((item) => item.ready).length

  const exampleBranchId = defaultBranch?.id ?? 'branch-id'
  const exampleBranchLabel = defaultBranch?.name ?? 'Cabang Utama'
  const exampleCashAccountId = tryoutCashAccount?.id ?? defaultBankAccount?.account_id ?? defaultCashAccount?.id ?? 'cash-bank-11xx-account-id'
  const exampleCashAccountLabel = formatAccountOption(tryoutCashAccount ?? defaultCashAccount ?? {
    id: 'cash-bank-11xx-account-id',
    code: '1101',
    name: 'Kas / Bank',
    type: 'ASSET',
  })
  const tryoutBankAccount =
    initialBankAccounts.find((bankAccount) => bankAccount.account_id === exampleCashAccountId)
    ?? null
  const exampleBankAccountId = tryoutBankAccount?.id ?? defaultBankAccount?.id ?? 'generated-bank-account-id'
  const exampleCashAvailableBalance = accountBalanceById.get(exampleCashAccountId) ?? 0
  const exampleBookProductName = String(preferredInventoryProduct?.name ?? 'BUKU MATEMATIKA SERIES 3')
  const exampleBookSku = String(preferredInventoryProduct?.sku ?? 'BMS3')
  const exampleBookUnit = String(preferredInventoryProduct?.unit ?? 'Pcs')
  const exampleInventoryAccountId = preferredInventoryAccount?.id ?? 'inventory-account-id'
  const exampleTaxAccountId = taxInputAccount?.id ?? 'tax-account-id'
  const examplePayableAccountId = payableAccount?.id ?? 'payable-account-id'
  const exampleFreightAccountId = freightInAccount?.id ?? 'other-charge-account-id'
  const exampleDiscountAccountId = purchaseDiscountAccount?.id ?? 'discount-account-id'

  const bookUnitCost = toSafeAmount(
    preferredInventoryProduct?.purchase_price ?? preferredInventoryProduct?.average_cost,
    9600
  )
  const bookQuantity = 2
  const bookInventoryAmount = Number((bookUnitCost * bookQuantity).toFixed(2))
  const bookTaxAmount = Number((bookInventoryAmount * 0.1).toFixed(2))
  const bookFreightAmount = 2000
  const bookDiscountAmount = 1000
  const bookInvoiceTotal = Number((bookInventoryAmount + bookTaxAmount + bookFreightAmount - bookDiscountAmount).toFixed(2))
  const maxCashPaidForExample =
    exampleCashAvailableBalance > 0
      ? Math.min(
        bookInvoiceTotal - 1000,
        Math.floor(exampleCashAvailableBalance * 100) / 100,
        15000
      )
      : 15000
  const bookCashPaidAmount = Number(
    (maxCashPaidForExample > 0 ? maxCashPaidForExample : Math.min(bookInvoiceTotal, 1000)).toFixed(2)
  )
  const bookPayableAmount = Number((bookInvoiceTotal - bookCashPaidAmount).toFixed(2))

  const receivableExampleBody = {
    type: 'in',
    amount: 250000,
    description: 'Pelunasan invoice INV-2026-001',
    reference: 'INV-2026-001',
    idempotency_key: 'cash-inv-2026-001',
    branch_id: exampleBranchId,
    transaction_date: '2026-04-15',
    account_id: exampleCashAccountId,
    settlement_type: 'receivable',
  }

  const onlineBookPurchaseBody = {
    type: 'out',
    amount: bookCashPaidAmount,
    description: `Push marketplace pembelian ${exampleBookSku} - ${exampleBookProductName}`,
    reference: 'PO-MP-BOOK-2026-0001',
    idempotency_key: 'cash-po-mp-book-2026-0001',
    branch_id: exampleBranchId,
    transaction_date: '2026-04-15',
    account_id: exampleCashAccountId,
    journal_lines: [
      {
        account_id: exampleInventoryAccountId,
        debit: bookInventoryAmount,
        memo: `Persediaan ${exampleBookSku} ${bookQuantity} ${exampleBookUnit}`,
      },
      {
        account_id: exampleTaxAccountId,
        debit: bookTaxAmount,
        memo: 'PPN masukan pembelian marketplace',
      },
      {
        account_id: exampleFreightAccountId,
        debit: bookFreightAmount,
        memo: 'Ongkir masuk marketplace',
      },
      {
        account_id: exampleDiscountAccountId,
        credit: bookDiscountAmount,
        memo: 'Diskon supplier marketplace',
      },
      {
        account_id: examplePayableAccountId,
        credit: bookPayableAmount,
        memo: 'Sisa hutang supplier marketplace',
      },
    ],
  }

  const endpointDocs: EndpointDoc[] = [
    {
      id: 'cash-read',
      label: 'Read Cash',
      method: 'GET',
      path: '/cash',
      summary: 'List active cash and bank accounts',
      operationId: 'listCashAccounts',
      scope: 'cash:read',
      description: 'Ambil daftar rekening bank aktif plus akun kas/bank likuid CoA `11xx` yang belum punya bridge `bank_accounts`, lengkap dengan saldo posted dan branch scope untuk API key Anda.',
      auth: ['ApiKeyAuth', 'BearerAuth'],
      parameters: [
        {
          name: 'x-api-key',
          in: 'header',
          required: false,
          schema: 'string',
          description: 'Primary authentication header.',
        },
        {
          name: 'Authorization',
          in: 'header',
          required: false,
          schema: 'Bearer <api-key>',
          description: 'Alternative bearer authentication using the same API key.',
        },
      ],
      requestBody: null,
      responses: [
        { status: '200', description: 'Cash account list returned successfully.' },
        { status: '401', description: 'API key missing, invalid, expired, or revoked.' },
        { status: '403', description: 'API key does not include `cash:read` scope.' },
        { status: '429', description: 'Per-key rate limit exceeded.' },
      ],
      notes: [
        '`source = bank_account` berarti rekening berasal dari tabel `bank_accounts` dan `bank_account_id` akan terisi.',
        '`source = gl_account` berarti akun kas/bank berasal langsung dari CoA `11xx`; `bank_account_id` bisa `null` sampai dipakai POST pertama kali.',
        'Saldo berasal dari jurnal berstatus `POSTED`, bukan dari draft transaksi.',
      ],
      examples: [
        {
          id: 'cash-read-mixed-sources',
          label: 'Mixed Cash Sources',
          description: `Contoh daftar rekening untuk org aktif, termasuk rekening bridge ${exampleCashAccountLabel} dan akun CoA kas/bank lain yang belum punya bridge.`,
          curl: buildCurlExample({
            baseUrl,
            method: 'GET',
            path: '/api/v1/cash',
          }),
          response: formatJson({
            success: true,
            data: [
              {
                id: exampleBankAccountId,
                bank_account_id: exampleBankAccountId,
                source: 'bank_account',
                name: exampleCashAccountLabel,
                account_id: exampleCashAccountId,
                account_code: defaultCashAccount?.code ?? '1105.1',
                account_name: defaultCashAccount?.name ?? exampleCashAccountLabel,
                account_number: defaultBankAccount?.account_number ?? '1',
                bank_name: exampleCashAccountLabel,
                balance: 3500000,
                currency: defaultBankAccount?.currency ?? 'IDR',
                branch_id: defaultBankAccount?.branch_id ?? exampleBranchId,
                is_active: true,
              },
              {
                id: cashAccounts.find((account) => !bankBackedCashAccountIds.has(account.id))?.id ?? 'gl-cash-account-id',
                bank_account_id: null,
                source: 'gl_account',
                name: cashAccounts.find((account) => !bankBackedCashAccountIds.has(account.id))?.name ?? 'Kas Besar',
                account_id: cashAccounts.find((account) => !bankBackedCashAccountIds.has(account.id))?.id ?? 'gl-cash-account-id',
                account_code: cashAccounts.find((account) => !bankBackedCashAccountIds.has(account.id))?.code ?? '1101',
                account_name: cashAccounts.find((account) => !bankBackedCashAccountIds.has(account.id))?.name ?? 'Kas Besar',
                account_number: null,
                bank_name: cashAccounts.find((account) => !bankBackedCashAccountIds.has(account.id))?.name ?? 'Kas Besar',
                balance: 1250000,
                currency: 'IDR',
                branch_id: exampleBranchId,
                is_active: true,
              },
            ],
            meta: {
              org_id: orgId,
              branch_scope: exampleBranchId,
              count: 2,
            },
          }),
        },
      ],
    },
    {
      id: 'inventory-read',
      label: 'Read Inventory',
      method: 'GET',
      path: '/inventory',
      summary: 'List inventory items',
      operationId: 'listInventoryItems',
      scope: 'inventory:read',
      description: 'Ambil daftar produk aktif dan stok inventori yang bisa difilter berdasarkan nama produk.',
      auth: ['ApiKeyAuth', 'BearerAuth'],
      parameters: [
        {
          name: 'limit',
          in: 'query',
          required: false,
          schema: 'integer (1..500)',
          description: 'Maximum records returned. Default 100, maximum 500.',
        },
        {
          name: 'search',
          in: 'query',
          required: false,
          schema: 'string',
          description: 'Case-insensitive filter by product name.',
        },
      ],
      requestBody: null,
      responses: [
        { status: '200', description: 'Inventory list returned successfully.' },
        { status: '401', description: 'API key missing, invalid, expired, or revoked.' },
        { status: '403', description: 'API key does not include `inventory:read` scope.' },
        { status: '429', description: 'Per-key rate limit exceeded.' },
      ],
      notes: [
        'Gunakan `limit` untuk pagination sederhana hingga maksimum 500 baris.',
        'Field `search` memfilter nama produk secara case-insensitive.',
      ],
      examples: [
        {
          id: 'inventory-read-default',
          label: 'Inventory List',
          description: `Contoh pengecekan stok item buku di org aktif sebelum payload pembelian marketplace dikirim.`,
          query: `limit=20&search=${encodeURIComponent(String(preferredInventoryProduct?.name ?? 'buku'))}`,
          curl: buildCurlExample({
            baseUrl,
            method: 'GET',
            path: '/api/v1/inventory',
            query: `limit=20&search=${encodeURIComponent(String(preferredInventoryProduct?.name ?? 'buku'))}`,
          }),
          response: formatJson({
            success: true,
            data: [
              {
                id: preferredInventoryProduct?.id ?? 'product-id',
                code: preferredInventoryProduct?.sku ?? 'BMS3',
                name: preferredInventoryProduct?.name ?? 'BUKU MATEMATIKA SERIES 3',
                unit: preferredInventoryProduct?.unit ?? 'Pcs',
                category: preferredInventoryProduct?.category ?? 'Siap Jual',
                selling_price: toSafeAmount(preferredInventoryProduct?.selling_price, 13333.33),
                cost_price: toSafeAmount(preferredInventoryProduct?.purchase_price ?? preferredInventoryProduct?.average_cost, 9600),
                stock_quantity: 3,
                branch_id: null,
                is_active: true,
              },
            ],
            meta: {
              org_id: orgId,
              branch_scope: exampleBranchId,
              count: 1,
            },
          }),
        },
      ],
    },
    {
      id: 'cash-create',
      label: 'Create Cash',
      method: 'POST',
      path: '/cash',
      summary: 'Create a cash transaction',
      operationId: 'createCashTransaction',
      scope: 'cash:write',
      description: 'Buat transaksi kas masuk atau kas keluar dari sistem eksternal dengan satu endpoint. `account_id` bisa langsung menunjuk akun kas/bank CoA `11xx`, dan `journal_lines` bisa dipakai untuk split jurnal inventory, pajak, diskon, hutang, piutang, atau biaya lain agar tetap masuk ke buku besar secara balance.',
      auth: ['ApiKeyAuth', 'BearerAuth'],
      parameters: [
        {
          name: 'x-api-key',
          in: 'header',
          required: false,
          schema: 'string',
          description: 'Primary authentication header.',
        },
        {
          name: 'Authorization',
          in: 'header',
          required: false,
          schema: 'Bearer <api-key>',
          description: 'Alternative bearer authentication using the same API key.',
        },
        {
          name: 'Idempotency-Key',
          in: 'header',
          required: false,
          schema: 'string',
          description: 'Disarankan untuk retry-safe POST agar request yang sama tidak membuat transaksi ganda.',
        },
      ],
      requestBody: {
        required: true,
        contentType: 'application/json',
        fields: [
          '`type` enum: `in` | `out`',
          '`amount` number > 0',
          '`description` string',
          '`reference` string, optional',
          '`idempotency_key` string, optional tetapi disarankan untuk retry-safe write',
          '`branch_id` UUID, required only when API key tidak branch-scoped',
          '`transaction_date` date string (YYYY-MM-DD), optional',
          '`bank_account_id` UUID, optional override untuk row `bank_accounts` spesifik',
          '`account_id` UUID, optional akun kas/bank CoA `11xx`; bridge `bank_accounts` dibuat otomatis bila belum ada',
          '`category_id` / `counter_account_id` UUID, optional override akun lawan untuk mode sederhana',
          '`settlement_type` enum: `general` | `revenue` | `expense` | `receivable` | `payable` | `tax` | `discount` | `other_charge`',
          '`journal_lines[]`, optional split jurnal tanpa baris kas/bank; tiap line pakai `account_id`/`category_id` dan tepat satu sisi `debit` atau `credit`',
        ],
      },
      responses: [
        { status: '200', description: 'Cash transaction created successfully.' },
        { status: '400', description: 'Invalid JSON or missing required fields.' },
        { status: '401', description: 'API key missing, invalid, expired, or revoked.' },
        { status: '403', description: 'API key does not include `cash:write` scope.' },
        { status: '409', description: 'Idempotency key conflict or same request masih diproses.' },
        { status: '422', description: 'Default cash account configuration is incomplete.' },
        { status: '429', description: 'Per-key rate limit exceeded.' },
      ],
      notes: [
        'Gunakan `Idempotency-Key` header atau `idempotency_key` di body untuk semua write dari middleware, marketplace, atau POS yang bisa retry otomatis.',
        '`journal_lines` hanya dipakai ketika `auto_post` aktif; akun kas/bank utama akan ditambahkan sistem otomatis dari `amount` dan `type`.',
        'Pada mode split, `amount` harus sama dengan arus kas aktual. Sisa yang belum dibayar dicatat sebagai `credit` ke hutang atau `debit` ke piutang di `journal_lines`.',
        'Setiap line wajib punya tepat satu sisi `debit` atau `credit`, dan total semua line harus balance terhadap baris kas/bank.',
        'Khusus `type = out`, akun kas/bank yang dipakai harus sudah punya saldo posted. Jika belum, lakukan cash-in atau opening balance lebih dulu.',
      ],
      examples: [
        {
          id: 'cash-create-receivable',
          label: 'Pelunasan Piutang',
          description: 'Kas masuk sederhana untuk pelunasan invoice ke akun piutang.',
          body: formatJson(receivableExampleBody),
          curl: buildCurlExample({
            baseUrl,
            method: 'POST',
            path: '/api/v1/cash',
            body: receivableExampleBody,
          }),
          response: formatJson({
            success: true,
            data: {
              id: 'cash-transaction-id',
              reference_number: 'INV-2026-001',
              amount: 250000,
              description: 'Pelunasan invoice INV-2026-001',
              status: 'POSTED',
              created_at: '2026-04-15T10:30:00.000Z',
              journal_entry_id: 'journal-entry-id',
              bank_account_id: exampleBankAccountId,
              category_id: initialAccounts.find((account) => account.code === '1201')?.id ?? 'receivable-account-id',
              transaction_date: '2026-04-15',
            },
            meta: {
              type: 'cash_in',
              auto_post: true,
              settlement_type: 'receivable',
            },
          }),
        },
        {
          id: 'cash-create-online-book-purchase',
          label: 'Push Pembelian Buku',
          description: `Simulasi push dari toko online untuk pembelian ${exampleBookSku} di ${exampleBranchLabel}, memakai kas ${exampleCashAccountLabel} dengan saldo acuan ${exampleCashAvailableBalance.toLocaleString('id-ID')}, lalu membagi persediaan, PPN, ongkir, diskon, dan sisa hutang.`,
          body: formatJson(onlineBookPurchaseBody),
          curl: buildCurlExample({
            baseUrl,
            method: 'POST',
            path: '/api/v1/cash',
            body: onlineBookPurchaseBody,
          }),
          response: formatJson({
            success: true,
            data: {
              id: 'cash-transaction-id',
              reference_number: 'PO-MP-BOOK-2026-0001',
              amount: bookCashPaidAmount,
              description: `Push marketplace pembelian ${exampleBookSku} - ${exampleBookProductName}`,
              status: 'POSTED',
              created_at: '2026-04-15T10:45:00.000Z',
              journal_entry_id: 'journal-entry-id',
              bank_account_id: exampleBankAccountId,
              category_id: exampleInventoryAccountId,
              transaction_date: '2026-04-15',
            },
            meta: {
              type: 'cash_out',
              auto_post: true,
              settlement_type: 'general',
            },
          }),
        },
      ],
    },
    {
      id: 'sales-read',
      label: 'Read Sales',
      method: 'GET',
      path: '/sales',
      summary: 'List sales documents',
      operationId: 'listSalesDocuments',
      scope: 'sales:read',
      description: 'Ambil daftar penjualan dari schema `sales` yang sudah dipakai sistem, lengkap dengan nomor transaksi, customer, nominal, status, dan tanggal order.',
      auth: ['ApiKeyAuth', 'BearerAuth'],
      parameters: [
        {
          name: 'limit',
          in: 'query',
          required: false,
          schema: 'integer (1..200)',
          description: 'Maximum records returned. Default 50, maximum 200.',
        },
        {
          name: 'status',
          in: 'query',
          required: false,
          schema: 'string',
          description: 'Filter exact status penjualan, mis. `ORDERED`.',
        },
        {
          name: 'date_from',
          in: 'query',
          required: false,
          schema: 'date (YYYY-MM-DD)',
          description: 'Batas bawah tanggal penjualan (inklusif).',
        },
        {
          name: 'date_to',
          in: 'query',
          required: false,
          schema: 'date (YYYY-MM-DD)',
          description: 'Batas atas tanggal penjualan (inklusif).',
        },
      ],
      requestBody: null,
      responses: [
        { status: '200', description: 'Sales list returned successfully.' },
        { status: '401', description: 'API key missing, invalid, expired, or revoked.' },
        { status: '403', description: 'API key does not include `sales:read` scope.' },
        { status: '429', description: 'Per-key rate limit exceeded.' },
      ],
      notes: [
        'Data berasal dari tabel `sales`, bukan schema sementara atau `sales_orders` lama.',
        'Gunakan kombinasi `status`, `date_from`, dan `date_to` untuk sinkronisasi incremental.',
      ],
      examples: [
        {
          id: 'sales-read-default',
          label: 'Sales List',
          description: 'Contoh sinkronisasi dokumen penjualan terbaru untuk ERP atau middleware eksternal.',
          query: 'limit=10&status=ORDERED&date_from=2026-04-01&date_to=2026-04-30',
          curl: buildCurlExample({
            baseUrl,
            method: 'GET',
            path: '/api/v1/sales',
            query: 'limit=10&status=ORDERED&date_from=2026-04-01&date_to=2026-04-30',
          }),
          response: formatJson({
            success: true,
            data: [
              {
                id: 'sale-id',
                so_number: 'SO-2026-000001',
                customer_name: 'CV Maju',
                total_amount: 250000,
                status: 'ORDERED',
                branch_id: exampleBranchId,
                order_date: '2026-04-18',
                created_at: '2026-04-18T00:00:00.000Z',
              },
            ],
            meta: {
              org_id: orgId,
              branch_scope: exampleBranchId,
              count: 1,
            },
          }),
        },
      ],
    },
    {
      id: 'contacts-read',
      label: 'Read Contacts',
      method: 'GET',
      path: '/contacts',
      summary: 'List contacts',
      operationId: 'listContacts',
      scope: 'contacts:read',
      description: 'Ambil daftar kontak aktif customer atau supplier untuk kebutuhan sinkronisasi master data eksternal.',
      auth: ['ApiKeyAuth', 'BearerAuth'],
      parameters: [
        {
          name: 'limit',
          in: 'query',
          required: false,
          schema: 'integer (1..500)',
          description: 'Maximum records returned. Default 100, maximum 500.',
        },
        {
          name: 'type',
          in: 'query',
          required: false,
          schema: '`customer` | `supplier`',
          description: 'Filter tipe kontak.',
        },
        {
          name: 'search',
          in: 'query',
          required: false,
          schema: 'string',
          description: 'Case-insensitive filter by contact name.',
        },
      ],
      requestBody: null,
      responses: [
        { status: '200', description: 'Contacts list returned successfully.' },
        { status: '401', description: 'API key missing, invalid, expired, or revoked.' },
        { status: '403', description: 'API key does not include `contacts:read` scope.' },
        { status: '429', description: 'Per-key rate limit exceeded.' },
      ],
      notes: [
        'Route ini hanya mengembalikan kontak aktif.',
        'Gunakan `type=supplier` atau `type=customer` untuk sinkronisasi master data per channel.',
      ],
      examples: [
        {
          id: 'contacts-read-default',
          label: 'Contacts List',
          description: 'Contoh sinkronisasi supplier aktif berdasarkan nama.',
          query: 'limit=20&type=supplier&search=andi',
          curl: buildCurlExample({
            baseUrl,
            method: 'GET',
            path: '/api/v1/contacts',
            query: 'limit=20&type=supplier&search=andi',
          }),
          response: formatJson({
            success: true,
            data: [
              {
                id: 'contact-id',
                name: 'Andi Supplier',
                email: 'andi@example.com',
                phone: '08123',
                type: 'supplier',
                company: 'PT Supplier',
                is_active: true,
                created_at: '2026-04-18T00:00:00.000Z',
              },
            ],
            meta: {
              org_id: orgId,
              count: 1,
            },
          }),
        },
      ],
    },
  ]

  const activeEndpointDoc = endpointDocs.find((doc) => doc.id === activeDoc) ?? endpointDocs[0]
  const defaultEndpointExampleId =
    (activeEndpointDoc.id === 'cash-create'
      ? activeEndpointDoc.examples.find((example) => example.id === 'cash-create-online-book-purchase')?.id
      : null)
    ?? activeEndpointDoc.examples[0]?.id
    ?? ''
  const activeEndpointExample =
    activeEndpointDoc.examples.find((example) => example.id === activeExampleId)
    ?? activeEndpointDoc.examples[0]

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setResolvedBaseUrl(window.location.origin)
    }
  }, [])

  useEffect(() => {
    setActiveExampleId(defaultEndpointExampleId)
  }, [activeDoc, defaultEndpointExampleId])

  useEffect(() => {
    setTryPath(`/api/v1${activeEndpointDoc.path}`)
    setTryQuery(activeEndpointExample?.query ?? '')
    setTryBody(activeEndpointDoc.method === 'GET' ? '' : (activeEndpointExample?.body ?? ''))
  }, [activeEndpointDoc.path, activeEndpointDoc.method, activeEndpointExample?.id, activeEndpointExample?.body, activeEndpointExample?.query])

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

  const handleRunTryout = async () => {
    const normalizedApiKey = normalizeTryApiKeyValue(tryApiKey)

    if (!normalizedApiKey) {
      setTryError('Masukkan API key terlebih dahulu.')
      return
    }

    if (normalizedApiKey !== tryApiKey) {
      setTryApiKey(normalizedApiKey)
    }

    if (!isValidTryApiKeyFormat(normalizedApiKey)) {
      setTryError('API key harus memakai format `nzm_live_...` tanpa spasi, newline, smart quote, atau karakter khusus lain.')
      return
    }

    const trimmedPath = tryPath.trim().startsWith('/') ? tryPath.trim() : `/${tryPath.trim()}`
    const normalizedQuery = tryQuery.trim().replace(/^\?/, '')
    const requestUrl = `${resolvedBaseUrl}${trimmedPath}${normalizedQuery ? `?${normalizedQuery}` : ''}`
    const method = activeEndpointDoc.method
    const headers: Record<string, string> = {
      Accept: 'application/json',
    }

    if (tryAuthMode === 'bearer') {
      headers.Authorization = `Bearer ${normalizedApiKey}`
    } else {
      headers['x-api-key'] = normalizedApiKey
    }

    const invalidHeaderEntry = Object.entries(headers).find(([, value]) => !isBrowserSafeHeaderValue(value))
    if (invalidHeaderEntry) {
      setTryError(`Header ${invalidHeaderEntry[0]} mengandung karakter non-standar. Gunakan API key plain-text tanpa karakter tersembunyi.`)
      return
    }

    let body: string | undefined
    if (method !== 'GET') {
      if (!tryBody.trim()) {
        setTryError('Request body wajib diisi untuk endpoint non-GET.')
        return
      }

      try {
        body = JSON.stringify(JSON.parse(tryBody))
      } catch {
        setTryError('Request body harus valid JSON.')
        return
      }

      headers['Content-Type'] = 'application/json'
    }

    let requestHeaders: Headers
    try {
      requestHeaders = new Headers(headers)
    } catch {
      setTryError('Header request tidak valid. Pastikan API key tidak mengandung karakter non ISO-8859-1 seperti smart quote, en dash, atau zero-width space.')
      return
    }

    setTryLoading(true)
    setTryError(null)
    setTryStatus(null)
    setTryResponse('')

    try {
      const response = await fetch(requestUrl, {
        method,
        headers: requestHeaders,
        body,
      })
      const rawText = await response.text()

      let formatted = rawText
      try {
        formatted = JSON.stringify(JSON.parse(rawText), null, 2)
      } catch {
        // Keep raw body when response is not JSON.
      }

      setTryStatus(response.status)
      setTryResponse(formatted)
    } catch (error) {
      setTryError(error instanceof Error ? error.message : 'Permintaan gagal dikirim.')
    } finally {
      setTryLoading(false)
    }
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
            <code className="text-sm font-black text-slate-800">{resolvedBaseUrl}/api/v1/</code>
            <p className="mt-2 text-xs text-slate-500 font-medium">
              Dokumentasi mesin-baca tersedia di{' '}
              <a href={`${resolvedBaseUrl}/api/openapi`} target="_blank" rel="noreferrer" className="font-black text-violet-700 hover:text-violet-800">
                {resolvedBaseUrl}/api/openapi
              </a>
            </p>
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

      <div className="rounded-[32px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-6 shadow-sm space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">Onboarding Checklist</p>
            <h2 className="text-xl font-black text-slate-900">Kesiapan Integrasi Open API</h2>
            <p className="text-sm text-slate-600 font-medium">
              Checklist ini memastikan endpoint write tidak macet karena key, rekening, atau mapping default belum siap.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 self-start rounded-2xl border border-emerald-200 bg-white px-4 py-2 text-sm font-black text-slate-700">
            <CheckCircle2 size={16} className="text-emerald-600" />
            {onboardingReadyCount}/{onboardingItems.length} siap
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {onboardingItems.map((item) => (
            <div
              key={item.id}
              className={`rounded-[24px] border p-4 ${
                item.ready
                  ? 'border-emerald-200 bg-white'
                  : 'border-amber-200 bg-amber-50/70'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 ${item.ready ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {item.ready ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-black text-slate-900">{item.label}</p>
                  <p className="text-xs leading-relaxed text-slate-600">{item.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm space-y-5">
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">OpenAPI 3.1 Documentation</p>
          <h2 className="text-xl font-black text-slate-900">International-Standard API Reference</h2>
          <p className="text-sm text-slate-500 font-medium">
            Referensi ini mengikuti struktur OpenAPI: operation summary, operationId, security scheme, parameters, request body, responses, dan contoh payload.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {endpointDocs.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => setActiveDoc(doc.id)}
              className={`px-4 py-2 rounded-2xl border text-[11px] font-black uppercase tracking-widest transition-all ${
                activeDoc === doc.id
                  ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                  : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
              }`}
            >
              {doc.path}
              <span className="ml-2 opacity-80">{doc.method}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-5">
          <div className="rounded-[28px] border border-slate-100 bg-slate-50 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="px-3 py-1 rounded-xl bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-700">
                {activeEndpointDoc.method}
              </div>
              <code className="text-sm font-black text-slate-900">{activeEndpointDoc.path}</code>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-black text-slate-900">{activeEndpointDoc.summary}</p>
              <p className="text-sm text-slate-600 leading-relaxed">{activeEndpointDoc.description}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-violet-100 text-violet-700 text-[10px] font-black uppercase tracking-widest">
                <Shield size={12} /> Scope: {activeEndpointDoc.scope}
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-widest">
                <Lock size={12} /> Security: {activeEndpointDoc.auth.join(' / ')}
              </span>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Operation Metadata</p>
              <div className="space-y-2">
                <div className="rounded-2xl bg-white border border-slate-100 px-4 py-3 text-sm text-slate-600">
                  <span className="font-black text-slate-800">operationId:</span> {activeEndpointDoc.operationId}
                </div>
                <div className="rounded-2xl bg-white border border-slate-100 px-4 py-3 text-sm text-slate-600">
                  <span className="font-black text-slate-800">Security schemes:</span> {activeEndpointDoc.auth.join(', ')}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Parameters</p>
              <div className="space-y-2">
                {activeEndpointDoc.parameters.map((item: EndpointParameter) => (
                  <div key={`${item.in}-${item.name}`} className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-600">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-slate-900">{item.name}</span>
                      <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">{item.in}</span>
                      <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">{item.required ? 'required' : 'optional'}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Schema: {item.schema}</p>
                    <p className="mt-1">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {activeEndpointDoc.requestBody && (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Request Body</p>
                <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-600">
                  <p><span className="font-black text-slate-900">Required:</span> {activeEndpointDoc.requestBody.required ? 'yes' : 'no'}</p>
                  <p className="mt-1"><span className="font-black text-slate-900">Content-Type:</span> {activeEndpointDoc.requestBody.contentType}</p>
                  <div className="mt-2 space-y-1">
                    {activeEndpointDoc.requestBody.fields.map((field: string) => (
                      <div key={field} className="text-sm text-slate-600">{field}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Responses</p>
              <div className="space-y-2">
                {activeEndpointDoc.responses.map((item: EndpointResponse) => (
                  <div key={item.status} className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-600">
                    <span className="font-black text-slate-900">{item.status}</span> {item.description}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Implementation Notes</p>
              <div className="space-y-2">
                {activeEndpointDoc.notes.map((note) => (
                  <div key={note} className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900/80">
                    {note}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[28px] border border-slate-100 bg-white p-5 space-y-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Example Templates</p>
                <p className="text-sm text-slate-500 mt-1">
                  Pilih contoh yang akan dipakai untuk dokumentasi visual dan prefill di tab Try API.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeEndpointDoc.examples.map((example) => (
                  <button
                    key={example.id}
                    type="button"
                    onClick={() => setActiveExampleId(example.id)}
                    className={`px-4 py-2 rounded-2xl border text-[11px] font-black uppercase tracking-widest transition-all ${
                      activeEndpointExample.id === example.id
                        ? 'bg-violet-600 text-white border-violet-600 shadow-md'
                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-violet-300'
                    }`}
                  >
                    {example.label}
                  </button>
                ))}
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <span className="font-black text-slate-900">Template aktif:</span> {activeEndpointExample.description}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-100 bg-slate-950 p-5">
              <div className="flex items-center gap-2 mb-3 text-slate-300">
                <Globe size={14} />
                <p className="text-[10px] font-black uppercase tracking-widest">Contoh Request</p>
              </div>
              <pre className="text-[11px] text-emerald-300 font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">
{activeEndpointExample.curl}
              </pre>
            </div>

            <div className="rounded-[28px] border border-slate-100 bg-white p-5">
              <div className="flex items-center gap-2 mb-3 text-slate-500">
                <Code size={14} />
                <p className="text-[10px] font-black uppercase tracking-widest">Contoh Response</p>
              </div>
              <pre className="text-[11px] text-slate-700 font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">
{activeEndpointExample.response}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl w-fit flex-wrap">
        {[
          { id: 'keys', label: 'API Keys', icon: Key },
          { id: 'tryout', label: 'Try API', icon: Globe },
          { id: 'cashin', label: 'Cash In', icon: ArrowDownCircle },
          { id: 'cashout', label: 'Cash Out', icon: ArrowUpCircle },
          { id: 'webhook', label: 'Webhook', icon: Webhook },
          { id: 'history', label: 'History', icon: History },
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

      {activeTab === 'tryout' && (
        <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-5">
          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-6 space-y-5">
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Interactive Console</p>
              <h3 className="text-xl font-black text-slate-900">Try API with Real Key</h3>
              <p className="text-sm text-slate-500 font-medium">
                Gunakan API key yang baru dibuat untuk menguji endpoint langsung dari browser pada origin saat ini.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em]">Endpoint</label>
              <div className="flex flex-wrap gap-2">
                {endpointDocs.map((doc) => (
                  <button
                    key={`try-${doc.id}`}
                    type="button"
                    onClick={() => setActiveDoc(doc.id)}
                    className={`px-4 py-2 rounded-2xl border text-[11px] font-black uppercase tracking-widest transition-all ${
                      activeDoc === doc.id
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {doc.method} {doc.path}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em]">Template</label>
              <div className="flex flex-wrap gap-2">
                {activeEndpointDoc.examples.map((example) => (
                  <button
                    key={`try-example-${example.id}`}
                    type="button"
                    onClick={() => setActiveExampleId(example.id)}
                    className={`px-4 py-2 rounded-2xl border text-[11px] font-black uppercase tracking-widest transition-all ${
                      activeEndpointExample.id === example.id
                        ? 'bg-violet-600 text-white border-violet-600 shadow-md'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300'
                    }`}
                  >
                    {example.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Mengganti template akan mengisi `path`, `query`, dan `JSON body`, lalu Anda masih bisa edit manual sebelum run.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[0.75fr_1.25fr] gap-4">
              <div className="space-y-2">
                <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em]">Auth Header</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['x-api-key', 'bearer'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setTryAuthMode(mode)}
                      className={`px-4 py-3 rounded-2xl border text-[11px] font-black uppercase tracking-widest transition-all ${
                        tryAuthMode === mode
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em]">API Key</label>
                <input
                  type="password"
                  value={tryApiKey}
                  onChange={(e) => setTryApiKey(e.target.value.replace(/[\r\n\t]/g, ''))}
                  onBlur={() => setTryApiKey((prev) => normalizeTryApiKeyValue(prev))}
                  placeholder="nzm_live_xxxxxxxxxxxxxxxxx"
                  className="w-full px-4 py-3 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-violet-50 focus:border-violet-500 font-mono"
                />
                <p className="text-[11px] text-slate-400 font-medium">
                  Tempel API key plain-text saja. Karakter tersembunyi dari copy-paste akan dibersihkan otomatis.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em]">Request URL</label>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-mono text-slate-600">
                {activeEndpointDoc.method} {resolvedBaseUrl}{tryPath}{tryQuery.trim() ? `?${tryQuery.trim().replace(/^\?/, '')}` : ''}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em]">Path</label>
                <input
                  value={tryPath}
                  onChange={(e) => setTryPath(e.target.value)}
                  className="w-full px-4 py-3 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-violet-50 focus:border-violet-500 font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em]">Query String</label>
                <input
                  value={tryQuery}
                  onChange={(e) => setTryQuery(e.target.value)}
                  placeholder="limit=50&search=beras"
                  className="w-full px-4 py-3 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-violet-50 focus:border-violet-500 font-mono"
                />
              </div>
            </div>

            {activeEndpointDoc.method !== 'GET' && (
              <div className="space-y-2">
                <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em]">JSON Body</label>
                <textarea
                  value={tryBody}
                  onChange={(e) => setTryBody(e.target.value)}
                  rows={12}
                  className="w-full px-4 py-3 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-violet-50 focus:border-violet-500 font-mono"
                />
              </div>
            )}

            {tryError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {tryError}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
              <p className="text-xs text-slate-400">
                Tester ini memanggil endpoint live yang sama dengan integrasi eksternal Anda.
              </p>
              <button
                type="button"
                onClick={handleRunTryout}
                disabled={tryLoading}
                className="px-6 py-3 bg-violet-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-violet-700 transition-all shadow-lg shadow-violet-200 disabled:opacity-50"
              >
                {tryLoading ? 'Menjalankan...' : 'Run Request'}
              </button>
            </div>
          </div>

          <div className="space-y-5">
            <div className="bg-slate-950 rounded-[32px] border border-slate-800 p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Response</p>
                  <h3 className="text-lg font-black text-white">Live Result</h3>
                </div>
                <div className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-widest ${
                  tryStatus === null
                    ? 'bg-slate-800 text-slate-300'
                    : tryStatus < 300
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-red-500/20 text-red-300'
                }`}>
                  {tryStatus === null ? 'Not Run' : `HTTP ${tryStatus}`}
                </div>
              </div>
              <pre className="min-h-[420px] whitespace-pre-wrap break-words rounded-2xl bg-black/30 p-4 text-[11px] leading-relaxed text-emerald-300 overflow-auto">
                {tryResponse || 'Response akan muncul di sini setelah request dijalankan.'}
              </pre>
            </div>

            <div className="bg-white rounded-[32px] border border-slate-100 p-6 space-y-3 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Current Operation</p>
              <h4 className="text-lg font-black text-slate-900">{activeEndpointDoc.summary}</h4>
              <p className="text-sm text-slate-500">{activeEndpointDoc.description}</p>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <span className="font-black text-slate-900">Template aktif:</span> {activeEndpointExample.label}
                <p className="mt-1 text-slate-500">{activeEndpointExample.description}</p>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-violet-100 text-violet-700 text-[10px] font-black uppercase tracking-widest">
                  <Shield size={12} /> Scope: {activeEndpointDoc.scope}
                </span>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-widest">
                  <Code size={12} /> operationId: {activeEndpointDoc.operationId}
                </span>
              </div>
              <div className="space-y-2 pt-1">
                {activeEndpointDoc.notes.map((note) => (
                  <div key={`try-note-${note}`} className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900/80">
                    {note}
                  </div>
                ))}
              </div>
            </div>
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
                <option value="">— Pilih Akun Kas/Bank 11xx —</option>
                {cashAccounts.map(a => (
                  <option key={a.id} value={a.id}>{formatAccountOption(a)}</option>
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
                <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">Akun Lawan Default (Kredit)</label>
                <p className="text-xs text-slate-400 ml-1 mb-2">Dipakai saat request tidak mengirim `category_id` / `counter_account_id`. Bisa berupa pendapatan, piutang, hutang, pajak, diskon, atau biaya lain.</p>
                <select
                  value={String(config.cash_in_params?.counter_account_id ?? config.cash_in_params?.revenue_account_id ?? '')}
                  onChange={e => setConfig(c => ({ ...c, cash_in_params: { ...c.cash_in_params, counter_account_id: e.target.value || undefined } }))}
                  className="w-full px-5 py-3 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 font-bold bg-white"
                >
                  <option value="">— Pilih Akun Lawan —</option>
                  {counterAccounts.map(a => (
                    <option key={a.id} value={a.id}>{formatAccountOption(a)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-[28px] border border-emerald-100 bg-emerald-50/60 p-5 space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">Mapping Settlement Lanjutan</p>
                <p className="text-xs text-emerald-900/70 font-medium mt-1">Digunakan ketika request mengirim `settlement_type` agar kas masuk otomatis diarahkan ke akun piutang, hutang, pajak, diskon, atau biaya lain.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-black text-emerald-700 tracking-[0.2em] ml-1">Piutang / Receivable</label>
                  <select
                    value={String(config.cash_in_params?.receivable_account_id ?? '')}
                    onChange={e => setConfig(c => ({ ...c, cash_in_params: { ...c.cash_in_params, receivable_account_id: e.target.value || undefined } }))}
                    className="w-full px-4 py-3 text-sm border border-emerald-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 font-bold bg-white"
                  >
                    <option value="">— Opsional —</option>
                    {counterAccounts.map(a => (
                      <option key={a.id} value={a.id}>{formatAccountOption(a)}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-black text-emerald-700 tracking-[0.2em] ml-1">Hutang / Payable</label>
                  <select
                    value={String(config.cash_in_params?.payable_account_id ?? '')}
                    onChange={e => setConfig(c => ({ ...c, cash_in_params: { ...c.cash_in_params, payable_account_id: e.target.value || undefined } }))}
                    className="w-full px-4 py-3 text-sm border border-emerald-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 font-bold bg-white"
                  >
                    <option value="">— Opsional —</option>
                    {counterAccounts.map(a => (
                      <option key={a.id} value={a.id}>{formatAccountOption(a)}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-black text-emerald-700 tracking-[0.2em] ml-1">Pajak</label>
                  <select
                    value={String(config.cash_in_params?.tax_account_id ?? '')}
                    onChange={e => setConfig(c => ({ ...c, cash_in_params: { ...c.cash_in_params, tax_account_id: e.target.value || undefined } }))}
                    className="w-full px-4 py-3 text-sm border border-emerald-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 font-bold bg-white"
                  >
                    <option value="">— Opsional —</option>
                    {counterAccounts.map(a => (
                      <option key={a.id} value={a.id}>{formatAccountOption(a)}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-black text-emerald-700 tracking-[0.2em] ml-1">Diskon / Potongan</label>
                  <select
                    value={String(config.cash_in_params?.discount_account_id ?? '')}
                    onChange={e => setConfig(c => ({ ...c, cash_in_params: { ...c.cash_in_params, discount_account_id: e.target.value || undefined } }))}
                    className="w-full px-4 py-3 text-sm border border-emerald-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 font-bold bg-white"
                  >
                    <option value="">— Opsional —</option>
                    {counterAccounts.map(a => (
                      <option key={a.id} value={a.id}>{formatAccountOption(a)}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-black text-emerald-700 tracking-[0.2em] ml-1">Biaya Lain-lain</label>
                  <select
                    value={String(config.cash_in_params?.other_charge_account_id ?? '')}
                    onChange={e => setConfig(c => ({ ...c, cash_in_params: { ...c.cash_in_params, other_charge_account_id: e.target.value || undefined } }))}
                    className="w-full px-4 py-3 text-sm border border-emerald-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 font-bold bg-white"
                  >
                    <option value="">— Opsional —</option>
                    {counterAccounts.map(a => (
                      <option key={a.id} value={a.id}>{formatAccountOption(a)}</option>
                    ))}
                  </select>
                </div>
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
                  <p className="text-xs text-slate-400">Jika aktif, transaksi langsung POSTED ke modul kas/bank dan jurnal akuntansi. Jika nonaktif, transaksi disimpan sebagai DRAFT.</p>
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
                <option value="">— Pilih Akun Kas/Bank 11xx —</option>
                {cashAccounts.map(a => (
                  <option key={a.id} value={a.id}>{formatAccountOption(a)}</option>
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
                <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">Akun Lawan Default (Debit)</label>
                <p className="text-xs text-slate-400 ml-1 mb-2">Dipakai saat request tidak mengirim `category_id` / `counter_account_id`. Bisa berupa beban, piutang, hutang, pajak, diskon, atau biaya lain.</p>
                <select
                  value={String(config.cash_out_params?.counter_account_id ?? config.cash_out_params?.expense_account_id ?? '')}
                  onChange={e => setConfig(c => ({ ...c, cash_out_params: { ...c.cash_out_params, counter_account_id: e.target.value || undefined } }))}
                  className="w-full px-5 py-3 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-rose-50 focus:border-rose-400 font-bold bg-white"
                >
                  <option value="">— Pilih Akun Lawan —</option>
                  {counterAccounts.map(a => (
                    <option key={a.id} value={a.id}>{formatAccountOption(a)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-[28px] border border-rose-100 bg-rose-50/60 p-5 space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-700">Mapping Settlement Lanjutan</p>
                <p className="text-xs text-rose-900/70 font-medium mt-1">Digunakan ketika request mengirim `settlement_type` agar kas keluar otomatis diarahkan ke akun piutang, hutang, pajak, diskon, atau biaya lain.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-black text-rose-700 tracking-[0.2em] ml-1">Piutang / Receivable</label>
                  <select
                    value={String(config.cash_out_params?.receivable_account_id ?? '')}
                    onChange={e => setConfig(c => ({ ...c, cash_out_params: { ...c.cash_out_params, receivable_account_id: e.target.value || undefined } }))}
                    className="w-full px-4 py-3 text-sm border border-rose-200 rounded-2xl outline-none focus:ring-4 focus:ring-rose-100 focus:border-rose-500 font-bold bg-white"
                  >
                    <option value="">— Opsional —</option>
                    {counterAccounts.map(a => (
                      <option key={a.id} value={a.id}>{formatAccountOption(a)}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-black text-rose-700 tracking-[0.2em] ml-1">Hutang / Payable</label>
                  <select
                    value={String(config.cash_out_params?.payable_account_id ?? '')}
                    onChange={e => setConfig(c => ({ ...c, cash_out_params: { ...c.cash_out_params, payable_account_id: e.target.value || undefined } }))}
                    className="w-full px-4 py-3 text-sm border border-rose-200 rounded-2xl outline-none focus:ring-4 focus:ring-rose-100 focus:border-rose-500 font-bold bg-white"
                  >
                    <option value="">— Opsional —</option>
                    {counterAccounts.map(a => (
                      <option key={a.id} value={a.id}>{formatAccountOption(a)}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-black text-rose-700 tracking-[0.2em] ml-1">Pajak</label>
                  <select
                    value={String(config.cash_out_params?.tax_account_id ?? '')}
                    onChange={e => setConfig(c => ({ ...c, cash_out_params: { ...c.cash_out_params, tax_account_id: e.target.value || undefined } }))}
                    className="w-full px-4 py-3 text-sm border border-rose-200 rounded-2xl outline-none focus:ring-4 focus:ring-rose-100 focus:border-rose-500 font-bold bg-white"
                  >
                    <option value="">— Opsional —</option>
                    {counterAccounts.map(a => (
                      <option key={a.id} value={a.id}>{formatAccountOption(a)}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-black text-rose-700 tracking-[0.2em] ml-1">Diskon / Potongan</label>
                  <select
                    value={String(config.cash_out_params?.discount_account_id ?? '')}
                    onChange={e => setConfig(c => ({ ...c, cash_out_params: { ...c.cash_out_params, discount_account_id: e.target.value || undefined } }))}
                    className="w-full px-4 py-3 text-sm border border-rose-200 rounded-2xl outline-none focus:ring-4 focus:ring-rose-100 focus:border-rose-500 font-bold bg-white"
                  >
                    <option value="">— Opsional —</option>
                    {counterAccounts.map(a => (
                      <option key={a.id} value={a.id}>{formatAccountOption(a)}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-black text-rose-700 tracking-[0.2em] ml-1">Biaya Lain-lain</label>
                  <select
                    value={String(config.cash_out_params?.other_charge_account_id ?? '')}
                    onChange={e => setConfig(c => ({ ...c, cash_out_params: { ...c.cash_out_params, other_charge_account_id: e.target.value || undefined } }))}
                    className="w-full px-4 py-3 text-sm border border-rose-200 rounded-2xl outline-none focus:ring-4 focus:ring-rose-100 focus:border-rose-500 font-bold bg-white"
                  >
                    <option value="">— Opsional —</option>
                    {counterAccounts.map(a => (
                      <option key={a.id} value={a.id}>{formatAccountOption(a)}</option>
                    ))}
                  </select>
                </div>
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
                  <p className="text-xs text-slate-400">Jika aktif, transaksi langsung POSTED ke modul kas/bank dan jurnal akuntansi. Jika nonaktif, transaksi disimpan sebagai DRAFT.</p>
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
      {/* TAB: HISTORY                                  */}
      {/* ══════════════════════════════════════════════ */}
      {activeTab === 'history' && (
        <div className="space-y-5">
          <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/50 p-10 space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center">
                <History size={20} className="text-slate-600" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Call History</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Log setiap request ke Open API v1 — 50 request terakhir.
                </p>
              </div>
            </div>

            {callLogs.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-3 text-slate-400">
                <History size={32} strokeWidth={1} />
                <p className="text-sm font-medium">Belum ada request tercatat.</p>
                <p className="text-xs text-slate-400">Log akan muncul setelah ada API call dengan key yang valid.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {callLogs.map((log) => {
                  const isSuccess = log.status_code < 400
                  const isServerErr = log.status_code >= 500
                  const methodColor =
                    log.method === 'POST' ? 'bg-emerald-100 text-emerald-700' :
                    log.method === 'GET'  ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-600'
                  const statusColor =
                    isServerErr          ? 'bg-red-100 text-red-600' :
                    !isSuccess           ? 'bg-amber-100 text-amber-700' :
                    'bg-emerald-100 text-emerald-700'

                  return (
                    <div
                      key={log.id}
                      className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-all"
                    >
                      {isSuccess
                        ? <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                        : <XCircle size={15} className="text-red-400 shrink-0" />
                      }
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg uppercase ${methodColor}`}>
                        {log.method}
                      </span>
                      <span className="text-xs font-mono text-slate-700 flex-1 min-w-0 truncate">
                        {log.endpoint}
                      </span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${statusColor}`}>
                        {log.status_code}
                      </span>
                      {log.duration_ms != null && (
                        <span className="text-[10px] text-slate-400 font-medium shrink-0">
                          {log.duration_ms}ms
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {new Date(log.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
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
