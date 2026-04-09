// Landing page publik NIZAM untuk memperkenalkan value proposition utama
// dan mengarahkan visitor ke login, register, atau demo.
import Image from 'next/image'
import Link from 'next/link'
import { NizamDashboardHeroPreview } from '@/components/marketing/NizamDashboardHeroPreview'
import { NizamMenuExplorer } from '@/components/marketing/NizamMenuExplorer'
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronDown,
  GitBranch,
  HandCoins,
  LayoutDashboard,
  Package,
  Quote,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from 'lucide-react'

const highlightCards = [
  {
    title: 'Manajemen Zakat',
    description: 'Pantau zakat perdagangan dan haul tanpa mencampurnya dengan laporan operasional biasa.',
    icon: HandCoins,
    accent: 'from-emerald-400 to-emerald-600',
  },
  {
    title: 'Strategi Berbasis BSC',
    description: 'Hubungkan target bisnis dengan perspektif Balanced Scorecard agar strategi tidak berhenti di slide.',
    icon: Target,
    accent: 'from-amber-400 to-orange-500',
  },
  {
    title: 'Approval Terpusat',
    description: 'Dokumen yang butuh persetujuan bisa dipantau dari satu pusat kontrol yang lebih rapi.',
    icon: ShieldCheck,
    accent: 'from-sky-400 to-blue-600',
  },
  {
    title: 'Operasional Multi-Cabang',
    description: 'Pilih unit aktif untuk transaksi, sambil tetap punya ringkasan agregat lintas cabang saat dibutuhkan.',
    icon: GitBranch,
    accent: 'from-slate-500 to-slate-800',
  },
]

const capabilityPills = [
  'Accounting',
  'Sales & Inventory',
  'HRIS',
  'Approval',
  'Zakat & BSC',
]

const flowSteps = [
  {
    title: 'Bangun fondasi bisnis',
    description: 'Mulai dari profil bisnis, CoA, cabang, pengguna, dan rekening kas atau bank.',
    icon: Building2,
  },
  {
    title: 'Jalankan operasional harian',
    description: 'Kelola CRM, gudang, pembelian, penjualan, POS, dan aktivitas tim dalam satu alur kerja.',
    icon: Package,
  },
  {
    title: 'Jaga kontrol internal',
    description: 'Gunakan approval center, audit trail, dan konteks unit aktif agar transaksi lebih disiplin.',
    icon: BadgeCheck,
  },
  {
    title: 'Pantau angka dan arah bisnis',
    description: 'Baca laporan keuangan, zakat, pareto, forecast, dan strategi BSC dari data yang sama.',
    icon: BarChart3,
  },
]

const audienceCards = [
  {
    title: 'Bisnis yang sedang beres-beres operasi',
    description: 'Cocok untuk tim yang ingin keluar dari spreadsheet terpencar dan mulai bekerja lebih konsisten.',
    icon: LayoutDashboard,
  },
  {
    title: 'Usaha dengan lebih dari satu unit',
    description: 'Cabang, divisi, atau unit usaha bisa dipantau dalam satu sistem tanpa kehilangan konteks transaksi.',
    icon: GitBranch,
  },
  {
    title: 'Owner yang ingin laporan lebih hidup',
    description: 'Bukan hanya laba rugi, tapi juga approval, zakat, strategi, dan performa operasional yang lebih terlihat.',
    icon: Users,
  },
]

const ecosystemPartners = [
  { id: 'supabase', label: 'Supabase', meta: 'Auth & database', hoverClass: 'group-hover:text-[#3ecf8e]' },
  { id: 'nextjs', label: 'Next.js', meta: 'App platform', hoverClass: 'group-hover:text-slate-950' },
  { id: 'resend', label: 'Resend', meta: 'Transactional email', hoverClass: 'group-hover:text-[#2563eb]' },
  { id: 'tailwind', label: 'Tailwind CSS', meta: 'UI foundation', hoverClass: 'group-hover:text-[#06b6d4]' },
  { id: 'framer', label: 'Framer Motion', meta: 'Motion layer', hoverClass: 'group-hover:text-[#2563eb]' },
  { id: 'typescript', label: 'TypeScript', meta: 'Code integrity', hoverClass: 'group-hover:text-[#3178c6]' },
]

