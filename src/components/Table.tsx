import { ArrowDown, ArrowUp, ChevronsUpDown, Filter, List, Search, X } from 'lucide-react'
import { useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { EdgeJoint, FilletRadius, Joint } from './Fillet'

export interface Column {
  key: string
  label: string
  width?: number // px; omitted = flex-1
  sortable?: boolean
}

export type SortDir = 'asc' | 'desc'
export interface SortState {
  key: string
  dir: SortDir
}

/** Tooltip: the column's current order and what clicking will do next. */
function sortHint(label: string, dir: SortDir | null) {
  if (dir === 'asc') return `${label}: ascending · click for descending`
  if (dir === 'desc') return `${label}: descending · click to clear`
  return `${label}: not sorted · click to sort ascending`
}

/** Click cycle for a header: off → ascending → descending → off. */
export function nextSort(current: SortState | null, key: string): SortState | null {
  if (!current || current.key !== key) return { key, dir: 'asc' }
  return current.dir === 'asc' ? { key, dir: 'desc' } : null
}

/** Sort a copy of `rows` by the value `get` returns for the active column. */
export function sortRows<T>(rows: T[], sort: SortState | null, get: (row: T, key: string) => string | number) {
  if (!sort) return rows
  const sign = sort.dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const x = get(a, sort.key)
    const y = get(b, sort.key)
    return sign * (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true }))
  })
}

// Checkbox column: the box sits flush on the page's 32px left edge, followed by a 12px gap.
/** Checkboxes live in the left gutter (absolutely positioned), so they take no column width
 * and the toolbar, headings and row content all share one left edge. */
export const CHECK_COL = 0
/** Classes that place a row's checkbox in the 32px left gutter. Rows must be `relative`. */
export const GUTTER_CHECK = 'absolute top-1/2 left-2 flex -translate-y-1/2'

const GUTTER = 32

const MIN_COL = 80
const LAST_COL_MIN = 140

/**
 * Column widths that the user can drag to resize, remembered per table in localStorage.
 * Returns the columns with current widths plus a setter used by the header's drag handles.
 */
export function useResizableColumns(tableId: string, initial: Column[]) {
  const storageKey = `infra:columns:${tableId}`
  const [widths, setWidths] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? '{}')
    } catch {
      return {}
    }
  })
  const columns = initial.map((c) => (c.width && widths[c.key] ? { ...c, width: widths[c.key] } : c))
  const persist = useCallback(
    (next: Record<string, number>) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        /* storage unavailable: widths just won't persist */
      }
      return next
    },
    [storageKey],
  )
  const resize = useCallback((key: string, width: number) => setWidths((prev) => persist({ ...prev, [key]: Math.max(MIN_COL, Math.round(width)) })), [persist])
  const reset = useCallback(
    (key: string) =>
      setWidths((prev) => {
        const next = { ...prev }
        delete next[key]
        return persist(next)
      }),
    [persist],
  )
  return { columns, resize, reset }
}

