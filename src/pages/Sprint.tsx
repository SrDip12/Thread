import { useState, type KeyboardEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Tables } from '../lib/database.types.ts'
import { estadoVM, ESTADOS } from '../lib/ui.ts'
import { useProyectos } from '../data/proyectos.ts'
import { useModulos } from '../data/modulos.ts'
import { useRealtimeProyecto } from '../data/realtime.ts'
import {
  useSprints,
  useSprintActivo,
  useCrearSprint,
  useActualizarSprint,
} from '../data/sprints.ts'
import { usePulsos, useCrearPulso, useActualizarPulso } from '../data/pulsos.ts'
import {
  useTareasSprint,
  useTareasBacklog,
  useCrearTarea,
  useActualizarTarea,
  type TareaConModulo,
} from '../data/tareas.ts'
import { usePersonas } from '../data/personas.ts'
import { useAuth } from '../auth/AuthProvider.tsx'
import { Avatar, EstadoChip, InlineEdit, EmptyState } from '../components/ui.tsx'

type Sprint = Tables<'sprints'>
type Persona = Tables<'personas'>

// Fecha ISO 'YYYY-MM-DD' a N días de hoy (0 = hoy).
function fechaISO(diasOffset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + diasOffset)
  return d.toISOString().slice(0, 10)
}

export default function Sprint() {
  const { id = '' } = useParams()
  const { data: proyectos } = useProyectos()
  const { data: sprintActivo } = useSprintActivo(id)
  const { data: modulosProyecto } = useModulos(id)

  useRealtimeProyecto(id, (modulosProyecto ?? []).map((m) => m.id))

  const proyecto = (proyectos ?? []).find((p) => p.id === id)
  const acento = proyecto?.color ?? '#8a8276'

  return (
    <div className="h-screen overflow-auto bg-canvas">
      <div className="mx-auto max-w-[960px] px-11 pb-20 pt-[34px]">
        <Link
          to={`/proyectos/${id}`}
          className="mb-[18px] inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 3L5 8l5 5" />
          </svg>
          {proyecto?.nombre ?? 'Proyecto'}
        </Link>

        <div className="mb-7 flex items-center gap-[11px]">
          <span className="h-3.5 w-3.5 flex-none rounded" style={{ background: acento }} />
          <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.025em]">Sprint</h1>
        </div>

        {sprintActivo ? (
          <SprintActivo sprint={sprintActivo} proyectoId={id} acento={acento} />
        ) : (
          <CrearSprintRapido proyectoId={id} />
        )}
      </div>
    </div>
  )
}

// ── Crear sprint rápido (sin sprint activo) ─────────────────────────────
function CrearSprintRapido({ proyectoId }: { proyectoId: string }) {
  const { data: sprints } = useSprints(proyectoId)
  const crear = useCrearSprint()
  const [inicio, setInicio] = useState(fechaISO(0))
  const [fin, setFin] = useState(fechaISO(14))
  const [objetivo, setObjetivo] = useState('')

  const nombre = `Sprint ${(sprints?.length ?? 0) + 1}`

  const crearSprint = () => {
    crear.mutate({
      proyecto_id: proyectoId,
      nombre,
      objetivo: objetivo.trim() || null,
      fecha_inicio: inicio || null,
      fecha_fin: fin || null,
      estado: 'activo',
    })
    setObjetivo('')
  }

  const onEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') crearSprint()
  }

  return (
    <div className="rounded-[13px] border border-line bg-surface p-6">
      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.04em] text-faint">
        Crear sprint rápido
      </div>
      <div className="mb-5 text-[22px] font-extrabold tracking-[-0.02em]">{nombre}</div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-[13px] text-muted">
          Inicio
          <input
            type="date"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            className="rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-brand"
          />
        </label>
        <label className="flex items-center gap-2 text-[13px] text-muted">
          Fin
          <input
            type="date"
            value={fin}
            onChange={(e) => setFin(e.target.value)}
            className="rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-brand"
          />
        </label>
      </div>

      <div className="flex items-center gap-2.5 rounded-lg border border-line bg-canvas px-3.5 py-2.5">
        <input
          value={objetivo}
          onChange={(e) => setObjetivo(e.target.value)}
          onKeyDown={onEnter}
          aria-label="Objetivo del sprint"
          placeholder="Objetivo del sprint…"
          className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint"
        />
        <button
          type="button"
          onClick={crearSprint}
          className="flex-none rounded-lg bg-brand px-3.5 py-1.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          Crear
        </button>
      </div>
    </div>
  )
}

