import { CalendarDays, ExternalLink, ShieldCheck, Sparkles, Target, TrendingUp, Zap } from 'lucide-react'
import SalesPageLeadForm from './SalesPageLeadForm'
import type { SalesPageView } from '@/modules/sales/lib/sales-page'

type SalesPagePublicViewProps = {
  org: {
    id: string
    name: string
    slug: string
    logo_url: string | null
  }
  page: SalesPageView
}

function renderCtaHref(value: string, fallback: string) {
  return value || fallback
}

function HeroVisual({ page }: { page: SalesPageView }) {
  return (
    <div
      className="rounded-[36px] border p-6 shadow-[0_30px_70px_-30px_rgba(15,23,42,0.35)]"
      style={{
        borderColor: page.theme.border,
        background: page.heroImageUrl
          ? `linear-gradient(180deg, rgba(15,23,42,0.08), rgba(15,23,42,0.18)), url(${page.heroImageUrl}) center / cover no-repeat`
          : `linear-gradient(145deg, ${page.theme.accent} 0%, ${page.theme.text} 100%)`,
      }}
    >
      <div className="min-h-[320px] rounded-[28px] border border-white/15 bg-white/10 p-6 text-white backdrop-blur-sm">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">Offer Value</div>
        <div className="mt-3 text-4xl font-black tracking-tighter">{page.priceLabel || 'Penawaran Spesial'}</div>
        <div className="mt-6 space-y-4 text-sm font-bold leading-relaxed text-white/85">
          <div className="flex items-start gap-3">
            <Zap size={18} className="mt-0.5 shrink-0" />
            <span>{page.bonusText || 'Bonus implementasi dan support awal.'}</span>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="mt-0.5 shrink-0" />
            <span>{page.guaranteeText || 'Sesi discovery sebelum eksekusi.'}</span>
          </div>
          <div className="flex items-start gap-3">
            <Sparkles size={18} className="mt-0.5 shrink-0" />
            <span>{page.urgencyText || 'Kuota batch promo terbatas.'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function LeadFormPanel({ org, page }: { org: SalesPagePublicViewProps['org']; page: SalesPageView }) {
  if (page.formSettings.enabled) {
    return (
      <SalesPageLeadForm
        orgSlug={org.slug}
        pageSlug={page.slug}
        metaPixelId={page.metaPixelId}
        formSettings={page.formSettings}
        theme={page.theme}
      />
    )
  }

  return (
    <div
      className="rounded-[36px] border bg-white p-7 shadow-[0_20px_60px_-25px_rgba(15,23,42,0.25)]"
      style={{ borderColor: page.theme.border }}
    >
      <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: page.theme.muted }}>
        Lead Capture
      </div>
      <h3 className="mt-3 text-2xl font-black tracking-tight text-slate-900">Form sementara dinonaktifkan</h3>
      <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
        Hubungi tim kami melalui tombol CTA di halaman ini untuk konsultasi lebih lanjut.
      </p>
    </div>
  )
}

function ProofPointStrip({ page }: { page: SalesPageView }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {page.proofPoints.map((point) => (
        <div
          key={`${point.label}-${point.value}`}
          className="rounded-[28px] border bg-white/90 px-5 py-5 shadow-lg"
          style={{ borderColor: page.theme.border }}
        >
          <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: page.theme.muted }}>
            {point.label}
          </div>
          <div className="mt-2 text-lg font-black tracking-tight text-slate-900">{point.value}</div>
        </div>
      ))}
    </div>
  )
}

