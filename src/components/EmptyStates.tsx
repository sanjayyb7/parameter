import { BookOpen, Box, Lock, Plus } from 'lucide-react'
import { PROVIDERS } from '../data/providers'

/* Empty-state cloud: a solid ink cloud on its own. Static: no motion. */

function CloudMark() {
  return (
    <svg aria-hidden width="156" height="99" viewBox="0 0 120 76" fill="none" className="overflow-visible">
      <defs>
        <linearGradient id="cloud-ink" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#3d3d3d" />
          <stop offset="1" stopColor="#0f0f0f" />
        </linearGradient>
      </defs>
      <path
        d="M37.5 67.5a19.5 19.5 0 0 1-1.95-38.9A26 26 0 0 1 84.95 31.7 17.9 17.9 0 0 1 84.6 67.5H37.5Z"
        fill="url(#cloud-ink)"
        style={{ filter: 'drop-shadow(0 10px 14px rgba(0,0,0,0.18))' }}
      />
      <path d="M44 38a16 16 0 0 1 14-9" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function PrimaryButton({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex h-10 items-center gap-1.5 rounded-lg bg-ink px-4 text-sm font-medium text-white shadow-sm transition duration-150 ease-out hover:bg-[#2a2a2a] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      {children}
    </button>
  )
}

/** Connections tab, nothing connected: the one place we explain what Infrastructure does. */
/* Cloud placement: y shifts only the cloud (the text below stays put); gap is the space to the heading. */
const CLOUD = {
  y: 17, // px; positive moves the cloud down
  gap: 24, // px between cloud and heading
}

/* Provider logos scroll as a looping carousel with both edges faded; pauses on hover. */
const LOGOS = {
  offset: 26, // space above the logo row (px)
  gap: 33, // space between logos (px)
  size: 23, // logo size (px)
  opacity: 0.95,
  width: 264, // visible window (px)
  speed: 7, // seconds per full loop of the set
  fade: 24, // edge fade, % of the window on each side
}

export function NoCloudsEmpty({ onConnect, onHowItWorks }: { onConnect: () => void; onHowItWorks: () => void }) {
  const logos = LOGOS
  const cloud = CLOUD
  const setWidth = PROVIDERS.length * (logos.size + logos.gap)
  const copies = Math.ceil(logos.width / setWidth) + 1
  // Optical centre: a touch above the middle of the empty area.
  return (
    <div className="absolute top-[46%] left-1/2 flex w-[520px] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
      <div style={{ transform: `translateY(${cloud.y}px)` }}>
        <CloudMark />
      </div>
      <h2 className="text-lg font-semibold" style={{ marginTop: cloud.gap }}>
        No clouds connected yet
      </h2>
      <p className="mt-1.5 text-sm leading-6 text-muted">
        Connect a cloud account and Parameter will map every resource, what’s reachable from the internet, and the paths an attacker could take.
      </p>
      <div className="mt-6 flex items-center gap-2.5">
        <button
          onClick={onHowItWorks}
          className="flex h-10 items-center gap-1.5 rounded-lg border border-[#e0e0e0] bg-white px-4 text-sm font-medium shadow-sm transition duration-150 ease-out hover:bg-[#fafafa] active:scale-[0.97]"
        >
          <BookOpen className="size-4" />
          How it works
        </button>
        <PrimaryButton onClick={onConnect}>
          <Plus className="size-4" />
          Connect cloud
        </PrimaryButton>
      </div>
      {/* Reassurance sits right under the decision to connect. */}
      <p className="mt-3 flex items-center gap-1.5 text-[13px] leading-5 text-subtle">
        <Lock className="size-3.5" />
        Read-only access
      </p>
      {/* Logo carousel: one set is (size + gap) × logos wide; enough copies fill the window, and the
          track shifts by exactly one set per loop so the seam never shows. */}
      <div
        className="logo-marquee overflow-hidden"
        style={{
          marginTop: logos.offset,
          width: logos.width,
          maskImage: `linear-gradient(to right, transparent, #000 ${logos.fade}%, #000 ${100 - logos.fade}%, transparent)`,
          WebkitMaskImage: `linear-gradient(to right, transparent, #000 ${logos.fade}%, #000 ${100 - logos.fade}%, transparent)`,
        }}
      >
        <div className="logo-track flex w-max" style={{ animationDuration: `${logos.speed}s`, ['--set' as string]: `${setWidth}px` } as React.CSSProperties}>
          {Array.from({ length: copies }).map((_, copy) => (
            <div key={copy} aria-hidden={copy > 0} className="flex shrink-0 items-center" style={{ gap: logos.gap, paddingRight: logos.gap }}>
              {PROVIDERS.map(({ id, Icon, color, name }) => (
                <Icon
                  key={id}
                  title={copy === 0 ? name : undefined}
                  style={{ color, width: logos.size, height: logos.size, opacity: logos.opacity, flexShrink: 0 }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Resources tab with no data: sits over the skeleton rows. */
export function NoResourcesEmpty({ syncing, onConnect }: { syncing: boolean; onConnect: () => void }) {
  return (
    <div className="absolute top-[46%] left-1/2 flex w-[560px] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
      <div className="flex size-11 items-center justify-center rounded-xl border border-line bg-white shadow-[0_2px_6px_rgba(0,0,0,0.06)]">
        <Box className="size-5 text-[#404040]" />
      </div>
      <h2 className="mt-4 text-base font-semibold">{syncing ? 'Discovering resources…' : 'No resources here, yet'}</h2>
      <p className="mt-1 text-sm text-subtle">
        {syncing
          ? 'Your first sync is running. Resources will stream in as they’re found.'
          : 'Your resources will appear here once a connected cloud finishes syncing.'}
      </p>
      {!syncing && (
        <div className="mt-5">
          <PrimaryButton onClick={onConnect}>
            <Plus className="size-4" />
            Connect cloud
          </PrimaryButton>
        </div>
      )}
    </div>
  )
}
