// Hooks de datos para la entidad `proyectos`.
// Toda la lógica de Supabase para proyectos vive acá; los componentes solo usan estos hooks.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Tables, TablesInsert, TablesUpdate } from '../lib/database.types.ts'
import { supabase } from '../lib/supabase.ts'
import { qk } from './queryKeys.ts'

type Proyecto = Tables<'proyectos'>

// Listado global de proyectos, ordenado por fecha de creación.
export function useProyectos() {
  return useQuery({
    queryKey: qk.proyectos.list(),
    queryFn: async (): Promise<Proyecto[]> => {
      const { data, error } = await supabase
        .from('proyectos')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

// Crear proyecto con update optimista (item temporal con id provisorio).
export function useCrearProyecto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (nuevo: TablesInsert<'proyectos'>): Promise<Proyecto> => {
      const { data, error } = await supabase
        .from('proyectos')
        .insert(nuevo)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onMutate: async (nuevo) => {
      const queryKey = qk.proyectos.list()
      await queryClient.cancelQueries({ queryKey })
      const previo = queryClient.getQueryData<Proyecto[]>(queryKey)
      const optimista: Proyecto = {
        id: crypto.randomUUID(),
        nombre: nuevo.nombre,
        descripcion: nuevo.descripcion ?? null,
        color: nuevo.color || '#c96442',
        estado: nuevo.estado ?? 'activo',
        que_es: nuevo.que_es ?? null,
        para_quien: nuevo.para_quien ?? null,
        problema: nuevo.problema ?? null,
        responsable_vision_id: nuevo.responsable_vision_id ?? null,
        created_at: nuevo.created_at ?? new Date().toISOString(),
      }
      queryClient.setQueryData<Proyecto[]>(queryKey, (viejo) => [...(viejo ?? []), optimista])
      return { previo }
    },
    onError: (_error, _nuevo, context) => {
      if (context?.previo) {
        queryClient.setQueryData(qk.proyectos.list(), context.previo)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.proyectos.all })
    },
  })
}

// Actualizar proyecto con merge optimista.
export function useActualizarProyecto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      cambios,
    }: {
      id: string
      cambios: TablesUpdate<'proyectos'>
    }): Promise<Proyecto> => {
      const { data, error } = await supabase
        .from('proyectos')
        .update(cambios)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onMutate: async ({ id, cambios }) => {
      const queryKey = qk.proyectos.list()
      await queryClient.cancelQueries({ queryKey })
      const previo = queryClient.getQueryData<Proyecto[]>(queryKey)
      queryClient.setQueryData<Proyecto[]>(queryKey, (viejo) =>
        (viejo ?? []).map((p) => (p.id === id ? { ...p, ...cambios } : p)),
      )
      return { previo }
    },
    onError: (_error, _vars, context) => {
      if (context?.previo) {
        queryClient.setQueryData(qk.proyectos.list(), context.previo)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.proyectos.all })
    },
  })
}

// Eliminar proyecto con filtrado optimista.
export function useEliminarProyecto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from('proyectos').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async (id) => {
      const queryKey = qk.proyectos.list()
      await queryClient.cancelQueries({ queryKey })
      const previo = queryClient.getQueryData<Proyecto[]>(queryKey)
      queryClient.setQueryData<Proyecto[]>(queryKey, (viejo) =>
        (viejo ?? []).filter((p) => p.id !== id),
      )
      return { previo }
    },
    onError: (_error, _id, context) => {
      if (context?.previo) {
        queryClient.setQueryData(qk.proyectos.list(), context.previo)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.proyectos.all })
    },
  })
}
