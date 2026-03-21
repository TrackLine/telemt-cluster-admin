import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Nodes } from './pages/Nodes'
import { BackendDetail } from './pages/BackendDetail'
import { EntryDetail } from './pages/EntryDetail'
import { Geography } from './pages/Geography'

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/nodes" element={<Nodes />} />
          <Route path="/nodes/backend/:id" element={<BackendDetail />} />
          <Route path="/nodes/entry/:id" element={<EntryDetail />} />
          <Route path="/geography" element={<Geography />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
