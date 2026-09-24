import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { Tables, TablesUpdate } from '../../lib/database.types.ts'
import { estadoVM, ESTADOS, fmtFechaHora } from '../../lib/ui.ts'
import i18n from '../../i18n/index.ts'
import { useActualizarModulo } from '../../data/modulos.ts'
import { useCrearTarea, useActualizarTarea } from '../../data/tareas.ts'
import { useComentariosModulo } from '../../data/comentarios.ts'
import { Avatar, EstadoChip, FechaTag, PrioridadTag } from '../ui.tsx'

type Modulo = Tables<'modulos'>
type Persona = Tables<'personas'>
type EstadoModulo = Modulo['estado']

// Chip de estado del módulo: gris=abierto, azul=en revisión, verde=cerrado.
function moduloEstadoVM(estado: EstadoModulo): { label: string; bg: string; fg: string } {
  const t = i18n.t
  switch (estado) {
    case 'cerrado':
      return { label: t('proyectoDetalle.moduloCerrado'), bg: 'var(--color-ok-tint)', fg: 'var(--color-ok)' }
    case 'en_revision':
      return { label: t('proyectoDetalle.moduloEnRevision'), bg: 'var(--color-info-tint)', fg: 'var(--color-info)' }
    default:
      return { label: t('proyectoDetalle.moduloAbierto'), bg: 'var(--color-neutral-tint)', fg: 'var(--color-neutral)' }
  }
}

export function ModuloSeccion({
  modulo,
  tareas,
  personaPorId,
  seleccionado,
  onAbrir,
  todasLasTareas,
  proyectoDeps,
}: {
  modulo: Modulo
  // Filtradas por el padre desde la lista del proyecto: una sola query para todos los módulos.
  tareas: Tables<'tareas'>[]
  personaPorId: Map<string, Persona>
  seleccionado: string | null
  onAbrir: (taskId: string) => void
  todasLasTareas: Tables<'tareas'>[]
  proyectoDeps: { bloqueadora_id: string; bloqueada_id: string }[]
}) {
  const { t } = useTranslation()
  const crear = useCrearTarea()
  const actualizar = useActualizarTarea()
  const actualizarModulo = useActualizarModulo()
  const [titulo, setTitulo] = useState('')
  // Un módulo cerrado arranca colapsado; el usuario puede expandirlo manualmente.
  const [abiertoManual, setAbiertoManual] = useState(false)

  const lista = tareas ?? []
  const hechas = lista.filter((t) => t.estado === 'hecho').length

  const estadoVMmod = moduloEstadoVM(modulo.estado)
  const cerrado = modulo.estado === 'cerrado'
  const colapsado = cerrado && !abiertoManual

  const cambiarEstado = (estado: EstadoModulo) => {
    // Al entrar a revisión, marcar el instante para priorizar la bandeja.
    // ponytail: set app-side; un único punto de transición. Si aparecen más, mover a trigger.
    const cambios: TablesUpdate<'modulos'> =
      estado === 'en_revision' ? { estado, en_revision_at: new Date().toISOString() } : { estado }
    actualizarModulo.mutate({ id: modulo.id, proyectoId: modulo.proyecto_id, cambios })
    if (estado === 'cerrado') setAbiertoManual(false)
  }

  const ciclarEstado = (id: string, estado: Tables<'tareas'>['estado']) => {
    const siguiente = ESTADOS[(ESTADOS.indexOf(estado) + 1) % ESTADOS.length]
    actualizar.mutate({ id, moduloId: modulo.id, cambios: { estado: siguiente } })
  }

  const agregar = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    const tit = titulo.trim()
    if (!tit) return
    crear.mutate({ modulo_id: modulo.id, titulo: tit })
    setTitulo('')
  }

  return (
    <div className={`mb-[30px] ${cerrado ? 'opacity-60' : ''}`}>
      <div className="mb-[9px] flex flex-wrap items-center gap-2.5 px-0.5">
        <button
          type="button"
          onClick={() => cerrado && setAbiertoManual((v) => !v)}
          className={`m-0 min-w-0 truncate text-[13px] font-bold uppercase tracking-[0.02em] text-label ${
            cerrado ? 'cursor-pointer' : 'cursor-default'
          }`}
          title={cerrado ? (colapsado ? t('proyectoDetalle.expandirModulo') : t('proyectoDetalle.colapsarModulo')) : undefined}
        >
          {modulo.nombre}
        </button>
        <span
          className="flex-none rounded-md px-2 py-[2px] text-[11px] font-semibold"
          style={{ background: estadoVMmod.bg, color: estadoVMmod.fg }}
        >
          {estadoVMmod.label}
        </span>
        <span className="font-mono text-[11.5px] text-faint">
          {hechas}/{lista.length}
        </span>
        <div className="h-px flex-1 bg-line" />
        <div className="flex flex-none items-center gap-2">
          {modulo.estado === 'abierto' && (
            <AccionModulo onClick={() => cambiarEstado('en_revision')}>{t('proyectoDetalle.enviarRevision')}</AccionModulo>
          )}
          {modulo.estado === 'en_revision' && (
            <Link
              to="/revisiones"
              className="rounded-md border border-[var(--color-info-line)] bg-[var(--color-info-tint)] px-2 py-[3px] text-[11px] font-semibold text-[var(--color-info)] transition-colors hover:bg-[var(--color-info-line)]"
              title={t('proyectoDetalle.pendienteVision')}
            >
              {t('proyectoDetalle.enRevisionArrow')}
            </Link>
          )}
          {modulo.estado === 'cerrado' && (
            <AccionModulo onClick={() => cambiarEstado('abierto')}>{t('proyectoDetalle.reabrir')}</AccionModulo>
          )}
        </div>
      </div>

      {/* Feedback de revisión: visible cuando hay decisión pendiente o tomada. */}
      {(modulo.estado === 'en_revision' || modulo.estado === 'cerrado') && (
        <FeedbackModulo moduloId={modulo.id} personaPorId={personaPorId} />
      )}

      {!colapsado && (
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
            <button
              key={tarea.id}
              type="button"
              data-taskrow
              onClick={() => onAbrir(tarea.id)}
              className="flex w-full items-center gap-3 border-b border-line-soft px-4 py-[11px] text-left transition-colors hover:bg-row-hover focus:bg-row-hover focus:outline-none"
              style={{ background: seleccionado === tarea.id ? 'var(--color-hover)' : undefined }}
            >
              <span className="h-[9px] w-[9px] flex-none rounded-full" style={{ background: vm.dot }} />
              <span
                className="min-w-0 flex-1 truncate text-sm font-medium flex items-center gap-1.5"
                style={{ color: vm.done ? 'var(--color-muted)' : 'var(--color-ink)' }}
              >
                {isBlocked && (
                  <span className="text-brand flex-none" title={t('kanban.tareaBloqueada')}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="inline">
                      <rect x="3" y="11" width="10" height="4" rx="1" />
                      <path d="M4 11V6a4 4 0 0 1 8 0v5" />
                    </svg>
                  </span>
                )}
                {tarea.titulo}
              </span>
              {tarea.tipo === 'correccion' && (
                <span
                  className="flex-none rounded-md px-[7px] py-[2px] text-[10.5px] font-bold uppercase tracking-[0.03em]"
                  style={{ background: 'var(--color-warn-tint)', color: 'var(--color-warn)' }}
                >
                  {t('revisiones.correccion')}
                </span>
              )}
              {!vm.done && <PrioridadTag prioridad={tarea.prioridad} />}
              <FechaTag fecha={tarea.fecha} done={vm.done} />
              {resp ? (
                <Avatar nombre={resp.nombre} color={resp.color} size={26} />
              ) : (
                <Avatar nombre="—" color="var(--color-avatar-empty)" size={26} />
              )}
              <EstadoChip estado={tarea.estado} onClick={() => ciclarEstado(tarea.id, tarea.estado)} />
            </button>
          )
        })}

        <div className="flex items-center gap-[11px] px-4 py-2.5">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="var(--color-neutral-dot)" strokeWidth="1.8" strokeLinecap="round" className="flex-none">
            <path d="M8 3.5v9M3.5 8h9" />
          </svg>
          <input
            data-quickadd-tarea
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onKeyDown={agregar}
            placeholder={t('proyectoDetalle.agregarTarea')}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
          />
          {titulo.trim() && (
            <span className="flex-none font-mono text-[11px] text-faint">{t('proyectoDetalle.enterHint')}</span>
          )}
        </div>
      </div>
      )}
    </div>
  )
}

