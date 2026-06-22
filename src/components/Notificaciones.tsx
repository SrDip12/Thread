import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.tsx'
import { usePersonas } from '../data/personas.ts'
import { useNotificaciones } from '../data/notificaciones.ts'
import { fmtRelativo } from '../lib/ui.ts'
import { Avatar } from './ui.tsx'

// "Visto hasta" por persona, en localStorage. Lo nuevo (ts > visto) cuenta como no leído.
function leerVisto(personaId: string): number {
  try {
    return Number(localStorage.getItem(`notif_visto_${personaId}`)) || 0
  } catch {
    return 0
  }
}
function guardarVisto(personaId: string, ms: number) {
  try {
    localStorage.setItem(`notif_visto_${personaId}`, String(ms))
  } catch {
    // localStorage puede fallar (modo privado); el badge igual baja en esta sesión.
  }
}

export default function Campana() {
  const navigate = useNavigate()
  const { persona } = useAuth()
  const personaId = persona?.id ?? ''
  const { data: notifs } = useNotificaciones(personaId)
  const { data: personas } = usePersonas()
  const personaPorId = new Map((personas ?? []).map((p) => [p.id, p]))

  const [abierto, setAbierto] = useState(false)
  const [visto, setVisto] = useState(() => leerVisto(personaId))

  const lista = notifs ?? []
  const noLeidas = lista.filter((n) => new Date(n.ts).getTime() > visto).length

  const abrir = () => {
    setAbierto(true)
    // Al abrir, marcamos todo como leído (el más reciente fija el corte).
    const masReciente = lista[0] ? new Date(lista[0].ts).getTime() : Date.now()
    guardarVisto(personaId, masReciente)
    setVisto(masReciente)
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
                  const autor = personaPorId.get(n.autorId)
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        setAbierto(false)
                        if (n.proyectoId) navigate(`/proyectos/${n.proyectoId}`)
                      }}
                      className="flex w-full gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-hover"
                    >
                      <Avatar nombre={autor?.nombre ?? '—'} color={autor?.color ?? '#c4bdb1'} size={26} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] leading-snug text-ink">
                          <span className="font-bold">{autor?.nombre ?? 'Alguien'}</span>{' '}
                          {n.esPregunta ? 'preguntó en' : 'comentó en'}{' '}
                          <span className="font-semibold">{n.tareaTitulo}</span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
                          <span className="inline-block h-1.5 w-1.5 flex-none rounded-[1px]" style={{ background: n.proyectoColor }} />
                          <span className="truncate">{n.proyectoNombre}</span>
                          <span className="text-[#d6cfc4]">·</span>
                          <span className="flex-none">{fmtRelativo(n.ts)}</span>
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
