import { ArrowRight, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Category, Resource } from '../data/types'
import { ExposurePill, ProviderIcon, RiskPill, StatePill, TypePill } from './Badges'
import { NoResourcesEmpty } from './EmptyStates'
import { InfoButton, TAB_INFO } from './InfoButton'
import { CopyButton, DetailRow, SidePanel } from './SidePanel'
import { evidenceFor } from '../data/exposure'
import {
  BulkBar,
  BulkButton,
  colStyle,
  GUTTER_CHECK,
  HeaderRow,
  nextSort,
  sortRows,
  useResizableColumns,
  useSelection,
  rowCheckClass,
  SkeletonRows,
  Toolbar,
  type Column,
  type SortState,
} from './Table'

// Columns follow the original Resources screen: Resource · Type · Project · Location · State · Last seen.
const DEFAULT_COLUMNS: Column[] = [
  { key: 'resource', label: 'Resource', width: 380, sortable: true },
  { key: 'type', label: 'Type', width: 150, sortable: true },
  { key: 'project', label: 'Project', width: 200, sortable: true },
  { key: 'location', label: 'Location', width: 190, sortable: true },
  { key: 'state', label: 'State', width: 120, sortable: true },
  { key: 'seen', label: 'Last seen' },
]

const CATEGORIES: { id: 'all' | Category; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'workloads', label: 'Workloads' },
  { id: 'network', label: 'Network' },
  { id: 'identity', label: 'Identity' },
  { id: 'secrets', label: 'Secrets' },
  { id: 'projects', label: 'Projects' },
]

const PAGE_SIZE = 20

interface Props {
  resources: Resource[]
  syncing: boolean
  onConnect: () => void
  /** Account filter for the toolbar. */
  filter?: React.ReactNode
  onDeleteMany: (ids: string[]) => void
}

export function ResourcesTab({ resources, syncing, onConnect, filter, onDeleteMany }: Props) {
  const { columns: COLUMNS, resize, reset } = useResizableColumns('resources', DEFAULT_COLUMNS)
  const [category, setCategory] = useState<'all' | Category>('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  // Direction of the last page turn, so rows slide in from the side you're heading to.
  const [pageDir, setPageDir] = useState<1 | -1>(1)
  // Row details open in the side panel (the full path lives there, not in the row).
  const [detailId, setDetailId] = useState<string | null>(null)
  const detail = resources.find((r) => r.id === detailId) ?? null
  const [sort, setSort] = useState<SortState | null>(null)
  const empty = resources.length === 0

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: resources.length }
    resources.forEach((r) => (c[r.category] = (c[r.category] ?? 0) + 1))
    return c
  }, [resources])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = resources.filter(
      (r) =>
        (category === 'all' || r.category === category) && (!q || [r.name, r.path, r.type, r.location, r.project].some((v) => v.toLowerCase().includes(q))),
    )
    return sortRows(filtered, sort, (r, key) =>
      key === 'resource'
        ? r.name
        : key === 'type'
          ? r.type
          : key === 'project'
            ? r.project
            : key === 'location'
              ? r.location
              : key === 'state'
                ? r.state
                : r.lastSeen,
    )
  }, [resources, category, query, sort])

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const visible = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)
  const sel = useSelection(visible.map((r) => r.id))

  const categoryTabs = (
    <div className="flex h-9 items-center gap-1 rounded-lg bg-[#f4f4f4] p-1 text-[13px]">
      {CATEGORIES.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => {
            setCategory(id)
            setPage(0)
          }}
          className={`flex h-full items-center gap-1.5 rounded-md px-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ink/15 ${category === id ? 'bg-white font-medium' : 'text-muted hover:text-ink'}`}
        >
          {label}
          <span className="text-xs text-subtle tabular-nums">{counts[id] ?? 0}</span>
        </button>
      ))}
    </div>
  )

  return (
    <section className="relative flex min-h-0 flex-1 flex-col" aria-label="Resources">
      <Toolbar
        placeholder="Search name, ID, or type"
        disabled={empty}
        value={query}
        onChange={(v) => {
          setQuery(v)
          setPage(0)
        }}
        left={
          empty ? undefined : sel.active ? (
            <BulkBar sel={sel}>
              <BulkButton
                icon={Trash2}
                label="Delete"
                danger
                onClick={() => {
                  onDeleteMany(sel.ids)
                  sel.clear()
                }}
              />
            </BulkBar>
          ) : (
            categoryTabs
          )
        }
        filter={filter}
        info={<InfoButton {...TAB_INFO.resources} />}
      />
      <HeaderRow
        columns={COLUMNS}
        selection={sel}
        faded={empty}
        onResize={resize}
        onResetWidth={reset}
        sort={sort}
        onSort={(key) => {
          setSort((cur) => nextSort(cur, key))
          setPage(0)
        }}
      />
      {empty ? (
        <div className="relative flex-1 overflow-hidden">
          <SkeletonRows columns={COLUMNS} />
          <NoResourcesEmpty syncing={syncing} onConnect={onConnect} />
        </div>
      ) : (
        <>
          <div role="rowgroup" key={current} className="page-in flex-1 overflow-auto" style={{ ['--dir' as string]: pageDir }}>
            {visible.map((r) => (
              <div
                key={r.id}
                role="row"
                aria-selected={detailId === r.id}
                onClick={() => setDetailId(r.id)}
                className={`group relative flex h-[52px] cursor-pointer items-center border-b border-line-soft pl-8 text-sm leading-5 hover:bg-[#f2f2f2] ${
                  detailId === r.id ? 'bg-[#f2f2f2]' : ''
                }`}
              >
                {/* Open sits at the row's right end on hover; the last column fades underneath. */}
                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center bg-gradient-to-r from-transparent via-[#f2f2f2] via-35% to-[#f2f2f2] pr-6 pl-16 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setDetailId(r.id)
                    }}
                    className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-[#e0e0e0] bg-white px-2.5 text-xs font-medium shadow-sm transition-[background-color,scale] duration-150 ease-out hover:bg-[#fafafa] active:scale-[0.97]"
                  >
                    Open
                    <ArrowRight className="size-3" />
                  </button>
                </div>
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
                    <div className="min-w-0 flex-1 truncate leading-5 font-medium" title={r.name}>
                      {r.name}
                    </div>
                  </div>
                </div>
                <div style={colStyle(COLUMNS[1])} className="flex h-full items-center border-r border-line-soft px-3">
                  <TypePill>{r.type}</TypePill>
                </div>
                <div style={colStyle(COLUMNS[2])} className="flex h-full items-center border-r border-line-soft px-3 text-[#404040]">
                  <span className="truncate">{r.project}</span>
                </div>
                <div style={colStyle(COLUMNS[3])} className="flex h-full items-center border-r border-line-soft px-3 text-[#404040]">
                  <span className="truncate">{r.location}</span>
                </div>
                <div style={colStyle(COLUMNS[4])} className="flex h-full items-center border-r border-line-soft px-3">
                  <StatePill value={r.state} />
                </div>
                <div style={colStyle(COLUMNS[5])} className="flex h-full items-center px-3 text-sm leading-5 text-muted">
                  {r.lastSeen}
                </div>
              </div>
            ))}
            {rows.length === 0 && <p className="px-8 py-10 text-center text-sm text-subtle">No resources match this filter.</p>}
          </div>
          <div className="flex items-center justify-between border-t border-line py-3 pr-8 pl-8 text-[13px] text-muted">
            <span className="tabular-nums">
              {rows.length === 0 ? 0 : current * PAGE_SIZE + 1}–{Math.min((current + 1) * PAGE_SIZE, rows.length)} of {rows.length} resources
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={current === 0}
                onClick={() => {
                  setPageDir(-1)
                  setPage(current - 1)
                }}
                className="flex h-8 items-center gap-1 rounded-md border border-[#e0e0e0] bg-white px-2.5 font-medium text-ink disabled:border-line disabled:text-faint"
              >
                <ChevronLeft className="size-3.5" />
                Previous
              </button>
              <button
                disabled={current >= pages - 1}
                onClick={() => {
                  setPageDir(1)
                  setPage(current + 1)
                }}
                className="flex h-8 items-center gap-1 rounded-md border border-[#e0e0e0] bg-white px-2.5 font-medium text-ink disabled:border-line disabled:text-faint"
              >
                Next
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        </>
      )}

      <SidePanel
        open={!!detail}
        onClose={() => setDetailId(null)}
        label="Resource details"
        header={
          detail && (
            <>
              <TypePill>{detail.type}</TypePill>
              <StatePill value={detail.state} />
            </>
          )
        }
      >
        {detail && <ResourceDetails r={detail} />}
      </SidePanel>
    </section>
  )
}

