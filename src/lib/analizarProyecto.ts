// Cliente del endpoint de análisis de proyecto con IA.
// El endpoint es una Vercel Edge Function (api/analizar-proyecto.ts).
// OJO: en `vite dev` la Function NO corre — necesitás `vercel dev` o el deploy en
// Vercel. En `vite dev` el fetch fallará (404 / HTML) y el UI debe mostrar el error
// con gracia.

export interface TareaPropuesta {
  titulo: string
  descripcion: string | null
  // "Cómo debería quedar": criterios de aceptación / definición de hecho.
  criterio: string | null
}
export interface ModuloPropuesto {
  nombre: string
  descripcion: string | null
  tareas: TareaPropuesta[]
}

function esModuloPropuesto(x: unknown): x is ModuloPropuesto {
  if (typeof x !== 'object' || x === null) return false
  const o = x as Record<string, unknown>
  if (typeof o.nombre !== 'string') return false
  if (o.descripcion !== null && typeof o.descripcion !== 'string') return false
  if (!Array.isArray(o.tareas)) return false
  return o.tareas.every((t) => {
    if (typeof t !== 'object' || t === null) return false
    const tt = t as Record<string, unknown>
    return (
      typeof tt.titulo === 'string' &&
      (tt.descripcion === null || typeof tt.descripcion === 'string') &&
      (tt.criterio === null || typeof tt.criterio === 'string')
    )
  })
}

export async function analizarProyecto(documento: string): Promise<ModuloPropuesto[]> {
  const res = await fetch('/api/analizar-proyecto', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ documento }),
  })

  if (!res.ok) {
    let mensaje = `Error ${res.status} al analizar el documento`
    try {
      const cuerpo = (await res.json()) as { error?: unknown }
      if (typeof cuerpo.error === 'string') mensaje = cuerpo.error
    } catch {
      // El cuerpo no era JSON (p. ej. el HTML de Vite en dev). Dejamos el mensaje genérico.
    }
    throw new Error(mensaje)
  }

  const datos = (await res.json()) as { modulos?: unknown }
  if (!Array.isArray(datos.modulos)) {
    throw new Error('Respuesta inválida del servidor.')
  }
  return datos.modulos.filter(esModuloPropuesto)
}
