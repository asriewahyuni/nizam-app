/**
 * PostgreSQL-native query adapter that mimics the Supabase JS SDK interface.
 *
 * Digunakan di internal auth mode agar semua query data (org_members, organizations, dll.)
 * diarahkan langsung ke PostgreSQL Railway, bukan ke Supabase Cloud.
 *
 * Interface yang disupport:
 *   db.from(table).select(cols).eq(col, val).neq(col, val).in(col, [...])
 *      .order(col, {ascending}).limit(n).maybeSingle() / .single() / await
 *   db.from(table).insert(payload)
 *   db.from(table).update(payload).eq(...)
 *   db.from(table).delete().eq(...)
 *   db.from(table).upsert(payload, options)
 *   db.rpc(fnName, params)
 *
 * Keterbatasan:
 *   - Nested select (e.g., 'org_members(*, organizations(*))')  tidak didukung penuh.
 *     Diimplementasikan dengan JOIN / subquery otomatis untuk pola yang paling umum.
 *   - RPC menjalankan SELECT fn(params) dan mengembalikan hasil pertama.
 */

import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { connectPostgresClient, queryPostgres } from './postgres'

// ─── FK constraint cache (fetched once from information_schema) ──────────────
// Maps: "sourceTable.sourceCol" → "targetTable"
// Example: "org_members.org_id" → "organizations"
const _fkCache = new Map<string, string>()
let _fkCacheLoaded = false

async function loadFkCache(): Promise<void> {
  if (_fkCacheLoaded) return
  try {
    const result = await queryPostgres<{
      table_name: string
      column_name: string
      ref_table: string
    }>(`
      SELECT
        kcu.table_name,
        kcu.column_name,
        ccu.table_name AS ref_table
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = tc.constraint_name
        AND kcu.table_schema = tc.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
    `)
    for (const row of result.rows) {
      _fkCache.set(`${row.table_name}.${row.column_name}`, row.ref_table)
    }
    _fkCacheLoaded = true
  } catch {
    // If FK lookup fails, fall back to naming conventions
    _fkCacheLoaded = true
  }
}


// ─── Types ───────────────────────────────────────────────────────────────────

type WhereClause = {
  type: 'eq' | 'neq' | 'in' | 'is' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'notnull' | 'notin'
  column: string
  value: unknown
}

/**
 * Parses a Supabase/PostgREST OR filter string into a SQL OR expression.
 * Format: 'col.op.val,col.op.val' → '(col op val OR col op val)'
 *
 * Examples:
 *   'void_reason.is.null,void_reason.neq.HARD_DELETE_HIDDEN'
 *   → '("void_reason" IS NULL OR "void_reason" != \'HARD_DELETE_HIDDEN\')'
 *
 *   'branch_id.eq.abc-123,branch_id.is.null'
 *   → '("branch_id" = \'abc-123\' OR "branch_id" IS NULL)'
 *
 *   'job_title.ilike.%sopir%,job_title.ilike.%driver%'
 *   → '("job_title" ILIKE \'%sopir%\' OR "job_title" ILIKE \'%driver%\')'
 */