const CATEGORY_LABEL: Record<Category, string> = {
  workloads: 'Workload',
  network: 'Network',
  identity: 'Identity',
  secrets: 'Secret',
  projects: 'Project',
}

/** Side-panel body: name, why it's reachable (if it is), then every field incl. the full path. */
function ResourceDetails({ r }: { r: Resource }) {
  const reachable = r.exposure === 'internet'
  return (
    <div className="space-y-4 px-5 py-4">
      <header>
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5">
            <ProviderIcon id={r.provider} size={18} />
          </span>
          <h2 className="text-[15px] leading-6 font-semibold [overflow-wrap:anywhere] text-ink">{r.name}</h2>
        </div>
        <div className="mt-1 pl-[28px] text-[13px] leading-5 text-subtle">
          {r.project} · {r.location}
        </div>
      </header>

      {reachable && (
        <div className="rounded-lg border border-[#fcd9bd] bg-[#fff8f1] px-3.5 py-3">
          <div className="text-[13px] leading-5 font-medium text-[#c4620f]">Internet reachable</div>
          <p className="mt-0.5 text-[13px] leading-5 text-[#404040]">{evidenceFor(r).reason}</p>
        </div>
      )}

      <dl className="overflow-hidden rounded-xl border border-line bg-white">
        <DetailRow label="Path" value={r.path} mono action={<CopyButton value={r.path} />} />
        <DetailRow label="Type" value={r.type} />
        <DetailRow label="Category" value={CATEGORY_LABEL[r.category]} />
        <DetailRow label="Project" value={r.project} />
        <DetailRow label="Location" value={r.location} />
        <DetailRow label="State" value={<StatePill value={r.state} />} />
        <DetailRow label="Exposure" value={<ExposurePill value={r.exposure} />} />
        <DetailRow label="Severity" value={<RiskPill value={r.risk} />} />
        <DetailRow label="Last seen" value={r.lastSeen} />
      </dl>
    </div>
  )
}
