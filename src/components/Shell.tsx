import {
  Aperture,
  BookOpen,
  Box,
  ChevronDown,
  ChevronRight,
  Clock,
  Database,
  FileText,
  Home,
  Inbox,
  KeyRound,
  Layers,
  Navigation,
  Package,
  PanelLeft,
  Search,
  Settings,
  Share2,
  Sun,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { EdgeJoint } from './Fillet'

export type PageId = 'overview' | 'infrastructure'

const NAV: { label: string; Icon: typeof Home; page?: PageId }[] = [
  { label: 'Home', Icon: Home, page: 'overview' },
  { label: 'Lens Agent', Icon: Navigation },
  { label: 'Penetration Tests', Icon: Box },
  { label: 'Autopilot', Icon: Clock },
  { label: 'Findings', Icon: Layers },
  { label: 'Sentinel', Icon: Aperture },
  { label: 'Secret Scanning', Icon: KeyRound },
  { label: 'Dependencies', Icon: Package },
  { label: 'Infrastructure', Icon: Share2, page: 'infrastructure' },
  { label: 'Knowledge', Icon: Database },
  { label: 'Integrations', Icon: BookOpen },
]

function NavItem({ label, Icon, active, onClick }: { label: string; Icon: typeof Home; active?: boolean; onClick?: () => void }) {
  return (
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault()
        onClick?.()
      }}
      aria-current={active ? 'page' : undefined}
      className={`flex h-9 items-center gap-3 rounded-md px-3 text-[15px] leading-5 transition-colors ${
        active ? 'bg-[#ededed] font-medium text-ink' : 'text-[#404040] hover:bg-[#f3f3f3]'
      }`}
    >
      <Icon className={`size-[18px] shrink-0 ${active ? 'text-ink' : 'text-muted'}`} strokeWidth={1.75} />
      {label}
    </a>
  )
}

export function Sidebar({ active, onNavigate }: { active: PageId; onNavigate: (p: PageId) => void }) {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-page">
      <div className="flex h-14 items-center justify-between border-b border-line px-4">
        <div className="flex items-center gap-2">
          <div className="size-5 rounded bg-ink" />
          <span className="text-[18px] font-semibold tracking-tight">Parameter</span>
        </div>
        <PanelLeft className="size-4 text-muted" strokeWidth={1.75} />
      </div>
      <nav className="flex flex-col gap-0.5 p-2">
        {NAV.map((n) => (
          <NavItem
            key={n.label}
            label={n.label}
            Icon={n.Icon}
            active={!!n.page && n.page === active}
            onClick={n.page ? () => onNavigate(n.page!) : undefined}
          />
        ))}
      </nav>
      <div className="flex-1" />
      <div className="flex flex-col gap-0.5 p-2">
        <NavItem label="Docs" Icon={FileText} />
        <NavItem label="Inbox" Icon={Inbox} />
      </div>
      <div className="relative flex h-14 items-center justify-between border-t border-line px-4">
        <EdgeJoint edge="right" line="top" quads={['tl', 'bl']} />
        <div className="flex items-center gap-2 text-[15px] font-medium">
          <div className="size-5 rounded bg-ink" />
          Make AI
        </div>
        <ChevronDown className="size-4 text-muted" />
      </div>
    </aside>
  )
}

export interface Crumb {
  label: string
  Icon: typeof Home
}

/** Breadcrumb: icon + label per level, chevron separators, current page in ink. */
export function Topbar({ trail }: { trail: Crumb[] }) {
  return (
    <header className="relative flex h-14 shrink-0 items-center justify-between border-b border-line px-8">
      {/* Sidebar edge × top bar rule (continues into the sidebar's brand row) */}
      <EdgeJoint edge="left" line="bottom" quads={['tl', 'tr', 'bl', 'br']} />
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-2.5 text-sm leading-5">
          {trail.map(({ label, Icon }, i) => {
            const current = i === trail.length - 1
            return (
              <li key={label} className="flex items-center gap-2.5">
                {i > 0 && <ChevronRight aria-hidden className="size-4 text-[#8f8f8f]" strokeWidth={2} />}
                <span
                  aria-current={current ? 'page' : undefined}
                  className={`flex items-center gap-2 ${current ? 'font-medium text-ink' : 'text-[#6b6b6b] hover:text-ink'}`}
                >
                  <Icon className="size-4" strokeWidth={1.75} />
                  {label}
                </span>
              </li>
            )
          })}
        </ol>
      </nav>
      <div className="flex items-center gap-4">
        <button className="flex items-center gap-2 text-sm text-muted hover:text-ink">
          <Search className="size-4" />
          Search
          <kbd className="rounded border border-line px-1.5 py-0.5 font-sans text-xs">⌘K</kbd>
        </button>
        <Sun className="size-4 text-muted" />
        <Settings className="size-4 text-muted" />
        <div className="flex items-center gap-2 text-sm font-medium">
          <div className="size-7 rounded-full bg-[#d4d4d4]" />
          Sanjay kumar balaji
          <ChevronDown className="size-3.5 text-muted" />
        </div>
      </div>
    </header>
  )
}

export function Page({ children, active, onNavigate }: { children: ReactNode; active: PageId; onNavigate: (p: PageId) => void }) {
  return (
    <div className="flex h-full">
      <Sidebar active={active} onNavigate={onNavigate} />
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  )
}
