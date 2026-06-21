// Cloudflare Pages Function: POST /extraer-tareas
// Recibe notas + personas + módulos, llama a Groq y devuelve tareas propuestas.
// La API key SOLO vive como secret de Cloudflare Pages (env.GROQ_API_KEY); NUNCA en el cliente.
// No usamos el tipo `PagesFunction` porque @cloudflare/workers-types no está instalado.

interface Env {
  GROQ_API_KEY: string
}

// Modelo de Groq; constante fácil de cambiar.
const MODEL = 'llama-3.3-70b-versatile'
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

interface RefEntidad {
  id: string
  nombre: string
}

interface CuerpoEntrada {
  notas: string
  personas: RefEntidad[]
  modulos: RefEntidad[]
  // true cuando la reunión es de tipo 'cliente': las notas son FEEDBACK del cliente
  // y cada ítem es una CORRECCIÓN sobre un módulo existente.
  esCliente: boolean
}

interface TareaPropuesta {
  titulo: string
  responsable_sugerido: string | null
  modulo_sugerido: string | null
  fecha: string | null
}

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function esRefEntidad(x: unknown): x is RefEntidad {
  if (typeof x !== 'object' || x === null) return false
  const o = x as Record<string, unknown>
  return typeof o.id === 'string' && typeof o.nombre === 'string'
}

function parsearEntrada(valor: unknown): CuerpoEntrada | null {
  if (typeof valor !== 'object' || valor === null) return null
  const o = valor as Record<string, unknown>
  if (typeof o.notas !== 'string' || o.notas.trim() === '') return null
  if (!Array.isArray(o.personas) || !o.personas.every(esRefEntidad)) return null
  if (!Array.isArray(o.modulos) || !o.modulos.every(esRefEntidad)) return null
  return {
    notas: o.notas,
    personas: o.personas,
    modulos: o.modulos,
    esCliente: o.esCliente === true,
  }
}

function normalizarTexto(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const t = valor.trim()
  return t === '' ? null : t
}

function normalizarTarea(valor: unknown): TareaPropuesta | null {
  if (typeof valor !== 'object' || valor === null) return null
  const o = valor as Record<string, unknown>
  const titulo = normalizarTexto(o.titulo)
  if (!titulo) return null
  return {
    titulo,
    responsable_sugerido: normalizarTexto(o.responsable_sugerido),
    modulo_sugerido: normalizarTexto(o.modulo_sugerido),
    fecha: normalizarTexto(o.fecha),
  }
}

