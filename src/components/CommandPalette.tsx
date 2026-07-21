// Paleta de comandos (Cmd/Ctrl+K): saltar a cualquier vista o proyecto, o crear,
// desde un atajo. Menos pasos para navegar. Sin estado global: se monta en Layout.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { useProyectos } from '../data/proyectos.ts'
import { useBuscarGlobal } from '../data/buscar.ts'
import { rutaTarea, volverDesde } from '../lib/navegacion.ts'

type Item = {
  id: string
  label: string
  hint: string
  color?: string
  run: () => void
}

export default function CommandPalette({
  abierto,
  onCerrar,
}: {
  abierto: boolean
  onCerrar: () => void
}) {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const [qDebounced, setQDebounced] = useState('')
  const [idx, setIdx] = useState(0)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { data: proyectos } = useProyectos()
  const inputRef = useRef<HTMLInputElement>(null)

  const cerrar = onCerrar

  useEffect(() => {
    const handler = setTimeout(() => setQDebounced(q), 150)
    return () => clearTimeout(handler)
  }, [q])

  const { data: dbResults } = useBuscarGlobal(qDebounced)

  const items = useMemo<Item[]>(() => {
    const irA = t('cmdk.irA')
    const base: Item[] = [
      { id: 'nav-hoy', label: t('nav.hoy'), hint: irA, run: () => navigate('/hoy') },
      { id: 'nav-proyectos', label: t('nav.proyectos'), hint: irA, run: () => navigate('/proyectos') },
      { id: 'nav-cal', label: t('nav.calendario'), hint: irA, run: () => navigate('/calendario') },
      { id: 'nav-mis', label: t('nav.misTareas'), hint: irA, run: () => navigate('/mis-tareas') },
      { id: 'nav-para', label: t('nav.paraMi'), hint: irA, run: () => navigate('/para-mi') },
      { id: 'nav-reu', label: t('nav.reuniones'), hint: irA, run: () => navigate('/reuniones') },
      { id: 'nav-rev', label: t('nav.revisiones'), hint: irA, run: () => navigate('/revisiones') },
      { id: 'nav-eq', label: t('nav.equipo'), hint: irA, run: () => navigate('/equipo') },
      { id: 'act-nuevo', label: t('cmdk.nuevoProyecto'), hint: t('cmdk.crear'), run: () => navigate('/proyectos?nuevo=1') },
    ]
    const term = q.trim().toLowerCase()
    
    // Si la búsqueda es muy corta, solo filtramos navegación base y proyectos cacheados
    if (term.length < 2) {
      const filteredBase = base.filter((it) => it.label.toLowerCase().includes(term))
      const filteredProys = (proyectos ?? [])
        .filter((p) => p.nombre.toLowerCase().includes(term))
        .map((p) => ({
          id: `proy-${p.id}`,
          label: p.nombre,
          hint: t('cmdk.proyecto'),
          color: p.color,
          run: () => navigate(`/proyectos/${p.id}`),
        }))
      return [...filteredBase, ...filteredProys]
    }

    const res: Item[] = []
    if (dbResults) {
      // 1. Proyectos
      dbResults.proyectos.forEach((p) => {
        res.push({
          id: `db-proy-${p.id}`,
          label: p.nombre,
          hint: t('cmdk.proyecto'),
          color: p.color,
          run: () => navigate(`/proyectos/${p.id}`),
        })
      })

      // 2. Tareas
      dbResults.tareas.forEach((tarea) => {
        res.push({
          id: `db-tarea-${tarea.id}`,
          label: tarea.titulo,
          hint: t('cmdk.tareaEn', { proyecto: tarea.proyecto_nombre, modulo: tarea.modulo_nombre }),
          color: tarea.proyecto_color,
          run: () => navigate(rutaTarea(tarea.proyecto_id, tarea.id, volverDesde(pathname))),
        })
      })

      // 3. Comentarios
      dbResults.comentarios.forEach((c) => {
        const textoCorto = c.texto.length > 50 ? `${c.texto.slice(0, 50)}...` : c.texto
        res.push({
          id: `db-com-${c.id}`,
          label: `«${textoCorto}»`,
          hint: t('cmdk.comentarioEn', { tarea: c.tarea_titulo, proyecto: c.proyecto_nombre }),
          color: c.proyecto_color,
          run: () => navigate(rutaTarea(c.proyecto_id, c.tarea_id, volverDesde(pathname))),
        })
      })

      // 4. Personas
      dbResults.personas.forEach((p) => {
        res.push({
          id: `db-pers-${p.id}`,
          label: p.nombre,
          hint: t('cmdk.miembro', { email: p.email }),
          color: p.color,
          run: () => navigate(`/equipo`),
        })
      })
    }

    return res
  }, [proyectos, dbResults, q, navigate, pathname, t])

  useEffect(() => setIdx(0), [q])
  // Al abrir: limpiar búsqueda y enfocar.
  useEffect(() => {
    if (abierto) {
      setQ('')
      setIdx(0)
      inputRef.current?.focus()
    }
  }, [abierto])

  if (!abierto) return null

  const activo = Math.min(idx, Math.max(0, items.length - 1))
  const correr = (it: Item | undefined) => {
    if (!it) return
    it.run()
    cerrar()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIdx((i) => Math.min(items.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIdx((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      correr(items[activo])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cerrar()
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-[var(--color-scrim)] p-6"
      onClick={cerrar}
    >
      <div
        role="dialog"
        aria-label={t('cmdk.paletaComandos')}
        className="mt-[12vh] w-full max-w-[520px] overflow-hidden rounded-[15px] border border-line bg-surface shadow-[var(--shadow-pop)]"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('cmdk.placeholder')}
          className="w-full border-b border-line bg-transparent px-4 py-3.5 text-[15px] text-ink outline-none placeholder:text-faint"
        />
        <div className="max-h-[50vh] overflow-auto p-1.5">
          {items.length === 0 ? (
            <div className="px-3 py-6 text-center text-[13px] text-faint">{t('cmdk.nadaCoincide')}</div>
          ) : (
            items.map((it, i) => (
              <button
                key={it.id}
                type="button"
                onMouseEnter={() => setIdx(i)}
                onClick={() => correr(it)}
                className={`flex w-full items-center gap-2.5 rounded-[9px] px-3 py-2 text-left text-sm transition-colors ${
                  i === activo ? 'bg-hover' : ''
                }`}
              >
                <span
                  className="h-2.5 w-2.5 flex-none rounded-[3px]"
                  style={{ background: it.color ?? 'var(--color-avatar-empty)' }}
                />
                <span className="flex-1 truncate font-medium text-ink">{it.label}</span>
                <span className="flex-none font-mono text-[11px] text-faint">{it.hint}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
