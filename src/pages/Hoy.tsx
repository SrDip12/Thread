// "Hoy": el plan del día en una pantalla. Qué venció, qué vence hoy, qué viene
// esta semana y las reuniones del día — con acción directa (ciclar estado, abrir).
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.tsx'
import { useMisTareas, useActualizarTarea, type TareaConProyecto } from '../data/tareas.ts'
import { useReuniones, type Reunion } from '../data/reuniones.ts'
import { momentoReunion } from '../data/recordatorios.ts'
import { useProyectos } from '../data/proyectos.ts'
import { estadoVM, ESTADOS, diasHasta, TIPOS_REUNION, fmtFecha } from '../lib/ui.ts'
import { rutaTarea } from '../lib/navegacion.ts'
import { Eyebrow, EstadoChip, FechaTag, Skeleton, EmptyState } from '../components/ui.tsx'

// Días desde hoy (0 = hoy) hasta el momento de la reunión, en días de calendario.
function diasReunion(r: Reunion): number {
  const m = momentoReunion(r)
  return diasHasta(
    `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(m.getDate()).padStart(2, '0')}`,
  )
}

export default function Hoy() {
  const navigate = useNavigate()
  const { persona } = useAuth()
  const { data: tareas, isLoading: cargandoTareas } = useMisTareas(persona?.id ?? '')
  const { data: reuniones, isLoading: cargandoReuniones } = useReuniones(null)
  const { data: proyectos } = useProyectos()
  const actualizar = useActualizarTarea()

  const proyectoPorId = new Map((proyectos ?? []).map((p) => [p.id, p]))
  const pendientes = (tareas ?? []).filter((t) => t.estado !== 'hecho')

  const vencidas = pendientes.filter((t) => t.fecha && diasHasta(t.fecha) < 0)
  const paraHoy = pendientes.filter((t) => t.fecha && diasHasta(t.fecha) === 0)
  const semana = pendientes
    .filter((t) => {
      if (!t.fecha) return false
      const d = diasHasta(t.fecha)
      return d >= 1 && d <= 7
    })
    .sort((a, b) => diasHasta(a.fecha as string) - diasHasta(b.fecha as string))
  const enCurso = pendientes.filter((t) => t.estado === 'en_curso' && !t.fecha)

  const reunionesHoy = (reuniones ?? [])
    .filter((r) => diasReunion(r) === 0)
    .sort((a, b) => momentoReunion(a).getTime() - momentoReunion(b).getTime())
  const reunionesProximas = (reuniones ?? [])
    .filter((r) => {
      const d = diasReunion(r)
      return d >= 1 && d <= 7
    })
    .sort((a, b) => momentoReunion(a).getTime() - momentoReunion(b).getTime())
    .slice(0, 4)

  const ciclar = (t: TareaConProyecto) => {
    const siguiente = ESTADOS[(ESTADOS.indexOf(t.estado) + 1) % ESTADOS.length]
    actualizar.mutate({ id: t.id, moduloId: t.modulo_id, cambios: { estado: siguiente } })
  }

  const cargando = cargandoTareas || cargandoReuniones
  const diaDespejado =
    !cargando &&
    vencidas.length === 0 &&
    paraHoy.length === 0 &&
    semana.length === 0 &&
    enCurso.length === 0 &&
    reunionesHoy.length === 0 &&
    reunionesProximas.length === 0

  const fechaLarga = new Date().toLocaleDateString('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="mx-auto max-w-[880px] px-11 pb-[90px] pt-10">
      <div className="mb-[30px]">
        <Eyebrow>{fechaLarga}</Eyebrow>
        <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.025em]">
          Hoy{persona ? `, ${persona.nombre.split(' ')[0]}` : ''}
        </h1>
        {!cargando && (
          <p className="mt-[7px] text-sm text-muted-soft">
            {vencidas.length > 0 && (
              <span className="font-semibold text-[var(--color-danger)]">
                {vencidas.length} {vencidas.length === 1 ? 'tarea vencida' : 'tareas vencidas'} ·{' '}
              </span>
            )}
            {paraHoy.length} para hoy · {reunionesHoy.length}{' '}
            {reunionesHoy.length === 1 ? 'reunión' : 'reuniones'} hoy
          </p>
        )}
      </div>

      {cargando && (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[110px] w-full rounded-[13px]" />
          ))}
        </div>
      )}

      {diaDespejado && (
        <EmptyState
          icon={
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="3.2" />
              <path d="M8 1.2v1.6M8 13.2v1.6M1.2 8h1.6M13.2 8h1.6M3.3 3.3l1.1 1.1M11.6 11.6l1.1 1.1M12.7 3.3l-1.1 1.1M4.4 11.6l-1.1 1.1" />
            </svg>
          }
          titulo="Día despejado"
          descripcion="Sin vencimientos ni reuniones a la vista. Mirá el backlog de tus proyectos si querés adelantar."
        />
      )}

      {vencidas.length > 0 && (
        <SeccionHoy titulo="Vencidas" extra={`${vencidas.length}`} alerta>
          {vencidas.map((t) => (
            <FilaTareaHoy key={t.id} t={t} onAbrir={navigate} onCiclar={() => ciclar(t)} />
          ))}
        </SeccionHoy>
      )}

      {paraHoy.length > 0 && (
        <SeccionHoy titulo="Para hoy" extra={`${paraHoy.length}`}>
          {paraHoy.map((t) => (
            <FilaTareaHoy key={t.id} t={t} onAbrir={navigate} onCiclar={() => ciclar(t)} />
          ))}
        </SeccionHoy>
      )}

      {semana.length > 0 && (
        <SeccionHoy titulo="Esta semana" extra={`${semana.length}`}>
          {semana.map((t) => (
            <FilaTareaHoy key={t.id} t={t} onAbrir={navigate} onCiclar={() => ciclar(t)} />
          ))}
        </SeccionHoy>
      )}

      {enCurso.length > 0 && (
        <SeccionHoy titulo="En curso, sin fecha" extra={`${enCurso.length}`}>
          {enCurso.map((t) => (
            <FilaTareaHoy key={t.id} t={t} onAbrir={navigate} onCiclar={() => ciclar(t)} />
          ))}
        </SeccionHoy>
      )}

      {/* Las reuniones van al final: lo primero que se ve al abrir la app son las tareas. */}
      {(reunionesHoy.length > 0 || reunionesProximas.length > 0) && (
        <SeccionHoy titulo="Reuniones" extra={`${reunionesHoy.length} hoy`}>
          {reunionesHoy.map((r) => (
            <FilaReunion key={r.id} r={r} color={proyectoPorId.get(r.proyecto_id)?.color} hoy />
          ))}
          {reunionesProximas.map((r) => (
            <FilaReunion key={r.id} r={r} color={proyectoPorId.get(r.proyecto_id)?.color} />
          ))}
        </SeccionHoy>
      )}
    </div>
  )
}

