import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getClusterSummary, getClusterTopology, type ClusterSummary, type Topology } from '../api'
import { Card } from '../components/Card'
import { StatusDot } from '../components/StatusDot'
import { TopologyGraph } from '../components/TopologyGraph'

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`
}

const REGION_FLAGS: Record<string, string> = {
  RU: '🇷🇺', DE: '🇩🇪', AT: '🇦🇹', FR: '🇫🇷', NL: '🇳🇱',
  FI: '🇫🇮', US: '🇺🇸', GB: '🇬🇧', PL: '🇵🇱', CZ: '🇨🇿',
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card style={{ padding: '18px 20px' }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>{sub}</div>
      )}
    </Card>
  )
}

export function Dashboard() {
  const [summary, setSummary] = useState<ClusterSummary | null>(null)
  const [topology, setTopology] = useState<Topology | null>(null)

  const load = async () => {
    try {
      const [s, t] = await Promise.all([getClusterSummary(), getClusterTopology()])
      setSummary(s)
      setTopology(t)
    } catch {}
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 15_000)
    return () => clearInterval(id)
  }, [])

  const backends = topology?.nodes.filter(n => n.type === 'backend') || []
  const entries = topology?.nodes.filter(n => n.type === 'entry') || []

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.4px', color: 'var(--text)' }}>
          Dashboard
        </h1>
        <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
          Refreshes every 15 seconds
        </div>
      </div>

      {/* Summary cards */}
      <div className="stat-grid">
        <StatCard
          label="Live Connections"
          value={(summary?.total_live_connections ?? 0).toLocaleString()}
        />
        <StatCard
          label="Nodes Online"
          value={`${summary?.nodes_online ?? 0} / ${summary?.nodes_total ?? 0}`}
        />
        <StatCard
          label="Avg Coverage"
          value={`${(summary?.avg_coverage_pct ?? 0).toFixed(1)}%`}
        />
        <StatCard
          label="Throughput"
          value={fmtBytes((summary?.total_bytes_in ?? 0) + (summary?.total_bytes_out ?? 0))}
          sub="↑ + ↓ total"
        />
      </div>

      {/* Topology */}
      {topology && (
        <Card style={{ marginBottom: 24, overflow: 'hidden' }}>
          <div
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid var(--border)',
              fontSize: 12,
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>Cluster Topology</span>
            <span>·</span>
            <span>{entries.length} entry → {backends.length} backend</span>
          </div>
          <div style={{ padding: 16 }}>
            <TopologyGraph topology={topology} />
          </div>
        </Card>
      )}

      {/* Node tables */}
      <div className="two-col-grid">
        {/* Backend nodes */}
        <Card>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
            Backend Nodes
          </div>
          {backends.length === 0 ? (
            <div style={{ padding: '20px 18px', color: 'var(--text-muted)', fontSize: 12 }}>
              No backend nodes. <Link to="/nodes" style={{ color: 'var(--ok)' }}>Add one →</Link>
            </div>
          ) : (
            backends.map(n => (
              <Link
                key={n.id}
                to={`/nodes/backend/${n.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 18px',
                  borderBottom: '1px solid var(--border)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <StatusDot status={n.status} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 12 }}>
                    {REGION_FLAGS[n.region] && <span style={{ marginRight: 4 }}>{REGION_FLAGS[n.region]}</span>}
                    {n.name}
                  </span>
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  {n.load.toLocaleString()} conns
                </span>
              </Link>
            ))
          )}
        </Card>

        {/* Entry nodes */}
        <Card>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
            Entry Nodes (HAProxy)
          </div>
          {entries.length === 0 ? (
            <div style={{ padding: '20px 18px', color: 'var(--text-muted)', fontSize: 12 }}>
              No entry nodes. <Link to="/nodes" style={{ color: 'var(--ok)' }}>Add one →</Link>
            </div>
          ) : (
            entries.map(n => (
              <Link
                key={n.id}
                to={`/nodes/entry/${n.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 18px',
                  borderBottom: '1px solid var(--border)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <StatusDot status={n.status} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 12 }}>
                    {REGION_FLAGS[n.region] && <span style={{ marginRight: 4 }}>{REGION_FLAGS[n.region]}</span>}
                    {n.name}
                  </span>
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  {n.load.toLocaleString()} sess
                </span>
              </Link>
            ))
          )}
        </Card>
      </div>
    </div>
  )
}
