/**
 * Attack paths for hex-exposure-lab, taken from the original "Graph → Attack vectors" design.
 * Each path is entry (internet-facing) → identity it runs as → identity it can impersonate.
 */

export type NodeKind = 'entry' | 'identity' | 'target'

export interface PathNode {
  id: string
  kind: NodeKind
  label: string
  /** Extra reach beyond the target, e.g. "+4 reached". */
  reached?: number
}

export type EdgeKind = 'runs-as' | 'impersonate'

export interface PathEdge {
  id: string
  kind: EdgeKind
  source: string
  target: string
  /** IAM role behind an impersonation grant. */
  role?: string
  /** Where the grant is bound. */
  scope?: string
}

export interface PathStep {
  verb: string
  subject: string
  detail: string
}

export interface AttackPath {
  id: string
  entry: string
  target: string
  severity: 'Critical' | 'High'
  tags: string[]
  summary: string
  why: string[]
  steps: PathStep[]
  fix: { text: string; command?: string }
  nodes: PathNode[]
  edges: PathEdge[]
}

const SUMMARY =
  'Reaching a credential store extends the blast radius past this chain: whatever those credentials unlock becomes reachable too, including systems this inventory cannot see.'
const WHY = ['the chain hands over an identity the entry did not hold', 'the final grant returns data directly']
const STEP_ENTRY = 'Where the chain starts. An attacker needs no credentials of yours to get this far.'
const STEP_RUNS_AS = 'The workload executes as this service account, so anyone who controls the workload acts as the account.'
const STEP_IMPERSONATE = 'An impersonation grant lets this identity mint short-lived credentials for the target.'
const TOKEN_CREATOR = 'roles/iam.serviceAccountTokenCreator'

export const ATTACK_PATHS: AttackPath[] = [
  {
    id: 'p1',
    entry: 'lab-frontend',
    target: 'Payments API',
    severity: 'Critical',
    tags: ['Gains a new identity'],
    summary: SUMMARY,
    why: WHY,
    steps: [
      { verb: 'Internet reachable', subject: 'lab-frontend', detail: STEP_ENTRY },
      { verb: 'runs as', subject: 'Web frontend', detail: STEP_RUNS_AS },
      { verb: 'can impersonate', subject: 'Payments API', detail: STEP_IMPERSONATE },
    ],
    fix: {
      text: 'Remove roles/iam.serviceAccountTokenCreator from web-frontend@hex-exposure-lab.iam.gserviceaccount.com on this resource. The binding is attached to the resource itself, so it is removed with that resource’s own set-iam-policy command.',
    },
    nodes: [
      { id: 'n-lab-frontend', kind: 'entry', label: 'lab-frontend' },
      { id: 'n-sa-lab-frontend', kind: 'identity', label: 'Web frontend' },
      { id: 'n-sa-lab-backend', kind: 'target', label: 'Payments API' },
    ],
    edges: [
      { id: 'e1a', kind: 'runs-as', source: 'n-lab-frontend', target: 'n-sa-lab-frontend' },
      { id: 'e1b', kind: 'impersonate', source: 'n-sa-lab-frontend', target: 'n-sa-lab-backend', role: TOKEN_CREATOR, scope: 'On the target service account only' },
    ],
  },
  {
    id: 'p2',
    entry: 'gcpgoat-entry',
    target: 'Billing worker',
    severity: 'Critical',
    tags: ['Gains a new identity', 'reaches 4'],
    summary: SUMMARY,
    why: WHY,
    steps: [
      { verb: 'Internet reachable', subject: 'gcpgoat-entry', detail: STEP_ENTRY },
      { verb: 'runs as', subject: 'CI deploy bot', detail: STEP_RUNS_AS },
      { verb: 'can impersonate', subject: 'Billing worker', detail: STEP_IMPERSONATE },
    ],
    fix: {
      text: 'Bound at the project, so it applies to every resource of this type in it. Removing it revokes access to all 4 resources at once.',
      command:
        'gcloud projects remove-iam-policy-binding hex-exposure-lab \\\n  --member="serviceAccount:ci-deploy@hex-exposure-lab.iam.gserviceaccount.com" \\\n  --role="roles/iam.serviceAccountTokenCreator"',
    },
    nodes: [
      { id: 'n-gcpgoat-entry', kind: 'entry', label: 'gcpgoat-entry' },
      { id: 'n-sa-gcpgoat', kind: 'identity', label: 'CI deploy bot' },
      { id: 'n-sa-thunder', kind: 'target', label: 'Billing worker', reached: 4 },
    ],
    edges: [
      { id: 'e2a', kind: 'runs-as', source: 'n-gcpgoat-entry', target: 'n-sa-gcpgoat' },
      { id: 'e2b', kind: 'impersonate', source: 'n-sa-gcpgoat', target: 'n-sa-thunder', role: TOKEN_CREATOR, scope: 'Project-wide (hex-exposure-lab)' },
    ],
  },
]

/** Plain-language meaning of each kind of connection, shown when a line is clicked. */
export const EDGE_MEANING: Record<EdgeKind, { title: string; body: string }> = {
  'runs-as': { title: 'runs as', body: STEP_RUNS_AS },
  impersonate: { title: 'can impersonate', body: STEP_IMPERSONATE },
}