function parseSupabaseOrFilter(filters: string): string {
  if (!filters) return ''

  // Split by top-level commas (not inside parentheses)
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const ch of filters) {
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    if (ch === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) parts.push(current.trim())

  const clauses = parts.map((part) => {
    // Format: column.operator.value  (value may contain dots)
    const firstDot = part.indexOf('.')
    if (firstDot === -1) return null
    const col = part.slice(0, firstDot)
    const rest = part.slice(firstDot + 1)
    const secondDot = rest.indexOf('.')
    if (secondDot === -1) return null
    const op = rest.slice(0, secondDot).toLowerCase()
    const val = rest.slice(secondDot + 1)

    const quotedCol = `"${col.replace(/"/g, '""')}"`

    if (op === 'is') {
      if (val === 'null') return `${quotedCol} IS NULL`
      if (val === 'not.null' || val === 'notnull') return `${quotedCol} IS NOT NULL`
      return `${quotedCol} IS ${val.toUpperCase()}`
    }
    // Escape single quotes in value
    const escaped = val.replace(/'/g, "''")
    if (op === 'eq') return `${quotedCol} = '${escaped}'`
    if (op === 'neq') return `${quotedCol} != '${escaped}'`
    if (op === 'gt') return `${quotedCol} > '${escaped}'`
    if (op === 'gte') return `${quotedCol} >= '${escaped}'`
    if (op === 'lt') return `${quotedCol} < '${escaped}'`
    if (op === 'lte') return `${quotedCol} <= '${escaped}'`
    if (op === 'like') return `${quotedCol} LIKE '${escaped}'`
    if (op === 'ilike') return `${quotedCol} ILIKE '${escaped}'`
    return null
  }).filter(Boolean)

  if (clauses.length === 0) return ''
  if (clauses.length === 1) return `(${clauses[0]})`
  return `(${clauses.join(' OR ')})`
}

type OrderClause = {
  column: string
  ascending: boolean
  nullsFirst?: boolean
}

type QueryResult = {
  data: unknown
  error: { message: string; code?: string } | null
  count?: number | null
}

// ─── Top-level comma split (respects parentheses nesting) ────────────────────

/**
 * Splits a Supabase select string by commas at depth=0 only.
 * Example: 'id, account:accounts(id, name, type), branch:branches(name)'
 * → ['id', 'account:accounts(id, name, type)', 'branch:branches(name)']
 */
function splitTopLevel(str: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const ch of str) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

// ─── Query builder ───────────────────────────────────────────────────────────

class PostgresQueryBuilder {
  private _table: string
  private _select: string | null = null
  private _where: WhereClause[] = []
  private _order: OrderClause[] = []
  private _limit: number | null = null
  private _operation: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'
  private _payload: Record<string, unknown> | Record<string, unknown>[] | null = null
  private _upsertOptions: Record<string, unknown> | null = null
  private _countMode: 'exact' | 'estimated' | null = null
  private _headOnly = false
  // Raw OR clause strings (already SQL-safe, appended to WHERE as AND (clause1 OR clause2))
  private _orRawClauses: string[] = []

  constructor(table: string) {
    this._table = table
  }

  select(columns?: string, options?: { count?: 'exact' | 'estimated'; head?: boolean }) {
    if (!['insert', 'update', 'upsert', 'delete'].includes(this._operation)) {
      this._operation = 'select'
    }
    this._select = columns ?? '*'
    if (options?.count) this._countMode = options.count
    if (options?.head) this._headOnly = true
    return this
  }

  insert(payload: Record<string, unknown> | Record<string, unknown>[]) {
    this._operation = 'insert'
    this._payload = payload
    return this
  }

  update(payload: Record<string, unknown>) {
    this._operation = 'update'
    this._payload = payload
    return this
  }

  upsert(payload: Record<string, unknown> | Record<string, unknown>[], options?: Record<string, unknown>) {
    this._operation = 'upsert'
    this._payload = payload
    this._upsertOptions = options ?? null
    return this
  }

  delete() {
    this._operation = 'delete'
    return this
  }

  eq(column: string, value: unknown) {
    this._where.push({ type: 'eq', column, value })
    return this
  }

  neq(column: string, value: unknown) {
    this._where.push({ type: 'neq', column, value })
    return this
  }

  in(column: string, values: unknown[]) {
    this._where.push({ type: 'in', column, value: values })
    return this
  }

  is(column: string, value: unknown) {
    this._where.push({ type: 'is', column, value })
    return this
  }

  gt(column: string, value: unknown) {
    this._where.push({ type: 'gt', column, value })
    return this
  }

  gte(column: string, value: unknown) {
    this._where.push({ type: 'gte', column, value })
    return this
  }

  lt(column: string, value: unknown) {
    this._where.push({ type: 'lt', column, value })
    return this
  }

  lte(column: string, value: unknown) {
    this._where.push({ type: 'lte', column, value })
    return this
  }

  like(column: string, value: unknown) {
    this._where.push({ type: 'like', column, value })
    return this
  }

  ilike(column: string, value: unknown) {
    this._where.push({ type: 'ilike', column, value })
    return this
  }

  /**
   * Supabase .or() filter — parses PostgREST filter string:
   * 'col.op.val,col.op.val' → AND (col op val OR col op val)
   *
   * Supported ops: eq, neq, gt, gte, lt, lte, is, ilike, like
   * Special: is.null → IS NULL, is.not.null → IS NOT NULL
   *
   * The `options.foreignTable` form (for embedded filters) is handled
   * as a no-op — columns are qualified by name only.
   */
  or(filters: string, _options?: { foreignTable?: string }) {
    const sql = parseSupabaseOrFilter(filters)
    if (sql) this._orRawClauses.push(sql)
    return this
  }

  /**
   * Supabase .not() filter: .not(column, operator, value)
   * e.g. .not('status', 'in', '("DRAFT","VOIDED")')  → status NOT IN ('DRAFT','VOIDED')
   *      .not('status', 'eq', 'CANCELLED')             → status != 'CANCELLED'
   *      .not('user_id', 'is', null)                   → user_id IS NOT NULL
   */
  /**
   * Supabase .not() filter: .not(column, operator, value)
   * e.g. .not('status', 'in', '("DRAFT","VOIDED")')  → status NOT IN ('DRAFT','VOIDED')
   *      .not('status', 'eq', 'CANCELLED')             → status != 'CANCELLED'
   *      .not('user_id', 'is', null)                   → user_id IS NOT NULL
   */
  not(column: string, operator: string, value: unknown) {
    const op = String(operator || '').toLowerCase()
    if (op === 'is' && (value === null || value === 'null')) {
      this._where.push({ type: 'notnull', column, value: null })
      return this
    }
    if (op === 'in') {
      const raw = String(value || '').trim().replace(/^[(]|[)]$/g, '')
      const items = raw.split(',').map((s) => { const t = s.trim(); return t.replace(/^["']/, '').replace(/["']$/, '') })
      this._where.push({ type: 'notin', column, value: items })
      return this
    }
    if (op === 'eq') {
      this._where.push({ type: 'neq', column, value })
      return this
    }
    if (op === 'neq') {
      this._where.push({ type: 'eq', column, value })
      return this
    }
    this._where.push({ type: 'neq', column, value })
    return this
  }

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    this._order.push({
      column,
      ascending: options?.ascending !== false,
      nullsFirst: options?.nullsFirst,
    })
    return this
  }

  limit(count: number) {
    this._limit = count
    return this
  }

  async maybeSingle(): Promise<QueryResult> {
    this._limit = 1
    const result = await this._execute()
    if ('error' in result && result.error) return { data: null, error: result.error }
    const rows = Array.isArray(result.data) ? result.data : []
    return { data: rows[0] ?? null, error: null }
  }

  async single(): Promise<QueryResult> {
    this._limit = 1
    const result = await this._execute()
    if ('error' in result && result.error) return { data: null, error: result.error }
    const rows = Array.isArray(result.data) ? result.data : []
    if (rows.length === 0) return { data: null, error: { message: 'No rows found', code: 'PGRST116' } }
    return { data: rows[0], error: null }
  }

  then<TResult1 = QueryResult>(
    onfulfilled: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null | undefined
  ): Promise<TResult1> {
    return this._execute().then(onfulfilled as any) as Promise<TResult1>
  }

  // ── Internal SQL builder ──────────────────────────────────────────────────

  private _buildWhere(params: unknown[], startIdx: number): string {
    if (this._where.length === 0) return ''
    const clauses = this._where.map((w) => {
      const col = `"${w.column.replace(/"/g, '""')}"`
      if (w.type === 'in') {
        const vals = (w.value as unknown[]).map(() => {
          params.push(w.value)
          return `$${startIdx + params.length}` // will be reassigned below
        })
        // Rebuild properly:
        params.length = startIdx // reset
        const inVals = (w.value as unknown[]).map((v) => {
          params.push(v)
          return `$${params.length}`
        })
        return `${col} = ANY($${params.length}::uuid[])`
      }
      params.push(w.value)
      const placeholder = `$${params.length}`
      if (w.type === 'eq') return `${col} = ${placeholder}`
      if (w.type === 'neq') return `${col} != ${placeholder}`
      if (w.type === 'is') return w.value === null ? `${col} IS NULL` : `${col} = ${placeholder}`
      if (w.type === 'gt') return `${col} > ${placeholder}`
      if (w.type === 'gte') return `${col} >= ${placeholder}`
      if (w.type === 'lt') return `${col} < ${placeholder}`
      if (w.type === 'lte') return `${col} <= ${placeholder}`
      if (w.type === 'like') return `${col} LIKE ${placeholder}`
      if (w.type === 'ilike') return `${col} ILIKE ${placeholder}`
      return `${col} = ${placeholder}`
    })
    return `WHERE ${clauses.join(' AND ')}`
  }

  private _buildOrder(): string {
    if (this._order.length === 0) return ''
    return `ORDER BY ${this._order.map((o) => {
      const col = `"${o.column.replace(/"/g, '""')}"`
      const dir = o.ascending ? 'ASC' : 'DESC'
      const nulls = o.nullsFirst === true ? 'NULLS FIRST' : o.nullsFirst === false ? 'NULLS LAST' : ''
      return `${col} ${dir} ${nulls}`.trim()
    }).join(', ')}`
  }

  private async _execute(): Promise<QueryResult> {
    try {
      const params: unknown[] = []
      const table = `public."${this._table.replace(/"/g, '""')}"`

      if (this._operation === 'select') {
        return await this._executeSelect(table, params)
      }

      if (this._operation === 'insert') {
        return await this._executeInsert(table, params)
      }

      if (this._operation === 'update') {
        return await this._executeUpdate(table, params)
      }

      if (this._operation === 'upsert') {
        return await this._executeUpsert(table, params)
      }

      if (this._operation === 'delete') {
        return await this._executeDelete(table, params)
      }

      return { data: null, error: { message: 'Unknown operation' } }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const code = (err as any)?.code
      return { data: null, error: { message, code } }
    }
  }

  private async _executeSelect(table: string, params: unknown[]): Promise<QueryResult> {
    // Untuk select sederhana tanpa nested join, kita cukup SELECT * FROM table WHERE ...
    // Nested relations (misal 'organizations(*)' atau 'account:accounts(id,name)') di-handle sebagai JOIN terpisah
    let selectExpr = '*'
    const nestedRelations: string[] = []

    if (this._select && this._select !== '*') {
      // Split by top-level commas only (not inside parentheses)
      const parts = splitTopLevel(this._select)
      const simpleCols: string[] = []
      for (const part of parts) {
        if (part.includes('(')) {
          nestedRelations.push(part)
        } else {
          simpleCols.push(part)
        }
      }
      selectExpr = simpleCols.length > 0 ? simpleCols.join(', ') : '*'
    }

    const whereClause = this._buildWhereSimple(params)
    const orderClause = this._buildOrder()
    const limitClause = this._limit !== null ? `LIMIT ${this._limit}` : ''

    if (this._headOnly && this._countMode) {
      const countSql = `SELECT COUNT(*) as "_count" FROM ${table} ${whereClause}`
      const countResult = await queryPostgres<{ _count: string }>(countSql, params)
      return { data: null, error: null, count: parseInt(countResult.rows[0]?._count ?? '0', 10) }
    }

    const sql = `SELECT ${selectExpr} FROM ${table} ${whereClause} ${orderClause} ${limitClause}`.trim()
    const result = await queryPostgres<Record<string, unknown>>(sql, params)
    let rows: Record<string, unknown>[] = result.rows

    // Proses nested relation dengan query tambahan
    if (nestedRelations.length > 0 && rows.length > 0) {
      rows = await this._resolveNestedRelations(rows, nestedRelations)
    }

    if (this._countMode === 'exact') {
      const countSql = `SELECT COUNT(*) as "_count" FROM ${table} ${whereClause}`
      const countResult = await queryPostgres<{ _count: string }>(countSql, params)
      return {
        data: rows,
        error: null,
        count: parseInt(countResult.rows[0]?._count ?? '0', 10),
      }
    }

    return { data: rows, error: null }
  }

  private _normalizeSelectedColumn(column: string): string {
    return column.trim().replace(/^"+|"+$/g, '')
  }

  private _mergeSelectColumns(selectExpr: string, requiredColumns: string[]): string {
    if (selectExpr === '*') return '*'

    const columns = new Set(
      splitTopLevel(selectExpr)
        .map((column) => this._normalizeSelectedColumn(column))
        .filter(Boolean)
    )

    for (const column of requiredColumns) {
      const normalized = this._normalizeSelectedColumn(column)
      if (normalized) columns.add(normalized)
    }

    return Array.from(columns).join(', ')
  }

  private async _collectSupportColumnsForSubRelations(
    baseTable: string,
    subRelations: string[]
  ): Promise<string[]> {
    if (subRelations.length === 0) return []

    await loadFkCache()

    const requiredColumns = new Set<string>()

    for (const subRel of subRelations) {
      const aliasMatch = subRel.match(/^(\w+):([\w!]+)\(([\s\S]*)\)$/)
      const simpleMatch = subRel.match(/^([\w!]+)\(([\s\S]*)\)$/)
      if (!aliasMatch && !simpleMatch) continue

      const aliasRaw = aliasMatch ? aliasMatch[1] : simpleMatch![1]
      const relTableRaw = aliasMatch ? aliasMatch[2] : simpleMatch![1]
      const alias = aliasRaw.split('!')[0]
      const relTable = relTableRaw.split('!')[0]

      // Alias-based fallback tetap dipakai karena banyak query mengikuti pola branch -> branch_id, product -> product_id.
      requiredColumns.add(`${alias}_id`)

      for (const [key, value] of _fkCache.entries()) {
        if (!key.startsWith(baseTable + '.') || value !== relTable) continue
        requiredColumns.add(key.split('.')[1])
      }
    }

    return Array.from(requiredColumns)
  }

  /**
   * Resolusi nested relations menggunakan FK constraint dari PostgreSQL information_schema.
   *
   * Contoh select: 'org_id, organizations(*), roles(permissions)'
   * → query org_members, lalu join organizations via FK org_members.org_id → organizations.id
   *
   * Strategy:
   * 1. Load FK constraints dari DB (cached, sekali per process)
   * 2. Cari kolom di current row yang FK-nya mengarah ke relTable
   * 3. Fallback ke naming convention jika FK tidak ditemukan
   */
  private async _resolveNestedRelations(
    rows: Record<string, unknown>[],
    relations: string[]
  ): Promise<Record<string, unknown>[]> {
    await loadFkCache()

    for (const rel of relations) {
      // Handle both formats:
      //   table(cols)          → alias=table, realTable=table
      //   alias:table(cols)    → alias=alias, realTable=table
      const aliasMatch = rel.match(/^(\w+):([\w!]+)\(([\s\S]*)\)$/)
      const simpleMatch = rel.match(/^([\w!]+)\(([\s\S]*)\)$/)
      if (!aliasMatch && !simpleMatch) continue

      const aliasRaw = aliasMatch ? aliasMatch[1] : simpleMatch![1]
      const relTableRaw = aliasMatch ? aliasMatch[2] : simpleMatch![1]
      const relCols = aliasMatch ? aliasMatch[3] : simpleMatch![2]

      const alias = aliasRaw.split('!')[0]
      const relTable = relTableRaw.split('!')[0]
      // fkHint is ignored in this simple adapter, but we successfully extract the real table name.

      // Isolate nested sub-relations to resolve them recursively later.
      const topLevelParts = relCols.trim() === '*' ? [] : splitTopLevel(relCols)
      const subRelations = topLevelParts.filter((p) => p.includes('('))
      const flatRelCols = relCols.trim() === '*'
        ? '*'
        : topLevelParts.filter((p) => !p.includes('(')).join(', ') || '*'
      
      const relColExpr = flatRelCols
      const relTableQ = `public."${relTable.replace(/"/g, '""')}"`
      const subRelationSupportCols = await this._collectSupportColumnsForSubRelations(relTable, subRelations)

      // --- Custom Strategy for specific FK column mapping (fallback when FK cache misses) ---
      // For instance, purchases -> contacts uses contact_id, but the alias might be 'vendor'
      let explicitFkColName: string | null = null
      if (this._table === 'purchases' && relTable === 'contacts') {
        explicitFkColName = 'vendor_id'
      }

      try {
        // Strategy 1: use FK cache — find column in current table that points to relTable
        const fkCol = (() => {
          if (explicitFkColName && rows.length > 0 && explicitFkColName in rows[0]) return explicitFkColName
          if (rows.length === 0) return null
          const sampleRow = rows[0]

          // 1a. Try alias_id first (e.g., alias='account' → check 'account_id')
          const aliasIdCol = alias + '_id'
          if (aliasIdCol in sampleRow) return aliasIdCol

          // 1b. Check all _id columns against FK cache
          for (const col of Object.keys(sampleRow)) {
            if (!col.endsWith('_id')) continue
            const cachedRef = _fkCache.get(this._table + '.' + col)
            if (cachedRef === relTable) return col
          }
          return null
        })()

        if (fkCol) {
          const foreignIds = Array.from(new Set(rows.map((row) => row[fkCol]).filter((v) => v != null)))
          if (foreignIds.length > 0) {
            // Always include 'id' in SELECT so relById map keys are populated
            const idSelectExpr = relColExpr === '*'
              ? '*'
              : this._mergeSelectColumns(relColExpr, ['id', ...subRelationSupportCols])
            let relResultRows = (await queryPostgres<Record<string, unknown>>(
              'SELECT ' + idSelectExpr + ' FROM ' + relTableQ + ' WHERE id = ANY($1::uuid[])',
              [foreignIds]
            )).rows
            
            if (subRelations.length > 0 && relResultRows.length > 0) {
              const subBuilder = new PostgresQueryBuilder(relTable)
              relResultRows = await subBuilder._resolveNestedRelations(relResultRows, subRelations)
            }
            
            const relById = new Map(relResultRows.map((r) => [String(r.id), r]))
            // Use alias as the key in the result row
            rows = rows.map((row) => ({ ...row, [alias]: relById.get(String(row[fkCol] ?? '')) ?? null }))
            continue
          }
        }

        // Strategy 2: naming convention fallback
        const candidates = [
          relTable + '_id',                                                         // organizations_id
          (relTable.endsWith('s') ? relTable.slice(0, -1) : relTable) + '_id',     // organization_id
        ]
        let resolved = false
        for (const fk of candidates) {
          if (rows.some((row) => fk in row)) {
            const foreignIds = Array.from(new Set(rows.map((row) => row[fk]).filter((v) => v != null)))
            if (foreignIds.length > 0) {
              // Always include 'id' in SELECT so relById map keys are populated
              const idSelectExpr2 = relColExpr === '*'
                ? '*'
                : this._mergeSelectColumns(relColExpr, ['id', ...subRelationSupportCols])
              let relResultRows = (await queryPostgres<Record<string, unknown>>(
                'SELECT ' + idSelectExpr2 + ' FROM ' + relTableQ + ' WHERE id = ANY($1::uuid[])',
                [foreignIds]
              )).rows

              if (subRelations.length > 0 && relResultRows.length > 0) {
                const subBuilder = new PostgresQueryBuilder(relTable)
                relResultRows = await subBuilder._resolveNestedRelations(relResultRows, subRelations)
              }
              
              const relById = new Map(relResultRows.map((r) => [String(r.id), r]))
              // Use alias as the key
              rows = rows.map((row) => ({ ...row, [alias]: relById.get(String(row[fk] ?? '')) ?? null }))
              resolved = true
              break
            }
          }
        }
        if (resolved) continue

        // Strategy 3: backref — relTable has FK pointing to current table
        const tableSingular = this._table.endsWith('s') ? this._table.slice(0, -1) : this._table
        const backRefColFromCache = (() => {
          for (const [key, val] of _fkCache.entries()) {
            if (key.startsWith(relTable + '.') && val === this._table) {
              return key.split('.')[1]
            }
          }
          return tableSingular + '_id'
        })()

        const parentIds = Array.from(new Set(rows.map((row) => row.id).filter((v) => v != null)))
        if (parentIds.length > 0) {
          try {
            // Ensure the backref column (e.g. purchase_id) is always included in SELECT
            // so we can use it as the grouping key. Without it, r[backRefColFromCache] is
            // undefined and all rows end up grouped under the empty-string key.
            const backRefColQ = `"${backRefColFromCache.replace(/"/g, '""')}"`
            const backRefSelectExpr = relColExpr === '*'
              ? '*'
              : this._mergeSelectColumns(relColExpr, [backRefColFromCache, ...subRelationSupportCols])

            let relResultRows = (await queryPostgres<Record<string, unknown>>(
              'SELECT ' + backRefSelectExpr + ' FROM ' + relTableQ + ' WHERE ' + backRefColQ + ' = ANY($1::uuid[])',
              [parentIds]
            )).rows
            
            if (subRelations.length > 0 && relResultRows.length > 0) {
              const subBuilder = new PostgresQueryBuilder(relTable)
              relResultRows = await subBuilder._resolveNestedRelations(relResultRows, subRelations)
            }

            const grouped: Record<string, unknown[]> = {}
            for (const r of relResultRows) {
              const parentId = String(r[backRefColFromCache] ?? '')
              if (!grouped[parentId]) grouped[parentId] = []
              grouped[parentId].push(r)
            }
            // Use alias as the key
            rows = rows.map((row) => ({ ...row, [alias]: grouped[String(row.id ?? '')] ?? [] }))
          } catch {
            rows = rows.map((row) => ({ ...row, [alias]: null }))
          }
        }
      } catch {
        rows = rows.map((row) => ({ ...row, [alias]: null }))
      }
    }
    return rows
  }

  // Serialize a payload value for a PostgreSQL parameterized query.
  // - Primitive arrays (string[], uuid[], etc.) → kept as JS array so pg binds them as
  //   PostgreSQL array literals ({item1,item2}) for text[]/uuid[] columns.
  // - Structured arrays (array of objects/arrays) → JSON.stringify for jsonb columns.
  // - Plain objects → JSON.stringify for jsonb columns.
  private _serializeDbParam(value: unknown): unknown {
    if (value == null) return null
    if (value instanceof Date) return value.toISOString()
    if (Buffer.isBuffer(value)) return value
    if (Array.isArray(value)) {
      const normalized = value.map((item) => item instanceof Date ? item.toISOString() : item)
      const hasStructured = normalized.some(
        (item) => Array.isArray(item) || (item !== null && typeof item === 'object')
      )
      return hasStructured ? JSON.stringify(normalized) : normalized
    }
    if (typeof value === 'object') return JSON.stringify(value)
    return value
  }

  private async _executeInsert(table: string, params: unknown[]): Promise<QueryResult> {
    const payloads = Array.isArray(this._payload) ? this._payload : [this._payload!]
    if (payloads.length === 0) return { data: [], error: null }

    const allKeys = [...new Set(payloads.flatMap((p) => Object.keys(p as Record<string, unknown>)))]
    const cols = allKeys.map((k) => `"${k.replace(/"/g, '""')}"`)

    const valueSets = payloads.map((p) => {
      const vals = allKeys.map((k) => {
        params.push(this._serializeDbParam((p as Record<string, unknown>)[k] ?? null))
        return `$${params.length}`
      })
      return `(${vals.join(', ')})`
    })

    const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES ${valueSets.join(', ')} RETURNING *`
    const result = await queryPostgres<Record<string, unknown>>(sql, params)
    return { data: result.rows, error: null }
  }

  private async _executeUpdate(table: string, params: unknown[]): Promise<QueryResult> {
    const payload = this._payload as Record<string, unknown>
    if (!payload || Object.keys(payload).length === 0) {
      return { data: null, error: { message: 'Update payload is empty' } }
    }

    const setClauses = Object.entries(payload).map(([k, v]) => {
      params.push(this._serializeDbParam(v))
      return `"${k.replace(/"/g, '""')}" = $${params.length}`
    })

    const whereClause = this._buildWhereSimple(params)
    const sql = `UPDATE ${table} SET ${setClauses.join(', ')} ${whereClause} RETURNING *`
    const result = await queryPostgres<Record<string, unknown>>(sql, params)
    return { data: result.rows, error: null }
  }

  private async _executeUpsert(table: string, params: unknown[]): Promise<QueryResult> {
    const payloads = Array.isArray(this._payload) ? this._payload : [this._payload!]
    if (payloads.length === 0) return { data: [], error: null }

    const allKeys = [...new Set(payloads.flatMap((p) => Object.keys(p as Record<string, unknown>)))]
    const cols = allKeys.map((k) => `"${k.replace(/"/g, '""')}"`)

    const valueSets = payloads.map((p) => {
      const vals = allKeys.map((k) => {
        params.push(this._serializeDbParam((p as Record<string, unknown>)[k] ?? null))
        return `$${params.length}`
      })
      return `(${vals.join(', ')})`
    })

    const onConflict = this._upsertOptions?.onConflict
      ? `(${String(this._upsertOptions.onConflict)})`
      : '(id)'
    const nonIdCols = allKeys.filter((k) => k !== 'id')
    const updateSet = nonIdCols.length > 0
      ? `DO UPDATE SET ${nonIdCols.map((k) => `"${k}" = EXCLUDED."${k}"`).join(', ')}`
      : 'DO NOTHING'

    const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES ${valueSets.join(', ')} ON CONFLICT ${onConflict} ${updateSet} RETURNING *`
    const result = await queryPostgres<Record<string, unknown>>(sql, params)
    return { data: result.rows, error: null }
  }

  private async _executeDelete(table: string, params: unknown[]): Promise<QueryResult> {
    const whereClause = this._buildWhereSimple(params)
    if (!whereClause) {
      return { data: null, error: { message: 'Delete without WHERE is not allowed' } }
    }
    const sql = `DELETE FROM ${table} ${whereClause} RETURNING *`
    const result = await queryPostgres<Record<string, unknown>>(sql, params)
    return { data: result.rows, error: null }
  }

  private _buildWhereSimple(params: unknown[]): string {
    const andClauses: string[] = []

    for (const w of this._where) {
      const col = `"${w.column.replace(/"/g, '""')}"`
      if (w.type === 'in') {
        params.push(w.value)
        andClauses.push(`${col} = ANY($${params.length})`)
        continue
      }
      if ((w as any).type === 'notnull') {
        andClauses.push(`${col} IS NOT NULL`)
        continue
      }
      if ((w as any).type === 'notin') {
        const items = w.value as string[]
        const quoted = items.map((s) => `'${String(s).replace(/'/g, "''")}'`).join(', ')
        andClauses.push(`${col} NOT IN (${quoted})`)
        continue
      }
      if (w.type === 'is' && w.value === null) {
        andClauses.push(`${col} IS NULL`)
        continue
      }
      params.push(w.value)
      const ph = `$${params.length}`
      switch (w.type) {
        case 'eq': andClauses.push(`${col} = ${ph}`); break
        case 'neq': andClauses.push(`${col} != ${ph}`); break
        case 'gt': andClauses.push(`${col} > ${ph}`); break
        case 'gte': andClauses.push(`${col} >= ${ph}`); break
        case 'lt': andClauses.push(`${col} < ${ph}`); break
        case 'lte': andClauses.push(`${col} <= ${ph}`); break
        case 'like': andClauses.push(`${col} LIKE ${ph}`); break
        case 'ilike': andClauses.push(`${col} ILIKE ${ph}`); break
        default: andClauses.push(`${col} = ${ph}`)
      }
    }

    // Append OR clauses from .or() calls (each is already a grouped SQL expression)
    for (const orSql of this._orRawClauses) {
      if (orSql.trim()) andClauses.push(orSql)
    }

    if (andClauses.length === 0) return ''
    return `WHERE ${andClauses.join(' AND ')}`
  }

}

