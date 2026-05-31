'use client'

import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  Copy,
  ExternalLink,
  Globe,
  LayoutTemplate,
  Megaphone,
  MousePointerClick,
  Pencil,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react'
import { EmptyState, PageHeader, SafeButton, SectionCard, SectionHeader, StatCard, StatusBadge, useConfirm} from '@/components/ui/NizamUI'
import { formatDate, formatRupiah } from '@/lib/utils'
import {
  createSalesPage,
  deleteSalesPage,
  duplicateSalesPageAction,
  saveSalesPageAiProfile,
  updateSalesPage,
} from '@/modules/sales/actions/sales-page.actions'
import {
  buildSalesPageGeneratorBrief,
  buildSalesPagePayload,
  DEFAULT_SALES_PAGE_AI_PROFILE,
  mergeSalesPageGeneratorInputWithProfile,
  SALES_PAGE_CAMPAIGN_OBJECTIVE_OPTIONS,
  faqItemsToText,
  featuresToText,
  normalizeMetaPixelId,
  normalizeSalesPageCtaUrl,
  normalizeSalesPageSlug,
  proofPointsToText,
  SALES_PAGE_TONE_STYLE_OPTIONS,
  SALES_PAGE_TRAFFIC_SOURCE_OPTIONS,
  SALES_PAGE_TEMPLATE_OPTIONS,
  serializeFaqItems,
  serializeFeatures,
  serializeProofPoints,
  serializeTestimonials,
  testimonialsToText,
  type SalesPageAiProfilePayload,
  type SalesPageAiProfileView,
  type SalesPageCampaignObjectiveId,
  type SalesPageGeneratorInput,
  type SalesPageGeneratorContext,
  type SalesPageLead,
  type SalesPagePayload,
  type SalesPageStatus,
  type SalesPageTemplateId,
  type SalesPageToneStyleId,
  type SalesPageTrafficSourceId,
  type SalesPageView,
} from '@/modules/sales/lib/sales-page'
import type { ServiceOrderSeed } from '@/modules/services/lib/service-order'

type GeneratorFormState = {
  serviceSeedId: string
  templateId: SalesPageTemplateId
  title: string
  productName: string
  audience: string
  promise: string
  aiPrompt: string
  priceLabel: string
  heroImageUrl: string
  heroImageAlt: string
  primaryCtaLabel: string
  primaryCtaUrl: string
  secondaryCtaLabel: string
  secondaryCtaUrl: string
  metaPixelId: string
  campaignObjective: SalesPageCampaignObjectiveId
  trafficSource: SalesPageTrafficSourceId
  toneStyle: SalesPageToneStyleId
  targetPainPoints: string
  keyBenefits: string
  deliverables: string
  proofAssets: string
  objectionHandling: string
  urgencyOffer: string
}

type EditorFormState = {
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
  formTitle: string
  formSubtitle: string
  formCtaLabel: string
  formSuccessMessage: string
  proofPointsText: string
  benefitsText: string
  offerItemsText: string
  testimonialsText: string
  faqText: string
  customDomain: string
}

type BrandBrainFormState = {
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

type SalesPageStudioClientProps = {
  orgId: string
  orgName: string
  orgSlug: string
  pages: SalesPageView[]
  leads: SalesPageLead[]
  serviceSeeds: ServiceOrderSeed[]
  aiProfile: SalesPageAiProfileView
}

type TemplateFrameGuide = {
  frameTitle: string
  frameCaption: string
  sectionBlocks: string[]
  colorGuide: {
    name: string
    colors: string[]
  }
}

const TEMPLATE_FRAME_GUIDES: Record<SalesPageTemplateId, TemplateFrameGuide> = {
  LEAD_CAPTURE: {
    frameTitle: 'Hero + Lead Form',
    frameCaption: 'Fokus konversi cepat dari headline ke form.',
    sectionBlocks: ['Hero Value', 'Proof Points', 'Offer Stack', 'Lead Form', 'FAQ'],
    colorGuide: {
      name: 'Teal Trust',
      colors: ['#0F766E', '#CCFBF1', '#F0FDFA', '#134E4A'],
    },
  },
  WEBINAR: {
    frameTitle: 'Hero + Agenda + Register',
    frameCaption: 'Alur registrasi event dengan detail agenda dan speaker.',
    sectionBlocks: ['Hero Event', 'Agenda', 'Speaker', 'Bonus Replay', 'Register'],
    colorGuide: {
      name: 'Blue Authority',
      colors: ['#1D4ED8', '#DBEAFE', '#EFF6FF', '#1E3A8A'],
    },
  },
  PRODUCT_LAUNCH: {
    frameTitle: 'Launch Hero + Feature Stack',
    frameCaption: 'Menonjolkan fitur unggulan, urgency, dan CTA peluncuran.',
    sectionBlocks: ['Hero Visual', 'Key Features', 'Offer Value', 'Social Proof', 'CTA'],
    colorGuide: {
      name: 'Amber Energy',
      colors: ['#C2410C', '#FFEDD5', '#FFF7ED', '#7C2D12'],
    },
  },
  CONSULTING: {
    frameTitle: 'Authority + Problem-Solution',
    frameCaption: 'Posisikan keahlian lalu arahkan ke booking konsultasi.',
    sectionBlocks: ['Authority Hero', 'Pain Points', 'Method', 'Case Story', 'Book Call'],
    colorGuide: {
      name: 'Rose Executive',
      colors: ['#BE123C', '#FFE4E6', '#FFF1F2', '#881337'],
    },
  },
}

const GENERATOR_WORKFLOW_STEPS = [
  {
    id: '01',
    title: 'Pilih Frame',
    detail: 'Tentukan template funnel dan struktur hero yang paling cocok.',
  },
  {
    id: '02',
    title: 'Ambil Seed',
    detail: 'Prefill campaign dari job order atau context yang sudah ada.',
  },
  {
    id: '03',
    title: 'Bentuk Angle',
    detail: 'Isi objective, traffic, tone, pain point, dan benefit inti.',
  },
  {
    id: '04',
    title: 'Review Preview',
    detail: 'Lihat versi visual, CTA, offer stack, dan AI brief secara live.',
  },
  {
    id: '05',
    title: 'Generate Draft',
    detail: 'AI menyusun headline, proof, FAQ, dan form lead siap pakai.',
  },
] as const

function GeneratorSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.28)]">
      <div className="mb-5">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{eyebrow}</div>
        <h4 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">{title}</h4>
        <p className="mt-1 text-sm font-medium text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  )
}

function buildGeneratorContextFromState(state: GeneratorFormState, serviceSeedLabel?: string): SalesPageGeneratorContext {
  return {
    serviceSeedId: state.serviceSeedId || undefined,
    serviceSeedLabel,
    campaignObjective: state.campaignObjective,
    trafficSource: state.trafficSource,
    toneStyle: state.toneStyle,
    targetPainPoints: state.targetPainPoints.trim(),
    keyBenefits: state.keyBenefits.trim(),
    deliverables: state.deliverables.trim(),
    proofAssets: state.proofAssets.trim(),
    objectionHandling: state.objectionHandling.trim(),
    urgencyOffer: state.urgencyOffer.trim(),
  }
}

function buildPresetFromServiceSeed(seed: ServiceOrderSeed, templateId: SalesPageTemplateId): Partial<GeneratorFormState> {
  const genericPromise = templateId === 'CONSULTING'
    ? `Bantu prospek memetakan kebutuhan ${seed.description.toLowerCase()} dengan proses konsultasi yang jelas dan eksekusi yang rapi.`
    : `Tawarkan ${seed.description.toLowerCase()} dengan scope kerja yang jelas, respons cepat, dan hasil yang mudah dipahami buyer.`

  return {
    serviceSeedId: seed.id,
    title: `${seed.description} Campaign`,
    productName: seed.description,
    promise: seed.notes.trim() || genericPromise,
    priceLabel: seed.estimatedCost > 0 ? `Mulai dari ${formatRupiah(seed.estimatedCost)}` : '',
    targetPainPoints: seed.notes.trim() || 'Prospek butuh vendor yang responsif, scope kerja jelas, dan hasil yang bisa dipertanggungjawabkan.',
    keyBenefits: [
      'Respons dan follow-up lebih cepat untuk prospek yang siap action',
      'Scope kerja dan hasil layanan dijelaskan tanpa berputar-putar',
      'Closing lebih mudah karena value dan langkah berikutnya jelas',
    ].join('\n'),
    deliverables: [
      `Layanan inti: ${seed.description}`,
      'Konsultasi kebutuhan awal atau survey singkat',
      'Rangkuman scope, jadwal, dan tindak lanjut setelah deal',
    ].join('\n'),
    proofAssets: [
      seed.branchName ? `Dikerjakan oleh unit ${seed.branchName}` : '',
      seed.status === 'COMPLETED' ? 'Pernah dieksekusi sampai selesai di operasional' : '',
      'Scope kerja bisa dirinci sejak awal sebelum deal berjalan',
    ].filter(Boolean).join('\n'),
    objectionHandling: 'Jika masih ragu, mulai dari assessment singkat agar kebutuhan dan estimasi kerja bisa terlihat jelas lebih dulu.',
    urgencyOffer: seed.status === 'PENDING'
      ? 'Slot pengerjaan aktif terbatas. Prioritaskan booking lebih awal agar jadwal tidak bergeser.'
      : '',
  }
}

