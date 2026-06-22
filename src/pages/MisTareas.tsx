import { useNavigate } from 'react-router-dom'
import { fmtFecha } from '../lib/ui.ts'
import { useAuth } from '../auth/AuthProvider.tsx'
import { useMisTareas, type TareaConProyecto } from '../data/tareas.ts'
import { estadoVM } from '../lib/ui.ts'
import { Eyebrow, EstadoChip, Skeleton, EmptyState } from '../components/ui.tsx'

interface Grupo {
  proyectoId: string
  nombre: string
  color: string
  tareas: TareaConProyecto[]
}

export default function MisTareas() {
  const { persona } = useAuth()
  const navigate = useNavigate()
  const { data: tareas, isLoading } = useMisTareas(persona?.id ?? '')

  const grupos = new Map<string, Grupo>()
  for (const t of tareas ?? []) {
    const proy = t.modulos?.proyectos
    if (!proy) continue
    const g = grupos.get(proy.id) ?? { proyectoId: proy.id, nombre: proy.nombre, color: proy.color, tareas: [] }
    g.tareas.push(t)
    grupos.set(proy.id, g)
  }

  return (
    <div className="mx-auto max-w-[880px] px-11 pb-[90px] pt-10">
      <div className="mb-[30px]">
        <Eyebrow>{tareas?.length ?? 0} tareas asignadas</Eyebrow>
        <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.025em]">Mis tareas</h1>
      </div>

      {isLoading && (
        <div className="space-y-[26px]">
          {[0, 1].map((i) => (
            <div key={i}>
              <div className="mb-[9px] flex items-center gap-[9px] px-0.5">
                <Skeleton className="h-2.5 w-2.5 rounded-[3px]" />
                <Skeleton className="h-4 w-40" />
              </div>
              <div className="overflow-hidden rounded-[13px] border border-line bg-surface">
                {[0, 1, 2].map((j) => (
                  <Skeleton key={j} className="h-[43px] rounded-none border-b border-line-soft" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {!isLoading && (tareas?.length ?? 0) === 0 && (
        <EmptyState
          icon={
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.5 8.5l3 3 6-6.5" />
              <circle cx="8" cy="8" r="6.5" />
            </svg>
          }
          titulo="No tenés tareas asignadas"
          descripcion="Cuando alguien te asigne una tarea en cualquier proyecto, aparecerá acá."
        />
      )}

      {[...grupos.values()].map((g) => (
        <div key={g.proyectoId} className="mb-[26px]">
          <div className="mb-[9px] flex items-center gap-[9px] px-0.5">
            <span className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: g.color }} />
            <h2 className="m-0 text-sm font-bold tracking-[-0.01em]">{g.nombre}</h2>
          </div>
          <div className="overflow-hidden rounded-[13px] border border-line bg-surface">
            {g.tareas.map((t) => {
              const vm = estadoVM(t.estado)
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => navigate(`/proyectos/${g.proyectoId}`)}
                  className="flex w-full items-center gap-3 border-b border-line-soft px-4 py-[11px] text-left transition-colors hover:bg-row-hover"
                >
                  <span className="h-[9px] w-[9px] flex-none rounded-full" style={{ background: vm.dot }} />
                  <span
                    className="min-w-0 flex-1 truncate text-sm font-medium"
                    style={{ color: vm.done ? '#a39d92' : '#1c1b19' }}
                  >
                    {t.titulo}
                  </span>
                  <span className="text-[11.5px] text-faint">{t.modulos?.nombre}</span>
                  {fmtFecha(t.fecha) && (
                    <span className="flex-none font-mono text-[11.5px] text-muted">{fmtFecha(t.fecha)}</span>
                  )}
                  <EstadoChip estado={t.estado} />
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
