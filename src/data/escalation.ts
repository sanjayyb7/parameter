/**
 * Identity chains found across the connected accounts, from the original Exposure design.
 * "Escalation" paths hand an attacker more than they started with; "expected" ones are
 * grants that exist for a reason and give the holder nothing new.
 */
import type { ProviderId, Risk } from './types'

/** A chain is read as alternating parts: entity · verb · entity · verb · entity … */
export type ChainPart = { entity: string } | { verb: string }

export interface IdentityPath {
  id: string
  kind: 'escalation' | 'expected'
  provider: ProviderId
  account: string
  /** Critical / High for escalations; expected access carries no severity. */
  risk: Risk
  grant: string
  chain: ChainPart[]
  traits: string[]
  /** Credentials or data stores reachable at the end of the chain. */
  reaches?: number
  explain: string
}

const e = (entity: string): ChainPart => ({ entity })
const v = (verb: string): ChainPart => ({ verb })

const GCP = 'hex-exposure-lab'
const AWS = '702541599103'
const AZ = 'privelege escalation subscription'

export const IDENTITY_PATHS: IdentityPath[] = [
  {
    id: 'esc-1',
    kind: 'escalation',
    provider: 'gcp',
    account: GCP,
    risk: 'critical',
    grant: 'roles/iam.serviceAccountTokenCreator',
    chain: [e('lab-frontend'), v('runs as'), e('Web frontend'), v('can impersonate'), e('Payments API')],
    traits: ['Runtime identity'],
    explain: 'The public service runs as an identity that can mint tokens for the backend account, so anyone who controls the service becomes the backend.',
  },
  {
    id: 'esc-2',
    kind: 'escalation',
    provider: 'aws',
    account: AWS,
    risk: 'critical',
    grant: 'iam:PassRole + iam:RemoveRoleFromInstanceProfile + iam:AddRoleToInstanceProfile',
    chain: [
      e('CloudGoat parameter super-critical-security-server'),
      v('runs as'),
      e('cg-entry-role-parameter'),
      v('can swap in'),
      e('cg-ec2-mighty-role-parameter'),
    ],
    traits: ['Project-wide grant', 'Runtime identity'],
    reaches: 2,
    explain: 'The instance role can replace the role on its own instance profile with a more powerful one, then use that role’s credentials.',
  },
  {
    id: 'esc-3',
    kind: 'escalation',
    provider: 'gcp',
    account: GCP,
    risk: 'critical',
    grant: 'roles/iam.serviceAccountTokenCreator',
    chain: [e('gcpgoat-entry'), v('runs as'), e('CI deploy bot'), v('can impersonate'), e('Billing worker')],
    traits: ['Project-wide grant', 'Runtime identity'],
    reaches: 4,
    explain: 'Token Creator is granted at the project, so this identity can impersonate every service account in hex-exposure-lab.',
  },
  {
    id: 'esc-4',
    kind: 'escalation',
    provider: 'azure',
    account: AZ,
    risk: 'high',
    grant: 'Public network access',
    chain: [e('Internet'), v('can reach'), e('paramvuln24565')],
    traits: ['Credential store'],
    explain: 'The Key Vault accepts traffic from all networks, so its secrets are one stolen token away from anyone on the internet.',
  },
  {
    id: 'exp-1',
    kind: 'expected',
    provider: 'azure',
    account: AZ,
    risk: 'none',
    grant: 'Contributor',
    chain: [e('pe2eappedarmvdb'), v('runs as'), e('pe2e-uami-edarmvdb')],
    traits: ['Runtime identity', 'Scoped to resource group'],
    explain: 'The app runs as its own managed identity. The identity has no access the app didn’t already have.',
  },
  {
    id: 'exp-2',
    kind: 'expected',
    provider: 'azure',
    account: AZ,
    risk: 'none',
    grant: 'Key Vault Secrets User',
    chain: [e('pe2e-uami-edarmvdb'), v('can read'), e('pe2evaultedarmvdb')],
    traits: ['Private vault'],
    explain: 'The vault only accepts private traffic, and reading its secrets is what this identity is for.',
  },
  {
    id: 'exp-3',
    kind: 'expected',
    provider: 'gcp',
    account: GCP,
    risk: 'none',
    grant: 'roles/cloudasset.viewer',
    chain: [e('Parameter scanner (read-only)'), v('can list'), e(GCP)],
    traits: ['Read-only'],
    explain: 'Parameter’s own inventory account. It can list resources and policies but can’t read data or change anything.',
  },
  {
    id: 'exp-4',
    kind: 'expected',
    provider: 'aws',
    account: AWS,
    risk: 'none',
    grant: 'SecurityAudit',
    chain: [e('ParameterReadOnly'), v('can list'), e(AWS)],
    traits: ['Read-only', 'Keyless'],
    explain: 'Parameter’s cross-account role. It reads configuration only and is assumed without stored keys.',
  },
]
