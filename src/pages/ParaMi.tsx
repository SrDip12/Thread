import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  useComentariosParaPo,
  useResolverPregunta,
  useResponderPregunta,
} from '../data/comentarios.ts'
import { usePersonas } from '../data/personas.ts'
import { useAuth } from '../auth/AuthProvider.tsx'
import { Skeleton, EmptyState } from '../components/ui.tsx'
import { fmtFechaHora } from '../lib/ui.ts'
import { rutaTarea } from '../lib/navegacion.ts'

export default function ParaMi() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { persona } = useAuth()
  const { data: preguntas, isLoading } = useComentariosParaPo()
  const { data: personas } = usePersonas()
  const resolver = useResolverPregunta()
  const responder = useResponderPregunta()
  const [respuestas, setRespuestas] = useState<Record<string, string>>({})
  const personaPorId = new Map((personas ?? []).map((p) => [p.id, p]))

  const count = preguntas?.length ?? 0

  return (
    <div className="mx-auto max-w-[780px] px-11 pb-[90px] pt-10">
      <div className="mb-2 flex items-center gap-2.5">
        <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.025em]">{t('paraMi.titulo')}</h1>
        {count > 0 && (
          <span className="flex h-6 min-w-[24px] items-center justify-center rounded-xl bg-brand px-[7px] text-[13px] font-bold text-on-brand">
            {count}
          </span>
        )}
      </div>
      <p className="m-0 mb-[30px] text-sm text-muted-soft">
        {t('paraMi.subtitulo')}
      </p>

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-[13px] border border-line bg-surface px-[18px] py-[17px]">
              <Skeleton className="mb-[11px] h-3.5 w-48" />
              <div className="flex gap-3">
                <Skeleton className="h-[30px] w-[30px] flex-none rounded-full" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="mb-2 h-3.5 w-28" />
                  <Skeleton className="mb-1.5 h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && count === 0 && (
        <EmptyState
          icon={
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.5 8.5l3 3 6-6.5" />
            </svg>
          }
          titulo={t('paraMi.todoAlDia')}
          descripcion={t('paraMi.todoAlDiaDesc')}
        />
      )}

      <div className="flex flex-col gap-3">
        {(preguntas ?? []).map((q) => {
          const autor = personaPorId.get(q.autor_id)
          const tarea = q.tareas
          const proy = tarea?.modulos?.proyectos
          return (
            <div key={q.id} className="rounded-[13px] border border-line bg-surface px-[18px] py-[17px]">
              <div className="mb-[11px] flex items-center gap-2 text-xs text-muted">
                <span className="inline-block h-2 w-2 flex-none rounded-[2px]" style={{ background: proy?.color ?? 'var(--color-avatar-empty)' }} />
                <span className="font-semibold text-label">{proy?.nombre ?? t('common.proyecto')}</span>
                <span className="text-[var(--color-faint)]">/</span>
                <span>{tarea?.modulos?.nombre ?? ''}</span>
              </div>
              <div className="flex gap-3">
                <div
                  className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: autor?.color ?? 'var(--color-avatar-empty)' }}
                >
                  {(autor?.nombre ?? '—').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-baseline gap-2 text-[13px]">
                    <span className="font-bold">{autor?.nombre ?? t('paraMi.alguien')}</span>
                    {q.created_at && (
                      <span className="text-[11px] font-mono text-faint">
                        {fmtFechaHora(q.created_at)}
                      </span>
                    )}
                  </div>
                  <p className="m-0 mb-3 text-[14.5px] leading-[1.55] text-ink-soft">{q.texto}</p>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => proy && tarea && navigate(rutaTarea(proy.id, tarea.id, '/para-mi'))}
                      className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-ink-soft transition-colors hover:bg-[var(--color-hover)]"
                    >
                      <span className="text-xs text-muted">↗</span> {tarea?.titulo ?? t('common.verTarea')}
                    </button>
                    <button
                      type="button"
                      onClick={() => resolver.mutate(q.id)}
                      className="flex items-center gap-1.5 rounded-lg bg-[var(--color-ok-tint)] px-[13px] py-1.5 text-[12.5px] font-semibold text-[var(--color-ok)] transition-colors hover:bg-[var(--color-ok-line)]"
                    >
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3.5 8.5l3 3 6-6.5" />
                      </svg>
                      {t('paraMi.resuelto')}
                    </button>
                  </div>
                  {tarea && persona && (
                    <div className="mt-3 border-t border-line pt-3">
                      <textarea
                        value={respuestas[q.id] ?? ''}
                        onChange={(e) =>
                          setRespuestas((r) => ({ ...r, [q.id]: e.target.value }))
                        }
                        placeholder={t('paraMi.responderPlaceholder')}
                        rows={2}
                        className="w-full resize-none rounded-lg border border-line bg-canvas px-3 py-2 text-[13.5px] text-ink outline-none placeholder:text-muted-soft focus:border-brand"
                      />
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          disabled={!(respuestas[q.id]?.trim()) || responder.isPending}
                          onClick={() => {
                            const texto = respuestas[q.id]?.trim()
                            if (!texto) return
                            responder.mutate(
                              { preguntaId: q.id, tareaId: tarea.id, autorId: persona.id, texto },
                              {
                                onSuccess: () =>
                                  setRespuestas((r) => {
                                    const { [q.id]: _, ...resto } = r
                                    return resto
                                  }),
                              },
                            )
                          }}
                          className="rounded-lg bg-brand px-[13px] py-1.5 text-[12.5px] font-semibold text-on-brand transition-colors hover:bg-brand/90 disabled:opacity-40"
                        >
                          {t('common.responder')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
