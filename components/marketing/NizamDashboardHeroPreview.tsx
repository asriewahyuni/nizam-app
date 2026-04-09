// Cuplikan hero ini memakai komponen dashboard asli NIZAM
// dengan data demo, agar preview landing page tetap jujur.
import { DashboardClient } from '@/app/(dashboard)/dashboard/DashboardClient'

const dashboardDemoData = {
  orgName: 'NIZAM Demo',
  metrics: [
    {
      label: 'Total Kas & Bank',
      value: 'Rp248.000.000',
      icon: 'wallet',
      hint: 'Total saldo di semua rekening',
      href: '/cash',
    },
    {
      label: 'Operating Cash Flow',
      value: 'Rp38.400.000',
      icon: 'profit',
      hint: 'Arus Kas Real dari Operasional',
      href: '/reports',
    },
    {
      label: 'Runway / Burn Rate',
      value: 'Aman (OCF Positif)',
      icon: 'wallet',
      hint: 'Perusahaan mencetak Net Cash.',
      href: '/accounting/budgets',
    },
    {
      label: 'Hutang & Piutang',
      value: 'Rp74.000.000 / Rp48.000.000',
      icon: 'receivables',
      hint: 'Rasio AP vs AR yang mengikat kas',
      href: '/accounting/aging?view=AP',
    },
    {
      label: 'Laba Bersih (Accrual)',
      value: 'Rp44.600.000',
      icon: 'profit',
      hint: 'Laba Kertas (AWAS ILUSI)',
      href: '/reports',
    },
  ],
  analytics: [
    { name: 'Jan', revenue: 96000000, expense: 71000000, profit: 25000000 },
    { name: 'Feb', revenue: 104000000, expense: 74800000, profit: 29200000 },
    { name: 'Mar', revenue: 118000000, expense: 82200000, profit: 35800000 },
    { name: 'Apr', revenue: 112000000, expense: 80400000, profit: 31600000 },
    { name: 'Mei', revenue: 127000000, expense: 87400000, profit: 39600000 },
    { name: 'Jun', revenue: 133000000, expense: 88400000, profit: 44600000 },
  ],
  topExpenses: [
    { name: 'Logistik', value: 18400000 },
    { name: 'Gaji Tim', value: 16200000 },
    { name: 'Sewa Operasional', value: 11800000 },
    { name: 'Promosi', value: 9100000 },
    { name: 'Utilitas', value: 5400000 },
    { name: 'Maintenance', value: 3600000 },
  ],
  topProducts: [
    { name: 'Beras Premium 25kg', revenue: 68400000, qty: 182, profit: 14400000 },
    { name: 'Minyak Goreng 2L', revenue: 51200000, qty: 240, profit: 9800000 },
    { name: 'Gula Kristal 1kg', revenue: 39600000, qty: 315, profit: 7600000 },
    { name: 'Tepung Terigu 1kg', revenue: 28500000, qty: 210, profit: 5100000 },
    { name: 'Kopi Bubuk 500gr', revenue: 22400000, qty: 136, profit: 4700000 },
    { name: 'Sirup Kurma 650ml', revenue: 17600000, qty: 92, profit: 3600000 },
    { name: 'Madu Hutan 250ml', revenue: 14800000, qty: 74, profit: 2900000 },
  ],
  paretoAnalysis: {
    totalProducts: 248,
    top20Count: 12,
    top20Revenue: 214000000,
    totalRevenue: 356000000,
    totalProfit: 71200000,
    paretoProducts: [
      { name: 'Beras Premium 25kg', revenue: 68400000, profit: 14400000 },
      { name: 'Minyak Goreng 2L', revenue: 51200000, profit: 9800000 },
      { name: 'Gula Kristal 1kg', revenue: 39600000, profit: 7600000 },
      { name: 'Tepung Terigu 1kg', revenue: 28500000, profit: 5100000 },
    ],
  },
  customerPareto: {
    totalCustomers: 164,
    top20Count: 9,
    top20Revenue: 228000000,
    top20Profit: 48400000,
    totalRevenue: 356000000,
    totalProfit: 71200000,
    paretoCustomers: [
      { id: 'cust-1', name: 'PT Samudra Retail', revenue: 82400000, profit: 18200000 },
      { id: 'cust-2', name: 'UD Amanah Mart', revenue: 69400000, profit: 14100000 },
      { id: 'cust-3', name: 'Koperasi Bina Usaha', revenue: 57600000, profit: 11600000 },
      { id: 'cust-4', name: 'CV Tunas Pangan', revenue: 18400000, profit: 5100000 },
    ],
  },
}

export function NizamDashboardHeroPreview() {
  return (
    <div className="overflow-hidden rounded-[34px] border border-slate-200 bg-white shadow-[0_32px_90px_-45px_rgba(15,23,42,0.32)]">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Cuplikan Dashboard</div>
      </div>

      <div className="relative h-[440px] overflow-hidden bg-[#f8fafc] sm:h-[520px] lg:h-[620px]">
        <div className="pointer-events-none absolute left-0 top-0 origin-top-left scale-[0.42] sm:scale-[0.52] lg:scale-[0.63]">
          <div className="w-[1180px] p-6">
            <DashboardClient data={dashboardDemoData} />
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white via-white/80 to-transparent" />
      </div>
    </div>
  )
}
