import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { CashClient } from './CashClient'
import { getChartOfAccounts, checkCanManageCoA } from '@/modules/accounting/actions/coa.actions'
import { getRecentBankTransactions } from '@/modules/cash/actions/bank.actions'
import { getActiveBranch, getActiveOrg, getBranches, getChildOrgs } from '@/modules/organization/actions/org.actions'
import { getPendingCoaRequestCount } from '@/modules/accounting/actions/coa-request.actions'
import { Account } from '@/types/database.types'

type PlacementAccountOption = { id: string; code: string; name: string }
type TransferCategoryOption = { id: string; code: string; name: string; type: string }

function readRelationName(relation: any): string | null {
  if (!relation) return null
  if (typeof relation?.name === 'string') return relation.name
  if (Array.isArray(relation) && relation.length > 0 && typeof relation[0]?.name === 'string') {
    return relation[0].name
  }
  return null
}

async function getPostedEntryIds(orgId: string, branchId?: string | null) {
  const data = await prisma.journal_entries.findMany({
    where: {
      org_id: orgId,
      status: 'POSTED',
      ...(branchId ? { branch_id: branchId } : {}),
    },
    select: {
      id: true,
    },
  })

  return data.map((entry) => entry.id)
}

function normalizeAccountForCash(account: {
  id: string
  org_id: string
  code: string
  name: string
  type: string
  normal_balance: string
  parent_id: string | null
  description: string | null
  is_system: boolean
  is_active: boolean
  created_at: Date
  updated_at: Date
}): Account {
  return {
    id: account.id,
    org_id: account.org_id,
    code: account.code,
    name: account.name,
    type: account.type as Account['type'],
    normal_balance: account.normal_balance as Account['normal_balance'],
    parent_id: account.parent_id,
    description: account.description,
    is_system: account.is_system,
    is_active: account.is_active,
    created_at: account.created_at.toISOString(),
    updated_at: account.updated_at.toISOString(),
  }
}

export async function getBankAccountsWithBalance(orgId: string, branchId?: string | null) {
  const accounts = await prisma.bank_accounts.findMany({
    where: {
      org_id: orgId,
      ...(branchId ? { branch_id: branchId } : {}),
    },
    include: {
      accounts: true,
    },
    orderBy: {
      bank_name: 'asc',
    },
  })

  if (accounts.length === 0) return []

  const accountIds = accounts.map((account) => account.account_id)
  const balanceMap = new Map<string, number>()

  if (!branchId) {
    const balances = await prisma.$queryRaw<Array<{ account_id: string; balance: number }>>`
      SELECT
        account_id::text AS account_id,
        COALESCE(balance, 0)::double precision AS balance
      FROM public.account_balances
      WHERE org_id = CAST(${orgId} AS uuid)
    `

    balances.forEach((balance) => {
      if (accountIds.includes(balance.account_id)) {
        balanceMap.set(balance.account_id, Number(balance.balance || 0))
      }
    })
  } else {
    const entryIds = await getPostedEntryIds(orgId, branchId)
    if (entryIds.length > 0) {
      const lines = await prisma.journal_lines.findMany({
        where: {
          entry_id: {
            in: entryIds,
          },
          account_id: {
            in: accountIds,
          },
        },
        select: {
          account_id: true,
          debit: true,
          credit: true,
        },
      })

      for (const line of lines) {
        const current = balanceMap.get(line.account_id) || 0
        balanceMap.set(line.account_id, current + Number(line.debit || 0) - Number(line.credit || 0))
      }
    }
  }

  return accounts.map((account) => ({
    id: account.id,
    org_id: account.org_id,
    branch_id: account.branch_id,
    account_id: account.account_id,
    account_name: account.accounts.name,
    bank_name: account.bank_name,
    account_number: account.account_number,
    currency: account.currency,
    current_balance: balanceMap.get(account.account_id) || 0,
    is_active: account.is_active,
    created_at: account.created_at.toISOString(),
    updated_at: account.updated_at.toISOString(),
    account: normalizeAccountForCash(account.accounts),
    balances: { balance: balanceMap.get(account.account_id) || 0 },
  }))
}

async function getConsolidatedOrgIds(parentOrgId: string): Promise<string[]> {
  const discovered = new Set<string>([parentOrgId])
  let frontier = [parentOrgId]

  while (frontier.length > 0) {
    const children = await prisma.organizations.findMany({
      where: {
        parent_org_id: { in: frontier },
        is_active: true,
      },
      select: { id: true },
    })

    const nextFrontier = children
      .map((org) => String(org.id || '').trim())
      .filter((id) => id.length > 0 && !discovered.has(id))

    nextFrontier.forEach((id) => {
      discovered.add(id)
    })
    frontier = nextFrontier
  }

  return Array.from(discovered)
}

