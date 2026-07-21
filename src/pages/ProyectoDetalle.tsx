import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { Tables, TablesUpdate } from '../lib/database.types.ts'
import { estadoVM, fmtFecha, ESTADOS, fmtFechaHora, diasHasta } from '../lib/ui.ts'
import { etiquetaOrigen, origenValido } from '../lib/navegacion.ts'
import { useProyectos, useActualizarProyecto, useEliminarProyecto } from '../data/proyectos.ts'
import { useModulos, useCrearModulo, useActualizarModulo } from '../data/modulos.ts'
import {
  useCrearTarea,
  useActualizarTarea,
  useTareasPorProyecto,
  useCorreccionesCliente,
  useProyectoDependencias,
} from '../data/tareas.ts'
import { usePersonas } from '../data/personas.ts'
import { useMiembros, useAgregarMiembro, useQuitarMiembro } from '../data/miembros.ts'
import { useReuniones } from '../data/reuniones.ts'
import { useClientePorProyecto, useCrearCliente, useActualizarCliente } from '../data/clientes.ts'
import { useComentariosModulo } from '../data/comentarios.ts'
import { useRealtimeProyecto } from '../data/realtime.ts'
import { Avatar, AvatarStack, EstadoChip, FechaTag } from '../components/ui.tsx'
import TareaPanel from '../components/TareaPanel.tsx'
import KanbanBoard from '../components/KanbanBoard.tsx'

type Modulo = Tables<'modulos'>
type Persona = Tables<'personas'>
type EstadoModulo = Modulo['estado']

// Chip de estado del módulo: gris=abierto, azul=en revisión, verde=cerrado.
function moduloEstadoVM(estado: EstadoModulo): { label: string; bg: string; fg: string } {
  switch (estado) {
    case 'cerrado':
      return { label: 'Cerrado', bg: 'var(--color-ok-tint)', fg: 'var(--color-ok)' }
    case 'en_revision':
      return { label: 'En revisión', bg: 'var(--color-info-tint)', fg: 'var(--color-info)' }
    default:
      return { label: 'Abierto', bg: 'var(--color-neutral-tint)', fg: 'var(--color-neutral)' }
  }
}

interface Seleccion {
  taskId: string
  moduloId: string
  moduloNombre: string
}

