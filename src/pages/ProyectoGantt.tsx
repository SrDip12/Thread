import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import type { Tables } from '../lib/database.types.ts'
import { estadoVM, fmtFecha, mesesCortos } from '../lib/ui.ts'
import { useProyectos } from '../data/proyectos.ts'
import { useModulos } from '../data/modulos.ts'
import { useTareasPorProyecto } from '../data/tareas.ts'
import { usePersonas } from '../data/personas.ts'
import { Avatar, Eyebrow, EmptyState, Skeleton } from '../components/ui.tsx'

type Tarea = Tables<'tareas'>

const PX_DIA = 13 // ancho de un día en el track; sube/baja para zoom
const COL = 248 // ancho de la columna de etiquetas (izquierda)
const DIA = 86_400_000
const HOY = new Date().toISOString().slice(0, 10)

const ms = (iso: string) => new Date(`${iso}T00:00:00`).getTime()

// Inicio/fin de la barra. start = inicio si lo hay, si no la fecha (hito).
// end = fecha (vencimiento) si lo hay, si no el inicio.
const rango = (t: Tarea) => {
  const start = t.fecha_inicio ?? t.fecha
  const end = t.fecha ?? t.fecha_inicio
  return start && end ? { start, end } : null
}
const esHito = (t: Tarea) => !t.fecha_inicio && !!t.fecha

