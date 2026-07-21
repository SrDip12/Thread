import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.tsx'
import { useProyectos } from '../data/proyectos.ts'
import { useReuniones } from '../data/reuniones.ts'
import { useMisTareas, type TareaConProyecto } from '../data/tareas.ts'
import { momentoReunion } from '../data/recordatorios.ts'
import { tiposReunion, estadoVM, fechaVM } from '../lib/ui.ts'
import { rutaTarea } from '../lib/navegacion.ts'
import { Eyebrow, Skeleton } from '../components/ui.tsx'

// Clave de día local "YYYY-MM-DD" para agrupar reuniones.
function claveDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Calendario() {
  const { t } = useTranslation()
  const TIPOS = tiposReunion()
  const MESES = t('calendario.meses', { returnObjects: true }) as unknown as string[]
  const DIAS = t('calendario.dias', { returnObjects: true }) as unknown as string[]
  const navigate = useNavigate()
  const { persona } = useAuth()
  const hoy = new Date()
  const [filtroProyecto, setFiltroProyecto] = useState<string | null>(null)
  const [mostrarTareas, setMostrarTareas] = useState(true)
  const [cursor, setCursor] = useState(() => new Date(hoy.getFullYear(), hoy.getMonth(), 1))

  const { data: proyectos } = useProyectos()
  const { data: reuniones, isLoading } = useReuniones(filtroProyecto)
  const { data: misTareas } = useMisTareas(persona?.id ?? '')

  const proyectoPorId = useMemo(
    () => new Map((proyectos ?? []).map((p) => [p.id, p])),
    [proyectos],
  )

  // Mis tareas pendientes con fecha, agrupadas por día (la fecha ya es YYYY-MM-DD).
  const tareasPorDia = useMemo(() => {
    const mapa = new Map<string, TareaConProyecto[]>()
    if (!mostrarTareas) return mapa
    for (const t of misTareas ?? []) {
      if (!t.fecha || t.estado === 'hecho') continue
      if (filtroProyecto && t.modulos?.proyectos?.id !== filtroProyecto) continue
      const arr = mapa.get(t.fecha) ?? []
      arr.push(t)
      mapa.set(t.fecha, arr)
    }
    return mapa
  }, [misTareas, mostrarTareas, filtroProyecto])

  // Reuniones agrupadas por día, ordenadas por hora dentro del día.
  const porDia = useMemo(() => {
    const mapa = new Map<string, typeof reuniones>()
    for (const r of reuniones ?? []) {
      const k = claveDia(momentoReunion(r))
      const arr = mapa.get(k) ?? []
      arr.push(r)
      mapa.set(k, arr)
    }
    for (const arr of mapa.values()) {
      arr?.sort((a, b) => momentoReunion(a).getTime() - momentoReunion(b).getTime())
    }
    return mapa
  }, [reuniones])

  // Celdas del mes: arranca el lunes de la semana del día 1.
  const primero = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const offset = (primero.getDay() + 6) % 7 // 0 = lunes
  const diasEnMes = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
  const semanas = Math.ceil((offset + diasEnMes) / 7)
  const celdas: Date[] = []
  for (let i = 0; i < semanas * 7; i++) {
    celdas.push(new Date(cursor.getFullYear(), cursor.getMonth(), i - offset + 1))
  }

  const irMes = (delta: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1))

  return (
    <div className="mx-auto max-w-[1040px] px-11 pb-20 pt-10">
      <div className="mb-[26px] flex items-end justify-between gap-6">
        <div>
          <Eyebrow>{t('calendario.reunionesCount', { count: reuniones?.length ?? 0 })}</Eyebrow>
          <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.025em]">{t('calendario.titulo')}</h1>
          <p className="mt-[7px] text-sm text-muted-soft">
            {t('calendario.subtitulo')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/reuniones')}
          className="flex flex-none items-center gap-1.5 rounded-[9px] border border-line bg-surface px-[15px] py-2.5 text-[13.5px] font-semibold text-ink transition-colors hover:bg-hover"
        >
          {t('calendario.verLista')}
        </button>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => irMes(-1)}
            aria-label={t('calendario.mesAnterior')}
            className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-line bg-surface text-muted transition-colors hover:bg-hover hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3L5 8l5 5" /></svg>
          </button>
          <button
            type="button"
            onClick={() => irMes(1)}
            aria-label={t('calendario.mesSiguiente')}
            className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-line bg-surface text-muted transition-colors hover:bg-hover hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3l5 5-5 5" /></svg>
          </button>
        </div>
        <div className="text-[17px] font-bold capitalize tracking-[-0.02em]">
          {MESES[cursor.getMonth()]} {cursor.getFullYear()}
        </div>
        <button
          type="button"
          onClick={() => setCursor(new Date(hoy.getFullYear(), hoy.getMonth(), 1))}
          className="rounded-[9px] border border-line bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-ink transition-colors hover:bg-hover"
        >
          {t('calendario.hoy')}
        </button>

        <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[12.5px] font-semibold text-muted">
          <input
            type="checkbox"
            checked={mostrarTareas}
            onChange={(e) => setMostrarTareas(e.target.checked)}
            className="h-[14px] w-[14px] accent-brand"
          />
          {t('calendario.misVencimientos')}
        </label>
        <select
          value={filtroProyecto ?? ''}
          onChange={(e) => setFiltroProyecto(e.target.value || null)}
          aria-label={t('calendario.filtrarProyecto')}
          className="rounded-[9px] border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink outline-none"
        >
          <option value="">{t('calendario.todosProyectos')}</option>
          {(proyectos ?? []).map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <Skeleton className="h-[520px] w-full rounded-[14px]" />
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
          <div className="grid grid-cols-7 border-b border-line">
            {DIAS.map((d) => (
              <div key={d} className="px-2.5 py-2 text-[11px] font-bold uppercase tracking-[0.04em] text-faint">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {celdas.map((dia, i) => {
              const delMes = dia.getMonth() === cursor.getMonth()
              const esHoy = claveDia(dia) === claveDia(hoy)
              const items = porDia.get(claveDia(dia)) ?? []
              return (
                <div
                  key={i}
                  className={`min-h-[104px] border-b border-r border-line-soft p-1.5 ${
                    delMes ? '' : 'bg-canvas/40'
                  } ${(i + 1) % 7 === 0 ? 'border-r-0' : ''}`}
                >
                  <div
                    className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full font-mono text-[12px] ${
                      esHoy ? 'bg-brand font-bold text-on-brand' : delMes ? 'text-ink' : 'text-faint'
                    }`}
                  >
                    {dia.getDate()}
                  </div>
                  <div className="flex flex-col gap-1">
                    {(items ?? []).map((r) => {
                      const tipo = TIPOS[r.tipo]
                      const proyecto = proyectoPorId.get(r.proyecto_id)
                      const hora = r.hora ? r.hora.slice(0, 5) : null
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => navigate(`/reuniones/${r.id}`)}
                          title={r.descripcion ?? r.titulo}
                          className="flex items-center gap-1 rounded-[6px] px-1.5 py-1 text-left text-[11.5px] font-semibold leading-tight transition-opacity hover:opacity-80"
                          style={{ background: tipo.tint, color: tipo.color }}
                        >
                          {proyecto && (
                            <span className="inline-block h-1.5 w-1.5 flex-none rounded-[1px]" style={{ background: proyecto.color }} />
                          )}
                          {hora && <span className="flex-none font-mono text-[10px] opacity-80">{hora}</span>}
                          <span className="min-w-0 flex-1 truncate">{r.titulo}</span>
                        </button>
                      )
                    })}
                    {(tareasPorDia.get(claveDia(dia)) ?? []).map((t) => {
                      const proy = t.modulos?.proyectos
                      const venc = fechaVM(t.fecha)
                      const vm = estadoVM(t.estado)
                      const estilo = venc?.vencida
                        ? { background: 'var(--color-danger-tint)', color: 'var(--color-danger)' }
                        : { background: vm.bg, color: vm.fg }
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => proy && navigate(rutaTarea(proy.id, t.id, '/calendario'))}
                          title={`${t.titulo}${proy ? ` · ${proy.nombre}` : ''}`}
                          className="flex items-center gap-1 rounded-[6px] px-1.5 py-1 text-left text-[11.5px] font-semibold leading-tight transition-opacity hover:opacity-80"
                          style={estilo}
                        >
                          <span className="inline-block h-1.5 w-1.5 flex-none rounded-full" style={{ background: proy?.color ?? vm.dot }} />
                          <span className="min-w-0 flex-1 truncate">{t.titulo}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
