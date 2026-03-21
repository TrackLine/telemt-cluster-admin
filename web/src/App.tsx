import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Nodes } from './pages/Nodes'
import { BackendDetail } from './pages/BackendDetail'
import { EntryDetail } from './pages/EntryDetail'
import { Geography } from './pages/Geography'
import { Login } from './pages/Login'
import { getAuthStatus, getAppConfig } from './api'
import { ClusterModeContext, type ClusterMode } from './context/ClusterMode'

type AuthState = 'loading' | 'login' | 'ok'

export default function App() {
  const [authState, setAuthState] = useState<AuthState>('loading')
  const [clusterMode, setClusterMode] = useState<ClusterMode>('full')

  const checkAuth = () => {
    getAuthStatus()
      .then(s => {
        if (s.authenticated) {
          // Load cluster config right after confirming auth
          getAppConfig()
            .then(c => setClusterMode(c.cluster_mode))
            .catch(() => {})
          setAuthState('ok')
        } else {
          setAuthState('login')
        }
      })
      .catch(() => setAuthState('login'))
  }

  useEffect(() => { checkAuth() }, [])

  if (authState === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text-muted)', fontSize: 14 }}>
        Loading…
      </div>
    )
  }

  if (authState === 'login') {
    return <Login onSuccess={() => { checkAuth() }} />
  }

  return (
    <ClusterModeContext.Provider value={clusterMode}>
      <BrowserRouter>
        <Layout onLogout={() => setAuthState('login')}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/nodes" element={<Nodes />} />
            <Route path="/nodes/backend/:id" element={<BackendDetail />} />
            <Route path="/nodes/entry/:id" element={<EntryDetail />} />
            <Route path="/geography" element={<Geography />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ClusterModeContext.Provider>
  )
}
