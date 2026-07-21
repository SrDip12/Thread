#!/usr/bin/env node
// Servidor MCP de Thread — expone las tareas del equipo como herramientas.
// Cada persona (vos o un trabajador) lo corre con SUS credenciales de la app
// (THREAD_EMAIL / THREAD_PASSWORD); usa la misma auth y RLS que la web.
//
// Herramientas: listar/ver/crear tareas, empezar, completar, enviar a revisión,
// aprobar/devolver (revisión), comentar, asignar, equipo y proyectos.
//
// Config (env o .env/.env.local en la raíz del repo):
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY  → mismos que la app
//   THREAD_EMAIL, THREAD_PASSWORD              → tu login de Thread

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// ── Env: process.env gana; .env.local pisa .env ────────────────────────────────
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const env = {}
for (const archivo of ['.env', '.env.local']) {
  try {
    for (const linea of readFileSync(path.join(raiz, archivo), 'utf8').split(/\r?\n/)) {
      const m = linea.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/)
      if (m && !linea.trim().startsWith('#')) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    /* archivo opcional */
  }
}
const cfg = (clave) => process.env[clave] ?? env[clave]

const SUPABASE_URL = cfg('THREAD_SUPABASE_URL') ?? cfg('VITE_SUPABASE_URL')
const SUPABASE_ANON_KEY = cfg('THREAD_SUPABASE_ANON_KEY') ?? cfg('VITE_SUPABASE_ANON_KEY')
const EMAIL = cfg('THREAD_EMAIL')
const PASSWORD = cfg('THREAD_PASSWORD')

// Cliente creado solo si hay config; el error se informa recién al usar una tool.
const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: true },
      })
    : null

// ── Sesión: login con email+password y resolución del "yo" (fila de personas) ──
let yo = null
async function asegurarSesion() {
  if (yo) return yo
  if (!supabase) {
    throw new Error(
      'Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (definilos en el entorno o en .env).',
    )
  }
  if (!EMAIL || !PASSWORD) {
    throw new Error(
      'Faltan THREAD_EMAIL / THREAD_PASSWORD (tu login de Thread) en el entorno o .env.local.',
    )
  }
  const { error: errAuth } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  })
  if (errAuth) throw new Error(`Login falló para ${EMAIL}: ${errAuth.message}`)
  const { data, error } = await supabase
    .from('personas')
    .select('*')
    .ilike('email', EMAIL)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error(`No hay persona registrada con el email ${EMAIL}.`)
  yo = data
  return yo
}

// ── Helpers de resolución (aceptan id o nombre/título parcial) ─────────────────
const esUuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)

async function resolverTarea(ref) {
  if (esUuid(ref)) {
    const { data, error } = await supabase.from('tareas').select('*').eq('id', ref).maybeSingle()
    if (error) throw error
    if (!data) throw new Error(`No existe la tarea con id ${ref}.`)
    return data
  }
  const { data, error } = await supabase
    .from('tareas')
    .select('*')
    .ilike('titulo', `%${ref}%`)
    .limit(10)
  if (error) throw error
  if (!data?.length) throw new Error(`No encontré tareas cuyo título contenga "${ref}".`)
  const exacta = data.filter((t) => t.titulo.toLowerCase() === ref.toLowerCase())
  if (exacta.length === 1) return exacta[0]
  if (data.length === 1) return data[0]
  throw new Error(
    `"${ref}" es ambiguo. Coincidencias:\n` +
      data.map((t) => `- ${t.titulo} [${t.estado}] (id: ${t.id})`).join('\n') +
      '\nRepetí con el id exacto.',
  )
}

async function resolverProyecto(ref) {
  const query = supabase.from('proyectos').select('*')
  const { data, error } = esUuid(ref)
    ? await query.eq('id', ref)
    : await query.ilike('nombre', `%${ref}%`)
  if (error) throw error
  if (!data?.length) throw new Error(`No encontré el proyecto "${ref}".`)
  if (data.length > 1)
    throw new Error(
      `"${ref}" matchea varios proyectos: ${data.map((p) => p.nombre).join(', ')}. Precisá más.`,
    )
  return data[0]
}

async function resolverPersona(ref) {
  if (!ref || ref.toLowerCase() === 'yo') return asegurarSesion()
  const query = supabase.from('personas').select('*')
  const { data, error } = esUuid(ref)
    ? await query.eq('id', ref)
    : await query.or(`nombre.ilike.%${ref}%,email.ilike.%${ref}%`)
  if (error) throw error
  if (!data?.length) throw new Error(`No encontré a "${ref}" en el equipo.`)
  if (data.length > 1)
    throw new Error(
      `"${ref}" matchea varias personas: ${data.map((p) => p.nombre).join(', ')}. Precisá más.`,
    )
  return data[0]
}

