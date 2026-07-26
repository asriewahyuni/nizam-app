'use client'

/**
 * Editor bersama toko LMS. Form ini menyimpan langsung ke tabel E-Commerce
 * yang sama; tidak ada salinan konfigurasi khusus LMS.
 */
import { useMemo, useState, useTransition, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  BadgeCheck,
  CircleAlert,
  Cloud,
  CreditCard,
  ExternalLink,
  Globe2,
  LoaderCircle,
  MonitorSmartphone,
  RefreshCw,
  Save,
  ShieldCheck,
  Store,
  Trash2,
} from 'lucide-react'
import ThemeHomepageEditor from '@/app/(dashboard)/ecommerce/ThemeHomepageEditor'
import {
  saveStoreBasicsAction,
} from '@/modules/ecommerce/actions/ecommerce.actions'
import {
  disableLmsTenantDomainAction,
  refreshLmsTenantDomainAction,
  requestLmsTenantDomainAction,
  setPrimaryLmsTenantDomainAction,
} from '@/modules/ecommerce/actions/lms-domain.actions'
import type {
  EcommerceDashboardData,
  StoreAdminSummary,
  StoreThemeVersionView,
} from '@/modules/ecommerce/lib/ecommerce'
import type { LmsTenantDomainView } from '@/modules/ecommerce/lib/lms-domain'
import { cn } from '@/lib/utils'

type EditorProps = {
  orgSlug: string
  dashboardData: EcommerceDashboardData
  selectedStore: StoreAdminSummary
  domains: LmsTenantDomainView[]
  automation: {
    railway: boolean
    cloudflare: boolean
  }
}

type TabId = 'identitas' | 'halaman' | 'pembayaran' | 'domain'

const TABS: Array<{
  id: TabId
  label: string
  description: string
  icon: typeof Store
}> = [
  { id: 'identitas', label: 'Identitas', description: 'Brand, kontak, dan slug', icon: Store },
  { id: 'halaman', label: 'Halaman', description: 'Builder dan publikasi', icon: MonitorSmartphone },
  { id: 'pembayaran', label: 'Pembayaran', description: 'Rekening dan instruksi', icon: CreditCard },
  { id: 'domain', label: 'Domain', description: 'DNS, SSL, dan homepage', icon: Globe2 },
]

function FieldLabel({
  children,
  htmlFor,
}: {
  children: React.ReactNode
  htmlFor?: string
}) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-semibold text-slate-700">
      {children}
    </label>
  )
}

function StorePreservedFields({ store }: { store: StoreAdminSummary }) {
  return (
    <>
      <input type="hidden" name="store_id" value={store.id} />
      <input type="hidden" name="name" value={store.name} />
      <input type="hidden" name="slug" value={store.slug} />
      <input type="hidden" name="brand_name" value={store.brandName} />
      <input type="hidden" name="line_name" value={store.lineName} />
      <input type="hidden" name="branch_id" value={store.branchId} />
      <input type="hidden" name="warehouse_id" value={store.warehouseId} />
      <input type="hidden" name="support_email" value={store.supportEmail} />
      <input type="hidden" name="support_phone" value={store.supportPhone} />
      <input type="hidden" name="whatsapp_phone" value={store.whatsappPhone} />
      <input type="hidden" name="logo_url" value={store.logoUrl} />
      <input type="hidden" name="headline" value={store.headline} />
      <input type="hidden" name="subheadline" value={store.subheadline} />
      <input type="hidden" name="currency" value={store.currency} />
      <input type="hidden" name="is_active" value={String(store.isActive)} />
      <input type="hidden" name="is_published" value={String(store.isPublished)} />
      <input
        type="hidden"
        name="allow_member_guest_checkout"
        value={String(store.allowGuestCheckout)}
      />
      <input type="hidden" name="seo_title" value={store.seoTitle} />
      <input type="hidden" name="seo_description" value={store.seoDescription} />
    </>
  )
}

function statusTone(status: LmsTenantDomainView['status']) {
  if (status === 'VERIFIED') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (status === 'FAILED') return 'border-rose-200 bg-rose-50 text-rose-800'
  if (status === 'DISABLED') return 'border-slate-200 bg-slate-100 text-slate-600'
  return 'border-amber-200 bg-amber-50 text-amber-800'
}

