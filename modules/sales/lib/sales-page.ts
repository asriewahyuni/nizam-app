import { generateSlug } from '@/lib/utils'

export type SalesPageStatus = 'DRAFT' | 'PUBLISHED'

export type SalesPageProofPoint = {
  label: string
  value: string
}

export type SalesPageFeature = {
  title: string
  description: string
}

export type SalesPageTestimonial = {
  name: string
  role: string
  quote: string
}

export type SalesPageFaqItem = {
  question: string
  answer: string
}

export type SalesPageTheme = {
  accent: string
  accentSoft: string
  accentContrast: string
  surface: string
  surfaceAlt: string
  border: string
  text: string
  muted: string
}

export type SalesPageFormSettings = {
  enabled: boolean
  title: string
  subtitle: string
  ctaLabel: string
  successMessage: string
  customDomain?: string
}

export type SalesPagePayload = {
  templateId: SalesPageTemplateId
  title: string
  slug: string
  status: SalesPageStatus
  offerBadge: string
  headline: string
  subheadline: string
  description: string
  targetAudience: string
  priceLabel: string
  bonusText: string
  guaranteeText: string
  urgencyText: string
  heroImageUrl: string
  heroImageAlt: string
  primaryCtaLabel: string
  primaryCtaUrl: string
  secondaryCtaLabel: string
  secondaryCtaUrl: string
  metaTitle: string
  metaDescription: string
  metaPixelId: string
  theme: SalesPageTheme
  proofPoints: SalesPageProofPoint[]
  benefits: SalesPageFeature[]
  offerItems: SalesPageFeature[]
  testimonials: SalesPageTestimonial[]
  faqItems: SalesPageFaqItem[]
  formSettings: SalesPageFormSettings
}

export type SalesPageRecord = {
  id: string
  org_id: string
  template_id: string | null
  title: string
  slug: string
  status: SalesPageStatus
  offer_badge: string | null
  headline: string
  subheadline: string | null
  description: string | null
  target_audience: string | null
  price_label: string | null
  bonus_text: string | null
  guarantee_text: string | null
  urgency_text: string | null
  hero_image_url: string | null
  hero_image_alt: string | null
  primary_cta_label: string
  primary_cta_url: string
  secondary_cta_label: string | null
  secondary_cta_url: string | null
  meta_title: string | null
  meta_description: string | null
  meta_pixel_id: string | null
  theme: unknown
  proof_points: unknown
  benefits: unknown
  offer_items: unknown
  testimonials: unknown
  faq_items: unknown
  form_settings: unknown
  published_at: string | null
  created_at: string
  updated_at: string
}

export type SalesPageLeadRecord = {
  id: string
  org_id: string
  sales_page_id: string
  full_name: string
  email: string | null
  phone: string | null
  company: string | null
  message: string | null
  status: string
  source_url: string | null
  utm_params: unknown
  meta: unknown
  created_at: string
}

export type SalesPageLead = {
  id: string
  orgId: string
  salesPageId: string
  fullName: string
  email: string | null
  phone: string | null
  company: string | null
  message: string | null
  status: string
  sourceUrl: string | null
  utmParams: Record<string, string>
  meta: Record<string, string>
  createdAt: string
}

