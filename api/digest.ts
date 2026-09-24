// Vercel Edge Function: GET /api/digest — cron diario (ver `crons` en vercel.json).
//
// 1. Genera los avisos in-app de vencimiento para todo el equipo
//    (`generar_avisos_vencimiento`), sin depender de que alguien tenga la app abierta.
// 2. Manda a cada persona un resumen por correo: sus tareas vencidas / por vencer,
//    lo que espera su revisión, y los proyectos que lidera sin movimiento.
//
// Auth: Vercel manda `Authorization: Bearer $CRON_SECRET`. Usa SUPABASE_SERVICE_ROLE_KEY.

import { clienteServicio, igualSeguro, json } from './_lib/supabase'
import { enviarCorreo, esc, renderCorreo } from './_lib/correo'

export const config = { runtime: 'edge' }

// Días sin actividad a partir de los cuales un proyecto activo se marca como estancado.
const DIAS_ESTANCADO = 7

interface TareaFila {
  id: string
  titulo: string
  fecha: string | null
  estado: string
  prioridad: string
  responsable_id: string | null
  modulos: { proyectos: { id: string; nombre: string; responsable_vision_id: string | null } | null } | null
}

interface ReunionFila {
  id: string
  titulo: string
  fecha: string
  hora: string | null
  proyecto_id: string
  reunion_asistentes: { persona_id: string }[]
}

function diasEntre(desdeISO: string, hasta: Date): number {
  return Math.floor((hasta.getTime() - new Date(desdeISO).getTime()) / 86_400_000)
}

function lista(titulo: string, items: string[]): string {
  if (!items.length) return ''
  return `<div style="margin-bottom:22px;">
  <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;letter-spacing:0.05em;margin-bottom:8px;">${esc(titulo)}</div>
  <ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.7;color:#1e293b;">${items.join('')}</ul>
</div>`
}

