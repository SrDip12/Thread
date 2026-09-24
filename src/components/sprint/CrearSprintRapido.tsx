import { useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useSprints, useCrearSprint } from '../../data/sprints.ts'

// Fecha ISO 'YYYY-MM-DD' LOCAL a N días de hoy (0 = hoy). No usar toISOString():
// es UTC y en husos negativos corre la fecha un día a la noche.
function fechaISO(diasOffset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + diasOffset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Crear sprint rápido ─────────────────────────────────────────────────
export function CrearSprintRapido({
  proyectoId,
  hayActivo,
  onCreado,
}: {
  proyectoId: string
  hayActivo: boolean
  onCreado: () => void
}) {
  const { t } = useTranslation()
  const { data: sprints } = useSprints(proyectoId)
  const crear = useCrearSprint()
  const [inicio, setInicio] = useState(fechaISO(0))
  const [fin, setFin] = useState(fechaISO(14))
  const [objetivo, setObjetivo] = useState('')

  const nombre = `Sprint ${(sprints?.length ?? 0) + 1}`

  const crearSprint = () => {
    crear.mutate({
      proyecto_id: proyectoId,
      nombre,
      objetivo: objetivo.trim() || null,
      fecha_inicio: inicio || null,
      fecha_fin: fin || null,
      // Si ya hay un sprint corriendo, el nuevo entra como planificado.
      estado: hayActivo ? 'planificado' : 'activo',
    })
    setObjetivo('')
    onCreado()
  }

  const onEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') crearSprint()
  }

  return (
    <div className="rounded-[13px] border border-line bg-surface p-6">
      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.04em] text-faint">
        {t('sprint.crearRapido')} {hayActivo && t('sprint.entraPlanificado')}
      </div>
      <div className="mb-5 text-[22px] font-extrabold tracking-[-0.02em]">{nombre}</div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-[13px] text-muted">
          {t('sprint.inicio')}
          <input
            type="date"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            className="rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-brand"
          />
        </label>
        <label className="flex items-center gap-2 text-[13px] text-muted">
          {t('sprint.fin')}
          <input
            type="date"
            value={fin}
            onChange={(e) => setFin(e.target.value)}
            className="rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-brand"
          />
        </label>
      </div>

      <div className="flex items-center gap-2.5 rounded-lg border border-line bg-canvas px-3.5 py-2.5">
        <input
          value={objetivo}
          onChange={(e) => setObjetivo(e.target.value)}
          onKeyDown={onEnter}
          aria-label={t('sprint.objetivoAria')}
          placeholder={t('sprint.objetivoPlaceholder')}
          className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint"
        />
        <button
          type="button"
          onClick={crearSprint}
          className="flex-none rounded-lg bg-brand px-3.5 py-1.5 text-[13px] font-semibold text-on-brand transition-opacity hover:opacity-90"
        >
          {t('common.crear')}
        </button>
      </div>
    </div>
  )
}