async function modulosDeProyecto(proyectoId) {
  const { data, error } = await supabase
    .from('modulos')
    .select('id, nombre, estado')
    .eq('proyecto_id', proyectoId)
    .order('orden', { ascending: true })
  if (error) throw error
  return data ?? []
}

async function resolverModulo(proyecto, ref) {
  const modulos = await modulosDeProyecto(proyecto.id)
  if (!modulos.length) throw new Error(`El proyecto "${proyecto.nombre}" no tiene módulos.`)
  if (!ref) {
    if (modulos.length === 1) return modulos[0]
    throw new Error(
      `Indicá el módulo. Módulos de "${proyecto.nombre}": ${modulos.map((m) => m.nombre).join(', ')}.`,
    )
  }
  const match = modulos.filter((m) => m.nombre.toLowerCase().includes(ref.toLowerCase()))
  if (match.length === 1) return match[0]
  if (!match.length)
    throw new Error(
      `No hay módulo "${ref}" en "${proyecto.nombre}". Existen: ${modulos.map((m) => m.nombre).join(', ')}.`,
    )
  throw new Error(`"${ref}" es ambiguo: ${match.map((m) => m.nombre).join(', ')}.`)
}

// Contexto módulo→proyecto de una tarea (para notificaciones y formato).
async function contextoTarea(tarea) {
  const { data, error } = await supabase
    .from('modulos')
    .select('nombre, proyectos(id, nombre, responsable_vision_id)')
    .eq('id', tarea.modulo_id)
    .maybeSingle()
  if (error) throw error
  return {
    modulo: data?.nombre ?? '?',
    proyecto: data?.proyectos ?? null,
  }
}

async function notificar({ persona_id, tipo, texto, tarea_id, proyecto_id }) {
  const actual = await asegurarSesion()
  if (!persona_id || persona_id === actual.id) return
  const { error } = await supabase.from('notificaciones').insert({
    persona_id,
    autor_id: actual.id,
    tipo,
    texto,
    tarea_id: tarea_id ?? null,
    proyecto_id: proyecto_id ?? null,
    leido: false,
  })
  if (error) console.error('No se pudo notificar:', error.message)
}

// ── Formato de salida ──────────────────────────────────────────────────────────
const ESTADOS = { proximo: 'Próximo', en_curso: 'En curso', revision: 'En revisión', hecho: 'Hecha' }

function lineaTarea(t, extra = '') {
  const partes = [
    `[${ESTADOS[t.estado] ?? t.estado}]`,
    t.titulo,
    t.fecha ? `· vence ${t.fecha}` : '',
    extra,
    `(id: ${t.id})`,
  ]
  return '- ' + partes.filter(Boolean).join(' ')
}

async function nombresPersonas(ids) {
  const unicos = [...new Set(ids.filter(Boolean))]
  if (!unicos.length) return new Map()
  const { data, error } = await supabase.from('personas').select('id, nombre').in('id', unicos)
  if (error) throw error
  return new Map((data ?? []).map((p) => [p.id, p.nombre]))
}

const texto = (t) => ({ content: [{ type: 'text', text: t }] })

// ── Servidor y herramientas ────────────────────────────────────────────────────
const server = new McpServer({ name: 'thread', version: '1.0.0' })

function tool(nombre, descripcion, shape, handler) {
  server.registerTool(nombre, { description: descripcion, inputSchema: shape }, async (args) => {
    try {
      await asegurarSesion()
      return await handler(args ?? {})
    } catch (e) {
      return { content: [{ type: 'text', text: `Error: ${e.message ?? e}` }], isError: true }
    }
  })
}

tool(
  'listar_proyectos',
  'Lista los proyectos de Thread con su estado y módulos.',
  {},
  async () => {
    const { data, error } = await supabase
      .from('proyectos')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) throw error
    if (!data?.length) return texto('No hay proyectos.')
    const lineas = []
    for (const p of data) {
      const mods = await modulosDeProyecto(p.id)
      lineas.push(
        `- ${p.nombre} [${p.estado}] · módulos: ${mods.map((m) => m.nombre).join(', ') || '—'} (id: ${p.id})`,
      )
    }
    return texto(lineas.join('\n'))
  },
)

