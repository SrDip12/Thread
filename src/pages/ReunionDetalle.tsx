import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { fmtFecha, fmtFechaCompleta, tiposReunion } from '../lib/ui.ts'
import { useProyectos } from '../data/proyectos.ts'
import { usePersonas } from '../data/personas.ts'
import { useModulos, useActualizarModulo } from '../data/modulos.ts'
import { useSprints } from '../data/sprints.ts'
import { useReunion, useAsistentes, useActualizarReunion } from '../data/reuniones.ts'
import { alertas, pedirPermisoNotificaciones } from '../data/recordatorios.ts'
import { useCrearTarea, useTareasReunion } from '../data/tareas.ts'
import { extraerTareas, type TareaPropuesta } from '../lib/extraer.ts'
import { Avatar, AvatarStack, Skeleton, EmptyState } from '../components/ui.tsx'

// Fila editable de la vista de revisión de tareas propuestas por la IA.
interface FilaRevision {
  id: string
  incluir: boolean
  titulo: string
  responsableId: string
  moduloId: string
  fecha: string
}

export default function ReunionDetalle() {
  const { t } = useTranslation()
  const TIPOS = tiposReunion()
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const { data: reunion, isLoading } = useReunion(id)
  const { data: proyectos } = useProyectos()
  const { data: personas } = usePersonas()
  const { data: asistentes } = useAsistentes(id)
  const actualizar = useActualizarReunion()
  const crearTarea = useCrearTarea()
  const actualizarModulo = useActualizarModulo()

  const proyectoId = reunion?.proyecto_id ?? ''
  const { data: modulos } = useModulos(proyectoId)
  const { data: sprints } = useSprints(proyectoId)
  const { data: tareasCreadas } = useTareasReunion(id)

  const personaPorId = useMemo(
    () => new Map((personas ?? []).map((p) => [p.id, p])),
    [personas],
  )

  // --- Notas con autoguardado (debounce + onBlur) ---
  const [notas, setNotas] = useState('')
  const notasReales = reunion?.notas ?? ''
  // Sincroniza el estado local cuando llega/cambia la reunión del servidor.
  useEffect(() => {
    setNotas(notasReales)
  }, [notasReales])

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }, [])

  const guardarNotas = (valor: string) => {
    if (!reunion || valor === notasReales) return
    actualizar.mutate({ id: reunion.id, proyectoId: reunion.proyecto_id, cambios: { notas: valor } })
  }

  const onCambiarNotas = (valor: string) => {
    setNotas(valor)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => guardarNotas(valor), 700)
  }

  const onBlurNotas = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    guardarNotas(notas)
  }

  // --- Descripción (agenda) con autoguardado, mismo patrón que las notas ---
  const [descripcion, setDescripcion] = useState('')
  const descripcionReal = reunion?.descripcion ?? ''
  useEffect(() => {
    setDescripcion(descripcionReal)
  }, [descripcionReal])

  const descDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (descDebounceRef.current) clearTimeout(descDebounceRef.current)
  }, [])

  const guardarDescripcion = (valor: string) => {
    if (!reunion || valor === descripcionReal) return
    actualizar.mutate({ id: reunion.id, proyectoId: reunion.proyecto_id, cambios: { descripcion: valor || null } })
  }

  const onCambiarDescripcion = (valor: string) => {
    setDescripcion(valor)
    if (descDebounceRef.current) clearTimeout(descDebounceRef.current)
    descDebounceRef.current = setTimeout(() => guardarDescripcion(valor), 700)
  }

  // Hora y alerta: guardan al instante (selects/inputs chicos).
  const onCambiarHora = (valor: string) => {
    if (!reunion) return
    actualizar.mutate({ id: reunion.id, proyectoId: reunion.proyecto_id, cambios: { hora: valor || null } })
  }
  const onCambiarAlerta = (valor: string) => {
    if (!reunion) return
    const min = valor === '' ? null : Number(valor)
    if (min !== null) void pedirPermisoNotificaciones()
    actualizar.mutate({ id: reunion.id, proyectoId: reunion.proyecto_id, cambios: { alerta_min: min } })
  }

  // Reunión de cliente: la extracción produce CORRECCIONES (feedback del cliente).
  const esCliente = reunion?.tipo === 'cliente'

  // --- Extracción de tareas con IA ---
  const [cargandoIA, setCargandoIA] = useState(false)
  const [errorIA, setErrorIA] = useState<string | null>(null)
  const [revision, setRevision] = useState<FilaRevision[] | null>(null)
  // Nombres de módulos que se reabrieron al confirmar correcciones de cliente.
  const [reabiertos, setReabiertos] = useState<string[]>([])

  const matchResponsable = (sugerido: string | null): string => {
    if (!sugerido) return ''
    const s = sugerido.toLowerCase()
    const match = (personas ?? []).find(
      (p) => p.nombre.toLowerCase().includes(s) || s.includes(p.nombre.toLowerCase()),
    )
    return match?.id ?? ''
  }

  const matchModulo = (sugerido: string | null): string => {
    const lista = modulos ?? []
    if (lista.length === 0) return ''
    if (sugerido) {
      const s = sugerido.toLowerCase()
      const match = lista.find(
        (m) => m.nombre.toLowerCase().includes(s) || s.includes(m.nombre.toLowerCase()),
      )
      if (match) return match.id
    }
    return lista[0].id
  }

  const aFila = (tp: TareaPropuesta): FilaRevision => ({
    id: crypto.randomUUID(),
    incluir: true,
    titulo: tp.titulo,
    responsableId: matchResponsable(tp.responsable_sugerido),
    moduloId: matchModulo(tp.modulo_sugerido),
    fecha: tp.fecha ?? '',
  })

  const onExtraer = async () => {
    if (!reunion) return
    setCargandoIA(true)
    setErrorIA(null)
    try {
      const propuestas = await extraerTareas({
        notas,
        personas: (personas ?? []).map((p) => ({ id: p.id, nombre: p.nombre })),
        modulos: (modulos ?? []).map((m) => ({ id: m.id, nombre: m.nombre })),
        esCliente,
      })
      setRevision(propuestas.map(aFila))
    } catch (e) {
      setErrorIA(e instanceof Error ? e.message : t('reunionDetalle.errExtraer'))
    } finally {
      setCargandoIA(false)
    }
  }

  const actualizarFila = (filaId: string, cambios: Partial<FilaRevision>) => {
    setRevision((prev) =>
      prev ? prev.map((f) => (f.id === filaId ? { ...f, ...cambios } : f)) : prev,
    )
  }

  const incluidas = (revision ?? []).filter((f) => f.incluir && f.titulo.trim() && f.moduloId)

  const onConfirmar = () => {
    if (!reunion) return
    for (const f of incluidas) {
      crearTarea.mutate({
        modulo_id: f.moduloId,
        titulo: f.titulo.trim(),
        responsable_id: f.responsableId || null,
        fecha: f.fecha || null,
        sprint_id: reunion.sprint_id ?? null,
        reunion_id: reunion.id,
        // En reuniones de cliente, cada ítem confirmado es una corrección.
        tipo: esCliente ? 'correccion' : 'tarea',
      })
    }

    // Reapertura: si una corrección de cliente toca un módulo 'cerrado', reabrirlo.
    if (esCliente) {
      const modPorId = new Map((modulos ?? []).map((m) => [m.id, m]))
      const aReabrir = new Map<string, string>() // moduloId → nombre (dedup)
      for (const f of incluidas) {
        const mod = modPorId.get(f.moduloId)
        if (mod && mod.estado === 'cerrado' && !aReabrir.has(mod.id)) {
          aReabrir.set(mod.id, mod.nombre)
        }
      }
      for (const [moduloId] of aReabrir) {
        actualizarModulo.mutate({
          id: moduloId,
          proyectoId: reunion.proyecto_id,
          cambios: { estado: 'abierto' },
        })
      }
      setReabiertos([...aReabrir.values()])
    }

    setRevision(null)
  }

  if (isLoading) {
    return (
      <div className="h-screen overflow-auto">
        <div className="mx-auto max-w-[780px] px-11 pb-24 pt-[34px]">
          <Skeleton className="mb-[18px] h-4 w-24 rounded" />
          <Skeleton className="mb-[7px] h-6 w-64 rounded" />
          <Skeleton className="mb-[26px] h-8 w-80 rounded" />
          <Skeleton className="mb-2.5 h-3 w-40 rounded" />
          <Skeleton className="h-48 w-full rounded-[13px]" />
        </div>
      </div>
    )
  }
  if (!reunion) {
    return (
      <div className="mx-auto max-w-[780px] px-11 pt-[60px]">
        <EmptyState
          icon={
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.5 3.5h11v9h-7l-3 2.5z" />
              <path d="M8 6v2.5M8 10.5h.01" />
            </svg>
          }
          titulo={t('reunionDetalle.noEncontrada')}
          descripcion={t('reunionDetalle.noEncontradaDesc')}
          accion={
            <button
              type="button"
              onClick={() => navigate('/reuniones')}
              className="rounded-[9px] border border-line bg-canvas px-[15px] py-2 text-[13.5px] font-semibold text-ink transition-colors hover:bg-hover"
            >
              {t('reunionDetalle.volverAReuniones')}
            </button>
          }
        />
      </div>
    )
  }

  const tipo = TIPOS[reunion.tipo]
  const proyecto = (proyectos ?? []).find((p) => p.id === reunion.proyecto_id)
  const sprint = reunion.sprint_id
    ? (sprints ?? []).find((s) => s.id === reunion.sprint_id)
    : undefined
  const fecha = fmtFechaCompleta(reunion.fecha)

  const sprintTexto = sprint
    ? [sprint.nombre, [fmtFecha(sprint.fecha_inicio), fmtFecha(sprint.fecha_fin)].filter(Boolean).join('–')]
        .filter(Boolean)
        .join(' · ')
    : null

  return (
    <div className="h-screen overflow-auto">
      <div className="mx-auto max-w-[780px] px-11 pb-24 pt-[34px]">
        <button
          type="button"
          onClick={() => navigate('/reuniones')}
          className="mb-[18px] flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 3L5 8l5 5" />
          </svg>
          {t('nav.reuniones')}
        </button>

        <div className="mb-[7px] flex flex-wrap items-center gap-2.5">
          {proyecto && (
            <span className="flex items-center gap-1.5 rounded-[7px] border border-line bg-canvas px-[9px] py-[3px] text-xs font-semibold text-ink-soft">
              <span className="inline-block h-[9px] w-[9px] flex-none rounded-[2px]" style={{ background: proyecto.color }} />
              {proyecto.nombre}
            </span>
          )}
          <span
            className="rounded-[7px] px-2.5 py-[3px] text-[11.5px] font-bold"
            style={{ background: tipo.tint, color: tipo.color }}
          >
            {tipo.label}
          </span>
          {fecha && <span className="font-mono text-xs text-muted">{fecha}</span>}
          {sprintTexto && (
            <>
              <span className="text-xs text-faint">·</span>
              <span className="text-xs text-muted">{sprintTexto}</span>
            </>
          )}
        </div>

        <div className="mb-[26px] flex items-start justify-between gap-5">
          <h1 className="m-0 text-[25px] font-extrabold tracking-[-0.025em]">{reunion.titulo}</h1>
          <div className="flex-none pt-1">
            <AvatarStack
              personas={(asistentes ?? []).map((a) => ({ nombre: a.nombre, color: a.color }))}
              size={28}
            />
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[12.5px] text-muted">
            {t('reunionDetalle.hora')}
            <input
              type="time"
              value={reunion.hora ? reunion.hora.slice(0, 5) : ''}
              onChange={(e) => onCambiarHora(e.target.value)}
              className="rounded-[8px] border border-line bg-canvas px-2 py-1.5 text-[12.5px] text-ink outline-none focus:border-brand"
            />
          </label>
          <label className="flex items-center gap-2 text-[12.5px] text-muted">
            {t('reuniones.alerta')}
            <select
              value={reunion.alerta_min ?? ''}
              onChange={(e) => onCambiarAlerta(e.target.value)}
              className="rounded-[8px] border border-line bg-canvas px-2 py-1.5 text-[12.5px] text-ink outline-none focus:border-brand"
            >
              {alertas().map((a) => (
                <option key={a.label} value={a.min ?? ''}>{a.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.04em] text-faint">
          {t('reunionDetalle.descQueSeHara')}
        </div>
        <textarea
          value={descripcion}
          onChange={(e) => onCambiarDescripcion(e.target.value)}
          onBlur={() => {
            if (descDebounceRef.current) clearTimeout(descDebounceRef.current)
            guardarDescripcion(descripcion)
          }}
          aria-label={t('reunionDetalle.descAria')}
          placeholder={t('reuniones.descripcionPlaceholder')}
          rows={3}
          className="mb-7 w-full resize-y rounded-[13px] border border-line bg-canvas px-4 py-[13px] text-sm leading-relaxed text-ink outline-none focus:border-brand"
        />

        <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.04em] text-faint">
          {t('reunionDetalle.notasTitulo')}
        </div>
        <textarea
          value={notas}
          onChange={(e) => onCambiarNotas(e.target.value)}
          onBlur={onBlurNotas}
          aria-label={t('reunionDetalle.notasAria')}
          placeholder={t('reunionDetalle.notasPlaceholder')}
          rows={9}
          className="w-full resize-y rounded-[13px] border border-line bg-canvas px-4 py-[15px] text-sm leading-relaxed text-ink outline-none focus:border-brand"
        />

        <div className="mt-3.5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void onExtraer()}
            disabled={cargandoIA || !notas.trim()}
            className="flex items-center gap-2 rounded-[10px] bg-ink px-[17px] py-2.5 text-[13.5px] font-semibold text-canvas transition-colors hover:bg-[var(--color-ink-soft)] disabled:opacity-50"
          >
            {cargandoIA ? (
              <>
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-canvas/40 border-t-canvas" aria-hidden="true" />
                {t('reunionDetalle.analizandoNotas')}
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M8 1.5l1.6 3.5L13.5 6.5 10.7 9.2l.7 3.9L8 11.3 3.6 13.1l.7-3.9L1.5 6.5l3.9-1.5z" />
                </svg>
                {t('reunionDetalle.extraerIA')}
              </>
            )}
          </button>
          <span className="text-xs text-muted">
            {esCliente
              ? t('reunionDetalle.ayudaCliente')
              : t('reunionDetalle.ayudaTareas')}
          </span>
        </div>

        {esCliente && (
          <div className="mt-3 rounded-[10px] border border-[var(--color-warn-line)] bg-[var(--color-warn-tint)] px-3 py-2.5 text-[12.5px] text-[var(--color-warn)]">
            {t('reunionDetalle.avisoClientePre')}<strong>{t('reunionDetalle.correccionesWord')}</strong>{t('reunionDetalle.avisoClientePost')}
          </div>
        )}

        {reabiertos.length > 0 && (
          <div className="mt-3 rounded-[10px] border border-[var(--color-warn-line)] bg-[var(--color-warn-tint)] px-3 py-2.5 text-[13px] text-[var(--color-warn)]">
            {reabiertos.map((nombre) => (
              <div key={nombre}>{t('reunionDetalle.reabiertoPre')}<strong>{nombre}</strong>{t('reunionDetalle.reabiertoPost')}</div>
            ))}
          </div>
        )}

        {errorIA && (
          <div className="mt-3.5 rounded-[10px] border border-[var(--color-danger-line)] bg-[var(--color-danger-tint)] px-3 py-2.5 text-[13px] text-[var(--color-danger)]">
            {errorIA}
          </div>
        )}

        {revision && (
          <div className="mt-6 overflow-hidden rounded-[15px] border border-line bg-canvas">
            <div className="flex items-center gap-2 border-b border-line-soft bg-surface px-[18px] py-3.5">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="var(--color-brand-deep)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 1.5l1.6 3.5L13.5 6.5 10.7 9.2l.7 3.9L8 11.3 3.6 13.1l.7-3.9L1.5 6.5l3.9-1.5z" />
              </svg>
              <span className="text-[13.5px] font-bold">
                {esCliente ? t('reunionDetalle.correccionesDetectadas') : t('reunionDetalle.tareasDetectadas')}
              </span>
              <span className="text-xs text-muted">{t('reunionDetalle.revisaDesmarca')}</span>
            </div>

            {revision.length === 0 && (
              <div className="px-[18px] py-5 text-[13px] text-muted">
                {t('reunionDetalle.sinAccionables')}
              </div>
            )}

            {revision.map((f) => (
              <div
                key={f.id}
                className="flex flex-col gap-3 border-b border-line-soft px-[18px] py-3.5 md:flex-row md:items-center"
                style={{ opacity: f.incluir ? 1 : 0.5 }}
              >
                <label className="flex flex-1 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={f.incluir}
                    onChange={(e) => actualizarFila(f.id, { incluir: e.target.checked })}
                    className="h-[18px] w-[18px] flex-none accent-brand"
                  />
                  <input
                    value={f.titulo}
                    onChange={(e) => actualizarFila(f.id, { titulo: e.target.value })}
                    aria-label={t('reunionDetalle.tituloTareaAria')}
                    className="min-w-0 flex-1 rounded-[8px] border border-line bg-surface px-2.5 py-1.5 text-sm font-medium text-ink outline-none focus:border-brand"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-2 pl-[30px] md:pl-0">
                  <select
                    value={f.responsableId}
                    onChange={(e) => actualizarFila(f.id, { responsableId: e.target.value })}
                    aria-label={t('reunionDetalle.responsableAria')}
                    className="rounded-[8px] border border-line bg-surface px-2 py-1.5 text-[12.5px] text-ink outline-none"
                  >
                    <option value="">{t('reunionDetalle.sinResponsable')}</option>
                    {(personas ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                  <select
                    value={f.moduloId}
                    onChange={(e) => actualizarFila(f.id, { moduloId: e.target.value })}
                    aria-label={t('reunionDetalle.moduloAria')}
                    className="rounded-[8px] border border-line bg-surface px-2 py-1.5 text-[12.5px] text-ink outline-none"
                  >
                    {(modulos ?? []).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={f.fecha}
                    onChange={(e) => actualizarFila(f.id, { fecha: e.target.value })}
                    aria-label={t('reunionDetalle.fechaTareaAria')}
                    className="rounded-[8px] border border-line bg-surface px-2 py-1.5 text-[12.5px] text-ink outline-none"
                  />
                </div>
              </div>
            ))}

            <div className="flex items-center justify-end gap-2.5 px-[18px] py-3.5">
              <button
                type="button"
                onClick={() => setRevision(null)}
                className="rounded-[9px] border border-line bg-surface px-[15px] py-2 text-[13.5px] font-semibold text-ink-soft transition-colors hover:bg-hover"
              >
                {t('reunionDetalle.descartar')}
              </button>
              <button
                type="button"
                onClick={onConfirmar}
                disabled={incluidas.length === 0}
                className="flex items-center gap-1.5 rounded-[9px] bg-brand px-4 py-2 text-[13.5px] font-semibold text-on-brand transition-colors hover:bg-[var(--color-brand-strong)] disabled:opacity-50"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M8 3v10M3 8h10" />
                </svg>
                {esCliente
                  ? t('reunionDetalle.crearCorrecciones', { count: incluidas.length })
                  : t('reunionDetalle.crearTareas', { count: incluidas.length })}
              </button>
            </div>
          </div>
        )}

        {(tareasCreadas?.length ?? 0) > 0 && (
          <div className="mt-[30px]">
            <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.04em] text-faint">
              {t('reunionDetalle.tareasCreadasTitulo', { count: tareasCreadas?.length ?? 0 })}
            </div>
            <div className="overflow-hidden rounded-[13px] border border-line bg-canvas">
              {(tareasCreadas ?? []).map((tc) => {
                const resp = tc.responsable_id ? personaPorId.get(tc.responsable_id) : undefined
                const proy = tc.modulos?.proyectos
                return (
                  <div
                    key={tc.id}
                    className="flex items-center gap-3 border-b border-line-soft px-4 py-[11px]"
                  >
                    <span className="h-[9px] w-[9px] flex-none rounded-full bg-[var(--color-neutral-dot)]" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                      {tc.titulo}
                    </span>
                    {proy && (
                      <span className="flex flex-none items-center gap-1.5 text-[11.5px] text-muted-soft">
                        <span
                          className="inline-block h-2 w-2 rounded-[2px]"
                          style={{ background: proy.color }}
                        />
                        {proy.nombre}
                      </span>
                    )}
                    <Avatar nombre={resp?.nombre ?? '—'} color={resp?.color ?? 'var(--color-avatar-empty)'} size={26} />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
