import { cache } from 'react'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import {
  DEFAULT_AI_TOKEN_POLICY,
  normalizeAiTokenPolicy,
  type AiTokenPolicy,
} from '@/modules/ai/lib/ai-token'
import {
  buildSalesPagePayload,
  mapSalesPageLead,
  mapSalesPageRecord,
  normalizeSalesPageCtaUrl,
  normalizeMetaPixelId,
  normalizeSalesPageSlug,
  resolveSalesPageTemplate,
  serializeFaqItems,
  serializeFeatures,
  serializeProofPoints,
  serializeTestimonials,
  type SalesPageGeneratorInput,
  type SalesPageLead,
  type SalesPageLeadRecord,
  type SalesPagePayload,
  type SalesPageRecord,
  type SalesPageStatus,
  type SalesPageView,
} from './sales-page'

type OrgSummary = {
  id: string
  name: string
  slug: string
  logo_url: string | null
}

type AiTokenWalletRow = {
  org_id: string
  balance_tokens: number
  total_purchased_tokens: number
  total_used_tokens: number
  low_balance_threshold: number
}

function normalizePublicOrgIdentifier(value: string) {
  return value.trim().toLowerCase()
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeSalesPageRow(row: any): SalesPageRecord {
  return {
    ...row,
    published_at: row.published_at instanceof Date ? row.published_at.toISOString() : row.published_at,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  }
}

function normalizeSalesPageLeadRow(row: any): SalesPageLeadRecord {
  return {
    ...row,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  }
}

async function getAiTokenPolicyFromPrisma(): Promise<AiTokenPolicy> {
  const data = await prisma.saas_config.findUnique({
    where: { key: 'ai_token_policy' },
    select: { value: true },
  })

  return normalizeAiTokenPolicy(data?.value || DEFAULT_AI_TOKEN_POLICY)
}

async function ensureAiTokenWallet(orgId: string, lowBalanceThreshold: number): Promise<AiTokenWalletRow> {
  const existing = await prisma.ai_token_wallets.findUnique({
    where: { org_id: orgId },
  })

  if (existing?.org_id) {
    return {
      org_id: existing.org_id,
      balance_tokens: toNumber(existing.balance_tokens, 0),
      total_purchased_tokens: toNumber(existing.total_purchased_tokens, 0),
      total_used_tokens: toNumber(existing.total_used_tokens, 0),
      low_balance_threshold: toNumber(existing.low_balance_threshold, lowBalanceThreshold),
    }
  }

  const created = await prisma.ai_token_wallets.create({
    data: {
      org_id: orgId,
      balance_tokens: 0,
      total_purchased_tokens: 0,
      total_used_tokens: 0,
      low_balance_threshold: lowBalanceThreshold,
    },
  })

  return {
    org_id: created.org_id,
    balance_tokens: toNumber(created.balance_tokens, 0),
    total_purchased_tokens: toNumber(created.total_purchased_tokens, 0),
    total_used_tokens: toNumber(created.total_used_tokens, 0),
    low_balance_threshold: toNumber(created.low_balance_threshold, lowBalanceThreshold),
  }
}

async function estimateCostFromUsageTokens(
  usage: { promptTokens: number; outputTokens: number },
): Promise<{ policy: AiTokenPolicy; estimatedCostIdr: number; billedTokens: number }> {
  const policy = await getAiTokenPolicyFromPrisma()
  const promptTokens = Math.max(0, Math.round(usage.promptTokens || 0))
  const outputTokens = Math.max(0, Math.round(usage.outputTokens || 0))
  const billedTokens = Math.max(1, promptTokens + outputTokens)

  const inputCost = (promptTokens / 1000) * policy.costPer1kInputIdr
  const outputCost = (outputTokens / 1000) * policy.costPer1kOutputIdr
  const estimatedCostIdr = inputCost + outputCost

  return { policy, estimatedCostIdr, billedTokens }
}

async function consumeAiTokensForGeneration(params: {
  orgId: string
  userId: string
  requestedTokens: number
  source: 'sales_page_generate'
  note: string
  estimatedCostIdr?: number
  meta?: Record<string, unknown>
}) {
  const policy = await getAiTokenPolicyFromPrisma()
  const wallet = await ensureAiTokenWallet(params.orgId, policy.lowBalanceThreshold)
  const requested = Math.max(1, Math.round(params.requestedTokens))

  if (wallet.balance_tokens < requested) {
    throw new Error(
      `Token AI tidak cukup. Sisa ${wallet.balance_tokens.toLocaleString('id-ID')} token, butuh ${requested.toLocaleString('id-ID')} token. Silakan topup token AI terlebih dahulu.`,
    )
  }

  const nextBalance = wallet.balance_tokens - requested
  const nextUsed = wallet.total_used_tokens + requested

  await prisma.ai_token_wallets.update({
    where: { org_id: params.orgId },
    data: {
      balance_tokens: nextBalance,
      total_used_tokens: nextUsed,
      updated_at: new Date(),
    },
  })

  await prisma.ai_token_usage_logs.create({
    data: {
      org_id: params.orgId,
      user_id: params.userId,
      source: params.source,
      direction: 'DEBIT',
      tokens: requested,
      estimated_cost_idr: Math.max(0, toNumber(params.estimatedCostIdr, 0)),
      note: params.note,
      meta: (params.meta || {}) as any,
    },
  })

  return {
    consumedTokens: requested,
    balanceTokens: nextBalance,
    policy,
  }
}

async function resolvePublicOrg(orgIdentifier: string): Promise<OrgSummary | null> {
  const normalizedIdentifier = normalizePublicOrgIdentifier(orgIdentifier)
  if (!normalizedIdentifier) return null

  const slugOrg = await prisma.organizations.findFirst({
    where: {
      slug: normalizedIdentifier,
      is_active: true,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      logo_url: true,
    },
  })

  if (slugOrg?.id) {
    return {
      id: String(slugOrg.id),
      name: String(slugOrg.name || ''),
      slug: String(slugOrg.slug || slugOrg.id),
      logo_url: slugOrg.logo_url,
    }
  }

  if (!looksLikeUuid(normalizedIdentifier)) {
    return null
  }

  const idOrg = await prisma.organizations.findFirst({
    where: {
      id: normalizedIdentifier,
      is_active: true,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      logo_url: true,
    },
  })

  if (!idOrg?.id) {
    return null
  }

  return {
    id: String(idOrg.id),
    name: String(idOrg.name || ''),
    slug: String(idOrg.slug || idOrg.id),
    logo_url: idOrg.logo_url,
  }
}

async function getAuthedContext() {
  const session = await auth()
  const user = session?.user

  if (!user?.id) {
    throw new Error('Tidak terautentikasi')
  }

  return { user }
}

async function getMemberOrg(orgId: string) {
  const { user } = await getAuthedContext()
  const member = await prisma.org_members.findFirst({
    where: {
      org_id: orgId,
      user_id: user.id,
      is_active: true,
    },
    include: {
      organizations: {
        select: {
          id: true,
          name: true,
          slug: true,
          logo_url: true,
        },
      },
    },
  })

  if (!member?.organizations) {
    throw new Error('Akses organisasi tidak ditemukan')
  }

  return {
    userId: String(user.id),
    role: String(member.role || 'staff'),
    org: member.organizations as OrgSummary,
  }
}

async function ensureUniqueSlug(orgId: string, baseSlug: string, ignoreId?: string) {
  const normalizedBase = normalizeSalesPageSlug(baseSlug) || `sales-page-${Date.now()}`
  let candidate = normalizedBase
  let counter = 1

  while (true) {
    const data = await prisma.sales_pages.findFirst({
      where: {
        org_id: orgId,
        slug: candidate,
        ...(ignoreId ? { id: { not: ignoreId } } : {}),
      },
      select: { id: true },
    })

    if (!data) return candidate
    counter += 1
    candidate = `${normalizedBase}-${counter}`
  }
}

function toInsertPayload(payload: SalesPagePayload) {
  return {
    template_id: payload.templateId,
    title: payload.title,
    slug: normalizeSalesPageSlug(payload.slug),
    status: payload.status,
    offer_badge: payload.offerBadge,
    headline: payload.headline,
    subheadline: payload.subheadline,
    description: payload.description,
    target_audience: payload.targetAudience,
    price_label: payload.priceLabel,
    bonus_text: payload.bonusText,
    guarantee_text: payload.guaranteeText,
    urgency_text: payload.urgencyText,
    hero_image_url: payload.heroImageUrl,
    hero_image_alt: payload.heroImageAlt,
    primary_cta_label: payload.primaryCtaLabel,
    primary_cta_url: normalizeSalesPageCtaUrl(payload.primaryCtaUrl, '#lead-form'),
    secondary_cta_label: payload.secondaryCtaLabel,
    secondary_cta_url: normalizeSalesPageCtaUrl(payload.secondaryCtaUrl, '#benefits'),
    meta_title: payload.metaTitle,
    meta_description: payload.metaDescription,
    meta_pixel_id: normalizeMetaPixelId(payload.metaPixelId),
    theme: payload.theme,
    proof_points: payload.proofPoints,
    benefits: payload.benefits,
    offer_items: payload.offerItems,
    testimonials: payload.testimonials,
    faq_items: payload.faqItems,
    form_settings: payload.formSettings,
  }
}

function normalizeStatus(value: string | null | undefined): SalesPageStatus {
  return value === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT'
}

function cleanAiText(value: unknown, max = 400): string {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/\s+/g, ' ').slice(0, max)
}

