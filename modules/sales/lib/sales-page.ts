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
  created_by: string | null
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
  createdBy: string | null
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
  context?: SalesPageGeneratorContext
}

export type SalesPageCampaignObjectiveId =
  | 'COLLECT_LEADS'
  | 'BOOK_CALL'
  | 'GET_WHATSAPP'
  | 'REGISTER_EVENT'
  | 'SELL_PRODUCT'

export type SalesPageTrafficSourceId =
  | 'META_ADS'
  | 'GOOGLE_ADS'
  | 'WHATSAPP'
  | 'EMAIL'
  | 'SEO'
  | 'PARTNER'
  | 'DIRECT'

export type SalesPageToneStyleId =
  | 'TEGAS_FRIENDLY'
  | 'KONSULTATIF'
  | 'EKSEKUTIF'
  | 'EDUKATIF'
  | 'ASSERTIVE'

export type SalesPageGeneratorContext = {
  serviceSeedId?: string
  serviceSeedLabel?: string
  campaignObjective?: SalesPageCampaignObjectiveId
  trafficSource?: SalesPageTrafficSourceId
  toneStyle?: SalesPageToneStyleId
  brandPositioning?: string
  brandGuardrails?: string
  targetPainPoints?: string
  keyBenefits?: string
  deliverables?: string
  proofAssets?: string
  objectionHandling?: string
  urgencyOffer?: string
}

export type SalesPageAiProfilePayload = {
  brandPositioning: string
  defaultAudience: string
  defaultToneStyle: SalesPageToneStyleId
  defaultPrimaryCtaLabel: string
  defaultPrimaryCtaUrl: string
  defaultHeroImageUrl: string
  defaultHeroImageAlt: string
  keyBenefits: string
  proofAssets: string
  objectionHandling: string
  aiRules: string
}

