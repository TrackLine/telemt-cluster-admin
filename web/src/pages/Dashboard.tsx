import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getClusterSummary, getClusterTopology, type ClusterSummary, type Topology } from '../api'
import { Card, CardHead } from '../components/Card'
import { StatusDot } from '../components/StatusDot'
import { TopologyGraph } from '../components/TopologyGraph'
import { useClusterMode } from '../context/ClusterMode'

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1_073_741_824) return `${(b / 1_048_576).toFixed(1)} MB`
  return `${(b / 1_073_741_824).toFixed(2)} GB`
}

const FLAGS: Record<string, string> = {
  RU:'🇷🇺', DE:'🇩🇪', AT:'🇦🇹', FR:'🇫🇷', NL:'🇳🇱',
  FI:'🇫🇮', US:'🇺🇸', GB:'🇬🇧', PL:'🇵🇱', CZ:'🇨🇿',
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export function Dashboard() {
  const [summary, setSummary] = useState<ClusterSummary | null>(null)
  const [topology, setTopology] = useState<Topology | null>(null)
  const clusterMode = useClusterMode()

  useEffect(() => {
    const load = async () => {
      try {
        const [s, t] = await Promise.all([getClusterSummary(), getClusterTopology()])
        setSummary(s)
        setTopology(t)
      } catch {}
    }
    load()
    const id = setInterval(load, 15_000)
    return () => clearInterval(id)
  }, [])

  const backends = topology?.nodes.filter(n => n.type === 'backend') ?? []
  const entries  = topology?.nodes.filter(n => n.type === 'entry') ?? []

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Обновляется каждые 15 секунд</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        <StatCard label="Live Connections" value={(summary?.total_live_connections ?? 0).toLocaleString()} />
        <StatCard
          label="Nodes Online"
          value={`${summary?.nodes_online ?? 0} / ${summary?.nodes_total ?? 0}`}
          color={(summary?.nodes_online ?? 0) > 0 ? undefined : 'var(--down)'}
        />
        <StatCard
          label="Avg Coverage"
          value={`${(summary?.avg_coverage_pct ?? 0).toFixed(1)}%`}
          color={(summary?.avg_coverage_pct ?? 0) >= 80 ? 'var(--ok)' : (summary?.avg_coverage_pct ?? 0) >= 50 ? 'var(--warn)' : 'var(--down)'}
        />
        <StatCard
          label="Трафик"
          value={fmtBytes((summary?.total_bytes_in ?? 0) + (summary?.total_bytes_out ?? 0))}
          sub="↑ + ↓ total"
        />
      </div>

      {/* Topology */}
      {topology && (
        <Card style={{ marginBottom: 20 }}>
          <CardHead
            title="Cluster Topology"
            right={
              <span className="text-muted" style={{ fontSize: 12 }}>
                {clusterMode === 'simple'
                  ? `${backends.length} backend`
                  : `${entries.length} entry → ${backends.length} backend`}
              </span>
            }
          />
          <div style={{ padding: 16 }}>
            <TopologyGraph topology={topology} />
          </div>
        </Card>
      )}

      {/* Node lists */}
      <div className={clusterMode === 'full' ? 'two-col-grid' : ''}>
        <Card>
          <CardHead
            title="Backend Nodes"
            right={
              <Link to="/nodes" className="text-muted" style={{ fontSize: 12, transition: 'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                Все →
              </Link>
            }
          />
          {backends.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-body">
                Нет backend-нод. <Link to="/nodes" style={{ color: 'var(--ok)' }}>Добавить →</Link>
              </div>
            </div>
          ) : (
            backends.map(n => (
              <Link key={n.id} to={`/nodes/backend/${n.id}`} className="node-row">
                <StatusDot status={n.status} pulse={n.status === 'ok'} size={7} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="truncate" style={{ fontSize: 13, fontWeight: 500 }}>
                    {FLAGS[n.region] && <span style={{ marginRight: 4 }}>{FLAGS[n.region]}</span>}
                    {n.name}
                  </div>
                </div>
                <span className="text-muted font-mono" style={{ fontSize: 12, flexShrink: 0 }}>
                  {n.load.toLocaleString()}
                </span>
              </Link>
            ))
          )}
        </Card>

        {clusterMode === 'full' && (
          <Card>
            <CardHead
              title="Entry Nodes (HAProxy)"
              right={
                <Link to="/nodes" className="text-muted" style={{ fontSize: 12, transition: 'color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  Все →
                </Link>
              }
            />
            {entries.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-body">
                  Нет entry-нод. <Link to="/nodes" style={{ color: 'var(--ok)' }}>Добавить →</Link>
                </div>
              </div>
            ) : (
              entries.map(n => (
                <Link key={n.id} to={`/nodes/entry/${n.id}`} className="node-row">
                  <StatusDot status={n.status} pulse={n.status === 'ok'} size={7} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="truncate" style={{ fontSize: 13, fontWeight: 500 }}>
                      {FLAGS[n.region] && <span style={{ marginRight: 4 }}>{FLAGS[n.region]}</span>}
                      {n.name}
                    </div>
                  </div>
                  <span className="text-muted font-mono" style={{ fontSize: 12, flexShrink: 0 }}>
                    {n.load.toLocaleString()}
                  </span>
                </Link>
              ))
            )}
          </Card>
        )}
      </div>
    </div>
  )
}