function cleanAiMultiline(value: unknown, max = 3000): string {
  if (typeof value !== 'string') return ''
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, max)
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[0]) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

async function generateSalesPageAiDraft(
  orgId: string,
  userId: string,
  input: SalesPageGeneratorInput,
  orgName: string,
): Promise<Partial<SalesPagePayload> | null> {
  const aiPrompt = cleanAiText(input.aiPrompt, 1200)
  if (!aiPrompt) return null

  const aiStudioKey = process.env.GOOGLE_AI_STUDIO_KEY
  if (!aiStudioKey) return null

  try {
    const tokenPolicy = await getAiTokenPolicyFromPrisma()
    const wallet = await ensureAiTokenWallet(orgId, tokenPolicy.lowBalanceThreshold)
    const minimumRequiredTokens = Math.max(1, tokenPolicy.tokensPerGeneration)

    if (wallet.balance_tokens < minimumRequiredTokens) {
      throw new Error(
        `Token AI tidak cukup. Sisa ${wallet.balance_tokens.toLocaleString('id-ID')} token, minimum ${minimumRequiredTokens.toLocaleString('id-ID')} token untuk 1 generate.`,
      )
    }

    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(aiStudioKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const template = resolveSalesPageTemplate(input.templateId)

    const brief = [
      `Organization: ${orgName}`,
      `Template: ${template.label}`,
      `Campaign title: ${input.title}`,
      `Product/Offer: ${input.productName}`,
      `Audience: ${input.audience || '-'}`,
      `Promise/Hook: ${input.promise || '-'}`,
      `Price label: ${input.priceLabel || '-'}`,
      `Primary CTA: ${input.primaryCtaLabel || '-'} (${input.primaryCtaUrl || '-'})`,
      `Secondary CTA: ${input.secondaryCtaLabel || '-'} (${input.secondaryCtaUrl || '-'})`,
      `Additional brief: ${aiPrompt}`,
    ].join('\n')

    const prompt = `You are an expert direct-response copywriter for Indonesian B2B landing pages.
Create conversion-focused content in Bahasa Indonesia.
Return ONLY valid JSON with this exact schema (all values as strings):
{
  "offerBadge": "",
  "headline": "",
  "subheadline": "",
  "description": "",
  "targetAudience": "",
  "priceLabel": "",
  "bonusText": "",
  "guaranteeText": "",
  "urgencyText": "",
  "metaTitle": "",
  "metaDescription": "",
  "primaryCtaLabel": "",
  "secondaryCtaLabel": "",
  "formTitle": "",
  "formSubtitle": "",
  "formCtaLabel": "",
  "formSuccessMessage": "",
  "proofPointsText": "Label | Value\\nLabel | Value",
  "benefitsText": "Title | Description\\nTitle | Description",
  "offerItemsText": "Title | Description\\nTitle | Description",
  "testimonialsText": "Nama | Role | Quote\\nNama | Role | Quote",
  "faqText": "Pertanyaan | Jawaban\\nPertanyaan | Jawaban"
}
Do not include markdown fences.
Use concise, practical copy.

Brief:
${brief}`

    const result = await model.generateContent(prompt)
    const raw = result.response.text().trim()
    const parsed = extractJsonObject(raw)
    if (!parsed) return null

    const usageMetadata = (result.response as { usageMetadata?: Record<string, unknown> }).usageMetadata
    const promptTokens = Number((usageMetadata as { promptTokenCount?: unknown } | undefined)?.promptTokenCount || 0)
    const outputTokens = Number(
      (usageMetadata as { candidatesTokenCount?: unknown; outputTokenCount?: unknown } | undefined)?.candidatesTokenCount
      || (usageMetadata as { outputTokenCount?: unknown } | undefined)?.outputTokenCount
      || 0,
    )
    const totalTokens = Number((usageMetadata as { totalTokenCount?: unknown } | undefined)?.totalTokenCount || 0)

    const usageCost = await estimateCostFromUsageTokens({
      promptTokens,
      outputTokens,
    })

    const billedTokens = Math.max(
      1,
      Math.round(totalTokens > 0 ? totalTokens : usageCost.billedTokens || tokenPolicy.tokensPerGeneration),
    )

    let estimatedCostIdr = usageCost.estimatedCostIdr
    if (!estimatedCostIdr && totalTokens > 0) {
      const avgCostPerToken = ((tokenPolicy.costPer1kInputIdr + tokenPolicy.costPer1kOutputIdr) / 2) / 1000
      estimatedCostIdr = totalTokens * avgCostPerToken
    }

    await consumeAiTokensForGeneration({
      orgId,
      userId,
      requestedTokens: billedTokens,
      source: 'sales_page_generate',
      estimatedCostIdr,
      note: `Generate sales page AI: ${input.title || input.productName || 'Untitled Campaign'}`,
      meta: {
        feature: 'sales_page',
        templateId: input.templateId || 'LEAD_CAPTURE',
        promptTokens,
        outputTokens,
        totalTokens: billedTokens,
      },
    })

    const proofPoints = serializeProofPoints(cleanAiMultiline(parsed.proofPointsText, 2000))
    const benefits = serializeFeatures(cleanAiMultiline(parsed.benefitsText, 3000))
    const offerItems = serializeFeatures(cleanAiMultiline(parsed.offerItemsText, 3000))
    const testimonials = serializeTestimonials(cleanAiMultiline(parsed.testimonialsText, 3000))
    const faqItems = serializeFaqItems(cleanAiMultiline(parsed.faqText, 3000))

    return {
      offerBadge: cleanAiText(parsed.offerBadge, 100),
      headline: cleanAiText(parsed.headline, 180),
      subheadline: cleanAiText(parsed.subheadline, 320),
      description: cleanAiText(parsed.description, 480),
      targetAudience: cleanAiText(parsed.targetAudience, 180),
      priceLabel: cleanAiText(parsed.priceLabel, 100),
      bonusText: cleanAiText(parsed.bonusText, 200),
      guaranteeText: cleanAiText(parsed.guaranteeText, 200),
      urgencyText: cleanAiText(parsed.urgencyText, 200),
      metaTitle: cleanAiText(parsed.metaTitle, 120),
      metaDescription: cleanAiText(parsed.metaDescription, 220),
      primaryCtaLabel: cleanAiText(parsed.primaryCtaLabel, 40),
      secondaryCtaLabel: cleanAiText(parsed.secondaryCtaLabel, 40),
      proofPoints: proofPoints.length ? proofPoints : undefined,
      benefits: benefits.length ? benefits : undefined,
      offerItems: offerItems.length ? offerItems : undefined,
      testimonials: testimonials.length ? testimonials : undefined,
      faqItems: faqItems.length ? faqItems : undefined,
      formSettings: {
        enabled: true,
        title: cleanAiText(parsed.formTitle, 120),
        subtitle: cleanAiText(parsed.formSubtitle, 260),
        ctaLabel: cleanAiText(parsed.formCtaLabel, 40),
        successMessage: cleanAiText(parsed.formSuccessMessage, 180),
      },
    }
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('token ai')) {
      throw error
    }
    console.error('[SalesPageAI] gagal generate draft:', error)
    return null
  }
}

