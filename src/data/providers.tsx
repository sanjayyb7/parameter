import type { IconBaseProps, IconType } from 'react-icons'
import { FaAws } from 'react-icons/fa'
import { SiDigitalocean, SiRender } from 'react-icons/si'
import { VscAzure } from 'react-icons/vsc'
import type { ProviderId } from './types'

/** Full-colour Google Cloud logo (the brand mark ignores the single-colour `color` prop). */
export function GoogleCloudLogo({ className, style, title, size, ...rest }: IconBaseProps) {
  const { color: _ignored, ...restStyle } = style ?? {}
  void _ignored
  return (
    <svg
      viewBox="6 2.5 116 116"
      className={className}
      style={{ ...(size ? { width: size, height: size } : {}), ...restStyle }}
      role={title ? 'img' : undefined}
      aria-label={title ?? rest['aria-label']}
      aria-hidden={title || rest['aria-label'] ? undefined : true}
    >
      {title && <title>{title}</title>}
      <path fill="#ea4335" d="M80.6 40.3h.4l-.2-.2 14-14v-.3c-11.8-10.4-28.1-14-43.2-9.5C36.5 20.8 24.9 32.8 20.7 48c.2-.1.5-.2.8-.2 5.2-3.4 11.4-5.4 17.9-5.4 2.2 0 4.3.2 6.4.6.1-.1.2-.1.3-.1 9-9.9 24.2-11.1 34.6-2.6h-.1z" />
      <path fill="#4285f4" d="M108.1 47.8c-2.3-8.5-7.1-16.2-13.8-22.1L80 39.9c6 4.9 9.5 12.3 9.3 20v2.5c16.9 0 16.9 25.2 0 25.2H63.9v20h-.1l.1.2h25.4c14.6.1 27.5-9.3 31.8-23.1 4.3-13.8-1-28.8-13-36.9z" />
      <path fill="#34a853" d="M39 107.9h26.3V87.7H39c-1.9 0-3.7-.4-5.4-1.1l-15.2 14.6v.2c6 4.3 13.2 6.6 20.7 6.6z" />
      <path fill="#fbbc05" d="M40.2 41.9c-14.9.1-28.1 9.6-32.9 23.7-4.7 14.1 0 29.7 11.9 38.8l15.6-15.6c-8.5-3.8-10.3-14.8-3.4-21s16.1-3.7 21.4 3.3l15.6-15.6c-6.4-8.4-16.6-14.2-28.2-13.6z" />
    </svg>
  )
}

export interface Provider {
  id: ProviderId
  name: string
  Icon: IconType
  color: string
  method: string
  inventoryReady: boolean
}

export const PROVIDERS: Provider[] = [
  { id: 'gcp', name: 'Google Cloud', Icon: GoogleCloudLogo, color: '#4285F4', method: 'Keyless service-account impersonation', inventoryReady: true },
  { id: 'aws', name: 'AWS', Icon: FaAws, color: '#232F3E', method: 'Keyless cross-account role', inventoryReady: true },
  { id: 'azure', name: 'Azure', Icon: VscAzure, color: '#0078D4', method: 'Reader role on Parameter’s app', inventoryReady: true },
  { id: 'digitalocean', name: 'DigitalOcean', Icon: SiDigitalocean, color: '#0080FF', method: 'Read-only OAuth grant', inventoryReady: false },
  { id: 'render', name: 'Render', Icon: SiRender, color: '#171717', method: 'Scoped API key, read requests only', inventoryReady: false },
]

export const providerById = (id: ProviderId) => PROVIDERS.find((p) => p.id === id)!