function toBrandBrainState(profile: SalesPageAiProfileView): BrandBrainFormState {
  return {
    brandPositioning: profile.brandPositioning,
    defaultAudience: profile.defaultAudience,
    defaultToneStyle: profile.defaultToneStyle,
    defaultPrimaryCtaLabel: profile.defaultPrimaryCtaLabel,
    defaultPrimaryCtaUrl: profile.defaultPrimaryCtaUrl,
    defaultHeroImageUrl: profile.defaultHeroImageUrl,
    defaultHeroImageAlt: profile.defaultHeroImageAlt,
    keyBenefits: profile.keyBenefits,
    proofAssets: profile.proofAssets,
    objectionHandling: profile.objectionHandling,
    aiRules: profile.aiRules,
  }
}

function toBrandBrainPayload(state: BrandBrainFormState): SalesPageAiProfilePayload {
  return {
    brandPositioning: state.brandPositioning.trim(),
    defaultAudience: state.defaultAudience.trim(),
    defaultToneStyle: state.defaultToneStyle,
    defaultPrimaryCtaLabel: state.defaultPrimaryCtaLabel.trim(),
    defaultPrimaryCtaUrl: state.defaultPrimaryCtaUrl.trim(),
    defaultHeroImageUrl: state.defaultHeroImageUrl.trim(),
    defaultHeroImageAlt: state.defaultHeroImageAlt.trim(),
    keyBenefits: state.keyBenefits.trim(),
    proofAssets: state.proofAssets.trim(),
    objectionHandling: state.objectionHandling.trim(),
    aiRules: state.aiRules.trim(),
  }
}

function initialGeneratorState(profile?: Partial<SalesPageAiProfilePayload>): GeneratorFormState {
  const defaultTemplate = SALES_PAGE_TEMPLATE_OPTIONS[0]
  const profileDefaults = { ...DEFAULT_SALES_PAGE_AI_PROFILE, ...profile }
  return {
    serviceSeedId: '',
    templateId: defaultTemplate.id,
    title: '',
    productName: '',
    audience: profileDefaults.defaultAudience,
    promise: '',
    aiPrompt: '',
    priceLabel: 'Mulai dari penawaran spesial hari ini',
    heroImageUrl: profileDefaults.defaultHeroImageUrl,
    heroImageAlt: profileDefaults.defaultHeroImageAlt,
    primaryCtaLabel: profileDefaults.defaultPrimaryCtaLabel || defaultTemplate.defaultPrimaryCtaLabel,
    primaryCtaUrl: profileDefaults.defaultPrimaryCtaUrl || defaultTemplate.defaultPrimaryCtaUrl,
    secondaryCtaLabel: defaultTemplate.defaultSecondaryCtaLabel,
    secondaryCtaUrl: defaultTemplate.defaultSecondaryCtaUrl,
    metaPixelId: '',
    campaignObjective: 'COLLECT_LEADS',
    trafficSource: 'META_ADS',
    toneStyle: profileDefaults.defaultToneStyle,
    targetPainPoints: '',
    keyBenefits: profileDefaults.keyBenefits,
    deliverables: '',
    proofAssets: profileDefaults.proofAssets,
    objectionHandling: profileDefaults.objectionHandling,
    urgencyOffer: '',
  }
}

function toEditorState(page: SalesPageView): EditorFormState {
  return {
    title: page.title,
    slug: page.slug,
    status: page.status,
    offerBadge: page.offerBadge,
    headline: page.headline,
    subheadline: page.subheadline,
    description: page.description,
    targetAudience: page.targetAudience,
    priceLabel: page.priceLabel,
    bonusText: page.bonusText,
    guaranteeText: page.guaranteeText,
    urgencyText: page.urgencyText,
    heroImageUrl: page.heroImageUrl,
    heroImageAlt: page.heroImageAlt,
    primaryCtaLabel: page.primaryCtaLabel,
    primaryCtaUrl: page.primaryCtaUrl,
    secondaryCtaLabel: page.secondaryCtaLabel,
    secondaryCtaUrl: page.secondaryCtaUrl,
    metaTitle: page.metaTitle,
    metaDescription: page.metaDescription,
    metaPixelId: page.metaPixelId,
    formTitle: page.formSettings.title,
    formSubtitle: page.formSettings.subtitle,
    formCtaLabel: page.formSettings.ctaLabel,
    formSuccessMessage: page.formSettings.successMessage,
    proofPointsText: proofPointsToText(page.proofPoints),
    benefitsText: featuresToText(page.benefits),
    offerItemsText: featuresToText(page.offerItems),
    testimonialsText: testimonialsToText(page.testimonials),
    faqText: faqItemsToText(page.faqItems),
    customDomain: page.formSettings.customDomain || '',
  }
}

function editorStateToPayload(state: EditorFormState, page: SalesPageView): SalesPagePayload {
  return {
    templateId: page.templateId,
    title: state.title.trim(),
    slug: normalizeSalesPageSlug(state.slug || state.title),
    status: state.status,
    offerBadge: state.offerBadge.trim(),
    headline: state.headline.trim(),
    subheadline: state.subheadline.trim(),
    description: state.description.trim(),
    targetAudience: state.targetAudience.trim(),
    priceLabel: state.priceLabel.trim(),
    bonusText: state.bonusText.trim(),
    guaranteeText: state.guaranteeText.trim(),
    urgencyText: state.urgencyText.trim(),
    heroImageUrl: state.heroImageUrl.trim(),
    heroImageAlt: state.heroImageAlt.trim(),
    primaryCtaLabel: state.primaryCtaLabel.trim(),
    primaryCtaUrl: normalizeSalesPageCtaUrl(state.primaryCtaUrl, '#lead-form'),
    secondaryCtaLabel: state.secondaryCtaLabel.trim(),
    secondaryCtaUrl: normalizeSalesPageCtaUrl(state.secondaryCtaUrl, '#benefits'),
    metaTitle: state.metaTitle.trim(),
    metaDescription: state.metaDescription.trim(),
    metaPixelId: normalizeMetaPixelId(state.metaPixelId),
    theme: page.theme,
    proofPoints: serializeProofPoints(state.proofPointsText),
    benefits: serializeFeatures(state.benefitsText),
    offerItems: serializeFeatures(state.offerItemsText),
    testimonials: serializeTestimonials(state.testimonialsText),
    faqItems: serializeFaqItems(state.faqText),
    formSettings: {
      enabled: page.formSettings.enabled,
      title: state.formTitle.trim(),
      subtitle: state.formSubtitle.trim(),
      ctaLabel: state.formCtaLabel.trim(),
      successMessage: state.formSuccessMessage.trim(),
      customDomain: state.customDomain.trim(),
    },
  }
}

function getStatusVariant(status: SalesPageStatus) {
  return status === 'PUBLISHED' ? 'success' : 'warning'
}

function getLeadCount(pageId: string, leads: SalesPageLead[]) {
  return leads.filter((lead) => lead.salesPageId === pageId).length
}