function mergeGeneratedPayload(base: SalesPagePayload, patch: Partial<SalesPagePayload> | null): SalesPagePayload {
  if (!patch) return base

  return {
    ...base,
    offerBadge: patch.offerBadge || base.offerBadge,
    headline: patch.headline || base.headline,
    subheadline: patch.subheadline || base.subheadline,
    description: patch.description || base.description,
    targetAudience: patch.targetAudience || base.targetAudience,
    priceLabel: patch.priceLabel || base.priceLabel,
    bonusText: patch.bonusText || base.bonusText,
    guaranteeText: patch.guaranteeText || base.guaranteeText,
    urgencyText: patch.urgencyText || base.urgencyText,
    metaTitle: patch.metaTitle || base.metaTitle,
    metaDescription: patch.metaDescription || base.metaDescription,
    primaryCtaLabel: patch.primaryCtaLabel || base.primaryCtaLabel,
    secondaryCtaLabel: patch.secondaryCtaLabel || base.secondaryCtaLabel,
    proofPoints: patch.proofPoints?.length ? patch.proofPoints : base.proofPoints,
    benefits: patch.benefits?.length ? patch.benefits : base.benefits,
    offerItems: patch.offerItems?.length ? patch.offerItems : base.offerItems,
    testimonials: patch.testimonials?.length ? patch.testimonials : base.testimonials,
    faqItems: patch.faqItems?.length ? patch.faqItems : base.faqItems,
    formSettings: {
      ...base.formSettings,
      ...patch.formSettings,
      enabled: patch.formSettings?.enabled ?? base.formSettings.enabled,
      title: patch.formSettings?.title || base.formSettings.title,
      subtitle: patch.formSettings?.subtitle || base.formSettings.subtitle,
      ctaLabel: patch.formSettings?.ctaLabel || base.formSettings.ctaLabel,
      successMessage: patch.formSettings?.successMessage || base.formSettings.successMessage,
    },
  }
}

