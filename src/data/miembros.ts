// Hooks de datos para la membresía de proyecto (tabla `proyecto_personas`).
// Devuelve las personas miembros de un proyecto; sumar/quitar con update optimista.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Tables } from '../lib/database.types.ts'
import { supabase } from '../lib/supabase.ts'
import { qk } from './queryKeys.ts'

type Persona = Tables<'personas'>

// Personas miembros del proyecto (vía el embed del FK proyecto_personas → personas).
export function useMiembros(proyectoId: string) {
  return useQuery({
    queryKey: qk.miembros.byProyecto(proyectoId),
    queryFn: async (): Promise<Persona[]> => {
      const { data, error } = await supabase
        .from('proyecto_personas')
        .select('personas(*)')
        .eq('proyecto_id', proyectoId)
      if (error) throw error
      // El embed llega como { personas: Persona }[]; lo aplanamos.
      return ((data ?? []) as unknown as { personas: Persona }[])
        .map((r) => r.personas)
        .filter((p): p is Persona => Boolean(p))
    },
    enabled: Boolean(proyectoId),
  })
}

export function useAgregarMiembro() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ proyectoId, persona }: { proyectoId: string; persona: Persona }) => {
      const { error } = await supabase
        .from('proyecto_personas')
        .insert({ proyecto_id: proyectoId, persona_id: persona.id })
      if (error) throw error
    },
    onMutate: async ({ proyectoId, persona }) => {
      const queryKey = qk.miembros.byProyecto(proyectoId)
      await queryClient.cancelQueries({ queryKey })
      const previo = queryClient.getQueryData<Persona[]>(queryKey)
      queryClient.setQueryData<Persona[]>(queryKey, (v) => [...(v ?? []), persona])
      return { previo, queryKey }
    },
    onError: (_e, _v, ctx) => {
      if (ctx) queryClient.setQueryData(ctx.queryKey, ctx.previo)
    },
    onSettled: (_d, _e, { proyectoId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.miembros.byProyecto(proyectoId) })
    },
  })
}

export function useQuitarMiembro() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ proyectoId, personaId }: { proyectoId: string; personaId: string }) => {
      const { error } = await supabase
        .from('proyecto_personas')
        .delete()
        .eq('proyecto_id', proyectoId)
        .eq('persona_id', personaId)
      if (error) throw error
    },
    onMutate: async ({ proyectoId, personaId }) => {
      const queryKey = qk.miembros.byProyecto(proyectoId)
      await queryClient.cancelQueries({ queryKey })
      const previo = queryClient.getQueryData<Persona[]>(queryKey)
      queryClient.setQueryData<Persona[]>(queryKey, (v) => (v ?? []).filter((p) => p.id !== personaId))
      return { previo, queryKey }
    },
    onError: (_e, _v, ctx) => {
      if (ctx) queryClient.setQueryData(ctx.queryKey, ctx.previo)
    },
    onSettled: (_d, _e, { proyectoId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.miembros.byProyecto(proyectoId) })
    },
  })
}