export default async function handler(request: Request): Promise<Response> {
  const secreto = process.env.CRON_SECRET
  if (!secreto) return json({ error: 'Falta configurar CRON_SECRET.' }, 500)
  const recibido = request.headers.get('authorization') ?? ''
  if (!igualSeguro(recibido, `Bearer ${secreto}`)) return json({ error: 'No autorizado.' }, 401)

  const supabase = clienteServicio()
  if (!supabase) return json({ error: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY.' }, 500)

  const { data: avisos, error: errAvisos } = await supabase.rpc('generar_avisos_vencimiento', {})
  if (errAvisos) console.error('generar_avisos_vencimiento:', errAvisos.message)

  const hoy = new Date()
  const hoyISO = hoy.toISOString().slice(0, 10)
  const limite = new Date(hoy.getTime() + 2 * 86_400_000).toISOString().slice(0, 10)

  const [
    { data: personas },
    { data: tareasRaw },
    { data: salud },
    { data: proyectos },
    { data: reunionesRaw },
  ] = await Promise.all([
    supabase.from('personas').select('id, nombre, email').eq('activo', true),
    supabase
      .from('tareas')
      .select('id, titulo, fecha, estado, prioridad, responsable_id, modulos(proyectos(id, nombre, responsable_vision_id))')
      .neq('estado', 'hecho'),
    supabase.from('v_salud_proyectos').select('proyecto_id, ultima_actividad, vencidas'),
    supabase.from('proyectos').select('id, nombre, estado, responsable_vision_id'),
    // `fecha` es el día (timestamptz a medianoche); se filtra por el día de hoy.
    supabase
      .from('reuniones')
      .select('id, titulo, fecha, hora, proyecto_id, reunion_asistentes(persona_id)')
      .gte('fecha', `${hoyISO}T00:00:00Z`)
      .lt('fecha', `${hoyISO}T23:59:59Z`),
  ])
  const tareas = (tareasRaw ?? []) as unknown as TareaFila[]
  const reuniones = (reunionesRaw ?? []) as unknown as ReunionFila[]
  const nombreProyecto = new Map((proyectos ?? []).map((pr) => [pr.id, pr.nombre]))
  const saludPorId = new Map((salud ?? []).map((s) => [s.proyecto_id, s]))
  const origen = process.env.APP_URL ?? new URL(request.url).origin

  let enviados = 0
  for (const p of personas ?? []) {
    if (!p.email) continue
    const mias = tareas.filter((t) => t.responsable_id === p.id && t.fecha && t.fecha <= limite)
    const vencidas = mias.filter((t) => (t.fecha as string) < hoyISO)
    const proximas = mias.filter((t) => (t.fecha as string) >= hoyISO)
    const aRevisar = tareas.filter(
      (t) => t.estado === 'revision' && t.modulos?.proyectos?.responsable_vision_id === p.id,
    )
    const estancados = (proyectos ?? []).filter((pr) => {
      if (pr.estado !== 'activo' || pr.responsable_vision_id !== p.id) return false
      const ult = saludPorId.get(pr.id)?.ultima_actividad
      return ult ? diasEntre(ult, hoy) >= DIAS_ESTANCADO : false
    })

    const misReuniones = reuniones
      .filter((r) => r.reunion_asistentes.some((a) => a.persona_id === p.id))
      .sort((a, b) => (a.hora ?? '').localeCompare(b.hora ?? ''))

    if (!vencidas.length && !proximas.length && !aRevisar.length && !estancados.length && !misReuniones.length) continue

    const item = (t: TareaFila) =>
      `<li>${t.prioridad === 'alta' ? '<strong style="color:#c0392b;">▲</strong> ' : ''}${esc(t.titulo)} <span style="color:#64748b;">· ${esc(t.modulos?.proyectos?.nombre ?? '')}${t.fecha ? ` · ${esc(t.fecha)}` : ''}</span></li>`

    const htmlExtra =
      lista(
        `Reuniones de hoy (${misReuniones.length})`,
        misReuniones.map(
          (r) =>
            `<li>${r.hora ? `<strong>${esc(r.hora.slice(0, 5))}</strong> · ` : ''}${esc(r.titulo)} <span style="color:#64748b;">· ${esc(nombreProyecto.get(r.proyecto_id) ?? '')}</span></li>`,
        ),
      ) +
      lista(`Vencidas (${vencidas.length})`, vencidas.map(item)) +
      lista(`Vencen en los próximos 2 días (${proximas.length})`, proximas.map(item)) +
      lista(`Esperando tu revisión (${aRevisar.length})`, aRevisar.map(item)) +
      lista(
        `Proyectos tuyos sin movimiento (${estancados.length})`,
        estancados.map((pr) => {
          const ult = saludPorId.get(pr.id)?.ultima_actividad
          return `<li>${esc(pr.nombre)} <span style="color:#64748b;">· ${ult ? diasEntre(ult, hoy) : '?'} días sin actividad</span></li>`
        }),
      )

    const html = renderCorreo({
      acento: '#c96442',
      badge: 'Resumen del día',
      badgeFondo: '#fdf2f0',
      saludo: `Hola **${p.nombre}**,`,
      intro: 'Esto es lo que necesita tu atención hoy en Thread.',
      bloques: [],
      htmlExtra,
      boton: { label: 'Abrir Thread', url: `${origen}/hoy` },
      pie: 'Resumen diario automático de Thread.',
    })
    const partes = [
      vencidas.length && `${vencidas.length} vencida${vencidas.length > 1 ? 's' : ''}`,
      aRevisar.length && `${aRevisar.length} por revisar`,
    ].filter(Boolean)
    const r = await enviarCorreo({
      para: p.email,
      asunto: `[Thread] Tu día${partes.length ? `: ${partes.join(', ')}` : ''}`,
      html,
    })
    if (r.ok) enviados++
  }

  return json({ success: true, avisosCreados: avisos ?? 0, correos: enviados })
}
