import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fmtFechaCompleta } from '../../lib/ui.ts'
import { useDecisiones, useCrearDecisiones, useEliminarDecision } from '../../data/decisiones.ts'
import { useAuth } from '../../auth/AuthProvider.tsx'

// Registro de decisiones: qué se decidió y cuándo. Se alimenta a mano o desde la
// extracción IA de reuniones. Muestra las últimas y se expande.
export function DecisionesSeccion({ proyectoId }: { proyectoId: string }) {
  const { t } = useTranslation()
  const { persona: yo } = useAuth()
  const { data: decisiones } = useDecisiones(proyectoId)
  const crear = useCrearDecisiones()
  const eliminar = useEliminarDecision()
  const [texto, setTexto] = useState('')
  const [todas, setTodas] = useState(false)

  const lista = decisiones ?? []
  const visibles = todas ? lista : lista.slice(0, 5)

  const agregar = () => {
    const v = texto.trim()
    if (!v) return
    crear.mutate({ proyectoId, nuevas: [{ proyecto_id: proyectoId, autor_id: yo?.id ?? null, texto: v }] })
    setTexto('')
  }

  return (
    <div className="mb-[30px]">
      <div className="mb-[9px] flex items-center gap-2.5 px-0.5">
        <h2 className="m-0 text-[13px] font-bold uppercase tracking-[0.02em] text-label">{t('proyectoDetalle.decisiones')}</h2>
        <span className="font-mono text-[11.5px] text-faint">{lista.length}</span>
        <div className="h-px flex-1 bg-line" />
      </div>
      <div className="rounded-[13px] border border-line bg-surface">
        {visibles.length === 0 && (
          <p className="m-0 px-4 py-3.5 text-[13px] text-faint">{t('proyectoDetalle.sinDecisiones')}</p>
        )}
        {visibles.map((d) => (
          <div key={d.id} className="group flex items-start gap-3 border-b border-line-soft px-4 py-[11px]">
            <span className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-brand" />
            <span className="min-w-0 flex-1 text-sm leading-[1.5] text-ink">{d.texto}</span>
            <span className="flex-none font-mono text-[11px] text-faint">{fmtFechaCompleta(d.created_at)}</span>
            <button
              type="button"
              onClick={() => eliminar.mutate({ id: d.id, proyectoId })}
              aria-label={t('proyectoDetalle.eliminarDecision')}
              className="flex h-5 w-5 flex-none items-center justify-center rounded text-faint opacity-0 transition-opacity hover:text-[var(--color-danger)] group-hover:opacity-100 focus:opacity-100"
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
        ))}
        {lista.length > 5 && (
          <button
            type="button"
            onClick={() => setTodas((v) => !v)}
            className="w-full border-b border-line-soft px-4 py-2 text-left text-[12.5px] font-semibold text-muted transition-colors hover:bg-hover"
          >
            {todas ? t('proyectoDetalle.verMenos') : t('proyectoDetalle.verTodas', { count: lista.length })}
          </button>
        )}
        <div className="flex items-center gap-2.5 px-4 py-2.5">
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') agregar()
            }}
            placeholder={t('proyectoDetalle.nuevaDecision')}
            className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-faint"
          />
          {texto.trim() && <span className="flex-none font-mono text-[11px] text-faint">{t('proyectoDetalle.enterHint')}</span>}
        </div>
      </div>
    </div>
  )
}
