// Hooks de datos para la entidad `comentarios`.
// Toda la lógica de Supabase para comentarios vive acá; los componentes solo usan estos hooks.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Tables, TablesInsert, TablesUpdate } from '../lib/database.types.ts'
import { supabase } from '../lib/supabase.ts'
import { qk } from './queryKeys.ts'

type Comentario = Tables<'comentarios'>

// Comentario-pregunta para el PO con su tarea y proyecto resueltos. Para /para-mi.
export interface PreguntaPo extends Comentario {
  tareas: {
    id: string
    titulo: string
    modulo_id: string
    modulos: {
      nombre: string
      proyectos: { id: string; nombre: string; color: string }
    } | null
  } | null
}

// Preguntas para el PO pendientes (para_po = true, resuelto = false) de todos los proyectos.
export function useComentariosParaPo() {
  return useQuery({
    queryKey: qk.comentarios.paraPo(),
    queryFn: async (): Promise<PreguntaPo[]> => {
      const { data, error } = await supabase
        .from('comentarios')
        .select('*, tareas(id, titulo, modulo_id, modulos(nombre, proyectos(id, nombre, color)))')
        .eq('para_po', true)
        .eq('resuelto', false)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as PreguntaPo[]
    },
  })
}

// Marcar una pregunta como resuelta, con remoción optimista de la bandeja "Para mí".
export function useResolverPregunta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from('comentarios').update({ resuelto: true }).eq('id', id)
      if (error) throw error
    },
    onMutate: async (id) => {
      const queryKey = qk.comentarios.paraPo()
      await queryClient.cancelQueries({ queryKey })
      const previo = queryClient.getQueryData<PreguntaPo[]>(queryKey)
      queryClient.setQueryData<PreguntaPo[]>(queryKey, (viejo) =>
        (viejo ?? []).filter((c) => c.id !== id),
      )
      return { previo }
    },
    onError: (_error, _id, context) => {
      if (context?.previo) {
        queryClient.setQueryData(qk.comentarios.paraPo(), context.previo)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.comentarios.all })
    },
  })
}

// Responder una pregunta del PO: crea un comentario de respuesta en la tarea
// y marca la pregunta como resuelta. Quita la pregunta de la bandeja "Para mí".
export function useResponderPregunta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (vars: {
      preguntaId: string
      tareaId: string
      autorId: string
      texto: string
    }): Promise<void> => {
      const { error: errInsert } = await supabase.from('comentarios').insert({
        tarea_id: vars.tareaId,
        autor_id: vars.autorId,
        texto: vars.texto,
      })
      if (errInsert) throw errInsert
      const { error: errUpdate } = await supabase
        .from('comentarios')
        .update({ resuelto: true })
        .eq('id', vars.preguntaId)
      if (errUpdate) throw errUpdate
    },
    onMutate: async ({ preguntaId }) => {
      const queryKey = qk.comentarios.paraPo()
      await queryClient.cancelQueries({ queryKey })
      const previo = queryClient.getQueryData<PreguntaPo[]>(queryKey)
      queryClient.setQueryData<PreguntaPo[]>(queryKey, (viejo) =>
        (viejo ?? []).filter((c) => c.id !== preguntaId),
      )
      return { previo }
    },
    onError: (_error, _vars, context) => {
      if (context?.previo) {
        queryClient.setQueryData(qk.comentarios.paraPo(), context.previo)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.comentarios.all })
    },
  })
}

// Listado de comentarios de una tarea, ordenado por fecha de creación.
export function useComentarios(tareaId: string) {
  return useQuery({
    queryKey: qk.comentarios.byTarea(tareaId),
    queryFn: async (): Promise<Comentario[]> => {
      const { data, error } = await supabase
        .from('comentarios')
        .select('*')
        .eq('tarea_id', tareaId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: Boolean(tareaId),
  })
}

// Listado de comentarios de un módulo (feedback de revisión), por fecha.
export function useComentariosModulo(moduloId: string) {
  return useQuery({
    queryKey: qk.comentarios.byModulo(moduloId),
    queryFn: async (): Promise<Comentario[]> => {
      const { data, error } = await supabase
        .from('comentarios')
        .select('*')
        .eq('modulo_id', moduloId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: Boolean(moduloId),
  })
}

// La query key del listado al que pertenece un comentario nuevo: por tarea o por módulo.
function keyDeComentario(nuevo: TablesInsert<'comentarios'>) {
  if (nuevo.modulo_id) return qk.comentarios.byModulo(nuevo.modulo_id)
  return qk.comentarios.byTarea(nuevo.tarea_id ?? '')
}

// Crear comentario con update optimista. Acepta comentarios de tarea (tarea_id)
// o de módulo (modulo_id); el listado optimista se elige según cuál venga.
export function useCrearComentario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (nuevo: TablesInsert<'comentarios'>): Promise<Comentario> => {
      const { data, error } = await supabase
        .from('comentarios')
        .insert(nuevo)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onMutate: async (nuevo) => {
      const queryKey = keyDeComentario(nuevo)
      await queryClient.cancelQueries({ queryKey })
      const previo = queryClient.getQueryData<Comentario[]>(queryKey)
      const optimista: Comentario = {
        id: crypto.randomUUID(),
        tarea_id: nuevo.tarea_id ?? null,
        modulo_id: nuevo.modulo_id ?? null,
        autor_id: nuevo.autor_id,
        texto: nuevo.texto,
        para_po: nuevo.para_po ?? false,
        resuelto: nuevo.resuelto ?? false,
        created_at: nuevo.created_at ?? new Date().toISOString(),
      }
      queryClient.setQueryData<Comentario[]>(queryKey, (viejo) => [...(viejo ?? []), optimista])
      return { previo, queryKey }
    },
    onError: (_error, _nuevo, context) => {
      if (context) {
        queryClient.setQueryData(context.queryKey, context.previo)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.comentarios.all })
    },
  })
}

// Actualizar comentario con merge optimista.
export function useActualizarComentario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      cambios,
    }: {
      id: string
      tareaId: string
      cambios: TablesUpdate<'comentarios'>
    }): Promise<Comentario> => {
      const { data, error } = await supabase
        .from('comentarios')
        .update(cambios)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onMutate: async ({ id, tareaId, cambios }) => {
      const queryKey = qk.comentarios.byTarea(tareaId)
      await queryClient.cancelQueries({ queryKey })
      const previo = queryClient.getQueryData<Comentario[]>(queryKey)
      queryClient.setQueryData<Comentario[]>(queryKey, (viejo) =>
        (viejo ?? []).map((c) => (c.id === id ? { ...c, ...cambios } : c)),
      )
      return { previo, queryKey }
    },
    onError: (_error, _vars, context) => {
      if (context) {
        queryClient.setQueryData(context.queryKey, context.previo)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.comentarios.all })
    },
  })
}

// Eliminar comentario con filtrado optimista.
export function useEliminarComentario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; tareaId: string }): Promise<void> => {
      const { error } = await supabase.from('comentarios').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, tareaId }) => {
      const queryKey = qk.comentarios.byTarea(tareaId)
      await queryClient.cancelQueries({ queryKey })
      const previo = queryClient.getQueryData<Comentario[]>(queryKey)
      queryClient.setQueryData<Comentario[]>(queryKey, (viejo) =>
        (viejo ?? []).filter((c) => c.id !== id),
      )
      return { previo, queryKey }
    },
    onError: (_error, _vars, context) => {
      if (context) {
        queryClient.setQueryData(context.queryKey, context.previo)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.comentarios.all })
    },
  })
}
