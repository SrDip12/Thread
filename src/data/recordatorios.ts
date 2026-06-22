// Alertas de reuniones. Mientras la app está abierta, revisa las reuniones con
// `alerta_min` y dispara una notificación del navegador cuando llega el momento.
// ponytail: solo avisa con una pestaña abierta. Para alertas con la app cerrada
// haría falta push real (service worker + web-push + cron en backend).

import { useEffect } from 'react'
import { useReuniones, type Reunion } from './reuniones.ts'

// Combina `fecha` (día) + `hora` (HH:MM[:SS], opcional → 09:00) en un Date local.
export function momentoReunion(r: Pick<Reunion, 'fecha' | 'hora'>): Date {
  const dia = new Date(r.fecha)
  const [h, m] = (r.hora ?? '09:00').split(':')
  dia.setHours(Number(h), Number(m), 0, 0)
  return dia
}

// Ya disparada esta alerta (persistido para no repetir entre recargas).
function yaAvisada(id: string): boolean {
  try {
    return localStorage.getItem(`reunion_alerta_${id}`) === '1'
  } catch {
    return false
  }
}
function marcarAvisada(id: string) {
  try {
    localStorage.setItem(`reunion_alerta_${id}`, '1')
  } catch {
    // localStorage puede fallar (modo privado); igual no re-avisamos en esta sesión.
  }
}

// Opciones de alerta para los selects (minutos antes; null = sin alerta).
export const ALERTAS: { min: number | null; label: string }[] = [
  { min: null, label: 'Sin alerta' },
  { min: 0, label: 'A la hora' },
  { min: 10, label: '10 min antes' },
  { min: 60, label: '1 hora antes' },
  { min: 1440, label: '1 día antes' },
]

export function etiquetaAlerta(min: number | null): string {
  return ALERTAS.find((a) => a.min === min)?.label ?? `${min} min antes`
}

// Pide permiso de notificaciones (requiere gesto del usuario). Devuelve si quedó concedido.
export async function pedirPermisoNotificaciones(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  return (await Notification.requestPermission()) === 'granted'
}

export function useRecordatoriosReuniones() {
  const { data: reuniones } = useReuniones(null)

  useEffect(() => {
    if (!reuniones || typeof Notification === 'undefined') return

    const revisar = () => {
      if (Notification.permission !== 'granted') return
      const ahora = Date.now()
      for (const r of reuniones) {
        if (r.alerta_min == null || yaAvisada(r.id)) continue
        const momento = momentoReunion(r).getTime()
        const avisoEn = momento - r.alerta_min * 60_000
        // Disparamos en la ventana [avisoEn, momento]; pasada la hora, ya no.
        if (ahora >= avisoEn && ahora <= momento) {
          marcarAvisada(r.id)
          const cuando = momentoReunion(r).toLocaleString('es', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
          })
          new Notification(r.titulo, {
            body: `Reunión · ${cuando}${r.descripcion ? `\n${r.descripcion}` : ''}`,
            tag: `reunion-${r.id}`,
          })
        }
      }
    }

    revisar()
    const t = setInterval(revisar, 30_000)
    return () => clearInterval(t)
  }, [reuniones])
}
