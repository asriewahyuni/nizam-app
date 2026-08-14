// Warna brand dinamis untuk layar Canvasser — dibaca dari
// organizations.settings.lms_branding.primary_color, satu-satunya sumber
// brand color generik yang sudah ada di codebase (dipakai juga oleh
// modules/member/lib/portal.server.ts). Dipanggil dari Server Component.
import { queryPostgres } from '@/lib/db/postgres'

const DEFAULT_PRIMARY_COLOR = '#2563eb'
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i

export async function getOrgBrandColor(orgId: string): Promise<string> {
  const res = await queryPostgres<{ settings: Record<string, unknown> | null }>(
    `SELECT settings FROM organizations WHERE id = $1`,
    [orgId]
  )
  const settings = res.rows[0]?.settings
  const branding = settings && typeof settings === 'object'
    ? (settings as Record<string, unknown>).lms_branding
    : null
  const primaryColor = branding && typeof branding === 'object'
    ? String((branding as Record<string, unknown>).primary_color || '')
    : ''
  return HEX_COLOR_RE.test(primaryColor) ? primaryColor : DEFAULT_PRIMARY_COLOR
}

// Logo perusahaan (organizations.logo_url) — sumber yang sama dipakai halaman
// login & dashboard shell. null kalau org belum upload logo (Settings > Bisnis).
export async function getOrgBrandLogo(orgId: string): Promise<string | null> {
  const res = await queryPostgres<{ logo_url: string | null }>(
    `SELECT logo_url FROM organizations WHERE id = $1`,
    [orgId]
  )
  const logoUrl = String(res.rows[0]?.logo_url || '').trim()
  return logoUrl || null
}
