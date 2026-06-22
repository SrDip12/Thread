import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Enums } from '../lib/database.types.ts'
import { useProyectos } from '../data/proyectos.ts'
import { usePersonas } from '../data/personas.ts'
import { useSprints } from '../data/sprints.ts'
import { useReuniones, useCrearReunion } from '../data/reuniones.ts'
import { ALERTAS, pedirPermisoNotificaciones } from '../data/recordatorios.ts'
import { Eyebrow, Skeleton, EmptyState } from '../components/ui.tsx'

type TipoReunion = Enums<'tipo_reunion'>

// Mapa de tipo de reunión → etiqueta + colores (chip).
const TIPOS: Record<TipoReunion, { label: string; color: string; tint: string }> = {
  sprint_planning: { label: 'Sprint planning', color: '#bb6a3e', tint: '#f8ece2' },
  retro: { label: 'Retro', color: '#477155', tint: '#e7efe9' },
  sync: { label: 'Sync', color: '#43618f', tint: '#e8eef6' },
  cliente: { label: 'Cliente', color: '#a96a23', tint: '#f9ecdc' },
  otro: { label: 'Otro', color: '#7a5a8c', tint: '#f0e9f3' },
}

const ORDEN_TIPOS: TipoReunion[] = ['sprint_planning', 'retro', 'sync', 'cliente', 'otro']

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// Fecha completa "12 jun 2026" a partir de un timestamptz (o date). null si no hay.
function fmtFechaCompleta(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`
}

export default function Reuniones() {
  const navigate = useNavigate()
  const [filtroProyecto, setFiltroProyecto] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)

  const { data: proyectos } = useProyectos()
  const { data: reuniones, isLoading } = useReuniones(filtroProyecto)

  const proyectoPorId = useMemo(
    () => new Map((proyectos ?? []).map((p) => [p.id, p])),
    [proyectos],
  )

  return (
    <div className="mx-auto max-w-[860px] px-11 pb-20 pt-10">
      <div className="mb-[30px] flex items-end justify-between gap-6">
        <div>
          <Eyebrow>{reuniones?.length ?? 0} registradas</Eyebrow>
          <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.025em]">Reuniones</h1>
          <p className="mt-[7px] text-sm text-muted-soft">
            Una bitácora de reuniones por proyecto. Tomá notas y convertí los acuerdos en tareas.
          </p>
        </div>
        <div className="flex flex-none items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/calendario')}
            className="flex items-center gap-1.5 rounded-[9px] border border-line bg-surface px-[15px] py-2.5 text-[13.5px] font-semibold text-ink transition-colors hover:bg-hover"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <rect x="2" y="3" width="12" height="11" rx="1.6" />
              <path d="M2 6.2h12M5.2 1.8v2.4M10.8 1.8v2.4" />
            </svg>
            Calendario
          </button>
          <button
            type="button"
            onClick={() => setCreando((v) => !v)}
            className="flex items-center gap-1.5 rounded-[9px] bg-ink px-[15px] py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#33302b]"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M8 3v10M3 8h10" />
            </svg>
            Nueva reunión
          </button>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-2.5">
        <label htmlFor="filtro-proyecto" className="text-xs font-medium text-muted">Proyecto</label>
        <select
          id="filtro-proyecto"
          value={filtroProyecto ?? ''}
          onChange={(e) => setFiltroProyecto(e.target.value || null)}
          className="rounded-[9px] border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink outline-none"
        >
          <option value="">Todos los proyectos</option>
          {(proyectos ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>

      {creando && (
        <NuevaReunionForm
          proyectoIdInicial={filtroProyecto}
          onCancelar={() => setCreando(false)}
          onCreada={(id) => navigate(`/reuniones/${id}`)}
        />
      )}

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[88px] rounded-[14px]" />
          ))}
        </div>
      )}
      {!isLoading && (reuniones?.length ?? 0) === 0 && (
        <EmptyState
          icon={
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.5 3.5h11v9h-7l-3 2.5z" />
              <path d="M5 6.5h6M5 9h4" />
            </svg>
          }
          titulo="Sin reuniones todavía"
          descripcion="Registrá una reunión para tomar notas y convertir los acuerdos en tareas."
          accion={
            !creando ? (
              <button
                type="button"
                onClick={() => setCreando(true)}
                className="flex items-center gap-1.5 rounded-[9px] bg-ink px-[15px] py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#33302b]"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M8 3v10M3 8h10" />
                </svg>
                Nueva reunión
              </button>
            ) : undefined
          }
        />
      )}

      <div className="flex flex-col gap-3">
        {(reuniones ?? []).map((m) => {
          const tipo = TIPOS[m.tipo]
          const proyecto = proyectoPorId.get(m.proyecto_id)
          const fecha = fmtFechaCompleta(m.fecha)
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => navigate(`/reuniones/${m.id}`)}
              className="rounded-[14px] border border-line bg-surface px-[19px] py-[17px] text-left transition-all hover:-translate-y-px hover:shadow-[0_8px_24px_-12px_rgba(40,35,30,0.16)]"
            >
              <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
                <span
                  className="rounded-[7px] px-2.5 py-[3px] text-[11.5px] font-bold"
                  style={{ background: tipo.tint, color: tipo.color }}
                >
                  {tipo.label}
                </span>
                {fecha && <span className="font-mono text-xs text-muted">{fecha}</span>}
                {proyecto && (
                  <span className="ml-auto flex items-center gap-1.5 text-[11.5px] text-muted-soft">
                    <span
                      className="inline-block h-2 w-2 flex-none rounded-[2px]"
                      style={{ background: proyecto.color }}
                    />
                    {proyecto.nombre}
                  </span>
                )}
              </div>
              <div className="text-base font-bold tracking-[-0.02em]">{m.titulo}</div>
              {m.sprint_id && <SprintLabel proyectoId={m.proyecto_id} sprintId={m.sprint_id} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Etiqueta del sprint asociado en la tarjeta de la lista.
function SprintLabel({ proyectoId, sprintId }: { proyectoId: string; sprintId: string }) {
  const { data: sprints } = useSprints(proyectoId)
  const sprint = (sprints ?? []).find((s) => s.id === sprintId)
  if (!sprint) return null
  return <div className="mt-2 text-[12px] text-muted">Sprint: {sprint.nombre}</div>
}

// Formulario inline para registrar (no agendar) una reunión.
function NuevaReunionForm({
  proyectoIdInicial,
  onCancelar,
  onCreada,
}: {
  proyectoIdInicial: string | null
  onCancelar: () => void
  onCreada: (id: string) => void
}) {
  const { data: proyectos } = useProyectos()
  const { data: personas } = usePersonas()
  const crear = useCrearReunion()

  const hoy = new Date().toISOString().slice(0, 10)
  const [proyectoId, setProyectoId] = useState(
    proyectoIdInicial ?? proyectos?.[0]?.id ?? '',
  )
  const [tipo, setTipo] = useState<TipoReunion>('sprint_planning')
  const [sprintId, setSprintId] = useState('')
  const [fecha, setFecha] = useState(hoy)
  const [hora, setHora] = useState('')
  const [alertaMin, setAlertaMin] = useState<number | null>(null)
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [asistentes, setAsistentes] = useState<string[]>([])

  const { data: sprints } = useSprints(proyectoId)

  const proyectoValido = proyectoId !== ''

  const toggleAsistente = (id: string) => {
    setAsistentes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const onCambiarProyecto = (id: string) => {
    setProyectoId(id)
    setSprintId('') // el sprint pertenece al proyecto anterior
  }

  const onCrear = () => {
    if (!proyectoValido || crear.isPending) return
    const tituloFinal = titulo.trim() || TIPOS[tipo].label
    crear.mutate(
      {
        reunion: {
          proyecto_id: proyectoId,
          tipo,
          titulo: tituloFinal,
          descripcion: descripcion.trim() || null,
          fecha: new Date(`${fecha}T00:00:00`).toISOString(),
          hora: hora || null,
          alerta_min: alertaMin,
          sprint_id: sprintId || null,
        },
        asistentes,
      },
      { onSuccess: (reunion) => onCreada(reunion.id) },
    )
  }

  // Al elegir una alerta, pedimos permiso de notificaciones (gesto del usuario).
  const onCambiarAlerta = (valor: string) => {
    const min = valor === '' ? null : Number(valor)
    setAlertaMin(min)
    if (min !== null) void pedirPermisoNotificaciones()
  }

  return (
    <div className="mb-6 rounded-[14px] border border-line bg-surface p-5">
      <div className="mb-4 text-[13px] font-bold uppercase tracking-[0.03em] text-label">
        Registrar reunión
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4">
        <Campo label="Proyecto">
          <select
            value={proyectoId}
            onChange={(e) => onCambiarProyecto(e.target.value)}
            className="w-full rounded-[9px] border border-line bg-canvas px-2.5 py-2 text-[13px] text-ink outline-none"
          >
            <option value="" disabled>
              Elegí un proyecto…
            </option>
            {(proyectos ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label="Tipo">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoReunion)}
            className="w-full rounded-[9px] border border-line bg-canvas px-2.5 py-2 text-[13px] text-ink outline-none"
          >
            {ORDEN_TIPOS.map((t) => (
              <option key={t} value={t}>
                {TIPOS[t].label}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label="Sprint (opcional)">
          <select
            value={sprintId}
            onChange={(e) => setSprintId(e.target.value)}
            disabled={!proyectoValido}
            className="w-full rounded-[9px] border border-line bg-canvas px-2.5 py-2 text-[13px] text-ink outline-none disabled:opacity-50"
          >
            <option value="">Sin sprint</option>
            {(sprints ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label="Fecha">
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full rounded-[9px] border border-line bg-canvas px-2.5 py-2 text-[13px] text-ink outline-none"
          />
        </Campo>

        <Campo label="Hora (opcional)">
          <input
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            className="w-full rounded-[9px] border border-line bg-canvas px-2.5 py-2 text-[13px] text-ink outline-none"
          />
        </Campo>

        <Campo label="Alerta">
          <select
            value={alertaMin ?? ''}
            onChange={(e) => onCambiarAlerta(e.target.value)}
            className="w-full rounded-[9px] border border-line bg-canvas px-2.5 py-2 text-[13px] text-ink outline-none"
          >
            {ALERTAS.map((a) => (
              <option key={a.label} value={a.min ?? ''}>{a.label}</option>
            ))}
          </select>
        </Campo>
      </div>

      <Campo label="Título (opcional)">
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder={TIPOS[tipo].label}
          className="w-full rounded-[9px] border border-line bg-canvas px-2.5 py-2 text-[13px] text-ink outline-none placeholder:text-faint"
        />
      </Campo>

      <div className="mt-4">
        <Campo label="Descripción · qué se hará en la reunión (opcional)">
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Agenda, objetivo, temas a tratar…"
            rows={2}
            className="w-full resize-y rounded-[9px] border border-line bg-canvas px-2.5 py-2 text-[13px] text-ink outline-none placeholder:text-faint"
          />
        </Campo>
      </div>

      <div className="mb-4 mt-4">
        <div className="mb-2 text-[12px] font-medium text-muted">Asistentes</div>
        <div className="flex flex-wrap gap-2">
          {(personas ?? []).map((p) => {
            const activo = asistentes.includes(p.id)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleAsistente(p.id)}
                className="flex items-center gap-1.5 rounded-[9px] border px-2.5 py-1.5 text-[12.5px] font-medium transition-colors"
                style={{
                  borderColor: activo ? p.color : '#e6e2da',
                  background: activo ? `${p.color}1a` : '#fff',
                  color: activo ? '#1c1b19' : '#6f6a62',
                }}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: p.color || '#c4bdb1' }}
                />
                {p.nombre}
              </button>
            )
          })}
        </div>
      </div>

      {crear.isError && (
        <div className="mb-3 rounded-[10px] border border-[#f0d8cc] bg-[#fbeee9] px-3 py-2.5 text-[13px] text-[#b5532f]">
          No se pudo crear la reunión.
        </div>
      )}

      <div className="flex items-center justify-end gap-2.5">
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-[9px] border border-line bg-canvas px-[15px] py-2 text-[13.5px] font-semibold text-ink transition-colors hover:bg-hover"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onCrear}
          disabled={!proyectoValido || crear.isPending}
          className="rounded-[9px] bg-[#c96442] px-4 py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#b85636] disabled:opacity-50"
        >
          {crear.isPending ? 'Creando…' : 'Crear reunión'}
        </button>
      </div>
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[12px] font-medium text-muted">{label}</div>
      {children}
    </div>
  )
}