tool(
  'equipo',
  'Lista las personas del equipo (nombre, email, rol).',
  {},
  async () => {
    const { data, error } = await supabase
      .from('personas')
      .select('*')
      .eq('activo', true)
      .order('nombre')
    if (error) throw error
    return texto(
      (data ?? []).map((p) => `- ${p.nombre} · ${p.email} · rol ${p.rol} (id: ${p.id})`).join('\n') ||
        'Sin personas.',
    )
  },
)

tool(
  'mis_tareas',
  'Tus tareas asignadas. filtro: pendientes (default) | hechas | todas.',
  { filtro: z.enum(['pendientes', 'hechas', 'todas']).optional() },
  async ({ filtro }) => {
    const actual = await asegurarSesion()
    let q = supabase
      .from('tareas')
      .select('*, modulos(nombre, proyectos(nombre))')
      .eq('responsable_id', actual.id)
      .order('fecha', { ascending: true, nullsFirst: false })
    if (filtro === 'hechas') q = q.eq('estado', 'hecho')
    else if (filtro !== 'todas') q = q.neq('estado', 'hecho')
    const { data, error } = await q
    if (error) throw error
    if (!data?.length) return texto('Sin tareas para ese filtro. 🎉')
    return texto(
      data
        .map((t) => lineaTarea(t, `· ${t.modulos?.proyectos?.nombre ?? '?'} / ${t.modulos?.nombre ?? '?'}`))
        .join('\n'),
    )
  },
)

tool(
  'listar_tareas',
  'Lista tareas con filtros opcionales: proyecto (nombre o id), estado, responsable (nombre, email o "yo"), vencidas (solo con fecha pasada y no hechas).',
  {
    proyecto: z.string().optional(),
    estado: z.enum(['proximo', 'en_curso', 'revision', 'hecho']).optional(),
    responsable: z.string().optional(),
    vencidas: z.boolean().optional(),
  },
  async ({ proyecto, estado, responsable, vencidas }) => {
    let q = supabase
      .from('tareas')
      .select('*, modulos(nombre, proyectos(nombre))')
      .order('fecha', { ascending: true, nullsFirst: false })
      .limit(100)
    if (proyecto) {
      const p = await resolverProyecto(proyecto)
      const mods = await modulosDeProyecto(p.id)
      if (!mods.length) return texto(`"${p.nombre}" no tiene módulos ni tareas.`)
      q = q.in('modulo_id', mods.map((m) => m.id))
    }
    if (estado) q = q.eq('estado', estado)
    if (responsable) q = q.eq('responsable_id', (await resolverPersona(responsable)).id)
    if (vencidas) q = q.neq('estado', 'hecho').lt('fecha', new Date().toISOString().slice(0, 10))
    const { data, error } = await q
    if (error) throw error
    if (!data?.length) return texto('Sin tareas para esos filtros.')
    const nombres = await nombresPersonas(data.map((t) => t.responsable_id))
    return texto(
      data
        .map((t) =>
          lineaTarea(
            t,
            `· ${t.modulos?.proyectos?.nombre ?? '?'} / ${t.modulos?.nombre ?? '?'}` +
              (t.responsable_id ? ` · ${nombres.get(t.responsable_id) ?? '?'}` : ' · sin asignar'),
          ),
        )
        .join('\n'),
    )
  },
)

tool(
  'ver_tarea',
  'Detalle completo de una tarea (por id o título) con sus comentarios.',
  { tarea: z.string().describe('Id o título (parcial) de la tarea') },
  async ({ tarea }) => {
    const t = await resolverTarea(tarea)
    const ctx = await contextoTarea(t)
    const nombres = await nombresPersonas([t.responsable_id])
    const { data: comentarios, error } = await supabase
      .from('comentarios')
      .select('texto, created_at, autor_id, personas(nombre)')
      .eq('tarea_id', t.id)
      .order('created_at', { ascending: true })
    if (error) throw error
    const lineas = [
      `# ${t.titulo}`,
      `Estado: ${ESTADOS[t.estado] ?? t.estado} · Tipo: ${t.tipo}`,
      `Proyecto: ${ctx.proyecto?.nombre ?? '?'} / ${ctx.modulo}`,
      `Responsable: ${t.responsable_id ? nombres.get(t.responsable_id) ?? '?' : 'sin asignar'}`,
      `Fechas: inicio ${t.fecha_inicio ?? '—'} · vence ${t.fecha ?? '—'}`,
      t.descripcion ? `Descripción: ${t.descripcion}` : '',
      t.criterio ? `Criterio de aceptación: ${t.criterio}` : '',
      `Id: ${t.id}`,
    ]
    if (comentarios?.length) {
      lineas.push('', 'Comentarios:')
      for (const c of comentarios)
        lineas.push(`- ${c.personas?.nombre ?? '?'} (${c.created_at.slice(0, 10)}): ${c.texto}`)
    }
    return texto(lineas.filter(Boolean).join('\n'))
  },
)

