import { AlertTriangle, HeartPulse, Globe, Loader2 } from 'lucide-react'
import { providerById } from '../data/providers'
import type { ConnectionStatus, Exposure, ProviderId, ResourceState, Risk } from '../data/types'

export function ProviderIcon({ id, size = 16 }: { id: ProviderId; size?: number }) {
  const { Icon, color, name } = providerById(id)
  return <Icon aria-label={name} style={{ color, width: size, height: size }} className="shrink-0" />
}

export function Pill({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs leading-4 font-medium ${className}`}>{children}</span>
}

export function TypePill({ children }: { children: React.ReactNode }) {
  return <Pill className="border border-[#e5e5e5] bg-[#fafafa] font-normal text-ink">{children}</Pill>
}

export function ExposurePill({ value }: { value: Exposure }) {
  return value === 'internet' ? (
    <Pill className="bg-[#fff1e6] text-[#c2410c]">
      <Globe className="size-3" />
      Internet-facing
    </Pill>
  ) : (
    <Pill className="bg-[#f4f4f4] font-normal text-muted">Private</Pill>
  )
}

const RISK: Record<Risk, [string, string] | null> = {
  critical: ['Critical', 'bg-[#fde8e8] text-[#b42318]'],
  high: ['High', 'bg-[#fff1e6] text-[#c2410c]'],
  medium: ['Medium', 'bg-[#fef7e0] text-[#a16207]'],
  low: ['Low', 'bg-[#f1f5f9] text-[#475569]'],
  sensitive: ['Sensitive', 'bg-[#eef2ff] text-[#4338ca]'],
  none: null,
}

export function RiskPill({ value }: { value: Risk }) {
  const r = RISK[value]
  return r ? <Pill className={r[1]}>{r[0]}</Pill> : <span className="text-[#a3a3a3]">—</span>
}

/** Status colours: light tint, thin matching border, coloured text. */
export const STATUS_TONE = {
  progress: 'border-[#c9d3fb] bg-[#eef1fd] text-[#2f3fa8]', // blue · In progress
  pending: 'border-[#fcd9bd] bg-[#fff3e8] text-[#c4620f]', // orange · Pending
  success: 'border-[#a7ecc8] bg-[#ebfbf3] text-[#0f7a4a]', // green · Delivered
  danger: 'border-[#f8c4c4] bg-[#fdeeee] text-[#c42b2b]', // red · Cancelled
} as const

function StatusBadge({ tone, children }: { tone: keyof typeof STATUS_TONE; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs leading-4 font-medium whitespace-nowrap ${STATUS_TONE[tone]}`}>
      {children}
    </span>
  )
}

export function StatusPill({ status, progress }: { status: ConnectionStatus; progress: number }) {
  if (status === 'syncing')
    // The pill is the progress bar: white inside a blue outline, filling with blue from the left.
    return (
      <span
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="relative inline-flex items-center overflow-hidden rounded-md border border-[#c9d3fb] bg-white px-2 py-0.5 text-xs leading-4 font-medium whitespace-nowrap text-[#2f3fa8]"
      >
        <span
          aria-hidden
          className="absolute inset-0 origin-left bg-[#dbe2fd] transition-transform duration-[450ms] ease-out"
          style={{ transform: `scaleX(${Math.min(progress, 100) / 100})` }}
        />
        <span className="relative flex items-center gap-1">
          <Loader2 className="size-3 animate-spin" />
          Syncing {Math.round(progress)}%
        </span>
      </span>
    )
  if (status === 'error')
    return (
      <StatusBadge tone="danger">
        <AlertTriangle className="size-3" />
        Sync failed
      </StatusBadge>
    )
  return (
    <StatusBadge tone="success">
      <HeartPulse className="size-3" />
      Healthy
    </StatusBadge>
  )
}

const STATE_TONE: Record<ResourceState, keyof typeof STATUS_TONE> = {
  RUNNING: 'success',
  ENABLED: 'success',
  DISABLED: 'danger',
  Unknown: 'pending',
}
const STATE_LABEL: Record<ResourceState, string> = { RUNNING: 'Running', ENABLED: 'Enabled', DISABLED: 'Disabled', Unknown: 'Unknown' }

/** Provider-reported resource state, as in the original Resources screen. */
export function StatePill({ value }: { value: ResourceState }) {
  return <StatusBadge tone={STATE_TONE[value]}>{STATE_LABEL[value]}</StatusBadge>
}
