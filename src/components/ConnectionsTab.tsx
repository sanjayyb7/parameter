import { AlertTriangle, Check, ChevronRight, Copy, Plus, RefreshCw, Unplug } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import { providerById } from '../data/providers'
import type { Connection } from '../data/types'
import { ProviderIcon, StatusPill } from './Badges'
import { NoCloudsEmpty } from './EmptyStates'
import { InfoButton, TAB_INFO } from './InfoButton'
import { PatternBackground } from './PatternBackground'
import { colStyle, HeaderRow, nextSort, sortRows, useResizableColumns, Toolbar, type Column, type SortState } from './Table'

const DEFAULT_COLUMNS: Column[] = [
  { key: 'account', label: 'Account', width: 300, sortable: true },
  { key: 'provider', label: 'Provider', width: 160 },
  { key: 'status', label: 'Status', width: 150, sortable: true },
  { key: 'resources', label: 'Resources', width: 130, sortable: true },
  { key: 'sync', label: 'Last sync', width: 150 },
  { key: 'by', label: 'Connected by' },
]

// Sorting by Status puts failures first, then syncing, then healthy.
const STATUS_ORDER = { error: 0, syncing: 1, healthy: 2 } as const

interface Props {
  connections: Connection[]
  onConnect: () => void
  onRetry: (id: string) => void
  onDisconnect: (id: string) => void
  onHowItWorks: () => void
}

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        void navigator.clipboard?.writeText(value)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1200)
      }}
      title="Copy"
      className="rounded p-1 text-subtle hover:bg-[#ededed] hover:text-ink"
    >
      {copied ? <Check className="size-3.5 text-[#15803d]" /> : <Copy className="size-3.5" />}
    </button>
  )
}

/** One row of the details list: label column, full value (wraps, never truncated), optional copy button. */
function Fact({ label, value, mono, copy }: { label: string; value: React.ReactNode; mono?: boolean; copy?: string }) {
  return (
    <div className="group/fact grid grid-cols-[136px_1fr] gap-4 border-b border-line-soft px-4 py-2.5 last:border-b-0">
      <dt className="text-[13px] leading-5 text-muted">{label}</dt>
      <dd className="flex min-w-0 items-start gap-1">
        <span className={mono ? 'font-mono text-[12.5px] leading-5 [overflow-wrap:anywhere] text-ink' : 'text-[13px] leading-5 text-ink'}>{value}</span>
        {copy && (
          <span className="-my-0.5">
            <CopyValue value={copy} />
          </span>
        )}
      </dd>
    </div>
  )
}

/**
 * Expanded row: one vertical list spanning the table width (label · full value), with the
 * actions in its footer. Any sync error leads.
 */