/** Drag handle on a column's right edge. Double-click restores the default width. */
function ResizeHandle({ column, onResize, onReset }: { column: Column; onResize: (w: number) => void; onReset: () => void }) {
  const [active, setActive] = useState(false)
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${column.label} column`}
      title="Drag to resize · double-click to reset"
      onDoubleClick={onReset}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        e.preventDefault()
        const startX = e.clientX
        const startW = column.width ?? 0
        // Never squeeze the last (flexible) column below LAST_COL_MIN.
        const headers = e.currentTarget.closest('[role=row]')?.querySelectorAll('[role=columnheader]')
        const lastW = headers?.length ? headers[headers.length - 1].getBoundingClientRect().width : Infinity
        const maxW = startW + Math.max(0, lastW - LAST_COL_MIN)
        setActive(true)
        const move = (ev: PointerEvent) => onResize(Math.min(maxW, startW + ev.clientX - startX))
        const up = () => {
          setActive(false)
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', up)
          document.body.style.cursor = ''
          document.body.style.userSelect = ''
        }
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
      }}
      className="group/handle absolute top-0 -right-[5px] z-20 flex h-full w-[9px] cursor-col-resize justify-center"
    >
      <span className={`h-full w-[2px] rounded-full transition-colors ${active ? 'bg-ink' : 'bg-transparent group-hover/handle:bg-[#c9c9c9]'}`} />
    </div>
  )
}

export function colStyle(c: Column) {
  return c.width ? { width: c.width, flexShrink: 0 } : { flex: 1, minWidth: 0 }
}

/** Search / filter / group row (sorting lives in the column headers). `disabled` renders the faded empty-state version. */
/**
 * Toolbar row. Optional `left` content (e.g. category tabs) sits on the left; the actions
 * sit on the right — [primary action] · Filter · Group by · search · (i). Sorting is done from the column headers.
 */
export function Toolbar({
  placeholder,
  disabled,
  left,
  action,
  filter,
  info,
  value,
  onChange,
  lineAbove,
}: {
  placeholder: string
  /** (i) button explaining the tab; stays usable even in the faded empty state. */
  info?: ReactNode
  /** A 1px rule sits directly above (e.g. Exposure's environment strip): fillet its corner too. */
  lineAbove?: boolean
  /** Replaces the default Filter button, e.g. with an account filter. */
  filter?: ReactNode
  disabled?: boolean
  left?: ReactNode
  /** Primary action shown before Filter (e.g. Connect cloud). */
  action?: ReactNode
  value?: string
  onChange?: (value: string) => void
}) {
  const base = disabled
    ? 'border-[#f0f0f0] bg-[#fcfcfc] text-[#c2c2c2] cursor-not-allowed'
    : 'border-[#e0e0e0] bg-white text-[#525252] hover:bg-[#fafafa] hover:text-ink'
  return (
    <div className="relative flex items-center justify-between gap-4 border-b border-line py-3 pr-8 pl-8">
      <EdgeJoint edge="left" line="bottom" quads={['tr']} />
      {lineAbove && <Joint x={-0.5} y={-0.5} quads={['br']} />}
      <div className="flex min-w-0 items-center">{left}</div>
      <div className="flex shrink-0 items-center gap-2">
        {action}
        {filter && !disabled ? (
          filter
        ) : (
          <button
            disabled={disabled}
            className={`flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-[background-color,color,scale] duration-150 ease-out enabled:active:scale-[0.97] ${base}`}
          >
            <Filter className="size-3.5" />
            Filter
          </button>
        )}
        {[
          { label: 'Group by', Icon: List },
        ].map(({ label, Icon }) => (
          <button key={label} disabled={disabled} className={`flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium ${base}`}>
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
        <label className={`flex h-9 w-[260px] items-center gap-2 rounded-md border px-3 text-sm ${base}`}>
          {/* The search icon matches its placeholder; button icons share their label's colour. */}
          <Search className={`size-4 shrink-0 ${disabled ? '' : 'text-[#a3a3a3]'}`} />
          <input
            disabled={disabled}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            className="w-full bg-transparent outline-none placeholder:text-[#a3a3a3] disabled:cursor-not-allowed disabled:placeholder:text-current"
          />
        </label>
        {info}
      </div>
    </div>
  )
}

/**
 * Column header row, built like the reference: the row's background is the line colour and
 * each heading cell is a rounded tile sitting on it with a 1px gap. The gaps *are* the
 * divider and bottom rules, and each tile's rounded corners reveal the line colour, so the
 * fillets are part of the lines themselves and always touch them, at any zoom level.
 * Table content rows below keep plain square corners.
 */
/**
 * Row selection. Checkboxes stay hidden until a row (or the header) is hovered; once
 * anything is ticked, every checkbox stays visible until the selection is cleared.
 */
export interface Selection {
  count: number
  total: number
  active: boolean
  has: (id: string) => boolean
  toggle: (id: string) => void
  toggleAll: () => void
  /** Ids currently selected (and still visible). */
  ids: string[]
  clear: () => void
}

export function useSelection(ids: string[]): Selection {
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const live = ids.filter((id) => picked.has(id))
  return {
    count: live.length,
    total: ids.length,
    active: live.length > 0,
    has: (id) => picked.has(id),
    toggle: (id) =>
      setPicked((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      }),
    toggleAll: () => setPicked(live.length === ids.length ? new Set() : new Set(ids)),
    ids: live,
    clear: () => setPicked(new Set()),
  }
}

/**
 * Gmail-style selection bar: replaces the toolbar's left side while rows are selected.
 * "N selected" · actions · clear.
 */
export function BulkBar({ sel, children }: { sel: Selection; children: ReactNode }) {
  return (
    <div className="bulk-in flex h-9 items-center gap-1 rounded-lg bg-[#f4f4f4] p-1 text-[13px]">
      <span className="px-2 font-medium text-ink tabular-nums">{sel.count} selected</span>
      <span className="mx-0.5 h-4 w-px bg-[#e0e0e0]" />
      {children}
      <button onClick={sel.clear} title="Clear selection" aria-label="Clear selection" className="rounded-md p-1.5 text-muted hover:bg-white hover:text-ink">
        <X className="size-3.5" />
      </button>
    </div>
  )
}

export function BulkButton({ icon: Icon, label, onClick, danger }: { icon: typeof X; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex h-full items-center gap-1.5 rounded-md px-2.5 font-medium transition-[background-color,color,scale] duration-150 ease-out active:scale-[0.97] ${
        danger ? 'text-[#b42318] hover:bg-white' : 'text-[#404040] hover:bg-white hover:text-ink'
      }`}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  )
}

