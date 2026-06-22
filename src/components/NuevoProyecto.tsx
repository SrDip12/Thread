// Modal de creación de proyecto. Opcionalmente toma un .md (requisitos / RF) que
// la IA analiza y separa en módulos + tareas; el usuario revisa antes de crear
// (nada se crea sin revisión, como el resto de la app).
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { COLORES_PROYECTO } from '../lib/ui.ts'
import { analizarProyecto, type ModuloPropuesto } from '../lib/analizarProyecto.ts'
import { useCrearProyecto } from '../data/proyectos.ts'
import { useCrearModulo } from '../data/modulos.ts'
import { useCrearTarea } from '../data/tareas.ts'

export default function NuevoProyecto({ onCerrar }: { onCerrar: () => void }) {
  const navigate = useNavigate()
  const crearProyecto = useCrearProyecto()
  const crearModulo = useCrearModulo()
  const crearTarea = useCrearTarea()

  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [color, setColor] = useState<string>(COLORES_PROYECTO[0])
  const [docTexto, setDocTexto] = useState('')
  const [docNombre, setDocNombre] = useState('')
  const [modulos, setModulos] = useState<ModuloPropuesto[] | null>(null)
  const [analizando, setAnalizando] = useState(false)
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState('')

  const tieneDoc = docTexto.trim() !== ''
  const totalTareas = (modulos ?? []).reduce((n, m) => n + m.tareas.length, 0)

  const leerArchivo = async (file: File | undefined) => {
    if (!file) return
    setError('')
    setModulos(null)
    setDocNombre(file.name)
    setDocTexto(await file.text())
  }

  const analizar = async () => {
    setError('')
    setAnalizando(true)
    try {
      const propuesta = await analizarProyecto(docTexto)
      if (propuesta.length === 0) {
        setError('La IA no encontró módulos ni tareas en el documento.')
      }
      setModulos(propuesta)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo analizar el documento.')
    } finally {
      setAnalizando(false)
    }
  }

  const quitarModulo = (i: number) =>
    setModulos((ms) => (ms ?? []).filter((_, idx) => idx !== i))
  const quitarTarea = (im: number, it: number) =>
    setModulos((ms) =>
      (ms ?? []).map((m, idx) =>
        idx === im ? { ...m, tareas: m.tareas.filter((_, j) => j !== it) } : m,
      ),
    )

  const crear = async () => {
    if (!nombre.trim()) return
    setError('')
    setCreando(true)
    try {
      // Si hay doc sin analizar, analizalo antes de crear (no se pierde el RF).
      let propuesta = modulos
      if (propuesta === null && tieneDoc) {
        propuesta = await analizarProyecto(docTexto)
        setModulos(propuesta)
      }
      const proyecto = await crearProyecto.mutateAsync({
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        color,
      })
      // Crea módulos y sus tareas en orden (operación única, no perf-crítica).
      let orden = 0
      for (const m of propuesta ?? []) {
        const modulo = await crearModulo.mutateAsync({
          proyecto_id: proyecto.id,
          nombre: m.nombre,
          descripcion: m.descripcion,
          orden: orden++,
        })
        for (const t of m.tareas) {
          await crearTarea.mutateAsync({ modulo_id: modulo.id, titulo: t.titulo })
        }
      }
      navigate(`/proyectos/${proyecto.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el proyecto.')
      setCreando(false)
    }
  }

  const ocupado = analizando || creando

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-[rgba(28,27,25,0.4)] p-6"
      onClick={onCerrar}
    >
      <div
        className="mt-[6vh] w-full max-w-[560px] rounded-[15px] border border-line bg-surface p-6 shadow-[0_20px_60px_-20px_rgba(40,35,30,0.4)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="m-0 text-[20px] font-extrabold tracking-[-0.02em]">Nuevo proyecto</h2>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg p-1 text-muted transition-colors hover:text-ink"
            aria-label="Cerrar"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        <label className="mb-1 block text-[12.5px] font-semibold text-muted">Nombre</label>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre del proyecto"
          autoFocus
          className="mb-4 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand placeholder:text-faint"
        />

        <label className="mb-1 block text-[12.5px] font-semibold text-muted">Descripción</label>
        <input
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Una línea (opcional)"
          className="mb-4 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand placeholder:text-faint"
        />

        <label className="mb-1.5 block text-[12.5px] font-semibold text-muted">Color</label>
        <div className="mb-5 flex gap-2.5">
          {COLORES_PROYECTO.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="h-7 w-7 rounded-full transition-transform hover:scale-110"
              style={{
                background: c,
                outline: color === c ? `2px solid ${c}` : 'none',
                outlineOffset: 2,
              }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>

        <label className="mb-1.5 block text-[12.5px] font-semibold text-muted">
          Documento de requisitos (.md) — opcional
        </label>
        <div className="mb-2 flex items-center gap-3">
          <label className="cursor-pointer rounded-lg border border-line bg-canvas px-3 py-1.5 text-[13px] font-semibold text-muted transition-colors hover:border-brand hover:text-brand">
            {docNombre ? 'Cambiar archivo' : 'Elegir archivo'}
            <input
              type="file"
              accept=".md,.markdown,.txt,text/markdown,text/plain"
              className="hidden"
              onChange={(e) => void leerArchivo(e.target.files?.[0])}
            />
          </label>
          {docNombre && <span className="truncate text-[13px] text-muted-soft">{docNombre}</span>}
        </div>
        {tieneDoc && modulos === null && (
          <button
            type="button"
            onClick={() => void analizar()}
            disabled={ocupado}
            className="mb-4 rounded-lg bg-brand px-3.5 py-1.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {analizando ? 'Analizando…' : 'Analizar con IA'}
          </button>
        )}

        {modulos !== null && (
          <div className="mb-4 mt-1">
            <div className="mb-2 text-[12.5px] font-semibold text-muted">
              Propuesta de la IA · {modulos.length} módulos · {totalTareas} tareas
              <span className="ml-2 font-normal text-faint">Revisá y quitá lo que no quieras.</span>
            </div>
            <div className="flex max-h-[40vh] flex-col gap-3 overflow-auto rounded-[11px] border border-line bg-canvas p-3">
              {modulos.length === 0 && (
                <span className="text-[13px] text-faint">Sin módulos. Podés crear el proyecto vacío.</span>
              )}
              {modulos.map((m, im) => (
                <div key={im} className="rounded-lg border border-line-soft bg-surface p-2.5">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="flex-1 text-sm font-bold text-ink">{m.nombre}</span>
                    <button
                      type="button"
                      onClick={() => quitarModulo(im)}
                      className="text-[12px] font-semibold text-faint transition-colors hover:text-brand"
                    >
                      Quitar módulo
                    </button>
                  </div>
                  {m.tareas.map((t, it) => (
                    <div key={it} className="flex items-center gap-2 py-0.5 pl-3">
                      <span className="flex-1 text-[13px] text-muted-soft">{t.titulo}</span>
                      <button
                        type="button"
                        onClick={() => quitarTarea(im, it)}
                        className="text-faint transition-colors hover:text-brand"
                        aria-label="Quitar tarea"
                      >
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                          <path d="M4 4l8 8M12 4l-8 8" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <div className="mb-3 text-[13px] text-brand">{error}</div>}

        <div className="flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg border border-line px-4 py-2 text-[13px] font-semibold text-muted transition-colors hover:text-ink"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void crear()}
            disabled={!nombre.trim() || ocupado}
            className="rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {creando
              ? 'Creando…'
              : totalTareas > 0
                ? `Crear proyecto · ${totalTareas} tareas`
                : 'Crear proyecto'}
          </button>
        </div>
      </div>
    </div>
  )
}
