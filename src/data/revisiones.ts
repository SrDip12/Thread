// Hooks de datos para la compuerta interna de revisión de módulos.
// Lista módulos en estado 'en_revision' y resuelve la revisión (aprobar/devolver):
// inserta el historial en `modulo_revisiones` y mueve el módulo a 'cerrado'/'abierto'.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Tables } from '../lib/database.types.ts'
import { supabase } from '../lib/supabase.ts'
import { qk } from './queryKeys.ts'

type Modulo = Tables<'modulos'>
type Proyecto = Tables<'proyectos'>

// Módulo en revisión con su proyecto resuelto (para mostrar la Definición al revisar).
export interface ModuloEnRevision extends Modulo {
  proyectos: Proyecto | null
}

// Módulos en estado 'en_revision' de todos los proyectos, con su proyecto.
export function useModulosEnRevision() {
  return useQuery({
    queryKey: qk.revisiones.enRevision(),
    queryFn: async (): Promise<ModuloEnRevision[]> => {
      const { data, error } = await supabase
        .from('modulos')
        .select('*, proyectos(*)')
        .eq('estado', 'en_revision')
        .order('orden', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as ModuloEnRevision[]
    },
  })
}

type Resultado = 'aprobado' | 'devuelto'

// Resolver una revisión: guarda el historial y mueve el módulo.
// aprobado → 'cerrado'; devuelto → 'abierto'.
export function useResolverRevision() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (vars: {
      moduloId: string
      proyectoId: string
      revisorId: string | null
      resultado: Resultado
    }): Promise<void> => {
      const { error: errHist } = await supabase.from('modulo_revisiones').insert({
        modulo_id: vars.moduloId,
        revisor_id: vars.revisorId,
        resultado: vars.resultado,
      })
      if (errHist) throw errHist
      const nuevoEstado = vars.resultado === 'aprobado' ? 'cerrado' : 'abierto'
      const { error: errMod } = await supabase
        .from('modulos')
        .update({ estado: nuevoEstado })
        .eq('id', vars.moduloId)
      if (errMod) throw errMod
    },
    onMutate: async ({ moduloId }) => {
      const queryKey = qk.revisiones.enRevision()
      await queryClient.cancelQueries({ queryKey })
      const previo = queryClient.getQueryData<ModuloEnRevision[]>(queryKey)
      // Sale de la bandeja de revisión apenas se resuelve.
      queryClient.setQueryData<ModuloEnRevision[]>(queryKey, (viejo) =>
        (viejo ?? []).filter((m) => m.id !== moduloId),
      )
      return { previo, queryKey }
    },
    onError: (_error, _vars, context) => {
      if (context) {
        queryClient.setQueryData(context.queryKey, context.previo)
      }
    },
    onSettled: (_data, _error, { proyectoId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.revisiones.enRevision() })
      void queryClient.invalidateQueries({ queryKey: qk.modulos.byProyecto(proyectoId) })
      void queryClient.invalidateQueries({ queryKey: qk.modulos.all })
    },
  })
}
