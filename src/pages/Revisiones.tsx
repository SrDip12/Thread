import { useMemo, useState } from 'react'
import type { Tables } from '../lib/database.types.ts'
import { estadoVM, fmtFecha, fmtRelativo } from '../lib/ui.ts'
import { useAuth } from '../auth/AuthProvider.tsx'
import { usePersonas } from '../data/personas.ts'
import { useTareas } from '../data/tareas.ts'
import { useComentariosModulo, useCrearComentario } from '../data/comentarios.ts'
import {
  useModulosEnRevision,
  useResolverRevision,
  type ModuloEnRevision,
} from '../data/revisiones.ts'
import { Avatar, Eyebrow, Skeleton, EmptyState, ProgressBar } from '../components/ui.tsx'

type Persona = Tables<'personas'>

export default function Revisiones() {
  const { data: modulos, isLoading } = useModulosEnRevision()
  const [selId, setSelId] = useState<string | null>(null)

  const lista = modulos ?? []
  // Mantener una selección válida: el seleccionado o el primero de la lista.
  const seleccionado = lista.find((m) => m.id === selId) ?? lista[0] ?? null

  return (
    <div className="flex">
      <div className="h-screen w-[330px] flex-none overflow-auto border-r border-line bg-canvas">
        <div className="px-6 pb-6 pt-10">
          <Eyebrow>{lista.length} en revisión</Eyebrow>
          <h1 className="m-0 text-[24px] font-extrabold tracking-[-0.025em]">Revisiones</h1>
          <p className="mt-[7px] text-[13px] text-muted-soft">
            Módulos esperando el visto bueno del responsable de visión.
          </p>
        </div>

        {isLoading && (
          <div className="flex flex-col gap-2 px-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[58px] rounded-[11px]" />
            ))}
          </div>
        )}
        {!isLoading && lista.length === 0 && (
          <div className="px-4">
            <EmptyState
              icon={
                <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3.5 8.5l3 3 6-6.5" />
                </svg>
              }
              titulo="Todo al día"
              descripcion="No hay módulos esperando revisión por ahora."
            />
          </div>
        )}

        <div className="flex flex-col gap-1 px-3">
          {lista.map((m) => {
            const activo = seleccionado?.id === m.id
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelId(m.id)}
                className={`rounded-[11px] border px-3.5 py-3 text-left transition-colors ${
                  activo ? 'border-line bg-surface' : 'border-transparent hover:bg-hover'
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 flex-none rounded-[2px]"
                    style={{ background: m.proyectos?.color ?? '#c4bdb1' }}
                  />
                  <span className="truncate text-[11.5px] text-muted-soft">
                    {m.proyectos?.nombre ?? 'Proyecto'}
                  </span>
                </div>
                <div className="text-sm font-bold tracking-[-0.01em]">{m.nombre}</div>
                {fmtRelativo(m.en_revision_at) && (
                  <div className="mt-1 font-mono text-[10.5px] text-faint">
                    en revisión {fmtRelativo(m.en_revision_at)}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="h-screen flex-1 overflow-auto">
        {seleccionado ? (
          <DetalleRevision key={seleccionado.id} modulo={seleccionado} />
        ) : (
          <div className="flex h-full items-center justify-center px-11">
            <EmptyState
              icon={
                <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 5.5h10M3 8h7M3 10.5h5" />
                </svg>
              }
              titulo="Nada para revisar"
              descripcion="Cuando un módulo pase a revisión, vas a poder aprobarlo o devolverlo desde acá."
            />
          </div>
        )}
      </div>
    </div>
  )
}

function DetalleRevision({ modulo }: { modulo: ModuloEnRevision }) {
  const { persona: yo } = useAuth()
  const { data: personas } = usePersonas()
  const { data: tareas } = useTareas(modulo.id)
  const resolver = useResolverRevision()
  const crear = useCrearComentario()
  const [pendienteConfirmar, setPendienteConfirmar] = useState(false)
  const [devolviendo, setDevolviendo] = useState(false)
  const [motivo, setMotivo] = useState('')

  const proyecto = modulo.proyectos
  const personaPorId = useMemo(
    () => new Map((personas ?? []).map((p) => [p.id, p])),
    [personas],
  )

  // Permiso: solo el responsable de visión del proyecto puede aprobar/devolver.
  const esResponsableVision =
    Boolean(yo) && yo?.id === proyecto?.responsable_vision_id
  const responsableVision = proyecto?.responsable_vision_id
    ? personaPorId.get(proyecto.responsable_vision_id)
    : undefined

  const decidir = (resultado: 'aprobado' | 'devuelto') => {
    if (!esResponsableVision || !proyecto || resolver.isPending) return
    resolver.mutate({
      moduloId: modulo.id,
      proyectoId: proyecto.id,
      revisorId: yo?.id ?? null,
      resultado,
    })
  }

  const listaTareas = tareas ?? []
  const total = listaTareas.length
  const hechas = listaTareas.filter((t) => t.estado === 'hecho').length
  const pendientes = total - hechas
  const pct = total ? Math.round((hechas / total) * 100) : 0

  // Aprobar: si hay tareas sin terminar, pedir confirmación una vez antes de cerrar.
  const aprobar = () => {
    if (!esResponsableVision || resolver.isPending) return
    if (pendientes > 0 && !pendienteConfirmar) {
      setPendienteConfirmar(true)
      return
    }
    decidir('aprobado')
  }

  // Devolver: el motivo es obligatorio y vuelve con el módulo como feedback.
  const devolverConMotivo = () => {
    const m = motivo.trim()
    if (!esResponsableVision || resolver.isPending || !m || !yo) return
    crear.mutate({ modulo_id: modulo.id, autor_id: yo.id, texto: m })
    decidir('devuelto')
  }

  return (
    <div className="mx-auto max-w-[820px] px-11 pb-24 pt-[34px]">
      <div className="mb-[7px] flex flex-wrap items-center gap-2.5">
        {proyecto && (
          <span className="flex items-center gap-1.5 rounded-[7px] border border-line bg-canvas px-[9px] py-[3px] text-xs font-semibold text-[#4a463f]">
            <span
              className="inline-block h-[9px] w-[9px] flex-none rounded-[2px]"
              style={{ background: proyecto.color }}
            />
            {proyecto.nombre}
          </span>
        )}
        <span
          className="rounded-[7px] px-2.5 py-[3px] text-[11.5px] font-bold"
          style={{ background: '#e8eef6', color: '#43618f' }}
        >
          En revisión
        </span>
      </div>

      <h1 className="m-0 mb-[6px] text-[25px] font-extrabold tracking-[-0.025em]">{modulo.nombre}</h1>
      {modulo.descripcion && (
        <p className="mb-6 text-sm text-muted-soft">{modulo.descripcion}</p>
      )}

      {/* Definición del producto: referencia contra la que se valida. */}
      <div className="mb-7 rounded-[14px] border border-line bg-surface px-5 py-[18px]">
        <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.04em] text-faint">
          Definición del producto · el norte
        </div>
        <div className="space-y-3">
          <DefFila label="Qué es" valor={proyecto?.que_es} />
          <DefFila label="Para quién" valor={proyecto?.para_quien} />
          <DefFila label="Problema" valor={proyecto?.problema} />
        </div>
      </div>

      {/* Tareas del módulo. */}
      <div className="mb-2.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.04em] text-faint">
        <span>Tareas del módulo · {total}</span>
        {total > 0 && (
          <span className="font-mono normal-case tracking-normal text-muted">
            {hechas}/{total} hechas
          </span>
        )}
      </div>
      {total > 0 && (
        <div className="mb-3">
          <ProgressBar pct={pct} color={pendientes === 0 ? '#477155' : proyecto?.color ?? '#c96442'} />
        </div>
      )}
      <div className="mb-7 overflow-hidden rounded-[13px] border border-line bg-surface">
        {listaTareas.length === 0 && (
          <div className="px-4 py-5 text-center text-[13px] text-faint">Este módulo no tiene tareas.</div>
        )}
        {listaTareas.map((t) => {
          const vm = estadoVM(t.estado)
          const resp = t.responsable_id ? personaPorId.get(t.responsable_id) : undefined
          const fecha = fmtFecha(t.fecha)
          return (
            <div
              key={t.id}
              className="flex items-center gap-3 border-b border-line-soft px-4 py-[11px] last:border-b-0"
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
              <span
                className="flex-none rounded-lg px-2 py-[3px] text-[11.5px] font-semibold"
                style={{ background: vm.bg, color: vm.fg }}
              >
                {vm.label}
              </span>
              <Avatar nombre={resp?.nombre ?? '—'} color={resp?.color ?? '#c4bdb1'} size={26} />
            </div>
          )
        })}
      </div>

      {/* Hilo de feedback del módulo. */}
      <HiloModulo modulo={modulo} yo={yo} personaPorId={personaPorId} />

      {/* Acciones de decisión. */}
      <div className="mt-8 rounded-[14px] border border-line bg-surface px-5 py-[18px]">
        {!esResponsableVision && (
          <div className="mb-3.5 rounded-[10px] border border-line bg-canvas px-3.5 py-2.5 text-[13px] text-muted">
            Solo el responsable de visión
            {responsableVision ? ` (${responsableVision.nombre})` : ''} puede decidir. Dejá tu feedback
            en el hilo de arriba.
          </div>
        )}

        {esResponsableVision && devolviendo ? (
          // Devolver exige motivo: se guarda como feedback y vuelve con el módulo.
          <div>
            <div className="mb-2 text-[13px] font-semibold text-ink">¿Qué hay que corregir?</div>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              autoFocus
              aria-label="Motivo de la devolución"
              placeholder="El motivo vuelve con el módulo como feedback…"
              rows={3}
              className="w-full resize-none rounded-[10px] border border-line bg-canvas px-[11px] py-[9px] text-[13.5px] outline-none focus:border-brand focus:bg-surface"
            />
            <div className="mt-2.5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setDevolviendo(false)
                  setMotivo('')
                }}
                className="rounded-[9px] border border-line bg-canvas px-4 py-2 text-[13.5px] font-semibold text-muted transition-colors hover:bg-hover"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={devolverConMotivo}
                disabled={!motivo.trim() || resolver.isPending}
                className="rounded-[9px] bg-[#b5532f] px-4 py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#9d4527] disabled:opacity-50"
              >
                Devolver con motivo
              </button>
            </div>
          </div>
        ) : (
          <>
            {pendienteConfirmar && (
              <div
                className="mb-3.5 rounded-[10px] px-3.5 py-2.5 text-[13px] font-medium"
                style={{ background: '#f9ecdc', color: '#a96a23' }}
              >
                {pendientes === 1
                  ? '1 tarea sin terminar.'
                  : `${pendientes} tareas sin terminar.`}{' '}
                ¿Aprobar el módulo igual?
              </div>
            )}
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDevolviendo(true)}
                disabled={!esResponsableVision || resolver.isPending}
                className="rounded-[9px] border border-line bg-canvas px-4 py-2 text-[13.5px] font-semibold text-[#b5532f] transition-colors hover:bg-hover disabled:opacity-50"
              >
                Devolver
              </button>
              <button
                type="button"
                onClick={aprobar}
                disabled={!esResponsableVision || resolver.isPending}
                className="flex items-center gap-1.5 rounded-[9px] bg-[#477155] px-4 py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#3c624a] disabled:opacity-50"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3.5 8.5l3 3 6-6.5" />
                </svg>
                {pendienteConfirmar ? 'Aprobar igual' : 'Aprobar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function DefFila({ label, valor }: { label: string; valor: string | null | undefined }) {
  return (
    <div>
      <div className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.04em] text-label">{label}</div>
      <div className="text-sm leading-[1.55] text-ink-soft">
        {valor?.trim() ? valor : <span className="text-faint">Sin definir.</span>}
      </div>
    </div>
  )
}

function HiloModulo({
  modulo,
  yo,
  personaPorId,
}: {
  modulo: ModuloEnRevision
  yo: Persona | null
  personaPorId: Map<string, Persona>
}) {
  const { data: comentarios } = useComentariosModulo(modulo.id)
  const crear = useCrearComentario()
  const [texto, setTexto] = useState('')

  const enviar = () => {
    const t = texto.trim()
    if (!t || !yo) return
    crear.mutate({ modulo_id: modulo.id, autor_id: yo.id, texto: t })
    setTexto('')
  }

  const lista = comentarios ?? []

  return (
    <div>
      <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.04em] text-faint">
        Feedback de revisión · {lista.length}
      </div>

      {lista.length === 0 ? (
        <div className="mb-4 rounded-[13px] border border-dashed border-line px-4 py-5 text-center text-[13px] text-faint">
          Sin feedback todavía.
        </div>
      ) : (
        <div className="mb-4 flex flex-col gap-4">
          {lista.map((c) => {
            const autor = personaPorId.get(c.autor_id)
            return (
              <div key={c.id} className="flex gap-[11px]">
                <Avatar nombre={autor?.nombre ?? '—'} color={autor?.color ?? '#c4bdb1'} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 text-[13px] font-bold">{autor?.nombre ?? 'Alguien'}</div>
                  <div className="text-[13.5px] leading-[1.55] text-ink-soft">{c.texto}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="flex items-start gap-2.5">
        <Avatar nombre={yo?.nombre ?? 'Yo'} color={yo?.color ?? '#c96442'} size={28} />
        <div className="flex-1">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            aria-label="Feedback de la revisión"
            placeholder="Dejá feedback de la revisión…"
            rows={2}
            className="w-full resize-none rounded-[10px] border border-line bg-canvas px-[11px] py-[9px] text-[13.5px] outline-none focus:border-brand focus:bg-surface"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={enviar}
              disabled={!texto.trim() || !yo}
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
