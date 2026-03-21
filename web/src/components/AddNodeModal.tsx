import { useState } from 'react'
import { X, Loader } from 'lucide-react'
import { createBackendNode, createEntryNode, testBackendNode, testEntryNode } from '../api'
import { useClusterMode } from '../context/ClusterMode'

const REGIONS = ['DE', 'AT', 'FR', 'NL', 'FI', 'US', 'GB', 'PL', 'CZ', 'RU', '']

interface Props {
  onClose: () => void
  onCreated: () => void
}

export function AddNodeModal({ onClose, onCreated }: Props) {
  const clusterMode = useClusterMode()
  const [type, setType] = useState<'backend' | 'entry'>('backend')
  const [name, setName] = useState('')
  const [hostname, setHostname] = useState('')
  const [region, setRegion] = useState('')
  const [port, setPort] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const defaultPort = type === 'backend' ? 9091 : 8404

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const p = port ? parseInt(port) : defaultPort
      const res = type === 'backend'
        ? await testBackendNode(hostname, p)
        : await testEntryNode(hostname, p)
      setTestResult(res)
    } catch (e: any) {
      setTestResult({ ok: false, error: e.message })
    }
    setTesting(false)
  }

  const handleCreate = async () => {
    if (!name || !hostname) { setError('Имя и хост обязательны'); return }
    setSaving(true)
    setError('')
    try {
      const p = port ? parseInt(port) : defaultPort
      if (type === 'backend') {
        await createBackendNode({ name, hostname, region, api_port: p })
      } else {
        await createEntryNode({ name, hostname, region, stats_port: p })
      }
      onCreated()
      onClose()
    } catch (e: any) {
      setError(e.message)
    }
    setSaving(false)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200, padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-med)',
        borderRadius: 'var(--r-lg)',
        padding: 24,
        width: '100%',
        maxWidth: 460,
        maxHeight: '90dvh',
        overflow: 'auto',
      }}>
        {/* Header */}
        <div className="flex-between" style={{ marginBottom: 20 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Add Node</span>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Type selector — hidden in simple mode */}
        {clusterMode === 'full' && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
            {(['backend', 'entry'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setType(t); setPort(''); setTestResult(null) }}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 'var(--r-sm)',
                  border: `1px solid ${type === t ? 'var(--border-med)' : 'var(--border)'}`,
                  background: type === t ? 'var(--bg-elevated)' : 'transparent',
                  color: type === t ? 'var(--text)' : 'var(--text-muted)',
                  fontSize: 12, fontWeight: type === t ? 500 : 400,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {t === 'backend' ? 'Backend (telemt)' : 'Entry (HAProxy)'}
              </button>
            ))}
          </div>
        )}

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field">
            <label className="field-label">Название</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="de-fra-01" />
          </div>
          <div className="field">
            <label className="field-label">Hostname / IP</label>
            <input className="input" value={hostname} onChange={e => setHostname(e.target.value)} placeholder="1.2.3.4" />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="field" style={{ flex: 1 }}>
              <label className="field-label">Регион</label>
              <select className="select-input" value={region} onChange={e => setRegion(e.target.value)}>
                {REGIONS.map(r => <option key={r} value={r}>{r || '—'}</option>)}
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label className="field-label">Порт (по умолч. {defaultPort})</label>
              <input className="input" type="number" value={port} onChange={e => setPort(e.target.value)} placeholder={String(defaultPort)} />
            </div>
          </div>
        </div>

        {/* Test connection */}
        <div className="flex-center gap-3" style={{ marginTop: 16 }}>
          <button
            className="btn btn-ghost"
            onClick={handleTest}
            disabled={!hostname || testing}
          >
            {testing
              ? <><Loader size={12} className="spin" /> Проверка…</>
              : 'Test Connection'}
          </button>
          {testResult && (
            <span style={{ fontSize: 12, color: testResult.ok ? 'var(--ok)' : 'var(--down)' }}>
              {testResult.ok ? '✓ Подключено' : `✗ ${testResult.error}`}
            </span>
          )}
        </div>

        {error && (
          <div style={{ marginTop: 12, color: 'var(--down)', fontSize: 12, padding: '8px 12px', background: 'var(--down-dim)', borderRadius: 'var(--r-sm)', border: '1px solid var(--down-border)' }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex-center" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
            {saving ? 'Добавление…' : 'Add Node'}
          </button>
        </div>
      </div>
    </div>
  )
}
