type DbError = { message: string; code?: string }

type QueryOutcome<T> = {
  data: T
  error: DbError | null
}

type QueryScript<T> = {
  result?: QueryOutcome<T[] | null>
  singleResult?: QueryOutcome<T | null>
  maybeSingleResult?: QueryOutcome<T | null>
}

type RpcScript<T> = QueryOutcome<T>

type OperationLog = {
  method: string
  args: unknown[]
}

export type QueryCall = {
  table: string
  script: QueryScript<unknown>
  operations: OperationLog[]
}

type MockConfig = {
  tables?: Record<string, QueryScript<unknown>[]>
  rpc?: Record<string, RpcScript<unknown>[]>
}

export function success<T>(data: T): QueryOutcome<T> {
  return { data, error: null }
}

export function failure(message: string, code?: string): QueryOutcome<null> {
  return { data: null, error: { message, code } }
}

export function createSupabaseMock(config: MockConfig = {}) {
  const tableQueues = new Map<string, QueryScript<unknown>[]>()
  const rpcQueues = new Map<string, RpcScript<unknown>[]>()
  const calls: QueryCall[] = []
  const rpcCalls: Array<{ fn: string; args: unknown }> = []

  Object.entries(config.tables || {}).forEach(([table, scripts]) => {
    tableQueues.set(table, [...scripts])
  })

  Object.entries(config.rpc || {}).forEach(([fn, scripts]) => {
    rpcQueues.set(fn, [...scripts])
  })

  const nextQueryScript = (table: string) => {
    const queue = tableQueues.get(table) || []
    const script = queue.shift() || {}
    tableQueues.set(table, queue)
    return script
  }

  const nextRpcScript = (fn: string) => {
    const queue = rpcQueues.get(fn) || []
    const script = queue.shift()
    rpcQueues.set(fn, queue)
    return script || success(null)
  }

  const createBuilder = (table: string, script: QueryScript<unknown>) => {
    const operations: OperationLog[] = []
    const call: QueryCall = { table, script, operations }
    calls.push(call)

    const builder = {
      select(query?: string) {
        operations.push({ method: 'select', args: [query] })
        return builder
      },
      insert(values: unknown) {
        operations.push({ method: 'insert', args: [values] })
        return builder
      },
      update(values: unknown) {
        operations.push({ method: 'update', args: [values] })
        return builder
      },
      upsert(values: unknown, options?: unknown) {
        operations.push({ method: 'upsert', args: [values, options] })
        return builder
      },
      delete() {
        operations.push({ method: 'delete', args: [] })
        return builder
      },
      eq(column: string, value: unknown) {
        operations.push({ method: 'eq', args: [column, value] })
        return builder
      },
      in(column: string, values: unknown[]) {
        operations.push({ method: 'in', args: [column, values] })
        return builder
      },
      not(column: string, operator: string, value: unknown) {
        operations.push({ method: 'not', args: [column, operator, value] })
        return builder
      },
      gte(column: string, value: unknown) {
        operations.push({ method: 'gte', args: [column, value] })
        return builder
      },
      lte(column: string, value: unknown) {
        operations.push({ method: 'lte', args: [column, value] })
        return builder
      },
      lt(column: string, value: unknown) {
        operations.push({ method: 'lt', args: [column, value] })
        return builder
      },
      gt(column: string, value: unknown) {
        operations.push({ method: 'gt', args: [column, value] })
        return builder
      },
      neq(column: string, value: unknown) {
        operations.push({ method: 'neq', args: [column, value] })
        return builder
      },
      order(column: string, options?: unknown) {
        operations.push({ method: 'order', args: [column, options] })
        return builder
      },
      limit(count: number) {
        operations.push({ method: 'limit', args: [count] })
        return builder
      },
      or(filters: string) {
        operations.push({ method: 'or', args: [filters] })
        return builder
      },
      single() {
        operations.push({ method: 'single', args: [] })
        return Promise.resolve(script.singleResult || success(undefined))
      },
      maybeSingle() {
        operations.push({ method: 'maybeSingle', args: [] })
        return Promise.resolve(script.maybeSingleResult || success(null))
      },
      then(onFulfilled?: (value: QueryOutcome<unknown[] | null>) => unknown, onRejected?: (reason: unknown) => unknown) {
        return Promise.resolve(script.result || success([])).then(onFulfilled, onRejected)
      }
    }

    return builder
  }

  return {
    calls,
    rpcCalls,
    client: {
      from(table: string) {
        return createBuilder(table, nextQueryScript(table))
      },
      rpc(fn: string, args: unknown) {
        rpcCalls.push({ fn, args })
        return Promise.resolve(nextRpcScript(fn))
      }
    }
  }
}
