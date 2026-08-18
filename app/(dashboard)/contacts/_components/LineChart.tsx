'use client'

import { useState } from 'react'

export type LineChartSeries = {
  key: string
  label: string
  color: string       // stroke color, e.g. '#3b82f6'
  fillColor?: string  // gradient fill, e.g. '#3b82f620'
  values: number[]
}

interface LineChartProps {
  labels: string[]          // x-axis labels (e.g. month names)
  series: LineChartSeries[]
  height?: number
  formatValue?: (v: number) => string
  showDots?: boolean
  showGrid?: boolean
  className?: string
}

const PAD = { top: 16, right: 16, bottom: 28, left: 8 }

// Tangen monotone cubic Hermite (Fritsch-Carlson) — dipakai smoothPath() di
// bawah. Beda dari kurva S naif (control point di y yang sama dengan titik),
// metode ini menjaga kurva tidak pernah overshoot melewati rentang y dua
// titik bertetangga. Tanpa ini, data yang datar lama lalu naik tajam di
// ujung (pola umum di grafik tren keuangan) menghasilkan kurva "mleyot" —
// bergelombang/overshoot sebelum akhirnya sampai di titik data.
function monotoneTangents(pts: [number, number][]): number[] {
  const n = pts.length
  const secants: number[] = []
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1][0] - pts[i][0]
    secants.push(dx === 0 ? 0 : (pts[i + 1][1] - pts[i][1]) / dx)
  }

  const tangents: number[] = new Array(n)
  tangents[0] = secants[0] ?? 0
  tangents[n - 1] = secants[n - 2] ?? 0
  for (let i = 1; i < n - 1; i++) {
    const left = secants[i - 1]
    const right = secants[i]
    tangents[i] = left === 0 || right === 0 || (left > 0) !== (right > 0) ? 0 : (left + right) / 2
  }

  for (let i = 0; i < n - 1; i++) {
    const secant = secants[i]
    if (secant === 0) {
      tangents[i] = 0
      tangents[i + 1] = 0
      continue
    }
    const a = tangents[i] / secant
    const b = tangents[i + 1] / secant
    const s = a * a + b * b
    if (s > 9) {
      const tau = 3 / Math.sqrt(s)
      tangents[i] = tau * a * secant
      tangents[i + 1] = tau * b * secant
    }
  }
  return tangents
}

function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return ''
  const tangents = monotoneTangents(pts)
  const d: string[] = [`M ${pts[0][0]},${pts[0][1]}`]
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[i + 1]
    const step = (x1 - x0) / 3
    const cp1x = x0 + step
    const cp1y = y0 + tangents[i] * step
    const cp2x = x1 - step
    const cp2y = y1 - tangents[i + 1] * step
    d.push(`C ${cp1x},${cp1y} ${cp2x},${cp2y} ${x1},${y1}`)
  }
  return d.join(' ')
}

function areaPath(pts: [number, number][], bottom: number): string {
  if (pts.length < 2) return ''
  const line = smoothPath(pts)
  return `${line} L ${pts[pts.length - 1][0]},${bottom} L ${pts[0][0]},${bottom} Z`
}

export default function LineChart({
  labels,
  series,
  height = 160,
  formatValue = (v) => v.toLocaleString('id-ID'),
  showDots = true,
  showGrid = true,
  className = '',
}: LineChartProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; idx: number } | null>(null)

  if (!labels.length || !series.length) {
    return <div className={`flex items-center justify-center text-xs text-slate-300 ${className}`} style={{ height }}>Belum ada data</div>
  }

  const W = 600
  const H = height
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const allValues = series.flatMap(s => s.values)
  const minVal = Math.min(...allValues)
  const maxVal = Math.max(...allValues)
  const range  = maxVal - minVal || 1

  const toX = (i: number) => PAD.left + (i / (labels.length - 1 || 1)) * innerW
  const toY = (v: number) => PAD.top + innerH - ((v - minVal) / range) * innerH

  const gridLines = 4

  return (
    <div className={`relative select-none ${className}`}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full overflow-visible"
        style={{ height }}
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          {series.map(s => (
            <linearGradient key={`grad-${s.key}`} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {/* Grid lines */}
        {showGrid && Array.from({ length: gridLines + 1 }).map((_, i) => {
          const y = PAD.top + (i / gridLines) * innerH
          return (
            <line key={`grid-${i}`} x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
              stroke="#f1f5f9" strokeWidth="1" />
          )
        })}

        {/* Area fills */}
        {series.map(s => {
          const pts = s.values.map((v, i): [number, number] => [toX(i), toY(v)])
          return (
            <path key={`area-${s.key}`}
              d={areaPath(pts, PAD.top + innerH)}
              fill={`url(#grad-${s.key})`}
            />
          )
        })}

        {/* Lines */}
        {series.map(s => {
          const pts = s.values.map((v, i): [number, number] => [toX(i), toY(v)])
          return (
            <path key={`line-${s.key}`}
              d={smoothPath(pts)}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )
        })}

        {/* Dots */}
        {showDots && series.map(s =>
          s.values.map((v, i) => {
            const x = toX(i)
            const y = toY(v)
            const isHovered = tooltip?.idx === i
            return (
              <circle key={`dot-${s.key}-${i}`}
                cx={x} cy={y}
                r={isHovered ? 5 : 3}
                fill="white"
                stroke={s.color}
                strokeWidth="2"
                className="transition-all duration-150 cursor-pointer"
                onMouseEnter={() => setTooltip({ x, y, idx: i })}
              />
            )
          })
        )}

        {/* X labels */}
        {labels.map((label, i) => {
          // Show every Nth label to avoid overlap, dihitung mundur dari label
          // TERAKHIR (bukan dari awal) — supaya titik data terbaru selalu
          // kelihatan tanpa merusak jarak antar-label jadi tidak rata di ujung
          // (mis. ...Mar, May, Jul lalu Aug nempel karena dipaksa tampil).
          const skip = Math.ceil(labels.length / 8)
          const lastIdx = labels.length - 1
          if ((lastIdx - i) % skip !== 0) return null
          return (
            <text key={`lbl-${i}`}
              x={toX(i)} y={H - 4}
              textAnchor="middle"
              fontSize="9"
              fill="#94a3b8"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
              fontWeight="600"
            >
              {label}
            </text>
          )
        })}

        {/* Hover vertical line */}
        {tooltip && (
          <line
            x1={toX(tooltip.idx)} y1={PAD.top}
            x2={toX(tooltip.idx)} y2={PAD.top + innerH}
            stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3"
          />
        )}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 bg-slate-900 text-white rounded-xl px-3 py-2.5 shadow-xl text-[11px] min-w-[140px]"
          style={{
            left: `${(toX(tooltip.idx) / 600) * 100}%`,
            top: 0,
            transform: 'translateX(-50%)',
          }}
        >
          <p className="font-bold text-slate-300 mb-1.5">{labels[tooltip.idx]}</p>
          {series.map(s => (
            <div key={s.key} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="text-slate-400">{s.label}</span>
              </div>
              <span className="font-bold">{formatValue(s.values[tooltip.idx] ?? 0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