tool(
  'crear_tarea',
  'Crea una tarea en un proyecto/módulo. Si el proyecto tiene un solo módulo, "modulo" es opcional.',
  {
    titulo: z.string(),
    proyecto: z.string().describe('Nombre o id del proyecto'),
    modulo: z.string().optional().describe('Nombre del módulo (opcional si hay uno solo)'),
    responsable: z.string().optional().describe('Nombre, email o "yo"'),
    fecha: z.string().optional().describe('Vencimiento YYYY-MM-DD'),
    descripcion: z.string().optional(),
  },
  async ({ titulo, proyecto, modulo, responsable, fecha, descripcion }) => {
    const actual = await asegurarSesion()
    const p = await resolverProyecto(proyecto)
    const m = await resolverModulo(p, modulo)
    const resp = responsable ? await resolverPersona(responsable) : null
    const { data, error } = await supabase
      .from('tareas')
      .insert({
        titulo,
        modulo_id: m.id,
        responsable_id: resp?.id ?? null,
        fecha: fecha ?? null,
        descripcion: descripcion ?? null,
      })
      .select()
      .single()
    if (error) throw error
    if (resp && resp.id !== actual.id)
      await notificar({
        persona_id: resp.id,
        tipo: 'asignacion',
        texto: `Te asignó la tarea "${titulo}"`,
        tarea_id: data.id,
        proyecto_id: p.id,
      })
    return texto(
      `Tarea creada en ${p.nombre} / ${m.nombre}:\n` +
        lineaTarea(data, resp ? `· ${resp.nombre}` : '· sin asignar'),
    )
  },
)

// Cambio de estado con notificaciones de revisión (mismo comportamiento que la web).
async function cambiarEstado(ref, nuevoEstado) {
  const actual = await asegurarSesion()
  const previa = await resolverTarea(ref)
  const { data, error } = await supabase
    .from('tareas')
    .update({ estado: nuevoEstado })
    .eq('id', previa.id)
    .select()
    .single()
  if (error) throw error
  const ctx = await contextoTarea(data)

  if (nuevoEstado === 'revision' && previa.estado !== 'revision') {
    await notificar({
      persona_id: ctx.proyecto?.responsable_vision_id,
      tipo: 'revision',
      texto: `envió a revisión la tarea "${data.titulo}"`,
      tarea_id: data.id,
      proyecto_id: ctx.proyecto?.id,
    })
  }
  if (previa.estado === 'revision' && nuevoEstado === 'hecho') {
    await notificar({
      persona_id: data.responsable_id,
      tipo: 'revision',
      texto: `aprobó tu tarea "${data.titulo}"`,
      tarea_id: data.id,
      proyecto_id: ctx.proyecto?.id,
    })
  }
  return { data, previa, ctx }
}

tool(
  'empezar_tarea',
  'Marca una tarea como "en curso".',
  { tarea: z.string() },
  async ({ tarea }) => {
    const { data } = await cambiarEstado(tarea, 'en_curso')
    return texto(`En curso: "${data.titulo}".`)
  },
)

tool(
  'completar_tarea',
  'Marca una tarea como hecha. Si estaba en revisión, cuenta como aprobada.',
  { tarea: z.string() },
  async ({ tarea }) => {
    const { data, previa } = await cambiarEstado(tarea, 'hecho')
    return texto(
      previa.estado === 'revision'
        ? `Aprobada y completada: "${data.titulo}".`
        : `Completada: "${data.titulo}". ✅`,
    )
  },
)

tool(
  'enviar_a_revision',
  'Manda una tarea a revisión (aparece en la bandeja de Revisiones y se avisa al responsable de visión).',
  { tarea: z.string() },
  async ({ tarea }) => {
    const { data, ctx } = await cambiarEstado(tarea, 'revision')
    const aviso = ctx.proyecto?.responsable_vision_id
      ? ' Se avisó al responsable de visión.'
      : ' (El proyecto no tiene responsable de visión configurado.)'
    return texto(`"${data.titulo}" quedó en revisión.${aviso}`)
  },
)

