/**
 * Why a resource counts as internet-facing, per provider and resource type. Mirrors the
 * "Evidence" block of the original Exposure design: the configuration that decided it,
 * what was observed, which API calls it came from and the permissions used to read them.
 */
import type { Resource, Risk } from './types'

export interface Evidence {
  /** Short label for the table's "Reachable via" column. */
  short: string
  reason: string
  observed: [label: string, value: string][]
  sources: string[]
  readWith: string[]
  docs: string
}

const GCP_RUN: Evidence = {
  short: 'Public IAM member, open ingress',
  reason: "An IAM binding grants a public member, and nothing in the workload's ingress settings prevents it being reached.",
  observed: [
    ['Ingress', 'unrestricted'],
    ['Public member', 'allUsers or allAuthenticatedUsers'],
    ['Reachable via', 'internet'],
  ],
  sources: ['google.cloud.asset.v1.AssetService.SearchAllIamPolicies', 'google.cloud.asset.v1.AssetService.SearchAllResources'],
  readWith: ['cloudasset.assets.searchAllIamPolicies', 'cloudasset.assets.searchAllResources'],
  docs: 'https://cloud.google.com/run/docs/securing/managing-access',
}

const AWS_INSTANCE: Evidence = {
  short: 'Public IP, security group 0.0.0.0/0',
  reason: 'The instance has a public IP address and a security group that accepts inbound traffic from anywhere (0.0.0.0/0).',
  observed: [
    ['Public IP', 'assigned'],
    ['Security group', 'inbound 0.0.0.0/0 · tcp/22, tcp/80'],
    ['Reachable via', 'internet'],
  ],
  sources: ['ec2.DescribeInstances', 'ec2.DescribeSecurityGroups'],
  readWith: ['ec2:DescribeInstances', 'ec2:DescribeSecurityGroups'],
  docs: 'https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html',
}

const AZ_SOURCES = ['Microsoft.ResourceGraph/resources']

const AZ_NETWORK: Evidence = {
  short: 'Public IP, NSG allows Any',
  reason: 'A public IP address is attached and the network security group allows inbound traffic from Any.',
  observed: [
    ['Public IP', 'attached'],
    ['NSG inbound', 'Any · 22, 3389'],
    ['Reachable via', 'internet'],
  ],
  sources: AZ_SOURCES,
  readWith: ['Microsoft.Network/networkSecurityGroups/read', 'Microsoft.Network/publicIPAddresses/read'],
  docs: 'https://learn.microsoft.com/azure/virtual-network/network-security-groups-overview',
}

const AZ_VAULT: Evidence = {
  short: 'Public network access, firewall open',
  reason: 'Public network access is enabled and the vault firewall allows traffic from all networks.',
  observed: [
    ['Public network access', 'Enabled'],
    ['Firewall default', 'Allow'],
    ['Reachable via', 'internet'],
  ],
  sources: AZ_SOURCES,
  readWith: ['Microsoft.KeyVault/vaults/read'],
  docs: 'https://learn.microsoft.com/azure/key-vault/general/network-security',
}

const AZ_APP: Evidence = {
  short: 'Public network access, no restrictions',
  reason: 'Public network access is enabled and no access restrictions are configured on the app.',
  observed: [
    ['Public network access', 'Enabled'],
    ['Access restrictions', 'none'],
    ['Reachable via', 'internet'],
  ],
  sources: AZ_SOURCES,
  readWith: ['Microsoft.Web/sites/config/read'],
  docs: 'https://learn.microsoft.com/azure/app-service/app-service-ip-restrictions',
}

export function evidenceFor(r: Resource): Evidence {
  if (r.provider === 'gcp') return GCP_RUN
  if (r.provider === 'aws') return AWS_INSTANCE
  if (r.type === 'Key Vault') return AZ_VAULT
  if (r.type === 'App Service') return AZ_APP
  return AZ_NETWORK
}

/** Resources that hold credentials or data an attacker would want. */
export const isSensitive = (r: Resource) => r.category === 'secrets' || r.risk === 'sensitive'

export const RISK_ORDER: Record<Risk, number> = { critical: 0, high: 1, medium: 2, sensitive: 3, low: 4, none: 5 }
