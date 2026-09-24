// Vercel Edge Function: POST /api/github — webhook de GitHub (evento pull_request).
//
// Conecta el trabajo real con el tablero:
//   · PR abierto / listo para revisión → la tarea guarda `pr_url` y pasa a "revisión"
//   · PR mergeado                      → la tarea pasa a "hecho"
// Una tarea se vincula a un PR si el título, la descripción o la rama del PR contienen
// su id (uuid) — p. ej. "Thread-Tarea: 3f2c…" en la descripción —, o si su `pr_url`
// ya apunta a ese PR. Si el proyecto tiene `repo_url`, el PR tiene que venir de ese repo.
//
// Setup: en el repo → Settings → Webhooks → Payload URL `https://<app>/api/github`,
// content type `application/json`, secret = GITHUB_WEBHOOK_SECRET, evento "Pull requests".
// Escribe con SUPABASE_SERVICE_ROLE_KEY (no hay usuario); los triggers generan los avisos.

import { clienteServicio, igualSeguro, json } from './_lib/supabase'

export const config = { runtime: 'edge' }

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

interface PullRequestEvento {
  action?: string
  pull_request?: {
    html_url?: string
    title?: string
    body?: string | null
    draft?: boolean
    merged?: boolean
    head?: { ref?: string }
  }
  repository?: { html_url?: string }
}

interface TareaVinculo {
  id: string
  estado: string
  pr_url: string | null
  modulos: { proyectos: { repo_url: string | null } | null } | null
}

async function firmaValida(cuerpo: string, firma: string | null, secreto: string): Promise<boolean> {
  if (!firma?.startsWith('sha256=')) return false
  const clave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(cuerpo))
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return igualSeguro(firma, `sha256=${hex}`)
}

const normalizarRepo = (u: string | null | undefined) =>
  (u ?? '').trim().toLowerCase().replace(/\.git$/, '').replace(/\/+$/, '')

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

  const secreto = process.env.GITHUB_WEBHOOK_SECRET
  if (!secreto) return json({ error: 'Falta configurar GITHUB_WEBHOOK_SECRET.' }, 500)

  const cuerpo = await request.text()
  if (!(await firmaValida(cuerpo, request.headers.get('x-hub-signature-256'), secreto))) {
    return json({ error: 'Firma inválida.' }, 401)
  }

  const evento = request.headers.get('x-github-event')
  if (evento === 'ping') return json({ ok: true })
  if (evento !== 'pull_request') return json({ ok: true, ignorado: evento })

  const supabase = clienteServicio()
  if (!supabase) return json({ error: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY.' }, 500)

  let datos: PullRequestEvento
  try {
    datos = JSON.parse(cuerpo) as PullRequestEvento
  } catch {
    return json({ error: 'JSON inválido.' }, 400)
  }
  const pr = datos.pull_request
  const prUrl = pr?.html_url
  if (!pr || !prUrl) return json({ ok: true, ignorado: 'sin pull_request' })

  const texto = `${pr.title ?? ''}\n${pr.body ?? ''}\n${pr.head?.ref ?? ''}`
  const ids = [...new Set((texto.match(UUID) ?? []).map((s) => s.toLowerCase()))]

  const seleccion = 'id, estado, pr_url, modulos(proyectos(repo_url))'
  const [porId, porUrl] = await Promise.all([
    ids.length
      ? supabase.from('tareas').select(seleccion).in('id', ids)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('tareas').select(seleccion).eq('pr_url', prUrl),
  ])
  if (porId.error || porUrl.error) return json({ error: 'No se pudieron leer las tareas.' }, 500)

  const repoPr = normalizarRepo(datos.repository?.html_url)
  const tareas = new Map<string, TareaVinculo>()
  for (const t of [...(porId.data ?? []), ...(porUrl.data ?? [])] as unknown as TareaVinculo[]) {
    const repoProyecto = normalizarRepo(t.modulos?.proyectos?.repo_url)
    if (repoProyecto && repoPr && repoProyecto !== repoPr) continue
    tareas.set(t.id, t)
  }

  const accion = datos.action ?? ''
  const abierto = ['opened', 'reopened', 'ready_for_review'].includes(accion) && !pr.draft
  const mergeado = accion === 'closed' && pr.merged === true

  const resultado: { id: string; cambio: string }[] = []
  for (const t of tareas.values()) {
    const cambios: { pr_url?: string; estado?: 'revision' | 'hecho' } = {}
    if (t.pr_url !== prUrl) cambios.pr_url = prUrl
    if (mergeado && t.estado !== 'hecho') cambios.estado = 'hecho'
    else if (abierto && (t.estado === 'proximo' || t.estado === 'en_curso')) cambios.estado = 'revision'
    if (!Object.keys(cambios).length) continue

    const { error } = await supabase.from('tareas').update(cambios).eq('id', t.id)
    if (error) console.error(`No se pudo actualizar la tarea ${t.id}:`, error.message)
    else resultado.push({ id: t.id, cambio: cambios.estado ?? 'pr_url' })
  }

  return json({ ok: true, accion, tareas: resultado })
}
