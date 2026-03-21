import { useState } from 'react'
import { X, Loader } from 'lucide-react'
import { createBackendNode, createEntryNode, testBackendNode, testEntryNode } from '../api'

const REGIONS = ['RU', 'DE', 'AT', 'FR', 'NL', 'FI', 'US', 'GB', 'PL', 'CZ', '']

interface Props {
  onClose: () => void
  onCreated: () => void
}

export function AddNodeModal({ onClose, onCreated }: Props) {
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
    if (!name || !hostname) {
      setError('Name and hostname are required')
      return
    }
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
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: 24,
          width: '90vw',
          maxWidth: 480,
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontWeight: 600 }}>Add Node</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Type selector */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {(['backend', 'entry'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setType(t); setPort(''); setTestResult(null) }}
              style={{
                flex: 1,
                padding: '7px 0',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: type === t ? 'var(--bg-hover)' : 'transparent',
                color: type === t ? 'var(--text)' : 'var(--text-muted)',
                fontSize: 12,
              }}
            >
              {t === 'backend' ? 'Backend (telemt)' : 'Entry (HAProxy)'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field label="Name" value={name} onChange={setName} placeholder="de-fra-01" />
          <Field label="Hostname / IP" value={hostname} onChange={setHostname} placeholder="1.2.3.4" />
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <FieldLabel>Region</FieldLabel>
              <select
                value={region}
                onChange={e => setRegion(e.target.value)}
                style={inputStyle}
              >
                {REGIONS.map(r => <option key={r} value={r}>{r || '—'}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <Field
                label={`Port (default ${defaultPort})`}
                value={port}
                onChange={setPort}
                placeholder={String(defaultPort)}
                type="number"
              />
            </div>
          </div>
        </div>

        {/* Test */}
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={handleTest}
            disabled={!hostname || testing}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-muted)',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {testing && <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} />}
            Test Connection
          </button>
          {testResult && (
            <span style={{ fontSize: 12, color: testResult.ok ? 'var(--ok)' : 'var(--down)' }}>
              {testResult.ok ? '✓ Connected' : `✗ ${testResult.error}`}
            </span>
          )}
        </div>

        {error && (
          <div style={{ marginTop: 10, color: 'var(--down)', fontSize: 12 }}>{error}</div>
        )}

        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              padding: '7px 16px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-muted)',
              fontSize: 12,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving}
            style={{
              padding: '7px 16px',
              borderRadius: 6,
              border: 'none',
              background: 'var(--ok)',
              color: '#000',
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            {saving ? 'Adding…' : 'Add Node'}
          </button>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text)',
  outline: 'none',
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>
      {children}
    </div>
  )
}

function Field({
  label, value, onChange, placeholder, type = 'text',
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
    </div>
  )
}
