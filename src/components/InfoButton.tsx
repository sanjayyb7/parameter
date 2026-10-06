import { Info } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

/** One sentence per tab, shown from the (i) button next to Filter. */
export const TAB_INFO = {
  connections: {
    title: 'Connections',
    body: 'The cloud accounts Parameter reads from, each with read-only access, and whether its inventory is syncing.',
  },
  resources: {
    title: 'Resources',
    body: 'Every resource Parameter found across your connected accounts, from workloads and networks to identities and secrets.',
  },
  exposure: {
    title: 'Exposure',
    body: 'What the internet can reach, which identities can escalate, and where credentials live, worked out from configuration alone.',
  },
  'attack-paths': {
    title: 'Attack paths',
    body: 'Step-by-step routes an attacker could take from the internet to your most sensitive identities, and the one grant that breaks each.',
  },
} as const

/**
 * Small (i) button that opens a one-sentence explainer. The popover scales in from its
 * trigger's corner, and closes on outside click or Esc.
 */
export function InfoButton({ title, body, size = 'md' }: { title: string; body: string; size?: 'md' | 'sm' }) {
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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`About ${title}`}
        title={`About ${title}`}
        className={
          size === 'md'
            ? `flex size-9 items-center justify-center rounded-md border text-[#525252] transition-[background-color,color,scale] duration-150 ease-out outline-none hover:bg-[#fafafa] hover:text-ink focus-visible:ring-2 focus-visible:ring-ink/15 active:scale-[0.97] ${
                open ? 'border-[#c9c9c9] bg-[#f4f4f4] text-ink' : 'border-[#e0e0e0] bg-white'
              }`
            : `rounded-md p-1.5 text-muted outline-none hover:bg-[#f0f0f0] hover:text-ink focus-visible:ring-2 focus-visible:ring-ink/15 ${open ? 'bg-[#f0f0f0] text-ink' : ''}`
        }
      >
        <Info className={size === 'md' ? 'size-4' : 'size-4'} />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={`About ${title}`}
          className="popover-in absolute top-full right-0 z-30 mt-1.5 w-72 origin-top-right rounded-xl border border-line bg-white p-3.5 text-left shadow-[0_12px_32px_rgba(0,0,0,0.12)]"
        >
          <div className="text-[13px] leading-5 font-medium text-ink">{title}</div>
          <p className="mt-1 text-[13px] leading-5 text-muted">{body}</p>
        </div>
      )}
    </div>
  )
}
