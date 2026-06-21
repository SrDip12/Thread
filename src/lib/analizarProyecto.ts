// Cliente del endpoint de análisis de proyecto con IA.
// El endpoint es una Cloudflare Pages Function (functions/analizar-proyecto.ts).
// OJO: en `vite dev` la Function NO corre — necesitás `wrangler pages dev` o el
// deploy en Cloudflare Pages. En `vite dev` el fetch fallará (404 / HTML) y el UI
// debe mostrar el error con gracia.

export interface TareaPropuesta {
  titulo: string
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
  return o.tareas.every(
    (t) => typeof t === 'object' && t !== null && typeof (t as Record<string, unknown>).titulo === 'string',
  )
}

export async function analizarProyecto(documento: string): Promise<ModuloPropuesto[]> {
  const res = await fetch('/analizar-proyecto', {
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
