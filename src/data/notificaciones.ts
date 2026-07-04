import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.ts'
import { qk } from './queryKeys.ts'
import type { TablesInsert } from '../lib/database.types.ts'
import { useMisTareas } from './tareas.ts'
import { fmtFecha } from '../lib/ui.ts'

export interface Notif {
  id: string
  created_at: string
  autor_id: string | null
  autor_nombre: string
  autor_color: string
  texto: string
  leido: boolean
  tarea_id: string | null
  tarea_titulo: string
  proyecto_id: string | null
  proyecto_nombre: string
  proyecto_color: string
  tipo: string
}

export function useNotificaciones(personaId: string) {
  return useQuery({
    queryKey: qk.notificaciones.byPersona(personaId),
    queryFn: async (): Promise<Notif[]> => {
      const { data, error } = await supabase
        .from('notificaciones')
        .select(`
          id,
          created_at,
          autor_id,
          tipo,
          texto,
          leido,
          tarea_id,
          proyecto_id,
          personas:autor_id(nombre, color),
          tareas(titulo),
          proyectos(nombre, color)
        `)
        .eq('persona_id', personaId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      return (data ?? []).map((n: any) => ({
        id: n.id,
        created_at: n.created_at,
        autor_id: n.autor_id,
        autor_nombre: n.personas?.nombre ?? 'Sistema',
        autor_color: n.personas?.color ?? '#c4bdb1',
        texto: n.texto,
        leido: n.leido,
        tarea_id: n.tarea_id,
        tarea_titulo: n.tareas?.titulo ?? '',
        proyecto_id: n.proyecto_id,
        proyecto_nombre: n.proyectos?.nombre ?? '',
        proyecto_color: n.proyectos?.color ?? '#c4bdb1',
        tipo: n.tipo,
      }))
    },
    enabled: Boolean(personaId),
    staleTime: 30000,
  })
}

export function useMarcarLeida() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; personaId: string }): Promise<void> => {
      const { error } = await supabase
        .from('notificaciones')
        .update({ leido: true })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: qk.notificaciones.byPersona(variables.personaId),
      })
    },
  })
}

export function useMarcarTodasLeidas() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (personaId: string): Promise<void> => {
      const { error } = await supabase
        .from('notificaciones')
        .update({ leido: true })
        .eq('persona_id', personaId)
        .eq('leido', false)
      if (error) throw error
    },
    onSuccess: (_data, personaId) => {
      void queryClient.invalidateQueries({
        queryKey: qk.notificaciones.byPersona(personaId),
      })
    },
  })
}

export function useCrearNotificacion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (nueva: TablesInsert<'notificaciones'>): Promise<void> => {
      const { error } = await supabase.from('notificaciones').insert(nueva)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: qk.notificaciones.byPersona(variables.persona_id),
      })
    },
  })
}

export function useChequearVencimientos(personaId: string) {
  const { data: misTareas } = useMisTareas(personaId)
  const { data: notifs } = useNotificaciones(personaId)
  const crearNotif = useCrearNotificacion()

  // Registro de notificaciones de vencimiento ya solicitadas en esta sesión
  const creadosRef = useRef<Set<string>>(new Set())
  const ultimoPersonaIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!personaId) {
      creadosRef.current.clear()
      ultimoPersonaIdRef.current = null
      return
    }

    // Si cambia de usuario, limpiar el registro
    if (ultimoPersonaIdRef.current !== personaId) {
      creadosRef.current.clear()
      ultimoPersonaIdRef.current = personaId
    }

    if (!misTareas || !notifs) return

    const ahora = new Date()
    ahora.setHours(0, 0, 0, 0)

    const vencenPronto = misTareas.filter((t) => {
      if (t.estado === 'hecho' || !t.fecha) return false
      const fVence = new Date(t.fecha + 'T00:00:00')
      const diffTiempo = fVence.getTime() - ahora.getTime()
      const diffDias = diffTiempo / (1000 * 3600 * 24)
      return diffDias <= 2 // vence hoy, mañana o ya vencida
    })

    for (const t of vencenPronto) {
      const existeNotif = notifs.some((n) => n.tipo === 'vencimiento' && n.tarea_id === t.id)
      
      // Solo disparar la mutación si no existe en BD y no ha sido solicitada en esta sesión
      if (!existeNotif && !creadosRef.current.has(t.id)) {
        creadosRef.current.add(t.id)
        crearNotif.mutate({
          persona_id: personaId,
          autor_id: null,
          tipo: 'vencimiento',
          texto: `La tarea "${t.titulo}" vence pronto o ya expiró (${fmtFecha(t.fecha)})`,
          tarea_id: t.id,
          proyecto_id: t.modulos?.proyectos?.id ?? null,
          leido: false,
        })
      }
    }
  }, [misTareas, notifs, personaId, crearNotif])
}
