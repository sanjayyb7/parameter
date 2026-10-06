import { Boxes, GitBranch, Globe, Lock, Plus, ShieldOff, X } from 'lucide-react'
import { useEffect } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  /** Closes this and opens the Connect a cloud modal. */
  onConnect: () => void
}

const STEPS = [
  {
    Icon: Lock,
    title: 'Connect read-only',
    body: 'Grant Parameter a read-only role. Google Cloud and AWS use keyless impersonation, so no long-lived keys are ever stored.',
  },
  {
    Icon: Boxes,
    title: 'Map your inventory',
    body: 'We list every resource and the access grants between them: who runs as whom, and who can impersonate whom.',
  },
  {
    Icon: Globe,
    title: 'Find what’s exposed',
    body: 'From configuration alone, we work out what the internet can reach and which stores hold credentials or data.',
  },
  {
    Icon: GitBranch,
    title: 'Trace attack paths',
    body: 'We chain those grants together to show how an attacker gets from the internet to what matters, and the one grant to remove.',
  },
]

const NEVER = ['Make changes to your cloud', 'Read secret values', 'Send traffic to your resources']

/** Same shell as Connect a cloud: header · numbered steps · reassurance · actions. */
export function HowItWorksModal({ open, onClose, onConnect }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[1px]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="how-title"
        onClick={(e) => e.stopPropagation()}
        className="modal-in w-[680px] max-w-[calc(100vw-48px)] rounded-2xl border border-line bg-white shadow-[0_24px_60px_rgba(0,0,0,0.15)]"
      >
        <div className="flex items-start justify-between border-b border-line px-7 py-6">
          <div>
            <h2 id="how-title" className="text-xl leading-7 font-semibold">
              How it works
            </h2>
            <p className="mt-1 text-sm leading-5 text-muted">From a read-only connection to the paths an attacker could take, in four steps.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-muted hover:bg-[#f3f3f3]">
            <X className="size-5" />
          </button>
        </div>

        <ol className="divide-y divide-line-soft">
          {STEPS.map(({ Icon, title, body }, i) => (
            <li key={title} className="flex items-start gap-4 px-7 py-5">
              <div className="relative flex size-12 shrink-0 items-center justify-center rounded-xl border border-line">
                <Icon className="size-5 text-ink" strokeWidth={1.75} />
                <span className="absolute -top-1.5 -left-1.5 flex size-5 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-white tabular-nums">
                  {i + 1}
                </span>
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="text-base leading-6 font-medium">{title}</div>
                <p className="mt-0.5 text-sm leading-5 text-subtle">{body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mx-7 mb-1 flex items-start gap-3 rounded-xl bg-[#f7f7f7] px-4 py-3.5">
          <ShieldOff className="mt-0.5 size-4 shrink-0 text-muted" />
          <div className="text-sm leading-5">
            <div className="font-medium text-ink">What Parameter never does</div>
            <div className="mt-0.5 text-subtle">{NEVER.join(' · ')}</div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 px-7 py-5">
          <button
            onClick={onClose}
            className="flex h-10 items-center rounded-lg border border-[#e0e0e0] bg-white px-4 text-sm font-medium text-[#525252] transition duration-150 ease-out hover:bg-[#fafafa] hover:text-ink active:scale-[0.97]"
          >
            Close
          </button>
          <button
            onClick={onConnect}
            className="flex h-10 items-center gap-1.5 rounded-lg bg-ink px-4 text-sm font-medium text-white shadow-sm transition duration-150 ease-out hover:bg-[#2a2a2a] active:scale-[0.97]"
          >
            <Plus className="size-4" />
            Connect cloud
          </button>
        </div>
      </div>
    </div>
  )
}
