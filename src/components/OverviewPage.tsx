import { ArrowDown, ArrowRight, Ban, CheckCircle2, Circle, CloudAlert, Database, GitBranch, Globe, Network, Plus, ShieldCheck } from 'lucide-react'
import { useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useDialKit, type DialConfig } from 'dialkit'
import { EdgeJoint, FilletRadius, usePixelColumns } from './Fillet'

/* ─────────────────────────────────────────────────────────
 * OVERVIEW
 *
 *   Same language as Infrastructure: a header band, then every
 *   section is a tile sitting on the line colour with 1px gaps
 *   and filleted corners (no floating cards).
 *
 *     header      Overview · welcome · View findings / New test
 *     row 1       4 KPI tiles with sparklines
 *     row 2       Findings over time · Top risky targets
 *     rows 3–4    Recent tests, then Recent findings (full width, stacked)
 * ───────────────────────────────────────────────────────── */

type Tone = 'good' | 'bad'
const TONE: Record<Tone, string> = {
  good: 'bg-[#ebfbf3] text-[#0f7a4a]',
  bad: 'bg-[#fdeeee] text-[#c42b2b]',
}

const KPIS: {
  label: string
  Icon: typeof Globe
  value: string
  delta?: { text: string; tone: Tone }
  sub: ReactNode
  data: number[]
  color: string
}[] = [
  {
    label: 'Total tests',
    Icon: Network,
    value: '195',
    delta: { text: '46%', tone: 'bad' },
    sub: 'vs last 30 days',
    data: [2, 2, 3, 2, 12, 3, 2, 14, 6, 5, 2, 4, 3, 6, 4, 3, 7, 4, 3, 2, 3],
    color: '#2f6fed',
  },
  {
    label: 'Resolution rate',
    Icon: ShieldCheck,
    value: '3%',
    sub: '31 of 900 resolved',
    data: [1, 1, 1, 1, 1, 1, 1, 13, 1, 1, 1, 1, 8, 1, 1, 13, 1, 1, 1, 1, 1],
    color: '#10a36b',
  },
  {
    label: 'Total findings',
    Icon: Database,
    value: '904',
    delta: { text: '89%', tone: 'good' },
    sub: 'vs last 30 days',
    data: [1, 1, 1, 14, 1, 2, 14, 7, 2, 1, 1, 2, 1, 2, 1, 1, 3, 1, 1, 1, 1],
    color: '#e5a00d',
  },
  {
    label: 'Critical · Open',
    Icon: CloudAlert,
    value: '143',
    sub: (
      <>
        <span className="block font-medium text-[#c42b2b]">143 past SLA</span>
        <span className="block">oldest 202 days</span>
      </>
    ),
    data: [1, 1, 1, 1, 1, 13, 1, 1, 9, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    color: '#dc2626',
  },
]

/** Findings per day, Sep 6 → Oct 5 2026: [critical, medium, low]. */
const DAILY: [number, number, number][] = [
  [15, 23, 24],
  [4, 10, 30],
  [13, 13, 12],
  [7, 13, 36],
  [81, 99, 90],
  [0, 0, 12],
  [6, 14, 0],
  [8, 7, 0],
  [0, 0, 10],
  [74, 91, 135],
  [24, 36, 60],
  [6, 14, 30],
  [0, 0, 8],
  [0, 0, 6],
  [5, 7, 0],
  [7, 11, 0],
  [0, 0, 9],
  [0, 0, 7],
  [5, 9, 0],
  [7, 9, 0],
  [5, 7, 0],
  [3, 7, 0],
  [0, 0, 11],
  [9, 16, 0],
  [9, 11, 40],
  [6, 9, 0],
  [0, 0, 8],
  [6, 6, 0],
  [6, 12, 0],
  [0, 0, 10],
]
const DAY0 = new Date(2026, 8, 6)

const TARGETS = [
  { name: 'make-inc/core', count: 31 },
  { name: 'make-inc/core', count: 40 },
  { name: 'make-inc/core', count: 38 },
  { name: 'make-inc/core', count: 32 },
  { name: 'make-inc/core', count: 31 },
  { name: 'make-inc/core', count: 40 },
]

const TESTS: { title: string; kind: 'web' | 'repo'; status: 'done' | 'cancelled'; count?: number; date: string }[] = [
  { title: 'Security Review: https://app.make.co', kind: 'web', status: 'done', date: 'Oct 2' },
  { title: 'Security Review: https://app.make.co', kind: 'web', status: 'done', date: 'Sep 30' },
  { title: 'Security Review: https://make.com', kind: 'web', status: 'done', date: 'Sep 29' },
  { title: 'Security Review: make-inc/core', kind: 'repo', status: 'done', date: 'Sep 29' },
  { title: 'Security Review: https://make.co', kind: 'web', status: 'cancelled', count: 4, date: 'Sep 28' },
  { title: 'Security Review: https://app.make.co +1 more', kind: 'web', status: 'done', date: 'Sep 28' },
]

const FINDINGS: { id: string; title: string; cwes: string[]; level: 1 | 2 | 3; date: string }[] = [
  { id: 'MAK-904', title: 'Unauth MakeLearn REST returns course data', cwes: ['CWE-284', 'CWE-639'], level: 2, date: 'Sep 28' },
  { id: 'MAK-903', title: 'Paywall bypass in GET /lessons', cwes: ['CWE-862', 'CWE-425', 'CWE-200'], level: 2, date: 'Sep 28' },
  { id: 'MAK-902', title: 'Hardcoded BlueToad secret in bundle', cwes: ['CWE-798', 'CWE-862', 'CWE-200'], level: 3, date: 'Sep 28' },
  { id: 'MAK-901', title: 'Paywall bypass in GET /video-library', cwes: ['CWE-862', 'CWE-425'], level: 3, date: 'Sep 28' },
  { id: 'MAK-900', title: 'Self-service email change in POST /account', cwes: ['CWE-287', 'CWE-620'], level: 2, date: 'Sep 28' },
  { id: 'MAK-899', title: 'Unauth Elementor content export', cwes: ['CWE-862', 'CWE-200', 'CWE-639'], level: 2, date: 'Sep 25' },
]

/* ───────────── small pieces ───────────── */

function Sparkline({ data, color, width = 150, height = 44 }: { data: number[]; color: string; width?: number; height?: number }) {
  const max = Math.max(...data)
  const step = width / (data.length - 1)
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(height - 2 - (v / max) * (height - 6)).toFixed(1)}`).join(' ')
  return (
    <svg aria-hidden width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0 overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

/** Filleted tile on the line colour, the building block of every section. */
function Tile({ children, className = '' }: { children: ReactNode; className?: string }) {
  const r = useContext(FilletRadius)
  return (
    <div style={{ borderRadius: r }} className={`min-w-0 overflow-hidden bg-page ${className}`}>
      {children}
    </div>
  )
}

function PanelHeader({ title, action = true }: { title: string; action?: boolean }) {
  return (
    <div className="flex h-12 items-center justify-between border-b border-line bg-[#fafafa] px-8">
      <h2 className="text-sm leading-5 font-medium text-ink">{title}</h2>
      {action && (
        <button className="-mr-2 flex items-center gap-1 rounded-md px-2 py-1 text-[13px] leading-5 text-muted transition-colors hover:bg-[#ededed] hover:text-ink">
          View all
          <ArrowRight className="size-3.5" />
        </button>
      )}
    </div>
  )
}

function CriticalPill() {
  return <span className="rounded-md bg-[#fde8e8] px-2 py-0.5 text-xs leading-4 font-medium text-[#b42318]">Critical</span>
}

/** Signal-bar severity glyph: how many of three bars are lit. */
function SeverityBars({ level }: { level: 1 | 2 | 3 }) {
  const lit = level === 3 ? '#f97316' : '#f5a524'
  return (
    <svg aria-hidden width="14" height="14" viewBox="0 0 14 14" className="shrink-0">
      {[0, 1, 2].map((i) => (
        <rect key={i} x={1 + i * 4.5} y={10 - i * 4} width="3" height={3 + i * 4} rx="1" fill={i < level ? lit : '#e5e5e5'} />
      ))}
    </svg>
  )
}

/* ───────────── charts ───────────── */

/* Block-column chart on a crisp hairline grid (square cells, sharp corners, like the
 * empty-state pattern): each day is a stack of cells (one cell = 30 findings); stacked Critical, Medium, then Low from the baseline up. Hovering a column
 * draws a dashed guide and a tooltip with the day's counts. */
const CELL = 30
const ROWS = 11
/** Chart styling (DialKit "Findings chart"). Colours are blended over the page colour. */
const CHART_CONFIG = {
  replay: { type: 'action', label: '↻ Replay animation' },
  lineOpacity: [0.01, 0, 0.2, 0.005], // darkness of the grid lines and the cuts between squares (one colour for both)
  frameOpacity: [0.1, 0, 0.4, 0.01], // left axis and baseline
  lineWeight: [0.5, 0, 4, 0.25], // grid line weight in px (cuts between squares too); snapped to whole screen pixels so every line matches, 0.5 = hairline on retina
  density: [3, 1, 4, 1], // squares per side of each box: 2 splits every box into 4, 3 into 9
  criticalTone: { type: 'color', default: '#b91c1c' }, // Critical: deepest red
  criticalOpacity: [0.85, 0, 1, 0.01],
  mediumTone: { type: 'color', default: '#ef5f5f' }, // Medium: mid red
  mediumOpacity: [0.85, 0, 1, 0.01],
  lowTone: { type: 'color', default: '#f4a7a7' }, // Low: light red
  lowOpacity: [0.92, 0, 1, 0.01],
  guideWidth: [0.2, 0, 2, 0.05], // px, dashed hover guide
  guideOpacity: [0.95, 0, 1, 0.01],
  tipWidth: [224, 160, 320, 1], // tooltip card width (px)
  tipPadding: [6, 0, 16, 1], // tooltip card inner padding (px)
  tipText: [13, 11, 16, 0.5], // tooltip text size (px, before the global text scale)
} satisfies DialConfig
const PAGE = '#fcfcfc'
// A colour at an opacity, flattened over the page colour so grid lines never show through.
const over = (rgb: string, a: number) => `linear-gradient(rgba(${rgb}, ${a}), rgba(${rgb}, ${a})), ${PAGE}`
const rgbOf = (hex: string) => {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}
const dayOf = (i: number) => new Date(DAY0.getFullYear(), DAY0.getMonth(), DAY0.getDate() + i)

/* ─────────────────────────────────────────────────────────
 * CHART MOTION (DialKit "Chart motion")
 *
 *   fall     cells drop into place from above, bottom rows first,
 *            in a wave across the days (bounce on landing)
 *   rise     each bar grows up from the baseline, row by row
 *   colour   bars appear grey, then the red washes in day by day
 *   none     static
 *
 *   delay = day × columnStagger + rowFromBottom × rowStagger
 *   Plays on mount; replays when a dial changes or ↻ is pressed.
 * ───────────────────────────────────────────────────────── */
const MOTION_CONFIG = {
  replay: { type: 'action', label: '↻ Replay animation' },
  style: { type: 'select', options: ['fall', 'rise', 'colour', 'none'], default: 'rise' },
  duration: [520, 150, 2000, 10], // ms per cell
  columnStagger: [26, 0, 120, 1], // ms between days
  rowStagger: [22, 0, 80, 1], // ms between rows (of the original 11), bottom first
  bounce: [0.35, 0, 1, 0.05], // fall only: overshoot on landing
} satisfies DialConfig

type RGB = [number, number, number]
const PAGE_RGB: RGB = [252, 252, 252]
const rgbArr = (hex: string) => rgbOf(hex).split(', ').map(Number) as RGB
/** `rgb` at opacity `a`, flattened over `base`. */
const mix = (rgb: RGB, a: number, base: RGB = PAGE_RGB): RGB => rgb.map((v, i) => v * a + base[i] * (1 - a)) as RGB
const css = (c: RGB) => `rgb(${c.map(Math.round).join(', ')})`
/** CSS cubic-bezier(x1, y1, x2, y2) as a function of progress. */
const bezier = (x1: number, y1: number, x2: number, y2: number) => (x: number) => {
  const at = (a: number, b: number, t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3
  let lo = 0
  let hi = 1
  for (let n = 0; n < 24; n++) {
    const mid = (lo + hi) / 2
    if (at(x1, x2, mid) < x) lo = mid
    else hi = mid
  }
  return at(y1, y2, (lo + hi) / 2)
}
const EASE_RISE = bezier(0.23, 1, 0.32, 1)
const EASE_COLOUR = bezier(0.25, 0.1, 0.25, 1)

/* The grid is painted on a canvas in real device pixels: one solid sheet of line colour with
 * the squares painted into it. Every line is the same whole number of device pixels, so
 * horizontal and vertical cuts are identical at any zoom or screen density. */
function OverTimeChart() {
  const [hover, setHover] = useState<number | null>(null)
  // Bump to replay: on any motion change, or from Replay in the Chart motion panel.
  const [run, setRun] = useState(0)
  const chart = useDialKit('Findings chart', CHART_CONFIG, { id: 'findings-chart-grid', persist: true, onAction: (a) => a === 'replay' && setRun((r) => r + 1) })
  const motion = useDialKit('Chart motion', MOTION_CONFIG, { id: 'chart-motion', persist: true, onAction: (a) => a === 'replay' && setRun((r) => r + 1) })
  useEffect(() => setRun((r) => r + 1), [motion.style, motion.duration, motion.columnStagger, motion.rowStagger, motion.bounce])
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const anim = reduce || motion.style === 'none' ? null : motion.style
  // Stacked bottom-up in this order, most severe at the base.
  const SERIES = [
    { label: 'Critical', tone: chart.criticalTone, opacity: chart.criticalOpacity },
    { label: 'Medium', tone: chart.mediumTone, opacity: chart.mediumOpacity },
    { label: 'Low', tone: chart.lowTone, opacity: chart.lowOpacity },
  ].map((x) => ({ ...x, swatch: over(rgbOf(x.tone), x.opacity), rgb: mix(rgbArr(x.tone), x.opacity) }))
  const cols = DAILY.length
  const d = chart.density
  const across = cols * d
  const rows = ROWS * d

  // Layout in device pixels: square size s, line width g, frame width f.
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [geo, setGeo] = useState({ dpr: 1, s: 0, g: 1, f: 1 })
  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const measure = () => {
      const dpr = window.devicePixelRatio || 1
      const g = chart.lineWeight > 0 ? Math.max(1, Math.round(chart.lineWeight * dpr)) : 0
      const f = Math.max(1, Math.round(dpr))
      const avail = Math.floor((el.clientWidth - 36) * dpr)
      const s = Math.max(1, Math.floor((avail - f - (across - 1) * g) / across))
      setGeo((p) => (p.dpr === dpr && p.s === s && p.g === g && p.f === f ? p : { dpr, s, g, f }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [across, chart.lineWeight])
  const { dpr, s, g, f } = geo
  const W = f + across * s + (across - 1) * g
  const H = rows * s + (rows - 1) * g + f
  const dayStride = d * (s + g) // device px from one day to the next

  // Filled squares per day: one square holds CELL / d² findings; they fill bottom-up, row by row.
  // fills[i] is the running square count per series, e.g. [3, 7, 12]: squares < 3 are Critical, < 7 Medium, < 12 Low.
  const fills = DAILY.map((day) => {
    const unit = CELL / (d * d)
    const count = (v: number) => (v > 0 ? Math.max(1, Math.round(v / unit)) : 0)
    const total = rows * d
    let sum = 0
    return day.map((v) => (sum = Math.min(total, sum + count(v))))
  })

  // Paint (and animate) the canvas. Restarts the motion only when `run` changes.
  const startRef = useRef({ run: -1, t0: 0 })
  useEffect(() => {
    const cv = canvasRef.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx || !s) return
    if (startRef.current.run !== run) startRef.current = { run, t0: performance.now() }
    const t0 = startRef.current.t0
    const line = css(mix([0, 0, 0], chart.lineOpacity))
    const frame = css(mix([0, 0, 0], chart.frameOpacity))
    const grey = (c: RGB): RGB => {
      const y = Math.min(255, (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) * 1.18)
      return [y, y, y]
    }
    const fall = bezier(0.34, 1 + motion.bounce, 0.64, 1)
    const dur = motion.duration
    const lastDelay = (cols - 1) * motion.columnStagger + (rows / d) * motion.rowStagger
    let raf = 0
    const paint = (now: number) => {
      const t = now - t0
      ctx.fillStyle = line
      ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = frame
      ctx.fillRect(0, 0, f, H)
      ctx.fillRect(0, H - f, W, f)
      ctx.fillStyle = css(PAGE_RGB)
      for (let c = 0; c < across; c++) for (let r = 0; r < rows; r++) ctx.fillRect(f + c * (s + g), r * (s + g), s, s)
      for (let i = 0; i < cols; i++) {
        const ends = fills[i]
        const dim = hover !== null && hover !== i ? 0.55 : 1
        for (let k = 0; k < ends[ends.length - 1]; k++) {
          const fromBottom = Math.floor(k / d)
          const x = f + (i * d + (k % d)) * (s + g)
          const y = (rows - 1 - fromBottom) * (s + g)
          const base = SERIES[ends.findIndex((e) => k < e)].rgb
          const p = anim ? Math.min(1, Math.max(0, (t - (i * motion.columnStagger + (fromBottom / d) * motion.rowStagger)) / dur)) : 1
          if (p <= 0 && anim !== 'colour') continue
          let colour = base
          let alpha = dim
          let top = y
          let size = s
          if (anim === 'rise') {
            const e = EASE_RISE(p)
            alpha *= e
            size = Math.round(s * e)
            top = y + s - size
          } else if (anim === 'fall') {
            alpha *= Math.min(1, p / 0.4)
            top = y - Math.round(180 * dpr * (1 - fall(p)))
          } else if (anim === 'colour') {
            const e = EASE_COLOUR(p)
            const gr = grey(base)
            colour = gr.map((v, n) => v + (base[n] - v) * e) as RGB
          }
          if (size <= 0 || alpha <= 0) continue
          ctx.globalAlpha = alpha
          ctx.fillStyle = css(colour)
          ctx.fillRect(x, top, s, size)
          ctx.globalAlpha = 1
        }
      }
      if (anim && t < lastDelay + dur) raf = requestAnimationFrame(paint)
    }
    raf = requestAnimationFrame(paint)
    return () => cancelAnimationFrame(raf)
  })

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const x = (e.clientX - e.currentTarget.getBoundingClientRect().left) * dpr - f
    const i = Math.floor(x / dayStride)
    setHover(x >= 0 && i < cols ? i : null)
  }
  const cssPx = (v: number) => v / dpr
  return (
    <div ref={boxRef}>
      {/* Legend: right edge lines up with the grid's right edge */}
      <div className="mb-3 ml-9 flex items-center justify-end gap-4 text-xs leading-4 text-muted" style={{ width: cssPx(W) }}>
        {SERIES.map((x) => (
          <span key={x.label} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[2px]" style={{ background: x.swatch }} />
            {x.label}
          </span>
        ))}
      </div>
      <div className="relative ml-9" style={{ width: cssPx(W) }} onMouseLeave={() => setHover(null)}>
        {/* y axis, outside the grid's left edge */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 -left-9 flex w-7 flex-col justify-between text-right font-mono text-[11px] leading-4 text-subtle"
          style={{ height: cssPx(H) }}
        >
          <span className="-mt-2">{CELL * ROWS}</span>
          <span>{(CELL * ROWS * 2) / 3}</span>
          <span>{(CELL * ROWS) / 3}</span>
          <span className="-mb-2">0</span>
        </div>
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            onMouseMove={onMove}
            className="block [image-rendering:pixelated]"
            style={{ width: cssPx(W), height: cssPx(H) }}
            role="img"
            aria-label="Findings per day over the last 30 days"
          />
          {hover !== null && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-[-6px] border-dashed"
              style={{
                left: cssPx(f + hover * dayStride + (d * s + (d - 1) * g) / 2),
                borderLeftWidth: chart.guideWidth,
                borderColor: `rgba(143, 143, 143, ${chart.guideOpacity})`,
              }}
            />
          )}
        </div>

        {/* x axis: every 6th day labelled, dots between */}
        <div
          className="mt-2 grid font-mono text-[11px] leading-4 text-subtle"
          style={{ gridTemplateColumns: `repeat(${cols}, ${cssPx(d * s + (d - 1) * g)}px)`, columnGap: cssPx(g), paddingLeft: cssPx(f) }}
        >
          {DAILY.map((_, i) => (
            <span key={i} className={`flex whitespace-nowrap ${i === 0 ? 'justify-start' : i === cols - 1 ? 'justify-end' : 'justify-center'}`}>
              {i % 6 === 0 || i === cols - 1 ? dayOf(i).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase() : i % 6 === 3 ? '·' : ''}
            </span>
          ))}
        </div>

        {hover !== null && (
          <div
            role="tooltip"
            className="popover-in pointer-events-none absolute top-6 z-10 rounded-xl border border-line bg-white shadow-[0_12px_32px_rgba(0,0,0,0.12)]"
            style={{
              ...(hover > cols * 0.6 ? { right: `calc(${((cols - hover) / cols) * 100}% + 10px)` } : { left: `calc(${((hover + 1) / cols) * 100}% + 10px)` }),
              width: chart.tipWidth,
              padding: chart.tipPadding,
              fontSize: `calc(${chart.tipText}px * var(--ui-scale))`,
            }}
          >
            <div className="rounded-lg bg-[#f4f4f4] px-2.5 py-1.5 leading-[1.5] text-muted">
              {dayOf(hover).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
            {SERIES.map(({ label, swatch: c }, n) => [label, DAILY[hover][n], c] as const).map(([label, v, c]) => (
              <div key={label} className="flex items-center gap-2 px-2.5 py-1.5 leading-[1.5]">
                <span className="size-2.5 rounded-[2px]" style={{ background: c }} />
                <span className="flex-1 whitespace-nowrap text-muted">{label}</span>
                <span className="font-semibold text-ink tabular-nums">{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ───────────── page ───────────── */

export function OverviewPage() {
  const kpiCols = usePixelColumns<HTMLDivElement>([1, 1, 1, 1])
  const chartCols = usePixelColumns<HTMLDivElement>([3, 2])
  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="Overview">
      {/* Header band */}
      <div className="relative flex shrink-0 items-center justify-between gap-6 border-b border-line px-8 py-4">
        <EdgeJoint edge="left" line="bottom" quads={['tr', 'br']} />
        {/* The breadcrumb already names the page, so the band leads with the welcome line. */}
        <p className="text-[15px] leading-6 text-ink">
          Welcome back, Sanjay. <span className="text-muted">Here’s what’s happening with your security today.</span>
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button className="flex h-9 items-center rounded-md border border-[#e0e0e0] bg-white px-3.5 text-sm font-medium text-[#525252] transition-[background-color,color,scale] duration-150 ease-out hover:bg-[#fafafa] hover:text-ink active:scale-[0.97]">
            View findings
          </button>
          <button className="flex h-9 items-center gap-1.5 rounded-md bg-ink px-3.5 text-sm font-medium text-white shadow-sm transition duration-150 ease-out hover:bg-[#2a2a2a] active:scale-[0.97]">
            <Plus className="size-4" />
            New test
          </button>
        </div>
      </div>

      {/* Sections: tiles on the line colour, 1px apart */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-px bg-line pb-px">
          {/* Row 1: KPIs */}
          <div ref={kpiCols} className="grid grid-cols-4 gap-px">
            {KPIS.map((k) => (
              <Tile key={k.label} className="px-8 py-5">
                <div className="flex items-center gap-2 text-[13px] leading-5 whitespace-nowrap text-muted">
                  <k.Icon className="size-4 shrink-0 text-subtle" strokeWidth={1.75} />
                  {k.label}
                </div>
                <div className="mt-3 flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[28px] leading-8 font-semibold tracking-tight text-ink tabular-nums">{k.value}</span>
                      {k.delta && (
                        <span className={`flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs leading-4 font-medium tabular-nums ${TONE[k.delta.tone]}`}>
                          <ArrowDown className="size-3" />
                          {k.delta.text}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[13px] leading-5 whitespace-nowrap text-subtle">{k.sub}</div>
                  </div>
                  <Sparkline data={k.data} color={k.color} width={96} height={36} />
                </div>
              </Tile>
            ))}
          </div>

          {/* Row 2: charts and targets */}
          <div ref={chartCols} className="grid grid-cols-[3fr_2fr] gap-px">
            <Tile>
              <PanelHeader title="Findings over time" action={false} />
              <div className="px-8 py-6">
                <OverTimeChart />
              </div>
            </Tile>
            <Tile>
              <PanelHeader title="Top risky targets" />
              <ul>
                {TARGETS.map((t, i) => (
                  <li
                    key={i}
                    className="flex h-[52px] cursor-pointer items-center gap-3 border-b border-line-soft px-8 text-sm leading-5 transition-colors last:border-b-0 hover:bg-[#f2f2f2]"
                  >
                    <Globe className="size-4 shrink-0 text-subtle" strokeWidth={1.75} />
                    <span className="min-w-0 flex-1 truncate text-ink">{t.name}</span>
                    <CriticalPill />
                    <span className="w-8 text-right text-ink tabular-nums">{t.count}</span>
                  </li>
                ))}
              </ul>
            </Tile>
          </div>

          {/* Rows 3–4: recent activity, stacked full width */}
          <div className="grid grid-cols-1 gap-px">
            <Tile>
              <PanelHeader title="Recent tests" />
              <ul>
                {TESTS.map((t, i) => (
                  <li
                    key={i}
                    className="flex h-[52px] cursor-pointer items-center gap-3 border-b border-line-soft px-8 text-sm leading-5 transition-colors last:border-b-0 hover:bg-[#f2f2f2]"
                  >
                    {t.status === 'done' ? (
                      <CheckCircle2 className="size-4 shrink-0 text-[#10a36b]" strokeWidth={1.75} />
                    ) : (
                      <Ban className="size-4 shrink-0 text-muted" strokeWidth={1.75} />
                    )}
                    {t.kind === 'web' ? (
                      <Globe className="size-4 shrink-0 text-subtle" strokeWidth={1.75} />
                    ) : (
                      <GitBranch className="size-4 shrink-0 text-subtle" strokeWidth={1.75} />
                    )}
                    <span className="min-w-0 flex-1 truncate text-ink">{t.title}</span>
                    {t.count ? <span className="text-muted tabular-nums">{t.count}</span> : null}
                    <span className="w-14 shrink-0 text-right text-[13px] text-muted tabular-nums">{t.date}</span>
                  </li>
                ))}
              </ul>
            </Tile>
            <Tile>
              <PanelHeader title="Recent findings" />
              <ul>
                {FINDINGS.map((f) => (
                  <li
                    key={f.id}
                    className="flex h-[52px] cursor-pointer items-center gap-3 border-b border-line-soft px-8 text-sm leading-5 transition-colors last:border-b-0 hover:bg-[#f2f2f2]"
                  >
                    <SeverityBars level={f.level} />
                    <span className="w-16 shrink-0 font-mono text-[13px] text-muted">{f.id}</span>
                    <Circle className="size-3.5 shrink-0 text-[#e11d48]" strokeWidth={2} />
                    <span className="min-w-0 flex-1 truncate text-ink" title={f.title}>
                      {f.title}
                    </span>
                    <span className="flex shrink-0 gap-1">
                      {f.cwes.map((c) => (
                        <span key={c} className="rounded border border-line bg-white px-1.5 font-mono text-[11px] leading-5 text-muted">
                          {c}
                        </span>
                      ))}
                    </span>
                    <span className="w-14 shrink-0 text-right text-[13px] text-muted tabular-nums">{f.date}</span>
                  </li>
                ))}
              </ul>
            </Tile>
          </div>
        </div>
      </div>
    </section>
  )
}
