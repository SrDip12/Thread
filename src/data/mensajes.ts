// Hooks de datos para la entidad `mensajes` (chat de equipo por proyecto).
// Toda la lógica de Supabase para mensajes vive acá; los componentes solo usan estos hooks.

import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Tables, TablesInsert } from '../lib/database.types.ts'
import { supabase } from '../lib/supabase.ts'
import { qk } from './queryKeys.ts'

type Mensaje = Tables<'mensajes'>

// Mensajes del proyecto, del más viejo al más nuevo (orden de chat).
export function useMensajes(proyectoId: string) {
  return useQuery({
    queryKey: qk.mensajes.byProyecto(proyectoId),
    queryFn: async (): Promise<Mensaje[]> => {
      const { data, error } = await supabase
        .from('mensajes')
        .select('*')
        .eq('proyecto_id', proyectoId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: Boolean(proyectoId),
  })
}

// Enviar mensaje con update optimista (aparece al instante; el realtime/refetch confirma).
export function useCrearMensaje() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (nuevo: TablesInsert<'mensajes'>): Promise<Mensaje> => {
      const { data, error } = await supabase.from('mensajes').insert(nuevo).select().single()
      if (error) throw error
      return data
    },
    onMutate: async (nuevo) => {
      const queryKey = qk.mensajes.byProyecto(nuevo.proyecto_id)
      await queryClient.cancelQueries({ queryKey })
      const previo = queryClient.getQueryData<Mensaje[]>(queryKey)
      const optimista: Mensaje = {
        id: crypto.randomUUID(),
        proyecto_id: nuevo.proyecto_id,
        autor_id: nuevo.autor_id,
        texto: nuevo.texto,
        created_at: nuevo.created_at ?? new Date().toISOString(),
      }
      queryClient.setQueryData<Mensaje[]>(queryKey, (viejo) => [...(viejo ?? []), optimista])
      return { previo, queryKey }
    },
    onError: (_error, _nuevo, context) => {
      if (context) {
        queryClient.setQueryData(context.queryKey, context.previo)
      }
    },
    onSettled: (_data, _error, nuevo) => {
      void queryClient.invalidateQueries({ queryKey: qk.mensajes.byProyecto(nuevo.proyecto_id) })
    },
  })
}

// Realtime: INSERTs del proyecto. Filtra server-side por proyecto_id (una sola columna,
// que es justo lo que postgres_changes permite). Invalida → refetch de la vista montada.
export function useRealtimeChat(proyectoId: string) {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!proyectoId) return
    const channel = supabase
      .channel(`chat:${proyectoId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensajes',
          filter: `proyecto_id=eq.${proyectoId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: qk.mensajes.byProyecto(proyectoId) })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [proyectoId, queryClient])
}