/** Undo toast for bulk deletes: bottom-centre, dismisses itself after a few seconds. */
export interface ToastState {
  id: number
  message: string
  undo?: () => void
}

export function UndoToast({ toast, onClose }: { toast: ToastState | null; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(onClose, 5000)
    return () => window.clearTimeout(t)
  }, [toast, onClose])
  if (!toast) return null
  return (
    <div
      key={toast.id}
      role="status"
      className="toast-in fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-xl bg-[#171717] py-2.5 pr-2.5 pl-4 text-sm text-white shadow-[0_12px_32px_rgba(0,0,0,0.25)]"
    >
      {toast.message}
      {toast.undo && (
        <button
          onClick={() => {
            toast.undo?.()
            onClose()
          }}
          className="rounded-md px-2.5 py-1 font-medium text-white transition-[background-color,scale] duration-150 ease-out hover:bg-white/15 active:scale-[0.97]"
        >
          Undo
        </button>
      )}
      <button onClick={onClose} aria-label="Dismiss" className="rounded-md p-1 text-white/60 hover:bg-white/10 hover:text-white">
        <X className="size-3.5" />
      </button>
    </div>
  )
}

/** Row checkbox class: hidden until the row is hovered, unless selection mode is on. */
export function rowCheckClass(sel: Selection) {
  return `m-0 size-4 cursor-pointer accent-ink transition-opacity ${sel.active ? '' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}`
}

