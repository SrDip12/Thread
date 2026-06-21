// Hooks de datos para la entidad `reuniones` (registro de reuniones + asistentes).
// Toda la lógica de Supabase para reuniones vive acá; los componentes solo usan estos hooks.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Tables, TablesInsert, TablesUpdate } from '../lib/database.types.ts'
import { supabase } from '../lib/supabase.ts'
import { qk } from './queryKeys.ts'

export type Reunion = Tables<'reuniones'>
type Persona = Tables<'personas'>

// Listado de reuniones, de la más nueva a la más vieja. Si hay proyectoId, filtra.
export function useReuniones(proyectoId: string | null) {
  return useQuery({
    queryKey: qk.reuniones.list(proyectoId),
    queryFn: async (): Promise<Reunion[]> => {
      let query = supabase.from('reuniones').select('*').order('fecha', { ascending: false })
      if (proyectoId) query = query.eq('proyecto_id', proyectoId)
      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}

// Una reunión por id (o null si no existe).
export function useReunion(reunionId: string) {
  return useQuery({
    queryKey: qk.reuniones.byId(reunionId),
    queryFn: async (): Promise<Reunion | null> => {
      const { data, error } = await supabase
        .from('reuniones')
        .select('*')
        .eq('id', reunionId)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: Boolean(reunionId),
  })
}

// Fila del embed asistente → persona. Los tipos traen `Relationships: []`,
// así que casteamos el resultado del join (ver comentario en database.types.ts).
interface AsistenteEmbed {
  persona_id: string
  personas: Persona | null
}

// Asistentes de una reunión (personas resueltas vía join).
export function useAsistentes(reunionId: string) {
  return useQuery({
    queryKey: qk.reuniones.asistentes(reunionId),
    queryFn: async (): Promise<Persona[]> => {
      const { data, error } = await supabase
        .from('reunion_asistentes')
        .select('persona_id, personas(*)')
        .eq('reunion_id', reunionId)
      if (error) throw error
      const filas = (data ?? []) as unknown as AsistenteEmbed[]
      return filas
        .map((f) => f.personas)
        .filter((p): p is Persona => Boolean(p))
    },
    enabled: Boolean(reunionId),
  })
}

// Crear reunión + sus asistentes. Devuelve la reunión creada.
export function useCrearReunion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      reunion,
      asistentes,
    }: {
      reunion: TablesInsert<'reuniones'>
      asistentes: string[]
    }): Promise<Reunion> => {
      const { data, error } = await supabase
        .from('reuniones')
        .insert(reunion)
        .select()
        .single()
      if (error) throw error
      if (asistentes.length > 0) {
        const filas = asistentes.map((persona_id) => ({ reunion_id: data.id, persona_id }))
        const { error: errorAsistentes } = await supabase
          .from('reunion_asistentes')
          .insert(filas)
        if (errorAsistentes) throw errorAsistentes
      }
      return data
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.reuniones.all })
    },
  })
}

// Actualizar reunión (autosave de notas, etc.) con merge optimista sobre byId.
export function useActualizarReunion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      cambios,
    }: {
      id: string
      proyectoId: string
      cambios: TablesUpdate<'reuniones'>
    }): Promise<Reunion> => {
      const { data, error } = await supabase
        .from('reuniones')
        .update(cambios)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onMutate: async ({ id, cambios }) => {
      const queryKey = qk.reuniones.byId(id)
      await queryClient.cancelQueries({ queryKey })
      const previo = queryClient.getQueryData<Reunion | null>(queryKey)
      queryClient.setQueryData<Reunion | null>(queryKey, (viejo) =>
        viejo ? { ...viejo, ...cambios } : viejo,
      )
      return { previo, queryKey }
    },
    onError: (_error, _vars, context) => {
      if (context) {
        queryClient.setQueryData(context.queryKey, context.previo)
      }
    },
    onSettled: (_data, _error, { id, proyectoId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.reuniones.byId(id) })
      void queryClient.invalidateQueries({ queryKey: qk.reuniones.list(proyectoId) })
      void queryClient.invalidateQueries({ queryKey: qk.reuniones.list(null) })
    },
  })
}