// ─── RPC caller ──────────────────────────────────────────────────────────────

async function callRpc(
  fnName: string,
  params?: Record<string, unknown>
): Promise<QueryResult> {
  try {
    let authClaimValues: string[] = []

    try {
      const internalSession = await getInternalAuthSession()
      const userId = String(internalSession?.user?.id || '').trim()
      const email = String(internalSession?.user?.email || '').trim()

      if (userId) {
        const claimPayload = JSON.stringify({
          sub: userId,
          role: 'authenticated',
          ...(email ? { email } : {}),
        })

        authClaimValues = [
          userId,
          'authenticated',
          claimPayload,
        ]
      }
    } catch {
      // No request-scoped internal auth session is available (e.g. scripts/cron).
      // In that case we call the RPC without auth claims injection.
    }

    const args = params ? Object.entries(params) : []
    const paramValues = args.map(([, v]) => serializeRpcParam(v))

    // Build: SELECT * FROM fn(p1 => $1, p2 => $2)
    const argStr = args.map(([k], i) => `${k} => $${i + 1}`).join(', ')
    const sql = `SELECT * FROM public."${fnName.replace(/"/g, '""')}"(${argStr})`
    let result

    if (authClaimValues.length > 0) {
      const client = await connectPostgresClient()

      try {
        await client.query('BEGIN')
        await client.query(
          `
            SELECT
              set_config('request.jwt.claim.sub', $1::text, true),
              set_config('request.jwt.claim.role', $2::text, true),
              set_config('request.jwt.claims', $3::text, true)
          `,
          authClaimValues
        )
        result = await client.query<Record<string, unknown>>(sql, paramValues)
        await client.query('COMMIT')
      } catch (error) {
        try {
          await client.query('ROLLBACK')
        } catch {
          // Ignore rollback failures so the original RPC error is preserved.
        }
        throw error
      } finally {
        client.release()
      }
    } else {
      result = await queryPostgres<Record<string, unknown>>(sql, paramValues)
    }

    if (result.rows.length === 1) {
      const row = result.rows[0]
      const rowKeys = Object.keys(row)

      // PostgreSQL scalar/jsonb functions come back as a single column whose
      // name matches the function name. Unwrap that so callers see the same
      // shape they expect from Supabase RPC.
      if (rowKeys.length === 1 && rowKeys[0] === fnName) {
        return { data: row[fnName], error: null }
      }

      return { data: row, error: null }
    }

    return { data: result.rows, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const code = (err as any)?.code
    return { data: null, error: { message, code } }
  }
}

function serializeRpcParam(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString()
  }

  if (Array.isArray(value)) {
    const normalizedArray = value.map((item) => item instanceof Date ? item.toISOString() : item)

    // Keep primitive arrays as native JS arrays so pg can bind them as
    // PostgreSQL arrays (uuid[], text[], numeric[], etc.). Structured arrays
    // still need JSON encoding for json/jsonb function parameters.
    const hasStructuredItem = normalizedArray.some(
      (item) => Array.isArray(item) || (item !== null && typeof item === 'object')
    )

    return hasStructuredItem ? JSON.stringify(normalizedArray) : normalizedArray
  }

  if (value && typeof value === 'object') {
    return JSON.stringify(value)
  }

  return value
}

