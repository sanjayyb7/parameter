import { Loader2, Plus } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'
import type { TabId } from '../data/types'
import { EdgeJoint } from './Fillet'

export interface TabDef {
  id: TabId
  label: string
  count: number
  disabled?: boolean
  loading?: boolean
  alert?: boolean
}

interface Props {
  tabs: TabDef[]
  active: TabId
  onChange: (id: TabId) => void
  onConnect?: () => void
}

/* ─────────────────────────────────────────────────────────
 * TAB SWITCH
 *
 *   The 2px indicator lives INSIDE the active tab, stretched to its
 *   edges, and each tab is exactly as wide as its label + count. So
 *   the line is always exactly as wide as the text above it, by
 *   construction: nothing is measured, nothing can go stale.
 *
 *   The slide is a FLIP: on change, the new indicator starts drawn
 *   over the old tab (translate + scaleX), then transitions to rest.
 *   Each label reserves its bold width, so switching never shifts
 *   its neighbours.
 * ───────────────────────────────────────────────────────── */
const INDICATOR = { duration: 220, ease: 'cubic-bezier(0.77, 0, 0.175, 1)' }

export function Tabs({ tabs, active, onChange, onConnect }: Props) {
  const barRef = useRef<HTMLSpanElement>(null)
  const prevRect = useRef<DOMRect | null>(null)

  useLayoutEffect(() => {
    const bar = barRef.current
    if (!bar) return
    const next = bar.getBoundingClientRect()
    const prev = prevRect.current
    prevRect.current = next
    if (!prev || !next.width || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // Invert: draw the new indicator where the old one was…
    bar.style.transition = 'none'
    bar.style.transform = `translateX(${prev.left - next.left}px) scaleX(${prev.width / next.width})`
    void bar.offsetWidth
    // …then play to its resting place under the new tab.
    bar.style.transition = `transform ${INDICATOR.duration}ms ${INDICATOR.ease}`
    bar.style.transform = ''
  }, [active])

  return (
    <div className="relative flex items-end gap-6 border-b border-line pt-4 pr-8 pl-8" role="tablist">
      <EdgeJoint edge="left" line="bottom" quads={['tr', 'br']} />
      {tabs.map((t) => {
        const isActive = t.id === active
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            disabled={t.disabled}
            onClick={() => onChange(t.id)}
            className={`relative -mb-px flex shrink-0 items-center gap-2 rounded-sm pb-3.5 text-sm whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ink/15 ${
              isActive ? 'text-ink' : t.disabled ? 'cursor-not-allowed text-faint' : 'text-muted hover:text-ink'
            }`}
          >
            {/* The hidden bold copy reserves the active width, so the label never shifts. */}
            <span className="grid">
              <span className={`col-start-1 row-start-1 ${isActive ? 'font-medium' : ''}`}>{t.label}</span>
              <span aria-hidden className="invisible col-start-1 row-start-1 font-medium">
                {t.label}
              </span>
            </span>
            {t.loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <span
                className={`overflow-hidden rounded border px-1.5 text-xs tabular-nums ${
                  t.disabled ? 'border-[#f0f0f0] text-[#cfcfcf]' : 'border-[#e5e5e5] text-muted'
                }`}
              >
                {/* Keyed by value: a new count ticks in when a sync lands. */}
                <span key={t.count} className="count-tick block">
                  {t.count}
                </span>
              </span>
            )}
            {t.alert && <span className="size-1.5 rounded-full bg-[#dc2626]" />}
            {/* Indicator: spans exactly this tab's content (the button has no side padding). */}
            {isActive && <span ref={barRef} aria-hidden className="pointer-events-none absolute right-0 bottom-0 left-0 h-0.5 origin-left bg-ink" />}
          </button>
        )
      })}

      {onConnect && (
        <button
          onClick={onConnect}
          className="mb-2 ml-auto flex h-8 items-center gap-1.5 rounded-md border border-[#e0e0e0] bg-white px-3 text-[13px] font-medium whitespace-nowrap transition-[background-color,scale] duration-150 ease-out hover:bg-[#fafafa] active:scale-[0.97]"
        >
          <Plus className="size-3.5" />
          Connect cloud
        </button>
      )}
    </div>
  )
}
