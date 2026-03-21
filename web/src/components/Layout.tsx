import { Link, useLocation } from 'react-router-dom'
import { Activity, Server, LayoutGrid, Map, LogOut } from 'lucide-react'
import { authLogout } from '../api'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid },
  { to: '/nodes', label: 'Nodes', icon: Server },
  { to: '/geography', label: 'Geography', icon: Map },
]

interface Props {
  children: React.ReactNode
  onLogout: () => void
}

export function Layout({ children, onLogout }: Props) {
  const { pathname } = useLocation()
  const isActive = (to: string) => to === '/' ? pathname === '/' : pathname.startsWith(to)

  const handleLogout = async () => {
    try { await authLogout() } catch { /* ignore */ }
    onLogout()
  }

  return (
    <div className="app-layout">
      {/* ── Desktop sidebar ── */}
      <aside className="app-sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-brand">
            <Activity size={15} color="var(--ok)" strokeWidth={2.5} />
            Proxy admin
          </div>
          <div className="sidebar-sub">MTProto monitor</div>
        </div>

        <nav className="sidebar-nav">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = isActive(to)
            return (
              <Link key={to} to={to} className={`sidebar-link${active ? ' active' : ''}`}>
                <Icon size={14} strokeWidth={active ? 2.5 : 2} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-logout" onClick={handleLogout}>
            <LogOut size={14} />
            Выйти
          </button>
        </div>
      </aside>

      {/* ── Mobile content wrapper ── */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        {/* Mobile top bar */}
        <div className="mobile-topbar">
          <Activity size={14} color="var(--ok)" strokeWidth={2.5} />
          <span style={{ fontWeight: 600, fontSize: 13 }}>Proxy admin</span>
          <span className="text-muted" style={{ fontSize: 11 }}>· MTProto</span>
          <button
            onClick={handleLogout}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
          >
            <LogOut size={15} />
          </button>
        </div>

        <main className="app-main">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="mobile-bottom-nav">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = isActive(to)
            return (
              <Link key={to} to={to} className={`mobile-nav-item${active ? ' active' : ''}`}>
                <Icon size={19} strokeWidth={active ? 2.5 : 1.8} />
                {label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
