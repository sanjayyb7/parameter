import { Check, ChevronDown, Filter } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ProviderId } from '../data/types'
import { ProviderIcon } from './Badges'

export interface AccountOption {
  id: string
  provider: ProviderId
  account: string
  count: number
}

/**
 * Filter button that scopes a view to one or more connected accounts. An empty selection
 * means "all accounts". With a single account connected there's nothing to narrow, so the
 * popover says so instead of offering a lone checkbox.
 */
export function AccountFilter({
  options,
  selected,
  onChange,
  align = 'right',
}: {
  options: AccountOption[]
  /** Which edge of the button the popover lines up with (left when the button sits at the left). */
  align?: 'left' | 'right'
  selected: Set<string>
  onChange: (next: Set<string>) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    // Capture phase: canvases like React Flow stop pointer events from bubbling.
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const active = options.filter((o) => selected.has(o.id))
  const label = active.length === 0 ? 'Filter' : active.length === 1 ? active[0].account : `${active.length} accounts`

  const toggle = (id: string) => {
    // No filter means every account is ticked, so start from all of them.
    const next = new Set(active.length ? selected : options.map((o) => o.id))
    if (next.has(id)) next.delete(id)
    else next.add(id)
    // Ticking every account is the same as no filter.
    onChange(next.size === options.length || next.size === 0 ? new Set() : next)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`flex h-9 max-w-[220px] items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-[background-color,border-color,color,scale] duration-150 ease-out active:scale-[0.97] ${
          active.length
            ? 'border-[#c9c9c9] bg-[#f4f4f4] text-ink hover:bg-[#ededed]'
            : 'border-[#e0e0e0] bg-white text-[#525252] hover:bg-[#fafafa] hover:text-ink'
        }`}
      >
        {active.length === 1 ? <ProviderIcon id={active[0].provider} size={14} /> : <Filter className="size-3.5 shrink-0" />}
        <span className="truncate">{label}</span>
        {active.length > 0 && <ChevronDown className="size-3.5 shrink-0 text-muted" />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Filter by account"
          className={`absolute top-full ${align === 'left' ? 'left-0 origin-top-left' : 'right-0 origin-top-right'} popover-in z-30 mt-1.5 w-72 overflow-hidden rounded-xl border border-line bg-white shadow-[0_12px_32px_rgba(0,0,0,0.12)]`}
        >
          <div className="flex h-10 items-center justify-between border-b border-line-soft px-3">
            <span className="text-xs leading-4 font-medium text-subtle">Accounts</span>
            {active.length > 0 && (
              <button onClick={() => onChange(new Set())} className="rounded px-1.5 py-0.5 text-xs leading-4 text-muted hover:bg-[#f4f4f4] hover:text-ink">
                Show all
              </button>
            )}
          </div>
          <ul className="p-1">
            {options.map((o) => {
              // With no filter every account is shown, so every row reads as ticked.
              const on = active.length === 0 || selected.has(o.id)
              return (
                <li key={o.id}>
                  <button
                    onClick={() => toggle(o.id)}
                    disabled={options.length < 2}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm leading-5 hover:bg-[#f6f6f6] disabled:hover:bg-transparent"
                  >
                    <span
                      className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                        on ? 'border-ink bg-ink text-white' : 'border-[#d4d4d4] bg-white'
                      }`}
                    >
                      {on && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    <ProviderIcon id={o.provider} />
                    <span className="min-w-0 flex-1 truncate text-ink">{o.account}</span>
                    <span className="text-xs leading-4 text-subtle tabular-nums">{o.count}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          {options.length < 2 && (
            <p className="border-t border-line-soft px-3 py-2.5 text-xs leading-4 text-subtle">Connect another cloud account to filter between them.</p>
          )}
        </div>
      )}
    </div>
  )
}
