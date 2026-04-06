import type { Metadata } from 'next'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'

import { getChartOfAccounts, seedInitialCoA, checkCanManageCoA, syncParentCoAToChildOrg } from '@/modules/accounting/actions/coa.actions'
import AccountRowActions from './components/AccountRowActions'

import { redirect } from 'next/navigation'
import type { Account, AccountType } from '@/types/database.types'

export const metadata: Metadata = { title: 'Chart of Accounts | NIZAM' }

const TYPE_LABELS: Record<AccountType, { label: string; color: string; bg: string }> = {
  ASSET:     { label: 'Aset',       color: '#1d4ed8', bg: '#dbeafe' },
  LIABILITY: { label: 'Liabilitas', color: '#b45309', bg: '#fef3c7' },
  EQUITY:    { label: 'Ekuitas',    color: '#6d28d9', bg: '#ede9fe' },
  REVENUE:   { label: 'Pendapatan', color: '#065f46', bg: '#d1fae5' },
  EXPENSE:   { label: 'Beban',      color: '#be185d', bg: '#fce7f3' },
}

export default async function ChartOfAccountsPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const orgEntity = orgData.org as typeof orgData.org & { parent_org_id?: string | null }
  const parentOrgId = orgEntity.parent_org_id ?? null

  // Self-healing sync:
  // setiap child membuka halaman CoA, tarik pembaruan terbaru dari parent dulu.
  if (parentOrgId) {
    const syncResult = await syncParentCoAToChildOrg(parentOrgId, orgData.org.id)
    if (!syncResult.success) {
      ;(console as any).warn('CoA sync warning (ChartOfAccountsPage)')
    }
  }

  const [accounts, { canManageDirect, isParentOrg }] = await Promise.all([
    getChartOfAccounts(orgData.org.id),
    checkCanManageCoA(orgData.org.id),
  ])

  // Group by type
  const grouped = accounts.reduce(
    (acc, account) => {
      if (!acc[account.type]) acc[account.type] = []
      acc[account.type].push(account)
      return acc
    },
    {} as Record<AccountType, Account[]>
  )

  const typeOrder: AccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Chart of Accounts</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {accounts.length} akun • Standar PSAK • Otomatis dibuat saat registrasi
          </p>
        </div>
        {canManageDirect ? (
          /* Parent/Holding: bisa tambah langsung */
          <a
            href="/settings/accounts/new"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-all"
            style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)' }}
          >
            + Tambah Akun
          </a>
        ) : (
          /* Child/Branch: harus melalui sistem request */
          <div className="flex items-center gap-2">
            <a
              href="/accounting/coa-requests"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-all"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Ajukan Rekening Baru
            </a>
          </div>
        )}
      </div>

      {/* Empty State */}
      {accounts.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Belum ada akun CoA</h3>
          <p className="text-gray-500 max-w-sm mx-auto mb-8 text-sm">
            Tabel Chart of Accounts (CoA) Anda masih kosong. Ini bisa terjadi jika terjadi kendala saat registrasi otomatis.
          </p>
          
          <form action={async () => {
            'use server'
            await seedInitialCoA(orgData.org.id)
          }}>
            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Siapkan Akun Standar PSAK Sekarang
            </button>
          </form>
        </div>
      )}

      {typeOrder.map((type) => {
        const typeAccounts = grouped[type] || []
        const meta = TYPE_LABELS[type]
        if (!typeAccounts.length) return null

        return (
          <div key={type} className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
            {/* Group header */}
            <div
              className="px-5 py-3 flex items-center gap-3 border-b"
              style={{ background: meta.bg, borderColor: '#e5e7eb' }}
            >
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: meta.color, color: '#fff' }}
              >
                {meta.label}
              </span>
              <span className="text-xs text-gray-500">{typeAccounts.length} akun</span>
            </div>

            {/* Account rows */}
            <div className="divide-y" style={{ borderColor: '#f3f4f6' }}>
              {typeAccounts.map((account: Account) => (
                <div
                  key={account.id}
                  className="flex items-center px-5 py-3 hover:bg-gray-50 transition-colors"
                  style={{ paddingLeft: account.parent_id ? '2.5rem' : '1.25rem' }}
                >
                  {/* Code */}
                  <span
                    className="text-xs font-mono font-semibold w-16 flex-shrink-0"
                    style={{ color: meta.color }}
                  >
                    {account.code}
                  </span>

                  {/* Name */}
                  <span className={`text-sm flex-1 ${!account.is_active ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {account.name}
                  </span>

                  {/* Normal balance */}
                  <span className="text-xs text-gray-400 hidden sm:block w-16 text-right">
                    {account.normal_balance === 'DEBIT' ? 'Debit' : 'Kredit'}
                  </span>

                  {/* System badge */}
                  {account.is_system && (
                    <span
                      className="ml-3 text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: '#f3f4f6', color: '#9ca3af' }}
                    >
                      Sistem
                    </span>
                  )}

                  {/* Active toggle & Actions */}
                  {!account.is_system && (
                    <div className="flex items-center gap-3 ml-4">
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: account.is_active ? '#10b981' : '#d1d5db' }}
                      />
                      <AccountRowActions 
                        accountId={account.id} 
                        orgId={orgData!.org.id} 
                        accountCode={account.code}
                        accountName={account.name}
                      />
                    </div>
                  )}


                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
