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
      if (errUpdate) {
        throw errUpdate
      }

      // Enviar la notificación de correo al desarrollador de manera asíncrona no bloqueante
      (async () => {
        try {
          // 1. Obtener la pregunta original y el id de su creador
          const { data: originalComment } = await supabase
            .from('comentarios')
            .select('texto, autor_id')
            .eq('id', vars.preguntaId)
            .single()

          if (originalComment) {
            // 2. Obtener los detalles del desarrollador que hizo la pregunta (destinatario)
            const { data: devData } = await supabase
              .from('personas')
              .select('nombre, email')
              .eq('id', originalComment.autor_id)
              .single()

            // 3. Obtener el nombre del PO que responde (autor del correo de respuesta)
            const { data: poData } = await supabase
              .from('personas')
              .select('nombre')
              .eq('id', vars.autorId)
              .single()

            // 4. Obtener detalles de la tarea y proyecto
            const { data: taskData } = await supabase
              .from('tareas')
              .select('titulo, modulos(nombre, proyectos(id, nombre))')
              .eq('id', vars.tareaId)
              .single()

            const rawTask = taskData as any
            const proyectos = rawTask?.modulos?.proyectos

            if (devData?.email && poData && taskData && proyectos) {
              await fetch('/api/enviar-correo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  tipo: 'respuesta',
                  destinatarioEmail: devData.email,
                  destinatarioNombre: devData.nombre,
                  autorNombre: poData.nombre,
                  proyectoNombre: proyectos.nombre,
                  proyectoId: proyectos.id,
                  tareaTitulo: taskData.titulo,
                  tareaId: vars.tareaId,
                  comentarioTexto: vars.texto,
                  preguntaTexto: originalComment.texto,
                  appUrl: window.location.origin,
                }),
              })
            }
          }
        } catch (err) {
          console.error('Error al notificar al desarrollador por correo:', err)
        }
      })()
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

      // Si es una pregunta para el PO y está ligada a una tarea, disparamos la notificación por correo
      if (data.para_po && data.tarea_id) {
        // Ejecutamos de forma asíncrona no bloqueante
        (async () => {
          try {
            // 1. Obtener detalles de la tarea, su módulo y el proyecto asociado
            const { data: taskData } = await supabase
              .from('tareas')
              .select('titulo, modulos(nombre, proyectos(id, nombre, responsable_vision_id))')
              .eq('id', data.tarea_id as string)
              .single()

            const rawTask = taskData as any
            const proyectos = rawTask?.modulos?.proyectos
            const poId = proyectos?.responsable_vision_id

            if (taskData && proyectos && poId) {
              // 2. Obtener el email y nombre del Product Owner (PO)
              const { data: poData } = await supabase
                .from('personas')
                .select('nombre, email')
                .eq('id', poId)
                .single()

              // 3. Obtener el nombre del autor de la pregunta
              const { data: autorData } = await supabase
                .from('personas')
                .select('nombre')
                .eq('id', data.autor_id)
                .single()

              if (poData?.email) {
                // 4. Enviar la notificación llamando a nuestra serverless function
                await fetch('/api/enviar-correo', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    destinatarioEmail: poData.email,
                    destinatarioNombre: poData.nombre,
                    autorNombre: autorData?.nombre ?? 'Un miembro del equipo',
                    proyectoNombre: proyectos.nombre,
                    proyectoId: proyectos.id,
                    tareaTitulo: taskData.titulo,
                    tareaId: data.tarea_id,
                    comentarioTexto: data.texto,
                    appUrl: window.location.origin,
                  }),
                })
              }
            }
          } catch (err) {
            console.error('Error al enviar la notificación por correo al PO:', err)
          }
        })()
      }

      // Notificaciones In-App (menciones, preguntas y comentarios)
      if (data.tarea_id) {
        (async () => {
          try {
            const { data: taskData } = await supabase
              .from('tareas')
              .select('titulo, responsable_id, modulo_id, modulos(proyecto_id, proyectos(nombre, color, responsable_vision_id))')
              .eq('id', data.tarea_id as string)
              .single()

            const rawTask = taskData as any
            const proyectoId = rawTask?.modulos?.proyecto_id ?? null
            const proyectos = rawTask?.modulos?.proyectos
            const poId = proyectos?.responsable_vision_id

            if (taskData) {
              const { data: personas } = await supabase.from('personas').select('id, nombre, email')
              const menciones: string[] = []
              const textoLower = data.texto.toLowerCase()

              for (const p of personas ?? []) {
                const nombreClean = p.nombre.toLowerCase().replace(/\s+/g, '')
                if (textoLower.includes(`@${nombreClean}`) || textoLower.includes(`@${p.nombre.toLowerCase()}`)) {
                  if (p.id !== data.autor_id) {
                    menciones.push(p.id)
                  }
                }
              }

              // Crear notificaciones de mención
              for (const pid of menciones) {
                await supabase.from('notificaciones').insert({
                  persona_id: pid,
                  autor_id: data.autor_id,
                  tipo: 'mencion',
                  texto: `Te mencionó en la tarea "${taskData.titulo}": "${data.texto.slice(0, 50)}..."`,
                  tarea_id: data.tarea_id,
                  proyecto_id: proyectoId,
                  leido: false,
                })
              }

              // Si es pregunta para el PO y el PO no es el autor y no fue mencionado
              if (data.para_po && poId && poId !== data.autor_id && !menciones.includes(poId)) {
                await supabase.from('notificaciones').insert({
                  persona_id: poId,
                  autor_id: data.autor_id,
                  tipo: 'pregunta',
                  texto: `Te hizo una pregunta en la tarea "${taskData.titulo}": "${data.texto.slice(0, 50)}..."`,
                  tarea_id: data.tarea_id,
                  proyecto_id: proyectoId,
                  leido: false,
                })
              }

              // Si tiene asignado y el asignado no es el autor, no es el PO notificado, y no fue mencionado
              if (
                taskData.responsable_id &&
                taskData.responsable_id !== data.autor_id &&
                !menciones.includes(taskData.responsable_id) &&
                !(data.para_po && poId === taskData.responsable_id)
              ) {
                await supabase.from('notificaciones').insert({
                  persona_id: taskData.responsable_id,
                  autor_id: data.autor_id,
                  tipo: 'comentario',
                  texto: `Comentó en tu tarea "${taskData.titulo}": "${data.texto.slice(0, 50)}..."`,
                  tarea_id: data.tarea_id,
                  proyecto_id: proyectoId,
                  leido: false,
                })
              }
            }
          } catch (e) {
            console.error('Error al insertar notificaciones en la base de datos:', e)
          }
        })()
      }

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
