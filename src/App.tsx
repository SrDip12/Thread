import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.tsx'
import Login from './components/Login.tsx'
import Proyectos from './pages/Proyectos.tsx'
import ProyectoDetalle from './pages/ProyectoDetalle.tsx'
import Sprint from './pages/Sprint.tsx'
import MisTareas from './pages/MisTareas.tsx'
import ParaMi from './pages/ParaMi.tsx'
import Equipo from './pages/Equipo.tsx'
import Reuniones from './pages/Reuniones.tsx'
import ReunionDetalle from './pages/ReunionDetalle.tsx'
import Revisiones from './pages/Revisiones.tsx'
import { useAuth } from './auth/AuthProvider.tsx'

function Rutas() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/proyectos" replace />} />
        <Route path="/proyectos" element={<Proyectos />} />
        <Route path="/proyectos/:id" element={<ProyectoDetalle />} />
        <Route path="/proyectos/:id/sprint" element={<Sprint />} />
        <Route path="/mis-tareas" element={<MisTareas />} />
        <Route path="/para-mi" element={<ParaMi />} />
        <Route path="/reuniones" element={<Reuniones />} />
        <Route path="/reuniones/:id" element={<ReunionDetalle />} />
        <Route path="/revisiones" element={<Revisiones />} />
        <Route path="/equipo" element={<Equipo />} />
        <Route path="*" element={<Navigate to="/proyectos" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  const { session, persona, cargando, signOut } = useAuth()

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
