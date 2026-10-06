import {
  Background,
  BackgroundVariant,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useViewport,
  type Edge,
  type EdgeMouseHandler,
  type NodeMouseHandler,
  type Node,
  type NodeProps,
  type OnNodesChange,
  type FitViewOptions,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  Expand,
  Globe,
  KeyRound,
  LocateFixed,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Server,
  Shrink,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { STATUS_TONE } from './Badges'
import { InfoButton, TAB_INFO } from './InfoButton'
import { ATTACK_PATHS, EDGE_MEANING, type AttackPath, type NodeKind, type PathEdge } from '../data/attackPaths'

/* ─────────────────────────────────────────────────────────
 * LAYOUT
 *
 *   Canvas fills the tab. Columns left→right: internet-facing
 *   entry · identity it runs as · identity it can impersonate.
 *   A floating panel sits inset on the right (expandable); the
 *   zoom / fit / fullscreen controls sit bottom-left.
 * ───────────────────────────────────────────────────────── */

const COL_X = [0, 500, 1000] // 300px cards + 200px for the edge label between columns
const ROW_Y = 300
const NODE_W = 300
const PANEL_W = { normal: 420, wide: 640 }
const PANEL_INSET = 16

type GraphNodeData = { label: string; kind: NodeKind; reached?: number; dim: boolean; active: boolean; num: number }

/* Card anatomy (after the reference): tinted tag above the card · icon tile + title +
 * subtitle · grey inner box with a label chip and one line of explanation · footer pills. */
const NODE_STYLE: Record<
  NodeKind,
  { Icon: typeof Globe; tag: string; tagTone: string; subtitle: string; chip: string; body: string; status: string }
> = {
  entry: {
    Icon: Globe,
    tag: 'Internet-facing',
    tagTone: STATUS_TONE.pending,
    subtitle: 'Cloud Run service · us-central1',
    chip: 'ENTRY POINT',
    body: 'Anyone on the internet can reach this. An attacker needs no credentials of yours to get here.',
    status: 'Public',
  },
  identity: {
    Icon: Server,
    tag: 'Runs as',
    tagTone: STATUS_TONE.progress,
    subtitle: 'Service account · hex-exposure-lab',
    chip: 'IDENTITY',
    body: 'The workload executes as this account, so whoever controls the workload acts as it.',
    status: 'Private',
  },
  target: {
    Icon: KeyRound,
    tag: 'Impersonated',
    tagTone: STATUS_TONE.danger,
    subtitle: 'Service account · hex-exposure-lab',
    chip: 'TARGET',
    body: 'Can be impersonated to mint short-lived credentials, handing over everything it can access.',
    status: 'Critical',
  },
}

/** Path number, shared by the entry card on the canvas and its card in the panel. */
function PathNumber({ n, active }: { n: number; active: boolean }) {
  return (
    <span
      className={`flex size-5 shrink-0 items-center justify-center rounded-full text-xs leading-4 font-semibold tabular-nums transition-colors ${
        active ? 'bg-ink text-white' : 'border border-line bg-white text-ink'
      }`}
    >
      {n}
    </span>
  )
}

function PathNodeView({ data }: NodeProps<Node<GraphNodeData>>) {
  const s = NODE_STYLE[data.kind]
  return (
    <div style={{ width: NODE_W }} className={`cursor-grab transition-opacity active:cursor-grabbing ${data.dim ? 'opacity-35' : ''}`}>
      {/* Tag above the card; the entry card also carries the path number shown in the panel */}
      <div className="mb-2 flex items-center gap-1.5">
        {data.kind === 'entry' && <PathNumber n={data.num} active={data.active} />}
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs leading-4 font-medium ${s.tagTone}`}>
        <s.Icon className="size-3" />
        {s.tag}
        </span>
      </div>
      <div
        className={`relative rounded-2xl bg-white p-2.5 transition-shadow ${
          data.active ? 'shadow-[0_6px_20px_rgba(0,0,0,0.08),0_0_0_1px_#bdbdbd]' : 'shadow-[0_1px_3px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.10),0_0_0_1px_rgba(0,0,0,0.06)]'
        }`}
      >
        <Handle type="target" position={Position.Left} className="!size-1.5 !min-h-0 !min-w-0 !border-0 !bg-[#b8b8b8]" />
        {/* The tag above already carries this card's icon, so the header is text only. */}
        <div className="flex items-center px-1.5 pt-1 pb-3">
          <div className="min-w-0">
            <div className="text-sm leading-5 font-semibold text-ink">{data.label}</div>
            <div className="truncate text-xs leading-4 text-subtle">{s.subtitle}</div>
          </div>
        </div>
        <div className="rounded-xl bg-[#f5f5f5] px-3 py-2">
          <span className="inline-block rounded-md bg-white px-2 py-0.5 text-[11px] leading-4 font-medium tracking-wide text-ink">{s.chip}</span>
          <p className="mt-1.5 text-[13px] leading-5 text-[#404040]">{s.body}</p>
        </div>
        {/* Footer tags: quiet sentence-case chips, neutral like the rest of the card. */}
        <div className="flex items-center gap-1.5 px-0.5 pt-2">
          <span className="rounded-md border border-line bg-white px-2 py-0.5 text-xs leading-4 text-muted">{s.status}</span>
          {data.reached ? <span className="rounded-md bg-[#f4f4f4] px-2 py-0.5 text-xs leading-4 text-muted">+{data.reached} reached</span> : null}
        </div>
        <Handle type="source" position={Position.Right} className="!size-1.5 !min-h-0 !min-w-0 !border-0 !bg-[#b8b8b8]" />
      </div>
    </div>
  )
}

const nodeTypes = { path: PathNodeView }

function edgeLabel(e: PathEdge) {
  return e.kind === 'runs-as' ? 'runs as' : 'can impersonate'
}

/* ───────────── Right panel ───────────── */

function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="mt-2.5 overflow-hidden rounded-lg border border-line bg-[#f7f7f7]">
      <div className="flex h-8 items-center justify-between border-b border-line pr-1 pl-3">
        <span className="text-xs leading-4 text-subtle">gcloud</span>
        <button
          onClick={() => {
            void navigator.clipboard?.writeText(command)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1200)
          }}
          className="flex items-center gap-1 rounded px-1.5 py-1 text-xs leading-4 text-muted hover:bg-white hover:text-ink"
        >
          {copied ? <Check className="size-3.5 text-[#15803d]" /> : <Copy className="size-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto px-3 py-2.5 font-mono text-xs leading-5 text-ink">{command}</pre>
    </div>
  )
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="text-xs leading-4 font-medium text-subtle">{children}</div>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line-soft px-4 py-3.5">
      <Eyebrow>{title}</Eyebrow>
      <div className="mt-2">{children}</div>
    </section>
  )
}

function SeverityBadge({ severity }: { severity: AttackPath['severity'] }) {
  return <span className="rounded-md bg-[#dc2626] px-1.5 py-0.5 text-xs leading-4 font-medium text-white">{severity}</span>
}

const STEP_ICON = [Globe, Server, KeyRound]
const STEP_LABEL = ['Entry point', 'Runs as', 'Can impersonate']

function PathCard({ path, num, open, onToggle }: { path: AttackPath; num: number; open: boolean; onToggle: () => void }) {
  return (
    <article id={`path-card-${path.id}`} className={`overflow-hidden rounded-xl border bg-white transition-colors ${open ? 'border-[#c4c4c4] shadow-[0_4px_14px_rgba(0,0,0,0.05)]' : 'border-line'}`}>
      <button onClick={onToggle} aria-expanded={open} className="flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-[#fafafa]">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <PathNumber n={num} active={open} />
            <SeverityBadge severity={path.severity} />
            {path.tags.map((t) => (
              <span key={t} className="rounded-md border border-line px-1.5 py-0.5 text-xs leading-4 text-muted">
                {t}
              </span>
            ))}
          </div>
          <dl className="mt-2.5 grid grid-cols-[40px_1fr] gap-x-2 gap-y-1 text-sm leading-5">
            <dt className="text-subtle">From</dt>
            <dd className="truncate font-medium text-ink">{path.entry}</dd>
            <dt className="text-subtle">To</dt>
            <dd className="font-medium text-ink">{path.target}</dd>
          </dl>
        </div>
        <ChevronDown className={`mt-0.5 size-4 shrink-0 text-subtle transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <Section title="Impact">
            <p className="text-sm leading-5 text-[#404040]">{path.summary}</p>
          </Section>

          <Section title="Why it’s critical">
            <ul className="space-y-1.5 text-sm leading-5 text-[#404040]">
              {path.why.map((w) => (
                <li key={w} className="flex gap-2">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-[#dc2626]" />
                  <span className="first-letter:uppercase">{w}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Attack chain">
            <ol>
              {path.steps.map((s, i) => {
                const Icon = STEP_ICON[i] ?? KeyRound
                const last = i === path.steps.length - 1
                return (
                  <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                    {!last && <span aria-hidden className="absolute top-7 bottom-0 left-[13px] w-px bg-line" />}
                    <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full border border-line bg-white text-muted">
                      <Icon className="size-3.5" />
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <div className="text-xs leading-4 text-subtle">
                        {i + 1}. {STEP_LABEL[i] ?? s.verb}
                      </div>
                      <div className="mt-0.5 text-sm leading-5 font-medium text-ink">{s.subject}</div>
                      <div className="mt-0.5 text-[13px] leading-5 text-muted">{s.detail}</div>
                    </div>
                  </li>
                )
              })}
            </ol>
          </Section>

          <Section title="How to fix">
            <p className="text-sm leading-5 [overflow-wrap:anywhere] text-[#404040]">{path.fix.text}</p>
            {path.fix.command && <CopyCommand command={path.fix.command} />}
          </Section>
        </>
      )}
    </article>
  )
}

function EdgeDetail({ edge, path, labels, onBack }: { edge: PathEdge; path: AttackPath; labels: Map<string, string>; onBack: () => void }) {
  const meaning = EDGE_MEANING[edge.kind]
  const stepIndex = edge.kind === 'runs-as' ? 2 : 3
  return (
    <div className="space-y-3">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] leading-5 text-muted hover:text-ink">
        <ArrowLeft className="size-3.5" />
        All paths
      </button>

      <article className="overflow-hidden rounded-xl border border-line bg-white">
        <header className="px-4 py-3.5">
          <div className="flex items-center gap-1.5">
            <SeverityBadge severity={path.severity} />
            <span className="rounded-md border border-line px-1.5 py-0.5 text-xs leading-4 text-muted tabular-nums">
              Step {stepIndex} of {path.steps.length}
            </span>
          </div>
          <h3 className="mt-2.5 text-base leading-6 font-semibold first-letter:uppercase">{meaning.title}</h3>
          <dl className="mt-2 grid grid-cols-[40px_1fr] gap-x-2 gap-y-1 text-sm leading-5">
            <dt className="text-subtle">From</dt>
            <dd className="font-medium text-ink">{labels.get(edge.source)}</dd>
            <dt className="text-subtle">To</dt>
            <dd className="font-medium text-ink">{labels.get(edge.target)}</dd>
          </dl>
        </header>

        <Section title="What it means">
          <p className="text-sm leading-5 text-[#404040]">{meaning.body}</p>
        </Section>

        <Section title="Details">
          <dl className="grid grid-cols-[72px_1fr] gap-x-3 gap-y-2 text-sm leading-5">
            <dt className="text-subtle">Path</dt>
            <dd className="text-ink">
              {path.entry} <ArrowRight className="inline size-3.5 align-[-2px] text-subtle" /> {path.target}
            </dd>
            {edge.role && (
              <>
                <dt className="text-subtle">Grant</dt>
                <dd className="font-mono text-xs leading-5 [overflow-wrap:anywhere] text-ink">{edge.role}</dd>
              </>
            )}
            {edge.scope && (
              <>
                <dt className="text-subtle">Bound</dt>
                <dd className="text-ink">{edge.scope}</dd>
              </>
            )}
          </dl>
        </Section>

        {edge.kind === 'impersonate' ? (
          <Section title="How to fix">
            <p className="text-sm leading-5 [overflow-wrap:anywhere] text-[#404040]">{path.fix.text}</p>
            {path.fix.command && <CopyCommand command={path.fix.command} />}
          </Section>
        ) : (
          <Section title="Is this a problem?">
            <p className="text-sm leading-5 text-[#404040]">
              Not on its own: a workload has to run as some identity. The risk is what that identity can do next. Select the “can impersonate”
              line to see the fix.
            </p>
          </Section>
        )}
      </article>
    </div>
  )
}

/** Panel toggle glyph: a rounded frame with an inset divider (no arrow; the line stops short of the edges). */
function PanelGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" className={className} aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M15 8.5v7" />
    </svg>
  )
}

