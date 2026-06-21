// Hooks de datos para la entidad `modulos`.
// Toda la lógica de Supabase para módulos vive acá; los componentes solo usan estos hooks.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Tables, TablesInsert, TablesUpdate } from '../lib/database.types.ts'
import { supabase } from '../lib/supabase.ts'
import { qk } from './queryKeys.ts'

type Modulo = Tables<'modulos'>

// Listado de módulos de un proyecto, ordenado por `orden`.
export function useModulos(proyectoId: string) {
  return useQuery({
    queryKey: qk.modulos.byProyecto(proyectoId),
    queryFn: async (): Promise<Modulo[]> => {
      const { data, error } = await supabase
        .from('modulos')
        .select('*')
        .eq('proyecto_id', proyectoId)
        .order('orden', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: Boolean(proyectoId),
  })
}

// Crear módulo con update optimista.
export function useCrearModulo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (nuevo: TablesInsert<'modulos'>): Promise<Modulo> => {
      const { data, error } = await supabase
        .from('modulos')
        .insert(nuevo)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onMutate: async (nuevo) => {
      const queryKey = qk.modulos.byProyecto(nuevo.proyecto_id)
      await queryClient.cancelQueries({ queryKey })
      const previo = queryClient.getQueryData<Modulo[]>(queryKey)
      const optimista: Modulo = {
        id: crypto.randomUUID(),
        proyecto_id: nuevo.proyecto_id,
        nombre: nuevo.nombre,
        descripcion: nuevo.descripcion ?? null,
        orden: nuevo.orden ?? 0,
        estado: nuevo.estado ?? 'abierto',
      }
      queryClient.setQueryData<Modulo[]>(queryKey, (viejo) => [...(viejo ?? []), optimista])
      return { previo, queryKey }
    },
    onError: (_error, _nuevo, context) => {
      if (context) {
        queryClient.setQueryData(context.queryKey, context.previo)
      }
    },
    onSettled: (_data, _error, nuevo) => {
      void queryClient.invalidateQueries({ queryKey: qk.modulos.byProyecto(nuevo.proyecto_id) })
    },
  })
}

// Actualizar módulo con merge optimista.
export function useActualizarModulo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      cambios,
    }: {
      id: string
      proyectoId: string
      cambios: TablesUpdate<'modulos'>
    }): Promise<Modulo> => {
      const { data, error } = await supabase
        .from('modulos')
        .update(cambios)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onMutate: async ({ id, proyectoId, cambios }) => {
      const queryKey = qk.modulos.byProyecto(proyectoId)
      await queryClient.cancelQueries({ queryKey })
      const previo = queryClient.getQueryData<Modulo[]>(queryKey)
      queryClient.setQueryData<Modulo[]>(queryKey, (viejo) =>
        (viejo ?? []).map((m) => (m.id === id ? { ...m, ...cambios } : m)),
      )
      return { previo, queryKey }
    },
    onError: (_error, _vars, context) => {
      if (context) {
        queryClient.setQueryData(context.queryKey, context.previo)
      }
    },
    onSettled: (_data, _error, { proyectoId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.modulos.byProyecto(proyectoId) })
    },
  })
}

// Eliminar módulo con filtrado optimista.
export function useEliminarModulo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; proyectoId: string }): Promise<void> => {
      const { error } = await supabase.from('modulos').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, proyectoId }) => {
      const queryKey = qk.modulos.byProyecto(proyectoId)
      await queryClient.cancelQueries({ queryKey })
      const previo = queryClient.getQueryData<Modulo[]>(queryKey)
      queryClient.setQueryData<Modulo[]>(queryKey, (viejo) =>
        (viejo ?? []).filter((m) => m.id !== id),
      )
      return { previo, queryKey }
    },
    onError: (_error, _vars, context) => {
      if (context) {
        queryClient.setQueryData(context.queryKey, context.previo)
      }
    },
    onSettled: (_data, _error, { proyectoId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.modulos.byProyecto(proyectoId) })
    },
  })
}
