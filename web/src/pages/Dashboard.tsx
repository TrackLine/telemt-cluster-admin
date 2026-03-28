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

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '0.75em', height: '0.75em', marginRight: '0.2em', verticalAlign: 'middle', opacity: 0.7 }}>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  )
}

function StatCard({ label, value, sub, color, icon }: { label: string; value: string; sub?: string; color?: string; icon?: boolean }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ ...(color ? { color } : {}), display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon && <TelegramIcon />}{value}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

function ConnectionSplit({ summary }: { summary: ClusterSummary }) {
  const direct = summary.direct_connections ?? 0
  const me = summary.me_connections ?? 0
  if (direct === 0 && me === 0) return null
  const total = direct + me
  const directPct = total > 0 ? Math.round((direct / total) * 100) : 0
  const mePct = 100 - directPct
  return (
    <div className="card" style={{ marginBottom: 20, padding: '14px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <span className="stat-label" style={{ marginBottom: 0, minWidth: 120 }}>Connection type</span>
        <div style={{ display: 'flex', flex: 1, gap: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ok)', flexShrink: 0 }} />
            <span className="text-muted" style={{ fontSize: 12 }}>ME</span>
            <span className="font-mono" style={{ fontSize: 13, fontWeight: 600 }}>{me.toLocaleString()}</span>
            <span className="text-muted" style={{ fontSize: 11 }}>({mePct}%)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#60a5fa', flexShrink: 0 }} />
            <span className="text-muted" style={{ fontSize: 12 }}>Direct</span>
            <span className="font-mono" style={{ fontSize: 13, fontWeight: 600 }}>{direct.toLocaleString()}</span>
            <span className="text-muted" style={{ fontSize: 11 }}>({directPct}%)</span>
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ flex: '0 0 160px', height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ display: 'flex', height: '100%' }}>
            <div style={{ width: `${mePct}%`, background: 'var(--ok)', transition: 'width 0.3s' }} />
            <div style={{ width: `${directPct}%`, background: '#60a5fa', transition: 'width 0.3s' }} />
          </div>
        </div>
      </div>
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
        const [s, t] = await Promise.all([
          getClusterSummary(),
          getClusterTopology(),
        ])
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
        <StatCard label="Live Connections" value={(summary?.total_live_connections ?? 0).toLocaleString()} icon />
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

      {/* Connection type split */}
      {summary && <ConnectionSplit summary={summary} />}

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
