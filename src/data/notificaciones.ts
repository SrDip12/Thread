// Notificaciones del usuario, DERIVADAS de datos existentes (sin tabla propia):
// comentarios de OTRAS personas en tareas donde sos responsable.
// El "leído" es local (localStorage), no compartido entre dispositivos.
// ponytail: feed derivado, sin triggers ni tabla; si hace falta read-state
// compartido o notifs de no-comentario, recién ahí una tabla `notificaciones`.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.ts'
import { qk } from './queryKeys.ts'

export interface Notif {
  id: string // = comentario id
  ts: string // created_at del comentario
  autorId: string
  texto: string
  tareaId: string
  tareaTitulo: string
  proyectoId: string
  proyectoNombre: string
  proyectoColor: string
  esPregunta: boolean // para_po
}

interface TareaMeta {
  id: string
  titulo: string
  modulos: { proyectos: { id: string; nombre: string; color: string } | null } | null
}

export function useNotificaciones(personaId: string) {
  return useQuery({
    queryKey: qk.notificaciones.byPersona(personaId),
    queryFn: async (): Promise<Notif[]> => {
      const { data: misTareas, error: e1 } = await supabase
        .from('tareas')
        .select('id, titulo, modulos(proyectos(id, nombre, color))')
        .eq('responsable_id', personaId)
      if (e1) throw e1
      const tareas = (misTareas ?? []) as unknown as TareaMeta[]
      if (tareas.length === 0) return []

      const meta = new Map(tareas.map((t) => [t.id, t]))
      const { data: coms, error: e2 } = await supabase
        .from('comentarios')
        .select('id, tarea_id, autor_id, texto, para_po, created_at')
        .in('tarea_id', [...meta.keys()])
        .neq('autor_id', personaId)
        .order('created_at', { ascending: false })
        .limit(40)
      if (e2) throw e2

      return (coms ?? []).flatMap((c) => {
        const t = c.tarea_id ? meta.get(c.tarea_id) : undefined
        if (!t || !c.tarea_id) return []
        const proy = t.modulos?.proyectos
        return [{
          id: c.id,
          ts: c.created_at,
          autorId: c.autor_id,
          texto: c.texto,
          tareaId: c.tarea_id,
          tareaTitulo: t.titulo,
          proyectoId: proy?.id ?? '',
          proyectoNombre: proy?.nombre ?? 'Proyecto',
          proyectoColor: proy?.color ?? '#c4bdb1',
          esPregunta: c.para_po,
        }]
      })
    },
    enabled: Boolean(personaId),
    // Sin realtime global: refrescamos al volver a la pestaña. La campana vive en
    // todas las vistas; el Realtime por-proyecto solo invalida en el proyecto abierto.
    refetchOnWindowFocus: true,
    staleTime: 60_000,
  })
}