export async function getSalesPagesForOrg(orgId: string): Promise<SalesPageView[]> {
  await getMemberOrg(orgId)
  const data = await prisma.sales_pages.findMany({
    where: { org_id: orgId },
    orderBy: { updated_at: 'desc' },
  })

  return (data || []).map((row) => mapSalesPageRecord(normalizeSalesPageRow(row)))
}

export async function getSalesPageLeadsForOrg(orgId: string, salesPageId?: string): Promise<SalesPageLead[]> {
  await getMemberOrg(orgId)
  const data = await prisma.sales_page_leads.findMany({
    where: {
      org_id: orgId,
      ...(salesPageId ? { sales_page_id: salesPageId } : {}),
    },
    orderBy: { created_at: 'desc' },
    take: 100,
  })

  return (data || []).map((row) => mapSalesPageLead(normalizeSalesPageLeadRow(row)))
}

export async function createGeneratedSalesPage(orgId: string, input: SalesPageGeneratorInput): Promise<SalesPageView> {
  const { userId, org } = await getMemberOrg(orgId)
  const initialPayload = buildSalesPagePayload(input, org.name)
  const aiPatch = await generateSalesPageAiDraft(orgId, userId, input, org.name)
  const payload = mergeGeneratedPayload(initialPayload, aiPatch)
  const slug = await ensureUniqueSlug(orgId, payload.slug)

  const data = await prisma.sales_pages.create({
    data: {
      org_id: orgId,
      created_by: userId,
      updated_by: userId,
      ...toInsertPayload({ ...payload, slug }),
    } as any,
  })

  return mapSalesPageRecord(normalizeSalesPageRow(data))
}

