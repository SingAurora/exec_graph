import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { useExecStore } from './store/useExecStore'

const DashboardPage = lazy(async () => ({ default: (await import('./pages/DashboardPage')).DashboardPage }))
const ExplorePage = lazy(async () => ({ default: (await import('./pages/ExplorePage')).ExplorePage }))
const ForgotPasswordPage = lazy(async () => ({ default: (await import('./pages/ForgotPasswordPage')).ForgotPasswordPage }))
const LoginPage = lazy(async () => ({ default: (await import('./pages/LoginPage')).LoginPage }))
const ProjectPage = lazy(async () => ({ default: (await import('./pages/ProjectPage')).ProjectPage }))
const PublicProfilePage = lazy(async () => ({ default: (await import('./pages/PublicProfilePage')).PublicProfilePage }))
const PublicProjectPage = lazy(async () => ({ default: (await import('./pages/PublicProjectPage')).PublicProjectPage }))
const NodePage = lazy(async () => ({ default: (await import('./pages/NodePage')).NodePage }))
const MePage = lazy(async () => ({ default: (await import('./pages/MePage')).MePage }))
const NewProjectPage = lazy(async () => ({ default: (await import('./pages/NewProjectPage')).NewProjectPage }))
const RegisterPage = lazy(async () => ({ default: (await import('./pages/RegisterPage')).RegisterPage }))
const SettingsPage = lazy(async () => ({ default: (await import('./pages/SettingsPage')).SettingsPage }))
const SmartContractsPage = lazy(async () => ({ default: (await import('./pages/SmartContractsPage')).SmartContractsPage }))

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoading />}>
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
      </Suspense>
    </BrowserRouter>
  )
}

function RouteLoading() {
  return <div className="min-h-screen bg-paper" aria-label="正在加载" />
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