export default function ProyectoGantt() {
  const { t } = useTranslation()
  const MESES = mesesCortos()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data: proyectos } = useProyectos()
  const { data: modulos } = useModulos(id)
  const { data: tareas, isLoading } = useTareasPorProyecto(id)
  const { data: personas } = usePersonas()

  const proyecto = (proyectos ?? []).find((p) => p.id === id)
  const personaPorId = useMemo(
    () => new Map((personas ?? []).map((p) => [p.id, p])),
    [personas],
  )

  // Dominio temporal: del 1° del mes más temprano hasta el vencimiento más tardío.
  const dominio = useMemo(() => {
    const conFecha = (tareas ?? []).map(rango).filter((r): r is { start: string; end: string } => !!r)
    if (conFecha.length === 0) return null
    const minMs = Math.min(...conFecha.map((r) => ms(r.start)))
    const maxMs = Math.max(...conFecha.map((r) => ms(r.end)))
    const d0 = new Date(minMs)
    const inicio = new Date(d0.getFullYear(), d0.getMonth(), 1) // 1° del mes
    const dias = Math.round((maxMs - inicio.getTime()) / DIA) + 2
    return { inicioMs: inicio.getTime(), dias, ancho: dias * PX_DIA }
  }, [tareas])

  // x en px desde el inicio del dominio.
  const x = (iso: string) => dominio ? ((ms(iso) - dominio.inicioMs) / DIA) * PX_DIA : 0

  // Marcas de mes a lo largo del dominio.
  const meses = useMemo(() => {
    if (!dominio) return []
    const out: { left: number; label: string }[] = []
    const fin = dominio.inicioMs + dominio.dias * DIA
    const d = new Date(dominio.inicioMs)
    while (d.getTime() < fin) {
      out.push({
        left: x(d.toISOString().slice(0, 10)),
        label: d.getMonth() === 0 ? `${MESES[0]} ${d.getFullYear()}` : MESES[d.getMonth()],
      })
      d.setMonth(d.getMonth() + 1)
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dominio])

  // Tareas agrupadas por módulo (en el orden de los módulos), solo las que tienen fecha.
  const grupos = useMemo(() => {
    const porModulo = new Map<string, Tarea[]>()
    for (const t of tareas ?? []) {
      if (!rango(t)) continue
      const arr = porModulo.get(t.modulo_id) ?? []
      arr.push(t)
      porModulo.set(t.modulo_id, arr)
    }
    return (modulos ?? [])
      .map((m) => ({ modulo: m, tareas: porModulo.get(m.id) ?? [] }))
      .filter((g) => g.tareas.length > 0)
  }, [tareas, modulos])

  const sinFecha = (tareas ?? []).filter((t) => !rango(t)).length

  if (!proyecto) {
    return <div className="px-11 pt-10 text-sm text-muted">{t('gantt.cargando')}</div>
  }

  return (
    <div className="mx-auto max-w-[1160px] px-11 pb-20 pt-[34px]">
      <button
        type="button"
        onClick={() => navigate(`/proyectos/${id}`)}
        className="mb-[18px] flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 3L5 8l5 5" />
        </svg>
        {proyecto.nombre}
      </button>

      <div className="mb-7">
        <Eyebrow>{t('gantt.cronograma')}</Eyebrow>
        <div className="flex items-center gap-[11px]">
          <span className="h-3.5 w-3.5 flex-none rounded" style={{ background: proyecto.color }} />
          <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.025em]">{t('gantt.titulo', { nombre: proyecto.nombre })}</h1>
        </div>
      </div>

      {isLoading && <Skeleton className="h-64 w-full rounded-[13px]" />}

      {!isLoading && !dominio && (
        <EmptyState
          icon={
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 4h7M2 8h11M2 12h5" />
            </svg>
          }
          titulo={t('gantt.sinFechas')}
          descripcion={t('gantt.sinFechasDesc')}
        />
      )}

      {!isLoading && dominio && (
        <div className="overflow-x-auto rounded-[13px] border border-line bg-surface">
          <div style={{ width: COL + dominio.ancho }}>
            {/* Cabecera: meses */}
            <div className="sticky top-0 z-10 flex border-b border-line bg-surface">
              <div className="flex-none border-r border-line" style={{ width: COL }} />
              <div className="relative h-9" style={{ width: dominio.ancho }}>
                {meses.map((m, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-9 border-l border-line-soft pl-1.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-faint"
                    style={{ left: m.left }}
                  >
                    {m.label}
                  </div>
                ))}
                {ms(HOY) >= dominio.inicioMs && (
                  <div
                    className="absolute top-0 z-20 h-9 w-px bg-brand"
                    style={{ left: x(HOY) }}
                    title={t('gantt.hoyTooltip', { fecha: fmtFecha(HOY) })}
                  />
                )}
              </div>
            </div>

            {/* Filas por módulo */}
            {grupos.map((g) => (
              <div key={g.modulo.id}>
                <div className="flex border-b border-line-soft bg-canvas">
                  <div className="flex-none px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.03em] text-muted" style={{ width: COL }}>
                    {g.modulo.nombre}
                  </div>
                  <div style={{ width: dominio.ancho }} />
                </div>
                {g.tareas.map((t) => (
                  <FilaTarea
                    key={t.id}
                    tarea={t}
                    persona={t.responsable_id ? personaPorId.get(t.responsable_id) : undefined}
                    x={x}
                    ancho={dominio.ancho}
                    color={proyecto.color}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLoading && sinFecha > 0 && (
        <p className="mt-3 text-[12.5px] text-faint">
          {t('gantt.sinFechaNota', { count: sinFecha })}
        </p>
      )}
    </div>
  )
}

function FilaTarea({
  tarea,
  persona,
  x,
  ancho,
  color,
}: {
  tarea: Tarea
  persona: Tables<'personas'> | undefined
  x: (iso: string) => number
  ancho: number
  color: string
}) {
  const { t } = useTranslation()
  const r = rango(tarea)
  if (!r) return null
  const vm = estadoVM(tarea.estado)
  const hito = esHito(tarea)
  const left = x(r.start)
  // +PX_DIA para que el día de fin entre en la barra; mínimo 1 día de ancho visible.
  const w = Math.max(x(r.end) - x(r.start) + PX_DIA, PX_DIA)

  return (
    <div className="flex items-center border-b border-line-soft hover:bg-hover">
      <div className="flex flex-none items-center gap-2 px-4 py-2" style={{ width: COL }}>
        {persona && <Avatar nombre={persona.nombre} color={persona.color} size={18} />}
        <span className={`truncate text-[13px] ${vm.done ? 'text-muted line-through' : 'text-ink'}`}>
          {tarea.titulo}
        </span>
      </div>
      <div className="relative h-9" style={{ width: ancho }}>
        {hito ? (
          <div
            className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 rounded-[1px]"
            style={{ left: left, background: vm.dot, border: `1px solid ${vm.fg}` }}
            title={t('gantt.hitoTooltip', { titulo: tarea.titulo, fecha: fmtFecha(tarea.fecha) })}
          />
        ) : (
          <div
            className="absolute top-1/2 flex h-[14px] -translate-y-1/2 items-center rounded-[5px]"
            style={{ left, width: w, background: vm.done ? vm.dot : color, opacity: vm.done ? 1 : 0.85 }}
            title={t('gantt.barraTooltip', { titulo: tarea.titulo, inicio: fmtFecha(r.start), fin: fmtFecha(r.end) })}
          />
        )}
      </div>
    </div>
  )
}