export function HeaderRow({
  columns,
  faded,
  onResize,
  onResetWidth,
  sort,
  onSort,
  selection,
  firstIndent = 0,
  selectable = true,
}: {
  columns: Column[]
  faded?: boolean
  onResize?: (key: string, width: number) => void
  onResetWidth?: (key: string) => void
  sort?: SortState | null
  onSort?: (key: string) => void
  selection?: Selection
  /** Extra left padding on the first heading, when rows lead with a control (e.g. an expand arrow) before the content. */
  firstIndent?: number
  /** Show the select-all checkbox in the gutter (off for tables without row selection). */
  selectable?: boolean
}) {
  const r = useContext(FilletRadius)
  const last = columns.length - 1
  return (
    <div role="row" className={`flex h-11 shrink-0 gap-px bg-line pb-px text-[13px] leading-5 font-medium ${faded ? 'text-[#cfcfcf]' : 'text-muted'}`}>
      {columns.map((c, i) => {
        // Tiles end 1px early; the 1px gap that follows is the column divider.
        const sortable = !!(c.sortable && !faded && onSort)
        const active = sortable && sort?.key === c.key
        const width = c.width ? (i === 0 ? GUTTER + CHECK_COL : 0) + c.width - 1 : undefined
        return (
          <div
            key={c.key}
            role="columnheader"
            aria-sort={active ? (sort?.dir === 'asc' ? 'ascending' : 'descending') : sortable ? 'none' : undefined}
            onClick={sortable ? () => onSort?.(c.key) : undefined}
            title={sortable ? sortHint(c.label, active ? sort!.dir : null) : undefined}
            style={{ ...(width ? { width, flexShrink: 0 } : { flex: 1, minWidth: 0 }), borderRadius: r, ...(i === 0 && firstIndent ? { paddingLeft: GUTTER + firstIndent } : {}) }}
            className={`group/head relative flex h-full items-center justify-between ${faded ? 'bg-page' : 'bg-[#fafafa]'} ${
              i === 0 ? 'pr-3 pl-8' : 'px-3'
            } ${sortable ? 'cursor-pointer select-none hover:bg-[#f2f2f2] hover:text-ink' : ''} ${active ? 'text-ink' : ''}`}
          >
            <span className="flex min-w-0 items-center">
              {i === 0 && selectable && (
                <span className={GUTTER_CHECK}>
                  {faded ? (
                    <span className="size-4 rounded border border-[#ededed]" />
                  ) : (
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={!!selection && selection.count > 0 && selection.count === selection.total}
                      ref={(el) => {
                        if (el) el.indeterminate = !!selection && selection.count > 0 && selection.count < selection.total
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => selection?.toggleAll()}
                      className={`m-0 size-4 cursor-pointer accent-ink transition-opacity ${
                        selection?.active ? '' : 'opacity-0 group-hover/head:opacity-100 focus-visible:opacity-100'
                      }`}
                    />
                  )}
                </span>
              )}
              <span className="truncate">{c.label}</span>
            </span>
            {/* Icons only appear on hover: ↑ / ↓ shows the current order of a sorted column,
                a neutral chevron marks a column that isn't sorted yet. */}
            {sortable && (
              <span className="shrink-0 opacity-0 transition-opacity group-hover/head:opacity-100">
                {active ? (
                  sort?.dir === 'asc' ? (
                    <ArrowUp className="size-3.5" />
                  ) : (
                    <ArrowDown className="size-3.5" />
                  )
                ) : (
                  <ChevronsUpDown className="size-3.5 text-subtle" />
                )}
              </span>
            )}
            {!faded && onResize && c.width && i < last && (
              <ResizeHandle column={c} onResize={(w) => onResize(c.key, w)} onReset={() => onResetWidth?.(c.key)} />
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Faint placeholder rows that hint at where content will appear. */
export function SkeletonRows({ columns, count = 14 }: { columns: Column[]; count?: number }) {
  const widths = ['w-36', 'w-28', 'w-40', 'w-32']
  return (
    <div aria-hidden className="absolute inset-0 flex flex-col overflow-hidden opacity-70">
      {Array.from({ length: count }).map((_, r) => (
        <div key={r} className="relative flex h-[52px] shrink-0 items-center border-b border-line pl-8">
          <div className={GUTTER_CHECK}>
            <div className="size-4 rounded border border-[#ededed]" />
          </div>
          {columns.map((c, i) => (
            <div
              key={c.key}
              style={colStyle(c)}
              className={`flex h-full items-center gap-2 ${i === 0 ? 'pr-3' : 'px-3'} ${i < columns.length - 1 ? 'border-r border-line' : ''}`}
            >
              {i === 0 ? (
                <>
                  <div className={`h-2 rounded-full bg-[#efefef] ${widths[r % widths.length]}`} />
                  <div className="h-2 w-16 rounded-full bg-[#f5f5f5]" />
                </>
              ) : i % 2 ? (
                <div className="h-5 w-16 rounded-md bg-[#f4f4f4]" />
              ) : (
                <div className={`h-2 rounded-full bg-[#efefef] ${r % 2 ? 'w-20' : 'w-24'}`} />
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
