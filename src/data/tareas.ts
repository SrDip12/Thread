// Hooks de datos para la entidad `tareas`.
// Toda la lógica de Supabase para tareas vive acá; los componentes solo usan estos hooks.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Tables, TablesInsert, TablesUpdate } from '../lib/database.types.ts'
import { supabase } from '../lib/supabase.ts'
import { useAuth } from '../auth/AuthProvider.tsx'
import { diasHasta } from '../lib/ui.ts'
import { qk } from './queryKeys.ts'
import i18n from '../i18n/index.ts'

type Tarea = Tables<'tareas'>

// Tarea con su proyecto resuelto (para vistas transversales). El embed se castea
// porque database.types.ts trae `Relationships: []` (ver su comentario).
export interface TareaConProyecto extends Tarea {
  modulos: {
    nombre: string
    proyectos: { id: string; nombre: string; color: string }
  } | null
}

// Tareas de un proyecto (todas sus tareas, vía sus módulos). Para stats de cabecera.
export function useTareasPorProyecto(proyectoId: string) {
  return useQuery({
    queryKey: qk.tareas.byProyecto(proyectoId),
    queryFn: async (): Promise<Tarea[]> => {
      const { data: mods, error: e1 } = await supabase
        .from('modulos')
        .select('id')
        .eq('proyecto_id', proyectoId)
      if (e1) throw e1
      const ids = (mods ?? []).map((m) => m.id)
      if (ids.length === 0) return []
      const { data, error } = await supabase
        .from('tareas')
        .select('*')
        .in('modulo_id', ids)
      if (error) throw error
      return data
    },
    enabled: Boolean(proyectoId),
  })
}

