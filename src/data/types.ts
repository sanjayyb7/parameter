export type ProviderId = 'gcp' | 'aws' | 'azure' | 'digitalocean' | 'render'

export type ConnectionStatus = 'syncing' | 'healthy' | 'error'

export interface ConnectionError {
  title: string
  hint: string
}

export interface Connection {
  id: string
  provider: ProviderId
  account: string
  status: ConnectionStatus
  progress: number // 0–100 while syncing
  resourceCount: number
  relationships: number
  lastSync: string
  connectedBy: string
  /** Identifiers shown in the expanded row (Project ID, Role, Subscription ID…). */
  details: [label: string, value: string][]
  error?: ConnectionError
}

export type Exposure = 'internet' | 'private'
export type Risk = 'critical' | 'high' | 'medium' | 'low' | 'sensitive' | 'none'
export type Category = 'workloads' | 'network' | 'identity' | 'secrets' | 'projects'
export type ResourceState = 'Unknown' | 'ENABLED' | 'RUNNING' | 'DISABLED'

export interface Resource {
  id: string
  connectionId: string
  provider: ProviderId
  name: string
  /** Full provider resource path, e.g. //compute.googleapis.com/projects/…/subnetworks/default */
  path: string
  type: string
  category: Category
  project: string
  location: string
  state: ResourceState
  lastSeen: string
  exposure: Exposure
  risk: Risk
}

export type TabId = 'connections' | 'resources' | 'exposure' | 'attack-paths'
