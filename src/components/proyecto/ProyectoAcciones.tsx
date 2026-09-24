// Acciones de la cabecera del proyecto: equipo (membresías) y borrar proyecto.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { Tables } from '../../lib/database.types.ts'
import { useEliminarProyecto } from '../../data/proyectos.ts'
import { useMiembros, useAgregarMiembro, useQuitarMiembro } from '../../data/miembros.ts'
import { Avatar, AvatarStack } from '../ui.tsx'

type Persona = Tables<'personas'>

// Borrar proyecto con confirmación inline (el delete cascada borra módulos/tareas).
export function EliminarProyecto({ proyectoId, nombre }: { proyectoId: string; nombre: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const eliminar = useEliminarProyecto()
  const [confirmando, setConfirmando] = useState(false)

  if (confirmando) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[var(--color-danger-line)] bg-[var(--color-danger-tint)] px-2.5 py-1.5">
        <span className="text-[12px] font-semibold text-brand-strong">{t('proyectoDetalle.eliminarConfirm', { nombre })}</span>
        <button
          type="button"
          onClick={() => {
            eliminar.mutate(proyectoId)
            navigate('/proyectos')
          }}
          className="rounded-md bg-brand px-2 py-[3px] text-[11px] font-bold text-on-brand transition-opacity hover:opacity-90"
        >
          {t('proyectoDetalle.siEliminar')}
        </button>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="text-[11px] font-semibold text-muted transition-colors hover:text-ink"
        >
          {t('common.cancelar')}
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirmando(true)}
      title={t('proyectoDetalle.eliminarProyecto')}
      aria-label={t('proyectoDetalle.eliminarProyecto')}
      className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-lg border border-line bg-surface text-muted transition-colors hover:border-[var(--color-danger-line)] hover:bg-[var(--color-danger-tint)] hover:text-brand"
    >
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 4.5h10M6.5 4V2.8h3V4M5 4.5l.5 8.5h5l.5-8.5M6.7 6.5v5M9.3 6.5v5" />
      </svg>
    </button>
  )
}

// Equipo del proyecto: AvatarStack que abre un popover para sumar/quitar miembros
// (tabla proyecto_personas). Las personas disponibles salen del equipo global.
export function EquipoProyecto({ proyectoId, personas }: { proyectoId: string; personas: Persona[] }) {
  const { t } = useTranslation()
  const { data: miembros } = useMiembros(proyectoId)
  const agregar = useAgregarMiembro()
  const quitar = useQuitarMiembro()
  const [abierto, setAbierto] = useState(false)
  const lista = miembros ?? []
  const ids = new Set(lista.map((m) => m.id))
  const disponibles = personas.filter((p) => !ids.has(p.id))

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        title={t('proyectoDetalle.equipoProyecto')}
        className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1 transition-colors hover:bg-hover"
      >
        {lista.length > 0 ? (
          <AvatarStack personas={lista.map((m) => ({ nombre: m.nombre, color: m.color }))} size={28} />
        ) : (
          <span className="px-1 text-[13px] font-semibold text-muted">{t('proyectoDetalle.masEquipo')}</span>
        )}
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setAbierto(false)} />
          <div className="absolute right-0 top-[calc(100%+6px)] z-40 w-64 rounded-[12px] border border-line bg-surface p-3 shadow-[var(--shadow-pop)]">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.04em] text-faint">
              {t('proyectoDetalle.equipoCount', { count: lista.length })}
            </div>
            <div className="mb-2 flex flex-col gap-1">
              {lista.length === 0 && (
                <p className="px-1 py-1 text-[12.5px] text-faint">{t('proyectoDetalle.nadieTodavia')}</p>
              )}
              {lista.map((m) => (
                <div key={m.id} className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-hover">
                  <Avatar nombre={m.nombre} color={m.color} size={22} />
                  <span className="flex-1 truncate text-[13px]">{m.nombre}</span>
                  <button
                    type="button"
                    onClick={() => quitar.mutate({ proyectoId, personaId: m.id })}
                    aria-label={t('proyectoDetalle.quitarA', { nombre: m.nombre })}
                    className="flex h-5 w-5 items-center justify-center rounded text-muted transition-colors hover:bg-[var(--color-danger-tint)] hover:text-[var(--color-danger)]"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M4 4l8 8M12 4l-8 8" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            {disponibles.length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  const p = disponibles.find((d) => d.id === e.target.value)
                  if (p) agregar.mutate({ proyectoId, persona: p })
                }}
                className="w-full rounded-lg border border-line bg-canvas px-2 py-1.5 text-[13px] outline-none focus:border-brand"
              >
                <option value="">{t('proyectoDetalle.sumarPersona')}</option>
                {disponibles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>
        </>
      )}
    </div>
  )
}