export default function LmsStoreSettingsEditor({
  orgSlug,
  dashboardData,
  selectedStore,
  domains,
  automation,
}: EditorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedTab = String(searchParams.get('tab') || 'identitas') as TabId
  const activeTab = TABS.some((tab) => tab.id === requestedTab)
    ? requestedTab
    : 'identitas'
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{
    tone: 'success' | 'error'
    text: string
  } | null>(null)

  const storeDomains = useMemo(
    () => domains.filter((domain) => domain.storeId === selectedStore.id),
    [domains, selectedStore.id],
  )
  const storeThemeDraft = useMemo(
    () => dashboardData.themes.find((theme) => (
      theme.storeId === selectedStore.id && theme.status === 'DRAFT'
    )) || null,
    [dashboardData.themes, selectedStore.id],
  )
  const storeThemePublished = useMemo(
    () => dashboardData.themes.find((theme) => (
      theme.storeId === selectedStore.id && theme.status === 'PUBLISHED'
    )) || null,
    [dashboardData.themes, selectedStore.id],
  )

  function runFormAction(
    action: (formData: FormData) => Promise<{ success: boolean; error?: string | null }>,
    formData: FormData,
    successText: string,
  ) {
    startTransition(async () => {
      setMessage(null)
      const result = await action(formData)
      if (!result.success) {
        setMessage({ tone: 'error', text: result.error || 'Data gagal disimpan.' })
        return
      }
      setMessage({ tone: 'success', text: successText })
      router.refresh()
    })
  }

  function handleStoreSubmit(event: FormEvent<HTMLFormElement>, successText: string) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    formData.set('org_slug', orgSlug)
    formData.set('store_slug', selectedStore.slug)
    runFormAction(saveStoreBasicsAction, formData, successText)
  }

  function appendStoreContext(formData: FormData) {
    formData.set('org_slug', orgSlug)
    formData.set('store_slug', selectedStore.slug)
  }

  async function runThemeAction(
    action: (formData: FormData) => Promise<{ success: boolean; error?: string | null }>,
    formData: FormData,
    successText: string,
  ) {
    const result = await action(formData)
    if (!result.success) {
      setMessage({ tone: 'error', text: result.error || 'Tema gagal disimpan.' })
      return
    }
    setMessage({ tone: 'success', text: successText })
    router.refresh()
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-bold text-slate-950">{selectedStore.name}</h2>
              <span className={cn(
                'rounded-full border px-2.5 py-1 text-xs font-semibold',
                selectedStore.isPublished
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-amber-200 bg-amber-50 text-amber-800',
              )}>
                {selectedStore.isPublished ? 'Tayang' : 'Belum tayang'}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Data ini juga langsung dipakai oleh area E-Commerce.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {dashboardData.stores.length > 1 && (
              <label className="sr-only" htmlFor="store-switcher">Pilih toko</label>
            )}
            {dashboardData.stores.length > 1 && (
              <select
                id="store-switcher"
                value={selectedStore.id}
                onChange={(event) => router.push(
                  `/lms/admin/penjualan/toko/${event.target.value}?tab=${activeTab}`,
                )}
                className="min-h-11 cursor-pointer rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
              >
                {dashboardData.stores.map((store) => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
            )}
            <Link
              href={`/toko/${orgSlug}/${selectedStore.slug}`}
              target="_blank"
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:border-indigo-300 hover:bg-indigo-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
            >
              Pratinjau
              <ExternalLink aria-hidden="true" size={16} />
            </Link>
          </div>
        </div>

        <nav aria-label="Pengaturan toko" className="mt-5 flex gap-2 overflow-x-auto border-t border-slate-100 pt-4">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <Link
                key={tab.id}
                href={`/lms/admin/penjualan/toko/${selectedStore.id}?tab=${tab.id}`}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100',
                  active
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-800'
                    : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50',
                )}
              >
                <Icon aria-hidden="true" size={17} />
                <span>{tab.label}</span>
                <span className="hidden text-xs font-normal text-slate-500 2xl:inline">
                  · {tab.description}
                </span>
              </Link>
            )
          })}
        </nav>
      </section>

      {message && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            'rounded-xl border px-4 py-3 text-sm font-semibold',
            message.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800',
          )}
        >
          {message.text}
        </div>
      )}

      {activeTab === 'identitas' && (
        <form
          onSubmit={(event) => handleStoreSubmit(event, 'Identitas toko berhasil disimpan.')}
          className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
        >
          <input type="hidden" name="store_id" value={selectedStore.id} />
          <input type="hidden" name="branch_id" value={selectedStore.branchId} />
          <input type="hidden" name="warehouse_id" value={selectedStore.warehouseId} />
          <input type="hidden" name="bank_account_id" value={selectedStore.bankAccountId} />
          <input type="hidden" name="currency" value={selectedStore.currency} />
          <input type="hidden" name="transfer_instructions" value={selectedStore.transferInstructions} />
          <input type="hidden" name="hero_notice" value={selectedStore.heroNotice} />
          <input type="hidden" name="checkout_notice" value={selectedStore.checkoutNotice} />

          <div>
            <h3 className="text-lg font-bold text-slate-950">Identitas portal dan toko</h3>
            <p className="mt-1 text-sm text-slate-600">
              Nama, slug, logo, dan kontak yang dilihat calon member.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <FieldLabel htmlFor="store-name">Nama toko</FieldLabel>
              <input id="store-name" name="name" required defaultValue={selectedStore.name} className="min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100" />
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="store-slug">Slug toko</FieldLabel>
              <input id="store-slug" name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" defaultValue={selectedStore.slug} className="min-h-11 w-full rounded-xl border border-slate-300 px-4 font-mono text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100" />
              <p className="text-xs text-slate-500">
                URL lama otomatis disimpan dan dialihkan permanen.
              </p>
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="brand-name">Nama portal / brand</FieldLabel>
              <input id="brand-name" name="brand_name" defaultValue={selectedStore.brandName} className="min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100" />
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="line-name">Nama program</FieldLabel>
              <input id="line-name" name="line_name" defaultValue={selectedStore.lineName} className="min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <FieldLabel htmlFor="logo-url">URL logo</FieldLabel>
              <input id="logo-url" name="logo_url" type="url" defaultValue={selectedStore.logoUrl} className="min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100" />
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="support-email">Email bantuan</FieldLabel>
              <input id="support-email" name="support_email" type="email" defaultValue={selectedStore.supportEmail} className="min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100" />
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="whatsapp-phone">Nomor WhatsApp</FieldLabel>
              <input id="whatsapp-phone" name="whatsapp_phone" defaultValue={selectedStore.whatsappPhone} className="min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100" />
              <input type="hidden" name="support_phone" value={selectedStore.supportPhone} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <FieldLabel htmlFor="headline">Judul portal</FieldLabel>
              <input id="headline" name="headline" defaultValue={selectedStore.headline} className="min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <FieldLabel htmlFor="subheadline">Subjudul portal</FieldLabel>
              <textarea id="subheadline" name="subheadline" rows={3} defaultValue={selectedStore.subheadline} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100" />
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="seo-title">SEO title</FieldLabel>
              <input id="seo-title" name="seo_title" defaultValue={selectedStore.seoTitle} className="min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100" />
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="seo-description">SEO description</FieldLabel>
              <input id="seo-description" name="seo_description" defaultValue={selectedStore.seoDescription} className="min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100" />
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="store-published">Status tayang</FieldLabel>
              <select id="store-published" name="is_published" defaultValue={String(selectedStore.isPublished)} className="min-h-11 w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-4 text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100">
                <option value="true">Tayang</option>
                <option value="false">Belum tayang</option>
              </select>
              <input type="hidden" name="is_active" value={String(selectedStore.isActive)} />
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="guest-checkout">Checkout tamu</FieldLabel>
              <select id="guest-checkout" name="allow_member_guest_checkout" defaultValue={String(selectedStore.allowGuestCheckout)} className="min-h-11 w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-4 text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100">
                <option value="false">Nonaktif</option>
                <option value="true">Aktif</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end border-t border-slate-100 pt-5">
            <button disabled={isPending} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 disabled:cursor-wait disabled:opacity-60">
              {isPending ? <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" size={17} /> : <Save aria-hidden="true" size={17} />}
              Simpan identitas
            </button>
          </div>
        </form>
      )}

      {activeTab === 'halaman' && (
        <ThemeHomepageEditor
          key={[
            selectedStore.id,
            storeThemeDraft?.id || 'draft',
            storeThemeDraft?.updatedAt || 'draft-updated',
            storeThemePublished?.id || 'published',
            storeThemePublished?.updatedAt || 'published-updated',
          ].join(':')}
          orgSlug={orgSlug}
          selectedStore={selectedStore}
          dashboardData={dashboardData}
          storeThemeDraft={storeThemeDraft as StoreThemeVersionView | null}
          storeThemePublished={storeThemePublished as StoreThemeVersionView | null}
          isPending={isPending}
          appendStoreContext={appendStoreContext}
          runAction={runThemeAction}
        />
      )}

      {activeTab === 'pembayaran' && (
        <form
          onSubmit={(event) => handleStoreSubmit(event, 'Pengaturan pembayaran berhasil disimpan.')}
          className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
        >
          <StorePreservedFields store={selectedStore} />
          <div>
            <h3 className="text-lg font-bold text-slate-950">Penerimaan pembayaran</h3>
            <p className="mt-1 text-sm text-slate-600">
              Satu rekening dipakai checkout dan pencatatan ERP toko ini.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <FieldLabel htmlFor="bank-account">Rekening penerimaan</FieldLabel>
              <select id="bank-account" name="bank_account_id" defaultValue={selectedStore.bankAccountId} className="min-h-11 w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-4 text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100">
                {dashboardData.bankAccounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <FieldLabel htmlFor="transfer-instructions">Instruksi transfer</FieldLabel>
              <textarea id="transfer-instructions" name="transfer_instructions" rows={5} defaultValue={selectedStore.transferInstructions} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100" />
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="hero-notice">Pemberitahuan katalog</FieldLabel>
              <input id="hero-notice" name="hero_notice" defaultValue={selectedStore.heroNotice} className="min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100" />
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="checkout-notice">Pemberitahuan checkout</FieldLabel>
              <input id="checkout-notice" name="checkout_notice" defaultValue={selectedStore.checkoutNotice} className="min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100" />
            </div>
          </div>
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">
            Transfer manual tetap tersedia. Moota dan Duitku mengikuti kredensial
            provider yang aktif di server, tanpa mengubah produk atau checkout.
          </div>
          <div className="flex justify-end border-t border-slate-100 pt-5">
            <button disabled={isPending} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 disabled:cursor-wait disabled:opacity-60">
              <Save aria-hidden="true" size={17} />
              Simpan pembayaran
            </button>
          </div>
        </form>
      )}

      {activeTab === 'domain' && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                <Globe2 aria-hidden="true" size={21} />
              </span>
              <div>
                <h3 className="text-lg font-bold text-slate-950">Hubungkan custom domain LMS</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Domain melayani storefront, produk, checkout, login, dashboard,
                  course, dan lesson dengan URL bersih.
                </p>
              </div>
            </div>

            <form
              className="mt-6 grid gap-5 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault()
                const formData = new FormData(event.currentTarget)
                formData.set('store_id', selectedStore.id)
                runFormAction(
                  requestLmsTenantDomainAction,
                  formData,
                  'Domain disimpan. Ikuti petunjuk DNS lalu periksa kembali.',
                )
              }}
            >
              <div className="space-y-2 md:col-span-2">
                <FieldLabel htmlFor="hostname">Nama domain</FieldLabel>
                <div className="flex min-h-11 items-center rounded-xl border border-slate-300 bg-white focus-within:ring-4 focus-within:ring-indigo-100">
                  <span className="border-r border-slate-200 px-3 text-sm text-slate-500">https://</span>
                  <input id="hostname" name="hostname" required placeholder="kelas.domainanda.com" className="min-h-11 min-w-0 flex-1 rounded-r-xl px-3 text-sm outline-none" />
                </div>
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="root-behavior">Saat membuka homepage</FieldLabel>
                <select id="root-behavior" name="root_behavior" defaultValue="STOREFRONT" className="min-h-11 w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-4 text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100">
                  <option value="STOREFRONT">Tampilkan Storefront</option>
                  <option value="LOGIN">Arahkan ke Login</option>
                </select>
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="domain-primary">Kedudukan domain</FieldLabel>
                <select id="domain-primary" name="is_primary" defaultValue={domains.length ? 'false' : 'true'} className="min-h-11 w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-4 text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100">
                  <option value="true">Domain utama LMS</option>
                  <option value="false">Domain tambahan</option>
                </select>
              </div>
              <div className="md:col-span-2 flex justify-end">
                <button disabled={isPending} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 disabled:cursor-wait disabled:opacity-60">
                  <Cloud aria-hidden="true" size={17} />
                  Hubungkan domain
                </button>
              </div>
            </form>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Railway</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {automation.railway ? 'Otomasi siap' : 'Mode panduan manual'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Cloudflare</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {automation.cloudflare ? 'Token tersedia' : 'Tidak dikelola otomatis'}
                </p>
              </div>
            </div>
          </section>

          {storeDomains.length === 0 ? (
            <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <Globe2 aria-hidden="true" className="mx-auto text-slate-400" size={28} />
              <p className="mt-3 text-sm font-semibold text-slate-700">Belum ada domain untuk toko ini.</p>
            </section>
          ) : storeDomains.map((domain) => (
            <section key={domain.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="truncate text-base font-bold text-slate-950">{domain.hostname}</h4>
                    <span className={cn('rounded-full border px-2.5 py-1 text-xs font-bold', statusTone(domain.status))}>
                      {domain.status}
                    </span>
                    {domain.isPrimary && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-800">
                        <BadgeCheck aria-hidden="true" size={14} />
                        Utama
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    Homepage: {domain.rootBehavior === 'STOREFRONT' ? 'Storefront' : 'Login'}
                    {' · '}DNS: {domain.dnsStatus}
                    {' · '}SSL: {domain.certificateStatus}
                  </p>
                  {domain.lastError && (
                    <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                      {domain.lastError}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <form onSubmit={(event) => {
                    event.preventDefault()
                    runFormAction(
                      refreshLmsTenantDomainAction,
                      new FormData(event.currentTarget),
                      'Status DNS dan SSL sudah diperbarui.',
                    )
                  }}>
                    <input type="hidden" name="domain_id" value={domain.id} />
                    <input type="hidden" name="store_id" value={selectedStore.id} />
                    <button disabled={isPending || domain.status === 'DISABLED'} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-50">
                      <RefreshCw aria-hidden="true" size={16} />
                      Periksa
                    </button>
                  </form>
                  {!domain.isPrimary && domain.status === 'VERIFIED' && (
                    <form onSubmit={(event) => {
                      event.preventDefault()
                      runFormAction(
                        setPrimaryLmsTenantDomainAction,
                        new FormData(event.currentTarget),
                        'Domain utama berhasil diubah.',
                      )
                    }}>
                      <input type="hidden" name="domain_id" value={domain.id} />
                      <input type="hidden" name="store_id" value={selectedStore.id} />
                      <button disabled={isPending} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-indigo-200 px-3 text-sm font-semibold text-indigo-700 transition-colors duration-200 hover:bg-indigo-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100">
                        <ShieldCheck aria-hidden="true" size={16} />
                        Jadikan utama
                      </button>
                    </form>
                  )}
                  {domain.status !== 'DISABLED' && (
                    <form onSubmit={(event) => {
                      event.preventDefault()
                      if (!window.confirm(`Nonaktifkan ${domain.hostname}? Domain tidak akan lagi melayani portal.`)) return
                      runFormAction(
                        disableLmsTenantDomainAction,
                        new FormData(event.currentTarget),
                        'Domain dinonaktifkan.',
                      )
                    }}>
                      <input type="hidden" name="domain_id" value={domain.id} />
                      <input type="hidden" name="store_id" value={selectedStore.id} />
                      <button disabled={isPending} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-rose-200 px-3 text-sm font-semibold text-rose-700 transition-colors duration-200 hover:bg-rose-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-100">
                        <Trash2 aria-hidden="true" size={16} />
                        Nonaktifkan
                      </button>
                    </form>
                  )}
                </div>
              </div>

              {domain.requiredDnsRecords.length > 0 && domain.status !== 'VERIFIED' && (
                <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-bold text-slate-800">Record DNS yang wajib dipasang</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-white text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Tipe</th>
                          <th className="px-4 py-3">Nama</th>
                          <th className="px-4 py-3">Nilai</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {domain.requiredDnsRecords.map((record, index) => (
                          <tr key={`${record.type}:${record.name}:${index}`}>
                            <td className="px-4 py-3 font-mono font-semibold">{record.type}</td>
                            <td className="px-4 py-3 font-mono">{record.name}</td>
                            <td className="max-w-md break-all px-4 py-3 font-mono text-xs">{record.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {domain.providerMode === 'MANUAL' && domain.status !== 'VERIFIED' && (
                <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <CircleAlert aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
                  <p>
                    Daftarkan domain ini pada Railway, pasang record yang diberikan
                    Railway di DNS Anda, tunggu SSL aktif, lalu tekan <strong>Periksa</strong>.
                  </p>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
