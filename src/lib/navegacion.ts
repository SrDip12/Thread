// Volver a donde estabas. Una tarea se abre siempre dentro de su proyecto
// (`/proyectos/:id?tarea=…`), pero se llega desde muchas vistas: Mis tareas, Hoy,
// Para mí, Revisiones, Calendario, el sprint, la campana… El param `de` lleva la
// ruta de origen para que el botón de volver (y el cierre del panel) devuelvan ahí
// en vez de tirar a todos a /proyectos.

const ETIQUETAS: { prefijo: string; label: string }[] = [
  { prefijo: '/mis-tareas', label: 'Mis tareas' },
  { prefijo: '/para-mi', label: 'Para mí' },
  { prefijo: '/revisiones', label: 'Revisiones' },
  { prefijo: '/calendario', label: 'Calendario' },
  { prefijo: '/reuniones', label: 'Reuniones' },
  { prefijo: '/equipo', label: 'Equipo' },
  { prefijo: '/hoy', label: 'Hoy' },
]

// Ruta de una tarea, arrastrando el origen para el volver.
export function rutaTarea(proyectoId: string, tareaId: string, de?: string): string {
  const base = `/proyectos/${proyectoId}?tarea=${tareaId}`
  return de ? `${base}&de=${encodeURIComponent(de)}` : base
}

// Solo aceptamos rutas internas ("/algo"): nada de "//host" ni URLs absolutas.
export function origenValido(de: string | null): string | null {
  if (!de || !de.startsWith('/') || de.startsWith('//')) return null
  return de
}

// Origen a guardar cuando se salta a una tarea desde un lugar "flotante" (campana,
// paleta de comandos): la vista actual. Si ya estamos dentro de un proyecto no vale
// la pena — el volver natural de esa pantalla ya es el correcto.
export function volverDesde(pathname: string): string | undefined {
  return pathname.startsWith('/proyectos') ? undefined : pathname
}

// Etiqueta del botón de volver según la ruta de origen.
export function etiquetaOrigen(de: string | null): string {
  const ruta = origenValido(de)
  if (!ruta) return 'Proyectos'
  if (/^\/proyectos\/[^/]+\/sprint/.test(ruta)) return 'Sprint'
  if (/^\/proyectos\/[^/]+\/gantt/.test(ruta)) return 'Gantt'
  return ETIQUETAS.find((e) => ruta.startsWith(e.prefijo))?.label ?? 'Proyectos'
}
