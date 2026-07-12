// Hooks de datos para la entidad `sprints`. Sin lógica de Supabase en componentes.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Tables, TablesInsert, TablesUpdate } from '../lib/database.types.ts'
import { supabase } from '../lib/supabase.ts'
import { qk } from './queryKeys.ts'

type Sprint = Tables<'sprints'>

// Listado de sprints de un proyecto, del más nuevo al más viejo.
export function useSprints(proyectoId: string) {
  return useQuery({
    queryKey: qk.sprints.byProyecto(proyectoId),
    queryFn: async (): Promise<Sprint[]> => {
      const { data, error } = await supabase
        .from('sprints')
        .select('*')
        .eq('proyecto_id', proyectoId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: Boolean(proyectoId),
  })
}

function invalidarSprints(
  queryClient: ReturnType<typeof useQueryClient>,
  proyectoId: string,
) {
  void queryClient.invalidateQueries({ queryKey: qk.sprints.byProyecto(proyectoId) })
}

// Crear sprint con update optimista.
export function useCrearSprint() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (nuevo: TablesInsert<'sprints'>): Promise<Sprint> => {
      const { data, error } = await supabase.from('sprints').insert(nuevo).select().single()
      if (error) throw error
      return data
    },
    onMutate: async (nuevo) => {
      const queryKey = qk.sprints.byProyecto(nuevo.proyecto_id)
      await queryClient.cancelQueries({ queryKey })
      const previo = queryClient.getQueryData<Sprint[]>(queryKey)
      const optimista: Sprint = {
        id: crypto.randomUUID(),
        proyecto_id: nuevo.proyecto_id,
        nombre: nuevo.nombre,
        objetivo: nuevo.objetivo ?? null,
        fecha_inicio: nuevo.fecha_inicio ?? null,
        fecha_fin: nuevo.fecha_fin ?? null,
        estado: nuevo.estado ?? 'planificado',
        cierre_logros: nuevo.cierre_logros ?? null,
        cierre_pegados: nuevo.cierre_pegados ?? null,
        cierre_cambio: nuevo.cierre_cambio ?? null,
        created_at: nuevo.created_at ?? new Date().toISOString(),
      }
      queryClient.setQueryData<Sprint[]>(queryKey, (viejo) => [optimista, ...(viejo ?? [])])
      return { previo, proyectoId: nuevo.proyecto_id }
    },
    onError: (_error, nuevo, context) => {
      if (context?.previo) {
        queryClient.setQueryData(qk.sprints.byProyecto(nuevo.proyecto_id), context.previo)
      }
    },
    onSettled: (_data, _error, nuevo) => invalidarSprints(queryClient, nuevo.proyecto_id),
  })
}

// Cerrar sprint: lo marca cerrado y devuelve al backlog las tareas no terminadas,
// en un UPDATE por tabla (antes era una mutación por tarea).
export function useCerrarSprint() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; proyectoId: string }): Promise<void> => {
      const { error: e1 } = await supabase.from('sprints').update({ estado: 'cerrado' }).eq('id', id)
      if (e1) throw e1
      const { error: e2 } = await supabase
        .from('tareas')
        .update({ sprint_id: null })
        .eq('sprint_id', id)
        .neq('estado', 'hecho')
      if (e2) throw e2
    },
    onSettled: (_data, _error, { proyectoId }) => {
      invalidarSprints(queryClient, proyectoId)
      void queryClient.invalidateQueries({ queryKey: qk.tareas.all })
    },
  })
}

// Actualizar sprint (objetivo, fechas, estado, campos de cierre) con merge optimista.
export function useActualizarSprint() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      cambios,
    }: {
      id: string
      proyectoId: string
      cambios: TablesUpdate<'sprints'>
    }): Promise<Sprint> => {
      const { data, error } = await supabase
        .from('sprints')
        .update(cambios)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onMutate: async ({ id, proyectoId, cambios }) => {
      const queryKey = qk.sprints.byProyecto(proyectoId)
      await queryClient.cancelQueries({ queryKey })
      const previo = queryClient.getQueryData<Sprint[]>(queryKey)
      queryClient.setQueryData<Sprint[]>(queryKey, (viejo) =>
        (viejo ?? []).map((s) => (s.id === id ? { ...s, ...cambios } : s)),
      )
      return { previo, proyectoId }
    },
    onError: (_error, { proyectoId }, context) => {
      if (context?.previo) {
        queryClient.setQueryData(qk.sprints.byProyecto(proyectoId), context.previo)
      }
    },
    onSettled: (_data, _error, { proyectoId }) => invalidarSprints(queryClient, proyectoId),
  })
}