export async function updateSalesPageContent(orgId: string, salesPageId: string, payload: SalesPagePayload): Promise<SalesPageView> {
  const { userId } = await getMemberOrg(orgId)
  const status = normalizeStatus(payload.status)
  const slug = await ensureUniqueSlug(orgId, payload.slug || payload.title, salesPageId)

  const data = await prisma.sales_pages.update({
    where: { id: salesPageId },
    data: {
      updated_by: userId,
      published_at: status === 'PUBLISHED' ? new Date() : null,
      ...toInsertPayload({ ...payload, status, slug }),
    } as any,
  })

  return mapSalesPageRecord(normalizeSalesPageRow(data))
}

export async function duplicateSalesPage(orgId: string, salesPageId: string): Promise<SalesPageView> {
  const { userId } = await getMemberOrg(orgId)
  const existing = await prisma.sales_pages.findFirst({
    where: {
      org_id: orgId,
      id: salesPageId,
    },
  })

  if (!existing) throw new Error('Sales page tidak ditemukan')

  const source = mapSalesPageRecord(normalizeSalesPageRow(existing))
  const slug = await ensureUniqueSlug(orgId, `${source.slug}-copy`)

  const data = await prisma.sales_pages.create({
    data: {
      org_id: orgId,
      created_by: userId,
      updated_by: userId,
      ...toInsertPayload({
        ...source,
        title: `${source.title} Copy`,
        slug,
        status: 'DRAFT',
        metaTitle: `${source.metaTitle} Copy`,
        metaPixelId: '',
      }),
    } as any,
  })

  return mapSalesPageRecord(normalizeSalesPageRow(data))
}

