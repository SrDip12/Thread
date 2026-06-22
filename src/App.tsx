import { lazy, Suspense } from 'react'
import { Link, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.tsx'
import Login from './components/Login.tsx'
import { useAuth } from './auth/AuthProvider.tsx'

// Cada ruta en su propio chunk: el bundle inicial solo carga la vista abierta.
const Proyectos = lazy(() => import('./pages/Proyectos.tsx'))
const ProyectoDetalle = lazy(() => import('./pages/ProyectoDetalle.tsx'))
const Sprint = lazy(() => import('./pages/Sprint.tsx'))
const MisTareas = lazy(() => import('./pages/MisTareas.tsx'))
const ParaMi = lazy(() => import('./pages/ParaMi.tsx'))
const Equipo = lazy(() => import('./pages/Equipo.tsx'))
const Reuniones = lazy(() => import('./pages/Reuniones.tsx'))
const ReunionDetalle = lazy(() => import('./pages/ReunionDetalle.tsx'))
const Revisiones = lazy(() => import('./pages/Revisiones.tsx'))

function CargandoRuta() {
  return <div className="px-11 pt-10 text-sm text-muted">Cargando…</div>
}

function Rutas() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route
          index
          element={<Navigate to="/proyectos" replace />}
        />
        <Route
          element={
            <Suspense fallback={<CargandoRuta />}>
              <Outlet />
            </Suspense>
          }
        >
          <Route path="/proyectos" element={<Proyectos />} />
          <Route path="/proyectos/:id" element={<ProyectoDetalle />} />
          <Route path="/proyectos/:id/sprint" element={<Sprint />} />
          <Route path="/mis-tareas" element={<MisTareas />} />
          <Route path="/para-mi" element={<ParaMi />} />
          <Route path="/reuniones" element={<Reuniones />} />
          <Route path="/reuniones/:id" element={<ReunionDetalle />} />
          <Route path="/revisiones" element={<Revisiones />} />
          <Route path="/equipo" element={<Equipo />} />
        </Route>
        <Route path="*" element={<NoEncontrado />} />
      </Route>
    </Routes>
  )
}

function NoEncontrado() {
  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-3 text-center">
      <p className="font-mono text-2xl font-semibold text-ink">404</p>
      <p className="text-sm text-muted">Esta página no existe.</p>
      <Link
        to="/proyectos"
        className="rounded-[9px] border border-line px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-hover"
      >
        Ir a Proyectos
      </Link>
    </div>
  )
}

export default function App() {
  const { session, persona, cargando, error, signOut } = useAuth()

  if (cargando) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-canvas text-sm text-muted">
        Cargando…
      </div>
    )
  }

  if (!session) {
    return <Login />
  }

  if (error) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-canvas px-4">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-canvas p-8 text-center">
          <p className="mb-2 text-sm text-ink">No pudimos verificar tu cuenta.</p>
          <p className="mb-4 text-xs text-muted">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-[9px] border border-line px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-hover"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (persona === null) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-canvas px-4">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-canvas p-8 text-center">
          <p className="mb-4 text-sm text-ink">
            Tu email no está registrado en el equipo. Avisá a un administrador.
          </p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-[9px] border border-line px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-hover"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    )
  }

  return <Rutas />
}
