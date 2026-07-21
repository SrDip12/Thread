// Alertas de reuniones. Mientras la app está abierta, revisa las reuniones con
// `alerta_min` y dispara una notificación del navegador cuando llega el momento.
// ponytail: solo avisa con una pestaña abierta. Para alertas con la app cerrada
// haría falta push real (service worker + web-push + cron en backend).

import { useEffect } from 'react'
import { useReuniones, type Reunion } from './reuniones.ts'
import i18n from '../i18n/index.ts'

// Combina `fecha` (día) + `hora` (HH:MM[:SS], opcional → 09:00) en un Date local.
// `fecha` llega como timestamptz a medianoche UTC: se toma solo la parte de día
// y se ubica en el día LOCAL; si no, en husos negativos la reunión corre un día.
export function momentoReunion(r: Pick<Reunion, 'fecha' | 'hora'>): Date {
  const dia = new Date(`${r.fecha.slice(0, 10)}T00:00:00`)
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
// Función (no const) para que las etiquetas reaccionen al cambio de idioma.
export function alertas(): { min: number | null; label: string }[] {
  const t = i18n.t
  return [
    { min: null, label: t('recordatorios.sinAlerta') },
    { min: 0, label: t('recordatorios.aLaHora') },
    { min: 10, label: t('recordatorios.min10') },
    { min: 60, label: t('recordatorios.hora1') },
    { min: 1440, label: t('recordatorios.dia1') },
  ]
}

export function etiquetaAlerta(min: number | null): string {
  return alertas().find((a) => a.min === min)?.label ?? i18n.t('recordatorios.minAntes', { min })
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
          const cuando = momentoReunion(r).toLocaleString(i18n.language?.startsWith('en') ? 'en' : 'es', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
          })
          new Notification(r.titulo, {
            body: `${i18n.t('recordatorios.notifBody', { cuando })}${r.descripcion ? `\n${r.descripcion}` : ''}`,
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
