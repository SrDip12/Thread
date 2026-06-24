import { useState } from 'react'
import type { Tables } from '../lib/database.types.ts'
import {
  usePersonas,
  useCrearPersona,
  useActualizarPersona,
  useEliminarPersona,
} from '../data/personas.ts'
import { Avatar, Eyebrow, Skeleton, EmptyState } from '../components/ui.tsx'

type Persona = Tables<'personas'>
type Rol = Persona['rol']

const PALETA = ['#c96442', '#3f7d6e', '#5a6f8c', '#a8743a', '#8a5a9c', '#6b7d3f']

export default function Equipo() {
  const { data: personas, isLoading } = usePersonas()
  const crear = useCrearPersona()

  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState<Rol>('dev')
  const [color, setColor] = useState(PALETA[0])

  const agregar = () => {
    if (!nombre.trim() || !email.trim()) return
    crear.mutate({ nombre: nombre.trim(), email: email.trim(), rol, color })
    setNombre('')
    setEmail('')
    setRol('dev')
    setColor(PALETA[0])
  }

  return (
    <div className="mx-auto max-w-[920px] px-11 pb-[90px] pt-10">
      <div className="mb-[30px]">
        <Eyebrow>{personas?.length ?? 0} personas</Eyebrow>
        <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.025em]">Equipo</h1>
      </div>

      <div className="mb-7 flex flex-wrap items-end gap-3 rounded-[13px] border border-line bg-surface p-4">
        <Campo label="Nombre">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre y apellido"
            className="w-44 rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-sm outline-none focus:border-brand focus:bg-surface"
          />
        </Campo>
        <Campo label="Email">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@thread.app"
            className="w-52 rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-sm outline-none focus:border-brand focus:bg-surface"
          />
        </Campo>
        <Campo label="Rol">
          <select
            value={rol}
            onChange={(e) => setRol(e.target.value as Rol)}
            className="rounded-lg border border-line bg-canvas px-2 py-1.5 text-sm outline-none focus:border-brand"
          >
            <option value="dev">Desarrollo</option>
            <option value="po">Product Owner</option>
          </select>
        </Campo>
        <Campo label="Color">
          <Swatches valor={color} onChange={setColor} />
        </Campo>
        <button
          type="button"
          onClick={agregar}
          disabled={!nombre.trim() || !email.trim()}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-50"
        >
          Agregar
        </button>
      </div>

      {isLoading && (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-[15px] border border-line bg-surface p-5">
              <div className="flex items-center gap-3">
                <Skeleton className="h-[46px] w-[46px] flex-none rounded-full" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="mb-2 h-4 w-32" />
                  <Skeleton className="mb-1.5 h-3 w-40" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Skeleton className="h-8 flex-1 rounded-lg" />
                <Skeleton className="h-8 w-16 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && (personas?.length ?? 0) === 0 && (
        <EmptyState
          icon={
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="5.5" r="2.5" />
              <path d="M1.5 13.5c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" />
              <path d="M11 4.2a2.3 2.3 0 0 1 0 4.1M13 13.5c0-1.9-1-3.2-2.6-3.8" />
            </svg>
          }
          titulo="Todavía no hay nadie en el equipo"
          descripcion="Agregá a la primera persona con el formulario de arriba."
        />
      )}

      {!isLoading && (personas?.length ?? 0) > 0 && (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
          {(personas ?? []).map((p) => (
            <PersonaCard key={p.id} persona={p} />
          ))}
        </div>
      )}
    </div>
  )
}

function PersonaCard({ persona }: { persona: Persona }) {
  const actualizar = useActualizarPersona()
  const eliminar = useEliminarPersona()
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(persona.nombre)
  const [email, setEmail] = useState(persona.email)
  const [rol, setRol] = useState<Rol>(persona.rol)
  const [color, setColor] = useState(persona.color)

  const guardar = () => {
    actualizar.mutate({
      id: persona.id,
      cambios: { nombre: nombre.trim(), email: email.trim(), rol, color },
    })
    setEditando(false)
  }

  if (editando) {
    return (
      <div className="rounded-[15px] border border-line bg-surface p-5">
        <div className="flex flex-col gap-2.5">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-sm outline-none focus:border-brand"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-sm outline-none focus:border-brand"
          />
          <select
            value={rol}
            onChange={(e) => setRol(e.target.value as Rol)}
            className="rounded-lg border border-line bg-canvas px-2 py-1.5 text-sm outline-none focus:border-brand"
          >
            <option value="dev">Desarrollo</option>
            <option value="po">Product Owner</option>
          </select>
          <Swatches valor={color} onChange={setColor} />
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={guardar}
              className="flex-1 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-strong"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-hover"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-[15px] border border-line bg-surface p-5">
      <div className="flex items-center gap-3">
        <Avatar nombre={persona.nombre} color={persona.color} size={46} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[15.5px] font-bold tracking-[-0.01em]">{persona.nombre}</span>
            {persona.rol === 'po' && (
              <span className="rounded-md bg-brand-tint px-1.5 py-px text-[10px] font-bold text-brand-deep">PO</span>
            )}
          </div>
          <div className="truncate text-[12.5px] text-muted-soft">{persona.email}</div>
          <div className="text-[12px] text-muted">{persona.rol === 'po' ? 'Product Owner' : 'Desarrollo'}</div>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="flex-1 rounded-lg border border-line px-3 py-1.5 text-[13px] font-semibold text-ink-soft transition-colors hover:bg-hover"
        >
          Editar
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm(`¿Eliminar a ${persona.nombre}?`)) eliminar.mutate(persona.id)
          }}
          className="rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-muted transition-colors hover:bg-[#fbeee9] hover:text-[#b5532f]"
        >
          Eliminar
        </button>
      </div>
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-faint">{label}</span>
      {children}
    </label>
  )
}

function Swatches({ valor, onChange }: { valor: string; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-1.5">
      {PALETA.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="h-6 w-6 rounded-md transition-transform hover:scale-110"
          style={{ background: c, outline: valor === c ? '2px solid #1c1b19' : 'none', outlineOffset: 1 }}
          aria-label={`Color ${c}`}
        />
      ))}
    </div>
  )
}
