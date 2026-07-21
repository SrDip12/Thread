// Helpers visuales puros (sin Supabase). Colores dinámicos del diseño.
import type { Enums } from './database.types.ts'
import i18n from '../i18n/index.ts'

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
  const t = i18n.t
  switch (estado) {
    case 'hecho':
      return { label: t('estados.hecho'), bg: 'var(--color-ok-tint)', fg: 'var(--color-ok)', dot: 'var(--color-ok-dot)', done: true }
    case 'revision':
      return { label: t('estados.revision'), bg: 'var(--color-brand-soft)', fg: 'var(--color-brand)', dot: 'var(--color-brand)', done: false }
    case 'en_curso':
      return { label: t('estados.en_curso'), bg: 'var(--color-info-tint)', fg: 'var(--color-info)', dot: 'var(--color-info-dot)', done: false }
    default:
      return { label: t('estados.proximo'), bg: 'var(--color-neutral-tint)', fg: 'var(--color-neutral)', dot: 'var(--color-neutral-dot)', done: false }
  }
}

export const ESTADOS: EstadoTarea[] = ['proximo', 'en_curso', 'revision', 'hecho']

// Tipo de reunión → etiqueta + colores (chip). Compartido por Reuniones/Calendario/Hoy.
// Función (no const) para que la etiqueta reaccione al cambio de idioma.
type TipoReunionVM = { label: string; color: string; tint: string }
export function tiposReunion(): Record<Enums<'tipo_reunion'>, TipoReunionVM> {
  const t = i18n.t
  return {
    sprint_planning: { label: t('tiposReunion.sprint_planning'), color: 'var(--color-brand-deep)', tint: 'var(--color-brand-tint)' },
    retro: { label: t('tiposReunion.retro'), color: 'var(--color-ok)', tint: 'var(--color-ok-tint)' },
    sync: { label: t('tiposReunion.sync'), color: 'var(--color-info)', tint: 'var(--color-info-tint)' },
    cliente: { label: t('tiposReunion.cliente'), color: 'var(--color-warn)', tint: 'var(--color-warn-tint)' },
    otro: { label: t('tiposReunion.otro'), color: 'var(--color-plum)', tint: 'var(--color-plum-tint)' },
  }
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

const MESES_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MESES_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function esIngles(): boolean {
  return i18n.language?.startsWith('en') ?? false
}
function mesCorto(m: number): string {
  return (esIngles() ? MESES_EN : MESES_ES)[m]
}
// Array de meses cortos del idioma actual (para el Gantt).
export function mesesCortos(): string[] {
  return esIngles() ? [...MESES_EN] : [...MESES_ES]
}
// Día + mes en el orden de cada idioma: "12 jun" (es) / "Jun 12" (en).
function diaMes(dia: number, mes: number): string {
  return esIngles() ? `${mesCorto(mes)} ${dia}` : `${dia} ${mesCorto(mes)}`
}

// Fecha corta "12 jun" / "Jun 12" desde un date ISO (YYYY-MM-DD). null si no hay.
export function fmtFecha(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return diaMes(d.getDate(), d.getMonth())
}

// Fecha completa "12 jun 2026" / "Jun 12 2026". Toma solo la parte de día del ISO
// (date o timestamptz a medianoche UTC) y la interpreta como día calendario local,
// para no correrla un día en husos negativos.
export function fmtFechaCompleta(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return `${diaMes(d.getDate(), d.getMonth())} ${d.getFullYear()}`
}

// Fecha y hora "12 jun, 18:30" / "Jun 12, 18:30" desde un timestamp ISO. null si no hay.
export function fmtFechaHora(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const hs = d.getHours().toString().padStart(2, '0')
  const min = d.getMinutes().toString().padStart(2, '0')
  return `${diaMes(d.getDate(), d.getMonth())}, ${hs}:${min}`
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
  if (dias === 0) return { label: i18n.t('fecha.hoy'), fg: 'var(--color-brand)', bg: 'var(--color-brand-soft)', vencida: false }
  if (dias === 1) return { label: i18n.t('fecha.manana'), fg: 'var(--color-warn)', bg: 'var(--color-warn-tint)', vencida: false }
  return { label: corta, fg: 'var(--color-muted)', vencida: false }
}

// Tiempo relativo localizado ("hace 3 días" / "3 days ago", "ahora" / "now").
// Acepta timestamptz ISO (con hora), no la fecha sola de fmtFecha.
export function fmtRelativo(iso: string | null): string | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  const rtf = new Intl.RelativeTimeFormat(esIngles() ? 'en' : 'es', { numeric: 'auto' })
  const min = Math.round((t - Date.now()) / 60000) // negativo = pasado
  if (Math.abs(min) < 60) return rtf.format(min, 'minute')
  const h = Math.round(min / 60)
  if (Math.abs(h) < 24) return rtf.format(h, 'hour')
  return rtf.format(Math.round(h / 24), 'day')
}
