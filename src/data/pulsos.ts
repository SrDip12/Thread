// Hooks de datos para `pulsos` (pulso async del sprint, reemplaza el daily).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Tables, TablesInsert, TablesUpdate } from '../lib/database.types.ts'
import { supabase } from '../lib/supabase.ts'
import { qk } from './queryKeys.ts'

type Pulso = Tables<'pulsos'>

// Pulsos de un sprint, del más nuevo al más viejo.
export function usePulsos(sprintId: string) {
  return useQuery({
    queryKey: qk.pulsos.bySprint(sprintId),
    queryFn: async (): Promise<Pulso[]> => {
      const { data, error } = await supabase
        .from('pulsos')
        .select('*')
        .eq('sprint_id', sprintId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: Boolean(sprintId),
  })
}

// Dejar un pulso con update optimista.
export function useCrearPulso() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (nuevo: TablesInsert<'pulsos'>): Promise<Pulso> => {
      const { data, error } = await supabase.from('pulsos').insert(nuevo).select().single()
      if (error) throw error
      return data
    },
    onMutate: async (nuevo) => {
      const queryKey = qk.pulsos.bySprint(nuevo.sprint_id)
      await queryClient.cancelQueries({ queryKey })
      const previo = queryClient.getQueryData<Pulso[]>(queryKey)
      const optimista: Pulso = {
        id: crypto.randomUUID(),
        sprint_id: nuevo.sprint_id,
        persona_id: nuevo.persona_id,
        texto: nuevo.texto,
        created_at: nuevo.created_at ?? new Date().toISOString(),
      }
      queryClient.setQueryData<Pulso[]>(queryKey, (viejo) => [optimista, ...(viejo ?? [])])
      return { previo, queryKey }
    },
    onError: (_error, _nuevo, context) => {
      if (context) queryClient.setQueryData(context.queryKey, context.previo)
    },
    onSettled: (_data, _error, nuevo) => {
      void queryClient.invalidateQueries({ queryKey: qk.pulsos.bySprint(nuevo.sprint_id) })
    },
  })
}

// Editar el texto de un pulso propio con merge optimista.
export function useActualizarPulso() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      cambios,
    }: {
      id: string
      sprintId: string
      cambios: TablesUpdate<'pulsos'>
    }): Promise<Pulso> => {
      const { data, error } = await supabase
        .from('pulsos')
        .update(cambios)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onMutate: async ({ id, sprintId, cambios }) => {
      const queryKey = qk.pulsos.bySprint(sprintId)
      await queryClient.cancelQueries({ queryKey })
      const previo = queryClient.getQueryData<Pulso[]>(queryKey)
      queryClient.setQueryData<Pulso[]>(queryKey, (viejo) =>
        (viejo ?? []).map((p) => (p.id === id ? { ...p, ...cambios } : p)),
      )
      return { previo, queryKey }
    },
    onError: (_error, _vars, context) => {
      if (context) queryClient.setQueryData(context.queryKey, context.previo)
    },
    onSettled: (_data, _error, { sprintId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.pulsos.bySprint(sprintId) })
    },
  })
}
