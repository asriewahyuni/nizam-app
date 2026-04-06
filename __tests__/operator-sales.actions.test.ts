import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const prisma = {
    $transaction: vi.fn(),
    organizations: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    saas_packages: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    saas_invoices: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    ai_token_topup_packages: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    saas_config: {
      findMany: vi.fn(),
    },
    accounts: {
      findMany: vi.fn(),
    },
    journal_entries: {
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    journal_lines: {
      createMany: vi.fn(),
    },
  }

  prisma.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === 'function') {
      return arg(prisma)
    }

    return Promise.resolve(arg)
  })

  return {
    auth: vi.fn(),
    revalidatePath: vi.fn(),
    prisma,
  }
})

vi.mock('@/auth', () => ({
  auth: mocks.auth,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

import {
  convertQuotationToSale,
  createOperatorQuotation,
  getOperatorSaasSnapshot,
  markOperatorSalePaid,
} from '@/modules/saas/actions/operator-sales.actions'

const PLATFORM_ADMIN_SESSION = {
  user: {
    id: 'platform-admin-1',
    email: 'bob@executive.id',
  },
}

describe('Operator Sales Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue(PLATFORM_ADMIN_SESSION)
    mocks.prisma.$transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') {
        return arg(mocks.prisma)
      }

      return Promise.resolve(arg)
    })

    mocks.prisma.organizations.findMany.mockResolvedValue([])
    mocks.prisma.organizations.update.mockResolvedValue({ id: 'org-1' })

    mocks.prisma.saas_packages.findMany.mockResolvedValue([])
    mocks.prisma.saas_packages.findUnique.mockResolvedValue(null)

    mocks.prisma.saas_invoices.findMany.mockResolvedValue([])
    mocks.prisma.saas_invoices.findUnique.mockResolvedValue(null)
    mocks.prisma.saas_invoices.create.mockResolvedValue({ id: 'inv-1' })
    mocks.prisma.saas_invoices.update.mockResolvedValue({ id: 'inv-1' })

    mocks.prisma.ai_token_topup_packages.findMany.mockResolvedValue([])
    mocks.prisma.ai_token_topup_packages.findFirst.mockResolvedValue(null)
    mocks.prisma.saas_config.findMany.mockResolvedValue([])

    mocks.prisma.accounts.findMany.mockResolvedValue([])
    mocks.prisma.journal_entries.findFirst.mockResolvedValue(null)
    mocks.prisma.journal_entries.create.mockResolvedValue({ id: 'je-1' })
    mocks.prisma.journal_entries.deleteMany.mockResolvedValue({ count: 1 })
    mocks.prisma.journal_lines.createMany.mockResolvedValue({ count: 2 })
  })

  it('builds an operator snapshot from Prisma data', async () => {
    mocks.prisma.organizations.findMany.mockResolvedValue([
      { id: 'org-1', name: 'PT Alpha' },
    ])
    mocks.prisma.saas_packages.findMany.mockResolvedValue([
      {
        id: 'pkg-1',
        name: 'Growth',
        price: 125000,
        billing: 'Bulan',
        modules: ['sales', 'inventory'],
        addons: ['warehouse'],
      },
    ])
    mocks.prisma.saas_invoices.findMany.mockResolvedValue([
      {
        id: 'inv-q',
        org_id: 'org-1',
        package_id: 'pkg-1',
        invoice_number: 'QTN-SAAS-001',
        item_name: 'Penawaran SaaS: Growth',
        item_description: 'Penawaran awal',
        discount_percent: 10,
        discount_amount: 1000,
        tax_percent: 11,
        tax_amount: 1100,
        amount: 11100,
        status: 'UNPAID',
        payment_method: null,
        due_date: new Date('2026-04-08T00:00:00.000Z'),
        created_at: new Date('2026-04-06T00:00:00.000Z'),
        updated_at: new Date('2026-04-06T01:00:00.000Z'),
        organizations: { name: 'PT Alpha' },
        saas_packages: { name: 'Growth' },
      },
      {
        id: 'inv-s',
        org_id: 'org-1',
        package_id: 'pkg-1',
        invoice_number: 'INV-SAAS-001',
        item_name: 'Invoice SaaS: Growth',
        item_description: 'Invoice final',
        discount_percent: 0,
        discount_amount: 0,
        tax_percent: 0,
        tax_amount: 0,
        amount: 200000,
        status: 'PAID',
        payment_method: 'MANUAL_TRANSFER',
        due_date: new Date('2026-04-08T00:00:00.000Z'),
        created_at: new Date('2026-04-06T02:00:00.000Z'),
        updated_at: new Date('2026-04-06T03:00:00.000Z'),
        organizations: { name: 'PT Alpha' },
        saas_packages: { name: 'Growth' },
      },
    ])
    mocks.prisma.ai_token_topup_packages.findMany.mockResolvedValue([
      {
        id: 'topup-1',
        name: 'Starter Token',
        description: 'Paket token kecil',
        tokens: BigInt(10000),
        price_idr: 99000,
      },
    ])

    const result = await getOperatorSaasSnapshot()

    expect(result.orgs).toEqual([{ id: 'org-1', name: 'PT Alpha' }])
    expect(result.packages).toEqual([
      {
        id: 'pkg-1',
        name: 'Growth',
        price: 125000,
        billing: 'Bulan',
        modules: ['Sales', 'Inventory'],
        addons: ['Warehouse'],
      },
    ])
    expect(result.aiTokenPackages).toEqual([
      {
        id: 'topup-1',
        name: 'Starter Token',
        description: 'Paket token kecil',
        tokens: 10000,
        price: 99000,
      },
    ])
    expect(result.quotations).toHaveLength(1)
    expect(result.sales).toHaveLength(1)
    expect(result.summary).toEqual({
      totalQuotes: 1,
      totalOpenSales: 0,
      totalPaidSales: 1,
      totalSalesValue: 200000,
    })
  })

  it('creates operator quotation with pricing breakdown from Prisma sources', async () => {
    mocks.prisma.saas_packages.findUnique.mockResolvedValue({
      name: 'Growth',
      price: 100000,
      modules: ['sales', 'inventory'],
    })
    mocks.prisma.ai_token_topup_packages.findFirst.mockResolvedValue({
      name: 'Starter Token',
      tokens: BigInt(10000),
      price_idr: 50000,
    })

    const formData = new FormData()
    formData.set('org_id', 'org-1')
    formData.set('package_id', 'pkg-1')
    formData.append('selected_addons', 'addon_warehouse')
    formData.append('selected_modules', 'sales')
    formData.set('ai_token_package_id', 'topup-1')
    formData.set('extra_entity_qty', '1')
    formData.set('extra_branch_qty', '2')
    formData.set('discount_percent', '10')
    formData.set('tax_percent', '11')
    formData.set('note', 'Bundling launch price')

    const result = await createOperatorQuotation(formData)

    expect(result).toEqual({
      success: true,
      invoiceNumber: expect.stringMatching(/^QTN-/),
    })
    expect(mocks.prisma.saas_invoices.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        org_id: 'org-1',
        package_id: 'pkg-1',
        item_name: 'Penawaran SaaS: Growth',
        status: 'UNPAID',
        discount_percent: 10,
        discount_amount: 84600,
        tax_percent: 11,
        tax_amount: 83754,
        amount: 845154,
      }),
    })

    const createPayload = mocks.prisma.saas_invoices.create.mock.calls[0]?.[0]
    expect(createPayload.data.item_description).toContain('Token AI: Starter Token')
    expect(createPayload.data.item_description).toContain('Cabang tambahan: 2 x')
    expect(createPayload.data.item_description).toContain('Diskon setelah durasi: 10%')
    expect(createPayload.data.item_description).toContain('Pajak: 11%')
  })

  it('converts quotation to sale and posts the sale journal via Prisma transaction', async () => {
    mocks.prisma.saas_invoices.findUnique.mockResolvedValue({
      id: 'inv-1',
      org_id: 'org-1',
      invoice_number: 'QTN-SAAS-001',
      amount: 111000,
      tax_amount: 11000,
      created_at: new Date('2026-04-06T00:00:00.000Z'),
    })
    mocks.prisma.accounts.findMany.mockResolvedValue([
      { id: 'acc-ar', code: '1201', name: 'Piutang Usaha', type: 'ASSET' },
      { id: 'acc-rev', code: '4001', name: 'Pendapatan Usaha', type: 'REVENUE' },
      { id: 'acc-tax', code: '2201', name: 'PPN Keluaran', type: 'LIABILITY' },
    ])
    mocks.prisma.journal_entries.findFirst.mockResolvedValueOnce(null)
    mocks.prisma.journal_entries.create.mockResolvedValueOnce({ id: 'je-sale' })
    mocks.prisma.journal_lines.createMany.mockResolvedValueOnce({ count: 3 })

    const result = await convertQuotationToSale('inv-1')

    expect(result).toEqual({ success: true })
    expect(mocks.prisma.journal_entries.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        org_id: 'org-1',
        entry_number: '',
        description: expect.stringContaining('Penjualan SaaS INV-'),
        reference_type: 'SALE',
        reference_id: 'inv-1',
        status: 'POSTED',
        is_auto: true,
        created_by: 'platform-admin-1',
      }),
      select: { id: true },
    })
    expect(mocks.prisma.journal_lines.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ account_id: 'acc-ar', debit: 111000, credit: 0 }),
        expect.objectContaining({ account_id: 'acc-rev', debit: 0, credit: 100000 }),
        expect.objectContaining({ account_id: 'acc-tax', debit: 0, credit: 11000 }),
      ],
    })
    expect(mocks.prisma.saas_invoices.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: {
        invoice_number: expect.stringMatching(/^INV-/),
        updated_at: expect.any(Date),
      },
    })
  })

  it('marks operator sale paid, creates receipt journal, and syncs tenant plan', async () => {
    mocks.prisma.saas_invoices.findUnique.mockResolvedValue({
      id: 'inv-1',
      org_id: 'org-1',
      package_id: 'pkg-1',
      invoice_number: 'INV-SAAS-001',
      amount: 111000,
      tax_amount: 11000,
      status: 'UNPAID',
      payment_method: null,
      created_at: new Date('2026-04-06T00:00:00.000Z'),
      organizations: {
        settings: { plan: 'Trial' },
      },
      saas_packages: {
        name: 'Growth',
      },
    })
    mocks.prisma.accounts.findMany.mockResolvedValue([
      { id: 'acc-ar', code: '1201', name: 'Piutang Usaha', type: 'ASSET' },
      { id: 'acc-rev', code: '4001', name: 'Pendapatan Usaha', type: 'REVENUE' },
      { id: 'acc-tax', code: '2201', name: 'PPN Keluaran', type: 'LIABILITY' },
      { id: 'acc-bank', code: '1103', name: 'Bank Utama', type: 'ASSET' },
    ])
    mocks.prisma.journal_entries.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
    mocks.prisma.journal_entries.create
      .mockResolvedValueOnce({ id: 'je-sale' })
      .mockResolvedValueOnce({ id: 'je-receipt' })
    mocks.prisma.journal_lines.createMany
      .mockResolvedValueOnce({ count: 3 })
      .mockResolvedValueOnce({ count: 2 })

    const result = await markOperatorSalePaid('inv-1', 'MANUAL_TRANSFER')

    expect(result).toEqual({ success: true })
    expect(mocks.prisma.saas_invoices.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: {
        status: 'PAID',
        payment_method: 'MANUAL_TRANSFER',
        updated_at: expect.any(Date),
      },
    })
    expect(mocks.prisma.organizations.update).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      data: {
        settings: expect.objectContaining({
          plan: 'Growth',
          updated_at: expect.any(String),
        }),
        updated_at: expect.any(Date),
      },
    })
    expect(mocks.prisma.journal_entries.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        org_id: 'org-1',
        description: 'Pelunasan Invoice SaaS INV-SAAS-001',
        reference_type: 'CASH_IN',
        reference_id: 'inv-1',
        status: 'POSTED',
      }),
      select: { id: true },
    })
    expect(mocks.prisma.journal_lines.createMany).toHaveBeenNthCalledWith(2, {
      data: [
        expect.objectContaining({ account_id: 'acc-bank', debit: 111000, credit: 0 }),
        expect.objectContaining({ account_id: 'acc-ar', debit: 0, credit: 111000 }),
      ],
    })
  })
})
