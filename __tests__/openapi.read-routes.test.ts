import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { createSupabaseMock, success } from './helpers/supabase-mock'

const mocks = vi.hoisted(() => ({
  validateApiKey: vi.fn(),
  requireScope: vi.fn(),
  logApiCall: vi.fn(),
  extractIpFromRequest: vi.fn(),
  queryPostgres: vi.fn(),
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/api/validate-key', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/validate-key')>('@/lib/api/validate-key')
  return {
    ...actual,
    validateApiKey: mocks.validateApiKey,
    requireScope: mocks.requireScope,
    logApiCall: mocks.logApiCall,
    extractIpFromRequest: mocks.extractIpFromRequest,
  }
})

vi.mock('@/lib/db/postgres', () => ({
  queryPostgres: mocks.queryPostgres,
}))

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: mocks.createAdminClient,
}))

import { GET as getInventory } from '@/app/api/v1/inventory/route'
import { GET as getInventoryMovements } from '@/app/api/v1/inventory/movements/route'
import { GET as getInventoryReconciliation } from '@/app/api/v1/inventory/reconciliation/route'
import { GET as getGeneralLedger } from '@/app/api/v1/general-ledger/route'
import { GET as getContacts } from '@/app/api/v1/contacts/route'
import { GET as getSales } from '@/app/api/v1/sales/route'
import { GET as getSaleDetail } from '@/app/api/v1/sales/[saleId]/route'
import { GET as getPurchases } from '@/app/api/v1/purchases/route'
import { GET as getBankTransactions } from '@/app/api/v1/bank-transactions/route'