// Tareas donde la persona es responsable, con proyecto resuelto. Para /mis-tareas.
export function useMisTareas(personaId: string) {
  return useQuery({
    queryKey: qk.tareas.mias(personaId),
    queryFn: async (): Promise<TareaConProyecto[]> => {
      const { data, error } = await supabase
        .from('tareas')
        .select('*, modulos(nombre, proyectos(id, nombre, color))')
        .eq('responsable_id', personaId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as TareaConProyecto[]
    },
    enabled: Boolean(personaId),
  })
}

export interface StatProyecto {
  total: number
  hechas: number
  vencidas: number
  pct: number
  modulos: number
  miembros: string[]
}

// Agregado por proyecto (avance, conteos, miembros) en una sola pasada. Para la lista de proyectos.
export function useEstadisticasProyectos() {
  return useQuery({
    queryKey: qk.tareas.statsProyectos(),
    queryFn: async (): Promise<Record<string, StatProyecto>> => {
      const { data: mods, error: e1 } = await supabase.from('modulos').select('id, proyecto_id')
      if (e1) throw e1
      const modToProy = new Map((mods ?? []).map((m) => [m.id, m.proyecto_id]))
      const { data: tareas, error: e2 } = await supabase
        .from('tareas')
        .select('modulo_id, estado, responsable_id, fecha')
      if (e2) throw e2

      const vacio = (): StatProyecto => ({ total: 0, hechas: 0, vencidas: 0, pct: 0, modulos: 0, miembros: [] })
      const stats: Record<string, StatProyecto> = {}
      for (const [, proyectoId] of modToProy) {
        stats[proyectoId] ??= vacio()
        stats[proyectoId].modulos += 1
      }
      const miembrosSet: Record<string, Set<string>> = {}
      for (const t of tareas ?? []) {
        const proyectoId = modToProy.get(t.modulo_id)
        if (!proyectoId) continue
        const s = (stats[proyectoId] ??= vacio())
        s.total += 1
        if (t.estado === 'hecho') s.hechas += 1
        else if (t.fecha && diasHasta(t.fecha) < 0) s.vencidas += 1
        if (t.responsable_id) (miembrosSet[proyectoId] ??= new Set()).add(t.responsable_id)
      }
      for (const [proyectoId, s] of Object.entries(stats)) {
        s.pct = s.total > 0 ? Math.round((s.hechas / s.total) * 100) : 0
        s.miembros = [...(miembrosSet[proyectoId] ?? [])]
      }
      return stats
    },
  })
}

// Tarea con el nombre de su módulo (vistas que cruzan módulos: sprint, backlog).
export interface TareaConModulo extends Tarea {
  modulos: { nombre: string } | null
}

// Tareas asignadas a un sprint (de todos los módulos del proyecto).
export function useTareasSprint(sprintId: string) {
  return useQuery({
    queryKey: qk.tareas.bySprint(sprintId),
    queryFn: async (): Promise<TareaConModulo[]> => {
      const { data, error } = await supabase
        .from('tareas')
        .select('*, modulos(nombre)')
        .eq('sprint_id', sprintId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as TareaConModulo[]
    },
    enabled: Boolean(sprintId),
  })
}

// Backlog: tareas del proyecto sin sprint asignado.
export function useTareasBacklog(proyectoId: string) {
  return useQuery({
    queryKey: qk.tareas.backlog(proyectoId),
    queryFn: async (): Promise<TareaConModulo[]> => {
      const { data: mods, error: e1 } = await supabase
        .from('modulos')
        .select('id')
        .eq('proyecto_id', proyectoId)
      if (e1) throw e1
      const ids = (mods ?? []).map((m) => m.id)
      if (ids.length === 0) return []
      const { data, error } = await supabase
        .from('tareas')
        .select('*, modulos(nombre)')
        .in('modulo_id', ids)
        .is('sprint_id', null)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as TareaConModulo[]
    },
    enabled: Boolean(proyectoId),
  })
}

// Tareas creadas en una reunión (reunion_id seteado), con proyecto resuelto.
export function useTareasReunion(reunionId: string) {
  return useQuery({
    queryKey: qk.tareas.byReunion(reunionId),
    queryFn: async (): Promise<TareaConProyecto[]> => {
      const { data, error } = await supabase
        .from('tareas')
        .select('*, modulos(nombre, proyectos(id, nombre, color))')
        .eq('reunion_id', reunionId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as TareaConProyecto[]
    },
    enabled: Boolean(reunionId),
  })
}

// Tareas en estado 'revision' de todos los proyectos, con proyecto resuelto.
// Para la bandeja de /revisiones: la más antigua (que más espera) primero.
export function useTareasEnRevision() {
  return useQuery({
    queryKey: qk.tareas.enRevision(),
    queryFn: async (): Promise<TareaConProyecto[]> => {
      const { data, error } = await supabase
        .from('tareas')
        .select('*, modulos(nombre, proyectos(id, nombre, color))')
        .eq('estado', 'revision')
        .order('updated_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as TareaConProyecto[]
    },
  })
}

// Correcciones de cliente ABIERTAS del proyecto: tareas tipo='correccion' que no
// están en estado 'hecho', de cualquier módulo del proyecto (cruza por modulo_id).
// Con el nombre del módulo resuelto para mostrarlo en la sección del detalle.
export function useCorreccionesCliente(proyectoId: string) {
  return useQuery({
    queryKey: qk.tareas.correcciones(proyectoId),
    queryFn: async (): Promise<TareaConModulo[]> => {
      const { data: mods, error: e1 } = await supabase
        .from('modulos')
        .select('id')
        .eq('proyecto_id', proyectoId)
      if (e1) throw e1
      const ids = (mods ?? []).map((m) => m.id)
      if (ids.length === 0) return []
      const { data, error } = await supabase
        .from('tareas')
        .select('*, modulos(nombre)')
        .in('modulo_id', ids)
        .eq('tipo', 'correccion')
        .neq('estado', 'hecho')
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as TareaConModulo[]
    },
    enabled: Boolean(proyectoId),
  })
}

// Listado de tareas de un módulo, ordenado por fecha de creación.
export function useTareas(moduloId: string) {
  return useQuery({
    queryKey: qk.tareas.byModulo(moduloId),
    queryFn: async (): Promise<Tarea[]> => {
      const { data, error } = await supabase
        .from('tareas')
        .select('*')
        .eq('modulo_id', moduloId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: Boolean(moduloId),
  })
}

// Aplica `cambios` a la tarea `id` en TODAS las listas de tareas cacheadas
// (módulo, sprint, backlog, "mías"…) para que la edición se vea al instante en
// cualquier vista montada, no solo en la del módulo. Las listas que no son arrays
// (p.ej. stats-proyectos, bajo la misma key raíz) se devuelven intactas.
// La membresía por `sprint_id` (mover backlog↔sprint) se reconcilia en onSettled.
function patchTareaEnCache(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
  cambios: TablesUpdate<'tareas'>,
) {
  queryClient.setQueriesData<unknown>({ queryKey: qk.tareas.all }, (lista: unknown) =>
    Array.isArray(lista)
      ? (lista as Tarea[]).map((t) => (t.id === id ? { ...t, ...cambios } : t))
      : lista,
  )
}

// Snapshot de todas las listas de tareas, para rollback en onError.
function snapshotTareas(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.getQueriesData({ queryKey: qk.tareas.all })
}
function restaurarTareas(
  queryClient: ReturnType<typeof useQueryClient>,
  snapshot: ReturnType<typeof snapshotTareas>,
) {
  for (const [key, data] of snapshot) queryClient.setQueryData(key, data)
}

// Crear tarea con update optimista. La tarea aparece al instante en la lista del
// módulo y —si lleva sprint_id (quick-add al sprint)— también en la del sprint.
export function useCrearTarea() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (nueva: TablesInsert<'tareas'>): Promise<Tarea> => {
      const { data, error } = await supabase
        .from('tareas')
        .insert(nueva)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onMutate: async (nueva) => {
      await queryClient.cancelQueries({ queryKey: qk.tareas.all })
      const snapshot = snapshotTareas(queryClient)
      const ahora = new Date().toISOString()
      const optimista: Tarea = {
        id: crypto.randomUUID(),
        modulo_id: nueva.modulo_id,
        titulo: nueva.titulo,
        descripcion: nueva.descripcion ?? null,
        responsable_id: nueva.responsable_id ?? null,
        estado: nueva.estado ?? 'proximo',
        fecha: nueva.fecha ?? null,
        fecha_inicio: nueva.fecha_inicio ?? null,
        sprint_id: nueva.sprint_id ?? null,
        reunion_id: nueva.reunion_id ?? null,
        tipo: nueva.tipo ?? 'tarea',
        criterio: nueva.criterio ?? null,
        created_at: nueva.created_at ?? ahora,
        updated_at: nueva.updated_at ?? ahora,
      }
      queryClient.setQueryData<Tarea[]>(qk.tareas.byModulo(nueva.modulo_id), (viejo) => [
        ...(viejo ?? []),
        optimista,
      ])
      // También en la lista por proyecto (la que renderizan detalle y sprint).
      // El proyecto del módulo sale del cache de módulos; si no está, onSettled refetchea.
      for (const [, mods] of queryClient.getQueriesData<{ id: string; proyecto_id: string }[]>({
        queryKey: qk.modulos.all,
      })) {
        const m = Array.isArray(mods) ? mods.find((x) => x.id === nueva.modulo_id) : undefined
        if (m) {
          queryClient.setQueryData<Tarea[]>(qk.tareas.byProyecto(m.proyecto_id), (viejo) =>
            viejo ? [...viejo, optimista] : viejo,
          )
          break
        }
      }
      if (nueva.sprint_id) {
        // Solo si la lista ya está cacheada (vista de sprint montada); el nombre
        // de módulo llega en el refetch de onSettled.
        queryClient.setQueryData<TareaConModulo[]>(qk.tareas.bySprint(nueva.sprint_id), (viejo) =>
          viejo ? [...viejo, { ...optimista, modulos: null }] : viejo,
        )
      }
      return { snapshot }
    },
    onError: (_error, _nueva, context) => {
      if (context) restaurarTareas(queryClient, context.snapshot)
    },
    onSettled: () => {
      // Invalida todo el árbol de tareas: módulo, proyecto, sprint, backlog y "mías" se refrescan.
      void queryClient.invalidateQueries({ queryKey: qk.tareas.all })
    },
  })
}

// Actualizar tarea con merge optimista en todas las vistas.
export function useActualizarTarea() {
  const queryClient = useQueryClient()
  const { persona } = useAuth()
  const yoId = persona?.id ?? null
  return useMutation({
    mutationFn: async ({
      id,
      cambios,
    }: {
      id: string
      moduloId: string
      cambios: TablesUpdate<'tareas'>
    }): Promise<Tarea> => {
      // El estado previo hace falta para notificar una asignación nueva o una
      // transición de revisión; en el resto de updates (fechas…) va directo el UPDATE.
      const notificar = Boolean(cambios.responsable_id) && cambios.responsable_id !== yoId
      const cambiaEstado = Boolean(cambios.estado)
      let previa: {
        responsable_id: string | null
        titulo: string
        modulo_id: string
        estado: Tarea['estado']
      } | null = null
      if (notificar || cambiaEstado) {
        const { data: actual, error: errGet } = await supabase
          .from('tareas')
          .select('responsable_id, titulo, modulo_id, estado')
          .eq('id', id)
          .single()
        if (errGet) throw errGet
        previa = actual
      }

      const { data, error } = await supabase
        .from('tareas')
        .update(cambios)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error

      // Avisar al nuevo responsable (si no se autoasignó y de verdad cambió).
      if (notificar && previa && cambios.responsable_id !== previa.responsable_id) {
        try {
          const { data: mod } = await supabase
            .from('modulos')
            .select('proyecto_id')
            .eq('id', previa.modulo_id)
            .single()
          await supabase.from('notificaciones').insert({
            persona_id: cambios.responsable_id as string,
            autor_id: yoId,
            tipo: 'asignacion',
            texto: i18n.t('notif.genAsigno', { titulo: previa.titulo }),
            tarea_id: id,
            proyecto_id: mod?.proyecto_id ?? null,
            leido: false,
          })
        } catch (e) {
          console.error('Error al insertar notificación de asignación:', e)
        }
      }

      // Transiciones de revisión: avisar al responsable de visión cuando una
      // tarea entra a revisión, y al responsable cuando se la aprueban o devuelven.
      if (previa && cambios.estado && cambios.estado !== previa.estado) {
        try {
          const entraARevision = cambios.estado === 'revision'
          const saleDeRevision = previa.estado === 'revision'
          if (entraARevision || saleDeRevision) {
            const { data: mod } = await supabase
              .from('modulos')
              .select('proyecto_id, proyectos(id, responsable_vision_id)')
              .eq('id', previa.modulo_id)
              .single()
            const proyecto = (mod as unknown as {
              proyecto_id: string
              proyectos: { id: string; responsable_vision_id: string | null } | null
            } | null)?.proyectos
            const avisos: { persona_id: string; texto: string }[] = []
            if (entraARevision && proyecto?.responsable_vision_id && proyecto.responsable_vision_id !== yoId) {
              avisos.push({
                persona_id: proyecto.responsable_vision_id,
                texto: i18n.t('notif.genEnvioRevision', { titulo: previa.titulo }),
              })
            }
            if (saleDeRevision && previa.responsable_id && previa.responsable_id !== yoId) {
              if (cambios.estado === 'hecho') {
                avisos.push({ persona_id: previa.responsable_id, texto: i18n.t('notif.genAprobo', { titulo: previa.titulo }) })
              } else if (cambios.estado === 'en_curso') {
                avisos.push({ persona_id: previa.responsable_id, texto: i18n.t('notif.genDevolvio', { titulo: previa.titulo }) })
              }
            }
            if (avisos.length) {
              await supabase.from('notificaciones').insert(
                avisos.map((a) => ({
                  persona_id: a.persona_id,
                  autor_id: yoId,
                  tipo: 'revision',
                  texto: a.texto,
                  tarea_id: id,
                  proyecto_id: proyecto?.id ?? null,
                  leido: false,
                })),
              )
            }
          }
        } catch (e) {
          console.error('Error al insertar notificación de revisión:', e)
        }
      }

      return data
    },
    onMutate: async ({ id, cambios }) => {
      await queryClient.cancelQueries({ queryKey: qk.tareas.all })
      const snapshot = snapshotTareas(queryClient)
      patchTareaEnCache(queryClient, id, cambios)
      return { snapshot }
    },
    onError: (_error, _vars, context) => {
      if (context) restaurarTareas(queryClient, context.snapshot)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.tareas.all })
    },
  })
}

// Eliminar tarea con filtrado optimista.
export function useEliminarTarea() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; moduloId: string }): Promise<void> => {
      const { error } = await supabase.from('tareas').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id }) => {
      // Filtra la tarea de TODAS las listas cacheadas (módulo, proyecto, sprint, mías…).
      await queryClient.cancelQueries({ queryKey: qk.tareas.all })
      const snapshot = snapshotTareas(queryClient)
      queryClient.setQueriesData<unknown>({ queryKey: qk.tareas.all }, (lista: unknown) =>
        Array.isArray(lista) ? (lista as Tarea[]).filter((t) => t.id !== id) : lista,
      )
      return { snapshot }
    },
    onError: (_error, _vars, context) => {
      if (context) restaurarTareas(queryClient, context.snapshot)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.tareas.all })
    },
  })
}

