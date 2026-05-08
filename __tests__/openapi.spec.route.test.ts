import { afterEach, describe, expect, it } from 'vitest'

import { buildOpenApiSpec } from '@/lib/api/openapi'
import { GET } from '@/app/api/openapi/route'

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL

describe('Open API specification', () => {
  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl
  })

  it('builds the machine-readable spec with security schemes and documented endpoints', () => {
    const spec = buildOpenApiSpec('https://api.example.com')

    expect(spec.openapi).toBe('3.1.0')
    expect(spec.info.title).toBe('Nizam Open API')
    expect(spec.info.version).toBe('1.5.0')
    expect(spec.servers[0]).toEqual({
      url: 'https://api.example.com/api/v1',
      description: 'Production server',
    })
    expect(spec.components.securitySchemes).toEqual(
      expect.objectContaining({
        ApiKeyAuth: expect.objectContaining({
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
        }),
        BearerAuth: expect.objectContaining({
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'API Key',
        }),
      })
    )
    expect(spec.paths).toEqual(
      expect.objectContaining({
        '/cash': expect.any(Object),
        '/inventory': expect.any(Object),
        '/inventory/movements': expect.any(Object),
        '/inventory/reconciliation': expect.any(Object),
        '/general-ledger': expect.any(Object),
        '/sales': expect.any(Object),
        '/sales/{saleId}': expect.any(Object),
        '/purchases': expect.any(Object),
        '/bank-transactions': expect.any(Object),
        '/contacts': expect.any(Object),
        '/contacts/upsert': expect.any(Object),
      })
    )
    expect(spec.paths['/cash'].post.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Idempotency-Key', in: 'header' }),
      ])
    )
    expect(spec.paths['/cash'].post.responses['409']).toEqual(expect.any(Object))
    expect(spec.components.schemas.CreateCashRequest.properties.idempotency_key).toEqual(expect.any(Object))
    expect(spec.paths['/sales'].get.operationId).toBe('listSalesDocuments')
    expect(spec.paths['/inventory/movements'].get.operationId).toBe('listInventoryMovements')
    expect(spec.paths['/inventory/reconciliation'].get.operationId).toBe('listInventoryLedgerReconciliation')
    expect(spec.paths['/general-ledger'].get.operationId).toBe('listGeneralLedgerEntries')
    expect(spec.paths['/sales/{saleId}'].get.operationId).toBe('getSalesDocumentById')
    expect(spec.paths['/purchases'].get.operationId).toBe('listPurchaseDocuments')
    expect(spec.paths['/bank-transactions'].get.operationId).toBe('listBankTransactions')
    expect(spec.paths['/contacts'].get.operationId).toBe('listContacts')
    expect(spec.paths['/contacts/upsert'].post.operationId).toBe('upsertContact')
    expect(spec.components.schemas.SalesListResponse).toEqual(expect.any(Object))
    expect(spec.components.schemas.InventoryMovementListResponse).toEqual(expect.any(Object))
    expect(spec.components.schemas.InventoryReconciliationListResponse).toEqual(expect.any(Object))
    expect(spec.components.schemas.GeneralLedgerListResponse).toEqual(expect.any(Object))
    expect(spec.components.schemas.SalesDetailResponse).toEqual(expect.any(Object))
    expect(spec.components.schemas.PurchaseListResponse).toEqual(expect.any(Object))
    expect(spec.components.schemas.BankTransactionListResponse).toEqual(expect.any(Object))
    expect(spec.components.schemas.ContactsListResponse).toEqual(expect.any(Object))
    expect(spec.components.schemas.ContactUpsertResponse).toEqual(expect.any(Object))
    expect(spec.paths['/cash'].get.responses['401'].content['application/json'].schema.properties).toEqual(
      expect.objectContaining({
        error_code: expect.any(Object),
        request_id: expect.any(Object),
      })
    )
    expect(spec.tags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Cash' }),
        expect.objectContaining({ name: 'Inventory' }),
        expect.objectContaining({ name: 'Sales' }),
        expect.objectContaining({ name: 'Purchases' }),
        expect.objectContaining({ name: 'Bank Transactions' }),
        expect.objectContaining({ name: 'Accounting' }),
        expect.objectContaining({ name: 'Contacts' }),
      ])
    )
  })

  it('serves the OpenAPI document using NEXT_PUBLIC_APP_URL when configured', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://kliknizam.app'

    const response = await GET(new Request('http://localhost:3000/api/openapi'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/vnd.oai.openapi+json; charset=utf-8')
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=300')
    expect(payload.servers[0].url).toBe('https://kliknizam.app/api/v1')
  })

  it('falls back to the request origin when NEXT_PUBLIC_APP_URL is not set', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL

    const response = await GET(new Request('https://tenant.example.com/api/openapi'))
    const payload = await response.json()

    expect(payload.servers[0].url).toBe('https://tenant.example.com/api/v1')
  })
})
