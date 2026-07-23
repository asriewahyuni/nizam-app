'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  BadgeCheck,
  BookOpen,
  Building2,
  Clock3,
  CreditCard,
  Layers3,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import {
  createMemberCheckout,
  type MemberCheckoutOffering,
  type MemberCheckoutState,
} from '@/modules/member/actions/checkout.actions'

const initialState: MemberCheckoutState = {}

export default function CheckoutForm({
  orgSlug,
  offerings,
  initialReferralCode,
  signedIn,
  memberName,
  memberEmail,
}: {
  orgSlug: string
  offerings: MemberCheckoutOffering[]
  initialReferralCode: string
  signedIn: boolean
  memberName: string
  memberEmail: string
}) {
  const [state, action, pending] = useActionState(createMemberCheckout, initialState)
  const [selectedId, setSelectedId] = useState(offerings[0]?.storeProductId || '')
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const selected = useMemo(
    () => offerings.find((offering) => offering.storeProductId === selectedId) || offerings[0],
    [offerings, selectedId],
  )

  useEffect(() => {
    if (state.paymentUrl) window.location.assign(state.paymentUrl)
  }, [state.paymentUrl])

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
              <UserRound aria-hidden="true" size={20} />
            </span>
            <div>
              <h2 className="text-lg font-bold">Data pembeli</h2>
              <p className="text-sm text-slate-600">
                {signedIn ? 'Checkout memakai akun yang sedang masuk.' : 'Akun belajar akan disiapkan dari email ini.'}
              </p>
            </div>
          </div>
          {signedIn ? (
            <dl className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nama</dt>
                <dd className="mt-1 font-semibold text-slate-900">{memberName}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</dt>
                <dd className="mt-1 break-all font-semibold text-slate-900">{memberEmail || '-'}</dd>
              </div>
            </dl>
          ) : selected?.allowGuestCheckout ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                Nama lengkap
                <input
                  name="fullName"
                  required
                  autoComplete="name"
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 font-normal outline-none transition-colors duration-200 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Email
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 font-normal outline-none transition-colors duration-200 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Nomor WhatsApp
                <input
                  name="phone"
                  type="tel"
                  required
                  minLength={8}
                  autoComplete="tel"
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 font-normal outline-none transition-colors duration-200 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100"
                />
              </label>
              <p className="text-sm leading-6 text-slate-600 sm:col-span-2">
                Setelah order dibuat, tautan aktivasi akun dikirim melalui email. Tautan hanya dapat dipakai sekali.
              </p>
            </div>
          ) : (
            <div role="alert" className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              Checkout tamu belum dibuka untuk store ini.{' '}
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(`/member/${orgSlug}/checkout`)}`}
                className="inline-flex min-h-11 cursor-pointer items-center rounded-lg px-2 font-bold underline decoration-2 underline-offset-2 transition-colors duration-200 hover:bg-amber-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-200"
              >
                Masuk untuk melanjutkan
              </Link>
              .
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold">Pilih paket</h2>
          <div className="mt-4 grid gap-3">
            {offerings.map((offering) => (
              <label
                key={offering.storeProductId}
                className="flex min-h-16 cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 transition-colors duration-200 hover:border-emerald-400 has-[:checked]:border-emerald-600 has-[:checked]:bg-emerald-50 focus-within:ring-4 focus-within:ring-emerald-100"
              >
                <input
                  type="radio"
                  name="storeProductId"
                  value={offering.storeProductId}
                  checked={selectedId === offering.storeProductId}
                  onChange={() => setSelectedId(offering.storeProductId)}
                  className="mt-1 size-4 accent-emerald-700"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{offering.productName}</span>
                  <span className="mt-1 block text-sm text-slate-600">
                    {offering.courseCount > 0
                      ? `${offering.courseCount} course`
                      : 'Produk tanpa course'}
                    {offering.billingLabel ? ` · berulang tiap ${offering.billingLabel.toLowerCase()}` : ''}
                  </span>
                </span>
                <span className="font-bold text-emerald-900">{formatRupiah(offering.price)}</span>
              </label>
            ))}
          </div>
        </section>

        {selected && selected.courseBenefits.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">Anda mendapatkan</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Semua course berikut otomatis masuk ke akun setelah pembayaran tervalidasi.
                </p>
              </div>
              <span className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-100 px-4 text-sm font-bold text-emerald-900">
                <Layers3 aria-hidden="true" size={17} />
                {selected.courseCount} course
              </span>
            </div>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {selected.courseBenefits.map((benefit) => (
                <li key={benefit.courseId} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex gap-3">
                    <BookOpen aria-hidden="true" className="mt-0.5 shrink-0 text-emerald-700" size={19} />
                    <div>
                      <p className="font-semibold text-slate-950">{benefit.title}</p>
                      <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                        <Clock3 aria-hidden="true" size={15} />
                        {benefit.durationLabel}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold">Diskon dan referensi</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Kode kupon
              <input
                name="couponCode"
                placeholder="Masukkan jika ada"
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 font-normal uppercase outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Kode afiliasi
              <input
                name="referralCode"
                defaultValue={initialReferralCode}
                placeholder="Opsional"
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 font-normal outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold">Metode pembayaran</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { code: 'MANUAL', label: 'Transfer manual', icon: Building2 },
              { code: 'MOOTA', label: 'Transfer + Moota', icon: BadgeCheck },
              { code: 'DUITKU', label: 'Duitku', icon: CreditCard },
            ].map((method, index) => {
              const Icon = method.icon
              return (
                <label
                  key={method.code}
                  className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 transition-colors duration-200 hover:border-emerald-400 has-[:checked]:border-emerald-600 has-[:checked]:bg-emerald-50 focus-within:ring-4 focus-within:ring-emerald-100"
                >
                  <input
                    type="radio"
                    name="providerCode"
                    value={method.code}
                    defaultChecked={index === 0}
                    className="size-4 accent-emerald-700"
                  />
                  <Icon aria-hidden="true" size={18} />
                  <span className="text-sm font-semibold">{method.label}</span>
                </label>
              )
            })}
          </div>
        </section>
      </div>

      <aside className="h-fit rounded-2xl border border-emerald-900/10 bg-emerald-950 p-6 text-white shadow-lg lg:sticky lg:top-24">
        <p className="text-sm font-semibold text-emerald-200">Ringkasan</p>
        <h2 className="mt-2 text-xl font-bold">{selected?.productName || 'Paket belajar'}</h2>
        <div className="mt-6 flex items-center justify-between border-t border-emerald-800 pt-5">
          <span className="text-emerald-100">Harga sebelum kupon</span>
          <span className="text-xl font-bold">{formatRupiah(selected?.price || 0)}</span>
        </div>
        <div className="mt-5 flex gap-3 rounded-xl bg-emerald-900/70 p-4 text-sm leading-6 text-emerald-100">
          <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0" size={19} />
          Pembayaran, akses kelas, dan pencatatan ERP diproses dengan kunci anti-duplikat.
        </div>

        {state.error && (
          <div role="alert" className="mt-5 rounded-xl border border-red-300 bg-red-950/50 p-4 text-sm text-red-100">
            {state.error}
          </div>
        )}
        {state.success && !state.paymentUrl && (
          <div role="status" className="mt-5 rounded-xl border border-emerald-300 bg-emerald-900 p-4 text-sm text-emerald-50">
            <p className="font-semibold">Order {state.orderNumber} berhasil dibuat.</p>
            {state.accountClaimRequired && (
              <p className="mt-2 text-emerald-100">
                Periksa email untuk mengaktifkan akun belajar Anda.
              </p>
            )}
            {state.paymentInstructions && (
              <dl className="mt-3 space-y-1 text-emerald-100">
                {Object.entries(state.paymentInstructions).map(([key, value]) => (
                  value ? <div key={key}>{String(value)}</div> : null
                ))}
              </dl>
            )}
            {state.orderAccessUrl && (
              <a
                href={state.orderAccessUrl}
                className="mt-4 inline-flex min-h-11 cursor-pointer items-center rounded-xl bg-white px-4 font-semibold text-emerald-900 transition hover:bg-emerald-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300"
              >
                Buka status order
              </a>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={
            pending
            || offerings.length === 0
            || (!signedIn && !selected?.allowGuestCheckout)
          }
          className="mt-6 min-h-12 w-full cursor-pointer rounded-xl bg-orange-600 px-5 font-bold text-white transition-colors duration-200 hover:bg-orange-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Memproses dengan aman…' : 'Buat order dan lanjut bayar'}
        </button>
      </aside>
    </form>
  )
}
