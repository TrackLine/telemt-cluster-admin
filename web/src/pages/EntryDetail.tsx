import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getEntryNodes, type EntryNode } from '../api'
import { Card } from '../components/Card'
import { StatusDot } from '../components/StatusDot'
import { MetricChart } from '../components/MetricChart'

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1_073_741_824) return `${(b / 1_048_576).toFixed(1)} MB`
  return `${(b / 1_073_741_824).toFixed(2)} GB`
}

const REGION_FLAGS: Record<string, string> = {
  RU: '🇷🇺', DE: '🇩🇪', AT: '🇦🇹', FR: '🇫🇷', NL: '🇳🇱',
  FI: '🇫🇮', US: '🇺🇸', GB: '🇬🇧', PL: '🇵🇱', CZ: '🇨🇿',
}

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <Card style={{ padding: '16px 20px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px', color: color || 'var(--text)' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </Card>
  )
}

export function EntryDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [node, setNode] = useState<EntryNode | null>(null)

  const load = async () => {
    const nodes = await getEntryNodes()
    const n = nodes.find(n => n.id === id)
    if (!n) { navigate('/nodes'); return }
    setNode(n)
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 15_000)
    return () => clearInterval(t)
  }, [id])

  if (!node) return null

  const flag = REGION_FLAGS[node.region] || ''
  const backendStatus = node.backends_up > 0
    ? (node.backends_down > 0 ? 'warn' : 'ok')
    : 'down'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link to="/nodes" style={{ color: 'var(--text-muted)', display: 'flex' }}>
          <ArrowLeft size={16} />
        </Link>
        <StatusDot status={node.status} pulse={node.status === 'ok'} size={8} />
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.4px' }}>
            {flag && <span style={{ marginRight: 6 }}>{flag}</span>}
            {node.name}
          </h1>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
            {node.hostname}:{node.stats_port} · HAProxy entry
          </div>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <MetricCard
          label="Current Sessions"
          value={node.current_sessions.toLocaleString()}
        />
        <MetricCard
          label="Total Connections"
          value={node.total_connections.toLocaleString()}
        />
        <MetricCard
          label="Backends"
          value={`${node.backends_up} UP`}
          sub={node.backends_down > 0 ? `${node.backends_down} DOWN` : 'all healthy'}
          color={backendStatus === 'ok' ? 'var(--ok)' : backendStatus === 'warn' ? 'var(--warn)' : 'var(--down)'}
        />
        <MetricCard
          label="Throughput"
          value={fmtBytes(node.bytes_in + node.bytes_out)}
          sub="↑ + ↓"
        />
      </div>

      <div className="two-col-grid">
        <Card style={{ padding: 20 }}>
          <MetricChart
            nodeId={node.id}
            metric="current_sessions"
            label="Current Sessions"
            color="var(--ok)"
          />
        </Card>
        <Card style={{ padding: 20 }}>
          <MetricChart
            nodeId={node.id}
            metric="bytes_in"
            label="Traffic In"
            color="#60a5fa"
            format={fmtBytes}
          />
        </Card>
      </div>
    </div>
  )
}