// ─── Main client factory ──────────────────────────────────────────────────────

export type PostgresNativeClient = {
  from: (table: string) => PostgresQueryBuilder
  rpc: (fnName: string, params?: Record<string, unknown>) => Promise<QueryResult>
  auth: {
    getUser: () => Promise<{ data: { user: null }; error: null }>
    getSession: () => Promise<{ data: { session: null }; error: null }>
    signOut: () => Promise<{ error: null }>
    admin: {
      listUsers: (options?: { page?: number; perPage?: number }) => Promise<{
        data: { users: { id: string; email?: string | null }[] }
        error: null
      }>
      createUser: (input: Record<string, unknown>) => Promise<{
        data: { user: null }
        error: { message: string } | null
      }>
    }
  }
  storage: {
    from: (bucket: string) => {
      upload: (path: string, file: unknown, options?: unknown) => Promise<{ error: null }>
      getPublicUrl: (path: string) => { data: { publicUrl: string } }
      remove: (paths: string[]) => Promise<{ error: null }>
    }
  }
}

export function createPostgresNativeClient(): PostgresNativeClient {
  return {
    from(table: string) {
      return new PostgresQueryBuilder(table)
    },

    async rpc(fnName: string, params?: Record<string, unknown>) {
      return callRpc(fnName, params)
    },

    auth: {
      async getUser() {
        return { data: { user: null }, error: null }
      },
      async getSession() {
        return { data: { session: null }, error: null }
      },
      async signOut() {
        return { error: null }
      },
      admin: {
        async listUsers() {
          try {
            const result = await queryPostgres<{ id: string; email: string }>(
              `SELECT id::text as id, email FROM auth.users ORDER BY created_at`
            )
            return { data: { users: result.rows }, error: null }
          } catch {
            return { data: { users: [] }, error: null }
          }
        },
        async createUser(input: Record<string, unknown>) {
          // Not implemented in Railway mode — use internal_auth_users instead
          return { data: { user: null }, error: { message: 'createUser not supported in Railway mode. Use createInternalAuthUser instead.' } }
        },
      },
    },

    storage: {
      from(bucket: string) {
        return {
          async upload(path: string, _file: unknown, _options?: unknown) {
            console.warn(`[PostgresNativeClient] Storage upload to "${bucket}/${path}" skipped — storage not configured in Railway mode.`)
            return { error: null }
          },
          getPublicUrl(path: string) {
            return { data: { publicUrl: '' } }
          },
          async remove(_paths: string[]) {
            return { error: null }
          },
        }
      },
    },
  }
}