export default function ProyectoDetalle() {
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
      const t = tareasProyecto.find((x) => x.id === tareaIdParam)
      if (t) {
        const m = modulos.find((x) => x.id === t.modulo_id)
        setSel({
          taskId: t.id,
          moduloId: t.modulo_id,
          moduloNombre: m ? m.nombre : 'Módulo',
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
    return <div className="p-11 text-sm text-muted">Proyecto no encontrado.</div>
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
      <div className="h-screen flex-1 overflow-auto">
        <div className="mx-auto max-w-[960px] px-11 pb-20 pt-[34px]">
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

          <div className="mb-6 flex items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="mb-[5px] flex items-center gap-[11px]">
                <span className="h-3.5 w-3.5 flex-none rounded" style={{ background: proyecto.color }} />
                <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.025em]">{proyecto.nombre}</h1>
              </div>
              <div className="pl-[25px] text-sm text-muted-soft">{proyecto.descripcion ?? ''}</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex rounded-lg border border-line bg-surface p-0.5 mr-1">
                <button
                  type="button"
                  onClick={() => cambiarVista('lista')}
                  className={`rounded-[6px] px-2.5 py-1 text-xs font-bold transition-colors ${
                    vista === 'lista' ? 'bg-hover text-ink' : 'text-muted hover:text-ink'
                  }`}
                >
                  Lista
                </button>
                <button
                  type="button"
                  onClick={() => cambiarVista('kanban')}
                  className={`rounded-[6px] px-2.5 py-1 text-xs font-bold transition-colors ${
                    vista === 'kanban' ? 'bg-hover text-ink' : 'text-muted hover:text-ink'
                  }`}
                >
                  Tablero
                </button>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/proyectos/${id}/gantt`)}
                className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink-soft transition-colors hover:bg-hover"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 4h7M2 8h11M2 12h5" />
                </svg>
                Gantt
              </button>
              <button
                type="button"
                onClick={() => navigate(`/proyectos/${id}/sprint`)}
                className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink-soft transition-colors hover:bg-hover"
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

          <div className="mb-[30px] flex items-center gap-[22px] rounded-[13px] border border-line bg-surface px-5 py-[15px]">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12.5px] font-semibold text-muted-soft">
                  Avance del proyecto · módulos cerrados
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
              <Metrica valor={total} label="tareas" />
              <Metrica valor={curso} label="en curso" color="var(--color-info)" />
              <Metrica valor={hechas} label="hechas" color="var(--color-ok)" />
              {vencidasProy > 0 && <Metrica valor={vencidasProy} label="vencidas" color="var(--color-danger)" />}
            </div>
          </div>

          <DefinicionSeccion proyecto={proyecto} />

          <CorreccionesClienteSeccion proyectoId={id} personaPorId={personaPorId} />

          {vista === 'kanban' ? (
            <div className="flex flex-col gap-4">
              {/* Filtro por Módulo */}
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-muted">
                  Filtrar por Módulo
                  <select
                    value={moduloFiltro}
                    onChange={(e) => setModuloFiltro(e.target.value)}
                    className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand"
                  >
                    <option value="todos">Todos los módulos</option>
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
                  const t = (tareasProyecto ?? []).find((x) => x.id === taskId)
                  if (t) {
                    const m = (modulos ?? []).find((x) => x.id === t.modulo_id)
                    setSel({
                      taskId: t.id,
                      moduloId: t.modulo_id,
                      moduloNombre: m ? m.nombre : 'Módulo',
                    })
                  }
                }}
                onMoverTarea={(taskId, nuevoEstado) => {
                  const t = (tareasProyecto ?? []).find((x) => x.id === taskId)
                  if (t) {
                    actualizar.mutate({
                      id: taskId,
                      moduloId: t.modulo_id,
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
                  placeholder="Agregar módulo…"
                  className="flex-1 bg-transparent text-[13px] font-semibold uppercase tracking-[0.02em] text-label outline-none placeholder:text-faint placeholder:normal-case placeholder:font-normal placeholder:tracking-normal"
                />
                {nuevoModulo.trim() && (
                  <span className="flex-none font-mono text-[11px] text-faint">Enter ↵</span>
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

// Borrar proyecto con confirmación inline (el delete cascada borra módulos/tareas).
function EliminarProyecto({ proyectoId, nombre }: { proyectoId: string; nombre: string }) {
  const navigate = useNavigate()
  const eliminar = useEliminarProyecto()
  const [confirmando, setConfirmando] = useState(false)

  if (confirmando) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[var(--color-danger-line)] bg-[var(--color-danger-tint)] px-2.5 py-1.5">
        <span className="text-[12px] font-semibold text-brand-strong">¿Eliminar «{nombre}»?</span>
        <button
          type="button"
          onClick={() => {
            eliminar.mutate(proyectoId)
            navigate('/proyectos')
          }}
          className="rounded-md bg-brand px-2 py-[3px] text-[11px] font-bold text-on-brand transition-opacity hover:opacity-90"
        >
          Sí, eliminar
        </button>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="text-[11px] font-semibold text-muted transition-colors hover:text-ink"
        >
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirmando(true)}
      title="Eliminar proyecto"
      aria-label="Eliminar proyecto"
      className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-lg border border-line bg-surface text-muted transition-colors hover:border-[var(--color-danger-line)] hover:bg-[var(--color-danger-tint)] hover:text-brand"
    >
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 4.5h10M6.5 4V2.8h3V4M5 4.5l.5 8.5h5l.5-8.5M6.7 6.5v5M9.3 6.5v5" />
      </svg>
    </button>
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

// Equipo del proyecto: AvatarStack que abre un popover para sumar/quitar miembros
// (tabla proyecto_personas). Las personas disponibles salen del equipo global.
function EquipoProyecto({ proyectoId, personas }: { proyectoId: string; personas: Persona[] }) {
  const { data: miembros } = useMiembros(proyectoId)
  const agregar = useAgregarMiembro()
  const quitar = useQuitarMiembro()
  const [abierto, setAbierto] = useState(false)
  const lista = miembros ?? []
  const ids = new Set(lista.map((m) => m.id))
  const disponibles = personas.filter((p) => !ids.has(p.id))

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        title="Equipo del proyecto"
        className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1 transition-colors hover:bg-hover"
      >
        {lista.length > 0 ? (
          <AvatarStack personas={lista.map((m) => ({ nombre: m.nombre, color: m.color }))} size={28} />
        ) : (
          <span className="px-1 text-[13px] font-semibold text-muted">+ Equipo</span>
        )}
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setAbierto(false)} />
          <div className="absolute right-0 top-[calc(100%+6px)] z-40 w-64 rounded-[12px] border border-line bg-surface p-3 shadow-[var(--shadow-pop)]">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.04em] text-faint">
              Equipo · {lista.length}
            </div>
            <div className="mb-2 flex flex-col gap-1">
              {lista.length === 0 && (
                <p className="px-1 py-1 text-[12.5px] text-faint">Nadie todavía.</p>
              )}
              {lista.map((m) => (
                <div key={m.id} className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-hover">
                  <Avatar nombre={m.nombre} color={m.color} size={22} />
                  <span className="flex-1 truncate text-[13px]">{m.nombre}</span>
                  <button
                    type="button"
                    onClick={() => quitar.mutate({ proyectoId, personaId: m.id })}
                    aria-label={`Quitar a ${m.nombre}`}
                    className="flex h-5 w-5 items-center justify-center rounded text-muted transition-colors hover:bg-[var(--color-danger-tint)] hover:text-[var(--color-danger)]"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M4 4l8 8M12 4l-8 8" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            {disponibles.length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  const p = disponibles.find((d) => d.id === e.target.value)
                  if (p) agregar.mutate({ proyectoId, persona: p })
                }}
                className="w-full rounded-lg border border-line bg-canvas px-2 py-1.5 text-[13px] outline-none focus:border-brand"
              >
                <option value="">+ Sumar persona…</option>
                {disponibles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// Definición de producto: el norte del proyecto. Autoguardado con debounce.
function DefinicionSeccion({ proyecto }: { proyecto: Tables<'proyectos'> }) {
  const actualizar = useActualizarProyecto()
  const [campos, setCampos] = useState({
    que_es: proyecto.que_es ?? '',
    para_quien: proyecto.para_quien ?? '',
    problema: proyecto.problema ?? '',
  })
  const [guardado, setGuardado] = useState<'idle' | 'guardando' | 'ok'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onChange = (campo: keyof typeof campos, valor: string) => {
    setCampos((c) => ({ ...c, [campo]: valor }))
    setGuardado('guardando')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      actualizar.mutate(
        { id: proyecto.id, cambios: { [campo]: valor.trim() || null } },
        { onSuccess: () => setGuardado('ok') },
      )
    }, 600)
  }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const fila = (
    campo: keyof typeof campos,
    label: string,
    placeholder: string,
  ) => (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.04em] text-label">{label}</span>
      <textarea
        value={campos[campo]}
        onChange={(e) => onChange(campo, e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full resize-y rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-brand"
      />
    </label>
  )

  return (
    <div className="mb-[30px]">
      <div className="mb-[9px] flex items-center gap-2.5 px-0.5">
        <h2 className="m-0 text-[13px] font-bold uppercase tracking-[0.02em] text-label">Definición</h2>
        <span className="font-mono text-[11.5px] text-faint">
          {guardado === 'guardando' ? 'guardando…' : guardado === 'ok' ? 'guardado' : 'el norte del proyecto'}
        </span>
        <div className="h-px flex-1 bg-line" />
      </div>
      <div className="space-y-3 rounded-[13px] border border-line bg-surface px-5 py-[18px]">
        {fila('que_es', 'Qué es', '¿Qué es este producto, en una frase?')}
        {fila('para_quien', 'Para quién', '¿Quién lo usa? ¿Para quién resuelve algo?')}
        {fila('problema', 'Problema', '¿Qué problema resuelve?')}
      </div>
    </div>
  )
}

// Compuerta externa con el cliente: correcciones abiertas + último cierre con cliente.
function CorreccionesClienteSeccion({
  proyectoId,
  personaPorId,
}: {
  proyectoId: string
  personaPorId: Map<string, Persona>
}) {
  const { data: correcciones } = useCorreccionesCliente(proyectoId)
  const { data: reuniones } = useReuniones(proyectoId)
  const { data: cliente } = useClientePorProyecto(proyectoId)

  const lista = correcciones ?? []
  // Última reunión de tipo 'cliente' (las reuniones vienen de la más nueva a la más vieja).
  const ultimoCierre = (reuniones ?? []).find((r) => r.tipo === 'cliente') ?? null
  const fechaCierre = ultimoCierre ? fmtFecha(ultimoCierre.fecha.slice(0, 10)) : null

  return (
    <div className="mb-[30px]">
      <div className="mb-[9px] flex items-center gap-2.5 px-0.5">
        <h2 className="m-0 text-[13px] font-bold uppercase tracking-[0.02em] text-label">
          Correcciones del cliente
        </h2>
        <span className="font-mono text-[11.5px] text-faint">
          {fechaCierre
            ? `último cierre con cliente: ${fechaCierre}`
            : 'sin cierres con cliente todavía'}
        </span>
        <div className="h-px flex-1 bg-line" />
      </div>

      <ClienteEditor proyectoId={proyectoId} cliente={cliente ?? null} />

      {lista.length === 0 ? (
        <div className="rounded-[13px] border border-dashed border-line px-4 py-3.5 text-center text-[12.5px] text-faint">
          Sin correcciones de cliente abiertas.
        </div>
      ) : (
        <div className="overflow-hidden rounded-[13px] border border-line bg-surface">
          {lista.map((t) => {
            const vm = estadoVM(t.estado)
            const resp = t.responsable_id ? personaPorId.get(t.responsable_id) : undefined
            return (
              <div
                key={t.id}
                className="flex items-center gap-3 border-b border-line-soft px-4 py-[11px]"
              >
                <span className="h-[9px] w-[9px] flex-none rounded-full" style={{ background: vm.dot }} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{t.titulo}</span>
                <span
                  className="flex-none rounded-md px-[7px] py-[2px] text-[10.5px] font-bold uppercase tracking-[0.03em]"
                  style={{ background: 'var(--color-warn-tint)', color: 'var(--color-warn)' }}
                >
                  Corrección
                </span>
                {t.modulos?.nombre && (
                  <span className="flex-none text-[11.5px] text-muted-soft">{t.modulos.nombre}</span>
                )}
                <span
                  className="flex-none rounded-md px-2 py-[2px] text-[11px] font-semibold"
                  style={{ background: vm.bg, color: vm.fg }}
                >
                  {vm.label}
                </span>
                <Avatar nombre={resp?.nombre ?? '—'} color={resp?.color ?? 'var(--color-avatar-empty)'} size={26} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Mini editor del cliente del proyecto (nombre/contacto). Autoguardado con debounce.
function ClienteEditor({
  proyectoId,
  cliente,
}: {
  proyectoId: string
  cliente: Tables<'clientes'> | null
}) {
  const crear = useCrearCliente()
  const actualizar = useActualizarCliente()
  const [nombre, setNombre] = useState(cliente?.nombre ?? '')
  const [contacto, setContacto] = useState(cliente?.contacto ?? '')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sincroniza cuando llega/cambia el cliente del servidor.
  useEffect(() => {
    setNombre(cliente?.nombre ?? '')
    setContacto(cliente?.contacto ?? '')
  }, [cliente?.nombre, cliente?.contacto])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const guardar = (nuevoNombre: string, nuevoContacto: string) => {
    const n = nuevoNombre.trim()
    const c = nuevoContacto.trim() || null
    if (cliente) {
      actualizar.mutate({ id: cliente.id, proyectoId, cambios: { nombre: n || cliente.nombre, contacto: c } })
    } else if (n) {
      crear.mutate({ proyecto_id: proyectoId, nombre: n, contacto: c })
    }
  }

  const onChange = (campo: 'nombre' | 'contacto', valor: string) => {
    const sigNombre = campo === 'nombre' ? valor : nombre
    const sigContacto = campo === 'contacto' ? valor : contacto
    if (campo === 'nombre') setNombre(valor)
    else setContacto(valor)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => guardar(sigNombre, sigContacto), 600)
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2.5 rounded-[13px] border border-line bg-surface px-4 py-3">
      <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-label">Cliente</span>
      <input
        value={nombre}
        onChange={(e) => onChange('nombre', e.target.value)}
        placeholder="Nombre del cliente"
        className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-[13px] text-ink outline-none placeholder:text-faint focus:border-brand"
      />
      <input
        value={contacto}
        onChange={(e) => onChange('contacto', e.target.value)}
        placeholder="Contacto (email, teléfono…)"
        className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-[13px] text-ink outline-none placeholder:text-faint focus:border-brand"
      />
    </div>
  )
}

function ModuloSeccion({
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
    const t = titulo.trim()
    if (!t) return
    crear.mutate({ modulo_id: modulo.id, titulo: t })
    setTitulo('')
  }

  return (
    <div className={`mb-[30px] ${cerrado ? 'opacity-60' : ''}`}>
      <div className="mb-[9px] flex items-center gap-2.5 px-0.5">
        <button
          type="button"
          onClick={() => cerrado && setAbiertoManual((v) => !v)}
          className={`m-0 text-[13px] font-bold uppercase tracking-[0.02em] text-label ${
            cerrado ? 'cursor-pointer' : 'cursor-default'
          }`}
          title={cerrado ? (colapsado ? 'Expandir módulo' : 'Colapsar módulo') : undefined}
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
            <AccionModulo onClick={() => cambiarEstado('en_revision')}>Enviar a revisión</AccionModulo>
          )}
          {modulo.estado === 'en_revision' && (
            <Link
              to="/revisiones"
              className="rounded-md border border-[var(--color-info-line)] bg-[var(--color-info-tint)] px-2 py-[3px] text-[11px] font-semibold text-[var(--color-info)] transition-colors hover:bg-[var(--color-info-line)]"
              title="Pendiente del responsable de visión"
            >
              En revisión →
            </Link>
          )}
          {modulo.estado === 'cerrado' && (
            <AccionModulo onClick={() => cambiarEstado('abierto')}>Reabrir</AccionModulo>
          )}
        </div>
      </div>

      {/* Feedback de revisión: visible cuando hay decisión pendiente o tomada. */}
      {(modulo.estado === 'en_revision' || modulo.estado === 'cerrado') && (
        <FeedbackModulo moduloId={modulo.id} personaPorId={personaPorId} />
      )}

      {!colapsado && (
      <div className="overflow-hidden rounded-[13px] border border-line bg-surface">
        {lista.map((t) => {
          const vm = estadoVM(t.estado)
          const resp = t.responsable_id ? personaPorId.get(t.responsable_id) : undefined

          const isBlocked = proyectoDeps
            .filter((d) => d.bloqueada_id === t.id)
            .some((d) => {
              const b = todasLasTareas.find((x) => x.id === d.bloqueadora_id)
              return b ? b.estado !== 'hecho' : false
            })

          return (
            <button
              key={t.id}
              type="button"
              data-taskrow
              onClick={() => onAbrir(t.id)}
              className="flex w-full items-center gap-3 border-b border-line-soft px-4 py-[11px] text-left transition-colors hover:bg-row-hover focus:bg-row-hover focus:outline-none"
              style={{ background: seleccionado === t.id ? 'var(--color-hover)' : undefined }}
            >
              <span className="h-[9px] w-[9px] flex-none rounded-full" style={{ background: vm.dot }} />
              <span
                className="min-w-0 flex-1 truncate text-sm font-medium flex items-center gap-1.5"
                style={{ color: vm.done ? 'var(--color-muted)' : 'var(--color-ink)' }}
              >
                {isBlocked && (
                  <span className="text-brand flex-none" title="Tarea bloqueada por tareas pendientes">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="inline">
                      <rect x="3" y="11" width="10" height="4" rx="1" />
                      <path d="M4 11V6a4 4 0 0 1 8 0v5" />
                    </svg>
                  </span>
                )}
                {t.titulo}
              </span>
              {t.tipo === 'correccion' && (
                <span
                  className="flex-none rounded-md px-[7px] py-[2px] text-[10.5px] font-bold uppercase tracking-[0.03em]"
                  style={{ background: 'var(--color-warn-tint)', color: 'var(--color-warn)' }}
                >
                  Corrección
                </span>
              )}
              <FechaTag fecha={t.fecha} done={vm.done} />
              {resp ? (
                <Avatar nombre={resp.nombre} color={resp.color} size={26} />
              ) : (
                <Avatar nombre="—" color="var(--color-avatar-empty)" size={26} />
              )}
              <EstadoChip estado={t.estado} onClick={() => ciclarEstado(t.id, t.estado)} />
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
            placeholder="Agregar tarea…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
          />
          {titulo.trim() && (
            <span className="flex-none font-mono text-[11px] text-faint">Enter ↵</span>
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
  const { data: comentarios } = useComentariosModulo(moduloId)
  const [expandido, setExpandido] = useState(false)
  const lista = comentarios ?? []
  if (lista.length === 0) return null

  const visibles = expandido ? lista : lista.slice(-1)

  return (
    <div className="mb-2.5 rounded-[11px] border border-line bg-row-hover px-3.5 py-2.5">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-faint">
          Feedback de revisión
        </span>
        {lista.length > 1 && (
          <button
            type="button"
            onClick={() => setExpandido((v) => !v)}
            className="text-[11px] font-semibold text-muted transition-colors hover:text-ink"
          >
            {expandido ? 'ver menos' : `ver los ${lista.length}`}
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
                  <span className="text-[12px] font-bold">{autor?.nombre ?? 'Alguien'}</span>
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
