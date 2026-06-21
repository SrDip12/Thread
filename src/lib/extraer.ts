// Cliente del endpoint de extracción de tareas con IA.
// El endpoint es una Vercel Edge Function (api/extraer-tareas.ts).
// OJO: en `vite dev` la Function NO corre — necesitás `vercel dev` o el deploy en
// Vercel. En `vite dev` el fetch fallará (404 / HTML) y el UI debe mostrar el error
// con gracia.

export interface TareaPropuesta {
  titulo: string
  responsable_sugerido: string | null
  modulo_sugerido: string | null
  fecha: string | null
}

interface ExtraerInput {
  notas: string
  personas: { id: string; nombre: string }[]
  modulos: { id: string; nombre: string }[]
  // true cuando la reunión es de tipo 'cliente': sesga la extracción a correcciones.
  esCliente?: boolean
}

function esTareaPropuesta(x: unknown): x is TareaPropuesta {
  if (typeof x !== 'object' || x === null) return false
  const o = x as Record<string, unknown>
  return (
    typeof o.titulo === 'string' &&
    (o.responsable_sugerido === null || typeof o.responsable_sugerido === 'string') &&
    (o.modulo_sugerido === null || typeof o.modulo_sugerido === 'string') &&
    (o.fecha === null || typeof o.fecha === 'string')
  )
}

export async function extraerTareas(input: ExtraerInput): Promise<TareaPropuesta[]> {
  const res = await fetch('/api/extraer-tareas', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!res.ok) {
    let mensaje = `Error ${res.status} al extraer tareas`
    try {
      const cuerpo = (await res.json()) as { error?: unknown }
      if (typeof cuerpo.error === 'string') mensaje = cuerpo.error
    } catch {
      // El cuerpo no era JSON (p. ej. el HTML de Vite en dev). Dejamos el mensaje genérico.
    }
    throw new Error(mensaje)
  }

  const datos = (await res.json()) as { tareas?: unknown }
  if (!Array.isArray(datos.tareas)) {
    throw new Error('Respuesta inválida del servidor.')
  }
  return datos.tareas.filter(esTareaPropuesta)
}
