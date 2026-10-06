import { DialRoot } from 'dialkit'
import 'dialkit/styles.css'
import { useCallback, useMemo, useState } from 'react'
import { AttackPathsTab } from './components/AttackPathsTab'
import { AccountFilter } from './components/AccountFilter'
import { ConnectionsTab } from './components/ConnectionsTab'
import { ExposureTab } from './components/ExposureTab'
import { ATTACK_PATHS } from './data/attackPaths'
import { ConnectModal } from './components/ConnectModal'
import { HowItWorksModal } from './components/HowItWorksModal'
import { FilletRadius } from './components/Fillet'
import { ResourcesTab } from './components/ResourcesTab'
import { UndoToast, type ToastState } from './components/Table'
import { OverviewPage } from './components/OverviewPage'
import { Page, Topbar, type Crumb, type PageId } from './components/Shell'
import { Boxes, GitBranch, Globe, Home, Plug, Share2 } from 'lucide-react'
import { Tabs, type TabDef } from './components/Tabs'
import type { TabId } from './data/types'
import { useInfrastructure } from './data/useInfrastructure'

const TAB_ICONS: Record<TabId, Crumb['Icon']> = {
  connections: Plug,
  resources: Boxes,
  exposure: Globe,
  'attack-paths': GitBranch,
}

const SHOW_DIALKIT = false

const TAB_ORDER: TabId[] = ['connections', 'resources', 'exposure', 'attack-paths']

const LABELS: Record<TabId, string> = {
  connections: 'Connections',
  resources: 'Resources',
  exposure: 'Exposure',
  'attack-paths': 'Attack paths',
}

export default function App() {
  const infra = useInfrastructure()
  const [page, setPage] = useState<PageId>('infrastructure')
  // Tab + direction of travel, so the incoming panel slides in from the side you moved toward.
  const [nav, setNav] = useState<{ tab: TabId; dir: 1 | -1 }>({ tab: 'connections', dir: 1 })
  const tab = nav.tab
  const setTab = (id: TabId) => setNav((prev) => ({ tab: id, dir: TAB_ORDER.indexOf(id) >= TAB_ORDER.indexOf(prev.tab) ? 1 : -1 }))
  const [modalOpen, setModalOpen] = useState(false)
  const [howOpen, setHowOpen] = useState(false)

  const hasResources = infra.resources.length > 0
  const syncing = infra.syncing.length > 0
  const internetFacing = infra.resources.filter((r) => r.exposure === 'internet').length
  // Attack paths come from the Google Cloud lab inventory.
  const pathsAvailable = infra.resources.some((r) => r.provider === 'gcp')

  const tabs: TabDef[] = [
    { id: 'connections', label: 'Connections', count: infra.connections.length, alert: infra.connections.some((c) => c.status === 'error') },
    { id: 'resources', label: 'Resources', count: infra.resources.length, loading: syncing && !hasResources },
    { id: 'exposure', label: 'Exposure', count: internetFacing, disabled: !hasResources },
    { id: 'attack-paths', label: 'Attack paths', count: pathsAvailable ? ATTACK_PATHS.length : 0, disabled: !hasResources },
  ]

  const openConnect = () => setModalOpen(true)

  // Bulk deletes happen immediately; the toast offers Undo (Gmail-style) instead of a confirm dialog.
  const [toast, setToast] = useState<ToastState | null>(null)
  const notify = useCallback((message: string, undo?: () => void) => setToast({ id: Date.now(), message, undo }), [])
  const closeToast = useCallback(() => setToast(null), [])
  const deleteWithUndo = (noun: string, ids: string[], run: (ids: string[]) => void) => {
    const snap = infra.snapshot()
    run(ids)
    notify(`${ids.length} ${noun}${ids.length === 1 ? '' : 's'} deleted`, () => infra.restore(snap))
  }

  // Account scope shared by Resources and Exposure. Empty means every account; ids of
  // accounts that were since disconnected are simply ignored.
  const [scopeIds, setScopeIds] = useState<Set<string>>(new Set())
  const accounts = useMemo(() => infra.connections.filter((c) => infra.resources.some((r) => r.connectionId === c.id)), [infra.connections, infra.resources])
  const scope = useMemo(() => new Set(accounts.filter((c) => scopeIds.has(c.id)).map((c) => c.id)), [accounts, scopeIds])
  const scoped = useMemo(() => (scope.size ? infra.resources.filter((r) => scope.has(r.connectionId)) : infra.resources), [infra.resources, scope])
  const accountOptions = accounts.map((c) => ({
    id: c.id,
    provider: c.provider,
    account: c.account,
    count: infra.resources.filter((r) => r.connectionId === c.id).length,
  }))
  const accountFilter = <AccountFilter options={accountOptions} selected={scope} onChange={setScopeIds} />
  // The attack paths come from the Google Cloud lab, so they show only while a GCP account is in scope.
  const pathsInScope = accounts.some((c) => c.provider === 'gcp' && (scope.size === 0 || scope.has(c.id)))

  return (
    <FilletRadius.Provider value={8}>
      <Page active={page} onNavigate={setPage}>
        {page === 'overview' ? (
          <>
            <Topbar trail={[{ label: 'Overview', Icon: Home }]} />
            <div key="overview" className="tab-panel flex min-h-0 flex-1 flex-col">
              <OverviewPage />
            </div>
          </>
        ) : (
          <>
            <Topbar
              trail={[
                { label: 'Infrastructure', Icon: Share2 },
                { label: LABELS[tab], Icon: TAB_ICONS[tab] },
              ]}
            />
            <Tabs tabs={tabs} active={tab} onChange={setTab} />

            {/* Keyed by tab: the incoming panel fades and rises in; the outgoing one leaves instantly. */}
            <div key={tab} className="tab-panel flex min-h-0 flex-1 flex-col" style={{ ['--dir' as string]: nav.dir }}>
              {tab === 'connections' && (
                <ConnectionsTab
                  connections={infra.connections}
                  onConnect={openConnect}
                  onRetry={infra.retry}
                  onDisconnect={infra.disconnect}
                  onHowItWorks={() => setHowOpen(true)}
                />
              )}
              {tab === 'resources' && (
                <ResourcesTab
                  resources={scoped}
                  syncing={syncing}
                  onConnect={openConnect}
                  filter={accountFilter}
                  onDeleteMany={(ids) => deleteWithUndo('resource', ids, infra.removeResources)}
                />
              )}
              {tab === 'attack-paths' && (
                <AttackPathsTab
                  available={pathsAvailable}
                  inScope={pathsInScope}
                  filter={<AccountFilter options={accountOptions} selected={scope} onChange={setScopeIds} align="left" />}
                />
              )}
              {tab === 'exposure' && (
                <ExposureTab resources={scoped} allResources={infra.resources} connections={accounts} scope={scope} filter={accountFilter} notify={notify} />
              )}
            </div>
          </>
        )}

        <UndoToast toast={toast} onClose={closeToast} />
        <HowItWorksModal
          open={howOpen}
          onClose={() => setHowOpen(false)}
          onConnect={() => {
            setHowOpen(false)
            setModalOpen(true)
          }}
        />
        {/* Live tuning: findings chart styling + motion */}
        {/* Hidden for now; set SHOW_DIALKIT to true to bring the tuning panel back. */}
        {SHOW_DIALKIT && <DialRoot position="bottom-left" theme="light" defaultOpen={false} />}
        <ConnectModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onConnect={(id) => {
            infra.connect(id)
            setPage('infrastructure')
            setTab('connections')
          }}
          isConnected={infra.isConnected}
        />
      </Page>
    </FilletRadius.Provider>
  )
}
