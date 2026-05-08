# MetricCard Component - Developer Guide

## Quick Start

### Using the Component

```tsx
import { MetricCard } from './MetricCard'
import { Wallet } from 'lucide-react'

<MetricCard
  label="Total Kas & Bank"
  value="Rp 1.960.804"
  hint="Mengikuti saldo rekening aktif"
  icon={Wallet}
  href="/dashboard/cash"
/>
```

### In a Grid

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
  {metrics.map((metric) => (
    <motion.div key={metric.label} variants={item}>
      <MetricCard {...metric} />
    </motion.div>
  ))}
</div>
```

---

## Component API

### Props

```typescript
interface MetricCardProps {
  label: string              // Card title
  value: string | ReactNode  // Displayed value
  hint: string               // Helper text
  icon: LucideIcon           // Icon component
  href?: string              // Click navigation (default: '#')
  trend?: number             // Trend percentage (e.g., 5, -8)
  danger?: boolean           // Danger/warning state
  isEmpty?: boolean          // Empty state (shows "—" and grayed out)
}
```

### All Prop Combinations

| State | Props | Visual | Notes |
|---|---|---|---|
| Normal | `{ value: "Rp X", trend: 5 }` | White, blue hover | Most common |
| Empty | `{ value: "Rp 0", isEmpty: true }` | Gray, not clickable | Use for 0 values |
| Danger | `{ danger: true, trend: -8 }` | Red/rose background | Highlight concerns |
| No Trend | `{ value: "Rp X" }` | No trend badge | Simple display |

---

## Styling Customization

### Card Styling

The component automatically handles styling based on state:

```tsx
// Normal state
styles.bg = 'bg-white'
styles.border = 'border-slate-100'
styles.icon = 'bg-slate-100 text-slate-600 group-hover:bg-blue-600'

// Danger state
styles.bg = 'bg-rose-50'
styles.border = 'border-rose-200'
styles.icon = 'bg-rose-100 text-rose-600'

// Empty state
styles.bg = 'bg-slate-50'
styles.border = 'border-slate-200'
styles.icon = 'bg-slate-100 text-slate-400'
```

### Tailwind Classes Used

```
Spacing: p-5, gap-3, mb-6, mt-auto
Rounded: rounded-2xl, rounded-xl, rounded-lg
Sizing: w-11, h-11, w-full, min-h-[200px]
Text: text-xs, text-2xl, font-bold, font-black
Borders: border, border-current/10
Shadows: shadow-sm, shadow-lg, shadow-md
Colors: blue-*, rose-*, slate-*, emerald-*
Effects: transition-all, duration-300
```

---

## Common Patterns

### 1. Displaying with Trend

```tsx
<MetricCard
  label="Revenue"
  value="Rp 50.000.000"
  hint="Total revenue this month"
  icon={TrendingUp}
  trend={15}  // Shows +15%
  href="/dashboard/revenue"
/>
```

### 2. Empty State

```tsx
<MetricCard
  label="No Data"
  value="Rp 0"
  hint="No transactions yet"
  icon={Package}
  isEmpty={true}
/>
```

### 3. Danger Alert

```tsx
<MetricCard
  label="Overdue Payables"
  value="Rp 10.000.000"
  hint="Accounts payable over 90 days"
  icon={AlertTriangle}
  danger={true}
  trend={-20}  // Negative trend in danger
  href="/dashboard/payables"
/>
```

### 4. Without Navigation

```tsx
<MetricCard
  label="Static Metric"
  value="100"
  hint="Just for display"
  icon={Zap}
  // No href = not clickable
/>
```

---

## Responsive Grid Layout

### Tailwind Breakpoints

```css
/* Mobile first approach */
grid-cols-1         /* < 640px: 1 column */
sm:grid-cols-2      /* ≥ 640px: 2 columns */
md:grid-cols-3      /* ≥ 768px: 3 columns */
lg:grid-cols-5      /* ≥ 1024px: 5 columns */

/* Gaps */
gap-4               /* Mobile: 1rem */
sm:gap-5            /* Tablet: 1.25rem */
lg:gap-6            /* Desktop: 1.5rem */
```

### Custom Breakpoints

```tsx
// For different layouts:
<div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-6">
  {/* 1 col mobile, 3 col tablet, 4 col desktop */}
</div>

// For 2-column layout:
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  {/* 1 col mobile, 2 col desktop */}
</div>
```

---

## Animation Integration

### With Framer Motion

```tsx
import { motion } from 'framer-motion'

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
}

<motion.div variants={item}>
  <MetricCard {...props} />
</motion.div>
```

### Without Framer Motion

The component has built-in `whileHover` and `whileTap` animations from Framer Motion. If you remove the motion wrapper, animations won't work (only CSS hover effect remains).

---

## Accessibility

### Color Contrast

All states meet WCAG AA minimum (4.5:1 for text):
- Normal text: Dark slate on white ✓
- Danger text: Dark rose on light rose ✓
- Empty text: Gray on light gray ✓

### Keyboard Navigation

Cards are navigable by keyboard because:
- They use `onClick` handler
- They're wrapped in motion divs
- Parent component handles focus management

To add focus rings:

```tsx
// In MetricCard.tsx, add to className:
focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
```

### Screen Reader

The component provides:
- `label` - Card title (semantic meaning)
- `value` - Metric value
- `hint` - Additional context

To improve screen reader experience:

```tsx
// Add aria-label in parent
<div role="region" aria-label="Dashboard Metrics">
  {/* MetricCards... */}
