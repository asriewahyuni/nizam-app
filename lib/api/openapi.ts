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
      message: { type: 'string' },
      error_code: { type: 'string' },
      request_id: { type: 'string', format: 'uuid' },
    },
    required: ['success', 'error', 'message', 'error_code', 'request_id'],
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Nizam Open API',
      version: '1.5.0',
      summary: 'Public REST API for Nizam ERP integrations.',
      description: 'Standar integrasi eksternal untuk membaca inventory, kontak, penjualan, pembelian, transaksi kas/bank, buku besar, rekonsiliasi inventory vs ledger, rekening kas, dan membuat transaksi kas dengan kontrak error yang konsisten.',
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
      { name: 'Sales', description: 'Sales order and invoice visibility.' },
      { name: 'Purchases', description: 'Purchase order and vendor payable visibility.' },
      { name: 'Bank Transactions', description: 'Cash and bank movement visibility.' },
      { name: 'Accounting', description: 'General ledger and reconciliation visibility.' },
      { name: 'Contacts', description: 'Customer and supplier directory access.' },
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
          description: 'Membuat transaksi kas masuk atau keluar ke modul kas/bank aktif. `account_id` bisa menunjuk langsung ke akun kas/bank CoA (11xx) atau ke `bank_accounts`. Untuk integrasi production, kirim `Idempotency-Key` atau `idempotency_key` agar retry tidak membuat transaksi ganda. Untuk skenario sederhana gunakan satu akun lawan; untuk pembelian inventory, pajak, diskon, hutang, atau biaya lain gunakan `journal_lines` agar jurnal split tetap masuk ke buku besar secara balance.',
          operationId: 'createCashTransaction',
          security: [
            { ApiKeyAuth: [] },
            { BearerAuth: [] },
          ],
          parameters: [
            {
              name: 'Idempotency-Key',
              in: 'header',
              required: false,
              description: 'Kunci idempotensi untuk memastikan retry POST yang sama tidak membuat transaksi duplikat.',
              schema: { type: 'string', minLength: 1, maxLength: 255 },
            },
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
                  idempotency_key: 'cash-inv-2026-001',
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
                      idempotency_key: 'cash-inv-2026-001',
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
                      idempotency_key: 'cash-po-mp-book-2026-0001',
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
            '409': {
              description: 'Idempotency key conflict or request replay still processing.',
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
      '/inventory/movements': {
        get: {
          tags: ['Inventory'],
          summary: 'List inventory movements',
          description: 'Mengembalikan kartu stok atau riwayat pergerakan inventori dari tabel `stock_movements`. Cocok untuk audit stok, sinkronisasi WMS, atau debugging selisih persediaan.',
          operationId: 'listInventoryMovements',
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
              name: 'product_id',
              in: 'query',
              required: false,
              description: 'Exact product UUID filter.',
              schema: { type: 'string', format: 'uuid' },
            },
            {
              name: 'reference_type',
              in: 'query',
              required: false,
              description: 'Exact movement source type filter such as `SALE`, `PURCHASE`, `ADJUSTMENT`, `PRODUCTION_OUTPUT`, or `PRODUCTION_CONSUMPTION`.',
              schema: { type: 'string' },
            },
            {
              name: 'direction',
              in: 'query',
              required: false,
              description: 'Movement direction filter.',
              schema: { type: 'string', enum: ['in', 'out'] },
            },
            {
              name: 'date_from',
              in: 'query',
              required: false,
              description: 'Inclusive lower bound for `movement_date` in `YYYY-MM-DD` format.',
              schema: { type: 'string', format: 'date' },
            },
            {
              name: 'date_to',
              in: 'query',
              required: false,
              description: 'Inclusive upper bound for `movement_date` in `YYYY-MM-DD` format.',
              schema: { type: 'string', format: 'date' },
            },
            {
              name: 'search',
              in: 'query',
              required: false,
              description: 'Case-insensitive search over product name, SKU, or notes.',
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Inventory movements retrieved successfully.',
              content: jsonContent(
                { $ref: '#/components/schemas/InventoryMovementListResponse' },
                {
                  success: true,
                  data: [
                    {
                      id: 'movement-id',
                      product_id: 'product-id',
                      product_code: 'BMS3',
                      product_name: 'BUKU MATEMATIKA SERIES 3',
                      product_unit: 'Pcs',
                      product_category: 'Siap Jual',
                      movement_date: '2026-04-18T08:00:00.000Z',
                      quantity: -2,
                      direction: 'out',
                      unit_price: 9600,
                      reference_type: 'SALE',
                      reference_id: 'sale-id',
                      notes: 'Pengiriman SO-2026-000001',
                      branch_id: 'branch-id',
                      created_at: '2026-04-18T08:00:00.000Z',
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
            '400': {
              description: 'Invalid filter values.',
              content: jsonContent(apiErrorSchema),
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
      '/inventory/reconciliation': {
        get: {
          tags: ['Accounting'],
          summary: 'List inventory reconciliation rows',
          description: 'Mengembalikan rekonsiliasi nilai inventory antara sub-ledger `stock_movements` berbasis average cost dan saldo buku besar akun persediaan `1301-1399`.',
          operationId: 'listInventoryLedgerReconciliation',
          security: [
            { ApiKeyAuth: [] },
            { BearerAuth: [] },
          ],
          parameters: [
            {
              name: 'limit',
              in: 'query',
              required: false,
              description: 'Maximum number of products to return. Default 100, maximum 500.',
              schema: { type: 'integer', minimum: 1, maximum: 500, default: 100 },
            },
            {
              name: 'product_id',
              in: 'query',
              required: false,
              description: 'Exact product UUID filter.',
              schema: { type: 'string', format: 'uuid' },
            },
            {
              name: 'as_of_date',
              in: 'query',
              required: false,
              description: 'Cut-off date for both stock movements and ledger balances in `YYYY-MM-DD` format.',
              schema: { type: 'string', format: 'date' },
            },
            {
              name: 'variance_only',
              in: 'query',
              required: false,
              description: 'Return only rows with non-zero variance.',
              schema: { type: 'boolean', default: false },
            },
            {
              name: 'search',
              in: 'query',
              required: false,
              description: 'Case-insensitive search over product name or SKU.',
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Inventory reconciliation rows retrieved successfully.',
              content: jsonContent(
                { $ref: '#/components/schemas/InventoryReconciliationListResponse' },
                {
                  success: true,
                  data: [
                    {
                      product_id: 'product-id',
                      product_code: 'BMS3',
                      product_name: 'BUKU MATEMATIKA SERIES 3',
                      product_unit: 'Pcs',
                      product_category: 'Siap Jual',
                      stock_qty: 7,
                      avg_cost: 9600,
                      on_hand_value: 67200,
                      ledger_value: 65000,
                      variance: 2200,
                    },
                  ],
                  meta: {
                    org_id: 'org-id',
                    branch_scope: 'branch-id',
                    count: 1,
                    as_of_date: '2026-04-18',
                    on_hand_value: 67200,
                    gl_inventory_balance: 65000,
                    inventory_variance: 2200,
                    valuation_method: 'average_cost',
                    gl_account_range: '1301-1399',
                  },
                }
              ),
            },
            '400': {
              description: 'Invalid product or date filter.',
              content: jsonContent(apiErrorSchema),
            },
            '401': {
              description: 'Missing or invalid API key.',
              content: jsonContent(apiErrorSchema),
            },
            '403': {
              description: 'Missing `ledger:read` scope.',
              content: jsonContent(apiErrorSchema),
            },
            '429': {
              description: 'Rate limit exceeded.',
              content: jsonContent(apiErrorSchema),
            },
          },
        },
      },
      '/general-ledger': {
        get: {
          tags: ['Accounting'],
          summary: 'List general ledger entries',
          description: 'Mengembalikan jurnal posted berikut total debit/kredit dan baris akun per entry. Dapat difilter per akun, reference type, rentang tanggal, dan branch scope dari API key.',
          operationId: 'listGeneralLedgerEntries',
          security: [
            { ApiKeyAuth: [] },
            { BearerAuth: [] },
          ],
          parameters: [
            {
              name: 'limit',
              in: 'query',
              required: false,
              description: 'Maximum number of entries to return. Default 50, maximum 200.',
              schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
            },
            {
              name: 'date_from',
              in: 'query',
              required: false,
              description: 'Inclusive lower bound for `entry_date`.',
              schema: { type: 'string', format: 'date' },
            },
            {
              name: 'date_to',
              in: 'query',
              required: false,
              description: 'Inclusive upper bound for `entry_date`.',
              schema: { type: 'string', format: 'date' },
            },
            {
              name: 'account_id',
              in: 'query',
              required: false,
              description: 'Exact account UUID filter based on journal line existence.',
              schema: { type: 'string', format: 'uuid' },
            },
            {
              name: 'account_code',
              in: 'query',
              required: false,
              description: 'Exact account code filter based on journal line existence.',
              schema: { type: 'string' },
            },
            {
              name: 'reference_type',
              in: 'query',
              required: false,
              description: 'Exact journal reference type filter.',
              schema: { type: 'string' },
            },
            {
              name: 'search',
              in: 'query',
              required: false,
              description: 'Case-insensitive search over entry number, description, or notes.',
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'General ledger entries retrieved successfully.',
              content: jsonContent(
                { $ref: '#/components/schemas/GeneralLedgerListResponse' },
                {
                  success: true,
                  data: [
                    {
                      id: 'je-id',
                      entry_number: 'JE-2026-000101',
                      entry_date: '2026-04-18',
                      description: 'Pengiriman penjualan SO-2026-000001',
                      reference_type: 'SALE',
                      reference_id: 'sale-id',
                      status: 'POSTED',
                      notes: null,
                      posted_at: '2026-04-18T08:10:00.000Z',
                      created_at: '2026-04-18T08:09:00.000Z',
                      branch_id: 'branch-id',
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
                    org_id: 'org-id',
                    branch_scope: 'branch-id',
                    count: 1,
                  },
                }
              ),
            },
            '400': {
              description: 'Invalid account or date filter.',
              content: jsonContent(apiErrorSchema),
            },
            '401': {
              description: 'Missing or invalid API key.',
              content: jsonContent(apiErrorSchema),
            },
            '403': {
              description: 'Missing `ledger:read` scope.',
              content: jsonContent(apiErrorSchema),
            },
            '429': {
              description: 'Rate limit exceeded.',
              content: jsonContent(apiErrorSchema),
            },
          },
        },
      },
      '/sales': {
        get: {
          tags: ['Sales'],
          summary: 'List sales documents',
          description: 'Mengembalikan daftar penjualan terbaru dari schema `sales`, dapat difilter berdasarkan status dan rentang tanggal.',
          operationId: 'listSalesDocuments',
          security: [
            { ApiKeyAuth: [] },
            { BearerAuth: [] },
          ],
          parameters: [
            {
              name: 'limit',
              in: 'query',
              required: false,
              description: 'Maximum number of records to return. Default 50, maximum 200.',
              schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
            },
            {
              name: 'status',
              in: 'query',
              required: false,
              description: 'Exact sales status filter.',
              schema: { type: 'string' },
            },
            {
              name: 'date_from',
              in: 'query',
              required: false,
              description: 'Inclusive lower bound for `sale_date`.',
              schema: { type: 'string', format: 'date' },
            },
            {
              name: 'date_to',
              in: 'query',
              required: false,
              description: 'Inclusive upper bound for `sale_date`.',
              schema: { type: 'string', format: 'date' },
            },
          ],
          responses: {
            '200': {
              description: 'Sales documents retrieved successfully.',
              content: jsonContent(
                { $ref: '#/components/schemas/SalesListResponse' },
                {
                  success: true,
                  data: [
                    {
                      id: 'sale-id',
                      so_number: 'SO-2026-000001',
                      customer_name: 'CV Maju',
                      total_amount: 250000,
                      status: 'ORDERED',
                      branch_id: 'branch-id',
                      order_date: '2026-04-18',
                      created_at: '2026-04-18T00:00:00.000Z',
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
              description: 'Missing `sales:read` scope.',
              content: jsonContent(apiErrorSchema),
            },
            '429': {
              description: 'Rate limit exceeded.',
              content: jsonContent(apiErrorSchema),
            },
          },
        },
      },
      '/sales/{saleId}': {
        get: {
          tags: ['Sales'],
          summary: 'Get a sales document by ID',
          description: 'Mengembalikan detail satu penjualan, termasuk line item, pembayaran, dan retur yang sudah tercatat.',
          operationId: 'getSalesDocumentById',
          security: [
            { ApiKeyAuth: [] },
            { BearerAuth: [] },
          ],
          parameters: [
            {
              name: 'saleId',
              in: 'path',
              required: true,
              description: 'ID dokumen penjualan.',
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            '200': {
              description: 'Sales document retrieved successfully.',
              content: jsonContent(
                { $ref: '#/components/schemas/SalesDetailResponse' },
                {
                  success: true,
                  data: {
                    id: 'sale-id',
                    so_number: 'SO-2026-000001',
                    customer_id: 'customer-id',
                    customer_name: 'CV Maju',
                    total_amount: 225000,
                    tax_amount: 22500,
                    discount_amount: 5000,
                    grand_total: 242500,
                    status: 'ORDERED',
                    payment_status: 'PARTIAL',
                    branch_id: 'branch-id',
                    branch_name: 'Cabang Utama',
                    warehouse_id: 'warehouse-id',
                    warehouse_name: 'Gudang Utama',
                    order_date: '2026-04-18',
                    due_date: '2026-04-25',
                    notes: 'Follow up pengiriman H+1',
                    created_at: '2026-04-18T00:00:00.000Z',
                    updated_at: '2026-04-18T01:00:00.000Z',
                    items: [
                      {
                        id: 'sale-item-id',
                        product_id: 'product-id',
                        description: 'BUKU MATEMATIKA SERIES 3',
                        quantity: 3,
                        unit_price: 75000,
                        discount_amount: 5000,
                        tax_amount: 22500,
                        total_amount: 242500,
                        branch_id: 'branch-id',
                        product_name: 'BUKU MATEMATIKA SERIES 3',
                        sku: 'BMS3',
                        unit: 'Pcs',
                        product_type: 'INVENTORY',
                      },
                    ],
                    payments: [
                      {
                        id: 'payment-id',
                        account_id: 'cash-account-id',
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
                    returns: [],
                  },
                  meta: {
                    org_id: 'org-id',
                    branch_scope: 'branch-id',
                  },
                }
              ),
            },
            '401': {
              description: 'Missing or invalid API key.',
              content: jsonContent(apiErrorSchema),
            },
            '403': {
              description: 'Missing `sales:read` scope.',
              content: jsonContent(apiErrorSchema),
            },
            '404': {
              description: 'Sales document not found.',
              content: jsonContent(apiErrorSchema),
            },
            '429': {
              description: 'Rate limit exceeded.',
              content: jsonContent(apiErrorSchema),
            },
          },
        },
      },
      '/purchases': {
        get: {
          tags: ['Purchases'],
          summary: 'List purchase documents',
          description: 'Mengembalikan daftar pembelian terbaru dari schema `purchases`, dapat difilter berdasarkan status, payment status, dan rentang tanggal.',
          operationId: 'listPurchaseDocuments',
          security: [
            { ApiKeyAuth: [] },
            { BearerAuth: [] },
          ],
          parameters: [
            {
              name: 'limit',
              in: 'query',
              required: false,
              description: 'Maximum number of records to return. Default 50, maximum 200.',
              schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
            },
            {
              name: 'status',
              in: 'query',
              required: false,
              description: 'Exact purchase status filter.',
              schema: { type: 'string' },
            },
            {
              name: 'payment_status',
              in: 'query',
              required: false,
              description: 'Exact purchase payment status filter.',
              schema: { type: 'string' },
            },
            {
              name: 'date_from',
              in: 'query',
              required: false,
              description: 'Inclusive lower bound for `purchase_date`.',
              schema: { type: 'string', format: 'date' },
            },
            {
              name: 'date_to',
              in: 'query',
              required: false,
              description: 'Inclusive upper bound for `purchase_date`.',
              schema: { type: 'string', format: 'date' },
            },
          ],
          responses: {
            '200': {
              description: 'Purchase documents retrieved successfully.',
              content: jsonContent(
                { $ref: '#/components/schemas/PurchaseListResponse' },
                {
                  success: true,
                  data: [
                    {
                      id: 'purchase-id',
                      po_number: 'PO-2026-000001',
                      vendor_name: 'PT Supplier Buku',
                      total_amount: 512000,
                      status: 'RECEIVED',
                      payment_status: 'PARTIAL',
                      branch_id: 'branch-id',
                      purchase_date: '2026-04-18',
                      due_date: '2026-04-25',
                      item_count: 2,
                      created_at: '2026-04-18T00:00:00.000Z',
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
              description: 'Missing `purchases:read` scope.',
              content: jsonContent(apiErrorSchema),
            },
            '429': {
              description: 'Rate limit exceeded.',
              content: jsonContent(apiErrorSchema),
            },
          },
        },
      },
      '/bank-transactions': {
        get: {
          tags: ['Bank Transactions'],
          summary: 'List bank and cash transactions',
          description: 'Mengembalikan daftar transaksi kas/bank yang sudah tercatat pada tabel `bank_transactions`, lengkap dengan rekening kas, akun lawan, dan referensi transaksi.',
          operationId: 'listBankTransactions',
          security: [
            { ApiKeyAuth: [] },
            { BearerAuth: [] },
          ],
          parameters: [
            {
              name: 'limit',
              in: 'query',
              required: false,
              description: 'Maximum number of records to return. Default 50, maximum 200.',
              schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
            },
            {
              name: 'type',
              in: 'query',
              required: false,
              description: 'Cash direction filter. Accepts `in` or `out`.',
              schema: { type: 'string', enum: ['in', 'out'] },
            },
            {
              name: 'status',
              in: 'query',
              required: false,
              description: 'Exact bank transaction status filter.',
              schema: { type: 'string' },
            },
            {
              name: 'date_from',
              in: 'query',
              required: false,
              description: 'Inclusive lower bound for `transaction_date`.',
              schema: { type: 'string', format: 'date' },
            },
            {
              name: 'date_to',
              in: 'query',
              required: false,
              description: 'Inclusive upper bound for `transaction_date`.',
              schema: { type: 'string', format: 'date' },
            },
            {
              name: 'search',
              in: 'query',
              required: false,
              description: 'Case-insensitive search in description or reference number.',
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Bank transactions retrieved successfully.',
              content: jsonContent(
                { $ref: '#/components/schemas/BankTransactionListResponse' },
                {
                  success: true,
                  data: [
                    {
                      id: 'bank-tx-id',
                      bank_account_id: 'bank-account-id',
                      cash_account_id: 'cash-account-id',
                      cash_account_code: '1101',
                      cash_account_name: 'Kas',
                      bank_name: 'BCA Operasional',
                      account_number: '1234567890',
                      description: 'Pelunasan invoice INV-2026-001',
                      amount: 250000,
                      type: 'in',
                      reference_number: 'INV-2026-001',
                      status: 'POSTED',
                      category_id: 'receivable-account-id',
                      category_code: '1201',
                      category_name: 'Piutang Dagang',
                      journal_entry_id: 'journal-entry-id',
                      branch_id: 'branch-id',
                      transaction_date: '2026-04-18',
                      created_at: '2026-04-18T00:00:00.000Z',
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
              description: 'Missing `bank_transactions:read` scope.',
              content: jsonContent(apiErrorSchema),
            },
            '429': {
              description: 'Rate limit exceeded.',
              content: jsonContent(apiErrorSchema),
            },
          },
        },
      },
      '/contacts': {
        get: {
          tags: ['Contacts'],
          summary: 'List contacts',
          description: 'Mengembalikan daftar kontak aktif customer atau supplier, dengan filter tipe dan pencarian nama.',
          operationId: 'listContacts',
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
              name: 'type',
              in: 'query',
              required: false,
              description: 'Contact type filter.',
              schema: { type: 'string', enum: ['customer', 'supplier'] },
            },
            {
              name: 'search',
              in: 'query',
              required: false,
              description: 'Case-insensitive name search.',
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Contacts retrieved successfully.',
              content: jsonContent(
                { $ref: '#/components/schemas/ContactsListResponse' },
                {
                  success: true,
                  data: [
                    {
                      id: 'contact-id',
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
                    org_id: 'org-id',
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
              description: 'Missing `contacts:read` scope.',
              content: jsonContent(apiErrorSchema),
            },
            '429': {
              description: 'Rate limit exceeded.',
              content: jsonContent(apiErrorSchema),
            },
          },
        },
      },
      '/contacts/upsert': {
        post: {
          tags: ['Contacts'],
          summary: 'Create or update a contact',
          description: 'Membuat kontak baru atau memperbarui kontak yang sudah ada dengan aturan pencocokan berurutan: `id`, `email`, `phone_wa`, `phone`, lalu `name` pada tipe kontak yang sama.',
          operationId: 'upsertContact',
          security: [
            { ApiKeyAuth: [] },
            { BearerAuth: [] },
          ],
          requestBody: {
            required: true,
            content: jsonContent(
              { $ref: '#/components/schemas/ContactUpsertRequest' },
              {
                example: {
                  name: 'Andi Supplier',
                  type: 'SUPPLIER',
                  email: 'andi@example.com',
                  phone: '08123',
                  phone_wa: '628123',
                  instagram: '@andisupplier',
                  address: 'Jl. Supplier No. 1',
                  is_active: true,
                },
              }
            ),
          },
          responses: {
            '200': {
              description: 'Contact created or updated successfully.',
              content: jsonContent(
                { $ref: '#/components/schemas/ContactUpsertResponse' },
                {
                  success: true,
                  data: {
                    id: 'contact-id',
                    name: 'Andi Supplier',
                    email: 'andi@example.com',
                    phone: '08123',
                    phone_wa: '628123',
                    instagram: '@andisupplier',
                    address: 'Jl. Supplier No. 1',
                    type: 'SUPPLIER',
                    is_active: true,
                    created_at: '2026-04-18T00:00:00.000Z',
                    updated_at: '2026-04-18T00:00:00.000Z',
                  },
                  meta: {
                    org_id: 'org-id',
                    action: 'created',
                    matched_by: 'insert',
                  },
                }
              ),
            },
            '400': {
              description: 'Invalid JSON body or invalid contact fields.',
              content: jsonContent(apiErrorSchema),
            },
            '401': {
              description: 'Missing or invalid API key.',
              content: jsonContent(apiErrorSchema),
            },
            '403': {
              description: 'Missing `contacts:write` scope.',
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
        InventoryMovementItem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            product_id: { type: 'string', format: 'uuid' },
            product_code: { type: 'string', nullable: true },
            product_name: { type: 'string' },
            product_unit: { type: 'string', nullable: true },
            product_category: { type: 'string', nullable: true },
            movement_date: { type: 'string', format: 'date-time' },
            quantity: { type: 'number' },
            direction: { type: 'string', enum: ['in', 'out', 'neutral'] },
            unit_price: { type: 'number' },
            reference_type: { type: 'string', nullable: true },
            reference_id: { type: 'string', format: 'uuid', nullable: true },
            notes: { type: 'string', nullable: true },
            branch_id: { type: 'string', format: 'uuid', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'product_id', 'product_name', 'movement_date', 'quantity', 'direction', 'unit_price', 'created_at'],
        },
        InventoryReconciliationItem: {
          type: 'object',
          properties: {
            product_id: { type: 'string', format: 'uuid' },
            product_code: { type: 'string', nullable: true },
            product_name: { type: 'string' },
            product_unit: { type: 'string', nullable: true },
            product_category: { type: 'string', nullable: true },
            stock_qty: { type: 'number' },
            avg_cost: { type: 'number' },
            on_hand_value: { type: 'number' },
            ledger_value: { type: 'number' },
            variance: { type: 'number' },
          },
          required: ['product_id', 'product_name', 'stock_qty', 'avg_cost', 'on_hand_value', 'ledger_value', 'variance'],
        },
        GeneralLedgerLineItem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            account_id: { type: 'string', format: 'uuid', nullable: true },
            account_code: { type: 'string', nullable: true },
            account_name: { type: 'string', nullable: true },
            account_type: { type: 'string', nullable: true },
            debit: { type: 'number' },
            credit: { type: 'number' },
            memo: { type: 'string', nullable: true },
          },
          required: ['id', 'debit', 'credit'],
        },
        GeneralLedgerEntry: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            entry_number: { type: 'string', nullable: true },
            entry_date: { type: 'string', format: 'date' },
            description: { type: 'string', nullable: true },
            reference_type: { type: 'string', nullable: true },
            reference_id: { type: 'string', format: 'uuid', nullable: true },
            status: { type: 'string', nullable: true },
            notes: { type: 'string', nullable: true },
            posted_at: { type: 'string', format: 'date-time', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
            branch_id: { type: 'string', format: 'uuid', nullable: true },
            total_debit: { type: 'number' },
            total_credit: { type: 'number' },
            journal_lines: {
              type: 'array',
              items: { $ref: '#/components/schemas/GeneralLedgerLineItem' },
            },
          },
          required: ['id', 'entry_date', 'created_at', 'total_debit', 'total_credit', 'journal_lines'],
        },
        SalesItem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            so_number: { type: 'string', nullable: true },
            customer_name: { type: 'string', nullable: true },
            total_amount: { type: 'number' },
            status: { type: 'string', nullable: true },
            branch_id: { type: 'string', format: 'uuid', nullable: true },
            order_date: { type: 'string', format: 'date', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'total_amount', 'created_at'],
        },
        SalesDetailLineItem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            product_id: { type: 'string', format: 'uuid', nullable: true },
            description: { type: 'string', nullable: true },
            quantity: { type: 'number' },
            unit_price: { type: 'number' },
            discount_amount: { type: 'number' },
            tax_amount: { type: 'number' },
            total_amount: { type: 'number' },
            branch_id: { type: 'string', format: 'uuid', nullable: true },
            product_name: { type: 'string', nullable: true },
            sku: { type: 'string', nullable: true },
            unit: { type: 'string', nullable: true },
            product_type: { type: 'string', nullable: true },
          },
          required: ['id', 'quantity', 'unit_price', 'discount_amount', 'tax_amount', 'total_amount'],
        },
        SalesPaymentItem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            account_id: { type: 'string', format: 'uuid', nullable: true },
            account_code: { type: 'string', nullable: true },
            account_name: { type: 'string', nullable: true },
            payment_date: { type: 'string', format: 'date', nullable: true },
            amount: { type: 'number' },
            discount_amount: { type: 'number' },
            payment_number: { type: 'string', nullable: true },
            notes: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'amount', 'discount_amount', 'created_at'],
        },
        SalesReturnItem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            return_number: { type: 'string', nullable: true },
            return_date: { type: 'string', format: 'date', nullable: true },
            total_amount: { type: 'number' },
            tax_amount: { type: 'number' },
            grand_total: { type: 'number' },
            status: { type: 'string', nullable: true },
            notes: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'total_amount', 'tax_amount', 'grand_total', 'created_at'],
        },
        SalesDetail: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            so_number: { type: 'string', nullable: true },
            customer_id: { type: 'string', format: 'uuid', nullable: true },
            customer_name: { type: 'string', nullable: true },
            total_amount: { type: 'number' },
            tax_amount: { type: 'number' },
            discount_amount: { type: 'number' },
            grand_total: { type: 'number' },
            status: { type: 'string', nullable: true },
            payment_status: { type: 'string', nullable: true },
            branch_id: { type: 'string', format: 'uuid', nullable: true },
            branch_name: { type: 'string', nullable: true },
            warehouse_id: { type: 'string', format: 'uuid', nullable: true },
            warehouse_name: { type: 'string', nullable: true },
            order_date: { type: 'string', format: 'date', nullable: true },
            due_date: { type: 'string', format: 'date', nullable: true },
            notes: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
            items: {
              type: 'array',
              items: { $ref: '#/components/schemas/SalesDetailLineItem' },
            },
            payments: {
              type: 'array',
              items: { $ref: '#/components/schemas/SalesPaymentItem' },
            },
            returns: {
              type: 'array',
              items: { $ref: '#/components/schemas/SalesReturnItem' },
            },
          },
          required: ['id', 'total_amount', 'tax_amount', 'discount_amount', 'grand_total', 'created_at', 'updated_at', 'items', 'payments', 'returns'],
        },
        PurchaseListItem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            po_number: { type: 'string', nullable: true },
            vendor_name: { type: 'string', nullable: true },
            total_amount: { type: 'number' },
            status: { type: 'string', nullable: true },
            payment_status: { type: 'string', nullable: true },
            branch_id: { type: 'string', format: 'uuid', nullable: true },
            purchase_date: { type: 'string', format: 'date', nullable: true },
            due_date: { type: 'string', format: 'date', nullable: true },
            item_count: { type: 'number' },
            created_at: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'total_amount', 'item_count', 'created_at'],
        },
        BankTransactionItem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            bank_account_id: { type: 'string', format: 'uuid', nullable: true },
            cash_account_id: { type: 'string', format: 'uuid', nullable: true },
            cash_account_code: { type: 'string', nullable: true },
            cash_account_name: { type: 'string', nullable: true },
            bank_name: { type: 'string', nullable: true },
            account_number: { type: 'string', nullable: true },
            description: { type: 'string', nullable: true },
            amount: { type: 'number' },
            type: { type: 'string', nullable: true, enum: ['in', 'out'] },
            reference_number: { type: 'string', nullable: true },
            status: { type: 'string', nullable: true },
            category_id: { type: 'string', format: 'uuid', nullable: true },
            category_code: { type: 'string', nullable: true },
            category_name: { type: 'string', nullable: true },
            journal_entry_id: { type: 'string', format: 'uuid', nullable: true },
            branch_id: { type: 'string', format: 'uuid', nullable: true },
            transaction_date: { type: 'string', format: 'date', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'amount', 'created_at'],
        },
        ContactItem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            email: { type: 'string', nullable: true },
            phone: { type: 'string', nullable: true },
            phone_wa: { type: 'string', nullable: true },
            instagram: { type: 'string', nullable: true },
            address: { type: 'string', nullable: true },
            type: { type: 'string', nullable: true },
            is_active: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time', nullable: true },
          },
          required: ['id', 'name', 'is_active', 'created_at'],
        },
        ContactUpsertRequest: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', nullable: true, description: 'ID kontak jika ingin memaksa prioritas match ke row tertentu.' },
            name: { type: 'string' },
            type: { type: 'string', enum: ['CUSTOMER', 'SUPPLIER'] },
            email: { type: 'string', nullable: true },
            phone: { type: 'string', nullable: true },
            phone_wa: { type: 'string', nullable: true },
            instagram: { type: 'string', nullable: true },
            address: { type: 'string', nullable: true },
            is_active: { type: 'boolean', nullable: true },
          },
          required: ['name', 'type'],
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
            action: { type: 'string', enum: ['created', 'updated'] },
            matched_by: { type: 'string', enum: ['id', 'email', 'phone_wa', 'phone', 'name', 'insert', 'unknown'] },
          },
        },
        InventoryReconciliationResponseMeta: {
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
            as_of_date: { type: 'string', format: 'date', nullable: true },
            on_hand_value: { type: 'number' },
            gl_inventory_balance: { type: 'number' },
            inventory_variance: { type: 'number' },
            valuation_method: { type: 'string' },
            gl_account_range: { type: 'string' },
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
        InventoryMovementListResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', const: true },
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/InventoryMovementItem' },
            },
            meta: { $ref: '#/components/schemas/ResponseMeta' },
          },
          required: ['success', 'data'],
        },
        InventoryReconciliationListResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', const: true },
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/InventoryReconciliationItem' },
            },
            meta: { $ref: '#/components/schemas/InventoryReconciliationResponseMeta' },
          },
          required: ['success', 'data'],
        },
        GeneralLedgerListResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', const: true },
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/GeneralLedgerEntry' },
            },
            meta: { $ref: '#/components/schemas/ResponseMeta' },
          },
          required: ['success', 'data'],
        },
        SalesListResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', const: true },
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/SalesItem' },
            },
            meta: { $ref: '#/components/schemas/ResponseMeta' },
          },
          required: ['success', 'data'],
        },
        SalesDetailResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', const: true },
            data: { $ref: '#/components/schemas/SalesDetail' },
            meta: { $ref: '#/components/schemas/ResponseMeta' },
          },
          required: ['success', 'data'],
        },
        PurchaseListResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', const: true },
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/PurchaseListItem' },
            },
            meta: { $ref: '#/components/schemas/ResponseMeta' },
          },
          required: ['success', 'data'],
        },
        BankTransactionListResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', const: true },
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/BankTransactionItem' },
            },
            meta: { $ref: '#/components/schemas/ResponseMeta' },
          },
          required: ['success', 'data'],
        },
        ContactsListResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', const: true },
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/ContactItem' },
            },
            meta: { $ref: '#/components/schemas/ResponseMeta' },
          },
          required: ['success', 'data'],
        },
        ContactUpsertResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', const: true },
            data: { $ref: '#/components/schemas/ContactItem' },
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
            idempotency_key: {
              type: 'string',
              description: 'Kunci idempotensi alternatif di body request. Bila juga mengirim header `Idempotency-Key`, nilainya harus sama.',
            },
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
