/**
 * Kumpulan builder XLSX untuk data admin LMS (Course Catalog, Member Directory,
 * Transaksi, Produk, Kupon, Afiliasi & Pencairan). Setiap fungsi memakai
 * fetcher data yang sama dengan halaman admin terkait, lalu diratakan jadi
 * baris tabel untuk di-export.
 */
import 'server-only'

import { buildTableXLSXBuffer, type TableColumn } from '@/lib/xlsx/table-workbook.server'
import { getLmsAdminMembers } from '@/modules/edu/actions/lms-members.actions'
import { getLmsCourses } from '@/modules/edu/actions/lms-commercial.actions'
import { getLmsAdminSalesList } from '@/modules/edu/lib/lms-sales.server'
import {
  getLmsCouponSalesData,
  getLmsProductSalesData,
} from '@/modules/ecommerce/lib/lms-sales.server'
import {
  getAdminAffiliateList,
  getAdminAffiliatePayouts,
} from '@/modules/ecommerce/lib/affiliate.server'

const EXPORT_PAGE_SIZE = 100

function formatDate(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

export async function buildLmsCoursesXLSX(orgId: string): Promise<Buffer> {
  const courses = await getLmsCourses(orgId)

  const columns: TableColumn[] = [
    { header: 'Judul', key: 'title', width: 40 },
    { header: 'Slug', key: 'slug', width: 30 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Level', key: 'levelCode', width: 12 },
    { header: 'Durasi (menit)', key: 'durationMinutes', width: 16 },
    { header: 'Aktif', key: 'isActive', width: 10 },
    { header: 'Unggulan', key: 'isFeatured', width: 10 },
    { header: 'Afiliasi Aktif', key: 'isAffiliateEnabled', width: 14 },
    { header: 'Jenis Komisi', key: 'affiliateCommissionType', width: 14 },
    { header: 'Nilai Komisi', key: 'affiliateCommissionValue', width: 14 },
    { header: 'Dibuat', key: 'createdAt', width: 20 },
  ]

  const rows = (courses || []).map((course: Record<string, unknown>) => ({
    title: course.title || '',
    slug: course.slug || '',
    status: course.status || '',
    levelCode: course.level_code || '',
    durationMinutes: Number(course.duration_minutes || 0),
    isActive: course.is_active ? 'Ya' : 'Tidak',
    isFeatured: course.is_featured ? 'Ya' : 'Tidak',
    isAffiliateEnabled: course.is_affiliate_enabled ? 'Ya' : 'Tidak',
    affiliateCommissionType: course.affiliate_commission_type || '',
    affiliateCommissionValue: Number(course.affiliate_commission_value || 0),
    createdAt: formatDate(course.created_at as string),
  }))

  return buildTableXLSXBuffer('Course Catalog', columns, rows)
}

export async function buildLmsMembersXLSX(filters: {
  search?: string
  levelFilter?: string
  courseFilter?: string
  sortBy?: string
}): Promise<Buffer> {
  const columns: TableColumn[] = [
    { header: 'Nama', key: 'name', width: 28 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'No. HP', key: 'phone', width: 18 },
    { header: 'Role', key: 'role', width: 14 },
    { header: 'Aktif', key: 'isActive', width: 10 },
    { header: 'Bergabung', key: 'joinedAt', width: 20 },
    { header: 'Kelas Diikuti', key: 'enrolledCount', width: 14 },
    { header: 'Kelas Selesai', key: 'completedCount', width: 14 },
    { header: 'Level', key: 'levelName', width: 16 },
    { header: 'Jumlah Badge', key: 'badgeCount', width: 14 },
  ]

  const rows: Array<Record<string, unknown>> = []
  let page = 1
  for (;;) {
    const result = await getLmsAdminMembers(
      filters.search || '',
      filters.levelFilter || 'ALL',
      filters.courseFilter || 'ALL',
      filters.sortBy || 'level_desc',
      page,
      EXPORT_PAGE_SIZE,
    )
    for (const member of result.members) {
      rows.push({
        name: member.name,
        email: member.email,
        phone: member.phone || '',
        role: member.role,
        isActive: member.isActive ? 'Ya' : 'Tidak',
        joinedAt: formatDate(member.joinedAt),
        enrolledCount: member.enrolledCount,
        completedCount: member.completedCount,
        levelName: member.levelName,
        badgeCount: member.badges?.length || 0,
      })
    }
    if (page >= result.totalPages || result.members.length === 0) break
    page += 1
  }

  return buildTableXLSXBuffer('Member Directory', columns, rows)
}

export async function buildLmsSalesXLSX(
  orgId: string,
  filters: {
    search?: string
    status?: string
    courseId?: string
    startDate?: string
    endDate?: string
  },
): Promise<Buffer> {
  const columns: TableColumn[] = [
    { header: 'No. Order', key: 'orderNumber', width: 22 },
    { header: 'Tanggal', key: 'createdAt', width: 20 },
    { header: 'Pelanggan', key: 'customerName', width: 26 },
    { header: 'Email', key: 'customerEmail', width: 28 },
    { header: 'No. HP', key: 'customerPhone', width: 18 },
    { header: 'Produk', key: 'items', width: 40 },
    { header: 'Subtotal', key: 'subtotalAmount', width: 16 },
    { header: 'Diskon', key: 'discountAmount', width: 16 },
    { header: 'Total', key: 'grandTotal', width: 16 },
    { header: 'Status Bayar', key: 'paymentStatus', width: 14 },
    { header: 'Payment Gateway', key: 'paymentGateway', width: 16 },
    { header: 'Afiliasi', key: 'affiliateName', width: 22 },
    { header: 'Komisi Afiliasi', key: 'affiliateCommission', width: 16 },
    { header: 'Sumber', key: 'source', width: 12 },
  ]

  const rows: Array<Record<string, unknown>> = []
  let offset = 0
  for (;;) {
    const result = await getLmsAdminSalesList(orgId, {
      ...filters,
      limit: EXPORT_PAGE_SIZE,
      offset,
    })
    for (const sale of result.sales) {
      rows.push({
        orderNumber: sale.orderNumber,
        createdAt: formatDate(sale.createdAt),
        customerName: sale.customerName,
        customerEmail: sale.customerEmail || '',
        customerPhone: sale.customerPhone,
        items: sale.items.map((item) => `${item.productName} x${item.quantity}`).join(', '),
        subtotalAmount: sale.subtotalAmount,
        discountAmount: sale.discountAmount,
        grandTotal: sale.grandTotal,
        paymentStatus: sale.paymentStatus,
        paymentGateway: sale.paymentGateway || '',
        affiliateName: sale.affiliate?.affiliateName || '',
        affiliateCommission: sale.affiliate?.commissionAmount || 0,
        source: sale.source,
      })
    }
    offset += EXPORT_PAGE_SIZE
    if (offset >= result.totalCount || result.sales.length === 0) break
  }

  return buildTableXLSXBuffer('Transaksi', columns, rows)
}

export async function buildLmsProductsXLSX(): Promise<Buffer> {
  const { storeProducts } = await getLmsProductSalesData()

  const columns: TableColumn[] = [
    { header: 'Nama Produk', key: 'publicName', width: 36 },
    { header: 'Slug', key: 'publicSlug', width: 30 },
    { header: 'Harga', key: 'price', width: 16 },
    { header: 'Harga Coret', key: 'comparePrice', width: 16 },
    { header: 'Jenis', key: 'offeringType', width: 16 },
    { header: 'Dipublikasikan', key: 'isPublished', width: 14 },
    { header: 'Unggulan', key: 'isFeatured', width: 10 },
    { header: 'Badge', key: 'badgeText', width: 16 },
  ]

  const rows = storeProducts.map((product) => ({
    publicName: product.publicName,
    publicSlug: product.publicSlug,
    price: product.priceOverride ?? 0,
    comparePrice: product.comparePrice ?? 0,
    offeringType: product.offeringType,
    isPublished: product.isPublished ? 'Ya' : 'Tidak',
    isFeatured: product.isFeatured ? 'Ya' : 'Tidak',
    badgeText: product.badgeText || '',
  }))

  return buildTableXLSXBuffer('Produk', columns, rows)
}

export async function buildLmsCouponsXLSX(): Promise<Buffer> {
  const { coupons } = await getLmsCouponSalesData()

  const columns: TableColumn[] = [
    { header: 'Kode', key: 'code', width: 22 },
    { header: 'Jenis Diskon', key: 'discountType', width: 14 },
    { header: 'Nilai Diskon', key: 'discountValue', width: 14 },
    { header: 'Minimum Belanja', key: 'minimumAmount', width: 16 },
    { header: 'Kuota', key: 'usageLimit', width: 10 },
    { header: 'Batas/Member', key: 'perUserLimit', width: 14 },
    { header: 'Terpakai', key: 'redemptionCount', width: 12 },
    { header: 'Total Diskon Terpakai', key: 'totalDiscountAmount', width: 18 },
    { header: 'Aktif', key: 'isActive', width: 10 },
    { header: 'Template Afiliasi', key: 'isAffiliateTemplate', width: 16 },
    { header: 'Milik Afiliasi', key: 'affiliateProfileId', width: 14 },
    { header: 'Mulai', key: 'startsAt', width: 20 },
    { header: 'Berakhir', key: 'expiresAt', width: 20 },
  ]

  const rows = coupons.map((coupon) => ({
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    minimumAmount: coupon.minimumAmount,
    usageLimit: coupon.usageLimit ?? '',
    perUserLimit: coupon.perUserLimit,
    redemptionCount: coupon.redemptionCount,
    totalDiscountAmount: coupon.totalDiscountAmount,
    isActive: coupon.isActive ? 'Ya' : 'Tidak',
    isAffiliateTemplate: coupon.isAffiliateTemplate ? 'Ya' : 'Tidak',
    affiliateProfileId: coupon.affiliateProfileId ? 'Ya' : 'Tidak',
    startsAt: formatDate(coupon.startsAt),
    expiresAt: formatDate(coupon.expiresAt),
  }))

  return buildTableXLSXBuffer('Kupon', columns, rows)
}

export async function buildLmsAffiliatesXLSX(orgId: string): Promise<Buffer> {
  const affiliates = await getAdminAffiliateList(orgId)

  const columns: TableColumn[] = [
    { header: 'Nama', key: 'name', width: 26 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'No. HP', key: 'phone', width: 18 },
    { header: 'Kode Referral', key: 'referralCode', width: 20 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Menunggu', key: 'pendingAmount', width: 16 },
    { header: 'Siap Cair', key: 'payableAmount', width: 16 },
    { header: 'Sudah Dibayar', key: 'paidAmount', width: 16 },
    { header: 'Konversi', key: 'conversionCount', width: 12 },
    { header: 'Bergabung', key: 'createdAt', width: 20 },
  ]

  const rows = affiliates.map((affiliate) => ({
    name: affiliate.name,
    email: affiliate.email,
    phone: affiliate.phone,
    referralCode: affiliate.referralCode,
    status: affiliate.status,
    pendingAmount: affiliate.pendingAmount,
    payableAmount: affiliate.payableAmount,
    paidAmount: affiliate.paidAmount,
    conversionCount: affiliate.conversionCount,
    createdAt: formatDate(affiliate.createdAt),
  }))

  return buildTableXLSXBuffer('Afiliasi', columns, rows)
}

export async function buildLmsAffiliatePayoutsXLSX(orgId: string): Promise<Buffer> {
  const payouts = await getAdminAffiliatePayouts(orgId)

  const columns: TableColumn[] = [
    { header: 'No. Pencairan', key: 'payoutNumber', width: 20 },
    { header: 'Afiliasi', key: 'affiliateName', width: 26 },
    { header: 'Kode Referral', key: 'referralCode', width: 18 },
    { header: 'Nominal', key: 'amount', width: 16 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Bank', key: 'bankName', width: 18 },
    { header: 'No. Rekening', key: 'accountNumber', width: 18 },
    { header: 'Nama Pemilik', key: 'accountName', width: 22 },
    { header: 'Diajukan', key: 'createdAt', width: 20 },
    { header: 'Dibayar', key: 'paidAt', width: 20 },
  ]

  const rows = payouts.map((payout) => ({
    payoutNumber: payout.payoutNumber,
    affiliateName: payout.affiliateName,
    referralCode: payout.referralCode,
    amount: payout.amount,
    status: payout.status,
    bankName: payout.bankName,
    accountNumber: payout.accountNumber,
    accountName: payout.accountName,
    createdAt: formatDate(payout.createdAt),
    paidAt: formatDate(payout.paidAt),
  }))

  return buildTableXLSXBuffer('Pencairan Afiliasi', columns, rows)
}
