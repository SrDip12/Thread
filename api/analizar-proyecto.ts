// Vercel Edge Function: POST /api/analizar-proyecto
// Recibe el texto de un documento (Markdown: requisitos, RF, alcance…), llama a
// Groq y devuelve una propuesta de módulos con sus tareas. La API key SOLO vive
// como env var de Vercel (process.env.GROQ_API_KEY); NUNCA en el cliente.

export const config = { runtime: 'edge' }

// Modelo de Groq; constante fácil de cambiar.
const MODEL = 'llama-3.3-70b-versatile'
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

// Límite defensivo: el prompt es el documento del usuario. ~48k chars ≈ documento grande.
const MAX_DOC = 48_000

interface TareaPropuesta {
  titulo: string
}
interface ModuloPropuesto {
  nombre: string
  descripcion: string | null
  tareas: TareaPropuesta[]
}

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function normalizarTexto(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const t = valor.trim()
  return t === '' ? null : t
}

function normalizarModulo(valor: unknown): ModuloPropuesto | null {
  if (typeof valor !== 'object' || valor === null) return null
  const o = valor as Record<string, unknown>
  const nombre = normalizarTexto(o.nombre)
  if (!nombre) return null
  const tareasCrudas = Array.isArray(o.tareas) ? o.tareas : []
  const tareas: TareaPropuesta[] = []
  for (const t of tareasCrudas) {
    if (typeof t === 'object' && t !== null) {
      const titulo = normalizarTexto((t as Record<string, unknown>).titulo)
      if (titulo) tareas.push({ titulo })
    }
  }
  return { nombre, descripcion: normalizarTexto(o.descripcion), tareas }
}

function construirPrompt(documento: string): string {
  return [
    'Sos un asistente que analiza el documento de un proyecto de software (requisitos, requisitos funcionales/RF, alcance, especificación) y lo organiza para arrancar el trabajo.',
    '',
    'Tu salida son MÓDULOS (áreas funcionales del producto) y, dentro de cada uno, TAREAS accionables (algo concreto que alguien tiene que construir o hacer).',
    'Reglas:',
    '- Si el documento enumera requisitos funcionales (RF1, RF2…), convertí cada uno en una tarea, agrupada en el módulo que corresponda.',
    '- Agrupá tareas relacionadas en pocos módulos claros (típicamente 2 a 8). No inventes módulos vacíos.',
    '- Los títulos de tarea son cortos, en infinitivo y en español (ej. "Implementar login con email").',
    '- `descripcion` del módulo: una línea opcional; null si no aporta.',
    '- No inventes funcionalidad que el documento no menciona.',
    '',
    'Devolvé SOLO JSON con esta forma exacta, sin texto adicional ni markdown:',
    '{"modulos":[{"nombre":"...","descripcion":"<texto o null>","tareas":[{"titulo":"..."}]}]}',
    '',
    'DOCUMENTO DEL PROYECTO:',
    documento,
  ].join('\n')
}

interface GroqRespuesta {
  choices?: { message?: { content?: string } }[]
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Método no permitido.' }, 405)
  }

  let cuerpoCrudo: unknown
  try {
    cuerpoCrudo = await request.json()
  } catch {
    return json({ error: 'El cuerpo de la solicitud debe ser JSON válido.' }, 400)
  }

  const doc =
    typeof cuerpoCrudo === 'object' && cuerpoCrudo !== null
      ? normalizarTexto((cuerpoCrudo as Record<string, unknown>).documento)
      : null
  if (!doc) {
    return json({ error: 'Falta `documento` (texto no vacío).' }, 400)
  }
  if (doc.length > MAX_DOC) {
    return json({ error: `El documento es demasiado largo (máx. ${MAX_DOC} caracteres).` }, 400)
  }

  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey) {
    return json({ error: 'Falta configurar GROQ_API_KEY en el servidor.' }, 500)
  }

  const respuesta = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${groqKey}`,
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
        { role: 'user', content: construirPrompt(doc) },
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
  const modulosCrudos = (parseado as Record<string, unknown>).modulos
  if (!Array.isArray(modulosCrudos)) {
    return json({ error: 'El servicio de IA devolvió un formato inesperado.' }, 502)
  }

  const modulos: ModuloPropuesto[] = []
  for (const item of modulosCrudos) {
    const normalizado = normalizarModulo(item)
    if (normalizado) modulos.push(normalizado)
  }

  return json({ modulos })
}
