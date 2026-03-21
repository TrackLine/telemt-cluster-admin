export type NodeStatus = 'ok' | 'warn' | 'down' | 'unknown'

export interface BackendNode {
  id: string
  name: string
  hostname: string
  region: string
  api_port: number
  enabled: boolean
  status: NodeStatus
  last_polled_at: string | null
  created_at: string
  live_connections: number
  coverage_pct: number
  alive_writers: number
  draining: boolean
  bytes_in: number
  bytes_out: number
}

export interface EntryNode {
  id: string
  name: string
  hostname: string
  region: string
  stats_port: number
  enabled: boolean
  status: NodeStatus
  last_polled_at: string | null
  created_at: string
  current_sessions: number
  total_connections: number
  bytes_in: number
  bytes_out: number
  backends_up: number
  backends_down: number
}

export interface ClusterSummary {
  total_live_connections: number
  nodes_online: number
  nodes_total: number
  avg_coverage_pct: number
  total_bytes_in: number
  total_bytes_out: number
}

export interface TopologyNode {
  id: string
  name: string
  type: 'entry' | 'backend'
  region: string
  status: NodeStatus
  load: number
}

export interface TopologyEdge {
  source: string
  target: string
}

export interface Topology {
  nodes: TopologyNode[]
  edges: TopologyEdge[]
}

export interface MetricSample {
  node_id: string
  node_type: string
  metric_name: string
  value: number
  sampled_at: string
}

export interface MetricHistory {
  node_id: string
  metric: string
  range: string
  data: MetricSample[]
}

const BASE = '/api'

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  if (res.status === 204) return undefined as T
  return res.json()
}

// Cluster
export const getClusterSummary = () => req<ClusterSummary>('/cluster/summary')
export const getClusterTopology = () => req<Topology>('/cluster/topology')

// Backend nodes
export const getBackendNodes = () => req<BackendNode[]>('/nodes/backends')
export const createBackendNode = (data: Partial<BackendNode>) =>
  req<BackendNode>('/nodes/backends', { method: 'POST', body: JSON.stringify(data) })
export const patchBackendNode = (id: string, data: Partial<BackendNode>) =>
  req<BackendNode>(`/nodes/backends/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
export const deleteBackendNode = (id: string) =>
  req<void>(`/nodes/backends/${id}`, { method: 'DELETE' })
export const testBackendNode = (hostname: string, api_port: number) =>
  req<{ ok: boolean; error?: string }>('/nodes/backends/test', {
    method: 'POST',
    body: JSON.stringify({ hostname, api_port }),
  })

// Entry nodes
export const getEntryNodes = () => req<EntryNode[]>('/nodes/entries')
export const createEntryNode = (data: Partial<EntryNode>) =>
  req<EntryNode>('/nodes/entries', { method: 'POST', body: JSON.stringify(data) })
export const patchEntryNode = (id: string, data: Partial<EntryNode>) =>
  req<EntryNode>(`/nodes/entries/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
export const deleteEntryNode = (id: string) =>
  req<void>(`/nodes/entries/${id}`, { method: 'DELETE' })
export const testEntryNode = (hostname: string, stats_port: number) =>
  req<{ ok: boolean; error?: string }>('/nodes/entries/test', {
    method: 'POST',
    body: JSON.stringify({ hostname, stats_port }),
  })

// Metrics
export const getMetrics = (nodeId: string, metric: string, range: string) =>
  req<MetricHistory>(`/metrics/${nodeId}?metric=${metric}&range=${range}`)

export interface GeoPoint {
  country_code: string
  country_name: string
  city: string
  lat: number
  lng: number
  connections: number
}

export interface GeoResponse {
  geo_available: boolean
  points: GeoPoint[]
  total_countries: number
  total_connections: number
}

export const getGeoClients = (hours = 1) =>
  req<GeoResponse>(`/geo/clients?hours=${hours}`)
