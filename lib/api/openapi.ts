/**
 * lib/api/openapi.ts
 *
 * OpenAPI 3.1 specification builder for Nizam public API.
 * The generated document is machine-readable and can be consumed by
 * Swagger UI, Postman import, SDK generators, and external integrators.
 */

function jsonContent(
  schema: Record<string, unknown>,
  exampleOrOptions?: unknown
) {
  const options =
    exampleOrOptions &&
    typeof exampleOrOptions === 'object' &&
    !Array.isArray(exampleOrOptions) &&
    ('example' in exampleOrOptions || 'examples' in exampleOrOptions)
      ? (exampleOrOptions as {
        example?: unknown
        examples?: Record<string, unknown>
      })
      : { example: exampleOrOptions }

  return {
    'application/json': {
      schema,
      ...(options.example !== undefined ? { example: options.example } : {}),
      ...(options.examples ? { examples: options.examples } : {}),
    },
  }
}

export function buildOpenApiSpec(serverUrl: string) {
  const apiErrorSchema = {
    type: 'object',
    properties: {
      success: { type: 'boolean', const: false },
      error: { type: 'string' },
    },
    required: ['success', 'error'],
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Nizam Open API',
      version: '1.0.0',
      summary: 'Public REST API for Nizam ERP integrations.',
      description: 'Standar integrasi eksternal untuk membaca data inventori, membaca rekening kas, dan membuat transaksi kas.',
      contact: {
        name: 'Nizam Support',
        url: 'https://brain.kliknizam.app',
      },
    },
    servers: [
      {
        url: `${serverUrl}/api/v1`,
        description: 'Production server',
      },
    ],
    security: [
      { ApiKeyAuth: [] },
      { BearerAuth: [] },
    ],
    tags: [
      { name: 'Cash', description: 'Cash and bank integrations.' },
      { name: 'Inventory', description: 'Inventory and stock visibility.' },
    ],
    paths: {
      '/cash': {
        get: {
          tags: ['Cash'],
          summary: 'List active cash and bank accounts',
          description: 'Mengembalikan rekening bank aktif plus akun kas/bank likuid dari CoA (11xx) walau belum punya bridge `bank_accounts`, lengkap dengan saldo posted dan metadata cabang.',
          operationId: 'listCashAccounts',
          security: [
            { ApiKeyAuth: [] },
            { BearerAuth: [] },
          ],
          responses: {
            '200': {
              description: 'Cash accounts retrieved successfully.',
              content: jsonContent(
                { $ref: '#/components/schemas/CashListResponse' },
                {
                  example: {
                    success: true,
                    data: [
                      {
                        id: 'bank-account-id',
                        bank_account_id: 'bank-account-id',
                        source: 'bank_account',
                        name: 'Bank BCA Operasional',
                        account_id: 'cash-account-id',
                        account_code: '1101',
                        account_name: 'Bank BCA Operasional',
                        account_number: '1234567890',
                        bank_name: 'BCA',
                        balance: 15000000,
                        currency: 'IDR',
                        branch_id: 'branch-id',
                        is_active: true,
                      },
                      {
                        id: 'gl-cash-account-id',
                        bank_account_id: null,
                        source: 'gl_account',
                        name: 'Kas Kecil Gudang',
                        account_id: 'gl-cash-account-id',
                        account_code: '1103',
                        account_name: 'Kas Kecil Gudang',
                        account_number: null,
                        bank_name: 'Kas Kecil Gudang',
                        balance: 2750000,
                        currency: 'IDR',
                        branch_id: 'branch-id',
                        is_active: true,
                      },
                    ],
                    meta: {
                      org_id: 'org-id',
                      branch_scope: 'branch-id',
                      count: 2,
                    },
                  },
                }
              ),
            },
            '401': {
              description: 'Missing or invalid API key.',
              content: jsonContent(apiErrorSchema),
            },
            '403': {
              description: 'Missing `cash:read` scope.',
              content: jsonContent(apiErrorSchema),
            },
            '429': {
              description: 'Rate limit exceeded.',
              content: jsonContent(apiErrorSchema),
            },
          },
        },
        post: {
          tags: ['Cash'],
          summary: 'Create a cash transaction',
          description: 'Membuat transaksi kas masuk atau keluar ke modul kas/bank aktif. `account_id` bisa menunjuk langsung ke akun kas/bank CoA (11xx) atau ke `bank_accounts`. Untuk skenario sederhana gunakan satu akun lawan; untuk pembelian inventory, pajak, diskon, hutang, atau biaya lain gunakan `journal_lines` agar jurnal split tetap masuk ke buku besar secara balance.',
          operationId: 'createCashTransaction',
          security: [
            { ApiKeyAuth: [] },
            { BearerAuth: [] },
          ],
          requestBody: {
            required: true,
            content: jsonContent(
              { $ref: '#/components/schemas/CreateCashRequest' },
              {
                example: {
                  type: 'in',
                  amount: 250000,
                  description: 'Pelunasan invoice INV-2026-001',
                  reference: 'INV-2026-001',
                  branch_id: 'branch-id',
                  transaction_date: '2026-04-15',
                  account_id: 'cash-bank-11xx-account-id',
                  settlement_type: 'receivable',
                },
                examples: {
                  simple_receivable: {
                    summary: 'Pelunasan piutang',
                    description: 'Kas masuk sederhana dengan satu akun lawan piutang.',
                    value: {
                      type: 'in',
                      amount: 250000,
                      description: 'Pelunasan invoice INV-2026-001',
                      reference: 'INV-2026-001',
                      branch_id: 'branch-id',
                      transaction_date: '2026-04-15',
                      account_id: 'cash-bank-11xx-account-id',
                      settlement_type: 'receivable',
                    },
                  },
                  inventory_purchase_split: {
                    summary: 'Push pembelian buku marketplace ke buku besar',
                    description: 'Kas keluar pembelian buku dari toko online dengan persediaan, PPN, ongkir masuk, diskon supplier, dan sisa hutang.',
                    value: {
                      type: 'out',
                      amount: 15000,
                      description: 'Push marketplace pembelian BMS3 - BUKU MATEMATIKA SERIES 3',
                      reference: 'PO-MP-BOOK-2026-0001',
                      branch_id: 'branch-id',
                      transaction_date: '2026-04-15',
                      account_id: 'cash-bank-11xx-account-id',
                      journal_lines: [
                        {
                          account_id: 'inventory-account-id',
                          debit: 19200,
                          memo: 'Persediaan BMS3 2 Pcs',
                        },
                        {
                          account_id: 'tax-account-id',
                          debit: 1920,
                          memo: 'PPN masukan pembelian marketplace',
                        },
                        {
                          account_id: 'other-charge-account-id',
                          debit: 2000,
                          memo: 'Ongkir masuk marketplace',
                        },
                        {
                          account_id: 'discount-account-id',
                          credit: 1000,
                          memo: 'Diskon supplier marketplace',
                        },
                        {
                          account_id: 'payable-account-id',
                          credit: 7120,
                          memo: 'Sisa hutang supplier marketplace',
                        },
                      ],
                    },
                  },
                },
              }
            ),
          },
          responses: {
            '200': {
              description: 'Cash transaction created successfully.',
              content: jsonContent(
                { $ref: '#/components/schemas/CreateCashResponse' },
                {
                  example: {
                    success: true,
                    data: {
                      id: 'cash-transaction-id',
                      reference_number: 'INV-2026-001',
                      amount: 250000,
                      description: 'Pelunasan invoice INV-2026-001',
                      status: 'POSTED',
                      created_at: '2026-04-15T10:30:00.000Z',
                      journal_entry_id: 'journal-entry-id',
                      bank_account_id: 'bank-account-id',
                      category_id: 'receivable-account-id',
                      transaction_date: '2026-04-15',
                    },
                    meta: {
                      type: 'cash_in',
                      auto_post: true,
                      settlement_type: 'receivable',
                    },
                  },
                  examples: {
                    simple_receivable: {
                      summary: 'Kas masuk piutang',
                      value: {
                        success: true,
                        data: {
                          id: 'cash-transaction-id',
                          reference_number: 'INV-2026-001',
                          amount: 250000,
                          description: 'Pelunasan invoice INV-2026-001',
                          status: 'POSTED',
                          created_at: '2026-04-15T10:30:00.000Z',
                          journal_entry_id: 'journal-entry-id',
                          bank_account_id: 'bank-account-id',
                          category_id: 'receivable-account-id',
                          transaction_date: '2026-04-15',
                        },
                        meta: {
                          type: 'cash_in',
                          auto_post: true,
                          settlement_type: 'receivable',
                        },
                      },
                    },
                    inventory_purchase_split: {
                      summary: 'Kas keluar pembelian buku marketplace',
                      value: {
                        success: true,
                        data: {
                          id: 'cash-transaction-id',
                          reference_number: 'PO-MP-BOOK-2026-0001',
                          amount: 15000,
                          description: 'Push marketplace pembelian BMS3 - BUKU MATEMATIKA SERIES 3',
                          status: 'POSTED',
                          created_at: '2026-04-15T10:45:00.000Z',
                          journal_entry_id: 'journal-entry-id',
                          bank_account_id: 'bank-account-id',
                          category_id: 'inventory-account-id',
                          transaction_date: '2026-04-15',
                        },
                        meta: {
                          type: 'cash_out',
                          auto_post: true,
                          settlement_type: 'general',
                        },
                      },
                    },
                  },
                }
              ),
            },
            '400': {
              description: 'Invalid body or missing required fields.',
              content: jsonContent(apiErrorSchema),
            },
            '401': {
              description: 'Missing or invalid API key.',
              content: jsonContent(apiErrorSchema),
            },
            '403': {
              description: 'Missing `cash:write` scope.',
              content: jsonContent(apiErrorSchema),
            },
            '422': {
              description: 'Cash account configuration is incomplete.',
              content: jsonContent(apiErrorSchema),
            },
            '429': {
              description: 'Rate limit exceeded.',
              content: jsonContent(apiErrorSchema),
            },
          },
        },
      },
      '/inventory': {
        get: {
          tags: ['Inventory'],
          summary: 'List inventory items',
          description: 'Mengembalikan daftar produk aktif dan stok inventori. Parameter pencarian nama bersifat opsional.',
          operationId: 'listInventoryItems',
          security: [
            { ApiKeyAuth: [] },
            { BearerAuth: [] },
          ],
          parameters: [
            {
              name: 'limit',
              in: 'query',
              required: false,
              description: 'Maximum number of records to return. Default 100, maximum 500.',
              schema: { type: 'integer', minimum: 1, maximum: 500, default: 100 },
            },
            {
              name: 'search',
              in: 'query',
              required: false,
              description: 'Case-insensitive product name search.',
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Inventory items retrieved successfully.',
              content: jsonContent(
                { $ref: '#/components/schemas/InventoryListResponse' },
                {
                  success: true,
                  data: [
                    {
                      id: 'product-id',
                      code: 'BMS3',
                      name: 'BUKU MATEMATIKA SERIES 3',
                      unit: 'Pcs',
                      category: 'Siap Jual',
                      selling_price: 13333.33,
                      cost_price: 9600,
                      stock_quantity: 3,
                      branch_id: null,
                      is_active: true,
                    },
                  ],
                  meta: {
                    org_id: 'org-id',
                    branch_scope: 'branch-id',
                    count: 1,
                  },
                }
              ),
            },
            '401': {
              description: 'Missing or invalid API key.',
              content: jsonContent(apiErrorSchema),
            },
            '403': {
              description: 'Missing `inventory:read` scope.',
              content: jsonContent(apiErrorSchema),
            },
            '429': {
              description: 'Rate limit exceeded.',
              content: jsonContent(apiErrorSchema),
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'Primary API key authentication.',
        },
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'API Key',
          description: 'Alternative bearer token style for the same Nizam API key.',
        },
      },
      schemas: {
        CashAccount: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            bank_account_id: {
              type: 'string',
              format: 'uuid',
              nullable: true,
              description: 'ID bridge `bank_accounts`. Bisa `null` bila sumber row adalah akun CoA likuid yang belum punya bridge.',
            },
            source: {
              type: 'string',
              enum: ['bank_account', 'gl_account'],
              description: '`bank_account` bila berasal dari tabel bank_accounts, `gl_account` bila berasal langsung dari CoA 11xx.',
            },
            name: { type: 'string' },
            account_id: {
              type: 'string',
              format: 'uuid',
              description: 'ID akun CoA kas/bank likuid yang dipakai untuk jurnal.',
            },
            account_code: { type: 'string', nullable: true },
            account_name: { type: 'string', nullable: true },
            account_number: { type: 'string', nullable: true },
            bank_name: { type: 'string', nullable: true },
            balance: {
              type: 'number',
              description: 'Saldo posted hasil agregasi jurnal debit minus credit untuk akun kas/bank tersebut.',
            },
            currency: { type: 'string', nullable: true },
            branch_id: { type: 'string', format: 'uuid', nullable: true },
            is_active: { type: 'boolean' },
          },
          required: ['id', 'name', 'account_id', 'balance', 'is_active'],
        },
        CashJournalLineInput: {
          type: 'object',
          properties: {
            account_id: {
              type: 'string',
              format: 'uuid',
              nullable: true,
              description: 'ID akun CoA lawan transaksi untuk line ini.',
            },
            category_id: {
              type: 'string',
              format: 'uuid',
              nullable: true,
              description: 'Alias untuk `account_id`.',
            },
            counter_account_id: {
              type: 'string',
              format: 'uuid',
              nullable: true,
              description: 'Alias untuk `account_id`.',
            },
            settlement_account_id: {
              type: 'string',
              format: 'uuid',
              nullable: true,
              description: 'Alias untuk `account_id`.',
            },
            settlement_type: {
              type: 'string',
              enum: ['general', 'revenue', 'expense', 'receivable', 'payable', 'tax', 'discount', 'other_charge'],
              nullable: true,
              description: 'Boleh diisi bila line ingin mengambil mapping akun default dari konfigurasi API.',
            },
            debit: {
              type: 'number',
              nullable: true,
              description: 'Nominal debit. Tepat satu sisi antara `debit` atau `credit` wajib diisi.',
            },
            credit: {
              type: 'number',
              nullable: true,
              description: 'Nominal credit. Tepat satu sisi antara `debit` atau `credit` wajib diisi.',
            },
            amount: {
              type: 'number',
              nullable: true,
              description: 'Alternatif nominal bila memakai `entry` = `debit` atau `credit`.',
            },
            entry: {
              type: 'string',
              enum: ['debit', 'credit'],
              nullable: true,
              description: 'Dipakai bersama `amount` sebagai alternatif pasangan `debit` / `credit`.',
            },
            memo: { type: 'string', nullable: true },
          },
        },
        InventoryItem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            code: { type: 'string', nullable: true },
            name: { type: 'string' },
            unit: { type: 'string' },
            category: { type: 'string', nullable: true },
            selling_price: { type: 'number' },
            cost_price: { type: 'number' },
            stock_quantity: { type: 'number' },
            branch_id: { type: 'string', format: 'uuid', nullable: true },
            is_active: { type: 'boolean' },
          },
          required: ['id', 'name', 'unit', 'selling_price', 'cost_price', 'stock_quantity', 'is_active'],
        },
        CashTransactionResult: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            reference_number: { type: 'string', nullable: true },
            amount: { type: 'number' },
            description: { type: 'string' },
            status: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
            journal_entry_id: { type: 'string', format: 'uuid', nullable: true },
            bank_account_id: { type: 'string', format: 'uuid' },
            category_id: { type: 'string', format: 'uuid', nullable: true },
            transaction_date: { type: 'string', format: 'date' },
          },
          required: ['id', 'amount', 'description', 'status', 'created_at', 'bank_account_id', 'transaction_date'],
        },
        ResponseMeta: {
          type: 'object',
          properties: {
            org_id: { type: 'string', format: 'uuid' },
            branch_scope: {
              oneOf: [
                { type: 'string', format: 'uuid' },
                { type: 'string', enum: ['all'] },
              ],
            },
            count: { type: 'integer' },
            type: { type: 'string' },
            auto_post: { type: 'boolean' },
            settlement_type: { type: 'string' },
          },
        },
        CashListResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', const: true },
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/CashAccount' },
            },
            meta: { $ref: '#/components/schemas/ResponseMeta' },
          },
          required: ['success', 'data'],
        },
        InventoryListResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', const: true },
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/InventoryItem' },
            },
            meta: { $ref: '#/components/schemas/ResponseMeta' },
          },
          required: ['success', 'data'],
        },
        CreateCashRequest: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['in', 'out'], description: '`in` untuk kas masuk, `out` untuk kas keluar.' },
            amount: {
              type: 'number',
              exclusiveMinimum: 0,
              description: 'Nilai arus kas aktual pada akun kas/bank. Pada transaksi split, ini bukan total gross jika masih ada hutang/piutang sisa.',
            },
            description: { type: 'string' },
            reference: { type: 'string' },
            branch_id: {
              type: 'string',
              format: 'uuid',
              description: 'Wajib bila API key tidak dibatasi ke satu cabang.',
            },
            account_id: {
              type: 'string',
              format: 'uuid',
              description: 'ID akun kas/bank CoA `11xx`. Bila belum punya row `bank_accounts`, sistem akan membuat bridge otomatis per cabang.',
            },
            bank_account_id: {
              type: 'string',
              format: 'uuid',
              description: 'ID row `bank_accounts` bila ingin memilih rekening bridge tertentu secara eksplisit.',
            },
            category_id: {
              type: 'string',
              format: 'uuid',
              description: 'Akun lawan sederhana untuk mode tanpa `journal_lines`.',
            },
            counter_account_id: {
              type: 'string',
              format: 'uuid',
              description: 'Alias untuk `category_id`.',
            },
            transaction_date: { type: 'string', format: 'date' },
            settlement_type: {
              type: 'string',
              enum: ['general', 'revenue', 'expense', 'receivable', 'payable', 'tax', 'discount', 'other_charge'],
              description: 'Menentukan mapping akun lawan default untuk mode sederhana atau per-line.',
            },
            journal_lines: {
              type: 'array',
              description: 'Split jurnal tanpa menyertakan baris kas/bank. Sistem akan menambahkan baris kas/bank otomatis berdasarkan `amount` dan `type`.',
              items: { $ref: '#/components/schemas/CashJournalLineInput' },
            },
          },
          required: ['type', 'amount', 'description'],
        },
        CreateCashResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', const: true },
            data: { $ref: '#/components/schemas/CashTransactionResult' },
            meta: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['cash_in', 'cash_out'] },
                auto_post: { type: 'boolean' },
                settlement_type: { type: 'string' },
              },
              required: ['type', 'auto_post', 'settlement_type'],
            },
          },
          required: ['success', 'data', 'meta'],
        },
      },
    },
  }
}
