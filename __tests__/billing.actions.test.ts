import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getMembership: vi.fn(),
  revalidatePath: vi.fn(),
  prisma: {
    $transaction: vi.fn(),
    saas_invoices: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

import {
  createBillingInvoice,
  submitPaymentProof,
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
})
