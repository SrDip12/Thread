// "Cartera": todos los proyectos en una pantalla con su salud — avance, vencidas,
// cuello de botella en revisión, trabajo sin dueño, tasa de corrección y, sobre todo,
// días sin actividad (el mejor predictor de un proyecto que se está muriendo).
// Pensada para la reunión semanal de socios: lo rojo arriba.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useProyectos } from '../data/proyectos.ts'
import { usePersonas } from '../data/personas.ts'
import { useSaludProyectos } from '../data/cartera.ts'
import { diasDesde, semaforo, DIAS_ESTANCADO, type Semaforo } from '../lib/salud.ts'
import { Avatar, EmptyState, Eyebrow, ProgressBar, Skeleton } from '../components/ui.tsx'

const ORDEN_SEMAFORO: Record<Semaforo, number> = { rojo: 0, ambar: 1, verde: 2 }

const COLOR_SEMAFORO: Record<Semaforo, { fg: string; bg: string }> = {
  rojo: { fg: 'var(--color-danger)', bg: 'var(--color-danger-tint)' },
  ambar: { fg: 'var(--color-warn)', bg: 'var(--color-warn-tint)' },
  verde: { fg: 'var(--color-ok)', bg: 'var(--color-ok-tint)' },
}

export default function Cartera() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: proyectos, isLoading: cargandoProyectos } = useProyectos()
  const { data: salud, isLoading: cargandoSalud, error } = useSaludProyectos()
  const { data: personas } = usePersonas()
  const [todos, setTodos] = useState(false)

  const personaPorId = new Map((personas ?? []).map((p) => [p.id, p]))
  const saludPorId = new Map((salud ?? []).map((s) => [s.proyecto_id, s]))

  const filas = (proyectos ?? [])
    .filter((p) => todos || p.estado === 'activo')
    .flatMap((p) => {
      const s = saludPorId.get(p.id)
      return s ? [{ p, s, luz: semaforo(s), inactivo: diasDesde(s.ultima_actividad) }] : []
    })
    .sort(
      (a, b) =>
        ORDEN_SEMAFORO[a.luz] - ORDEN_SEMAFORO[b.luz] || (b.inactivo ?? 0) - (a.inactivo ?? 0),
    )

  const conteo = { rojo: 0, ambar: 0, verde: 0 }
  for (const f of filas) conteo[f.luz]++

  const cargando = cargandoProyectos || cargandoSalud

  return (
    <div className="mx-auto max-w-[1120px] px-4 sm:px-6 lg:px-11 pb-20 pt-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>{t('cartera.eyebrow', { count: filas.length })}</Eyebrow>
          <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.025em]">{t('cartera.titulo')}</h1>
          <p className="mt-[7px] text-sm text-muted-soft">{t('cartera.subtitulo', { dias: DIAS_ESTANCADO })}</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-muted">
          <input
            type="checkbox"
            checked={todos}
            onChange={(e) => setTodos(e.target.checked)}
            className="h-[15px] w-[15px] accent-brand"
          />
          {t('cartera.incluirInactivos')}
        </label>
      </div>

      {!cargando && filas.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {(['rojo', 'ambar', 'verde'] as const).map((luz) => (
            <span
              key={luz}
              className="rounded-lg px-2.5 py-1 text-[12px] font-semibold"
              style={{ color: COLOR_SEMAFORO[luz].fg, background: COLOR_SEMAFORO[luz].bg }}
            >
              {t(`cartera.luz_${luz}`, { count: conteo[luz] })}
            </span>
          ))}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-[10px] border border-[var(--color-danger-line)] bg-[var(--color-danger-tint)] px-3 py-2.5 text-[13px] text-[var(--color-danger)]">
          {t('cartera.errCargar')}
        </div>
      )}

      {cargando && (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[96px] rounded-[13px]" />
          ))}
        </div>
      )}

      {!cargando && !error && filas.length === 0 && (
        <EmptyState
          icon={
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 13.5h12" />
              <path d="M4 11V8M7 11V4.5M10 11V6.5M13 11V9" />
            </svg>
          }
          titulo={t('cartera.vacio')}
          descripcion={t('cartera.vacioDesc')}
        />
      )}

      <div className="flex flex-col gap-3">
        {filas.map(({ p, s, luz, inactivo }) => {
          const pct = s.total ? Math.round((s.hechas / s.total) * 100) : 0
          const tasaCorreccion = s.total ? Math.round((s.correcciones / s.total) * 100) : 0
          const vision = p.responsable_vision_id ? personaPorId.get(p.responsable_vision_id) : undefined
          const c = COLOR_SEMAFORO[luz]
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => navigate(`/proyectos/${p.id}`)}
              className="grid w-full gap-4 rounded-[13px] border border-line bg-surface px-[18px] py-4 text-left transition-colors hover:bg-row-hover md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.6fr)] md:items-center"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: c.fg }} title={t(`cartera.estado_${luz}`)} />
                <span className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: p.color }} />
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-bold tracking-[-0.01em]">{p.nombre}</div>
                  <div className="flex items-center gap-1.5 text-[12px] text-muted">
                    {vision ? (
                      <>
                        <Avatar nombre={vision.nombre} color={vision.color} size={16} />
                        <span className="truncate">{vision.nombre}</span>
                      </>
                    ) : (
                      <span className="text-[var(--color-warn)]">{t('cartera.sinResponsable')}</span>
                    )}
                    {p.estado !== 'activo' && <span className="text-faint">· {t(`cartera.proyecto_${p.estado}`)}</span>}
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between text-[12px]">
                  <span className="text-muted">{t('cartera.avance', { hechas: s.hechas, total: s.total })}</span>
                  <span className="font-mono font-bold">{pct}%</span>
                </div>
                <ProgressBar pct={pct} color={p.color} />
              </div>

              <div className="flex flex-wrap gap-1.5 font-mono text-[11.5px]">
                <Metrica
                  label={t('cartera.inactivo', { count: inactivo ?? 0 })}
                  alerta={(inactivo ?? 0) >= DIAS_ESTANCADO}
                />
                <Metrica label={t('cartera.vencidas', { count: s.vencidas })} alerta={s.vencidas > 0} ocultarCero={s.vencidas === 0} />
                <Metrica label={t('cartera.enRevision', { count: s.en_revision })} aviso={s.en_revision > 2} ocultarCero={s.en_revision === 0} />
                <Metrica label={t('cartera.sinAsignar', { count: s.sin_asignar })} aviso={s.sin_asignar > 0} ocultarCero={s.sin_asignar === 0} />
                <Metrica label={t('cartera.alta', { count: s.alta_abiertas })} ocultarCero={s.alta_abiertas === 0} />
                <Metrica label={t('cartera.correccion', { pct: tasaCorreccion })} aviso={tasaCorreccion >= 30} ocultarCero={s.correcciones === 0} />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Metrica({
  label,
  alerta = false,
  aviso = false,
  ocultarCero = false,
}: {
  label: string
  alerta?: boolean
  aviso?: boolean
  ocultarCero?: boolean
}) {
  if (ocultarCero) return null
  const estilo = alerta
    ? { color: 'var(--color-danger)', background: 'var(--color-danger-tint)' }
    : aviso
      ? { color: 'var(--color-warn)', background: 'var(--color-warn-tint)' }
      : { color: 'var(--color-muted)', background: 'var(--color-neutral-tint)' }
  return (
    <span className="rounded px-1.5 py-[2px] font-semibold" style={estilo}>
      {label}
    </span>
  )
}
