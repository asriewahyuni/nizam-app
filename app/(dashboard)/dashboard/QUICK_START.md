# ⚡ Quick Start

## Usage

```tsx
import { MetricCard } from './MetricCard'
import { Wallet } from 'lucide-react'

<MetricCard
  label="Total Kas & Bank"
  value="Rp 1.960.804"
  hint="Saldo rekening aktif"
  icon={Wallet}
  href="/dashboard/cash"
  trend={5}
/>
```

---

## In Grid

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
  {metrics.map((m) => (
    <motion.div key={m.label} variants={item}>
      <MetricCard {...m} />
    </motion.div>
  ))}
</div>
```

---

## Props

| Prop | Type | Default | Example |
|------|------|---------|---------|
| `label` | string | required | "Total Kas" |
| `value` | string | required | "Rp 1.960.804" |
| `hint` | string | required | "Saldo aktif" |
| `icon` | LucideIcon | required | Wallet |
| `href` | string | '#' | "/dashboard" |
| `trend` | number | undefined | 5, -8 |
| `danger` | boolean | false | true |
| `isEmpty` | boolean | false | true |

---

## States

```tsx
// Normal
<MetricCard label="..." value="Rp X" hint="..." icon={Wallet} />

// Empty
<MetricCard label="..." value="Rp 0" hint="..." icon={Wallet} isEmpty />

// Danger
<MetricCard label="..." value="Rp X" hint="..." icon={Wallet} danger trend={-8} />
```

---

## Responsive

```
<640px:    1 column (grid-cols-1)
640px:     2 columns (sm:grid-cols-2)
768px:     3 columns (md:grid-cols-3)
1024px+:   5 columns (lg:grid-cols-5)
```

---

## Styling

Colors: Blue (normal) | Rose (danger) | Gray (empty)
Icons: 20px, auto-colored
Shadows: Subtle with blue hover
Rounded: 2xl (16px)

---

## See Also

- **VISUAL_SHOWCASE.md** - Visual examples
- **DEVELOPER_GUIDE.md** - Full reference
- **MetricCard.stories.tsx** - Component variations
