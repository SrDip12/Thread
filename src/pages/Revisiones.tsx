import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { Tables } from '../lib/database.types.ts'
import { estadoVM, fmtFecha, fmtRelativo, fmtFechaHora } from '../lib/ui.ts'
import { rutaTarea } from '../lib/navegacion.ts'
import { useAuth } from '../auth/AuthProvider.tsx'
import { usePersonas } from '../data/personas.ts'
import {
  useTareas,
  useTareasEnRevision,
  useActualizarTarea,
  type TareaConProyecto,
} from '../data/tareas.ts'
import { useComentariosModulo, useCrearComentario } from '../data/comentarios.ts'
import {
  useModulosEnRevision,
  useResolverRevision,
  type ModuloEnRevision,
} from '../data/revisiones.ts'
import { Avatar, Eyebrow, FechaTag, Skeleton, EmptyState, ProgressBar } from '../components/ui.tsx'

type Persona = Tables<'personas'>
type Tab = 'tareas' | 'modulos'

// Selector Tareas/Módulos compartido por las dos vistas de la página.
function Tabs({
  tab,
  setTab,
  nTareas,
  nModulos,
}: {
  tab: Tab
  setTab: (t: Tab) => void
  nTareas: number
  nModulos: number
}) {
  const { t } = useTranslation()
  const boton = (id: Tab, label: string, n: number) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`rounded-[6px] px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
        tab === id ? 'bg-hover text-ink' : 'text-muted hover:text-ink'
      }`}
    >
      {label}
      {n > 0 && <span className="ml-1.5 font-mono text-[11px] text-faint">{n}</span>}
    </button>
  )
  return (
    <div className="flex w-fit rounded-lg border border-line bg-surface p-0.5">
      {boton('tareas', t('revisiones.tabTareas'), nTareas)}
      {boton('modulos', t('revisiones.tabModulos'), nModulos)}
    </div>
  )
}

export default function Revisiones() {
  const { data: modulos, isLoading: cargandoModulos } = useModulosEnRevision()
  const { data: tareasRev, isLoading: cargandoTareas } = useTareasEnRevision()
  const [tab, setTab] = useState<Tab>('tareas')

  const nTareas = tareasRev?.length ?? 0
  const nModulos = modulos?.length ?? 0

  if (tab === 'tareas') {
    return (
      <TareasRevision
        tareas={tareasRev ?? []}
        cargando={cargandoTareas}
        tabs={<Tabs tab={tab} setTab={setTab} nTareas={nTareas} nModulos={nModulos} />}
      />
    )
  }

  return (
    <ModulosRevision
      modulos={modulos ?? []}
      cargando={cargandoModulos}
      tabs={<Tabs tab={tab} setTab={setTab} nTareas={nTareas} nModulos={nModulos} />}
    />
  )
}

