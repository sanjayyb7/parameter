/**
 * Sample inventory, taken from the original Connections / Resources / Exposure designs in
 * Wonder (hex-exposure-lab, CloudGoat, the Azure privilege-escalation lab). Values the
 * designs truncated (long IDs) are completed with plausible placeholders.
 */
import type { Category, Connection, ConnectionError, Exposure, ProviderId, Resource, ResourceState, Risk } from './types'

type ConnectionSample = Pick<Connection, 'account' | 'details' | 'relationships'> & {
  /** Present when the first sync for this provider fails; a retry then succeeds. */
  error?: ConnectionError
}

export const CONNECTION_SAMPLES: Record<ProviderId, ConnectionSample> = {
  gcp: {
    account: 'hex-exposure-lab',
    relationships: 143,
    details: [
      ['Project ID', 'hex-exposure-lab'],
      ['Service account', 'hex-inventory-54e6adbccc88@hex-exposure-lab.iam.gserviceaccount.com'],
      ['Parameter runtime', 'web-production@anytool-prod.iam.gserviceaccount.com'],
      ['Additional runtime', 'worker-production@anytool-prod.iam.gserviceaccount.com'],
    ],
  },
  aws: {
    account: '702541599103',
    relationships: 18,
    details: [
      ['Account ID', '702541599103'],
      ['Role', 'arn:aws:iam::702541599103:role/ParameterReadOnly'],
    ],
    error: {
      title: 'Cloud inventory sync failed',
      hint: 'Parameter couldn’t assume the cross-account role. Check the role’s trust policy allows Parameter, then retry.',
    },
  },
  azure: {
    account: 'privelege escalation subscription',
    relationships: 21,
    details: [
      ['Subscription ID', '247beea9-97ac-4a01-ab3b-fd2e5c1a9b40'],
      ['Directory ID', 'ea090290-6c37-4173-8824-44f1b2d7c3e5'],
    ],
    error: {
      title: 'This Azure subscription belongs to another organization',
      hint: 'Ask that organization’s admin to disconnect it there, or connect a subscription in your own tenant.',
    },
  },
  digitalocean: { account: 'parameter-team', relationships: 0, details: [['Team', 'parameter-team']] },
  render: { account: 'parameter-workspace', relationships: 0, details: [['Workspace', 'parameter-workspace']] },
}

type R = Omit<Resource, 'id' | 'connectionId' | 'provider' | 'lastSeen'>

const row = (
  name: string,
  path: string,
  type: string,
  category: Category,
  project: string,
  location: string,
  state: ResourceState = 'Unknown',
  exposure: Exposure = 'private',
  risk: Risk = 'none',
): R => ({ name, path, type, category, project, location, state, exposure, risk })

const GCP = 'hex-exposure-lab'

// Every GCP region gets a "default" subnetwork; first twelve follow the order in the design.
const GCP_REGIONS = [
  'northamerica-south1', 'europe-west12', 'africa-south1', 'asia-northeast1', 'asia-southeast2', 'northamerica-northeast2',
  'asia-east1', 'europe-west6', 'southamerica-east1', 'asia-south1', 'asia-east2', 'me-central1', 'us-central1', 'us-east1',
  'us-east4', 'us-east5', 'us-south1', 'us-west1', 'us-west2', 'us-west3', 'us-west4', 'europe-west1', 'europe-west2',
  'europe-west3', 'europe-west4', 'europe-west8', 'europe-west9', 'europe-west10', 'europe-north1', 'europe-central2',
  'europe-southwest1', 'asia-northeast2', 'asia-northeast3', 'asia-south2', 'asia-southeast1', 'australia-southeast1',
  'australia-southeast2', 'me-west1', 'me-central2', 'northamerica-northeast1', 'southamerica-west1',
]

const defaultSubnet = (region: string) =>
  row('default', `//compute.googleapis.com/projects/${GCP}/regions/${region}/subnetworks/default`, 'Subnetwork', 'network', GCP, region)

const sa = (name: string, email: string, risk: Risk = 'none') =>
  row(name, `//iam.googleapis.com/projects/${GCP}/serviceAccounts/${email}`, 'ServiceAccount', 'identity', GCP, 'global', 'ENABLED', 'private', risk)

const run = (name: string, risk: Risk) =>
  row(name, `//run.googleapis.com/projects/${GCP}/locations/us-central1/services/${name}`, 'Service', 'workloads', GCP, 'us-central1', 'Unknown', 'internet', risk)

const secret = (name: string, risk: Risk = 'sensitive') =>
  row(`projects/1038497727701/secrets/${name}`, `//secretmanager.googleapis.com/projects/1038497727701/secrets/${name}`, 'Secret', 'secrets', GCP, 'global', 'Unknown', 'private', risk)

