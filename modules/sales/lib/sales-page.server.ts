import { cache } from 'react'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import {
  consumeAiTokensForGeneration,
  ensureAiTokenWallet,
  estimateCostFromUsageTokens,
  getAiTokenPolicyFromDb,
} from '@/modules/ai/lib/ai-token.server'
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

type LooseQueryResult = Promise<{ data: any; error: any }>

interface LooseQuery extends Promise<{ data: any; error: any }> {
  select: (columns?: string) => LooseQuery
  eq: (column: string, value: any) => LooseQuery
  neq: (column: string, value: any) => LooseQuery
  order: (column: string, options?: { ascending: boolean }) => LooseQuery
  limit: (count: number) => LooseQuery
  insert: (values: any) => LooseQuery
  update: (values: any) => LooseQuery
  upsert: (values: any) => LooseQuery
  delete: () => LooseQuery
  single: () => LooseQueryResult
  maybeSingle: () => LooseQueryResult
}

type LooseDb = {
  from: (table: string) => LooseQuery
}

function normalizePublicOrgIdentifier(value: string) {
  return value.trim().toLowerCase()
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)
}

async function resolvePublicOrg(admin: LooseDb, orgIdentifier: string): Promise<OrgSummary | null> {
  const normalizedIdentifier = normalizePublicOrgIdentifier(orgIdentifier)
  if (!normalizedIdentifier) return null

  const { data: slugOrg, error: slugError } = await admin
    .from('organizations')
    .select('id, name, slug, logo_url, is_active')
    .eq('slug', normalizedIdentifier)
    .eq('is_active', true)
    .maybeSingle()

  if (!slugError && slugOrg?.id) {
    return {
      id: String(slugOrg.id),
      name: String((slugOrg as { name?: unknown }).name || ''),
      slug: String((slugOrg as { slug?: unknown }).slug || slugOrg.id),
      logo_url: (slugOrg as { logo_url?: unknown }).logo_url as string | null,
    }
  }

  if (!looksLikeUuid(normalizedIdentifier)) {
    return null
  }

  const { data: idOrg, error: idError } = await admin
    .from('organizations')
    .select('id, name, slug, logo_url, is_active')
    .eq('id', normalizedIdentifier)
    .eq('is_active', true)
    .maybeSingle()

  if (idError || !idOrg?.id) {
    return null
  }

  return {
    id: String(idOrg.id),
    name: String((idOrg as { name?: unknown }).name || ''),
    slug: String((idOrg as { slug?: unknown }).slug || idOrg.id),
    logo_url: (idOrg as { logo_url?: unknown }).logo_url as string | null,
  }
}

async function getAuthedContext() {
  const supabase = await createClient()
  const db = supabase as unknown as LooseDb

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Tidak terautentikasi')
  }

  return { supabase, db, user }
}

async function getMemberOrg(orgId: string) {
  const { db, user } = await getAuthedContext()
  const { data: member, error } = await db
    .from('org_members')
    .select('role, organizations(id, name, slug, logo_url)')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (error || !member?.organizations) {
    throw new Error('Akses organisasi tidak ditemukan')
  }

  return {
    userId: user.id,
    role: String(member.role || 'staff'),
    org: member.organizations as OrgSummary,
  }
}