export default function SalesPagePublicView({ org, page }: SalesPagePublicViewProps) {
  const primaryCtaFallback = page.formSettings.enabled ? '#lead-form' : '#benefits'

  const isLeadCapture = page.templateId === 'LEAD_CAPTURE'
  const isWebinar = page.templateId === 'WEBINAR'
  const isProductLaunch = page.templateId === 'PRODUCT_LAUNCH'
  const isConsulting = page.templateId === 'CONSULTING'

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div
        className="relative overflow-hidden"
        style={{
          background: isConsulting
            ? `linear-gradient(155deg, #0f172a 0%, #111827 28%, ${page.theme.surface} 100%)`
            : isWebinar
              ? `radial-gradient(circle at 15% 10%, ${page.theme.accentSoft} 0%, transparent 32%), linear-gradient(145deg, #ffffff 0%, ${page.theme.surfaceAlt} 56%, ${page.theme.surface} 100%)`
              : `radial-gradient(circle at top right, ${page.theme.accentSoft} 0%, transparent 28%), linear-gradient(145deg, ${page.theme.surface} 0%, #ffffff 58%, ${page.theme.surfaceAlt} 100%)`,
        }}
      >
        <div className="absolute -left-24 top-16 h-64 w-64 rounded-full blur-3xl opacity-60" style={{ backgroundColor: page.theme.accentSoft }} />
        <div className="absolute right-0 top-0 h-72 w-72 rounded-full blur-3xl opacity-40" style={{ backgroundColor: page.theme.accentContrast }} />

        <header className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl border text-sm font-black shadow-lg ${isConsulting ? 'bg-slate-900 text-white' : 'bg-white'}`}
              style={{ borderColor: page.theme.border, color: isConsulting ? '#ffffff' : page.theme.accent }}
            >
              {org.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className={`text-[10px] font-black uppercase tracking-[0.22em] ${isConsulting ? 'text-slate-300' : ''}`} style={{ color: isConsulting ? undefined : page.theme.muted }}>
                {isWebinar ? 'Webinar Funnel' : isProductLaunch ? 'Launch Page' : isConsulting ? 'Consulting Offer' : 'Sales Page'}
              </div>
              <div className={`text-sm font-black ${isConsulting ? 'text-white' : 'text-slate-900'}`}>{org.name}</div>
            </div>
          </div>

          <a
            href={renderCtaHref(page.primaryCtaUrl, primaryCtaFallback)}
            className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-xs font-black text-white shadow-xl"
            style={{ backgroundColor: page.theme.accent }}
          >
            {page.primaryCtaLabel}
            <ExternalLink size={14} />
          </a>
        </header>

        {isLeadCapture && (
          <main className="relative mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-4 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:pb-24 lg:pt-10">
            <section className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border bg-white/90 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] shadow-sm" style={{ borderColor: page.theme.border, color: page.theme.muted }}>
                <Sparkles size={14} />
                {page.offerBadge || 'Penawaran Spesial'}
              </div>

              <div className="space-y-5">
                <h1 className="max-w-4xl text-5xl font-black tracking-tighter text-slate-950 sm:text-6xl">{page.headline}</h1>
                <p className="max-w-3xl text-lg font-medium leading-relaxed text-slate-600">{page.subheadline || page.description}</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href={renderCtaHref(page.primaryCtaUrl, primaryCtaFallback)}
                  className="inline-flex items-center gap-2 rounded-[24px] px-7 py-4 text-sm font-black text-white shadow-2xl"
                  style={{ backgroundColor: page.theme.accent }}
                >
                  {page.primaryCtaLabel}
                </a>
                {page.secondaryCtaLabel && (
                  <a
                    href={renderCtaHref(page.secondaryCtaUrl, '#benefits')}
                    className="inline-flex items-center gap-2 rounded-[24px] border bg-white px-7 py-4 text-sm font-black text-slate-800"
                    style={{ borderColor: page.theme.border }}
                  >
                    {page.secondaryCtaLabel}
                  </a>
                )}
              </div>

              <ProofPointStrip page={page} />
            </section>

            <aside className="space-y-5">
              <HeroVisual page={page} />
              <div className="rounded-[28px] border bg-white px-6 py-5" style={{ borderColor: page.theme.border }}>
                <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: page.theme.muted }}>
                  Cocok Untuk
                </div>
                <div className="mt-2 text-sm font-bold leading-relaxed text-slate-700">
                  {page.targetAudience || 'Tim bisnis yang ingin kampanye penawarannya lebih rapi dan lebih cepat closing.'}
                </div>
              </div>
            </aside>
          </main>
        )}

        {isWebinar && (
          <main className="relative mx-auto max-w-6xl px-6 pb-20 pt-6 lg:px-8 lg:pb-24 lg:pt-8">
            <div className="grid gap-10 lg:grid-cols-[1.25fr_0.75fr]">
              <section className="space-y-7">
                <div className="inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em]" style={{ borderColor: page.theme.border, color: page.theme.muted }}>
                  <CalendarDays size={14} />
                  {page.offerBadge || 'Webinar Registration'}
                </div>
                <h1 className="max-w-4xl text-5xl font-black tracking-tighter text-slate-950 sm:text-6xl">{page.headline}</h1>
                <p className="max-w-3xl text-lg font-medium leading-relaxed text-slate-600">{page.subheadline || page.description}</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {page.proofPoints.map((point) => (
                    <div key={`${point.label}-${point.value}`} className="rounded-2xl border bg-white px-4 py-4" style={{ borderColor: page.theme.border }}>
                      <div className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: page.theme.muted }}>{point.label}</div>
                      <div className="mt-1 text-sm font-black text-slate-900">{point.value}</div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  <a href={renderCtaHref(page.primaryCtaUrl, primaryCtaFallback)} className="inline-flex items-center gap-2 rounded-2xl px-7 py-4 text-sm font-black text-white" style={{ backgroundColor: page.theme.accent }}>
                    {page.primaryCtaLabel}
                  </a>
                  {page.secondaryCtaLabel && (
                    <a href={renderCtaHref(page.secondaryCtaUrl, '#benefits')} className="inline-flex items-center gap-2 rounded-2xl border bg-white px-7 py-4 text-sm font-black text-slate-800" style={{ borderColor: page.theme.border }}>
                      {page.secondaryCtaLabel}
                    </a>
                  )}
                </div>
              </section>
              <aside className="space-y-4">
                <HeroVisual page={page} />
                <div className="rounded-3xl border bg-white p-5" style={{ borderColor: page.theme.border }}>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: page.theme.muted }}>Audience Fit</div>
                  <p className="mt-2 text-sm font-bold text-slate-700">{page.targetAudience || 'Tim yang ingin insight praktis yang bisa dieksekusi cepat.'}</p>
                </div>
              </aside>
            </div>
          </main>
        )}

        {isProductLaunch && (
          <main className="relative mx-auto max-w-6xl px-6 pb-20 pt-4 lg:px-8 lg:pb-24 lg:pt-10">
            <section className="rounded-[40px] border bg-white/85 p-8 shadow-xl" style={{ borderColor: page.theme.border }}>
              <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
                <div className="space-y-5">
                  <div className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em]" style={{ borderColor: page.theme.border, color: page.theme.muted }}>
                    <TrendingUp size={14} />
                    {page.offerBadge || 'Launch Campaign'}
                  </div>
                  <h1 className="text-5xl font-black tracking-tighter text-slate-950 sm:text-6xl">{page.headline}</h1>
                  <p className="text-lg font-medium leading-relaxed text-slate-600">{page.subheadline || page.description}</p>
                  <div className="flex flex-wrap gap-3">
                    <a href={renderCtaHref(page.primaryCtaUrl, primaryCtaFallback)} className="inline-flex items-center gap-2 rounded-[24px] px-7 py-4 text-sm font-black text-white" style={{ backgroundColor: page.theme.accent }}>
                      {page.primaryCtaLabel}
                    </a>
                    {page.secondaryCtaLabel && (
                      <a href={renderCtaHref(page.secondaryCtaUrl, '#benefits')} className="inline-flex items-center gap-2 rounded-[24px] border bg-white px-7 py-4 text-sm font-black text-slate-800" style={{ borderColor: page.theme.border }}>
                        {page.secondaryCtaLabel}
                      </a>
                    )}
                  </div>
                </div>
                <HeroVisual page={page} />
              </div>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {page.proofPoints.map((point) => (
                  <div key={`${point.label}-${point.value}`} className="rounded-2xl border bg-white px-5 py-4" style={{ borderColor: page.theme.border }}>
                    <div className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: page.theme.muted }}>{point.label}</div>
                    <div className="mt-1 text-sm font-black text-slate-900">{point.value}</div>
                  </div>
                ))}
              </div>
            </section>
          </main>
        )}

        {isConsulting && (
          <main className="relative mx-auto max-w-6xl px-6 pb-20 pt-4 lg:px-8 lg:pb-24 lg:pt-10">
            <section className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-200">
                  <Target size={14} />
                  {page.offerBadge || 'Consulting Offer'}
                </div>
                <h1 className="max-w-4xl text-5xl font-black tracking-tighter text-white sm:text-6xl">{page.headline}</h1>
                <p className="max-w-3xl text-lg font-medium leading-relaxed text-slate-300">{page.subheadline || page.description}</p>
                <div className="flex flex-wrap gap-3">
                  <a href={renderCtaHref(page.primaryCtaUrl, primaryCtaFallback)} className="inline-flex items-center gap-2 rounded-2xl px-7 py-4 text-sm font-black text-white" style={{ backgroundColor: page.theme.accent }}>
                    {page.primaryCtaLabel}
                  </a>
                  {page.secondaryCtaLabel && (
                    <a href={renderCtaHref(page.secondaryCtaUrl, '#benefits')} className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/40 px-7 py-4 text-sm font-black text-slate-100">
                      {page.secondaryCtaLabel}
                    </a>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                <HeroVisual page={page} />
                <div className="rounded-3xl border border-slate-700 bg-slate-900/60 p-5 text-slate-200">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em]">Scope Fit</div>
                  <p className="mt-2 text-sm font-bold text-slate-300">{page.targetAudience || 'Owner dan manajer yang ingin arahan strategis berbasis data operasional nyata.'}</p>
                </div>
              </div>
            </section>
          </main>
        )}
      </div>

      <section id="benefits" className="mx-auto max-w-6xl px-6 py-20 lg:px-8">
        <div className="max-w-2xl">
          <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: page.theme.muted }}>
            {isWebinar ? 'Agenda Value' : isConsulting ? 'Problem-Solution' : 'Kenapa Halaman Ini Bekerja'}
          </div>
          <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-900">
            {isWebinar
              ? 'Rangkaian materi yang membuat peserta jelas langkah berikutnya.'
              : isConsulting
                ? 'Susun jalur eksekusi dari diagnosis masalah ke rencana aksi.'
                : 'Dirancang untuk membawa visitor dari tertarik menjadi siap bicara.'}
          </h2>
        </div>

        <div className={`mt-10 grid gap-6 ${isConsulting ? 'md:grid-cols-1' : 'md:grid-cols-3'}`}>
          {page.benefits.map((benefit, idx) => (
            <article
              key={benefit.title}
              className="rounded-[32px] border bg-white px-6 py-6 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.25)]"
              style={{ borderColor: page.theme.border }}
            >
              <div className="mb-5 flex items-center justify-between">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-black"
                  style={{ backgroundColor: page.theme.accentSoft, color: page.theme.accent }}
                >
                  {benefit.title.slice(0, 1).toUpperCase()}
                </div>
                {isConsulting && <div className="text-sm font-black text-slate-400">Step {idx + 1}</div>}
              </div>
              <h3 className="text-xl font-black tracking-tight text-slate-900">{benefit.title}</h3>
              <p className="mt-3 text-sm font-medium leading-relaxed text-slate-600">{benefit.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-100 bg-slate-50/70">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
          <div className="space-y-5">
            <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: page.theme.muted }}>
              {isWebinar ? 'Agenda + Bonus' : isConsulting ? 'Scope Engagement' : 'Offer Stack'}
            </div>
            <h2 className="text-4xl font-black tracking-tight text-slate-900">
              {isProductLaunch
                ? 'Komponen launch yang mempercepat keputusan prospek.'
                : isConsulting
                  ? 'Apa saja yang akan dibahas dan dieksekusi dalam engagement.'
                  : 'Apa yang visitor dapatkan ketika mereka mengambil langkah hari ini.'}
            </h2>
            <p className="text-base font-medium leading-relaxed text-slate-600">
              {isWebinar
                ? 'Susunan agenda dan materi bonus membantu peserta paham value event sebelum mendaftar.'
                : 'Stack penawaran ini memudahkan tim Anda menjelaskan nilai dan alasan kenapa prospek sebaiknya tidak menunda.'}
            </p>
            <div className="space-y-4">
              {page.offerItems.map((item) => (
                <div key={item.title} className="rounded-[28px] border bg-white px-5 py-5 shadow-sm" style={{ borderColor: page.theme.border }}>
                  <div className="text-lg font-black tracking-tight text-slate-900">{item.title}</div>
                  <div className="mt-2 text-sm font-medium leading-relaxed text-slate-600">{item.description}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <LeadFormPanel org={org} page={page} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-8">
        <div className="max-w-2xl">
          <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: page.theme.muted }}>
            Testimonial
          </div>
          <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-900">Social proof yang membantu visitor merasa lebih aman melangkah.</h2>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {page.testimonials.map((testimonial) => (
            <blockquote
              key={`${testimonial.name}-${testimonial.role}`}
              className="rounded-[34px] border bg-white px-6 py-6 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)]"
              style={{ borderColor: page.theme.border }}
            >
              <p className="text-lg font-black leading-relaxed text-slate-900">
                <span aria-hidden="true">&ldquo;</span>
                {testimonial.quote}
                <span aria-hidden="true">&rdquo;</span>
              </p>
              <footer className="mt-6">
                <div className="font-black text-slate-900">{testimonial.name}</div>
                <div className="text-sm font-medium text-slate-500">{testimonial.role}</div>
              </footer>
            </blockquote>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20 lg:px-8">
        <div className="rounded-[40px] border bg-white px-6 py-8 shadow-[0_25px_70px_-35px_rgba(15,23,42,0.3)]" style={{ borderColor: page.theme.border }}>
          <div className="max-w-2xl">
            <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: page.theme.muted }}>
              FAQ
            </div>
            <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-900">Pertanyaan yang biasanya muncul sebelum prospek mengambil keputusan.</h2>
          </div>
          <div className="mt-8 divide-y divide-slate-100">
            {page.faqItems.map((faq) => (
              <div key={faq.question} className="py-5">
                <h3 className="text-lg font-black tracking-tight text-slate-900">{faq.question}</h3>
                <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-600">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 text-sm font-medium text-slate-500 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>Halaman ini diterbitkan oleh {org.name} melalui NIZAM Sales Page Studio.</div>
          <a href={renderCtaHref(page.primaryCtaUrl, primaryCtaFallback)} className="font-black" style={{ color: page.theme.accent }}>
            {page.primaryCtaLabel}
          </a>
        </div>
      </footer>
    </div>
  )
}
