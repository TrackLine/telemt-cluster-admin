import { useState } from 'react'
import type { FormEvent } from 'react'
import { Activity } from 'lucide-react'
import { authLogin } from '../api'

interface Props { onSuccess: () => void }

export function Login({ onSuccess }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await authLogin(username, password)
      onSuccess()
    } catch {
      setError('Неверный логин или пароль')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Activity size={20} color="var(--ok)" strokeWidth={2.5} />
            <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.4px' }}>Telemt Cluster Admin</span>
          </div>
          <div className="text-muted" style={{ fontSize: 13 }}>MTProto monitor</div>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: '28px 28px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, textAlign: 'center', marginBottom: 22 }}>Вход</h2>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="field">
              <label className="field-label">Логин</label>
              <input
                className="input"
                type="text"
                autoComplete="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="admin"
                required
              />
            </div>

            <div className="field">
              <label className="field-label">Пароль</label>
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div style={{
                padding: '9px 12px', borderRadius: 'var(--r-sm)', fontSize: 13,
                background: 'var(--down-dim)', border: '1px solid var(--down-border)', color: 'var(--down)',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '10px', marginTop: 4, fontSize: 13 }}
            >
              {loading ? 'Вход…' : 'Войти'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
