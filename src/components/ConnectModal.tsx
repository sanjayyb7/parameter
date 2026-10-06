import { Check, Lock, X } from 'lucide-react'
import { useEffect } from 'react'
import { PROVIDERS } from '../data/providers'
import type { ProviderId } from '../data/types'

interface Props {
  open: boolean
  onClose: () => void
  onConnect: (id: ProviderId) => void
  isConnected: (id: ProviderId) => boolean
}

export function ConnectModal({ open, onClose, onConnect, isConnected }: Props) {
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
        aria-labelledby="connect-title"
        onClick={(e) => e.stopPropagation()}
        className="modal-in w-[680px] max-w-[calc(100vw-48px)] rounded-2xl border border-line bg-white shadow-[0_24px_60px_rgba(0,0,0,0.15)]"
      >
        <div className="flex items-start justify-between border-b border-line px-7 py-6">
          <div>
            <h2 id="connect-title" className="text-xl leading-7 font-semibold">
              Connect a cloud
            </h2>
            <p className="mt-1 flex items-center gap-1.5 text-sm leading-5 text-muted">
              <Lock className="size-4" />
              Read-only access
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-muted hover:bg-[#f3f3f3]">
            <X className="size-5" />
          </button>
        </div>
        <ul className="divide-y divide-line-soft">
          {PROVIDERS.map(({ id, name, Icon, color, method, inventoryReady }) => {
            const connected = isConnected(id)
            return (
              <li key={id} className="flex items-center gap-4 px-7 py-5">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-line">
                  <Icon style={{ color }} className="size-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-base leading-6 font-medium">
                    {name}
                    {!inventoryReady && (
                      <span className="rounded-md bg-[#f4f4f4] px-2 py-0.5 text-xs leading-4 font-normal text-muted">Inventory soon</span>
                    )}
                  </div>
                  <div className="truncate text-sm leading-5 text-subtle">{method}</div>
                </div>
                {connected ? (
                  <span className="flex items-center gap-1.5 text-sm font-medium text-[#15803d]">
                    <Check className="size-4" />
                    Connected
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      onConnect(id)
                      onClose()
                    }}
                    className="h-10 shrink-0 rounded-lg bg-ink px-5 text-sm font-medium text-white hover:bg-[#2a2a2a]"
                  >
                    Connect
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
