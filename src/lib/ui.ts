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

// Estados gris / azul / verde, según /design.
export function estadoVM(estado: EstadoTarea): EstadoVM {
  switch (estado) {
    case 'hecho':
      return { label: 'Hecho', bg: '#e7efe9', fg: '#477155', dot: '#6fa07f', done: true }
    case 'en_curso':
      return { label: 'En curso', bg: '#e8eef6', fg: '#43618f', dot: '#6c8ac4', done: false }
    default:
      return { label: 'Próximo', bg: '#f0ede7', fg: '#8a8276', dot: '#bcb5a8', done: false }
  }
}

export const ESTADOS: EstadoTarea[] = ['proximo', 'en_curso', 'hecho']

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