// ── Sprint activo ───────────────────────────────────────────────────────
function SprintActivo({
  sprint,
  proyectoId,
  acento,
}: {
  sprint: Sprint
  proyectoId: string
  acento: string
}) {
  const { data: personas } = usePersonas()
  const actualizarSprint = useActualizarSprint()
  const personaPorId = new Map((personas ?? []).map((p) => [p.id, p]))

  const guardarFecha = (campo: 'fecha_inicio' | 'fecha_fin', valor: string) => {
    actualizarSprint.mutate({
      id: sprint.id,
      proyectoId,
      cambios: { [campo]: valor || null },
    })
  }

  return (
    <div className="flex flex-col gap-[30px]">
      {/* Cabecera del sprint */}
      <div className="rounded-[13px] border border-line bg-surface p-5">
        <div className="mb-1.5 flex items-center gap-2.5">
          <h2 className="m-0 text-[19px] font-extrabold tracking-[-0.02em]">{sprint.nombre}</h2>
          <span
            className="rounded-md px-2 py-0.5 text-[11px] font-semibold"
            style={{ background: '#e8eef6', color: '#43618f' }}
          >
            Activo
          </span>
        </div>

        <InlineEdit
          value={sprint.objetivo ?? ''}
          onSave={(v) =>
            actualizarSprint.mutate({ id: sprint.id, proyectoId, cambios: { objetivo: v || null } })
          }
          placeholder="Objetivo del sprint…"
          viewClassName="mb-3 text-sm text-muted-soft"
          editClassName="mb-3 w-full bg-transparent text-sm text-ink outline-none"
        />

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-[12.5px] text-muted">
            Inicio
            <input
              type="date"
              value={sprint.fecha_inicio ?? ''}
              onChange={(e) => guardarFecha('fecha_inicio', e.target.value)}
              className="rounded-lg border border-line bg-canvas px-2.5 py-1 text-[12.5px] text-ink outline-none focus:border-brand"
            />
          </label>
          <label className="flex items-center gap-2 text-[12.5px] text-muted">
            Fin
            <input
              type="date"
              value={sprint.fecha_fin ?? ''}
              onChange={(e) => guardarFecha('fecha_fin', e.target.value)}
              className="rounded-lg border border-line bg-canvas px-2.5 py-1 text-[12.5px] text-ink outline-none focus:border-brand"
            />
          </label>
        </div>
      </div>

      <TareasSprint sprint={sprint} proyectoId={proyectoId} personaPorId={personaPorId} />
      <Backlog sprint={sprint} proyectoId={proyectoId} personaPorId={personaPorId} />
      <PulsoEquipo sprint={sprint} personaPorId={personaPorId} />
      <CierreSprint sprint={sprint} proyectoId={proyectoId} acento={acento} />
    </div>
  )
}

// ── Fila compacta de tarea ──────────────────────────────────────────────
function FilaTarea({
  tarea,
  persona,
  onCiclar,
}: {
  tarea: TareaConModulo
  persona: Persona | undefined
  onCiclar: () => void
}) {
  const vm = estadoVM(tarea.estado)
  return (
    <div className="flex items-center gap-3 border-b border-line-soft px-4 py-[11px] last:border-b-0">
      <span className="h-[9px] w-[9px] flex-none rounded-full" style={{ background: vm.dot }} />
      <span
        className="min-w-0 flex-1 truncate text-sm font-medium"
        style={{ color: vm.done ? '#a39d92' : '#1c1b19' }}
      >
        {tarea.titulo}
      </span>
      {tarea.modulos?.nombre && (
        <span className="flex-none rounded bg-track px-2 py-0.5 text-[11px] font-medium text-muted">
          {tarea.modulos.nombre}
        </span>
      )}
      {persona ? (
        <Avatar nombre={persona.nombre} color={persona.color} size={26} />
      ) : (
        <Avatar nombre="—" color="#c4bdb1" size={26} />
      )}
      <EstadoChip estado={tarea.estado} onClick={onCiclar} />
    </div>
  )
}