const perspectiveCards = [
  {
    quote: 'Yang saya cari bukan sekadar banyak menu, tapi ritme kerja yang lebih rapi dari kas, stok, sampai approval.',
    role: 'Owner bisnis multi-cabang',
    focus: 'Kontrol dan visibilitas',
  },
  {
    quote: 'Kalau struktur data dan dokumennya tertib, tim finance lebih mudah membaca apa yang benar-benar terjadi di operasional.',
    role: 'Finance lead',
    focus: 'Disiplin pencatatan',
  },
  {
    quote: 'Saya lebih nyaman kalau CRM, gudang, purchasing, dan sales tidak jalan sendiri-sendiri seperti aplikasi yang terpisah.',
    role: 'Admin operasional',
    focus: 'Alur kerja harian',
  },
]

const faqItems = [
  {
    question: 'Apakah semua menu selalu muncul untuk setiap akun?',
    answer:
      'Tidak selalu. Tampilan menu mengikuti permission role dan paket modul yang aktif, jadi setiap user bisa melihat struktur yang berbeda sesuai tanggung jawabnya.',
  },
  {
    question: 'Apakah NIZAM cocok untuk bisnis multi-cabang atau multi-unit?',
    answer:
      'Ya, alurnya memang mendukung konteks unit aktif dan pembacaan agregat. Itu berguna untuk bisnis yang punya lebih dari satu cabang, divisi, atau unit usaha.',
  },
  {
    question: 'Apakah fitur zakat dan strategi BSC memang tersedia di sistem?',
    answer:
      'Ya, keduanya tersedia di NIZAM. Tetap saja, tampilannya bisa bergantung pada paket modul dan permission yang sedang aktif di organisasi Anda.',
  },
  {
    question: 'Apakah NIZAM langsung dimulai dari landing page publik?',
    answer:
      'Untuk flow produk saat ini, user baru tetap masuk melalui landing page publik ini lalu melanjutkan ke login. Setelah login, onboarding dan akses modul mengikuti status organisasi yang aktif.',
  },
  {
    question: 'Apakah NIZAM lebih enak dipakai di desktop atau mobile?',
    answer:
      'Untuk setup dan operasional lengkap, pengalaman terbaik tetap di desktop atau laptop. Namun beberapa area preview di landing page sengaja dibuat tetap terasa seperti tampilan desktop meski dibuka dari tablet atau ponsel.',
  },
]

const trustValues = [
  {
    title: 'Profesionalitas',
    description: 'Bantu tim Anda bekerja lebih rapi dengan alur yang jelas, tampilan yang tertata, dan struktur modul yang mudah diikuti.',
    icon: BadgeCheck,
  },
  {
    title: 'Integritas',
    description: 'Lacak approval, audit trail, dan konteks unit agar keputusan bisnis Anda lebih terlacak dan lebih bertanggung jawab.',
    icon: ShieldCheck,
  },
  {
    title: 'Amanah',
    description: 'Jalankan operasional harian dengan sistem yang membantu Anda menjaga ketertiban data, proses, dan kepercayaan tim.',
    icon: CheckCircle2,
  },
  {
    title: 'Taat Syariah',
    description: 'Gunakan area seperti zakat untuk kebutuhan bisnis yang ingin berjalan lebih tertib dan tetap taat syariah.',
    icon: HandCoins,
  },
]

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="max-w-3xl space-y-4">
      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 shadow-sm">
        <Sparkles size={14} className="text-amber-500" />
        {eyebrow}
      </div>
      <h2 className="text-3xl font-black tracking-tighter text-slate-950 sm:text-4xl">{title}</h2>
      <p className="text-base font-medium leading-7 text-slate-600">{description}</p>
    </div>
  )
}