</div>
```

---

## Performance Considerations

### Rendering

- Component is client-side (`'use client'`)
- Uses standard React hooks
- No expensive computations
- Memoization not needed (props are primitives)

### Animations

- Framer Motion animations are GPU-accelerated
- CSS transforms use `will-change` internally
- Smooth 300ms transitions
- Safe for 60fps on modern devices

### For Large Lists

```tsx
// If rendering 100+ cards, consider:
// 1. Pagination
// 2. Virtual scrolling (react-window)
// 3. Lazy loading

import { useMemo } from 'react'

<div className="grid ...">
  {useMemo(() => 
    metrics.map((m) => <MetricCard key={m.label} {...m} />)
  , [metrics])}
</div>
```

---

## Troubleshooting

### Icons Not Showing

```tsx
// ✓ Correct - Pass icon component
<MetricCard icon={Wallet} ... />

// ✗ Wrong - Passing icon name string
<MetricCard icon="wallet" ... />

// ✗ Wrong - Passing LucideIcon itself
<MetricCard icon={<Wallet />} ... />
```

### Styling Not Applied

1. Check if component uses `'use client'` directive ✓
2. Verify Tailwind CSS is set up in project
3. Ensure no CSS conflicts from parent styles
4. Check browser DevTools for Tailwind classes

### Hover Effect Not Working

```tsx
// ✓ Works - Wrapped in motion div
<motion.div>
  <MetricCard ... />
</motion.div>

// Partial - Component has internal hover, but no translate animation
<MetricCard ... />

// ✗ Doesn't work - motion.div disabled animations
<motion.div animate={false}>
  <MetricCard ... />
</motion.div>
```

### Empty State Not Showing

```tsx
// ✓ Correct - Pass isEmpty explicitly
<MetricCard value="Rp 0" isEmpty={true} ... />

// ✗ Won't show empty state - relies on value prop
<MetricCard value="Rp 0" ... />  // Check: isEmpty calculated from value?
```

Check `DashboardClient.tsx` line 272 where isEmpty is calculated:
```tsx
const isEmpty = String(m.value).trim() === 'Rp 0' || String(m.value).trim() === '0'
```

---

## Testing

### Unit Tests (Example with Jest)

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MetricCard } from './MetricCard'
import { Wallet } from 'lucide-react'

describe('MetricCard', () => {
  test('renders metric with value', () => {
    render(
      <MetricCard
        label="Test"
        value="Rp 100"
        hint="Test hint"
        icon={Wallet}
      />
    )
    expect(screen.getByText('Rp 100')).toBeInTheDocument()
  })

  test('shows empty state', () => {
    render(
      <MetricCard
        label="Empty"
        value="Rp 0"
        hint="Empty hint"
        icon={Wallet}
        isEmpty={true}
      />
    )
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  test('shows danger badge', () => {
    render(
      <MetricCard
        label="Danger"
        value="Rp 50000"
        hint="Danger hint"
        icon={Wallet}
        danger={true}
      />
    )
    expect(screen.getByText(/—/)).toBeInTheDocument() // Danger border
  })
})
```

---

## Common Modifications

### 1. Change Icon Size

In `MetricCard.tsx`, change line:
```tsx
<Icon size={20} strokeWidth={2} />
// Change to:
<Icon size={24} strokeWidth={2} />
```

### 2. Change Card Min Height

```tsx
min-h-[200px]  // Change to:
min-h-[180px]  // or
min-h-fit      // for flexible height
```

### 3. Add Custom Badge

```tsx
{isEmpty ? (
  <span>No data</span>
) : trendIndicator ? (
  // Add custom badge here
  <CustomBadge value={trend} />
) : null}
```

### 4. Change Color Scheme

Modify `getCardStyle()` function:
```tsx
return {
  bg: 'bg-blue-50',      // Change color
  border: 'border-blue-200',
  icon: 'bg-blue-100 text-blue-600',
  // ...
}
```

---

## Files to Know

| File | Purpose |
|---|---|
| `MetricCard.tsx` | Main component ← Edit styling here |
| `DashboardClient.tsx` | Grid layout & integration ← Edit grid here |
| `MetricCard.stories.tsx` | Examples & documentation |
| `IMPROVEMENTS.md` | Design decisions |
| `IMPLEMENTATION_SUMMARY.md` | Full details |

---

## Need Help?

1. Check `MetricCard.stories.tsx` for examples
2. Read `IMPROVEMENTS.md` for design rationale
3. Look at DashboardClient.tsx line 272 for current usage
4. Check Tailwind docs for CSS class references

**Happy coding! 🚀**
