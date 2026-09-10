import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { DashboardPage } from './pages/DashboardPage'
import { ExplorePage } from './pages/ExplorePage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { LoginPage } from './pages/LoginPage'
import { ProjectPage } from './pages/ProjectPage'
import { PublicProfilePage } from './pages/PublicProfilePage'
import { PublicProjectPage } from './pages/PublicProjectPage'
import { NodePage } from './pages/NodePage'
import { MePage } from './pages/MePage'
import { NewProjectPage } from './pages/NewProjectPage'
import { RegisterPage } from './pages/RegisterPage'
import { SettingsPage } from './pages/SettingsPage'
import { SmartContractsPage } from './pages/SmartContractsPage'
import { useExecStore } from './store/useExecStore'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/forgot-password" element={<ForgotPasswordRoute />} />
        <Route path="/register" element={<RegisterRoute />} />
        <Route element={<ProtectedApp />}>
          <Route index element={<DashboardPage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/explore/projects/:projectId" element={<PublicProjectPage />} />
          <Route path="/u/:handle" element={<PublicProfilePage />} />
          <Route path="/chains" element={<Navigate to="/projects/project-default" replace />} />
          <Route path="/projects/new" element={<NewProjectPage />} />
          <Route path="/projects/:projectId" element={<ProjectPage />} />
          <Route path="/goals/goal-product" element={<Navigate to="/projects/project-exec-graph" replace />} />
          <Route path="/goals/goal-writing" element={<Navigate to="/projects/project-writing" replace />} />
          <Route path="/contracts/:contractId" element={<NodePage />} />
          <Route path="/nodes/:contractId" element={<NodePage />} />
          <Route path="/me" element={<MePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/smart-contracts" element={<SmartContractsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

function ProtectedApp() {
  const isAuthenticated = useExecStore((state) => state.isAuthenticated)
  return isAuthenticated ? <AppShell /> : <Navigate to="/login" replace />
}

function LoginRoute() {
  const isAuthenticated = useExecStore((state) => state.isAuthenticated)
  return isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
}

function RegisterRoute() {
  const isAuthenticated = useExecStore((state) => state.isAuthenticated)
  return isAuthenticated ? <Navigate to="/" replace /> : <RegisterPage />
}

function ForgotPasswordRoute() {
  const isAuthenticated = useExecStore((state) => state.isAuthenticated)
  return isAuthenticated ? <Navigate to="/" replace /> : <ForgotPasswordPage />
}
