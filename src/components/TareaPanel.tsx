import { useState } from 'react'
import type { Tables } from '../lib/database.types.ts'
import { ESTADOS, estadoVM, fmtFecha, fmtFechaHora } from '../lib/ui.ts'
import {
  useActualizarTarea,
  useTareas,
  useTareasPorProyecto,
  useDependenciasTarea,
  useCrearDependencia,
  useEliminarDependencia,
} from '../data/tareas.ts'
import {
  useComentarios,
  useCrearComentario,
  useActualizarComentario,
} from '../data/comentarios.ts'
import { usePersonas } from '../data/personas.ts'
import { useAuth } from '../auth/AuthProvider.tsx'
import { Avatar, InlineEdit, Skeleton } from './ui.tsx'

type Tarea = Tables<'tareas'>
type Proyecto = Tables<'proyectos'>

// Chip de tipo: 'tarea' neutro, 'correccion' con acento ámbar de alerta.
function tipoVM(tipo: Tarea['tipo']): { label: string; bg: string; fg: string } {
  return tipo === 'correccion'
    ? { label: 'Corrección', bg: '#f9ecdc', fg: '#a96a23' }
    : { label: 'Tarea', bg: '#f0ede7', fg: '#8a8276' }
}

export default function TareaPanel({
  taskId,
  moduloId,
  moduloNombre,
  proyecto,
  onClose,
}: {
  taskId: string
  moduloId: string
  moduloNombre: string
  proyecto: Proyecto
  onClose: () => void
}) {
  const { persona: yo } = useAuth()
  const { data: personas } = usePersonas()
  const { data: tareas } = useTareas(moduloId)
  const personaPorId = new Map((personas ?? []).map((p) => [p.id, p]))
  const actualizar = useActualizarTarea()

  const tarea = (tareas ?? []).find((t) => t.id === taskId)
  if (!tarea) {
    // La tarea desapareció (borrada o aún cargando tras navegar). Placeholder limpio.
    return (
      <aside
        aria-busy="true"
        aria-label="Cargando tarea"
        className="flex h-screen w-[430px] flex-none flex-col border-l border-line bg-surface"
      >
        <div className="flex items-center justify-between border-b border-line-soft px-[22px] py-4">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-7 w-7 rounded-lg" />
        </div>
        <div className="border-b border-line-soft px-[22px] pb-[18px] pt-[22px]">
          <Skeleton className="mb-[18px] h-6 w-3/4" />
          <div className="flex flex-col gap-[13px]">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-7 w-56" />
            ))}
          </div>
        </div>
        <div className="px-[22px] pt-5">
          <Skeleton className="mb-3 h-3 w-24" />
          <Skeleton className="h-16 w-full rounded-[10px]" />
        </div>
      </aside>
    )
  }

  const setCambios = (cambios: Partial<Tarea>) =>
    actualizar.mutate({ id: tarea.id, moduloId: tarea.modulo_id, cambios })

  const responsable = tarea.responsable_id ? personaPorId.get(tarea.responsable_id) : undefined

  const { data: deps } = useDependenciasTarea(tarea.id)
  const { data: todasLasTareas } = useTareasPorProyecto(proyecto.id)
  const crearDep = useCrearDependencia()
  const elimDep = useEliminarDependencia()

  const dependencias = deps ?? []
  const tareasProyecto = todasLasTareas ?? []
  const tareasMap = new Map(tareasProyecto.map((t) => [t.id, t]))

  // Tareas que bloquean a la actual
  const bloqueadores = dependencias
    .filter((d) => d.bloqueada_id === tarea.id)
    .map((d) => tareasMap.get(d.bloqueadora_id))
    .filter(Boolean) as Tarea[]

  // Tareas que la actual bloquea
  const bloqueados = dependencias
    .filter((d) => d.bloqueadora_id === tarea.id)
    .map((d) => tareasMap.get(d.bloqueada_id))
    .filter(Boolean) as Tarea[]

  // ¿Está la tarea bloqueada por tareas incompletas?
  const blockersIncompletos = bloqueadores.filter((b) => b.estado !== 'hecho')
  const estaBloqueada = blockersIncompletos.length > 0

  return (
    <aside className="flex h-screen w-[430px] flex-none flex-col overflow-auto border-l border-line bg-surface">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line-soft bg-surface px-[22px] py-4">
        <div className="flex items-center gap-2 text-[12.5px] text-muted">
          <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: proyecto.color }} />
          {proyecto.nombre}
          <span className="text-[#d6cfc4]">/</span>
          {moduloNombre}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar panel"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-ink"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      {estaBloqueada && (
        <div className="mx-[22px] mt-4 rounded-lg border border-[#e6c9bf] bg-[#fbeee8] p-3 text-xs text-brand-strong flex-none">
          <div className="flex items-center gap-1.5 font-bold mb-1">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="10" height="4" rx="1" />
              <path d="M4 11V6a4 4 0 0 1 8 0v5" />
            </svg>
            Tarea Bloqueada
          </div>
          Esta tarea no debería empezar hasta completar:
          <ul className="list-disc list-inside mt-1 font-semibold space-y-0.5">
            {blockersIncompletos.map((b) => (
              <li key={b.id}>
                {b.titulo} <span className="font-normal text-muted">({estadoVM(b.estado).label})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-b border-line-soft px-[22px] pb-[18px] pt-[22px]">
        <div className="mb-[18px]">
          <InlineEdit
            value={tarea.titulo}
            onSave={(v) => setCambios({ titulo: v })}
            viewClassName="text-[19px] font-bold leading-[1.3] tracking-[-0.02em] rounded-md -mx-1 px-1 hover:bg-hover"
            editClassName="w-full text-[19px] font-bold leading-[1.3] tracking-[-0.02em] rounded-md border border-brand px-1 -mx-1 outline-none bg-surface"
          />
        </div>
        <div className="flex flex-col gap-[13px]">
          <Fila etiqueta="Responsable">
            <div className="flex items-center gap-2">
              {responsable && <Avatar nombre={responsable.nombre} color={responsable.color} size={24} />}
              <select
                value={tarea.responsable_id ?? ''}
                onChange={(e) => setCambios({ responsable_id: e.target.value || null })}
                className="rounded-md border border-line bg-surface px-1.5 py-1 text-[13.5px] font-semibold outline-none focus:border-brand"
              >
                <option value="">Sin asignar</option>
                {(personas ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
          </Fila>

          <Fila etiqueta="Estado">
            <select
              value={tarea.estado}
              onChange={(e) => setCambios({ estado: e.target.value as Tarea['estado'] })}
              className="rounded-lg py-[3px] pl-2 pr-2 text-[12.5px] font-semibold outline-none"
              style={{ background: estadoVM(tarea.estado).bg, color: estadoVM(tarea.estado).fg }}
            >
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {estadoVM(e).label}
                </option>
              ))}
            </select>
          </Fila>

          <Fila etiqueta="Tipo">
            {(() => {
              const vm = tipoVM(tarea.tipo)
              const otro: Tarea['tipo'] = tarea.tipo === 'correccion' ? 'tarea' : 'correccion'
              return (
                <button
                  type="button"
                  onClick={() => setCambios({ tipo: otro })}
                  title={`Cambiar a ${tipoVM(otro).label.toLowerCase()}`}
                  className="rounded-lg px-2 py-[3px] text-[12.5px] font-semibold outline-none transition-colors"
                  style={{ background: vm.bg, color: vm.fg }}
                >
                  {vm.label}
                </button>
              )
            })()}
          </Fila>

          <Fila etiqueta="Inicio">
            <input
              type="date"
              value={tarea.fecha_inicio ?? ''}
              onChange={(e) => setCambios({ fecha_inicio: e.target.value || null })}
              className="rounded-md border border-line bg-surface px-2 py-1 text-[13.5px] font-semibold outline-none focus:border-brand"
            />
            {tarea.fecha_inicio && <span className="text-[12.5px] text-muted">{fmtFecha(tarea.fecha_inicio)}</span>}
          </Fila>

          <Fila etiqueta="Vence">
            <input
              type="date"
              value={tarea.fecha ?? ''}
              onChange={(e) => setCambios({ fecha: e.target.value || null })}
              className="rounded-md border border-line bg-surface px-2 py-1 text-[13.5px] font-semibold outline-none focus:border-brand"
            />
            {tarea.fecha && <span className="text-[12.5px] text-muted">{fmtFecha(tarea.fecha)}</span>}
          </Fila>
        </div>
      </div>

      <div className="border-b border-line-soft px-[22px] pb-[18px] pt-5">
        <div className="mb-[9px] text-[11px] font-bold uppercase tracking-[0.04em] text-faint">
          Qué se hace
        </div>
        <InlineEdit
          value={tarea.descripcion ?? ''}
          onSave={(v) => setCambios({ descripcion: v || null })}
          multiline
          placeholder="Describe qué hay que hacer… (clic para editar)"
          viewClassName="text-sm leading-[1.6] text-ink-soft rounded-[10px] -mx-1 px-1 py-0.5 hover:bg-hover whitespace-pre-wrap min-h-[24px]"
          editClassName="w-full resize-y rounded-[10px] border border-brand bg-surface px-3 py-2 text-sm leading-[1.6] text-ink-soft outline-none"
        />
      </div>

      <div className="border-b border-line-soft px-[22px] pb-[18px] pt-5">
        <div className="mb-[9px] text-[11px] font-bold uppercase tracking-[0.04em] text-faint">
          Criterio · ¿cómo sé que está listo?
        </div>
        <InlineEdit
          value={tarea.criterio ?? ''}
          onSave={(v) => setCambios({ criterio: v || null })}
          multiline
          placeholder="Define qué tiene que pasar para darla por terminada… (clic para editar)"
          viewClassName="text-sm leading-[1.6] text-ink-soft rounded-[10px] -mx-1 px-1 py-0.5 hover:bg-hover whitespace-pre-wrap min-h-[24px]"
          editClassName="w-full resize-y rounded-[10px] border border-brand bg-surface px-3 py-2 text-sm leading-[1.6] text-ink-soft outline-none"
        />
      </div>

      {/* Sección de Dependencias */}
      <div className="border-b border-line-soft px-[22px] pb-[18px] pt-5">
        <div className="mb-[9px] text-[11px] font-bold uppercase tracking-[0.04em] text-faint">
          Dependencias
        </div>
        
        {/* Lista de bloqueadores */}
        <div className="mb-3 space-y-1.5">
          <div className="text-[12px] font-bold text-muted mb-1">Bloqueada por (tareas previas):</div>
          {bloqueadores.length === 0 ? (
            <div className="text-[12.5px] text-faint italic pl-1">Sin bloqueadores.</div>
          ) : (
            bloqueadores.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-lg bg-canvas px-2.5 py-1.5 text-xs">
                <span className="truncate font-medium text-ink flex-1 mr-2">{b.titulo}</span>
                <span className="flex-none font-mono text-[10px] px-1.5 py-0.5 rounded mr-2" style={{ background: estadoVM(b.estado).bg, color: estadoVM(b.estado).fg }}>
                  {estadoVM(b.estado).label}
                </span>
                <button
                  type="button"
                  onClick={() => elimDep.mutate({ bloqueadora_id: b.id, bloqueada_id: tarea.id })}
                  className="text-faint hover:text-brand-strong font-bold px-1"
                  title="Eliminar bloqueo"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>

        {/* Agregar bloqueador */}
        <div className="mt-3 flex items-center gap-2">
          <select
            value=""
            onChange={(e) => {
              const val = e.target.value
              if (val) {
                crearDep.mutate({ bloqueadora_id: val, bloqueada_id: tarea.id })
              }
            }}
            className="flex-1 rounded-md border border-line bg-surface px-2 py-1 text-[12.5px] outline-none focus:border-brand"
          >
            <option value="">+ Agregar tarea bloqueadora...</option>
            {tareasProyecto
              .filter((t) => t.id !== tarea.id && !bloqueadores.some((b) => b.id === t.id) && !bloqueados.some((b) => b.id === t.id))
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.titulo}
                </option>
              ))}
          </select>
        </div>

        {/* Lista de tareas bloqueadas */}
        {bloqueados.length > 0 && (
          <div className="mt-4">
            <div className="text-[12px] font-bold text-muted mb-1.5">Bloquea a (tareas que dependen de esta):</div>
            <div className="space-y-1.5">
              {bloqueados.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-lg bg-canvas px-2.5 py-1.5 text-xs">
                  <span className="truncate font-medium text-ink flex-1 mr-2">{b.titulo}</span>
                  <span className="flex-none font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ background: estadoVM(b.estado).bg, color: estadoVM(b.estado).fg }}>
                    {estadoVM(b.estado).label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Comentarios tarea={tarea} yoId={yo?.id ?? null} personaPorId={personaPorId} />
    </aside>
  )
}

function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3.5">
      <span className="w-[84px] flex-none text-[12.5px] text-muted">{etiqueta}</span>
      {children}
    </div>
  )
}

function Comentarios({
  tarea,
  yoId,
  personaPorId,
}: {
  tarea: Tarea
  yoId: string | null
  personaPorId: Map<string, Tables<'personas'>>
}) {
  const { data: comentarios } = useComentarios(tarea.id)
  const crear = useCrearComentario()
  const actualizar = useActualizarComentario()
  const [texto, setTexto] = useState('')
  const [paraPo, setParaPo] = useState(false)

  // Estados para autocompletar menciones con @
  const [mostrarMentions, setMostrarMentions] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const personasFiltradas = Array.from(personaPorId.values()).filter((p) => {
    if (p.id === yoId) return false
    const term = searchQuery.toLowerCase()
    return p.nombre.toLowerCase().includes(term) || p.email.toLowerCase().includes(term)
  })

  const handleChangeTextarea = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setTexto(val)

    const start = e.target.selectionStart
    const textBeforeCursor = val.slice(0, start)
    const match = textBeforeCursor.match(/@([a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9_]*)$/)

    if (match) {
      setMostrarMentions(true)
      setSearchQuery(match[1])
      setSelectedIndex(0)
    } else {
      setMostrarMentions(false)
    }
  }

  const handleKeyDownTextarea = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!mostrarMentions || personasFiltradas.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % personasFiltradas.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + personasFiltradas.length) % personasFiltradas.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      insertarMencion(personasFiltradas[selectedIndex])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setMostrarMentions(false)
    }
  }

  const insertarMencion = (persona: Tables<'personas'>) => {
    const textarea = document.getElementById('comentario-textarea') as HTMLTextAreaElement
    if (!textarea) return

    const val = texto
    const start = textarea.selectionStart
    const textBeforeCursor = val.slice(0, start)
    const textAfterCursor = val.slice(start)

    const lastAtIdx = textBeforeCursor.lastIndexOf('@')
    if (lastAtIdx === -1) return

    const nuevoTexto = textBeforeCursor.slice(0, lastAtIdx) + `@${persona.nombre} ` + textAfterCursor
    setTexto(nuevoTexto)
    setMostrarMentions(false)

    setTimeout(() => {
      textarea.focus()
      const newCursorPos = lastAtIdx + persona.nombre.length + 2 // @ + nombre + espacio
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  const enviar = () => {
    const t = texto.trim()
    if (!t || !yoId) return
    crear.mutate({ tarea_id: tarea.id, autor_id: yoId, texto: t, para_po: paraPo })
    setTexto('')
    setParaPo(false)
    setMostrarMentions(false)
  }

  return (
    <div className="flex-1 px-[22px] py-5">
      <div className="mb-3.5 text-[11px] font-bold uppercase tracking-[0.04em] text-faint">
        Comentarios
      </div>

      {(comentarios?.length ?? 0) === 0 ? (
        <div className="py-5 text-center text-[13px] text-faint">Sin comentarios todavía.</div>
      ) : (
        <div className="mb-5 flex flex-col gap-4">
          {(comentarios ?? []).map((c) => {
            const autor = personaPorId.get(c.autor_id)
            const pendiente = c.para_po && !c.resuelto
            return (
              <div key={c.id} className="flex gap-[11px]">
                <Avatar nombre={autor?.nombre ?? '—'} color={autor?.color ?? '#c4bdb1'} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-baseline gap-2">
                    <span className="text-[13px] font-bold">{autor?.nombre ?? 'Alguien'}</span>
                    {c.created_at && (
                      <span className="text-[11px] font-mono text-faint">
                        {fmtFechaHora(c.created_at)}
                      </span>
                    )}
                  </div>
                  <div
                    className="rounded-[10px] text-[13.5px] leading-[1.55] text-ink-soft"
                    style={{
                      padding: c.para_po ? '10px 12px' : 0,
                      background: pendiente
                        ? 'var(--color-brand-tint)'
                        : c.resuelto && c.para_po
                          ? 'var(--color-hover)'
                          : 'transparent',
                      border: c.para_po ? '1px solid var(--color-line)' : 'none',
                    }}
                  >
                    {c.para_po && (
                      <div
                        className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold"
                        style={{ color: pendiente ? '#bb6a3e' : '#7e8a7e' }}
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                          <path d="M4 2.5v11" strokeLinecap="round" />
                          <path d="M4 3.2h8.2l-2 2.4 2 2.4H4" strokeLinejoin="round" />
                        </svg>
                        {c.resuelto ? 'Pregunta para el PO · resuelta' : 'Pregunta para el PO'}
                      </div>
                    )}
                    {c.texto}
                    {pendiente && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() =>
                            actualizar.mutate({
                              id: c.id,
                              tareaId: tarea.id,
                              cambios: { resuelto: true },
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#e0bfac] bg-surface px-[11px] py-[5px] text-xs font-semibold text-brand-deep transition-colors hover:bg-[#fdf6f1]"
                        >
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M3.5 8.5l3 3 6-6.5" />
                          </svg>
                          Marcar resuelto
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="flex items-start gap-2.5 pt-1">
        <Avatar nombre={yoId ? personaPorId.get(yoId)?.nombre ?? 'Yo' : 'Yo'} color="#c96442" size={28} />
        <div className="relative flex-1">
          <textarea
            id="comentario-textarea"
            value={texto}
            onChange={handleChangeTextarea}
            onKeyDown={handleKeyDownTextarea}
            placeholder="Escribe un comentario…"
            rows={2}
            className="w-full resize-none rounded-[10px] border border-line bg-canvas px-[11px] py-[9px] text-[13.5px] outline-none focus:border-brand focus:bg-surface"
          />

          {mostrarMentions && personasFiltradas.length > 0 && (
            <div className="absolute bottom-[calc(100%+6px)] left-0 z-50 w-[240px] rounded-xl border border-line bg-surface p-1 shadow-xl max-h-[160px] overflow-y-auto">
              {personasFiltradas.map((p, idx) => {
                const seleccionado = idx === selectedIndex
                return (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      insertarMencion(p)
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                      seleccionado ? 'bg-brand text-white font-bold' : 'hover:bg-hover text-ink font-medium'
                    }`}
                  >
                    <Avatar nombre={p.nombre} color={p.color} size={20} />
                    <div className="min-w-0 flex-1">
                      <div className={`truncate ${seleccionado ? 'text-white' : 'text-ink'}`}>{p.nombre}</div>
                      <div className={`truncate ${seleccionado ? 'text-white/80' : 'text-muted-soft'}`} style={{ fontSize: '10px' }}>
                        {p.rol === 'po' ? 'Product Owner' : 'Developer'}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          <div className="mt-2 flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-[7px] text-[12.5px] text-label">
              <input
                type="checkbox"
                checked={paraPo}
                onChange={(e) => setParaPo(e.target.checked)}
                className="h-[15px] w-[15px] accent-brand"
              />
              Marcar como pregunta para el PO
            </label>
            <button
              type="button"
              onClick={enviar}
              disabled={!texto.trim() || !yoId}
              className="rounded-lg bg-brand px-3.5 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-50"
            >
              Comentar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
