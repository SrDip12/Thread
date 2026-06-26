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

export function useBuscarGlobal(q: string) {
  const term = q.trim()
  return useQuery({
    queryKey: ['buscar-global', term],
    queryFn: async (): Promise<ResultadoBusqueda> => {
      if (!term) return { proyectos: [], tareas: [], personas: [], comentarios: [] }

      // 1. Buscar proyectos
      const { data: proys } = await supabase
        .from('proyectos')
        .select('id, nombre, color')
        .ilike('nombre', `%${term}%`)
        .limit(5)

      // 2. Buscar personas
      const { data: pers } = await supabase
        .from('personas')
        .select('id, nombre, email, color')
        .ilike('nombre', `%${term}%`)
        .limit(5)

      // 3. Buscar tareas (resolviendo módulo y proyecto)
      const { data: targs } = await supabase
        .from('tareas')
        .select('id, titulo, modulo_id, modulos(nombre, proyecto_id, proyectos(nombre, color))')
        .ilike('titulo', `%${term}%`)
        .limit(10)

      // 4. Buscar comentarios (resolviendo tarea y proyecto)
      const { data: coms } = await supabase
        .from('comentarios')
        .select('id, texto, tarea_id, tareas(titulo, modulo_id, modulos(nombre, proyecto_id, proyectos(nombre, color)))')
        .ilike('texto', `%${term}%`)
        .limit(5)

      return {
        proyectos: (proys ?? []) as { id: string; nombre: string; color: string }[],
        personas: (pers ?? []) as { id: string; nombre: string; email: string; color: string }[],
        tareas: ((targs ?? []) as any[]).map((t) => ({
          id: t.id,
          titulo: t.titulo,
          modulo_id: t.modulo_id,
          modulo_nombre: t.modulos?.nombre ?? '',
          proyecto_id: t.modulos?.proyecto_id ?? '',
          proyecto_nombre: t.modulos?.proyectos?.nombre ?? '',
          proyecto_color: t.modulos?.proyectos?.color ?? '#c96442',
        })),
        comentarios: ((coms ?? []) as any[])
          .filter((c) => c.tareas) // Filtrar por si la tarea fue eliminada
          .map((c) => ({
            id: c.id,
            texto: c.texto,
            tarea_id: c.tarea_id,
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
