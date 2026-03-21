import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2, Power } from 'lucide-react'
import {
  getBackendNodes, getEntryNodes,
  patchBackendNode, patchEntryNode,
  deleteBackendNode, deleteEntryNode,
  type BackendNode, type EntryNode,
} from '../api'
import { Card } from '../components/Card'
import { StatusDot } from '../components/StatusDot'
import { AddNodeModal } from '../components/AddNodeModal'

const REGION_FLAGS: Record<string, string> = {
  RU: '🇷🇺', DE: '🇩🇪', AT: '🇦🇹', FR: '🇫🇷', NL: '🇳🇱',
  FI: '🇫🇮', US: '🇺🇸', GB: '🇬🇧', PL: '🇵🇱', CZ: '🇨🇿',
}

function fmtTime(s: string | null) {
  if (!s) return '—'
  const d = new Date(s)
  const diff = Date.now() - d.getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return d.toLocaleDateString()
}

export function Nodes() {
  const [backends, setBackends] = useState<BackendNode[]>([])
  const [entries, setEntries] = useState<EntryNode[]>([])
  const [showModal, setShowModal] = useState(false)
  const [tab, setTab] = useState<'backend' | 'entry'>('backend')

  const load = async () => {
    const [b, e] = await Promise.all([getBackendNodes(), getEntryNodes()])
    setBackends(b)
    setEntries(e)
  }

  useEffect(() => { load(); const id = setInterval(load, 15_000); return () => clearInterval(id) }, [])

  const toggleBackend = async (n: BackendNode) => {
    await patchBackendNode(n.id, { enabled: !n.enabled })
    load()
  }
  const removeBackend = async (id: string) => {
    if (!confirm('Remove this node?')) return
    await deleteBackendNode(id)
    load()
  }

  const toggleEntry = async (n: EntryNode) => {
    await patchEntryNode(n.id, { enabled: !n.enabled })
    load()
  }
  const removeEntry = async (id: string) => {
    if (!confirm('Remove this node?')) return
    await deleteEntryNode(id)
    load()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.4px' }}>Nodes</h1>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
            {backends.length} backend · {entries.length} entry
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            borderRadius: 6,
            border: 'none',
            background: 'var(--ok)',
            color: '#000',
            fontWeight: 600,
            fontSize: 12,
          }}
        >
          <Plus size={13} />
          Add Node
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        {(['backend', 'entry'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 16px',
              borderRadius: '6px 6px 0 0',
              border: 'none',
              background: 'none',
              color: tab === t ? 'var(--text)' : 'var(--text-muted)',
              borderBottom: tab === t ? '2px solid var(--ok)' : '2px solid transparent',
              fontSize: 13,
              marginBottom: -1,
            }}
          >
            {t === 'backend' ? `Backend (${backends.length})` : `Entry (${entries.length})`}
          </button>
        ))}
      </div>

      {tab === 'backend' && (
        <Card>
          {backends.length === 0 ? (
            <div style={{ padding: '24px 20px', color: 'var(--text-muted)', fontSize: 12 }}>
              No backend nodes yet. Click "Add Node" to add a telemt node.
            </div>
          ) : (
            <div className="table-scroll"><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Status', 'Name', 'Host', 'Connections', 'Coverage', 'Last Poll', ''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {backends.map(n => (
                  <tr
                    key={n.id}
                    style={{ borderBottom: '1px solid var(--border)', opacity: n.enabled ? 1 : 0.4 }}
                  >
                    <td style={{ padding: '10px 16px' }}>
                      <StatusDot status={n.status} />
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <Link to={`/nodes/backend/${n.id}`} style={{ fontSize: 12, fontWeight: 500 }}>
                        {REGION_FLAGS[n.region] && <span style={{ marginRight: 4 }}>{REGION_FLAGS[n.region]}</span>}
                        {n.name}
                      </Link>
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontSize: 12 }}>
                      {n.hostname}:{n.api_port}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12 }}>
                      {n.live_connections.toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12 }}>
                      <span style={{ color: n.coverage_pct >= 80 ? 'var(--ok)' : n.coverage_pct >= 50 ? 'var(--warn)' : 'var(--down)' }}>
                        {n.coverage_pct.toFixed(1)}%
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontSize: 12 }}>
                      {fmtTime(n.last_polled_at)}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => toggleBackend(n)}
                          title={n.enabled ? 'Disable' : 'Enable'}
                          style={{ background: 'none', border: 'none', color: n.enabled ? 'var(--text-muted)' : 'var(--warn)', display: 'flex' }}
                        >
                          <Power size={13} />
                        </button>
                        <button
                          onClick={() => removeBackend(n.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', display: 'flex' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </Card>
      )}

      {tab === 'entry' && (
        <Card>
          {entries.length === 0 ? (
            <div style={{ padding: '24px 20px', color: 'var(--text-muted)', fontSize: 12 }}>
              No entry nodes yet. Click "Add Node" to add an HAProxy entry point.
            </div>
          ) : (
            <div className="table-scroll"><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Status', 'Name', 'Host', 'Sessions', 'Backends', 'Last Poll', ''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map(n => (
                  <tr
                    key={n.id}
                    style={{ borderBottom: '1px solid var(--border)', opacity: n.enabled ? 1 : 0.4 }}
                  >
                    <td style={{ padding: '10px 16px' }}>
                      <StatusDot status={n.status} />
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <Link to={`/nodes/entry/${n.id}`} style={{ fontSize: 12, fontWeight: 500 }}>
                        {REGION_FLAGS[n.region] && <span style={{ marginRight: 4 }}>{REGION_FLAGS[n.region]}</span>}
                        {n.name}
                      </Link>
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontSize: 12 }}>
                      {n.hostname}:{n.stats_port}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12 }}>
                      {n.current_sessions.toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12 }}>
                      <span style={{ color: 'var(--ok)' }}>{n.backends_up} up</span>
                      {n.backends_down > 0 && (
                        <span style={{ color: 'var(--down)', marginLeft: 4 }}>/ {n.backends_down} down</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontSize: 12 }}>
                      {fmtTime(n.last_polled_at)}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => toggleEntry(n)}
                          style={{ background: 'none', border: 'none', color: n.enabled ? 'var(--text-muted)' : 'var(--warn)', display: 'flex' }}
                        >
                          <Power size={13} />
                        </button>
                        <button
                          onClick={() => removeEntry(n.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', display: 'flex' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </Card>
      )}

      {showModal && (
        <AddNodeModal
          onClose={() => setShowModal(false)}
          onCreated={load}
        />
      )}
    </div>
  )
}