// ── Hooks de dependencias entre tareas ──────────────────────────────────────────

export function useDependenciasTarea(tareaId: string) {
  return useQuery({
    queryKey: ['tarea_dependencias', tareaId],
    queryFn: async (): Promise<{ bloqueadora_id: string; bloqueada_id: string }[]> => {
      const { data, error } = await supabase
        .from('tarea_dependencias')
        .select('bloqueadora_id, bloqueada_id')
        .or(`bloqueadora_id.eq.${tareaId},bloqueada_id.eq.${tareaId}`)
      if (error) throw error
      return data ?? []
    },
    enabled: Boolean(tareaId),
  })
}

export function useProyectoDependencias(proyectoId: string) {
  return useQuery({
    queryKey: ['proyecto_dependencias', proyectoId],
    queryFn: async (): Promise<{ bloqueadora_id: string; bloqueada_id: string }[]> => {
      const { data, error } = await supabase
        .from('tarea_dependencias')
        .select('bloqueadora_id, bloqueada_id')
      if (error) throw error
      return data ?? []
    },
    enabled: Boolean(proyectoId),
  })
}

export function useCrearDependencia() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (dep: { bloqueadora_id: string; bloqueada_id: string }): Promise<void> => {
      const { error } = await supabase.from('tarea_dependencias').insert(dep)
      if (error) throw error
    },
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['tarea_dependencias', variables.bloqueada_id] })
      void queryClient.invalidateQueries({ queryKey: ['tarea_dependencias', variables.bloqueadora_id] })
      void queryClient.invalidateQueries({ queryKey: ['proyecto_dependencias'] })
      void queryClient.invalidateQueries({ queryKey: qk.tareas.all })
    },
  })
}

export function useEliminarDependencia() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (dep: { bloqueadora_id: string; bloqueada_id: string }): Promise<void> => {
      const { error } = await supabase
        .from('tarea_dependencias')
        .delete()
        .eq('bloqueadora_id', dep.bloqueadora_id)
        .eq('bloqueada_id', dep.bloqueada_id)
      if (error) throw error
    },
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['tarea_dependencias', variables.bloqueada_id] })
      void queryClient.invalidateQueries({ queryKey: ['tarea_dependencias', variables.bloqueadora_id] })
      void queryClient.invalidateQueries({ queryKey: ['proyecto_dependencias'] })
      void queryClient.invalidateQueries({ queryKey: qk.tareas.all })
    },
  })
}

