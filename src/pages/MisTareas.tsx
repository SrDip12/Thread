import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.tsx'
import { useMisTareas, useActualizarTarea, type TareaConProyecto } from '../data/tareas.ts'
import { estadoVM, ESTADOS, diasHasta } from '../lib/ui.ts'
import { rutaTarea } from '../lib/navegacion.ts'
import { Eyebrow, EstadoChip, FechaTag, Skeleton, EmptyState } from '../components/ui.tsx'

interface Grupo {
  proyectoId: string
  nombre: string
  color: string
  tareas: TareaConProyecto[]
}

type Filtro = 'pendientes' | 'hechas' | 'todas'

const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'pendientes', label: 'Pendientes' },
  { id: 'hechas', label: 'Hechas' },
  { id: 'todas', label: 'Todas' },
]

// Vencidas primero, luego por fecha ascendente; sin fecha al final; hechas últimas.
function ordenar(a: TareaConProyecto, b: TareaConProyecto): number {
  const aHecha = a.estado === 'hecho'
  const bHecha = b.estado === 'hecho'
  if (aHecha !== bHecha) return aHecha ? 1 : -1
  const da = a.fecha ? diasHasta(a.fecha) : Infinity
  const db = b.fecha ? diasHasta(b.fecha) : Infinity
  return da - db
}

export default function MisTareas() {
  const { persona } = useAuth()
  const navigate = useNavigate()
  const { data: tareas, isLoading } = useMisTareas(persona?.id ?? '')
  const actualizar = useActualizarTarea()
  const [filtro, setFiltro] = useState<Filtro>('pendientes')

  const todas = tareas ?? []
  const pendientes = todas.filter((t) => t.estado !== 'hecho')
  const vencidas = pendientes.filter((t) => t.fecha && diasHasta(t.fecha) < 0)

  const visibles =
    filtro === 'pendientes' ? pendientes : filtro === 'hechas' ? todas.filter((t) => t.estado === 'hecho') : todas

  const grupos = new Map<string, Grupo>()
  for (const t of visibles) {
    const proy = t.modulos?.proyectos
    if (!proy) continue
    const g = grupos.get(proy.id) ?? { proyectoId: proy.id, nombre: proy.nombre, color: proy.color, tareas: [] }
    g.tareas.push(t)
    grupos.set(proy.id, g)
  }
  for (const g of grupos.values()) g.tareas.sort(ordenar)

  const ciclar = (t: TareaConProyecto) => {
    const siguiente = ESTADOS[(ESTADOS.indexOf(t.estado) + 1) % ESTADOS.length]
    actualizar.mutate({ id: t.id, moduloId: t.modulo_id, cambios: { estado: siguiente } })
  }

  return (
    <div className="mx-auto max-w-[880px] px-11 pb-[90px] pt-10">
      <div className="mb-5">
        <Eyebrow>
          {pendientes.length} pendientes
          {vencidas.length > 0 && (
            <span className="ml-1.5 rounded bg-[var(--color-danger-tint)] px-1.5 py-[1px] font-bold text-[var(--color-danger)]">
              {vencidas.length} vencidas
            </span>
          )}
        </Eyebrow>
        <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.025em]">Mis tareas</h1>
      </div>

      <div className="mb-[26px] flex items-center gap-1.5">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltro(f.id)}
            className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
              filtro === f.id
                ? 'border-brand bg-brand-tint text-brand-strong'
                : 'border-line bg-surface text-muted hover:bg-hover hover:text-ink'
            }`}
          >
            {f.label}
          </button>
        ))}
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
      {!isLoading && visibles.length === 0 && (
        <EmptyState
          icon={
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.5 8.5l3 3 6-6.5" />
              <circle cx="8" cy="8" r="6.5" />
            </svg>
          }
          titulo={filtro === 'pendientes' ? 'Nada pendiente' : filtro === 'hechas' ? 'Todavía sin tareas hechas' : 'No tenés tareas asignadas'}
          descripcion={
            filtro === 'pendientes'
              ? 'Cuando alguien te asigne una tarea (o exista alguna sin terminar), aparecerá acá.'
              : 'Cuando alguien te asigne una tarea en cualquier proyecto, aparecerá acá.'
          }
        />
      )}

      {[...grupos.values()].map((g) => (
        <div key={g.proyectoId} className="mb-[26px]">
          <div className="mb-[9px] flex items-center gap-[9px] px-0.5">
            <span className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: g.color }} />
            <h2 className="m-0 text-sm font-bold tracking-[-0.01em]">{g.nombre}</h2>
            <span className="font-mono text-[11.5px] text-faint">{g.tareas.length}</span>
          </div>
          <div className="overflow-hidden rounded-[13px] border border-line bg-surface">
            {g.tareas.map((t) => {
              const vm = estadoVM(t.estado)
              return (
                <div
                  key={t.id}
                  className="flex w-full items-center gap-3 border-b border-line-soft px-4 py-[11px] transition-colors hover:bg-row-hover"
                >
                  <span className="h-[9px] w-[9px] flex-none rounded-full" style={{ background: vm.dot }} />
                  <button
                    type="button"
                    onClick={() => navigate(rutaTarea(g.proyectoId, t.id, '/mis-tareas'))}
                    className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline"
                    style={{ color: vm.done ? 'var(--color-muted)' : 'var(--color-ink)' }}
                  >
                    {t.titulo}
                  </button>
                  <span className="text-[11.5px] text-faint">{t.modulos?.nombre}</span>
                  <FechaTag fecha={t.fecha} done={vm.done} />
                  <EstadoChip estado={t.estado} onClick={() => ciclar(t)} />
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
