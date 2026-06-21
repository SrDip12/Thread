// Hooks de datos para la entidad `personas`.
// Toda la lógica de Supabase para personas vive acá; los componentes solo usan estos hooks.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Tables, TablesInsert, TablesUpdate } from '../lib/database.types.ts'
import { supabase } from '../lib/supabase.ts'
import { qk } from './queryKeys.ts'

type Persona = Tables<'personas'>

// Listado global de personas, ordenado por nombre.
export function usePersonas() {
  return useQuery({
    queryKey: qk.personas.list(),
    queryFn: async (): Promise<Persona[]> => {
      const { data, error } = await supabase
        .from('personas')
        .select('*')
        .order('nombre', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

// Crear persona con update optimista.
export function useCrearPersona() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (nueva: TablesInsert<'personas'>): Promise<Persona> => {
      const { data, error } = await supabase
        .from('personas')
        .insert(nueva)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onMutate: async (nueva) => {
      const queryKey = qk.personas.list()
      await queryClient.cancelQueries({ queryKey })
      const previo = queryClient.getQueryData<Persona[]>(queryKey)
      const optimista: Persona = {
        id: crypto.randomUUID(),
        nombre: nueva.nombre,
        email: nueva.email,
        rol: nueva.rol,
        color: nueva.color ?? '',
        activo: nueva.activo ?? true,
        created_at: nueva.created_at ?? new Date().toISOString(),
      }
      queryClient.setQueryData<Persona[]>(queryKey, (viejo) => [...(viejo ?? []), optimista])
      return { previo }
    },
    onError: (_error, _nueva, context) => {
      if (context?.previo) {
        queryClient.setQueryData(qk.personas.list(), context.previo)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.personas.all })
    },
  })
}

// Actualizar persona con merge optimista.
export function useActualizarPersona() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      cambios,
    }: {
      id: string
      cambios: TablesUpdate<'personas'>
    }): Promise<Persona> => {
      const { data, error } = await supabase
        .from('personas')
        .update(cambios)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onMutate: async ({ id, cambios }) => {
      const queryKey = qk.personas.list()
      await queryClient.cancelQueries({ queryKey })
      const previo = queryClient.getQueryData<Persona[]>(queryKey)
      queryClient.setQueryData<Persona[]>(queryKey, (viejo) =>
        (viejo ?? []).map((p) => (p.id === id ? { ...p, ...cambios } : p)),
      )
      return { previo }
    },
    onError: (_error, _vars, context) => {
      if (context?.previo) {
        queryClient.setQueryData(qk.personas.list(), context.previo)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.personas.all })
    },
  })
}

// Eliminar persona con filtrado optimista.
export function useEliminarPersona() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from('personas').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async (id) => {
      const queryKey = qk.personas.list()
      await queryClient.cancelQueries({ queryKey })
      const previo = queryClient.getQueryData<Persona[]>(queryKey)
      queryClient.setQueryData<Persona[]>(queryKey, (viejo) =>
        (viejo ?? []).filter((p) => p.id !== id),
      )
      return { previo }
    },
    onError: (_error, _id, context) => {
      if (context?.previo) {
        queryClient.setQueryData(qk.personas.list(), context.previo)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.personas.all })
    },
  })
}
