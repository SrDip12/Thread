// Chat de equipo del proyecto, en tiempo real. Widget flotante abajo a la derecha
// (no pelea con el panel lateral de tareas). Mensajes vía src/data/mensajes.ts.
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider.tsx'
import { usePersonas } from '../data/personas.ts'
import { useCrearMensaje, useMensajes, useRealtimeChat } from '../data/mensajes.ts'
import { Avatar } from './ui.tsx'

function hora(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
}

export default function ChatProyecto({ proyectoId, color }: { proyectoId: string; color: string }) {
  const { persona } = useAuth()
  const { data: personas } = usePersonas()
  const { data: mensajes } = useMensajes(proyectoId)
  const crear = useCrearMensaje()
  useRealtimeChat(proyectoId)

  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const finRef = useRef<HTMLDivElement>(null)

  const personaPorId = new Map((personas ?? []).map((p) => [p.id, p]))
  const lista = mensajes ?? []

  // Auto-scroll al fondo al llegar mensajes o al abrir.
  useEffect(() => {
    if (abierto) finRef.current?.scrollIntoView({ block: 'end' })
  }, [lista.length, abierto])

  const enviar = () => {
    const t = texto.trim()
    if (!t || !persona) return
    crear.mutate({ proyecto_id: proyectoId, autor_id: persona.id, texto: t })
    setTexto('')
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Abrir chat del proyecto"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_8px_24px_-6px_rgba(40,35,30,0.4)] transition-transform hover:scale-105"
        style={{ background: color }}
      >
        <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2.5 3.5h11a1 1 0 011 1v6a1 1 0 01-1 1H6l-3 2.5V11.5H2.5a1 1 0 01-1-1v-6a1 1 0 011-1z" />
        </svg>
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 flex h-[480px] w-[360px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-[15px] border border-line bg-surface shadow-[0_20px_60px_-20px_rgba(40,35,30,0.45)]">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: color }} />
          <span className="text-[14px] font-bold text-ink">Chat del equipo</span>
        </div>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          aria-label="Cerrar chat"
          className="rounded-lg p-1 text-muted transition-colors hover:bg-hover hover:text-ink"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-auto px-4 py-3.5">
        {lista.length === 0 && (
          <p className="mt-6 text-center text-[13px] text-faint">
            Sin mensajes todavía. Escribí el primero.
          </p>
        )}
        {lista.map((m) => {
          const autor = personaPorId.get(m.autor_id)
          const mio = m.autor_id === persona?.id
          return (
            <div key={m.id} className={`flex gap-2.5 ${mio ? 'flex-row-reverse' : ''}`}>
              <Avatar nombre={autor?.nombre ?? '—'} color={autor?.color ?? '#c4bdb1'} size={28} />
              <div className={`min-w-0 max-w-[74%] ${mio ? 'text-right' : ''}`}>
                <div className={`mb-0.5 flex items-center gap-1.5 text-[11px] ${mio ? 'justify-end' : ''}`}>
                  <span className="font-semibold text-ink-soft">{mio ? 'Vos' : (autor?.nombre ?? 'Alguien')}</span>
                  <span className="font-mono text-faint">{hora(m.created_at)}</span>
                </div>
                <div
                  className="inline-block break-words rounded-[12px] px-3 py-2 text-left text-[13px] leading-[1.45]"
                  style={
                    mio
                      ? { background: color, color: '#fff' }
                      : { background: 'var(--color-hover)', color: 'var(--color-ink)' }
                  }
                >
                  {m.texto}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={finRef} />
      </div>

      <div className="flex items-center gap-2 border-t border-line px-3 py-2.5">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              enviar()
            }
          }}
          placeholder="Escribí un mensaje…"
          aria-label="Mensaje"
          className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] text-ink outline-none placeholder:text-faint focus:border-brand"
        />
        <button
          type="button"
          onClick={enviar}
          disabled={!texto.trim()}
          aria-label="Enviar mensaje"
          className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ background: color }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2L7 9M14 2l-4.5 12-2.5-5-5-2.5L14 2z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
