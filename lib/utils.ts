import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Merge Tailwind classes without conflicts.
 * Usage: cn('px-4 py-2', isActive && 'bg-blue-500', className)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format number as Indonesian Rupiah.
 * Usage: formatRupiah(1500000) → "Rp 1.500.000"
 */
export function formatRupiah(amount: number, compact = false): string {
  if (compact && Math.abs(amount) >= 1_000_000_000) {
    return `Rp ${(amount / 1_000_000_000).toFixed(1)}M`
  }
  if (compact && Math.abs(amount) >= 1_000_000) {
    return `Rp ${(amount / 1_000_000).toFixed(1)}jt`
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format ISO date to Indonesian locale.
 * Usage: formatDate('2024-03-15') → "15 Maret 2024"
 */
export function formatDate(date: string | Date | null | undefined, style: 'short' | 'long' = 'long'): string {
  if (!date) return '-'
  const isDateOnly = typeof date === 'string' && DATE_ONLY_PATTERN.test(date)
  const d = typeof date === 'string'
    ? isDateOnly
      ? parseDateOnly(date)
      : new Date(date)
    : date

  if (isNaN(d.getTime())) return '-'
  
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    year: 'numeric',
    timeZone: isDateOnly ? 'UTC' : undefined,
  }).format(d)
}

/**
 * Format today's date for a business timezone as YYYY-MM-DD.
 * Usage: getDateInTimeZone('Asia/Jakarta') → "2026-04-04"
 */
export function getDateInTimeZone(timeZone: string = 'Asia/Jakarta', date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value

  if (!year || !month || !day) return ''
  return `${year}-${month}-${day}`
}

/**
 * Parse YYYY-MM-DD safely without local timezone drift.
 * Usage: parseDateOnly('2026-04-04')
 */
export function parseDateOnly(date: string | null | undefined): Date {
  if (!date) return new Date(Number.NaN)

  const match = DATE_ONLY_PATTERN.exec(date)
  if (!match) return new Date(Number.NaN)

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))

  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    return new Date(Number.NaN)
  }

  return parsed
}

/**
 * Add calendar days to a YYYY-MM-DD string.
 * Usage: addDaysToDateString('2026-04-04', 2) → "2026-04-06"
 */
export function addDaysToDateString(date: string, days: number): string {
  const parsed = parseDateOnly(date)
  if (isNaN(parsed.getTime())) return date

  parsed.setUTCDate(parsed.getUTCDate() + days)

  const year = parsed.getUTCFullYear()
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const day = String(parsed.getUTCDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

/**
 * Compare two YYYY-MM-DD strings in whole calendar days.
 * Usage: diffDateOnlyStrings('2026-04-10', '2026-04-04') → 6
 */
export function diffDateOnlyStrings(laterDate: string, earlierDate: string): number {
  const later = parseDateOnly(laterDate)
  const earlier = parseDateOnly(earlierDate)

  if (isNaN(later.getTime()) || isNaN(earlier.getTime())) return 0

  return Math.floor((later.getTime() - earlier.getTime()) / 86400000)
}

/**
 * Generate URL-safe slug from org name.
 * Usage: generateSlug('PT Maju Jaya') → 'pt-maju-jaya'
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

/**
 * Get initials from a name (for avatars).
 * Usage: getInitials('Budi Santoso') → 'BS'
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

/**
 * Truncate number to fixed decimals without rounding artifacts.
 */
export function toFixed2(n: number): number {
  return Math.round(n * 100) / 100
}
