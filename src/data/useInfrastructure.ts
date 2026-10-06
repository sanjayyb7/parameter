import { useCallback, useEffect, useRef, useState } from 'react'
import { CONNECTION_SAMPLES, RESOURCE_SAMPLES } from './sampleData'
import type { Connection, ProviderId, Resource } from './types'

/**
 * Mock store for the Infrastructure section. Connecting a provider adds a connection in
 * the "syncing" state and ticks its progress, then publishes that provider's sample inventory.
 * AWS and Azure first land in the error states the original designs show (role can't be
 * assumed / subscription owned by another org); Retry then succeeds, to demo recovery.
 */
export function useInfrastructure() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const timers = useRef(new Map<string, number>())
  const failedOnce = useRef(new Set<string>())
  const connectionsRef = useRef(connections)
  connectionsRef.current = connections

  useEffect(() => {
    const active = timers.current
    return () => active.forEach((t) => window.clearInterval(t))
  }, [])

  const finishSync = useCallback((id: string) => {
    const conn = connectionsRef.current.find((c) => c.id === id)
    if (!conn) return
    const sample = CONNECTION_SAMPLES[conn.provider]
    if (sample.error && !failedOnce.current.has(id)) {
      failedOnce.current.add(id)
      setConnections((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'error', progress: 100, lastSync: 'failed just now', error: sample.error } : c)))
      return
    }
    const rows = RESOURCE_SAMPLES[conn.provider]
    setResources((prev) => [
      ...prev.filter((r) => r.connectionId !== id),
      ...rows.map((r, i) => ({ ...r, id: `${id}-${i}`, connectionId: id, provider: conn.provider, lastSeen: 'just now' })),
    ])
    setConnections((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, status: 'healthy', progress: 100, resourceCount: rows.length, relationships: sample.relationships, lastSync: 'just now', error: undefined }
          : c,
      ),
    )
  }, [])

  const startSync = useCallback(
    (id: string) => {
      const existing = timers.current.get(id)
      if (existing) window.clearInterval(existing)
      const timer = window.setInterval(() => {
        const current = connectionsRef.current.find((c) => c.id === id)
        if (!current) return window.clearInterval(timer)
        const next = Math.min(current.progress + 12 + Math.random() * 10, 100)
        if (next >= 100) {
          window.clearInterval(timer)
          timers.current.delete(id)
          finishSync(id)
        } else {
          setConnections((prev) => prev.map((c) => (c.id === id ? { ...c, progress: next } : c)))
        }
      }, 450)
      timers.current.set(id, timer)
    },
    [finishSync],
  )

  const connect = useCallback(
    (provider: ProviderId) => {
      const sample = CONNECTION_SAMPLES[provider]
      const conn: Connection = {
        id: `${provider}-${Date.now()}`,
        provider,
        account: sample.account,
        details: sample.details,
        status: 'syncing',
        progress: 4,
        resourceCount: 0,
        relationships: 0,
        lastSync: 'syncing…',
        connectedBy: 'Sanjay kumar balaji',
      }
      connectionsRef.current = [...connectionsRef.current, conn]
      setConnections((prev) => [...prev, conn])
      startSync(conn.id)
    },
    [startSync],
  )

  const retry = useCallback(
    (id: string) => {
      const patch = { status: 'syncing' as const, progress: 4, lastSync: 'syncing…', error: undefined }
      connectionsRef.current = connectionsRef.current.map((c) => (c.id === id ? { ...c, ...patch } : c))
      setConnections((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
      startSync(id)
    },
    [startSync],
  )

  const disconnect = useCallback((id: string) => {
    const t = timers.current.get(id)
    if (t) window.clearInterval(t)
    timers.current.delete(id)
    setConnections((prev) => prev.filter((c) => c.id !== id))
    setResources((prev) => prev.filter((r) => r.connectionId !== id))
  }, [])

  /** Bulk delete from the inventory (mock). */
  const removeResources = useCallback((ids: string[]) => {
    const drop = new Set(ids)
    setResources((prev) => prev.filter((r) => !drop.has(r.id)))
  }, [])

  /** Disconnect several accounts at once; their resources go with them. */
  const removeConnections = useCallback(
    (ids: string[]) => {
      ids.forEach((id) => disconnect(id))
    },
    [disconnect],
  )

  /** Snapshot / restore, so a bulk delete can be undone from its toast. */
  const snapshot = useCallback(() => ({ connections: connectionsRef.current, resources }), [resources])
  const restore = useCallback((snap: { connections: Connection[]; resources: Resource[] }) => {
    connectionsRef.current = snap.connections
    setConnections(snap.connections)
    setResources(snap.resources)
  }, [])

  const isConnected = (provider: ProviderId) => connections.some((c) => c.provider === provider)
  const syncing = connections.filter((c) => c.status === 'syncing')

  return { connections, resources, syncing, connect, retry, disconnect, removeResources, removeConnections, snapshot, restore, isConnected }
}
