import { useEffect, useLayoutEffect, useState } from 'react'

// Tour guiado de primer login. Sin dependencias: el spotlight es un recuadro sobre
// el elemento [data-tour=...] con un box-shadow gigante que oscurece el resto.
// Se marca como visto en localStorage; el botón "?" del sidebar lo reabre.

const CLAVE_VISTO = 'thread_onboarding_visto'

type Paso = {
  target: string | null // selector [data-tour]; null = paso centrado sin spotlight
  titulo: string
  texto: string
}

const PASOS: Paso[] = [
  {
    target: null,
    titulo: 'Bienvenido a Thread',
    texto:
      'Tu espacio para gestionar proyectos, tareas y reuniones del equipo. Te muestro las secciones en 1 minuto.',
  },
  {
    target: '[data-tour="proyectos"]',
    titulo: 'Proyectos',
    texto:
      'Cada proyecto se divide en módulos, y cada módulo en tareas. Entrá a un proyecto para ver las filas de tareas y abrir el panel lateral con el detalle de cada una.',
  },
  {
    target: '[data-tour="mis-tareas"]',
    titulo: 'Mis tareas',
    texto: 'Todo lo que tenés asignado a vos, de todos los proyectos, en una sola lista.',
  },
  {
    target: '[data-tour="para-mi"]',
    titulo: 'Para mí',
    texto:
      'Preguntas y comentarios marcados para el Product Owner. El número del badge indica cuántos están sin resolver.',
  },
  {
    target: '[data-tour="reuniones"]',
    titulo: 'Reuniones',
    texto:
      'Registrá las notas de una reunión y la IA extrae las acciones concretas como tareas propuestas. Las revisás (responsable, módulo, fecha) antes de crearlas.',
  },
  {
    target: '[data-tour="revisiones"]',
    titulo: 'Revisiones',
    texto:
      'La compuerta de calidad: módulos en revisión que se aprueban o se devuelven, y el feedback del cliente que entra como correcciones.',
  },
  {
    target: '[data-tour="equipo"]',
    titulo: 'Equipo',
    texto: 'Las personas del equipo. Los Product Owner pueden dar de alta y editar a sus integrantes.',
  },
  {
    target: null,
    titulo: '¡Listo!',
    texto: 'Eso es todo. Podés volver a ver este recorrido cuando quieras con el botón "?" del menú.',
  },
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
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)

  const paso = PASOS[i]

  // Reset al índice 0 cada vez que se abre.
  useEffect(() => {
    if (abierto) setI(0)
  }, [abierto])

  // Recalcular el rect del target en cada paso y al redimensionar.
  useLayoutEffect(() => {
    if (!abierto) return
    const actualizar = () => setRect(rectDe(paso.target))
    actualizar()
    window.addEventListener('resize', actualizar)
    return () => window.removeEventListener('resize', actualizar)
  }, [abierto, paso.target])

  if (!abierto) return null

  const ultimo = i === PASOS.length - 1
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
          {i + 1} / {PASOS.length}
        </div>
        <h2 className="mb-2 text-base font-bold text-ink">{paso.titulo}</h2>
        <p className="mb-5 text-sm leading-relaxed text-muted">{paso.texto}</p>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={cerrar}
            className="text-sm font-medium text-muted transition-colors hover:text-ink"
          >
            Saltar
          </button>
          <div className="flex gap-2">
            {i > 0 && (
              <button
                type="button"
                onClick={() => setI((n) => n - 1)}
                className="rounded-[9px] border border-line px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-hover"
              >
                Anterior
              </button>
            )}
            <button
              type="button"
              onClick={() => (ultimo ? cerrar() : setI((n) => n + 1))}
              className="rounded-[9px] bg-brand px-3 py-1.5 text-sm font-semibold text-canvas transition-opacity hover:opacity-90"
            >
              {ultimo ? 'Empezar' : 'Siguiente'}
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
