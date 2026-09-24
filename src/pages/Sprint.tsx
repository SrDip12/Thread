import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import type { Tables } from '../lib/database.types.ts'
import { sprintEstadoVM } from '../lib/ui.ts'
import { useProyectos } from '../data/proyectos.ts'
import { useModulos } from '../data/modulos.ts'
import { useRealtimeProyecto } from '../data/realtime.ts'
import { useSprints } from '../data/sprints.ts'
import { CrearSprintRapido } from '../components/sprint/CrearSprintRapido.tsx'
import { VistaSprint } from '../components/sprint/VistaSprint.tsx'

type Sprint = Tables<'sprints'>

// Orden de la lista: activo primero, después planificados, cerrados al final.
const PESO_ESTADO: Record<Sprint['estado'], number> = { activo: 0, planificado: 1, cerrado: 2 }

export default function SprintPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const { data: proyectos } = useProyectos()
  const { data: sprints } = useSprints(id)
  const { data: modulosProyecto } = useModulos(id)
  const [selId, setSelId] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)

  useRealtimeProyecto(id, (modulosProyecto ?? []).map((m) => m.id))

  const proyecto = (proyectos ?? []).find((p) => p.id === id)
  const acento = proyecto?.color ?? 'var(--color-neutral)'

  const lista = [...(sprints ?? [])].sort(
    (a, b) =>
      PESO_ESTADO[a.estado] - PESO_ESTADO[b.estado] ||
      (a.created_at ?? '').localeCompare(b.created_at ?? ''),
  )
  const activo = lista.find((s) => s.estado === 'activo') ?? null
  // Selección: la elegida si sigue existiendo; si no, el activo; si no, el primero.
  const sel = lista.find((s) => s.id === selId) ?? activo ?? lista[0] ?? null

  return (
    <div className="h-screen overflow-auto bg-canvas">
      <div className="mx-auto max-w-[960px] px-4 sm:px-6 lg:px-11 pb-20 pt-[34px]">
        <Link
          to={`/proyectos/${id}`}
          className="mb-[18px] inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 3L5 8l5 5" />
          </svg>
          {proyecto?.nombre ?? t('common.proyecto')}
        </Link>

        <div className="mb-5 flex flex-wrap items-center gap-[11px]">
          <span className="h-3.5 w-3.5 flex-none rounded" style={{ background: acento }} />
          <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.025em]">{t('sprint.titulo')}</h1>
          {lista.length > 0 && (
            <span className="font-mono text-[12px] text-faint">{lista.length}</span>
          )}
          {lista.length > 0 && (
            <button
              type="button"
              onClick={() => setCreando((v) => !v)}
              className="ml-auto rounded-lg border border-line bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-muted transition-colors hover:bg-hover hover:text-ink"
            >
              {creando ? t('common.cancelar') : t('sprint.nuevoSprint')}
            </button>
          )}
        </div>

        {/* Selector: todos los sprints del proyecto, ninguno queda invisible. */}
        {lista.length > 1 && (
          <div className="mb-6 flex flex-wrap gap-1.5">
            {lista.map((s) => {
              const vm = sprintEstadoVM(s.estado)
              const elegido = sel?.id === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelId(s.id)}
                  className={`flex items-center gap-2 rounded-[10px] border px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                    elegido
                      ? 'border-brand bg-brand-tint text-ink'
                      : 'border-line bg-surface text-muted hover:bg-hover hover:text-ink'
                  }`}
                >
                  <span className="inline-block h-2 w-2 flex-none rounded-full" style={{ background: vm.dot }} />
                  <span className="max-w-[220px] truncate">{s.nombre}</span>
                </button>
              )
            })}
          </div>
        )}

        {(creando || lista.length === 0) && (
          <div className="mb-6">
            <CrearSprintRapido
              proyectoId={id}
              hayActivo={Boolean(activo)}
              onCreado={() => setCreando(false)}
            />
          </div>
        )}

        {sel && (
          <VistaSprint
            key={sel.id}
            sprint={sel}
            proyectoId={id}
            acento={acento}
            hayOtroActivo={Boolean(activo) && activo?.id !== sel.id}
          />
        )}
      </div>
    </div>
  )
}
