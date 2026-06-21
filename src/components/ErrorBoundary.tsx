import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

// Excepción a "solo componentes funcionales" (CLAUDE.md): React solo soporta
// error boundaries como clases. Evita la pantalla en blanco ante un throw en render.

type Props = { children: ReactNode }
type State = { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error no controlado:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-canvas px-4">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-canvas p-8 text-center">
          <p className="mb-2 text-base font-semibold text-ink">Algo salió mal</p>
          <p className="mb-6 text-sm text-muted">
            Ocurrió un error inesperado. Probá recargar la página.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-[9px] bg-brand px-3 py-2 text-sm font-semibold text-canvas transition-opacity hover:opacity-90"
          >
            Recargar
          </button>
        </div>
      </div>
    )
  }
}
