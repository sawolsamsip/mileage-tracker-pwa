import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Trips from './pages/Trips'
import Vehicles from './pages/Vehicles'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import AuthTeslaCallback from './pages/AuthTeslaCallback'
import AuthSmartcarCallback from './pages/AuthSmartcarCallback'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth/tesla/callback" element={<AuthTeslaCallback />} />
        <Route path="/auth/smartcar/callback" element={<AuthSmartcarCallback />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="trips" element={<Trips />} />
          <Route path="vehicles" element={<Vehicles />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
