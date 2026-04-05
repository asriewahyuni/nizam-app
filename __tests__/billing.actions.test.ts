import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getMembership: vi.fn(),
  revalidatePath: vi.fn(),
  uploadBillingProofAsset: vi.fn(),
  prisma: {
    $transaction: vi.fn(),
    saas_config: {
      findMany: vi.fn(),
    },
    saas_invoices: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    ai_token_topup_packages: {
      findMany: vi.fn(),
    },
    ai_token_topup_orders: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    ai_token_wallets: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    ai_token_usage_logs: {
      create: vi.fn(),
    },
    organizations: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    saas_vouchers: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    saas_packages: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/auth', () => ({
  auth: mocks.auth,
}))

vi.mock('@/lib/auth/permissions', () => ({
  getMembership: mocks.getMembership,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}))

vi.mock('@/modules/organization/lib/billing-proof-storage.server', () => ({
  uploadBillingProofAsset: mocks.uploadBillingProofAsset,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

import {
  createBillingInvoice,
  getBillingDashboardData,
  getBillingInvoicePrintData,
  submitPaymentProof,
  uploadBillingPaymentProof,
} from '@/modules/organization/actions/billing.actions'

function makeMembership() {
  return {
    memberId: 'member-1',
    userId: 'user-1',
    orgId: 'org-1',
    role: 'owner',
    roleId: null,
    permissions: [],
    isOwner: true,
    isAdmin: false,
    isOwnerOrAdmin: true,
  }
}

describe('Billing Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.getMembership.mockResolvedValue(makeMembership())
    mocks.prisma.saas_config.findMany.mockResolvedValue([])
    mocks.prisma.ai_token_topup_packages.findMany.mockResolvedValue([])
    mocks.prisma.saas_packages.findMany.mockResolvedValue([])
    mocks.prisma.saas_invoices.findMany.mockResolvedValue([])
    mocks.prisma.saas_invoices.findFirst.mockResolvedValue(null)
    mocks.prisma.saas_invoices.findUnique.mockResolvedValue(null)
    mocks.prisma.ai_token_topup_orders.findUnique.mockResolvedValue(null)
    mocks.prisma.ai_token_wallets.findUnique.mockResolvedValue(null)
    mocks.prisma.organizations.findUnique.mockResolvedValue(null)
    mocks.uploadBillingProofAsset.mockResolvedValue({
      url: 'https://proof.test/default.png',
    })
  })

  it('reuses an existing unpaid invoice for the same item', async () => {
    mocks.prisma.saas_invoices.findFirst.mockResolvedValue({
      id: 'inv-1',
      invoice_number: 'INV-PKG-PACKAGE-pkg-1-ABC123',
      amount: 125000,
    })

    const result = await createBillingInvoice('org-1', {
      id: 'pkg-1',
      name: 'Growth',
      price: 125000,
      type: 'PACKAGE',
    })

    expect(result).toEqual({
      success: true,
      id: 'inv-1',
      invoiceNumber: 'INV-PKG-PACKAGE-pkg-1-ABC123',
      amount: 125000,
      message: 'Harap selesaikan pembayaran invoice sebelumnya.',
    })
    expect(mocks.prisma.saas_invoices.create).not.toHaveBeenCalled()
  })

  it('creates a topup invoice plus matching topup order', async () => {
    mocks.prisma.saas_invoices.findFirst.mockResolvedValue(null)
    mocks.prisma.saas_invoices.create.mockResolvedValue({
      id: 'inv-topup-1',
      invoice_number: 'INV-TOK-AI_TOKEN_TOPUP-topup-1-ABC123',
      amount: 99000,
    })

    const result = await createBillingInvoice('org-1', {
      id: 'topup-1',
      name: 'Starter Token',
      price: 99000,
      type: 'AI_TOKEN_TOPUP',
      topupPackageId: 'pkg-topup-1',
      tokens: 10000,
    })

    expect(result).toEqual({
      success: true,
      id: 'inv-topup-1',
      invoiceNumber: 'INV-TOK-AI_TOKEN_TOPUP-topup-1-ABC123',
      amount: 99000,
    })
    expect(mocks.prisma.ai_token_topup_orders.create).toHaveBeenCalledWith({
      data: {
        org_id: 'org-1',
        package_id: 'pkg-topup-1',
        invoice_id: 'inv-topup-1',
        status: 'PENDING',
        tokens: BigInt(10000),
        price_idr: 99000,
      },
    })
  })

  it('credits wallet and marks topup order paid when payment proof is submitted', async () => {
    mocks.prisma.saas_invoices.findFirst.mockResolvedValue({
      id: 'inv-1',
      org_id: 'org-1',
      saas_packages: null,
      organizations: { settings: { plan: 'Trial' } },
    })
    mocks.prisma.ai_token_topup_orders.findUnique.mockResolvedValue({
      id: 'topup-1',
      package_id: 'pkg-topup-1',
      invoice_id: 'inv-1',
      status: 'PENDING',
      tokens: BigInt(5000),
    })
    mocks.prisma.ai_token_wallets.findUnique.mockResolvedValue({
      org_id: 'org-1',
      balance_tokens: BigInt(7000),
      total_purchased_tokens: BigInt(12000),
      total_used_tokens: BigInt(0),
    })

    const result = await submitPaymentProof('org-1', 'inv-1', 'https://proof.test/file.png', 'BANK_TRANSFER')

    expect(result).toEqual({ success: true })
    expect(mocks.prisma.saas_invoices.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: expect.objectContaining({
        status: 'PAID',
        payment_method: 'BANK_TRANSFER',
        payment_proof_url: 'https://proof.test/file.png',
      }),
    })
    expect(mocks.prisma.ai_token_wallets.update).toHaveBeenCalledWith({
      where: { org_id: 'org-1' },
      data: {
        balance_tokens: BigInt(12000),
        total_purchased_tokens: BigInt(17000),
        updated_at: expect.any(Date),
      },
    })
    expect(mocks.prisma.ai_token_usage_logs.create).toHaveBeenCalledWith({
      data: {
        org_id: 'org-1',
        source: 'topup',
        direction: 'CREDIT',
        tokens: BigInt(5000),
        related_invoice_id: 'inv-1',
        note: 'Topup token AI dari invoice inv-1',
        meta: { topup_order_id: 'topup-1', package_id: 'pkg-topup-1' },
      },
    })
    expect(mocks.prisma.ai_token_topup_orders.update).toHaveBeenCalledWith({
      where: { id: 'topup-1' },
      data: {
        status: 'PAID',
        paid_at: expect.any(Date),
        updated_at: expect.any(Date),
      },
    })
  })

  it('builds a billing dashboard snapshot from Prisma data', async () => {
    mocks.prisma.saas_config.findMany.mockResolvedValue([
      { key: 'bank_info', value: { bank: 'BCA', account: '123', name: 'PT Nizam' } },
      { key: 'support_info', value: { wa: '62811', label: 'Support Billing' } },
    ])
    mocks.prisma.ai_token_topup_packages.findMany.mockResolvedValue([
      {
        id: 'topup-1',
        name: 'Starter Token',
        description: 'Topup kecil',
        tokens: BigInt(10000),
        price_idr: 99000,
        sort_order: 1,
      },
    ])
    mocks.prisma.organizations.findUnique.mockResolvedValue({
      id: 'org-1',
      name: 'PT Nizam Makmur',
      logo_url: null,
      settings: { plan: 'Growth' },
      active_addons: [{ name: 'Warehouse' }],
      is_demo: false,
    })
    mocks.prisma.saas_packages.findMany.mockResolvedValue([
      {
        id: 'pkg-1',
        name: 'Growth',
        price: 125000,
        billing: 'Bulan',
        duration_days: 30,
        max_orgs: 2,
        max_warehouses: 5,
        modules: ['Inventory', 'Sales'],
      },
    ])
    mocks.prisma.ai_token_wallets.findUnique.mockResolvedValue({
      balance_tokens: BigInt(7777),
    })
    mocks.prisma.saas_invoices.findMany.mockResolvedValue([
      {
        id: 'inv-1',
        invoice_number: 'INV-001',
        amount: 125000,
        status: 'UNPAID',
        created_at: new Date('2026-04-05T03:00:00.000Z'),
        due_date: new Date('2026-04-06T03:00:00.000Z'),
        item_name: 'Growth',
        payment_proof_url: null,
      },
    ])

    const result = await getBillingDashboardData('org-1')

    expect(result).toEqual({
      bankInfo: { bank: 'BCA', account: '123', name: 'PT Nizam' },
      supportInfo: { wa: '62811', label: 'Support Billing' },
      activeOrg: {
        id: 'org-1',
        name: 'PT Nizam Makmur',
        logo_url: null,
        settings: { plan: 'Growth' },
        active_addons: [{ name: 'Warehouse' }],
        package_limit: {
          max_orgs: 2,
          max_warehouses: 5,
          max_users: 10,
        },
        is_demo: false,
      },
      packages: [
        {
          id: 'pkg-1',
          name: 'Growth',
          price: 125000,
          billing: 'Bulan',
          duration_days: 30,
          max_orgs: 2,
          max_warehouses: 5,
          modules: ['Inventory', 'Sales'],
        },
      ],
      invoices: [
        {
          id: 'inv-1',
          invoice_number: 'INV-001',
          amount: 125000,
          status: 'UNPAID',
          created_at: '2026-04-05T03:00:00.000Z',
          due_date: '2026-04-06T03:00:00.000Z',
          item_name: 'Growth',
          payment_proof_url: null,
        },
      ],
      aiTokenBalance: 7777,
      aiTokenPackages: [
        {
          id: 'topup-1',
          name: 'Starter Token',
          description: 'Topup kecil',
          tokens: 10000,
          price_idr: 99000,
          sort_order: 1,
        },
      ],
      totalMonthly: 274000,
    })
  })

  it('uploads billing proof and forwards the public URL into invoice submission', async () => {
    mocks.prisma.saas_invoices.findFirst
      .mockResolvedValueOnce({ invoice_number: 'INV-001' })
      .mockResolvedValueOnce({
        id: 'inv-1',
        org_id: 'org-1',
        saas_packages: null,
        organizations: { settings: { plan: 'Trial' } },
      })
    mocks.prisma.ai_token_topup_orders.findUnique.mockResolvedValue(null)
    mocks.uploadBillingProofAsset.mockResolvedValue({
      url: 'https://proof.test/inv-001.png',
    })

    const formData = new FormData()
    formData.set('proof', new File(['proof'], 'proof.png', { type: 'image/png' }))

    const result = await uploadBillingPaymentProof('org-1', 'inv-1', formData)

    expect(result).toEqual({ success: true })
    expect(mocks.uploadBillingProofAsset).toHaveBeenCalledWith(
      'org-1',
      'INV-001',
      expect.any(File)
    )
    expect(mocks.prisma.saas_invoices.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: expect.objectContaining({
        payment_proof_url: 'https://proof.test/inv-001.png',
      }),
    })
  })

  it('returns invoice print data only for members of the invoice organization', async () => {
    mocks.prisma.saas_config.findMany.mockResolvedValue([
      { key: 'bank_info', value: { bank: 'Mandiri', account: '999', name: 'PT Nizam' } },
    ])
    mocks.prisma.saas_invoices.findUnique.mockResolvedValue({
      id: 'inv-1',
      org_id: 'org-1',
      invoice_number: 'INV-001',
      amount: 125000,
      status: 'PAID',
      created_at: new Date('2026-04-05T03:00:00.000Z'),
      due_date: new Date('2026-04-06T03:00:00.000Z'),
      item_name: 'Growth',
      organizations: {
        id: 'org-1',
        name: 'PT Nizam Makmur',
        logo_url: null,
        owner_email: 'owner@example.com',
        settings: { brand_name: 'Nizam Custom' },
      },
    })

    const result = await getBillingInvoicePrintData('inv-1')

    expect(result).toEqual({
      invoice: {
        id: 'inv-1',
        invoice_number: 'INV-001',
        amount: 125000,
        status: 'PAID',
        created_at: '2026-04-05T03:00:00.000Z',
        due_date: '2026-04-06T03:00:00.000Z',
        item_name: 'Growth',
        organization: {
          id: 'org-1',
          name: 'PT Nizam Makmur',
          logo_url: null,
          owner_email: 'owner@example.com',
          settings: { brand_name: 'Nizam Custom' },
        },
      },
      saasConfig: {
        bank_info: { bank: 'Mandiri', account: '999', name: 'PT Nizam' },
        support_info: {
          wa: '628123456789',
          label: 'Admin Nizam Support',
        },
      },
    })
  })
})
