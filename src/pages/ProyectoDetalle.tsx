import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Tables } from '../lib/database.types.ts'
import { estadoVM, fmtFecha, ESTADOS } from '../lib/ui.ts'
import { useProyectos, useActualizarProyecto } from '../data/proyectos.ts'
import { useModulos, useCrearModulo, useActualizarModulo } from '../data/modulos.ts'
import {
  useTareas,
  useCrearTarea,
  useActualizarTarea,
  useTareasPorProyecto,
  useCorreccionesCliente,
} from '../data/tareas.ts'
import { usePersonas } from '../data/personas.ts'
import { useReuniones } from '../data/reuniones.ts'
import { useClientePorProyecto, useCrearCliente, useActualizarCliente } from '../data/clientes.ts'
import { useComentariosModulo } from '../data/comentarios.ts'
import { useRealtimeProyecto } from '../data/realtime.ts'
import { Avatar, AvatarStack, EstadoChip } from '../components/ui.tsx'
import TareaPanel from '../components/TareaPanel.tsx'

type Modulo = Tables<'modulos'>
type Persona = Tables<'personas'>
type EstadoModulo = Modulo['estado']

// Chip de estado del módulo: gris=abierto, azul=en revisión, verde=cerrado.
function moduloEstadoVM(estado: EstadoModulo): { label: string; bg: string; fg: string } {
  switch (estado) {
    case 'cerrado':
      return { label: 'Cerrado', bg: '#e7efe9', fg: '#477155' }
    case 'en_revision':
      return { label: 'En revisión', bg: '#e8eef6', fg: '#43618f' }
    default:
      return { label: 'Abierto', bg: '#f0ede7', fg: '#8a8276' }
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
        if (!typing) setSel(null)
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
  }, [])

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
  // Avance del proyecto = módulos cerrados / total de módulos.
  const mods = modulos ?? []
  const modsCerrados = mods.filter((m) => m.estado === 'cerrado').length
  const pct = mods.length > 0 ? Math.round((modsCerrados / mods.length) * 100) : 0
  const miembros = [...new Set(tasks.map((t) => t.responsable_id).filter((x): x is string => Boolean(x)))]
    .map((pid) => personaPorId.get(pid))
    .filter((x): x is Persona => Boolean(x))

  return (
    <div ref={rootRef} className="flex">
      <div className="h-screen flex-1 overflow-auto">
        <div className="mx-auto max-w-[960px] px-11 pb-20 pt-[34px]">
          <button
            type="button"
            onClick={() => navigate('/proyectos')}
            className="mb-[18px] flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 3L5 8l5 5" />
            </svg>
            Proyectos
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
              <button
                type="button"
                onClick={() => navigate(`/proyectos/${id}/sprint`)}
                className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] font-semibold text-[#4a463f] transition-colors hover:bg-hover"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 8h12M8 2v12" />
                </svg>
                Sprint
              </button>
              <AvatarStack personas={miembros.map((m) => ({ nombre: m.nombre, color: m.color }))} size={30} />
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
              <Metrica valor={curso} label="en curso" color="#43618f" />
              <Metrica valor={hechas} label="hechas" color="#477155" />
            </div>
          </div>

          <DefinicionSeccion proyecto={proyecto} />

          <CorreccionesClienteSeccion proyectoId={id} personaPorId={personaPorId} />

          {(modulos ?? []).map((m) => (
            <ModuloSeccion
              key={m.id}
              modulo={m}
              personaPorId={personaPorId}
              seleccionado={sel?.taskId ?? null}
              onAbrir={(taskId) =>
                setSel({ taskId, moduloId: m.id, moduloNombre: m.nombre })
              }
            />
          ))}
          <div className="flex items-center gap-[11px] px-0.5 py-1">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#bcb5a8" strokeWidth="1.8" strokeLinecap="round" className="flex-none">
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
        </div>
      </div>

      {sel && (
        <TareaPanel
          taskId={sel.taskId}
          moduloId={sel.moduloId}
          moduloNombre={sel.moduloNombre}
          proyecto={proyecto}
          onClose={() => setSel(null)}
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
                  style={{ background: '#f9ecdc', color: '#a96a23' }}
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
                <Avatar nombre={resp?.nombre ?? '—'} color={resp?.color ?? '#c4bdb1'} size={26} />
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
  personaPorId,
  seleccionado,
  onAbrir,
}: {
  modulo: Modulo
  personaPorId: Map<string, Persona>
  seleccionado: string | null
  onAbrir: (taskId: string) => void
}) {
  const { data: tareas } = useTareas(modulo.id)
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
    actualizarModulo.mutate({ id: modulo.id, proyectoId: modulo.proyecto_id, cambios: { estado } })
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
              className="rounded-md border border-[#cfd9e8] bg-[#eef2f8] px-2 py-[3px] text-[11px] font-semibold text-[#43618f] transition-colors hover:bg-[#e4ebf4]"
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
          const fecha = fmtFecha(t.fecha)
          return (
            <button
              key={t.id}
              type="button"
              data-taskrow
              onClick={() => onAbrir(t.id)}
              className="flex w-full items-center gap-3 border-b border-line-soft px-4 py-[11px] text-left transition-colors hover:bg-row-hover focus:bg-row-hover focus:outline-none"
              style={{ background: seleccionado === t.id ? '#f7f2ec' : undefined }}
            >
              <span className="h-[9px] w-[9px] flex-none rounded-full" style={{ background: vm.dot }} />
              <span
                className="min-w-0 flex-1 truncate text-sm font-medium"
                style={{ color: vm.done ? '#a39d92' : '#1c1b19' }}
              >
                {t.titulo}
              </span>
              {t.tipo === 'correccion' && (
                <span
                  className="flex-none rounded-md px-[7px] py-[2px] text-[10.5px] font-bold uppercase tracking-[0.03em]"
                  style={{ background: '#f9ecdc', color: '#a96a23' }}
                >
                  Corrección
                </span>
              )}
              {fecha && <span className="flex-none font-mono text-[11.5px] text-muted">{fecha}</span>}
              {resp ? (
                <Avatar nombre={resp.nombre} color={resp.color} size={26} />
              ) : (
                <Avatar nombre="—" color="#c4bdb1" size={26} />
              )}
              <EstadoChip estado={t.estado} onClick={() => ciclarEstado(t.id, t.estado)} />
            </button>
          )
        })}

        <div className="flex items-center gap-[11px] px-4 py-2.5">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#bcb5a8" strokeWidth="1.8" strokeLinecap="round" className="flex-none">
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
    <div className="mb-2.5 rounded-[11px] border border-[#e7e3db] bg-[#faf7f2] px-3.5 py-2.5">
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
              <Avatar nombre={autor?.nombre ?? '—'} color={autor?.color ?? '#c4bdb1'} size={22} />
              <div className="min-w-0 flex-1">
                <span className="mr-1.5 text-[12px] font-bold">{autor?.nombre ?? 'Alguien'}</span>
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
