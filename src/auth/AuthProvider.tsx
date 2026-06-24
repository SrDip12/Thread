import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase.ts'
import type { Tables } from '../lib/database.types.ts'

type Persona = Tables<'personas'>

interface AuthContextValue {
  session: Session | null
  persona: Persona | null
  cargando: boolean
  /** Falla real de la query de personas (red/permiso), distinta de "email no registrado". */
  error: string | null
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

type ResultadoPersona = { persona: Persona | null; error: string | null }

async function buscarPersona(email: string | undefined): Promise<ResultadoPersona> {
  if (!email) return { persona: null, error: null }
  const { data, error } = await supabase
    .from('personas')
    .select('*')
    .eq('email', email)
    .maybeSingle()
  if (error) return { persona: null, error: error.message }
  return { persona: data, error: null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [persona, setPersona] = useState<Persona | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let activo = true
    let userActual: string | undefined

    async function resolverSesion(nuevaSesion: Session | null) {
      const res = await buscarPersona(nuevaSesion?.user.email)
      if (!activo) return
      userActual = nuevaSesion?.user.id
      setSession(nuevaSesion)
      setPersona(res.persona)
      setError(res.error)
      setCargando(false)
    }

    supabase.auth.getSession().then(({ data }) => {
      void resolverSesion(data.session)
    })

    // Supabase emite SIGNED_IN/TOKEN_REFRESHED al volver el foco a la pestaña.
    // No tocar `cargando` acá: flipearlo desmonta <Rutas/> y pierde el estado
    // local de la vista (ej. panel de tarea abierto). Si el usuario no cambió,
    // solo refrescamos el token; no re-resolvemos persona.
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      if (nuevaSesion?.user.id === userActual) {
        setSession(nuevaSesion)
        return
      }
      void resolverSesion(nuevaSesion)
    })

    return () => {
      activo = false
      sub.subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, persona, cargando, error, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
