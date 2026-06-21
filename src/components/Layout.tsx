import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.tsx'
import { useComentariosParaPo } from '../data/comentarios.ts'
import { Avatar } from './ui.tsx'

const iconProps = {
  width: 17,
  height: 17,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
} as const

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  badge?: boolean
}

const nav: NavItem[] = [
  {
    to: '/proyectos',
    label: 'Proyectos',
    icon: (
      <svg {...iconProps}>
        <rect x="2" y="2" width="5" height="5" rx="1.2" />
        <rect x="9" y="2" width="5" height="5" rx="1.2" />
        <rect x="2" y="9" width="5" height="5" rx="1.2" />
        <rect x="9" y="9" width="5" height="5" rx="1.2" />
      </svg>
    ),
  },
  {
    to: '/mis-tareas',
    label: 'Mis tareas',
    icon: (
      <svg {...iconProps} strokeLinecap="round">
        <path d="M3 4h2M3 8h2M3 12h2" />
        <path d="M8 4h5M8 8h5M8 12h5" />
      </svg>
    ),
  },
  {
    to: '/para-mi',
    label: 'Para mí',
    badge: true,
    icon: (
      <svg {...iconProps} strokeLinejoin="round">
        <path d="M4 2.5v11" strokeLinecap="round" />
        <path d="M4 3.2h8.2l-2 2.4 2 2.4H4" />
      </svg>
    ),
  },
  {
    to: '/reuniones',
    label: 'Reuniones',
    icon: (
      <svg {...iconProps}>
        <rect x="2" y="3" width="12" height="11" rx="1.6" />
        <path d="M2 6.2h12M5.2 1.8v2.4M10.8 1.8v2.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: '/revisiones',
    label: 'Revisiones',
    icon: (
      <svg {...iconProps} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 8.5l3 3 6.5-7" />
        <path d="M13 8v5.5A1.5 1.5 0 0111.5 15h-7A1.5 1.5 0 013 13.5v-9A1.5 1.5 0 014.5 3H10" />
      </svg>
    ),
  },
  {
    to: '/equipo',
    label: 'Equipo',
    icon: (
      <svg {...iconProps}>
        <circle cx="6" cy="6" r="2.4" />
        <path d="M2 13.2c0-2.2 1.8-3.6 4-3.6s4 1.4 4 3.6" />
        <path d="M10.4 4.2c1.3.2 2.2 1.1 2.2 2.2 0 .9-.5 1.6-1.3 2" />
        <path d="M11.2 9.9c1.7.2 2.8 1.4 2.8 3.3" />
      </svg>
    ),
  },
]

export default function Layout() {
  const { persona, signOut } = useAuth()
  const { data: preguntas } = useComentariosParaPo()
  const poCount = preguntas?.length ?? 0

  return (
    <div className="flex min-h-screen w-full bg-canvas">
      <aside className="sticky top-0 flex h-screen w-[248px] flex-none flex-col border-r border-line bg-canvas">
        <div className="flex items-center gap-2.5 px-[18px] pb-3.5 pt-[22px]">
          <div className="flex h-7 w-7 flex-none items-center justify-center rounded-[9px] bg-brand">
            <div className="h-[9px] w-[9px] rounded-full bg-[#faf2ee]" />
          </div>
          <div className="text-base font-extrabold tracking-[-0.02em]">Thread</div>
        </div>

        <nav className="flex flex-col gap-0.5 px-3 py-1.5">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-[11px] rounded-[9px] px-[11px] py-2 text-sm transition-colors hover:bg-hover ${
                  isActive ? 'bg-hover font-bold text-ink' : 'font-medium text-label'
                }`
              }
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {item.badge && poCount > 0 && (
                <span className="flex h-[19px] min-w-[19px] flex-none items-center justify-center rounded-[10px] bg-brand px-[5px] text-[11px] font-bold text-white">
                  {poCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto p-3">
          <div className="mt-2 flex items-center gap-2.5 border-t border-line px-[11px] pb-2 pt-3.5">
            <Avatar nombre={persona?.nombre ?? 'Yo'} color={persona?.color ?? '#c96442'} size={30} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold">{persona?.nombre ?? 'Yo'}</div>
              <div className="truncate text-[11px] text-muted">
                {persona?.rol === 'po' ? 'Product Owner' : 'Desarrollo'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              title="Cerrar sesión"
              className="flex h-7 w-7 flex-none items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-ink"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 14H3.5A1.5 1.5 0 012 12.5v-9A1.5 1.5 0 013.5 2H6" />
                <path d="M10.5 11L14 8l-3.5-3M14 8H6" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}
