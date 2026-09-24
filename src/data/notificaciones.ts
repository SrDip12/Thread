import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.ts'
import { qk } from './queryKeys.ts'
import i18n from '../i18n/index.ts'

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
  tarea_fecha: string | null
  proyecto_id: string | null
  proyecto_nombre: string
  proyecto_color: string
  tipo: string
  /** Sub-caso del tipo (revision: envio_revision | aprobo | devolvio). */
  evento: string | null
}

// Forma cruda del select con embeds (database.types no declara Relationships).
interface NotifFila {
  id: string
  created_at: string
  autor_id: string | null
  tipo: string
  evento: string | null
  texto: string
  leido: boolean
  tarea_id: string | null
  proyecto_id: string | null
  personas: { nombre: string; color: string } | null
  tareas: { titulo: string; fecha: string | null } | null
  proyectos: { nombre: string; color: string } | null
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
          evento,
          texto,
          leido,
          tarea_id,
          proyecto_id,
          personas:autor_id(nombre, color),
          tareas(titulo, fecha),
          proyectos(nombre, color)
        `)
        .eq('persona_id', personaId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      return ((data ?? []) as unknown as NotifFila[]).map((n) => ({
        id: n.id,
        created_at: n.created_at,
        autor_id: n.autor_id,
        autor_nombre: n.personas?.nombre ?? i18n.t('notif.sistema'),
        autor_color: n.personas?.color ?? 'var(--color-avatar-empty)',
        texto: n.texto,
        leido: n.leido,
        tarea_id: n.tarea_id,
        tarea_titulo: n.tareas?.titulo ?? '',
        tarea_fecha: n.tareas?.fecha ?? null,
        proyecto_id: n.proyecto_id,
        proyecto_nombre: n.proyectos?.nombre ?? '',
        proyecto_color: n.proyectos?.color ?? 'var(--color-avatar-empty)',
        tipo: n.tipo,
        evento: n.evento,
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

// Al abrir la app, genera los avisos de vencimiento propios que falten (la función
// SQL deduplica). El cron diario /api/digest hace lo mismo para todo el equipo, así
// que esto solo adelanta los avisos si alguien entra antes del cron.
export function useChequearVencimientos(personaId: string) {
  const queryClient = useQueryClient()
  const hechoPara = useRef<string | null>(null)

  useEffect(() => {
    if (!personaId || hechoPara.current === personaId) return
    hechoPara.current = personaId
    void supabase.rpc('generar_avisos_vencimiento', {}).then(({ data, error }) => {
      if (error) {
        console.error('No se pudieron generar los avisos de vencimiento:', error.message)
        return
      }
      if (data) void queryClient.invalidateQueries({ queryKey: qk.notificaciones.byPersona(personaId) })
    })
  }, [personaId, queryClient])
}
