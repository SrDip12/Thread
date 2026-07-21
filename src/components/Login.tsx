import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase.ts'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function entrar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    const { error: errLogin } = await supabase.auth.signInWithPassword({ email, password })
    if (errLogin) setError(errLogin.message)
    setEnviando(false)
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-canvas p-8">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-7 w-7 flex-none items-center justify-center rounded-[9px] bg-brand">
            <div className="h-2.5 w-2.5 rounded-full bg-canvas" />
          </div>
          <div className="text-base font-extrabold tracking-tight text-ink">Thread</div>
        </div>

        <h1 className="mb-1 text-lg font-semibold text-ink">Iniciar sesión</h1>
        <p className="mb-6 text-sm text-muted">Ingresá con tu email y contraseña.</p>

        <form onSubmit={entrar} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="rounded-[9px] border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="rounded-[9px] border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand"
            />
          </label>

          {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

          <button
            type="submit"
            disabled={enviando}
            className="rounded-[9px] bg-brand px-3 py-2 text-sm font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            Entrar
          </button>
        </form>

        <p className="mt-4 text-xs text-muted">
          ¿No tenés acceso? El alta de cuentas la hace un administrador del equipo.
        </p>
      </div>
    </div>
  )
}
