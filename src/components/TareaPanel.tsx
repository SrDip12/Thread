import { useState } from 'react'
import type { Tables } from '../lib/database.types.ts'
import { ESTADOS, estadoVM, fmtFecha } from '../lib/ui.ts'
import { useActualizarTarea, useTareas } from '../data/tareas.ts'
import {
  useComentarios,
  useCrearComentario,
  useActualizarComentario,
} from '../data/comentarios.ts'
import { usePersonas } from '../data/personas.ts'
import { useAuth } from '../auth/AuthProvider.tsx'
import { Avatar, InlineEdit } from './ui.tsx'

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
    // La tarea desapareció (borrada o aún cargando tras navegar). Cerrar limpio.
    return (
      <aside className="flex h-screen w-[430px] flex-none items-center justify-center border-l border-line bg-surface text-sm text-muted">
        …
      </aside>
    )
  }

  const setCambios = (cambios: Partial<Tarea>) =>
    actualizar.mutate({ id: tarea.id, moduloId: tarea.modulo_id, cambios })

  const responsable = tarea.responsable_id ? personaPorId.get(tarea.responsable_id) : undefined

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
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-ink"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

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

          <Fila etiqueta="Fecha">
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

  const enviar = () => {
    const t = texto.trim()
    if (!t || !yoId) return
    crear.mutate({ tarea_id: tarea.id, autor_id: yoId, texto: t, para_po: paraPo })
    setTexto('')
    setParaPo(false)
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
                  <div className="mb-1 text-[13px] font-bold">{autor?.nombre ?? 'Alguien'}</div>
                  <div
                    className="rounded-[10px] text-[13.5px] leading-[1.55] text-ink-soft"
                    style={{
                      padding: c.para_po ? '10px 12px' : 0,
                      background: pendiente ? '#fbf2ec' : c.resuelto && c.para_po ? '#f1f4f0' : 'transparent',
                      border: c.para_po
                        ? `1px solid ${pendiente ? '#f0dccd' : '#e3e8e1'}`
                        : 'none',
                    }}
                  >
                    {c.para_po && (
                      <div
                        className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold"
                        style={{ color: pendiente ? '#bb6a3e' : '#7e8a7e' }}
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
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
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
        <div className="flex-1">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribe un comentario…"
            rows={2}
            className="w-full resize-none rounded-[10px] border border-line bg-canvas px-[11px] py-[9px] text-[13.5px] outline-none focus:border-brand focus:bg-surface"
          />
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
