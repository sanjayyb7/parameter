import { Check, Copy, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Right-hand detail panel shared by the tables: full height (16px inset), over a mild
 * dark blurred backdrop. Slides in from beyond the right edge and back out the same way;
 * the last content stays mounted while it leaves. Closes on the backdrop, the ×, or Esc.
 */
export function SidePanel({
  open,
  onClose,
  label,
  header,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  label: string
  header?: ReactNode
  children?: ReactNode
  footer?: ReactNode
}) {
  const [mounted, setMounted] = useState(open)
  const [closing, setClosing] = useState(false)
  // Keep what was shown so the panel can slide out with its content intact.
  const last = useRef({ header, children, footer })
  if (open) last.current = { header, children, footer }

  useEffect(() => {
    if (open) {
      setMounted(true)
      setClosing(false)
      return
    }
    if (!mounted) return
    setClosing(true)
    const t = window.setTimeout(() => {
      setMounted(false)
      setClosing(false)
    }, 220)
    return () => window.clearTimeout(t)
  }, [open, mounted])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!mounted) return null
  const { header: h, children: body, footer: f } = last.current
  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-[3px] ${
          closing ? 'animate-[fade-out_200ms_cubic-bezier(0.23,1,0.32,1)_forwards]' : 'animate-[fade-in_200ms_ease-out]'
        }`}
      />
      <aside
        aria-label={label}
        role="dialog"
        className={`fixed top-4 right-4 bottom-4 z-50 flex w-[460px] flex-col overflow-hidden rounded-xl border border-line bg-page shadow-[0_24px_64px_rgba(0,0,0,0.22)] ${
          closing ? 'animate-[panel-out_220ms_cubic-bezier(0.23,1,0.32,1)_forwards]' : 'animate-[panel-in_320ms_cubic-bezier(0.32,0.72,0,1)]'
        }`}
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-line px-5">
          <div className="flex min-w-0 items-center gap-2">{h}</div>
          <button onClick={onClose} aria-label="Close" title="Close (Esc)" className="rounded-md p-1.5 text-muted hover:bg-[#f0f0f0] hover:text-ink">
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
        {f && <div className="shrink-0 border-t border-line bg-page px-5 py-3">{f}</div>}
      </aside>
    </>
  )
}

/** Label · value row for detail lists (value wraps, never truncated). */
export function DetailRow({ label, value, mono, action }: { label: string; value: ReactNode; mono?: boolean; action?: ReactNode }) {
  return (
    <div className="grid grid-cols-[112px_1fr] gap-4 border-b border-line-soft px-4 py-2.5 last:border-b-0">
      <dt className="text-[13px] leading-5 text-muted">{label}</dt>
      <dd className="flex min-w-0 items-start gap-1">
        <span className={mono ? 'font-mono text-[12.5px] leading-5 [overflow-wrap:anywhere] text-ink' : 'text-[13px] leading-5 text-ink'}>{value}</span>
        {action}
      </dd>
    </div>
  )
}

/** Small copy button: copies the value and confirms with a tick. */
export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        void navigator.clipboard?.writeText(value)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1200)
      }}
      title="Copy"
      aria-label="Copy"
      className="-my-0.5 shrink-0 rounded p-1 text-subtle hover:bg-[#ededed] hover:text-ink"
    >
      {copied ? <Check className="size-3.5 text-[#15803d]" /> : <Copy className="size-3.5" />}
    </button>
  )
}
