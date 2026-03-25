import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

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
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '-'
  
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    year: 'numeric',
  }).format(d)
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
