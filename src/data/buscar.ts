import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.ts'

export interface ResultadoBusqueda {
  proyectos: { id: string; nombre: string; color: string }[]
  tareas: {
    id: string
    titulo: string
    modulo_id: string
    modulo_nombre: string
    proyecto_id: string
    proyecto_nombre: string
    proyecto_color: string
  }[]
  personas: { id: string; nombre: string; email: string; color: string }[]
  comentarios: {
    id: string
    texto: string
    tarea_id: string
    tarea_titulo: string
    modulo_id: string
    proyecto_id: string
    proyecto_nombre: string
    proyecto_color: string
  }[]
}

// Formas crudas de los selects con embeds (database.types no declara Relationships).
type ModuloEmbed = {
  nombre: string
  proyecto_id: string
  proyectos: { nombre: string; color: string } | null
} | null
interface TareaFila {
  id: string
  titulo: string
  modulo_id: string
  modulos: ModuloEmbed
}
interface ComentarioFila {
  id: string
  texto: string
  tarea_id: string | null
  tareas: { titulo: string; modulo_id: string; modulos: ModuloEmbed } | null
}

export function useBuscarGlobal(q: string) {
  const term = q.trim()
  return useQuery({
    queryKey: ['buscar-global', term],
    queryFn: async (): Promise<ResultadoBusqueda> => {
      if (!term) return { proyectos: [], tareas: [], personas: [], comentarios: [] }

      const patron = `%${term}%`
      const [proys, pers, targs, coms] = await Promise.all([
        supabase.from('proyectos').select('id, nombre, color').ilike('nombre', patron).limit(5),
        supabase.from('personas').select('id, nombre, email, color').ilike('nombre', patron).limit(5),
        supabase
          .from('tareas')
          .select('id, titulo, modulo_id, modulos(nombre, proyecto_id, proyectos(nombre, color))')
          .ilike('titulo', patron)
          .limit(10),
        supabase
          .from('comentarios')
          .select('id, texto, tarea_id, tareas(titulo, modulo_id, modulos(nombre, proyecto_id, proyectos(nombre, color)))')
          .ilike('texto', patron)
          .limit(5),
      ])
      const error = proys.error ?? pers.error ?? targs.error ?? coms.error
      if (error) throw error

      return {
        proyectos: proys.data ?? [],
        personas: pers.data ?? [],
        tareas: ((targs.data ?? []) as unknown as TareaFila[]).map((t) => ({
          id: t.id,
          titulo: t.titulo,
          modulo_id: t.modulo_id,
          modulo_nombre: t.modulos?.nombre ?? '',
          proyecto_id: t.modulos?.proyecto_id ?? '',
          proyecto_nombre: t.modulos?.proyectos?.nombre ?? '',
          proyecto_color: t.modulos?.proyectos?.color ?? '#c96442',
        })),
        comentarios: ((coms.data ?? []) as unknown as ComentarioFila[])
          .filter((c) => c.tareas && c.tarea_id) // Comentarios de módulo o de tareas borradas
          .map((c) => ({
            id: c.id,
            texto: c.texto,
            tarea_id: c.tarea_id as string,
            tarea_titulo: c.tareas?.titulo ?? '',
            modulo_id: c.tareas?.modulo_id ?? '',
            proyecto_id: c.tareas?.modulos?.proyecto_id ?? '',
            proyecto_nombre: c.tareas?.modulos?.proyectos?.nombre ?? '',
            proyecto_color: c.tareas?.modulos?.proyectos?.color ?? '#c96442',
          })),
      }
    },
    enabled: term.length >= 2,
    staleTime: 5000,
  })
}
