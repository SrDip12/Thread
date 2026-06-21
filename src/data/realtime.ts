// Suscripción Realtime de Supabase, integrada con TanStack Query.
// Vive solo mientras hay un proyecto abierto (se monta/desmonta con la pantalla),
// así las suscripciones quedan limitadas al proyecto en pantalla.

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.ts'
import { qk } from './queryKeys.ts'

// ponytail: Realtime postgres_changes filtra por una sola columna y tareas/comentarios
// no tienen proyecto_id directo. Escuchamos las dos tablas pero filtramos en el cliente
// por modulo_id del proyecto; si crece el volumen, mover el filtro al server (vista o canal por módulo).
export function useRealtimeProyecto(proyectoId: string, moduloIds: string[]) {
  const queryClient = useQueryClient()
  // Clave estable para el efecto (los ids cambian de identidad en cada render).
  const idsKey = moduloIds.join(',')

  useEffect(() => {
    if (!proyectoId) return
    const ids = new Set(moduloIds)

    const channel = supabase
      .channel(`proyecto:${proyectoId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tareas' },
        (payload) => {
          const fila = (payload.new ?? payload.old) as { modulo_id?: string }
          // Ignora tareas de otros proyectos.
          if (fila?.modulo_id && ids.size > 0 && !ids.has(fila.modulo_id)) return
          void queryClient.invalidateQueries({ queryKey: qk.tareas.all })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comentarios' },
        () => {
          // Sin proyecto_id en comentarios; invalidamos el árbol (solo refetchea queries activas).
          void queryClient.invalidateQueries({ queryKey: qk.comentarios.all })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoId, idsKey, queryClient])
}
