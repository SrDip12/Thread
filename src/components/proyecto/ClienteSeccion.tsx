import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Tables } from '../../lib/database.types.ts'
import { estadoVM, fmtFecha } from '../../lib/ui.ts'
import { useCorreccionesCliente } from '../../data/tareas.ts'
import { useReuniones } from '../../data/reuniones.ts'
import { useClientePorProyecto, useCrearCliente, useActualizarCliente } from '../../data/clientes.ts'
import { Avatar } from '../ui.tsx'

type Persona = Tables<'personas'>

// Compuerta externa con el cliente: correcciones abiertas + último cierre con cliente.
export function CorreccionesClienteSeccion({
  proyectoId,
  personaPorId,
}: {
  proyectoId: string
  personaPorId: Map<string, Persona>
}) {
  const { t } = useTranslation()
  const { data: correcciones } = useCorreccionesCliente(proyectoId)
  const { data: reuniones } = useReuniones(proyectoId)
  const { data: cliente } = useClientePorProyecto(proyectoId)

  const lista = correcciones ?? []
  // Última reunión de tipo 'cliente' (las reuniones vienen de la más nueva a la más vieja).
  const ultimoCierre = (reuniones ?? []).find((r) => r.tipo === 'cliente') ?? null
  const fechaCierre = ultimoCierre ? fmtFecha(ultimoCierre.fecha.slice(0, 10)) : null

  return (
    <div className="mb-[30px]">
      <div className="mb-[9px] flex items-center gap-2.5 px-0.5">
        <h2 className="m-0 text-[13px] font-bold uppercase tracking-[0.02em] text-label">
          {t('proyectoDetalle.correccionesCliente')}
        </h2>
        <span className="font-mono text-[11.5px] text-faint">
          {fechaCierre
            ? t('proyectoDetalle.ultimoCierre', { fecha: fechaCierre })
            : t('proyectoDetalle.sinCierres')}
        </span>
        <div className="h-px flex-1 bg-line" />
      </div>

      <ClienteEditor proyectoId={proyectoId} cliente={cliente ?? null} />

      {lista.length === 0 ? (
        <div className="rounded-[13px] border border-dashed border-line px-4 py-3.5 text-center text-[12.5px] text-faint">
          {t('proyectoDetalle.sinCorrecciones')}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[13px] border border-line bg-surface">
          {lista.map((tarea) => {
            const vm = estadoVM(tarea.estado)
            const resp = tarea.responsable_id ? personaPorId.get(tarea.responsable_id) : undefined
            return (
              <div
                key={tarea.id}
                className="flex items-center gap-3 border-b border-line-soft px-4 py-[11px]"
              >
                <span className="h-[9px] w-[9px] flex-none rounded-full" style={{ background: vm.dot }} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{tarea.titulo}</span>
                <span
                  className="flex-none rounded-md px-[7px] py-[2px] text-[10.5px] font-bold uppercase tracking-[0.03em]"
                  style={{ background: 'var(--color-warn-tint)', color: 'var(--color-warn)' }}
                >
                  {t('revisiones.correccion')}
                </span>
                {tarea.modulos?.nombre && (
                  <span className="flex-none text-[11.5px] text-muted-soft">{tarea.modulos.nombre}</span>
                )}
                <span
                  className="flex-none rounded-md px-2 py-[2px] text-[11px] font-semibold"
                  style={{ background: vm.bg, color: vm.fg }}
                >
                  {vm.label}
                </span>
                <Avatar nombre={resp?.nombre ?? '—'} color={resp?.color ?? 'var(--color-avatar-empty)'} size={26} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Mini editor del cliente del proyecto (nombre/contacto). Autoguardado con debounce.
function ClienteEditor({
  proyectoId,
  cliente,
}: {
  proyectoId: string
  cliente: Tables<'clientes'> | null
}) {
  const { t } = useTranslation()
  const crear = useCrearCliente()
  const actualizar = useActualizarCliente()
  const [nombre, setNombre] = useState(cliente?.nombre ?? '')
  const [contacto, setContacto] = useState(cliente?.contacto ?? '')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sincroniza cuando llega/cambia el cliente del servidor.
  useEffect(() => {
    setNombre(cliente?.nombre ?? '')
    setContacto(cliente?.contacto ?? '')
  }, [cliente?.nombre, cliente?.contacto])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const guardar = (nuevoNombre: string, nuevoContacto: string) => {
    const n = nuevoNombre.trim()
    const c = nuevoContacto.trim() || null
    if (cliente) {
      actualizar.mutate({ id: cliente.id, proyectoId, cambios: { nombre: n || cliente.nombre, contacto: c } })
    } else if (n) {
      crear.mutate({ proyecto_id: proyectoId, nombre: n, contacto: c })
    }
  }

  const onChange = (campo: 'nombre' | 'contacto', valor: string) => {
    const sigNombre = campo === 'nombre' ? valor : nombre
    const sigContacto = campo === 'contacto' ? valor : contacto
    if (campo === 'nombre') setNombre(valor)
    else setContacto(valor)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => guardar(sigNombre, sigContacto), 600)
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2.5 rounded-[13px] border border-line bg-surface px-4 py-3">
      <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-label">{t('proyectoDetalle.cliente')}</span>
      <input
        value={nombre}
        onChange={(e) => onChange('nombre', e.target.value)}
        placeholder={t('proyectoDetalle.nombreCliente')}
        className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-[13px] text-ink outline-none placeholder:text-faint focus:border-brand"
      />
      <input
        value={contacto}
        onChange={(e) => onChange('contacto', e.target.value)}
        placeholder={t('proyectoDetalle.contactoCliente')}
        className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-[13px] text-ink outline-none placeholder:text-faint focus:border-brand"
      />
    </div>
  )
}