/* ───────────── Canvas ───────────── */

function ControlButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-9 items-center justify-center rounded-xl text-ink transition-colors hover:bg-[#f4f4f4]"
    >
      {children}
    </button>
  )
}

/** Live zoom percentage between the − and + buttons. */
function ZoomLevel() {
  const { zoom } = useViewport()
  return <span className="w-14 text-center text-sm leading-5 font-medium tabular-nums text-ink">{Math.round(zoom * 100)}%</span>
}

function Graph({ filter, inScope }: { filter?: React.ReactNode; inScope: boolean }) {
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null)
  const [wide, setWide] = useState(false)
  // The side panel can be tucked away to give the canvas the full width.
  const [hidden, setHidden] = useState(false)
  const [openPath, setOpenPath] = useState<string | null>(null)
  // Selecting a line or highlighting a path brings a hidden panel back, since that's where its details show.
  useEffect(() => {
    if (selectedEdge || openPath) setHidden(false)
  }, [selectedEdge, openPath])
  const [full, setFull] = useState(false)
  const flow = useReactFlow()

  const panelW = wide ? PANEL_W.wide : PANEL_W.normal
  const fitPadding = useMemo(
    (): FitViewOptions['padding'] => ({ top: '48px', bottom: '48px', left: '72px', right: hidden ? '72px' : `${panelW + PANEL_INSET * 2 + 24}px` }),
    [panelW, hidden],
  )

  const edgeIndex = useMemo(() => {
    const m = new Map<string, { edge: PathEdge; path: AttackPath }>()
    ATTACK_PATHS.forEach((path) => path.edges.forEach((edge) => m.set(edge.id, { edge, path })))
    return m
  }, [])
  const labels = useMemo(() => new Map(ATTACK_PATHS.flatMap((p) => p.nodes.map((n) => [n.id, n.label] as const))), [])
  const selected = selectedEdge ? edgeIndex.get(selectedEdge) : undefined
  // The highlighted path: the one whose line is selected, else the one open in the panel.
  const activePath = selected?.path.id ?? openPath

  // Cards can be dragged to rearrange the canvas; moved positions override the column layout.
  const [moved, setMoved] = useState<Record<string, { x: number; y: number }>>({})
  const onNodesChange: OnNodesChange<Node<GraphNodeData>> = useCallback((changes) => {
    setMoved((prev) => {
      let next = prev
      for (const c of changes) {
        if (c.type === 'position' && c.position) next = { ...next, [c.id]: c.position }
      }
      return next
    })
  }, [])

  const nodes: Node<GraphNodeData>[] = useMemo(
    () =>
      ATTACK_PATHS.flatMap((path, row) =>
        path.nodes.map((n, col) => ({
          id: n.id,
          type: 'path',
          position: moved[n.id] ?? { x: COL_X[col], y: row * ROW_Y },
          data: { label: n.label, kind: n.kind, reached: n.reached, num: row + 1, active: activePath === path.id, dim: !!activePath && activePath !== path.id },
        })),
      ),
    [activePath, moved],
  )

  const edges: Edge[] = useMemo(
    () =>
      ATTACK_PATHS.flatMap((path) =>
        path.edges.map((e) => {
          const isSel = e.id === selectedEdge
          const dim = !!activePath && activePath !== path.id
          const color = isSel ? '#171717' : e.kind === 'impersonate' ? '#e3908a' : '#b5b5b5'
          return {
            id: e.id,
            source: e.source,
            target: e.target,
            type: 'smoothstep',
            pathOptions: { borderRadius: 24 },
            label: edgeLabel(e),
            interactionWidth: 24,
            animated: isSel,
            style: { stroke: color, strokeWidth: isSel ? 2 : 1.25, opacity: dim ? 0.3 : 1, cursor: 'pointer' },
            markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
            labelStyle: { fill: isSel ? '#171717' : '#5c5c5c', fontSize: 12, fontWeight: 500 },
            labelBgStyle: { fill: '#ffffff', stroke: '#ebebeb' },
            labelBgPadding: [6, 3] as [number, number],
            labelBgBorderRadius: 6,
          }
        }),
      ),
    [activePath, selectedEdge],
  )

  const pathOfNode = useMemo(() => new Map(ATTACK_PATHS.flatMap((p) => p.nodes.map((n) => [n.id, p.id] as const))), [])

  // Clicking a card on the canvas opens (or closes) its path in the panel and scrolls to it.
  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      const id = pathOfNode.get(node.id)
      if (!id) return
      setSelectedEdge(null)
      setOpenPath((cur) => (cur === id ? null : id))
      window.setTimeout(() => document.getElementById(`path-card-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
    },
    [pathOfNode],
  )

  // Opening a card in the panel brings its row into view on the canvas.
  const togglePath = (id: string) => {
    const opening = openPath !== id
    setOpenPath(opening ? id : null)
    if (opening) {
      const ids = ATTACK_PATHS.find((p) => p.id === id)?.nodes.map((n) => ({ id: n.id })) ?? []
      void flow.fitView({ nodes: ids, padding: fitPadding, maxZoom: 1.1, duration: 300 })
    }
  }

  const onEdgeClick: EdgeMouseHandler = useCallback((_, edge) => setSelectedEdge((cur) => (cur === edge.id ? null : edge.id)), [])

  // Refit whenever the canvas changes size (first layout, fullscreen, window resize)
  // or the panel width changes, so the graph always sits centred left of the panel.
  const canvasRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    let t = 0
    const refit = () => {
      window.clearTimeout(t)
      t = window.setTimeout(() => void flow.fitView({ padding: fitPadding, maxZoom: 1.1, duration: 250 }), 60)
    }
    const ro = new ResizeObserver(refit)
    ro.observe(el)
    refit()
    return () => {
      ro.disconnect()
      window.clearTimeout(t)
    }
  }, [fitPadding, full, flow])

  useEffect(() => {
    if (!full) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFull(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [full])

  return (
    <>
      {full && <div className="fixed inset-0 z-40 bg-[#e8e8e8]" onClick={() => setFull(false)} />}
      <div
        ref={canvasRef}
        className={
          full
            ? 'fixed inset-4 z-50 overflow-hidden rounded-2xl border border-line bg-[#f6f6f6] shadow-[0_24px_80px_rgba(0,0,0,0.25)]'
            : 'relative min-h-0 flex-1 overflow-hidden'
        }
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          nodesDraggable
          nodesFocusable={false}
          onEdgeClick={onEdgeClick}
          onNodeClick={onNodeClick}
          onPaneClick={() => {
            setSelectedEdge(null)
            setOpenPath(null)
          }}
          fitView
          fitViewOptions={{ padding: fitPadding, maxZoom: 1.1 }}
          minZoom={0.3}
          maxZoom={2}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: false }}
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1.4} color="#cfcfcf" bgColor="#f6f6f6" />
        </ReactFlow>

        {/* Top-left: account filter (same popover as the tables), with the canvas hint beside it */}
        <div className="absolute top-4 left-6 z-20 flex items-center gap-3">
          {filter}
          <div className="pointer-events-none rounded-md bg-[#f6f6f6]/90 px-2 py-1 text-[13px] leading-5 text-subtle">
            Click a card to highlight its path · drag to rearrange · click a line to see what it means
          </div>
        </div>

        {/* Every account that has these paths is filtered out */}
        {!inScope && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 bg-[#f6f6f6]/90 text-center">
            <h2 className="text-base leading-6 font-semibold">No attack paths in the selected accounts</h2>
            <p className="text-sm leading-5 text-subtle">These paths come from Google Cloud (hex-exposure-lab). Include it in the filter to see them.</p>
          </div>
        )}

        {/* Canvas controls: zoom pill + separate fit / fullscreen buttons */}
        <div className="absolute bottom-6 left-6 flex items-center gap-2">
          <div className="flex h-12 items-center rounded-2xl bg-white px-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.03)]">
            <ControlButton label="Zoom out" onClick={() => void flow.zoomOut({ duration: 200 })}>
              <Minus className="size-4" />
            </ControlButton>
            <ZoomLevel />
            <ControlButton label="Zoom in" onClick={() => void flow.zoomIn({ duration: 200 })}>
              <Plus className="size-4" />
            </ControlButton>
          </div>
          <div className="flex h-12 items-center rounded-2xl bg-white px-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.03)]">
            <ControlButton label="Recenter" onClick={() => void flow.fitView({ padding: fitPadding, maxZoom: 1.1, duration: 250 })}>
              <LocateFixed className="size-4" />
            </ControlButton>
            <ControlButton label={full ? 'Exit full screen (Esc)' : 'Full screen'} onClick={() => setFull((f) => !f)}>
              {full ? <Shrink className="size-4" /> : <Expand className="size-4" />}
            </ControlButton>
          </div>
        </div>

        {/* Shown while the panel is hidden: brings it back. */}
        <button
          onClick={() => setHidden(false)}
          aria-hidden={!hidden}
          tabIndex={hidden ? 0 : -1}
          style={{ top: PANEL_INSET, right: PANEL_INSET }}
          className={`absolute flex h-10 items-center gap-2 rounded-xl bg-white pr-3 pl-2.5 text-sm font-medium text-ink shadow-[0_1px_3px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] transition-[opacity,translate,box-shadow,scale] duration-200 ease-out active:scale-[0.97] hover:shadow-[0_6px_18px_rgba(0,0,0,0.10),0_0_0_1px_rgba(0,0,0,0.06)] ${
            hidden ? 'opacity-100' : 'pointer-events-none translate-x-2 opacity-0'
          }`}
        >
          <PanelGlyph className="size-4 text-subtle" />
          Attack paths
          <span className="rounded-full bg-[#f1f1f1] px-1.5 text-xs leading-5 font-medium text-muted tabular-nums">{ATTACK_PATHS.length}</span>
        </button>

        {/* Floating right panel (slides out to the right when hidden) */}
        <aside
          aria-label={selected ? 'Connection details' : 'Attack paths'}
          aria-hidden={hidden}
          style={{ width: panelW, top: PANEL_INSET, right: PANEL_INSET, bottom: PANEL_INSET }}
          className={`absolute flex flex-col overflow-hidden rounded-xl border border-line bg-page/95 shadow-[0_8px_30px_rgba(0,0,0,0.08)] backdrop-blur-sm transition-[width,transform,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            hidden ? 'pointer-events-none translate-x-[calc(100%+32px)] opacity-0' : ''
          }`}
        >
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
            <div className="flex items-center gap-2">
              <h2 className="text-sm leading-5 font-semibold">{selected ? 'Connection details' : 'Attack paths'}</h2>
              {!selected && (
                <span className="rounded-full bg-[#f1f1f1] px-2 py-0.5 text-xs leading-4 font-medium text-muted tabular-nums">
                  {ATTACK_PATHS.length} critical
                </span>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              <InfoButton {...TAB_INFO['attack-paths']} size="sm" />
              <button
                onClick={() => setWide((w) => !w)}
                title={wide ? 'Narrow panel' : 'Widen panel'}
                aria-label={wide ? 'Narrow panel' : 'Widen panel'}
                className="rounded-md p-1.5 text-muted hover:bg-[#f0f0f0] hover:text-ink"
              >
                {wide ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </button>
              <button onClick={() => setHidden(true)} title="Hide panel" aria-label="Hide panel" className="rounded-md p-1.5 text-muted hover:bg-[#f0f0f0] hover:text-ink">
                <PanelGlyph className="size-4" />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {selected ? (
              <EdgeDetail edge={selected.edge} path={selected.path} labels={labels} onBack={() => setSelectedEdge(null)} />
            ) : (
              ATTACK_PATHS.map((p) => (
                <PathCard key={p.id} path={p} num={ATTACK_PATHS.indexOf(p) + 1} open={openPath === p.id} onToggle={() => togglePath(p.id)} />
              ))
            )}
          </div>
        </aside>
      </div>
    </>
  )
}

export function AttackPathsTab({ available, inScope = true, filter }: { available: boolean; inScope?: boolean; filter?: React.ReactNode }) {
  if (!available)
    return (
      <section className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
        <h2 className="text-base leading-6 font-semibold">No attack paths yet</h2>
        <p className="text-sm leading-5 text-subtle">Paths appear once Google Cloud (hex-exposure-lab) finishes syncing.</p>
      </section>
    )
  return (
    <section className="relative flex min-h-0 flex-1 flex-col" aria-label="Attack paths">
      <ReactFlowProvider>
        <Graph filter={filter} inScope={inScope} />
      </ReactFlowProvider>
    </section>
  )
}
