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

const FLAGS: Record<string, string> = {
  RU:'🇷🇺', DE:'🇩🇪', AT:'🇦🇹', FR:'🇫🇷', NL:'🇳🇱',
  FI:'🇫🇮', US:'🇺🇸', GB:'🇬🇧', PL:'🇵🇱', CZ:'🇨🇿',
}

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
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
            <h1 className="page-title">
              {flag && <span style={{ marginRight: 6 }}>{flag}</span>}
              {node.name}
            </h1>
            <p className="page-subtitle">{node.hostname}:{node.api_port} · telemt backend</p>
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
        <MetricCard label="Live Connections" value={node.live_connections.toLocaleString()} />
        <MetricCard
          label="ME Coverage"
          value={`${node.coverage_pct.toFixed(1)}%`}
          sub={`${node.alive_writers} alive writers`}
          color={coverageColor}
        />
        <MetricCard label="Traffic In"  value={fmtBytes(node.bytes_in)} />
        <MetricCard label="Traffic Out" value={fmtBytes(node.bytes_out)} />
      </div>

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