tool(
  'revisiones_pendientes',
  'Tareas esperando revisión (la que más espera, primero).',
  {},
  async () => {
    const { data, error } = await supabase
      .from('tareas')
      .select('*, modulos(nombre, proyectos(nombre))')
      .eq('estado', 'revision')
      .order('updated_at', { ascending: true })
    if (error) throw error
    if (!data?.length) return texto('No hay tareas esperando revisión.')
    const nombres = await nombresPersonas(data.map((t) => t.responsable_id))
    return texto(
      data
        .map((t) =>
          lineaTarea(
            t,
            `· ${t.modulos?.proyectos?.nombre ?? '?'} / ${t.modulos?.nombre ?? '?'}` +
              (t.responsable_id ? ` · de ${nombres.get(t.responsable_id) ?? '?'}` : ''),
          ),
        )
        .join('\n'),
    )
  },
)

tool(
  'aprobar_tarea',
  'Aprueba una tarea en revisión (pasa a hecha y se avisa al responsable).',
  { tarea: z.string() },
  async ({ tarea }) => {
    const t = await resolverTarea(tarea)
    if (t.estado !== 'revision')
      throw new Error(`"${t.titulo}" no está en revisión (estado: ${ESTADOS[t.estado] ?? t.estado}).`)
    const { data } = await cambiarEstado(t.id, 'hecho')
    return texto(`Aprobada: "${data.titulo}". ✅`)
  },
)

tool(
  'devolver_tarea',
  'Devuelve una tarea de revisión a "en curso" con un motivo (queda como comentario y se avisa al responsable).',
  { tarea: z.string(), motivo: z.string().describe('Por qué se devuelve') },
  async ({ tarea, motivo }) => {
    const actual = await asegurarSesion()
    const t = await resolverTarea(tarea)
    if (t.estado !== 'revision')
      throw new Error(`"${t.titulo}" no está en revisión (estado: ${ESTADOS[t.estado] ?? t.estado}).`)
    const { error: errCom } = await supabase.from('comentarios').insert({
      tarea_id: t.id,
      autor_id: actual.id,
      texto: `Devuelta de revisión: ${motivo}`,
    })
    if (errCom) throw errCom
    const { data, ctx } = await cambiarEstado(t.id, 'en_curso')
    await notificar({
      persona_id: data.responsable_id,
      tipo: 'revision',
      texto: `devolvió tu tarea "${data.titulo}": ${motivo}`,
      tarea_id: data.id,
      proyecto_id: ctx.proyecto?.id,
    })
    return texto(`Devuelta a en curso: "${data.titulo}". Motivo registrado como comentario.`)
  },
)

tool(
  'comentar_tarea',
  'Agrega un comentario a una tarea.',
  { tarea: z.string(), texto: z.string() },
  async ({ tarea, texto: cuerpo }) => {
    const actual = await asegurarSesion()
    const t = await resolverTarea(tarea)
    const { error } = await supabase
      .from('comentarios')
      .insert({ tarea_id: t.id, autor_id: actual.id, texto: cuerpo })
    if (error) throw error
    if (t.responsable_id && t.responsable_id !== actual.id) {
      const ctx = await contextoTarea(t)
      await notificar({
        persona_id: t.responsable_id,
        tipo: 'comentario',
        texto: `comentó en "${t.titulo}": "${cuerpo.slice(0, 50)}"`,
        tarea_id: t.id,
        proyecto_id: ctx.proyecto?.id,
      })
    }
    return texto(`Comentario agregado a "${t.titulo}".`)
  },
)

tool(
  'asignar_tarea',
  'Asigna (o reasigna) el responsable de una tarea. Usa "yo" para autoasignarte.',
  { tarea: z.string(), responsable: z.string() },
  async ({ tarea, responsable }) => {
    const t = await resolverTarea(tarea)
    const p = await resolverPersona(responsable)
    const { data, error } = await supabase
      .from('tareas')
      .update({ responsable_id: p.id })
      .eq('id', t.id)
      .select()
      .single()
    if (error) throw error
    const ctx = await contextoTarea(data)
    await notificar({
      persona_id: p.id,
      tipo: 'asignacion',
      texto: `Te asignó la tarea "${data.titulo}"`,
      tarea_id: data.id,
      proyecto_id: ctx.proyecto?.id,
    })
    return texto(`"${data.titulo}" asignada a ${p.nombre}.`)
  },
)

const transport = new StdioServerTransport()
await server.connect(transport)
console.error(`Thread MCP listo (${SUPABASE_URL}).`)
