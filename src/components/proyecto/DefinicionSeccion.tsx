import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Tables } from '../../lib/database.types.ts'
import { useActualizarProyecto } from '../../data/proyectos.ts'

// Definición de producto: el norte del proyecto. Autoguardado con debounce.
export function DefinicionSeccion({ proyecto }: { proyecto: Tables<'proyectos'> }) {
  const { t } = useTranslation()
  const actualizar = useActualizarProyecto()
  const [campos, setCampos] = useState({
    que_es: proyecto.que_es ?? '',
    para_quien: proyecto.para_quien ?? '',
    problema: proyecto.problema ?? '',
    repo_url: proyecto.repo_url ?? '',
  })
  const [guardado, setGuardado] = useState<'idle' | 'guardando' | 'ok'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onChange = (campo: keyof typeof campos, valor: string) => {
    setCampos((c) => ({ ...c, [campo]: valor }))
    setGuardado('guardando')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      actualizar.mutate(
        { id: proyecto.id, cambios: { [campo]: valor.trim() || null } },
        { onSuccess: () => setGuardado('ok') },
      )
    }, 600)
  }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const fila = (
    campo: keyof typeof campos,
    label: string,
    placeholder: string,
  ) => (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.04em] text-label">{label}</span>
      <textarea
        value={campos[campo]}
        onChange={(e) => onChange(campo, e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full resize-y rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-brand"
      />
    </label>
  )

  return (
    <div className="mb-[30px]">
      <div className="mb-[9px] flex items-center gap-2.5 px-0.5">
        <h2 className="m-0 text-[13px] font-bold uppercase tracking-[0.02em] text-label">{t('proyectoDetalle.definicion')}</h2>
        <span className="font-mono text-[11.5px] text-faint">
          {guardado === 'guardando' ? t('proyectoDetalle.guardando') : guardado === 'ok' ? t('proyectoDetalle.guardado') : t('proyectoDetalle.elNorte')}
        </span>
        <div className="h-px flex-1 bg-line" />
      </div>
      <div className="space-y-3 rounded-[13px] border border-line bg-surface px-5 py-[18px]">
        {fila('que_es', t('revisiones.queEs'), t('proyectoDetalle.queEsPh'))}
        {fila('para_quien', t('revisiones.paraQuien'), t('proyectoDetalle.paraQuienPh'))}
        {fila('problema', t('revisiones.problema'), t('proyectoDetalle.problemaPh'))}
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.04em] text-label">
            {t('proyectoDetalle.repo')}
          </span>
          <input
            type="url"
            value={campos.repo_url}
            onChange={(e) => onChange('repo_url', e.target.value)}
            placeholder="https://github.com/org/repo"
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-[13px] text-ink outline-none transition-colors placeholder:text-faint focus:border-brand"
          />
          <span className="mt-1 block text-[11.5px] text-muted">{t('proyectoDetalle.repoAyuda')}</span>
        </label>
      </div>
    </div>
  )
}
