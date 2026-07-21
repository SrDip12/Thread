// Helpers visuales puros (sin Supabase). Colores dinámicos del diseño.
import type { Enums } from './database.types.ts'

export type EstadoTarea = Enums<'estado_tarea'>

export interface EstadoVM {
  label: string
  bg: string
  fg: string
  dot: string
  done: boolean
}

// Estados gris / azul / naranja / verde, según /design.
export function estadoVM(estado: EstadoTarea): EstadoVM {
  switch (estado) {
    case 'hecho':
      return { label: 'Hecho', bg: 'var(--color-ok-tint)', fg: 'var(--color-ok)', dot: 'var(--color-ok-dot)', done: true }
    case 'revision':
      return { label: 'En revisión', bg: 'var(--color-brand-soft)', fg: 'var(--color-brand)', dot: 'var(--color-brand)', done: false }
    case 'en_curso':
      return { label: 'En curso', bg: 'var(--color-info-tint)', fg: 'var(--color-info)', dot: 'var(--color-info-dot)', done: false }
    default:
      return { label: 'Próximo', bg: 'var(--color-neutral-tint)', fg: 'var(--color-neutral)', dot: 'var(--color-neutral-dot)', done: false }
  }
}

export const ESTADOS: EstadoTarea[] = ['proximo', 'en_curso', 'revision', 'hecho']

// Tipo de reunión → etiqueta + colores (chip). Compartido por Reuniones/Calendario/Hoy.
export const TIPOS_REUNION: Record<Enums<'tipo_reunion'>, { label: string; color: string; tint: string }> = {
  sprint_planning: { label: 'Sprint planning', color: 'var(--color-brand-deep)', tint: 'var(--color-brand-tint)' },
  retro: { label: 'Retro', color: 'var(--color-ok)', tint: 'var(--color-ok-tint)' },
  sync: { label: 'Sync', color: 'var(--color-info)', tint: 'var(--color-info-tint)' },
  cliente: { label: 'Cliente', color: 'var(--color-warn)', tint: 'var(--color-warn-tint)' },
  otro: { label: 'Otro', color: 'var(--color-plum)', tint: 'var(--color-plum-tint)' },
}

// Paleta de acentos por proyecto (un color por proyecto, según /design).
// El primero (terracota) es el acento de marca y el default.
export const COLORES_PROYECTO = [
  '#c96442', // terracota (marca)
  '#4a7a96', // azul
  '#5a8a6b', // verde
  '#9a6a9a', // ciruela
  '#c08a3e', // ámbar
  '#7a7068', // piedra
] as const

// Iniciales a partir del nombre: "Ana Ruiz" -> "AR".
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/)
  if (partes.length === 0 || partes[0] === '') return '—'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// Fecha corta "12 jun" desde un date ISO (YYYY-MM-DD). null si no hay.
export function fmtFecha(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getDate()} ${MESES[d.getMonth()]}`
}

// Fecha completa "12 jun 2026". Toma solo la parte de día del ISO (date o
// timestamptz a medianoche UTC) y la interpreta como día calendario local,
// para no correrla un día en husos negativos.
export function fmtFechaCompleta(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`
}

// Fecha y hora "12 jun, 18:30" desde un timestamp ISO. null si no hay.
export function fmtFechaHora(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const dia = d.getDate()
  const mes = MESES[d.getMonth()]
  const hs = d.getHours().toString().padStart(2, '0')
  const min = d.getMinutes().toString().padStart(2, '0')
  return `${dia} ${mes}, ${hs}:${min}`
}

// Días de diferencia entre una fecha ISO (YYYY-MM-DD) y hoy. Negativo = pasada.
export function diasHasta(iso: string): number {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const f = new Date(`${iso}T00:00:00`)
  return Math.round((f.getTime() - hoy.getTime()) / 86_400_000)
}

export interface FechaVM {
  label: string
  fg: string
  bg?: string
  vencida: boolean
}

// Señal de vencimiento para filas de tarea: vencida (rojo), hoy (marca),
// mañana (ámbar), futura (neutro). `done` la silencia (ya se cumplió).
export function fechaVM(iso: string | null, done = false): FechaVM | null {
  if (!iso) return null
  const corta = fmtFecha(iso)
  if (!corta) return null
  if (done) return { label: corta, fg: 'var(--color-muted)', vencida: false }
  const dias = diasHasta(iso)
  if (dias < 0) return { label: corta, fg: 'var(--color-danger)', bg: 'var(--color-danger-tint)', vencida: true }
  if (dias === 0) return { label: 'hoy', fg: 'var(--color-brand)', bg: 'var(--color-brand-soft)', vencida: false }
  if (dias === 1) return { label: 'mañana', fg: 'var(--color-warn)', bg: 'var(--color-warn-tint)', vencida: false }
  return { label: corta, fg: 'var(--color-muted)', vencida: false }
}

// Tiempo relativo en español ("hace 3 días", "hace 4 h", "ahora").
// Acepta timestamptz ISO (con hora), no la fecha sola de fmtFecha.
const RTF = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })
export function fmtRelativo(iso: string | null): string | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  const min = Math.round((t - Date.now()) / 60000) // negativo = pasado
  if (Math.abs(min) < 60) return RTF.format(min, 'minute')
  const h = Math.round(min / 60)
  if (Math.abs(h) < 24) return RTF.format(h, 'hour')
  return RTF.format(Math.round(h / 24), 'day')
}