function EcosystemLogoMark({ id, className }: { id: string; className?: string }) {
  const baseClassName = `h-10 w-auto ${className ?? ''}`

  if (id === 'supabase') {
    return (
      <svg viewBox="0 0 64 64" className={baseClassName} aria-hidden="true">
        <path d="M37 7c1.8-2.5 5.7-1.2 5.7 1.9v29.4L31.1 55.5c-1.8 2.6-5.8 1.3-5.8-1.8V24.3z" fill="currentColor" opacity="0.95" />
        <path d="M27 57c-1.6 0-3-1.2-3-2.9V24.7h-7.1c-2.4 0-3.8-2.8-2.3-4.8L27 2.8C28.7.5 32.3 1.7 32.3 4.6V34h7.5c2.4 0 3.8 2.8 2.3 4.8L29.4 55.8A3 3 0 0 1 27 57" fill="currentColor" />
      </svg>
    )
  }

  if (id === 'nextjs') {
    return (
      <svg viewBox="0 0 64 64" className={baseClassName} aria-hidden="true">
        <circle cx="32" cy="32" r="25" fill="none" stroke="currentColor" strokeWidth="4" />
        <path d="M23 43V21l17 22V21" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M42 42 21 19" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      </svg>
    )
  }

  if (id === 'resend') {
    return (
      <svg viewBox="0 0 64 64" className={baseClassName} aria-hidden="true">
        <rect x="10" y="16" width="44" height="32" rx="8" fill="none" stroke="currentColor" strokeWidth="4" />
        <path d="m16 22 16 13 16-13" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18 42h28" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" opacity="0.75" />
      </svg>
    )
  }

  if (id === 'tailwind') {
    return (
      <svg viewBox="0 0 64 64" className={baseClassName} aria-hidden="true">
        <path
          d="M20 24c4.2-6 8.3-8 12.4-8 6.8 0 10.2 3.6 12.3 10.6-4.3-6-8.4-8-12.3-8-4.3 0-7.3 2.4-12.4 10.6ZM7 40c4.2-6 8.3-8 12.4-8 6.8 0 10.2 3.6 12.3 10.6-4.3-6-8.4-8-12.3-8-4.3 0-7.3 2.4-12.4 10.6Zm25 0c4.2-6 8.3-8 12.4-8 6.8 0 10.2 3.6 12.3 10.6-4.3-6-8.4-8-12.3-8-4.3 0-7.3 2.4-12.4 10.6Z"
          fill="currentColor"
        />
      </svg>
    )
  }

  if (id === 'framer') {
    return (
      <svg viewBox="0 0 64 64" className={baseClassName} aria-hidden="true">
        <path d="M17 50V14h30L31.5 29.5 47 45H31.5L17 50Z" fill="currentColor" />
        <path d="M17 14h30L32 29H17z" fill="currentColor" opacity="0.8" />
        <path d="M17 32h15v18z" fill="currentColor" opacity="0.55" />
      </svg>
    )
  }

  if (id === 'typescript') {
    return (
      <svg viewBox="0 0 64 64" className={baseClassName} aria-hidden="true">
        <rect x="10" y="10" width="44" height="44" rx="8" fill="currentColor" opacity="0.2" />
        <rect x="10" y="10" width="44" height="44" rx="8" fill="none" stroke="currentColor" strokeWidth="3" />
        <path d="M22 24h20M32 24v17" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <path d="M42 30c-2 0-4 1.1-4 3.2 0 2 1.6 2.8 3.8 3.4 2.4.7 4.2 1.5 4.2 4 0 3-2.5 4.8-5.8 4.8-2.1 0-4.1-.7-5.6-2" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      </svg>
    )
  }

  return null
}

