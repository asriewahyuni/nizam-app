export type LooseQueryResponse = {
  data: any
  error: { message: string } | null
}

export interface LooseQuery extends PromiseLike<LooseQueryResponse> {
  select: (columns?: string) => LooseQuery
  eq: (column: string, value: unknown) => LooseQuery
  neq: (column: string, value: unknown) => LooseQuery
  order: (column: string, options?: { ascending: boolean }) => LooseQuery
  limit: (count: number) => LooseQuery
  insert: (values: unknown) => LooseQuery
  update: (values: unknown) => LooseQuery
  upsert: (values: unknown, options?: Record<string, unknown>) => LooseQuery
  delete: () => LooseQuery
  single: () => Promise<LooseQueryResponse>
  maybeSingle: () => Promise<LooseQueryResponse>
  then: <TResult1 = LooseQueryResponse, TResult2 = never>(
    onfulfilled?: ((value: LooseQueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) => PromiseLike<TResult1 | TResult2>
}

export type LooseDb = {
  from: (table: string) => LooseQuery
}
