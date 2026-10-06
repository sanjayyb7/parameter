import { ArrowDown, ArrowRight, Ban, CheckCircle2, Circle, CloudAlert, Database, GitBranch, Globe, Network, Plus, ShieldCheck } from 'lucide-react'
import { useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { EdgeJoint, FilletRadius } from './Fillet'

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

/** Findings per day, Sep 6 → Oct 5 2026: [critical + high, medium + low + info]. */
const DAILY: [number, number][] = [
  [0, 0],
  [0, 0],
  [0, 0],
  [0, 0],
  [180, 90],
  [0, 12],
  [20, 0],
  [15, 0],
  [0, 10],
  [165, 135],
  [60, 60],
  [20, 30],
  [0, 8],
  [0, 6],
  [12, 0],
  [18, 0],
  [0, 9],
  [0, 7],
  [14, 0],
  [16, 0],
  [12, 0],
  [10, 0],
  [0, 11],
  [25, 0],
  [20, 40],
  [15, 0],
  [0, 8],
  [12, 0],
  [18, 0],
  [0, 10],
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
 * empty-state pattern): each day is a stack of cells (one cell = 30 findings); ink cells are Critical + High, grey cells Medium · Low · Info. Hovering a column
 * draws a dashed guide and a tooltip with the day's counts. */
const CELL = 30
const ROWS = 11
/** Chart styling. Colours are blended over the page colour. */
const CHART = {
  gridOpacity: 0.08, // darkness of the inner grid lines (0.25 ≈ the empty-state grid); the frame stays fixed
  highOpacity: 0.86, // Critical + High cells
  lowOpacity: 0.92, // Medium · Low · Info cells
  cellGap: 0.75, // px of line between cells (0 = solid bars, no cuts)
  guideWidth: 0.25, // px, dashed hover guide
  guideOpacity: 0.95, // dashed hover guide
  density: 3, // squares per side of each box: 2 splits every box into 4 smaller squares, 3 into 9
  criticalRed: '#dc2626', // Critical + High: strong red
  lighterRed: '#f4a7a7', // Medium · Low · Info: lighter shade of the same red (lower level)
  tipWidth: 224, // tooltip card width (px)
  tipPadding: 6, // tooltip card inner padding (px)
  tipText: 13, // tooltip text size (px, before the global text scale)
}
const PAGE = '#fcfcfc'
// A colour at an opacity, flattened over the page colour so grid lines never show through.
const over = (rgb: string, a: number) => `linear-gradient(rgba(${rgb}, ${a}), rgba(${rgb}, ${a})), ${PAGE}`
const rgbOf = (hex: string) => {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}
const dayOf = (i: number) => new Date(DAY0.getFullYear(), DAY0.getMonth(), DAY0.getDate() + i)

function OverTimeChart() {
  const [hover, setHover] = useState<number | null>(null)
  const chart = CHART
  const HIGH = over(rgbOf(chart.criticalRed), chart.highOpacity)
  const LOW = over(rgbOf(chart.lighterRed), chart.lowOpacity)
  const LINE = over('0, 0, 0', chart.gridOpacity * 0.25)
  const cols = DAILY.length
  // The grid's height follows its width (square cells); the y-axis labels track it.
  const gridRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const ro = new ResizeObserver(() => el.parentElement?.style.setProperty('--grid-h', `${el.offsetHeight}px`))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div>
      <div className="mb-3 flex items-center justify-end gap-4 text-xs leading-4 text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px]" style={{ background: HIGH }} />
          Critical + High
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px]" style={{ background: LOW }} />
          Medium · Low · Info
        </span>
      </div>
      <div className="relative ml-9 min-w-0" onMouseLeave={() => setHover(null)}>
        {/* y axis, outside the grid's left edge */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 -left-9 flex w-7 flex-col justify-between text-right font-mono text-[11px] leading-4 text-subtle"
          style={{ aspectRatio: 'auto', height: 'var(--grid-h)' }}
        >
          <span className="-mt-2">{CELL * ROWS}</span>
          <span>{(CELL * ROWS * 2) / 3}</span>
          <span>{(CELL * ROWS) / 3}</span>
          <span className="-mb-2">0</span>
        </div>
        {/* Crisp hairline grid, like the empty-state pattern: square cells, 1px lines, sharp corners */}
        <div
          ref={gridRef}
          // Axis lines (left edge and baseline) are fixed; only the inner lines follow the opacity dial. No top/right frame.
          className="grid border-b border-l border-[#e2e2e2]"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, aspectRatio: `${cols} / ${ROWS}`, background: LINE, gap: chart.cellGap }}
        >
          {DAILY.map(([hi, lo], i) => {
            // Each day is a d×d subdivided column: d small squares across, ROWS·d tall. A small
            // square holds CELL / d² findings and they fill bottom-up, row by row.
            const d = chart.density
            const unit = CELL / (d * d)
            const count = (v: number) => (v > 0 ? Math.max(1, Math.round(v / unit)) : 0)
            const total = ROWS * d * d
            const h = Math.min(count(hi), total)
            const l = Math.min(count(lo), total - h)
            const rows = ROWS * d
            return (
              <div
                key={i}
                className="relative grid"
                style={{ gap: chart.cellGap, gridTemplateColumns: `repeat(${d}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
                onMouseEnter={() => setHover(i)}
              >
                {Array.from({ length: rows * d }).map((_, n) => {
                  const fromBottom = rows - 1 - Math.floor(n / d)
                  const k = fromBottom * d + (n % d)
                  const filled = k < h + l
                  return (
                    <span
                      key={n}
                      className="min-h-0 transition-opacity duration-150"
                      style={{
                        background: k < h ? HIGH : filled ? LOW : PAGE,
                        opacity: hover !== null && hover !== i && filled ? 0.55 : 1,
                      }}
                    />
                  )
                })}
                {hover === i && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-[-6px] left-1/2 border-dashed"
                    style={{ borderLeftWidth: chart.guideWidth, borderColor: `rgba(143, 143, 143, ${chart.guideOpacity})` }}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* x axis: every 6th day labelled, dots between */}
        <div
          className="mt-2 grid font-mono text-[11px] leading-4 text-subtle"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: chart.cellGap }}
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
            {(
              [
                ['Critical + High', DAILY[hover][0], HIGH],
                ['Medium · Low · Info', DAILY[hover][1], LOW],
              ] as const
            ).map(([label, v, c]) => (
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
          <div className="grid grid-cols-4 gap-px">
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
          <div className="grid grid-cols-[3fr_2fr] gap-px">
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
