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
import { useClusterMode } from '../context/ClusterMode'

const FLAGS: Record<string, string> = {
  RU:'🇷🇺', DE:'🇩🇪', AT:'🇦🇹', FR:'🇫🇷', NL:'🇳🇱',
  FI:'🇫🇮', US:'🇺🇸', GB:'🇬🇧', PL:'🇵🇱', CZ:'🇨🇿',
}

function fmtTime(s: string | null) {
  if (!s) return '—'
  const d = new Date(s)
  const diff = Date.now() - d.getTime()
  if (diff < 60_000)     return 'только что'
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}м назад`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}ч назад`
  return d.toLocaleDateString('ru')
}

export function Nodes() {
  const clusterMode = useClusterMode()
  const [backends, setBackends] = useState<BackendNode[]>([])
  const [entries, setEntries]   = useState<EntryNode[]>([])
  const [showModal, setShowModal] = useState(false)
  const [tab, setTab] = useState<'backend' | 'entry'>('backend')

  const load = async () => {
    const [b, e] = await Promise.all([getBackendNodes(), getEntryNodes()])
    setBackends(b)
    setEntries(e)
  }

  useEffect(() => { load(); const id = setInterval(load, 15_000); return () => clearInterval(id) }, [])

  const toggleBackend = async (n: BackendNode) => { await patchBackendNode(n.id, { enabled: !n.enabled }); load() }
  const removeBackend = async (id: string)    => { if (!confirm('Удалить ноду?')) return; await deleteBackendNode(id); load() }
  const toggleEntry   = async (n: EntryNode)  => { await patchEntryNode(n.id, { enabled: !n.enabled }); load() }
  const removeEntry   = async (id: string)    => { if (!confirm('Удалить ноду?')) return; await deleteEntryNode(id); load() }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Nodes</h1>
          <p className="page-subtitle">
            {clusterMode === 'simple'
              ? `${backends.length} backend`
              : `${backends.length} backend · ${entries.length} entry`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={13} strokeWidth={2.5} />
          Add Node
        </button>
      </div>

      {/* Tabs */}
      {clusterMode === 'full' && (
        <div className="tabs">
          {(['backend', 'entry'] as const).map(t => (
            <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
              {t === 'backend' ? `Backend (${backends.length})` : `Entry (${entries.length})`}
            </button>
          ))}
        </div>
      )}

      {/* Backend table */}
      {(tab === 'backend' || clusterMode === 'simple') && (
        <Card>
          {backends.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🖥</div>
              <div className="empty-state-title">Нет backend-нод</div>
              <div className="empty-state-body">Нажмите «Add Node» чтобы добавить telemt-ноду</div>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}></th>
                    <th>Название</th>
                    <th className="col-hide-sm">Хост</th>
                    <th>Connections</th>
                    <th className="col-hide-sm">Coverage</th>
                    <th className="col-hide-sm">Опрос</th>
                    <th style={{ width: 72 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {backends.map(n => (
                    <tr key={n.id} style={{ opacity: n.enabled ? 1 : 0.45 }}>
                      <td><StatusDot status={n.status} pulse={n.status === 'ok'} /></td>
                      <td>
                        <Link to={`/nodes/backend/${n.id}`} style={{ fontWeight: 500 }}>
                          {FLAGS[n.region] && <span style={{ marginRight: 4 }}>{FLAGS[n.region]}</span>}
                          {n.name}
                        </Link>
                      </td>
                      <td className="col-hide-sm text-muted" style={{ fontSize: 12 }}>
                        {n.hostname}:{n.api_port}
                      </td>
                      <td className="font-mono">{n.live_connections.toLocaleString()}</td>
                      <td className="col-hide-sm">
                        <span style={{
                          color: n.coverage_pct >= 80 ? 'var(--ok)' : n.coverage_pct >= 50 ? 'var(--warn)' : 'var(--down)',
                          fontWeight: 500,
                        }}>
                          {n.coverage_pct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="col-hide-sm text-muted" style={{ fontSize: 12 }}>{fmtTime(n.last_polled_at)}</td>
                      <td>
                        <div className="flex-center gap-1">
                          <button
                            className={`btn-icon${!n.enabled ? ' warn' : ''}`}
                            onClick={() => toggleBackend(n)}
                            title={n.enabled ? 'Отключить' : 'Включить'}
                          >
                            <Power size={13} />
                          </button>
                          <button className="btn-icon" onClick={() => removeBackend(n.id)} title="Удалить">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Entry table */}
      {tab === 'entry' && clusterMode === 'full' && (
        <Card>
          {entries.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔀</div>
              <div className="empty-state-title">Нет entry-нод</div>
              <div className="empty-state-body">Нажмите «Add Node» чтобы добавить HAProxy entry point</div>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}></th>
                    <th>Название</th>
                    <th className="col-hide-sm">Хост</th>
                    <th>Sessions</th>
                    <th className="col-hide-sm">Backends</th>
                    <th className="col-hide-sm">Опрос</th>
                    <th style={{ width: 72 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(n => (
                    <tr key={n.id} style={{ opacity: n.enabled ? 1 : 0.45 }}>
                      <td><StatusDot status={n.status} pulse={n.status === 'ok'} /></td>
                      <td>
                        <Link to={`/nodes/entry/${n.id}`} style={{ fontWeight: 500 }}>
                          {FLAGS[n.region] && <span style={{ marginRight: 4 }}>{FLAGS[n.region]}</span>}
                          {n.name}
                        </Link>
                      </td>
                      <td className="col-hide-sm text-muted" style={{ fontSize: 12 }}>
                        {n.hostname}:{n.stats_port}
                      </td>
                      <td className="font-mono">{n.current_sessions.toLocaleString()}</td>
                      <td className="col-hide-sm">
                        <span className="text-ok">{n.backends_up} up</span>
                        {n.backends_down > 0 && (
                          <span className="text-down" style={{ marginLeft: 6 }}>/{n.backends_down} down</span>
                        )}
                      </td>
                      <td className="col-hide-sm text-muted" style={{ fontSize: 12 }}>{fmtTime(n.last_polled_at)}</td>
                      <td>
                        <div className="flex-center gap-1">
                          <button
                            className={`btn-icon${!n.enabled ? ' warn' : ''}`}
                            onClick={() => toggleEntry(n)}
                            title={n.enabled ? 'Отключить' : 'Включить'}
                          >
                            <Power size={13} />
                          </button>
                          <button className="btn-icon" onClick={() => removeEntry(n.id)} title="Удалить">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {showModal && <AddNodeModal onClose={() => setShowModal(false)} onCreated={load} />}
    </div>
  )
}
