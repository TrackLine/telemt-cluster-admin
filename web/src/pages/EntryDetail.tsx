import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getEntryNodes, type EntryNode } from '../api'
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

export function EntryDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [node, setNode] = useState<EntryNode | null>(null)

  useEffect(() => {
    const load = async () => {
      const nodes = await getEntryNodes()
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
  const backendColor = node.backends_up > 0
    ? (node.backends_down > 0 ? 'var(--warn)' : 'var(--ok)')
    : 'var(--down)'

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
            <p className="page-subtitle">{node.hostname}:{node.stats_port} · HAProxy entry</p>
          </div>
        </div>
        <StatusBadge status={node.status} />
      </div>

      <div className="metric-grid">
        <MetricCard label="Current Sessions"  value={node.current_sessions.toLocaleString()} />
        <MetricCard label="Total Connections" value={node.total_connections.toLocaleString()} />
        <MetricCard
          label="Backends"
          value={`${node.backends_up} UP`}
          sub={node.backends_down > 0 ? `${node.backends_down} DOWN` : 'all healthy'}
          color={backendColor}
        />
        <MetricCard label="Трафик" value={fmtBytes(node.bytes_in + node.bytes_out)} sub="↑ + ↓" />
      </div>

      <div className="two-col-grid">
        <Card>
          <CardHead title="Current Sessions" />
          <div className="card-body">
            <MetricChart nodeId={node.id} metric="current_sessions" label="Sessions" color="var(--ok)" />
          </div>
        </Card>
        <Card>
          <CardHead title="Traffic In" />
          <div className="card-body">
            <MetricChart nodeId={node.id} metric="bytes_in" label="Bytes in" color="#60a5fa" format={fmtBytes} />
          </div>
        </Card>
      </div>
    </div>
  )
}