describe('Open API read routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.validateApiKey.mockResolvedValue({
      success: true,
      key: {
        keyId: 'key-1',
        orgId: '11111111-1111-4111-8111-111111111111',
        branchId: '22222222-2222-4222-8222-222222222222',
        scopes: ['inventory:read', 'ledger:read', 'contacts:read', 'sales:read', 'purchases:read', 'bank_transactions:read'],
        rateLimitRpm: 60,
      },
    })
    mocks.requireScope.mockReturnValue(true)
    mocks.logApiCall.mockResolvedValue(undefined)
    mocks.extractIpFromRequest.mockReturnValue('198.51.100.15')
  })

  it('requires an API key for inventory reads', async () => {
    const response = await getInventory(new NextRequest('http://localhost/api/v1/inventory'))

    expect(response.status).toBe(401)
    expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate')
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: 'API key diperlukan. Sertakan header x-api-key.',
        error_code: 'api_key_missing',
        request_id: expect.any(String),
      })
    )
    expect(mocks.validateApiKey).not.toHaveBeenCalled()
  })

  it('returns normalized inventory rows and logs the request', async () => {
    mocks.queryPostgres.mockResolvedValueOnce({
      rows: [
        {
          id: 'product-1',
          code: 'BMS3',
          name: 'BUKU MATEMATIKA',
          unit: null,
          category: 'Books',
          selling_price: '13333.33',
          cost_price: '9600',
          stock_quantity: '7',
          is_active: true,
        },
      ],
    })

    const response = await getInventory(new NextRequest('http://localhost/api/v1/inventory?limit=20&search=buku', {
      headers: {
        'x-api-key': 'nzm_live_test',
        'user-agent': 'Vitest',
      },
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate')
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: [
        {
          id: 'product-1',
          code: 'BMS3',
          name: 'BUKU MATEMATIKA',
          unit: '',
          category: 'Books',
          selling_price: 13333.33,
          cost_price: 9600,
          stock_quantity: 7,
          branch_id: '22222222-2222-4222-8222-222222222222',
          is_active: true,
        },
      ],
      meta: {
        org_id: '11111111-1111-4111-8111-111111111111',
        branch_scope: '22222222-2222-4222-8222-222222222222',
        count: 1,
      },
    })
    expect(mocks.logApiCall).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/api/v1/inventory',
        statusCode: 200,
        ipAddress: '198.51.100.15',
      })
    )
  })

  it('returns inventory movements with signed quantity, direction, and filters', async () => {
    mocks.queryPostgres.mockResolvedValueOnce({
      rows: [
        {
          id: 'movement-1',
          product_id: 'product-1',
          product_code: 'BMS3',
          product_name: 'BUKU MATEMATIKA',
          product_unit: 'Pcs',
          product_category: 'Books',
          movement_date: '2026-04-18T08:00:00.000Z',
          quantity: '-2',
          unit_price: '9600',
          reference_type: 'sale',
          reference_id: 'sale-1',
          notes: 'Pengiriman SO-2026-000001',
          branch_id: '22222222-2222-4222-8222-222222222222',
          created_at: '2026-04-18T08:00:00.000Z',
        },
      ],
    })

    const response = await getInventoryMovements(new NextRequest('http://localhost/api/v1/inventory/movements?limit=10&reference_type=sale&direction=out&search=buku', {
      headers: {
        'x-api-key': 'nzm_live_test',
        'user-agent': 'Vitest',
      },
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate')
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: [
        {
          id: 'movement-1',
          product_id: 'product-1',
          product_code: 'BMS3',
          product_name: 'BUKU MATEMATIKA',
          product_unit: 'Pcs',
          product_category: 'Books',
          movement_date: '2026-04-18T08:00:00.000Z',
          quantity: -2,
          direction: 'out',
          unit_price: 9600,
          reference_type: 'SALE',
          reference_id: 'sale-1',
          notes: 'Pengiriman SO-2026-000001',
          branch_id: '22222222-2222-4222-8222-222222222222',
          created_at: '2026-04-18T08:00:00.000Z',
        },
      ],
      meta: {
        org_id: '11111111-1111-4111-8111-111111111111',
        branch_scope: '22222222-2222-4222-8222-222222222222',
        count: 1,
      },
    })
    expect(String(mocks.queryPostgres.mock.calls[0]?.[0])).toContain('FROM public.stock_movements')
    expect(mocks.logApiCall).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/api/v1/inventory/movements',
        statusCode: 200,
      })
    )
  })

  it('rejects invalid inventory movement direction filters', async () => {
    const response = await getInventoryMovements(new NextRequest('http://localhost/api/v1/inventory/movements?direction=sideways', {
      headers: {
        'x-api-key': 'nzm_live_test',
      },
    }))

    expect(response.status).toBe(400)
    expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate')
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: 'Parameter "direction" harus berisi in atau out.',
        error_code: 'inventory_direction_invalid',
      })
    )
  })

  it('returns inventory reconciliation rows with summary meta', async () => {
    mocks.queryPostgres
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'product-1',
            product_code: 'BMS3',
            product_name: 'BUKU MATEMATIKA',
            product_unit: 'Pcs',
            product_category: 'Books',
            average_cost: '9600',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            product_id: 'product-1',
            stock_qty: '7',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            gl_inventory_balance: '65000',
          },
        ],
      })

    const response = await getInventoryReconciliation(new NextRequest('http://localhost/api/v1/inventory/reconciliation?as_of_date=2026-04-18&variance_only=true', {
      headers: {
        'x-api-key': 'nzm_live_test',
        'user-agent': 'Vitest',
      },
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate')
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: [
        {
          product_id: 'product-1',
          product_code: 'BMS3',
          product_name: 'BUKU MATEMATIKA',
          product_unit: 'Pcs',
          product_category: 'Books',
          stock_qty: 7,
          avg_cost: 9600,
          on_hand_value: 67200,
          ledger_value: 65000,
          variance: 2200,
        },
      ],
      meta: {
        org_id: '11111111-1111-4111-8111-111111111111',
        branch_scope: '22222222-2222-4222-8222-222222222222',
        count: 1,
        as_of_date: '2026-04-18',
        on_hand_value: 67200,
        gl_inventory_balance: 65000,
        inventory_variance: 2200,
        valuation_method: 'average_cost',
        gl_account_range: '1301-1399',
      },
    })
    expect(String(mocks.queryPostgres.mock.calls[0]?.[0])).toContain('FROM public.products')
    expect(mocks.logApiCall).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/api/v1/inventory/reconciliation',
        statusCode: 200,
      })
    )
  })

  it('returns general ledger entries with nested journal lines', async () => {
    mocks.queryPostgres
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'je-1',
            entry_number: 'JE-2026-000101',
            entry_date: '2026-04-18',
            description: 'Pengiriman penjualan',
            reference_type: 'sale',
            reference_id: 'sale-1',
            status: 'POSTED',
            notes: null,
            posted_at: '2026-04-18T08:10:00.000Z',
            created_at: '2026-04-18T08:09:00.000Z',
            branch_id: '22222222-2222-4222-8222-222222222222',
            total_debit: '19200',
            total_credit: '19200',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'jl-1',
            entry_id: 'je-1',
            account_id: 'account-hpp-id',
            account_code: '5101',
            account_name: 'Harga Pokok Penjualan',
            account_type: 'EXPENSE',
            debit: '19200',
            credit: '0',
            memo: 'HPP keluar',
          },
          {
            id: 'jl-2',
            entry_id: 'je-1',
            account_id: 'account-inventory-id',
            account_code: '1301',
            account_name: 'Persediaan Barang Dagang',
            account_type: 'ASSET',
            debit: '0',
            credit: '19200',
            memo: 'Pengurangan stok',
          },
        ],
      })

    const response = await getGeneralLedger(new NextRequest('http://localhost/api/v1/general-ledger?reference_type=sale&limit=10', {
      headers: {
        'x-api-key': 'nzm_live_test',
        'user-agent': 'Vitest',
      },
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate')
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: [
        {
          id: 'je-1',
          entry_number: 'JE-2026-000101',
          entry_date: '2026-04-18',
          description: 'Pengiriman penjualan',
          reference_type: 'SALE',
          reference_id: 'sale-1',
          status: 'POSTED',
          notes: null,
          posted_at: '2026-04-18T08:10:00.000Z',
          created_at: '2026-04-18T08:09:00.000Z',
          branch_id: '22222222-2222-4222-8222-222222222222',
          total_debit: 19200,
          total_credit: 19200,
          journal_lines: [
            {
              id: 'jl-1',
              account_id: 'account-hpp-id',
              account_code: '5101',
              account_name: 'Harga Pokok Penjualan',
              account_type: 'EXPENSE',
              debit: 19200,
              credit: 0,
              memo: 'HPP keluar',
            },
            {
              id: 'jl-2',
              account_id: 'account-inventory-id',
              account_code: '1301',
              account_name: 'Persediaan Barang Dagang',
              account_type: 'ASSET',
              debit: 0,
              credit: 19200,
              memo: 'Pengurangan stok',
            },
          ],
        },
      ],
      meta: {
        org_id: '11111111-1111-4111-8111-111111111111',
        branch_scope: '22222222-2222-4222-8222-222222222222',
        count: 1,
      },
    })
    expect(String(mocks.queryPostgres.mock.calls[0]?.[0])).toContain('FROM public.journal_entries')
    expect(mocks.logApiCall).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/api/v1/general-ledger',
        statusCode: 200,
      })
    )
  })

  it('filters contacts by type and search and keeps responses uncacheable', async () => {
    const supabase = createSupabaseMock({
      tables: {
        contacts: [{
          result: success([
            {
              id: 'contact-1',
              name: 'Andi Supplier',
              email: 'andi@example.com',
              phone: '08123',
              phone_wa: '628123',
              instagram: '@andisupplier',
              address: 'Jl. Supplier No. 1',
              type: 'supplier',
              is_active: true,
              created_at: '2026-04-18T00:00:00.000Z',
            },
          ]),
        }],
      },
    })
    mocks.createAdminClient.mockResolvedValue(supabase.client)

    const response = await getContacts(new NextRequest('http://localhost/api/v1/contacts?type=supplier&search=andi', {
      headers: {
        'x-api-key': 'nzm_live_test',
        'user-agent': 'Vitest',
      },
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate')
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: [
        {
          id: 'contact-1',
          name: 'Andi Supplier',
          email: 'andi@example.com',
          phone: '08123',
          phone_wa: '628123',
          instagram: '@andisupplier',
          address: 'Jl. Supplier No. 1',
          type: 'supplier',
          is_active: true,
          created_at: '2026-04-18T00:00:00.000Z',
        },
      ],
      meta: {
        org_id: '11111111-1111-4111-8111-111111111111',
        count: 1,
      },
    })

    const contactCall = supabase.calls.find((call) => call.table === 'contacts')
    expect(contactCall?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'eq', args: ['org_id', '11111111-1111-4111-8111-111111111111'] }),
        expect.objectContaining({ method: 'eq', args: ['type', 'SUPPLIER'] }),
        expect.objectContaining({ method: 'ilike', args: ['name', '%andi%'] }),
      ])
    )
  })

  it('reads sales from the actual sales schema and normalizes the response', async () => {
    mocks.queryPostgres.mockResolvedValueOnce({
      rows: [
        {
          id: 'sale-1',
          sale_number: 'SO-2026-000001',
          customer_name: 'CV Maju',
          total_amount: '250000',
          status: 'ORDERED',
          branch_id: '22222222-2222-4222-8222-222222222222',
          order_date: '2026-04-18',
          created_at: '2026-04-18T00:00:00.000Z',
        },
      ],
    })

    const response = await getSales(new NextRequest('http://localhost/api/v1/sales?status=ORDERED&limit=10', {
      headers: {
        'x-api-key': 'nzm_live_test',
        'user-agent': 'Vitest',
      },
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate')
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: [
        {
          id: 'sale-1',
          so_number: 'SO-2026-000001',
          customer_name: 'CV Maju',
          total_amount: 250000,
          status: 'ORDERED',
          branch_id: '22222222-2222-4222-8222-222222222222',
          order_date: '2026-04-18',
          created_at: '2026-04-18T00:00:00.000Z',
        },
      ],
      meta: {
        org_id: '11111111-1111-4111-8111-111111111111',
        branch_scope: '22222222-2222-4222-8222-222222222222',
        count: 1,
      },
    })
    expect(String(mocks.queryPostgres.mock.calls[0]?.[0])).toContain('FROM public.sales')
  })

  it('blocks sales reads when the key scope is missing', async () => {
    mocks.requireScope.mockReturnValue(false)

    const response = await getSales(new NextRequest('http://localhost/api/v1/sales', {
      headers: { 'x-api-key': 'nzm_live_test' },
    }))

    expect(response.status).toBe(403)
    expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate')
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: 'Scope tidak mencukupi. Diperlukan: sales:read',
        error_code: 'scope_missing',
        request_id: expect.any(String),
      })
    )
  })

  it('reads purchases and normalizes purchase summary rows', async () => {
    mocks.queryPostgres.mockResolvedValueOnce({
      rows: [
        {
          id: 'purchase-1',
          purchase_number: 'PO-2026-000001',
          vendor_name: 'PT Supplier Buku',
          total_amount: '512000',
          status: 'RECEIVED',
          payment_status: 'PARTIAL',
          branch_id: '22222222-2222-4222-8222-222222222222',
          purchase_date: '2026-04-18',
          due_date: '2026-04-25',
          created_at: '2026-04-18T00:00:00.000Z',
          item_count: '2',
        },
      ],
    })

    const response = await getPurchases(new NextRequest('http://localhost/api/v1/purchases?status=RECEIVED&payment_status=PARTIAL', {
      headers: {
        'x-api-key': 'nzm_live_test',
        'user-agent': 'Vitest',
      },
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: [
        {
          id: 'purchase-1',
          po_number: 'PO-2026-000001',
          vendor_name: 'PT Supplier Buku',
          total_amount: 512000,
          status: 'RECEIVED',
          payment_status: 'PARTIAL',
          branch_id: '22222222-2222-4222-8222-222222222222',
          purchase_date: '2026-04-18',
          due_date: '2026-04-25',
          item_count: 2,
          created_at: '2026-04-18T00:00:00.000Z',
        },
      ],
      meta: {
        org_id: '11111111-1111-4111-8111-111111111111',
        branch_scope: '22222222-2222-4222-8222-222222222222',
        count: 1,
      },
    })
    expect(mocks.logApiCall).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/api/v1/purchases',
        statusCode: 200,
      })
    )
  })

  it('reads bank transactions and normalizes cash direction to lowercase', async () => {
    mocks.queryPostgres.mockResolvedValueOnce({
      rows: [
        {
          id: 'bank-tx-1',
          bank_account_id: 'bank-account-1',
          cash_account_id: 'cash-account-1',
          cash_account_code: '1101',
          cash_account_name: 'Kas',
          bank_name: 'BCA',
          account_number: '1234567890',
          description: 'Pelunasan invoice INV-2026-001',
          amount: '250000',
          type: 'IN',
          reference_number: 'INV-2026-001',
          status: 'POSTED',
          category_id: 'account-1201',
          category_code: '1201',
          category_name: 'Piutang Dagang',
          journal_entry_id: 'journal-1',
          branch_id: '22222222-2222-4222-8222-222222222222',
          transaction_date: '2026-04-18',
          created_at: '2026-04-18T00:00:00.000Z',
        },
      ],
    })

    const response = await getBankTransactions(new NextRequest('http://localhost/api/v1/bank-transactions?type=in&search=INV-2026', {
      headers: {
        'x-api-key': 'nzm_live_test',
        'user-agent': 'Vitest',
      },
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: [
        {
          id: 'bank-tx-1',
          bank_account_id: 'bank-account-1',
          cash_account_id: 'cash-account-1',
          cash_account_code: '1101',
          cash_account_name: 'Kas',
          bank_name: 'BCA',
          account_number: '1234567890',
          description: 'Pelunasan invoice INV-2026-001',
          amount: 250000,
          type: 'in',
          reference_number: 'INV-2026-001',
          status: 'POSTED',
          category_id: 'account-1201',
          category_code: '1201',
          category_name: 'Piutang Dagang',
          journal_entry_id: 'journal-1',
          branch_id: '22222222-2222-4222-8222-222222222222',
          transaction_date: '2026-04-18',
          created_at: '2026-04-18T00:00:00.000Z',
        },
      ],
      meta: {
        org_id: '11111111-1111-4111-8111-111111111111',
        branch_scope: '22222222-2222-4222-8222-222222222222',
        count: 1,
      },
    })
    expect(mocks.logApiCall).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/api/v1/bank-transactions',
        statusCode: 200,
      })
    )
  })

  it('returns a sales detail document with nested items, payments, and returns', async () => {
    mocks.queryPostgres
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'sale-1',
            sale_number: 'SO-2026-000001',
            customer_id: 'contact-1',
            customer_name: 'CV Maju',
            total_amount: '225000',
            tax_amount: '22500',
            discount_amount: '5000',
            grand_total: '242500',
            status: 'ORDERED',
            payment_status: 'PARTIAL',
            branch_id: '22222222-2222-4222-8222-222222222222',
            branch_name: 'Cabang Utama',
            warehouse_id: 'warehouse-1',
            warehouse_name: 'Gudang Utama',
            sale_date: '2026-04-18',
            due_date: '2026-04-25',
            notes: 'Follow up pengiriman H+1',
            created_at: '2026-04-18T00:00:00.000Z',
            updated_at: '2026-04-18T01:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'item-1',
            product_id: 'product-1',
            description: 'BUKU MATEMATIKA SERIES 3',
            quantity: '3',
            unit_price: '75000',
            discount_amount: '5000',
            tax_amount: '22500',
            total_amount: '242500',
            branch_id: '22222222-2222-4222-8222-222222222222',
            product_name: 'BUKU MATEMATIKA SERIES 3',
            sku: 'BMS3',
            unit: 'Pcs',
            product_type: 'INVENTORY',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'payment-1',
            account_id: 'cash-account-1',
            account_code: '1101',
            account_name: 'Kas',
            payment_date: '2026-04-18',
            amount: '100000',
            discount_amount: '0',
            payment_number: 'PAY-2026-000001',
            notes: 'DP customer',
            created_at: '2026-04-18T02:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'return-1',
            return_number: 'SR-2026-000001',
            return_date: '2026-04-19',
            total_amount: '50000',
            tax_amount: '5000',
            grand_total: '55000',
            status: 'APPROVED',
            notes: 'Salah kirim item',
            created_at: '2026-04-19T00:00:00.000Z',
          },
        ],
      })

    const response = await getSaleDetail(
      new NextRequest('http://localhost/api/v1/sales/sale-1', {
        headers: {
          'x-api-key': 'nzm_live_test',
          'user-agent': 'Vitest',
        },
      }),
      { params: { saleId: 'sale-1' } }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        id: 'sale-1',
        so_number: 'SO-2026-000001',
        customer_id: 'contact-1',
        customer_name: 'CV Maju',
        total_amount: 225000,
        tax_amount: 22500,
        discount_amount: 5000,
        grand_total: 242500,
        status: 'ORDERED',
        payment_status: 'PARTIAL',
        branch_id: '22222222-2222-4222-8222-222222222222',
        branch_name: 'Cabang Utama',
        warehouse_id: 'warehouse-1',
        warehouse_name: 'Gudang Utama',
        order_date: '2026-04-18',
        due_date: '2026-04-25',
        notes: 'Follow up pengiriman H+1',
        created_at: '2026-04-18T00:00:00.000Z',
        updated_at: '2026-04-18T01:00:00.000Z',
        items: [
          {
            id: 'item-1',
            product_id: 'product-1',
            description: 'BUKU MATEMATIKA SERIES 3',
            quantity: 3,
            unit_price: 75000,
            discount_amount: 5000,
            tax_amount: 22500,
            total_amount: 242500,
            branch_id: '22222222-2222-4222-8222-222222222222',
            product_name: 'BUKU MATEMATIKA SERIES 3',
            sku: 'BMS3',
            unit: 'Pcs',
            product_type: 'INVENTORY',
          },
        ],
        payments: [
          {
            id: 'payment-1',
            account_id: 'cash-account-1',
            account_code: '1101',
            account_name: 'Kas',
            payment_date: '2026-04-18',
            amount: 100000,
            discount_amount: 0,
            payment_number: 'PAY-2026-000001',
            notes: 'DP customer',
            created_at: '2026-04-18T02:00:00.000Z',
          },
        ],
        returns: [
          {
            id: 'return-1',
            return_number: 'SR-2026-000001',
            return_date: '2026-04-19',
            total_amount: 50000,
            tax_amount: 5000,
            grand_total: 55000,
            status: 'APPROVED',
            notes: 'Salah kirim item',
            created_at: '2026-04-19T00:00:00.000Z',
          },
        ],
      },
      meta: {
        org_id: '11111111-1111-4111-8111-111111111111',
        branch_scope: '22222222-2222-4222-8222-222222222222',
      },
    })
    expect(mocks.logApiCall).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/api/v1/sales/:saleId',
        statusCode: 200,
      })
    )
  })

  it('returns 404 when a sales detail document is not found', async () => {
    mocks.queryPostgres.mockResolvedValueOnce({ rows: [] })

    const response = await getSaleDetail(
      new NextRequest('http://localhost/api/v1/sales/missing-sale', {
        headers: {
          'x-api-key': 'nzm_live_test',
          'user-agent': 'Vitest',
        },
      }),
      { params: Promise.resolve({ saleId: 'missing-sale' }) }
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: 'Data penjualan tidak ditemukan.',
        error_code: 'sales_not_found',
      })
    )
    expect(mocks.logApiCall).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/api/v1/sales/:saleId',
        statusCode: 404,
      })
    )
  })
})