const gcpNamed: R[] = [
  secret('a4-crown-jewel'),
  run('a5-entry', 'critical'),
  sa('GCP-GOAT sc6 attacker (project-wide tokenCreator)', `gcpgoat-attacker@${GCP}.iam.gserviceaccount.com`, 'critical'),
  sa('Lab frontend (runs the public service)', `lab-frontend@${GCP}.iam.gserviceaccount.com`, 'critical'),
  sa('Parameter read-only inventory', `hex-inventory-a5f6b662826c@${GCP}.iam.gserviceaccount.com`),
  row('a4-target', `//compute.googleapis.com/projects/${GCP}/zones/us-central1-a/instances/a4-target`, 'Instance', 'workloads', GCP, 'us-central1-a', 'RUNNING'),
  run('gcpgoat-entry', 'critical'),
  row('a4-subnet', `//compute.googleapis.com/projects/${GCP}/regions/us-central1/subnetworks/a4-subnet`, 'Subnetwork', 'network', GCP, 'us-central1'),
  run('a4-entry', 'critical'),
  run('lab-frontend', 'critical'),
  sa('Lab backend (holds the crown jewel)', `lab-backend@${GCP}.iam.gserviceaccount.com`, 'high'),
  sa('Thunder a4error VM identity (the prize)', `a4error-vm@${GCP}.iam.gserviceaccount.com`, 'high'),
  secret('lab-crown-jewel'),
  secret('lab-already-owned'),
  row(GCP, `//cloudresourcemanager.googleapis.com/projects/${GCP}`, 'Project', 'projects', GCP, 'global', 'ENABLED'),
]

// Interleave named resources with default subnets, roughly as they appear in the design.
const gcpRows: R[] = []
GCP_REGIONS.forEach((region, i) => {
  gcpRows.push(defaultSubnet(region))
  if (i >= 3 && gcpNamed[i - 3]) gcpRows.push(gcpNamed[i - 3])
})
gcpNamed.slice(GCP_REGIONS.length - 3).forEach((r) => gcpRows.push(r))

const AWS_ACCOUNT = '702541599103'
const awsRows: R[] = [
  row('CloudGoat parameter super-critical-security-server', `arn:aws:ec2:us-east-1:${AWS_ACCOUNT}:instance/i-0b7c2d9e4f1a6b3c8`, 'Instance', 'workloads', AWS_ACCOUNT, 'us-east-1', 'RUNNING', 'internet', 'critical'),
  row('cg-ec2-mighty-role-parameter', `arn:aws:iam::${AWS_ACCOUNT}:role/cg-ec2-mighty-role-parameter`, 'IAM role', 'identity', AWS_ACCOUNT, 'global', 'ENABLED', 'private', 'high'),
  row('cg-entry-role-parameter', `arn:aws:iam::${AWS_ACCOUNT}:role/cg-entry-role-parameter`, 'IAM role', 'identity', AWS_ACCOUNT, 'global', 'ENABLED'),
  row('cg-vpc-parameter', `arn:aws:ec2:us-east-1:${AWS_ACCOUNT}:vpc/vpc-0a1b2c3d4e5f60718`, 'VPC', 'network', AWS_ACCOUNT, 'us-east-1'),
  row('cg-public-subnet-parameter', `arn:aws:ec2:us-east-1:${AWS_ACCOUNT}:subnet/subnet-0f1e2d3c4b5a69788`, 'Subnet', 'network', AWS_ACCOUNT, 'us-east-1a'),
  row('cg-secret-parameter', `arn:aws:secretsmanager:us-east-1:${AWS_ACCOUNT}:secret:cg-secret-parameter`, 'Secret', 'secrets', AWS_ACCOUNT, 'us-east-1', 'Unknown', 'private', 'sensitive'),
]

const AZ_SUB = '247beea9-97ac-4a01-ab3b-fd2e5c1a9b40'
const AZ_NAME = 'privelege escalation subscription'
const az = (provider: string, name: string) => `/subscriptions/${AZ_SUB}/resourceGroups/privesc-lab/providers/${provider}/${name}`
const azureRows: R[] = [
  row('vuln-vm-01', az('Microsoft.Compute/virtualMachines', 'vuln-vm-01'), 'Virtual machine', 'workloads', AZ_NAME, 'eastus', 'RUNNING', 'internet', 'high'),
  row('vuln-vm-01-pip', az('Microsoft.Network/publicIPAddresses', 'vuln-vm-01-pip'), 'Public IP address', 'network', AZ_NAME, 'eastus', 'Unknown', 'internet'),
  row('vuln-vm-01-nic', az('Microsoft.Network/networkInterfaces', 'vuln-vm-01-nic'), 'Network interface', 'network', AZ_NAME, 'eastus', 'Unknown', 'internet'),
  row('paramvuln24565', az('Microsoft.KeyVault/vaults', 'paramvuln24565'), 'Key Vault', 'secrets', AZ_NAME, 'eastus', 'ENABLED', 'internet', 'high'),
  row('pe2eappedarmvdb', az('Microsoft.Web/sites', 'pe2eappedarmvdb'), 'App Service', 'workloads', AZ_NAME, 'westus2', 'RUNNING', 'internet'),
  row('pe2e-uami-edarmvdb', az('Microsoft.ManagedIdentity/userAssignedIdentities', 'pe2e-uami-edarmvdb'), 'Managed identity', 'identity', AZ_NAME, 'westus2', 'ENABLED'),
  row('pe2evaultedarmvdb', az('Microsoft.KeyVault/vaults', 'pe2evaultedarmvdb'), 'Key Vault', 'secrets', AZ_NAME, 'westus2', 'ENABLED', 'private', 'sensitive'),
]

export const RESOURCE_SAMPLES: Record<ProviderId, R[]> = {
  gcp: gcpRows,
  aws: awsRows,
  azure: azureRows,
  digitalocean: [],
  render: [],
}