function TareasSprint({
  sprint,
  proyectoId,
  personaPorId,
}: {
  sprint: Sprint
  proyectoId: string
  personaPorId: Map<string, Persona>
}) {
  const { data: tareas } = useTareasSprint(sprint.id)
  const { data: modulos } = useModulos(proyectoId)
  const crear = useCrearTarea()
  const actualizar = useActualizarTarea()
  const [titulo, setTitulo] = useState('')
  const [moduloId, setModuloId] = useState('')

  const lista = tareas ?? []
  const mods = modulos ?? []
  const hechas = lista.filter((t) => t.estado === 'hecho').length
  const moduloElegido = moduloId || mods[0]?.id || ''

  const ciclar = (t: TareaConModulo) => {
    const siguiente = ESTADOS[(ESTADOS.indexOf(t.estado) + 1) % ESTADOS.length]
    actualizar.mutate({ id: t.id, moduloId: t.modulo_id, cambios: { estado: siguiente } })
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
      <SeccionTitulo titulo="Tareas del sprint" extra={`${hechas}/${lista.length}`} />
      <div className="overflow-hidden rounded-[13px] border border-line bg-surface">
        {lista.map((t) => (
          <FilaTarea
            key={t.id}
            tarea={t}
            persona={t.responsable_id ? personaPorId.get(t.responsable_id) : undefined}
            onCiclar={() => ciclar(t)}
          />
        ))}

        <div className="flex items-center gap-2.5 border-t border-line-soft px-4 py-2.5">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#bcb5a8" strokeWidth="1.8" strokeLinecap="round" className="flex-none" aria-hidden="true">
            <path d="M8 3.5v9M3.5 8h9" />
          </svg>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onKeyDown={agregar}
            disabled={mods.length === 0}
            aria-label="Agregar tarea al sprint"
            placeholder={mods.length === 0 ? 'Creá un módulo primero' : 'Agregar tarea al sprint…'}
            className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint disabled:cursor-not-allowed"
          />
          {mods.length > 0 && (
            <select
              value={moduloElegido}
              onChange={(e) => setModuloId(e.target.value)}
              aria-label="Módulo de la tarea"
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
      </div>
    </section>
  )
}

function Backlog({
  sprint,
  proyectoId,
  personaPorId,
}: {
  sprint: Sprint
  proyectoId: string
  personaPorId: Map<string, Persona>
}) {
  const { data: tareas } = useTareasBacklog(proyectoId)
  const actualizar = useActualizarTarea()
  const lista = tareas ?? []

  const alSprint = (t: TareaConModulo) => {
    actualizar.mutate({ id: t.id, moduloId: t.modulo_id, cambios: { sprint_id: sprint.id } })
  }

  return (
    <section>
      <SeccionTitulo titulo="Backlog" extra={`${lista.length}`} />
      {lista.length === 0 ? (
        <EmptyState
          icon={
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 4.5h10M3 8h10M3 11.5h6" />
            </svg>
          }
          titulo="Backlog vacío"
          descripcion="Las tareas sin sprint aparecen acá, listas para sumar al sprint activo."
        />
      ) : (
        <div className="overflow-hidden rounded-[13px] border border-line bg-surface">
          {lista.map((t) => {
            const vm = estadoVM(t.estado)
            const resp = t.responsable_id ? personaPorId.get(t.responsable_id) : undefined
            return (
              <div
                key={t.id}
                className="flex items-center gap-3 border-b border-line-soft px-4 py-[11px] last:border-b-0"
              >
                <span className="h-[9px] w-[9px] flex-none rounded-full" style={{ background: vm.dot }} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{t.titulo}</span>
                {t.modulos?.nombre && (
                  <span className="flex-none rounded bg-track px-2 py-0.5 text-[11px] font-medium text-muted">
                    {t.modulos.nombre}
                  </span>
                )}
                {resp && <Avatar nombre={resp.nombre} color={resp.color} size={26} />}
                <button
                  type="button"
                  onClick={() => alSprint(t)}
                  className="flex-none rounded-lg border border-line px-2.5 py-1 text-[12px] font-semibold text-muted transition-colors hover:border-brand hover:text-brand"
                >
                  + Al sprint
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
  const { persona } = useAuth()
  const { data: pulsos } = usePulsos(sprint.id)
  const crear = useCrearPulso()
  const actualizar = useActualizarPulso()
  const [texto, setTexto] = useState('')

  const lista = pulsos ?? []
  const miPulso = persona ? lista.find((p) => p.persona_id === persona.id) : undefined

  const enviar = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !persona) return
    const t = texto.trim()
    if (!t) return
    if (miPulso) {
      actualizar.mutate({ id: miPulso.id, sprintId: sprint.id, cambios: { texto: t } })
    } else {
      crear.mutate({ sprint_id: sprint.id, persona_id: persona.id, texto: t })
    }
    setTexto('')
  }

  return (
    <section>
      <SeccionTitulo titulo="Pulso del equipo" />
      <div className="overflow-hidden rounded-[13px] border border-line bg-surface">
        {lista.length === 0 ? (
          <div className="px-4 py-4 text-center text-[13px] text-faint">
            Todavía no hay pulsos · contá tu avance o bloqueo.
          </div>
        ) : (
          lista.map((p) => {
            const autor = personaPorId.get(p.persona_id)
            return (
              <div key={p.id} className="flex items-start gap-3 border-b border-line-soft px-4 py-[11px] last:border-b-0">
                <Avatar nombre={autor?.nombre ?? '—'} color={autor?.color ?? '#c4bdb1'} size={26} />
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-semibold text-ink">{autor?.nombre ?? 'Alguien'}</div>
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
              aria-label="Tu pulso del sprint"
              placeholder={miPulso ? 'Actualizá tu pulso…' : 'Tu pulso (avance o bloqueo)…'}
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
  const actualizarSprint = useActualizarSprint()
  const actualizarTarea = useActualizarTarea()
  const { data: tareas } = useTareasSprint(sprint.id)

  const guardar = (campo: 'cierre_logros' | 'cierre_pegados' | 'cierre_cambio', valor: string) => {
    actualizarSprint.mutate({ id: sprint.id, proyectoId, cambios: { [campo]: valor || null } })
  }

  const cerrar = () => {
    if (!window.confirm('¿Cerrar el sprint? Las tareas sin terminar volverán al backlog.')) return
    actualizarSprint.mutate({ id: sprint.id, proyectoId, cambios: { estado: 'cerrado' } })
    for (const t of tareas ?? []) {
      if (t.estado !== 'hecho') {
        actualizarTarea.mutate({ id: t.id, moduloId: t.modulo_id, cambios: { sprint_id: null } })
      }
    }
  }

  return (
    <section>
      <SeccionTitulo titulo="Cierre del sprint" />
      <div className="flex flex-col gap-3 rounded-[13px] border border-line bg-surface p-5">
        <CampoCierre
          etiqueta="Logros"
          valor={sprint.cierre_logros ?? ''}
          onGuardar={(v) => guardar('cierre_logros', v)}
        />
        <CampoCierre
          etiqueta="Pegados"
          valor={sprint.cierre_pegados ?? ''}
          onGuardar={(v) => guardar('cierre_pegados', v)}
        />
        <CampoCierre
          etiqueta="Cambio"
          valor={sprint.cierre_cambio ?? ''}
          onGuardar={(v) => guardar('cierre_cambio', v)}
        />
        <div className="pt-1">
          <button
            type="button"
            onClick={cerrar}
            className="rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: acento }}
          >
            Cerrar sprint
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
