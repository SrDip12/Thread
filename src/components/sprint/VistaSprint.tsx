// Vista de un sprint: cabecera con progreso/plazo, tareas, backlog, pulso async y cierre.
import { useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import type { Tables } from '../../lib/database.types.ts'
import { estadoVM, ESTADOS, diasHasta, sprintEstadoVM } from '../../lib/ui.ts'
import { rutaTarea } from '../../lib/navegacion.ts'
import { useModulos } from '../../data/modulos.ts'
import KanbanBoard from '../KanbanBoard.tsx'
import { useActualizarSprint, useCerrarSprint } from '../../data/sprints.ts'
import { usePulsos, useCrearPulso, useActualizarPulso } from '../../data/pulsos.ts'
import { useTareasSprint, useTareasBacklog, useCrearTarea, useActualizarTarea, type TareaConModulo, useProyectoDependencias, useTareasPorProyecto } from '../../data/tareas.ts'
import { usePersonas } from '../../data/personas.ts'
import { useAuth } from '../../auth/AuthProvider.tsx'
import { Avatar, EstadoChip, FechaTag, PrioridadTag, InlineEdit, EmptyState } from '../ui.tsx'

type Sprint = Tables<'sprints'>
type Persona = Tables<'personas'>

// ── Vista de un sprint (activo, planificado o cerrado) ─────────────────
export function VistaSprint({
  sprint,
  proyectoId,
  acento,
  hayOtroActivo,
}: {
  sprint: Sprint
  proyectoId: string
  acento: string
  hayOtroActivo: boolean
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: personas } = usePersonas()
  const actualizarSprint = useActualizarSprint()
  const personaPorId = new Map((personas ?? []).map((p) => [p.id, p]))
  const { data: proyectoDeps } = useProyectoDependencias(proyectoId)
  const { data: todasLasTareas } = useTareasPorProyecto(proyectoId)
  const { data: sprintTareas } = useTareasSprint(sprint.id)
  const { data: modulos } = useModulos(proyectoId)
  const actualizarTarea = useActualizarTarea()

  const activo = sprint.estado === 'activo'
  const planificado = sprint.estado === 'planificado'
  const cerrado = sprint.estado === 'cerrado'
  const estadoSprint = sprintEstadoVM(sprint.estado)

  const [vista, setVista] = useState<'lista' | 'kanban'>(() => {
    try {
      return (localStorage.getItem('preferencia_vista_sprint') as 'lista' | 'kanban') || 'lista'
    } catch {
      return 'lista'
    }
  })

  const cambiarVista = (v: 'lista' | 'kanban') => {
    setVista(v)
    try {
      localStorage.setItem('preferencia_vista_sprint', v)
    } catch {}
  }

  const guardarFecha = (campo: 'fecha_inicio' | 'fecha_fin', valor: string) => {
    actualizarSprint.mutate({
      id: sprint.id,
      proyectoId,
      cambios: { [campo]: valor || null },
    })
  }

  const iniciar = () =>
    actualizarSprint.mutate({ id: sprint.id, proyectoId, cambios: { estado: 'activo' } })

  // Cumplimiento del sprint: avance de tareas y días hasta el fin.
  const st = sprintTareas ?? []
  const hechasSprint = st.filter((t) => t.estado === 'hecho').length
  const pctSprint = st.length > 0 ? Math.round((hechasSprint / st.length) * 100) : 0
  const diasFin = !cerrado && sprint.fecha_fin ? diasHasta(sprint.fecha_fin) : null
  const plazoVM =
    diasFin === null
      ? null
      : diasFin < 0
        ? { label: t('sprint.vencioHace', { count: -diasFin }), bg: 'var(--color-danger-tint)', fg: 'var(--color-danger)' }
        : diasFin === 0
          ? { label: t('sprint.terminaHoy'), bg: 'var(--color-brand-soft)', fg: 'var(--color-brand)' }
          : { label: t('sprint.quedan', { count: diasFin }), bg: 'var(--color-info-tint)', fg: 'var(--color-info)' }

  const tieneCierre = Boolean(sprint.cierre_logros || sprint.cierre_pegados || sprint.cierre_cambio)

  return (
    <div className="flex flex-col gap-[30px]">
      {/* Cabecera del sprint */}
      <div className="rounded-[13px] border border-line bg-surface p-5">
        <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
          <h2 className="m-0 text-[19px] font-extrabold tracking-[-0.02em]">{sprint.nombre}</h2>
          <span
            className="rounded-md px-2 py-0.5 text-[11px] font-semibold"
            style={{ background: estadoSprint.bg, color: estadoSprint.fg }}
          >
            {estadoSprint.label}
          </span>
          {plazoVM && (
            <span
              className="rounded-md px-2 py-0.5 text-[11px] font-semibold"
              style={{ background: plazoVM.bg, color: plazoVM.fg }}
            >
              {plazoVM.label}
            </span>
          )}
          {planificado && (
            <button
              type="button"
              onClick={iniciar}
              disabled={hayOtroActivo || actualizarSprint.isPending}
              title={hayOtroActivo ? t('sprint.yaHayActivo') : t('sprint.ponerEnMarcha')}
              className="ml-auto rounded-lg bg-brand px-3.5 py-1.5 text-[12.5px] font-semibold text-on-brand transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {t('sprint.iniciarSprint')}
            </button>
          )}
        </div>

        <InlineEdit
          value={sprint.objetivo ?? ''}
          onSave={(v) =>
            actualizarSprint.mutate({ id: sprint.id, proyectoId, cambios: { objetivo: v || null } })
          }
          placeholder={t('sprint.objetivoPlaceholder')}
          viewClassName="mb-3 text-sm text-muted-soft"
          editClassName="mb-3 w-full bg-transparent text-sm text-ink outline-none"
        />

        {!cerrado && (
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-[12.5px] text-muted">
              {t('sprint.inicio')}
              <input
                type="date"
                value={sprint.fecha_inicio ?? ''}
                onChange={(e) => guardarFecha('fecha_inicio', e.target.value)}
                className="rounded-lg border border-line bg-canvas px-2.5 py-1 text-[12.5px] text-ink outline-none focus:border-brand"
              />
            </label>
            <label className="flex items-center gap-2 text-[12.5px] text-muted">
              {t('sprint.fin')}
              <input
                type="date"
                value={sprint.fecha_fin ?? ''}
                onChange={(e) => guardarFecha('fecha_fin', e.target.value)}
                className="rounded-lg border border-line bg-canvas px-2.5 py-1 text-[12.5px] text-ink outline-none focus:border-brand"
              />
            </label>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <div className="h-[7px] flex-1 overflow-hidden rounded bg-track">
            <div className="h-full rounded" style={{ width: `${pctSprint}%`, background: acento }} />
          </div>
          <span className="flex-none font-mono text-[12px] font-bold">
            {hechasSprint}/{st.length} · {pctSprint}%
          </span>
        </div>

        {/* Resumen de cierre de un sprint cerrado. */}
        {cerrado && tieneCierre && (
          <div className="mt-4 space-y-1.5 border-t border-line-soft pt-3.5 text-[13px]">
            {sprint.cierre_logros && (
              <div><span className="font-semibold text-muted">{t('sprint.logros')}:</span> <span className="text-ink-soft">{sprint.cierre_logros}</span></div>
            )}
            {sprint.cierre_pegados && (
              <div><span className="font-semibold text-muted">{t('sprint.pegados')}:</span> <span className="text-ink-soft">{sprint.cierre_pegados}</span></div>
            )}
            {sprint.cierre_cambio && (
              <div><span className="font-semibold text-muted">{t('sprint.cambio')}:</span> <span className="text-ink-soft">{sprint.cierre_cambio}</span></div>
            )}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-4 px-0.5">
          <div className="text-xs font-semibold uppercase tracking-[0.04em] text-faint">{t('sprint.tareasDelSprint')}</div>
          <div className="flex rounded-lg border border-line bg-surface p-0.5">
            <button
              type="button"
              onClick={() => cambiarVista('lista')}
              className={`rounded-[6px] px-2.5 py-1 text-xs font-bold transition-colors ${
                vista === 'lista' ? 'bg-hover text-ink' : 'text-muted hover:text-ink'
              }`}
            >
              {t('sprint.lista')}
            </button>
            <button
              type="button"
              onClick={() => cambiarVista('kanban')}
              className={`rounded-[6px] px-2.5 py-1 text-xs font-bold transition-colors ${
                vista === 'kanban' ? 'bg-hover text-ink' : 'text-muted hover:text-ink'
              }`}
            >
              {t('sprint.tablero')}
            </button>
          </div>
        </div>

        {vista === 'kanban' ? (
          <div className="rounded-[13px] border border-line bg-surface p-4">
            <KanbanBoard
              tareas={sprintTareas ?? []}
              personaPorId={personaPorId}
              proyectoId={proyectoId}
              proyectoDeps={proyectoDeps ?? []}
              todasLasTareas={todasLasTareas ?? []}
              moduloNombres={new Map((modulos ?? []).map((m) => [m.id, m.nombre]))}
              onAbrir={(taskId) => {
                navigate(rutaTarea(proyectoId, taskId, `/proyectos/${proyectoId}/sprint`))
              }}
              onMoverTarea={(taskId, nuevoEstado) => {
                const tk = (todasLasTareas ?? []).find((x) => x.id === taskId)
                if (tk) {
                  actualizarTarea.mutate({
                    id: taskId,
                    moduloId: tk.modulo_id,
                    cambios: { estado: nuevoEstado },
                  })
                }
              }}
            />
          </div>
        ) : (
          <TareasSprint
            sprint={sprint}
            proyectoId={proyectoId}
            personaPorId={personaPorId}
            proyectoDeps={proyectoDeps ?? []}
            todasLasTareas={todasLasTareas ?? []}
            soloLectura={cerrado}
          />
        )}
      </div>
      {!cerrado && (
        <Backlog
          sprint={sprint}
          proyectoId={proyectoId}
          personaPorId={personaPorId}
          proyectoDeps={proyectoDeps ?? []}
          todasLasTareas={todasLasTareas ?? []}
        />
      )}
      {activo && <PulsoEquipo sprint={sprint} personaPorId={personaPorId} />}
      {activo && <CierreSprint sprint={sprint} proyectoId={proyectoId} acento={acento} />}
    </div>
  )
}

// ── Fila compacta de tarea ──────────────────────────────────────────────
function FilaTarea({
  tarea,
  persona,
  onCiclar,
  proyectoId,
  isBlocked,
}: {
  tarea: TareaConModulo
  persona: Persona | undefined
  onCiclar: () => void
  proyectoId: string
  isBlocked: boolean
}) {
  const { t } = useTranslation()
  const vm = estadoVM(tarea.estado)
  return (
    <div className="flex items-center gap-3 border-b border-line-soft px-4 py-[11px] last:border-b-0">
      <span className="h-[9px] w-[9px] flex-none rounded-full" style={{ background: vm.dot }} />
      <Link
        to={rutaTarea(proyectoId, tarea.id, `/proyectos/${proyectoId}/sprint`)}
        className="min-w-0 flex-1 truncate text-sm font-medium hover:underline hover:text-brand flex items-center gap-1.5"
        style={{ color: vm.done ? 'var(--color-muted)' : 'var(--color-ink)' }}
      >
        {isBlocked && (
          <span className="text-brand flex-none" title={t('kanban.tareaBloqueada')}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="inline">
              <rect x="3" y="11" width="10" height="4" rx="1" />
              <path d="M4 11V6a4 4 0 0 1 8 0v5" />
            </svg>
          </span>
        )}
        {tarea.titulo}
      </Link>
      {!vm.done && <PrioridadTag prioridad={tarea.prioridad} />}
      <FechaTag fecha={tarea.fecha} done={vm.done} />
      {tarea.modulos?.nombre && (
        <span className="hidden max-w-[140px] flex-none truncate rounded bg-track px-2 py-0.5 text-[11px] font-medium text-muted sm:inline-block">
          {tarea.modulos.nombre}
        </span>
      )}
      {persona ? (
        <Avatar nombre={persona.nombre} color={persona.color} size={26} />
      ) : (
        <Avatar nombre="—" color="var(--color-avatar-empty)" size={26} />
      )}
      <EstadoChip estado={tarea.estado} onClick={onCiclar} />
    </div>
  )
}

function TareasSprint({
  sprint,
  proyectoId,
  personaPorId,
  proyectoDeps,
  todasLasTareas,
  soloLectura,
}: {
  sprint: Sprint
  proyectoId: string
  personaPorId: Map<string, Persona>
  proyectoDeps: { bloqueadora_id: string; bloqueada_id: string }[]
  todasLasTareas: Tables<'tareas'>[]
  soloLectura: boolean
}) {
  const { t } = useTranslation()
  const { data: tareas } = useTareasSprint(sprint.id)
  const { data: modulos } = useModulos(proyectoId)
  const crear = useCrearTarea()
  const actualizar = useActualizarTarea()
  const [titulo, setTitulo] = useState('')
  const [moduloId, setModuloId] = useState('')

  const lista = tareas ?? []
  const mods = modulos ?? []
  const hechas = lista.filter((x) => x.estado === 'hecho').length
  const moduloElegido = moduloId || mods[0]?.id || ''

  const ciclar = (tarea: TareaConModulo) => {
    const siguiente = ESTADOS[(ESTADOS.indexOf(tarea.estado) + 1) % ESTADOS.length]
    actualizar.mutate({ id: tarea.id, moduloId: tarea.modulo_id, cambios: { estado: siguiente } })
  }

  const agregar = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    const tit = titulo.trim()
    if (!tit || !moduloElegido) return
    crear.mutate({ modulo_id: moduloElegido, titulo: tit, sprint_id: sprint.id })
    setTitulo('')
  }

  return (
    <section>
      <SeccionTitulo titulo={t('sprint.tareasDelSprint')} extra={`${hechas}/${lista.length}`} />
      <div className="overflow-hidden rounded-[13px] border border-line bg-surface">
        {lista.length === 0 && (
          <div className="px-4 py-4 text-center text-[13px] text-faint">
            {t('sprint.sinTareasSprint')}
          </div>
        )}
        {lista.map((tarea) => {
          const isBlocked = proyectoDeps
            .filter((d) => d.bloqueada_id === tarea.id)
            .some((d) => {
              const b = todasLasTareas.find((x) => x.id === d.bloqueadora_id)
              return b ? b.estado !== 'hecho' : false
            })

          return (
            <FilaTarea
              key={tarea.id}
              tarea={tarea}
              persona={tarea.responsable_id ? personaPorId.get(tarea.responsable_id) : undefined}
              onCiclar={() => ciclar(tarea)}
              proyectoId={proyectoId}
              isBlocked={isBlocked}
            />
          )
        })}

        {!soloLectura && (
          <div className="flex items-center gap-2.5 border-t border-line-soft px-4 py-2.5">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="var(--color-neutral-dot)" strokeWidth="1.8" strokeLinecap="round" className="flex-none" aria-hidden="true">
              <path d="M8 3.5v9M3.5 8h9" />
            </svg>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              onKeyDown={agregar}
              disabled={mods.length === 0}
              aria-label={t('sprint.agregarTareaAria')}
              placeholder={mods.length === 0 ? t('sprint.creaModuloPrimero') : t('sprint.agregarTareaSprint')}
              className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint disabled:cursor-not-allowed"
            />
            {mods.length > 0 && (
              <select
                value={moduloElegido}
                onChange={(e) => setModuloId(e.target.value)}
                aria-label={t('sprint.moduloTareaAria')}
                className="flex-none rounded-lg border border-line bg-canvas px-2 py-1 text-[12.5px] text-muted outline-none focus:border-brand"
              >
                {mods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function Backlog({
  sprint,
  proyectoId,
  personaPorId,
  proyectoDeps,
  todasLasTareas,
}: {
  sprint: Sprint
  proyectoId: string
  personaPorId: Map<string, Persona>
  proyectoDeps: { bloqueadora_id: string; bloqueada_id: string }[]
  todasLasTareas: Tables<'tareas'>[]
}) {
  const { t } = useTranslation()
  const { data: tareas } = useTareasBacklog(proyectoId)
  const actualizar = useActualizarTarea()
  const lista = tareas ?? []

  const alSprint = (tarea: TareaConModulo) => {
    actualizar.mutate({ id: tarea.id, moduloId: tarea.modulo_id, cambios: { sprint_id: sprint.id } })
  }

  return (
    <section>
      <SeccionTitulo titulo={t('sprint.backlog')} extra={`${lista.length}`} />
      {lista.length === 0 ? (
        <EmptyState
          icon={
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 4.5h10M3 8h10M3 11.5h6" />
            </svg>
          }
          titulo={t('sprint.backlogVacio')}
          descripcion={t('sprint.backlogVacioDesc')}
        />
      ) : (
        <div className="overflow-hidden rounded-[13px] border border-line bg-surface">
          {lista.map((tarea) => {
            const vm = estadoVM(tarea.estado)
            const resp = tarea.responsable_id ? personaPorId.get(tarea.responsable_id) : undefined
            const isBlocked = proyectoDeps
              .filter((d) => d.bloqueada_id === tarea.id)
              .some((d) => {
                const b = todasLasTareas.find((x) => x.id === d.bloqueadora_id)
                return b ? b.estado !== 'hecho' : false
              })

            return (
              <div
                key={tarea.id}
                className="flex items-center gap-3 border-b border-line-soft px-4 py-[11px] last:border-b-0"
              >
                <span className="h-[9px] w-[9px] flex-none rounded-full" style={{ background: vm.dot }} />
                <Link
                  to={rutaTarea(proyectoId, tarea.id, `/proyectos/${proyectoId}/sprint`)}
                  className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:underline hover:text-brand flex items-center gap-1.5"
                >
                  {isBlocked && (
                    <span className="text-brand flex-none" title={t('kanban.tareaBloqueada')}>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="inline">
                        <rect x="3" y="11" width="10" height="4" rx="1" />
                        <path d="M4 11V6a4 4 0 0 1 8 0v5" />
                      </svg>
                    </span>
                  )}
                  {tarea.titulo}
                </Link>
                {!vm.done && <PrioridadTag prioridad={tarea.prioridad} />}
                <FechaTag fecha={tarea.fecha} done={vm.done} />
                {tarea.modulos?.nombre && (
                  <span className="hidden max-w-[140px] flex-none truncate rounded bg-track px-2 py-0.5 text-[11px] font-medium text-muted sm:inline-block">
                    {tarea.modulos.nombre}
                  </span>
                )}
                {resp && <Avatar nombre={resp.nombre} color={resp.color} size={26} />}
                <button
                  type="button"
                  onClick={() => alSprint(tarea)}
                  className="flex-none rounded-lg border border-line px-2.5 py-1 text-[12px] font-semibold text-muted transition-colors hover:border-brand hover:text-brand"
                >
                  {t('sprint.alSprint')}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function PulsoEquipo({
  sprint,
  personaPorId,
}: {
  sprint: Sprint
  personaPorId: Map<string, Persona>
}) {
  const { t } = useTranslation()
  const { persona } = useAuth()
  const { data: pulsos } = usePulsos(sprint.id)
  const crear = useCrearPulso()
  const actualizar = useActualizarPulso()
  const [texto, setTexto] = useState('')

  const lista = pulsos ?? []
  const miPulso = persona ? lista.find((p) => p.persona_id === persona.id) : undefined

  const enviar = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !persona) return
    const txt = texto.trim()
    if (!txt) return
    if (miPulso) {
      actualizar.mutate({ id: miPulso.id, sprintId: sprint.id, cambios: { texto: txt } })
    } else {
      crear.mutate({ sprint_id: sprint.id, persona_id: persona.id, texto: txt })
    }
    setTexto('')
  }

  return (
    <section>
      <SeccionTitulo titulo={t('sprint.pulsoEquipo')} />
      <div className="overflow-hidden rounded-[13px] border border-line bg-surface">
        {lista.length === 0 ? (
          <div className="px-4 py-4 text-center text-[13px] text-faint">
            {t('sprint.sinPulsos')}
          </div>
        ) : (
          lista.map((p) => {
            const autor = personaPorId.get(p.persona_id)
            return (
              <div key={p.id} className="flex items-start gap-3 border-b border-line-soft px-4 py-[11px] last:border-b-0">
                <Avatar nombre={autor?.nombre ?? '—'} color={autor?.color ?? 'var(--color-avatar-empty)'} size={26} />
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-semibold text-ink">{autor?.nombre ?? t('paraMi.alguien')}</div>
                  <div className="text-sm text-muted-soft">{p.texto}</div>
                </div>
              </div>
            )
          })
        )}

        {persona && (
          <div className="flex items-center gap-2.5 border-t border-line-soft px-4 py-2.5">
            <Avatar nombre={persona.nombre} color={persona.color} size={26} />
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={enviar}
              aria-label={t('sprint.tuPulsoAria')}
              placeholder={miPulso ? t('sprint.actualizaPulso') : t('sprint.tuPulsoPlaceholder')}
              className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint"
            />
          </div>
        )}
      </div>
    </section>
  )
}

function CierreSprint({
  sprint,
  proyectoId,
  acento,
}: {
  sprint: Sprint
  proyectoId: string
  acento: string
}) {
  const { t } = useTranslation()
  const actualizarSprint = useActualizarSprint()
  const cerrarSprint = useCerrarSprint()

  const guardar = (campo: 'cierre_logros' | 'cierre_pegados' | 'cierre_cambio', valor: string) => {
    actualizarSprint.mutate({ id: sprint.id, proyectoId, cambios: { [campo]: valor || null } })
  }

  const cerrar = () => {
    if (!window.confirm(t('sprint.confirmarCerrar'))) return
    cerrarSprint.mutate({ id: sprint.id, proyectoId })
  }

  return (
    <section>
      <SeccionTitulo titulo={t('sprint.cierreSprint')} />
      <div className="flex flex-col gap-3 rounded-[13px] border border-line bg-surface p-5">
        <CampoCierre
          etiqueta={t('sprint.logros')}
          valor={sprint.cierre_logros ?? ''}
          onGuardar={(v) => guardar('cierre_logros', v)}
        />
        <CampoCierre
          etiqueta={t('sprint.pegados')}
          valor={sprint.cierre_pegados ?? ''}
          onGuardar={(v) => guardar('cierre_pegados', v)}
        />
        <CampoCierre
          etiqueta={t('sprint.cambio')}
          valor={sprint.cierre_cambio ?? ''}
          onGuardar={(v) => guardar('cierre_cambio', v)}
        />
        <div className="pt-1">
          <button
            type="button"
            onClick={cerrar}
            disabled={cerrarSprint.isPending}
            className="rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: acento }}
          >
            {cerrarSprint.isPending ? t('sprint.cerrando') : t('sprint.cerrarSprint')}
          </button>
        </div>
      </div>
    </section>
  )
}

function CampoCierre({
  etiqueta,
  valor,
  onGuardar,
}: {
  etiqueta: string
  valor: string
  onGuardar: (v: string) => void
}) {
  const [val, setVal] = useState(valor)
  return (
    <label className="flex items-center gap-3">
      <span className="w-16 flex-none text-[12.5px] font-semibold text-muted">{etiqueta}</span>
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          if (val.trim() !== valor.trim()) onGuardar(val.trim())
        }}
        placeholder={`${etiqueta}…`}
        className="flex-1 rounded-lg border border-line bg-canvas px-3 py-1.5 text-sm text-ink outline-none focus:border-brand placeholder:text-faint"
      />
    </label>
  )
}

function SeccionTitulo({ titulo, extra }: { titulo: string; extra?: string }) {
  return (
    <div className="mb-[9px] flex items-center gap-2.5 px-0.5">
      <h2 className="m-0 text-[13px] font-bold uppercase tracking-[0.02em] text-label">{titulo}</h2>
      {extra && <span className="font-mono text-[11.5px] text-faint">{extra}</span>}
      <div className="h-px flex-1 bg-line" />
    </div>
  )
}