// ── Revisión de TAREAS: aprobar → hecho, devolver → en curso con motivo ──
function TareasRevision({
  tareas,
  cargando,
  tabs,
}: {
  tareas: TareaConProyecto[]
  cargando: boolean
  tabs: React.ReactNode
}) {
  const { t: tr } = useTranslation()
  const navigate = useNavigate()
  const { persona: yo } = useAuth()
  const { data: personas } = usePersonas()
  const actualizar = useActualizarTarea()
  const crearComentario = useCrearComentario()
  const [devolviendoId, setDevolviendoId] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const personaPorId = new Map((personas ?? []).map((p) => [p.id, p]))

  const aprobar = (tarea: TareaConProyecto) =>
    actualizar.mutate({ id: tarea.id, moduloId: tarea.modulo_id, cambios: { estado: 'hecho' } })

  const devolver = (tarea: TareaConProyecto) => {
    const m = motivo.trim()
    if (!m || !yo) return
    crearComentario.mutate({ tarea_id: tarea.id, autor_id: yo.id, texto: tr('revisiones.devueltaDeRevision', { motivo: m }) })
    actualizar.mutate({ id: tarea.id, moduloId: tarea.modulo_id, cambios: { estado: 'en_curso' } })
    setDevolviendoId(null)
    setMotivo('')
  }

  return (
    <div className="mx-auto max-w-[820px] px-11 pb-24 pt-10">
      <div className="mb-4">
        <Eyebrow>{tr('revisiones.tareasEsperando', { count: tareas.length })}</Eyebrow>
        <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.025em]">{tr('nav.revisiones')}</h1>
        <p className="mt-[7px] text-sm text-muted-soft">
          {tr('revisiones.subtituloTareas')}
        </p>
      </div>
      <div className="mb-6">{tabs}</div>

      {cargando && (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[92px] rounded-[13px]" />
          ))}
        </div>
      )}

      {!cargando && tareas.length === 0 && (
        <EmptyState
          icon={
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.5 8.5l3 3 6-6.5" />
            </svg>
          }
          titulo={tr('revisiones.nadaEsperando')}
          descripcion={tr('revisiones.nadaEsperandoDesc')}
        />
      )}

      <div className="flex flex-col gap-3">
        {tareas.map((t) => {
          const proy = t.modulos?.proyectos
          const resp = t.responsable_id ? personaPorId.get(t.responsable_id) : undefined
          const devolviendo = devolviendoId === t.id
          return (
            <div key={t.id} className="rounded-[13px] border border-line bg-surface px-[18px] py-4">
              <div className="mb-2 flex items-center gap-2 text-xs text-muted">
                <span className="inline-block h-2 w-2 flex-none rounded-[2px]" style={{ background: proy?.color ?? 'var(--color-avatar-empty)' }} />
                <span className="font-semibold text-label">{proy?.nombre ?? tr('common.proyecto')}</span>
                <span className="text-faint">/</span>
                <span>{t.modulos?.nombre ?? ''}</span>
                {fmtRelativo(t.updated_at) && (
                  <span className="ml-auto font-mono text-[10.5px] text-faint">
                    {tr('revisiones.enRevisionRel', { tiempo: fmtRelativo(t.updated_at) })}
                  </span>
                )}
              </div>

              <div className="mb-1 flex items-center gap-2.5">
                <span className="min-w-0 flex-1 text-[15px] font-bold tracking-[-0.01em] text-ink">
                  {t.titulo}
                </span>
                <FechaTag fecha={t.fecha} />
                {resp && <Avatar nombre={resp.nombre} color={resp.color} size={24} />}
              </div>

              {t.criterio?.trim() && (
                <div className="mb-2 rounded-[9px] bg-canvas px-3 py-2 text-[12.5px] leading-[1.5] text-ink-soft">
                  <span className="font-bold text-muted">{tr('revisiones.criterioListo')}</span>
                  {t.criterio}
                </div>
              )}

              {devolviendo ? (
                <div className="mt-2.5">
                  <textarea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    autoFocus
                    aria-label={tr('revisiones.motivoAria')}
                    placeholder={tr('revisiones.motivoTareaPlaceholder')}
                    rows={2}
                    className="w-full resize-none rounded-[10px] border border-line bg-canvas px-[11px] py-[9px] text-[13.5px] outline-none focus:border-brand focus:bg-surface"
                  />
                  <div className="mt-2 flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDevolviendoId(null)
                        setMotivo('')
                      }}
                      className="rounded-[9px] border border-line bg-canvas px-3.5 py-1.5 text-[12.5px] font-semibold text-muted transition-colors hover:bg-hover"
                    >
                      {tr('common.cancelar')}
                    </button>
                    <button
                      type="button"
                      onClick={() => devolver(t)}
                      disabled={!motivo.trim() || actualizar.isPending}
                      className="rounded-[9px] bg-[var(--color-danger-solid)] px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#9d4527] disabled:opacity-50"
                    >
                      {tr('revisiones.devolverConMotivo')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2.5 flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => proy && navigate(rutaTarea(proy.id, t.id, '/revisiones'))}
                    className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-ink-soft transition-colors hover:bg-hover"
                  >
                    {tr('revisiones.verTareaExt')}
                  </button>
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => {
                      setDevolviendoId(t.id)
                      setMotivo('')
                    }}
                    className="rounded-lg border border-line bg-canvas px-3.5 py-1.5 text-[12.5px] font-semibold text-[var(--color-danger)] transition-colors hover:bg-hover"
                  >
                    {tr('revisiones.devolver')}
                  </button>
                  <button
                    type="button"
                    onClick={() => aprobar(t)}
                    disabled={actualizar.isPending}
                    className="flex items-center gap-1.5 rounded-lg bg-[var(--color-ok-solid)] px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#3c624a] disabled:opacity-50"
                  >
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3.5 8.5l3 3 6-6.5" />
                    </svg>
                    {tr('revisiones.aprobar')}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Revisión de MÓDULOS: la compuerta del responsable de visión ─────────
function ModulosRevision({
  modulos,
  cargando,
  tabs,
}: {
  modulos: ModuloEnRevision[]
  cargando: boolean
  tabs: React.ReactNode
}) {
  const { t: tr } = useTranslation()
  const isLoading = cargando
  const [selId, setSelId] = useState<string | null>(null)

  const lista = modulos
  // Mantener una selección válida: el seleccionado o el primero de la lista.
  const seleccionado = lista.find((m) => m.id === selId) ?? lista[0] ?? null

  return (
    <div className="flex">
      <div className="h-screen w-[330px] flex-none overflow-auto border-r border-line bg-canvas">
        <div className="px-6 pb-4 pt-10">
          <Eyebrow>{tr('nav.enRevision', { count: lista.length })}</Eyebrow>
          <h1 className="m-0 text-[24px] font-extrabold tracking-[-0.025em]">{tr('nav.revisiones')}</h1>
          <p className="mt-[7px] text-[13px] text-muted-soft">
            {tr('revisiones.subtituloModulos')}
          </p>
          <div className="mt-3">{tabs}</div>
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
              titulo={tr('paraMi.todoAlDia')}
              descripcion={tr('revisiones.sinModulosDesc')}
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
                    style={{ background: m.proyectos?.color ?? 'var(--color-avatar-empty)' }}
                  />
                  <span className="truncate text-[11.5px] text-muted-soft">
                    {m.proyectos?.nombre ?? tr('common.proyecto')}
                  </span>
                </div>
                <div className="text-sm font-bold tracking-[-0.01em]">{m.nombre}</div>
                {fmtRelativo(m.en_revision_at) && (
                  <div className="mt-1 font-mono text-[10.5px] text-faint">
                    {tr('revisiones.enRevisionRel', { tiempo: fmtRelativo(m.en_revision_at) })}
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
              titulo={tr('revisiones.nadaParaRevisar')}
              descripcion={tr('revisiones.nadaParaRevisarDesc')}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function DetalleRevision({ modulo }: { modulo: ModuloEnRevision }) {
  const { t: tr } = useTranslation()
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
          <span className="flex items-center gap-1.5 rounded-[7px] border border-line bg-canvas px-[9px] py-[3px] text-xs font-semibold text-ink-soft">
            <span
              className="inline-block h-[9px] w-[9px] flex-none rounded-[2px]"
              style={{ background: proyecto.color }}
            />
            {proyecto.nombre}
          </span>
        )}
        <span
          className="rounded-[7px] px-2.5 py-[3px] text-[11.5px] font-bold"
          style={{ background: 'var(--color-info-tint)', color: 'var(--color-info)' }}
        >
          {tr('estados.revision')}
        </span>
      </div>

      <h1 className="m-0 mb-[6px] text-[25px] font-extrabold tracking-[-0.025em]">{modulo.nombre}</h1>
      {modulo.descripcion && (
        <p className="mb-6 text-sm text-muted-soft">{modulo.descripcion}</p>
      )}

      {/* Definición del producto: referencia contra la que se valida. */}
      <div className="mb-7 rounded-[14px] border border-line bg-surface px-5 py-[18px]">
        <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.04em] text-faint">
          {tr('revisiones.definicionProducto')}
        </div>
        <div className="space-y-3">
          <DefFila label={tr('revisiones.queEs')} valor={proyecto?.que_es} />
          <DefFila label={tr('revisiones.paraQuien')} valor={proyecto?.para_quien} />
          <DefFila label={tr('revisiones.problema')} valor={proyecto?.problema} />
        </div>
      </div>

      {/* Tareas del módulo. */}
      <div className="mb-2.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.04em] text-faint">
        <span>{tr('revisiones.tareasModulo', { count: total })}</span>
        {total > 0 && (
          <span className="font-mono normal-case tracking-normal text-muted">
            {tr('revisiones.hechasCount', { hechas, total })}
          </span>
        )}
      </div>
      {total > 0 && (
        <div className="mb-3">
          <ProgressBar pct={pct} color={pendientes === 0 ? 'var(--color-ok)' : proyecto?.color ?? '#c96442'} />
        </div>
      )}
      <div className="mb-7 overflow-hidden rounded-[13px] border border-line bg-surface">
        {listaTareas.length === 0 && (
          <div className="px-4 py-5 text-center text-[13px] text-faint">{tr('revisiones.sinTareasModulo')}</div>
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
                style={{ color: vm.done ? 'var(--color-muted)' : 'var(--color-ink)' }}
              >
                {t.titulo}
              </span>
              {t.tipo === 'correccion' && (
                <span
                  className="flex-none rounded-md px-[7px] py-[2px] text-[10.5px] font-bold uppercase tracking-[0.03em]"
                  style={{ background: 'var(--color-warn-tint)', color: 'var(--color-warn)' }}
                >
                  {tr('revisiones.correccion')}
                </span>
              )}
              {fecha && <span className="flex-none font-mono text-[11.5px] text-muted">{fecha}</span>}
              <span
                className="flex-none rounded-lg px-2 py-[3px] text-[11.5px] font-semibold"
                style={{ background: vm.bg, color: vm.fg }}
              >
                {vm.label}
              </span>
              <Avatar nombre={resp?.nombre ?? '—'} color={resp?.color ?? 'var(--color-avatar-empty)'} size={26} />
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
            {tr('revisiones.soloResponsable', { nombre: responsableVision ? ` (${responsableVision.nombre})` : '' })}
          </div>
        )}

        {esResponsableVision && devolviendo ? (
          // Devolver exige motivo: se guarda como feedback y vuelve con el módulo.
          <div>
            <div className="mb-2 text-[13px] font-semibold text-ink">{tr('revisiones.queCorregir')}</div>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              autoFocus
              aria-label={tr('revisiones.motivoAria')}
              placeholder={tr('revisiones.motivoModuloPlaceholder')}
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
                {tr('common.cancelar')}
              </button>
              <button
                type="button"
                onClick={devolverConMotivo}
                disabled={!motivo.trim() || resolver.isPending}
                className="rounded-[9px] bg-[var(--color-danger-solid)] px-4 py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#9d4527] disabled:opacity-50"
              >
                {tr('revisiones.devolverConMotivo')}
              </button>
            </div>
          </div>
        ) : (
          <>
            {pendienteConfirmar && (
              <div
                className="mb-3.5 rounded-[10px] px-3.5 py-2.5 text-[13px] font-medium"
                style={{ background: 'var(--color-warn-tint)', color: 'var(--color-warn)' }}
              >
                {tr('revisiones.sinTerminarAprobar', { count: pendientes })}
              </div>
            )}
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDevolviendo(true)}
                disabled={!esResponsableVision || resolver.isPending}
                className="rounded-[9px] border border-line bg-canvas px-4 py-2 text-[13.5px] font-semibold text-[var(--color-danger)] transition-colors hover:bg-hover disabled:opacity-50"
              >
                {tr('revisiones.devolver')}
              </button>
              <button
                type="button"
                onClick={aprobar}
                disabled={!esResponsableVision || resolver.isPending}
                className="flex items-center gap-1.5 rounded-[9px] bg-[var(--color-ok-solid)] px-4 py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#3c624a] disabled:opacity-50"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3.5 8.5l3 3 6-6.5" />
                </svg>
                {pendienteConfirmar ? tr('revisiones.aprobarIgual') : tr('revisiones.aprobar')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function DefFila({ label, valor }: { label: string; valor: string | null | undefined }) {
  const { t } = useTranslation()
  return (
    <div>
      <div className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.04em] text-label">{label}</div>
      <div className="text-sm leading-[1.55] text-ink-soft">
        {valor?.trim() ? valor : <span className="text-faint">{t('revisiones.sinDefinir')}</span>}
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
  const { t: tr } = useTranslation()
  const { data: comentarios } = useComentariosModulo(modulo.id)
  const crear = useCrearComentario()
  const [texto, setTexto] = useState('')

  const enviar = () => {
    const txt = texto.trim()
    if (!txt || !yo) return
    crear.mutate({ modulo_id: modulo.id, autor_id: yo.id, texto: txt })
    setTexto('')
  }

  const lista = comentarios ?? []

  return (
    <div>
      <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.04em] text-faint">
        {tr('revisiones.feedbackRevision', { count: lista.length })}
      </div>

      {lista.length === 0 ? (
        <div className="mb-4 rounded-[13px] border border-dashed border-line px-4 py-5 text-center text-[13px] text-faint">
          {tr('revisiones.sinFeedback')}
        </div>
      ) : (
        <div className="mb-4 flex flex-col gap-4">
          {lista.map((c) => {
            const autor = personaPorId.get(c.autor_id)
            return (
              <div key={c.id} className="flex gap-[11px]">
                <Avatar nombre={autor?.nombre ?? '—'} color={autor?.color ?? 'var(--color-avatar-empty)'} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-baseline gap-2">
                    <span className="text-[13px] font-bold">{autor?.nombre ?? tr('paraMi.alguien')}</span>
                    {c.created_at && (
                      <span className="text-[11px] font-mono text-faint">
                        {fmtFechaHora(c.created_at)}
                      </span>
                    )}
                  </div>
                  <div className="text-[13.5px] leading-[1.55] text-ink-soft">{c.texto}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="flex items-start gap-2.5">
        <Avatar nombre={yo?.nombre ?? tr('nav.yo')} color={yo?.color ?? '#c96442'} size={28} />
        <div className="flex-1">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            aria-label={tr('revisiones.feedbackAria')}
            placeholder={tr('revisiones.feedbackPlaceholder')}
            rows={2}
            className="w-full resize-none rounded-[10px] border border-line bg-canvas px-[11px] py-[9px] text-[13.5px] outline-none focus:border-brand focus:bg-surface"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={enviar}
              disabled={!texto.trim() || !yo}
              className="rounded-lg bg-brand px-3.5 py-1.5 text-[13px] font-semibold text-on-brand transition-colors hover:bg-brand-strong disabled:opacity-50"
            >
              {tr('revisiones.comentar')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