export type SalesPageView = {
  id: string
  orgId: string
  templateId: SalesPageTemplateId
  title: string
  slug: string
  status: SalesPageStatus
  offerBadge: string
  headline: string
  subheadline: string
  description: string
  targetAudience: string
  priceLabel: string
  bonusText: string
  guaranteeText: string
  urgencyText: string
  heroImageUrl: string
  heroImageAlt: string
  primaryCtaLabel: string
  primaryCtaUrl: string
  secondaryCtaLabel: string
  secondaryCtaUrl: string
  metaTitle: string
  metaDescription: string
  metaPixelId: string
  theme: SalesPageTheme
  proofPoints: SalesPageProofPoint[]
  benefits: SalesPageFeature[]
  offerItems: SalesPageFeature[]
  testimonials: SalesPageTestimonial[]
  faqItems: SalesPageFaqItem[]
  formSettings: SalesPageFormSettings
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export type SalesPageGeneratorInput = {
  title: string
  productName: string
  audience: string
  promise: string
  priceLabel: string
  primaryCtaLabel: string
  primaryCtaUrl: string
  secondaryCtaLabel?: string
  secondaryCtaUrl?: string
  metaPixelId?: string
  templateId?: SalesPageTemplateId
  aiPrompt?: string
  heroImageUrl?: string
  heroImageAlt?: string
}

export type SalesPageTemplateId = 'LEAD_CAPTURE' | 'WEBINAR' | 'PRODUCT_LAUNCH' | 'CONSULTING'

export type SalesPageTemplateOption = {
  id: SalesPageTemplateId
  label: string
  description: string
  offerBadge: string
  defaultPrimaryCtaLabel: string
  defaultPrimaryCtaUrl: string
  defaultSecondaryCtaLabel: string
  defaultSecondaryCtaUrl: string
}

export const SALES_PAGE_TEMPLATE_OPTIONS: SalesPageTemplateOption[] = [
  {
    id: 'LEAD_CAPTURE',
    label: 'Lead Capture',
    description: 'Fokus mengumpulkan lead untuk demo, konsultasi, atau follow-up sales.',
    offerBadge: 'Lead Capture Campaign',
    defaultPrimaryCtaLabel: 'Jadwalkan Demo',
    defaultPrimaryCtaUrl: '#lead-form',
    defaultSecondaryCtaLabel: 'Lihat Benefit',
    defaultSecondaryCtaUrl: '#benefits',
  },
  {
    id: 'WEBINAR',
    label: 'Webinar Funnel',
    description: 'Landing untuk registrasi webinar/live session dengan CTA pendaftaran cepat.',
    offerBadge: 'Webinar Campaign',
    defaultPrimaryCtaLabel: 'Daftar Webinar',
    defaultPrimaryCtaUrl: '#lead-form',
    defaultSecondaryCtaLabel: 'Lihat Agenda',
    defaultSecondaryCtaUrl: '#benefits',
  },
  {
    id: 'PRODUCT_LAUNCH',
    label: 'Product Launch',
    description: 'Untuk peluncuran produk/fitur baru dengan penekanan value dan urgency.',
    offerBadge: 'Launch Campaign',
    defaultPrimaryCtaLabel: 'Coba Sekarang',
    defaultPrimaryCtaUrl: '#lead-form',
    defaultSecondaryCtaLabel: 'Lihat Fitur',
    defaultSecondaryCtaUrl: '#benefits',
  },
  {
    id: 'CONSULTING',
    label: 'Consulting Offer',
    description: 'Untuk jasa konsultasi/audit dengan CTA booking sesi diskusi.',
    offerBadge: 'Consulting Campaign',
    defaultPrimaryCtaLabel: 'Booking Konsultasi',
    defaultPrimaryCtaUrl: '#lead-form',
    defaultSecondaryCtaLabel: 'Lihat Scope',
    defaultSecondaryCtaUrl: '#benefits',
  },
]

const SALES_PAGE_THEMES: SalesPageTheme[] = [
  {
    accent: '#0F766E',
    accentSoft: '#CCFBF1',
    accentContrast: '#F0FDFA',
    surface: '#F0FDFA',
    surfaceAlt: '#ECFDF5',
    border: '#99F6E4',
    text: '#134E4A',
    muted: '#0F766E',
  },
  {
    accent: '#C2410C',
    accentSoft: '#FFEDD5',
    accentContrast: '#FFF7ED',
    surface: '#FFF7ED',
    surfaceAlt: '#FFFBEB',
    border: '#FDBA74',
    text: '#7C2D12',
    muted: '#9A3412',
  },
  {
    accent: '#1D4ED8',
    accentSoft: '#DBEAFE',
    accentContrast: '#EFF6FF',
    surface: '#EFF6FF',
    surfaceAlt: '#F8FAFC',
    border: '#93C5FD',
    text: '#1E3A8A',
    muted: '#1D4ED8',
  },
  {
    accent: '#BE123C',
    accentSoft: '#FFE4E6',
    accentContrast: '#FFF1F2',
    surface: '#FFF1F2',
    surfaceAlt: '#FFF7ED',
    border: '#FDA4AF',
    text: '#881337',
    muted: '#BE123C',
  },
]

const DEFAULT_FORM_SETTINGS: SalesPageFormSettings = {
  enabled: true,
  title: 'Ambil Penawaran Terbaik Sekarang',
  subtitle: 'Isi data singkat Anda. Tim kami akan follow-up cepat dengan detail promo, bonus, dan demo.',
  ctaLabel: 'Saya Mau Penawarannya',
  successMessage: 'Lead Anda sudah masuk. Tim kami akan segera menghubungi Anda.',
}

function pickTheme(seed: string): SalesPageTheme {
  const hash = Array.from(seed).reduce((total, char) => total + char.charCodeAt(0), 0)
  return SALES_PAGE_THEMES[hash % SALES_PAGE_THEMES.length]
}

export function resolveSalesPageTemplate(templateId?: string): SalesPageTemplateOption {
  return SALES_PAGE_TEMPLATE_OPTIONS.find((item) => item.id === templateId) || SALES_PAGE_TEMPLATE_OPTIONS[0]
}

function normalizeTemplateId(value: unknown): SalesPageTemplateId {
  if (typeof value !== 'string') return 'LEAD_CAPTURE'
  return SALES_PAGE_TEMPLATE_OPTIONS.some((item) => item.id === value)
    ? (value as SalesPageTemplateId)
    : 'LEAD_CAPTURE'
}

function cleanText(value: string | null | undefined): string {
  return (value || '').trim()
}

function sanitizeTheme(value: unknown, fallback: SalesPageTheme): SalesPageTheme {
  const base = sanitizeObject(value)
  return {
    accent: base.accent || fallback.accent,
    accentSoft: base.accentSoft || fallback.accentSoft,
    accentContrast: base.accentContrast || fallback.accentContrast,
    surface: base.surface || fallback.surface,
    surfaceAlt: base.surfaceAlt || fallback.surfaceAlt,
    border: base.border || fallback.border,
    text: base.text || fallback.text,
    muted: base.muted || fallback.muted,
  }
}

function sanitizeFormSettings(value: unknown): SalesPageFormSettings {
  const base = sanitizeObject(value)
  const enabled =
    Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof (value as { enabled?: unknown }).enabled === 'boolean'
      ? ((value as { enabled: boolean }).enabled)
      : DEFAULT_FORM_SETTINGS.enabled

  return {
    enabled,
    title: base.title || DEFAULT_FORM_SETTINGS.title,
    subtitle: base.subtitle || DEFAULT_FORM_SETTINGS.subtitle,
    ctaLabel: base.ctaLabel || DEFAULT_FORM_SETTINGS.ctaLabel,
    successMessage: base.successMessage || DEFAULT_FORM_SETTINGS.successMessage,
    customDomain: base.customDomain || '',
  }
}


export function normalizeSalesPageSlug(value: string): string {
  return generateSlug(value).replace(/^-+|-+$/g, '').slice(0, 80)
}

export function normalizeMetaPixelId(value: string | null | undefined): string {
  return cleanText(value).replace(/[^\d]/g, '').slice(0, 32)
}

const ALLOWED_CTA_PROTOCOLS = new Set(['http:', 'https:'])

export function normalizeSalesPageCtaUrl(value: string | null | undefined, fallback: string): string {
  const cleaned = cleanText(value)
  if (!cleaned) return fallback

  if (cleaned.startsWith('#')) {
    return /^#[A-Za-z0-9:_-]+$/.test(cleaned) ? cleaned : fallback
  }

  if (cleaned.startsWith('/')) {
    return cleaned
  }

  try {
    const parsed = new URL(cleaned)
    if (ALLOWED_CTA_PROTOCOLS.has(parsed.protocol)) {
      return parsed.toString()
    }
  } catch {
    return fallback
  }

  return fallback
}

export function sanitizeObject(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, raw]) => {
    if (typeof raw === 'string') acc[key] = raw
    return acc
  }, {})
}