export async function removeSalesPage(orgId: string, salesPageId: string) {
  await getMemberOrg(orgId)
  await prisma.sales_pages.deleteMany({
    where: {
      org_id: orgId,
      id: salesPageId,
    },
  })
}

export async function getPublicSalesPageByPath(orgSlug: string, pageSlug: string) {
  const org = await resolvePublicOrg(orgSlug)
  if (!org?.id) return null
  const normalizedPageSlug = normalizeSalesPageSlug(pageSlug) || pageSlug.trim().toLowerCase()

  const page = await prisma.sales_pages.findFirst({
    where: {
      org_id: org.id,
      slug: normalizedPageSlug,
      status: 'PUBLISHED',
    },
  })

  if (!page) return null

  return {
    org: org as OrgSummary,
    page: mapSalesPageRecord(normalizeSalesPageRow(page)),
  }
}

export const getCachedPublicSalesPageByPath = cache(getPublicSalesPageByPath)

export async function createPublicSalesPageLead(input: {
  orgSlug: string
  pageSlug: string
  fullName: string
  email?: string
  phone?: string
  company?: string
  message?: string
  sourceUrl?: string
  utmParams?: Record<string, string>
  meta?: Record<string, string>
}) {
  const publicPage = await getPublicSalesPageByPath(input.orgSlug, input.pageSlug)
  if (!publicPage) throw new Error('Sales page tidak ditemukan atau belum dipublikasikan')

  const data = await prisma.sales_page_leads.create({
    data: {
      org_id: publicPage.org.id,
      sales_page_id: publicPage.page.id,
      full_name: input.fullName.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      company: input.company?.trim() || null,
      message: input.message?.trim() || null,
      source_url: input.sourceUrl?.trim() || null,
      utm_params: input.utmParams || {},
      meta: input.meta || {},
    },
  })

  let contactId: string | null = null
  if (input.phone) {
    const existing = await prisma.contacts.findFirst({
      where: {
        org_id: publicPage.org.id,
        phone: input.phone.trim(),
      },
      select: { id: true },
    })
    if (existing) contactId = existing.id
  }

  if (!contactId && input.email) {
    const existing = await prisma.contacts.findFirst({
      where: {
        org_id: publicPage.org.id,
        email: input.email.trim(),
      },
      select: { id: true },
    })
    if (existing) contactId = existing.id
  }

  if (!contactId) {
    const contact = await prisma.contacts.create({
      data: {
        org_id: publicPage.org.id,
        name: input.fullName.trim(),
        type: 'CUSTOMER' as any,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
      },
      select: { id: true },
    })
    if (contact) contactId = contact.id
  }

  if (contactId) {
    await prisma.sales.create({
      data: {
        org_id: publicPage.org.id,
        customer_id: contactId,
        sale_number: '',
        sale_date: new Date(new Date().toISOString().split('T')[0] + 'T00:00:00.000Z'),
        total_amount: 0,
        tax_amount: 0,
        discount_amount: 0,
        grand_total: 0,
        status: 'QUOTATION',
        shariah_mode: 'CASH',
        notes: `[SalesPage Lead] ${publicPage.page.title}\nMsg: ${input.message || '-'}`,
        created_by: publicPage.page.createdBy || null,
      } as any,
    })
  }

  return {
    page: publicPage.page,
    org: publicPage.org,
    lead: mapSalesPageLead(normalizeSalesPageLeadRow(data)),
  }
}
