import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { diasHasta } from '../lib/ui.ts'
import i18n from '../i18n/index.ts'
import { etiquetaOrigen, origenValido } from '../lib/navegacion.ts'
import { useProyectos } from '../data/proyectos.ts'
import { useModulos, useCrearModulo } from '../data/modulos.ts'
import { useActualizarTarea, useTareasPorProyecto, useProyectoDependencias } from '../data/tareas.ts'
import { usePersonas } from '../data/personas.ts'
import { useRealtimeProyecto } from '../data/realtime.ts'
import TareaPanel from '../components/TareaPanel.tsx'
import KanbanBoard from '../components/KanbanBoard.tsx'
import { EliminarProyecto, EquipoProyecto } from '../components/proyecto/ProyectoAcciones.tsx'
import { DefinicionSeccion } from '../components/proyecto/DefinicionSeccion.tsx'
import { DecisionesSeccion } from '../components/proyecto/DecisionesSeccion.tsx'
import { CorreccionesClienteSeccion } from '../components/proyecto/ClienteSeccion.tsx'
import { ModuloSeccion } from '../components/proyecto/ModuloSeccion.tsx'

interface Seleccion {
  taskId: string
  moduloId: string
  moduloNombre: string
}

export default function ProyectoDetalle() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data: proyectos } = useProyectos()
  const { data: modulos } = useModulos(id)
  const { data: tareasProyecto } = useTareasPorProyecto(id)
  const { data: personas } = usePersonas()
  const [sel, setSel] = useState<Seleccion | null>(null)
  const { data: proyectoDeps } = useProyectoDependencias(id)
  const actualizar = useActualizarTarea()
  const [searchParams, setSearchParams] = useSearchParams()
  const tareaIdParam = searchParams.get('tarea')
  // De dónde vino (Mis tareas, Hoy, Revisiones…). Sin `de`, el volver es a Proyectos.
  const origen = origenValido(searchParams.get('de'))
  const volverA = origen ?? '/proyectos'
  const volverLabel = etiquetaOrigen(origen)

  const [vista, setVista] = useState<'lista' | 'kanban'>(() => {
    try {
      return (localStorage.getItem('preferencia_vista') as 'lista' | 'kanban') || 'lista'
    } catch {
      return 'lista'
    }
  })
  const [moduloFiltro, setModuloFiltro] = useState<string>('todos')
  
  const cambiarVista = (v: 'lista' | 'kanban') => {
    setVista(v)
    try {
      localStorage.setItem('preferencia_vista', v)
    } catch {}
  }

  useEffect(() => {
    if (tareaIdParam && tareasProyecto && modulos) {
      const tk = tareasProyecto.find((x) => x.id === tareaIdParam)
      if (tk) {
        const m = modulos.find((x) => x.id === tk.modulo_id)
        setSel({
          taskId: tk.id,
          moduloId: tk.modulo_id,
          moduloNombre: m ? m.nombre : i18n.t('proyectoDetalle.moduloFallback'),
        })
      }
    }
  }, [tareaIdParam, tareasProyecto, modulos])

  // Si se entró directo a la tarea desde otra vista, cerrar el panel devuelve ahí:
  // el proyecto nunca fue el destino elegido. Si no, solo se cierra el panel.
  const onCerrarPanel = useCallback(() => {
    if (origen) {
      navigate(origen)
      return
    }
    setSel(null)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('tarea')
        return next
      },
      { replace: true }
    )
  }, [origen, navigate, setSearchParams])
  const [nuevoModulo, setNuevoModulo] = useState('')
  const crearModulo = useCrearModulo()
  const rootRef = useRef<HTMLDivElement>(null)

  // Atajos: "n" → quick-add tarea, Esc → cerrar panel, ↑/↓ → navegar filas.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const el = e.target as HTMLElement
      const typing =
        el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.tagName === 'SELECT' ||
        el.isContentEditable

      if (e.key === 'Escape') {
        // Cerrar por Esc pasa por el mismo camino que la X: limpia `?tarea` (si no,
        // el próximo refetch de tareas vuelve a abrir el panel) y respeta el origen.
        if (!typing) onCerrarPanel()
        return
      }
      if (typing) return

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        rootRef.current?.querySelector<HTMLInputElement>('[data-quickadd-tarea]')?.focus()
        return
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const filas = [...(rootRef.current?.querySelectorAll<HTMLElement>('[data-taskrow]') ?? [])]
        if (filas.length === 0) return
        e.preventDefault()
        const idx = filas.indexOf(document.activeElement as HTMLElement)
        let next = e.key === 'ArrowDown' ? idx + 1 : idx - 1
        if (idx === -1) next = e.key === 'ArrowDown' ? 0 : filas.length - 1
        filas[Math.max(0, Math.min(filas.length - 1, next))]?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCerrarPanel])

  const proyecto = (proyectos ?? []).find((p) => p.id === id)
  const personaPorId = new Map((personas ?? []).map((p) => [p.id, p]))

  // Live entre miembros: tareas/comentarios del proyecto abierto.
  useRealtimeProyecto(id, (modulos ?? []).map((m) => m.id))

  const agregarModulo = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    const nombre = nuevoModulo.trim()
    if (!nombre) return
    crearModulo.mutate({ proyecto_id: id, nombre, orden: modulos?.length ?? 0 })
    setNuevoModulo('')
  }

  if (!proyecto) {
    return <div className="p-11 text-sm text-muted">{t('proyectoDetalle.noEncontrado')}</div>
  }

  const tasks = tareasProyecto ?? []
  const total = tasks.length
  const hechas = tasks.filter((t) => t.estado === 'hecho').length
  const curso = tasks.filter((t) => t.estado === 'en_curso').length
  const vencidasProy = tasks.filter(
    (t) => t.estado !== 'hecho' && t.fecha && diasHasta(t.fecha) < 0,
  ).length
  // Avance del proyecto = módulos cerrados / total de módulos.
  const mods = modulos ?? []
  const modsCerrados = mods.filter((m) => m.estado === 'cerrado').length
  const pct = mods.length > 0 ? Math.round((modsCerrados / mods.length) * 100) : 0

  return (
    <div ref={rootRef} className="flex">
      {/* En mobile el scroll lo lleva el body (el topbar del Layout ya ocupa alto);
          desde lg la columna tiene su propio scroll para que el panel lateral quede fijo. */}
      <div className="min-w-0 flex-1 lg:h-screen lg:overflow-auto">
        <div className="mx-auto max-w-[960px] px-4 sm:px-6 lg:px-11 pb-20 pt-[34px]">
          <button
            type="button"
            onClick={() => navigate(volverA)}
            className="mb-[18px] flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 3L5 8l5 5" />
            </svg>
            {volverLabel}
          </button>

          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-[5px] flex items-center gap-[11px]">
                <span className="h-3.5 w-3.5 flex-none rounded" style={{ background: proyecto.color }} />
                <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.025em]">{proyecto.nombre}</h1>
              </div>
              <div className="pl-[25px] text-sm text-muted-soft">{proyecto.descripcion ?? ''}</div>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
              <div className="flex flex-none rounded-lg border border-line bg-surface p-0.5 sm:mr-1">
                <button
                  type="button"
                  onClick={() => cambiarVista('lista')}
                  className={`rounded-[6px] px-2.5 py-1 text-xs font-bold transition-colors ${
                    vista === 'lista' ? 'bg-hover text-ink' : 'text-muted hover:text-ink'
                  }`}
                >
                  {t('proyectoDetalle.lista')}
                </button>
                <button
                  type="button"
                  onClick={() => cambiarVista('kanban')}
                  className={`rounded-[6px] px-2.5 py-1 text-xs font-bold transition-colors ${
                    vista === 'kanban' ? 'bg-hover text-ink' : 'text-muted hover:text-ink'
                  }`}
                >
                  {t('proyectoDetalle.tablero')}
                </button>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/proyectos/${id}/gantt`)}
                className="flex flex-none items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink-soft transition-colors hover:bg-hover"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 4h7M2 8h11M2 12h5" />
                </svg>
                Gantt
              </button>
              <button
                type="button"
                onClick={() => navigate(`/proyectos/${id}/sprint`)}
                className="flex flex-none items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink-soft transition-colors hover:bg-hover"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 8h12M8 2v12" />
                </svg>
                Sprint
              </button>
              <EliminarProyecto proyectoId={id} nombre={proyecto.nombre} />
              <EquipoProyecto proyectoId={id} personas={personas ?? []} />
            </div>
          </div>

          <div className="mb-[30px] flex flex-col gap-4 rounded-[13px] border border-line bg-surface px-4 py-[15px] sm:flex-row sm:items-center sm:gap-[22px] sm:px-5">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12.5px] font-semibold text-muted-soft">
                  {t('proyectoDetalle.avanceProyecto')}
                </span>
                <span className="font-mono text-[13px] font-bold">
                  {modsCerrados}/{mods.length} · {pct}%
                </span>
              </div>
              <div className="h-[7px] overflow-hidden rounded bg-track">
                <div className="h-full rounded" style={{ width: `${pct}%`, background: proyecto.color }} />
              </div>
            </div>
            <div className="h-[34px] w-px flex-none bg-line" />
            <div className="flex flex-none gap-[22px]">
              <Metrica valor={total} label={t('common.tareas')} />
              <Metrica valor={curso} label={t('proyectoDetalle.metEnCurso')} color="var(--color-info)" />
              <Metrica valor={hechas} label={t('proyectoDetalle.metHechas')} color="var(--color-ok)" />
              {vencidasProy > 0 && <Metrica valor={vencidasProy} label={t('proyectoDetalle.metVencidas')} color="var(--color-danger)" />}
            </div>
          </div>

          <DefinicionSeccion proyecto={proyecto} />

          <DecisionesSeccion proyectoId={id} />

          <CorreccionesClienteSeccion proyectoId={id} personaPorId={personaPorId} />

          {vista === 'kanban' ? (
            <div className="flex flex-col gap-4">
              {/* Filtro por Módulo */}
              <div className="mb-2 flex items-center justify-between">
                <label className="flex min-w-0 flex-wrap items-center gap-2 text-xs font-semibold text-muted">
                  {t('proyectoDetalle.filtrarModulo')}
                  <select
                    value={moduloFiltro}
                    onChange={(e) => setModuloFiltro(e.target.value)}
                    className="min-w-0 max-w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand"
                  >
                    <option value="todos">{t('proyectoDetalle.todosModulos')}</option>
                    {(modulos ?? []).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <KanbanBoard
                tareas={
                  moduloFiltro === 'todos'
                    ? (tareasProyecto ?? [])
                    : (tareasProyecto ?? []).filter((t) => t.modulo_id === moduloFiltro)
                }
                personaPorId={personaPorId}
                proyectoId={id}
                proyectoDeps={proyectoDeps ?? []}
                todasLasTareas={tareasProyecto ?? []}
                moduloNombres={new Map((modulos ?? []).map((m) => [m.id, m.nombre]))}
                onAbrir={(taskId) => {
                  const tk = (tareasProyecto ?? []).find((x) => x.id === taskId)
                  if (tk) {
                    const m = (modulos ?? []).find((x) => x.id === tk.modulo_id)
                    setSel({
                      taskId: tk.id,
                      moduloId: tk.modulo_id,
                      moduloNombre: m ? m.nombre : t('proyectoDetalle.moduloFallback'),
                    })
                  }
                }}
                onMoverTarea={(taskId, nuevoEstado) => {
                  const tk = (tareasProyecto ?? []).find((x) => x.id === taskId)
                  if (tk) {
                    actualizar.mutate({
                      id: taskId,
                      moduloId: tk.modulo_id,
                      cambios: { estado: nuevoEstado },
                    })
                  }
                }}
              />
            </div>
          ) : (
            <>
              {(modulos ?? []).map((m) => (
                <ModuloSeccion
                  key={m.id}
                  modulo={m}
                  tareas={tasks.filter((t) => t.modulo_id === m.id)}
                  personaPorId={personaPorId}
                  seleccionado={sel?.taskId ?? null}
                  onAbrir={(taskId) =>
                    setSel({ taskId, moduloId: m.id, moduloNombre: m.nombre })
                  }
                  todasLasTareas={tareasProyecto ?? []}
                  proyectoDeps={proyectoDeps ?? []}
                />
              ))}
              <div className="flex items-center gap-[11px] px-0.5 py-1">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--color-neutral-dot)" strokeWidth="1.8" strokeLinecap="round" className="flex-none">
                  <path d="M8 3.5v9M3.5 8h9" />
                </svg>
                <input
                  value={nuevoModulo}
                  onChange={(e) => setNuevoModulo(e.target.value)}
                  onKeyDown={agregarModulo}
                  placeholder={t('proyectoDetalle.agregarModulo')}
                  className="flex-1 bg-transparent text-[13px] font-semibold uppercase tracking-[0.02em] text-label outline-none placeholder:text-faint placeholder:normal-case placeholder:font-normal placeholder:tracking-normal"
                />
                {nuevoModulo.trim() && (
                  <span className="flex-none font-mono text-[11px] text-faint">{t('proyectoDetalle.enterHint')}</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {sel && (
        <TareaPanel
          taskId={sel.taskId}
          moduloNombre={sel.moduloNombre}
          proyecto={proyecto}
          onClose={onCerrarPanel}
        />
      )}
    </div>
  )
}

function Metrica({ valor, label, color }: { valor: number; label: string; color?: string }) {
  return (
    <div className="text-center">
      <div className="font-mono text-[19px] font-extrabold" style={color ? { color } : undefined}>
        {valor}
      </div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  )
}