export function NizamLandingPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900">
      <div className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[560px] bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.10),_transparent_30%),linear-gradient(180deg,_#ffffff_0%,_#f2f7fb_50%,_#f8fafc_100%)]" />
        <div className="absolute left-[-60px] top-24 h-64 w-64 rounded-full bg-blue-200/20 blur-3xl" />
        <div className="absolute right-[-40px] top-16 h-64 w-64 rounded-full bg-slate-200/35 blur-3xl" />

        <header className="relative mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-6 lg:px-8">
          <Link href="/" className="flex items-center gap-4">
            <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-white/60 bg-white shadow-xl shadow-slate-200/70">
              <Image src="/logo.png" alt="NIZAM" fill className="object-cover scale-[1.15]" sizes="56px" />
            </div>
            <div>
              <div className="text-xl font-black uppercase tracking-tight text-slate-950">NIZAM</div>
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Mini ERP Modular</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-3 md:flex">
            <a href="#fitur" className="rounded-full px-4 py-2 text-sm font-bold text-slate-500 hover:bg-white/80 hover:text-slate-900">
              Fitur Utama
            </a>
            <a href="#alur" className="rounded-full px-4 py-2 text-sm font-bold text-slate-500 hover:bg-white/80 hover:text-slate-900">
              Alur Kerja
            </a>
            <a href="#untuk-siapa" className="rounded-full px-4 py-2 text-sm font-bold text-slate-500 hover:bg-white/80 hover:text-slate-900">
              Cocok Untuk
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm hover:-translate-y-0.5 hover:border-slate-300 hover:text-slate-950"
            >
              Masuk
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-full bg-[#003366] px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-900/15 hover:-translate-y-0.5 hover:bg-[#002952]"
            >
              Daftar
              <ArrowRight size={16} />
            </Link>
          </div>
        </header>

        <main className="relative mx-auto max-w-7xl px-6 pb-20 pt-8 lg:px-8 lg:pb-28 lg:pt-10">
          <section className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-blue-700 shadow-sm">
                <CheckCircle2 size={14} />
                Dibuat untuk operasional yang ingin lebih rapi, bukan sekadar lebih ramai
              </div>

              <div className="space-y-5">
                <h1 className="max-w-4xl text-5xl font-black tracking-tighter text-slate-950 sm:text-6xl">
                  Mini ERP modular untuk bisnis yang ingin bergerak lebih tenang dan lebih terukur.
                </h1>
                <p className="max-w-2xl text-lg font-medium leading-8 text-slate-600">
                  NIZAM membantu Anda menghubungkan keuangan, stok, penjualan, SDM, approval, dan laporan ke dalam satu alur kerja.
                  Fokusnya bukan terdengar paling besar, tapi membuat proses bisnis harian lebih tertata, lebih mudah dipantau,
                  dan dibangun dengan semangat profesionalitas, integritas, amanah, serta perhatian pada kebutuhan yang tetap taat syariah.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-[24px] bg-[#003366] px-7 py-4 text-sm font-black text-white shadow-2xl shadow-blue-900/15 hover:-translate-y-0.5 hover:bg-[#002952]"
                >
                  Mulai Buat Akun
                  <ArrowRight size={16} />
                </Link>
                <Link
                  href="/demo"
                  className="inline-flex items-center gap-2 rounded-[24px] border border-[#f59e0b] bg-[#f59e0b] px-7 py-4 text-sm font-black text-white shadow-lg shadow-amber-500/25 hover:-translate-y-0.5 hover:border-[#d97706] hover:bg-[#d97706]"
                >
                  Coba Demo
                </Link>
              </div>

              <div className="flex flex-wrap gap-2">
                {capabilityPills.map((pill) => (
                  <span
                    key={pill}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 shadow-sm"
                  >
                    {pill}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-x-8 top-10 h-20 rounded-full bg-blue-200/25 blur-3xl" />
              <div className="relative">
                <NizamDashboardHeroPreview />
              </div>
            </div>
          </section>
        </main>
      </div>

      <section className="mx-auto max-w-7xl px-6 py-8 lg:px-8 lg:py-12">
        <div className="rounded-[34px] border border-slate-200 bg-white px-6 py-8 shadow-[0_18px_50px_-38px_rgba(15,23,42,0.18)] lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                <Sparkles size={14} className="text-amber-500" />
                Nilai yang Ingin Kami Jaga
              </div>
              <h2 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                Profesional, berintegritas, amanah, dan tetap memberi ruang bagi bisnis yang tetap taat syariah.
              </h2>
              <p className="max-w-xl text-sm font-medium leading-7 text-slate-600">
                Saat Anda menaruh operasional bisnis ke dalam satu sistem, yang Anda cari bukan hanya fitur. Anda juga butuh proses yang
                tertib, data yang lebih mudah dipertanggungjawabkan, dan ritme kerja yang terasa aman untuk dipakai setiap hari.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {trustValues.map((value) => {
                const Icon = value.icon

                return (
                  <article key={value.title} className="rounded-[26px] border border-slate-200 bg-[#fbfcfd] p-5">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                      <Icon size={20} />
                    </div>
                    <h3 className="mt-4 text-lg font-black tracking-tight text-slate-900">{value.title}</h3>
                    <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{value.description}</p>
                  </article>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-8 lg:px-8 lg:py-12">
        <SectionTitle
          eyebrow="Partner & Ekosistem"
          title="Dibangun di atas fondasi teknologi yang mendukung ritme kerja yang stabil"
          description="Berikut fondasi teknologi yang menopang pengalaman NIZAM saat ini, dari aplikasi, database, sampai integrasi pendukungnya."
        />

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {ecosystemPartners.map((partner) => (
            <article
              key={partner.label}
              className="group rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] px-5 py-6 text-center shadow-[0_18px_44px_-34px_rgba(15,23,42,0.18)] transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_22px_48px_-34px_rgba(15,23,42,0.24)]"
            >
              <div className={`mx-auto mb-5 flex h-14 items-center justify-center text-slate-300 transition-colors duration-300 ${partner.hoverClass}`}>
                <EcosystemLogoMark id={partner.id} className="h-11 w-auto" />
              </div>
              <div className="text-lg font-black tracking-tight text-slate-700 transition-colors duration-300 group-hover:text-slate-950">{partner.label}</div>
              <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 transition-colors duration-300 group-hover:text-slate-500">{partner.meta}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-8 lg:px-8 lg:py-12">
        <SectionTitle
          eyebrow="Cicip Menu"
          title="Lihat susunan menu yang akan Anda temui saat mulai menjelajahi NIZAM"
          description="Gunakan area di bawah untuk mengenali modul utama, memahami arah navigasi, dan merasakan struktur produk secara read-only."
        />

        <div className="mt-10">
          <NizamMenuExplorer />
        </div>
      </section>

      <section id="fitur" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <SectionTitle
          eyebrow="Yang Cukup Menonjol"
          title="Fitur yang memang terasa berbeda saat produk mulai dipakai"
          description="Anda bisa mulai dari area yang paling relevan untuk bisnis Anda, terutama jika Anda membutuhkan kontrol operasional, zakat, strategi, dan visibilitas lintas unit."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-4">
          {highlightCards.map((card) => {
            const Icon = card.icon

            return (
              <article key={card.title} className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_-38px_rgba(15,23,42,0.24)]">
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${card.accent} text-white shadow-md`}>
                  <Icon size={22} />
                </div>
                <h3 className="mt-5 text-xl font-black tracking-tight text-slate-900">{card.title}</h3>
                <p className="mt-3 text-sm font-medium leading-6 text-slate-600">{card.description}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section id="alur" className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <SectionTitle
            eyebrow="Alur Kerja"
            title="Mulai dari dasar, lalu naik ke operasional dan strategi"
            description="Alur NIZAM lebih masuk akal kalau dipakai bertahap: siapkan fondasi, jalankan transaksi, rapikan approval, lalu baca angka dan arah bisnis dari data yang sama."
          />

          <div className="mt-12 grid gap-5 lg:grid-cols-4">
            {flowSteps.map((step, index) => {
              const Icon = step.icon

              return (
                <article key={step.title} className="rounded-[28px] border border-slate-200 bg-[#fbfcfd] p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#003366] text-white shadow-md shadow-blue-900/10">
                      <Icon size={22} />
                    </div>
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-300">0{index + 1}</div>
                  </div>
                  <h3 className="mt-6 text-xl font-black tracking-tight text-slate-950">{step.title}</h3>
                  <p className="mt-3 text-sm font-medium leading-6 text-slate-600">{step.description}</p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section id="untuk-siapa" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <SectionTitle
          eyebrow="Cocok Untuk"
          title="Bukan untuk semua bisnis, tapi untuk bisnis anda yang..."
          description="NIZAM akan terasa lebih relevan jika Anda sedang menata proses, memperkuat kontrol internal, dan ingin membaca angka bisnis dengan konteks yang lebih utuh."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {audienceCards.map((card) => {
            const Icon = card.icon

            return (
              <article key={card.title} className="rounded-[30px] border border-slate-200 bg-white p-7 shadow-[0_18px_50px_-38px_rgba(15,23,42,0.2)]">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 shadow-sm">
                  <Icon size={22} />
                </div>
                <h3 className="mt-5 text-xl font-black tracking-tight text-slate-900">{card.title}</h3>
                <p className="mt-3 text-sm font-medium leading-6 text-slate-600">{card.description}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <SectionTitle
            eyebrow="Perspektif Pengguna"
            title="Sudut pandang yang biasanya paling dicari saat tim menilai sistem seperti NIZAM"
            description="Bagian ini merangkum sudut pandang per peran yang paling sering dicari saat menilai sistem seperti NIZAM, sambil menunggu testimoni pelanggan resmi yang siap dipublikasikan."
          />

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {perspectiveCards.map((item) => (
              <article
                key={item.role}
                className="rounded-[32px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#fbfcfd_100%)] p-7 shadow-[0_20px_50px_-38px_rgba(15,23,42,0.18)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-600">{item.focus}</div>
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                    <Quote size={18} />
                  </div>
                </div>
                <p className="mt-5 text-lg font-black leading-8 tracking-tight text-slate-900">“{item.quote}”</p>
                <div className="mt-6 border-t border-slate-100 pt-5 text-sm font-bold text-slate-600">{item.role}</div>
              </article>
            ))}
          </div>

          <p className="mt-6 text-sm font-medium leading-7 text-slate-500">
            Perspektif di atas membantu Anda membaca kecocokan penggunaan dari sudut pandang peran, tanpa berpura-pura menjadi testimoni pelanggan spesifik.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <SectionTitle
          eyebrow="FAQ"
          title="Pertanyaan yang paling mungkin muncul sebelum mulai mencoba NIZAM"
          description="Bagian ini membantu calon user memahami flow, kecocokan penggunaan, dan beberapa batasan yang memang perlu dijelaskan sejak awal."
        />

        <div className="mt-12 grid gap-4 lg:grid-cols-2">
          {faqItems.map((item, index) => (
            <details
              key={item.question}
              className="group rounded-[28px] border border-slate-200 bg-white px-6 py-5 shadow-[0_14px_34px_-26px_rgba(15,23,42,0.18)]"
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 pr-0">
                <div className="flex items-start gap-4">
                  <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-[11px] font-black uppercase tracking-[0.12em] text-amber-600">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <span className="pt-1 text-base font-black tracking-tight text-slate-900">{item.question}</span>
                </div>
                <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-400 transition group-open:rotate-180 group-open:text-slate-900">
                  <ChevronDown size={18} />
                </div>
              </summary>
              <p className="mt-5 border-t border-slate-100 pt-5 text-sm font-medium leading-7 text-slate-600">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="px-6 pb-20 lg:px-8 lg:pb-24">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[36px] border border-slate-200 bg-white px-8 py-10 shadow-[0_25px_70px_-40px_rgba(15,23,42,0.22)] sm:px-10 lg:px-14 lg:py-14">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                <Sparkles size={14} className="text-amber-500" />
                Mulai dari flow yang memang ada
              </div>
              <h2 className="text-3xl font-black tracking-tighter text-slate-950 sm:text-4xl">
                Lihat dulu cara kerja NIZAM, lalu putuskan apakah ritmenya cocok untuk bisnis Anda.
              </h2>
              <p className="max-w-2xl text-base font-medium leading-7 text-slate-600">
                Mulailah dari akun baru, masuk ke demo, atau lanjut login jika Anda sudah punya akses. Dari sana Anda bisa menilai sendiri
                apakah alur kerja, struktur modul, dan cara baca datanya sesuai dengan kebutuhan bisnis Anda.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Link
                href="/demo"
                className="rounded-[24px] border border-[#f59e0b] bg-[#f59e0b] px-6 py-4 text-sm font-black text-white shadow-lg shadow-amber-500/25 hover:-translate-y-0.5 hover:border-[#d97706] hover:bg-[#d97706]"
              >
                Coba Demo
              </Link>
              <Link
                href="/login"
                className="rounded-[24px] border border-[#003366] bg-[#003366] px-6 py-4 text-sm font-black text-white shadow-lg shadow-blue-900/15 hover:-translate-y-0.5 hover:bg-[#002952]"
              >
                Masuk ke NIZAM
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="px-6 pb-10 lg:px-8">
        <div className="mx-auto max-w-7xl border-t border-slate-200 pt-6 text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Create with integritas</p>
        </div>
      </footer>
    </div>
  )
}