function SeccionHoy({
  titulo,
  extra,
  alerta = false,
  children,
}: {
  titulo: string
  extra?: string
  alerta?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="mb-[26px]">
      <div className="mb-[9px] flex items-center gap-2.5 px-0.5">
        <h2
          className="m-0 text-[13px] font-bold uppercase tracking-[0.02em]"
          style={{ color: alerta ? 'var(--color-danger)' : 'var(--color-label)' }}
        >
          {titulo}
        </h2>
        {extra && <span className="font-mono text-[11.5px] text-faint">{extra}</span>}
        <div className="h-px flex-1 bg-line" />
      </div>
      <div
        className={`overflow-hidden rounded-[13px] border bg-surface ${
          alerta ? 'border-[var(--color-danger-line)]' : 'border-line'
        }`}
      >
        {children}
      </div>
    </div>
  )
}

function FilaTareaHoy({
  t,
  onAbrir,
  onCiclar,
}: {
  t: TareaConProyecto
  onAbrir: (ruta: string) => void
  onCiclar: () => void
}) {
  const vm = estadoVM(t.estado)
  const proy = t.modulos?.proyectos
  return (
    <div className="flex w-full items-center gap-3 border-b border-line-soft px-4 py-[11px] last:border-b-0 transition-colors hover:bg-row-hover">
      <span className="h-[9px] w-[9px] flex-none rounded-full" style={{ background: vm.dot }} />
      <button
        type="button"
        onClick={() => proy && onAbrir(rutaTarea(proy.id, t.id, '/hoy'))}
        className="min-w-0 flex-1 truncate text-left text-sm font-medium text-ink hover:underline"
      >
        {t.titulo}
      </button>
      {proy && (
        <span className="flex flex-none items-center gap-1.5 text-[11.5px] text-muted-soft">
          <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: proy.color }} />
          {proy.nombre}
        </span>
      )}
      <FechaTag fecha={t.fecha} done={vm.done} />
      <EstadoChip estado={t.estado} onClick={onCiclar} />
    </div>
  )
}

function FilaReunion({ r, color, hoy = false }: { r: Reunion; color?: string; hoy?: boolean }) {
  const navigate = useNavigate()
  const tipo = TIPOS_REUNION[r.tipo]
  const hora = r.hora ? r.hora.slice(0, 5) : null
  return (
    <button
      type="button"
      onClick={() => navigate(`/reuniones/${r.id}`)}
      className="flex w-full items-center gap-3 border-b border-line-soft px-4 py-[11px] text-left last:border-b-0 transition-colors hover:bg-row-hover"
    >
      <span
        className="flex-none rounded-md px-2 py-[2px] text-[11px] font-semibold"
        style={{ background: tipo.tint, color: tipo.color }}
      >
        {tipo.label}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{r.titulo}</span>
      {color && <span className="inline-block h-2 w-2 flex-none rounded-[2px]" style={{ background: color }} />}
      <span className="flex-none font-mono text-[11.5px] font-semibold text-muted">
        {hoy ? (hora ?? 'hoy') : `${fmtFecha(r.fecha.slice(0, 10))}${hora ? ` · ${hora}` : ''}`}
      </span>
    </button>
  )
}
