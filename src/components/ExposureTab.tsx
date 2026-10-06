import { ArrowRight, ArrowUpRight, Check, CheckCircle2, ChevronDown, ExternalLink, Globe, KeyRound, RotateCcw, ShieldCheck, Trash2, X } from 'lucide-react'
import { FaSlack } from 'react-icons/fa'
import { SlackComposer, type SentRecord } from './SlackShare'
import { FilletRadius, usePixelColumns } from './Fillet'
import { InfoButton, TAB_INFO } from './InfoButton'
import { Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { IDENTITY_PATHS, type IdentityPath } from '../data/escalation'
import { evidenceFor, isSensitive, RISK_ORDER } from '../data/exposure'
import type { Connection, Resource, Risk } from '../data/types'
import { ProviderIcon, RiskPill, STATUS_TONE, TypePill } from './Badges'
import {
  BulkBar,
  BulkButton,
  GUTTER_CHECK,
  colStyle,
  HeaderRow,
  nextSort,
  rowCheckClass,
  sortRows,
  Toolbar,
  useResizableColumns,
  useSelection,
  type Column,
  type SortState,
} from './Table'

/* Same table as Resources: toolbar with segmented views · filleted header · 58px rows.
 * Clicking a row (or its hover-only Open button) shows the finding in a floating panel
 * inset from the top, right and bottom, like the Attack paths panel. */

const DEFAULT_COLUMNS: Column[] = [
  { key: 'resource', label: 'Resource', width: 300, sortable: true },
  { key: 'severity', label: 'Severity', width: 104, sortable: true },
  { key: 'type', label: 'Type', width: 140, sortable: true },
  { key: 'project', label: 'Project', width: 160, sortable: true },
  { key: 'location', label: 'Location', width: 120, sortable: true },
  { key: 'via', label: 'Reachable via' },
]

type View = 'all' | 'reachable' | 'escalation' | 'expected' | 'sensitive'
type Category = Exclude<View, 'all'>

const CATEGORY: Record<Category, { label: string; Icon: typeof Globe; tone: string }> = {
  reachable: { label: 'Internet reachable', Icon: Globe, tone: STATUS_TONE.pending },
  escalation: {
    label: 'Escalation path',
    Icon: ArrowUpRight,
    tone: STATUS_TONE.danger,
  },
  expected: {
    label: 'Expected access',
    Icon: ShieldCheck,
    tone: 'border-line bg-white text-muted',
  },
  sensitive: {
    label: 'Credentials & data',
    Icon: KeyRound,
    tone: STATUS_TONE.progress,
  },
}
const CATEGORY_ORDER: Record<Category, number> = {
  escalation: 0,
  reachable: 1,
  sensitive: 2,
  expected: 3,
}

function CategoryPill({ c }: { c: Category }) {
  const { label, Icon, tone } = CATEGORY[c]
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs leading-4 font-medium whitespace-nowrap ${tone}`}>
      <Icon className="size-3" />
      {label}
    </span>
  )
}

/** One row of the All view: a resource finding or an identity path. */
type Finding = { id: string; category: Category; risk: Resource['risk'] } & ({ resource: Resource } | { path: IdentityPath })

const ALL_COLUMNS: Column[] = [
  { key: 'finding', label: 'Finding', width: 400, sortable: true },
  { key: 'category', label: 'Category', width: 170, sortable: true },
  { key: 'severity', label: 'Severity', width: 104, sortable: true },
  { key: 'account', label: 'Account', width: 190, sortable: true },
  { key: 'why', label: 'Why' },
]

// Identity-path views (escalation / expected access) share the table, with their own columns.
const PATH_COLUMNS: Column[] = [
  { key: 'path', label: 'Path', width: 420, sortable: true },
  { key: 'severity', label: 'Severity', width: 104, sortable: true },
  { key: 'grant', label: 'Grant', width: 220, sortable: true },
  { key: 'account', label: 'Account', width: 190, sortable: true },
  { key: 'reaches', label: 'Reaches' },
]

const chainText = (p: IdentityPath) => p.chain.map((c) => ('entity' in c ? c.entity : c.verb)).join(' ')

/** entity · verb · entity, with entities in ink and verbs muted. */
function Chain({ path }: { path: IdentityPath }) {
  return (
    <>
      {path.chain.map((c, i) =>
        'entity' in c ? (
          <span key={i} className="font-medium text-ink">
            {c.entity}
          </span>
        ) : (
          <span key={i} className="text-subtle">
            {' '}
            {c.verb}{' '}
          </span>
        ),
      )}
    </>
  )
}

/** Hover-only Open button at the right end of the row, the last column fading underneath. */
function OpenOverlay({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center bg-gradient-to-r from-transparent via-[#f2f2f2] via-35% to-[#f2f2f2] pr-6 pl-16 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
      <button
        onClick={(e) => {
          e.stopPropagation()
          onOpen()
        }}
        className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-[#e0e0e0] bg-white px-2.5 text-xs font-medium shadow-sm transition-[background-color,scale] duration-150 ease-out hover:bg-[#fafafa] active:scale-[0.97]"
      >
        Open
        <ArrowRight className="size-3" />
      </button>
    </div>
  )
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line-soft px-5 py-4">
      <div className="text-xs leading-4 font-medium text-subtle">{title}</div>
      <div className="mt-2">{children}</div>
    </section>
  )
}

function PathBody({ p }: { p: IdentityPath }) {
  const entities = p.chain.filter((c): c is { entity: string } => 'entity' in c)
  return (
    <>
      <PanelSection title="What this means">
        <p className="text-sm leading-5 text-[#404040]">{p.explain}</p>
      </PanelSection>
      <PanelSection title="Chain">
        <ol>
          {entities.map((c, i) => {
            const verb = p.chain[i * 2 - 1]
            return (
              <li key={i} className="relative flex gap-3 pb-3 last:pb-0">
                {i < entities.length - 1 && <span aria-hidden className="absolute top-6 bottom-0 left-[11px] w-px bg-line" />}
                <span className="relative flex size-6 shrink-0 items-center justify-center rounded-full border border-line bg-white text-xs text-muted tabular-nums">
                  {i + 1}
                </span>
                <div className="pt-0.5 text-sm leading-5">
                  {verb && 'verb' in verb && <div className="text-xs leading-4 text-subtle">{verb.verb}</div>}
                  <div className="font-medium text-ink">{c.entity}</div>
                </div>
              </li>
            )
          })}
        </ol>
      </PanelSection>
      <PanelSection title="Details">
        <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-2 text-sm leading-5">
          <dt className="text-muted">Grant</dt>
          <dd className="font-mono text-xs leading-5 [overflow-wrap:anywhere] text-ink">{p.grant}</dd>
          <dt className="text-muted">Traits</dt>
          <dd className="text-ink">{p.traits.join(' · ')}</dd>
          {p.reaches ? (
            <>
              <dt className="text-muted">Reaches</dt>
              <dd className="font-medium text-[#c42b2b]">{p.reaches} credentials</dd>
            </>
          ) : null}
        </dl>
      </PanelSection>
    </>
  )
}

interface Props {
  /** Resources already narrowed by the account filter. */
  resources: Resource[]
  /** Every resource, so each environment tile always shows its own totals. */
  allResources: Resource[]
  /** Every connected account with an inventory. */
  connections: Connection[]
  /** Account ids in scope; empty means all. */
  scope: Set<string>
  filter: React.ReactNode
  /** Shows the shared Undo toast. */
  notify: (message: string, undo?: () => void) => void
}

/**
 * Exposure by environment: read-only stat tiles, one per account, sitting on the line colour
 * with 1px gaps like the table header. Accounts outside the current filter are dimmed.
 */
function EnvironmentStrip({ connections, all, scope }: { connections: Connection[]; all: Resource[]; scope: Set<string> }) {
  const r = useContext(FilletRadius)
  const cols = usePixelColumns<HTMLDivElement>(connections.map(() => 1))
  return (
    <div ref={cols} className="grid shrink-0 gap-px bg-line pb-px" style={{ gridTemplateColumns: `repeat(${connections.length}, minmax(0, 1fr))` }}>
      {connections.map((c, i) => {
        const mine = all.filter((x) => x.connectionId === c.id)
        const reachable = mine.filter((x) => x.exposure === 'internet').length
        const sensitive = mine.filter(isSensitive).length
        const excluded = scope.size > 0 && !scope.has(c.id)
        return (
          <div
            key={c.id}
            style={{ borderRadius: r }}
            className={`flex min-w-0 flex-1 items-center gap-3 bg-page py-3 pr-6 transition-opacity ${i === 0 ? 'pl-8' : 'pl-6'} ${excluded ? 'opacity-50' : ''}`}
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#f2f2f2]">
              <ProviderIcon id={c.provider} size={26} />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm leading-5 font-medium text-ink">{c.account}</span>
            <span className="flex shrink-0 items-baseline gap-1.5 text-[13px] leading-5 text-muted">
              <span className="font-mono text-xl leading-6 font-medium text-ink tabular-nums">{reachable}</span>
              internet-reachable <span className="text-subtle tabular-nums">of {mine.length}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1 pl-3 text-[13px] leading-5 font-medium text-[#c42b2b] tabular-nums">
              <KeyRound className="size-3.5" />
              {sensitive} sensitive
            </span>
          </div>
        )
      })}
    </div>
  )
}

function ResourceBody({ r }: { r: Resource }) {
  const ev = evidenceFor(r)
  const reachable = r.exposure === 'internet'
  return (
    <>
      <PanelSection title={reachable ? 'Why it’s reachable' : 'Why it matters'}>
        <p className="text-sm leading-5 text-[#404040]">
          {reachable
            ? ev.reason
            : 'Holds credentials or data. Nothing in its configuration exposes it to the internet directly, but an identity that can read it may be reachable.'}
        </p>
      </PanelSection>
      {reachable && (
        <>
          <PanelSection title="Observed">
            <dl className="grid grid-cols-[132px_1fr] gap-x-3 gap-y-2 text-sm leading-5">
              {ev.observed.map(([k, v]) => (
                <Fragment key={k}>
                  <dt className="text-muted">{k}</dt>
                  <dd className="font-mono text-xs leading-5 [overflow-wrap:anywhere] text-ink">{v}</dd>
                </Fragment>
              ))}
            </dl>
          </PanelSection>
          <PanelSection title="Evidence">
            <dl className="grid grid-cols-[132px_1fr] gap-x-3 gap-y-2 text-sm leading-5">
              <dt className="text-muted">Sources</dt>
              <dd className="font-mono text-xs leading-5 [overflow-wrap:anywhere] text-ink">
                {ev.sources.map((x) => (
                  <div key={x}>{x}</div>
                ))}
              </dd>
              <dt className="text-muted">Read with</dt>
              <dd className="font-mono text-xs leading-5 [overflow-wrap:anywhere] text-ink">
                {ev.readWith.map((x) => (
                  <div key={x}>{x}</div>
                ))}
              </dd>
            </dl>
          </PanelSection>
        </>
      )}
      <PanelSection title="Resource">
        <code className="block font-mono text-xs leading-5 [overflow-wrap:anywhere] text-ink">{r.path}</code>
        {reachable && (
          <a
            href={ev.docs}
            target="_blank"
            rel="noreferrer"
            className="mt-3 -ml-2.5 flex h-8 w-fit items-center gap-1.5 rounded-md border border-transparent px-2.5 text-[13px] text-muted transition-colors hover:border-line hover:bg-white hover:text-ink"
          >
            Provider documentation
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </PanelSection>
    </>
  )
}

type Detail = { resource: Resource } | { path: IdentityPath }

const SEVERITY_CHOICES: { value: Risk; label: string }[] = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'none', label: 'Info' },
]
const SEVERITY_NAME: Record<Risk, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', sensitive: 'Sensitive', none: 'Info' }

/** Severity pill for the picker: RiskPill, plus a neutral "Info" pill for no severity. */
function SeverityPill({ value }: { value: Risk }) {
  return value === 'none' ? (
    <span className="inline-flex items-center rounded-md bg-[#f4f4f4] px-2 py-0.5 text-xs leading-4 font-medium text-muted">Info</span>
  ) : (
    <RiskPill value={value} />
  )
}

/**
 * The severity pill in the panel header is a menu: pick a new level, or reset to what
 * Parameter detected. Changes apply to the table immediately.
 */
function SeverityPicker({ risk, detected, expected, onChange }: { risk: Risk; detected: Risk; expected: boolean; onChange: (r: Risk | null) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open])
  const edited = risk !== detected
  return (
    <div ref={ref} className="relative flex items-center gap-1.5">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Change severity"
        className="flex items-center gap-1 rounded-md transition-[scale] duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-ink/15 active:scale-[0.97]"
      >
        {expected && !edited ? (
          <span className="rounded-md border border-line bg-white px-2 py-0.5 text-xs leading-4 font-medium text-muted">No gain</span>
        ) : (
          <SeverityPill value={risk} />
        )}
        <ChevronDown className={`size-3.5 text-subtle transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {edited && <span className="text-xs leading-4 text-subtle">Edited</span>}
      {open && (
        <div
          role="menu"
          className="popover-in absolute top-full left-0 z-30 mt-1.5 w-56 origin-top-left overflow-hidden rounded-xl border border-line bg-white p-1 shadow-[0_12px_32px_rgba(0,0,0,0.12)]"
        >
          <div className="px-2.5 pt-1.5 pb-1 text-xs leading-4 font-medium text-subtle">Severity</div>
          {SEVERITY_CHOICES.map((c) => (
            <button
              key={c.value}
              role="menuitemradio"
              aria-checked={risk === c.value}
              onClick={() => {
                onChange(c.value === detected ? null : c.value)
                setOpen(false)
              }}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm leading-5 hover:bg-[#f6f6f6]"
            >
              <SeverityPill value={c.value} />
              <span className="flex items-center gap-2 text-xs text-subtle">
                {c.value === detected && 'Detected'}
                {risk === c.value && <Check className="size-3.5 text-ink" />}
              </span>
            </button>
          ))}
          {edited && (
            <button
              onClick={() => {
                onChange(null)
                setOpen(false)
              }}
              className="mt-1 flex w-full items-center gap-1.5 rounded-lg border-t border-line-soft px-2.5 pt-2 pb-1.5 text-left text-[13px] leading-5 text-muted hover:text-ink"
            >
              <RotateCcw className="size-3.5" />
              Reset to {SEVERITY_NAME[detected]}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Floating detail panel, inset from the top, right and bottom like the Attack paths panel. */
function DetailPanel({
  detail,
  closing,
  onClose,
  sent,
  onSent,
  detected,
  onSeverity,
}: {
  detail: Detail
  closing: boolean
  onClose: () => void
  sent?: SentRecord
  onSent: (channels: string[]) => void
  /** Severity Parameter detected, before any manual change. */
  detected: Risk
  onSeverity: (r: Risk | null) => void
}) {
  const isPath = 'path' in detail
  const detailKey = isPath ? detail.path.id : detail.resource.id
  // Details ⇄ Send to Slack, inside the same panel. Switching findings returns to details.
  const [mode, setMode] = useState<'details' | 'slack'>('details')
  useEffect(() => setMode('details'), [detailKey])
  const category: Category = isPath ? detail.path.kind : detail.resource.exposure === 'internet' ? 'reachable' : 'sensitive'
  const risk = isPath ? detail.path.risk : detail.resource.risk
  return (
    <>
      {/* Mild dark, blurred backdrop over the whole app; clicking it closes the panel. */}
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-[3px] ${closing ? 'animate-[fade-out_200ms_cubic-bezier(0.23,1,0.32,1)_forwards]' : 'animate-[fade-in_200ms_ease-out]'}`}
      />
      <aside
        aria-label="Finding details"
        role="dialog"
        className={`fixed top-4 right-4 bottom-4 z-50 flex w-[460px] flex-col overflow-hidden rounded-xl border border-line bg-page shadow-[0_24px_64px_rgba(0,0,0,0.22)] ${
          closing ? 'animate-[panel-out_220ms_cubic-bezier(0.23,1,0.32,1)_forwards]' : 'animate-[panel-in_320ms_cubic-bezier(0.32,0.72,0,1)]'
        }`}
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-line px-5">
          <div className="flex items-center gap-2">
            <CategoryPill c={category} />
            <SeverityPicker risk={risk} detected={detected} expected={category === 'expected'} onChange={onSeverity} />
          </div>
          <button onClick={onClose} aria-label="Close" title="Close (Esc)" className="rounded-md p-1.5 text-muted hover:bg-[#f0f0f0] hover:text-ink">
            <X className="size-4" />
          </button>
        </div>
        {mode === 'slack' ? (
          <SlackComposer
            key={detailKey}
            target={detail}
            onBack={() => setMode('details')}
            onSent={(channels) => {
              onSent(channels)
              setMode('details')
            }}
          />
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <header className="px-5 py-4">
                {isPath ? (
                  <h2 className="text-[15px] leading-6">
                    <Chain path={detail.path} />
                  </h2>
                ) : (
                  <h2 className="text-[15px] leading-6 font-semibold [overflow-wrap:anywhere] text-ink">{detail.resource.name}</h2>
                )}
                <div className="mt-1.5 flex items-center gap-1.5 text-[13px] leading-5 text-subtle">
                  <ProviderIcon id={isPath ? detail.path.provider : detail.resource.provider} size={13} />
                  {isPath ? detail.path.account : `${detail.resource.type} · ${detail.resource.location} · ${detail.resource.project}`}
                </div>
              </header>
              {isPath ? <PathBody p={detail.path} /> : <ResourceBody r={detail.resource} />}
            </div>
            {/* Footer: share the finding with the team. Primary for Critical / High findings. */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line bg-page px-5 py-3">
              {sent ? (
                <span className="flex min-w-0 items-center gap-1.5 text-[13px] leading-5 text-[#0f7a4a]">
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span className="truncate">
                    Sent to {sent.channels.map((c) => `#${c}`).join(', ')} · {sent.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </span>
              ) : (
                <span className="text-xs leading-4 text-subtle">
                  {risk === 'critical' || risk === 'high' ? 'Let the owning team know.' : 'Share with your team.'}
                </span>
              )}
              <button
                onClick={() => setMode('slack')}
                className={`flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3.5 text-sm font-medium transition duration-150 ease-out active:scale-[0.97] ${
                  (risk === 'critical' || risk === 'high') && !sent
                    ? 'bg-ink text-white shadow-sm hover:bg-[#2a2a2a]'
                    : 'border border-[#e0e0e0] bg-white text-[#525252] hover:bg-[#fafafa] hover:text-ink'
                }`}
              >
                <FaSlack className="size-3.5" />
                {sent ? 'Send again' : 'Send to Slack'}
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  )
}

export function ExposureTab({ resources, allResources, connections, scope, filter, notify }: Props) {
  // Deleted findings are hidden from every view; Undo brings them back.
  const [deleted, setDeleted] = useState<Set<string>>(new Set())
  const { columns: COLUMNS, resize, reset } = useResizableColumns('exposure', DEFAULT_COLUMNS)
  const [view, setView] = useState<View>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortState | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  // The panel stays mounted while it slides out, then the id is cleared.
  const [closing, setClosing] = useState(false)
  const [sent, setSent] = useState<Record<string, SentRecord>>({})
  // Manual severity changes, by finding id. Applied before anything is filtered or sorted.
  const [severity, setSeverity] = useState<Record<string, Risk>>({})
  const rated = useMemo(() => resources.map((r) => (severity[r.id] ? { ...r, risk: severity[r.id] } : r)), [resources, severity])
  const ratedPaths = useMemo(() => IDENTITY_PATHS.map((p) => (severity[p.id] ? { ...p, risk: severity[p.id] } : p)), [severity])
  const closeTimer = useRef(0)

  const reachable = useMemo(() => rated.filter((r) => r.exposure === 'internet' && !deleted.has(r.id)), [rated, deleted])
  const sensitive = useMemo(() => rated.filter((r) => isSensitive(r) && !deleted.has(r.id)), [rated, deleted])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = (view === 'reachable' ? reachable : sensitive).filter(
      (r) => !q || [r.name, r.path, r.type, r.project, r.location].some((v) => v.toLowerCase().includes(q)),
    )
    // Default order: highest severity first.
    const bySeverity = [...base].sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk])
    return sortRows(bySeverity, sort, (r, key) =>
      key === 'resource'
        ? r.name
        : key === 'severity'
          ? RISK_ORDER[r.risk]
          : key === 'type'
            ? r.type
            : key === 'project'
              ? r.project
              : key === 'location'
                ? r.location
                : evidenceFor(r).short,
    )
  }, [view, reachable, sensitive, query, sort])

  const pathCols = useResizableColumns('exposure-paths', PATH_COLUMNS)
  const providersInScope = useMemo(() => new Set(resources.map((r) => r.provider)), [resources])
  const escalation = useMemo(
    () => ratedPaths.filter((p) => p.kind === 'escalation' && providersInScope.has(p.provider) && !deleted.has(p.id)),
    [ratedPaths, providersInScope, deleted],
  )
  const expected = useMemo(
    () => ratedPaths.filter((p) => p.kind === 'expected' && providersInScope.has(p.provider) && !deleted.has(p.id)),
    [ratedPaths, providersInScope, deleted],
  )
  const isPathView = view === 'escalation' || view === 'expected'
  const pathRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = (view === 'expected' ? expected : escalation).filter(
      (p) => !q || [chainText(p), p.grant, p.account, ...p.traits].some((x) => x.toLowerCase().includes(q)),
    )
    return sortRows(base, sort, (p, key) =>
      key === 'path' ? chainText(p) : key === 'severity' ? RISK_ORDER[p.risk] : key === 'grant' ? p.grant : key === 'account' ? p.account : (p.reaches ?? 0),
    )
  }, [view, escalation, expected, query, sort])

  // All: every finding in one list. A sensitive store that's also reachable is listed once, as reachable.
  const allCols = useResizableColumns('exposure-all', ALL_COLUMNS)
  const allRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const items: Finding[] = [
      ...reachable.map((r): Finding => ({
        id: r.id,
        category: 'reachable',
        risk: r.risk,
        resource: r,
      })),
      ...sensitive
        .filter((r) => r.exposure !== 'internet')
        .map((r): Finding => ({
          id: r.id,
          category: 'sensitive',
          risk: r.risk,
          resource: r,
        })),
      ...escalation.map((p): Finding => ({
        id: p.id,
        category: 'escalation',
        risk: p.risk,
        path: p,
      })),
      ...expected.map((p): Finding => ({
        id: p.id,
        category: 'expected',
        risk: p.risk,
        path: p,
      })),
    ]
    const text = (f: Finding) => ('path' in f ? chainText(f.path) : f.resource.name)
    const account = (f: Finding) => ('path' in f ? f.path.account : f.resource.project)
    const filtered = items.filter((f) => !q || [text(f), account(f), CATEGORY[f.category].label].some((x) => x.toLowerCase().includes(q)))
    const ordered = filtered.sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk] || CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category])
    return sortRows(ordered, sort, (f, key) =>
      key === 'finding'
        ? text(f)
        : key === 'category'
          ? CATEGORY_ORDER[f.category]
          : key === 'severity'
            ? RISK_ORDER[f.risk]
            : key === 'account'
              ? account(f)
              : '',
    )
  }, [reachable, sensitive, escalation, expected, query, sort])

  const sel = useSelection(view === 'all' ? allRows.map((f) => f.id) : isPathView ? pathRows.map((p) => p.id) : rows.map((r) => r.id))

  // The open finding is looked up by id, so it disappears if the filter removes it.
  const detail: Detail | null = useMemo(() => {
    if (!detailId) return null
    const r = rated.find((x) => x.id === detailId)
    if (r) return { resource: r }
    const p = [...escalation, ...expected].find((x) => x.id === detailId)
    return p ? { path: p } : null
  }, [detailId, rated, escalation, expected])
  const closeDetail = useCallback(() => {
    setClosing(true)
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => {
      setDetailId(null)
      setClosing(false)
    }, 200)
  }, [])
  const showDetail = (id: string) => {
    window.clearTimeout(closeTimer.current)
    setClosing(false)
    setDetailId(id)
  }
  const openDetail = (id: string) => (detailId === id ? closeDetail() : showDetail(id))

  useEffect(() => {
    if (!detailId) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeDetail()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [detailId, closeDetail])

  const views: { id: View; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: allRows.length },
    { id: 'reachable', label: 'Internet reachable', count: reachable.length },
    { id: 'escalation', label: 'Escalation', count: escalation.length },
    { id: 'expected', label: 'Expected', count: expected.length },
    { id: 'sensitive', label: 'Credentials', count: sensitive.length },
  ]

  const viewTabs = (
    <div className="flex h-9 items-center gap-1 rounded-lg bg-[#f4f4f4] p-1 text-[13px]">
      {views.map(({ id, label, count }) => (
        <button
          key={id}
          onClick={() => {
            setView(id)
            setSort(null)
          }}
          className={`flex h-full items-center gap-1.5 rounded-md px-2.5 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ink/15 ${view === id ? 'bg-white font-medium' : 'text-muted hover:text-ink'}`}
        >
          {label}
          <span className="text-xs text-subtle tabular-nums">{count}</span>
        </button>
      ))}
    </div>
  )

  return (
    <section className="relative flex min-h-0 flex-1 flex-col" aria-label="Exposure">
      <EnvironmentStrip connections={connections} all={allResources} scope={scope} />
      <Toolbar
        lineAbove
        placeholder="Search exposed resources"
        value={query}
        onChange={setQuery}
        filter={filter}
        info={<InfoButton {...TAB_INFO.exposure} />}
        left={
          sel.active ? (
            <BulkBar sel={sel}>
              <BulkButton
                icon={Trash2}
                label="Delete"
                danger
                onClick={() => {
                  const ids = sel.ids
                  setDeleted((prev) => new Set([...prev, ...ids]))
                  sel.clear()
                  notify(`${ids.length} finding${ids.length === 1 ? '' : 's'} deleted`, () =>
                    setDeleted((prev) => new Set([...prev].filter((id) => !ids.includes(id)))),
                  )
                }}
              />
            </BulkBar>
          ) : (
            viewTabs
          )
        }
      />
      <HeaderRow
        columns={
          view === 'all'
            ? allCols.columns
            : isPathView
              ? pathCols.columns
              : COLUMNS.map((c) => (c.key === 'via' && view === 'sensitive' ? { ...c, label: 'Exposure' } : c))
        }
        onResize={view === 'all' ? allCols.resize : isPathView ? pathCols.resize : resize}
        onResetWidth={view === 'all' ? allCols.reset : isPathView ? pathCols.reset : reset}
        sort={sort}
        onSort={(key) => setSort((cur) => nextSort(cur, key))}
        selection={sel}
      />

      <div role="rowgroup" className="flex-1 overflow-auto">
        {view === 'all' &&
          allRows.map((f) => {
            const C = allCols.columns
            const isPath = 'path' in f
            return (
              <Fragment key={f.id}>
                <div
                  role="row"
                  aria-selected={detailId === f.id}
                  onClick={() => openDetail(f.id)}
                  className={`group relative flex h-[58px] cursor-pointer items-center border-b border-line-soft pl-8 text-sm leading-5 hover:bg-[#f2f2f2] ${detailId === f.id ? 'bg-[#f2f2f2]' : ''}`}
                >
                  <OpenOverlay onOpen={() => showDetail(f.id)} />
                  <div className={GUTTER_CHECK} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label="Select finding"
                      checked={sel.has(f.id)}
                      onChange={() => sel.toggle(f.id)}
                      className={rowCheckClass(sel)}
                    />
                  </div>
                  <div style={colStyle(C[0])} className="relative flex h-full min-w-0 items-center gap-3 border-r border-line-soft pr-3">
                    <ProviderIcon id={isPath ? f.path.provider : f.resource.provider} />
                    <div className="min-w-0 flex-1">
                      {isPath ? (
                        <>
                          <div className="truncate leading-5">
                            <Chain path={f.path} />
                          </div>
                          <div className="truncate text-xs leading-4 text-subtle">{f.path.traits.join(' · ')}</div>
                        </>
                      ) : (
                        <>
                          <div className="truncate leading-5 font-medium">{f.resource.name}</div>
                          <div className="truncate font-mono text-xs leading-4 text-subtle">{f.resource.path}</div>
                        </>
                      )}
                    </div>
                  </div>
                  <div style={colStyle(C[1])} className="flex h-full items-center border-r border-line-soft px-3">
                    <CategoryPill c={f.category} />
                  </div>
                  <div style={colStyle(C[2])} className="flex h-full items-center border-r border-line-soft px-3">
                    {f.category === 'expected' ? (
                      <span className="rounded-md border border-line bg-white px-2 py-0.5 text-xs leading-4 font-medium text-muted">No gain</span>
                    ) : (
                      <RiskPill value={f.risk} />
                    )}
                  </div>
                  <div style={colStyle(C[3])} className="flex h-full min-w-0 items-center gap-2 border-r border-line-soft px-3 text-[#404040]">
                    <ProviderIcon id={isPath ? f.path.provider : f.resource.provider} size={14} />
                    <span className="truncate">{isPath ? f.path.account : f.resource.project}</span>
                  </div>
                  <div style={colStyle(C[4])} className="flex h-full min-w-0 items-center px-3 pr-8">
                    <span className={`truncate ${isPath ? 'font-mono text-xs text-[#404040]' : 'text-muted'}`}>
                      {isPath ? f.path.grant : f.category === 'reachable' ? evidenceFor(f.resource).short : `${f.resource.type}, not directly reachable`}
                    </span>
                  </div>
                </div>
              </Fragment>
            )
          })}
        {isPathView &&
          pathRows.map((p) => {
            const C = pathCols.columns
            return (
              <Fragment key={p.id}>
                <div
                  role="row"
                  aria-selected={detailId === p.id}
                  onClick={() => openDetail(p.id)}
                  className={`group relative flex h-[58px] cursor-pointer items-center border-b border-line-soft pl-8 text-sm leading-5 hover:bg-[#f2f2f2] ${detailId === p.id ? 'bg-[#f2f2f2]' : ''}`}
                >
                  <OpenOverlay onOpen={() => showDetail(p.id)} />
                  <div className={GUTTER_CHECK} onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" aria-label="Select path" checked={sel.has(p.id)} onChange={() => sel.toggle(p.id)} className={rowCheckClass(sel)} />
                  </div>
                  <div style={colStyle(C[0])} className="relative flex h-full min-w-0 items-center gap-3 border-r border-line-soft pr-3">
                    <ProviderIcon id={p.provider} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate leading-5">
                        <Chain path={p} />
                      </div>
                      <div className="truncate text-xs leading-4 text-subtle">{p.traits.join(' · ')}</div>
                    </div>
                  </div>
                  <div style={colStyle(C[1])} className="flex h-full items-center border-r border-line-soft px-3">
                    {p.kind === 'expected' ? (
                      <span className="rounded-md border border-line bg-white px-2 py-0.5 text-xs leading-4 font-medium text-muted">No gain</span>
                    ) : (
                      <RiskPill value={p.risk} />
                    )}
                  </div>
                  <div style={colStyle(C[2])} className="flex h-full min-w-0 items-center border-r border-line-soft px-3">
                    <span className="truncate font-mono text-xs text-[#404040]" title={p.grant}>
                      {p.grant}
                    </span>
                  </div>
                  <div style={colStyle(C[3])} className="flex h-full min-w-0 items-center gap-2 border-r border-line-soft px-3 text-[#404040]">
                    <ProviderIcon id={p.provider} size={14} />
                    <span className="truncate">{p.account}</span>
                  </div>
                  <div style={colStyle(C[4])} className="flex h-full items-center px-3 pr-8 tabular-nums">
                    {p.reaches ? <span className="font-medium text-[#c42b2b]">{p.reaches} credentials</span> : <span className="text-subtle">—</span>}
                  </div>
                </div>
              </Fragment>
            )
          })}
        {!isPathView &&
          view !== 'all' &&
          rows.map((r) => {
            return (
              <Fragment key={r.id}>
                <div
                  role="row"
                  aria-selected={detailId === r.id}
                  onClick={() => openDetail(r.id)}
                  className={`group relative flex h-[58px] cursor-pointer items-center border-b border-line-soft pl-8 text-sm leading-5 hover:bg-[#f2f2f2] ${detailId === r.id ? 'bg-[#f2f2f2]' : ''}`}
                >
                  <OpenOverlay onOpen={() => showDetail(r.id)} />
                  <div className={GUTTER_CHECK} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${r.name}`}
                      checked={sel.has(r.id)}
                      onChange={() => sel.toggle(r.id)}
                      className={rowCheckClass(sel)}
                    />
                  </div>
                  <div style={colStyle(COLUMNS[0])} className="relative flex h-full min-w-0 items-center border-r border-line-soft pr-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <ProviderIcon id={r.provider} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate leading-5 font-medium">{r.name}</div>
                        <div className="truncate font-mono text-xs leading-4 text-subtle">{r.path}</div>
                      </div>
                    </div>
                  </div>
                  <div style={colStyle(COLUMNS[1])} className="flex h-full items-center border-r border-line-soft px-3">
                    <RiskPill value={r.risk} />
                  </div>
                  <div style={colStyle(COLUMNS[2])} className="flex h-full items-center border-r border-line-soft px-3">
                    <TypePill>{r.type}</TypePill>
                  </div>
                  <div style={colStyle(COLUMNS[3])} className="flex h-full items-center border-r border-line-soft px-3 text-[#404040]">
                    <span className="truncate">{r.project}</span>
                  </div>
                  <div style={colStyle(COLUMNS[4])} className="flex h-full items-center border-r border-line-soft px-3 text-[#404040]">
                    <span className="truncate">{r.location}</span>
                  </div>
                  <div style={colStyle(COLUMNS[5])} className="flex h-full min-w-0 items-center gap-2 px-3 pr-8">
                    {r.exposure === 'internet' ? (
                      <>
                        <span
                          title="Derived from configuration. Parameter reads settings; it never sends traffic to your resources."
                          className={`shrink-0 rounded-md border px-1.5 py-0.5 text-xs leading-4 font-medium ${STATUS_TONE.pending}`}
                        >
                          Derived
                        </span>
                        <span className="truncate text-muted">{evidenceFor(r).short}</span>
                      </>
                    ) : (
                      <span className="truncate text-subtle">Not directly reachable</span>
                    )}
                  </div>
                </div>
              </Fragment>
            )
          })}
        {isPathView && pathRows.length === 0 && (
          <p className="px-8 py-10 text-center text-sm text-subtle">
            {query ? 'No paths match this search.' : view === 'escalation' ? 'No escalation paths in scope.' : 'No expected access in scope.'}
          </p>
        )}
        {!isPathView && view !== 'all' && rows.length === 0 && (
          <p className="px-8 py-10 text-center text-sm text-subtle">
            {query
              ? 'No exposed resources match this search.'
              : view === 'reachable'
                ? 'Nothing in scope is reachable from the internet.'
                : 'No sensitive stores in scope.'}
          </p>
        )}
      </div>

      {detail && detailId && (
        <DetailPanel
          detail={detail}
          closing={closing}
          onClose={closeDetail}
          sent={sent[detailId]}
          onSent={(channels) => setSent((prev) => ({ ...prev, [detailId]: { channels, at: new Date() } }))}
          detected={resources.find((r) => r.id === detailId)?.risk ?? IDENTITY_PATHS.find((p) => p.id === detailId)?.risk ?? 'none'}
          onSeverity={(next) => {
            const before = severity[detailId]
            setSeverity((prev) => {
              const copy = { ...prev }
              if (next) copy[detailId] = next
              else delete copy[detailId]
              return copy
            })
            notify(next ? `Severity changed to ${SEVERITY_NAME[next]}` : 'Severity reset', () =>
              setSeverity((prev) => {
                const copy = { ...prev }
                if (before) copy[detailId] = before
                else delete copy[detailId]
                return copy
              }),
            )
          }}
        />
      )}
    </section>
  )
}
