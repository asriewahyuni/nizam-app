export function toPlainSerializable<T>(value: T): T {
  const normalize = (input: unknown): unknown => {
    if (input === null || input === undefined) return input
    if (input instanceof Date) return input.toISOString()
    if (Array.isArray(input)) return input.map((item) => normalize(item))
    if (typeof input === 'object') {
      if ('toNumber' in (input as Record<string, unknown>) && typeof (input as { toNumber?: unknown }).toNumber === 'function') {
        return (input as { toNumber: () => number }).toNumber()
      }
      return Object.fromEntries(
        Object.entries(input as Record<string, unknown>).map(([key, entry]) => [key, normalize(entry)])
      )
    }
    return input
  }

  return normalize(value) as T
}
