// Vercel Edge Function: POST /api/enviar-correo
// Avisa por correo de un comentario: pregunta al PO, mención o respuesta a una pregunta.
//
// Recibe SOLO ids: { comentarioId, preguntaId? }. Destinatarios, textos y enlaces se
// resuelven acá con la sesión del usuario (RLS), así el endpoint no sirve para mandar
// correos arbitrarios. Solo el autor del comentario puede dispararlo, y una sola vez
// (`comentarios.correo_enviado_at`).

import { autenticar, json } from './_lib/supabase'
import { enviarCorreo, mencionados, renderCorreo } from './_lib/correo'

export const config = { runtime: 'edge' }

const COLOR = {
  pregunta: { acento: '#c96442', fondo: '#fdf2f0' },
  respuesta: { acento: '#2e9e7b', fondo: '#edfcf7' },
  mencion: { acento: '#9a5cc4', fondo: '#f7f0fc' },
} as const

interface TareaCtx {
  titulo: string
  modulos: { proyectos: { id: string; nombre: string; responsable_vision_id: string | null } | null } | null
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

  const sesion = await autenticar(request)
  if (sesion instanceof Response) return sesion
  const { supabase, personaId } = sesion

  let cuerpo: { comentarioId?: unknown; preguntaId?: unknown }
  try {
    cuerpo = (await request.json()) as typeof cuerpo
  } catch {
    return json({ error: 'El cuerpo de la solicitud debe ser JSON válido.' }, 400)
  }
  if (typeof cuerpo.comentarioId !== 'string') return json({ error: 'Falta `comentarioId`.' }, 400)
  const preguntaId = typeof cuerpo.preguntaId === 'string' ? cuerpo.preguntaId : null

  const { data: com, error: errCom } = await supabase
    .from('comentarios')
    .select('id, texto, autor_id, tarea_id, para_po, correo_enviado_at')
    .eq('id', cuerpo.comentarioId)
    .maybeSingle()
  if (errCom) return json({ error: 'No se pudo leer el comentario.' }, 500)
  if (!com || !com.tarea_id) return json({ error: 'Comentario no encontrado.' }, 404)
  if (com.autor_id !== personaId) return json({ error: 'Solo el autor puede notificar su comentario.' }, 403)
  if (com.correo_enviado_at) return json({ success: true, enviados: 0, yaEnviado: true })

  const { data: tareaRaw } = await supabase
    .from('tareas')
    .select('titulo, modulos(proyectos(id, nombre, responsable_vision_id))')
    .eq('id', com.tarea_id)
    .maybeSingle()
  const tarea = tareaRaw as unknown as TareaCtx | null
  const proyecto = tarea?.modulos?.proyectos
  if (!tarea || !proyecto) return json({ error: 'Tarea no encontrada.' }, 404)

  const { data: personas } = await supabase
    .from('personas')
    .select('id, nombre, email')
    .eq('activo', true)
  const equipo = personas ?? []
  const porId = new Map(equipo.map((p) => [p.id, p]))
  const autor = porId.get(personaId)?.nombre ?? 'Alguien del equipo'

  const origen = new URL(request.url).origin
  const url = `${origen}/proyectos/${proyecto.id}?tarea=${com.tarea_id}`

  type Destino = { id: string; tipo: keyof typeof COLOR; pregunta?: string }
  const destinos: Destino[] = []
  const ya = new Set<string>([personaId])
  const sumar = (d: Destino) => {
    if (!ya.has(d.id) && porId.has(d.id)) {
      ya.add(d.id)
      destinos.push(d)
    }
  }

  if (preguntaId) {
    const { data: preg } = await supabase
      .from('comentarios')
      .select('texto, autor_id, tarea_id')
      .eq('id', preguntaId)
      .maybeSingle()
    if (preg && preg.tarea_id === com.tarea_id) sumar({ id: preg.autor_id, tipo: 'respuesta', pregunta: preg.texto })
  }
  for (const p of mencionados(com.texto, equipo)) sumar({ id: p.id, tipo: 'mencion' })
  if (com.para_po && proyecto.responsable_vision_id) sumar({ id: proyecto.responsable_vision_id, tipo: 'pregunta' })

  let enviados = 0
  for (const d of destinos) {
    const p = porId.get(d.id)
    if (!p?.email) continue
    const c = COLOR[d.tipo]
    const asunto =
      d.tipo === 'pregunta'
        ? `[Thread] Nueva pregunta de ${autor} en ${proyecto.nombre}`
        : d.tipo === 'respuesta'
          ? `[Thread] Respuesta a tu pregunta en ${proyecto.nombre}`
          : `[Thread] Te mencionaron en "${tarea.titulo}"`
    const intro =
      d.tipo === 'pregunta'
        ? `**${autor}** dejó una pregunta para el responsable del proyecto **${proyecto.nombre}**.`
        : d.tipo === 'respuesta'
          ? `**${autor}** respondió tu pregunta en **${proyecto.nombre}**.`
          : `**${autor}** te mencionó en un comentario en **${proyecto.nombre}**.`
    const html = renderCorreo({
      acento: c.acento,
      badge: d.tipo === 'pregunta' ? 'Pregunta' : d.tipo === 'respuesta' ? 'Respuesta' : 'Mención',
      badgeFondo: c.fondo,
      saludo: `Hola **${p.nombre}**,`,
      intro,
      bloques: [
        { etiqueta: 'Tarea', texto: tarea.titulo },
        ...(d.pregunta ? [{ etiqueta: 'Tu pregunta', texto: d.pregunta, cursiva: true }] : []),
        { etiqueta: d.tipo === 'respuesta' ? `Respuesta de ${autor}` : 'Comentario', texto: com.texto },
      ],
      boton: { label: 'Ver en Thread', url },
      pie: 'Recibís este correo porque sos parte del proyecto en Thread.',
    })
    const r = await enviarCorreo({ para: p.email, asunto, html })
    if (r.ok) enviados++
  }

  await supabase
    .from('comentarios')
    .update({ correo_enviado_at: new Date().toISOString() })
    .eq('id', com.id)

  return json({ success: true, enviados })
}
