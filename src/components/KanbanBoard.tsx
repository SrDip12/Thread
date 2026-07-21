import { useTranslation } from 'react-i18next'
import type { Tables } from '../lib/database.types.ts'
import { estadoVM } from '../lib/ui.ts'
import { Avatar, FechaTag } from './ui.tsx'

type Tarea = Tables<'tareas'>
type Persona = Tables<'personas'>

interface KanbanBoardProps {
  tareas: Tarea[]
  personaPorId: Map<string, Persona>
  proyectoId: string
  proyectoDeps: { bloqueadora_id: string; bloqueada_id: string }[]
  todasLasTareas: Tarea[]
  onAbrir: (taskId: string) => void
  onMoverTarea: (taskId: string, nuevoEstado: Tarea['estado']) => void
  moduloNombres?: Map<string, string> // Opcional para mostrar el nombre del módulo en la tarjeta (ej. en Sprint o vista global)
}

const COLUMNAS: { estado: Tarea['estado']; labelKey: string }[] = [
  { estado: 'proximo', labelKey: 'kanban.pendiente' },
  { estado: 'en_curso', labelKey: 'kanban.en_curso' },
  { estado: 'revision', labelKey: 'kanban.revision' },
  { estado: 'hecho', labelKey: 'kanban.hecho' },
]

export default function KanbanBoard({
  tareas,
  personaPorId,
  proyectoId: _proyectoId,
  proyectoDeps,
  todasLasTareas,
  onAbrir,
  onMoverTarea,
  moduloNombres,
}: KanbanBoardProps) {
  const { t } = useTranslation()

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, nuevoEstado: Tarea['estado']) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('text/plain')
    if (taskId) {
      onMoverTarea(taskId, nuevoEstado)
    }
  }

  return (
    <div className="flex gap-4 min-h-[500px] items-start select-none">
      {COLUMNAS.map(({ estado, labelKey }) => {
        const tareasColumna = tareas.filter((t) => t.estado === estado)
        const vm = estadoVM(estado)
        
        return (
          <div
            key={estado}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, estado)}
            className="flex-1 min-w-[220px] rounded-[13px] bg-[var(--color-neutral-tint)] p-3 flex flex-col gap-3 min-h-[500px] border border-line-soft transition-colors duration-200"
          >
            {/* Header de la columna */}
            <div className="flex items-center justify-between px-1.5 py-0.5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: vm.dot }} />
                <span className="text-[12.5px] font-bold text-ink-soft uppercase tracking-[0.02em]">{t(labelKey)}</span>
              </div>
              <span className="font-mono text-[11px] font-semibold text-faint bg-canvas px-2 py-0.5 rounded-full">
                {tareasColumna.length}
              </span>
            </div>

            {/* Lista de tarjetas */}
            <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[70vh] custom-scrollbar">
              {tareasColumna.length === 0 ? (
                <div className="text-center py-8 text-[11.5px] text-faint border border-dashed border-[var(--color-line)] rounded-lg">
                  {t('kanban.arrastrarAqui')}
                </div>
              ) : (
                tareasColumna.map((tarea) => {
                  const resp = tarea.responsable_id ? personaPorId.get(tarea.responsable_id) : undefined

                  // Calcular si la tarea está bloqueada
                  const isBlocked = proyectoDeps
                    .filter((d) => d.bloqueada_id === tarea.id)
                    .some((d) => {
                      const b = todasLasTareas.find((x) => x.id === d.bloqueadora_id)
                      return b ? b.estado !== 'hecho' : false
                    })

                  const moduloNombre = moduloNombres?.get(tarea.modulo_id)

                  return (
                    <div
                      key={tarea.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', tarea.id)
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onClick={() => onAbrir(tarea.id)}
                      className="group cursor-grab active:cursor-grabbing rounded-[10px] border border-line bg-surface p-3 shadow-sm transition-all duration-150 hover:shadow-md hover:border-brand-tint"
                    >
                      <div className="flex items-start gap-2 justify-between mb-2">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          {isBlocked && (
                            <span className="text-brand flex-none" title={t('kanban.tareaBloqueada')}>
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="inline">
                                <rect x="3" y="11" width="10" height="4" rx="1" />
                                <path d="M4 11V6a4 4 0 0 1 8 0v5" />
                              </svg>
                            </span>
                          )}
                          <h4 className="m-0 text-[13.5px] font-semibold text-ink leading-snug group-hover:text-brand transition-colors duration-150 truncate">
                            {tarea.titulo}
                          </h4>
                        </div>
                        {tarea.tipo === 'correccion' && (
                          <span
                            className="flex-none rounded-md px-1.5 py-[2px] text-[8.5px] font-bold uppercase tracking-[0.03em]"
                            style={{ background: 'var(--color-warn-tint)', color: 'var(--color-warn)' }}
                          >
                            !
                          </span>
                        )}
                      </div>

                      {moduloNombre && (
                        <div className="mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-[0.03em] text-faint bg-canvas px-1.5 py-0.5 rounded">
                            {moduloNombre}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-2 pt-1 border-t border-line-soft">
                        <div className="flex items-center gap-2">
                          <FechaTag fecha={tarea.fecha} done={tarea.estado === 'hecho'} />
                        </div>
                        {resp ? (
                          <Avatar nombre={resp.nombre} color={resp.color} size={22} />
                        ) : (
                          <Avatar nombre="—" color="var(--color-avatar-empty)" size={22} />
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
