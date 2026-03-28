import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getBackendNodes, type BackendNode } from '../api'
import { Card, CardHead } from '../components/Card'
import { StatusDot, StatusBadge } from '../components/StatusDot'
import { MetricChart } from '../components/MetricChart'

function fmtBytes(b: number) {
  if (b < 1024)          return `${b} B`
  if (b < 1_048_576)     return `${(b / 1024).toFixed(1)} KB`
  if (b < 1_073_741_824) return `${(b / 1_048_576).toFixed(1)} MB`
  return `${(b / 1_073_741_824).toFixed(2)} GB`
}

function fmtUptime(seconds: number): string {
  if (!seconds || seconds <= 0) return '—'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts = []
  if (d > 0) parts.push(`${d}д`)
  if (h > 0) parts.push(`${h}ч`)
  if (m > 0 || parts.length === 0) parts.push(`${m}м`)
  return parts.join(' ')
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

function MetricCard({ label, value, sub, color, icon }: { label: string; value: string; sub?: string; color?: string; icon?: boolean }) {
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

function LatencyHistogram({ node }: { node: BackendNode }) {
  const buckets = [
    { label: '<100ms',    value: node.latency_lte_100ms ?? 0,  color: 'var(--ok)' },
    { label: '100–500ms', value: node.latency_101_500ms ?? 0,  color: 'var(--warn)' },
    { label: '500ms–1s',  value: node.latency_501_1000ms ?? 0, color: '#f97316' },
    { label: '>1s',       value: node.latency_gt_1000ms ?? 0,  color: 'var(--down)' },
  ]
  const total = buckets.reduce((s, b) => s + b.value, 0)
  if (total === 0) return (
    <div className="text-muted" style={{ fontSize: 12, padding: '8px 0' }}>Нет данных о задержках</div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {buckets.map(b => {
        const pct = total > 0 ? Math.round((b.value / total) * 100) : 0
        return (
          <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="text-muted font-mono" style={{ fontSize: 11, minWidth: 72 }}>{b.label}</span>
            <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: b.color, borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
            <span className="font-mono text-muted" style={{ fontSize: 11, minWidth: 32, textAlign: 'right' }}>{pct}%</span>
          </div>
        )
      })}
    </div>
  )
}

export function BackendDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [node, setNode] = useState<BackendNode | null>(null)

  useEffect(() => {
    const load = async () => {
      const nodes = await getBackendNodes()
      const n = nodes.find(n => n.id === id)
      if (!n) { navigate('/nodes'); return }
      setNode(n)
    }
    load()
    const t = setInterval(load, 15_000)
    return () => clearInterval(t)
  }, [id])

  if (!node) return null

  const flag = FLAGS[node.region] ?? ''
  const coverageColor = node.coverage_pct >= 80 ? 'var(--ok)' : node.coverage_pct >= 50 ? 'var(--warn)' : 'var(--down)'

  return (
    <div>
      <Link to="/nodes" className="back-link">
        <ArrowLeft size={14} /> Nodes
      </Link>

      <div className="page-header">
        <div className="flex-center gap-3">
          <StatusDot status={node.status} pulse={node.status === 'ok'} size={9} />
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {flag && <span style={{ marginRight: 2 }}>{flag}</span>}
              {node.name}
              {node.read_only && (
                <span style={{
                  fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 4,
                  background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.2)',
                  color: 'var(--text-muted)', letterSpacing: '0.3px',
                }}>Read-only</span>
              )}
              {!node.accepting_connections && node.accepting_connections !== undefined && (
                <span style={{
                  fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 4,
                  background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)',
                  color: 'var(--warn)', letterSpacing: '0.3px',
                }}>Not accepting</span>
              )}
            </h1>
            <p className="page-subtitle">
              {node.hostname}:{node.api_port} · telemt backend
              {node.uptime_seconds > 0 && (
                <span className="text-muted"> · uptime {fmtUptime(node.uptime_seconds)}</span>
              )}
            </p>
          </div>
        </div>
        <StatusBadge status={node.status} />
      </div>

      {node.draining && (
        <div className="alert alert-warn mb-4">
          <span>⚠</span>
          <span>Нода в режиме drain — новые подключения не принимаются</span>
        </div>
      )}

      <div className="metric-grid">
        <MetricCard label="Live Connections" value={node.live_connections.toLocaleString()} icon />
        <MetricCard
          label="ME Coverage"
          value={`${node.coverage_pct.toFixed(1)}%`}
          sub={`${node.alive_writers} alive writers`}
          color={coverageColor}
        />
        <MetricCard label="Traffic In"  value={fmtBytes(node.bytes_in)} />
        <MetricCard label="Traffic Out" value={fmtBytes(node.bytes_out)} />
      </div>

      {/* Connection type + Latency histogram */}
      {((node.direct_connections ?? 0) > 0 || (node.me_connections ?? 0) > 0 ||
        (node.latency_lte_100ms ?? 0) > 0) && (
        <div className="two-col-grid" style={{ marginBottom: 20 }}>
          {/* Connection split */}
          {((node.direct_connections ?? 0) + (node.me_connections ?? 0)) > 0 && (
            <Card>
              <CardHead title="Connection Type" />
              <div className="card-body">
                <div style={{ display: 'flex', gap: 24 }}>
                  <div>
                    <div className="stat-label">ME</div>
                    <div className="stat-value" style={{ fontSize: 20, color: 'var(--ok)' }}>
                      {(node.me_connections ?? 0).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="stat-label">Direct</div>
                    <div className="stat-value" style={{ fontSize: 20, color: '#60a5fa' }}>
                      {(node.direct_connections ?? 0).toLocaleString()}
                    </div>
                  </div>
                  {(node.handshake_timeouts ?? 0) > 0 && (
                    <div>
                      <div className="stat-label">HS Timeouts</div>
                      <div className="stat-value" style={{ fontSize: 20, color: 'var(--warn)' }}>
                        {node.handshake_timeouts.toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Latency histogram */}
          <Card>
            <CardHead title="Upstream Latency" />
            <div className="card-body">
              <LatencyHistogram node={node} />
            </div>
          </Card>
        </div>
      )}

      <div className="two-col-grid">
        <Card>
          <CardHead title="Live Connections" />
          <div className="card-body">
            <MetricChart nodeId={node.id} metric="live_connections" label="Connections" color="var(--ok)" />
          </div>
        </Card>
        <Card>
          <CardHead title="ME Coverage %" />
          <div className="card-body">
            <MetricChart nodeId={node.id} metric="coverage_pct" label="Coverage" color="var(--warn)" format={v => `${v.toFixed(1)}%`} />
          </div>
        </Card>
        <Card>
          <CardHead title="Traffic In" />
          <div className="card-body">
            <MetricChart nodeId={node.id} metric="bytes_in" label="Bytes in" color="#60a5fa" format={fmtBytes} />
          </div>
        </Card>
        <Card>
          <CardHead title="Traffic Out" />
          <div className="card-body">
            <MetricChart nodeId={node.id} metric="bytes_out" label="Bytes out" color="#a78bfa" format={fmtBytes} />
          </div>
        </Card>
      </div>
    </div>
  )
}
