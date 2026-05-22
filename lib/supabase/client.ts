'use client'

/**
 * lib/supabase/client.ts
 *
 * Browser client untuk Client Components.
 *
 * Karena Railway PostgreSQL tidak bisa diakses langsung dari browser,
 * semua query dirouting ke `/api/db` — sebuah Next.js API route yang
 * mengeksekusi query di server-side dan mengembalikan hasil ke browser.
 *
 * Interface dijaga kompatibel dengan Supabase JS SDK sehingga semua
 * komponen yang pakai `createClient()` tidak perlu diubah.
 */

type QueryResult = { data: any; error: any; count?: number }

class BrowserQueryBuilder {
  private _table: string
  private _method: string = 'select'
  private _columns: string = '*'
  private _filters: Array<{ type: string; column: string; value: any }> = []
  private _orders: Array<{ column: string; ascending: boolean }> = []
  private _limit: number | null = null
  private _payload: any = null
  private _onConflict: string | null = null
  private _upsertPayload: any = null

  constructor(table: string) {
    this._table = table
  }

  select(columns = '*') {
    this._columns = columns
    this._method = 'select'
    return this
  }

  insert(payload: any) {
    this._method = 'insert'
    this._payload = payload
    return this
  }

  update(payload: any) {
    this._method = 'update'
    this._payload = payload
    return this
  }

  upsert(payload: any, options?: any) {
    this._method = 'upsert'
    this._upsertPayload = payload
    if (options?.onConflict) this._onConflict = options.onConflict
    return this
  }

  delete() {
    this._method = 'delete'
    return this
  }

  eq(column: string, value: any) { this._filters.push({ type: 'eq', column, value }); return this }
  neq(column: string, value: any) { this._filters.push({ type: 'neq', column, value }); return this }
  in(column: string, values: any[]) { this._filters.push({ type: 'in', column, value: values }); return this }
  is(column: string, value: any) { this._filters.push({ type: 'is', column, value }); return this }
  gt(column: string, value: any) { this._filters.push({ type: 'gt', column, value }); return this }
  gte(column: string, value: any) { this._filters.push({ type: 'gte', column, value }); return this }
  lt(column: string, value: any) { this._filters.push({ type: 'lt', column, value }); return this }
  lte(column: string, value: any) { this._filters.push({ type: 'lte', column, value }); return this }
  like(column: string, value: any) { this._filters.push({ type: 'like', column, value }); return this }
  ilike(column: string, value: any) { this._filters.push({ type: 'ilike', column, value }); return this }
  or(filters: string) { this._filters.push({ type: 'or', column: '', value: filters }); return this }
  not(column: string, op: string, value: any) { this._filters.push({ type: 'not', column, value: { op, value } }); return this }

  order(column: string, options?: { ascending?: boolean }) {
    this._orders.push({ column, ascending: options?.ascending !== false })
    return this
  }

  limit(count: number) { this._limit = count; return this }

  async maybeSingle(): Promise<QueryResult> {
    this._limit = 1
    const result = await this._execute()
    const rows = Array.isArray(result.data) ? result.data : []
    return { data: rows[0] ?? null, error: result.error }
  }

  async single(): Promise<QueryResult> {
    this._limit = 1
    const result = await this._execute()
    const rows = Array.isArray(result.data) ? result.data : []
    if (!result.error && rows.length === 0) {
      return { data: null, error: { message: 'No rows found', code: 'PGRST116' } }
    }
    return { data: rows[0] ?? null, error: result.error }
  }

  then<T>(onfulfilled: ((value: QueryResult) => T | PromiseLike<T>) | null): Promise<T> {
    return this._execute().then(onfulfilled as any) as Promise<T>
  }

  private async _execute(): Promise<QueryResult> {
    try {
      const body = {
        table: this._table,
        method: this._method,
        columns: this._columns,
        filters: this._filters,
        orders: this._orders,
        limit: this._limit,
        payload: this._payload,
        upsertPayload: this._upsertPayload,
        onConflict: this._onConflict,
      }

      const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      })

      if (!response.ok) {
        const text = await response.text()
        return { data: null, error: { message: `HTTP ${response.status}: ${text}` } }
      }

      return await response.json()
    } catch (e: any) {
      return { data: null, error: { message: e?.message || 'Network error' } }
    }
  }
}

class BrowserAuthClient {
  async getSession() {
    try {
      const res = await fetch('/api/auth/session', { credentials: 'include' })
      const json = await res.json()
      return { data: { session: json.session }, error: null }
    } catch (e: any) {
      return { data: { session: null }, error: { message: e.message } }
    }
  }

  async getUser() {
    try {
      const res = await fetch('/api/auth/session', { credentials: 'include' })
      const json = await res.json()
      return { data: { user: json.user }, error: null }
    } catch (e: any) {
      return { data: { user: null }, error: { message: e.message } }
    }
  }

  async updateUser(attrs: any): Promise<{ data: { user: any }, error: any }> {
    return { data: { user: null }, error: null }
  }

  async signInWithPassword(_creds: any): Promise<{ data: { user: any, session: any }, error: any }> {
    return { data: { user: null, session: null }, error: { message: 'Use internal auth login' } }
  }

  async signOut() {
    try {
      await fetch('/api/auth/signout', { method: 'POST', credentials: 'include' })
    } catch {}
    return { error: null }
  }
}

class BrowserSupabaseClient {
  auth = new BrowserAuthClient()

  from(table: string) {
    return new BrowserQueryBuilder(table)
  }

  rpc(_fn: string, _args?: any) {
    // RPCs are not supported from browser in Railway-only mode
    return Promise.resolve({ data: null, error: { message: 'RPC not available in browser mode' } })
  }

  channel(name: string) {
    const ch: any = { on() { return ch }, subscribe() { return ch } }
    return ch
  }

  async removeChannel(channel: any) { return 'ok' }
}

// Singleton
let _browserClient: BrowserSupabaseClient | null = null

export function createClient() {
  if (!_browserClient) {
    _browserClient = new BrowserSupabaseClient()
  }
  return _browserClient
}

export function createOptionalClient() {
  return createClient()
}