export function sanitizeArray<T>(
  value: unknown,
  mapper: (item: Record<string, unknown>) => T | null,
): T[] {
  if (!Array.isArray(value)) return []
  return value.reduce<T[]>((acc, item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return acc
    const mapped = mapper(item as Record<string, unknown>)
    if (mapped) acc.push(mapped)
    return acc
  }, [])
}

export function buildSalesPagePayload(input: SalesPageGeneratorInput, orgName: string): SalesPagePayload {
  const title = cleanText(input.title)
  const productName = cleanText(input.productName) || title
  const audience = cleanText(input.audience)
  const promise = cleanText(input.promise)
  const template = resolveSalesPageTemplate(input.templateId)
  const promptHint = cleanText(input.aiPrompt)
  const slug = normalizeSalesPageSlug(title || productName || `${orgName}-sales-page`)
  const theme = pickTheme(`${orgName}-${productName}`)

  const promiseFallbackMap: Record<SalesPageTemplateId, string> = {
    LEAD_CAPTURE: 'Bangun kampanye penjualan yang lebih rapi, lebih meyakinkan, dan lebih cepat closing.',
    WEBINAR: 'Ajak calon customer memahami solusi Anda lewat sesi live yang ringkas dan bernilai.',
    PRODUCT_LAUNCH: 'Perkenalkan produk baru dengan positioning yang jelas dan CTA yang tegas.',
    CONSULTING: 'Saring prospek berkualitas dan arahkan mereka ke sesi konsultasi yang terstruktur.',
  }

  const audienceFallbackMap: Record<SalesPageTemplateId, string> = {
    LEAD_CAPTURE: 'bisnis yang ingin tumbuh lebih cepat',
    WEBINAR: 'tim yang ingin insight praktis dan bisa dieksekusi',
    PRODUCT_LAUNCH: 'tim yang butuh solusi baru untuk scale operasional',
    CONSULTING: 'owner dan manajer yang butuh arahan strategis',
  }

  const promptSentence = promptHint ? ` Brief campaign: ${promptHint.slice(0, 220)}.` : ''
  const resolvedPromise = promise || promiseFallbackMap[template.id]

  return {
    templateId: template.id,
    title: title || `${productName} Landing Page`,
    slug,
    status: 'DRAFT',
    offerBadge: `${template.offerBadge} ${new Date().getFullYear()}`,
    headline: `${productName} untuk ${audience || audienceFallbackMap[template.id]}`,
    subheadline: resolvedPromise,
    description: `${productName} membantu ${audience || 'tim Anda'} bergerak lebih cepat dengan penawaran yang jelas, positioning yang tegas, dan ajakan aksi yang tidak membingungkan calon buyer.${promptSentence}`,
    targetAudience: audience,
    priceLabel: cleanText(input.priceLabel) || 'Mulai dari penawaran spesial hari ini',
    bonusText: template.id === 'WEBINAR'
      ? 'Bonus replay webinar, deck presentasi, dan worksheet implementasi.'
      : 'Bonus onboarding, template follow-up, dan panduan implementasi.',
    guaranteeText: template.id === 'CONSULTING'
      ? 'Sesi discovery untuk memetakan kebutuhan sebelum eksekusi.'
      : 'Konsultasi kebutuhan dan mapping solusi sebelum deal.',
    urgencyText: template.id === 'PRODUCT_LAUNCH'
      ? 'Akses early-batch terbatas untuk periode launch ini.'
      : 'Slot onboarding promo terbatas untuk batch bulan ini.',
    heroImageUrl: cleanText(input.heroImageUrl),
    heroImageAlt: cleanText(input.heroImageAlt) || `${productName} visual`,
    primaryCtaLabel: cleanText(input.primaryCtaLabel) || template.defaultPrimaryCtaLabel,
    primaryCtaUrl: normalizeSalesPageCtaUrl(input.primaryCtaUrl, template.defaultPrimaryCtaUrl),
    secondaryCtaLabel: cleanText(input.secondaryCtaLabel) || template.defaultSecondaryCtaLabel,
    secondaryCtaUrl: normalizeSalesPageCtaUrl(input.secondaryCtaUrl, template.defaultSecondaryCtaUrl),
    metaTitle: `${productName} | Solusi untuk ${audience || orgName}`,
    metaDescription: `${productName} membantu ${audience || 'bisnis Anda'} mendapatkan hasil lebih cepat dengan proses yang lebih rapi, penawaran yang lebih kuat, dan CTA yang lebih jelas.`,
    metaPixelId: normalizeMetaPixelId(input.metaPixelId),
    theme,
    proofPoints: [
      { label: 'Positioning', value: 'Pesan utama langsung jelas' },
      { label: 'CTA', value: 'Arahkan visitor ke aksi inti' },
      { label: 'Tracking', value: 'Siap Meta Pixel & lead capture' },
    ],
    benefits: [
      {
        title: 'Pesan penjualan lebih tajam',
        description: `Konten halaman langsung menekankan nilai ${productName} untuk ${audience || 'buyer Anda'}.`,
      },
      {
        title: 'Meyakinkan sejak layar pertama',
        description: 'Hero section, social proof, offer stack, dan FAQ ditata agar visitor cepat paham dan percaya.',
      },
      {
        title: 'Siap dipakai untuk iklan',
        description: 'Tracking Meta Pixel dan formulir lead sudah disiapkan agar campaign bisa langsung jalan.',
      },
    ],
    offerItems: [
      {
        title: productName,
        description: promise || 'Solusi inti yang membantu calon customer bergerak dari tertarik ke yakin membeli.',
      },
      {
        title: 'Bonus implementasi',
        description: 'Checklist eksekusi, template SOP, dan arahan follow-up tim sales.',
      },
      {
        title: 'Pendampingan awal',
        description: 'Sesi singkat untuk membantu tim memahami skenario penggunaan paling relevan.',
      },
    ],
    testimonials: [
      {
        name: 'Calon Case Study #1',
        role: 'Owner / Founder',
        quote: `Setelah memakai pendekatan ini, penyampaian value ${productName} jadi jauh lebih jelas dan closing terasa lebih cepat.`,
      },
      {
        name: 'Calon Case Study #2',
        role: 'Head of Sales',
        quote: 'Tim kami akhirnya punya halaman penawaran yang rapi, tidak berputar-putar, dan enak dikirim ke prospek.',
      },
    ],
    faqItems: [
      {
        question: `Apakah ${productName} cocok untuk bisnis saya?`,
        answer: `Jika Anda ingin solusi yang membantu ${audience || 'tim Anda'} bergerak lebih cepat dan lebih terukur, halaman ini sudah disusun untuk memvalidasi kebutuhan itu.`,
      },
      {
        question: 'Bagaimana proses follow-up setelah visitor isi form?',
        answer: 'Lead akan masuk ke dashboard sehingga tim Anda bisa langsung follow-up manual atau menghubungkannya ke workflow internal berikutnya.',
      },
      {
        question: 'Apakah Meta Pixel bisa disisipkan per halaman?',
        answer: 'Bisa. Setiap sales page memiliki pengaturan Pixel ID sendiri dan event lead akan dipicu setelah form berhasil dikirim.',
      },
    ],
    formSettings: {
      ...DEFAULT_FORM_SETTINGS,
      title: `Mau lihat bagaimana ${productName} cocok untuk bisnis Anda?`,
    },
  }
}

