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
      return { label: 'Hecho', bg: '#e7efe9', fg: '#477155', dot: '#6fa07f', done: true }
    case 'revision':
      return { label: 'En revisión', bg: '#fdf6f1', fg: '#c96442', dot: '#c96442', done: false }
    case 'en_curso':
      return { label: 'En curso', bg: '#e8eef6', fg: '#43618f', dot: '#6c8ac4', done: false }
    default:
      return { label: 'Próximo', bg: '#f0ede7', fg: '#8a8276', dot: '#bcb5a8', done: false }
  }
}

export const ESTADOS: EstadoTarea[] = ['proximo', 'en_curso', 'revision', 'hecho']

// Tipo de reunión → etiqueta + colores (chip). Compartido por Reuniones/Calendario/Hoy.
export const TIPOS_REUNION: Record<Enums<'tipo_reunion'>, { label: string; color: string; tint: string }> = {
  sprint_planning: { label: 'Sprint planning', color: '#bb6a3e', tint: '#f8ece2' },
  retro: { label: 'Retro', color: '#477155', tint: '#e7efe9' },
  sync: { label: 'Sync', color: '#43618f', tint: '#e8eef6' },
  cliente: { label: 'Cliente', color: '#a96a23', tint: '#f9ecdc' },
  otro: { label: 'Otro', color: '#7a5a8c', tint: '#f0e9f3' },
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
  if (dias < 0) return { label: corta, fg: '#b5532f', bg: '#fbeee8', vencida: true }
  if (dias === 0) return { label: 'hoy', fg: '#c96442', bg: '#fdf6f1', vencida: false }
  if (dias === 1) return { label: 'mañana', fg: '#a96a23', bg: '#f9ecdc', vencida: false }
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