export default function SalesPageStudioClient({
  orgId,
  orgName,
  orgSlug,
  pages,
  leads,
  serviceSeeds,
  aiProfile,
}: SalesPageStudioClientProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [selectedPageId, setSelectedPageId] = useState<string | null>(pages[0]?.id || null)
  const { confirm, ConfirmUI } = useConfirm()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingPageId, setEditingPageId] = useState<string | null>(null)
  const [profileSnapshot, setProfileSnapshot] = useState<SalesPageAiProfileView>(aiProfile)
  const [profileState, setProfileState] = useState<BrandBrainFormState>(() => toBrandBrainState(aiProfile))
  const [createState, setCreateState] = useState<GeneratorFormState>(() => initialGeneratorState(aiProfile))
  const [editState, setEditState] = useState<EditorFormState | null>(pages[0] ? toEditorState(pages[0]) : null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<'create' | 'update' | 'duplicate' | 'delete' | 'publish' | 'domain' | 'profile' | null>(null)
  const [quickDomain, setQuickDomain] = useState<string>('')

  const selectedTemplate = useMemo(
    () => SALES_PAGE_TEMPLATE_OPTIONS.find((template) => template.id === createState.templateId) || SALES_PAGE_TEMPLATE_OPTIONS[0],
    [createState.templateId],
  )

  const selectedTemplateGuide = TEMPLATE_FRAME_GUIDES[selectedTemplate.id]
  const selectedServiceSeed = useMemo(
    () => serviceSeeds.find((seed) => seed.id === createState.serviceSeedId) || null,
    [createState.serviceSeedId, serviceSeeds],
  )
  const generatorContext = useMemo(
    () => buildGeneratorContextFromState(
      createState,
      selectedServiceSeed ? `${selectedServiceSeed.jobNumber} - ${selectedServiceSeed.description}` : '',
    ),
    [createState, selectedServiceSeed],
  )
  const baseGeneratorInput = useMemo(
    (): SalesPageGeneratorInput => ({
      templateId: createState.templateId,
      title: createState.title,
      productName: createState.productName,
      audience: createState.audience,
      promise: createState.promise,
      priceLabel: createState.priceLabel,
      primaryCtaLabel: createState.primaryCtaLabel,
      primaryCtaUrl: createState.primaryCtaUrl,
      secondaryCtaLabel: createState.secondaryCtaLabel,
      secondaryCtaUrl: createState.secondaryCtaUrl,
      aiPrompt: createState.aiPrompt,
      context: generatorContext,
    }),
    [createState, generatorContext],
  )
  const mergedGeneratorPreviewInput = useMemo(
    () => mergeSalesPageGeneratorInputWithProfile(baseGeneratorInput, profileSnapshot),
    [baseGeneratorInput, profileSnapshot],
  )
  const previewPage = useMemo(
    () => buildSalesPagePayload(mergedGeneratorPreviewInput, orgName),
    [mergedGeneratorPreviewInput, orgName],
  )
  const guidedBriefPreview = useMemo(
    () => buildSalesPageGeneratorBrief(mergedGeneratorPreviewInput),
    [mergedGeneratorPreviewInput],
  )
  const previewObjectiveLabel = useMemo(
    () => SALES_PAGE_CAMPAIGN_OBJECTIVE_OPTIONS.find((option) => option.id === mergedGeneratorPreviewInput.context?.campaignObjective)?.label || 'Belum dipilih',
    [mergedGeneratorPreviewInput],
  )
  const previewTrafficLabel = useMemo(
    () => SALES_PAGE_TRAFFIC_SOURCE_OPTIONS.find((option) => option.id === mergedGeneratorPreviewInput.context?.trafficSource)?.label || 'Belum dipilih',
    [mergedGeneratorPreviewInput],
  )
  const previewToneLabel = useMemo(
    () => SALES_PAGE_TONE_STYLE_OPTIONS.find((option) => option.id === mergedGeneratorPreviewInput.context?.toneStyle)?.label || 'Belum dipilih',
    [mergedGeneratorPreviewInput],
  )

  const selectedPage = useMemo(
    () => pages.find((page) => page.id === selectedPageId) || pages[0] || null,
    [pages, selectedPageId],
  )

  const selectedPageLeads = useMemo(
    () => (selectedPage ? leads.filter((lead) => lead.salesPageId === selectedPage.id) : leads),
    [leads, selectedPage],
  )

  useEffect(() => {
    if (selectedPage) {
      setQuickDomain(selectedPage.formSettings?.customDomain || '')
    }
  }, [selectedPage])

  useEffect(() => {
    setProfileSnapshot(aiProfile)
    setProfileState(toBrandBrainState(aiProfile))
  }, [aiProfile])

  const publishedCount = pages.filter((page) => page.status === 'PUBLISHED').length
  const pixelReadyCount = pages.filter((page) => Boolean(page.metaPixelId)).length

  useEffect(() => {
    if (!pages.length) {
      setSelectedPageId(null)
      setEditingPageId(null)
      setEditState(null)
      return
    }

    const exists = pages.some((page) => page.id === selectedPageId)
    if (!exists) {
      setSelectedPageId(pages[0].id)
    }
  }, [pages, selectedPageId])

  useEffect(() => {
    if (!editingPageId) return
    const page = pages.find((item) => item.id === editingPageId)
    if (page) {
      setEditState(toEditorState(page))
    }
  }, [pages, editingPageId])

  useEffect(() => {
    if (!success) return
    const timer = window.setTimeout(() => setSuccess(null), 2600)
    return () => window.clearTimeout(timer)
  }, [success])

  const selectedPublicPath = selectedPage ? `/sp/${orgSlug}/${selectedPage.slug}` : ''
  const previewPublicPath = `/sp/${orgSlug}/${previewPage.slug || 'preview'}`

  const copyPublicUrl = async (path: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`)
      setSuccess('URL publik berhasil disalin.')
    } catch {
      setError('Gagal menyalin URL publik.')
    }
  }

  const refreshPage = () => {
    startTransition(() => router.refresh())
  }

  const openCreateModal = () => {
    setError(null)
    setCreateState(initialGeneratorState(profileSnapshot))
    setShowCreateModal(true)
  }

  const handleTemplateChange = (nextTemplateId: SalesPageTemplateId) => {
    const nextTemplate = SALES_PAGE_TEMPLATE_OPTIONS.find((option) => option.id === nextTemplateId)
    if (!nextTemplate) return
    const objectiveByTemplate: Record<SalesPageTemplateId, SalesPageCampaignObjectiveId> = {
      LEAD_CAPTURE: 'COLLECT_LEADS',
      WEBINAR: 'REGISTER_EVENT',
      PRODUCT_LAUNCH: 'SELL_PRODUCT',
      CONSULTING: 'BOOK_CALL',
    }
    setCreateState((prev) => ({
      ...prev,
      templateId: nextTemplateId,
      primaryCtaLabel: nextTemplate.defaultPrimaryCtaLabel,
      primaryCtaUrl: nextTemplate.defaultPrimaryCtaUrl,
      secondaryCtaLabel: nextTemplate.defaultSecondaryCtaLabel,
      secondaryCtaUrl: nextTemplate.defaultSecondaryCtaUrl,
      campaignObjective: objectiveByTemplate[nextTemplateId],
    }))
  }

  const handleServiceSeedChange = (serviceSeedId: string) => {
    const nextSeed = serviceSeeds.find((seed) => seed.id === serviceSeedId)

    if (!nextSeed) {
      setCreateState((prev) => ({ ...prev, serviceSeedId: '' }))
      return
    }

    const preset = buildPresetFromServiceSeed(nextSeed, createState.templateId)
    setCreateState((prev) => ({
      ...prev,
      ...preset,
      serviceSeedId,
    }))
  }

  const handleSaveBrandBrain = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setBusyAction('profile')

    try {
      const payload = toBrandBrainPayload(profileState)
      const savedProfile = await saveSalesPageAiProfile(orgId, payload)
      setProfileSnapshot(savedProfile)
      setProfileState(toBrandBrainState(savedProfile))
      setSuccess('Brand Brain berhasil disimpan. Generator akan memakai default ini untuk draft berikutnya.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan Brand Brain.')
    } finally {
      setBusyAction(null)
    }
  }

  const handleCreatePage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setBusyAction('create')

    try {
      const payload = mergeSalesPageGeneratorInputWithProfile({
        ...baseGeneratorInput,
        title: createState.title.trim(),
        productName: createState.productName.trim(),
        audience: createState.audience.trim(),
        promise: createState.promise.trim(),
        aiPrompt: createState.aiPrompt.trim(),
        priceLabel: createState.priceLabel.trim(),
        heroImageUrl: createState.heroImageUrl.trim(),
        heroImageAlt: createState.heroImageAlt.trim(),
        primaryCtaLabel: createState.primaryCtaLabel.trim(),
        primaryCtaUrl: normalizeSalesPageCtaUrl(createState.primaryCtaUrl, '#lead-form'),
        secondaryCtaLabel: createState.secondaryCtaLabel.trim(),
        secondaryCtaUrl: normalizeSalesPageCtaUrl(createState.secondaryCtaUrl, '#benefits'),
        metaPixelId: createState.metaPixelId.trim(),
      }, profileSnapshot)

      if (!payload.title || !payload.productName || !payload.primaryCtaLabel || !payload.primaryCtaUrl) {
        throw new Error('Judul, nama produk, dan CTA utama wajib diisi.')
      }

      const createdPage = await createSalesPage(orgId, payload, orgSlug)
      setShowCreateModal(false)
      setCreateState(initialGeneratorState(profileSnapshot))
      setSelectedPageId(createdPage.id)
      setSuccess('Sales page draft berhasil dibuat.')
      refreshPage()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat sales page.')
    } finally {
      setBusyAction(null)
    }
  }

  const handleSavePage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedPage || !editState) return

    setError(null)
    setBusyAction('update')

    try {
      const payload = editorStateToPayload(editState, selectedPage)
      if (!payload.title || !payload.headline || !payload.primaryCtaLabel || !payload.primaryCtaUrl) {
        throw new Error('Judul, headline, dan CTA utama wajib diisi.')
      }

      await updateSalesPage(orgId, selectedPage.id, payload, orgSlug, selectedPage.slug)
      setEditingPageId(null)
      setSuccess(
        payload.status === 'PUBLISHED'
          ? 'Sales page berhasil disimpan dan dipublikasikan.'
          : 'Perubahan sales page berhasil disimpan.',
      )
      refreshPage()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan perubahan.')
    } finally {
      setBusyAction(null)
    }
  }

  const handleUpdateDomain = async () => {
    if (!selectedPage) return
    setError(null)
    setBusyAction('domain')
    try {
      const editMode = toEditorState(selectedPage)
      editMode.customDomain = quickDomain
      const payload = editorStateToPayload(editMode, selectedPage)
      await updateSalesPage(orgId, selectedPage.id, payload, orgSlug, selectedPage.slug)
      setSuccess('Domain khusus berhasil diperbarui.')
      refreshPage()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan domain khusus.')
    } finally {
      setBusyAction(null)
    }
  }

  const handleDuplicate = async (page: SalesPageView) => {
    setError(null)
    setBusyAction('duplicate')
    try {
      const duplicated = await duplicateSalesPageAction(orgId, page.id, orgSlug)
      setSelectedPageId(duplicated.id)
      setSuccess('Sales page berhasil diduplikasi sebagai draft.')
      refreshPage()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menduplikasi sales page.')
    } finally {
      setBusyAction(null)
    }
  }

  const handleDelete = async (page: SalesPageView) => {
    if (!await confirm(`Hapus sales page "${page.title}"? Lead yang terkait juga akan ikut terhapus.`)) return

    setError(null)
    setBusyAction('delete')
    try {
      await deleteSalesPage(orgId, page.id, orgSlug, page.slug)
      if (selectedPageId === page.id) {
        const fallback = pages.find((item) => item.id !== page.id)
        setSelectedPageId(fallback?.id || null)
      }
      setSuccess('Sales page berhasil dihapus.')
      refreshPage()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus sales page.')
    } finally {
      setBusyAction(null)
    }
  }

  const handlePublish = async (page: SalesPageView) => {
    if (page.status === 'PUBLISHED') {
      setSuccess('Sales page sudah berstatus publish.')
      return
    }

    setError(null)
    setBusyAction('publish')
    try {
      const nextState = { ...toEditorState(page), status: 'PUBLISHED' as SalesPageStatus }
      const payload = editorStateToPayload(nextState, page)
      await updateSalesPage(orgId, page.id, payload, orgSlug, page.slug)
      setSuccess('Sales page berhasil diaktifkan dan dipublikasikan.')
      refreshPage()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengaktifkan publish.')
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <div className="max-w-7xl mx-auto pb-24 space-y-12">
      <PageHeader
        icon={<Megaphone />}
        title="Sales Page Studio"
        subtitle="Bangun halaman penawaran siap iklan, publish ke URL publik, aktifkan Meta Pixel, dan tangkap lead langsung ke dashboard."
        tag="Growth Engine"
        actions={
          <SafeButton variant="primary" icon={<Wand2 size={18} />} onClick={openCreateModal}>
            Generate Sales Page
          </SafeButton>
        }
      />

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm font-bold text-rose-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-sm font-bold text-emerald-700">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Total Halaman" value={pages.length} icon={LayoutTemplate} color="blue" sub="Semua draft dan halaman tayang" />
        <StatCard label="Sudah Publish" value={publishedCount} icon={Globe} color="emerald" sub="Live dan siap trafik" />
        <StatCard label="Pixel Ready" value={pixelReadyCount} icon={ShieldCheck} color="amber" sub="Meta Pixel ID terpasang" />
        <StatCard label="Lead Masuk" value={leads.length} icon={MousePointerClick} color="indigo" sub="Semua sales page" />
      </div>

      <SectionCard>
        <SectionHeader
          title="Brand Brain"
          subtitle="Simpan positioning, CTA default, trust asset, dan guardrail AI sekali untuk dipakai ulang di semua draft berikutnya."
          actions={
            <SafeButton
              type="submit"
              form="brand-brain-form"
              variant="primary"
              size="sm"
              icon={<Sparkles size={14} />}
              isLoading={busyAction === 'profile'}
            >
              Simpan Brand Brain
            </SafeButton>
          }
        />

        <form id="brand-brain-form" onSubmit={handleSaveBrandBrain} className="p-8 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Reusable Defaults</div>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Draft baru akan memakai default audience, tone, CTA, hero visual, benefit, dan proof dari sini.
              </p>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Terakhir Disimpan</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {profileSnapshot.updatedAt ? formatDate(profileSnapshot.updatedAt, 'short') : 'Belum pernah'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Brand Positioning</label>
              <textarea
                value={profileState.brandPositioning}
                onChange={(event) => setProfileState((prev) => ({ ...prev, brandPositioning: event.target.value }))}
                rows={4}
                placeholder="Contoh: Kami membantu bisnis jasa menjual lebih meyakinkan dengan penawaran yang jelas, cepat, dan enak difollow-up."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Default Tone</label>
              <select
                value={profileState.defaultToneStyle}
                onChange={(event) => setProfileState((prev) => ({ ...prev, defaultToneStyle: event.target.value as SalesPageToneStyleId }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
              >
                {SALES_PAGE_TONE_STYLE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
              <p className="text-[11px] font-medium text-slate-400">
                {SALES_PAGE_TONE_STYLE_OPTIONS.find((option) => option.id === profileState.defaultToneStyle)?.description}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Default Audience</label>
              <input
                value={profileState.defaultAudience}
                onChange={(event) => setProfileState((prev) => ({ ...prev, defaultAudience: event.target.value }))}
                placeholder="Contoh: owner jasa, kontraktor, atau retail multi cabang"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Default CTA Label</label>
              <input
                value={profileState.defaultPrimaryCtaLabel}
                onChange={(event) => setProfileState((prev) => ({ ...prev, defaultPrimaryCtaLabel: event.target.value }))}
                placeholder="Contoh: Jadwalkan Survey"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Default CTA URL</label>
              <input
                value={profileState.defaultPrimaryCtaUrl}
                onChange={(event) => setProfileState((prev) => ({ ...prev, defaultPrimaryCtaUrl: event.target.value }))}
                placeholder="#lead-form atau https://wa.me/..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Default Hero Image URL</label>
              <input
                value={profileState.defaultHeroImageUrl}
                onChange={(event) => setProfileState((prev) => ({ ...prev, defaultHeroImageUrl: event.target.value }))}
                placeholder="https://..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Default Hero Image Alt</label>
              <input
                value={profileState.defaultHeroImageAlt}
                onChange={(event) => setProfileState((prev) => ({ ...prev, defaultHeroImageAlt: event.target.value }))}
                placeholder="Deskripsi visual default"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Default Key Benefits</label>
              <textarea
                value={profileState.keyBenefits}
                onChange={(event) => setProfileState((prev) => ({ ...prev, keyBenefits: event.target.value }))}
                rows={4}
                placeholder={`Satu benefit per baris. Contoh:
Respons cepat
Hasil kerja rapi
Follow-up lebih gampang`}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Default Proof Assets</label>
              <textarea
                value={profileState.proofAssets}
                onChange={(event) => setProfileState((prev) => ({ ...prev, proofAssets: event.target.value }))}
                rows={4}
                placeholder={`Satu bukti per baris. Contoh:
Tim berpengalaman
Respon cepat
Proses kerja transparan`}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Default Objection Handling</label>
              <textarea
                value={profileState.objectionHandling}
                onChange={(event) => setProfileState((prev) => ({ ...prev, objectionHandling: event.target.value }))}
                rows={4}
                placeholder="Contoh: Mulai dari assessment singkat dulu agar scope dan estimasi bisa jelas sebelum deal."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">AI Guardrails</label>
              <textarea
                value={profileState.aiRules}
                onChange={(event) => setProfileState((prev) => ({ ...prev, aiRules: event.target.value }))}
                rows={4}
                placeholder="Contoh: Hindari klaim berlebihan, gunakan bahasa ringkas, jangan terlalu ramai, CTA fokus ke konsultasi."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </form>
      </SectionCard>

      <SectionCard className="overflow-hidden">
        <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.2),_transparent_28%),linear-gradient(145deg,#0f172a_0%,#111827_55%,#1e293b_100%)] px-8 py-8 text-white">
            <div className="absolute -left-12 top-12 h-40 w-40 rounded-full bg-cyan-400/20 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-48 w-48 rounded-full bg-blue-500/20 blur-3xl" />
            <div className="relative space-y-6">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200">AI Campaign Architect</div>
                <h3 className="mt-3 max-w-xl text-3xl font-semibold tracking-tight text-white">
                  User tidak lagi isi prompt kosong. User tinggal isi section, AI yang merakit strategi dan draft halaman.
                </h3>
                <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-slate-300">
                  Sekarang alurnya lebih terasa seperti builder: ambil seed dari job order, isi angle campaign, lalu lihat preview halaman dan brief AI secara live sebelum draft dibuat.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4 backdrop-blur-sm">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-cyan-100">Brand Brain</div>
                  <div className="mt-2 text-lg font-semibold text-white">
                    {profileSnapshot.brandPositioning ? 'Aktif' : 'Belum Diisi'}
                  </div>
                  <p className="mt-1 text-xs font-medium leading-relaxed text-slate-300">
                    Default tone, CTA, proof, dan guardrail AI tersimpan untuk semua draft berikutnya.
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4 backdrop-blur-sm">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-cyan-100">Service Seeds</div>
                  <div className="mt-2 text-lg font-semibold text-white">{serviceSeeds.length}</div>
                  <p className="mt-1 text-xs font-medium leading-relaxed text-slate-300">
                    Job order bisa langsung dipakai untuk prefill offer, pain point, dan value stack.
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4 backdrop-blur-sm">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-cyan-100">Live Preview</div>
                  <div className="mt-2 text-lg font-semibold text-white">Aktif</div>
                  <p className="mt-1 text-xs font-medium leading-relaxed text-slate-300">
                    Objective, CTA, brief, dan mini visual landing page sekarang terlihat sebelum generate.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <SafeButton variant="white" icon={<Sparkles size={16} />} onClick={openCreateModal}>
                  Buka AI Builder
                </SafeButton>
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-bold text-slate-300">
                  5-step guided workflow
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-8 py-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Workflow Preview</div>
                <h4 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Alur baru generator sekarang kelihatan jelas</h4>
              </div>
              <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Guided
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {GENERATOR_WORKFLOW_STEPS.map((step) => (
                <div
                  key={step.id}
                  className="flex items-start gap-4 rounded-[26px] border border-slate-200 bg-white px-5 py-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.22)]"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white">
                    {step.id}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{step.title}</div>
                    <p className="mt-1 text-sm font-medium leading-relaxed text-slate-500">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.85fr] gap-8">
        <SectionCard className="overflow-hidden">
          <SectionHeader
            title="Library Sales Page"
            subtitle="Klik halaman untuk melihat ringkasan dan lead terkait."
            actions={
              <SafeButton variant="white" size="sm" icon={<Sparkles size={14} />} onClick={openCreateModal}>
                Page Baru
              </SafeButton>
            }
          />

          {!pages.length ? (
            <div className="p-5">
              <EmptyState
                icon={LayoutTemplate}
                title="Belum ada sales page"
                description="Mulai dari generator cepat. Sistem akan membentuk struktur hero, benefit, offer, FAQ, dan formulir lead secara otomatis."
                action={
                  <SafeButton variant="primary" icon={<Wand2 size={18} />} onClick={openCreateModal}>
                    Buat Draft Pertama
                  </SafeButton>
                }
              />
            </div>
          ) : (
            <div className="p-6 space-y-4">
              {pages.map((page) => {
                const isSelected = selectedPage?.id === page.id
                const publicPath = `/sp/${orgSlug}/${page.slug}`
                const leadCount = getLeadCount(page.id, leads)

                return (
                  <div
                    key={page.id}
                    className={`w-full rounded-xl border p-6 transition-all ${
                      isSelected
                        ? 'border-slate-900 bg-slate-900 text-white shadow-md shadow-slate-900/10'
                        : 'border-slate-100 bg-white hover:border-slate-300 hover:-translate-y-0.5'
                    }`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <button type="button" onClick={() => setSelectedPageId(page.id)} className="flex-1 text-left space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge label={page.status} variant={getStatusVariant(page.status)} />
                          {page.metaPixelId ? <StatusBadge label="Meta Pixel" variant="indigo" /> : <StatusBadge label="Tanpa Pixel" variant="neutral" />}
                          <span className={`text-[10px] font-semibold uppercase tracking-wide ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                            {leadCount} lead
                          </span>
                        </div>
                        <div>
                          <h3 className={`text-2xl font-semibold tracking-tight ${isSelected ? 'text-white' : 'text-slate-900'}`}>{page.title}</h3>
                          <p className={`text-sm font-medium mt-1 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>{page.headline}</p>
                        </div>
                        <div className="text-[11px] font-bold text-slate-400">
                          /sp/{orgSlug}/{page.slug} • Update {formatDate(page.updatedAt, 'short')}
                        </div>
                      </button>

                      <div className="flex flex-wrap gap-2">
                        <SafeButton
                          variant={isSelected ? 'white' : 'ghost'}
                          size="sm"
                          icon={<Copy size={14} />}
                          onClick={() => copyPublicUrl(publicPath)}
                        >
                          Copy URL
                        </SafeButton>
                        <SafeButton
                          variant={isSelected ? 'white' : 'ghost'}
                          size="sm"
                          icon={<Pencil size={14} />}
                          onClick={() => {
                            setSelectedPageId(page.id)
                            setEditingPageId(page.id)
                            setEditState(toEditorState(page))
                          }}
                        >
                          Edit
                        </SafeButton>
                        <SafeButton
                          variant={isSelected ? 'white' : 'primary'}
                          size="sm"
                          icon={<Globe size={14} />}
                          isLoading={busyAction === 'publish'}
                          onClick={() => handlePublish(page)}
                        >
                          Aktivasi
                        </SafeButton>
                        <SafeButton
                          variant={isSelected ? 'white' : 'ghost'}
                          size="sm"
                          icon={<Copy size={14} />}
                          isLoading={busyAction === 'duplicate'}
                          onClick={() => handleDuplicate(page)}
                        >
                          Duplikat
                        </SafeButton>
                        <SafeButton
                          variant={isSelected ? 'white' : 'danger'}
                          size="sm"
                          icon={<Trash2 size={14} />}
                          isLoading={busyAction === 'delete'}
                          onClick={() => handleDelete(page)}
                        >
                          Hapus
                        </SafeButton>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>

        <div className="space-y-8">
          <SectionCard>
            <SectionHeader title="Ringkasan Aktif" subtitle="Preview cepat untuk halaman yang sedang dipilih." />
            {selectedPage ? (
              <div className="p-8 space-y-6">
                <div
                  className="rounded-[32px] p-6 border relative overflow-hidden"
                  style={{
                    background: `linear-gradient(145deg, ${selectedPage.theme.surface} 0%, ${selectedPage.theme.accentContrast} 100%)`,
                    borderColor: selectedPage.theme.border,
                  }}
                >
                  <div
                    className="absolute -right-10 -top-10 w-40 h-40 rounded-full blur-3xl opacity-60"
                    style={{ backgroundColor: selectedPage.theme.accentSoft }}
                  />
                  <div className="relative space-y-4">
                    <StatusBadge label={selectedPage.status} variant={getStatusVariant(selectedPage.status)} />
                    <div>
                      <h3 className="text-2xl font-semibold tracking-tight text-slate-900">{selectedPage.headline}</h3>
                      <p className="text-sm text-slate-600 font-medium mt-2 leading-relaxed">{selectedPage.subheadline || selectedPage.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {selectedPage.status !== 'PUBLISHED' && (
                        <SafeButton
                          variant="primary"
                          size="sm"
                          icon={<Globe size={14} />}
                          isLoading={busyAction === 'publish'}
                          onClick={() => handlePublish(selectedPage)}
                        >
                          Aktivasi Publish
                        </SafeButton>
                      )}
                      <a
                        href={selectedPublicPath}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-xs font-semibold text-white shadow-xl"
                        style={{ backgroundColor: selectedPage.theme.accent }}
                      >
                        Buka Halaman
                        <ExternalLink size={14} />
                      </a>
                      <button
                        type="button"
                        onClick={() => copyPublicUrl(selectedPublicPath)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-xs font-semibold text-slate-700"
                      >
                        Copy URL
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-[24px] border border-slate-100 bg-slate-50 px-5 py-4">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Lead Masuk</div>
                    <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{selectedPageLeads.length}</div>
                  </div>
                  <div className="rounded-[24px] border border-slate-100 bg-slate-50 px-5 py-4">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Meta Pixel</div>
                    <div className="mt-2 text-sm font-semibold tracking-tight text-slate-900">
                      {selectedPage.metaPixelId ? selectedPage.metaPixelId : 'Belum diisi'}
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-100 bg-slate-50 px-5 py-4 space-y-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Custom Domain (DNS)</div>
                  <div className="flex flex-col sm:flex-row gap-3">
                     <input
                        value={quickDomain}
                        onChange={(e) => setQuickDomain(e.target.value)}
                        placeholder="Cth: promo.bisnisanda.com"
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 shadow-sm"
                     />
                     <SafeButton
                        variant="primary"
                        icon={<Globe size={14} />}
                        isLoading={busyAction === 'domain'}
                        onClick={handleUpdateDomain}
                     >
                        Terapkan
                     </SafeButton>
                  </div>
                  {quickDomain && quickDomain === selectedPage.formSettings?.customDomain && (
                    <p className="text-[10px] font-bold text-slate-500 mt-2 bg-slate-100 p-2 rounded-xl">
                      Arahkan <strong>A Record / CNAME</strong> domain ini ke server ERP NIZAM agar bisa diakses.
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Value Stack</div>
                  <div className="space-y-3">
                    {selectedPage.offerItems.slice(0, 3).map((item) => (
                      <div key={item.title} className="rounded-xl border border-slate-100 bg-white px-4 py-4">
                        <div className="font-semibold text-slate-900 text-sm">{item.title}</div>
                        <div className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">{item.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8">
                <EmptyState
                  icon={Globe}
                  title="Belum ada halaman terpilih"
                  description="Pilih sales page dari library di sebelah kiri untuk melihat ringkasannya."
                />
              </div>
            )}
          </SectionCard>

          <SectionCard>
            <SectionHeader title="Lead Capture" subtitle="Lead terbaru dari halaman yang sedang dipilih." />
            <div className="p-6 space-y-4">
              {!selectedPageLeads.length ? (
                <EmptyState
                  icon={MousePointerClick}
                  title="Belum ada lead"
                  description="Setelah halaman tayang dan visitor mengisi formulir, data lead akan muncul di sini."
                />
              ) : (
                selectedPageLeads.slice(0, 8).map((lead) => (
                  <div key={lead.id} className="rounded-[24px] border border-slate-100 bg-white px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">{lead.fullName}</div>
                        <div className="text-xs text-slate-500 font-medium mt-1">
                          {lead.email || lead.phone || 'Kontak belum lengkap'}
                        </div>
                      </div>
                      <StatusBadge label={lead.status} variant="info" />
                    </div>
                    {lead.message && <p className="text-sm text-slate-600 font-medium mt-3 leading-relaxed">{lead.message}</p>}
                    <div className="mt-3 text-[11px] font-bold text-slate-400">
                      {formatDate(lead.createdAt, 'short')}
                      {lead.utmParams.utm_source ? ` • ${lead.utmParams.utm_source}` : ''}
                      {lead.utmParams.utm_campaign ? ` / ${lead.utmParams.utm_campaign}` : ''}
                    </div>
                  </div>
                ))
              )}
            </div>
          </SectionCard>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <div className="relative w-full max-w-7xl rounded-xl bg-white shadow-md overflow-hidden">
            <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_26%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-8 py-7">
              <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-blue-500">Generator</div>
                  <h3 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Generate Sales Page Baru</h3>
                  <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-slate-500">
                    Ini sekarang bukan lagi form datar. Isi step by step, lalu lihat objective, visual hero, CTA, offer stack, dan brief AI berubah secara live sebelum draft dibuat.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[24px] border border-white/70 bg-white/80 px-4 py-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.18)] backdrop-blur-sm">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Auto Fill</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">Job Order + Brand Brain</div>
                    <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-500">Gunakan seed dan default brand supaya user tidak mulai dari nol.</p>
                  </div>
                  <div className="rounded-[24px] border border-white/70 bg-white/80 px-4 py-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.18)] backdrop-blur-sm">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Live Feedback</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">Preview + Brief</div>
                    <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-500">User bisa langsung lihat bentuk output sebelum menekan generate.</p>
                  </div>
                  <div className="rounded-[24px] border border-white/70 bg-white/80 px-4 py-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.18)] backdrop-blur-sm">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Draft Engine</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">Siap Publish</div>
                    <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-500">AI tetap menyusun hero, proof, FAQ, dan form lead siap edit.</p>
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleCreatePage} className="max-h-[82vh] overflow-y-auto p-6 lg:p-8">
              <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {GENERATOR_WORKFLOW_STEPS.map((step) => (
                  <div
                    key={step.id}
                    className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-4 py-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.16)]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-xs font-semibold text-white">
                        {step.id}
                      </div>
                      <div className="text-sm font-semibold text-slate-900">{step.title}</div>
                    </div>
                    <p className="mt-3 text-[11px] font-medium leading-relaxed text-slate-500">{step.detail}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
                <div className="space-y-6">
                  <GeneratorSection
                    eyebrow="Template Layout"
                    title="Pilih Frame Halaman"
                    description="Tentukan struktur funnel yang paling cocok sebelum Anda mengisi campaign detail."
                  >
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                        {SALES_PAGE_TEMPLATE_OPTIONS.map((template) => {
                          const isSelected = createState.templateId === template.id
                          const guide = TEMPLATE_FRAME_GUIDES[template.id]
                          return (
                            <button
                              key={template.id}
                              type="button"
                              onClick={() => handleTemplateChange(template.id)}
                              className={`rounded-[24px] border p-4 text-left transition-all ${
                                isSelected
                                  ? 'border-slate-900 bg-slate-900 text-white shadow-xl shadow-slate-900/15'
                                  : 'border-slate-200 bg-white hover:border-slate-400'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className={`text-xs font-semibold tracking-tight ${isSelected ? 'text-white' : 'text-slate-900'}`}>{template.label}</div>
                                  <p className={`mt-1 text-[11px] font-medium leading-relaxed ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                                    {template.description}
                                  </p>
                                </div>
                                <div className={`mt-0.5 h-5 w-5 rounded-full border-2 ${isSelected ? 'border-white bg-white' : 'border-slate-300'}`}>
                                  {isSelected && <div className="m-0.5 h-2.5 w-2.5 rounded-full bg-slate-900" />}
                                </div>
                              </div>

                              <div className={`mt-3 rounded-xl border p-3 ${isSelected ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
                                <div className={`rounded-xl border p-3 ${isSelected ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}>
                                  <div className={`h-2 w-24 rounded-full ${isSelected ? 'bg-slate-600' : 'bg-slate-300'}`} />
                                  <div className={`mt-2 h-2 w-full rounded-full ${isSelected ? 'bg-slate-700' : 'bg-slate-200'}`} />
                                  <div className={`mt-1 h-2 w-10/12 rounded-full ${isSelected ? 'bg-slate-700' : 'bg-slate-200'}`} />
                                  <div className="mt-3 flex gap-2">
                                    <div className={`h-6 flex-1 rounded-lg ${isSelected ? 'bg-slate-500' : 'bg-slate-300'}`} />
                                    <div className={`h-6 w-16 rounded-lg ${isSelected ? 'bg-slate-700' : 'bg-slate-200'}`} />
                                  </div>
                                </div>
                                <div className="mt-2 grid grid-cols-3 gap-2">
                                  {guide.sectionBlocks.slice(0, 3).map((block) => (
                                    <div
                                      key={`${template.id}-${block}`}
                                      className={`rounded-lg px-2 py-1 text-[9px] font-semibold uppercase tracking-wide ${
                                        isSelected ? 'bg-slate-700 text-slate-300' : 'bg-white text-slate-500 border border-slate-200'
                                      }`}
                                    >
                                      {block}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>

                      <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Color Guide</div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{selectedTemplateGuide.colorGuide.name}</div>
                            <p className="text-[11px] font-medium text-slate-500 mt-0.5">{selectedTemplateGuide.frameTitle}: {selectedTemplateGuide.frameCaption}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {selectedTemplateGuide.colorGuide.colors.map((color) => (
                              <div key={`${selectedTemplate.id}-${color}`} className="flex flex-col items-center gap-1">
                                <span
                                  className="h-7 w-7 rounded-full border border-white shadow ring-1 ring-slate-200"
                                  style={{ backgroundColor: color }}
                                />
                                <span className="text-[9px] font-bold text-slate-400">{color.replace('#', '')}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </GeneratorSection>

                  <GeneratorSection
                    eyebrow="Quick Start"
                    title="Gunakan Data Job Order Sebagai Seed"
                    description="Pilih job order agar draft offer, price label, pain point, dan deliverables terisi lebih cepat."
                  >
                    <div className="grid grid-cols-1 md:grid-cols-[1.3fr_0.7fr] gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Seed Job Order</label>
                        <select
                          value={createState.serviceSeedId}
                          onChange={(event) => handleServiceSeedChange(event.target.value)}
                          className="w-full rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500"
                        >
                          <option value="">Pilih job order sebagai dasar campaign</option>
                          {serviceSeeds.map((seed) => (
                            <option key={seed.id} value={seed.id}>
                              {seed.jobNumber} - {seed.description}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Status Seed</div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">
                          {selectedServiceSeed ? selectedServiceSeed.status : 'Belum dipilih'}
                        </div>
                        <p className="mt-1 text-[11px] font-medium text-slate-500">
                          {selectedServiceSeed
                            ? selectedServiceSeed.branchName || 'Tanpa info unit'
                            : serviceSeeds.length
                              ? 'Pilih seed untuk prefill campaign.'
                              : 'Belum ada job order yang bisa dipakai sebagai seed.'}
                        </p>
                      </div>
                    </div>
                  </GeneratorSection>

                  <GeneratorSection
                    eyebrow="Campaign Basics"
                    title="Tulis Inti Penawarannya"
                    description="Bagian ini mendefinisikan headline utama dan siapa yang akan Anda incar."
                  >
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Judul Campaign</label>
                          <input
                            value={createState.title}
                            onChange={(event) => setCreateState((prev) => ({ ...prev, title: event.target.value }))}
                            placeholder="Cth: Sales Page NIZAM ERP Retail"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Nama Produk / Offer</label>
                          <input
                            value={createState.productName}
                            onChange={(event) => setCreateState((prev) => ({ ...prev, productName: event.target.value }))}
                            placeholder="Cth: NIZAM ERP"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Target Audience</label>
                          <input
                            value={createState.audience}
                            onChange={(event) => setCreateState((prev) => ({ ...prev, audience: event.target.value }))}
                            placeholder="Cth: owner retail multi-cabang"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Price Label</label>
                          <input
                            value={createState.priceLabel}
                            onChange={(event) => setCreateState((prev) => ({ ...prev, priceLabel: event.target.value }))}
                            placeholder="Cth: Mulai dari Rp 499rb / bulan"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Janji / Hook Utama</label>
                        <textarea
                          value={createState.promise}
                          onChange={(event) => setCreateState((prev) => ({ ...prev, promise: event.target.value }))}
                          rows={4}
                          placeholder="Cth: Satukan penjualan, stok, kas, dan laporan dalam satu dashboard yang siap dipakai tim."
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-blue-500"
                          required
                        />
                      </div>
                    </div>
                  </GeneratorSection>

                  <GeneratorSection
                    eyebrow="Campaign Engine"
                    title="Isi Konteks Campaign"
                    description="Field-field ini membentuk strategi dan brief AI yang akan dipakai saat generate."
                  >
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="space-y-2">
                          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Objective</label>
                          <select
                            value={createState.campaignObjective}
                            onChange={(event) => setCreateState((prev) => ({ ...prev, campaignObjective: event.target.value as SalesPageCampaignObjectiveId }))}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                          >
                            {SALES_PAGE_CAMPAIGN_OBJECTIVE_OPTIONS.map((option) => (
                              <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                          </select>
                          <p className="text-[11px] font-medium text-slate-400">
                            {SALES_PAGE_CAMPAIGN_OBJECTIVE_OPTIONS.find((option) => option.id === createState.campaignObjective)?.description}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Traffic Source</label>
                          <select
                            value={createState.trafficSource}
                            onChange={(event) => setCreateState((prev) => ({ ...prev, trafficSource: event.target.value as SalesPageTrafficSourceId }))}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                          >
                            {SALES_PAGE_TRAFFIC_SOURCE_OPTIONS.map((option) => (
                              <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                          </select>
                          <p className="text-[11px] font-medium text-slate-400">
                            {SALES_PAGE_TRAFFIC_SOURCE_OPTIONS.find((option) => option.id === createState.trafficSource)?.description}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Tone Style</label>
                          <select
                            value={createState.toneStyle}
                            onChange={(event) => setCreateState((prev) => ({ ...prev, toneStyle: event.target.value as SalesPageToneStyleId }))}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                          >
                            {SALES_PAGE_TONE_STYLE_OPTIONS.map((option) => (
                              <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                          </select>
                          <p className="text-[11px] font-medium text-slate-400">
                            {SALES_PAGE_TONE_STYLE_OPTIONS.find((option) => option.id === createState.toneStyle)?.description}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Pain Point Utama</label>
                          <textarea
                            value={createState.targetPainPoints}
                            onChange={(event) => setCreateState((prev) => ({ ...prev, targetPainPoints: event.target.value }))}
                            rows={4}
                            placeholder="Contoh: prospek bingung pilih vendor, follow-up lambat, hasil kerja tidak transparan"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Benefit Kunci</label>
                          <textarea
                            value={createState.keyBenefits}
                            onChange={(event) => setCreateState((prev) => ({ ...prev, keyBenefits: event.target.value }))}
                            rows={4}
                            placeholder={`Satu benefit per baris. Contoh:
Proses cepat
Harga transparan
Laporan hasil rapi`}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Deliverables / Offer Stack</label>
                          <textarea
                            value={createState.deliverables}
                            onChange={(event) => setCreateState((prev) => ({ ...prev, deliverables: event.target.value }))}
                            rows={4}
                            placeholder={`Satu item per baris. Contoh:
Survey awal
Eksekusi layanan
Laporan & rekomendasi`}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Proof / Trust Assets</label>
                          <textarea
                            value={createState.proofAssets}
                            onChange={(event) => setCreateState((prev) => ({ ...prev, proofAssets: event.target.value }))}
                            rows={4}
                            placeholder="Contoh: Tim berpengalaman, respon cepat, pernah handle puluhan project"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Objection Handling</label>
                          <textarea
                            value={createState.objectionHandling}
                            onChange={(event) => setCreateState((prev) => ({ ...prev, objectionHandling: event.target.value }))}
                            rows={4}
                            placeholder="Contoh: Mulai dari assessment singkat agar scope dan estimasi bisa jelas lebih dulu."
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Urgency / Promo</label>
                          <textarea
                            value={createState.urgencyOffer}
                            onChange={(event) => setCreateState((prev) => ({ ...prev, urgencyOffer: event.target.value }))}
                            rows={4}
                            placeholder="Contoh: Slot implementasi batch bulan ini terbatas."
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Catatan Tambahan untuk AI</label>
                        <textarea
                          value={createState.aiPrompt}
                          onChange={(event) => setCreateState((prev) => ({ ...prev, aiPrompt: event.target.value }))}
                          rows={3}
                          placeholder="Opsional. Misalnya: jangan terlalu ramai, hindari bahasa bombastis, arahkan CTA ke demo 30 menit."
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </GeneratorSection>

                  <GeneratorSection
                    eyebrow="CTA & Assets"
                    title="Atur Aksi dan Visual"
                    description="Lengkapi CTA, visual hero, serta pixel agar halaman siap dipakai dan dilacak."
                  >
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">CTA Utama</label>
                          <input
                            value={createState.primaryCtaLabel}
                            onChange={(event) => setCreateState((prev) => ({ ...prev, primaryCtaLabel: event.target.value }))}
                            placeholder="Cth: Jadwalkan Demo"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">URL CTA Utama</label>
                          <input
                            value={createState.primaryCtaUrl}
                            onChange={(event) => setCreateState((prev) => ({ ...prev, primaryCtaUrl: event.target.value }))}
                            placeholder="#lead-form atau https://wa.me/..."
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Hero Image URL</label>
                          <input
                            value={createState.heroImageUrl}
                            onChange={(event) => setCreateState((prev) => ({ ...prev, heroImageUrl: event.target.value }))}
                            placeholder="https://..."
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Hero Image Alt</label>
                          <input
                            value={createState.heroImageAlt}
                            onChange={(event) => setCreateState((prev) => ({ ...prev, heroImageAlt: event.target.value }))}
                            placeholder="Deskripsi gambar hero"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="space-y-2 md:col-span-1">
                          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">CTA Sekunder</label>
                          <input
                            value={createState.secondaryCtaLabel}
                            onChange={(event) => setCreateState((prev) => ({ ...prev, secondaryCtaLabel: event.target.value }))}
                            placeholder="Cth: Lihat Benefit"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="space-y-2 md:col-span-1">
                          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">URL CTA Sekunder</label>
                          <input
                            value={createState.secondaryCtaUrl}
                            onChange={(event) => setCreateState((prev) => ({ ...prev, secondaryCtaUrl: event.target.value }))}
                            placeholder="#benefits"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="space-y-2 md:col-span-1">
                          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Meta Pixel ID</label>
                          <input
                            value={createState.metaPixelId}
                            onChange={(event) => setCreateState((prev) => ({ ...prev, metaPixelId: event.target.value }))}
                            placeholder="123456789012345"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  </GeneratorSection>

                  <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Ready To Generate</div>
                      <p className="mt-1 text-sm font-medium text-slate-500">
                        Preview di kanan akan mengikuti input ini secara live sebelum draft dibuat.
                      </p>
                    </div>
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setShowCreateModal(false)}
                        className="px-5 py-3 text-sm font-semibold text-slate-400"
                      >
                        Batal
                      </button>
                      <SafeButton type="submit" variant="primary" icon={<Wand2 size={16} />} isLoading={busyAction === 'create'}>
                        Generate Draft
                      </SafeButton>
                    </div>
                  </div>
                </div>

                <aside className="space-y-4 lg:sticky lg:top-0 self-start">
                  <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.28)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Live Preview</div>
                        <p className="mt-1 text-[11px] font-medium text-slate-500">Ringkasan strategi dan halaman yang sedang terbentuk.</p>
                      </div>
                      <Sparkles size={18} className="text-slate-400" />
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                        <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Objective</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">{previewObjectiveLabel}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                        <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Traffic</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">{previewTrafficLabel}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                        <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Tone</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">{previewToneLabel}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                        <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Preview Path</div>
                        <div className="mt-1 text-xs font-semibold text-slate-900">{previewPublicPath}</div>
                      </div>
                    </div>
                  </div>

                  <div
                    className="rounded-[34px] border p-5 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)]"
                    style={{
                      borderColor: previewPage.theme.border,
                      background: previewPage.templateId === 'CONSULTING'
                        ? `linear-gradient(155deg, #0f172a 0%, #111827 30%, ${previewPage.theme.surface} 100%)`
                        : `radial-gradient(circle at top right, ${previewPage.theme.accentSoft} 0%, transparent 28%), linear-gradient(145deg, ${previewPage.theme.surface} 0%, #ffffff 58%, ${previewPage.theme.surfaceAlt} 100%)`,
                    }}
                  >
                    <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] ${previewPage.templateId === 'CONSULTING' ? 'border-slate-700 bg-slate-900/60 text-slate-200' : 'bg-white/90 text-slate-700'}`} style={{ borderColor: previewPage.templateId === 'CONSULTING' ? undefined : previewPage.theme.border }}>
                      {previewPage.offerBadge || 'Offer Preview'}
                    </div>

                    <div className="mt-5 space-y-4">
                      <h4 className={`text-3xl font-semibold tracking-tight ${previewPage.templateId === 'CONSULTING' ? 'text-white' : 'text-slate-950'}`}>
                        {previewPage.headline}
                      </h4>
                      <p className={`text-sm font-medium leading-relaxed ${previewPage.templateId === 'CONSULTING' ? 'text-slate-300' : 'text-slate-600'}`}>
                        {previewPage.subheadline || previewPage.description}
                      </p>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <div
                        className="inline-flex items-center rounded-[20px] px-5 py-3 text-xs font-semibold text-white shadow-xl"
                        style={{ backgroundColor: previewPage.theme.accent }}
                      >
                        {previewPage.primaryCtaLabel}
                      </div>
                      {previewPage.secondaryCtaLabel && (
                        <div className={`inline-flex items-center rounded-[20px] border px-5 py-3 text-xs font-semibold ${previewPage.templateId === 'CONSULTING' ? 'border-slate-700 bg-slate-900/40 text-slate-100' : 'bg-white text-slate-800'}`} style={{ borderColor: previewPage.templateId === 'CONSULTING' ? undefined : previewPage.theme.border }}>
                          {previewPage.secondaryCtaLabel}
                        </div>
                      )}
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      {previewPage.proofPoints.slice(0, 3).map((point) => (
                        <div
                          key={`${point.label}-${point.value}`}
                          className={`rounded-xl border px-4 py-4 ${previewPage.templateId === 'CONSULTING' ? 'border-slate-700 bg-slate-900/50' : 'bg-white/90'}`}
                          style={{ borderColor: previewPage.templateId === 'CONSULTING' ? undefined : previewPage.theme.border }}
                        >
                          <div className={`text-[9px] font-semibold uppercase tracking-wide ${previewPage.templateId === 'CONSULTING' ? 'text-slate-400' : ''}`} style={{ color: previewPage.templateId === 'CONSULTING' ? undefined : previewPage.theme.muted }}>
                            {point.label}
                          </div>
                          <div className={`mt-2 text-sm font-semibold ${previewPage.templateId === 'CONSULTING' ? 'text-white' : 'text-slate-900'}`}>{point.value}</div>
                        </div>
                      ))}
                    </div>

                    <div
                      className="mt-5 rounded-xl border p-4"
                      style={{
                        borderColor: previewPage.theme.border,
                        background: previewPage.heroImageUrl
                          ? `linear-gradient(180deg, rgba(15,23,42,0.08), rgba(15,23,42,0.18)), url(${previewPage.heroImageUrl}) center / cover no-repeat`
                          : `linear-gradient(145deg, ${previewPage.theme.accent} 0%, ${previewPage.theme.text} 100%)`,
                      }}
                    >
                      <div className="rounded-[24px] border border-white/15 bg-white/10 p-4 text-white backdrop-blur-sm">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-white/70">Offer Value</div>
                        <div className="mt-2 text-2xl font-semibold tracking-tight">{previewPage.priceLabel || 'Penawaran spesial'}</div>
                        <div className="mt-4 space-y-2 text-xs font-bold leading-relaxed text-white/85">
                          <div>{previewPage.bonusText}</div>
                          <div>{previewPage.guaranteeText}</div>
                          <div>{previewPage.urgencyText}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.28)]">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Offer Stack Preview</div>
                    <div className="mt-4 space-y-3">
                      {previewPage.offerItems.slice(0, 3).map((item) => (
                        <div key={item.title} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                          <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                          <div className="mt-1 text-xs font-medium leading-relaxed text-slate-500">{item.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.28)]">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Brief Preview</div>
                    <p className="mt-1 text-[11px] font-medium text-slate-500">Inilah ringkasan yang akan dipakai engine AI untuk generate copy.</p>
                    <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 px-4 py-4 text-[11px] font-medium leading-relaxed text-slate-600">
                      {guidedBriefPreview || 'Isi konteks campaign untuk melihat brief otomatis.'}
                    </pre>
                  </div>
                </aside>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingPageId && editState && selectedPage && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setEditingPageId(null)} />
          <div className="relative w-full max-w-5xl rounded-xl bg-white shadow-md overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-indigo-500">Editor</div>
              <h3 className="text-2xl font-semibold tracking-tight text-slate-900 mt-2">Edit Sales Page</h3>
              <p className="text-sm text-slate-500 font-medium mt-2">
                Format textarea:
                <span className="font-semibold text-slate-700"> `Label | Value`</span> untuk proof point,
                <span className="font-semibold text-slate-700"> `Title | Description`</span> untuk benefit/offer,
                dan
                <span className="font-semibold text-slate-700"> `Nama | Role | Quote`</span> untuk testimonial.
              </p>
            </div>

            <form onSubmit={handleSavePage} className="max-h-[82vh] overflow-y-auto p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Judul</label>
                  <input
                    value={editState.title}
                    onChange={(event) => setEditState((prev) => (prev ? { ...prev, title: event.target.value } : prev))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Status</label>
                  <select
                    value={editState.status}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, status: event.target.value as SalesPageStatus } : prev))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Published</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Headline</label>
                  <input
                    value={editState.headline}
                    onChange={(event) => setEditState((prev) => (prev ? { ...prev, headline: event.target.value } : prev))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Slug</label>
                  <input
                    value={editState.slug}
                    onChange={(event) => setEditState((prev) => (prev ? { ...prev, slug: event.target.value } : prev))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Offer Badge</label>
                  <input
                    value={editState.offerBadge}
                    onChange={(event) => setEditState((prev) => (prev ? { ...prev, offerBadge: event.target.value } : prev))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Target Audience</label>
                  <input
                    value={editState.targetAudience}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, targetAudience: event.target.value } : prev))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Subheadline</label>
                <textarea
                  value={editState.subheadline}
                  onChange={(event) => setEditState((prev) => (prev ? { ...prev, subheadline: event.target.value } : prev))}
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Deskripsi</label>
                <textarea
                  value={editState.description}
                  onChange={(event) => setEditState((prev) => (prev ? { ...prev, description: event.target.value } : prev))}
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Price Label</label>
                  <input
                    value={editState.priceLabel}
                    onChange={(event) => setEditState((prev) => (prev ? { ...prev, priceLabel: event.target.value } : prev))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Meta Pixel ID</label>
                  <input
                    value={editState.metaPixelId}
                    onChange={(event) => setEditState((prev) => (prev ? { ...prev, metaPixelId: event.target.value } : prev))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Bonus Text</label>
                  <input
                    value={editState.bonusText}
                    onChange={(event) => setEditState((prev) => (prev ? { ...prev, bonusText: event.target.value } : prev))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Guarantee Text</label>
                  <input
                    value={editState.guaranteeText}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, guaranteeText: event.target.value } : prev))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Urgency Text</label>
                  <input
                    value={editState.urgencyText}
                    onChange={(event) => setEditState((prev) => (prev ? { ...prev, urgencyText: event.target.value } : prev))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Hero Image URL</label>
                  <input
                    value={editState.heroImageUrl}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, heroImageUrl: event.target.value } : prev))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Hero Image Alt</label>
                  <input
                    value={editState.heroImageAlt}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, heroImageAlt: event.target.value } : prev))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">CTA Utama</label>
                  <input
                    value={editState.primaryCtaLabel}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, primaryCtaLabel: event.target.value } : prev))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                    required
                  />
                  <input
                    value={editState.primaryCtaUrl}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, primaryCtaUrl: event.target.value } : prev))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                    placeholder="#lead-form / https://..."
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">CTA Sekunder</label>
                  <input
                    value={editState.secondaryCtaLabel}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, secondaryCtaLabel: event.target.value } : prev))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                  />
                  <input
                    value={editState.secondaryCtaUrl}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, secondaryCtaUrl: event.target.value } : prev))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                    placeholder="#benefits / https://..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Meta Title</label>
                  <input
                    value={editState.metaTitle}
                    onChange={(event) => setEditState((prev) => (prev ? { ...prev, metaTitle: event.target.value } : prev))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Meta Description</label>
                  <textarea
                    value={editState.metaDescription}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, metaDescription: event.target.value } : prev))
                    }
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Judul Form Lead</label>
                  <input
                    value={editState.formTitle}
                    onChange={(event) => setEditState((prev) => (prev ? { ...prev, formTitle: event.target.value } : prev))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Label Tombol Form</label>
                  <input
                    value={editState.formCtaLabel}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, formCtaLabel: event.target.value } : prev))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Subtitle Form Lead</label>
                  <textarea
                    value={editState.formSubtitle}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, formSubtitle: event.target.value } : prev))
                    }
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Pesan Sukses</label>
                  <textarea
                    value={editState.formSuccessMessage}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, formSuccessMessage: event.target.value } : prev))
                    }
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Proof Points</label>
                  <textarea
                    value={editState.proofPointsText}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, proofPointsText: event.target.value } : prev))
                    }
                    rows={6}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Benefits</label>
                  <textarea
                    value={editState.benefitsText}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, benefitsText: event.target.value } : prev))
                    }
                    rows={6}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Offer Stack</label>
                  <textarea
                    value={editState.offerItemsText}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, offerItemsText: event.target.value } : prev))
                    }
                    rows={6}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Testimonials</label>
                  <textarea
                    value={editState.testimonialsText}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, testimonialsText: event.target.value } : prev))
                    }
                    rows={6}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">FAQ</label>
                <textarea
                  value={editState.faqText}
                  onChange={(event) => setEditState((prev) => (prev ? { ...prev, faqText: event.target.value } : prev))}
                  rows={7}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingPageId(null)}
                  className="px-5 py-3 text-sm font-semibold text-slate-400"
                >
                  Tutup
                </button>
                <SafeButton type="submit" variant="indigo" icon={<Pencil size={16} />} isLoading={busyAction === 'update'}>
                  Simpan Perubahan
                </SafeButton>
              </div>
            </form>
          </div>
        </div>
      )}
      {ConfirmUI}
    </div>
  )
}