// Feedback de revisión del módulo (comentarios con modulo_id), compacto.
// Muestra el último; con expand lista todos. Solo lectura — se escribe en /revisiones.
function FeedbackModulo({
  moduloId,
  personaPorId,
}: {
  moduloId: string
  personaPorId: Map<string, Persona>
}) {
  const { t } = useTranslation()
  const { data: comentarios } = useComentariosModulo(moduloId)
  const [expandido, setExpandido] = useState(false)
  const lista = comentarios ?? []
  if (lista.length === 0) return null

  const visibles = expandido ? lista : lista.slice(-1)

  return (
    <div className="mb-2.5 rounded-[11px] border border-line bg-row-hover px-3.5 py-2.5">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-faint">
          {t('proyectoDetalle.feedbackRevision')}
        </span>
        {lista.length > 1 && (
          <button
            type="button"
            onClick={() => setExpandido((v) => !v)}
            className="text-[11px] font-semibold text-muted transition-colors hover:text-ink"
          >
            {expandido ? t('proyectoDetalle.verMenos') : t('proyectoDetalle.verLos', { count: lista.length })}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {visibles.map((c) => {
          const autor = personaPorId.get(c.autor_id)
          return (
            <div key={c.id} className="flex gap-2.5">
              <Avatar nombre={autor?.nombre ?? '—'} color={autor?.color ?? 'var(--color-avatar-empty)'} size={22} />
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-baseline gap-2">
                  <span className="text-[12px] font-bold">{autor?.nombre ?? t('paraMi.alguien')}</span>
                  {c.created_at && (
                    <span className="text-[10px] font-mono text-faint">
                      {fmtFechaHora(c.created_at)}
                    </span>
                  )}
                </div>
                <span className="text-[12.5px] leading-[1.5] text-ink-soft">{c.texto}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Botón discreto para transicionar el estado de un módulo.
function AccionModulo({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-line bg-surface px-2 py-[3px] text-[11px] font-semibold text-muted transition-colors hover:bg-hover hover:text-ink"
    >
      {children}
    </button>
  )
}