async function ensureUniqueSlug(db: LooseDb, orgId: string, baseSlug: string, ignoreId?: string) {
  const normalizedBase = normalizeSalesPageSlug(baseSlug) || `sales-page-${Date.now()}`
  let candidate = normalizedBase
  let counter = 1

  while (true) {
    let query = db
      .from('sales_pages')
      .select('id')
      .eq('org_id', orgId)
      .eq('slug', candidate)

    if (ignoreId) query = query.neq('id', ignoreId)

    const { data } = await query.maybeSingle()
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
  db: LooseDb,
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
    const tokenPolicy = await getAiTokenPolicyFromDb(db)
    const wallet = await ensureAiTokenWallet(db, orgId, tokenPolicy.lowBalanceThreshold)
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

    const usageCost = await estimateCostFromUsageTokens(db, {
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
      db,
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
  const { db } = await getAuthedContext()
  const { data, error } = await db
    .from('sales_pages')
    .select('*')
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data || []).map((row: SalesPageRecord) => mapSalesPageRecord(row))
}

export async function getSalesPageLeadsForOrg(orgId: string, salesPageId?: string): Promise<SalesPageLead[]> {
  const { db } = await getAuthedContext()
  let query = db
    .from('sales_page_leads')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (salesPageId) query = query.eq('sales_page_id', salesPageId)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data || []).map((row: SalesPageLeadRecord) => mapSalesPageLead(row))
}

export async function createGeneratedSalesPage(orgId: string, input: SalesPageGeneratorInput): Promise<SalesPageView> {
  const { db } = await getAuthedContext()
  const { userId, org } = await getMemberOrg(orgId)
  const initialPayload = buildSalesPagePayload(input, org.name)
  const aiPatch = await generateSalesPageAiDraft(db, orgId, userId, input, org.name)
  const payload = mergeGeneratedPayload(initialPayload, aiPatch)
  const slug = await ensureUniqueSlug(db, orgId, payload.slug)

  const { data, error } = await db
    .from('sales_pages')
    .insert({
      org_id: orgId,
      created_by: userId,
      updated_by: userId,
      ...toInsertPayload({ ...payload, slug }),
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return mapSalesPageRecord(data as SalesPageRecord)
}

export async function updateSalesPageContent(orgId: string, salesPageId: string, payload: SalesPagePayload): Promise<SalesPageView> {
  const { db } = await getAuthedContext()
  const { userId } = await getMemberOrg(orgId)
  const status = normalizeStatus(payload.status)
  const slug = await ensureUniqueSlug(db, orgId, payload.slug || payload.title, salesPageId)

  const { data, error } = await db
    .from('sales_pages')
    .update({
      updated_by: userId,
      published_at: status === 'PUBLISHED' ? new Date().toISOString() : null,
      ...toInsertPayload({ ...payload, status, slug }),
    })
    .eq('org_id', orgId)
    .eq('id', salesPageId)
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return mapSalesPageRecord(data as SalesPageRecord)
}

export async function duplicateSalesPage(orgId: string, salesPageId: string): Promise<SalesPageView> {
  const { db } = await getAuthedContext()
  const { userId } = await getMemberOrg(orgId)
  const { data: existing, error: existingError } = await db
    .from('sales_pages')
    .select('*')
    .eq('org_id', orgId)
    .eq('id', salesPageId)
    .single()

  if (existingError || !existing) throw new Error(existingError?.message || 'Sales page tidak ditemukan')

  const source = mapSalesPageRecord(existing as SalesPageRecord)
  const slug = await ensureUniqueSlug(db, orgId, `${source.slug}-copy`)

  const { data, error } = await db
    .from('sales_pages')
    .insert({
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
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return mapSalesPageRecord(data as SalesPageRecord)
}

export async function removeSalesPage(orgId: string, salesPageId: string) {
  const { db } = await getAuthedContext()
  await getMemberOrg(orgId)
  const { error } = await db
    .from('sales_pages')
    .delete()
    .eq('org_id', orgId)
    .eq('id', salesPageId)

  if (error) throw new Error(error.message)
}

export async function getPublicSalesPageByPath(orgSlug: string, pageSlug: string) {
  const admin = (await createAdminClient()) as unknown as LooseDb
  const org = await resolvePublicOrg(admin, orgSlug)
  if (!org?.id) return null
  const normalizedPageSlug = normalizeSalesPageSlug(pageSlug) || pageSlug.trim().toLowerCase()

  const { data: page, error: pageError } = await admin
    .from('sales_pages')
    .select('*')
    .eq('org_id', org.id)
    .eq('slug', normalizedPageSlug)
    .eq('status', 'PUBLISHED')
    .maybeSingle()

  if (pageError || !page) return null

  return {
    org: org as OrgSummary,
    page: mapSalesPageRecord(page as SalesPageRecord),
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

  const admin = (await createAdminClient()) as unknown as LooseDb

  const { data, error } = await admin
    .from('sales_page_leads')
    .insert({
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
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)

  let contactId = null
  if (input.phone) {
    const { data: existing } = await admin
      .from('contacts')
      .select('id')
      .eq('org_id', publicPage.org.id)
      .eq('phone', input.phone.trim())
      .maybeSingle()
    if (existing) contactId = existing.id
  }

  if (!contactId && input.email) {
    const { data: existing } = await admin
      .from('contacts')
      .select('id')
      .eq('org_id', publicPage.org.id)
      .eq('email', input.email.trim())
      .maybeSingle()
    if (existing) contactId = existing.id
  }

  if (!contactId) {
    const { data: contact } = await admin
      .from('contacts')
      .insert({
        org_id: publicPage.org.id,
        name: input.fullName.trim(),
        type: 'CUSTOMER',
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
      })
      .select('id')
      .maybeSingle()
    if (contact) contactId = contact.id
  }

  if (contactId) {
    await admin.from('sales').insert({
      org_id: publicPage.org.id,
      customer_id: contactId,
      sale_date: new Date().toISOString().split('T')[0],
      total_amount: 0,
      tax_amount: 0,
      discount_amount: 0,
      grand_total: 0,
      status: 'QUOTATION',
      shariah_mode: 'CASH',
      notes: `[SalesPage Lead] ${publicPage.page.title}\nMsg: ${input.message || '-'}`,
      created_by: publicPage.page.createdBy || null,
    })
  }

  return {
    page: publicPage.page,
    org: publicPage.org,
    lead: mapSalesPageLead(data as SalesPageLeadRecord),
  }
}