export type SalesPageAiProfileRecord = {
  id: string
  org_id: string
  brand_positioning: string | null
  default_audience: string | null
  default_tone_style: string | null
  default_primary_cta_label: string | null
  default_primary_cta_url: string | null
  default_hero_image_url: string | null
  default_hero_image_alt: string | null
  key_benefits: string | null
  proof_assets: string | null
  objection_handling: string | null
  ai_rules: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type SalesPageAiProfileView = SalesPageAiProfilePayload & {
  id: string
  orgId: string
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

type SalesPageContextOption<T extends string> = {
  id: T
  label: string
  description: string
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

export const SALES_PAGE_CAMPAIGN_OBJECTIVE_OPTIONS: SalesPageContextOption<SalesPageCampaignObjectiveId>[] = [
  {
    id: 'COLLECT_LEADS',
    label: 'Kumpulkan Lead',
    description: 'Arahkan visitor untuk isi form dan masuk ke pipeline follow-up.',
  },
  {
    id: 'BOOK_CALL',
    label: 'Booking Call',
    description: 'Cocok untuk konsultasi, demo, atau discovery call.',
  },
  {
    id: 'GET_WHATSAPP',
    label: 'Masuk WhatsApp',
    description: 'Dorong visitor pindah ke obrolan WA secepat mungkin.',
  },
  {
    id: 'REGISTER_EVENT',
    label: 'Daftar Event',
    description: 'Untuk webinar, workshop, atau live demo.',
  },
  {
    id: 'SELL_PRODUCT',
    label: 'Jual Produk',
    description: 'Fokus ke pembelian, trial, atau penawaran launch.',
  },
]

export const SALES_PAGE_TRAFFIC_SOURCE_OPTIONS: SalesPageContextOption<SalesPageTrafficSourceId>[] = [
  {
    id: 'META_ADS',
    label: 'Meta Ads',
    description: 'Traffic dingin yang butuh hook kuat dan CTA cepat.',
  },
  {
    id: 'GOOGLE_ADS',
    label: 'Google Ads',
    description: 'Visitor intent tinggi yang sensitif pada relevansi pesan.',
  },
  {
    id: 'WHATSAPP',
    label: 'WhatsApp',
    description: 'Cocok untuk follow-up broadcast atau chat pribadi.',
  },
  {
    id: 'EMAIL',
    label: 'Email Blast',
    description: 'Biasanya datang dari audience yang sudah kenal brand.',
  },
  {
    id: 'SEO',
    label: 'SEO / Organic',
    description: 'Butuh edukasi, trust, dan struktur halaman yang informatif.',
  },
  {
    id: 'PARTNER',
    label: 'Partner / Referral',
    description: 'Traffic hangat dari rekomendasi atau partner channel.',
  },
  {
    id: 'DIRECT',
    label: 'Direct / Manual',
    description: 'Untuk link proposal, presentasi, atau follow-up internal.',
  },
]

export const SALES_PAGE_TONE_STYLE_OPTIONS: SalesPageContextOption<SalesPageToneStyleId>[] = [
  {
    id: 'TEGAS_FRIENDLY',
    label: 'Tegas Friendly',
    description: 'Jelas, meyakinkan, tapi tetap hangat dan mudah dicerna.',
  },
  {
    id: 'KONSULTATIF',
    label: 'Konsultatif',
    description: 'Cocok untuk jasa, audit, dan solusi yang perlu edukasi.',
  },
  {
    id: 'EKSEKUTIF',
    label: 'Eksekutif',
    description: 'Ringkas, rapi, dan terasa premium untuk decision maker.',
  },
  {
    id: 'EDUKATIF',
    label: 'Edukatif',
    description: 'Menjelaskan value dengan gaya yang lebih sabar dan informatif.',
  },
  {
    id: 'ASSERTIVE',
    label: 'Agresif Closing',
    description: 'Lebih direct-response untuk promo atau launch yang tegas.',
  },
]

export const DEFAULT_SALES_PAGE_AI_PROFILE: SalesPageAiProfilePayload = {
  brandPositioning: '',
  defaultAudience: '',
  defaultToneStyle: 'TEGAS_FRIENDLY',
  defaultPrimaryCtaLabel: '',
  defaultPrimaryCtaUrl: '',
  defaultHeroImageUrl: '',
  defaultHeroImageAlt: '',
  keyBenefits: '',
  proofAssets: '',
  objectionHandling: '',
  aiRules: '',
}

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

function normalizeSalesPageToneStyle(value: unknown): SalesPageToneStyleId {
  if (typeof value !== 'string') return DEFAULT_SALES_PAGE_AI_PROFILE.defaultToneStyle
  return SALES_PAGE_TONE_STYLE_OPTIONS.some((option) => option.id === value)
    ? (value as SalesPageToneStyleId)
    : DEFAULT_SALES_PAGE_AI_PROFILE.defaultToneStyle
}

function listTextToItems(value: string | null | undefined, max = 4): string[] {
  return cleanText(value)
    .replace(/[;,]+/g, '\n')
    .split('\n')
    .map((line) => line.replace(/^[\-\*\d\.\)\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, max)
}

function resolveContextOptionLabel<T extends string>(
  options: SalesPageContextOption<T>[],
  value: T | string | undefined,
): string {
  return options.find((option) => option.id === value)?.label || ''
}

function hasStructuredContext(context?: SalesPageGeneratorContext): boolean {
  if (!context) return false
  return Boolean(
    cleanText(context.serviceSeedLabel)
    || cleanText(context.brandPositioning)
    || cleanText(context.brandGuardrails)
    || cleanText(context.targetPainPoints)
    || cleanText(context.keyBenefits)
    || cleanText(context.deliverables)
    || cleanText(context.proofAssets)
    || cleanText(context.objectionHandling)
    || cleanText(context.urgencyOffer)
    || context.campaignObjective
    || context.trafficSource
    || context.toneStyle,
  )
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

export function hasSalesPageAiContext(input: SalesPageGeneratorInput): boolean {
  return Boolean(cleanText(input.aiPrompt) || hasStructuredContext(input.context))
}

export function mergeSalesPageGeneratorInputWithProfile(
  input: SalesPageGeneratorInput,
  profile?: Partial<SalesPageAiProfilePayload> | null,
): SalesPageGeneratorInput {
  if (!profile) return input

  const resolvedProfile: SalesPageAiProfilePayload = {
    ...DEFAULT_SALES_PAGE_AI_PROFILE,
    ...profile,
    defaultToneStyle: normalizeSalesPageToneStyle(profile.defaultToneStyle),
  }

  const mergedContext: SalesPageGeneratorContext = {
    ...input.context,
    toneStyle: input.context?.toneStyle || resolvedProfile.defaultToneStyle,
    brandPositioning: cleanText(input.context?.brandPositioning) || cleanText(resolvedProfile.brandPositioning),
    brandGuardrails: cleanText(input.context?.brandGuardrails) || cleanText(resolvedProfile.aiRules),
    keyBenefits: cleanText(input.context?.keyBenefits) || cleanText(resolvedProfile.keyBenefits),
    proofAssets: cleanText(input.context?.proofAssets) || cleanText(resolvedProfile.proofAssets),
    objectionHandling: cleanText(input.context?.objectionHandling) || cleanText(resolvedProfile.objectionHandling),
  }

  return {
    ...input,
    audience: cleanText(input.audience) || cleanText(resolvedProfile.defaultAudience),
    primaryCtaLabel: cleanText(input.primaryCtaLabel) || cleanText(resolvedProfile.defaultPrimaryCtaLabel),
    primaryCtaUrl: normalizeSalesPageCtaUrl(input.primaryCtaUrl, cleanText(resolvedProfile.defaultPrimaryCtaUrl) || '#lead-form'),
    heroImageUrl: cleanText(input.heroImageUrl) || cleanText(resolvedProfile.defaultHeroImageUrl),
    heroImageAlt: cleanText(input.heroImageAlt) || cleanText(resolvedProfile.defaultHeroImageAlt),
    context: mergedContext,
  }
}

export function buildSalesPageGeneratorBrief(input: SalesPageGeneratorInput): string {
  const context = input.context
  const lines = [
    cleanText(input.title) ? `Campaign title: ${cleanText(input.title)}` : '',
    cleanText(input.productName) ? `Product/Offer: ${cleanText(input.productName)}` : '',
    cleanText(input.audience) ? `Audience: ${cleanText(input.audience)}` : '',
    cleanText(input.promise) ? `Promise/Hook: ${cleanText(input.promise)}` : '',
    cleanText(input.priceLabel) ? `Price label: ${cleanText(input.priceLabel)}` : '',
    cleanText(context?.serviceSeedLabel) ? `Source seed: ${cleanText(context?.serviceSeedLabel)}` : '',
    cleanText(context?.brandPositioning) ? `Brand positioning: ${cleanText(context?.brandPositioning)}` : '',
    context?.campaignObjective
      ? `Campaign objective: ${resolveContextOptionLabel(SALES_PAGE_CAMPAIGN_OBJECTIVE_OPTIONS, context.campaignObjective)}`
      : '',
    context?.trafficSource
      ? `Traffic source: ${resolveContextOptionLabel(SALES_PAGE_TRAFFIC_SOURCE_OPTIONS, context.trafficSource)}`
      : '',
    context?.toneStyle
      ? `Tone style: ${resolveContextOptionLabel(SALES_PAGE_TONE_STYLE_OPTIONS, context.toneStyle)}`
      : '',
    cleanText(context?.targetPainPoints) ? `Main pain points: ${cleanText(context?.targetPainPoints)}` : '',
    cleanText(context?.keyBenefits) ? `Key benefits: ${cleanText(context?.keyBenefits)}` : '',
    cleanText(context?.deliverables) ? `Offer stack / deliverables: ${cleanText(context?.deliverables)}` : '',
    cleanText(context?.proofAssets) ? `Proof assets: ${cleanText(context?.proofAssets)}` : '',
    cleanText(context?.objectionHandling) ? `Objection handling: ${cleanText(context?.objectionHandling)}` : '',
    cleanText(context?.urgencyOffer) ? `Urgency / promo: ${cleanText(context?.urgencyOffer)}` : '',
    cleanText(context?.brandGuardrails) ? `Brand guardrails: ${cleanText(context?.brandGuardrails)}` : '',
    cleanText(input.primaryCtaLabel)
      ? `Primary CTA: ${cleanText(input.primaryCtaLabel)} (${normalizeSalesPageCtaUrl(input.primaryCtaUrl, '#lead-form')})`
      : '',
    cleanText(input.secondaryCtaLabel)
      ? `Secondary CTA: ${cleanText(input.secondaryCtaLabel)} (${normalizeSalesPageCtaUrl(input.secondaryCtaUrl, '#benefits')})`
      : '',
    cleanText(input.aiPrompt) ? `Additional notes: ${cleanText(input.aiPrompt)}` : '',
  ]

  return lines.filter(Boolean).join('\n')
}

export function buildSalesPagePayload(input: SalesPageGeneratorInput, orgName: string): SalesPagePayload {
  const title = cleanText(input.title)
  const productName = cleanText(input.productName) || title
  const audience = cleanText(input.audience)
  const promise = cleanText(input.promise)
  const template = resolveSalesPageTemplate(input.templateId)
  const promptHint = cleanText(input.aiPrompt)
  const context = input.context
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

  const hasNarrativeContext = Boolean(
    promptHint
    || cleanText(context?.brandPositioning)
    || cleanText(context?.brandGuardrails)
    || cleanText(context?.serviceSeedLabel)
    || cleanText(context?.targetPainPoints)
    || cleanText(context?.keyBenefits)
    || cleanText(context?.deliverables)
    || cleanText(context?.proofAssets)
    || cleanText(context?.objectionHandling)
    || cleanText(context?.urgencyOffer),
  )
  const promptSentence = hasNarrativeContext ? buildSalesPageGeneratorBrief(input) : ''
  const promptSentenceSuffix = promptSentence ? ` Brief campaign: ${promptSentence.slice(0, 260)}.` : ''
  const resolvedPromise = promise || promiseFallbackMap[template.id]
  const objectiveLabel = resolveContextOptionLabel(SALES_PAGE_CAMPAIGN_OBJECTIVE_OPTIONS, context?.campaignObjective)
  const trafficLabel = resolveContextOptionLabel(SALES_PAGE_TRAFFIC_SOURCE_OPTIONS, context?.trafficSource)
  const brandPositioning = cleanText(context?.brandPositioning)
  const painPoints = listTextToItems(context?.targetPainPoints, 3)
  const benefitItems = listTextToItems(context?.keyBenefits, 3)
  const deliverableItems = listTextToItems(context?.deliverables, 4)
  const proofItems = listTextToItems(context?.proofAssets, 3)
  const objectionItems = listTextToItems(context?.objectionHandling, 2)
  const urgencyOffer = cleanText(context?.urgencyOffer)
  const leadingPainPoint = painPoints[0]
  const benefitSummary = benefitItems[0]
  const proofSummary = proofItems[0]
  const audienceLabel = audience || audienceFallbackMap[template.id]
  const formTitleFallback = context?.campaignObjective === 'BOOK_CALL'
    ? `Siap diskusikan kebutuhan ${productName} dengan tim kami?`
    : context?.campaignObjective === 'REGISTER_EVENT'
      ? `Amankan slot Anda untuk ${productName}`
      : `Mau lihat bagaimana ${productName} cocok untuk bisnis Anda?`

  return {
    templateId: template.id,
    title: title || `${productName} Landing Page`,
    slug,
    status: 'DRAFT',
    offerBadge: `${template.offerBadge} ${new Date().getFullYear()}`,
    headline: `${productName} untuk ${audienceLabel}`,
    subheadline: resolvedPromise,
    description: `${productName} membantu ${audience || 'tim Anda'} bergerak lebih cepat dengan penawaran yang jelas, positioning yang tegas, dan ajakan aksi yang tidak membingungkan calon buyer.${brandPositioning ? ` Arah positioning utama brand: ${brandPositioning}.` : ''}${leadingPainPoint ? ` Fokus utama campaign ini adalah mengatasi ${leadingPainPoint}.` : ''}${benefitSummary ? ` Benefit terkuat yang ditonjolkan: ${benefitSummary}.` : ''}${trafficLabel ? ` Kanal traffic utama: ${trafficLabel}.` : ''}${promptSentenceSuffix}`,
    targetAudience: audience,
    priceLabel: cleanText(input.priceLabel) || 'Mulai dari penawaran spesial hari ini',
    bonusText: template.id === 'WEBINAR'
      ? 'Bonus replay webinar, deck presentasi, dan worksheet implementasi.'
      : 'Bonus onboarding, template follow-up, dan panduan implementasi.',
    guaranteeText: template.id === 'CONSULTING'
      ? 'Sesi discovery untuk memetakan kebutuhan sebelum eksekusi.'
      : 'Konsultasi kebutuhan dan mapping solusi sebelum deal.',
    urgencyText: urgencyOffer || (template.id === 'PRODUCT_LAUNCH'
      ? 'Akses early-batch terbatas untuk periode launch ini.'
      : 'Slot onboarding promo terbatas untuk batch bulan ini.'),
    heroImageUrl: cleanText(input.heroImageUrl),
    heroImageAlt: cleanText(input.heroImageAlt) || `${productName} visual`,
    primaryCtaLabel: cleanText(input.primaryCtaLabel) || template.defaultPrimaryCtaLabel,
    primaryCtaUrl: normalizeSalesPageCtaUrl(input.primaryCtaUrl, template.defaultPrimaryCtaUrl),
    secondaryCtaLabel: cleanText(input.secondaryCtaLabel) || template.defaultSecondaryCtaLabel,
    secondaryCtaUrl: normalizeSalesPageCtaUrl(input.secondaryCtaUrl, template.defaultSecondaryCtaUrl),
    metaTitle: `${productName} | Solusi untuk ${audience || orgName}`,
    metaDescription: `${productName} membantu ${audience || 'bisnis Anda'} mendapatkan hasil lebih cepat dengan proses yang lebih rapi, penawaran yang lebih kuat, dan CTA yang lebih jelas.${leadingPainPoint ? ` Cocok untuk yang ingin mengatasi ${leadingPainPoint}.` : ''}`,
    metaPixelId: normalizeMetaPixelId(input.metaPixelId),
    theme,
    proofPoints: proofItems.length
      ? proofItems.map((item, index) => ({
          label: index === 0 ? 'Proof' : index === 1 ? 'Trust' : 'Angle',
          value: item,
        }))
      : [
          { label: 'Positioning', value: 'Pesan utama langsung jelas' },
          { label: 'CTA', value: objectiveLabel || 'Arahkan visitor ke aksi inti' },
          { label: 'Tracking', value: trafficLabel ? `Siap untuk ${trafficLabel}` : 'Siap Meta Pixel & lead capture' },
        ],
    benefits: benefitItems.length
      ? benefitItems.map((item, index) => ({
          title: index === 0 ? 'Benefit Utama' : index === 1 ? 'Value Tambahan' : 'Dampak untuk Buyer',
          description: item,
        }))
      : [
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
    offerItems: deliverableItems.length
      ? deliverableItems.map((item, index) => ({
          title: index === 0 ? productName : `Deliverable ${index + 1}`,
          description: item,
        }))
      : [
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
        quote: `Setelah memakai pendekatan ini, penyampaian value ${productName} jadi jauh lebih jelas dan closing terasa lebih cepat.${proofSummary ? ` Bukti yang paling menenangkan buyer juga terasa lebih konkret: ${proofSummary}.` : ''}`,
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
        answer: `Jika Anda ingin solusi yang membantu ${audience || 'tim Anda'} bergerak lebih cepat dan lebih terukur, halaman ini sudah disusun untuk memvalidasi kebutuhan itu.${leadingPainPoint ? ` Terutama bila tantangan utama Anda adalah ${leadingPainPoint}.` : ''}`,
      },
      {
        question: 'Bagaimana proses follow-up setelah visitor isi form?',
        answer: 'Lead akan masuk ke dashboard sehingga tim Anda bisa langsung follow-up manual atau menghubungkannya ke workflow internal berikutnya.',
      },
      {
        question: 'Apakah Meta Pixel bisa disisipkan per halaman?',
        answer: 'Bisa. Setiap sales page memiliki pengaturan Pixel ID sendiri dan event lead akan dipicu setelah form berhasil dikirim.',
      },
      ...(objectionItems[0]
        ? [
            {
              question: 'Bagaimana jika saya masih ragu sebelum memulai?',
              answer: objectionItems[0],
            },
          ]
        : []),
    ],
    formSettings: {
      ...DEFAULT_FORM_SETTINGS,
      title: formTitleFallback,
      subtitle: objectiveLabel
        ? `${DEFAULT_FORM_SETTINGS.subtitle} Fokus campaign: ${objectiveLabel}.`
        : DEFAULT_FORM_SETTINGS.subtitle,
    },
  }
}

export function mapSalesPageAiProfileRecord(row: SalesPageAiProfileRecord): SalesPageAiProfileView {
  return {
    id: row.id,
    orgId: row.org_id,
    brandPositioning: cleanText(row.brand_positioning),
    defaultAudience: cleanText(row.default_audience),
    defaultToneStyle: normalizeSalesPageToneStyle(row.default_tone_style),
    defaultPrimaryCtaLabel: cleanText(row.default_primary_cta_label),
    defaultPrimaryCtaUrl: normalizeSalesPageCtaUrl(row.default_primary_cta_url, ''),
    defaultHeroImageUrl: cleanText(row.default_hero_image_url),
    defaultHeroImageAlt: cleanText(row.default_hero_image_alt),
    keyBenefits: cleanText(row.key_benefits),
    proofAssets: cleanText(row.proof_assets),
    objectionHandling: cleanText(row.objection_handling),
    aiRules: cleanText(row.ai_rules),
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
    createdBy: row.created_by,
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