export function mapSalesPageRecord(row: SalesPageRecord): SalesPageView {
  const fallbackTheme = pickTheme(row.title)
  return {
    id: row.id,
    orgId: row.org_id,
    templateId: normalizeTemplateId(row.template_id),
    title: row.title,
    slug: row.slug,
    status: row.status,
    offerBadge: cleanText(row.offer_badge),
    headline: row.headline,
    subheadline: cleanText(row.subheadline),
    description: cleanText(row.description),
    targetAudience: cleanText(row.target_audience),
    priceLabel: cleanText(row.price_label),
    bonusText: cleanText(row.bonus_text),
    guaranteeText: cleanText(row.guarantee_text),
    urgencyText: cleanText(row.urgency_text),
    heroImageUrl: cleanText(row.hero_image_url),
    heroImageAlt: cleanText(row.hero_image_alt),
    primaryCtaLabel: row.primary_cta_label,
    primaryCtaUrl: normalizeSalesPageCtaUrl(row.primary_cta_url, '#lead-form'),
    secondaryCtaLabel: cleanText(row.secondary_cta_label),
    secondaryCtaUrl: normalizeSalesPageCtaUrl(row.secondary_cta_url, '#benefits'),
    metaTitle: cleanText(row.meta_title) || row.title,
    metaDescription: cleanText(row.meta_description) || cleanText(row.description),
    metaPixelId: normalizeMetaPixelId(row.meta_pixel_id),
    theme: sanitizeTheme(row.theme, fallbackTheme),
    proofPoints: sanitizeArray(row.proof_points, (item) => {
      const label = cleanText(String(item.label || ''))
      const value = cleanText(String(item.value || ''))
      return label && value ? { label, value } : null
    }),
    benefits: sanitizeArray(row.benefits, (item) => {
      const title = cleanText(String(item.title || ''))
      const description = cleanText(String(item.description || ''))
      return title && description ? { title, description } : null
    }),
    offerItems: sanitizeArray(row.offer_items, (item) => {
      const title = cleanText(String(item.title || ''))
      const description = cleanText(String(item.description || ''))
      return title && description ? { title, description } : null
    }),
    testimonials: sanitizeArray(row.testimonials, (item) => {
      const name = cleanText(String(item.name || ''))
      const role = cleanText(String(item.role || ''))
      const quote = cleanText(String(item.quote || ''))
      return name && quote ? { name, role, quote } : null
    }),
    faqItems: sanitizeArray(row.faq_items, (item) => {
      const question = cleanText(String(item.question || ''))
      const answer = cleanText(String(item.answer || ''))
      return question && answer ? { question, answer } : null
    }),
    formSettings: sanitizeFormSettings(row.form_settings),
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapSalesPageLead(row: SalesPageLeadRecord): SalesPageLead {
  return {
    id: row.id,
    orgId: row.org_id,
    salesPageId: row.sales_page_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    message: row.message,
    status: row.status,
    sourceUrl: row.source_url,
    utmParams: sanitizeObject(row.utm_params),
    meta: sanitizeObject(row.meta),
    createdAt: row.created_at,
  }
}

export function serializeProofPoints(text: string): SalesPageProofPoint[] {
  return text
    .split('\n')
    .map((line) => line.split('|').map((part) => part.trim()))
    .filter(([label, value]) => Boolean(label && value))
    .map(([label, value]) => ({ label, value }))
}

export function serializeFeatures(text: string): SalesPageFeature[] {
  return text
    .split('\n')
    .map((line) => line.split('|').map((part) => part.trim()))
    .filter(([title, description]) => Boolean(title && description))
    .map(([title, description]) => ({ title, description }))
}

export function serializeTestimonials(text: string): SalesPageTestimonial[] {
  return text
    .split('\n')
    .map((line) => line.split('|').map((part) => part.trim()))
    .filter(([name, role, quote]) => Boolean(name && quote && role))
    .map(([name, role, quote]) => ({ name, role, quote }))
}

export function serializeFaqItems(text: string): SalesPageFaqItem[] {
  return text
    .split('\n')
    .map((line) => line.split('|').map((part) => part.trim()))
    .filter(([question, answer]) => Boolean(question && answer))
    .map(([question, answer]) => ({ question, answer }))
}

export function proofPointsToText(items: SalesPageProofPoint[]): string {
  return items.map((item) => `${item.label} | ${item.value}`).join('\n')
}

export function featuresToText(items: SalesPageFeature[]): string {
  return items.map((item) => `${item.title} | ${item.description}`).join('\n')
}

export function testimonialsToText(items: SalesPageTestimonial[]): string {
  return items.map((item) => `${item.name} | ${item.role} | ${item.quote}`).join('\n')
}

export function faqItemsToText(items: SalesPageFaqItem[]): string {
  return items.map((item) => `${item.question} | ${item.answer}`).join('\n')
}
