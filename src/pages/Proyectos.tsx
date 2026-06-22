import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useProyectos } from '../data/proyectos.ts'
import { useEstadisticasProyectos } from '../data/tareas.ts'
import { usePersonas } from '../data/personas.ts'
import { AvatarStack, EmptyState, Eyebrow, ProgressBar, Skeleton } from '../components/ui.tsx'
import NuevoProyecto from '../components/NuevoProyecto.tsx'

export default function Proyectos() {
  const navigate = useNavigate()
  const { data: proyectos, isLoading } = useProyectos()
  const { data: stats } = useEstadisticasProyectos()
  const { data: personas } = usePersonas()
  const [creando, setCreando] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  // La paleta de comandos abre el modal con ?nuevo=1; lo consumimos y limpiamos.
  useEffect(() => {
    if (searchParams.get('nuevo') === '1') {
      setCreando(true)
      searchParams.delete('nuevo')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const personaPorId = new Map((personas ?? []).map((p) => [p.id, p]))

  return (
    <div className="mx-auto max-w-[1120px] px-11 pb-20 pt-10">
      <div className="mb-[30px] flex items-end justify-between">
        <div>
          <Eyebrow>Equipo</Eyebrow>
          <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.025em]">Proyectos</h1>
        </div>
        <button
          type="button"
          onClick={() => setCreando(true)}
          className="rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          + Nuevo proyecto
        </button>
      </div>

      {creando && <NuevoProyecto onCerrar={() => setCreando(false)} />}

      {isLoading && (
        <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fill,minmax(310px,1fr))]">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[176px] rounded-[15px]" />
          ))}
        </div>
      )}

      {!isLoading && (proyectos?.length ?? 0) === 0 && (
        <EmptyState
          icon={
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
              <rect x="2" y="2" width="5" height="5" rx="1.2" />
              <rect x="9" y="2" width="5" height="5" rx="1.2" />
              <rect x="2" y="9" width="5" height="5" rx="1.2" />
              <rect x="9" y="9" width="5" height="5" rx="1.2" />
            </svg>
          }
          titulo="Todavía no hay proyectos"
          descripcion="Creá el primero y, si querés, subí un documento de requisitos para que la IA arme los módulos."
          accion={
            <button
              type="button"
              onClick={() => setCreando(true)}
              className="rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              + Nuevo proyecto
            </button>
          }
        />
      )}

      <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fill,minmax(310px,1fr))]">
        {(proyectos ?? []).map((p) => {
          const s = stats?.[p.id]
          const miembros = (s?.miembros ?? [])
            .slice(0, 5)
            .map((id) => personaPorId.get(id))
            .filter((x): x is NonNullable<typeof x> => Boolean(x))
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => navigate(`/proyectos/${p.id}`)}
              className="overflow-hidden rounded-[15px] border border-line bg-surface text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-10px_rgba(40,35,30,0.18)]"
            >
              <div className="h-1" style={{ background: p.color }} />
              <div className="px-[19px] pb-[17px] pt-[18px]">
                <div className="mb-[3px] flex items-center gap-[9px]">
                  <span className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: p.color }} />
                  <div className="text-[16.5px] font-bold tracking-[-0.02em]">{p.nombre}</div>
                </div>
                <div className="mb-5 text-[13px] text-muted-soft">{p.descripcion ?? ''}</div>

                <div className="mb-[7px] flex items-center justify-between">
                  <span className="text-xs font-medium text-muted">Avance</span>
                  <span className="font-mono text-xs font-bold text-ink">{s?.pct ?? 0}%</span>
                </div>
                <div className="mb-[18px]">
                  <ProgressBar pct={s?.pct ?? 0} color={p.color} />
                </div>

                <div className="flex items-center justify-between">
                  <AvatarStack personas={miembros.map((m) => ({ nombre: m.nombre, color: m.color }))} />
                  <div className="font-mono text-xs text-muted">
                    {s?.modulos ?? 0} mód · {s?.total ?? 0} tareas
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
