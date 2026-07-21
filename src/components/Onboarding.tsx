import { useEffect, useLayoutEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

// Tour guiado de primer login. Sin dependencias: el spotlight es un recuadro sobre
// el elemento [data-tour=...] con un box-shadow gigante que oscurece el resto.
// Se marca como visto en localStorage; el botón "?" del sidebar lo reabre.

// v2: al renovarse la app, el tour se muestra una vez más a todos (clave nueva)
// y arranca con "qué hay de nuevo".
const CLAVE_VISTO = 'thread_onboarding_visto_v2'

// Solo la estructura (target del spotlight). Los textos (titulo/texto) salen de
// i18n por índice: onboarding.pasos[i]. Ambos arreglos van en el mismo orden.
const TARGETS: (string | null)[] = [
  null,
  '[data-tour="hoy"]',
  '[data-tour="proyectos"]',
  '[data-tour="mis-tareas"]',
  '[data-tour="para-mi"]',
  '[data-tour="reuniones"]',
  '[data-tour="calendario"]',
  '[data-tour="revisiones"]',
  '[data-tour="equipo"]',
  null,
]

type Rect = { top: number; left: number; width: number; height: number }

function rectDe(selector: string | null): Rect | null {
  if (!selector) return null
  const el = document.querySelector(selector)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

export default function Onboarding({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const { t } = useTranslation()
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)

  const pasos = t('onboarding.pasos', { returnObjects: true }) as unknown as { titulo: string; texto: string }[]
  const target = TARGETS[i]
  const paso = pasos[i]
  const total = TARGETS.length

  // Reset al índice 0 cada vez que se abre.
  useEffect(() => {
    if (abierto) setI(0)
  }, [abierto])

  // Recalcular el rect del target en cada paso y al redimensionar.
  useLayoutEffect(() => {
    if (!abierto) return
    const actualizar = () => setRect(rectDe(target))
    actualizar()
    window.addEventListener('resize', actualizar)
    return () => window.removeEventListener('resize', actualizar)
  }, [abierto, target])

  if (!abierto) return null

  const ultimo = i === total - 1
  const padding = 6

  function cerrar() {
    localStorage.setItem(CLAVE_VISTO, '1')
    onCerrar()
  }

  // Posición de la tarjeta: al lado del target (sidebar a la izquierda), o centrada.
  const cardStyle: React.CSSProperties = rect
    ? { top: Math.min(rect.top, window.innerHeight - 220), left: rect.left + rect.width + 16 }
    : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }

  return (
    <div className="fixed inset-0 z-50">
      {rect ? (
        // Spotlight: recuadro sobre el target con sombra gigante que oscurece el resto.
        <div
          className="pointer-events-none absolute rounded-[11px]"
          style={{
            top: rect.top - padding,
            left: rect.left - padding,
            width: rect.width + padding * 2,
            height: rect.height + padding * 2,
            boxShadow: '0 0 0 9999px rgba(20, 18, 16, 0.55)',
          }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: 'rgba(20, 18, 16, 0.55)' }} />
      )}

      <div
        className="absolute w-[300px] rounded-2xl border border-line bg-canvas p-5 shadow-xl"
        style={cardStyle}
      >
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">
          {t('onboarding.paso', { actual: i + 1, total })}
        </div>
        <h2 className="mb-2 text-base font-bold text-ink">{paso.titulo}</h2>
        <p className="mb-5 text-sm leading-relaxed text-muted">{paso.texto}</p>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={cerrar}
            className="text-sm font-medium text-muted transition-colors hover:text-ink"
          >
            {t('common.saltar')}
          </button>
          <div className="flex gap-2">
            {i > 0 && (
              <button
                type="button"
                onClick={() => setI((n) => n - 1)}
                className="rounded-[9px] border border-line px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-hover"
              >
                {t('common.anterior')}
              </button>
            )}
            <button
              type="button"
              onClick={() => (ultimo ? cerrar() : setI((n) => n + 1))}
              className="rounded-[9px] bg-brand px-3 py-1.5 text-sm font-semibold text-canvas transition-opacity hover:opacity-90"
            >
              {ultimo ? t('onboarding.empezar') : t('common.siguiente')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function onboardingPendiente(): boolean {
  return localStorage.getItem(CLAVE_VISTO) !== '1'
}
