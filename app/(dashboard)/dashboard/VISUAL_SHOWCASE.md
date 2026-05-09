# 🎨 MetricCard Visual Showcase

## States

### Normal State
```
┌──────────────────────────┐
│ [💰]    KAS & BANK  [↑5%]│
│ Rp 1.960.804             │
│ Saldo rekening aktif     │
└──────────────────────────┘
```

### Empty State
```
┌──────────────────────────┐
│ [📦]    HUTANG    [No data]
│ —                        │
│ Outstanding AP/AR        │
└──────────────────────────┘
```

### Danger State
```
┌─ ──────────────────────┐
│ [⚠️]   PAYABLES  [↓-8%] │
│ Rp 5.234.100           │
│ Hutang jatuh tempo     │
└────────────────────────┘
```

---

## Responsive Grid

```
📱 Mobile           💻 Tablet          🖥️ Desktop         📊 Large
┌────────┐         ┌────┬────┐        ┌───┬───┬───┐      ┌───┬───┬───┬───┬───┐
│ Card 1 │         │ C1 │ C2 │        │C1 │C2 │C3 │      │C1 │C2 │C3 │C4 │C5 │
├────────┤         ├────┼────┤        ├───┼───┼───┤      └───┴───┴───┴───┴───┘
│ Card 2 │         │ C3 │ C4 │        │C4 │C5 │   │
├────────┤         ├────┼────┤        └───┴───┴───┘
│ Card 3 │         │ C5 │    │
└────────┘         └────┴────┘
 1 column           2 columns          3 columns          5 columns
```

---

## Interactions

### Hover
```
Card lifts up → Icon turns blue → Arrow appears
```

### Click
```
Navigate to detail page
```

### Tap (Mobile)
```
Scale feedback + Navigate
```

---

## Colors

| State | Background | Border | Icon |
|-------|-----------|--------|------|
| Normal | White | Light slate | Blue hover |
| Empty | Light gray | Gray | Muted |
| Danger | Light rose | Rose | Red |

---

## Component Props

```typescript
MetricCard({
  label:    "Total Kas & Bank"
  value:    "Rp 1.960.804"
  hint:     "Saldo rekening aktif"
  icon:     Wallet
  href:     "/dashboard/cash"
  trend:    5
})
```
