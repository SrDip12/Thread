// Hooks de datos para la entidad `clientes` (un cliente por proyecto).
// Toda la lógica de Supabase para clientes vive acá; los componentes solo usan estos hooks.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Tables, TablesInsert, TablesUpdate } from '../lib/database.types.ts'
import { supabase } from '../lib/supabase.ts'
import { qk } from './queryKeys.ts'

export type Cliente = Tables<'clientes'>

// El cliente de un proyecto (o null si todavía no se cargó). Único por proyecto.
export function useClientePorProyecto(proyectoId: string) {
  return useQuery({
    queryKey: qk.clientes.byProyecto(proyectoId),
    queryFn: async (): Promise<Cliente | null> => {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('proyecto_id', proyectoId)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: Boolean(proyectoId),
  })
}

// Crear cliente con update optimista sobre la query del proyecto.
export function useCrearCliente() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (nuevo: TablesInsert<'clientes'>): Promise<Cliente> => {
      const { data, error } = await supabase
        .from('clientes')
        .insert(nuevo)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onMutate: async (nuevo) => {
      const queryKey = qk.clientes.byProyecto(nuevo.proyecto_id)
      await queryClient.cancelQueries({ queryKey })
      const previo = queryClient.getQueryData<Cliente | null>(queryKey)
      const optimista: Cliente = {
        id: crypto.randomUUID(),
        nombre: nuevo.nombre,
        contacto: nuevo.contacto ?? null,
        proyecto_id: nuevo.proyecto_id,
        created_at: nuevo.created_at ?? new Date().toISOString(),
      }
      queryClient.setQueryData<Cliente | null>(queryKey, optimista)
      return { previo, queryKey }
    },
    onError: (_error, _nuevo, context) => {
      if (context) queryClient.setQueryData(context.queryKey, context.previo)
    },
    onSettled: (_data, _error, nuevo) => {
      void queryClient.invalidateQueries({ queryKey: qk.clientes.byProyecto(nuevo.proyecto_id) })
    },
  })
}

// Actualizar cliente con merge optimista.
export function useActualizarCliente() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      cambios,
    }: {
      id: string
      proyectoId: string
      cambios: TablesUpdate<'clientes'>
    }): Promise<Cliente> => {
      const { data, error } = await supabase
        .from('clientes')
        .update(cambios)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onMutate: async ({ id, proyectoId, cambios }) => {
      const queryKey = qk.clientes.byProyecto(proyectoId)
      await queryClient.cancelQueries({ queryKey })
      const previo = queryClient.getQueryData<Cliente | null>(queryKey)
      queryClient.setQueryData<Cliente | null>(queryKey, (viejo) =>
        viejo && viejo.id === id ? { ...viejo, ...cambios } : viejo,
      )
      return { previo, queryKey }
    },
    onError: (_error, _vars, context) => {
      if (context) queryClient.setQueryData(context.queryKey, context.previo)
    },
    onSettled: (_data, _error, { proyectoId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.clientes.byProyecto(proyectoId) })
    },
  })
}