async function getManagedBankAccountsForParent(parentOrgId: string) {
  const orgIds = await getConsolidatedOrgIds(parentOrgId)

  const accounts = await prisma.bank_accounts.findMany({
    where: { org_id: { in: orgIds } },
    include: {
      accounts: true,
      organizations: { select: { name: true } },
      branches: { select: { name: true } },
    },
    orderBy: { bank_name: 'asc' },
  })

  if (accounts.length === 0) return []

  const accountIds = Array.from(
    new Set(
      accounts
        .map((account: any) => String(account?.account_id || '').trim())
        .filter((id: string) => id.length > 0)
    )
  )

  let balanceByAccountId = new Map<string, number>()
  if (accountIds.length > 0) {
    const balances = await prisma.$queryRaw<Array<{ account_id: string; balance: number }>>`
      SELECT account_id::text AS account_id, COALESCE(balance, 0)::double precision AS balance
      FROM public.account_balances
      WHERE account_id = ANY(${accountIds}::uuid[])
    `

    balanceByAccountId = new Map(
      balances.map((row) => [String(row.account_id), Number(row.balance || 0)])
    )
  }

  return accounts.map((account: any) => ({
    ...account,
    balances: { balance: balanceByAccountId.get(String(account.account_id)) || 0 },
    org_name: readRelationName(account.organizations),
    branch_name: readRelationName(account.branches),
  }))
}

export default async function CashPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const orgId = orgData.org.id
  const orgName = orgData.org.name || 'Nizam'
  const activeBranch = await getActiveBranch(orgId)

  const [bankAccounts, allAccounts, recentTransactions, { canManageDirect, isParentOrg }, pendingCoaRequests, branches, childOrgs] = await Promise.all([
    getBankAccountsWithBalance(orgId, activeBranch?.id),
    getChartOfAccounts(orgId),
    getRecentBankTransactions(orgId, 20, activeBranch?.id),
    checkCanManageCoA(orgId),
    getPendingCoaRequestCount(orgId),
    getBranches(orgId),
    getChildOrgs(orgId),
  ])

  const managedBankAccounts =
    canManageDirect && isParentOrg ? await getManagedBankAccountsForParent(orgId) : bankAccounts

  // Prepare explicit placement options for Parent users
  const placementNodes: {
    orgId: string
    orgName: string
    branches: { id: string; name: string }[]
    accounts: PlacementAccountOption[]
  }[] = []
  const transferCategoryNodes: {
    orgId: string
    orgName: string
    accounts: TransferCategoryOption[]
  }[] = []
  if (canManageDirect) {
    const parentTransferAccounts = allAccounts.filter((a: Account) =>
      ['REVENUE', 'EXPENSE', 'ASSET', 'LIABILITY', 'EQUITY'].includes(a.type)
    )
    // 1. Add Parent
    placementNodes.push({
      orgId: orgId,
      orgName: orgName + ' (Pusat)',
      branches: branches,
      accounts: allAccounts.filter((a: Account) => a.type === 'ASSET' && (a.code.startsWith('11') || a.name.toLowerCase().includes('kas') || a.name.toLowerCase().includes('bank'))),
    });
    transferCategoryNodes.push({
      orgId: orgId,
      orgName: orgName + ' (Pusat)',
      accounts: parentTransferAccounts.map((a: Account) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        type: a.type,
      })),
    })
    // 2. Fetch and add all Child Orgs
    for (const child of childOrgs) {
       const [childBranches, childAccounts] = await Promise.all([
         getBranches(child.id),
         getChartOfAccounts(child.id)
       ]);
       placementNodes.push({
         orgId: child.id,
         orgName: child.name,
         branches: childBranches,
         accounts: childAccounts.filter((a: Account) => a.type === 'ASSET' && (a.code.startsWith('11') || a.name.toLowerCase().includes('kas') || a.name.toLowerCase().includes('bank'))),
       });
       transferCategoryNodes.push({
         orgId: child.id,
         orgName: child.name,
         accounts: childAccounts
           .filter((a: Account) => ['REVENUE', 'EXPENSE', 'ASSET', 'LIABILITY', 'EQUITY'].includes(a.type))
           .map((a: Account) => ({
             id: a.id,
             code: a.code,
             name: a.name,
             type: a.type,
           })),
       })
    }
  }

  // Filter accounts that are suitable for "Category" in cash transactions (Revenue, Expense, etc.)
  // and also Asset/Liability for transfers/payments.
  const categoryAccounts = allAccounts.filter((a: Account) => 
    ['REVENUE', 'EXPENSE', 'ASSET', 'LIABILITY', 'EQUITY'].includes(a.type)
  )

  // Default GL Accounts for the current org
  const bankGlAccounts = allAccounts.filter((a: Account) => 
    a.type === 'ASSET' && (a.code.startsWith('11') || a.name.toLowerCase().includes('kas') || a.name.toLowerCase().includes('bank'))
  )

  return (
    <div className="p-8 pb-20">
      <CashClient 
        orgId={orgId}
        orgName={orgName}
        bankAccounts={bankAccounts}
        managedBankAccounts={managedBankAccounts}
        categoryAccounts={categoryAccounts}
        bankGlAccounts={bankGlAccounts}
        recentTransactions={recentTransactions}
        userRole={orgData.role}
        activeBranchId={activeBranch?.id ?? null}
        activeBranchName={activeBranch?.name ?? null}
        canManageDirect={canManageDirect}
        isParentOrg={isParentOrg}
        pendingCoaRequests={pendingCoaRequests}
        branches={branches}
        placementNodes={placementNodes}
        transferCategoryNodes={transferCategoryNodes}
      />
    </div>
  )
}
