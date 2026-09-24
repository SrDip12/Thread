// Hooks de datos para `decisiones`: el registro de "qué decidimos y por qué" de cada
// proyecto. Se cargan a mano o salen de la extracción IA de una reunión.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Tables, TablesInsert } from '../lib/database.types.ts'
import { supabase } from '../lib/supabase.ts'
import { qk } from './queryKeys.ts'

export type Decision = Tables<'decisiones'>

// Decisiones de un proyecto, la más reciente primero.
export function useDecisiones(proyectoId: string) {
  return useQuery({
    queryKey: qk.decisiones.byProyecto(proyectoId),
    queryFn: async (): Promise<Decision[]> => {
      const { data, error } = await supabase
        .from('decisiones')
        .select('*')
        .eq('proyecto_id', proyectoId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: Boolean(proyectoId),
  })
}

// Crear una o varias decisiones del mismo proyecto, con alta optimista.
export function useCrearDecisiones() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      nuevas,
    }: {
      proyectoId: string
      nuevas: TablesInsert<'decisiones'>[]
    }): Promise<void> => {
      if (!nuevas.length) return
      const { error } = await supabase.from('decisiones').insert(nuevas)
      if (error) throw error
    },
    onMutate: async ({ proyectoId, nuevas }) => {
      const queryKey = qk.decisiones.byProyecto(proyectoId)
      await queryClient.cancelQueries({ queryKey })
      const previo = queryClient.getQueryData<Decision[]>(queryKey)
      const ahora = new Date().toISOString()
      const optimistas: Decision[] = nuevas.map((n) => ({
        id: crypto.randomUUID(),
        proyecto_id: n.proyecto_id,
        reunion_id: n.reunion_id ?? null,
        autor_id: n.autor_id ?? null,
        texto: n.texto,
        created_at: n.created_at ?? ahora,
      }))
      queryClient.setQueryData<Decision[]>(queryKey, (viejo) => [...optimistas, ...(viejo ?? [])])
      return { previo, queryKey }
    },
    onError: (_error, _vars, context) => {
      if (context) queryClient.setQueryData(context.queryKey, context.previo)
    },
    onSettled: (_data, _error, { proyectoId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.decisiones.byProyecto(proyectoId) })
    },
  })
}

// Eliminar decisión con filtrado optimista.
export function useEliminarDecision() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; proyectoId: string }): Promise<void> => {
      const { error } = await supabase.from('decisiones').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, proyectoId }) => {
      const queryKey = qk.decisiones.byProyecto(proyectoId)
      await queryClient.cancelQueries({ queryKey })
      const previo = queryClient.getQueryData<Decision[]>(queryKey)
      queryClient.setQueryData<Decision[]>(queryKey, (viejo) => (viejo ?? []).filter((d) => d.id !== id))
      return { previo, queryKey }
    },
    onError: (_error, _vars, context) => {
      if (context) queryClient.setQueryData(context.queryKey, context.previo)
    },
    onSettled: (_data, _error, { proyectoId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.decisiones.byProyecto(proyectoId) })
    },
  })
}
