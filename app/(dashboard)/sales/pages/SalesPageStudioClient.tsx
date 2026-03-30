'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
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
import { EmptyState, PageHeader, SafeButton, SectionCard, SectionHeader, StatCard, StatusBadge } from '@/components/ui/NizamUI'
import { formatDate } from '@/lib/utils'
import {
  createSalesPage,
  deleteSalesPage,
  duplicateSalesPageAction,
  updateSalesPage,
} from '@/modules/sales/actions/sales-page.actions'
import {
  faqItemsToText,
  featuresToText,
  normalizeMetaPixelId,
  normalizeSalesPageCtaUrl,
  normalizeSalesPageSlug,
  proofPointsToText,
  SALES_PAGE_TEMPLATE_OPTIONS,
  serializeFaqItems,
  serializeFeatures,
  serializeProofPoints,
  serializeTestimonials,
  testimonialsToText,
  type SalesPageGeneratorInput,
  type SalesPageLead,
  type SalesPagePayload,
  type SalesPageStatus,
  type SalesPageTemplateId,
  type SalesPageView,
} from '@/modules/sales/lib/sales-page'

type GeneratorFormState = {
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

type SalesPageStudioClientProps = {
  orgId: string
  orgSlug: string
  pages: SalesPageView[]
  leads: SalesPageLead[]
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

function initialGeneratorState(): GeneratorFormState {
  const defaultTemplate = SALES_PAGE_TEMPLATE_OPTIONS[0]
  return {
    templateId: defaultTemplate.id,
    title: '',
    productName: '',
    audience: '',
    promise: '',
    aiPrompt: '',
    priceLabel: 'Mulai dari penawaran spesial hari ini',
    heroImageUrl: '',
    heroImageAlt: '',
    primaryCtaLabel: defaultTemplate.defaultPrimaryCtaLabel,
    primaryCtaUrl: defaultTemplate.defaultPrimaryCtaUrl,
    secondaryCtaLabel: defaultTemplate.defaultSecondaryCtaLabel,
    secondaryCtaUrl: defaultTemplate.defaultSecondaryCtaUrl,
    metaPixelId: '',
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
  orgSlug,
  pages,
  leads,
}: SalesPageStudioClientProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [selectedPageId, setSelectedPageId] = useState<string | null>(pages[0]?.id || null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingPageId, setEditingPageId] = useState<string | null>(null)
  const [createState, setCreateState] = useState<GeneratorFormState>(() => initialGeneratorState())
  const [editState, setEditState] = useState<EditorFormState | null>(pages[0] ? toEditorState(pages[0]) : null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<'create' | 'update' | 'duplicate' | 'delete' | 'publish' | 'domain' | null>(null)
  const [quickDomain, setQuickDomain] = useState<string>('')

  const selectedTemplate = useMemo(
    () => SALES_PAGE_TEMPLATE_OPTIONS.find((template) => template.id === createState.templateId) || SALES_PAGE_TEMPLATE_OPTIONS[0],
    [createState.templateId],
  )

  const selectedTemplateGuide = TEMPLATE_FRAME_GUIDES[selectedTemplate.id]

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

  const handleTemplateChange = (nextTemplateId: SalesPageTemplateId) => {
    const nextTemplate = SALES_PAGE_TEMPLATE_OPTIONS.find((option) => option.id === nextTemplateId)
    if (!nextTemplate) return
    setCreateState((prev) => ({
      ...prev,
      templateId: nextTemplateId,
      primaryCtaLabel: nextTemplate.defaultPrimaryCtaLabel,
      primaryCtaUrl: nextTemplate.defaultPrimaryCtaUrl,
      secondaryCtaLabel: nextTemplate.defaultSecondaryCtaLabel,
      secondaryCtaUrl: nextTemplate.defaultSecondaryCtaUrl,
    }))
  }

  const handleCreatePage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setBusyAction('create')

    try {
      const payload: SalesPageGeneratorInput = {
        templateId: createState.templateId,
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
      }

      if (!payload.title || !payload.productName || !payload.primaryCtaLabel || !payload.primaryCtaUrl) {
        throw new Error('Judul, nama produk, dan CTA utama wajib diisi.')
      }

      const createdPage = await createSalesPage(orgId, payload, orgSlug)
      setShowCreateModal(false)
      setCreateState(initialGeneratorState())
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
    if (!window.confirm(`Hapus sales page "${page.title}"? Lead yang terkait juga akan ikut terhapus.`)) return

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
          <SafeButton variant="primary" icon={<Wand2 size={18} />} onClick={() => setShowCreateModal(true)}>
            Generate Sales Page
          </SafeButton>
        }
      />

      {error && (
        <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-6 py-4 text-sm font-bold text-rose-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 px-6 py-4 text-sm font-bold text-emerald-700">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Total Halaman" value={pages.length} icon={LayoutTemplate} color="blue" sub="Semua draft dan halaman tayang" />
        <StatCard label="Sudah Publish" value={publishedCount} icon={Globe} color="emerald" sub="Live dan siap trafik" />
        <StatCard label="Pixel Ready" value={pixelReadyCount} icon={ShieldCheck} color="amber" sub="Meta Pixel ID terpasang" />
        <StatCard label="Lead Masuk" value={leads.length} icon={MousePointerClick} color="indigo" sub="Semua sales page" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.85fr] gap-8">
        <SectionCard className="overflow-hidden">
          <SectionHeader
            title="Library Sales Page"
            subtitle="Klik halaman untuk melihat ringkasan dan lead terkait."
            actions={
              <SafeButton variant="white" size="sm" icon={<Sparkles size={14} />} onClick={() => setShowCreateModal(true)}>
                Page Baru
              </SafeButton>
            }
          />

          {!pages.length ? (
            <div className="p-10">
              <EmptyState
                icon={LayoutTemplate}
                title="Belum ada sales page"
                description="Mulai dari generator cepat. Sistem akan membentuk struktur hero, benefit, offer, FAQ, dan formulir lead secara otomatis."
                action={
                  <SafeButton variant="primary" icon={<Wand2 size={18} />} onClick={() => setShowCreateModal(true)}>
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
                    className={`w-full rounded-[28px] border p-6 transition-all ${
                      isSelected
                        ? 'border-slate-900 bg-slate-900 text-white shadow-2xl shadow-slate-900/10'
                        : 'border-slate-100 bg-white hover:border-slate-300 hover:-translate-y-0.5'
                    }`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <button type="button" onClick={() => setSelectedPageId(page.id)} className="flex-1 text-left space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge label={page.status} variant={getStatusVariant(page.status)} />
                          {page.metaPixelId ? <StatusBadge label="Meta Pixel" variant="indigo" /> : <StatusBadge label="Tanpa Pixel" variant="neutral" />}
                          <span className={`text-[10px] font-black uppercase tracking-[0.18em] ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                            {leadCount} lead
                          </span>
                        </div>
                        <div>
                          <h3 className={`text-2xl font-black tracking-tight ${isSelected ? 'text-white' : 'text-slate-900'}`}>{page.title}</h3>
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
                      <h3 className="text-2xl font-black tracking-tight text-slate-900">{selectedPage.headline}</h3>
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
                        className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-xs font-black text-white shadow-xl"
                        style={{ backgroundColor: selectedPage.theme.accent }}
                      >
                        Buka Halaman
                        <ExternalLink size={14} />
                      </a>
                      <button
                        type="button"
                        onClick={() => copyPublicUrl(selectedPublicPath)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-black text-slate-700"
                      >
                        Copy URL
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-[24px] border border-slate-100 bg-slate-50 px-5 py-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Lead Masuk</div>
                    <div className="mt-2 text-2xl font-black tracking-tight text-slate-900">{selectedPageLeads.length}</div>
                  </div>
                  <div className="rounded-[24px] border border-slate-100 bg-slate-50 px-5 py-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Meta Pixel</div>
                    <div className="mt-2 text-sm font-black tracking-tight text-slate-900">
                      {selectedPage.metaPixelId ? selectedPage.metaPixelId : 'Belum diisi'}
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-100 bg-slate-50 px-5 py-4 space-y-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Custom Domain (DNS)</div>
                  <div className="flex flex-col sm:flex-row gap-3">
                     <input
                        value={quickDomain}
                        onChange={(e) => setQuickDomain(e.target.value)}
                        placeholder="Cth: promo.bisnisanda.com"
                        className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 shadow-sm"
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
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Value Stack</div>
                  <div className="space-y-3">
                    {selectedPage.offerItems.slice(0, 3).map((item) => (
                      <div key={item.title} className="rounded-[22px] border border-slate-100 bg-white px-4 py-4">
                        <div className="font-black text-slate-900 text-sm">{item.title}</div>
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
                        <div className="font-black text-slate-900">{lead.fullName}</div>
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
          <div className="relative w-full max-w-4xl rounded-[40px] bg-white shadow-2xl overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-500">Generator</div>
              <h3 className="text-2xl font-black tracking-tight text-slate-900 mt-2">Generate Sales Page Baru</h3>
              <p className="text-sm text-slate-500 font-medium mt-2">
                Isi brief inti. Sistem akan membentuk struktur hero, value stack, FAQ, dan form lead untuk Anda.
              </p>
            </div>

            <form onSubmit={handleCreatePage} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Template Layout</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                            <div className={`text-xs font-black tracking-tight ${isSelected ? 'text-white' : 'text-slate-900'}`}>{template.label}</div>
                            <p className={`mt-1 text-[11px] font-medium leading-relaxed ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                              {template.description}
                            </p>
                          </div>
                          <div
                            className={`mt-0.5 h-5 w-5 rounded-full border-2 ${isSelected ? 'border-white bg-white' : 'border-slate-300'}`}
                          >
                            {isSelected && <div className="m-0.5 h-2.5 w-2.5 rounded-full bg-slate-900" />}
                          </div>
                        </div>

                        <div className={`mt-3 rounded-2xl border p-3 ${isSelected ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
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
                                className={`rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-wide ${
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
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Color Guide</div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-slate-900">{selectedTemplateGuide.colorGuide.name}</div>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Judul Campaign</label>
                  <input
                    value={createState.title}
                    onChange={(event) => setCreateState((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="Cth: Sales Page NIZAM ERP Retail"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Nama Produk / Offer</label>
                  <input
                    value={createState.productName}
                    onChange={(event) => setCreateState((prev) => ({ ...prev, productName: event.target.value }))}
                    placeholder="Cth: NIZAM ERP"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Target Audience</label>
                  <input
                    value={createState.audience}
                    onChange={(event) => setCreateState((prev) => ({ ...prev, audience: event.target.value }))}
                    placeholder="Cth: owner retail multi-cabang"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Price Label</label>
                  <input
                    value={createState.priceLabel}
                    onChange={(event) => setCreateState((prev) => ({ ...prev, priceLabel: event.target.value }))}
                    placeholder="Cth: Mulai dari Rp 499rb / bulan"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Janji / Hook Utama</label>
                <textarea
                  value={createState.promise}
                  onChange={(event) => setCreateState((prev) => ({ ...prev, promise: event.target.value }))}
                  rows={4}
                  placeholder="Cth: Satukan penjualan, stok, kas, dan laporan dalam satu dashboard yang siap dipakai tim."
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Prompt AI / Brief Campaign</label>
                <textarea
                  value={createState.aiPrompt}
                  onChange={(event) => setCreateState((prev) => ({ ...prev, aiPrompt: event.target.value }))}
                  rows={4}
                  placeholder="Contoh: Tone tegas tapi friendly, target owner retail F&B 2-10 cabang, fokus pain point stok bocor dan laporan lambat, CTA ajak demo 30 menit."
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-blue-500"
                />
                <p className="text-[11px] font-medium text-slate-400">
                  Opsional. Jika AI key aktif, brief ini dipakai untuk menghasilkan copy otomatis sesuai template.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">CTA Utama</label>
                  <input
                    value={createState.primaryCtaLabel}
                    onChange={(event) => setCreateState((prev) => ({ ...prev, primaryCtaLabel: event.target.value }))}
                    placeholder="Cth: Jadwalkan Demo"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">URL CTA Utama</label>
                  <input
                    value={createState.primaryCtaUrl}
                    onChange={(event) => setCreateState((prev) => ({ ...prev, primaryCtaUrl: event.target.value }))}
                    placeholder="#lead-form atau https://wa.me/..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Hero Image URL</label>
                  <input
                    value={createState.heroImageUrl}
                    onChange={(event) => setCreateState((prev) => ({ ...prev, heroImageUrl: event.target.value }))}
                    placeholder="https://..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Hero Image Alt</label>
                  <input
                    value={createState.heroImageAlt}
                    onChange={(event) => setCreateState((prev) => ({ ...prev, heroImageAlt: event.target.value }))}
                    placeholder="Deskripsi gambar hero"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2 md:col-span-1">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">CTA Sekunder</label>
                  <input
                    value={createState.secondaryCtaLabel}
                    onChange={(event) => setCreateState((prev) => ({ ...prev, secondaryCtaLabel: event.target.value }))}
                    placeholder="Cth: Lihat Benefit"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">URL CTA Sekunder</label>
                  <input
                    value={createState.secondaryCtaUrl}
                    onChange={(event) => setCreateState((prev) => ({ ...prev, secondaryCtaUrl: event.target.value }))}
                    placeholder="#benefits"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Meta Pixel ID</label>
                  <input
                    value={createState.metaPixelId}
                    onChange={(event) => setCreateState((prev) => ({ ...prev, metaPixelId: event.target.value }))}
                    placeholder="123456789012345"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-3 text-sm font-black text-slate-400"
                >
                  Batal
                </button>
                <SafeButton type="submit" variant="primary" icon={<Wand2 size={16} />} isLoading={busyAction === 'create'}>
                  Generate Draft
                </SafeButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingPageId && editState && selectedPage && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setEditingPageId(null)} />
          <div className="relative w-full max-w-5xl rounded-[40px] bg-white shadow-2xl overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-500">Editor</div>
              <h3 className="text-2xl font-black tracking-tight text-slate-900 mt-2">Edit Sales Page</h3>
              <p className="text-sm text-slate-500 font-medium mt-2">
                Format textarea:
                <span className="font-black text-slate-700"> `Label | Value`</span> untuk proof point,
                <span className="font-black text-slate-700"> `Title | Description`</span> untuk benefit/offer,
                dan
                <span className="font-black text-slate-700"> `Nama | Role | Quote`</span> untuk testimonial.
              </p>
            </div>

            <form onSubmit={handleSavePage} className="max-h-[82vh] overflow-y-auto p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Judul</label>
                  <input
                    value={editState.title}
                    onChange={(event) => setEditState((prev) => (prev ? { ...prev, title: event.target.value } : prev))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Status</label>
                  <select
                    value={editState.status}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, status: event.target.value as SalesPageStatus } : prev))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Published</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Headline</label>
                  <input
                    value={editState.headline}
                    onChange={(event) => setEditState((prev) => (prev ? { ...prev, headline: event.target.value } : prev))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Slug</label>
                  <input
                    value={editState.slug}
                    onChange={(event) => setEditState((prev) => (prev ? { ...prev, slug: event.target.value } : prev))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Offer Badge</label>
                  <input
                    value={editState.offerBadge}
                    onChange={(event) => setEditState((prev) => (prev ? { ...prev, offerBadge: event.target.value } : prev))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Target Audience</label>
                  <input
                    value={editState.targetAudience}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, targetAudience: event.target.value } : prev))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Subheadline</label>
                <textarea
                  value={editState.subheadline}
                  onChange={(event) => setEditState((prev) => (prev ? { ...prev, subheadline: event.target.value } : prev))}
                  rows={3}
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Deskripsi</label>
                <textarea
                  value={editState.description}
                  onChange={(event) => setEditState((prev) => (prev ? { ...prev, description: event.target.value } : prev))}
                  rows={4}
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Price Label</label>
                  <input
                    value={editState.priceLabel}
                    onChange={(event) => setEditState((prev) => (prev ? { ...prev, priceLabel: event.target.value } : prev))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Meta Pixel ID</label>
                  <input
                    value={editState.metaPixelId}
                    onChange={(event) => setEditState((prev) => (prev ? { ...prev, metaPixelId: event.target.value } : prev))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Bonus Text</label>
                  <input
                    value={editState.bonusText}
                    onChange={(event) => setEditState((prev) => (prev ? { ...prev, bonusText: event.target.value } : prev))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Guarantee Text</label>
                  <input
                    value={editState.guaranteeText}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, guaranteeText: event.target.value } : prev))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Urgency Text</label>
                  <input
                    value={editState.urgencyText}
                    onChange={(event) => setEditState((prev) => (prev ? { ...prev, urgencyText: event.target.value } : prev))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Hero Image URL</label>
                  <input
                    value={editState.heroImageUrl}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, heroImageUrl: event.target.value } : prev))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Hero Image Alt</label>
                  <input
                    value={editState.heroImageAlt}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, heroImageAlt: event.target.value } : prev))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">CTA Utama</label>
                  <input
                    value={editState.primaryCtaLabel}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, primaryCtaLabel: event.target.value } : prev))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                    required
                  />
                  <input
                    value={editState.primaryCtaUrl}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, primaryCtaUrl: event.target.value } : prev))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                    placeholder="#lead-form / https://..."
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">CTA Sekunder</label>
                  <input
                    value={editState.secondaryCtaLabel}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, secondaryCtaLabel: event.target.value } : prev))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                  />
                  <input
                    value={editState.secondaryCtaUrl}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, secondaryCtaUrl: event.target.value } : prev))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                    placeholder="#benefits / https://..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Meta Title</label>
                  <input
                    value={editState.metaTitle}
                    onChange={(event) => setEditState((prev) => (prev ? { ...prev, metaTitle: event.target.value } : prev))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Meta Description</label>
                  <textarea
                    value={editState.metaDescription}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, metaDescription: event.target.value } : prev))
                    }
                    rows={3}
                    className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Judul Form Lead</label>
                  <input
                    value={editState.formTitle}
                    onChange={(event) => setEditState((prev) => (prev ? { ...prev, formTitle: event.target.value } : prev))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Label Tombol Form</label>
                  <input
                    value={editState.formCtaLabel}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, formCtaLabel: event.target.value } : prev))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Subtitle Form Lead</label>
                  <textarea
                    value={editState.formSubtitle}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, formSubtitle: event.target.value } : prev))
                    }
                    rows={3}
                    className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Pesan Sukses</label>
                  <textarea
                    value={editState.formSuccessMessage}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, formSuccessMessage: event.target.value } : prev))
                    }
                    rows={3}
                    className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Proof Points</label>
                  <textarea
                    value={editState.proofPointsText}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, proofPointsText: event.target.value } : prev))
                    }
                    rows={6}
                    className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Benefits</label>
                  <textarea
                    value={editState.benefitsText}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, benefitsText: event.target.value } : prev))
                    }
                    rows={6}
                    className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Offer Stack</label>
                  <textarea
                    value={editState.offerItemsText}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, offerItemsText: event.target.value } : prev))
                    }
                    rows={6}
                    className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Testimonials</label>
                  <textarea
                    value={editState.testimonialsText}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, testimonialsText: event.target.value } : prev))
                    }
                    rows={6}
                    className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">FAQ</label>
                <textarea
                  value={editState.faqText}
                  onChange={(event) => setEditState((prev) => (prev ? { ...prev, faqText: event.target.value } : prev))}
                  rows={7}
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingPageId(null)}
                  className="px-5 py-3 text-sm font-black text-slate-400"
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
    </div>
  )
}