function ConnectionDetails({ c, onRetry, onDisconnect }: { c: Connection; onRetry: () => void; onDisconnect: () => void }) {
  const provider = providerById(c.provider)
  // The first two details are the account's own identifiers (copyable); the rest are Parameter's runtimes.
  const identifiers = c.details.slice(0, 2)
  const runtimes = c.details.slice(2)
  return (
    <div className="border-b border-line-soft bg-[#fafafa] px-8 py-4">
      <div>
        {c.error && (
          <div className="mb-3 flex items-start justify-between gap-4 rounded-lg border border-[#f5d0cd] bg-[#fff6f5] px-4 py-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#b42318]" />
              <div>
                <div className="text-sm font-medium text-[#b42318]">{c.error.title}</div>
                <div className="mt-0.5 text-[13px] text-muted">{c.error.hint}</div>
              </div>
            </div>
            <button
              onClick={onRetry}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-ink px-3 text-[13px] font-medium text-white transition duration-150 ease-out hover:bg-[#2a2a2a] active:scale-[0.97]"
            >
              <RefreshCw className="size-3.5" />
              Retry sync
            </button>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <dl>
            {identifiers.map(([label, value]) => (
              <Fact key={label} label={label} value={value} mono copy={value} />
            ))}
            <Fact label="Access" value={`${provider.method} · read-only`} />
            {runtimes.map(([label, value]) => (
              <Fact key={label} label={label} value={value} mono />
            ))}
            {c.status === 'healthy' && (
              <>
                <Fact label="Inventory" value={`${c.resourceCount} resources · ${c.relationships} relationships`} />
                <Fact label="Last sync" value={c.lastSync} />
              </>
            )}
          </dl>
          <div className="flex items-center gap-1 border-t border-line bg-[#fcfcfc] px-1.5 py-1.5">
            <button
              onClick={onRetry}
              disabled={c.status === 'syncing'}
              className="flex h-8 items-center gap-1.5 rounded-md border border-transparent px-2.5 text-[13px] text-muted transition-colors hover:border-line hover:bg-white hover:text-ink disabled:opacity-40"
            >
              <RefreshCw className="size-3.5" />
              Sync now
            </button>
            <button
              onClick={onDisconnect}
              className="flex h-8 items-center gap-1.5 rounded-md border border-transparent px-2.5 text-[13px] text-muted transition-colors hover:border-[#f5d0cd] hover:bg-[#fff6f5] hover:text-[#b42318]"
            >
              <Unplug className="size-3.5" />
              Disconnect
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ConnectionsTab({ connections, onConnect, onRetry, onDisconnect, onHowItWorks }: Props) {
  const { columns: COLUMNS, resize, reset } = useResizableColumns('connections', DEFAULT_COLUMNS)
  const empty = connections.length === 0
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [sort, setSort] = useState<SortState | null>(null)
  const rows = useMemo(
    () =>
      sortRows(connections, sort, (c, key) =>
        key === 'account' ? c.account : key === 'status' ? STATUS_ORDER[c.status] : key === 'resources' ? c.resourceCount : c.account,
      ),
    [connections, sort],
  )
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <section className="relative flex min-h-0 flex-1 flex-col" aria-label="Connections">
      <Toolbar
        placeholder="Search connections"
        disabled={empty}
        info={<InfoButton {...TAB_INFO.connections} />}
        action={
          empty ? undefined : (
            <button
              onClick={onConnect}
              className="flex h-9 items-center gap-1.5 rounded-md bg-ink px-3.5 text-sm font-medium text-white shadow-sm transition duration-150 ease-out hover:bg-[#2a2a2a] active:scale-[0.97]"
            >
              <Plus className="size-4" />
              Connect cloud
            </button>
          )
        }
      />
      <HeaderRow
        columns={COLUMNS}
        // No row checkboxes here: the left gutter holds the hover-only expand arrow instead.
        selectable={false}
        faded={empty}
        onResize={resize}
        onResetWidth={reset}
        sort={sort}
        onSort={(key) => setSort((cur) => nextSort(cur, key))}
      />
      {empty ? (
        <div className="relative flex-1 overflow-hidden">
          <PatternBackground />
          <NoCloudsEmpty onConnect={onConnect} onHowItWorks={onHowItWorks} />
        </div>
      ) : (
        <div role="rowgroup" className="flex-1 overflow-auto">
          {rows.map((c) => {
            // Failed connections open automatically so the cause and Retry are visible.
            const expanded = open.has(c.id) !== (c.status === 'error')
            return (
              <Fragment key={c.id}>
                <div
                  role="row"
                  aria-expanded={expanded}
                  onClick={() => toggle(c.id)}
                  className="group relative flex h-[58px] cursor-pointer items-center border-b border-line-soft pl-8 text-sm leading-5 hover:bg-[#f2f2f2]"
                >
                  {/* Expand arrow sits in the left gutter: shown on hover (and while open), so the logo and
                      the Account heading share the table's left edge. */}
                  <ChevronRight
                    aria-hidden
                    className={`absolute top-1/2 left-2.5 size-4 -translate-y-1/2 transition-[opacity,rotate] duration-200 ease-out group-hover:opacity-100 ${
                      expanded ? 'rotate-90 text-ink opacity-100' : 'text-subtle opacity-0'
                    }`}
                  />
                  <div style={colStyle(COLUMNS[0])} className="flex h-full items-center gap-3 border-r border-line-soft pr-3">
                    <ProviderIcon id={c.provider} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate leading-5 font-medium">{c.account}</div>
                      <div className="truncate text-xs leading-4 text-subtle">
                        {c.details.find(([, v]) => v !== c.account)?.[1] ?? providerById(c.provider).method}
                      </div>
                    </div>
                  </div>
                  <div style={colStyle(COLUMNS[1])} className="flex h-full items-center border-r border-line-soft px-3 text-[#404040]">
                    {providerById(c.provider).name}
                  </div>
                  <div style={colStyle(COLUMNS[2])} className="flex h-full flex-col items-start justify-center gap-1 border-r border-line-soft px-3">
                    <StatusPill status={c.status} progress={c.progress} />
                  </div>
                  <div style={colStyle(COLUMNS[3])} className="flex h-full flex-col justify-center border-r border-line-soft px-3 tabular-nums">
                    {c.status === 'healthy' ? (
                      <>
                        <span>{c.resourceCount}</span>
                        <span className="text-xs leading-4 text-subtle">{c.relationships} relationships</span>
                      </>
                    ) : (
                      <span className="text-subtle">—</span>
                    )}
                  </div>
                  <div
                    style={colStyle(COLUMNS[4])}
                    className={`flex h-full items-center border-r border-line-soft px-3 text-sm leading-5 ${c.status === 'error' ? 'text-[#b42318]' : 'text-muted'}`}
                  >
                    {c.lastSync}
                  </div>
                  <div style={colStyle(COLUMNS[5])} className="flex h-full min-w-0 items-center justify-between gap-2 px-3 pr-8 text-sm leading-5 text-muted">
                    <span className="truncate">{c.connectedBy}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onRetry(c.id)
                      }}
                      title="Sync now"
                      disabled={c.status === 'syncing'}
                      className="rounded p-1.5 opacity-0 transition group-hover:opacity-100 hover:bg-[#ededed] disabled:opacity-0"
                    >
                      <RefreshCw className="size-3.5" />
                    </button>
                  </div>
                </div>
                {expanded && <ConnectionDetails c={c} onRetry={() => onRetry(c.id)} onDisconnect={() => onDisconnect(c.id)} />}
              </Fragment>
            )
          })}
        </div>
      )}
    </section>
  )
}
