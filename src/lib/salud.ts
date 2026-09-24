// Reglas puras de salud de proyecto (sin Supabase): semáforo de la cartera.
import type { Database } from './database.types.ts'

export type SaludProyecto = Database['public']['Views']['v_salud_proyectos']['Row']

// Días sin actividad a partir de los cuales un proyecto se considera estancado.
// El cron /api/digest usa el mismo umbral.
export const DIAS_ESTANCADO = 7

export type Semaforo = 'rojo' | 'ambar' | 'verde'

// Días completos desde un ISO hasta ahora (null si no hay fecha).
export function diasDesde(iso: string | null): number | null {
  if (!iso) return null
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
}

// Rojo si está estancado o con vencidas; ámbar si hay cosas trabadas en revisión,
// trabajo sin dueño o demasiadas urgencias; verde si fluye.
export function semaforo(s: SaludProyecto): Semaforo {
  const inactivo = diasDesde(s.ultima_actividad) ?? 0
  if (inactivo >= DIAS_ESTANCADO || s.vencidas > 0) return 'rojo'
  if (s.en_revision > 2 || s.sin_asignar > 0 || s.alta_abiertas > 3) return 'ambar'
  return 'verde'
}