function construirPrompt(entrada: CuerpoEntrada): string {
  const hoy = new Date().toISOString().slice(0, 10)
  const nombresPersonas = entrada.personas.map((p) => p.nombre).join(', ') || '(ninguna)'
  const nombresModulos = entrada.modulos.map((m) => m.nombre).join(', ') || '(ninguno)'

  if (entrada.esCliente) {
    return [
      'Sos un asistente que procesa el FEEDBACK DE UN CLIENTE sobre un producto ya entregado.',
      'Las notas son comentarios del cliente. Extraé SOLO CORRECCIONES: cada ítem es un cambio, ajuste o arreglo que el cliente pide sobre un módulo EXISTENTE.',
      'Ignorá elogios, charla general y comentarios que no impliquen un cambio concreto. Redactá cada título como una corrección accionable (ej. "Corregir...", "Ajustar...", "Cambiar...").',
      '',
      `Hoy es ${hoy}. Si una nota menciona una fecha relativa (ej. "el viernes", "la semana que viene"), convertila a una fecha absoluta YYYY-MM-DD; si no hay fecha, usá null.`,
      '',
      `Personas del equipo (usá el nombre EXACTO de esta lista para responsable_sugerido, o null si no se puede inferir): ${nombresPersonas}`,
      `Módulos existentes del proyecto (ELEGÍ SIEMPRE el módulo existente que la corrección afecta para modulo_sugerido; usá el nombre EXACTO de esta lista): ${nombresModulos}`,
      '',
      'Cada ítem es una corrección (tipo "correccion"). Devolvé SOLO JSON con esta forma exacta, sin texto adicional:',
      '{"tareas":[{"titulo":"...","responsable_sugerido":"<nombre exacto o null>","modulo_sugerido":"<nombre de módulo existente o null>","fecha":"YYYY-MM-DD o null","tipo":"correccion"}]}',
      '',
      'FEEDBACK DEL CLIENTE:',
      entrada.notas,
    ].join('\n')
  }

  return [
    'Sos un asistente que extrae ACCIONES CONCRETAS de las notas de una reunión.',
    'Extraé SOLO tareas accionables (algo que alguien tiene que hacer). Ignorá el estado, la charla, las decisiones que no implican una acción y los comentarios generales.',
    '',
    `Hoy es ${hoy}. Si una nota menciona una fecha relativa (ej. "el viernes", "la semana que viene"), convertila a una fecha absoluta YYYY-MM-DD; si no hay fecha, usá null.`,
    '',
    `Personas del equipo (usá el nombre EXACTO de esta lista para responsable_sugerido, o null si no se puede inferir): ${nombresPersonas}`,
    `Módulos existentes del proyecto (preferí uno de estos para modulo_sugerido; si la tarea pertenece a un área nueva podés proponer otro nombre, o null): ${nombresModulos}`,
    '',
    'Devolvé SOLO JSON con esta forma exacta, sin texto adicional:',
    '{"tareas":[{"titulo":"...","responsable_sugerido":"<nombre exacto o null>","modulo_sugerido":"<nombre de módulo o null>","fecha":"YYYY-MM-DD o null"}]}',
    '',
    'NOTAS DE LA REUNIÓN:',
    entrada.notas,
  ].join('\n')
}

interface GroqRespuesta {
  choices?: { message?: { content?: string } }[]
}

export async function onRequestPost(context: {
  request: Request
  env: Env
}): Promise<Response> {
  const { request, env } = context

  let cuerpoCrudo: unknown
  try {
    cuerpoCrudo = await request.json()
  } catch {
    return json({ error: 'El cuerpo de la solicitud debe ser JSON válido.' }, 400)
  }

  const entrada = parsearEntrada(cuerpoCrudo)
  if (!entrada) {
    return json(
      { error: 'Datos inválidos: se requiere `notas` (texto no vacío), `personas` y `modulos`.' },
      400,
    )
  }

  if (!env.GROQ_API_KEY) {
    return json({ error: 'Falta configurar GROQ_API_KEY en el servidor.' }, 500)
  }

  const respuesta = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'Devolvés únicamente JSON válido, sin texto adicional ni markdown.',
        },
        { role: 'user', content: construirPrompt(entrada) },
      ],
    }),
  })

  if (!respuesta.ok) {
    return json({ error: 'El servicio de IA no respondió correctamente.' }, 502)
  }

  const datos = (await respuesta.json()) as GroqRespuesta
  const texto = datos.choices?.[0]?.message?.content
  if (typeof texto !== 'string') {
    return json({ error: 'Respuesta vacía del servicio de IA.' }, 502)
  }

  let parseado: unknown
  try {
    parseado = JSON.parse(texto)
  } catch {
    return json({ error: 'El servicio de IA devolvió un formato inesperado.' }, 502)
  }

  if (typeof parseado !== 'object' || parseado === null) {
    return json({ error: 'El servicio de IA devolvió un formato inesperado.' }, 502)
  }
  const tareasCrudas = (parseado as Record<string, unknown>).tareas
  if (!Array.isArray(tareasCrudas)) {
    return json({ error: 'El servicio de IA devolvió un formato inesperado.' }, 502)
  }

  const tareas: TareaPropuesta[] = []
  for (const item of tareasCrudas) {
    const normalizada = normalizarTarea(item)
    if (normalizada) tareas.push(normalizada)
  }

  return json({ tareas })
}
