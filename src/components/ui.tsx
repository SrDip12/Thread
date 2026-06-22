// Componentes presentacionales reutilizables, fieles al /design. Sin lógica de datos.
import { useCallback, useState } from 'react'
import { estadoVM, iniciales, type EstadoTarea } from '../lib/ui.ts'

// Edición inline: clic para editar, Enter (input) o blur guarda, Esc cancela.
export function InlineEdit({
  value,
  onSave,
  multiline = false,
  placeholder,
  viewClassName = '',
  editClassName = '',
}: {
  value: string
  onSave: (v: string) => void
  multiline?: boolean
  placeholder?: string
  viewClassName?: string
  editClassName?: string
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value)
  // Enfoca y selecciona una sola vez al montar el campo (identidad estable).
  const focusRef = useCallback((el: HTMLInputElement | HTMLTextAreaElement | null) => {
    if (el) {
      el.focus()
      el.select()
    }
  }, [])

  const empezar = () => {
    setVal(value)
    setEditing(true)
  }
  const commit = () => {
    setEditing(false)
    const v = val.trim()
    if (!v && !multiline) return // título no puede quedar vacío
    if (v !== value.trim()) onSave(v)
  }
  const cancel = () => setEditing(false)

  if (!editing) {
    return (
      <div onClick={empezar} className={`cursor-text ${viewClassName}`}>
        {value || <span className="text-faint">{placeholder}</span>}
      </div>
    )
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      cancel()
    } else if (e.key === 'Enter' && !multiline) {
      e.preventDefault()
      commit()
    }
  }

  return multiline ? (
    <textarea
      ref={focusRef}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      rows={3}
      className={editClassName}
    />
  ) : (
    <input
      ref={focusRef}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className={editClassName}
    />
  )
}

export function Avatar({
  nombre,
  color,
  size = 26,
  ring = false,
}: {
  nombre: string
  color: string
  size?: number
  ring?: boolean
}) {
  return (
    <div
      title={nombre}
      className="flex flex-none items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        background: color || '#c4bdb1',
        fontSize: Math.max(8, Math.round(size * 0.36)),
        border: ring ? '2px solid #fff' : undefined,
      }}
    >
      {iniciales(nombre)}
    </div>
  )
}

// Pila de avatares solapados.
export function AvatarStack({
  personas,
  size = 26,
}: {
  personas: { nombre: string; color: string }[]
  size?: number
}) {
  return (
    <div className="flex">
      {personas.map((p, i) => (
        <div key={`${p.nombre}-${i}`} style={{ marginLeft: i === 0 ? 0 : -7 }}>
          <Avatar nombre={p.nombre} color={p.color} size={size} ring />
        </div>
      ))}
    </div>
  )
}

const CheckIcon = (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.5 8.5l3 3 6-6.5" />
  </svg>
)

export function EstadoChip({ estado, onClick }: { estado: EstadoTarea; onClick?: () => void }) {
  const vm = estadoVM(estado)
  return (
    <span
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation()
              onClick()
            }
          : undefined
      }
      role={onClick ? 'button' : undefined}
      title={onClick ? 'Cambiar estado' : undefined}
      className={`flex flex-none items-center gap-1.5 rounded-lg py-[3px] pl-2 pr-[9px] text-xs font-semibold ${
        onClick ? 'cursor-pointer transition-transform hover:scale-[1.03]' : ''
      }`}
      style={{ background: vm.bg, color: vm.fg, minWidth: 92 }}
    >
      {vm.done ? (
        CheckIcon
      ) : (
        <span className="inline-block h-[7px] w-[7px] rounded-full" style={{ background: vm.dot }} />
      )}
      {vm.label}
    </span>
  )
}

// Etiqueta de sección en versalitas (eyebrow).
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-faint">
      {children}
    </div>
  )
}

export function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded bg-track">
      <div className="h-full rounded" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

// Bloque de carga (shimmer). animate-pulse es nativo de Tailwind; reduced-motion lo apaga.
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-track ${className}`} />
}

// Estado vacío con icono, copy y CTA opcional. Cálido y centrado, fiel al /design.
export function EmptyState({
  icon,
  titulo,
  descripcion,
  accion,
}: {
  icon?: React.ReactNode
  titulo: string
  descripcion?: string
  accion?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[15px] border border-dashed border-line px-6 py-14 text-center">
      {icon && (
        <div className="mb-3.5 flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-brand">
          {icon}
        </div>
      )}
      <p className="m-0 text-[15px] font-bold tracking-[-0.01em] text-ink">{titulo}</p>
      {descripcion && <p className="mb-0 mt-1 max-w-[340px] text-[13px] text-muted">{descripcion}</p>}
      {accion && <div className="mt-5">{accion}</div>}
    </div>
  )
}
