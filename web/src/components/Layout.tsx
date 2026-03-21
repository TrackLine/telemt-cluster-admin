import { Link, useLocation } from 'react-router-dom'
import { Activity, Server, LayoutGrid, Map } from 'lucide-react'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid },
  { to: '/nodes', label: 'Nodes', icon: Server },
  { to: '/geography', label: 'Geography', icon: Map },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()

  const isActive = (to: string) => to === '/' ? pathname === '/' : pathname.startsWith(to)

  return (
    <div className="app-layout">
      {/* Desktop Sidebar */}
      <aside className="app-sidebar">
        {/* Logo */}
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={16} color="var(--ok)" />
            <span style={{ fontWeight: 600, fontSize: 13, letterSpacing: '-0.3px' }}>Proxy admin</span>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>MTProto monitor</div>
        </div>
        <nav style={{ flex: 1, padding: '4px 8px' }}>
          {nav.map(({ to, label, icon: Icon }) => {
            const active = isActive(to)
            return (
              <Link
                key={to}
                to={to}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 12px', borderRadius: 6,
                  color: active ? 'var(--text)' : 'var(--text-muted)',
                  background: active ? 'var(--bg-hover)' : 'transparent',
                  marginBottom: 2, transition: 'all 0.1s',
                }}
              >
                <Icon size={14} />
                <span style={{ fontSize: 13 }}>{label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Mobile top bar + main content + mobile bottom nav */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <div className="mobile-topbar">
          <Activity size={14} color="var(--ok)" />
          <span style={{ fontWeight: 600, fontSize: 13 }}>Proxy admin</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 2 }}>· MTProto</span>
        </div>

        {/* Main content */}
        <main className="app-main">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="mobile-bottom-nav">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = isActive(to)
            return (
              <Link
                key={to}
                to={to}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 4,
                  color: active ? 'var(--ok)' : 'var(--text-muted)',
                  fontSize: 10, fontWeight: active ? 600 : 400,
                  transition: 'color 0.15s',
                  textDecoration: 'none',
                }}
              >
                <Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
                {label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
