/**
 * MetricCard Component - Storybook & Usage Examples
 * 
 * This file documents all possible states and configurations of the MetricCard component.
 * Use this as reference for consistent styling across the dashboard.
 */

import { MetricCard } from './MetricCard'
import { Wallet, TrendingUp, TrendingDown, Package, Target } from 'lucide-react'

/**
 * Example 1: Normal State with Positive Trend
 * - Shows healthy metric with growth trend
 */
export function MetricCardNormalWithTrend() {
  return (
    <MetricCard
      label="Total Kas & Bank"
      value="Rp 1.960.804"
      hint="Mengikuti saldo rekening aktif di menu Kas & Bank"
      icon={Wallet}
      trend={12}
      href="/dashboard/cash"
    />
  )
}

/**
 * Example 2: Empty State
 * - Shows when no data is available yet
 */
export function MetricCardEmpty() {
  return (
    <MetricCard
      label="Hutang & Piutang"
      value="Rp 0"
      hint="Outstanding aging AP / AR dari modul operasional"
      icon={Package}
      isEmpty={true}
      href="/dashboard/accounting"
    />
  )
}

/**
 * Example 3: Danger State
 * - Highlights concerning metrics (negative trend, high payables, etc.)
 */
export function MetricCardDanger() {
  return (
    <MetricCard
      label="Outstanding Payables"
      value="Rp 5.234.100"
      hint="Hutang yang sudah jatuh tempo lebih dari 30 hari"
      icon={TrendingDown}
      trend={-8}
      danger={true}
      href="/dashboard/payables"
    />
  )
}

/**
 * Example 4: Negative Trend (Normal)
 * - Metric is OK but showing negative trend
 */
export function MetricCardNegativeTrend() {
  return (
    <MetricCard
      label="Profit Margin"
      value="Rp 7.979.200"
      hint="Diambil dari laporan laba rugi periode berjalan"
      icon={TrendingUp}
      trend={-3}
      href="/dashboard/reports"
    />
  )
}

/**
 * Example 5: No Trend Data
 * - Metric without trend information
 */
export function MetricCardNoTrend() {
  return (
    <MetricCard
      label="Stok & Asset Lancar"
      value="Rp 0"
      hint="Persediaan + asset lancar lain vs liabilitas non-lancar"
      icon={Target}
      href="/dashboard/inventory"
    />
  )
}

/**
 * Layout Grid Examples
 */

export function MetricCardGridResponsive() {
  const metrics = [
    {
      label: 'Total Kas & Bank',
      value: 'Rp 1.960.804',
      hint: 'Mengikuti saldo rekening aktif',
      icon: Wallet,
      trend: 5,
    },
    {
      label: 'Operating Cash Flow',
      value: 'Rp 7.979.200',
      hint: 'Sama dengan angka OCF pada menu laporan',
      icon: TrendingUp,
      trend: 12,
    },
    {
      label: 'Hutang & Piutang',
      value: 'Rp 0',
      hint: 'Outstanding aging AP / AR dari modul',
      icon: Package,
      isEmpty: true,
    },
    {
      label: 'Stok & Asset Lancar',
      value: 'Rp 0',
      hint: 'Persediaan + asset lancar lain vs',
      icon: Target,
      isEmpty: true,
    },
    {
      label: 'Laba Bersih (Accrual)',
      value: 'Rp 7.979.200',
      hint: 'Diambil dari laporan laba rugi periode',
      icon: TrendingUp,
      trend: 8,
    },
  ]

  return (
    <div className="w-full p-8 bg-slate-50">
      <h2 className="text-2xl font-bold mb-6">Responsive Grid Layout</h2>
      
      <div className="mb-12">
        <h3 className="text-sm font-semibold text-slate-600 mb-4">Mobile (1 column)</h3>
        <div className="grid grid-cols-1 gap-4 max-w-sm">
          {metrics.slice(0, 2).map((m) => (
            <MetricCard
              key={m.label}
              label={m.label}
              value={m.value}
              hint={m.hint}
              icon={m.icon}
              trend={m.trend}
              isEmpty={m.isEmpty}
            />
          ))}
        </div>
      </div>

      <div className="mb-12">
        <h3 className="text-sm font-semibold text-slate-600 mb-4">Tablet (2 columns)</h3>
        <div className="grid grid-cols-2 gap-5 max-w-2xl">
          {metrics.slice(0, 4).map((m) => (
            <MetricCard
              key={m.label}
              label={m.label}
              value={m.value}
              hint={m.hint}
              icon={m.icon}
              trend={m.trend}
              isEmpty={m.isEmpty}
            />
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-600 mb-4">Desktop (5 columns)</h3>
        <div className="grid grid-cols-5 gap-6">
          {metrics.map((m) => (
            <MetricCard
              key={m.label}
              label={m.label}
              value={m.value}
              hint={m.hint}
              icon={m.icon}
              trend={m.trend}
              isEmpty={m.isEmpty}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * STYLING GUIDELINES
 * 
 * Colors Used:
 * - Blue (#2563eb): Primary action, hover state
 * - Emerald (#10b981): Positive trend
 * - Rose (#f43f5e): Negative trend, danger state
 * - Slate: Neutral states and backgrounds
 * 
 * Spacing:
 * - Mobile gap: 4 (1rem)
 * - Tablet gap: 5 (1.25rem)
 * - Desktop gap: 6 (1.5rem)
 * 
 * Typography:
 * - Label: 12px, font-bold, uppercase, tracking-wider
 * - Value: 24px, font-black, font-mono, tabular-nums
 * - Hint: 12px, font-medium, line-clamp-2
 * 
 * Interactions:
 * - Hover: y translate -4px, shadow-lg increase
 * - Tap: scale 0.98
 * - Duration: 300ms
 * 
 * Icons:
 * - Size: 20px (normal), 16px (trend)
 * - Color: Inherit from card style
 * - Hover animation: Fill with blue, white text
 */
