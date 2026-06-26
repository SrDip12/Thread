import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.tsx'
import { useNotificaciones, useMarcarLeida, useMarcarTodasLeidas } from '../data/notificaciones.ts'
import { useRealtimeNotificaciones } from '../data/realtime.ts'
import { fmtRelativo } from '../lib/ui.ts'
import { Avatar } from './ui.tsx'

export default function Campana() {
  const navigate = useNavigate()
  const { persona } = useAuth()
  const personaId = persona?.id ?? ''

  // Suscripción Realtime para notificaciones de la persona
  useRealtimeNotificaciones(personaId)

  const { data: notifs } = useNotificaciones(personaId)
  const marcarLeida = useMarcarLeida()
  const marcarTodasLeidas = useMarcarTodasLeidas()

  const [abierto, setAbierto] = useState(false)

  const lista = notifs ?? []
  const noLeidas = lista.filter((n) => !n.leido).length

  const abrir = () => {
    setAbierto(true)
    if (noLeidas > 0) {
      marcarTodasLeidas.mutate(personaId)
    }
  }

  return (
    <div className="relative ml-auto">
      <button
        type="button"
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        aria-label={`Notificaciones${noLeidas > 0 ? ` (${noLeidas} sin leer)` : ''}`}
        className="relative flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-ink"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 1.8a4 4 0 0 0-4 4v2.2L2.6 11h10.8L12 8V5.8a4 4 0 0 0-4-4z" />
          <path d="M6.5 13a1.5 1.5 0 0 0 3 0" />
        </svg>
        {noLeidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
            {noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAbierto(false)} />
          <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-[300px] rounded-[12px] border border-line bg-surface p-2 shadow-lg">
            <div className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-faint">
              Notificaciones
            </div>
            {lista.length === 0 ? (
              <p className="px-2 py-6 text-center text-[12.5px] text-faint">Nada nuevo por acá.</p>
            ) : (
              <div className="flex max-h-[60vh] flex-col gap-0.5 overflow-auto">
                {lista.map((n) => {
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        setAbierto(false)
                        if (!n.leido) {
                          marcarLeida.mutate({ id: n.id, personaId })
                        }
                        if (n.proyecto_id) {
                          if (n.tarea_id) {
                            navigate(`/proyectos/${n.proyecto_id}?tarea=${n.tarea_id}`)
                          } else {
                            navigate(`/proyectos/${n.proyecto_id}`)
                          }
                        }
                      }}
                      className={`flex w-full gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-hover ${
                        !n.leido ? 'bg-[#fdf6f1]/60' : ''
                      }`}
                    >
                      <Avatar nombre={n.autor_nombre} color={n.autor_color} size={26} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] leading-snug text-ink">
                          {n.tipo === 'vencimiento' ? (
                            <span className="text-muted font-normal">{n.texto}</span>
                          ) : (
                            <>
                              <span className="font-bold">{n.autor_nombre}</span>{' '}
                              {n.tipo === 'mencion' && <>te mencionó en <span className="font-semibold">{n.tarea_titulo}</span></>}
                              {n.tipo === 'pregunta' && <>te preguntó en <span className="font-semibold">{n.tarea_titulo}</span></>}
                              {n.tipo === 'comentario' && <>comentó en <span className="font-semibold">{n.tarea_titulo}</span></>}
                              {n.tipo === 'asignacion' && <>te asignó la tarea <span className="font-semibold">{n.tarea_titulo}</span></>}
                              {!['mencion', 'pregunta', 'comentario', 'asignacion'].includes(n.tipo) && n.texto}
                            </>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
                          <span className="inline-block h-1.5 w-1.5 flex-none rounded-[1px]" style={{ background: n.proyecto_color }} />
                          <span className="truncate">{n.proyecto_nombre}</span>
                          <span className="text-[#d6cfc4]">·</span>
                          <span className="flex-none">{fmtRelativo(n.created_at)}</span>
                          {!n.leido && (
                            <>
                              <span className="text-[#d6cfc4]">·</span>
                              <span className="h-1.5 w-1.5 rounded-full bg-brand flex-none" />
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

